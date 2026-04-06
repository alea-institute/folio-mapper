import { useCallback, useRef } from 'react';
import {
  fetchCandidates,
  fetchMandatoryFallback,
  fetchPipelineCandidates,
} from '@folio-mapper/core';
import type {
  BranchState,
  LLMProviderType,
  ParseItem,
  PipelineRequestConfig,
} from '@folio-mapper/core';
import { useMappingStore } from '../store/mapping-store';
import { useLLMStore } from '../store/llm-store';

/** Progressive batch sizes: 1, 2, 4, 8, then cap at 16.
 *  Ensures item 2 arrives almost immediately after item 1. */
const BATCH_SEQUENCE = [1, 2, 4, 8, 16];

/**
 * Hook to trigger candidate fetching and initialize mapping state.
 * Loads the first item immediately, then remaining items in background batches.
 */
export function useMapping() {
  const {
    startMapping,
    appendMappingItems,
    setBatchLoading,
    setPipelineMetadata,
    setPipelineEnhancing,
    setLoadingCandidates,
    setError,
    mergeFallbackResults,
    mergeSearchResults,
  } = useMappingStore();

  const abortRef = useRef<AbortController | null>(null);

  const cancelBatchLoading = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setBatchLoading(false);
  }, [setBatchLoading]);

  const loadCandidates = useCallback(
    async (items: ParseItem[], mandatoryBranches?: string[], llmConfig?: PipelineRequestConfig | null) => {
      // Cancel any in-flight batches from a previous run
      cancelBatchLoading();

      setLoadingCandidates(true);
      setError(null);

      try {
        // Batch 1: first item only — show mapping screen immediately
        const firstBatch = items.slice(0, 1);
        const response = await fetchCandidates(firstBatch, 0, 10, mandatoryBranches, llmConfig);
        startMapping(response, items.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load candidates');
        setLoadingCandidates(false);
        return;
      }

      // Remaining items in background batches
      if (items.length <= 1) {
        setBatchLoading(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const remaining = items.slice(1);

      let offset = 0;
      let step = 0;
      while (offset < remaining.length) {
        if (controller.signal.aborted) break;

        const size = BATCH_SEQUENCE[Math.min(step, BATCH_SEQUENCE.length - 1)];
        const batch = remaining.slice(offset, offset + size);
        try {
          const response = await fetchCandidates(batch, 0, 10, mandatoryBranches, llmConfig);
          if (controller.signal.aborted) break;
          appendMappingItems(response.items);
        } catch (err) {
          if (controller.signal.aborted) break;
          // Non-fatal: log and continue with next batch
          console.warn('Batch loading error:', err);
          setBatchLoading(true, err instanceof Error ? err.message : 'Batch loading error');
        }
        offset += size;
        step++;
      }

      if (!controller.signal.aborted) {
        setBatchLoading(false);
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    },
    [startMapping, appendMappingItems, setBatchLoading, setLoadingCandidates, setError, cancelBatchLoading],
  );

  const loadPipelineCandidates = useCallback(
    async (items: ParseItem[], llmConfig: PipelineRequestConfig, mandatoryBranches?: string[]) => {
      // Cancel any in-flight batches from a previous run
      cancelBatchLoading();

      setLoadingCandidates(true);
      setError(null);

      const branches = mandatoryBranches ?? [];

      // Phase 1: Load symbolic (keyword + embedding) results IMMEDIATELY
      // so the user sees candidates while the LLM pipeline runs in the background.
      try {
        const firstBatch = items.slice(0, 1);
        const symbolicResponse = await fetchCandidates(firstBatch, 0, 10, branches, llmConfig);
        startMapping(symbolicResponse, items.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load candidates');
        setLoadingCandidates(false);
        return;
      }

      // Load remaining items via symbolic search in background batches
      const controller = new AbortController();
      abortRef.current = controller;

      if (items.length > 1) {
        const remaining = items.slice(1);
        let offset = 0;
        let step = 0;
        while (offset < remaining.length) {
          if (controller.signal.aborted) break;
          const size = BATCH_SEQUENCE[Math.min(step, BATCH_SEQUENCE.length - 1)];
          const batch = remaining.slice(offset, offset + size);
          try {
            const response = await fetchCandidates(batch, 0, 10, branches, llmConfig);
            if (controller.signal.aborted) break;
            appendMappingItems(response.items);
          } catch (err) {
            if (controller.signal.aborted) break;
            console.warn('Symbolic batch loading error:', err);
          }
          offset += size;
          step++;
        }
      }

      if (controller.signal.aborted) {
        if (abortRef.current === controller) abortRef.current = null;
        return;
      }
      setBatchLoading(false);

      // Phase 2: Enhance ALL items with LLM pipeline in background.
      // Symbolic results are already visible — pipeline upgrades scores and adds LLM-found candidates.
      setPipelineEnhancing(true);

      let pipelineOffset = 0;
      let pipelineStep = 0;
      while (pipelineOffset < items.length) {
        if (controller.signal.aborted) break;

        const size = BATCH_SEQUENCE[Math.min(pipelineStep, BATCH_SEQUENCE.length - 1)];
        const batch = items.slice(pipelineOffset, pipelineOffset + size);
        try {
          const response = await fetchPipelineCandidates(batch, llmConfig, 0, 10, branches);
          if (controller.signal.aborted) break;
          appendMappingItems(response.mapping.items, response.pipeline_metadata);
          if (pipelineOffset === 0) {
            setPipelineMetadata(response.pipeline_metadata);
          }
        } catch (err) {
          if (controller.signal.aborted) break;
          // Pipeline enhancement failed — symbolic results remain. Not fatal.
          console.warn('Pipeline enhancement error:', err);
          // Mark provider as invalid if first batch fails
          if (pipelineOffset === 0) {
            useLLMStore.getState().setConnectionStatus(llmConfig.provider as LLMProviderType, 'invalid');
          }
          break;
        }
        pipelineOffset += size;
        pipelineStep++;
      }

      setPipelineEnhancing(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    },
    [startMapping, appendMappingItems, setBatchLoading, setPipelineMetadata, setPipelineEnhancing, setLoadingCandidates, setError, cancelBatchLoading],
  );

  const loadMandatoryFallback = useCallback(
    async (
      itemIndex: number,
      itemText: string,
      branchStates: Record<string, BranchState>,
      existingBranchNames: string[],
      llmConfig?: PipelineRequestConfig | null,
    ) => {
      // Find mandatory branches that have no existing candidates for this item
      const mandatoryWithNoCandidates = Object.entries(branchStates)
        .filter(([name, state]) => state === 'mandatory' && !existingBranchNames.includes(name))
        .map(([name]) => name);

      if (mandatoryWithNoCandidates.length === 0) return;

      try {
        const response = await fetchMandatoryFallback(
          itemText,
          itemIndex,
          mandatoryWithNoCandidates,
          llmConfig,
        );
        mergeFallbackResults(response.item_index, response.fallback_results);
      } catch {
        // Non-fatal: silently fail if backend/LLM unavailable
      }
    },
    [mergeFallbackResults],
  );

  const searchCandidates = useCallback(
    async (query: string, itemIndex: number, llmConfig?: PipelineRequestConfig | null) => {
      const syntheticItem: ParseItem = { text: query, index: 0, ancestry: [] };

      if (llmConfig) {
        const response = await fetchPipelineCandidates([syntheticItem], llmConfig, 0, 10);
        mergeSearchResults(itemIndex, response.mapping);
      } else {
        const response = await fetchCandidates([syntheticItem], 0, 10);
        mergeSearchResults(itemIndex, response);
      }
    },
    [mergeSearchResults],
  );

  return { loadCandidates, loadPipelineCandidates, loadMandatoryFallback, searchCandidates, cancelBatchLoading };
}
