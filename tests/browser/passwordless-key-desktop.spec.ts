import { test, expect, type BrowserSession } from './fixtures/browser';
import { KEYS } from './fixtures/offline-api';
import { capture, card, keyInput, settings, validate } from './helpers/key-vault';

type Removal = 'Forget' | 'Clear all';

async function replaceRemovedKey(session: BrowserSession, removal: Removal) {
  await session.restart(true);
  await session.backup();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.keychain);
  await expect(card(session.page).getByText('Keychain', { exact: true })).toBeVisible();
  if (removal === 'Forget') {
    await card(session.page).getByRole('button', { name: 'Forget', exact: true }).click();
  } else {
    await session.page.getByRole('button', { name: 'Clear all saved API keys', exact: true }).click();
  }
  await expect.poll(() => session.keychainCalls).toEqual([
    removal === 'Forget' ? { operation: 'deleteKey', provider: 'anthropic' } : { operation: 'clearAll' },
  ]);
  await expect(card(session.page).getByText('Session only', { exact: true })).toBeVisible();
  await keyInput(session.page).fill(KEYS.replacement);
}

for (const removal of ['Forget', 'Clear all'] as const) {
  for (const validation of ['Test first', 'Save & Close'] as const) {
    test(`simulated desktop warns after ${removal} and replacement (${validation})`, async ({ session }, info) => {
      await replaceRemovedKey(session, removal);
      if (validation === 'Test first') await validate(session, 'replacement');
      await session.page.getByRole('button', { name: 'Save & Close', exact: true }).click();
      await expect(session.page.getByText("Your API key isn't saved", { exact: true })).toBeVisible();
      await expect(session.page.getByRole('heading', { name: 'LLM Provider Settings', exact: true })).toBeVisible();
      expect(session.api.validations).toEqual([{ provider: 'anthropic', credential: 'replacement' }]);
      expect(session.keychainCalls).toHaveLength(1);
      if (removal === 'Forget' && validation === 'Test first') {
        await capture(session.page, info, 'desktop-unsaved-key-warning');
      }
      await session.page.getByRole('button', { name: 'Close without saving', exact: true }).click();
      await expect(session.page.getByRole('heading', { name: 'LLM Provider Settings', exact: true })).toBeHidden();
      expect(session.keychainCalls).toHaveLength(1);
      await session.restart();
      await settings(session.page);
      await expect(keyInput(session.page)).toHaveValue('');
    });
  }
}

test('simulated desktop saves the replacement only after the warning action', async ({ session }) => {
  await replaceRemovedKey(session, 'Clear all');
  await session.page.getByRole('button', { name: 'Save & Close', exact: true }).click();
  const prompt = session.page.locator('div.border-b').filter({ hasText: "Your API key isn't saved" });
  await expect(prompt).toBeVisible();
  expect(session.keychainCalls).toEqual([{ operation: 'clearAll' }]);
  await prompt.getByRole('button', { name: 'Save to keychain', exact: true }).click();
  await expect.poll(() => session.keychainCalls).toEqual([
    { operation: 'clearAll' },
    { operation: 'setKey', provider: 'anthropic', credential: 'replacement' },
  ]);
  await expect(session.page.getByRole('heading', { name: 'LLM Provider Settings', exact: true })).toBeHidden();
  await settings(session.page);
  await expect(card(session.page).getByText('Keychain', { exact: true })).toBeVisible();
  await expect(card(session.page).getByText('Key saved', { exact: true })).toBeVisible();
  await session.restart();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.replacement);
  await validate(session, 'replacement');
});
