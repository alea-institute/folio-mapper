---
phase: 02-demo-mode
plan: 01
subsystem: ui
tags: [zustand, react, demo-mode, exemplar, tailwind]

# Dependency graph
requires:
  - phase: 01-input-stage
    provides: ExemplarPanel component and EXEMPLARS data shipped on the input screen
provides:
  - useDemoStore — session-scoped Zustand store exposing exemplarMode flag plus toggle/set actions
  - ExemplarPanel Demo toggle button + per-card "Demo" chip affordances
  - App.tsx wiring that reads the demo-store and passes props to ExemplarPanel
affects: [02-demo-mode-plan-02, 02-demo-mode-plan-03, 02-demo-mode-plan-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Session-scoped Zustand store (plain `create()`, no `persist` middleware) for ephemeral UI mode flags
    - data-testid attributes (`demo-toggle`, `demo-chip`) on new affordances for downstream deterministic testing
    - aria-pressed on the toggle button for a11y / assistive-tech state communication

key-files:
  created:
    - apps/web/src/store/demo-store.ts
    - apps/web/src/store/demo-store.test.ts
    - .planning/phases/02-demo-mode/deferred-items.md
  modified:
    - packages/ui/src/components/input/ExemplarPanel.tsx
    - packages/ui/src/index.ts
    - apps/web/src/App.tsx

key-decisions:
  - "Placed exemplarMode in a NEW demo-store.ts (vs extending input-store.ts) — smaller diff and avoids touching the persisted input-store's partialize/merge logic that could leak the mode flag into localStorage"
  - "Demo toggle button lives in the ExemplarPanel header (right-aligned via ml-auto) — keeps the affordance adjacent to the cards it controls, no extra layout chrome"
  - "Chip uses bg-teal-600 / text-white / text-[9px] uppercase tracking-wider — consistent with the existing project pane-heading typography pattern documented in MEMORY.md"
  - "Did NOT change handleExemplarSelect — Plan 02-03 owns rerouting the click path based on exemplarMode"

patterns-established:
  - "Pattern: Session-scoped Zustand stores use plain `create()` (no `persist`/`createDebouncedStorage`) so refresh resets to defaults — appropriate for presentation intent vs. user preference"
  - "Pattern: New required props on shared UI components are accompanied by data-testid hooks so downstream wave tests can target them deterministically"

requirements-completed:
  - PHASE-02-SC-01
  - PHASE-02-SC-03
  - PHASE-02-SC-07

# Metrics
duration: 3min
completed: 2026-05-10
---

# Phase 2 Plan 01: Demo Store + ExemplarPanel Toggle Summary

**Session-scoped Zustand demo-store flips exemplarMode lean↔demo, ExemplarPanel renders a teal Demo button + per-card chip while in demo mode, and App.tsx wires the store to props — no data path change yet (Plan 02-03 owns that).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-10T23:11:26Z
- **Completed:** 2026-05-10T23:14:13Z
- **Tasks:** 3 (4 commits — Task 1 split into RED + GREEN per TDD)
- **Files modified:** 5 (3 created + 2 modified; +1 deferred-items.md for tracking)

## Accomplishments

- Session-scoped `useDemoStore` exporting `exemplarMode: 'lean' | 'demo'`, `toggleExemplarMode()`, `setExemplarMode(mode)` — plain Zustand `create()`, NO `persist` middleware (verified by `grep -c "from 'zustand/middleware'" = 0` and a unit test snapshotting localStorage keys).
- ExemplarPanel now accepts `exemplarMode` + `onToggleMode` props, renders a right-aligned `data-testid="demo-toggle"` button with `aria-pressed`, and conditionally renders a `data-testid="demo-chip"` pill on each card while `exemplarMode === 'demo'`.
- App.tsx imports `useDemoStore`, subscribes via selector hooks, and forwards both props to `<ExemplarPanel />` without touching `handleExemplarSelect`.
- 4/4 demo-store unit tests pass; zero new TypeScript errors introduced by this plan's edits.

## Task Commits

1. **Task 1 (RED): failing demo-store tests** — `764cad8` (test)
2. **Task 1 (GREEN): implement demo-store** — `2c6653f` (feat)
3. **Task 2: extend ExemplarPanel** — `5b4f2da` (feat)
4. **Task 3: wire demo-store into App.tsx** — `d0d059e` (feat)

_Task 1 followed the TDD RED→GREEN cycle. No REFACTOR commit was necessary — the GREEN implementation was already minimal and clear._

## Files Created/Modified

- `apps/web/src/store/demo-store.ts` (created) — `useDemoStore` + `ExemplarMode` type. Plain Zustand `create()`, no persist middleware. Session-scoped per 02-CONTEXT.md locked decision.
- `apps/web/src/store/demo-store.test.ts` (created) — 4 unit tests: default state, toggle, set, no-localStorage-write invariant.
- `packages/ui/src/components/input/ExemplarPanel.tsx` (modified) — new `exemplarMode` + `onToggleMode` required props, header Demo button (data-testid=demo-toggle, aria-pressed), per-card Demo chip (data-testid=demo-chip), card `<button>` gains `relative` for absolute chip positioning.
- `packages/ui/src/index.ts` (modified) — re-export `ExemplarPanelProps` type alongside the component.
- `apps/web/src/App.tsx` (modified) — import `useDemoStore`, subscribe to `exemplarMode` / `toggleExemplarMode`, pass both to `<ExemplarPanel />`.
- `.planning/phases/02-demo-mode/deferred-items.md` (created) — tracks pre-existing typecheck noise in untouched files plus the fact that the plan's verification command `pnpm -w typecheck` does not exist as a workspace script.

## Decisions Made

- **Where exemplarMode lives:** new `demo-store.ts` rather than extending `input-store.ts`. The input-store uses `persist(...)` with a `partialize`; adding `exemplarMode` there would have required either an explicit exclusion in `partialize` or a new test asserting it's not persisted. A separate plain-Zustand store is the smaller, harder-to-misuse diff and matches CONTEXT's "session-scoped — does NOT persist" decision unambiguously.
- **Button placement:** inside ExemplarPanel's header row (right-aligned via `ml-auto` on the button) rather than as a separate header element. Keeps the affordance attached to the surface it controls and avoids touching `InputScreen` slot wiring.
- **Chip styling:** `text-[9px] uppercase tracking-wider font-bold bg-teal-600 text-white rounded-sm px-1` — matches the project's existing pane-heading uppercase/tracking-wider type pattern (per MEMORY.md) while being small enough to be subtle.
- **Tests via `pnpm test`, not `pnpm vitest run` directly:** the apps/web package's `vitest` binary is only on the local-package PATH; the plan's literal command `pnpm vitest run …` printed `Command "vitest" not found`. `pnpm test src/store/demo-store.test.ts` ran the same file via the package's `test` script (`vitest run`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-install workspace dependencies**
- **Found during:** Task 1 (RED test run)
- **Issue:** `vitest` was not on PATH because the worktree's `node_modules` had not been installed yet (`pnpm test` reported "Local package.json exists, but node_modules missing").
- **Fix:** Ran `pnpm install` at the worktree root.
- **Files modified:** none (lockfile already committed; install produced `node_modules` only).
- **Verification:** `pnpm test src/store/demo-store.test.ts` now executes vitest successfully.
- **Committed in:** N/A (no file changes; just a tooling step).

**2. [Rule 3 - Blocking] Plan's `pnpm -w typecheck` command does not exist**
- **Found during:** Task 2 verification
- **Issue:** The plan's automated-verification command was `pnpm -w typecheck`, but no `typecheck` script exists in any workspace `package.json`.
- **Fix:** Ran `npx tsc --noEmit` directly from `packages/ui/` and `apps/web/` to validate types. Confirmed zero new errors in `ExemplarPanel.tsx`, `demo-store.ts`, or `App.tsx`. Documented the missing script + pre-existing unrelated type errors in `.planning/phases/02-demo-mode/deferred-items.md`.
- **Files modified:** `.planning/phases/02-demo-mode/deferred-items.md` (created).
- **Verification:** `npx tsc --noEmit | grep -E "(App\.tsx|demo-store|ExemplarPanel)"` returns nothing — no errors in touched files.
- **Committed in:** plan-metadata commit (alongside this SUMMARY.md).

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking tooling issues).
**Impact on plan:** None functional — both were tooling/verification-command issues, not behavior changes. The plan's intent (typecheck passes for touched files; demo-store tests pass) is satisfied via the workable substitute commands.

## Issues Encountered

- Pre-existing TypeScript errors in `packages/ui/src/components/mapping/graph/*` and `packages/ui/src/components/settings/{LLMSettings,ProviderCard}.tsx` surfaced when running `npx tsc --noEmit`. None are caused by this plan's edits; they are out-of-scope per the executor's `<SCOPE BOUNDARY>` rule and have been logged in `deferred-items.md` for a future tooling-hardening pass.

## User Setup Required

None — no external service configuration or environment variables introduced.

## Next Phase Readiness

- **Plan 02-02 (curation script + PI demo JSON):** unblocked; can proceed in parallel — produces the data file Plan 02-03 will load.
- **Plan 02-03 (reroute click on `exemplarMode === 'demo'`):** the store contract (`useDemoStore().exemplarMode`) is now stable and importable; this plan should subscribe to that selector in `handleExemplarSelect` (or a hook it calls) and branch the load path.
- **Plan 02-04 (version banner):** independent of 02-01; can start any time.
- **Manual smoke (optional, not gating):** `pnpm dev` → input screen → Demo button visible in exemplar panel header → click → button fills teal-600 and a "DEMO" chip appears on each of the 10 cards → click again → button reverts and chips disappear → hard refresh → button is outlined again (mode reset to lean).

## Self-Check: PASSED

Verified post-write:

- `apps/web/src/store/demo-store.ts` — FOUND
- `apps/web/src/store/demo-store.test.ts` — FOUND
- `packages/ui/src/components/input/ExemplarPanel.tsx` — FOUND (modified)
- `packages/ui/src/index.ts` — FOUND (modified)
- `apps/web/src/App.tsx` — FOUND (modified)
- `.planning/phases/02-demo-mode/deferred-items.md` — FOUND
- Commit `764cad8` (test RED) — FOUND in git log
- Commit `2c6653f` (feat GREEN) — FOUND in git log
- Commit `5b4f2da` (Task 2) — FOUND in git log
- Commit `d0d059e` (Task 3) — FOUND in git log

---
*Phase: 02-demo-mode*
*Completed: 2026-05-10*
