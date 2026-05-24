---
phase: quick-260524-fmm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/core/src/mapping/compute-score-cutoff.ts
  - packages/core/src/mapping/compute-score-cutoff.test.ts
  - packages/ui/src/components/mapping/CandidateTree.tsx
  - packages/ui/src/components/mapping/MappingScreen.tsx
autonomous: true
requirements: [QUICK-260524-fmm]

must_haves:
  truths:
    - "A non-mandatory branch whose candidates all fall below the global score cutoff still shows its top 3 candidates"
    - "A non-mandatory branch with many high-scoring candidates still expands fully with the topN slider (no regression)"
    - "Mandatory and excluded branch behavior is unchanged"
    - "CandidateTree render and MappingScreen visibleCandidateHashes apply identical visibility logic"
  artifacts:
    - path: "packages/core/src/mapping/compute-score-cutoff.ts"
      provides: "selectVisibleCandidates helper with per-branch floor"
      contains: "export function selectVisibleCandidates"
    - path: "packages/core/src/mapping/compute-score-cutoff.test.ts"
      provides: "Regression test reproducing the global-threshold suppression bug"
      contains: "selectVisibleCandidates"
  key_links:
    - from: "packages/ui/src/components/mapping/CandidateTree.tsx"
      to: "selectVisibleCandidates"
      via: "import from @folio-mapper/core, used in non-mandatory branch of visibleCandidates"
      pattern: "selectVisibleCandidates"
    - from: "packages/ui/src/components/mapping/MappingScreen.tsx"
      to: "selectVisibleCandidates"
      via: "import from @folio-mapper/core, used in visibleCandidateHashes flatMap"
      pattern: "selectVisibleCandidates"
---

<objective>
Fix the `computeScoreCutoff` global-threshold bug (Defect 3 in area-of-law-sparse-results.md): one
high-scoring branch (e.g. Service, scores 87-99) pulls the single global score cutoff above the max
score of a sparse branch (e.g. Area of Law, max 52.4), causing the UI to hide ALL of that branch's
candidates even though the backend returned valid matches.

The fix gives NON-mandatory branches the same guarantee mandatory branches already have: a branch is
never fully suppressed. Mandatory branches use `sorted.slice(0, Math.max(topN, 3))`. We mirror that
floor for non-mandatory branches via Option A (per-branch flooring): after applying the global
threshold, always retain at least each branch's top 3 candidates.

Purpose: Restore visibility of valid candidates in sparse branches without regressing the topN
slider for branches that legitimately have many high-scoring candidates. Frontend-only — the backend
already returns the candidates.
Output: A shared pure helper in core, a vitest regression test, and both UI call sites updated to use it.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/debug/resolved/area-of-law-sparse-results.md
@.planning/debug/resolved/mandatory-branch-slider.md

<interfaces>
<!-- Existing helper (packages/core/src/mapping/compute-score-cutoff.ts) — unchanged signature -->
export function computeScoreCutoff(
  branchGroups: BranchGroup[],
  topN: number,
  branchStates: Record<string, BranchState>,
): number;

<!-- FolioCandidate (packages/core/src/folio/types.ts) — has numeric `score` and `iri_hash` -->
<!-- BranchState (packages/core/src/mapping/types.ts): 'normal' | 'mandatory' | 'excluded' -->

<!-- Current non-mandatory visibility logic (DUPLICATED at both call sites): -->
<!-- CandidateTree.tsx ~line 207: -->
<!--   visibleCandidates = threshold > 0 ? sorted.filter(c => c.score >= threshold) : sorted; -->
<!-- MappingScreen.tsx ~line 285: -->
<!--   candidates = effectiveThreshold > 0 ? sorted.filter(c => c.score >= effectiveThreshold) : sorted; -->
<!-- In BOTH, `sorted` is already `[...candidates].sort((a,b) => b.score - a.score)` (descending). -->

<!-- Mandatory floor pattern to mirror (both files): sorted.slice(0, Math.max(topN, 3)) -->

<!-- Core mapping barrel (packages/core/src/mapping/index.ts) re-exports compute-score-cutoff.* -->
<!-- UI imports: import { ..., computeScoreCutoff } from '@folio-mapper/core'; -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add selectVisibleCandidates helper with per-branch floor + regression test</name>
  <files>packages/core/src/mapping/compute-score-cutoff.ts, packages/core/src/mapping/compute-score-cutoff.test.ts</files>
  <behavior>
    selectVisibleCandidates(sortedDescending, threshold, floor=3) — pure function:
    - Input `sorted` is already sorted by score descending (callers pre-sort); function must NOT
      mutate the input array.
    - When threshold less than or equal to 0: return all candidates (no cutoff active) — matches the current `sorted` branch.
    - When threshold greater than 0: return the union of (a) candidates with score greater than or equal to threshold, AND
      (b) the top `floor` candidates — preserving descending order with no duplicates.
    - Floor guarantee: a non-empty branch always yields at least min(floor, branch length)
      candidates, even when every score is below threshold (the bug case).
    - No regression: a branch where at least `floor` candidates exceed the threshold returns exactly the
      thresholded set (the floor adds nothing because those top candidates already qualify).

    Regression test cases (the bug from Defect 3):
    - Test A (bug repro): branch "Area of Law" scores [52.4, 52.4, 47.3], threshold=59.4 (pulled up
      by a Service branch). Assert selectVisibleCandidates returns the top 3 (not empty).
    - Test B (no regression): branch scores [99, 88, 70, 60, 40], threshold=60 returns the 4
      candidates greater than or equal to 60 ([99,88,70,60]); floor of 3 adds nothing.
    - Test C (threshold less than or equal to 0): returns all candidates unchanged.
    - Test D (floor exceeds branch size): branch has 2 candidates all below threshold returns both.
    - Test E (de-dup order): top-floor candidates that also exceed threshold are not duplicated;
      result stays descending.
  </behavior>
  <action>
    In compute-score-cutoff.ts add and export a pure function selectVisibleCandidates that takes a
    descending-sorted FolioCandidate[], a numeric threshold, and an optional floor (default 3).
    Implement Option A (per-branch flooring): if threshold is not positive return the array as-is;
    otherwise build the visible set as the thresholded candidates unioned with the top `floor` slice,
    deduped by iri_hash and kept in descending order. Do NOT mutate the input. Add a JSDoc block
    explaining this mirrors the mandatory-branch Math.max(topN, 3) floor so one branch's high scores
    can never fully suppress a sparse branch. Leave computeScoreCutoff itself unchanged.
    Then extend compute-score-cutoff.test.ts with the behavior cases above; reuse the file's existing
    makeBranchGroup helper (read its .candidates) or build candidate arrays directly with
    label/iri/iri_hash/definition/synonyms/branch/branch_color/hierarchy_path/score fields.
  </action>
  <verify>
    <automated>pnpm --filter @folio-mapper/core test</automated>
  </verify>
  <done>selectVisibleCandidates exported from core; all new and existing compute-score-cutoff tests pass; bug-repro Test A asserts a non-empty top-3 result.</done>
</task>

<task type="auto">
  <name>Task 2: Wire selectVisibleCandidates into both UI call sites</name>
  <files>packages/ui/src/components/mapping/CandidateTree.tsx, packages/ui/src/components/mapping/MappingScreen.tsx</files>
  <action>
    Replace the duplicated non-mandatory visibility logic at both call sites with the shared helper.
    In CandidateTree.tsx (the `else` branch for non-mandatory, around line 207), replace
    `visibleCandidates = threshold greater than 0 ? sorted.filter(c => c.score greater than or equal to threshold) : sorted;`
    with `visibleCandidates = selectVisibleCandidates(sorted, threshold);`. In MappingScreen.tsx
    (the `else` branch around line 285), replace the effectiveThreshold filter with
    `candidates = selectVisibleCandidates(sorted, effectiveThreshold);`. Add `selectVisibleCandidates`
    to the existing `@folio-mapper/core` import in each file (CandidateTree's import line and
    MappingScreen.tsx line 16). Do NOT touch the mandatory branch, excluded branch, showAll, the
    selected-candidate union, or the searchFilter logic — only the non-mandatory threshold filter
    changes. Keep both call sites identical in behavior (the debug notes stress they must stay
    consistent). UI components remain pure/presentational per CLAUDE.md — no new state or store changes.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && pnpm --filter @folio-mapper/core test && grep -c "selectVisibleCandidates" packages/ui/src/components/mapping/CandidateTree.tsx packages/ui/src/components/mapping/MappingScreen.tsx</automated>
  </verify>
  <done>Both UI files import and call selectVisibleCandidates in their non-mandatory branch (grep returns at least 2 in each file: import + usage); core tests pass; mandatory/excluded/showAll paths untouched.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @folio-mapper/core test` passes (existing + new cases).
- Bug-repro test (Test A): a sparse non-mandatory branch with all scores below the global cutoff still surfaces its top 3 candidates.
- No-regression test (Test B): a dense branch still returns its full thresholded set without extra floored items.
- Both UI call sites use the shared `selectVisibleCandidates` helper (consistency between hash collection and render).
- Mandatory, excluded, showAll, selected-candidate-union, and searchFilter logic unchanged.
</verification>

<success_criteria>
- A non-mandatory branch is never fully suppressed by a higher-scoring sibling branch; it always shows at least its top 3 candidates.
- The topN slider still expands branches with many high-scoring candidates exactly as before (no regression).
- Frontend-only change — no backend scoring or search code modified.
- Logic duplicated across CandidateTree.tsx and MappingScreen.tsx is now centralized in one tested core helper.
</success_criteria>

<output>
Create `.planning/quick/260524-fmm-fix-computescorecutoff-global-threshold-/260524-fmm-SUMMARY.md` when done
</output>
