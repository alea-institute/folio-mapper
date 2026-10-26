import { test, expect } from './fixtures/browser';
import { KEYS } from './fixtures/offline-api';
import { card, keyInput, save, settings, storage, validate } from './helpers/key-vault';

for (const damage of ['device key missing', 'ciphertext damaged', 'payload missing'] as const) {
  test(`${damage} permits manual recovery without a passphrase`, async ({ session }) => {
    await session.visit();
    await settings(session.page);
    await save(session);
    await session.backup();
    await settings(session.page);
    await expect(keyInput(session.page)).toHaveValue(KEYS.first);
    await session.page.evaluate(async (damage) => {
      if (damage === 'device key missing') {
        await new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('folio-mapper-keyvault');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('device-key', 'readwrite');
            tx.objectStore('device-key').delete('aesKey');
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onabort = () => { db.close(); reject(tx.error); };
          };
        });
      } else if (damage === 'ciphertext damaged') {
        const payload = JSON.parse(localStorage.getItem('folio-mapper-vault-anthropic')!);
        const bytes = Uint8Array.from(atob(payload.cipher), (c) => c.charCodeAt(0));
        bytes[0] ^= 1;
        payload.cipher = btoa(String.fromCharCode(...bytes));
        localStorage.setItem('folio-mapper-vault-anthropic', JSON.stringify(payload));
      } else localStorage.removeItem('folio-mapper-vault-anthropic');
    }, damage);
    await session.page.reload();
    await settings(session.page);
    await expect(keyInput(session.page)).toHaveValue('');
    await expect(card(session.page).getByText('Key saved', { exact: true })).toHaveCount(0);
    await expect(session.page.getByText(/passphrase/i)).toHaveCount(0);
    await save(session, 'replacement');
    await session.restart();
    await settings(session.page);
    await expect(keyInput(session.page)).toHaveValue(KEYS.replacement);
    await validate(session, 'replacement');
  });
}

for (const fault of ['device database', 'vault payload'] as const) {
  test(`${fault} failure remains session-only and supports re-entry`, async ({ session }) => {
    session.expectedConsoleErrors = [/^Failed to save key to vault:/];
    await session.visit();
    await session.backup();
    await settings(session.page);
    await session.page.evaluate((fault) => {
      Object.assign(window, { __faultHits: 0 });
      if (fault === 'device database') {
        const original = indexedDB.open.bind(indexedDB);
        indexedDB.open = function (name, version) {
          if (name === 'folio-mapper-keyvault') {
            (window as any).__faultHits++;
            throw new DOMException('Synthetic device database failure', 'SecurityError');
          }
          return original(name, version);
        };
      } else {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (this === localStorage && name === 'folio-mapper-vault-anthropic') {
            (window as any).__faultHits++;
            throw new DOMException('Synthetic vault write failure', 'QuotaExceededError');
          }
          return original.call(this, name, value);
        };
      }
    }, fault);
    await keyInput(session.page).fill(KEYS.first);
    await validate(session, 'first');
    await expect.poll(() => session.page.evaluate(() => (window as any).__faultHits)).toBeGreaterThan(0);
    await expect(card(session.page).getByText('Key saved', { exact: true })).toHaveCount(0);
    expect((await storage(session.page)).providers).toEqual([]);
    await session.page.reload(); // Restores the native boundary; no recurring init-script fault.
    await settings(session.page);
    await expect(keyInput(session.page)).toHaveValue('');
    await save(session, 'replacement');
    await session.restart();
    await settings(session.page);
    await expect(keyInput(session.page)).toHaveValue(KEYS.replacement);
    await validate(session, 'replacement');
  });
}

test('legacy canary cleanup runs once and preserves subsequently saved device-key credentials', async ({ session }) => {
  await session.visit();
  await session.backup();
  await session.page.evaluate(() => {
    // Seed once, while the previous application instance is already initialized.
    localStorage.setItem('folio-mapper-vault-canary', 'synthetic-legacy-canary');
    localStorage.setItem('folio-mapper-vault-meta', JSON.stringify({ providers: ['anthropic'] }));
    localStorage.setItem('folio-mapper-vault-anthropic', 'synthetic-legacy-ciphertext');
  });
  await session.page.reload();
  const notice = () => session.page.getByText(/Saved API keys are now passwordless/);
  await expect(notice()).toBeVisible();
  expect(await session.page.evaluate(() => localStorage.getItem('folio-mapper-vault-canary'))).toBeNull();
  expect((await storage(session.page)).providers).toEqual([]);
  await settings(session.page);
  await save(session);
  await session.page.reload();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.first);
  await expect(notice()).toHaveCount(0);
  await validate(session, 'first');
  await session.restart();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.first);
  await expect(notice()).toHaveCount(0);
});
