---
phase: 03-new-session
plan: "01"
subsystem: session-storage
tags: [session, localStorage, tab-identity, lru-eviction, tdd]
dependency_graph:
  requires: []
  provides:
    - tab-identity.ts (synchronous tab ID resolver)
    - session-registry.ts (LRU registry CRUD)
    - session-storage.ts onWrite hook
  affects:
    - apps/web/src/store/input-store.ts (will consume MAPPING_KEY in later wave)
    - apps/web/src/store/mapping-store.ts (will consume INPUT_KEY in later wave)
    - apps/web/src/hooks/useSession.ts (will consume readRegistry in later wave)
tech_stack:
  added: []
  patterns:
    - synchronous module-level resolution (module side effect at import time)
    - Map-backed Storage mock for vitest jsdom environments without localStorage.clear
    - LRU eviction via sort+splice on max-5 array
    - onWrite callback hook in debounced storage adapter
key_files:
  created:
    - apps/web/src/store/tab-identity.ts
    - apps/web/src/store/tab-identity.test.ts
    - apps/web/src/store/session-registry.ts
    - apps/web/src/store/session-registry.test.ts
  modified:
    - apps/web/src/store/session-storage.ts
decisions:
  - "Map-backed localStorage mock required because vitest 2.1.9 jsdom environment does not implement localStorage.clear()"
  - "resolveTabIdentity exported as named function (in addition to module-level tabIdentity const) so tests can assert it is a function"
  - "localStorage.clear() workaround: vi.stubGlobal with Map-backed Storage mock in beforeEach"
metrics:
  duration_minutes: 7
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 1
---

# Phase 3 Plan 1: Per-Tab Session Storage Core Summary

**One-liner:** Synchronous tab-identity resolver with legacy migration + LRU session registry + debounced storage onWrite hook, all built TDD with Map-backed storage mocks.

## What Was Built

Three new/modified modules form the Wave 0 foundation for per-tab session persistence:

**`apps/web/src/store/tab-identity.ts`** — Synchronous module-level resolver that runs at import time (before any Zustand store is created). Implements four boot branches: (1) `?new=1` URL generates fresh tabId + strips param (D-05); (2) existing `sessionStorage['folio-tab-id']` is reused (D-08); (3) legacy single-session localStorage keys are migrated to namespaced per-tab keys without data loss (D-06); (4) no-identity fallback returns `{ tabId: '', hasIdentity: false }` for the boot resolver to handle (D-07). Exports `tabIdentity`, `MAPPING_KEY`, `INPUT_KEY`. No React/Zustand imports — pure browser Web APIs only. Security: `history.replaceState` receives `window.location.pathname` ONLY (T-03-01 guard).

**`apps/web/src/store/session-registry.ts`** — Pure functions over localStorage. `readRegistry()` with JSON.parse safety. `upsertRegistry()` upserts current tab first (bumps rank), sorts descending by `updatedAt`, splices to `MAX_SESSIONS=5`, removes evicted tabs' namespaced data keys (D-09/D-14). `deleteFromRegistry()` removes record and data keys. Never touches `folio-mapper-llm`.

**`apps/web/src/store/session-storage.ts`** (extended) — `createDebouncedStorage()` now accepts optional `opts?: { onWrite?: (name: string) => void }`. The callback fires AFTER `localStorage.setItem` succeeds inside the setTimeout, so `updatedAt` is tied to "last persisted" time (not in-memory mutation — Pitfall 3 guard). Zero-arg callsites (input-store, mapping-store) remain unaffected.

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | tab-identity.ts + tab-identity.test.ts (TDD) | cd09919 |
| 2 | session-registry.ts + session-registry.test.ts (TDD) | 96e656d |
| 3 | session-storage.ts onWrite extension + full suite green | ec25e73 |

## Test Results

- `pnpm --filter @folio-mapper/web test --run -- tab-identity`: 10/10 passed
- `pnpm --filter @folio-mapper/web test --run -- session-registry`: 13/13 passed
- `pnpm --filter @folio-mapper/web test --run` (full suite): **73/73 passed** (9 test files)
- No regression in pre-existing tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest jsdom localStorage.clear() not available**

- **Found during:** Task 1 (first test run after implementing RED tests)
- **Issue:** vitest 2.1.9's jsdom environment exposes `localStorage` but `localStorage.clear` is `undefined` (type: `"undefined"`). The `--localstorage-file` warning confirms a custom localStorage implementation is in use that lacks the `clear()` method.
- **Fix:** Created `makeStorageMock()` helper in both test files that returns a Map-backed `Storage` implementation with `clear()`. Used `vi.stubGlobal('localStorage', localStorageMock)` and `vi.stubGlobal('sessionStorage', sessionStorageMock)` in `beforeEach` to inject clean mocks per test. This pattern also ensures test isolation without relying on shared global state.
- **Files modified:** `apps/web/src/store/tab-identity.test.ts`, `apps/web/src/store/session-registry.test.ts`
- **Commit:** cd09919, 96e656d

### Out-of-Scope Pre-existing Type Errors

Pre-existing TypeScript errors found in `packages/core/src/llm/key-vault.ts` and `apps/web/src/__tests__/demo-mode-no-network.test.tsx` during the `tsc --noEmit` verification step. These are in files not modified by this plan. Logged as deferred per scope boundary rule — not fixed.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary crossings introduced. All new code is client-side localStorage/sessionStorage operations, consistent with the pre-existing posture documented in the plan's threat model.

- T-03-01 (Tampering/Injection via replaceState): Mitigated. `history.replaceState(null, '', window.location.pathname)` uses pathname-only — confirmed by grep + test assertion.
- T-03-03 (DoS via unbounded localStorage growth): Mitigated. `MAX_SESSIONS=5` LRU eviction implemented and tested.
- T-03-05 (Migration data loss): Mitigated. `migrateToNamespacedKeys()` centralized in `tab-identity.ts`; D-06 tests assert no data loss.

## Known Stubs

None. All modules are fully implemented. The `tabId: ''` fallback in `resolveTabIdentity()` is intentional per plan design (D-07 fallback path — the boot resolver in Plan 02 handles auto-resume for the no-identity case).

## Self-Check

### Created files exist:
- `apps/web/src/store/tab-identity.ts` — FOUND
- `apps/web/src/store/tab-identity.test.ts` — FOUND
- `apps/web/src/store/session-registry.ts` — FOUND
- `apps/web/src/store/session-registry.test.ts` — FOUND

### Modified files:
- `apps/web/src/store/session-storage.ts` — FOUND

### Commits exist:
- cd09919 — FOUND
- 96e656d — FOUND
- ec25e73 — FOUND

## Self-Check: PASSED
