import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encryptKey,
  decryptKey,
  storeEncryptedKey,
  loadEncryptedKey,
  removeEncryptedKey,
  clearVault,
  getVaultMeta,
  storeCanary,
  validateCanary,
  hasCanary,
} from './key-vault';

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  });
});

describe('key-vault', () => {
  it('encrypts and decrypts a key roundtrip', async () => {
    const payload = await encryptKey('sk-test-12345', 'mypassphrase');
    expect(payload.salt).toBeTruthy();
    expect(payload.iv).toBeTruthy();
    expect(payload.cipher).toBeTruthy();

    const result = await decryptKey(payload, 'mypassphrase');
    expect(result).toBe('sk-test-12345');
  });

  it('throws on wrong passphrase', async () => {
    const payload = await encryptKey('sk-test-12345', 'correct-pass');
    await expect(decryptKey(payload, 'wrong-pass')).rejects.toThrow();
  });

  it('stores and loads encrypted keys', async () => {
    const payload = await encryptKey('sk-openai-key', 'pass');
    storeEncryptedKey('openai', payload);

    const loaded = loadEncryptedKey('openai');
    expect(loaded).not.toBeNull();
    expect(loaded!.cipher).toBe(payload.cipher);
  });

  it('returns null for missing key', () => {
    expect(loadEncryptedKey('nonexistent')).toBeNull();
  });

  it('tracks providers in vault meta', async () => {
    const p1 = await encryptKey('key1', 'pass');
    const p2 = await encryptKey('key2', 'pass');
    storeEncryptedKey('openai', p1);
    storeEncryptedKey('anthropic', p2);

    const meta = getVaultMeta();
    expect(meta.providers).toContain('openai');
    expect(meta.providers).toContain('anthropic');
  });

  it('removes a key and updates meta', async () => {
    const payload = await encryptKey('key1', 'pass');
    storeEncryptedKey('openai', payload);
    removeEncryptedKey('openai');

    expect(loadEncryptedKey('openai')).toBeNull();
    expect(getVaultMeta().providers).not.toContain('openai');
  });

  it('clears entire vault', async () => {
    const p1 = await encryptKey('key1', 'pass');
    const p2 = await encryptKey('key2', 'pass');
    storeEncryptedKey('openai', p1);
    storeEncryptedKey('anthropic', p2);
    await storeCanary('pass');

    clearVault();

    expect(getVaultMeta().providers).toEqual([]);
    expect(loadEncryptedKey('openai')).toBeNull();
    expect(loadEncryptedKey('anthropic')).toBeNull();
    expect(hasCanary()).toBe(false);
  });

  it('canary validates correct passphrase', async () => {
    await storeCanary('mypassphrase');
    expect(hasCanary()).toBe(true);
    expect(await validateCanary('mypassphrase')).toBe(true);
  });

  it('canary rejects wrong passphrase', async () => {
    await storeCanary('correct');
    expect(await validateCanary('wrong')).toBe(false);
  });

  it('canary returns false when not set', async () => {
    expect(hasCanary()).toBe(false);
    expect(await validateCanary('any')).toBe(false);
  });
});
