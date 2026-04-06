# Phase 1: Revamp Exemplars for Higher Hit Rate - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Revamp all exemplar taxonomies on the home screen so the system produces high-precision FOLIO matches out of the box. Expand from 7 to 10 exemplars. Each exemplar's leaf terms should be ~60% verbatim FOLIO labels and ~40% close synonyms the search pipeline matches easily.

</domain>

<decisions>
## Implementation Decisions

### Term Sourcing
- **D-01:** Use folio-python to explore FOLIO branches + LLM to generate natural-sounding taxonomy labels. Not manual curation alone.
- **D-02:** ~60% of leaf terms should be verbatim FOLIO concept labels; ~40% should be close synonyms that score well in search.

### Practice Areas
- **D-03:** Keep all 7 existing practice areas (Solo Criminal Defense, Family Law, Personal Injury, Employment & Labor, Corporate M&A, IP & Technology, Commercial Litigation). Revise their terms for better hit rates.
- **D-04:** Add 3 new practice areas: Real Estate, Banking & Finance, Immigration.
- **D-05:** The full set of 10 must cover a realistic mix of big law, mid law, and solo/small practitioner types.

### Validation
- **D-06:** Two-pronged validation: (1) folio-python script runs `search_by_label` for each term and reports scores, (2) user manually runs exemplars through the full backend pipeline.

### Claude's Discretion
- Hierarchy depth and structure per exemplar (current pattern is 3 levels with 5 categories × 2 sub-items each — can vary if it produces better hits)
- Which specific FOLIO branches to draw from per practice area
- How to phrase synonym terms to sound natural while remaining searchable

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Exemplar System
- `packages/core/src/exemplar/data.ts` — Current exemplar definitions (7 exemplars, TypeScript format)
- `packages/ui/src/components/input/ExemplarPanel.tsx` — Exemplar UI component (grid layout, teal styling)
- `packages/ui/src/components/input/InputScreen.tsx` — Where ExemplarPanel renders in input flow
- `apps/web/src/App.tsx` lines 523-537 — Exemplar selection handler (parseText flow)

### FOLIO Search Pipeline
- `backend/app/services/folio_service.py` — `search_candidates()` function, search phases, scoring logic
- `backend/app/services/pipeline/stage1_filter.py` — Pipeline Stage 1 (branch-scoped search)
- `backend/app/services/embedding/folio_index.py` — FAISS embedding index

### folio-python Library
- `from folio import FOLIO, FOLIOTypes, FOLIO_TYPE_IRIS` — Core imports
- `search_by_label(term, include_alt_labels=True, limit=10)` returns `List[Tuple[OWLClass, float]]` (score 0-100)
- OWLClass attrs: `iri`, `label`, `definition`, `alternative_labels`, `sub_class_of`, `parent_class_of`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExemplarPanel.tsx` — Existing grid component, currently 2-col/4-col responsive grid
- `Exemplar` TypeScript interface — `{ id, label, description, text }` format
- `EXEMPLARS` array export from `packages/core/src/index.ts`

### Established Patterns
- Exemplar text uses tab-indented hierarchy format (parsed by backend `POST /api/parse/text`)
- Each exemplar has ~5 mid-level categories with ~2 leaf items each (~10-11 leaf terms)
- Labels use natural legal terminology, not FOLIO IRIs

### Integration Points
- `packages/core/src/exemplar/data.ts` is the single source of truth for all exemplar data
- `ExemplarPanel` grid layout may need adjustment for 10 items (currently optimized for 7)
- No backend changes needed — exemplars flow through the same parse/search pipeline as user input

</code_context>

<specifics>
## Specific Ideas

- The goal is first impressions: when a new user clicks an exemplar, they should see mostly green/high-confidence matches, not a wall of low-scoring candidates
- "High performing" means the FOLIO branches for those practice areas are concept-rich, yielding strong search results
- Taxonomies must remain realistic — they should look like actual practice area breakdowns a law firm would use

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-revamp-exemplars*
*Context gathered: 2026-04-06*
