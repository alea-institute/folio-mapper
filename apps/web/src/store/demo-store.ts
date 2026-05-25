import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Exemplar mode controls how the "Try an Exemplar" cards behave on click.
 *
 * - `lean`:  load the existing precision-tuned text payload (default).
 * - `demo`:  load a pre-cached rich session JSON (zero LLM cost).
 *
 * `exemplarMode` IS persisted (localStorage `folio-mapper-demo`). The original
 * design reset it to `lean` on every refresh, but that silently re-armed the
 * paid lean path for frequent demo-ers: refresh mid-demo, click a card, and a
 * live pipeline run fires. Persisting the toggle means once you choose Demo it
 * stays Demo until you turn it off. (Supersedes the 02-CONTEXT.md "session-
 * scoped" decision.) `isDemoSession` and `stalePresetWarning` remain session-
 * scoped — they describe the currently-loaded session, not a preference.
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

  /**
   * True while the currently displayed session was hydrated from a pre-baked
   * demo payload. Unlike `exemplarMode` (the input-screen toggle), this tracks
   * the *loaded session*, so it stays true through the mapping screen and is
   * cleared the moment the user does real work (types text, loads a real
   * exemplar/session, or starts over). All LLM calls are suppressed while true,
   * guaranteeing demos cost zero tokens. Session-scoped, NOT persisted.
   */
  /** Session-scoped (NOT persisted) — see header comment. */
  isDemoSession: boolean;
  setIsDemoSession: (value: boolean) => void;

  stalePresetWarning: StalePresetWarning | null;
  setStalePresetWarning: (warning: StalePresetWarning | null) => void;
  dismissStalePresetWarning: () => void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
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

      isDemoSession: false,
      setIsDemoSession: (value) => set({ isDemoSession: value }),

      stalePresetWarning: null,
      setStalePresetWarning: (warning) => set({ stalePresetWarning: warning }),
      dismissStalePresetWarning: () => set({ stalePresetWarning: null }),
    }),
    {
      name: 'folio-mapper-demo',
      // Persist ONLY the toggle. isDemoSession + stalePresetWarning are
      // session-scoped and must reset on every fresh load.
      partialize: (state) => ({ exemplarMode: state.exemplarMode }),
    },
  ),
);
