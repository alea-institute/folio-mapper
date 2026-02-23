import type { EmbeddingStatus } from './types';
import { baseHeaders } from '../auth';

const BASE_URL = '/api/embedding';

export async function fetchEmbeddingStatus(): Promise<EmbeddingStatus> {
  const res = await fetch(`${BASE_URL}/status`, { headers: baseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch embedding status (${res.status})`);
  }

  return res.json();
}

export async function warmupEmbedding(): Promise<EmbeddingStatus> {
  const res = await fetch(`${BASE_URL}/warmup`, { method: 'POST', headers: baseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to warmup embedding index (${res.status})`);
  }

  return res.json();
}
