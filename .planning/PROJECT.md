# FOLIO Mapper

## What This Is

FOLIO Mapper helps legal practitioners and ontologists map their concept lists, practice taxonomies, or matter narratives to the FOLIO (Federated Ontology for Legal Information Operations) standard. It parses hierarchical input, runs an LLM + embedding + keyword search pipeline against ~18K FOLIO concepts, and presents ranked candidates for expert curation and export.

## Core Value

A legal expert can take their own practice-area concepts and get accurate, reviewable FOLIO mappings — with the system doing most of the work and inviting human judgment where it matters.

## Current Milestone: v1.1 Full Demo Coverage + Regulatory Exemplars

**Goal:** Extend demo mode to every practice area — finish the 9 deferred per-area demo payloads, then add regulatory/compliance exemplars (probe-gated) with their own demo payloads.

**Target features:**
- Demo payloads for all 9 remaining existing exemplar areas (only Personal Injury shipped in v1.0)
- 3–4 net-new regulatory/compliance lean exemplars, selected by FOLIO coverage probe
- Demo payloads for the new regulatory exemplars
- Zero runtime LLM cost preserved (cached payloads, reproducible via `curate_demos.py`)

## Requirements

### Validated

<!-- Shipped and confirmed valuable (v1.0). -->

- 10 high-precision practice-area exemplars with 100% FOLIO hit rate
- Demo mode toggle (lean ↔ pre-cached pipeline output) — Personal Injury payload shipped
- Per-tab namespaced session persistence + on-demand session picker with rename
- 8-format export; LLM provider layer; embedding + spaCy + bridging search

### Active

<!-- Current scope (v1.1). See REQUIREMENTS.md for REQ-IDs. -->

- [ ] Demo payloads for the 9 remaining existing exemplar areas
- [ ] Regulatory/compliance exemplars (3–4, coverage-probe selected)
- [ ] Demo payloads for the new regulatory exemplars

### Out of Scope

- Live pipeline runs as part of demo — cached only (deterministic, zero token cost)
- Net-new transactional deal-work areas — already covered by M&A, Real Estate, Banking, IP exemplars
- Persisting demo-mode preference across reloads — demo mode is a presentation intent, not a user preference

## Context

- Monorepo: pnpm workspaces, Vite, React 19, Zustand 5, Tailwind 3, FastAPI backend.
- Demo infrastructure already exists: `scripts/curate_demos.py`, static demo manifest, Stage 7A session-load path, stale-preset banner.
- Existing 10 exemplars: Solo Criminal Defense, Family Law, Personal Injury, Employment & Labor, Corporate M&A, IP & Technology, Commercial Litigation, Real Estate, Banking & Finance, Immigration.
- Seed `demo-mode-transactional.md` reframed: transactional deal work is already covered; the genuine gap is pure regulatory/compliance practice.
- Two-tier deploy: DEV = Railway (auto on `dev`), PROD = openlegalstandard.org (on `main`).

## Constraints

- **Tech stack**: Frontend exemplars in `packages/core/src/exemplar/data.ts`; demos in `apps/web/src/exemplar/demos/`; curation via Python `scripts/curate_demos.py`.
- **Quality gate**: Every new exemplar leaf must map to a precise FOLIO label (100% hit rate), matching the v1.0 precision bar.
- **Cost**: Demo-mode runtime LLM cost must stay at zero (pre-cached JSON only).
- **Density risk**: Regulatory areas have unknown FOLIO fan-out — Phase 5 must probe before authoring.

## Key Decisions

- Demo richness comes from natural fan-out heterogeneity (mix of 1:1, 1:2–1:3, 1:4+), not forced uniform fan-out.
- Regulatory exemplar selection is gated on a coverage probe — areas with weak FOLIO fan-out are dropped, not forced.
- New exemplars reuse the lean exemplar text verbatim as demo source; lean exemplars stay untouched.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-24 — Milestone v1.1 started*
