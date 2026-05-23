---
status: resolved
trigger: "mandatory-branch-slider-not-expanding"
created: 2026-04-06T00:00:00Z
updated: 2026-05-22T00:00:00Z
resolution: not-a-bug + mitigated-by-later-work
---

## Resolution Update (2026-05-22 — milestone v1.0 close re-test)

Confirmed the original diagnosis: this was never a frontend bug. The slider correctly slices
`sorted.slice(0, Math.max(topN, 3))`; it simply cannot show more candidates than the backend
returned. The real cause was the backend returning too few candidates for sparse branches —
the same root cause as [[area-of-law-sparse-results]].

Re-test: `search_candidates("Securities Litigation", use_bridging=True)` now returns **4** Area of
Law candidates (was 1 in April), so a mandatory Area of Law branch now expands to up to 4 with the
slider instead of being stuck at 1. The post-April embedding/spaCy/bridging discovery work resolved
the underlying sparsity. Frontend slice logic was correct all along and needs no change.

Outcome: resolved — frontend behaviour is correct; backend sparsity (the actual cause) is mitigated
by later search improvements. Closing alongside [[area-of-law-sparse-results]].

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — Mandatory branches are hard-capped at max_per_branch*2 (=20) candidates in the backend, and the frontend's per-branch slice uses `sorted.slice(0, Math.max(topN, 3))` against that returned set — but when a mandatory branch only has 1 or 2 candidates in the backend response (because few matched the query), slicing to topN=10 can't produce more than what was returned. The frontend slice IS respecting topN, but the bottleneck is the backend only returning 1 candidate in the first place.
test: confirmed by reading CandidateTree.tsx lines 199-210 and folio_service.py line 1378
expecting: root cause found
next_action: report findings

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Increasing the "Show" slider from 5 to 10 should show more candidates in ALL branches, including mandatory ones like "Area of Law"
actual: The slider only expands non-mandatory branches. Mandatory branches (Area of Law, Service) keep showing the same number of candidates regardless of slider position
errors: No errors — just no expansion of mandatory branch candidates
reproduction: Map "Securities Litigation", observe Area of Law shows 1 result, increase the slider — Area of Law still shows 1 result
started: May have always been the case — needs investigation

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The frontend slider value (topN) is not being passed to mandatory branch rendering
  evidence: CandidateTree.tsx lines 199-210 clearly use topN for mandatory branch slicing: `sorted.slice(0, Math.max(topN, 3))`. topN IS used.
  timestamp: 2026-04-06T00:00:01Z

- hypothesis: computeScoreCutoff is being applied to mandatory branches
  evidence: compute-score-cutoff.ts line 27 explicitly skips mandatory branches: `if (state === 'excluded' || state === 'mandatory') continue;`
  timestamp: 2026-04-06T00:00:01Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-06T00:00:01Z
  checked: packages/core/src/mapping/compute-score-cutoff.ts lines 26-28
  found: computeScoreCutoff explicitly skips mandatory branches — they are completely excluded from the global threshold pool
  implication: Mandatory branches never get a score threshold applied; instead they get per-branch slicing in the rendering layer

- timestamp: 2026-04-06T00:00:01Z
  checked: packages/ui/src/components/mapping/CandidateTree.tsx lines 199-210
  found: Mandatory branches use `sorted.slice(0, Math.max(topN, 3))` — so topN IS respected for the slice. If topN=10 and sorted has 10 items, all 10 show.
  implication: The frontend IS correctly scaling mandatory branch display with topN. The slice logic is correct.

- timestamp: 2026-04-06T00:00:01Z
  checked: backend/app/services/folio_service.py line 1378
  found: `branch_limit = max_per_branch * 2 if branch_name in mandatory_set else max_per_branch` — mandatory branches get 2× the backend limit (default: 10*2=20 candidates returned)
  implication: Backend returns up to 20 candidates for mandatory branches. Plenty to slice from.

- timestamp: 2026-04-06T00:00:01Z
  checked: "Securities Litigation" + "Area of Law" scenario
  found: Area of Law shows only 1 result at topN=5 AND at topN=10. The backend returned only 1 candidate for Area of Law. The frontend slice `sorted.slice(0, Math.max(10, 3))` of a 1-element array is still 1 element.
  implication: The slider can't show more than what the backend returned. The backend only found 1 Area of Law match for "Securities Litigation". The topN slider physically cannot expand beyond the number of candidates in the response.

- timestamp: 2026-04-06T00:00:01Z
  checked: MappingScreen.tsx line 282: `const branchLimit = Math.max(safeTopN, 3);` and same pattern in CandidateTree.tsx line 204
  found: Both the visibleCandidateHashes computation (MappingScreen) and the actual render (CandidateTree) use the same slice logic. Consistent, correct.
  implication: Frontend logic is correct and consistent. No divergence between hash collection and rendering.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The topN slider cannot expand mandatory branches beyond the number of candidates the backend returned. For "Securities Litigation" + "Area of Law", the backend only returns 1 candidate. The frontend correctly slices `sorted.slice(0, Math.max(topN, 3))` — but slicing a 1-element array at any N still gives 1 element. The slider appears broken for mandatory branches with sparse results because there is nothing more to show — the backend search simply didn't find additional matches. The non-mandatory branches DO expand because they use a score threshold (not a count limit), and the backend returned 10+ candidates in those branches that were hidden by the threshold; raising topN lowers the threshold, revealing pre-existing candidates. Mandatory branches have no hidden candidates — every returned candidate is already visible at topN=5 (min 3).
fix: (not requested — diagnose only)
verification:
files_changed: []
