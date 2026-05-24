# Roadmap: FOLIO Mapper

## Overview

FOLIO Mapper helps legal practitioners and ontologists map their concept lists, practice taxonomies, or matter narratives to the FOLIO standard. The roadmap tracks milestones from initial exemplar quality work through demo coverage expansion and regulatory depth.

## Milestones

- ✅ **v1.0 — Exemplars, Demo & New-Tab Sessions** — Phases 1-3 (shipped 2026-05-23)
- 🚧 **v1.1 — Full Demo Coverage + Regulatory Exemplars** — Phases 4-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 — Exemplars, Demo & New-Tab Sessions (Phases 1-3) — SHIPPED 2026-05-23</summary>

- [x] Phase 1: Revamp Exemplars (1/1 plans)
- [x] Phase 2: Demo Mode (4/4 plans)
- [x] Phase 3: New (Fresh Session in New Tab) (3/3 plans) — completed 2026-05-22

Full phase details archived at `.planning/milestones/v1.0-ROADMAP.md`.
Milestone summary: `.planning/MILESTONES.md`.

</details>

### 🚧 v1.1 — Full Demo Coverage + Regulatory Exemplars (In Progress)

**Milestone Goal:** Every existing exemplar area has a demo payload; 3–4 new regulatory/compliance exemplars (probe-gated, 100% hit rate) ship with their own demo payloads. Zero runtime LLM cost preserved throughout.

- [ ] **Phase 4: Demo Payloads for Existing Exemplar Areas** - Curate and register pre-cached pipeline outputs for the 9 exemplar areas that shipped without demo payloads in v1.0
- [ ] **Phase 5: Regulatory Exemplars** - Probe FOLIO fan-out density across candidate regulatory/compliance areas, then author 3–4 lean exemplars in the winning areas at 100% hit rate
- [ ] **Phase 6: Demo Payloads for Regulatory Exemplars** - Curate and register pre-cached pipeline outputs for each new regulatory exemplar, wiring them into the existing demo infrastructure

## Phase Details

### Phase 4: Demo Payloads for Existing Exemplar Areas
**Goal**: Every existing exemplar area can be loaded in demo mode, giving presenters a live "watch curation happen" experience across all 9 previously-deferred areas
**Depends on**: v1.0 demo infrastructure (curate_demos.py, demo manifest, Stage 7A load path, personal-injury.demo.json as reference pattern)
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05
**Success Criteria** (what must be TRUE):
  1. Clicking any of the 9 existing exemplar cards in demo mode loads pre-computed pipeline output (mappings, candidates, judge annotations) without triggering a live pipeline run
  2. Each of the 9 demo payloads contains a natural mix of fan-out ratios (1:1, 1:2–1:3, and 1:4+) plus at least one judge-flagged ambiguity that makes the curation step meaningful to a viewer
  3. Running `scripts/curate_demos.py` regenerates all 9 payloads deterministically, and every payload filename appears in the demo manifest
  4. Zero LLM API calls occur at runtime when any of the 9 existing-area demos is loaded
**Plans**: 5 plans
Plans:
- [x] 04-01-PLAN.md — Lazy-load manifest migration + Wave 0 test parametrization (foundation)
- [x] 04-02-PLAN.md — Generalized coverage probe script + 9 probe-items files
- [ ] 04-03-PLAN.md — Batch 1: re-curate PI + curate solo-criminal, family-law, employment-labor
- [ ] 04-04-PLAN.md — Batch 2: curate corporate-ma, ip-tech, commercial-lit
- [ ] 04-05-PLAN.md — Batch 3: curate real-estate, banking-finance, immigration + phase gate
**UI hint**: yes

### Phase 5: Regulatory Exemplars
**Goal**: A curated set of 3–4 regulatory/compliance lean exemplars — selected by a FOLIO coverage probe that gates out low-density areas — exist at 100% hit rate and appear in the carousel alongside the existing 10
**Depends on**: Phase 4 (sequential; Phase 4 clarifies demo infrastructure patterns before extending to new areas)
**Requirements**: REG-01, REG-02, REG-03, REG-04
**Success Criteria** (what must be TRUE):
  1. A coverage probe report exists documenting FOLIO fan-out density for each candidate regulatory/compliance area (e.g. Securities/Regulatory Compliance, Tax, Healthcare Regulatory, Environmental/Energy), with areas ranked by density and low-density areas explicitly excluded from authoring
  2. 3–4 new lean exemplars are committed to `packages/core/src/exemplar/data.ts`, each covering a regulatory/compliance area that passed the probe
  3. Every leaf item in every new exemplar resolves to a precise, uniquely-labelled FOLIO concept (100% hit rate — no "best-available" or partial matches)
  4. The new regulatory exemplars appear in the "Try an Exemplar" carousel alongside the 10 existing exemplars, selectable and functional in both lean and demo modes
**Plans**: TBD

### Phase 6: Demo Payloads for Regulatory Exemplars
**Goal**: Every new regulatory exemplar has a pre-cached demo payload that loads via the existing Stage 7A path, completing demo mode coverage across the full expanded exemplar set
**Depends on**: Phase 5 (new exemplars must exist and be confirmed at 100% hit rate before payloads can be curated)
**Requirements**: REGDEMO-01, REGDEMO-02, REGDEMO-03
**Success Criteria** (what must be TRUE):
  1. A demo payload file exists for each new regulatory exemplar, curated from that exemplar's lean text using the same `curate_demos.py` workflow used for existing areas
  2. Each regulatory demo payload loads correctly via the Stage 7A session-load path and its filename is registered in the demo manifest
  3. Zero LLM API calls occur at runtime when any regulatory demo is loaded
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 1. Revamp Exemplars | v1.0 | 1/1 | Complete | 2026 |
| 2. Demo Mode | v1.0 | 4/4 | Complete | 2026 |
| 3. New (Fresh Session in New Tab) | v1.0 | 3/3 | Complete | 2026-05-22 |
| 4. Demo Payloads for Existing Exemplar Areas | v1.1 | 2/5 | In Progress|  |
| 5. Regulatory Exemplars | v1.1 | 0/? | Not started | - |
| 6. Demo Payloads for Regulatory Exemplars | v1.1 | 0/? | Not started | - |

## Quick Tasks

- 260522-q0p — Add a "Rename" button to the session picker (complete, shipped to PROD)
