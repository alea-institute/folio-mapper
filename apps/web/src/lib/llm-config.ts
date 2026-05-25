import type { LLMProviderConfig, LLMProviderType, PipelineRequestConfig } from '@folio-mapper/core';

/**
 * Resolve the LLM config for a backend call from the active provider.
 *
 * Demos must cost zero tokens. When `isDemoSession` is true we return `null`
 * regardless of any saved/valid key — this forces every candidate-fetch path
 * (mandatory-branch fallback, manual search, the pipeline) down its free,
 * symbolic branch. Loading a demo payload is already network-free; this guard
 * closes the post-load leak where viewing or searching a demo would otherwise
 * rebuild a live `llmConfig` from a persisted key and burn tokens.
 */
export function resolveLlmConfig(
  activeProvider: LLMProviderType,
  configs: Record<LLMProviderType, LLMProviderConfig>,
  isDemoSession: boolean,
): PipelineRequestConfig | null {
  if (isDemoSession) return null;

  const active = configs[activeProvider];
  if (active?.connectionStatus !== 'valid') return null;

  return {
    provider: activeProvider,
    api_key: active.apiKey || null,
    base_url: active.baseUrl || null,
    model: active.model || null,
  };
}
