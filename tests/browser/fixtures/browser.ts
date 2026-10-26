import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { KEYS, OfflineAPI, ORIGIN } from './offline-api';

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
    await this.context.addInitScript(({ keys, desktop }) => {
      // Observe storage writes without retaining plaintext or dumping storage.
      const original = Storage.prototype.setItem;
      Object.assign(window, { __plaintextWrite: false });
      Storage.prototype.setItem = function (name, value) {
        if (keys.some((key) => String(value).includes(key))) Object.assign(window, { __plaintextWrite: true });
        return original.call(this, name, value);
      };
      if (desktop) Object.assign(window, { desktop: {
        isDesktop: true,
        keychain: {
          isAvailable: async () => true,
          listProviders: async () => ['anthropic'],
          getKey: async () => keys[4],
        },
      } });
    }, { keys: Object.values(KEYS), desktop });
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
