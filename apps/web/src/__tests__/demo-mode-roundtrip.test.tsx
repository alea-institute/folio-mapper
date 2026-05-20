import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import demoPI from '../exemplar/demos/personal-injury.demo.json';
import { loadSessionFromObject, useSession } from '../hooks/useSession';
import { useInputStore } from '../store/input-store';
import { useMappingStore } from '../store/mapping-store';

/**
 * Spike-001 invariant: a curated demo JSON renamed to my-saved-session.json
 * and loaded through the regular drag-drop session loader must produce the
 * same store state as loading it through the demo-mode helper.
 *
 * Loads the actual shipping `personal-injury.demo.json` (NOT a fixture) so a
 * future SessionFile schema bump that breaks production payloads breaks this
 * test too.
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

  it('PI demo payload produces identical store state via loadSessionFromObject and File-based handleLoadSessionFile', async () => {
    // Path A — direct demo-mode helper
    const sessionA = loadSessionFromObject(demoPI);
    expect(sessionA).not.toBeNull();
    const snapA = snapshot();

    resetStores();

    // Path B — public session-file API (the drag-drop loader)
    const { result } = renderHook(() => useSession());
    const payloadText = JSON.stringify(demoPI);
    const file = new File([payloadText], 'my-saved-session.json', {
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
  });
});
