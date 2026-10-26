import { expect, type Page, type TestInfo } from '@playwright/test';
import { copyFile, mkdir } from 'node:fs/promises';
import { KEYS, type Credential, type Provider } from '../fixtures/offline-api';
import type { BrowserSession } from '../fixtures/browser';

const names = { anthropic: 'Anthropic', openai: 'OpenAI' };
export const keyInput = (page: Page, provider: Provider = 'anthropic') =>
  page.getByPlaceholder(`Enter ${names[provider]} API key`, { exact: true });
export const card = (page: Page, provider: Provider = 'anthropic') =>
  page.locator('div.rounded-lg.border').filter({ has: keyInput(page, provider) });

export async function settings(page: Page) {
  await page.getByRole('button', { name: 'LLM settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'LLM Provider Settings', exact: true })).toBeVisible();
}

export async function validate(session: BrowserSession, credential: Credential, provider: Provider = 'anthropic') {
  const count = session.api.validations.length;
  await card(session.page, provider).getByRole('button', { name: 'Test', exact: true }).click();
  await expect.poll(() => session.api.validations.length).toBe(count + 1);
  expect(session.api.validations.at(-1)).toEqual({ provider, credential });
  await expect(card(session.page, provider).getByText(credential === 'rejected' ? '✗ Invalid' : '✓ Valid', { exact: true })).toBeVisible();
}

export async function save(session: BrowserSession, credential: Credential = 'first', provider: Provider = 'anthropic') {
  await keyInput(session.page, provider).fill(KEYS[credential]);
  await validate(session, credential, provider);
  await saved(session.page, provider);
}

export async function saved(page: Page, provider: Provider = 'anthropic') {
  await expect(card(page, provider).getByText('Key saved', { exact: true })).toBeVisible();
  await expect(card(page, provider).getByText('Encrypted', { exact: true })).toBeVisible();
  await expect.poll(async () => (await storage(page)).providers).toContain(provider);
}

/** Reads through native transaction completion, returning only non-secret facts. */
export async function storage(page: Page) {
  return page.evaluate(async (keys) => {
    const databases = await indexedDB.databases();
    let device: { algorithm: string; length: number; extractable: boolean; type: string; usages: string[]; exportRejected: boolean } | null = null;
    if (databases.some((db) => db.name === 'folio-mapper-keyvault')) {
      const key = await new Promise<CryptoKey | undefined>((resolve, reject) => {
        const open = indexedDB.open('folio-mapper-keyvault');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('device-key')) { db.close(); resolve(undefined); return; }
          const tx = db.transaction('device-key', 'readonly');
          const request = tx.objectStore('device-key').get('aesKey');
          tx.oncomplete = () => { db.close(); resolve(request.result); };
          tx.onabort = () => { db.close(); reject(tx.error); };
        };
      });
      if (key) {
        let exportRejected = false;
        try { await crypto.subtle.exportKey('raw', key); } catch { exportRejected = true; }
        device = { algorithm: key.algorithm.name, length: (key.algorithm as AesKeyAlgorithm).length,
          extractable: key.extractable, type: key.type, usages: key.usages, exportRejected };
      }
    }
    const persisted = JSON.parse(localStorage.getItem('folio-mapper-llm') ?? '{"state":{"configs":{}}}');
    const meta = JSON.parse(localStorage.getItem('folio-mapper-vault-meta') ?? '{"providers":[]}');
    const payloads: Record<string, boolean> = {};
    for (const provider of ['anthropic', 'openai']) {
      const payload = JSON.parse(localStorage.getItem(`folio-mapper-vault-${provider}`) ?? 'null');
      payloads[provider] = !!payload && typeof payload.cipher === 'string' && atob(payload.cipher).length > 16 && atob(payload.iv).length === 12;
    }
    return {
      device, providers: meta.providers as string[], payloads,
      plaintext: [localStorage, sessionStorage].some((store) => Object.values(store).some((value) => keys.some((key) => String(value).includes(key)))),
      plaintextWrite: (window as unknown as { __plaintextWrite: boolean }).__plaintextWrite,
      emptyPersistedKeys: Object.values(persisted.state.configs).every((config: any) => config.apiKey === '' && config.connectionStatus === 'untested'),
    };
  }, Object.values(KEYS));
}

export async function capture(page: Page, info: TestInfo, name: string) {
  const output = info.outputPath(`${name}.png`);
  const keyRows = page.locator('input[type="password"]').locator('..');
  await page.screenshot({ path: output,
    mask: [keyRows, keyRows.locator('span')], maskColor: '#d1d5db' });
  await info.attach(name, { path: output, contentType: 'image/png' });
  if (process.env.FM2_CAPTURE_EVIDENCE === '1') {
    await mkdir('docs/plans/evidence/fm-2', { recursive: true });
    await copyFile(output, `docs/plans/evidence/fm-2/${name}.png`);
  }
}
