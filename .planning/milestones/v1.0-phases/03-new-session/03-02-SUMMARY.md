---
phase: 03-new-session
plan: 02
subsystem: session-persistence
tags: [zustand, persist, tab-identity, boot-resolver, session-registry]
dependency_graph:
  requires:
    - 03-01  # tab-identity.ts, session-registry.ts, session-storage.ts onWrite hook
  provides:
    - per-tab namespaced input-store and mapping-store persistence
    - three-branch boot resolver (fresh/direct-recover/auto-resume)
    - handleNewTab + session picker trigger state
    - D-12 beforeunload removal, D-02 NewProjectModal flow removal
  affects:
    - apps/web/src/store/input-store.ts
    - apps/web/src/store/mapping-store.ts
    - apps/web/src/hooks/useSession.ts
    - apps/web/src/test-setup.ts
tech_stack:
  added: []
  patterns:
    - "Zustand persist skipHydration for ?new=1 tabs"
    - "createDebouncedStorage onWrite callback → upsertRegistry (D-14)"
    - "Boot resolver with setOptions+rehydrate for dynamic namespace adoption"
    - "vi.resetModules() + dynamic import() for per-test module re-execution"
    - "Global Map-backed localStorage mock in test-setup.ts for transitive imports"
key_files:
  created:
    - apps/web/src/hooks/useSession.test.ts
  modified:
    - apps/web/src/store/input-store.ts
    - apps/web/src/store/mapping-store.ts
    - apps/web/src/hooks/useSession.ts
    - apps/web/src/test-setup.ts
decisions:
  - "sourceFile in registry onWrite set to null (mapping store has no access to input store at debounce time; avoids circular dependency; registry is UI metadata only)"
  - "Global Map-backed localStorage mock added to test-setup.ts — required because tab-identity.ts runs at module-import time and jsdom does not fully initialize localStorage in all Vitest worker contexts"
  - "handleResume kept as no-op for App.tsx backward compatibility until plan 03-03 updates the call site"
  - "getRecoveryData() updated to use dynamic persist key (useMappingStore.persist.getOptions().name) instead of static MAPPING_STORAGE_KEY constant"
metrics:
  duration_minutes: 7
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 4
---

# Phase 3 Plan 2: Per-Tab Store Wiring + Boot Resolver Summary

**One-liner:** Per-tab namespaced Zustand persist keys with three-branch boot resolver (fresh / direct-recover / auto-resume-copy-under-new-tabId) and D-02/D-12 dead code removal.

## What Was Built

### Task 1: input-store + mapping-store namespacing (commit 3d16fac)

**`apps/web/src/store/input-store.ts`** — Added `import { INPUT_KEY, tabIdentity } from './tab-identity'`. Changed `name: 'folio-mapper-session-input'` to `name: INPUT_KEY`. Added `skipHydration: tabIdentity.isNewTab` so `?new=1` tabs start fresh without loading old data (Pitfall 1 guard). Existing `partialize` and `merge` blocks unchanged.

**`apps/web/src/store/mapping-store.ts`** — Same pattern as input-store. Added imports for `MAPPING_KEY`, `tabIdentity`, `upsertRegistry`, `readRegistry`, `SessionRecord`. Changed persist `name` to `MAPPING_KEY`, added `skipHydration`. The `createDebouncedStorage` instance now passes an `onWrite` callback: after each successful debounced `localStorage.setItem`, it reads the current mapping state (node counts, completions, skips) and calls `upsertRegistry(record)` with `updatedAt = now` (D-14 / Pitfall 3 guard — updatedAt reflects actual persistence time, not in-memory mutation time).

**`apps/web/src/test-setup.ts`** — Added global Map-backed localStorage/sessionStorage mock. Required because `tab-identity.ts` runs `resolveTabIdentity()` at module-load time; when `input-store.ts` and `mapping-store.ts` are transitively imported in test workers, jsdom's localStorage may not be initialized yet. The global mock ensures all storage calls succeed regardless of import order.

### Task 2: Boot resolver + handleNewTab + D-02/D-12 removals (commit 90e2606)

**`apps/web/src/hooks/useSession.ts`** — Full refactor:

- **Boot resolver** (replaces the old "check for session to recover" effect): Three branches run once after store rehydration:
  - `tabIdentity.isNewTab` → return immediately (fresh `?new=1` tab, stores already cleared)
  - `tabIdentity.hasIdentity` → return immediately (refreshed tab, stores already hydrated from own keys)
  - else (D-07 auto-resume) → read registry, pick rank-0 (most-recently-modified), generate a NEW tabId via `crypto.randomUUID()`, write to `sessionStorage`, COPY the source session's data into the new tab's namespaced keys, call `setOptions+rehydrate` on both stores. Pitfall 5 / T-03-06 guard: the current tab always owns a unique tabId — no two tabs ever share a key.

- **`handleNewTab`** (D-01/D-03): `window.open(window.location.pathname + '?new=1', '_blank')` — instant, no confirm(). T-03-07 guard: only `window.location.pathname` used, never a user-controlled URL.

- **Session picker triggers** (D-07b): `showSessionPicker` state, `handleOpenSessionPicker`, `handleCloseSessionPicker`, `handlePickerResume(tabId)` — picker is on-demand, not startup-gated.

- **`clearStores`** updated: uses `useMappingStore.persist.getOptions().name` / `useInputStore.persist.getOptions().name` for dynamic key removal (instead of old static constants).

- **REMOVED** (D-12): entire `beforeunload` useEffect — redundant now that sessions auto-save and are recoverable.
- **REMOVED** (D-02): `showNewProjectModal`, `handleNewProject`, `handleSaveAndNew`, `handleDiscardAndNew`, `handleCancelNewProject` — in-place reset flow deleted.
- **REMOVED**: `showRecoveryModal` — startup-gated recovery modal removed; replaced by silent auto-resume.

### Task 3: useSession.test.ts (commit 44c9e03)

**`apps/web/src/hooks/useSession.test.ts`** — 3 tests covering the three acceptance criteria:

1. **D-12**: Spies on `window.addEventListener`; asserts no call with `'beforeunload'` after hook renders. Uses `vi.resetModules()` + dynamic import for deterministic tab-identity state.

2. **D-01/D-03**: Seeds `window.open` spy and `window.location.pathname = '/app'`; invokes `handleNewTab`; asserts `window.open` called once with `'/app?new=1'` and `'_blank'`; asserts `confirm()` never called.

3. **D-07/Pitfall-5**: Seeds registry + matching localStorage data for an existing tabId; confirms no `'folio-tab-id'` in sessionStorage (fresh-tab path); renders hook + awaits async effects; asserts new tabId written to sessionStorage, original keys still present (copy not move), new namespaced keys populated with identical data.

## Test Results

- `pnpm --filter @folio-mapper/web test --run -- input-store mapping-store`: 73/73 passed (after test-setup.ts fix)
- `pnpm --filter @folio-mapper/web test --run -- useSession`: 76/76 passed (10 test files, +3 new)
- `pnpm --filter @folio-mapper/web test --run` (full suite): **76/76 passed** (10 test files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Global localStorage mock added to test-setup.ts**
- **Found during:** Task 1 (running `pnpm test --run -- input-store mapping-store`)
- **Issue:** After adding `import { INPUT_KEY, tabIdentity } from './tab-identity'` to `input-store.ts`, the existing `input-store.test.ts` and `mapping-store.test.ts` began failing with `TypeError: localStorage.getItem is not a function`. Root cause: `tab-identity.ts` calls `localStorage.getItem()` synchronously at module-import time; when these test files import the stores, `tab-identity.ts` runs before jsdom fully initializes `localStorage` in the Vitest worker context (observed as `--localstorage-file was provided without a valid path` warning).
- **Fix:** Added Map-backed localStorage/sessionStorage mocks to `apps/web/src/test-setup.ts` (the global Vitest setup file), ensuring storage APIs are always available at module-load time across all test workers.
- **Files modified:** `apps/web/src/test-setup.ts`
- **Commit:** 3d16fac

**2. [Rule 2 - Missing Critical Functionality] sourceFile in registry onWrite set to null with comment**
- **Found during:** Task 1 (implementing onWrite callback)
- **Issue:** The `SessionRecord.sourceFile` field should ideally reflect the current session's source filename, but mapping-store has no access to input-store at debounce time without creating a circular dependency (mapping-store ← input-store ← tab-identity is fine; mapping-store → input-store would create a cycle). The registry is UI metadata only per threat model.
- **Fix:** `sourceFile: null` with a code comment explaining the architectural reason. This is acceptable; the session picker can display counts without a filename, and future plan 03-03 could wire this through a separate channel if needed.
- **Files modified:** `apps/web/src/store/mapping-store.ts`
- **Commit:** 3d16fac

## Threat Mitigations Applied

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-03-06 | mitigated | Auto-resume (D-07) copies data to freshly generated tabId; original keys untouched; no two tabs share a key |
| T-03-07 | mitigated | `window.open` receives `window.location.pathname + '?new=1'` ONLY — verified by grep and test assertion |
| T-03-08 | accepted | Registry is UI metadata only (no auth/privilege) — no mitigation needed |
| T-03-09 | mitigated | `updatedAt` stamped only inside `onWrite` callback (debounced setItem), not on in-memory store mutations |
| T-03-SC | n/a | No new packages installed in this plan |

## Threat Flags

(None — no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes introduced.)

## Self-Check: PASSED

Files created/modified:
- `apps/web/src/store/input-store.ts` — FOUND (contains INPUT_KEY, skipHydration)
- `apps/web/src/store/mapping-store.ts` — FOUND (contains MAPPING_KEY, skipHydration, upsertRegistry)
- `apps/web/src/hooks/useSession.ts` — FOUND (contains handleNewTab, readRegistry, setOptions, rehydrate)
- `apps/web/src/hooks/useSession.test.ts` — FOUND (3 tests: D-12, D-01/D-03, D-07/Pitfall-5)
- `apps/web/src/test-setup.ts` — FOUND (Map-backed storage mock)

Commits:
- `3d16fac` — feat(03-02): namespace store persist keys — FOUND
- `90e2606` — feat(03-02): boot resolver + handleNewTab — FOUND
- `44c9e03` — test(03-02): useSession.test.ts — FOUND
