import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { KEYS, OfflineAPI, ORIGIN, type Credential } from './offline-api';

type KeychainOperation = 'isAvailable' | 'listProviders' | 'getKey' | 'setKey' | 'deleteKey' | 'clearAll';
type KeychainMutation = { operation: 'setKey' | 'deleteKey' | 'clearAll'; provider?: string; credential?: Credential };

async function fingerprints(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    result.push(`${path.relative(directory, file)}:${createHash('sha256').update(await readFile(file)).digest('hex')}`);
  }
  return result.sort();
}

export class BrowserSession {
  readonly api = new OfflineAPI();
  readonly errors: string[] = [];
  readonly consoleErrors: string[] = [];
  readonly keychainCalls: KeychainMutation[] = [];
  private keychainKeys = new Map<string, string>([['anthropic', KEYS.keychain]]);
  expectedConsoleErrors: RegExp[] = [];
  context!: BrowserContext;
  page!: Page;
  private open = false;
  private backupCount = 0;
  private desktop = false;

  constructor(readonly profile: string) {}

  async start(desktop = false) {
    this.desktop = desktop;
    this.context = await chromium.launchPersistentContext(this.profile, {
      headless: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1050 },
    });
    this.open = true;
    await this.api.install(this.context);
    if (desktop) await this.context.exposeFunction('__syntheticKeychain', (operation: KeychainOperation, provider?: string, key?: string) => {
      switch (operation) {
        case 'isAvailable': return true;
        case 'listProviders': return [...this.keychainKeys.keys()];
        case 'getKey': return this.keychainKeys.get(provider!) ?? null;
        case 'setKey': {
          const credential = (Object.keys(KEYS) as Credential[]).find((id) => KEYS[id] === key);
          if (!provider || !credential) throw new Error('Unexpected synthetic keychain write');
          this.keychainCalls.push({ operation, provider, credential });
          this.keychainKeys.set(provider, key!);
          return;
        }
        case 'deleteKey':
          this.keychainCalls.push({ operation, provider });
          this.keychainKeys.delete(provider!);
          return;
        case 'clearAll':
          this.keychainCalls.push({ operation });
          this.keychainKeys.clear();
      }
    });
    await this.context.addInitScript(({ keys, desktop }) => {
      const original = Storage.prototype.setItem;
      Object.assign(window, { __plaintextWrite: false });
      Storage.prototype.setItem = function (name, value) {
        if (Object.values(keys).some((key) => String(value).includes(key))) Object.assign(window, { __plaintextWrite: true });
        return original.call(this, name, value);
      };
      if (desktop) {
        const invoke = (window as unknown as {
          __syntheticKeychain: (operation: KeychainOperation, provider?: string, key?: string) => Promise<unknown>;
        }).__syntheticKeychain;
        Object.assign(window, { desktop: {
          isDesktop: true,
          keychain: {
            isAvailable: () => invoke('isAvailable'),
            listProviders: () => invoke('listProviders'),
            getKey: (provider: string) => invoke('getKey', provider),
            setKey: (provider: string, key: string) => invoke('setKey', provider, key),
            deleteKey: (provider: string) => invoke('deleteKey', provider),
            clearAll: () => invoke('clearAll'),
          },
        } });
      }
    }, { keys: KEYS, desktop });
    this.context.on('page', (page) => this.observe(page));
    this.page = this.context.pages()[0] ?? await this.context.newPage();
    this.observe(this.page);
  }

  private observe(page: Page) {
    page.on('pageerror', (error) => this.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !this.expectedConsoleErrors.some((re) => re.test(message.text()))) {
        this.consoleErrors.push(message.text());
      }
    });
  }

  async visit() { await this.page.goto(ORIGIN); }

  async restart(desktop = this.desktop) {
    await this.close();
    await this.start(desktop);
    await this.visit();
  }

  /** Back up a fully closed synthetic profile before deleting/tampering with its state. */
  async backup() {
    await this.close();
    const destination = `${this.profile}-backup-${++this.backupCount}`;
    await cp(this.profile, destination, { recursive: true, errorOnExist: true, force: false });
    expect(await fingerprints(destination)).toEqual(await fingerprints(this.profile));
    await this.start(this.desktop);
    await this.visit();
  }

  async close() {
    if (this.open) {
      await this.context.close();
      this.open = false;
    }
  }
}

export const test = base.extend<{ session: BrowserSession }>({
  session: async ({}, use, info) => {
    // Outside test-results: Playwright clears that directory on the next run.
    const profile = path.resolve('.playwright-profiles', `${info.testId}-${info.retry}-${randomUUID()}`);
    await mkdir(profile, { recursive: true });
    const session = new BrowserSession(profile);
    try {
      await session.start();
      await use(session);
    } finally {
      await session.close();
      expect(session.api.unexpected, 'unexpected application traffic').toEqual([]);
      expect(session.errors, 'unhandled application errors').toEqual([]);
      expect(session.consoleErrors, 'unexpected console errors').toEqual([]);
    }
  },
});
export { expect };
