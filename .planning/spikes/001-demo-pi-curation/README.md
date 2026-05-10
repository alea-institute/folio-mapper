---
spike: 001
name: demo-pi-curation
type: standard
validates: "Given the existing lean PI exemplar text + a small enrichment set, when run through FOLIO Stage-1 search, then the demo payload shows enough 1:4-1:5 fan-out items to feel rich without losing the practice-area coherence"
verdict: VALIDATED
related: []
tags: [demo-mode, folio-coverage, personal-injury]
---

# Spike 001: Demo PI Curation — FOLIO Coverage Probe

## What This Validates

**Given** the 16 items from the existing lean Personal Injury exemplar (verbatim from `packages/core/src/exemplar/data.ts`) PLUS a small set of enrichment items chosen to bridge thin-mapping gaps,
**When** each item is searched against the FOLIO ontology via `folio.search_by_label` (Stage 1 of the pipeline),
**Then** the resulting demo payload contains enough natural 1:4–1:5+ fan-out items to feel rich, with no item below 1:1 — proving the "reuse lean exemplar + sprinkle enrichments" approach is feasible without drafting wholly new narrative content.

## Approach: Reuse + Enrich, Not Replace

After an initial wrong turn into narrative items (archived as `items.narrative-deprecated.json` and `candidates.narrative-deprecated.json`), the spike pivoted to the user's preferred approach:

1. **Lean exemplar stays untouched.** The 10 existing exemplars in `exemplar/data.ts` are tuned for 100% precision (1:1 mapping). They keep that job.
2. **Demo payload = lean exemplar text VERBATIM + 2-3 enrichment items** that naturally pull richer fan-out.
3. **Both feed the same pipeline.** The demo payload is run through the pipeline once offline, the resulting session is saved as `pi.demo.json`, and the Demo button loads that pre-computed session.

This keeps practice-area coherence (it's still Personal Injury items, in the same hierarchical style) while guaranteeing the demo has visible richness.

## Research

- `folio-python>=0.2.0` loads the OWL ontology from GitHub (~1s warm, cached at `~/.folio/cache`).
- `search_by_label(term, include_alt_labels=True, limit=N)` returns `(OWLClass, score)` tuples; scores ≥90 are strong label/alt-label matches.
- "Relevant" FOLIO branches for legal substance: Objectives, Area of Law, Legal Entity, Actor/Player, Service, Industry and Market, Matter Narrative, Standards Compatibility.

**Chosen approach:** Drive `folio-python` directly. Treat each item as both the item text AND the Stage 1 search term — mirrors how the pipeline handles exemplar-style label input. LLM-free, zero token cost (honors Claude Max plan budget).

## How to Run

From project root:

```bash
backend/.venv/bin/python .planning/spikes/001-demo-pi-curation/run_coverage_probe.py
```

Outputs `candidates.json` and a per-item stderr summary.

## Investigation Trail

### Iteration 1 — Narrative items (wrong format)

First pass drafted 15 multi-sentence intake narratives ("Plaintiff was rear-ended at a stoplight by a delivery van..."). User correctly pointed out exemplars are tabbed hierarchical LISTS, not narratives. Coverage finding from that iteration is preserved in `items.narrative-deprecated.json` and `candidates.narrative-deprecated.json` — confirmed FOLIO has the depth even for narrative input, but the artifact didn't match the demo format.

### Iteration 2 — Pivot: reuse existing exemplar verbatim

Replaced items.json with the 16 lines of the lean PI exemplar (root + 5 branches + 10 leaves). Per-item probe revealed:

- Total relevant-branch candidates per item: 6–25 (mean 15.2)
- **High-confidence (≥90) relevant candidates per item — the metric that drives auto-accept:**

| # | Item | Level | High≥90 relevant |
|---|------|-------|------------------|
| 1 | Personal Injury | root | **10** |
| 2 | Motor Vehicle Accidents | branch | 1 |
| 3 | Motor Vehicle Law | leaf | 1 |
| 4 | Accident Benefits Law | leaf | 2 |
| 5 | Premises Liability | branch | 2 |
| 6 | Slip-and-Fall Negligence | leaf | 3 |
| 7 | Dog Bite | leaf | 4 |
| 8/9 | Medical Malpractice | branch/leaf | **8** |
| 10 | Wrongful Death Claim | leaf | 2 |
| 11 | Product Liability | branch | **14** |
| 12 | Product Liability Law | leaf | 1 |
| 13 | Defective Product Claims | leaf | 1 |
| 14 | Mass Torts & Defamation | branch | 3 |
| 15 | Mass Torts Law | leaf | 3 |
| 16 | Defamation Law | leaf | 2 |

**Reading the table:** 4 items naturally produce rich fan-out (1, 8, 11 hit 8-14, plus 7 at 4). About half the items produce thin 1:1 or 1:2 — that's the expected behavior since exemplar leaves are precise FOLIO labels.

### Iteration 3 — Enrichment candidates (per user's "not too many, but impressive" guidance)

Tested 8 candidate enrichments. Results (high ≥90 relevant counts):

| Candidate | High≥90 relevant | Notes |
|-----------|------------------|-------|
| Negligence | 22 | Many but mostly specialty noise (ENT/EMT/EMS). Redundant with existing items. **Skip.** |
| Class Action | 6 | Clean: Class Action Claim, Waiver Clause, Class, Representative, certification standard. **Pick.** |
| Compensatory Damages | 5 | Solid but lukewarm — Damages, Additur, generic noise. |
| Loss of Consortium | 5 | Clean: Loss of Spousal Consortium variant adds an "ah, related" beat. **Pick.** |
| Insurance Bad Faith | 4 | Clean: Insurance Carrier Bad Faith, Insurance Law, Carriers Industry. **Pick.** |
| Punitive Damages | 4 | Solid; could swap in if needed. |
| Future Medical Damages | 3 | Too thin; only one strong direct match. |
| Toxic Tort | 2 | Too thin; Mass Torts already covers this thematically. |

## Results

### Verdict: VALIDATED

**Recommended demo PI payload (lean exemplar + 3 enrichments = 19 items):**

```
Personal Injury
	Motor Vehicle Accidents
		Motor Vehicle Law
		Accident Benefits Law
		Insurance Bad Faith               ← enrichment, 1:4
	Premises Liability
		Slip-and-Fall Negligence
		Dog Bite
	Medical Malpractice
		Medical Malpractice
		Wrongful Death Claim
		Loss of Consortium                ← enrichment, 1:5
	Product Liability
		Product Liability Law
		Defective Product Claims
	Mass Torts & Defamation
		Mass Torts Law
		Defamation Law
		Class Action                      ← enrichment, 1:6
```

**Why these three:**
- Each lands in a thematically-appropriate branch (insurance under MVA, consortium under MedMal, class action under Mass Torts).
- Each demonstrably produces ≥4 high-confidence relevant FOLIO candidates (verified via probe).
- Together they sprinkle three "wow, look at the fan-out" moments across the demo, separated from each other — feels distributed, not bunched.

### Expected Demo Distribution

After running this payload through the full pipeline:

- **5 items** with rich fan-out (1:4-1:14): Personal Injury, Medical Malpractice (×2), Product Liability + the 3 enrichments → roughly 8 rich items total.
- **~6 items** with modest fan-out (1:2-1:3): Premises Liability, Dog Bite, Wrongful Death Claim, etc.
- **~5 items** with tight 1:1 fan-out: precise leaf labels (Motor Vehicle Law, Product Liability Law, etc.).

That heterogeneity is itself the demo's narrative: *"watch how the system handles broad concepts AND precise ones — sometimes one perfect match, sometimes a constellation of related concepts inviting your judgment."*

### Surprises

1. **Lean exemplar leaves are tighter than I expected.** "Motor Vehicle Law" pulls only 1 high-conf match because it's already a unique FOLIO label. Anything below the root pulls 1-3 in most cases. The richness was hiding at the root + broad-branch level.
2. **`search_by_label` produces real noise on every item.** Countries, unrelated state courts, "Ed.D." — these appear at score 90 due to fuzzy token overlap. The pipeline's Stage 2/3 LLM stages are doing more discrimination work than I realized, and the noise becomes the demo's "watch the judge reject" beat.
3. **"Negligence" as enrichment is a trap.** It pulls 22 candidates, but most are specialty negligence types (ENT/EMT/EMS Negligence) which read as the wrong domain. Better demo moment is a clean term that fans out cleanly.

### What This Spike Did NOT Validate

- **Actual pipeline output shape.** Producing the real `pi.demo.json` still requires a Stages-0/2/3 LLM run (~$0.50–$2 in tokens). This spike confirmed the *raw material* is present; the LLM stages will compose the final mapped session.
- **Auto-accept threshold tuning.** The pipeline's threshold determines exactly how many candidates become "accepted" vs "pending review." The 8/16 thin items will look different at threshold 75 vs 85.
- **The other 9 practice areas.** PI is FOLIO's densest branch. M&A, employment, IP need their own coverage probes before scaling.

### Decision

- **Green light** for the Demo Mode phase, scoped to PI first.
- **Recommendation for the phase**: take the lean PI exemplar verbatim, append `Insurance Bad Faith`, `Loss of Consortium`, and `Class Action` (in their thematically-appropriate branches), run the result through the live pipeline once, save as `pi.demo.json`.
- **For scale**: rerun this same probe-then-enrich pattern for each of the other 9 practice areas before drafting their demo payloads. Avoid assuming PI's density translates.

## Files

- `items.json` — the 16-line lean PI exemplar payload used in iteration 2
- `run_coverage_probe.py` — Stage-1 search driver
- `candidates.json` — per-item top-relevant candidate output from iteration 2
- `items.narrative-deprecated.json` / `candidates.narrative-deprecated.json` — wrong-format iteration 1, preserved for honesty
- `ORIGINAL-DEFINITION.md` — original spike definition from `/gsd-explore`
