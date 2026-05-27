import type { ConnectionTestResponse, LLMProviderType, ModelInfo, ModelProbeResult } from './types';
import { baseHeaders, buildAuthHeaders } from '../auth';

const BASE_URL = '/api/llm';

export async function testConnection(
  provider: LLMProviderType,
  apiKey?: string,
  baseUrl?: string,
  model?: string,
): Promise<ConnectionTestResponse> {
  const res = await fetch(`${BASE_URL}/test-connection`, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify({
      provider,
      base_url: baseUrl || null,
      model: model || null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Connection test failed' }));
    throw new Error(err.detail || `Connection test failed (${res.status})`);
  }

  return res.json();
}

export async function probeModels(
  provider: LLMProviderType,
  models: string[],
  apiKey?: string,
  baseUrl?: string,
): Promise<ModelProbeResult[]> {
  const res = await fetch(`${BASE_URL}/probe-models`, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify({
      provider,
      base_url: baseUrl || null,
      models,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to probe models' }));
    throw new Error(err.detail || `Failed to probe models (${res.status})`);
  }

  const data = await res.json();
  return data.results as ModelProbeResult[];
}

export async function fetchKeyStatus(): Promise<{ env_providers: string[] }> {
  const res = await fetch(`${BASE_URL}/key-status`, { headers: baseHeaders() });
  if (!res.ok) {
    throw new Error('Failed to fetch key status');
  }
  return res.json();
}

export async function fetchKnownModels(): Promise<Record<string, ModelInfo[]>> {
  const res = await fetch(`${BASE_URL}/known-models`, { headers: baseHeaders() });
  if (!res.ok) {
    throw new Error('Failed to fetch known models');
  }
  return res.json();
}

export async function fetchModels(
  provider: LLMProviderType,
  apiKey?: string,
  baseUrl?: string,
): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE_URL}/models`, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify({
      provider,
      base_url: baseUrl || null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch models' }));
    throw new Error(err.detail || `Failed to fetch models (${res.status})`);
  }

  return res.json();
}
