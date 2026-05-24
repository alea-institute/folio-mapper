# Phase 4: Demo Payloads for Existing Exemplar Areas - Research

**Researched:** 2026-05-24
**Domain:** Content curation + demo manifest wiring (no new architecture)
**Confidence:** HIGH — all findings verified directly from codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Probe each of the 9 areas (run_coverage_probe.py pattern) before drafting enrichments; pick 2–3 enrichments each yielding ≥4 high-confidence (≥90) relevant candidates.
- **D-02:** Ship all 9; enrich each to a minimum richness floor (≥2 items at 1:4+ fan-out), capped for practice-area coherence; coherence outranks richness.
- **D-03:** Tune curate_demos.py --threshold per area for a visible mix of auto-accepted AND pending-review items.
- **D-04:** Curate with anthropic claude-3-5-sonnet-latest (match the shipped PI demo) for cross-demo consistency.

### Claude's Discretion

- Exact enrichment items chosen per area (driven by probe results).
- Exact --threshold value per area to hit the visible-mix target.
- Exact numeric richness bar beyond the ≥2-items-at-1:4+ guideline.
- Per-area input-file slugs (must match the carousel/data.ts area identity; PI used `personal-injury`).
- Whether to batch all 9 in one PR or land incrementally.

### Deferred Ideas (OUT OF SCOPE)

- Net-new regulatory/compliance exemplars (Phase 5) and their demo payloads (Phase 6).
- Telemetry on Demo button usage.
- A "save as demo" affordance.
- Re-curating the existing PI demo if the curation model later changes.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEMO-01 | A demo payload exists for each of the 9 remaining exemplar areas | 9 input JSON files + 9 demo.json files + manifest registration |
| DEMO-02 | Clicking an exemplar card in demo mode loads pre-computed pipeline output | Covered by getDemoPayload() → loadSessionFromObject() path; round-trip test validates |
| DEMO-03 | Each demo payload exhibits natural fan-out heterogeneity + judge-flagged ambiguity | Threshold tuning (--threshold ~0.80–0.90) produces the required mix; verified via completed/total_nodes ratio |
| DEMO-04 | All 9 payloads reproducible via curate_demos.py and registered in manifest | Script is locked, manifest wiring is mechanical; requires bundle-size strategy (lazy imports) |
| DEMO-05 | Demo mode triggers zero LLM API calls at runtime for every existing area | Validated by existing demo-mode-no-network.test.tsx; dynamic import() for JSON chunks is not an LLM call |
</phase_requirements>

---

## Summary

Phase 4 is pure content curation at scale — the architecture shipped in v1.0 Phase 2 is fully locked, and the curation script (`scripts/curate_demos.py`) requires no changes. The planner's job is to organize a repeatable probe-then-enrich-then-curate loop for each of the 9 areas and to wire the produced demo JSONs into the manifest.

Two items of engineering exist at the edges of the content work: (1) `apps/web/src/exemplar/demos/index.ts` must be updated to register each new payload, and (2) the current eager-import approach for PI at 3.4 MB means adding 9 more eager imports would grow the initial bundle by ~30-45 MB — far beyond the 1.5 MB budget stated in Phase 2 CONTEXT. Phase 2 CONTEXT explicitly allows swapping to lazy `import()` calls, and `getDemoPayload()` is called from an already-async handler in `App.tsx`, so the migration to `Promise<DemoPayload | null>` is safe.

The PI demo as shipped (provider=null, model=null) was produced with `--no-llm`. D-04 mandates `anthropic/claude-3-5-sonnet-latest` for all 9 new areas. LLM-produced score distributions differ from symbolic-only, so D-03 threshold tuning must be done after each area is curated — not pre-set.

**Primary recommendation:** Execute the per-area loop mechanically: probe → select enrichments → write input.json → curate at threshold 0.85 → inspect completed/total_nodes ratio → re-tune threshold if all-accepted or all-pending → verify fan-out → register in index.ts → run round-trip test.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Demo JSON curation (offline) | Build-time script | Backend API | curate_demos.py drives the backend; produces committed JSON artifacts |
| Demo JSON storage | Frontend bundle | — | Static ES-module imports (or dynamic) in apps/web/src/exemplar/demos/ |
| Demo payload loading at runtime | Frontend App.tsx | — | getDemoPayload() → loadSessionFromObject() → store hydration; zero backend |
| Manifest registration | Frontend index.ts | — | DEMO_PAYLOADS record + DEMO_AVAILABLE_SLUGS set |
| Coverage probe (offline) | Planning script | Backend venv | run_coverage_probe.py drives folio-python directly; LLM-free |
| Round-trip validation | Frontend test suite | — | vitest tests in apps/web/src/__tests__/ |

---

## The 9 Areas: Canonical Slug Mapping

All slugs come directly from `packages/core/src/exemplar/data.ts` (the `id` field). [VERIFIED: codebase read]

| # | data.ts `id` (= slug) | data.ts `label` | Input file | Output file |
|---|----------------------|-----------------|------------|-------------|
| 1 | `solo-criminal` | Solo Criminal Defense | `scripts/demos/solo-criminal.input.json` | `apps/web/src/exemplar/demos/solo-criminal.demo.json` |
| 2 | `family-law` | Family Law Firm | `scripts/demos/family-law.input.json` | `apps/web/src/exemplar/demos/family-law.demo.json` |
| 3 | `employment-labor` | Employment & Labor | `scripts/demos/employment-labor.input.json` | `apps/web/src/exemplar/demos/employment-labor.demo.json` |
| 4 | `corporate-ma` | Corporate M&A | `scripts/demos/corporate-ma.input.json` | `apps/web/src/exemplar/demos/corporate-ma.demo.json` |
| 5 | `ip-tech` | IP & Technology | `scripts/demos/ip-tech.input.json` | `apps/web/src/exemplar/demos/ip-tech.demo.json` |
| 6 | `commercial-lit` | Commercial Litigation | `scripts/demos/commercial-lit.input.json` | `apps/web/src/exemplar/demos/commercial-lit.demo.json` |
| 7 | `real-estate` | Real Estate | `scripts/demos/real-estate.input.json` | `apps/web/src/exemplar/demos/real-estate.demo.json` |
| 8 | `banking-finance` | Banking & Finance | `scripts/demos/banking-finance.input.json` | `apps/web/src/exemplar/demos/banking-finance.demo.json` |
| 9 | `immigration` | Immigration | `scripts/demos/immigration.input.json` | `apps/web/src/exemplar/demos/immigration.demo.json` |

**Lean item counts (all identical):** 1 root + 5 branches + 10 leaves = 16 items each. [VERIFIED: codebase read of data.ts]

---

## Input File Format

Reference: `scripts/demos/personal-injury.input.json`. [VERIFIED: codebase read]

```json
{
  "slug": "personal-injury",
  "label": "Personal Injury Plaintiff",
  "text": "<lean_exemplar_text_verbatim>\\n<enrichment_1_line>\\n<enrichment_2_line>\\n<enrichment_3_line>",
  "enrichments": ["Enrichment Label 1", "Enrichment Label 2", "Enrichment Label 3"],
  "source_lean_exemplar": "packages/core/src/exemplar/data.ts#personal-injury",
  "spike_reference": ".planning/spikes/001-demo-pi-curation/README.md"
}
```

**Rules for the `text` field:**
- Lean exemplar text from `data.ts` copied VERBATIM (same `\t`-indented hierarchy, same line order).
- Enrichments are appended as tab-indented lines at the LEAF level within the thematically appropriate branch (see PI example: Insurance Bad Faith under Motor Vehicle Accidents, not at the root).
- The `\n\t\t` prefix for each enrichment leaf puts it two levels deep (branch-child), matching the existing leaf convention.
- `curate_demos.py` reads only `input_doc["text"]` from this file — the `enrichments` and other metadata fields are documentary only.

**Lean text per area** (from `data.ts`, for copy-paste into input files): [VERIFIED: codebase read]

| Slug | Root line | Branch lines (5) |
|------|-----------|------------------|
| `solo-criminal` | `Criminal Defense` | DUI & Impaired Driving, Drug Offenses, Violent Crimes, Property Crimes, Juvenile & Financial Crimes |
| `family-law` | `Family Law` | Divorce & Separation, Child Custody, Support Obligations, Protective Orders, Adoption & Guardianship |
| `employment-labor` | `Employment Law` | Discrimination, Wage & Hour, Workplace Safety, Wrongful Termination, Benefits & Compensation |
| `corporate-ma` | `Mergers & Acquisitions` | Corporate Governance, Securities, Due Diligence, Deal Structuring, Post-Merger |
| `ip-tech` | `Intellectual Property` | Patent Practice, Trademark Practice, Trade Secrets, Copyright Practice, IP Transactions |
| `commercial-lit` | `Complex Commercial Litigation` | Contract Disputes, Antitrust, Securities Litigation, Consumer & Trade, Dispute Resolution |
| `real-estate` | `Real Property Law` | Property Transactions, Landlord-Tenant, Zoning & Land Use, Construction, Foreclosure & Liens |
| `banking-finance` | `Banking & Finance Law` | Commercial Lending, Securities & Capital Markets, Investment Funds, Structured Finance, Compliance & Enforcement |
| `immigration` | `Immigration Law` | Employment Visas, Family & Humanitarian, Removal Defense, Status Adjustment, Special Visas |

---

## curate_demos.py Mechanics

[VERIFIED: codebase read of `scripts/curate_demos.py`]

### CLI Signature

```
backend/.venv/bin/python scripts/curate_demos.py \
    --area {slug}           # required; resolves scripts/demos/{slug}.input.json
    --provider anthropic    # required for D-04; sets ANTHROPIC_API_KEY env var
    --model <override>      # optional; default is claude-3-5-sonnet-latest
    --threshold 0.85        # float 0-1; accept top candidate iff score >= threshold * 100
    --max-per-branch 10     # default 10; candidates per FOLIO branch
    --backend http://127.0.0.1:58000  # must match pnpm dev:api port
    --output-dir apps/web/src/exemplar/demos  # default; no need to override
    --no-llm                # skip LLM stages (NOT for D-04 areas; symbolic only)
```

### Prerequisites

1. `pnpm dev:api` running (backend on port 58000)
2. `ANTHROPIC_API_KEY` exported in shell
3. `backend/.venv` created and backend installed (`pip install -e ".[embedding,nlp]"` in backend/)

### Auto-Accept Logic [VERIFIED: codebase read, line 237-243 in curate_demos.py]

```
for each item:
    top_candidate = highest-score candidate across ALL branch_groups
    if top_candidate.score >= threshold * 100:
        selections[idx] = [top_candidate.iri_hash]
        node_statuses[idx] = "completed"
    else:
        selections[idx] = []
        node_statuses[idx] = "unmapped"
```

**Auto-accept threshold math:** `--threshold 0.85` accepts if `top_score >= 85.0`. The PI demo used `--threshold 0.30` (accepting if score >= 30), which auto-accepted all 19 items since the minimum top score was 61.4. For D-03's visible mix, threshold values in the 0.80–0.92 range will be appropriate for most areas.

### Version Snapshot [VERIFIED: codebase read]

The script snapshots into the output JSON:
- `pipeline_version`: `{apps/desktop/package.json version}+{git short SHA}` (e.g., `0.10.0+a09573b`)
- `folio_version`: from `folio.__version__` or pip metadata (e.g., `0.2.0`)

### Script Stderr Output (D-03 tuning feedback)

After a run, the script prints to stderr:
```
✓ Wrote apps/web/src/exemplar/demos/{slug}.demo.json
  Items:            {N}
  Auto-mapped:      {X}  (unmapped: {Y})
  Fan-out:          {"0": a, "1": b, "2-3": c, "4+": d}
  pipeline_version: {version}
  folio_version:    {version}
```

The `Auto-mapped: X  (unmapped: Y)` line is the D-03 tuning feedback. If `X == N` (all accepted) or `Y == N` (all pending), re-run with a different threshold.

---

## Output + Manifest Wiring

### demo.json Schema [VERIFIED: codebase read of session/index.ts and personal-injury.demo.json]

Every `{slug}.demo.json` is a `SessionFile` (v1.3) plus two non-schema snapshot fields. The `validateSession()` function in `packages/core/src/session/index.ts` is shape-based and accepts extra fields. Required fields:

| Field | Type | Value for demo payloads |
|-------|------|------------------------|
| `version` | string | `"1.3"` (SESSION_VERSION) |
| `created` | ISO 8601 string | curation timestamp |
| `updated` | ISO 8601 string | curation timestamp |
| `total_nodes` | number | item count (16 + enrichments) |
| `screen` | string | `"mapping"` |
| `provider` | string or null | `"anthropic"` (D-04) |
| `model` | string or null | `"claude-3-5-sonnet-latest"` (D-04) |
| `selections` | `Record<string, string[]>` | string-keyed (not number) |
| `node_statuses` | `Record<string, NodeStatus>` | string-keyed |
| `pipeline_version` | string | `"{version}+{sha}"` |
| `folio_version` | string | `"0.2.x"` |

**Note:** The shipped PI demo has `provider: null, model: null` because it was produced with `--no-llm`. The 9 new areas produced with `--provider anthropic` will have `provider: "anthropic"`, `model: "claude-3-5-sonnet-latest"` — this is correct and expected.

### Manifest Registration [VERIFIED: codebase read of index.ts]

Current `apps/web/src/exemplar/demos/index.ts` structure:

```typescript
import personalInjuryDemo from './personal-injury.demo.json';

export const DEMO_PAYLOADS: Record<string, DemoPayload> = {
  'personal-injury': personalInjuryDemo as DemoPayload,
};

export const DEMO_AVAILABLE_SLUGS: ReadonlySet<string> = new Set(Object.keys(DEMO_PAYLOADS));
```

`getDemoPayload(slug)` is currently **synchronous**, returning `DemoPayload | null`.

### Bundle Size: The Critical Constraint

[VERIFIED: measured from filesystem]

The PI demo JSON is **3.4 MB** on disk. With gzip (~7:1 compression for JSON), this is ~480 KB over the wire. Adding 9 more eager imports at similar sizes:

| Scenario | Raw bundle addition | Gzipped |
|----------|--------------------|---------| 
| 9 eager imports | ~30–45 MB | ~2–3 MB |
| 9 dynamic imports (lazy) | 0 MB at startup | Fetched on demand |

Phase 2 CONTEXT explicitly permits: "If the budget proves tight, swap to lazy `import()` calls without changing the public API." [CITED: .planning/milestones/v1.0-phases/02-demo-mode/02-CONTEXT.md]

**getDemoPayload is called inside `handleExemplarSelect`, which is already `async`.** Making `getDemoPayload` return `Promise<DemoPayload | null>` requires only:
1. `index.ts`: Change return type; use `await import('./slug.demo.json')` for the 9 new areas.
2. `App.tsx` line 554: Change `const payload = getDemoPayload(id)` to `const payload = await getDemoPayload(id)` (call site is already in an async function).
3. `DEMO_AVAILABLE_SLUGS`: Must be hardcoded statically (cannot derive from async DEMO_PAYLOADS). [VERIFIED: codebase read, App.tsx + index.ts]

**Recommended approach:** PI stays as an eager import (already in the initial bundle, already tested), and the 9 new areas use `() => import('./{slug}.demo.json')` per-demand with an in-memory cache.

---

## Coverage-Probe Generalization

Reference: `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py`. [VERIFIED: codebase read]

### Items.json Format

```json
{
  "items": ["Root Label", "Branch Label", "Leaf Label", ...],
  "item_level": ["root", "branch", "leaf", ...]
}
```

Level is determined by tab-count in the lean exemplar text: 0 tabs = `"root"`, 1 tab = `"branch"`, 2 tabs = `"leaf"`. This maps cleanly for all 9 areas.

### Generalizing the Probe Script

The current `run_coverage_probe.py` hardcodes `ITEMS_FILE = SCRIPT_DIR / "items.json"` and `OUT_FILE = SCRIPT_DIR / "candidates.json"`. To generalize for each area, the planner should create a wrapper that:

1. Accepts `--area {slug}` argument
2. Reads the lean text from `packages/core/src/exemplar/data.ts` (or from a pre-extracted per-area items file)
3. Parses tab-count into level strings
4. Passes items + levels to the probe logic
5. Writes output to `scripts/demos/{slug}-probe-candidates.json`

The simplest implementation: create per-area `{slug}-probe-items.json` files in `scripts/demos/` (same format as the PI spike's `items.json`), then run the probe script with a `--items-file` override. This avoids modifying the probe script itself.

### What the Probe Measures

The probe runs `folio.search_by_label(item, include_alt_labels=True, limit=20)` for each item and counts `high_score_relevant`: candidates in `RELEVANT_BRANCHES` with score >= 90. [VERIFIED: codebase read]

**RELEVANT_BRANCHES** (from the probe script, used for enrichment selection only):
```python
{"Objectives", "Area of Law", "Legal Entity", "Actor / Player", "Service",
 "Industry and Market", "Matter Narrative", "Standards Compatibility"}
```

**D-01 enrichment selection criterion:** An enrichment candidate passes if the probe shows `high_score_relevant >= 4` for that label. This is a pre-curation filter only — the final demo.json will have very different score distributions because the full LLM pipeline (Stages 0/2/3) re-ranks candidates.

**The "Negligence trap" (from spike 001):** Some terms probe with high `high_score_relevant` counts but most matches are specialty noise (ENT/EMT/EMS Negligence, etc.). Prefer terms that fan out into thematically coherent FOLIO candidates, not just any term with high count.

---

## Threshold Tuning + Richness Verification

### D-03: Visible Mix Verification

After running `curate_demos.py`, inspect the produced `{slug}.demo.json`:

```bash
# Quick check
python3 -c "
import json
d = json.load(open('apps/web/src/exemplar/demos/{slug}.demo.json'))
print(f'total={d[\"total_nodes\"]}, completed={d[\"completed\"]}, ratio={d[\"completed\"]/d[\"total_nodes\"]:.1%}')
"
```

**D-03 targets:**
- `completed / total_nodes` in the range **0.55–0.80** (roughly 60–80% auto-accepted)
- Neither `completed == total_nodes` (all-accepted = threshold too low) nor `completed == 0` (all-pending = threshold too high)

**Tuning guidance from PI score analysis:**

The PI demo at `--threshold 0.30` produced `19/19` auto-accepted because all items' top scores were in the range 61–99. For LLM-curated areas (Stages 0/2/3), score distributions concentrate at the extremes (very high for exact FOLIO label matches, lower for branch/conceptual items). Starting threshold recommendation: **0.85**. If ratio > 0.80, increase to 0.88 or 0.90. If ratio < 0.55, decrease to 0.80.

### D-02: Fan-Out Richness Verification

The `curate_demos.py` stderr output includes the `Fan-out` histogram (total candidates per item buckets: 0, 1, 2-3, 4+). With the full LLM pipeline at `--max-per-branch=10`, virtually all items land in the `4+` bucket regardless of area density — this is not the meaningful metric.

The meaningful D-02 check is: do the **enrichment items** (the ones chosen in Step 2) show qualitatively richer candidate sets than the lean-exemplar leaf items? Verify by inspecting top candidates for each enrichment item in the produced demo.json:

```bash
python3 -c "
import json
d = json.load(open('apps/web/src/exemplar/demos/{slug}.demo.json'))
items = d['parse_result']['items']
mapping = d['mapping_response']['items']
enrichments = [...]  # from your input.json enrichments list
for i, item in enumerate(items):
    if item['text'] in enrichments:
        bgs = mapping[i].get('branch_groups', [])
        cands = sorted([c for bg in bgs for c in bg.get('candidates',[])], key=lambda c: -c.get('score',0))
        print(f'{item[\"text\"]}: top 3 = {[(c[\"label\"], c[\"score\"]) for c in cands[:3]]}')
"
```

A passing enrichment item shows top candidates with scores >= 70 AND labels that clearly belong to the practice area.

---

## Architecture Patterns

### Per-Area Loop (Concrete Steps for Planner)

```
For each of the 9 areas in order:

Wave A — Probe (per area):
  1. Create scripts/demos/{slug}-probe-items.json
     (parse tab-indented lean text into {"items": [...], "item_level": [...]})
  2. Run probe:
     backend/.venv/bin/python .planning/spikes/001-demo-pi-curation/run_coverage_probe.py
     (with ITEMS_FILE + OUT_FILE overridden to {slug} variants)
  3. Read candidates output: identify 2-3 enrichment candidates with high_score_relevant >= 4
     in thematically-coherent FOLIO branches. Avoid "trap" terms.

Wave B — Input File + Curation (per area):
  4. Write scripts/demos/{slug}.input.json
     (slug, label, text=lean_verbatim+enrichments_inserted, enrichments list)
  5. Run curate_demos.py at starting threshold 0.85:
     export ANTHROPIC_API_KEY=sk-ant-...
     backend/.venv/bin/python scripts/curate_demos.py --area {slug} --provider anthropic --threshold 0.85
  6. Check stderr: Auto-mapped: X  (unmapped: Y)
     - If X == total (all-accepted): re-run at 0.90 or 0.92
     - If Y == total (all-pending): re-run at 0.80 or 0.75
     - If 60-80% accepted: threshold is good — continue

Wave C — Verify + Register (per area):
  7. Verify D-02 enrichment richness (inspect top candidates for enrichment items)
  8. Register in apps/web/src/exemplar/demos/index.ts (dynamic import)
  9. Run round-trip test:
     pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-roundtrip.test.tsx
  10. Commit: scripts/demos/{slug}.input.json + apps/web/src/exemplar/demos/{slug}.demo.json
```

### Index.ts Lazy-Loading Pattern [ASSUMED — derived from Phase 2 CONTEXT intent + App.tsx structure]

```typescript
// Keep PI eager (already in bundle, tests depend on static import)
import personalInjuryDemo from './personal-injury.demo.json';

// New areas: lazy load on demand
const LAZY_LOADERS: Record<string, () => Promise<{ default: DemoPayload }>> = {
  'solo-criminal': () => import('./solo-criminal.demo.json'),
  'family-law': () => import('./family-law.demo.json'),
  // ... 7 more
};

// Cache to avoid re-fetching
const _cache: Record<string, DemoPayload> = {};

export const DEMO_PAYLOADS: Record<string, DemoPayload> = {
  'personal-injury': personalInjuryDemo as DemoPayload,
};

// Becomes async for new areas
export async function getDemoPayload(slug: string): Promise<DemoPayload | null> {
  if (DEMO_PAYLOADS[slug]) return DEMO_PAYLOADS[slug];
  if (_cache[slug]) return _cache[slug];
  const loader = LAZY_LOADERS[slug];
  if (!loader) return null;
  const mod = await loader();
  _cache[slug] = mod.default;
  return _cache[slug];
}

// Hardcoded since dynamic-imported slugs can't be derived synchronously
export const DEMO_AVAILABLE_SLUGS: ReadonlySet<string> = new Set([
  'personal-injury',
  'solo-criminal',
  'family-law',
  'employment-labor',
  'corporate-ma',
  'ip-tech',
  'commercial-lit',
  'real-estate',
  'banking-finance',
  'immigration',
]);
```

**App.tsx change required:** `const payload = getDemoPayload(id)` → `const payload = await getDemoPayload(id)`. Already inside `async` `handleExemplarSelect` — safe change. [VERIFIED: App.tsx line 549-574]

### Recommended Project Structure (additions only)

```
scripts/demos/
├── personal-injury.input.json      ← exists (reference)
├── solo-criminal.input.json        ← new (Wave A+B)
├── family-law.input.json           ← new
├── employment-labor.input.json     ← new
├── corporate-ma.input.json         ← new
├── ip-tech.input.json              ← new
├── commercial-lit.input.json       ← new
├── real-estate.input.json          ← new
├── banking-finance.input.json      ← new
└── immigration.input.json          ← new

apps/web/src/exemplar/demos/
├── personal-injury.demo.json       ← exists (reference, stays eager)
├── solo-criminal.demo.json         ← new (Wave C)
├── family-law.demo.json            ← new
├── employment-labor.demo.json      ← new
├── corporate-ma.demo.json          ← new
├── ip-tech.demo.json               ← new
├── commercial-lit.demo.json        ← new
├── real-estate.demo.json           ← new
├── banking-finance.demo.json       ← new
├── immigration.demo.json           ← new
├── index.ts                        ← modified (lazy getDemoPayload + DEMO_AVAILABLE_SLUGS)
└── index.test.ts                   ← extended (detectStalePreset tests unchanged)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pipeline execution | Manual HTTP calls | `curate_demos.py` | Already handles auth, parse, pipeline, session construction, api_key leak check, atomic writes |
| FOLIO search for enrichment probing | Custom search | `folio.search_by_label()` via `run_coverage_probe.py` | LLM-free, verified against the same FOLIO that the pipeline uses |
| Session schema construction | Custom dict | `_build_session_file()` in curate_demos.py | Handles selections, node_statuses, version fields, api_key exclusion |
| Bundle splitting | Custom webpack config | Vite dynamic `import()` | Vite splits dynamically-imported modules into separate chunks automatically |
| Round-trip validation | Manual testing | `demo-mode-roundtrip.test.tsx` | Existing test; extend with new areas rather than testing manually |

---

## Common Pitfalls

### Pitfall 1: Threshold Too Low (All Items Auto-Accepted)

**What goes wrong:** Running `curate_demos.py --threshold 0.30` (the default) accepts every item because even low-scoring items have top scores above 30. The demo loads with all nodes green and nothing pending, losing the "your judgment finishes it" narrative beat (violates D-03).

**Why it happens:** The default threshold is calibrated for interactive user sessions where the user is present to resolve ambiguity. Demo mode needs a HIGHER bar so some items land in pending.

**How to avoid:** Start at `--threshold 0.85`. Inspect stderr `Auto-mapped` line before committing. Never use the default 0.30 for demo curation.

**Warning signs:** stderr shows `Auto-mapped: 19  (unmapped: 0)` — any N where N equals total_nodes.

### Pitfall 2: "Trap" Enrichment Terms

**What goes wrong:** A term like "Negligence" appears to have high probe coverage (22 `high_score_relevant` candidates) but most matches are specialty noise — ENT/EMS/EMT negligence — not the practice area's domain. The demo shows many candidates but they're incoherent and fail the "wow, look at the relevant options" beat.

**Why it happens:** `folio.search_by_label` fuzzy-matches substrings. "Negligence" matches many compound FOLIO labels across unrelated branches.

**How to avoid:** After identifying high-count probe candidates, read the actual top candidate labels from the probe output. Skip enrichments where the top candidates are in unrelated FOLIO branches even if the count is high.

**Warning signs:** Top candidates for an enrichment term are in branches like "Governmental Body," "Language," "Geographic Region."

### Pitfall 3: Bundle Size Regression

**What goes wrong:** Adding all 9 new demo JSONs as eager imports (same as the PI demo) grows the initial bundle by ~30-45 MB raw.

**Why it happens:** Static `import foo from './foo.json'` includes the file in the main bundle unconditionally.

**How to avoid:** Use dynamic `import()` for all 9 new areas as described in the Index.ts Lazy-Loading Pattern section above. PI stays eager (single file, already tested, tests import it statically).

**Warning signs:** `pnpm build` output shows chunk sizes above 5 MB; `vite build --report` shows demo JSON files in the main chunk.

### Pitfall 4: Provider/Model Mismatch in Demo JSON

**What goes wrong:** Running curate_demos.py with `--no-llm` (or wrong provider) produces a demo JSON with `provider: null, model: null`. The PI demo has this because it was produced symbolically. D-04 mandates Anthropic for cross-demo consistency.

**Why it happens:** `--no-llm` bypasses the LLM pipeline and sets provider/model to null in the output.

**How to avoid:** Always use `--provider anthropic` (never `--no-llm`) for the 9 new areas. Verify the produced JSON: `python3 -c "import json; d=json.load(open('{slug}.demo.json')); print(d['provider'], d['model'])"` — must print `anthropic claude-3-5-sonnet-latest`.

### Pitfall 5: getDemoPayload Call-Site Not Awaited After Making It Async

**What goes wrong:** `getDemoPayload` is changed to `async`, but App.tsx `const payload = getDemoPayload(id)` is not updated. TypeScript will catch this if strict mode is on, but if typechecking is skipped, the `payload` variable will be a Promise object (truthy), and `validateSession(payload)` will return null, causing a silent fallback to lean mode.

**How to avoid:** Update App.tsx line 554 to `const payload = await getDemoPayload(id)` in the same commit as the index.ts change. Run `pnpm --filter @folio-mapper/web test` to catch this via the round-trip test.

### Pitfall 6: Area Density Variance (Not All Areas are PI-Dense)

**What goes wrong:** Assuming the enrichment probe will find 2-3 strong enrichment candidates for every area. Transactional areas (Banking, Corporate M&A, IP) may have fewer intuitive enrichments with ≥4 `high_score_relevant` candidates because their FOLIO branch is more specific.

**Why it happens:** FOLIO's "Area of Law" branch covers litigation areas densely; transactional practice areas may have fewer broad conceptual labels.

**How to avoid:** Per D-02, coherence outranks richness. If an area can only yield 1-2 good enrichments, ship it at that richness rather than forcing incoherent terms. Document the shortfall in the commit message.

**Warning signs:** Probe output shows fewer than 3 enrichment candidates with `high_score_relevant >= 4` across all tested terms for an area.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @folio-mapper/web test --run src/__tests__/` |
| Full suite command | `pnpm test` (runs packages/* and apps/web) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEMO-01 | All 9 demo payload files exist and are valid JSON | Static import test | `pnpm --filter @folio-mapper/web test --run src/exemplar/demos/index.test.ts` | Partial — index.test.ts exists but only covers detectStalePreset; needs import assertions for each new slug |
| DEMO-02 | Clicking demo card loads pre-computed session data | Integration test | `pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-roundtrip.test.tsx` | Exists for PI only — extend with 9 new areas |
| DEMO-03 | Each demo has 0 < completed < total_nodes | Unit (JSON assertion) | Script-level check; add vitest assertion or a `pnpm run verify:demos` script | Does not exist — Wave 0 gap |
| DEMO-04 | Each demo registered in manifest + curate_demos.py reproducible | Static import + manifest test | `pnpm --filter @folio-mapper/web test --run src/exemplar/demos/` | Partial — add slug registration assertions |
| DEMO-05 | Zero LLM API calls at runtime | Unit (fetch spy) | `pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-no-network.test.tsx` | Exists for PI — extend with 9 new areas |

### Sampling Rate

- **Per-area completion:** `pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-roundtrip.test.tsx` before committing each area's demo.json
- **Per wave merge:** `pnpm test` (full frontend suite)
- **Phase gate:** Full suite green before closing Phase 4

### Wave 0 Gaps

- [ ] `apps/web/src/__tests__/demo-mode-roundtrip.test.tsx` — extend to parametrize over all 10 slug + payload pairs (covers DEMO-01, DEMO-02, DEMO-04)
- [ ] `apps/web/src/__tests__/demo-mode-no-network.test.tsx` — extend to test all 9 new area payloads (covers DEMO-05); requires importing each demo.json statically in the test
- [ ] D-03 assertion test: `apps/web/src/__tests__/demo-mode-richness.test.ts` — for each demo payload, assert `completed > 0 && completed < total_nodes` (covers DEMO-03)

**Note:** The D-03 / DEMO-03 test can only be created AFTER the demo JSONs exist (the JSON is the fixture). It is a Wave C gate per area, not a Wave 0 gap. Include it in the per-area verification loop.

---

## Code Examples

### Input File Creation (reference)

```json
// scripts/demos/solo-criminal.input.json
{
  "slug": "solo-criminal",
  "label": "Solo Criminal Defense",
  "text": "Criminal Defense\n\tDUI & Impaired Driving\n\t\tDriving Under the Influence\n\t\tBoating DUI/BUI\n\t\t{Enrichment1}\n\tDrug Offenses\n\t\tCannabis Law\n\t\tControlled Substance Charges\n\tViolent Crimes\n\t\tAssault Law\n\t\tDomestic Violence\n\tProperty Crimes\n\t\tBurglary\n\t\tShoplifting\n\tJuvenile & Financial Crimes\n\t\tJuvenile Law\n\t\tWire Fraud\n\t\t{Enrichment2}\n\t\t{Enrichment3}",
  "enrichments": ["{Enrichment1}", "{Enrichment2}", "{Enrichment3}"],
  "source_lean_exemplar": "packages/core/src/exemplar/data.ts#solo-criminal",
  "spike_reference": ".planning/spikes/001-demo-pi-curation/README.md"
}
```

**Note:** Enrichment placement within the text is thematic — place enrichments as leaves of the branch they are most relevant to, not appended at the end of the full text. PI example: `Insurance Bad Faith` was placed under `Motor Vehicle Accidents` branch, not at the root level.

### Curation Command (per area)

```bash
# Start backend
pnpm dev:api &
export ANTHROPIC_API_KEY=sk-ant-...

# Curate (starting threshold)
backend/.venv/bin/python scripts/curate_demos.py \
    --area solo-criminal \
    --provider anthropic \
    --threshold 0.85

# Check output ratio in stderr:
# Auto-mapped: X  (unmapped: Y)  <-- target X/(X+Y) in 0.55-0.80 range

# If not in range, re-run with adjusted threshold
```

### D-03 Verification One-Liner

```bash
python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))
total = d['total_nodes']
completed = d['completed']
ratio = completed / total
status = 'PASS' if 0.0 < ratio < 1.0 else 'FAIL'
print(f'{sys.argv[1]}: {completed}/{total} auto-accepted ({ratio:.1%}) [{status}]')
" apps/web/src/exemplar/demos/{slug}.demo.json
```

### Round-Trip Test Extension Pattern

```typescript
// Extend demo-mode-roundtrip.test.tsx:
import demoPISolo from '../exemplar/demos/solo-criminal.demo.json';
// ...
it.each([
  ['personal-injury', demoPI],
  ['solo-criminal', demoPISolo],
  // add each area as they are produced
])('%s demo payload produces identical store state via both load paths', async (slug, payload) => {
  // same test body as current PI test
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PI demo produced with `--no-llm` (symbolic) | 9 new areas produced with `--provider anthropic` | Phase 4 (D-04) | Provider/model fields populated; LLM re-ranking produces more concentrated score distributions |
| Single eager import (PI only) | PI eager + 9 new lazy `import()` | Phase 4 (bundle budget) | getDemoPayload becomes async; App.tsx needs `await` |
| DEMO_AVAILABLE_SLUGS derived from DEMO_PAYLOADS keys | Hardcoded set of 10 slugs | Phase 4 | Static set maintained manually; must be updated if areas are added in future |

**PI demo quirk:** `provider: null, model: null` in the shipped PI demo. This is correct for its production history (`--no-llm`), not a defect. The 9 new demos will have non-null provider/model and can serve as more informative references for the "what model was used" display if one is ever added.

---

## Open Questions

1. **Probe automation vs. manual items.json**
   - What we know: The probe script currently hardcodes its items file path.
   - What's unclear: Whether to modify the probe script to accept `--area` (minor change) or create per-area items.json files manually (more files, no script change).
   - Recommendation: Create a single generalized `scripts/demos/run_probe.py` that accepts `--area` and derives items from `packages/core/src/exemplar/data.ts` directly via tab-parsing. 9 invocations, one script.

2. **Incremental landing vs. single PR**
   - What we know: 9 areas × (probe + curate + tune + register) is a multi-hour effort.
   - What's unclear: Whether to land all 9 in one PR or group them (e.g., 3+3+3 by domain).
   - Recommendation: Land the lazy-loading refactor and index.ts changes first (trivially reviewable); then land per-area demos in batches of 3-4 to keep PRs manageable. Each batch is independently deployable.

3. **DEMO-03 test timing**
   - What we know: The D-03 test assertion requires the demo JSON to exist first.
   - What's unclear: Whether it belongs in the per-area Wave C or in a final Wave D pass.
   - Recommendation: Include D-03 assertion in per-area Wave C. Gate each area's commit on it.

---

## Package Legitimacy Audit

This phase installs no new packages. [VERIFIED: curate_demos.py uses only httpx (already in backend venv); probe uses only folio (already in backend venv).]

| Package | Status |
|---------|--------|
| httpx | Already installed in backend venv — no new install |
| folio-python | Already installed in backend venv — no new install |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `backend/.venv` (Python) | curate_demos.py, run_coverage_probe.py | Assumed available | Python 3.13 | Install per backend README |
| `ANTHROPIC_API_KEY` | D-04 (LLM curation) | Operator-supplied | — | None — required for D-04; `--no-llm` exists but violates D-04 |
| `pnpm dev:api` (FastAPI backend) | curate_demos.py | Must be started manually | Port 58000 | None — script fails without it |
| `folio-python` package | run_coverage_probe.py | Already in venv | 0.2.x | None — required for probe |
| `vitest` | Automated tests | Already in pnpm workspace | — | — |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY` — operator must export before running curation commands. Without it, the script exits early with an error message.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Demo JSON file sizes for new areas will be ~3-4 MB each (similar to PI's 3.4 MB) | Bundle Size section | If areas produce significantly smaller files (e.g., because LLM pipeline truncates candidates), lazy loading may not be strictly necessary, but it remains the safer choice |
| A2 | Lazy `getDemoPayload` returning `Promise<DemoPayload \| null>` is compatible with App.tsx | Index.ts Lazy-Loading Pattern | If App.tsx has other synchronous callers of getDemoPayload not found in this research, those would need updating — search for `getDemoPayload` before implementing |
| A3 | LLM-produced score distributions with `claude-3-5-sonnet-latest` will be concentrated enough that threshold 0.85 provides a meaningful split | Threshold Tuning section | Score distributions vary by area and model; the actual starting threshold may need to be 0.80 or 0.90 depending on the area |
| A4 | All 9 areas have enough FOLIO coverage to find 2-3 coherent enrichments with high_score_relevant >= 4 | Per-Area Loop | Transactional areas (Banking, M&A, IP) may be thinner; per D-02, coherence outranks richness and ships are not blocked by failure to reach 3 enrichments |

---

## Sources

### Primary (HIGH confidence)

- `apps/web/src/exemplar/demos/index.ts` — demo manifest structure, getDemoPayload signature, DEMO_AVAILABLE_SLUGS, bundle strategy
- `apps/web/src/exemplar/demos/personal-injury.demo.json` — reference output shape; measured 3.4 MB, all-accepted at 0.30 threshold
- `scripts/curate_demos.py` — CLI flags, auto-accept logic (threshold * 100), session construction, stderr output format
- `scripts/demos/personal-injury.input.json` — input file schema
- `packages/core/src/exemplar/data.ts` — all 9 area ids, labels, and verbatim lean texts
- `packages/core/src/session/index.ts` — SessionFile schema, SESSION_VERSION='1.3', validateSession()
- `apps/web/src/App.tsx` (line 549–574) — getDemoPayload call site, async context confirmation
- `apps/web/src/__tests__/demo-mode-roundtrip.test.tsx` — round-trip invariant test
- `apps/web/src/__tests__/demo-mode-no-network.test.tsx` — DEMO-05 test
- `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py` — probe mechanics
- `.planning/spikes/001-demo-pi-curation/README.md` — enrichment-selection lessons, "Negligence trap"

### Secondary (MEDIUM confidence)

- `.planning/milestones/v1.0-phases/02-demo-mode/02-CONTEXT.md` — bundle strategy mandate, lazy import permission

---

## Metadata

**Confidence breakdown:**
- Area slug mapping and input format: HIGH — read directly from data.ts and personal-injury.input.json
- curate_demos.py mechanics: HIGH — read directly from script source
- Bundle size concern: HIGH — measured PI demo at 3.4 MB
- Threshold tuning ranges: MEDIUM — derived from PI score analysis; actual ranges per area depend on LLM output
- Enrichment quality for specific areas: LOW — requires running the probe; no pre-probe data available

**Research date:** 2026-05-24
**Valid until:** Phase 4 completion (no external dependencies that change; architecture is locked)
