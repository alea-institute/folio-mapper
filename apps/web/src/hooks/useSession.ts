import { useState, useEffect, useCallback, useRef } from 'react';
import { SESSION_VERSION, validateSession } from '@folio-mapper/core';
import type { SessionFile } from '@folio-mapper/core';
import { useInputStore } from '../store/input-store';
import { useMappingStore } from '../store/mapping-store';
import { useLLMStore } from '../store/llm-store';
import { tabIdentity } from '../store/tab-identity';
import { readRegistry } from '../store/session-registry';

/**
 * Hydrate input + mapping stores from a pre-parsed session object.
 *
 * Used by both the file-based session loader (drag-drop / file picker) and the
 * Demo Mode payload loader (Plan 02-03), so the two paths share validation +
 * store-hydration semantics.
 *
 * Returns the validated `SessionFile` on success, or `null` if `validateSession`
 * rejects. Caller is responsible for surfacing an error to the user on null.
 */
export function loadSessionFromObject(data: unknown): SessionFile | null {
  const session = validateSession(data);
  if (!session) return null;

  const inputStore = useInputStore.getState();
  if (session.text_input) inputStore.setTextInput(session.text_input);
  if (session.parse_result) inputStore.setParseResult(session.parse_result);
  if (session.screen) inputStore.setScreen(session.screen);

  const mappingStore = useMappingStore.getState();
  if (session.mapping_response) {
    mappingStore.setMappingResponse(session.mapping_response);

    useMappingStore.setState({
      currentItemIndex: session.current_position,
      selections: session.selections ?? {},
      nodeStatuses: session.node_statuses ?? {},
      notes: session.notes ?? {},
      branchStates: session.branch_states ?? {},
      inputBranchStates: session.input_branch_states ?? {},
      branchSortMode: session.branch_sort_mode ?? 'default',
      customBranchOrder: session.custom_branch_order ?? [],
      statusFilter: session.status_filter ?? 'all',
      pipelineMetadata: session.pipeline_metadata ?? null,
      suggestionQueue: session.suggestion_queue ?? [],
      reviewQueue: session.review_queue ?? [],
    });
  }

  return session;
}

export function useSession() {
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [rehydrated, setRehydrated] = useState(false);
  const checkedRef = useRef(false);

  // Wait for both stores to rehydrate before checking for session
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    let mappingReady = false;
    let inputReady = false;

    const check = () => {
      if (mappingReady && inputReady) {
        setRehydrated(true);
      }
    };

    // Zustand persist fires onRehydrateStorage synchronously on subscribe
    const mappingUnsub = useMappingStore.persist.onFinishHydration(() => {
      mappingReady = true;
      check();
    });
    const inputUnsub = useInputStore.persist.onFinishHydration(() => {
      inputReady = true;
      check();
    });

    unsubs.push(mappingUnsub, inputUnsub);

    // Also check if already rehydrated (may have fired before effect ran)
    if (useMappingStore.persist.hasHydrated()) mappingReady = true;
    if (useInputStore.persist.hasHydrated()) inputReady = true;
    check();

    return () => unsubs.forEach((u) => u());
  }, []);

  // Boot resolver — runs once after stores are rehydrated.
  // Implements three branches per RESEARCH.md Pattern 3:
  //   1. isNewTab → fresh tab, stores already skipped hydration (D-01)
  //   2. hasIdentity → refresh path, stores hydrated directly (D-08)
  //   3. else → auto-resume most-recently-modified session under a NEW tabId (D-07, Pitfall 5)
  useEffect(() => {
    if (!rehydrated || checkedRef.current) return;
    checkedRef.current = true;

    if (tabIdentity.isNewTab) return;    // D-01: fresh ?new=1 tab, already clean
    if (tabIdentity.hasIdentity) return; // D-08: refreshed tab, already hydrated from own keys

    // D-07: No identity — auto-resume most-recently-modified session
    const registry = readRegistry();
    if (registry.length === 0) return; // No sessions → stay fresh

    // Registry is already sorted descending by updatedAt (upsertRegistry maintains order)
    const mostRecent = registry[0];

    // Pitfall 5 fix: COPY data under a freshly generated tabId — never adopt the original.
    // This guarantees no two tabs ever share a tabId (split-brain safe, T-03-06).
    const newTabId = crypto.randomUUID();
    sessionStorage.setItem('folio-tab-id', newTabId);

    const mappingKey = `folio-mapper-session-${newTabId}-mapping`;
    const inputKey = `folio-mapper-session-${newTabId}-input`;
    const srcMapping = `folio-mapper-session-${mostRecent.tabId}-mapping`;
    const srcInput = `folio-mapper-session-${mostRecent.tabId}-input`;

    const mappingData = localStorage.getItem(srcMapping);
    const inputData = localStorage.getItem(srcInput);
    if (mappingData) localStorage.setItem(mappingKey, mappingData);
    if (inputData) localStorage.setItem(inputKey, inputData);

    useMappingStore.persist.setOptions({ name: mappingKey });
    useInputStore.persist.setOptions({ name: inputKey });
    void Promise.all([
      useMappingStore.persist.rehydrate(),
      useInputStore.persist.rehydrate(),
    ]);
  }, [rehydrated]);

  // Ctrl+S handler for manual save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const { mappingResponse } = useMappingStore.getState();
        if (mappingResponse) {
          downloadSession();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const buildSessionFile = useCallback((): SessionFile => {
    const mapping = useMappingStore.getState();
    const input = useInputStore.getState();
    const llm = useLLMStore.getState();
    const activeConfig = llm.configs[llm.activeProvider];

    const completedCount = Object.values(mapping.nodeStatuses).filter((s) => s === 'completed').length;
    const skippedCount = Object.values(mapping.nodeStatuses).filter((s) => s === 'skipped').length;

    return {
      version: SESSION_VERSION,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      source_file: input.parseResult?.source_filename ?? null,
      input_format: input.parseResult?.format ?? null,
      total_nodes: mapping.totalItems,
      completed: completedCount,
      skipped: skippedCount,
      current_position: mapping.currentItemIndex,

      provider: llm.activeProvider,
      model: activeConfig?.model ?? null,

      text_input: input.textInput,
      parse_result: input.parseResult,
      mapping_response: mapping.mappingResponse,
      pipeline_metadata: mapping.pipelineMetadata,

      selections: mapping.selections,
      node_statuses: mapping.nodeStatuses,
      notes: mapping.notes,
      screen: input.screen,

      branch_states: mapping.branchStates,
      input_branch_states: mapping.inputBranchStates,
      branch_sort_mode: mapping.branchSortMode,
      custom_branch_order: mapping.customBranchOrder,
      status_filter: mapping.statusFilter,

      suggestion_queue: mapping.suggestionQueue,
      review_queue: mapping.reviewQueue,
    };
  }, []);

  const downloadSession = useCallback(() => {
    const session = buildSessionFile();
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folio-session-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [buildSessionFile]);

  // clearStores uses the store's current persist key (dynamic, per D-04 namespacing)
  const clearStores = useCallback(() => {
    useMappingStore.getState().resetMapping();
    useInputStore.getState().reset();
    const mappingKey = useMappingStore.persist.getOptions().name;
    const inputKey = useInputStore.persist.getOptions().name;
    if (mappingKey) localStorage.removeItem(mappingKey);
    if (inputKey) localStorage.removeItem(inputKey);
  }, []);

  // D-01/D-03: Open a fresh tab instantly — no confirmation (T-03-07 guard: pathname only)
  const handleNewTab = useCallback(() => {
    window.open(window.location.pathname + '?new=1', '_blank');
  }, []);

  // D-07b: On-demand session picker state + handlers
  const handleOpenSessionPicker = useCallback(() => {
    setShowSessionPicker(true);
  }, []);

  const handleCloseSessionPicker = useCallback(() => {
    setShowSessionPicker(false);
  }, []);

  // Resume a specific session by tabId: copy its keys into the current tab's namespace,
  // rehydrate both stores, then close the picker.
  const handlePickerResume = useCallback((tabId: string) => {
    const newTabId = crypto.randomUUID();
    sessionStorage.setItem('folio-tab-id', newTabId);

    const mappingKey = `folio-mapper-session-${newTabId}-mapping`;
    const inputKey = `folio-mapper-session-${newTabId}-input`;
    const srcMapping = `folio-mapper-session-${tabId}-mapping`;
    const srcInput = `folio-mapper-session-${tabId}-input`;

    const mappingData = localStorage.getItem(srcMapping);
    const inputData = localStorage.getItem(srcInput);
    if (mappingData) localStorage.setItem(mappingKey, mappingData);
    if (inputData) localStorage.setItem(inputKey, inputData);

    useMappingStore.persist.setOptions({ name: mappingKey });
    useInputStore.persist.setOptions({ name: inputKey });
    void Promise.all([
      useMappingStore.persist.rehydrate(),
      useInputStore.persist.rehydrate(),
    ]);

    setShowSessionPicker(false);
  }, []);

  const handleResume = useCallback(() => {
    // No-op: direct-recover path does not show a modal gate (D-07/D-08 redesign)
    // Kept for call-site compatibility until App.tsx is updated.
  }, []);

  const handleStartFresh = useCallback(() => {
    clearStores();
  }, [clearStores]);

  const handleDownloadSession = useCallback(() => {
    downloadSession();
  }, [downloadSession]);

  const handleLoadSessionFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const session = loadSessionFromObject(data);
      if (!session) {
        throw new Error('Invalid session file format');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load session file';
      useInputStore.getState().setError(msg);
    }
  }, []);

  const hasActiveSession = useMappingStore((s) => s.mappingResponse !== null);

  return {
    showSessionPicker,
    hasActiveSession,
    handleNewTab,
    handleOpenSessionPicker,
    handleCloseSessionPicker,
    handlePickerResume,
    handleResume,
    handleStartFresh,
    handleDownloadSession,
    handleLoadSessionFile,
    loadSessionFromObject,
    downloadSession,

    // Recovery modal data — kept for backward compatibility with existing UI
    getRecoveryData: () => {
      const mapping = useMappingStore.getState();
      const completedCount = Object.values(mapping.nodeStatuses).filter((s) => s === 'completed').length;
      const skippedCount = Object.values(mapping.nodeStatuses).filter((s) => s === 'skipped').length;
      // Try to find a "created" date from the current persist key
      let created = new Date().toISOString();
      try {
        const currentKey = useMappingStore.persist.getOptions().name;
        if (currentKey) {
          const raw = localStorage.getItem(currentKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.state?.updated) created = parsed.state.updated;
          }
        }
      } catch { /* ignore */ }
      return {
        created,
        totalNodes: mapping.totalItems,
        completedCount,
        skippedCount,
      };
    },
  };
}
