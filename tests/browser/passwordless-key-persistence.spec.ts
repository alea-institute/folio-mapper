import { test, expect } from './fixtures/browser';
import { KEYS } from './fixtures/offline-api';
import { capture, card, keyInput, save, saved, settings, storage, validate } from './helpers/key-vault';

for (const entry of ['Test', 'Save & Close'] as const) {
  test(`${entry} saves native ciphertext and restores across reload and browser restart`, async ({ session }, info) => {
    await session.visit();
    await settings(session.page);
    await keyInput(session.page).fill(KEYS.first);
    expect((await storage(session.page)).providers).toEqual([]);
    if (entry === 'Test') await validate(session, 'first');
    else {
      await session.page.getByRole('button', { name: entry, exact: true }).click();
      await expect(session.page.getByRole('heading', { name: 'LLM Provider Settings', exact: true })).toBeHidden();
      expect(session.api.validations.at(-1)).toEqual({ provider: 'anthropic', credential: 'first' });
      await settings(session.page);
    }
    await saved(session.page);
    expect(await storage(session.page)).toEqual({
      device: { algorithm: 'AES-GCM', length: 256, extractable: false, type: 'secret', usages: ['encrypt', 'decrypt'], exportRejected: true },
      providers: ['anthropic'], payloads: { anthropic: true, openai: false },
      plaintext: false, plaintextWrite: false, emptyPersistedKeys: true,
    });
    for (const returnVisit of ['reload', 'restart']) {
      if (returnVisit === 'reload') await session.page.reload();
      else await session.restart();
      await settings(session.page);
      await expect(keyInput(session.page)).toHaveValue(KEYS.first);
      await saved(session.page);
      await expect(card(session.page).getByText('✓ Valid', { exact: true })).toHaveCount(0);
      await expect(session.page.getByText(/passphrase/i)).toHaveCount(0);
      await validate(session, 'first');
    }
    if (entry === 'Test') await capture(session.page, info, 'passwordless-key-restored');
  });
}

test('rejected keys never save; a validated replacement restores on the next visit', async ({ session }) => {
  await session.visit();
  await settings(session.page);
  await keyInput(session.page).fill(KEYS.rejected);
  await validate(session, 'rejected');
  expect((await storage(session.page)).providers).toEqual([]);
  await save(session);
  await keyInput(session.page).fill(KEYS.rejected);
  await expect(card(session.page).getByText('✓ Valid', { exact: true })).toHaveCount(0);
  await validate(session, 'rejected');
  await session.page.reload();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.first);
  await validate(session, 'first');
  await save(session, 'replacement');
  await session.restart();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.replacement);
  await validate(session, 'replacement');
});

test('Forget stays forgotten after validation and rerenders, preserving the other provider', async ({ session }) => {
  await session.visit();
  await settings(session.page);
  await save(session);
  await save(session, 'openai', 'openai');
  await session.backup();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.first);
  await validate(session, 'first');
  await card(session.page).getByRole('button', { name: 'Forget', exact: true }).click();
  await expect(card(session.page).getByText('Session only', { exact: true })).toBeVisible();
  await validate(session, 'first');
  await card(session.page, 'openai').getByTitle('Refresh models', { exact: true }).click();
  expect((await storage(session.page)).providers).toEqual(['openai']);
  await expect(card(session.page).getByText('Key saved', { exact: true })).toHaveCount(0);
  await expect(keyInput(session.page)).toHaveValue(KEYS.first);
  await session.restart();
  await settings(session.page);
  await expect(keyInput(session.page, 'openai')).toHaveValue(KEYS.openai);
  await expect(keyInput(session.page)).toHaveValue('');
  await save(session, 'replacement');
  await session.page.reload();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.replacement);
  await validate(session, 'replacement');
});

test('Clear all removes ciphertext and device key across reload and restart', async ({ session }, info) => {
  await session.visit();
  await settings(session.page);
  await save(session);
  await save(session, 'openai', 'openai');
  await session.backup();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.first);
  await validate(session, 'first');
  await session.page.getByRole('button', { name: 'Clear all saved API keys', exact: true }).click();
  await expect.poll(async () => (await storage(session.page)).device).toBeNull();
  expect((await storage(session.page)).providers).toEqual([]);
  for (const returnVisit of ['reload', 'restart']) {
    if (returnVisit === 'reload') await session.page.reload(); else await session.restart();
    await settings(session.page);
    await expect(keyInput(session.page)).toHaveValue('');
    await expect(keyInput(session.page, 'openai')).toHaveValue('');
    expect((await storage(session.page)).payloads).toEqual({ anthropic: false, openai: false });
    expect((await storage(session.page)).device).toBeNull();
    await expect(session.page.getByText('Key saved', { exact: true })).toHaveCount(0);
  }
  await capture(session.page, info, 'passwordless-keys-forgotten');
});

test('Clear all cancels a pending native encryption completion', async ({ session }) => {
  await session.visit();
  await session.backup();
  await settings(session.page);
  await session.page.evaluate(() => {
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    const pending: (() => void)[] = [];
    Object.assign(window, { __pendingEncryption: 0, __finishedEncryption: 0,
      __releaseEncryption: () => pending.splice(0).forEach((release) => release()) });
    crypto.subtle.encrypt = async (...args) => {
      const cipher = await encrypt(...args);
      (window as any).__pendingEncryption++;
      await new Promise<void>((resolve) => pending.push(resolve));
      (window as any).__finishedEncryption++;
      return cipher;
    };
  });
  await keyInput(session.page).fill(KEYS.first);
  await validate(session, 'first');
  await expect.poll(() => session.page.evaluate(() => (window as any).__pendingEncryption)).toBeGreaterThan(0);
  await session.page.getByRole('button', { name: 'Clear all saved API keys', exact: true }).click();
  await expect.poll(async () => (await storage(session.page)).device).toBeNull();
  await session.page.evaluate(() => (window as any).__releaseEncryption());
  await expect.poll(() => session.page.evaluate(() => (window as any).__finishedEncryption)).toBeGreaterThan(0);
  expect((await storage(session.page)).providers).toEqual([]);
  await expect(card(session.page).getByText('Key saved', { exact: true })).toHaveCount(0);
  await session.restart();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue('');
});
