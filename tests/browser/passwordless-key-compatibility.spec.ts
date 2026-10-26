import { test, expect } from './fixtures/browser';
import { KEYS } from './fixtures/offline-api';
import { card, keyInput, save, settings, storage, validate } from './helpers/key-vault';

test('server environment takes priority over a browser-saved key', async ({ session }) => {
  await session.visit();
  await settings(session.page);
  await save(session);
  session.api.envProviders = ['anthropic'];
  await session.restart();
  await settings(session.page);
  const envCard = session.page.locator('div.rounded-lg.border').filter({ hasText: 'Provided via server environment' });
  await expect(envCard.getByText('Env', { exact: true })).toBeVisible();
  await expect(keyInput(session.page)).toHaveCount(0);
  await envCard.getByRole('button', { name: 'Test', exact: true }).click();
  await expect(envCard.getByText('✓ Valid', { exact: true })).toBeVisible();
  expect(session.api.validations.at(-1)).toEqual({ provider: 'anthropic', credential: 'env' });
  expect((await storage(session.page)).providers).toEqual(['anthropic']);
});

test('simulated desktop keychain wins over browser vault; environment wins over keychain', async ({ session }) => {
  await session.visit();
  await settings(session.page);
  await save(session);
  await session.restart(true);
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.keychain);
  await expect(card(session.page).getByText('Keychain', { exact: true })).toBeVisible();
  await validate(session, 'keychain');
  expect((await storage(session.page)).providers).toEqual(['anthropic']);
  session.api.envProviders = ['anthropic'];
  await session.restart(true);
  await settings(session.page);
  await expect(session.page.getByText('Provided via server environment', { exact: true })).toBeVisible();
  await expect(session.page.getByText('Keychain', { exact: true })).toHaveCount(0);
  session.api.envProviders = [];
  await session.restart(false);
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.first);
  await validate(session, 'first');
});

test('Demo manual candidate search omits LLM configuration with a restored and revalidated key', async ({ session }) => {
  await session.visit();
  await settings(session.page);
  await save(session);
  await session.restart();
  await settings(session.page);
  await expect(keyInput(session.page)).toHaveValue(KEYS.first);
  await validate(session, 'first');
  await session.page.getByRole('button', { name: 'Save & Close', exact: true }).click();
  const demo = session.page.getByRole('button', { name: 'Demo', exact: true });
  if (await demo.getAttribute('aria-pressed') !== 'true') await demo.click();
  session.api.validations.length = 0;
  session.api.allowDemoSearch = true;
  await session.page.getByRole('button', { name: /Personal Injury/ }).click();
  const search = session.page.getByPlaceholder('Search and filter candidates...', { exact: true });
  await expect(search).toBeVisible();
  await search.fill('synthetic acceptance query');
  await search.press('Enter');
  await expect.poll(() => session.api.demoSearches).toBe(1);
  await expect(search).toBeEnabled();
  expect(session.api.validations).toEqual([]);
});
