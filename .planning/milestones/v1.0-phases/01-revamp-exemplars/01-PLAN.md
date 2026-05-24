# Phase 1: Revamp Exemplars for Higher Hit Rate - Plan

**Created:** 2026-04-06
**Status:** Ready for execution
**Goal:** Replace 7 low-precision exemplars with 10 high-precision ones (~60% verbatim FOLIO labels, ~40% close synonyms)

---

## Overview

The current 7 exemplars use practitioner jargon that often doesn't match FOLIO's ontology labels, giving users a poor first impression. This phase reverse-engineers exemplars from what FOLIO actually contains, then dresses them as realistic practice area taxonomies. Three new practice areas are added (Real Estate, Banking & Finance, Immigration) for a total of 10.

## Pre-requisites

- `pip install folio` (folio-python library)
- FOLIO ontology cached at `~/.folio/cache/` (auto-downloads on first `FOLIO()` call)

---

## Tasks

### Task 1: FOLIO Branch Explorer Script
**File:** `scripts/explore_folio_branches.py`
**Purpose:** Map which FOLIO concepts exist under each of the 10 target practice areas

**What to build:**
1. Load FOLIO via `from folio import FOLIO`
2. For each of the 10 practice areas, identify the most relevant FOLIO branch(es):
   - Criminal Defense → Criminal law concepts
   - Family Law → Family/domestic law concepts
   - Personal Injury → Tort/negligence/liability concepts
   - Employment & Labor → Employment/labor law concepts
   - Corporate M&A → Corporate/business/merger concepts
   - IP & Technology → IP/patent/trademark/copyright concepts
   - Commercial Litigation → Commercial/contract/securities concepts
   - Real Estate → Property/real estate/land use concepts
   - Banking & Finance → Banking/finance/securities/lending concepts
   - Immigration → Immigration/visa/citizenship concepts
3. For each branch, walk `parent_class_of` recursively to enumerate all descendant concepts
4. Output per-area report: concept count, list of labels, alt_labels, and definitions
5. Save output to `scripts/output/folio_branch_report.json`

**Acceptance:** Script runs, produces a JSON report with concept counts per practice area. At least 20 concepts per area.

---

### Task 2: Exemplar Generator Script
**File:** `scripts/generate_exemplars.py`
**Purpose:** Generate 10 exemplar taxonomies with ~60% verbatim / ~40% synonym mix

**What to build:**
1. Load the branch report from Task 1
2. For each practice area:
   a. Select verbatim FOLIO labels that sound natural as practice area items (~60% of leaf terms)
   b. Use LLM (Claude API via `anthropic` SDK or `alea-llm-client`) to:
      - Suggest realistic synonym variants for remaining ~40% of leaf terms
      - Ensure synonyms are close enough to score well in fuzzy search (e.g., "Divorce Proceedings" for FOLIO's "Dissolution of Marriage")
   c. Organize into a realistic 3-level hierarchy:
      - Level 0: Practice area name (e.g., "Criminal Defense")
      - Level 1: Sub-categories (e.g., "DUI / Impaired Driving") — 5-6 per area
      - Level 2: Specific items — 2 per sub-category
   d. Output in the `Exemplar` TypeScript interface format
3. Tag each leaf term as `[V]` verbatim or `[S]` synonym in a side report (for validation)
4. Save generated exemplars to `scripts/output/generated_exemplars.ts`
5. Save term classification report to `scripts/output/term_report.json`

**Acceptance:** 10 exemplars generated, each with 10-12 leaf terms, ~60% tagged verbatim.

---

### Task 3: Validation Script
**File:** `scripts/validate_exemplars.py`
**Purpose:** Pre-validate that generated terms produce strong FOLIO search matches

**What to build:**
1. Load generated exemplars from Task 2
2. For each leaf term, run `folio.search_by_label(term, include_alt_labels=True, limit=5)`
3. Record:
   - Best match label and score (0-100)
   - Whether the best match is from the expected FOLIO branch
   - Whether score meets threshold (>=60 = good, 40-59 = marginal, <40 = miss)
4. Output per-exemplar summary:
   - Total terms, good/marginal/miss counts, average score
   - Overall hit rate percentage
5. Flag any terms scoring <40 for manual review/replacement
6. Save validation report to `scripts/output/validation_report.json`
7. Print human-readable summary to stdout

**Acceptance:** All 10 exemplars achieve >=80% hit rate (terms scoring >=60). Any misses are flagged for replacement.

---

### Task 4: Iterate on Low Scorers
**Purpose:** Replace terms that scored poorly in validation

**What to do:**
1. Review flagged terms from Task 3's validation report
2. For each miss/marginal term:
   - Check if a verbatim FOLIO label exists that fits the practice area
   - If yes, swap in the verbatim label
   - If no, try alternate synonym phrasing
3. Re-run validation (Task 3) after replacements
4. Repeat until all exemplars hit >=80% hit rate target

**Acceptance:** All 10 exemplars pass validation threshold after iteration.

---

### Task 5: Update Exemplar Data File
**File:** `packages/core/src/exemplar/data.ts`
**Purpose:** Replace the 7 existing exemplars with 10 validated ones

**What to do:**
1. Copy validated exemplars from `scripts/output/generated_exemplars.ts`
2. Replace the `EXEMPLARS` array in `data.ts`
3. Ensure each exemplar follows the existing interface: `{ id, label, description, text }`
4. Order: keep original 7 first (revised), then 3 new ones
5. Update descriptions to accurately summarize each exemplar's content
6. Run existing frontend tests (`pnpm test`) to verify no breakage

**Acceptance:** `data.ts` has 10 exemplars, TypeScript compiles, existing tests pass.

---

### Task 6: Adjust ExemplarPanel Grid for 10 Items
**File:** `packages/ui/src/components/input/ExemplarPanel.tsx`
**Purpose:** The grid currently shows 7 buttons in a `grid-cols-2 sm:grid-cols-4` layout. With 10 items this needs adjustment.

**What to do:**
1. Change grid to `grid-cols-2 sm:grid-cols-5` (2 rows of 5 on desktop)
2. Alternatively: `grid-cols-2 sm:grid-cols-4 lg:grid-cols-5` for better responsive behavior
3. Verify button sizing still works with longer labels (e.g., "Banking & Finance")
4. Visual check: take screenshot to verify layout looks good

**Acceptance:** 10 exemplar buttons display cleanly in a balanced grid on desktop and mobile.

---

### Task 7: Manual Backend Validation (User)
**Purpose:** User runs all 10 exemplars through the full backend pipeline

**What to do:**
1. Start dev servers (`pnpm dev`)
2. Click each of the 10 exemplars
3. Check mapping results for high-confidence matches
4. Note any terms that need further adjustment
5. If issues found, iterate on Task 4

**Acceptance:** User is satisfied with mapping quality across all 10 exemplars.

---

## Execution Order

```
Task 1 (explore) → Task 2 (generate) → Task 3 (validate) → Task 4 (iterate)
                                                                    ↓
                                                              Task 5 (update data.ts)
                                                                    ↓
                                                              Task 6 (adjust grid)
                                                                    ↓
                                                              Task 7 (manual test)
```

Tasks 1-4 are sequential (each depends on the prior output).
Tasks 5-6 can run in parallel after Task 4.
Task 7 is manual, after Tasks 5-6.

---

## Scripts Directory

All scripts go in `scripts/` at the repo root. Output files go in `scripts/output/` (gitignored).

```
scripts/
├── explore_folio_branches.py
├── generate_exemplars.py
├── validate_exemplars.py
└── output/
    ├── folio_branch_report.json
    ├── generated_exemplars.ts
    ├── term_report.json
    └── validation_report.json
```

---

## Success Criteria

1. **10 exemplars** covering big law, mid law, and solo/small practice types
2. **>=80% hit rate** per exemplar (leaf terms scoring >=60 in `search_by_label`)
3. **~60/40 split** between verbatim FOLIO labels and close synonyms
4. **Realistic taxonomies** that look like actual practice area breakdowns
5. **No regressions** — existing tests pass, UI displays correctly
6. **User approval** after manual backend testing

---

*Phase: 01-revamp-exemplars*
*Plan created: 2026-04-06*
