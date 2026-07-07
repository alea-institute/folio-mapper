# Phase 5: Regulatory Exemplars — Context

**Gathered:** 2026-07-07
**Status:** Executed (context + plan recorded alongside execution per TODAY-mode autonomy)

<domain>
## Phase Boundary

Author **3–4 net-new regulatory/compliance lean exemplars**, selected by a
deterministic FOLIO coverage probe, each at 100% leaf hit rate, appearing in the
"Try an Exemplar" carousel alongside the existing 10.

**In scope:** A deterministic density survey over FOLIO's Area of Law tree; the
area-selection decision (with documented exclusions); the exemplar entries in
`packages/core/src/exemplar/data.ts`; a reusable 100%-hit-rate validation gate.

**Out of scope:** Demo payloads for the new exemplars (Phase 6). Demo-mode
architecture (locked in Phase 2). Any change to the existing 10 exemplars.

**This phase targets PURE regulatory/compliance practice** — transactional
deal-work (M&A, Real Estate, Banking, IP) is already covered by v1.0 exemplars
(STATE decision).
</domain>

<decisions>
## Implementation Decisions

### Deterministic density probe (REG-01)
- Survey uses **folio-python only** (LLM-free, near-zero cost) per the portfolio
  gestalt/deterministic-first policy — `scripts/demos/regulatory_density_survey.py`.
- Two gating signals per candidate area: **branch density** (recursive descendant
  count of the FOLIO Area-of-Law root branch) and **definition coverage**, plus a
  **10-leaf exact-hit feasibility** check (can the area field 10 precise, unique
  FOLIO leaf labels?).
- The exact-hit feasibility count is the hard gate: an area that cannot field 10
  clean leaves is DROPPED, not forced to "best-available" matches.

### Area selection (REG-02) — 4 SELECTED
Balancing **density** and **diversity** (four distinct regulatory domains, minimal
overlap with the existing 10):
1. **Environmental Compliance** (`environmental-compliance`) — densest branch
   (12 descendants, 100% def), 10/10 exact leaves. Natural-resources domain.
2. **Energy & Utilities** (`energy-utilities`) — 10/10 exact leaves (renewable +
   conventional + utilities-industry concepts). Energy/utilities domain.
3. **Securities Regulation** (`securities-regulation`) — dense (10 descendants),
   10/10 exact leaves. Financial-markets regulatory domain. Framed around
   enforcement/market-regulation (Securities Fraud, Insider Trading, Exchanges,
   Investment Advisers) to differentiate from the deal-work in Banking & Finance /
   Corporate M&A. **Overlap flagged** — see QA queue.
4. **Data Privacy & Cybersecurity** (`data-privacy`) — 10/10 exact leaves sourced
   across FOLIO (Information Security, Privacy, Consumer, Records). Tech-regulatory
   domain; branch density understates it (leaves are distributed, not concentrated).

### Exclusions (documented density gate)
- **Tax & Revenue** — only 5/10 exact leaves (FOLIO's tax branch is thin at the
  leaf level: Tax Law, Tax Credits Law, Estates/Gifts/Trusts, Non-Profit/Tax-Exempt,
  ESOP; Income/Property/Sales/International/Corporate Tax have no precise FOLIO node).
- **Healthcare / health-privacy** — 3/10 exact leaves, branch density 0 (Health Law,
  Food and Drug Law, Public Health and Welfare Law are leaf-terminal; Medicare/
  Medicaid/Pharmaceutical/Mental-Health/Elder/Nursing-Home have no precise node).
  This is the mission's "plausible candidate" that the probe correctly gates out.

### 100% hit-rate gate (REG-03)
- Every leaf must satisfy `scripts/demos/validate_exemplar_hits.py`: exact unique
  `get_by_label` match AND top `search_by_label` result at score 100. 40/40 leaves
  pass. Branch/root lines are organizational headers (not required to hit).

### Carousel integration (REG-04)
- New exemplars flow automatically: `App.tsx` renders `exemplars={EXEMPLARS}`.
  Adding to the `EXEMPLARS` array in `data.ts` is sufficient for lean-mode
  selectability. Demo-mode functionality follows in Phase 6 (until then, demo mode
  falls through to lean for the new slugs via `getDemoPayload` returning null).
</decisions>

<canonical_refs>
## Canonical References
- `.planning/phases/04-demo-payloads-for-existing-exemplar-areas/04-CONTEXT.md` — probe-then-author method, coherence-over-richness (D-02).
- `scripts/demos/regulatory_density_survey.py` → `scripts/demos/regulatory-density-report.json` — the density evidence.
- `scripts/demos/validate_exemplar_hits.py` — the 100%-hit-rate gate.
- `packages/core/src/exemplar/data.ts` — the exemplar registry (new entries appended after `immigration`).
- `docs/evidence/phases-5-6/` — evidence pack (density rationale + exemplar critiques).
</canonical_refs>

---
*Phase: 05-regulatory-exemplars*
