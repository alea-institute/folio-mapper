import { readdir } from 'node:fs/promises';
import type { BrowserContext, Route } from '@playwright/test';

export const ORIGIN = 'http://127.0.0.1:58174';
export const KEYS = {
  first: 'synthetic-fm2-anthropic-first-0001',
  replacement: 'synthetic-fm2-anthropic-replacement-0002',
  openai: 'synthetic-fm2-openai-0003',
  rejected: 'synthetic-fm2-rejected-0004',
  keychain: 'synthetic-fm2-keychain-0005',
} as const;
export type Credential = keyof typeof KEYS;
export type Provider = 'anthropic' | 'openai';

const models = {
  anthropic: [{ id: 'claude-sonnet-4-20250514', name: 'Synthetic Claude', context_window: 200000 }],
  openai: [{ id: 'gpt-4o', name: 'Synthetic GPT', context_window: 128000 }],
};

/** No API request ever falls through to a backend, including unknown paths. */
export class OfflineAPI {
  unexpected: string[] = [];
  validations: { provider: Provider; credential: Credential | 'env' }[] = [];
  envProviders: Provider[] = [];
  allowDemoSearch = false;
  demoSearches = 0;

  async install(context: BrowserContext) {
    const assets = new Set((await readdir('apps/web/dist', { recursive: true }))
      .map((path) => `/${path.split('\\').join('/')}`));
    assets.add('/');
    await context.route('**/*', (route) => this.route(route, assets));
    await context.routeWebSocket('**/*', (socket) => {
      this.unexpected.push('Unexpected WebSocket');
      socket.close();
    });
  }

  private async route(route: Route, assets: Set<string>) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown) => route.fulfill({ json: body });
    const reject = async () => {
      // Never log request bodies, query strings or authorization headers.
      this.unexpected.push(`${method} ${url.origin === ORIGIN ? path : 'external request'}`);
      await route.abort('blockedbyclient');
    };
    if (url.origin !== ORIGIN) return reject();
    if (!path.startsWith('/api/')) {
      if (method === 'GET' && assets.has(path) && !url.search) return route.continue();
      return reject();
    }
    if (url.search) return reject();
    if (method === 'GET' && path === '/api/llm/key-status') {
      return json({ env_providers: this.envProviders });
    }
    if (method === 'GET' && path === '/api/llm/known-models') return json(models);
    if (method === 'GET' && path === '/api/llm/pricing') return json({ prices: {} });
    if ((method === 'POST' && path === '/api/embedding/warmup') ||
        (method === 'GET' && path === '/api/embedding/status')) {
      return json({ available: true, provider: 'synthetic', model: 'synthetic', dimension: 3,
        num_concepts: 1, index_cached: true, error: null });
    }
    if ((method === 'POST' && path === '/api/mapping/warmup') ||
        (method === 'GET' && path === '/api/mapping/status')) {
      return json({ loaded: true, concept_count: 1, loading: false, error: null });
    }
    if (method === 'GET' && path === '/api/mapping/owl-update/status') {
      return json({ update_status: 'current', last_check_time: null, last_update_time: null,
        concept_count: 1, owl_commit_sha: null, check_interval_seconds: 3600, error: null });
    }
    if (method === 'POST' && ['/api/llm/test-connection', '/api/llm/models', '/api/llm/probe-models'].includes(path)) {
      const body = request.postDataJSON();
      if (!body || !(body.provider in models)) return reject();
      const provider = body.provider as Provider;
      const authorization = request.headers().authorization;
      const credential = (Object.keys(KEYS) as Credential[]).find((id) => authorization === `Bearer ${KEYS[id]}`)
        ?? (!authorization && this.envProviders.includes(provider) ? 'env' : undefined);
      if (!credential) return reject();
      if (path.endsWith('/models')) return json(models[provider]);
      if (path.endsWith('/probe-models')) {
        if (!Array.isArray(body.models) || !body.models.every((id: string) => models[provider].some((m) => m.id === id))) return reject();
        return json({ results: body.models.map((model: string) => ({ model, available: false, reason: 'auth' })) });
      }
      this.validations.push({ provider, credential });
      return json({ success: credential !== 'rejected', model: body.model,
        message: credential === 'rejected' ? 'Synthetic key rejected' : 'Synthetic connection verified',
        reason: credential === 'rejected' ? 'auth' : null });
    }
    if (method === 'POST' && path === '/api/mapping/candidates' && this.allowDemoSearch) {
      const body = request.postDataJSON();
      if (body.llm_config != null || request.headers().authorization || !Array.isArray(body.items)) return reject();
      this.demoSearches++;
      return json({ items: body.items.map((item: { index: number; text: string }) => ({
        item_index: item.index, item_text: item.text, branch_groups: [], total_candidates: 0,
      })), total_items: body.items.length, branches_available: [] });
    }
    return reject();
  }
}
