---
phase: 02-demo-mode
plan: 04
subsystem: testing
tags: [demo, round-trip, network-invariant, version-mismatch, docs]

requires:
  - phase: 02-03
    provides: loadSessionFromObject + demo store warning state + App wiring

provides:
  - Automated round-trip test asserting bundled PI payload hydrates identically via loadSessionFromObject and via File-based handleLoadSessionFile (spike-001 invariant locked)
  - Automated zero-network test asserting loadSessionFromObject makes no LLM/pipeline/parse/embedding/mapping/export/github/synthetic/pricing fetches
  - Pure detectStalePreset helper extracted from App.tsx with 6 unit tests covering match/mismatch/nullish corners
  - docs/curating-demo-payloads.md operator-facing curation workflow
  - README link to the new docs page

affects: [02-completion, future-demo-areas, regression-coverage]

tech-stack:
  added: []
  patterns:
    - "Test the shipping production artifact (apps/web/src/exemplar/demos/personal-injury.demo.json), not a fixture — schema bumps that break production payloads must break this test too"
    - "jsdom 25 does not implement Blob.text(); polyfill via Object.defineProperty(file, 'text', { value }) on the test File instance"
    - "Version-drift detection is a pure args→args|null function; App.tsx is now a thin caller"

key-files:
  created:
    - apps/web/src/__tests__/demo-mode-roundtrip.test.tsx
    - apps/web/src/__tests__/demo-mode-no-network.test.tsx
    - apps/web/src/exemplar/demos/index.test.ts
    - docs/curating-demo-payloads.md
  modified:
    - apps/web/src/exemplar/demos/index.ts
    - apps/web/src/App.tsx
    - README.md

key-decisions:
  - "Put detectStalePreset tests in apps/web/src/exemplar/demos/index.test.ts rather than the plan's hooks/useSession.test.ts because the helper lives in demos/index.ts and there is no useSession.test.ts file to extend"
  - "Polyfill File.prototype.text() on the test instance rather than upgrading jsdom or wiring a different file-reading abstraction — minimal blast radius, contained to the round-trip test"
  - "Test the shipping personal-injury.demo.json directly rather than a fixture; a future SessionFile schema bump that breaks production payloads will break this test, which is the desired regression signal"

patterns-established:
  - "apps/web/src/__tests__/ holds cross-cutting tests that touch multiple stores + the shipping demo payloads"
  - "Pure helpers go alongside the module they support (demos/index.test.ts next to demos/index.ts), not in a separate test tree"

requirements-completed:
  - PHASE-02-SC-02
  - PHASE-02-SC-05
  - PHASE-02-SC-06

duration: ~15min
completed: 2026-05-20
---

# Phase 02-04: Lock-In Tests + Curation Docs Summary

**Round-trip + zero-network invariants locked behind automated tests against the shipping PI payload; detectStalePreset extracted as a pure helper with 6 unit tests; operator-facing curation doc shipped and linked from README.**

## Performance

- **Tasks:** 4 (3 auto + 1 docs)
- **Files created:** 4
- **Files modified:** 3
- **Tests added:** 9 (1 round-trip + 2 no-network + 6 detectStalePreset)
- **apps/web suite:** 50/50 passing (was 41 before this plan, +9 new)

## Accomplishments
- **Round-trip invariant locked.** `demo-mode-roundtrip.test.tsx` loads the shipping `personal-injury.demo.json` through both `loadSessionFromObject(payload)` (demo-mode path) and `handleLoadSessionFile(file)` (drag-drop path) and asserts identical store snapshots across 16 keys covering input + mapping state. Future schema drift will surface here.
- **Zero-network invariant locked.** `demo-mode-no-network.test.tsx` stubs `globalThis.fetch` with vi.spyOn and asserts zero calls to `/api/{pipeline,llm,parse,embedding,mapping,export,github,synthetic,pricing}` during `loadSessionFromObject`. Second test confirms the load still hydrates stores correctly under the stub.
- **detectStalePreset extracted.** Moved the inline version-comparison from App.tsx into a pure `detectStalePreset(args): VersionVector | null` helper exported from `apps/web/src/exemplar/demos/index.ts`. App.tsx now calls it and feeds the result straight into `setStalePresetWarning`. 6 unit tests cover: both match, pipeline mismatch, folio mismatch, payload nullish, runtime nullish, and pipeline-only when folio runtime is null.
- **Curation doc shipped.** `docs/curating-demo-payloads.md` covers when to recurate, prerequisites, both LLM and --no-llm workflows, adding a new practice area (in 6 numbered steps), what NOT to commit, the runtime consumption flow, and cross-references to spike 001 + phase plans. README links to it under a new **Internal docs** subsection of Contributing.

## Task Commits

1. **Task 1: Round-trip test** — pending in 02-04 plan-complete commit
2. **Task 2: Zero-network test** — pending in 02-04 plan-complete commit
3. **Task 3: detectStalePreset + tests + App.tsx refactor** — pending in 02-04 plan-complete commit
4. **Task 4: Curation doc + README link** — pending in 02-04 plan-complete commit

## Files Created/Modified

**Created**
- `apps/web/src/__tests__/demo-mode-roundtrip.test.tsx` — spike-001 invariant; jsdom-25 File.text() polyfill in the test
- `apps/web/src/__tests__/demo-mode-no-network.test.tsx` — 2 tests covering offline contract + hydration under fetch stub
- `apps/web/src/exemplar/demos/index.test.ts` — 6 unit tests for detectStalePreset
- `docs/curating-demo-payloads.md` — operator-facing curation workflow

**Modified**
- `apps/web/src/exemplar/demos/index.ts` — exported `VersionVector` interface + `detectStalePreset()` helper
- `apps/web/src/App.tsx` — replaced inline version-comparison with `detectStalePreset(...)` call; removed redundant if/else branch
- `README.md` — added "Internal docs" subsection under Contributing with link to the curation doc

## Decisions Made
- **Test the shipping artifact, not a fixture.** The round-trip test imports `apps/web/src/exemplar/demos/personal-injury.demo.json` directly. If the SessionFile schema or curation script output drifts, this test breaks loudly — which is exactly the regression signal we want.
- **detectStalePreset returns the input vector when stale.** Returning `args` (rather than a new object with the same shape) keeps the helper free of allocation noise and makes the App.tsx call site one-liner clean: `setStalePresetWarning(detectStalePreset({...}))`.
- **Polyfill File.text() on the test instance, not globally.** jsdom 25 lacks `Blob.text()`. Patching globally would mask future jsdom upgrades; patching the instance only when missing keeps the workaround contained and self-removing once jsdom adds the method.

## Deviations from Plan
- **detectStalePreset tests live in `apps/web/src/exemplar/demos/index.test.ts`, not `apps/web/src/hooks/useSession.test.ts`.** The plan named useSession.test.ts as the home for these tests, but the helper itself lives in demos/index.ts (per Task 3's own action block), and there is no existing useSession.test.ts to extend. Co-locating the tests next to the module under test is the convention everywhere else in the repo. Trivial deviation.
- **Two extra detectStalePreset tests (6 instead of 5).** The plan listed 5 cases; I added a sixth ("fires on pipeline mismatch alone when folio runtime is null") because Plan 02-03 explicitly anticipated a null `runtimeFolioVersion` and the banner is expected to still fire on pipeline-only drift — worth pinning down.
- **Added a second no-network test ("still hydrates stores correctly when fetch is stubbed").** Defensive: proves the invariant doesn't accidentally break loadSessionFromObject's positive path.

**Total deviations:** 3 (1 location move, 2 extra tests). All additive; no scope creep.

## Issues Encountered
- **jsdom 25 missing Blob.text().** First round-trip test run failed with `file.text is not a function`. Added an instance-level polyfill on the test File so the hook's `await file.text()` resolves to the JSON payload. Documented inline in the test for future maintainers.

## User Setup Required
None — all tests run under `pnpm vitest run` with the existing test setup.

## Next Phase Readiness
- All 8 phase success criteria are now backed by either committed code (02-01..02-03), automated tests (02-04), operator-verified smoke (02-03 Task 4), or the curation doc (02-04 Task 4). Phase 02 is feature-complete.
- Suggested follow-ups for a future phase (out of scope for v1.0 milestone): add Family Law + Corporate M&A demo payloads (currently only PI ships); add a backend endpoint that surfaces the loaded FOLIO ontology version so fetchRuntimeFolioVersion can drop its `null` fallback; normalize curation script's `pipeline_version` to strip the `+gitsha` suffix when the working tree is clean, so the banner doesn't fire spuriously within a single semver release.

---
*Phase: 02-demo-mode*
*Completed: 2026-05-20*
