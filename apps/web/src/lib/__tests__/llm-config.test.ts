import { describe, it, expect } from 'vitest';
import type { LLMProviderConfig, LLMProviderType } from '@folio-mapper/core';
import { resolveLlmConfig } from '../llm-config';

/**
 * Guards the demo cost invariant at its decision seam. The demo-mode-no-network
 * test proves *loading* a demo is free; this proves that once a demo session is
 * active, every downstream candidate-fetch path (mandatory fallback, search,
 * pipeline) is denied an LLM config regardless of a saved/valid key — so demos
 * never burn tokens after load, which was the live bug.
 */
function makeConfig(overrides: Partial<LLMProviderConfig> = {}): LLMProviderConfig {
  return {
    apiKey: 'sk-real-key',
    baseUrl: '',
    model: 'claude-opus-4-7',
    connectionStatus: 'valid',
    keySource: 'manual',
    rememberKey: true,
    ...overrides,
  };
}

function makeConfigs(active: LLMProviderConfig): Record<LLMProviderType, LLMProviderConfig> {
  return { anthropic: active } as Record<LLMProviderType, LLMProviderConfig>;
}

describe('resolveLlmConfig', () => {
  it('returns null in a demo session even with a valid key (zero token cost)', () => {
    const configs = makeConfigs(makeConfig({ connectionStatus: 'valid', apiKey: 'sk-real-key' }));
    expect(resolveLlmConfig('anthropic', configs, true)).toBeNull();
  });

  it('returns the config when not a demo and the provider is valid', () => {
    const configs = makeConfigs(makeConfig({ connectionStatus: 'valid' }));
    expect(resolveLlmConfig('anthropic', configs, false)).toEqual({
      provider: 'anthropic',
      api_key: 'sk-real-key',
      base_url: null,
      model: 'claude-opus-4-7',
    });
  });

  it('returns null when not a demo but the provider is not validated', () => {
    const configs = makeConfigs(makeConfig({ connectionStatus: 'untested' }));
    expect(resolveLlmConfig('anthropic', configs, false)).toBeNull();
  });

  it('coerces empty optional fields to null', () => {
    const configs = makeConfigs(makeConfig({ baseUrl: '', model: '' }));
    const result = resolveLlmConfig('anthropic', configs, false);
    expect(result).not.toBeNull();
    expect(result?.base_url).toBeNull();
    expect(result?.model).toBeNull();
  });
});
