import { useEffect, useRef, useState } from 'react';
import type { LLMProviderType } from '@folio-mapper/core';
import {
  fetchKeyStatus,
  getVaultMeta,
  loadEncryptedKey,
  decryptKeyDevice,
  hasLegacyVault,
  clearVault,
} from '@folio-mapper/core';
import { useLLMStore } from '../store/llm-store';

/**
 * Resolves API keys on startup from multiple sources in priority order:
 * 1. Env vars (server-side — key never reaches browser)
 * 2. OS keychain (desktop only — Electron safeStorage)
 * 3. Device-key vault (web only — AES-GCM, silently unlocked via a non-extractable
 *    IndexedDB key; no passphrase)
 * 4. Manual entry (session-only)
 */
export function useKeyResolution() {
  const hasRun = useRef(false);
  // True for the session if a legacy passphrase vault was found and cleared —
  // the UI surfaces a one-time "re-enter your key once" notice.
  const [legacyVaultCleared, setLegacyVaultCleared] = useState(false);
  const updateConfig = useLLMStore((s) => s.updateConfig);
  const setKeySource = useLLMStore((s) => s.setKeySource);

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

      // Layer 3: Device-key vault (web only — skip if desktop)
      if (!window.desktop) {
        // One-time migration: a legacy passphrase vault can't be read without the
        // (now removed) passphrase, so clear it and prompt for re-entry once.
        if (hasLegacyVault()) {
          clearVault();
          setLegacyVaultCleared(true);
        }

        const meta = getVaultMeta();
        for (const provider of meta.providers) {
          if (resolved.has(provider)) continue; // env wins
          const payload = loadEncryptedKey(provider);
          if (!payload) continue;
          try {
            const key = await decryptKeyDevice(payload);
            updateConfig(provider as LLMProviderType, { apiKey: key });
            setKeySource(provider as LLMProviderType, 'saved');
            resolved.add(provider);
          } catch {
            // Device key missing/corrupt — treat as unsaved; user re-enters.
          }
        }
      }
    };

    resolve();
  }, [updateConfig, setKeySource]);

  return { legacyVaultCleared };
}
