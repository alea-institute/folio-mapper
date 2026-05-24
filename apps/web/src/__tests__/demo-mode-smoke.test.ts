import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDemoPayload, DEMO_AVAILABLE_SLUGS } from '../exemplar/demos';
import { loadSessionFromObject } from '../hooks/useSession';
import { useInputStore } from '../store/input-store';
import { useMappingStore } from '../store/mapping-store';

/**
 * End-to-end demo-load smoke test — the automated equivalent of manually
 * clicking each demo card in the carousel.
 *
 * Unlike demo-mode-roundtrip / demo-mode-no-network (which import the demo JSON
 * statically and call loadSessionFromObject directly), this drives the exact
 * path App.tsx#handleExemplarSelect uses in demo mode:
 *
 *     await getDemoPayload(slug)   // resolves the LAZY_LOADERS dynamic import
 *       -> loadSessionFromObject   // hydrates the stores + sets the screen
 *
 * For every registered area it asserts: the lazy loader resolves a valid
 * anthropic-curated payload, the session hydrates to the mapping screen with a
 * visible auto-accept/pending mix, and zero live pipeline/LLM/parse calls fire
 * during the load. This exercises the manifest wiring for all 10 slugs at once.
 */

const SLUGS = [
  'personal-injury',
  'solo-criminal',
  'family-law',
  'employment-labor',
  'corporate-ma',
  'ip-tech',
  'commercial-lit',
  'real-estate',
  'banking-finance',
  'immigration',
] as const;

describe('demo mode end-to-end load (all registered areas)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useInputStore.getState().reset();
    useMappingStore.getState().resetMapping();
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{}', { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('every canonical slug is registered in DEMO_AVAILABLE_SLUGS', () => {
    expect(DEMO_AVAILABLE_SLUGS.size).toBe(SLUGS.length);
    for (const slug of SLUGS) {
      expect(DEMO_AVAILABLE_SLUGS.has(slug)).toBe(true);
    }
  });

  it.each(SLUGS)(
    '%s: getDemoPayload → loadSessionFromObject reaches the mapping screen (visible mix, zero pipeline calls)',
    async (slug) => {
      // 1. Lazy loader resolves the demo payload (the path App.tsx awaits).
      const payload = (await getDemoPayload(slug)) as Record<string, unknown> | null;
      expect(payload, `getDemoPayload("${slug}") should resolve`).not.toBeNull();
      const p = payload as Record<string, unknown>;
      expect(p.provider).toBe('anthropic');
      expect(p.model).toBe('claude-3-5-sonnet-latest');
      expect(p.version).toBe('1.3');

      // 2. Load it the way App does — hydrates the stores + sets the screen.
      const session = loadSessionFromObject(p);
      expect(session, `loadSessionFromObject("${slug}") should hydrate`).not.toBeNull();

      // 3. The demo lands the user on the mapping screen with a hydrated,
      //    visible-mix session (0 < completed < total_nodes).
      expect(useInputStore.getState().screen).toBe('mapping');
      expect(useMappingStore.getState().mappingResponse).not.toBeNull();
      const total = p.total_nodes as number;
      const completed = p.completed as number;
      expect(completed).toBeGreaterThan(0);
      expect(completed).toBeLessThan(total);

      // 4. Loading the demo fired no live pipeline/LLM/parse network calls.
      const calls = fetchSpy.mock.calls.map(([url]) => String(url));
      const offending = calls.filter((u) =>
        /\/api\/(pipeline|llm|parse|embedding|mapping|export|github|synthetic|pricing)\b/.test(u),
      );
      expect(offending).toEqual([]);
    },
  );
});
