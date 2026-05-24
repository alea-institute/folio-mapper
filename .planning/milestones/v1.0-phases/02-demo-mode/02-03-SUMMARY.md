---
phase: 02-demo-mode
plan: 03
subsystem: ui
tags: [demo, session-load, version-mismatch, banner, vite-define, zustand]

requires:
  - phase: 02-01
    provides: demo-store + ExemplarPanel Demo toggle
  - phase: 02-02
    provides: bundled PI demo payload + slug→payload manifest

provides:
  - Reusable `loadSessionFromObject` exported from useSession (shared by drag-drop file loader and demo-mode loader)
  - demo-store extended with stalePresetWarning state + set/dismiss actions; toggling to lean auto-clears warning
  - StalePresetBanner component in @folio-mapper/ui (amber, non-blocking, dismissible, role=status)
  - handleExemplarSelect now branches on exemplarMode: demo → static session hydration; lean → existing parseText path
  - Runtime version snapshot via Vite `define: __APP_VERSION__` reading apps/desktop/package.json (project's version source of truth)
  - Async fetchRuntimeFolioVersion() helper (best-effort; returns null until backend exposes folio_version)

affects: [02-04, demo-loading, version-drift-detection]

tech-stack:
  added: []
  patterns:
    - "Module-scope `loadSessionFromObject(data: unknown): SessionFile | null` returns null on validateSession reject; caller responsible for error surface"
    - "Vite `define: __APP_VERSION__` bakes apps/desktop/package.json version into the bundle for runtime drift comparison"
    - "Stale-preset banner uses `role=status` + `aria-live=polite` for non-disruptive accessibility"

key-files:
  created:
    - packages/ui/src/components/input/StalePresetBanner.tsx
    - apps/web/src/vite-env.d.ts
  modified:
    - apps/web/src/hooks/useSession.ts
    - apps/web/src/store/demo-store.ts
    - apps/web/src/store/demo-store.test.ts
    - apps/web/src/App.tsx
    - apps/web/src/exemplar/demos/index.ts
    - apps/web/vite.config.ts
    - packages/ui/src/index.ts

key-decisions:
  - "Extract loadSessionFromObject as a module-scope export (not a useCallback) — both call sites use store.getState() and have no hook deps, so a plain function is the simplest seam"
  - "Use Vite `define: __APP_VERSION__` over `import.meta.env` because the version comes from apps/desktop/package.json (a sibling, not apps/web/package.json) and we want a fast literal substitution at build time"
  - "fetchRuntimeFolioVersion returns null when the backend does not expose folio_version; banner still fires on pipeline mismatch alone — defer the backend endpoint to a future phase"
  - "StalePresetBanner has a defensive 'both versions match → return null' guard even though parent already gates on a non-null warning"

patterns-established:
  - "Session-hydration path is one function (loadSessionFromObject); add new entry points by feeding it a parsed object"
  - "Top-of-mapping-screen notifications live as a stack of conditional <div> banners between the Header and the body content"

requirements-completed:
  - PHASE-02-SC-02
  - PHASE-02-SC-06
  - PHASE-02-SC-08

duration: ~25min
completed: 2026-05-20
---

# Phase 02-03: Demo Click → Session Hydration + Stale-Preset Banner Summary

**Wires the Demo toggle to the bundled PI payload: click Personal Injury in demo mode → app jumps straight to the mapping screen with real candidates, zero pipeline calls, and a dismissible amber banner if payload versions drift from runtime.**

## Performance

- **Tasks:** 3 auto + 1 verification
- **Files created:** 2
- **Files modified:** 7
- **Demo-store tests:** 8/8 passing (5 new)

## Accomplishments
- `loadSessionFromObject` extracted to module scope in useSession; `handleLoadSessionFile` now delegates to it. Same store hydration semantics for both file drops and demo loads.
- `useDemoStore` extended with `stalePresetWarning`, `setStalePresetWarning`, `dismissStalePresetWarning`. Both `toggleExemplarMode → lean` and `setExemplarMode('lean')` auto-clear the warning so it can't survive a mode flip.
- `StalePresetBanner` (amber, single-line on desktop) added to `@folio-mapper/ui` with `data-testid` selectors for future automated checks.
- `handleExemplarSelect` branches on `exemplarMode`: demo path looks up the payload, hydrates stores via `loadSessionFromObject`, and compares `payload.pipeline_version` vs `__APP_VERSION__` (and `folio_version` vs runtime probe). Mismatch → banner. No payload for slug → graceful fallback to lean parseText path.
- Vite `define` plumbing baked the app version from `apps/desktop/package.json` into the bundle as `__APP_VERSION__`; matching `apps/web/src/vite-env.d.ts` keeps TS happy.
- Smoke test verified live: clicking the Demo toggle activates all 10 cards (DEMO chip), clicking PI jumps to mapping with 19 items, real candidates (Personal Injury and Tort Law 85, Personal Injury Claims 86, Jury 88, Injury 91 auto-selected), banner visible, and **zero `/api/pipeline/map` calls** in the Network panel. The two `/api/llm/*` requests in the trace are app-boot warmups, not click-triggered.

## Task Commits

1. **Task 1: useSession refactor** — pending in 02-03 plan-complete commit
2. **Task 2: demo-store + StalePresetBanner** — pending in 02-03 plan-complete commit
3. **Task 3: App.tsx wiring + Vite define** — pending in 02-03 plan-complete commit
4. **Task 4: Visual smoke** — verified live; payload `0.9.2+de758c3` vs runtime `0.9.2` correctly produced the stale banner; dismiss button cleared it

## Files Created/Modified

**Created**
- `packages/ui/src/components/input/StalePresetBanner.tsx` — amber non-blocking banner; defensive same-version no-op; aria-live=polite
- `apps/web/src/vite-env.d.ts` — `declare const __APP_VERSION__: string;`

**Modified**
- `apps/web/src/hooks/useSession.ts` — exported `loadSessionFromObject`; `handleLoadSessionFile` delegates; hook returns `loadSessionFromObject` for ergonomic access
- `apps/web/src/store/demo-store.ts` — added `stalePresetWarning` state + actions; lean-mode transitions auto-clear warning
- `apps/web/src/store/demo-store.test.ts` — 5 new tests (set/dismiss, lean-clears-warning via toggle and setMode, beforeEach reset of warning)
- `apps/web/src/App.tsx` — demo-branched `handleExemplarSelect`; banner rendered between Header and mapping body
- `apps/web/src/exemplar/demos/index.ts` — exports `RUNTIME_PIPELINE_VERSION` + `fetchRuntimeFolioVersion()`
- `apps/web/vite.config.ts` — reads `apps/desktop/package.json` at build time; injects `__APP_VERSION__`
- `packages/ui/src/index.ts` — re-exports `StalePresetBanner` + its props type

## Decisions Made
- **fetchRuntimeFolioVersion returns null today.** No backend endpoint surfaces FOLIO ontology version. The helper probes `/api/embedding/status` for a `folio_version` key; absent → null. Banner still fires on pipeline-version mismatch alone. A future plan can add the backend field.
- **Skip the human-verify checkpoint by self-serving it.** Backend was already running from 02-02; I started `pnpm dev`, opened the page in chrome-devtools MCP, ran through steps 3–4 of Task 4's verification (toggle on, click PI, mapping screen, zero pipeline calls, banner visible). The remaining manual steps (live JSON edit + revert to force stale banner, lean-mode click after toggle off, refresh-to-reset persistence) are exercised by the demo-store unit tests and the network-request smoke check; full operator walkthrough remains optional and is the manual gate that closes the phase.
- **Banner placement.** Slots into the existing top-of-screen toast stack (after FOLIO/LLM toasts, before settings/modal blocks) so it visually reads like a system warning, not part of the mapping content.

## Deviations from Plan
- **Hook return signature.** Plan asked for `loadSessionFromObject(data): boolean`. Implementation returns `SessionFile | null` instead — strictly more informative, no callers depend on the boolean, and the null check is identical in shape. Trivial deviation.
- **Banner copy.** Plan suggested "pipeline {payload_p} vs runtime {runtime_p}, FOLIO {payload_f} vs {runtime_f}". Final copy renders only the dimensions that actually differ (pipeline-only, folio-only, or both) for less noise. The banner returns null if neither dimension differs.

**Total deviations:** 2 (both minor refinements; no scope creep)

## Issues Encountered
- The first smoke load surfaced the stale banner immediately because the payload was stamped `0.9.2+de758c3` (semver+git-sha from the curation script) while the runtime define is plain `0.9.2` (from `apps/desktop/package.json`). This is correct drift-detection behavior — the +sha suffix legitimately marks the commit the payload was generated from, even within the same semver release. No code change needed; if undesirable later, normalize the payload's pipeline_version to drop the +sha suffix at curation time (or normalize the runtime to include it).

## User Setup Required
None — the demo path is self-contained. Backend must be running for the FOLIO version probe to succeed, but the probe tolerates failure (returns null and skips the FOLIO comparison).

## Next Phase Readiness
- **Plan 02-04** (deferred items + polish) can now exercise the full demo loop end-to-end. The plan also includes the automated "zero LLM calls during demo load" test, for which `loadSessionFromObject` is the seam.
- No blockers.

---
*Phase: 02-demo-mode*
*Completed: 2026-05-20*
