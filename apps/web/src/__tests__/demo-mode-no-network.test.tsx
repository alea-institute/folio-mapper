import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import demoPI from '../exemplar/demos/personal-injury.demo.json';
import { loadSessionFromObject } from '../hooks/useSession';
import { useInputStore } from '../store/input-store';
import { useMappingStore } from '../store/mapping-store';

/**
 * Phase 02 success criterion #6: zero LLM/pipeline calls at runtime when
 * loading a curated demo payload. The seam is `loadSessionFromObject` — it
 * must be purely synchronous + in-memory. App.tsx may make a best-effort
 * fetch to /api/embedding/status for the FOLIO version probe, but the
 * load function itself never hits the network.
 */
describe('demo mode network invariant', () => {
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

  it('loadSessionFromObject performs zero LLM/pipeline/parse network calls', () => {
    loadSessionFromObject(demoPI);

    const calls = fetchSpy.mock.calls.map(([url]) => String(url));
    const offending = calls.filter((u) =>
      /\/api\/(pipeline|llm|parse|embedding|mapping|export|github|synthetic|pricing)\b/.test(u),
    );
    expect(offending).toEqual([]);
  });

  it('still hydrates stores correctly when fetch is stubbed', () => {
    const session = loadSessionFromObject(demoPI);
    expect(session).not.toBeNull();
    expect(useMappingStore.getState().mappingResponse).not.toBeNull();
    expect(useInputStore.getState().textInput).not.toBe('');
  });
});
