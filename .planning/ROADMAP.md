# Roadmap: FOLIO Mapper

## Overview

FOLIO Mapper helps legal practitioners and ontologists map their concept lists, practice taxonomies, or matter narratives to the FOLIO (Federated Ontology for Legal Information Operations) standard. Active development is focused on richer demonstration affordances and ongoing precision improvements for the existing 10 exemplar practice areas.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Revamp Exemplars** - Replace generic exemplars with 10 high-precision practice areas with 100% FOLIO hit rate
- [ ] **Phase 2: Demo Mode** - Add a Demo button that flips exemplar cards from lean precision-tuned payloads to rich pre-cached session payloads showcasing the curation workflow
- [ ] **Phase 3: New (Fresh Session in New Tab)** - Replace the in-place "New Project" reset with a folio-enrich-style "New" button that opens a fresh tab; make session persistence per-tab with a session picker for recovery

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

### Phase 3: New (Fresh Session in New Tab)

**Goal**: Replicate the folio-enrich "New" button — a header button that opens a fresh browser tab with a brand-new empty session, leaving the current tab and its work intact. This replaces folio-mapper's existing in-place "New Project" reset. To make multi-tab safe, session persistence becomes per-tab namespaced (today it's a single shared localStorage session), and recovery on a fresh tab is handled by a new session picker.

**Depends on**: Stage 7A session persistence (complete) — this phase reworks its storage layer.

**Canonical refs**: `.planning/phases/03-new-session/03-CONTEXT.md`

**Success Criteria**:

1. A "New" button (always visible on input/confirming/mapping screens) opens a fresh tab via `?new=1`; current tab untouched, no confirmation prompt
2. Session persistence is per-tab namespaced — no tab can clobber another tab's saved work
3. Returning to the page after a full browser close/reboot auto-resumes the most-recent session (zero clicks, everything already mapped) — no recovery-modal gate
4. A session picker is available on-demand (from the header) to switch to another saved session, start new, or delete (Resume / Start New / Delete per entry)
5. A refresh within an existing tab directly recovers that tab's own session
6. Stored sessions are capped (~5, LRU eviction) to bound localStorage footprint
7. The old in-place reset (`NewProjectModal` popover), the startup `SessionRecoveryModal` gate, and the `beforeunload` warning are removed
8. Existing single-session localStorage data migrates gracefully (no lost in-progress work on upgrade)

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Storage core: tab-identity resolver, session registry (LRU), debounced-storage onWrite + Wave-0 tests (D-04, D-05, D-06, D-09, D-13, D-14)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Namespace stores, boot resolver (auto-resume/refresh/fresh), handleNewTab, remove beforeunload + NewProjectModal flow + useSession tests (D-01, D-02, D-07, D-08, D-12, D-14)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-03-PLAN.md — Always-visible "New" button, on-demand SessionPickerModal, App wiring, delete NewProjectModal (D-01, D-02, D-03, D-07b, D-10, D-11)

### Out of Scope (Phase 3)

- Live cross-tab sync (real-time reflection of edits between open tabs)
- Server-side / cloud session storage
- Session rename/labeling in the picker (deferred unless picker UX needs it)

### Open Questions (carried from `/gsd-explore`)

- **Bundling strategy**: in-app static import vs backend endpoint vs static asset fetch
- **Preset versioning**: how to detect/handle preset staleness when FOLIO IRIs or pipeline scoring shifts materially
- **Visual differentiation**: subtle (badge) or prominent (recolor) on exemplar cards when demo mode is active

### Out of Scope (Phase 2)

- Live pipeline runs as part of demo (cached only)
- Transactional/regulatory practice areas (see seed `.planning/seeds/demo-mode-transactional.md`)
- Persisting demo-mode preference across reloads
