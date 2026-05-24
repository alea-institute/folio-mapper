---
phase: 4
slug: demo-payloads-for-existing-exemplar-areas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @folio-mapper/web test --run src/__tests__/` |
| **Full suite command** | `pnpm test` (runs packages/* and apps/web) |
| **Estimated runtime** | ~15 seconds (frontend) |

---

## Sampling Rate

- **Per-area completion:** Run `pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-roundtrip.test.tsx` before committing each area's `demo.json`
- **After every plan wave:** Run `pnpm test` (full frontend + packages suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DEMO-01 | All 9 (+PI) demo payload files exist and are valid JSON, importable | static import | `pnpm --filter @folio-mapper/web test --run src/exemplar/demos/index.test.ts` | ⚠️ partial — covers detectStalePreset only; add per-slug import assertions | ⬜ pending |
| DEMO-02 | Clicking a demo card loads pre-computed session (mappings, candidates, judge annotations) | integration | `pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-roundtrip.test.tsx` | ⚠️ PI only — parametrize over all 10 | ⬜ pending |
| DEMO-03 | Each demo shows a visible mix: `0 < completed < total_nodes` | unit (JSON assertion) | `pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-richness.test.ts` | ❌ W0 — new test (per-area gate, fixture = the demo JSON) | ⬜ pending |
| DEMO-04 | Each demo registered in manifest; `curate_demos.py` reproducible | static import + manifest | `pnpm --filter @folio-mapper/web test --run src/exemplar/demos/` | ⚠️ partial — add slug registration assertions | ⬜ pending |
| DEMO-05 | Zero LLM API calls at runtime when a demo loads | unit (fetch spy) | `pnpm --filter @folio-mapper/web test --run src/__tests__/demo-mode-no-network.test.tsx` | ⚠️ PI only — extend to all 9 new payloads | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/__tests__/demo-mode-roundtrip.test.tsx` — parametrize over all 10 slug + payload pairs (DEMO-01, DEMO-02, DEMO-04)
- [ ] `apps/web/src/__tests__/demo-mode-no-network.test.tsx` — extend to all 9 new area payloads (DEMO-05); import each demo.json statically
- [ ] `apps/web/src/exemplar/demos/index.test.ts` — add per-slug import + manifest-registration assertions (DEMO-01, DEMO-04)

*Note: the DEMO-03 richness test (`demo-mode-richness.test.ts`) can only run AFTER each demo JSON exists (the JSON is the fixture). It is a per-area Wave C gate, not a Wave 0 stub.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-area enrichment richness "feels" coherent + impressive | DEMO-03 | Subjective demo quality; automated check only asserts the numeric mix | Operator loads each demo card, confirms a mix of auto-accepts + pending-review items and coherent fan-out |
| Demo payloads carry real LLM judge annotations | DEMO-02/03 | Requires LLM curation run with operator's API key | Operator runs `curate_demos.py --provider anthropic`; confirms `provider: anthropic` + judge annotations present in output |
| Round-trip invariant | DEMO-02 | Drag-drop load equivalence | Rename a `{slug}.demo.json` to `session.json`, load via session loader — result identical to clicking the demo card |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
