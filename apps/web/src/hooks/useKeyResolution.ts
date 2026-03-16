import { useEffect, useRef, useState } from 'react';
import type { KeySource, LLMProviderType } from '@folio-mapper/core';
import {
  fetchKeyStatus,
  getVaultMeta,
  loadEncryptedKey,
  decryptKey,
  hasCanary,
  validateCanary,
} from '@folio-mapper/core';
import { useLLMStore } from '../store/llm-store';

/**
 * Resolves API keys on startup from multiple sources in priority order:
 * 1. Env vars (server-side — key never reaches browser)
 * 2. OS keychain (desktop only — Electron safeStorage)
 * 3. Browser vault (web only — AES-GCM encrypted in localStorage)
 * 4. Manual entry (session-only — current default)
 */
export function useKeyResolution() {
  const hasRun = useRef(false);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const updateConfig = useLLMStore((s) => s.updateConfig);
  const setKeySource = useLLMStore((s) => s.setKeySource);
  const configs = useLLMStore((s) => s.configs);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const resolve = async () => {
      const resolved = new Set<string>();

      // Layer 1: Env var check
      try {
        const { env_providers } = await fetchKeyStatus();
        for (const provider of env_providers) {
          setKeySource(provider as LLMProviderType, 'env');
          resolved.add(provider);
        }
      } catch {
        // Backend unavailable — skip env check
      }

      // Layer 2: OS keychain (desktop only)
      const keychain = window.desktop?.keychain;
      if (keychain) {
        try {
          const available = await keychain.isAvailable();
          if (available) {
            const providers = await keychain.listProviders();
            for (const provider of providers) {
              if (resolved.has(provider)) continue; // env wins
              const key = await keychain.getKey(provider);
              if (key) {
                updateConfig(provider as LLMProviderType, { apiKey: key });
                setKeySource(provider as LLMProviderType, 'keychain');
                resolved.add(provider);
              }
            }
          }
        } catch {
          // Keychain unavailable
        }
      }

      // Layer 3: Browser vault (web only — skip if desktop)
      if (!window.desktop && hasCanary()) {
        const meta = getVaultMeta();
        if (meta.providers.length > 0) {
          // Check if any vault providers still need resolution
          const needsVault = meta.providers.some((p) => !resolved.has(p));
          if (needsVault) {
            setNeedsPassphrase(true);
          }
        }
      }
    };

    resolve();
  }, [updateConfig, setKeySource, configs]);

  const unlockVault = async (passphrase: string): Promise<boolean> => {
    setPassphraseError(null);

    const valid = await validateCanary(passphrase);
    if (!valid) {
      setPassphraseError('Incorrect passphrase');
      return false;
    }

    const meta = getVaultMeta();
    for (const provider of meta.providers) {
      const payload = loadEncryptedKey(provider);
      if (!payload) continue;
      try {
        const key = await decryptKey(payload, passphrase);
        updateConfig(provider as LLMProviderType, { apiKey: key });
        setKeySource(provider as LLMProviderType, 'saved');
      } catch {
        // Individual key decrypt failed — skip
      }
    }

    setNeedsPassphrase(false);
    return true;
  };

  const dismissPassphrase = () => {
    setNeedsPassphrase(false);
    setPassphraseError(null);
  };

  return {
    needsPassphrase,
    passphraseError,
    unlockVault,
    dismissPassphrase,
  };
}
