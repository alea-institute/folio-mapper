"""Deterministic FOLIO density survey for v1.1 Phase 5 regulatory exemplar selection.

Walks the FOLIO Area of Law tree and, for a slate of candidate regulatory /
compliance areas, measures the two signals that gate exemplar authoring:

  1. BRANCH DENSITY  — recursive descendant count of the area's root branch
     (how many sub-concepts exist to draw leaves from).
  2. DEFINITION COVERAGE — share of subtree concepts carrying a real definition
     (thin, undefined regions make poor precise exemplars).

It also runs an exact-hit feasibility check on a proposed 10-leaf slate per
candidate: how many of the intended leaf labels resolve to a precise, unique
FOLIO concept (the 100%-hit-rate authoring gate). Areas that cannot field 10
clean leaves are recommended DROP.

LLM-free, deterministic, near-zero cost (folio-python only). Reproduces the
evidence behind the Phase 5 area selection recorded in
docs/evidence/phases-5-6/.

Run from project root via the backend venv:
    backend/.venv/bin/python scripts/demos/regulatory_density_survey.py
Writes: scripts/demos/regulatory-density-report.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent

# Candidate regulatory/compliance areas with their FOLIO root-branch label and a
# proposed 10-leaf slate (exact FOLIO labels we intend to author as exemplar
# leaves). SELECTED areas ship; DROPPED areas are documented exclusions.
CANDIDATES = {
    "environmental-compliance": {
        "root_branch": "Environmental and Natural Resource Law",
        "decision": "SELECT",
        "leaves": [
            "Air Quality Law", "Water Quality Law", "Contaminant Cleanup Law",
            "Waste Management Law", "Chemical Safety Law", "Mineral Resources Law",
            "Water Resources and Wetlands Law", "Wildlife and Plants Law",
            "Environmental, Social, and Governance Law", "Impact Assessment Law",
        ],
    },
    "energy-utilities": {
        "root_branch": "Energy Law",
        "decision": "SELECT",
        "leaves": [
            "Solar Energy Law", "Wind Power Law", "Hydroelectric Energy Law",
            "Nuclear Law", "Oil and Gas Law", "Oil and Gas Extraction Industry",
            "Nuclear Electric Power Generation", "Fossil Fuel Electric Power Generation",
            "Energy Sales and Transmission Law", "Project Finance Law",
        ],
    },
    "securities-regulation": {
        "root_branch": "Securities and Financial Instruments Law",
        "decision": "SELECT",
        "leaves": [
            "Investment Advisor Law", "Exchanges Law", "Commodities Law",
            "Insider Trading", "Securities Fraud", "Regulatory Enforcement",
            "Financial Reporting Law", "Security Offerings and Capital Markets Law",
            "Business and Financial Crimes Law", "Anti-Corruption Law",
        ],
    },
    "data-privacy": {
        "root_branch": "Information Security Law",
        "decision": "SELECT",
        "leaves": [
            "Cybersecurity Law", "Cybercrime Law", "Data Breach",
            "Impersonation / Identity Theft", "Privacy Law", "Data Protection Regulation",
            "Consumer Protection Law", "Telecommunications Law",
            "Government Access and Disclosure Law", "Freedom of Information Act Claim",
        ],
    },
    # --- Probed and DROPPED (documented exclusions) ---
    "tax-compliance": {
        "root_branch": "Tax and Revenue Law",
        "decision": "DROP",
        "leaves": [
            "Tax Law", "Tax Credits Law", "Estates, Gifts, and Trusts Law",
            "Non-Profit and Tax-Exempt Organizations Law",
            "Employee Stock Ownership Plans Law", "Income Tax Law", "Property Tax Law",
            "Sales Tax Law", "International Tax Law", "Corporate Tax Law",
        ],
    },
    "healthcare-regulatory": {
        "root_branch": "Health Law",
        "decision": "DROP",
        "leaves": [
            "Health Law", "Food and Drug Law", "Public Health and Welfare Law",
            "Pharmaceutical Law", "Medicare Law", "Medicaid Law",
            "Health Insurance Law", "Mental Health Law", "Elder Law", "Nursing Home Law",
        ],
    },
}


def main() -> int:
    print("Loading FOLIO ontology...", file=sys.stderr)
    from folio import FOLIO  # type: ignore[import-not-found]

    folio = FOLIO()

    def get_exact(label):
        try:
            res = folio.get_by_label(label)
        except Exception:  # noqa: BLE001
            return None
        if not res:
            return None
        nodes = res if isinstance(res, list) else [res]
        return nodes

    def subtree(iri, seen=None):
        if seen is None:
            seen = set()
        if iri in seen:
            return seen
        seen.add(iri)
        for ch in folio.get_children(iri):
            ci = getattr(ch, "iri", None)
            if ci:
                subtree(ci, seen)
        return seen

    report = {"candidates": {}}
    for slug, spec in CANDIDATES.items():
        root_nodes = get_exact(spec["root_branch"])
        density = def_cov = None
        if root_nodes and len(root_nodes) == 1:
            root = root_nodes[0]
            st = subtree(root.iri) - {root.iri}
            defined = total = 0
            for si in st:
                try:
                    node = folio[si]
                except Exception:  # noqa: BLE001
                    continue
                total += 1
                d = getattr(node, "definition", None)
                if d and d.strip():
                    defined += 1
            density = len(st)
            def_cov = round(defined / total * 100, 1) if total else 0.0

        # Exact-hit feasibility over the proposed leaf slate.
        exact_hits = 0
        leaf_status = {}
        for leaf in spec["leaves"]:
            nodes = get_exact(leaf)
            if nodes and len(nodes) == 1 and \
               (getattr(nodes[0], "label", "") or "").lower() == leaf.lower():
                exact_hits += 1
                leaf_status[leaf] = "exact"
            elif nodes and len(nodes) > 1:
                leaf_status[leaf] = f"ambiguous({len(nodes)})"
            else:
                leaf_status[leaf] = "miss"

        report["candidates"][slug] = {
            "root_branch": spec["root_branch"],
            "decision": spec["decision"],
            "branch_density_descendants": density,
            "definition_coverage_pct": def_cov,
            "exact_leaf_hits": f"{exact_hits}/{len(spec['leaves'])}",
            "leaf_status": leaf_status,
        }
        print(
            f"{slug:24s} [{spec['decision']:6s}] density={density} "
            f"def%={def_cov} exact_leaves={exact_hits}/{len(spec['leaves'])}",
            file=sys.stderr,
        )

    out = SCRIPT_DIR / "regulatory-density-report.json"
    out.write_text(json.dumps(report, indent=2))
    print(f"\nWrote {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
