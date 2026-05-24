---
phase: quick-260524-fmm
plan: "01"
subsystem: mapping-ui
tags: [bug-fix, score-cutoff, candidate-visibility, tdd]
one_liner: "Per-branch floor guarantee in selectVisibleCandidates prevents sparse branches from being fully suppressed by high-scoring sibling branches"
dependency_graph:
  requires: []
  provides: [selectVisibleCandidates]
  affects:
    - packages/ui/src/components/mapping/CandidateTree.tsx
    - packages/ui/src/components/mapping/MappingScreen.tsx
tech_stack:
  added: []
  patterns:
    - "Pure helper function with floor guarantee (mirrors mandatory-branch Math.max(topN,3) pattern)"
    - "TDD RED/GREEN cycle for regression test coverage"
key_files:
  created:
    - packages/core/src/mapping/compute-score-cutoff.ts (selectVisibleCandidates added)
    - packages/core/src/mapping/compute-score-cutoff.test.ts (8 new test cases)
  modified:
    - packages/ui/src/components/mapping/CandidateTree.tsx
    - packages/ui/src/components/mapping/MappingScreen.tsx
decisions:
  - "Option A (per-branch flooring): union of threshold-passing candidates + top-floor slice, deduped by iri_hash"
  - "floor=3 default mirrors mandatory-branch guarantee; kept as parameter for future flexibility"
  - "selectVisibleCandidates does NOT mutate input array (callers already pre-sort with spread)"
metrics:
  duration: "~2.5 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Quick Task 260524-fmm: Fix computeScoreCutoff Global Threshold Summary

Per-branch floor guarantee in `selectVisibleCandidates` prevents sparse branches from being fully suppressed by high-scoring sibling branches.

## What Was Built

### Task 1: selectVisibleCandidates helper + regression test (TDD)

Added and exported a pure function `selectVisibleCandidates` in `packages/core/src/mapping/compute-score-cutoff.ts`.

**The bug (Defect 3):** `computeScoreCutoff` pools all non-mandatory branch scores globally and returns the Nth score as a cutoff. When a high-scoring branch (e.g. Service, scores 87-99) pulls the cutoff above the max score of a sparse branch (e.g. Area of Law, max 52.4), the UI's `sorted.filter(c => c.score >= threshold)` call returns an empty array and hides ALL of that branch's candidates.

**The fix:** `selectVisibleCandidates(sorted, threshold, floor=3)`:
- When `threshold <= 0`: return all candidates (existing "show all" behavior unchanged)
- When `threshold > 0`: return the union of (a) candidates with `score >= threshold` AND (b) top `floor` candidates — deduped by `iri_hash`, descending order preserved, input not mutated
- This mirrors the mandatory-branch `sorted.slice(0, Math.max(topN, 3))` floor pattern

**Regression tests (8 new cases):**
- Test A (bug repro): Area of Law [52.4, 52.4, 47.3], threshold=59.4 → returns top 3, not empty
- Test B (no regression): [99, 88, 70, 60, 40], threshold=60 → returns [99,88,70,60], floor adds nothing
- Test C: threshold <= 0 → returns all unchanged
- Test D: floor exceeds branch size → returns all candidates
- Test E: dedup — top-floor candidates already in threshold set are not duplicated
- Additional: no-mutation, custom floor parameter, empty input

All 30 tests pass (22 pre-existing + 8 new).

### Task 2: Wire selectVisibleCandidates into both UI call sites

**CandidateTree.tsx:** Two replacement sites:
1. `allCollapsible` useMemo (line ~133): `visible = selectVisibleCandidates(sorted, threshold);`
2. Render-path (line ~207): `visibleCandidates = selectVisibleCandidates(sorted, threshold);`

**MappingScreen.tsx:** One replacement site:
- `visibleCandidateHashes` flatMap (line ~285): `candidates = selectVisibleCandidates(sorted, effectiveThreshold);`

Both files import `selectVisibleCandidates` from `@folio-mapper/core`. Mandatory/excluded/showAll/selected-candidate-union/searchFilter paths are untouched.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | afbbd4d | test(quick-260524-fmm-01): add failing tests for selectVisibleCandidates |
| 1 (GREEN) | a7a5734 | feat(quick-260524-fmm-01): add selectVisibleCandidates with per-branch floor guarantee |
| 2 | 272e328 | feat(quick-260524-fmm-01): wire selectVisibleCandidates into both UI call sites |

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate commit: afbbd4d (test import of non-exported `selectVisibleCandidates` causes 8 failures)
- GREEN gate commit: a7a5734 (all 30 tests pass after implementation)
- No REFACTOR gate needed (implementation was clean on first pass)

## Verification

- `pnpm --filter @folio-mapper/core test` passes (30/30 tests)
- Bug-repro Test A: sparse branch with all scores below threshold returns top 3 (not empty)
- No-regression Test B: dense branch returns full thresholded set without extra floored items
- Both UI call sites confirmed via `grep -c "selectVisibleCandidates"` (CandidateTree: 3, MappingScreen: 2)
- Pre-existing TypeScript errors in `key-vault.ts` are unrelated to this change (out of scope per deviation rules)

## Known Stubs

None.

## Threat Flags

None — frontend-only change. No new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

- packages/core/src/mapping/compute-score-cutoff.ts: FOUND
- packages/core/src/mapping/compute-score-cutoff.test.ts: FOUND
- packages/ui/src/components/mapping/CandidateTree.tsx: FOUND
- packages/ui/src/components/mapping/MappingScreen.tsx: FOUND
- Commit afbbd4d: FOUND
- Commit a7a5734: FOUND
- Commit 272e328: FOUND
