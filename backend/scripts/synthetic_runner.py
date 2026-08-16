#!/usr/bin/env python3
"""Run deterministic FOLIO pipeline seams over precomputed segments."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any, Sequence

sys.dont_write_bytecode = True
BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.models.pipeline_models import PreScanResult, PreScanSegment, RankedCandidate, ScopedCandidate
from app.services.embedding.service import get_embedding_index
from app.services.folio_service import get_folio
from app.services.pipeline.orchestrator import _embedding_rerank
from app.services.pipeline.stage1_filter import run_stage1

THRESHOLD = 0.3
MAX_PER_BRANCH = 10
RERANK_TOP_K = 20
COMMIT_TOP_N = 10
LLM_PROVIDER_ENV_VARS = (
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "MISTRAL_API_KEY",
    "COHERE_API_KEY", "META_LLAMA_API_KEY", "GROQ_API_KEY", "XAI_API_KEY",
    "GITHUB_MODELS_API_KEY",
)


def _package_version(distribution: str, module_name: str) -> str:
    try:
        return version(distribution)
    except PackageNotFoundError:
        try:
            value = getattr(__import__(module_name), "__version__", None)
            return str(value) if value else "unknown"
        except ImportError:
            return "unknown"


def _read_items(path: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as stream:
        for line_number, raw in enumerate(stream, 1):
            if not raw.strip():
                continue
            try:
                item = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise ValueError(f"line {line_number}: invalid JSON: {exc.msg}") from exc
            if not isinstance(item, dict):
                raise ValueError(f"line {line_number}: item must be an object")
            if not isinstance(item.get("item_id"), str):
                raise ValueError(f"line {line_number}: item_id must be a string")
            if not isinstance(item.get("text"), str):
                raise ValueError(f"line {line_number}: text must be a string")
            segments = item.get("segments")
            if not isinstance(segments, list) or not segments or any(
                not isinstance(segment, str) or not segment.strip() for segment in segments
            ):
                raise ValueError(f"line {line_number}: segments must be a non-empty list of strings")
            items.append(item)
    return items


def _run_item(
    item: dict[str, Any], folio: object, embedding_available: bool,
) -> tuple[dict[str, Any], bool]:
    stage1_best: dict[str, ScopedCandidate] = {}
    reranked_best: dict[str, RankedCandidate] = {}
    rerank_failed = False
    for segment_text in item["segments"]:
        prescan = PreScanResult(
            segments=[PreScanSegment(text=segment_text, branches=[], reasoning="precomputed")],
            raw_text=segment_text,
        )
        candidates = run_stage1(
            folio, prescan, threshold=THRESHOLD, max_per_branch=MAX_PER_BRANCH,
            mandatory_branches=None,
        )
        for candidate in candidates:
            previous = stage1_best.get(candidate.iri_hash)
            if previous is None or candidate.score > previous.score:
                stage1_best[candidate.iri_hash] = candidate
        if embedding_available:
            segment_ranked = _embedding_rerank(segment_text, candidates, top_k=RERANK_TOP_K)
            if candidates and all(row.reasoning == "local score" for row in segment_ranked):
                rerank_failed = True
            for ranked in segment_ranked:
                previous_ranked = reranked_best.get(ranked.iri_hash)
                if previous_ranked is None or ranked.score > previous_ranked.score:
                    reranked_best[ranked.iri_hash] = ranked

    stage1 = sorted(stage1_best.values(), key=lambda row: (-row.score, row.iri_hash))
    if embedding_available:
        reranked = sorted(reranked_best.values(), key=lambda row: (-row.score, row.iri_hash))
        embedding_snapshot = [row.iri_hash for row in reranked]
        committed = embedding_snapshot[:COMMIT_TOP_N]
    else:
        embedding_snapshot = []
        committed = [row.iri_hash for row in stage1[:COMMIT_TOP_N]]
    return {
        "item_id": item["item_id"],
        "iris": sorted(set(committed)),
        "stages": {
            "stage1_filter": [row.iri_hash for row in stage1],
            "embedding_rerank": embedding_snapshot,
            "committed": committed,
        },
    }, rerank_failed


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--items", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--lane", choices=("deterministic",), default="deterministic")
    parser.add_argument("--llm-on", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.llm_on and not any(os.environ.get(name) for name in LLM_PROVIDER_ENV_VARS):
            raise ValueError("--llm-on requires a configured provider environment variable")
        items = _read_items(args.items)
        folio = get_folio()
        try:
            embedding_available = get_embedding_index() is not None
        except Exception:
            embedding_available = False
        item_results = [_run_item(item, folio, embedding_available) for item in items]
        if any(failed for _, failed in item_results):
            embedding_available = False
            item_results = [_run_item(item, folio, False) for item in items]
        records = [{
            "kind": "synthetic-stack-run",
            "stack": "folio-mapper",
            "lane": args.lane,
            "folio_resolve_version": _package_version("folio-resolve", "folio_resolve"),
            "folio_python_version": _package_version("folio-python", "folio"),
            "config": {
                "threshold": THRESHOLD,
                "max_per_branch": MAX_PER_BRANCH,
                "rerank_top_k": RERANK_TOP_K,
                "commit_top_n": COMMIT_TOP_N,
                "keyword_weight": 0.6,
                "embedding_weight": 0.4,
                "embedding_rerank": "available" if embedding_available else "unavailable",
                "llm_on": args.llm_on,
            },
        }]
        records.extend(record for record, _ in item_results)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=args.out.parent, delete=False) as temp:
            temp_path = Path(temp.name)
            for record in records:
                temp.write(json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n")
        temp_path.replace(args.out)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    if os.environ.get("PYTHONHASHSEED") != "0":
        os.environ["PYTHONHASHSEED"] = "0"
        os.execv(sys.executable, [sys.executable, *sys.argv])
    raise SystemExit(main())
