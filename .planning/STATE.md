---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: — Full Demo Coverage + Regulatory Exemplars
status: phases_complete
stopped_at: Phases 5–6 complete; milestone ready for /gsd:complete-milestone
last_updated: "2026-07-07T14:00:00.000Z"
last_activity: 2026-07-07 -- Phases 05 and 06 marked complete
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-07)

**Core value:** A legal expert can take their own practice-area concepts and get accurate, reviewable FOLIO mappings — with the system doing most of the work and inviting human judgment where it matters.
**Current focus:** v1.1 phases complete — ready to close the milestone

## Current Position

Phase: 06 — COMPLETE (all v1.1 phases done)
Plan: 1 of 1
Status: Phases 5 & 6 complete, verified, evidence pack published
Last activity: 2026-07-07 -- 4 regulatory exemplars + 4 demo payloads shipped; 166/166 tests

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed (v1.1): 7 (Phase 4: 5, Phase 5: 1, Phase 6: 1)

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 4. Demo Payloads for Existing Areas | 5/5 | Complete (2026-05-24) |
| 5. Regulatory Exemplars | 1/1 | Complete (2026-07-07) |
| 6. Demo Payloads for Regulatory Exemplars | 1/1 | Complete (2026-07-07) |

## Accumulated Context

### Decisions

- [v1.1 planning]: Transactional deal-work areas (M&A, Real Estate, Banking, IP) already covered by v1.0 exemplars — Phase 5 targets pure regulatory/compliance areas only
- [v1.1 planning]: Regulatory exemplar selection gated on FOLIO coverage probe — low-density areas dropped, not forced to 100% hit rate
- [v1.1 planning]: New exemplars reuse lean exemplar text verbatim as demo source; lean exemplars stay untouched
- [v1.1 planning]: Phase 5 sequenced after Phase 4 (not parallel) — Phase 4 patterns inform Phase 5 demo curation
- [Phase 5]: 4 areas selected (environmental-compliance, energy-utilities, securities-regulation, data-privacy); Tax (5/10 exact leaves) and Healthcare (3/10) probe-gated OUT
- [Phase 5]: Hit-rate gate hardened with anti-circularity check (no leaf may be an ancestor of a co-leaf) after subagent ontology critique caught a parent/child defect
- [Phase 5]: Securities exemplar reframed as "Securities Enforcement" to cut leaf overlap with banking-finance from 4 to 0; PM question queued on keep-vs-swap
- [Phase 6]: Demos curated with --provider google (gemini-3-flash-preview), matching the post-Phase-4 Gemini re-curation standard so all 14 payloads are consistent

### Pending Todos

- Run /gsd:complete-milestone for v1.1 (all phases done).
- PM question in QA queue: Securities Enforcement card — keep reframed version or swap for a fully-distinct area (e.g., International Trade & Sanctions, pending its own probe).

### Blockers/Concerns

None. The Phase-5 density risk resolved favorably: regulatory branches fan out richer than several litigation areas (mean 12–16 relevant candidates/leaf).

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260522-q0p | Add a "Rename" button to the session picker | 2026-05-22 | cdce07c | ./quick/260522-q0p-... |
| 260524-fmm | Fix computeScoreCutoff global-threshold bug | 2026-05-24 | b16a4f8 | ./quick/260524-fmm-... |
| 260525-bz7 | Update most-recent LLM models (Anthropic/OpenAI/Google) | 2026-05-25 | 482ee8e | ./quick/260525-bz7-update-most-recent-llm-models-from-provi/ |

## Session Continuity

Last session: 2026-07-07
Stopped at: Phases 5–6 complete; evidence pack at docs/evidence/phases-5-6/
Resume file: .planning/phases/06-demo-payloads-for-regulatory-exemplars/06-01-SUMMARY.md
