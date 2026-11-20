import { useCallback, useEffect, useRef, useState } from 'react';
import { encryptKeyDevice, removeEncryptedKey, storeEncryptedKey, type LLMProviderType } from '@folio-mapper/core';
import type { KeySaveStatus } from '@folio-mapper/ui';
import { useLLMStore } from '../store/llm-store';

type SaveAttempt = {
  key: string;
  automaticStarted: boolean;
  pending: number;
  failed: boolean;
  outcome?: Promise<boolean>;
  finish?: (saved: boolean) => void;
};
const SAVE_ERROR = "Couldn't finish saving this key in your browser. It is still usable in this session. Try Save (encrypted) again before closing.";

/** Owns transient save outcomes; rememberKey remains only the user's preference. */
export function useBrowserKeyPersistence(isDesktop: boolean) {
  const configs = useLLMStore((state) => state.configs);
  const attempts = useRef<Partial<Record<LLMProviderType, SaveAttempt>>>({});
  const [statuses, setStatuses] = useState<Partial<Record<LLMProviderType, KeySaveStatus>>>({});
  const publish = useCallback((provider: LLMProviderType, status: KeySaveStatus) => {
    setStatuses((current) => {
      const previous = current[provider];
      if (previous?.pending === status.pending && previous?.error === status.error) return current;
      return { ...current, [provider]: status };
    });
  }, []);

  const invalidate = useCallback((provider: LLMProviderType) => {
    attempts.current[provider]?.finish?.(false);
    delete attempts.current[provider];
    publish(provider, {});
  }, [publish]);

  // Observe edits synchronously, including changing away and back before React renders.
  useEffect(() => useLLMStore.subscribe((state, previous) => {
    if (state.configs === previous.configs) return;
    for (const provider of Object.keys(state.configs) as LLMProviderType[]) {
      const next = state.configs[provider];
      const prior = previous.configs[provider];
      if (next.apiKey !== prior.apiKey || (prior.rememberKey && !next.rememberKey) ||
          (next.keySource === 'manual' && prior.connectionStatus === 'valid' && next.connectionStatus !== 'valid') ||
          (next.keySource !== prior.keySource && (next.keySource === 'manual' || next.keySource === 'none'))) {
        invalidate(provider);
      }
    }
  }), [invalidate]);

  const getAttempt = useCallback((provider: LLMProviderType) => {
    return attempts.current[provider] ??= {
      key: useLLMStore.getState().configs[provider].apiKey,
      automaticStarted: false, pending: 0, failed: false,
    };
  }, []);

  const startSave = useCallback((provider: LLMProviderType, attempt: SaveAttempt) => {
    if (!attempt.pending) {
      attempt.failed = false;
      attempt.outcome = new Promise<boolean>((resolve) => { attempt.finish = resolve; });
    }
    attempt.pending++;
    publish(provider, { pending: true });
    const isCurrent = () => {
      const current = useLLMStore.getState().configs[provider];
      return attempts.current[provider] === attempt && current.apiKey === attempt.key &&
        current.rememberKey && current.connectionStatus === 'valid';
    };
    void (async () => {
      try {
        const payload = await encryptKeyDevice(attempt.key);
        if (!isCurrent()) return;
        const state = useLLMStore.getState();
        if (state.configs[provider].keySource !== 'saved') {
          storeEncryptedKey(provider, payload);
          state.setKeySource(provider, 'saved');
        }
        attempt.finish?.(true);
      } catch {
        if (isCurrent()) attempt.failed = true;
      } finally {
        attempt.pending--;
        if (attempts.current[provider] !== attempt) return;
        const saved = useLLMStore.getState().configs[provider].keySource === 'saved';
        publish(provider, saved ? {} : {
          pending: attempt.pending > 0,
          error: !attempt.pending && attempt.failed ? SAVE_ERROR : undefined,
        });
        if (!attempt.pending) attempt.finish?.(saved);
      }
    })();
    return attempt.outcome!;
  }, [publish]);

  const canSave = useCallback((provider: LLMProviderType) => {
    const config = useLLMStore.getState().configs[provider];
    return !isDesktop && config.apiKey && config.rememberKey &&
      config.connectionStatus === 'valid' && config.keySource === 'manual';
  }, [isDesktop]);

  useEffect(() => {
    for (const provider of Object.keys(configs) as LLMProviderType[]) {
      if (!canSave(provider)) continue;
      const attempt = getAttempt(provider);
      if (attempt.automaticStarted) continue;
      attempt.automaticStarted = true;
      void startSave(provider, attempt);
    }
  }, [configs, canSave, getAttempt, startSave]);

  const remember = useCallback((provider: LLMProviderType, rememberKey: boolean): Promise<boolean> => {
    const state = useLLMStore.getState();
    state.updateConfig(provider, { rememberKey });
    if (!rememberKey) {
      invalidate(provider);
      removeEncryptedKey(provider);
      if (state.configs[provider].keySource === 'saved') {
        state.setKeySource(provider, state.configs[provider].apiKey ? 'manual' : 'none');
      }
      return Promise.resolve(false);
    }
    if (!canSave(provider)) return Promise.resolve(state.configs[provider].keySource === 'saved');
    return startSave(provider, getAttempt(provider));
  }, [canSave, getAttempt, invalidate, startSave]);

  const ensureSaved = useCallback((provider: LLMProviderType): Promise<boolean> => {
    const config = useLLMStore.getState().configs[provider];
    if (!config.apiKey || config.keySource !== 'manual') return Promise.resolve(true);
    if (!canSave(provider)) return Promise.resolve(false);
    const attempt = getAttempt(provider);
    if (attempt.pending) return attempt.outcome!;
    if (attempt.automaticStarted) return Promise.resolve(false);
    attempt.automaticStarted = true;
    return startSave(provider, attempt);
  }, [canSave, getAttempt, startSave]);

  return { statuses, remember, ensureSaved, invalidate };
}
