import { test, expect } from './fixtures/browser';

test('fresh profile opens the real settings without another test’s keys', async ({ session }) => {
  await session.visit();
  await session.page.getByRole('button', { name: 'LLM settings', exact: true }).click();
  await expect(session.page.getByPlaceholder('Enter Anthropic API key')).toHaveValue('');
  await expect(session.page.getByText('Key saved', { exact: true })).toHaveCount(0);
});

test('request guard blocks and records unknown API and external traffic', async ({ session }) => {
  session.expectedConsoleErrors = [/net::ERR_BLOCKED_BY_CLIENT/];
  await session.visit();
  for (const url of ['/api/fm2-unexpected', 'https://example.invalid/fm2']) {
    expect(await session.page.evaluate(async (url) => {
      try { await fetch(url); return false; } catch { return true; }
    }, url)).toBe(true);
  }
  expect(session.api.unexpected).toEqual(['GET /api/fm2-unexpected', 'GET external request']);
  session.api.unexpected.length = 0;
});
