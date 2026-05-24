# Requirements: FOLIO Mapper — Milestone v1.1

**Milestone:** v1.1 Full Demo Coverage + Regulatory Exemplars
**Defined:** 2026-05-24

## v1.1 Requirements

### Existing-Area Demos (DEMO)

<!-- #2 — the 9 demo payloads deferred from v1.0 Phase 2 (only Personal Injury shipped). -->

- [ ] **DEMO-01**: A demo payload exists for each of the 9 remaining existing exemplar areas (Solo Criminal Defense, Family Law, Employment & Labor, Corporate M&A, IP & Technology, Commercial Litigation, Real Estate, Banking & Finance, Immigration)
- [ ] **DEMO-02**: Clicking an existing exemplar card in demo mode loads pre-computed pipeline output (mappings, candidates, judge annotations) — not the raw lean text
- [ ] **DEMO-03**: Each demo payload exhibits natural fan-out heterogeneity (a mix of 1:1, 1:2–1:3, and 1:4+ items) with at least some judge-flagged ambiguity to make curation a meaningful demonstration
- [ ] **DEMO-04**: All 9 demo payloads are reproducible via `scripts/curate_demos.py` and registered in the demo manifest
- [ ] **DEMO-05**: Demo mode triggers zero LLM API calls at runtime for every existing area

### Regulatory Exemplars (REG)

<!-- #3 part 1 — net-new regulatory/compliance lean exemplars, probe-gated. -->

- [ ] **REG-01**: A coverage probe reports FOLIO fan-out density for candidate regulatory/compliance areas (e.g. Securities/Regulatory Compliance, Tax, Healthcare Regulatory, Environmental/Energy)
- [ ] **REG-02**: 3–4 net-new regulatory/compliance lean exemplars are added, selected by probe results (areas with weak FOLIO fan-out are dropped, not forced)
- [ ] **REG-03**: Every leaf in each new exemplar maps to a precise FOLIO label (100% hit rate), matching the v1.0 precision bar
- [ ] **REG-04**: The new exemplars appear in the "Try an Exemplar" carousel alongside the existing 10

### Regulatory Demos (REGDEMO)

<!-- #3 part 2 — demo payloads for the new regulatory exemplars. -->

- [ ] **REGDEMO-01**: A demo payload exists for each new regulatory exemplar
- [ ] **REGDEMO-02**: New regulatory demos load via the existing Stage 7A demo path and are registered in the demo manifest
- [ ] **REGDEMO-03**: New regulatory demos preserve zero runtime LLM cost (pre-cached JSON only)

## Future Requirements

<!-- Deferred beyond v1.1. -->

- Net-new transactional deal-work areas beyond the existing M&A/Real Estate/Banking/IP coverage
- Visual differentiation refinements for demo-mode cards (beyond the existing chip)
- Demo payload auto-regeneration on FOLIO/pipeline version bumps

## Out of Scope

- **Live pipeline runs during demo** — cached only; deterministic, zero token cost.
- **Persisting demo-mode preference across reloads** — demo mode is a presentation intent, not a user preference.
- **Forcing low-density regulatory areas** — if a candidate area lacks FOLIO fan-out, it is dropped rather than shipped at lower quality.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DEMO-01 | Phase 4 | Pending |
| DEMO-02 | Phase 4 | Pending |
| DEMO-03 | Phase 4 | Pending |
| DEMO-04 | Phase 4 | Pending |
| DEMO-05 | Phase 4 | Pending |
| REG-01 | Phase 5 | Pending |
| REG-02 | Phase 5 | Pending |
| REG-03 | Phase 5 | Pending |
| REG-04 | Phase 5 | Pending |
| REGDEMO-01 | Phase 6 | Pending |
| REGDEMO-02 | Phase 6 | Pending |
| REGDEMO-03 | Phase 6 | Pending |
