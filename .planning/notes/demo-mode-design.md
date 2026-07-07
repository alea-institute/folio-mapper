---
title: Demo mode design rationale
date: 2026-05-10
context: exploration via /gsd-explore — UX affordance to showcase curation
---

# Demo mode design rationale

A "Demo" affordance that flips the existing "Try an Exemplar" cards from their lean, precision-tuned payloads to **rich, pre-cached session payloads** intended to showcase the curation workflow.

## Shape of a demo payload

- **15 items** per practice area (verbose enough to elicit multiple matches)
- **4-5 FOLIO concepts mapped per item** (1:4 to 1:5 fan-out)
- **Mix of high-confidence auto-accepts and judge-flagged ambiguity** — the system has done most of the work; the remaining items invite expert review
- **Realistic pipeline output** — produced by running the live pipeline once offline, letting auto-accept fire at its normal threshold, and saving the resulting session JSON

## Why cached, not live

- Demos are about showcasing **curation UX**, not pipeline runtime
- Zero LLM tokens spent per demo click
- Deterministic — every demo looks identical, no "bad day" risk
- Stage 7A session persistence already provides the load path; demo = `loadSession(preset.json)`

## UX: mode toggle, not new surface

- Single **Demo** button toggles exemplar mode `lean` ↔ `demo`
- Same 10 exemplar cards, same practice-area names, two payloads per area (`pi.exemplar.json`, `pi.demo.json`)
- Reversible — clicking back returns to lean exemplar behavior
- Toggle is session-scoped (does not persist across reloads — demo mode is a presentation intent, not a user preference)

## Relationship to existing exemplars

The recent exemplar revamp tuned 10 practice areas for 100% precision (one-to-one, no ambiguity). Those answer "**does it work?**" — first-touch users need a clean signal. Demo mode answers "**why is your expertise still needed?**" — sales/conference moments need ambiguity worth resolving. Conflating the two weakens both. Mode toggle preserves both jobs on one UI surface.

## Open questions

- Bundling: ship `*.demo.json` in the app, fetch from backend, or host as static assets?
- Preset regeneration workflow when pipeline/FOLIO changes — script vs manual?
- Visual differentiation of exemplar cards when in demo mode (badge? color shift?)
