import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { getOrCreateDeviceKey, hasDeviceKey, clearDeviceKey } from './device-key';

beforeEach(() => {
  // Fresh IndexedDB per test = a clean "browser"
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => vi.restoreAllMocks());

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function expectCompatible(keys: CryptoKey[]) {
  const iv = new Uint8Array(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, keys[0], new TextEncoder().encode('shared secret'),
  );
  for (const key of keys) {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    expect(new TextDecoder().decode(plaintext)).toBe('shared secret');
  }
}

describe('device-key', () => {
  it.each(['first use', 'after clear'])('shares concurrent creation on %s', async (scenario) => {
    if (scenario === 'after clear') {
      await getOrCreateDeviceKey();
      await clearDeviceKey();
    }
    const started = deferred();
    const release = deferred();
    const generate = crypto.subtle.generateKey.bind(crypto.subtle);
    const generation = vi.spyOn(crypto.subtle, 'generateKey').mockImplementation(async (...args) => {
      const key = await generate(...args);
      started.resolve();
      await release.promise;
      return key;
    });
    const first = getOrCreateDeviceKey();
    await started.promise;
    const others = [getOrCreateDeviceKey(), getOrCreateDeviceKey()];
    expect(await hasDeviceKey()).toBe(false);
    release.resolve();
    const keys = await Promise.all([first, ...others]);
    await expectCompatible([...keys, await getOrCreateDeviceKey()]);
    expect(generation).toHaveBeenCalledTimes(1);
  });

  it('retries after generation fails instead of retaining a rejected flight', async () => {
    vi.spyOn(crypto.subtle, 'generateKey').mockRejectedValueOnce(new Error('generation unavailable'));
    await expect(getOrCreateDeviceKey()).rejects.toThrow('generation unavailable');
    expect(await hasDeviceKey()).toBe(false);
    await getOrCreateDeviceKey();
    expect(await hasDeviceKey()).toBe(true);
  });

  it('orders repeated clears before new creation and keeps obsolete cleanup out of the new flight', async () => {
    const oldStarted = deferred();
    const oldRelease = deferred();
    const newStarted = deferred();
    const newRelease = deferred();
    const generate = crypto.subtle.generateKey.bind(crypto.subtle);
    const generation = vi.spyOn(crypto.subtle, 'generateKey')
      .mockImplementationOnce(async (...args) => {
        const key = await generate(...args);
        oldStarted.resolve();
        await oldRelease.promise;
        return key;
      })
      .mockImplementationOnce(async (...args) => {
        const key = await generate(...args);
        newStarted.resolve();
        await newRelease.promise;
        return key;
      });
    const obsolete = getOrCreateDeviceKey();
    const rejected = expect(obsolete).rejects.toThrow('cleared');
    await oldStarted.promise;

    // Suspend the first deletion before its transaction starts, while keeping real IDB operations.
    const deleting = deferred();
    let releaseDeletion!: () => void;
    const open = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementationOnce((...args) => {
      const request = open(...args);
      request.addEventListener('success', (event) => {
        event.stopImmediatePropagation();
        releaseDeletion = () => request.onsuccess!.call(request, event);
        deleting.resolve();
      });
      return request;
    });
    const firstClear = clearDeviceKey();
    await deleting.promise;
    const secondClear = clearDeviceKey();
    const current = getOrCreateDeviceKey();
    expect(await hasDeviceKey()).toBe(false);
    expect(generation).toHaveBeenCalledTimes(1);
    releaseDeletion();
    await Promise.all([firstClear, secondClear]);
    await newStarted.promise;
    oldRelease.resolve();
    await rejected;
    const peer = getOrCreateDeviceKey();
    newRelease.resolve();
    const keys = await Promise.all([current, peer]);
    await expectCompatible([...keys, await getOrCreateDeviceKey()]);
    expect(generation).toHaveBeenCalledTimes(2);
  });

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

  it('does not persist a generation that finished after clearing, but allows a new generation', async () => {
    const realKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const generating = new Promise<void>((resolve) => { started = resolve; });
    vi.spyOn(crypto.subtle, 'generateKey').mockImplementationOnce(async () => {
      started();
      await gate;
      return realKey;
    });
    const pending = getOrCreateDeviceKey();
    await generating;
    await clearDeviceKey();
    const rejected = expect(pending).rejects.toThrow();
    release();
    await rejected;
    expect(await hasDeviceKey()).toBe(false);
    await getOrCreateDeviceKey();
    expect(await hasDeviceKey()).toBe(true);
  });

  it('rejects a write transaction aborted after its request succeeded', async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(getOrCreateDeviceKey()).rejects.toThrow();
    expect(await hasDeviceKey()).toBe(false);
    await getOrCreateDeviceKey();
    expect(await hasDeviceKey()).toBe(true);
  });
});
