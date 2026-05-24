import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import demoPI from '../exemplar/demos/personal-injury.demo.json';
import demoSoloCriminal from '../exemplar/demos/solo-criminal.demo.json';
import demoFamilyLaw from '../exemplar/demos/family-law.demo.json';
import demoEmploymentLabor from '../exemplar/demos/employment-labor.demo.json';
import demoCorporateMa from '../exemplar/demos/corporate-ma.demo.json';
import demoIpTech from '../exemplar/demos/ip-tech.demo.json';
import demoCommercialLit from '../exemplar/demos/commercial-lit.demo.json';
// Remaining areas added by Plan 05 as their demo.json is committed:
// import demoRealEstate from '../exemplar/demos/real-estate.demo.json';
// import demoBankingFinance from '../exemplar/demos/banking-finance.demo.json';
// import demoImmigration from '../exemplar/demos/immigration.demo.json';
import { loadSessionFromObject } from '../hooks/useSession';
import { useInputStore } from '../store/input-store';
import { useMappingStore } from '../store/mapping-store';

/**
 * Phase 02 success criterion #6: zero LLM/pipeline calls at runtime when
 * loading a curated demo payload. The seam is `loadSessionFromObject` — it
 * must be purely synchronous + in-memory. App.tsx may make a best-effort
 * fetch to /api/embedding/status for the FOLIO version probe, but the
 * load function itself never hits the network.
 *
 * Table is parametrized — per-area plans add one import + one row each.
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

  // Add new rows here as each area's demo.json is committed.
  // Remaining areas added by Plans 04-05:
  // ['corporate-ma',     demoCorporateMa],
  // ['ip-tech',          demoIpTech],
  // ['commercial-lit',   demoCommercialLit],
  // ['real-estate',      demoRealEstate],
  // ['banking-finance',  demoBankingFinance],
  // ['immigration',      demoImmigration],
  it.each([
    ['personal-injury',  demoPI],
    ['solo-criminal',    demoSoloCriminal],
    ['family-law',       demoFamilyLaw],
    ['employment-labor', demoEmploymentLabor],
    ['corporate-ma',     demoCorporateMa],
    ['ip-tech',          demoIpTech],
    ['commercial-lit',   demoCommercialLit],
  ] as [string, Record<string, unknown>][])(
    '%s loadSessionFromObject performs zero LLM/pipeline/parse network calls',
    (_slug, payload) => {
      loadSessionFromObject(payload);

      const calls = fetchSpy.mock.calls.map(([url]) => String(url));
      const offending = calls.filter((u) =>
        /\/api\/(pipeline|llm|parse|embedding|mapping|export|github|synthetic|pricing)\b/.test(u),
      );
      expect(offending).toEqual([]);
    },
  );

  it('still hydrates stores correctly when fetch is stubbed', () => {
    const session = loadSessionFromObject(demoPI);
    expect(session).not.toBeNull();
    expect(useMappingStore.getState().mappingResponse).not.toBeNull();
    expect(useInputStore.getState().textInput).not.toBe('');
  });
});
