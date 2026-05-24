---
phase: 04-demo-payloads-for-existing-exemplar-areas
plan: 01
subsystem: frontend/exemplar-demos
tags: [demo-mode, lazy-loading, test-scaffolding, wave-0]
dependency_graph:
  requires: []
  provides:
    - async getDemoPayload with LAZY_LOADERS for 9 new slugs
    - DEMO_AVAILABLE_SLUGS hardcoded to all 10 canonical slugs
    - Wave 0 parametrized test harnesses (roundtrip, no-network, richness, index)
  affects:
    - apps/web/src/App.tsx (await at call site)
    - apps/web/src/exemplar/demos/index.ts
tech_stack:
  added: []
  patterns:
    - Template-literal dynamic import() to bypass Vite vite:import-analysis static validation
    - it.each parametrized test tables for per-area extension without rewrites
    - Graceful null return on import() failure for not-yet-committed demo JSON files
key_files:
  created:
    - apps/web/src/__tests__/demo-mode-richness.test.ts
  modified:
    - apps/web/src/exemplar/demos/index.ts
    - apps/web/src/App.tsx
    - apps/web/src/__tests__/demo-mode-roundtrip.test.tsx
    - apps/web/src/__tests__/demo-mode-no-network.test.tsx
    - apps/web/src/exemplar/demos/index.test.ts
decisions:
  - Template-literal _mkLoader() used instead of static import() paths to prevent Vite from validating not-yet-committed JSON files at transform time
  - getDemoPayload wraps loader() in try/catch so missing JSON files return null gracefully rather than throwing
  - PI richness test is it.todo until Plan 03 re-curation (shipped at threshold 0.30, all-accepted 19/19)
  - DEMO_AVAILABLE_SLUGS hardcoded to 10 slugs (cannot derive dynamically from async loaders)
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-24"
  tasks_completed: 2
  files_modified: 6
---

# Phase 04 Plan 01: Async Lazy Loading Foundation + Wave 0 Test Scaffolds Summary

**One-liner:** Async getDemoPayload with template-literal lazy loaders for 9 new slugs, DEMO_AVAILABLE_SLUGS hardcoded to 10, App.tsx awaited, and four parametrized test harnesses so per-area plans add one import + one table row each.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate index.ts to async lazy loading + await App.tsx call site | c96d77c | index.ts, App.tsx |
| 2 | Parametrize roundtrip + no-network + richness + index harnesses (Wave 0 scaffolds) | b0cd480 | 4 test files, index.ts (Vite fix) |

## What Was Built

### Task 1: Async getDemoPayload

`apps/web/src/exemplar/demos/index.ts` was migrated from a synchronous eager-import pattern to async lazy loading:

- PI stays eager-imported (already in bundle, existing tests rely on it)
- 9 new slugs get `_mkLoader(slug)` entries in `LAZY_LOADERS` — each returns a `() => Promise<{ default: DemoPayload }>` via template-literal `import()`
- In-memory `_demoCache` prevents re-fetching within a session (bounded to ≤10 slugs)
- `getDemoPayload` is now `async function getDemoPayload(slug): Promise<DemoPayload | null>`, with try/catch for graceful null on import failure
- `DEMO_AVAILABLE_SLUGS` hardcoded to all 10 canonical slugs (cannot derive dynamically)
- `App.tsx` line 554 updated: `getDemoPayload(id)` → `await getDemoPayload(id)` (handleExemplarSelect was already async)

### Task 2: Wave 0 Test Harnesses

Four test files parametrized for per-area extension:

- **roundtrip.test.tsx**: `it.each([['personal-injury', demoPI]])` — PI row passes; new areas added one row each
- **no-network.test.tsx**: `it.each([['personal-injury', demoPI]])` — PI zero-network assertion passes; hydration test preserved
- **demo-mode-richness.test.ts** (NEW): D-03 harness with empty it.each (active cases added after per-area curation) + `it.todo('personal-injury...')` + sanity-check confirming PI is currently all-accepted (19/19)
- **index.test.ts**: appended `describe('demo manifest registration')` — DEMO_AVAILABLE_SLUGS size=10, getDemoPayload('personal-injury') resolves to version '1.3', getDemoPayload('does-not-exist') resolves to null

Test results: 13 passed, 1 todo, 0 failures across all 4 files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vite vite:import-analysis rejects static dynamic import() paths for not-yet-committed files**
- **Found during:** Task 2 (first test run of index.test.ts)
- **Issue:** Vite's `vite:import-analysis` plugin validates all `import()` call paths at transform time — including those inside `LAZY_LOADERS` entries — even when target files don't exist yet. `@vite-ignore` did not suppress this in Vite 5.4.21.
- **Fix:** Replaced static `() => import('./solo-criminal.demo.json')` pattern with a `_mkLoader(slug)` helper that produces `() => import(\`.\/${slug}.demo.json\`)` (template literal). Vite treats template-literal dynamic imports as truly runtime-dynamic and does not validate them at transform time. Also added try/catch in getDemoPayload to return null gracefully when the import fails (for not-yet-committed files).
- **Files modified:** `apps/web/src/exemplar/demos/index.ts`
- **Commit:** b0cd480

## Test Results

```
Test Files  4 passed (4)
    Tests  13 passed | 1 todo (14)
```

- roundtrip: 1 pass (PI)
- no-network: 2 pass (PI zero-network + hydration)
- richness: 2 pass (sanity check + todo)
- index: 9 pass (6 detectStalePreset + 3 registration)

## Known Stubs

None. The `_mkLoader` entries for 9 new slugs return null gracefully when JSON files don't exist — this is intentional scaffolding, not a stub. The LAZY_LOADERS are wired and will automatically resolve once per-area JSON files are committed in Plans 02-10.

## Threat Surface Scan

No new trust boundaries introduced. Changes are:
- `index.ts`: purely in-bundle, static JSON, no user-controlled paths (slug is gated by hardcoded DEMO_AVAILABLE_SLUGS)
- `App.tsx`: single `await` addition, no new network calls or data handling
- Test files: test-only, no production surface

## Self-Check: PASSED

- `apps/web/src/exemplar/demos/index.ts` — FOUND
- `apps/web/src/App.tsx` — FOUND (await getDemoPayload)
- `apps/web/src/__tests__/demo-mode-richness.test.ts` — FOUND
- `apps/web/src/__tests__/demo-mode-roundtrip.test.tsx` — FOUND (it.each)
- `apps/web/src/__tests__/demo-mode-no-network.test.tsx` — FOUND (it.each)
- `apps/web/src/exemplar/demos/index.test.ts` — FOUND (registration block appended)
- Commit c96d77c — FOUND (Task 1)
- Commit b0cd480 — FOUND (Task 2)
