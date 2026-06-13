/**
 * Browser-side encrypted key vault.
 *
 * API keys are encrypted with AES-256-GCM using a non-extractable device key
 * (see ./device-key). No passphrase is involved: keys are encrypted once and
 * silently restored every session. Ciphertext lives in localStorage; the
 * encryption key lives only in IndexedDB.
 */

import { getOrCreateDeviceKey } from './device-key';

const VAULT_PREFIX = 'folio-mapper-vault-';
const VAULT_META_KEY = 'folio-mapper-vault-meta';
/** Legacy passphrase-vault marker — retained only so we can detect and clear it. */
const CANARY_KEY = 'folio-mapper-vault-canary';

export interface VaultPayload {
  /** base64-encoded 16-byte salt. Vestigial for device-key payloads (legacy passphrase vaults only). */
  salt?: string;
  iv: string;     // base64-encoded 12-byte IV
  cipher: string; // base64-encoded ciphertext
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Encrypt a plaintext API key with the browser's device key. */
export async function encryptKeyDevice(plaintext: string): Promise<VaultPayload> {
  const key = await getOrCreateDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { iv: toBase64(iv), cipher: toBase64(cipher) };
}

/** Decrypt a payload with the browser's device key. Rejects if the key is missing or the payload is tampered. */
export async function decryptKeyDevice(payload: VaultPayload): Promise<string> {
  const key = await getOrCreateDeviceKey();
  const iv = fromBase64(payload.iv);
  const cipher = fromBase64(payload.cipher);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

export function storeEncryptedKey(provider: string, payload: VaultPayload): void {
  localStorage.setItem(`${VAULT_PREFIX}${provider}`, JSON.stringify(payload));
  updateMeta(provider, 'add');
}

export function loadEncryptedKey(provider: string): VaultPayload | null {
  const raw = localStorage.getItem(`${VAULT_PREFIX}${provider}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultPayload;
  } catch {
    return null;
  }
}

export function removeEncryptedKey(provider: string): void {
  localStorage.removeItem(`${VAULT_PREFIX}${provider}`);
  updateMeta(provider, 'remove');
}

export function clearVault(): void {
  const meta = getVaultMeta();
  for (const p of meta.providers) {
    localStorage.removeItem(`${VAULT_PREFIX}${p}`);
  }
  localStorage.removeItem(VAULT_META_KEY);
  localStorage.removeItem(CANARY_KEY);
}

export function getVaultMeta(): { providers: string[] } {
  const raw = localStorage.getItem(VAULT_META_KEY);
  if (!raw) return { providers: [] };
  try {
    return JSON.parse(raw) as { providers: string[] };
  } catch {
    return { providers: [] };
  }
}

function updateMeta(provider: string, action: 'add' | 'remove'): void {
  const meta = getVaultMeta();
  const set = new Set(meta.providers);
  if (action === 'add') set.add(provider);
  else set.delete(provider);
  localStorage.setItem(VAULT_META_KEY, JSON.stringify({ providers: [...set] }));
}

/**
 * Returns true if a legacy passphrase vault exists (it has a canary).
 * Such vaults are undecryptable without the removed passphrase, so callers
 * clear them once and prompt for re-entry.
 */
export function hasLegacyVault(): boolean {
  return localStorage.getItem(CANARY_KEY) !== null;
}
