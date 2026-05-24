# Phase 4: Demo Payloads for Existing Exemplar Areas - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 14 (9 input JSONs + 9 demo JSONs + index.ts + run_probe.py + 2 extended test files + 1 new richness test)
**Analogs found:** 14 / 14 — every file has a direct analog in the shipped PI infrastructure

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/demos/{slug}.input.json` (×9) | config | batch | `scripts/demos/personal-injury.input.json` | exact |
| `apps/web/src/exemplar/demos/{slug}.demo.json` (×9) | config | batch | `apps/web/src/exemplar/demos/personal-injury.demo.json` | exact |
| `apps/web/src/exemplar/demos/index.ts` (modify) | utility | request-response | itself (current synchronous version) | exact — migrate sync → async |
| `apps/web/src/App.tsx` (line 554, modify) | component | request-response | itself (line 554, `getDemoPayload(id)`) | exact — add `await` |
| `scripts/demos/run_probe.py` (new generalized script) | utility | batch | `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py` | exact |
| `scripts/demos/{slug}-probe-items.json` (×9) | config | batch | `.planning/spikes/001-demo-pi-curation/items.json` | exact |
| `apps/web/src/__tests__/demo-mode-roundtrip.test.tsx` (extend) | test | request-response | itself (current PI-only version) | exact — parametrize |
| `apps/web/src/__tests__/demo-mode-no-network.test.tsx` (extend) | test | request-response | itself (current PI-only version) | exact — parametrize |
| `apps/web/src/__tests__/demo-mode-richness.test.ts` (new) | test | batch | `apps/web/src/__tests__/demo-mode-no-network.test.tsx` | role-match |

---

## Pattern Assignments

### `scripts/demos/{slug}.input.json` (×9) (config, batch)

**Analog:** `scripts/demos/personal-injury.input.json`

**Full file shape** (lines 1-8):
```json
{
  "slug": "personal-injury",
  "label": "Personal Injury Plaintiff",
  "text": "Personal Injury\n\tMotor Vehicle Accidents\n\t\tMotor Vehicle Law\n\t\tAccident Benefits Law\n\t\tInsurance Bad Faith\n\tPremises Liability\n\t\tSlip-and-Fall Negligence\n\t\tDog Bite\n\tMedical Malpractice\n\t\tMedical Malpractice\n\t\tWrongful Death Claim\n\t\tLoss of Consortium\n\tProduct Liability\n\t\tProduct Liability Law\n\t\tDefective Product Claims\n\tMass Torts & Defamation\n\t\tMass Torts Law\n\t\tDefamation Law\n\t\tClass Action",
  "enrichments": ["Insurance Bad Faith", "Loss of Consortium", "Class Action"],
  "source_lean_exemplar": "packages/core/src/exemplar/data.ts#personal-injury",
  "spike_reference": ".planning/spikes/001-demo-pi-curation/README.md"
}
```

**Critical rules for the `text` field:**
- Lean exemplar text from `packages/core/src/exemplar/data.ts` copied VERBATIM (array `.join('\n')` output — `\t` prefixes preserved).
- Enrichments appended as `\t\t`-prefixed lines at the leaf level INSIDE the thematically relevant branch (NOT appended at root). PI example: `Insurance Bad Faith` placed under `Motor Vehicle Accidents` branch.
- `curate_demos.py` reads ONLY `input_doc["text"]` — all other fields are documentary metadata.

**Verbatim lean texts per slug** (from `packages/core/src/exemplar/data.ts`):

| Slug | Root | Branches (5) | Leaves (10) |
|---|---|---|---|
| `solo-criminal` | `Criminal Defense` | `DUI & Impaired Driving`, `Drug Offenses`, `Violent Crimes`, `Property Crimes`, `Juvenile & Financial Crimes` | `Driving Under the Influence`, `Boating DUI/BUI`, `Cannabis Law`, `Controlled Substance Charges`, `Assault Law`, `Domestic Violence`, `Burglary`, `Shoplifting`, `Juvenile Law`, `Wire Fraud` |
| `family-law` | `Family Law` | `Divorce & Separation`, `Child Custody`, `Support Obligations`, `Protective Orders`, `Adoption & Guardianship` | `Contested Divorce`, `Legal Separation`, `Custody Law`, `Parenting Plan`, `Child Support`, `Spousal Support`, `Restraining Order`, `Criminal Harassment`, `Adoption`, `Guardianship` |
| `employment-labor` | `Employment Law` | `Discrimination`, `Wage & Hour`, `Workplace Safety`, `Wrongful Termination`, `Benefits & Compensation` | `Employment Discrimination Law`, `Age Discrimination`, `Wage and Hour Law`, `Pay Equity Law`, `Employment Health and Safety Law`, `Substance Abuse and Drug Testing Law`, `Wrongful Discharge or Termination`, `Reduction in Force Law`, `Workers Compensation Law`, `Unemployment Benefits Law` |
| `corporate-ma` | `Mergers & Acquisitions` | `Corporate Governance`, `Securities`, `Due Diligence`, `Deal Structuring`, `Post-Merger` | `Corporate Governance Law`, `Breach of Fiduciary Duty`, `Security Offerings and Capital Markets Law`, `Securities Fraud`, `Asset Due Diligence Practice`, `Regulatory Compliance`, `Stock Purchase Agreement`, `Asset Purchase Agreement`, `Antitrust and Competition Law`, `Hostile Takeover` |
| `ip-tech` | `Intellectual Property` | `Patent Practice`, `Trademark Practice`, `Trade Secrets`, `Copyright Practice`, `IP Transactions` | `Patent Law`, `Patent Infringement`, `Trademark and Trade Dress Law`, `Trademark Infringement`, `Trade Secret Law`, `Trade Secret Misappropriation`, `Copyright Law`, `Copyright Infringement`, `Intellectual Property Assets`, `Software Patent` |
| `commercial-lit` | `Complex Commercial Litigation` | `Contract Disputes`, `Antitrust`, `Securities Litigation`, `Consumer & Trade`, `Dispute Resolution` | `Breach of Contract`, `Tortious Interference Claims`, `Antitrust and Competition Law`, `Antitrust - Bid-Rigging Claims`, `Securities Fraud`, `Insider Trading`, `Consumer Protection Law`, `Unfair Competition`, `Arbitration Practice`, `Mediation Practice` |
| `real-estate` | `Real Property Law` | `Property Transactions`, `Landlord-Tenant`, `Zoning & Land Use`, `Construction`, `Foreclosure & Liens` | `Property Rights and Transactions Law`, `Clearing Title`, `Landlord Tenant Law`, `Lease Agreements`, `Land Use and Zoning Law`, `Zoning Variance`, `Construction and Development Law`, `Building Code Violations`, `Mortgage Foreclosure`, `Eminent Domain Law` |
| `banking-finance` | `Banking & Finance Law` | `Commercial Lending`, `Securities & Capital Markets`, `Investment Funds`, `Structured Finance`, `Compliance & Enforcement` | `Commercial Finance Law`, `Asset-Based Lending Practice`, `Broker-Dealer Law`, `Derivatives and Futures Law`, `Investment Companies Law`, `Private Equity, Hedge Funds and Venture Capital Law`, `Structured Finance Law`, `Collateralized Loan Obligation`, `Bank Secrecy and Anti-Money Laundering Law`, `Cryptocurrency Law` |
| `immigration` | `Immigration Law` | `Employment Visas`, `Family & Humanitarian`, `Removal Defense`, `Status Adjustment`, `Special Visas` | `Employment Immigration Law`, `H-1B Visa`, `Affirmative Asylum`, `Refugee`, `Deportation`, `Defensive Asylum`, `Naturalization Application`, `Green Card`, `Student Visa`, `Entertainment Visa` |

---

### `scripts/demos/{slug}-probe-items.json` (×9) (config, batch)

**Analog:** `.planning/spikes/001-demo-pi-curation/items.json`

**Full file shape** (lines 1-41):
```json
{
  "practice_area": "personal-injury",
  "approach": "Existing lean exemplar text verbatim from packages/core/src/exemplar/data.ts. ...",
  "source": "packages/core/src/exemplar/data.ts (id: personal-injury)",
  "items": [
    "Personal Injury",
    "Motor Vehicle Accidents",
    "Motor Vehicle Law",
    ...
  ],
  "item_level": [
    "root",
    "branch",
    "leaf",
    ...
  ]
}
```

**Tab-count → level mapping:** 0 tabs = `"root"`, 1 tab = `"branch"`, 2 tabs = `"leaf"`. Each area has exactly 16 items: 1 root + 5 branches + 10 leaves. The lean verbatim text from `data.ts` is the authoritative source — do NOT include enrichments in the probe items file (probe measures lean coverage only).

---

### `scripts/demos/run_probe.py` (new, utility, batch)

**Analog:** `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py`

**Core structure to copy** (lines 1-155 of analog):
```python
# Header / path setup — lines 25-27:
SCRIPT_DIR = Path(__file__).resolve().parent
ITEMS_FILE = SCRIPT_DIR / "items.json"          # override per area
OUT_FILE = SCRIPT_DIR / "candidates.json"        # override per area

# Relevant branches constant — lines 31-40 (copy verbatim):
RELEVANT_BRANCHES = {
    "Objectives",
    "Area of Law",
    "Legal Entity",
    "Actor / Player",
    "Service",
    "Industry and Market",
    "Matter Narrative",
    "Standards Compatibility",
}

# FOLIO load + search loop — lines 43-112 (copy verbatim):
folio = FOLIO()
for idx, (item, level) in enumerate(zip(items, levels), start=1):
    hits = folio.search_by_label(item, include_alt_labels=True, limit=20)
    # ... build candidates_by_iri, rank, count high_score_relevant ...
    results.append({
        "index": idx, "item": item, "level": level,
        "total_candidates": len(ranked),
        "relevant_candidates": len(relevant),
        "high_score_relevant": len(high_relevant),
        "top_relevant": top_relevant,
        "branches_touched": sorted({c["branch"] for c in top_relevant}),
    })

# _branch_of() helper — lines 131-151 (copy verbatim)
```

**Generalization changes from analog:**
- Replace hardcoded `ITEMS_FILE` / `OUT_FILE` with `argparse` `--area {slug}` argument.
- Derive: `ITEMS_FILE = SCRIPT_DIR / f"{slug}-probe-items.json"` and `OUT_FILE = SCRIPT_DIR / f"{slug}-probe-candidates.json"`.
- Alternatively, parse tab-indented lean text directly from `packages/core/src/exemplar/data.ts` at runtime to avoid the per-area items.json files entirely (open question from RESEARCH.md — planner decides).

**Run command:**
```bash
backend/.venv/bin/python scripts/demos/run_probe.py --area solo-criminal
```

---

### `apps/web/src/exemplar/demos/{slug}.demo.json` (×9) (config, batch)

**Analog:** `apps/web/src/exemplar/demos/personal-injury.demo.json`

**Production method:** These files are NEVER hand-written. They are produced exclusively by:
```bash
backend/.venv/bin/python scripts/curate_demos.py \
    --area {slug} \
    --provider anthropic \
    --threshold 0.85
```

**Required fields in produced output** (from RESEARCH.md, verified against session/index.ts):

| Field | Expected value for new areas |
|---|---|
| `version` | `"1.3"` |
| `provider` | `"anthropic"` (D-04 — NOT null) |
| `model` | `"claude-3-5-sonnet-latest"` (D-04 — NOT null) |
| `screen` | `"mapping"` |
| `selections` | `Record<string, string[]>` with string keys |
| `node_statuses` | `Record<string, NodeStatus>` |
| `pipeline_version` | `"{version}+{sha}"` |
| `folio_version` | `"0.2.x"` |

**D-03 visible-mix verification** (run after each curation):
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

Target: `completed / total_nodes` in 0.55–0.80 range. Start at `--threshold 0.85`; increase toward 0.92 if all-accepted, decrease toward 0.75 if all-pending.

---

### `apps/web/src/exemplar/demos/index.ts` (modify, utility, request-response)

**Analog:** itself (current version at lines 1-89)

**Current synchronous pattern** (lines 1-29 — the parts that change):
```typescript
// Current — lines 1-29:
import personalInjuryDemo from './personal-injury.demo.json';

export const DEMO_PAYLOADS: Record<string, DemoPayload> = {
  'personal-injury': personalInjuryDemo as DemoPayload,
};

export function getDemoPayload(slug: string): DemoPayload | null {
  return DEMO_PAYLOADS[slug] ?? null;
}

export const DEMO_AVAILABLE_SLUGS: ReadonlySet<string> = new Set(Object.keys(DEMO_PAYLOADS));
```

**Target lazy-loading pattern** (the full replacement for lines 1-29):
```typescript
// Keep PI eager — already in bundle, existing tests import it statically:
import personalInjuryDemo from './personal-injury.demo.json';

// New areas: lazy-loaded on demand (Vite splits each into its own chunk):
const LAZY_LOADERS: Record<string, () => Promise<{ default: DemoPayload }>> = {
  'solo-criminal':     () => import('./solo-criminal.demo.json'),
  'family-law':        () => import('./family-law.demo.json'),
  'employment-labor':  () => import('./employment-labor.demo.json'),
  'corporate-ma':      () => import('./corporate-ma.demo.json'),
  'ip-tech':           () => import('./ip-tech.demo.json'),
  'commercial-lit':    () => import('./commercial-lit.demo.json'),
  'real-estate':       () => import('./real-estate.demo.json'),
  'banking-finance':   () => import('./banking-finance.demo.json'),
  'immigration':       () => import('./immigration.demo.json'),
};

// In-memory cache to avoid re-fetching within a session:
const _demoCache: Record<string, DemoPayload> = {};

export const DEMO_PAYLOADS: Record<string, DemoPayload> = {
  'personal-injury': personalInjuryDemo as DemoPayload,
};

// getDemoPayload becomes async — callers that were already in async functions
// only need `await` added. App.tsx line 554 is the only call site.
export async function getDemoPayload(slug: string): Promise<DemoPayload | null> {
  if (DEMO_PAYLOADS[slug]) return DEMO_PAYLOADS[slug];
  if (_demoCache[slug]) return _demoCache[slug];
  const loader = LAZY_LOADERS[slug];
  if (!loader) return null;
  const mod = await loader();
  _demoCache[slug] = mod.default;
  return _demoCache[slug];
}

// Must be hardcoded — cannot derive dynamically from async loaders:
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

**Lines 32-89 (DemoPayload interface, detectStalePreset, fetchRuntimeFolioVersion, VersionVector, RUNTIME_PIPELINE_VERSION) are UNCHANGED** — copy forward verbatim.

---

### `apps/web/src/App.tsx` (line 554, modify, component, request-response)

**Analog:** itself, lines 549-574

**Current call-site** (line 554):
```typescript
const handleExemplarSelect = async (id: string) => {      // line 549 — already async
  const exemplar = EXEMPLARS.find((e) => e.id === id);
  if (!exemplar) return;

  if (exemplarMode === 'demo') {
    const payload = getDemoPayload(id);                    // line 554 — synchronous, no await
    if (payload) {
```

**Target call-site** (line 554 — single token change):
```typescript
      const payload = await getDemoPayload(id);            // line 554 — add await
```

`handleExemplarSelect` is already `async` (confirmed line 549). No other callers of `getDemoPayload` exist in the codebase — this is the only change required in App.tsx.

---

### `apps/web/src/__tests__/demo-mode-roundtrip.test.tsx` (extend, test, request-response)

**Analog:** itself (current PI-only version, lines 1-79)

**Current single-test pattern** (lines 1-79 — copy as template):
```typescript
import demoPI from '../exemplar/demos/personal-injury.demo.json';
// ...
describe('demo mode round-trip', () => {
  beforeEach(() => { resetStores(); });

  it('PI demo payload produces identical store state via loadSessionFromObject and File-based handleLoadSessionFile', async () => {
    // Path A — direct demo-mode helper
    const sessionA = loadSessionFromObject(demoPI);
    expect(sessionA).not.toBeNull();
    const snapA = snapshot();
    resetStores();

    // Path B — public session-file API (the drag-drop loader)
    const { result } = renderHook(() => useSession());
    const payloadText = JSON.stringify(demoPI);
    const file = new File([payloadText], 'my-saved-session.json', { type: 'application/json' });
    if (typeof file.text !== 'function') {
      Object.defineProperty(file, 'text', { value: async () => payloadText, configurable: true });
    }
    await act(async () => { await result.current.handleLoadSessionFile(file); });
    const snapB = snapshot();

    expect(snapB).toEqual(snapA);
  });
});
```

**Parametrized extension pattern** (to add after each new demo.json is committed):
```typescript
// Add static imports as each area is committed:
import demoSoloCriminal from '../exemplar/demos/solo-criminal.demo.json';
import demoFamilyLaw from '../exemplar/demos/family-law.demo.json';
// ... one import per committed area ...

// Replace the single it() with it.each():
it.each([
  ['personal-injury',   demoPI],
  ['solo-criminal',     demoSoloCriminal],
  ['family-law',        demoFamilyLaw],
  // add each area as it is committed
])('%s demo payload produces identical store state via both load paths', async (slug, payload) => {
  // Identical test body — copy from PI test verbatim.
  // The `slug` param is available for error messages if needed.
  const sessionA = loadSessionFromObject(payload);
  expect(sessionA).not.toBeNull();
  const snapA = snapshot();
  resetStores();

  const { result } = renderHook(() => useSession());
  const payloadText = JSON.stringify(payload);
  const file = new File([payloadText], `${slug}-session.json`, { type: 'application/json' });
  if (typeof file.text !== 'function') {
    Object.defineProperty(file, 'text', { value: async () => payloadText, configurable: true });
  }
  await act(async () => { await result.current.handleLoadSessionFile(file); });
  const snapB = snapshot();

  expect(snapB).toEqual(snapA);
});
```

**Note:** Static `import` of each demo JSON is required here (not dynamic import) so vitest can resolve the fixture at test compile time. Each import is added only when the corresponding `{slug}.demo.json` file exists.

---

### `apps/web/src/__tests__/demo-mode-no-network.test.tsx` (extend, test, request-response)

**Analog:** itself (current PI-only version, lines 1-45)

**Current pattern** (lines 1-45 — template for extension):
```typescript
import demoPI from '../exemplar/demos/personal-injury.demo.json';
import { loadSessionFromObject } from '../hooks/useSession';

describe('demo mode network invariant', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useInputStore.getState().reset();
    useMappingStore.getState().resetMapping();
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{}', { status: 200 }));
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('loadSessionFromObject performs zero LLM/pipeline/parse network calls', () => {
    loadSessionFromObject(demoPI);
    const calls = fetchSpy.mock.calls.map(([url]) => String(url));
    const offending = calls.filter((u) =>
      /\/api\/(pipeline|llm|parse|embedding|mapping|export|github|synthetic|pricing)\b/.test(u),
    );
    expect(offending).toEqual([]);
  });

  it('still hydrates stores correctly when fetch is stubbed', () => {
    const session = loadSessionFromObject(demoPI);
    expect(session).not.toBeNull();
    expect(useMappingStore.getState().mappingResponse).not.toBeNull();
    expect(useInputStore.getState().textInput).not.toBe('');
  });
});
```

**Parametrized extension** (add imports + it.each as each area is committed):
```typescript
// Add static imports as each area is committed:
import demoSoloCriminal from '../exemplar/demos/solo-criminal.demo.json';
// ...

// Add parametrized zero-network test:
it.each([
  ['personal-injury', demoPI],
  ['solo-criminal',   demoSoloCriminal],
  // add each area as it is committed
])('%s loadSessionFromObject performs zero LLM/pipeline/parse network calls', (slug, payload) => {
  loadSessionFromObject(payload);
  const calls = fetchSpy.mock.calls.map(([url]) => String(url));
  const offending = calls.filter((u) =>
    /\/api\/(pipeline|llm|parse|embedding|mapping|export|github|synthetic|pricing)\b/.test(u),
  );
  expect(offending).toEqual([]);
});
```

---

### `apps/web/src/__tests__/demo-mode-richness.test.ts` (new, test, batch)

**Analog:** `apps/web/src/__tests__/demo-mode-no-network.test.tsx` (structure), plus the D-03 verification one-liner from RESEARCH.md

**No existing file — new test asserting D-03.** Create after first demo.json is committed. Pattern:
```typescript
import { describe, it, expect } from 'vitest';
// Add static imports as each area is committed:
import demoPI from '../exemplar/demos/personal-injury.demo.json';
// import demoSoloCriminal from '../exemplar/demos/solo-criminal.demo.json';
// ...

// Type narrowing helper — demo JSONs have total_nodes and completed at top level:
function getRichness(payload: Record<string, unknown>) {
  const total = payload['total_nodes'] as number;
  const completed = payload['completed'] as number;
  return { total, completed, ratio: completed / total };
}

describe('demo mode richness (D-03)', () => {
  it.each([
    ['personal-injury', demoPI],
    // ['solo-criminal', demoSoloCriminal],  // uncomment as each area is committed
  ])('%s demo has 0 < completed < total_nodes (visible mix)', (_slug, payload) => {
    const { total, completed } = getRichness(payload as Record<string, unknown>);
    expect(completed).toBeGreaterThan(0);
    expect(completed).toBeLessThan(total);
  });
});
```

**Note on PI:** The shipped PI demo has `completed === total_nodes` (all-accepted at threshold 0.30). The D-03 test will FAIL for PI until it is re-curated with `--provider anthropic --threshold 0.85` per D-04. The test should be written accepting this — either skip PI in the it.each until re-curated, or set the PI entry as `todo`.

---

## Shared Patterns

### Curation Command Template
**Apply to:** All 9 areas (Wave B step)
```bash
# Prerequisites: pnpm dev:api running on port 58000, ANTHROPIC_API_KEY exported
backend/.venv/bin/python scripts/curate_demos.py \
    --area {slug} \
    --provider anthropic \
    --threshold 0.85 \
    --backend http://127.0.0.1:58000
# Inspect stderr: "Auto-mapped: X  (unmapped: Y)"
# Target: X/(X+Y) in 0.55-0.80 range.
# Too high (all accepted): increase threshold toward 0.92
# Too low (all pending):   decrease threshold toward 0.75
```

### Probe Command Template
**Apply to:** All 9 areas (Wave A step)
```bash
backend/.venv/bin/python scripts/demos/run_probe.py --area {slug}
# Reads: scripts/demos/{slug}-probe-items.json
# Writes: scripts/demos/{slug}-probe-candidates.json
# Inspect output: look for items with high_score_relevant >= 4 in thematically-coherent FOLIO branches
```

### Per-Area Test Gate
**Apply to:** Each area before commit (Wave C step)
```bash
pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-roundtrip.test.tsx
pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-no-network.test.tsx
pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-richness.test.ts
```

### Provider/Model Verification
**Apply to:** Each produced demo.json before registering in index.ts
```bash
python3 -c "import json; d=json.load(open('apps/web/src/exemplar/demos/{slug}.demo.json')); print(d['provider'], d['model'])"
# Must print: anthropic claude-3-5-sonnet-latest
# If null null: the curation used --no-llm — re-run with --provider anthropic
```

---

## No Analog Found

All files in this phase have direct analogs. No entries in this section.

---

## Key Ordering Constraint

The index.ts migration (lazy getDemoPayload) and App.tsx `await` addition MUST land in the same commit before any of the 9 new demo.json files are registered. Registering a slug in index.ts without the lazy-load infrastructure triggers a static import that inflates the bundle. The correct commit sequence:

1. **Commit 1:** `index.ts` migration + `App.tsx` line 554 `await` addition (no new demo JSONs yet; DEMO_AVAILABLE_SLUGS lists all 10 slugs but LAZY_LOADERS returns null for unproduced files — safe, falls through to lean mode).
2. **Commits 2–10:** Per-area: `scripts/demos/{slug}.input.json` + `apps/web/src/exemplar/demos/{slug}.demo.json` + LAZY_LOADERS entry active (already wired in commit 1) + test extension.

---

## Metadata

**Analog search scope:** `apps/web/src/exemplar/`, `scripts/demos/`, `apps/web/src/__tests__/`, `.planning/spikes/001-demo-pi-curation/`
**Files scanned:** 9 (index.ts, personal-injury.input.json, personal-injury.demo.json, App.tsx, demo-mode-roundtrip.test.tsx, demo-mode-no-network.test.tsx, index.test.ts, run_coverage_probe.py, items.json, data.ts)
**Pattern extraction date:** 2026-05-24
