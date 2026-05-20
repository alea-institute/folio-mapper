# Spike Manifest

## Idea

Add a **Demo** mode that flips the "Try an Exemplar" cards from lean precision-tuned payloads to rich, pre-cached session payloads showcasing FOLIO Mapper's curation workflow. Each demo loads a saved session with ~15 items mapped to 4-5 FOLIO concepts each, blending high-confidence auto-accepts with judge-flagged ambiguity that invites expert review.

## Requirements

Tracked as they emerge from spike findings and user choices.

- Demo payloads must round-trip through the existing Stage 7A session-load path — no new pipeline logic.
- Demo payloads reuse the lean exemplar text VERBATIM + 2-3 enrichment items per area; lean exemplars stay untouched.
- Demo richness comes from natural heterogeneity (mix of 1:1, 1:2-1:3, and 1:4+ fan-out across items), not uniform 1:4-1:5 on every item.
- At least some items must contain genuine ambiguity (cross-branch hits, judge boosts/penalties, bridged matches) to make curation a meaningful demonstration.
- Demo mode is a session-scoped toggle, not a persisted preference.
- Demo-mode token cost at runtime = 0 (presets are pre-computed JSON).

## Spikes

| #   | Name                  | Type     | Validates                                                                                  | Verdict | Tags                                |
| --- | --------------------- | -------- | ------------------------------------------------------------------------------------------ | ------- | ----------------------------------- |
| 001 | demo-pi-curation      | standard | Given lean PI exemplar + 3 enrichment items, when run through FOLIO Stage-1 search, then demo payload shows enough 1:4+ fan-out items to feel rich without losing practice-area coherence | ✓ VALIDATED | demo-mode, folio-coverage, personal-injury |
