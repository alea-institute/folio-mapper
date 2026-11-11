/**
 * Auto-generated, non-extractable device key for passwordless key encryption.
 *
 * A single AES-256-GCM `CryptoKey` is generated once with `extractable: false`
 * and persisted as a `CryptoKey` object in IndexedDB (structured clone preserves
 * non-extractable keys). The raw key material never exists in JS or localStorage,
 * so the encrypted API-key payloads in localStorage cannot be decrypted without
 * this browser's IndexedDB-bound key — and no passphrase is ever required.
 */

const DB_NAME = 'folio-mapper-keyvault';
const STORE_NAME = 'device-key';
const KEY_ID = 'aesKey';
let deviceKeyGeneration = 0;
let creation: Promise<CryptoKey> | null = null;
let clearing: Promise<void> = Promise.resolve();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch (error) {
          db.close();
          reject(error);
          return;
        }
        let result: T;
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('Device key transaction aborted'));
        };
        try {
          const req = fn(tx.objectStore(STORE_NAME));
          req.onsuccess = () => { result = req.result; };
        } catch (error) {
          tx.abort();
          reject(error);
        }
      }),
  );
}

/**
 * Returns the device key, generating and persisting it on first use.
 * Rejects if IndexedDB or Web Crypto is unavailable (callers degrade to
 * session-only manual entry).
 */
export async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  if (creation) return creation;
  const generation = deviceKeyGeneration;
  const assertCurrent = () => {
    if (generation !== deviceKeyGeneration) throw new Error('Device key creation was cleared');
  };
  // Share only in-flight work. A later call must read persisted state again.
  const pending = (async () => {
    await clearing;
    assertCurrent();
    const existing = await withStore<CryptoKey | undefined>('readonly', (s) => s.get(KEY_ID));
    assertCurrent();
    if (existing) return existing;

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable — raw bytes never leave IndexedDB
      ['encrypt', 'decrypt'],
    );
    await withStore('readwrite', (s) => {
      assertCurrent();
      return s.put(key, KEY_ID);
    });
    assertCurrent();
    return key;
  })().finally(() => {
    // An obsolete completion must not release a newer generation's flight.
    if (creation === pending) creation = null;
  });
  creation = pending;
  return pending;
}

/** Returns true if a device key has already been generated. */
export async function hasDeviceKey(): Promise<boolean> {
  try {
    const existing = await withStore<CryptoKey | undefined>('readonly', (s) => s.get(KEY_ID));
    return !!existing;
  } catch {
    return false;
  }
}

/** Deletes the device key, rendering any stored ciphertext permanently unreadable. */
export async function clearDeviceKey(): Promise<void> {
  deviceKeyGeneration++;
  creation = null;
  // New requests wait for every queued deletion before reading or creating.
  clearing = clearing.then(async () => {
    await withStore('readwrite', (s) => s.delete(KEY_ID));
  }).catch(() => {
    // IndexedDB unavailable — nothing to clear
  });
  await clearing;
}
