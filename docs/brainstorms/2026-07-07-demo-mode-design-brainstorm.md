# Brainstorm: Demo Mode — design rationale & regulatory extension

**Date:** 2026-07-07 (formalized from `.planning/notes/demo-mode-design.md` and
`.planning/seeds/demo-mode-transactional.md`, both planted 2026-05-10)
**Status:** Shipped (v1.0 Phase 2 + v1.1 Phases 4–6); this doc is the durable seed
of record for demo mode and its open evolutions.
**Author:** Damien Riehl (with Claude)

## What Demo Mode Is

A "Demo" affordance that flips the "Try an Exemplar" cards from their lean,
precision-tuned payloads to **rich, pre-cached session payloads** that showcase the
curation workflow. Same cards, same practice-area names, two payloads per area
(`{slug}.exemplar` lean text ↔ `{slug}.demo.json` cached pipeline output). A single
**Demo** button toggles exemplar mode `lean ↔ demo`, reversibly, session-scoped
(demo mode is a presentation intent, not a persisted user preference).

### The two jobs, kept separate
- **Lean exemplars** answer *"does it work?"* — 100% precision, one-to-one, no
  ambiguity. First-touch users need a clean signal.
- **Demo payloads** answer *"why is your expertise still needed?"* — a rich fan-out
  with judge-flagged ambiguity worth resolving. Sales / conference moments need
  ambiguity. Conflating the two weakens both; the mode toggle preserves both jobs on
  one UI surface.

### Shape of a demo payload
- The lean exemplar text **verbatim** + 2–3 coherent enrichment leaves.
- A natural mix of fan-out ratios (1:1, 1:2–1:3, 1:4+) plus judge-flagged ambiguity.
- Real pipeline output — produced once **offline** by running the live pipeline and
  saving the resulting `SessionFile` JSON. Zero LLM tokens per demo click,
  deterministic (no "bad day" risk), and it reuses the Stage-7A session-load path
  (demo = `loadSession(preset.json)`).

## Why cached, not live
Demos showcase **curation UX**, not pipeline runtime. Caching gives zero per-click
cost, determinism, and reuses infrastructure that already exists. The trade-off —
demos can drift when the pipeline or FOLIO changes — is handled by a version-drift
banner (`detectStalePreset`) and a reproducible curation script (`curate_demos.py`).

## Open questions — now resolved (2026-05 → 2026-07)

The original note left three open questions; the shipped work answered them:

1. **Bundling** — *ship in-app, fetch from backend, or static assets?* → **Ship in
   app, lazy-loaded.** `apps/web/src/exemplar/demos/*.demo.json` are discovered by
   `import.meta.glob` and emitted as one lazy chunk each, so the ~0.6 MB payloads
   load on demand (not in the initial bundle) and resolve correctly in the
   production build. (Phase 4 migration.)
2. **Regeneration workflow** — *script vs manual?* → **Script.** `curate_demos.py`
   drives the live backend `/api/pipeline/map` per area from a `{slug}.input.json`,
   stamping `pipeline_version` + `folio_version` for drift detection. Curation runs
   on the operator's LLM (Phase 4/6 used a local `claude_max_proxy.py` bridging the
   Anthropic API to the Claude Max CLI — no metered key).
3. **Visual differentiation of cards in demo mode** — handled by the demo-mode chip
   / toggle state (Phase 2), not per-card badges.

## The regulatory / transactional extension (the seed that fired)

The v1.0 demo set skewed litigation-heavy. The seed `demo-mode-transactional.md`
said: revisit when the exemplar set expands to transactional/regulatory areas, and
first (1) **probe FOLIO density before drafting**, (2) consider whether item shape
differs, (3) consider whether the "ambiguity invites curation" narrative reads
differently for regulatory users.

**How it fired (v1.1 Phases 5–6, 2026-07-07):**
- Transactional deal-work turned out to be **already covered** by the v1.0 M&A / Real
  Estate / Banking / IP exemplars — so the genuine gap was **pure regulatory /
  compliance** practice, not transactional.
- A deterministic folio-python density probe (`regulatory_density_survey.py`) ranked
  candidate areas and **gated out thin ones** (Tax 5/10 leaves, Healthcare 3/10)
  rather than forcing 100%. Four areas cleared the bar: **Environmental Compliance,
  Energy & Utilities, Securities Regulation, Data Privacy & Cybersecurity.**
- Item shape stayed hierarchical (same as litigation) — no clause-shaped inputs
  needed. The regulatory branches proved **denser** than several litigation areas
  (mean 12–16 relevant candidates per leaf), so the demos are richer, not thinner —
  the ambiguity-invites-curation narrative holds strongly for regulatory audiences.

## Forward seeds (not yet built)

- **"Save as demo"** — let a power user turn a polished manual mapping into a preset
  (`plant when`: a user asks to keep/share a session as a reusable demo).
- **Demo telemetry** — which areas are demoed, how often (feeds exemplar priorities).
- **Ecosystem-loop feeder** — leaves that fail the 100%-hit gate during future
  exemplar authoring are exactly the ontology gaps that should flow into ontokit's
  suggestion queue (Portfolio Plan II.0.1).
- **SSSOM export of exemplar↔FOLIO mappings** — the confirmed lean-exemplar leaf
  mappings are a small, clean, curated mapping set; a natural first payload for the
  folio-mapper → FOLIO OWL standards write-back (Portfolio Plan II.6.0).
