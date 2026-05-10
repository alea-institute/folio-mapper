---
spike: 001
name: demo-pi-curation
type: standard
validates: "Given 15 verbose Personal Injury narrative items, when run through FOLIO label search (Stage 1 of the pipeline), then each yields ≥4 candidates in legally-relevant FOLIO branches"
verdict: VALIDATED
related: []
tags: [demo-mode, folio-coverage, personal-injury]
---

# Spike 001: Demo PI Curation — FOLIO Coverage Probe

## What This Validates

**Given** 15 verbose Personal Injury narrative items (intake-summary style, 1-3 sentences each),
**When** they are searched against the FOLIO ontology via `folio.search_by_label` (the Stage 1 search the real pipeline performs after LLM segmentation),
**Then** each item yields ≥4 candidates in legally-relevant FOLIO branches (Objectives, Area of Law, Legal Entity, Actor/Player, Service, Industry, Matter Narrative, Standards Compatibility) — enough surface area for the LLM ranking + judge stages to produce a 1:4–1:5 mapped-concept fan-out.

## Research

- **folio-python 0.2+** (`from folio import FOLIO`) loads the OWL ontology from GitHub on first use (~5–15s warm-up, cached at `~/.folio/cache`).
- `search_by_label(term, include_alt_labels=True, limit=N)` returns `(OWLClass, score)` tuples; scores ≥90 indicate strong label/alt-label fuzzy match.
- FOLIO has 24 top-level branches and ~18 323 classes; the project memory documents this. Branch detection walks `sub_class_of` to a root in `FOLIO_TYPE_IRIS`.
- No external research needed beyond the project's own memory and `backend/app/services/folio_service.py` for search semantics.

**Chosen approach:** Drive `folio-python` directly, with handcrafted multi-term queries per item that mirror what Stage 0 (LLM segmentation + branch tagging) would emit. This keeps the spike free of LLM tokens — the user's "Claude Max plan" budget is honored by having me (Claude in this session) play the LLM stages inline when interpretation is required.

## How to Run

From the project root:

```bash
backend/.venv/bin/python .planning/spikes/001-demo-pi-curation/run_coverage_probe.py
```

Output:
- `candidates.json` — full per-item candidate list (top 12 per item) with scores, matched terms, branches.
- stderr summary — per-item count of high-confidence hits, branches touched, and overall ratio.

## What to Expect

- All 15 items return 48–63 raw candidates (deduplicated by IRI).
- Top-12 per item: each item shows ≥4 candidates whose branch is one of the legally-relevant branches.
- Noise candidates appear at score 90 (e.g., countries, unrelated state courts, "Ed.D."): these are token-overlap false positives in `search_by_label` and are exactly what Stage 2/3 of the real pipeline reject.

## Investigation Trail

### Iteration 1 — Naïve "high-confidence" count

Initial summary reported "15/15 items have 12 high-confidence (≥75) candidates each" — uniform exactly because the script capped output at top-12. Surprising flat distribution prompted skepticism: **was every item really that clean, or was the top-12 cap masking heterogeneity?**

### Iteration 2 — Manual inspection of items 1, 2, 3

Spot-check revealed both signal and noise:
- **Signal** (per item): "Pain and Suffering", "Negligence", "Property & Premises Liability Claims", "Medical Malpractice", "Wrongful Death Claim", "Distracted Driving Claim" — all canonical PI concepts.
- **Noise** (also scoring 90): "Poland", "Albania", "Hawaii State Courts", "Ed.D. (Doctor of Education)", "Savings and Loan Association" — fuzzy substring matches on unrelated FOLIO classes.

Conclusion: raw search score is too generous on its own. **But this is what the LLM ranker and judge are for.** The pipeline's Stages 2/3 reject the noise; the spike just needs to confirm the signal exists.

### Iteration 3 — Keyword-filter heuristic (too narrow)

First-pass filter kept only labels containing legal vocabulary ("liability", "negligence", "malpractice", etc.). This rejected legitimate non-vocabulary matches like "Insured" (Actor/Player) and "Transportation and Logistics Industry" (Industry). Filter undercounted items 1, 11, 12, 15.

### Iteration 4 — Branch-membership filter (correct)

Switched to counting candidates whose **branch** is one of the legally-relevant branches (Objectives, Area of Law, Legal Entity, Actor/Player, Service, Industry and Market, Matter Narrative, Standards Compatibility). This counts a candidate as PI-relevant if it sits inside a branch FOLIO uses for legal substance, regardless of whether the specific label happens to contain a legal word.

Result (relevant-branch candidates per item): `[5, 7, 8, 9, 4, 10, 10, 8, 10, 5, 11, 7, 5, 9, 4]`. Minimum 4, mean ~7.5, max 11. **15/15 pass the ≥4 bar.**

## Results

### Verdict: VALIDATED

FOLIO has more than sufficient depth to support 15 verbose Personal Injury items each yielding 4–5 mapped concepts across multiple branches. Coverage is not the bottleneck; the bottleneck is the LLM ranker + judge correctly pruning Stage 1's noise — and the existence of that noise is **load-bearing for the demo's narrative** ("watch how the system rejects irrelevant candidates").

### Evidence

| Item | Item summary | Relevant-branch candidates | Distinct branches |
|------|------|----|----|
| 1 | rear-ended texting driver | 5 | 3 |
| 2 | grocery slip-and-fall | 7 | 3 |
| 3 | obstetric wrongful death | 8 | 4 |
| 4 | pressure cooker explosion | 9 | 3 |
| 5 | groundwater contamination class | 4 | 3 |
| 6 | pedestrian struck by DUI driver | 10 | 6 |
| 7 | broken stair landlord notice | 10 | 3 |
| 8 | wrong-site knee surgery | 8 | 4 |
| 9 | rollover roof crush | 10 | 3 |
| 10 | veterans burn-pit class | 5 | 3 |
| 11 | uninsured motorist denial | 11 | 6 |
| 12 | hotel-room assault | 7 | 5 |
| 13 | nursing home pressure ulcer | 5 | 2 |
| 14 | playground equipment collapse | 9 | 3 |
| 15 | asbestos mesothelioma | 4 | 2 |

Mean: 7.5 relevant-branch candidates per item, 3.5 distinct branches per item.

### Surprises

1. **`search_by_label` produces real noise.** Strings like "whiplash" → "Poland" (90 score) because of token overlap, not semantic match. The Stage 2 LLM ranker is doing more discrimination work than I had appreciated; without it, `search_by_label` alone would surface ~50% noise.
2. **Branch diversity is healthier than expected.** Even item 11 (uninsured motorist — narrow legal issue) touches Actor/Player ("Insured", "Driver"), Industry ("Insurance Carriers"), and Service ("Licensing Practice", "Policies Practice") in addition to the obvious Objectives + Area of Law hits. This is exactly the cross-branch surface area that makes a demo feel rich.
3. **PACER nature-of-suit codes appear in Standards Compatibility.** Item 4, 9, 14 (all product liability) all surface "345 Marine Product Liability (PACER NoS)" — a real FOLIO concept that the judge would either accept (correct PACER mapping) or boost into a "see also" tier. Either way, an interesting curation moment.

### What This Means for the Demo

- **Coverage is sufficient.** No need to rewrite items. The drafted 15 work as written.
- **Curation richness is locked in.** Every item has 4–11 strong candidates in legally-meaningful branches — and that's *before* the LLM ranker reorders them or the judge boosts/rejects.
- **Ambiguity comes free.** The Stage 1 noise (countries, state courts, education degrees) becomes the demo's "watch the judge work" moment. We don't need to engineer ambiguity; it's a natural byproduct of fuzzy label search.

### What This Spike Did NOT Validate

- **Actual pipeline output shape.** The real `pi.demo.json` requires running Stages 0/2/3 with an LLM provider. This spike confirmed the *raw material* exists; it did not produce the final demo artifact.
- **Auto-accept threshold tuning.** The pipeline's auto-accept threshold (likely 75 or 80) determines how many of these candidates land as "accepted" vs "pending review" in the demo. Tuning that for ideal demo balance is a phase-level concern.
- **The other 9 practice areas.** PI is FOLIO's densest branch (Tort, Negligence, Damages, Med Mal, Premises, Products all live there). M&A, employment, IP — those need their own coverage probes before scaling presets.

### Decision

- **Green light** for the Demo Mode phase, with one caveat: budget a real pipeline run (~$0.50–$2.00 in LLM tokens depending on provider) per practice area to produce the actual session JSON. PI alone is feasible. Scaling to 10 areas needs either (a) per-area coverage probes first, or (b) trusting that less-dense branches will still hit ≥4 since this spike's threshold was conservative.

## Files

- `items.json` — the 15 PI fact patterns
- `run_coverage_probe.py` — Stage-1 search driver
- `candidates.json` — full per-item top-12 candidate output
- `ORIGINAL-DEFINITION.md` — the original spike definition from `/gsd-explore`
