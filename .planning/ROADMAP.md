# Roadmap: FOLIO Mapper

## Overview

FOLIO Mapper helps legal practitioners and ontologists map their concept lists, practice taxonomies, or matter narratives to the FOLIO (Federated Ontology for Legal Information Operations) standard. Active development is focused on richer demonstration affordances and ongoing precision improvements for the existing 10 exemplar practice areas.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Revamp Exemplars** - Replace generic exemplars with 10 high-precision practice areas with 100% FOLIO hit rate
- [ ] **Phase 2: Demo Mode** - Add a Demo button that flips exemplar cards from lean precision-tuned payloads to rich pre-cached session payloads showcasing the curation workflow

## Phase Details

### Phase 1: Revamp Exemplars

**Goal**: Replace generic exemplar inputs with 10 practice-area-specific exemplars whose every leaf is a precise FOLIO label, yielding a 100% hit rate when users click "Try an Exemplar."

**Status**: Complete (commit d6a271d). Archived at `.planning/phases/01-revamp-exemplars/`.

**Depends on**: Nothing.

**Success Criteria**:
1. 10 exemplars covering distinct practice areas (PI, family, IP, employment, M&A, etc.)
2. Each exemplar produces 100% FOLIO mapping hit rate on the canonical leaf labels
3. Exemplar carousel UI lets the user pick an exemplar and load its text into the input

### Phase 2: Demo Mode

**Goal**: Add a Demo affordance that toggles the "Try an Exemplar" cards from the lean precision-tuned payloads (current behavior) to rich pre-cached session payloads — same practice areas, same hierarchical item structure, but each demo session is the saved output of running the lean exemplar text (+ 2-3 enrichment items per area) through the live pipeline once offline. The Demo button gives sales/conference moments the "watch curation happen" narrative without spending LLM tokens at runtime.

**Depends on**: Phase 1 (lean exemplars must exist as the source text), Stage 7A session persistence (complete).

**Requirements**: Demo payloads round-trip through existing Stage 7A load path; lean exemplars stay untouched; runtime LLM cost = 0; demo richness from natural fan-out heterogeneity (mix of 1:1, 1:2-1:3, and 1:4+ across items); demo mode is session-scoped, not persisted.

**Success Criteria**:
1. A Demo button exists on the exemplar carousel surface and toggles exemplar mode `lean` ↔ `demo`
2. Clicking an exemplar card while in demo mode loads a pre-computed session showing pipeline output (mappings, candidates, judge annotations) — not the raw text
3. Toggling demo mode is reversible and session-scoped (refreshing the app returns to lean mode by default)
4. The PI demo payload is shipped (other 9 areas can land in follow-up work)
5. A documented curation workflow exists so demo payloads can be regenerated when the pipeline or FOLIO updates materially
6. Demo mode triggers zero LLM API calls at runtime

**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Demo store (session-scoped exemplarMode flag), Demo toggle button, per-card chip
- [ ] 02-02-PLAN.md — Curation script (scripts/curate_demos.py) + PI demo payload + static manifest
- [ ] 02-03-PLAN.md — Wire demo-mode click to load bundled JSON via Stage 7A path; stale-version banner
- [ ] 02-04-PLAN.md — Round-trip + zero-network tests; operator curation doc

### Open Questions (carried from `/gsd-explore`)

- **Bundling strategy**: in-app static import vs backend endpoint vs static asset fetch
- **Preset versioning**: how to detect/handle preset staleness when FOLIO IRIs or pipeline scoring shifts materially
- **Visual differentiation**: subtle (badge) or prominent (recolor) on exemplar cards when demo mode is active

### Out of Scope (Phase 2)

- Live pipeline runs as part of demo (cached only)
- Transactional/regulatory practice areas (see seed `.planning/seeds/demo-mode-transactional.md`)
- Persisting demo-mode preference across reloads
