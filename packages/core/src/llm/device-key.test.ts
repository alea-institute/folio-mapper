import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getOrCreateDeviceKey, hasDeviceKey, clearDeviceKey } from './device-key';

beforeEach(() => {
  // Fresh IndexedDB per test = a clean "browser"
  vi.stubGlobal('indexedDB', new IDBFactory());
});

describe('device-key', () => {
  it('generates a non-extractable AES-GCM key', async () => {
    const key = await getOrCreateDeviceKey();
    expect(key.type).toBe('secret');
    expect(key.extractable).toBe(false);
    expect((key.algorithm as AesKeyAlgorithm).name).toBe('AES-GCM');
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('returns the same persisted key across calls (survives "reload")', async () => {
    const first = await getOrCreateDeviceKey();
    const enc = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(12) },
      first,
      new TextEncoder().encode('hello'),
    );
    // Simulate a fresh app load — same IndexedDB, new getOrCreate call
    const second = await getOrCreateDeviceKey();
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(12) }, second, enc);
    expect(new TextDecoder().decode(dec)).toBe('hello');
  });

  it('reports presence and clears', async () => {
    expect(await hasDeviceKey()).toBe(false);
    await getOrCreateDeviceKey();
    expect(await hasDeviceKey()).toBe(true);
    await clearDeviceKey();
    expect(await hasDeviceKey()).toBe(false);
  });

  it('hasDeviceKey returns false when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await hasDeviceKey()).toBe(false);
  });
});
