---
title: Curate one practice-area demo preset end-to-end
date: 2026-05-10
status: proposed
practice_area_under_test: personal-injury
---

# Spike: Curate one practice-area demo preset end-to-end

## Question this spike answers

Can the live pipeline produce **15 items × 4-5 FOLIO matches each** for a single practice area, with a healthy mix of high-confidence auto-accepts and judge-flagged ambiguity? If yes, the demo-mode feature is feasible at scale. If no, we need to understand whether the limit is item drafting, FOLIO coverage density, or pipeline thresholds — before committing to 10 presets.

## Test case

**Personal Injury** — likely the highest-density practice area in FOLIO (Tort, Negligence, Damages, Medical Malpractice, Premises Liability, etc. all live there). If PI can't yield 1:4-1:5, no other practice area will.

## Procedure

1. **Draft 15 PI items** with deliberate multi-faceted phrasing — each item should plausibly touch ≥4 FOLIO concepts (e.g., *"Plaintiff slipped on unmarked wet floor in defendant's grocery store, sustaining a fractured hip requiring surgical repair and ongoing physical therapy."* → premises liability + negligence + bodily injury + medical damages + future care).
2. **Run the full pipeline** (Stage 0 pre-scan → Stage 3 judge) with default thresholds and active LLM provider.
3. **Inspect output per item**: count accepted mappings, count surfaced candidates, note judge annotations.
4. **Iterate items** that yield <4 matches — rephrase, add detail, or swap.
5. **Save the resulting session JSON** via existing Stage 7A save path.
6. **Reload the saved session** through normal load flow to confirm round-trip works for demo button.

## Success criteria

- [ ] ≥12 of 15 items produce 4-5 mapped concepts (some misses are acceptable — demos show curation, not perfection)
- [ ] At least 3 items contain "interesting ambiguity" (judge boosted/penalized, bridged matches, cross-branch hits)
- [ ] Total LLM cost for one full curation pass is documented
- [ ] Resulting `pi.demo.json` loads cleanly via existing session-load code path

## Decision after spike

- **Green light**: scale curation to remaining 9 practice areas; phase planning proceeds
- **Yellow light**: PI works but barely — investigate which areas have FOLIO depth before scaling
- **Red light**: even PI can't hit the shape — revisit whether item shape (e.g., paragraph length, multi-clause structure) is the lever, or whether demo-mode needs different practice areas than the current 10
