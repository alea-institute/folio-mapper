import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  encryptKeyDevice,
  decryptKeyDevice,
  storeEncryptedKey,
  loadEncryptedKey,
  removeEncryptedKey,
  clearVault,
  getVaultMeta,
  hasLegacyVault,
} from './key-vault';
import { hasDeviceKey, clearDeviceKey } from './device-key';

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  });
  // Fresh IndexedDB per test so the device key is regenerated
  vi.stubGlobal('indexedDB', new IDBFactory());
});

describe('key-vault (device key)', () => {
  it('encrypts and decrypts a key roundtrip', async () => {
    const payload = await encryptKeyDevice('sk-test-12345');
    expect(payload.iv).toBeTruthy();
    expect(payload.cipher).toBeTruthy();
    expect(payload.salt).toBeUndefined();

    const result = await decryptKeyDevice(payload);
    expect(result).toBe('sk-test-12345');
  });

  it('generates the device key on first use and reuses it', async () => {
    expect(await hasDeviceKey()).toBe(false);
    await encryptKeyDevice('sk-1');
    expect(await hasDeviceKey()).toBe(true);
  });

  it('fails to decrypt once the device key is cleared', async () => {
    const payload = await encryptKeyDevice('sk-secret');
    await clearDeviceKey();
    // A fresh device key is generated and cannot decrypt the old ciphertext
    await expect(decryptKeyDevice(payload)).rejects.toThrow();
  });

  it('fails to decrypt a tampered payload', async () => {
    const payload = await encryptKeyDevice('sk-secret');
    const tampered = { ...payload, cipher: payload.cipher.slice(0, -4) + 'AAAA' };
    await expect(decryptKeyDevice(tampered)).rejects.toThrow();
  });

  it('stores and loads encrypted keys', async () => {
    const payload = await encryptKeyDevice('sk-openai-key');
    storeEncryptedKey('openai', payload);

    const loaded = loadEncryptedKey('openai');
    expect(loaded).not.toBeNull();
    expect(loaded!.cipher).toBe(payload.cipher);
  });

  it('returns null for missing key', () => {
    expect(loadEncryptedKey('nonexistent')).toBeNull();
  });

  it('tracks providers in vault meta', async () => {
    storeEncryptedKey('openai', await encryptKeyDevice('key1'));
    storeEncryptedKey('anthropic', await encryptKeyDevice('key2'));

    const meta = getVaultMeta();
    expect(meta.providers).toContain('openai');
    expect(meta.providers).toContain('anthropic');
  });

  it('removes a key and updates meta', async () => {
    storeEncryptedKey('openai', await encryptKeyDevice('key1'));
    removeEncryptedKey('openai');

    expect(loadEncryptedKey('openai')).toBeNull();
    expect(getVaultMeta().providers).not.toContain('openai');
  });

  it('clears entire vault including legacy canary', async () => {
    storeEncryptedKey('openai', await encryptKeyDevice('key1'));
    storeEncryptedKey('anthropic', await encryptKeyDevice('key2'));
    localStorage.setItem('folio-mapper-vault-canary', '{}');

    clearVault();

    expect(getVaultMeta().providers).toEqual([]);
    expect(loadEncryptedKey('openai')).toBeNull();
    expect(loadEncryptedKey('anthropic')).toBeNull();
    expect(hasLegacyVault()).toBe(false);
  });

  it('detects a legacy passphrase vault via its canary', () => {
    expect(hasLegacyVault()).toBe(false);
    localStorage.setItem('folio-mapper-vault-canary', '{"some":"payload"}');
    expect(hasLegacyVault()).toBe(true);
  });
});
