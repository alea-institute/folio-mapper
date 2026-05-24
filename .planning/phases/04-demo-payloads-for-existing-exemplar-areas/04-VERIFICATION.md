---
phase: 04-demo-payloads-for-existing-exemplar-areas
verified: 2026-05-24T20:07:41Z
status: verified_with_override
score: 4/4 roadmap success criteria (1 via operator-approved override)
overrides_applied: 1
overrides:
  - must_have: "Each of the 9 demo payloads contains a natural mix of fan-out ratios (1:1, 1:2–1:3, and 1:4+)"
    reason: "employment-labor and solo-criminal are thin-coverage FOLIO areas: their precise criminal/employment concepts sit in sparse regions of the FOLIO hierarchy, so the real pipeline (stage1 hierarchy walk + stage3 judge) surfaces ≤2–3 coherent candidates per leaf and no 1:4+ items. The probe's higher counts came from fuzzy label search, which overestimates pipeline fan-out. Per D-02 (coherence outranks richness), forcing 1:4+ would require off-theme broad terms that misrepresent a focused practitioner session. The other 8/10 payloads each contain 1:4+ items, so the demo SET fully demonstrates the disambiguation experience. Both thin payloads still show a visible auto-accept/pending mix (solo-criminal 12/19, employment-labor 14/19) and real Stage 3 judge annotations."
    accepted_by: "Damien Riehl"
    accepted_at: "2026-05-24"
gaps: []
---

# Phase 4: Demo Payloads for Existing Exemplar Areas — Verification Report

**Phase Goal:** Every existing exemplar area can be loaded in demo mode, giving presenters a live "watch curation happen" experience across all 9 previously-deferred areas
**Verified:** 2026-05-24T20:07:41Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|---------|
| SC-1 | Clicking any of the 9 existing exemplar cards in demo mode loads pre-computed pipeline output without triggering a live pipeline run | VERIFIED | All 9 demo.json exist; `loadSessionFromObject` is purely in-memory; no-network test passes for all 10 slugs (117/117 tests green) |
| SC-2 | Each of the 9 demo payloads contains a natural mix of fan-out ratios (1:1, 1:2–1:3, and 1:4+) plus at least one judge-flagged ambiguity | FAILED | `employment-labor` (max 3 candidates/item, zero 1:4+) and `solo-criminal` (max 2 candidates/item, zero 1:4+) do not contain any 1:4+ items. All 10 payloads do have judge-flagged ambiguity (stage3_judged_count > 0 with penalized/rejected candidates). 8/10 meet the full criterion; 2 fail on 1:4+. |
| SC-3 | Running `scripts/curate_demos.py` regenerates all 9 payloads deterministically, and every payload filename appears in the demo manifest | VERIFIED | All 10 input.json present in `scripts/demos/`; `curate_demos.py` exists and is not modified; all 10 slugs registered in `LAZY_LOADERS` + `DEMO_AVAILABLE_SLUGS` in `index.ts` |
| SC-4 | Zero LLM API calls occur at runtime when any of the 9 existing-area demos is loaded | VERIFIED | `demo-mode-no-network.test.tsx` passes for all 10 slugs (11 tests including hydration assertion); `loadSessionFromObject` is synchronous and in-memory |

**Score:** 3/4 roadmap success criteria verified

---

### Requirement Coverage (DEMO-01 through DEMO-05)

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| DEMO-01 | Demo payload exists for each of the 9 remaining existing exemplar areas | VERIFIED | 10 demo.json files present: banking-finance, commercial-lit, corporate-ma, employment-labor, family-law, immigration, ip-tech, personal-injury, real-estate, solo-criminal |
| DEMO-02 | Clicking an exemplar card in demo mode loads pre-computed pipeline output | VERIFIED | getDemoPayload awaited in App.tsx; loadSessionFromObject hydrates stores; round-trip test passes for all 10 |
| DEMO-03 | Each demo payload exhibits natural fan-out heterogeneity (1:1, 1:2–1:3, and 1:4+ items) with judge-flagged ambiguity | PARTIAL | 8/10 payloads pass all criteria; employment-labor and solo-criminal fail the 1:4+ tier. All 10 have judge-flagged ambiguity. |
| DEMO-04 | All 9 demo payloads reproducible via curate_demos.py and registered in manifest | VERIFIED | All 10 input.json present; all 10 slugs in LAZY_LOADERS + DEMO_AVAILABLE_SLUGS; curate_demos.py is unchanged from Phase 2 |
| DEMO-05 | Demo mode triggers zero LLM API calls at runtime for every existing area | VERIFIED | demo-mode-no-network.test.tsx with vi.spyOn on globalThis.fetch; passes for all 10 slugs |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/exemplar/demos/personal-injury.demo.json` | Re-curated with provider=anthropic, visible mix | VERIFIED | provider='anthropic', model='claude-3-5-sonnet-latest', version='1.3', 14/19 completed |
| `apps/web/src/exemplar/demos/solo-criminal.demo.json` | provider=anthropic, visible mix, 1:4+ | PARTIAL | provider/model/version correct, 12/19 visible mix, but max_candidates=2 (zero 1:4+ items) |
| `apps/web/src/exemplar/demos/family-law.demo.json` | provider=anthropic, visible mix, 1:4+ | VERIFIED | 15/19 completed, max_candidates=6, has 1:4+ |
| `apps/web/src/exemplar/demos/employment-labor.demo.json` | provider=anthropic, visible mix, 1:4+ | PARTIAL | provider/model/version correct, 14/19 visible mix, but max_candidates=3 (zero 1:4+ items) |
| `apps/web/src/exemplar/demos/corporate-ma.demo.json` | provider=anthropic, visible mix, 1:4+ | VERIFIED | 16/19 completed, max_candidates=8, has 1:4+ |
| `apps/web/src/exemplar/demos/ip-tech.demo.json` | provider=anthropic, visible mix, 1:4+ | VERIFIED | 15/19 completed, max_candidates=9, has 1:4+ |
| `apps/web/src/exemplar/demos/commercial-lit.demo.json` | provider=anthropic, visible mix, 1:4+ | VERIFIED | 16/19 completed, max_candidates=14, has 1:4+ |
| `apps/web/src/exemplar/demos/real-estate.demo.json` | provider=anthropic, visible mix, 1:4+ | VERIFIED | 15/19 completed, max_candidates=18, has 1:4+ |
| `apps/web/src/exemplar/demos/banking-finance.demo.json` | provider=anthropic, visible mix, 1:4+ | VERIFIED | 14/18 completed, max_candidates=6, has 1:4+ |
| `apps/web/src/exemplar/demos/immigration.demo.json` | provider=anthropic, visible mix, 1:4+ | VERIFIED | 13/18 completed, max_candidates=7, has 1:4+ |
| `apps/web/src/exemplar/demos/index.ts` | Async getDemoPayload + LAZY_LOADERS (9 slugs) + DEMO_AVAILABLE_SLUGS (10 slugs) | VERIFIED | async getDemoPayload, LAZY_LOADERS 9 entries, DEMO_AVAILABLE_SLUGS hardcoded Set of 10 |
| `apps/web/src/App.tsx` | await getDemoPayload at call site | VERIFIED | Line 554: `const payload = await getDemoPayload(id)` |
| `apps/web/src/__tests__/demo-mode-roundtrip.test.tsx` | it.each with 10 slug rows, all active | VERIFIED | 10 rows active in it.each, all pass |
| `apps/web/src/__tests__/demo-mode-no-network.test.tsx` | it.each with 10 slug rows | VERIFIED | 10 rows active in it.each, all pass |
| `apps/web/src/__tests__/demo-mode-richness.test.ts` | it.each with 10 slug rows, PI active (not todo) | VERIFIED | 10 rows active, PI in active table (not it.todo), no skipped tests |
| `scripts/demos/{slug}.input.json` (×10) | Lean text verbatim + enrichments per area | VERIFIED | All 10 input.json present and valid JSON |
| `scripts/curate_demos.py` | Unchanged curation script | VERIFIED | Exists at scripts/curate_demos.py, not modified in Phase 4 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `App.tsx` | `getDemoPayload` | `await` in `handleExemplarSelect` | VERIFIED | Line 554: `const payload = await getDemoPayload(id)` |
| `index.ts` LAZY_LOADERS | `./${slug}.demo.json` | template-literal `import()` via `_mkLoader` | VERIFIED | All 9 non-PI slugs in LAZY_LOADERS; _mkLoader generates template-literal imports |
| `demo-mode-roundtrip.test.tsx` | all 10 demo.json | static imports + it.each rows | VERIFIED | 10 static imports at top of file, 10 rows in it.each |
| `demo-mode-no-network.test.tsx` | all 10 demo.json | static imports + it.each rows | VERIFIED | 10 static imports, 10 rows; fetchSpy asserts zero API calls |
| `demo-mode-richness.test.ts` | all 10 demo.json | static imports + it.each rows | VERIFIED | 10 static imports, 10 active it.each rows, none todo |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `index.ts` getDemoPayload | DemoPayload (session JSON) | static import (PI) or lazy import (9 others) | Yes — committed JSON with real pipeline output | FLOWING |
| `App.tsx` handleExemplarSelect | payload | getDemoPayload | Yes — all 10 demo.json have real stage3_judged_count, selections, node_statuses | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 10 demo.json parse as valid JSON | python3 json.load loop | All valid | PASS |
| provider == anthropic in all 10 | python3 check | 10/10 correct | PASS |
| model == claude-3-5-sonnet-latest in all 10 | python3 check | 10/10 correct | PASS |
| version == 1.3 in all 10 | python3 check | 10/10 correct | PASS |
| 0 < completed < total_nodes (visible mix) in all 10 | python3 check | 10/10 pass; ranges from 12/19 to 16/19 | PASS |
| Judge annotations present (stage3_judged_count > 0) | python3 check | 10/10 have judge activity | PASS |
| 1:4+ fan-out items present per demo | python3 branch_groups analysis | 8/10 PASS; employment-labor and solo-criminal have zero 1:4+ items | FAIL |
| Full web test suite | pnpm --filter @folio-mapper/web test | 117 passed, 0 failures, 0 todos | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no probe-*.sh scripts declared for this phase; phase uses vitest as the automated gate.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TBD, FIXME, XXX, or placeholder patterns found in phase-modified files | — | — |

---

### D-04 Claude Max Proxy Deviation — Judge Assessment

The operator routed LLM curation through a local `claude_max_proxy.py` proxy (bridging the Anthropic Messages API to the `claude` CLI) rather than a metered `ANTHROPIC_API_KEY`. The recorded `model` field is `claude-3-5-sonnet-latest`; the proxy actually served Claude Sonnet 4.6 via the Max subscription plan.

**Verdict: This deviation SATISFIES D-04's intent.** The intent of D-04 was to get (a) real judge annotations from Stage 3, (b) a consistent provider/model label recorded in every demo.json, and (c) the visible auto-accept/pending mix that only the LLM judge produces. All three are satisfied:

- All 10 demo.json have `provider: "anthropic"`, `model: "claude-3-5-sonnet-latest"` — consistent labeling achieved.
- Stage 3 produced real boosted/penalized/rejected counts on every payload — genuine judge output.
- The proxy is transparent to the pipeline code: the backend received normal Anthropic API responses.

The model-label discrepancy (label says `claude-3-5-sonnet-latest`, proxy served Sonnet 4.6) is a known and operator-approved deviation. It is not a quality problem — Sonnet 4.6 is the current production Sonnet, and the label accurately names the configured model in `llm_config`. **No override required for D-04.**

---

### Gaps Summary

**1 gap blocking full success criterion coverage:**

**employment-labor and solo-criminal fail SC-2 / DEMO-03** — neither has any items with 4+ total candidates. The ROADMAP Success Criterion 2 and DEMO-03 both require "a natural mix of fan-out ratios (1:1, 1:2–1:3, and **1:4+**)." The data shows:

- `employment-labor`: candidate distribution `{0:3, 1:10, 2:5, 3:1}` — max 3 candidates/item
- `solo-criminal`: candidate distribution `{0:7, 1:10, 2:2}` — max 2 candidates/item

The 04-03-SUMMARY.md claims "All 4 areas reached ≥3 coherent enrichments worth of richness; none shipped below the D-02 floor." This claim is **contradicted by the JSON data**. D-02 defined the floor as "≥2 items at 1:4+ fan-out." Both areas fall below it.

The probe data (solo-criminal-probe-candidates.json) shows `Burglary: high_score_relevant=4` and `employment-labor` shows `Age Discrimination: 6, Discrimination: 16`. The Stage 3 judge rejected many candidates, resulting in fewer surviving in the final demo payload. The FOLIO coverage for these criminal and employment areas is genuinely thin at the leaf level.

**D-02 coherence override path exists:** The context decision D-02 explicitly allows shipping below the floor when coherent enrichments cannot clear it, with the shortfall surfaced to the operator. That disclosure did NOT happen in 04-03-SUMMARY.md (the summary falsely claimed meeting the floor). However, the *intent* of D-02 is to allow this — the operator needs to make a conscious choice.

**Resolution options:**
1. **Re-curate** both areas with different/additional enrichments targeting specifically high fan-out items in FOLIO — Burglary (4 high-score probes) and possibly broader criminal categories for solo-criminal; broader discrimination or OSHA-type items for employment-labor.
2. **Accept the deviation** by adding an override entry to this VERIFICATION.md with an explicit reason acknowledging these are thin-coverage FOLIO areas and D-02's coherence rule applies.

**To accept this deviation as-is, add to this file's frontmatter:**

```yaml
overrides:
  - must_have: "Each of the 9 demo payloads contains a natural mix of fan-out ratios (1:1, 1:2–1:3, and 1:4+)"
    reason: "employment-labor and solo-criminal are thin-coverage FOLIO areas where coherent enrichments do not yield 1:4+ fan-out; per D-02, coherence outranks richness; the demos still show a visible auto-accept/pending mix and real judge annotations"
    accepted_by: "{your name}"
    accepted_at: "{ISO timestamp}"
```

---

### Human Verification Required

No human verification items — all must-haves are either verified programmatically or are concrete, observable failures in the data.

---

_Verified: 2026-05-24T20:07:41Z_
_Verifier: Claude (gsd-verifier)_
