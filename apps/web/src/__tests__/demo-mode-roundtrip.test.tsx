import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import demoPI from '../exemplar/demos/personal-injury.demo.json';
import demoSoloCriminal from '../exemplar/demos/solo-criminal.demo.json';
import demoFamilyLaw from '../exemplar/demos/family-law.demo.json';
import demoEmploymentLabor from '../exemplar/demos/employment-labor.demo.json';
// Remaining areas added by Plans 04-05 as their demo.json is committed:
// import demoCorporateMa from '../exemplar/demos/corporate-ma.demo.json';
// import demoIpTech from '../exemplar/demos/ip-tech.demo.json';
// import demoCommercialLit from '../exemplar/demos/commercial-lit.demo.json';
// import demoRealEstate from '../exemplar/demos/real-estate.demo.json';
// import demoBankingFinance from '../exemplar/demos/banking-finance.demo.json';
// import demoImmigration from '../exemplar/demos/immigration.demo.json';
import { loadSessionFromObject, useSession } from '../hooks/useSession';
import { useInputStore } from '../store/input-store';
import { useMappingStore } from '../store/mapping-store';

/**
 * Spike-001 invariant: a curated demo JSON renamed to {slug}-session.json
 * and loaded through the regular drag-drop session loader must produce the
 * same store state as loading it through the demo-mode helper.
 *
 * Loads the actual shipping demo JSON files (NOT fixtures) so a future
 * SessionFile schema bump that breaks production payloads breaks this test too.
 *
 * Table is parametrized — per-area plans add one import + one row each.
 */
function snapshot() {
  const i = useInputStore.getState();
  const m = useMappingStore.getState();
  return {
    textInput: i.textInput,
    parseResult: i.parseResult,
    screen: i.screen,
    mappingResponse: m.mappingResponse,
    selections: m.selections,
    nodeStatuses: m.nodeStatuses,
    pipelineMetadata: m.pipelineMetadata,
    currentItemIndex: m.currentItemIndex,
    notes: m.notes,
    branchStates: m.branchStates,
    inputBranchStates: m.inputBranchStates,
    branchSortMode: m.branchSortMode,
    customBranchOrder: m.customBranchOrder,
    statusFilter: m.statusFilter,
    suggestionQueue: m.suggestionQueue,
    reviewQueue: m.reviewQueue,
  };
}

function resetStores() {
  useInputStore.getState().reset();
  useMappingStore.getState().resetMapping();
}

describe('demo mode round-trip', () => {
  beforeEach(() => {
    resetStores();
  });

  // Add new rows here as each area's demo.json is committed.
  // Remaining areas added by Plans 04-05:
  // ['corporate-ma',      demoCorporateMa],
  // ['ip-tech',           demoIpTech],
  // ['commercial-lit',    demoCommercialLit],
  // ['real-estate',       demoRealEstate],
  // ['banking-finance',   demoBankingFinance],
  // ['immigration',       demoImmigration],
  it.each([
    ['personal-injury',  demoPI],
    ['solo-criminal',    demoSoloCriminal],
    ['family-law',       demoFamilyLaw],
    ['employment-labor', demoEmploymentLabor],
  ] as [string, Record<string, unknown>][])(
    '%s demo payload produces identical store state via both load paths',
    async (slug, payload) => {
      // Path A — direct demo-mode helper
      const sessionA = loadSessionFromObject(payload);
      expect(sessionA).not.toBeNull();
      const snapA = snapshot();

      resetStores();

      // Path B — public session-file API (the drag-drop loader)
      const { result } = renderHook(() => useSession());
      const payloadText = JSON.stringify(payload);
      const file = new File([payloadText], `${slug}-session.json`, {
        type: 'application/json',
      });
      // jsdom 25's File does not implement Blob.text(); patch the instance so the
      // hook's `await file.text()` resolves to the JSON payload.
      if (typeof file.text !== 'function') {
        Object.defineProperty(file, 'text', {
          value: async () => payloadText,
          configurable: true,
        });
      }
      await act(async () => {
        await result.current.handleLoadSessionFile(file);
      });
      const snapB = snapshot();

      expect(snapB).toEqual(snapA);
    },
  );
});
