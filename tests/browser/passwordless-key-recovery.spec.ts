import { test, expect } from './fixtures/browser';
import { KEYS } from './fixtures/offline-api';
import { capture, card, keyInput, save, saved, settings, storage, validate } from './helpers/key-vault';

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
  await session.page.addInitScript(() => {
    // Seed before application startup, only on the first navigation.
    if (localStorage.getItem('fm2-legacy-fixture-created')) return;
    localStorage.setItem('fm2-legacy-fixture-created', 'true');
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


for (const removal of ['Forget', 'Clear all'] as const) {
  for (const boundary of ['payload', 'metadata'] as const) {
    test(`failed explicit ${boundary} save after ${removal} warns and unchanged-key retry persists`, async ({ session }, info) => {
      await session.visit();
      await settings(session.page);
      await save(session);
      await session.backup();
      await settings(session.page);
      if (removal === 'Forget') await card(session.page).getByRole('button', { name: 'Forget', exact: true }).click();
      else {
        await session.page.getByRole('button', { name: 'Clear all saved API keys', exact: true }).click();
        await expect.poll(async () => (await storage(session.page)).device).toBeNull();
      }
      await validate(session, 'first');
      await session.page.evaluate((boundary) => {
        const setItem = Storage.prototype.setItem;
        Object.assign(window, { __saveFaultHits: 0, __restoreSave: () => { Storage.prototype.setItem = setItem; } });
        Storage.prototype.setItem = function (name, value) {
          const target = boundary === 'payload' ? 'folio-mapper-vault-anthropic' : 'folio-mapper-vault-meta';
          if (this === localStorage && name === target) {
            (window as any).__saveFaultHits++;
            throw new DOMException('Synthetic vault write failure', 'QuotaExceededError');
          }
          return setItem.call(this, name, value);
        };
      }, boundary);
      await card(session.page).getByRole('button', { name: 'Save (encrypted)', exact: true }).click();
      await expect(card(session.page).getByRole('alert')).toContainText("Couldn't finish saving this key in your browser.");
      await expect.poll(() => session.page.evaluate(() => (window as any).__saveFaultHits)).toBeGreaterThan(0);
      await expect(keyInput(session.page)).toHaveValue(KEYS.first);
      await expect(card(session.page).getByText('✓ Valid', { exact: true })).toBeVisible();
      await expect(card(session.page).getByText('Save unconfirmed', { exact: true })).toBeVisible();
      await expect(card(session.page).getByText('Key saved', { exact: true })).toHaveCount(0);
      const failedStorage = await storage(session.page);
      expect(failedStorage.providers).toEqual([]);
      expect(failedStorage.payloads.anthropic).toBe(boundary === 'metadata');
      expect(failedStorage.plaintext).toBe(false);
      const hits = await session.page.evaluate(() => (window as any).__saveFaultHits);
      await session.page.getByRole('button', { name: 'Save & Close', exact: true }).click();
      await expect(session.page.getByText("Your API key isn't saved", { exact: true })).toBeVisible();
      expect(await session.page.evaluate(() => (window as any).__saveFaultHits)).toBe(hits);
      if (removal === 'Forget' && boundary === 'payload') {
        await capture(session.page, info, 'browser-encrypted-save-failed', 'fm-7');
      }
      await session.page.getByRole('button', { name: 'Cancel', exact: true }).click();
      // The app, not the dialog, owns the failure display.
      await settings(session.page);
      await expect(card(session.page).getByRole('alert')).toBeVisible();
      await session.page.evaluate(() => (window as any).__restoreSave());
      const validations = session.api.validations.length;
      await card(session.page).getByRole('button', { name: 'Save (encrypted)', exact: true }).click();
      await saved(session.page);
      expect(session.api.validations).toHaveLength(validations);
      await expect(card(session.page).getByRole('alert')).toHaveCount(0);
      await session.page.getByRole('button', { name: 'Save & Close', exact: true }).click();
      await expect(session.page.getByRole('heading', { name: 'LLM Provider Settings', exact: true })).toBeHidden();
      await session.restart();
      await settings(session.page);
      await expect(keyInput(session.page)).toHaveValue(KEYS.first);
      await saved(session.page);
      await validate(session, 'first');
      if (removal === 'Forget' && boundary === 'payload') {
        await capture(session.page, info, 'browser-encrypted-save-retry-restored', 'fm-7');
      }
    });
  }
}

for (const entry of ['already valid', 'newly validated'] as const) {
  for (const outcome of ['success', 'failure'] as const) {
    test(`Save & Close waits for ${entry} encryption ${outcome}`, async ({ session }) => {
      await session.visit();
      await session.backup();
      await settings(session.page);
      await session.page.evaluate((outcome) => {
        const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
        const releases: (() => void)[] = [];
        Object.assign(window, { __savePending: 0, __releaseSave: () => releases.splice(0).forEach((release) => release()) });
        crypto.subtle.encrypt = async (...args) => {
          const payload = await encrypt(...args);
          (window as any).__savePending++;
          await new Promise<void>((resolve) => releases.push(resolve));
          if (outcome === 'failure') throw new DOMException('Synthetic encryption failure', 'OperationError');
          return payload;
        };
      }, outcome);
      await keyInput(session.page).fill(KEYS.first);
      if (entry === 'already valid') await validate(session, 'first');
      await session.page.getByRole('button', { name: 'Save & Close', exact: true }).click();
      await expect.poll(() => session.page.evaluate(() => (window as any).__savePending)).toBeGreaterThan(0);
      await expect(session.page.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled();
      await expect(card(session.page).getByText('Key saved', { exact: true })).toHaveCount(0);
      expect((await storage(session.page)).providers).toEqual([]);
      await session.page.evaluate(() => (window as any).__releaseSave());
      if (outcome === 'success') {
        await expect(session.page.getByRole('heading', { name: 'LLM Provider Settings', exact: true })).toBeHidden();
        await settings(session.page);
        await saved(session.page);
      } else {
        await expect(card(session.page).getByRole('alert')).toContainText("Couldn't finish saving this key");
        await expect(session.page.getByText("Your API key isn't saved", { exact: true })).toBeVisible();
        await expect(keyInput(session.page)).toHaveValue(KEYS.first);
        await expect(card(session.page).getByText('✓ Valid', { exact: true })).toBeVisible();
        await session.page.reload();
        await settings(session.page);
        await expect(keyInput(session.page)).toHaveValue('');
      }
    });
  }
}
