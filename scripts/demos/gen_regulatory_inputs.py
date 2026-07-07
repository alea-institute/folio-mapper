"""Generate {slug}.input.json for the v1.1 Phase 6 regulatory demo curation.

Each input's `text` is the lean exemplar hierarchy (verbatim from data.ts) PLUS
2 coherent enrichment leaves inserted under a thematic branch, to add high
fan-out "wow" beats to the curated demo (Phase 4 D-01 pattern). All enrichment
labels are exact FOLIO concepts. curate_demos.py reads only `text`.

Run: backend/.venv/bin/python scripts/demos/gen_regulatory_inputs.py
"""

from __future__ import annotations

import json
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent

# structure: root -> [(branch, [leaves...]) ...]; enrichment leaves are marked
# by membership in ENRICH so they're recorded in enrichments[].
AREAS = {
    "environmental-compliance": {
        "label": "Environmental Compliance",
        "root": "Environmental Compliance",
        "branches": [
            ("Air & Water Quality", ["Air Quality Law", "Water Quality Law"]),
            ("Contamination & Cleanup", ["Contaminant Cleanup Law", "Waste Management Law",
                                         "Forest Resources Law"]),
            ("Chemicals & Resources", ["Chemical Safety Law", "Mineral Resources Law"]),
            ("Water & Wildlife", ["Water Resources and Wetlands Law", "Wildlife and Plants Law",
                                  "Fish and Game Law"]),
            ("Sustainability & Review", ["Environmental, Social, and Governance Law",
                                         "Impact Assessment Law"]),
        ],
        "enrichments": ["Forest Resources Law", "Fish and Game Law"],
    },
    "energy-utilities": {
        "label": "Energy & Utilities",
        "root": "Energy & Utilities",
        "branches": [
            ("Renewable Energy", ["Solar Energy Law", "Wind Power Law"]),
            ("Hydropower & Nuclear", ["Hydroelectric Energy Law", "Nuclear Law"]),
            ("Oil & Gas", ["Oil and Gas Law", "Oil and Gas Extraction Industry"]),
            ("Power Generation", ["Nuclear Electric Power Generation",
                                  "Fossil Fuel Electric Power Generation",
                                  "Hydroelectric Power Generation"]),
            ("Transmission & Finance", ["Energy Sales and Transmission Law", "Project Finance Law",
                                        "Utilities Industry"]),
        ],
        "enrichments": ["Hydroelectric Power Generation", "Utilities Industry"],
    },
    "securities-regulation": {
        "label": "Securities Enforcement",
        "root": "Securities Regulation & Enforcement",
        "branches": [
            ("Market Participants", ["Investment Advisor Law", "Exchanges Law"]),
            ("Trading & Markets", ["Commodities Law", "Insider Trading"]),
            ("Enforcement", ["Securities Fraud", "Regulatory Enforcement", "Regulatory Compliance"]),
            ("Disclosure & Reporting", ["Financial Reporting Law",
                                        "Security Offerings and Capital Markets Law"]),
            ("Financial Crime", ["Business and Financial Crimes Law", "Anti-Corruption Law",
                                 "Bank Secrecy and Anti-Money Laundering Law"]),
        ],
        "enrichments": ["Regulatory Compliance", "Bank Secrecy and Anti-Money Laundering Law"],
    },
    "data-privacy": {
        "label": "Data Privacy & Cybersecurity",
        "root": "Data Privacy & Cybersecurity",
        "branches": [
            ("Cybersecurity", ["Cybersecurity Law", "Cybercrime Law", "Information Security Law"]),
            ("Data Breach & Identity", ["Data Breach", "Impersonation / Identity Theft"]),
            ("Privacy & Data Protection", ["Privacy Law", "Data Protection Regulation"]),
            ("Consumer & Communications", ["Consumer Protection Law", "Telecommunications Law",
                                           "Advertising Law"]),
            ("Government Access", ["Government Access and Disclosure Law",
                                   "Freedom of Information Act Claim"]),
        ],
        "enrichments": ["Information Security Law", "Advertising Law"],
    },
}


def build_text(spec) -> str:
    lines = [spec["root"]]
    for branch, leaves in spec["branches"]:
        lines.append(f"\t{branch}")
        for leaf in leaves:
            lines.append(f"\t\t{leaf}")
    return "\n".join(lines)


def main() -> int:
    for slug, spec in AREAS.items():
        payload = {
            "slug": slug,
            "label": spec["label"],
            "text": build_text(spec),
            "enrichments": spec["enrichments"],
            "source_lean_exemplar": f"packages/core/src/exemplar/data.ts#{slug}",
            "spike_reference": ".planning/spikes/001-demo-pi-curation/README.md",
        }
        out = OUT_DIR / f"{slug}.input.json"
        out.write_text(json.dumps(payload, indent=2))
        leaf_count = sum(len(lv) for _, lv in spec["branches"])
        print(f"wrote {out.name}: {leaf_count} leaves (+{len(spec['enrichments'])} enrichments)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
