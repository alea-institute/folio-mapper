/**
 * Browser-side encrypted key vault using Web Crypto API.
 * AES-256-GCM encryption with PBKDF2-derived key from user passphrase.
 */

const VAULT_PREFIX = 'folio-mapper-vault-';
const VAULT_META_KEY = 'folio-mapper-vault-meta';
const CANARY_KEY = 'folio-mapper-vault-canary';
const CANARY_PLAINTEXT = 'folio-mapper-vault-check';
const PBKDF2_ITERATIONS = 100_000;

export interface VaultPayload {
  salt: string;   // base64-encoded 16-byte salt
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

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptKey(plaintext: string, passphrase: string): Promise<VaultPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    cipher: toBase64(cipher),
  };
}

export async function decryptKey(payload: VaultPayload, passphrase: string): Promise<string> {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const cipher = fromBase64(payload.cipher);
  const key = await deriveKey(passphrase, salt);
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

/** Store a canary value encrypted with the passphrase for quick validation. */
export async function storeCanary(passphrase: string): Promise<void> {
  const payload = await encryptKey(CANARY_PLAINTEXT, passphrase);
  localStorage.setItem(CANARY_KEY, JSON.stringify(payload));
}

/** Validate passphrase by decrypting the stored canary. Returns true if correct. */
export async function validateCanary(passphrase: string): Promise<boolean> {
  const raw = localStorage.getItem(CANARY_KEY);
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw) as VaultPayload;
    const result = await decryptKey(payload, passphrase);
    return result === CANARY_PLAINTEXT;
  } catch {
    return false;
  }
}

/** Returns true if a canary exists (vault has been initialized). */
export function hasCanary(): boolean {
  return localStorage.getItem(CANARY_KEY) !== null;
}
