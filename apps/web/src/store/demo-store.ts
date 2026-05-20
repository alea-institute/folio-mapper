import { create } from 'zustand';

/**
 * Exemplar mode controls how the "Try an Exemplar" cards behave on click.
 *
 * - `lean`:  load the existing precision-tuned text payload (default).
 * - `demo`:  load a pre-cached rich session JSON (Plan 02-03 wires this).
 *
 * IMPORTANT: this flag is intentionally session-scoped. It is NOT persisted via
 * the existing Zustand `persist` middleware, so every fresh app load resets to
 * `lean`. This is a locked decision in 02-CONTEXT.md ("Mode flag is session-
 * scoped, NOT persisted"). Demo mode is presentation intent, not a user
 * preference, so it should not survive a refresh.
 */
export type ExemplarMode = 'lean' | 'demo';

export interface StalePresetWarning {
  payloadPipelineVersion: string | null;
  payloadFolioVersion: string | null;
  runtimePipelineVersion: string | null;
  runtimeFolioVersion: string | null;
}

interface DemoState {
  exemplarMode: ExemplarMode;
  toggleExemplarMode: () => void;
  setExemplarMode: (mode: ExemplarMode) => void;

  stalePresetWarning: StalePresetWarning | null;
  setStalePresetWarning: (warning: StalePresetWarning | null) => void;
  dismissStalePresetWarning: () => void;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  exemplarMode: 'lean',
  toggleExemplarMode: () => {
    const next: ExemplarMode = get().exemplarMode === 'lean' ? 'demo' : 'lean';
    set({
      exemplarMode: next,
      ...(next === 'lean' ? { stalePresetWarning: null } : {}),
    });
  },
  setExemplarMode: (mode) =>
    set({
      exemplarMode: mode,
      ...(mode === 'lean' ? { stalePresetWarning: null } : {}),
    }),

  stalePresetWarning: null,
  setStalePresetWarning: (warning) => set({ stalePresetWarning: warning }),
  dismissStalePresetWarning: () => set({ stalePresetWarning: null }),
}));
