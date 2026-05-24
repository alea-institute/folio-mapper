# Phase 4: Demo Payloads for Existing Exemplar Areas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 4-demo-payloads-for-existing-exemplar-areas
**Areas discussed:** Enrichment sourcing, Thin-area richness floor, Auto-accept threshold, Provider/model & cost

---

## Enrichment Sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| Probe per area, data-driven | Run run_coverage_probe.py per area; pick 2–3 enrichments each yielding ≥4 high-conf candidates | ✓ |
| Judgment-pick, no probe | Choose enrichments by domain knowledge without probing | |
| Probe only uncertain areas | Probe only the areas of uncertain density | |

**User's choice:** Probe per area, data-driven
**Notes:** Mirrors spike 001's explicit recommendation; guards against PI's density not translating.

---

## Thin-Area Richness Floor

| Option | Description | Selected |
|--------|-------------|----------|
| Enrich to a minimum floor | Add enrichments until each area clears a richness bar (≥2 items at 1:4+), capped for coherence; ship all 9 | ✓ |
| Accept natural richness | Ship all 9 at whatever fan-out occurs naturally | |
| Hard bar + flag | Strict bar; flag areas that can't clear it for a scope call | |

**User's choice:** Enrich to a minimum floor
**Notes:** Practice-area coherence outranks richness; never inject off-domain enrichments to pad fan-out.

---

## Auto-Accept Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Tune for a visible mix | Per-area `--threshold` tuning to guarantee both auto-accepted and pending-review items | ✓ |
| Pipeline default, unchanged | Use production threshold as-is | |
| Default, hand-fix outliers | Default; only adjust if a demo loses its curation moment | |

**User's choice:** Tune for a visible mix
**Notes:** A demo that lands all-accepted or all-pending loses the "invites your expertise" narrative.

---

## Provider / Model & Cost

| Option | Description | Selected |
|--------|-------------|----------|
| Match PI (claude-3-5-sonnet) | Same model as the shipped PI demo for cross-demo consistency; no hard cap | ✓ |
| Upgrade to latest Claude | Use latest model + re-curate PI for consistency | |
| Cheapest viable | Minimize token cost (haiku / gpt-4o-mini) | |

**User's choice:** Match PI (claude-3-5-sonnet)
**Notes:** Consistency across all 10 demos (judge phrasing/scoring) over marginal annotation quality. ~$5–18 total expected.

---

## Claude's Discretion

- Exact enrichment items per area (probe-driven).
- Exact `--threshold` per area to hit the visible-mix target.
- Exact richness-bar numbers beyond the ≥2-items-at-1:4+ guideline.
- Per-area input-file slugs.
- One PR for all 9 vs incremental landing.

## Deferred Ideas

- Net-new regulatory exemplars (Phase 5) and their demos (Phase 6).
- Telemetry on Demo button usage.
- A "save as demo" affordance.
