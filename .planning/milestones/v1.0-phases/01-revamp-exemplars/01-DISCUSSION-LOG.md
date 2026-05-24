# Phase 1: Revamp Exemplars - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 01-revamp-exemplars
**Areas discussed:** Term sourcing strategy, Verbatim vs. synonym ratio, Practice area selection, Validation process

---

## Term Sourcing Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Script it | Query FOLIO for each current term, swap misses for actual FOLIO labels | |
| Browse manually | Cherry-pick FOLIO labels that sound natural | |
| Hybrid | Test current terms against search, replace low-scorers | |
| LLM + folio-python | Use LLM along with folio-python to create each realistic exemplar | ✓ |

**User's choice:** Use LLM + folio-python together to generate exemplars
**Notes:** User wants to leverage both the FOLIO ontology data (for verbatim labels) and LLM capability (for natural taxonomy structure and synonym generation)

---

## Verbatim vs. Synonym Ratio

| Option | Description | Selected |
|--------|-------------|----------|
| 60% verbatim / 40% synonym | Majority FOLIO labels, minority natural synonyms | ✓ |
| Vary per exemplar | Some "easy mode" with mostly verbatim, some more challenging | |

**User's choice:** 60% verbatim FOLIO labels, 40% close synonyms
**Notes:** User confirmed 60% verbatim "looks right"

---

## Practice Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 7, revise terms | Same practice areas, better terms | |
| Keep 7 + add 3 new | Expand to 10 with high-performing areas | ✓ |
| Replace some existing | Swap weak areas for stronger ones | |

**User's choice:** Keep all 7 existing + add 3 new (Real Estate, Banking & Finance, Immigration)
**Notes:** Mix must cover big law, mid law, and solo/small practitioners. The 3 new areas were chosen by user directly (not from FOLIO coverage data).

---

## Validation Process

| Option | Description | Selected |
|--------|-------------|----------|
| folio-python script only | Automated search_by_label scoring | |
| Backend pipeline only | Manual full-pipeline testing | |
| Combination | folio-python script + manual backend testing | ✓ |

**User's choice:** Two-pronged: (1) folio-python script for pre-validation, (2) user runs through backend manually
**Notes:** User will handle the manual backend testing themselves

---

## Claude's Discretion

- Hierarchy depth and structure per exemplar
- Which specific FOLIO branches to draw from per practice area
- Synonym phrasing choices

## Deferred Ideas

None
