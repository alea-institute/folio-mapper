export type LLMProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'cohere'
  | 'meta_llama'
  | 'ollama'
  | 'lmstudio'
  | 'custom'
  | 'groq'
  | 'xai'
  | 'github_models'
  | 'llamafile';

export type ConnectionStatus = 'untested' | 'valid' | 'invalid';

export type KeySource = 'none' | 'env' | 'keychain' | 'saved' | 'manual';

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  connectionStatus: ConnectionStatus;
  keySource: KeySource;
  rememberKey: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  context_window: number | null;
}

export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  model: string | null;
  /** Machine-readable failure category (e.g. 'auth', 'model_unavailable', 'quota'). */
  reason?: string | null;
}

export interface ModelProbeResult {
  model: string;
  available: boolean;
  reason?: string | null;
}

/** Failure categories specific to the chosen model — other models may still work. */
export const MODEL_SPECIFIC_REASONS = ['model_unavailable', 'access', 'bad_request'];

export interface ProviderMeta {
  type: LLMProviderType;
  displayName: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
  isLocal: boolean;
}
