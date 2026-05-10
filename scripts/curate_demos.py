"""Offline curation pipeline for FOLIO Mapper demo payloads (Phase 02).

Drives the live backend `/api/pipeline/map` endpoint with a per-practice-area
input file, captures the response as a SessionFile-shaped JSON, snapshots
pipeline_version + folio_version, and writes the result to
`apps/web/src/exemplar/demos/{slug}.demo.json`.

Operator workflow:
    pnpm dev:api                                                          # one terminal
    export ANTHROPIC_API_KEY=sk-ant-...
    backend/.venv/bin/python scripts/curate_demos.py \\
        --area personal-injury --provider anthropic
    git add apps/web/src/exemplar/demos/personal-injury.demo.json && git commit

The script is a developer-only build-time tool. It runs against a localhost
backend with the operator's own LLM API key. The key is read from the
environment, never logged, and never written to disk. The produced JSON
omits any `api_key` field by construction (see _build_session_file()).
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
from typing import Any

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Run from backend/.venv/bin/python.", file=sys.stderr)
    sys.exit(2)


# --- Constants -------------------------------------------------------------

SESSION_VERSION = "1.3"  # MUST mirror packages/core/src/session/index.ts SESSION_VERSION

PROVIDER_ENV_VARS = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google": "GOOGLE_API_KEY",
}

DEFAULT_MODELS = {
    "anthropic": "claude-3-5-sonnet-latest",
    "openai": "gpt-4o",
    "google": "gemini-1.5-pro-latest",
}

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
DESKTOP_PACKAGE_JSON = REPO_ROOT / "apps" / "desktop" / "package.json"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "apps" / "web" / "src" / "exemplar" / "demos"


# --- Version snapshot helpers ---------------------------------------------

def _git_short_sha() -> str | None:
    try:
        out = subprocess.check_output(
            ["git", "-C", str(REPO_ROOT), "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
        )
        return out.decode().strip() or None
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def _pipeline_version() -> str:
    """Combine apps/desktop/package.json version with current git short SHA."""
    try:
        pkg = json.loads(DESKTOP_PACKAGE_JSON.read_text())
        pkg_version = pkg.get("version", "unknown")
    except (FileNotFoundError, json.JSONDecodeError):
        pkg_version = "unknown"
    sha = _git_short_sha()
    return f"{pkg_version}+{sha}" if sha else pkg_version


def _folio_version() -> str:
    """Best-effort FOLIO ontology version snapshot.

    Order: folio.__version__ → folio-python pip metadata → 'unknown'.
    """
    try:
        import folio  # type: ignore
        v = getattr(folio, "__version__", None)
        if v:
            return str(v)
    except ImportError:
        pass
    try:
        from importlib.metadata import version
        return version("folio-python")
    except Exception:
        return "unknown"


# --- Backend transport -----------------------------------------------------

def _auth_headers(api_key: str) -> dict[str, str]:
    """Headers for backend requests.

    LLM API key flows via `Authorization: Bearer` (see backend/app/services/auth.py).
    Local auth token is required only when FOLIO_MAPPER_LOCAL_TOKEN is set in the
    backend's environment; in dev mode (the typical curation context) it is unset
    and auth is disabled automatically.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    local_token = os.environ.get("FOLIO_MAPPER_LOCAL_TOKEN")
    if local_token:
        headers["X-Local-Token"] = local_token
    return headers


def _parse_text(client: httpx.Client, backend: str, text: str, api_key: str) -> dict[str, Any]:
    r = client.post(
        f"{backend}/api/parse/text",
        headers=_auth_headers(api_key),
        json={"text": text},
        timeout=60.0,
    )
    if r.status_code >= 300:
        raise RuntimeError(f"/api/parse/text returned {r.status_code}: {r.text[:500]}")
    return r.json()


def _run_pipeline(
    client: httpx.Client,
    backend: str,
    items: list[dict[str, Any]],
    provider: str,
    model: str,
    api_key: str,
    threshold: float,
    max_per_branch: int,
) -> dict[str, Any]:
    body = {
        "items": items,
        "llm_config": {
            "provider": provider,
            "model": model,
            "base_url": None,
        },
        "threshold": threshold,
        "max_per_branch": max_per_branch,
        "mandatory_branches": [],
    }
    r = client.post(
        f"{backend}/api/pipeline/map",
        headers=_auth_headers(api_key),
        json=body,
        timeout=600.0,
    )
    if r.status_code >= 300:
        raise RuntimeError(f"/api/pipeline/map returned {r.status_code}: {r.text[:500]}")
    return r.json()


def _run_symbolic_mapping(
    client: httpx.Client,
    backend: str,
    items: list[dict[str, Any]],
    threshold: float,
    max_per_branch: int,
    api_key: str | None,
) -> dict[str, Any]:
    """Hit /api/mapping/candidates (keyword + embedding + spaCy, no LLM stages).

    Returns a dict shaped as `{"mapping": MappingResponse, "pipeline_metadata": None}`
    so the downstream session-builder can reuse the same code path.
    """
    body = {
        "items": items,
        "threshold": threshold,
        "max_per_branch": max_per_branch,
        "mandatory_branches": [],
        "llm_config": None,
    }
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    local_token = os.environ.get("FOLIO_MAPPER_LOCAL_TOKEN")
    if local_token:
        headers["X-Local-Token"] = local_token
    r = client.post(
        f"{backend}/api/mapping/candidates",
        headers=headers,
        json=body,
        timeout=120.0,
    )
    if r.status_code >= 300:
        raise RuntimeError(f"/api/mapping/candidates returned {r.status_code}: {r.text[:500]}")
    return {"mapping": r.json(), "pipeline_metadata": None}


# --- SessionFile construction ---------------------------------------------

def _build_session_file(
    input_doc: dict[str, Any],
    parse_result: dict[str, Any],
    pipeline_response: dict[str, Any],
    provider: str | None,
    model: str | None,
    threshold: float,
) -> dict[str, Any]:
    """Construct a SessionFile-shaped dict + snapshot fields.

    The resulting dict is structurally compatible with validateSession() in
    packages/core/src/session/index.ts (validation is shape-based and ignores
    unknown keys, so the pipeline_version / folio_version snapshot fields are safe).
    Crucially, no api_key field is ever included.
    """
    mapping = pipeline_response.get("mapping", {})
    pipeline_metadata = pipeline_response.get("pipeline_metadata")
    item_results = mapping.get("items", [])

    # Auto-accept the top-scored candidate per item iff score ≥ threshold * 100.
    # MappingResponse has items[].branch_groups[].candidates[]; the "top" candidate is
    # the highest-scoring across all branch groups for that item.
    selections: dict[int, list[str]] = {}
    node_statuses: dict[int, str] = {}
    for idx, item_result in enumerate(item_results):
        all_candidates = [
            c
            for bg in (item_result.get("branch_groups") or [])
            for c in (bg.get("candidates") or [])
        ]
        all_candidates.sort(key=lambda c: c.get("score", 0), reverse=True)
        if all_candidates and all_candidates[0].get("score", 0) >= threshold * 100:
            selections[idx] = [all_candidates[0]["iri_hash"]]
            node_statuses[idx] = "completed"
        else:
            selections[idx] = []
            node_statuses[idx] = "unmapped"

    now = dt.datetime.now(dt.timezone.utc).isoformat()
    items = parse_result.get("items", [])
    completed = sum(1 for s in node_statuses.values() if s == "completed")

    session: dict[str, Any] = {
        # SessionFile schema (packages/core/src/session/index.ts) ---------------
        "version": SESSION_VERSION,
        "created": now,
        "updated": now,
        "source_file": None,
        "input_format": parse_result.get("format"),
        "total_nodes": len(items),
        "completed": completed,
        "skipped": 0,
        "current_position": 0,
        "provider": provider,
        "model": model,
        "text_input": input_doc["text"],
        "parse_result": parse_result,
        "mapping_response": mapping,
        "pipeline_metadata": pipeline_metadata,
        "selections": {str(k): v for k, v in selections.items()},
        "node_statuses": {str(k): v for k, v in node_statuses.items()},
        "notes": {},
        "screen": "mapping",
        "branch_states": {},
        "input_branch_states": {},
        "branch_sort_mode": "default",
        "custom_branch_order": [],
        "status_filter": "all",
        "suggestion_queue": [],
        "review_queue": [],
        # Non-schema snapshot fields ------------------------------------------
        "pipeline_version": _pipeline_version(),
        "folio_version": _folio_version(),
    }

    # Defensive: make damn sure no api_key leaked in from anywhere.
    leaked_candidate = any(
        "api_key" in (c or {})
        for item in item_results
        for bg in (item.get("branch_groups") or [])
        for c in (bg.get("candidates") or [])
    )
    if "api_key" in session or leaked_candidate:
        raise RuntimeError("api_key field detected in session output; refusing to write")
    return session


# --- Reporting -------------------------------------------------------------

def _fanout_histogram(mapping: dict[str, Any]) -> dict[str, int]:
    buckets = collections.Counter()
    for item in mapping.get("items", []):
        n = sum(
            len(bg.get("candidates") or [])
            for bg in (item.get("branch_groups") or [])
        )
        if n == 0:
            buckets["0"] += 1
        elif n == 1:
            buckets["1"] += 1
        elif n <= 3:
            buckets["2-3"] += 1
        else:
            buckets["4+"] += 1
    return dict(buckets)


# --- CLI -------------------------------------------------------------------

def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="curate_demos.py",
        description=(
            "Curate a FOLIO Mapper demo session payload (e.g. personal-injury) "
            "by driving the live backend pipeline endpoint with an operator-supplied "
            "LLM API key. Writes apps/web/src/exemplar/demos/{slug}.demo.json."
        ),
        epilog=(
            "Example: backend/.venv/bin/python scripts/curate_demos.py "
            "--area personal-injury --provider anthropic"
        ),
    )
    p.add_argument(
        "--area",
        required=True,
        help="Practice-area slug (e.g. 'personal-injury'); resolves scripts/demos/{area}.input.json",
    )
    p.add_argument(
        "--provider",
        choices=sorted(PROVIDER_ENV_VARS.keys()),
        default=None,
        help="LLM provider; selects the API key env var (e.g. ANTHROPIC_API_KEY). Required unless --no-llm.",
    )
    p.add_argument("--model", default=None, help="Override the default model for this provider")
    p.add_argument(
        "--no-llm",
        action="store_true",
        help=(
            "Skip the LLM pipeline (Stages 0/2/3) and curate via the symbolic "
            "/api/mapping/candidates endpoint instead. No API key required. "
            "Results include keyword + embedding + spaCy candidates; "
            "pipeline_metadata in the output is null."
        ),
    )
    p.add_argument("--backend", default="http://127.0.0.1:58000", help="Backend base URL")
    p.add_argument("--threshold", type=float, default=0.3, help="Pipeline score threshold (0-1)")
    p.add_argument("--max-per-branch", type=int, default=10, help="Max candidates per FOLIO branch")
    p.add_argument(
        "--output-dir",
        type=pathlib.Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for the produced {slug}.demo.json",
    )
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = _parse_args(argv)

    # Locate and read input
    input_path = REPO_ROOT / "scripts" / "demos" / f"{args.area}.input.json"
    if not input_path.exists():
        print(f"ERROR: input file not found: {input_path}", file=sys.stderr)
        print(
            "Create one following scripts/demos/personal-injury.input.json as a template.",
            file=sys.stderr,
        )
        return 2

    try:
        input_doc = json.loads(input_path.read_text())
    except json.JSONDecodeError as e:
        print(f"ERROR: input file is not valid JSON: {e}", file=sys.stderr)
        return 2

    # Resolve provider / API key
    if args.no_llm:
        provider_label = "symbolic"
        model_label = "no-llm (mapping/candidates)"
        api_key: str | None = None
    else:
        if not args.provider:
            print("ERROR: --provider is required unless --no-llm is set.", file=sys.stderr)
            return 2
        env_var = PROVIDER_ENV_VARS[args.provider]
        api_key = os.environ.get(env_var, "").strip() or None
        if not api_key:
            print(
                f"ERROR: missing {env_var}. Export it before running. "
                f"For other providers, use --provider {{openai,google}} or pass --no-llm.",
                file=sys.stderr,
            )
            return 2
        provider_label = args.provider
        model_label = args.model or DEFAULT_MODELS[args.provider]

    output_path = args.output_dir / f"{args.area}.demo.json"
    args.output_dir.mkdir(parents=True, exist_ok=True)

    print(f"→ Curating '{args.area}' via {provider_label}/{model_label}", file=sys.stderr)
    print(f"  Backend:    {args.backend}", file=sys.stderr)
    print(f"  Threshold:  {args.threshold}  Max/branch: {args.max_per_branch}", file=sys.stderr)

    try:
        with httpx.Client() as client:
            # /api/parse/text doesn't require auth, but pass the bearer if we have one.
            parse_result = _parse_text(
                client, args.backend, input_doc["text"], api_key or "no-llm"
            )
            items = parse_result.get("items", [])
            if not items:
                print("ERROR: backend /api/parse/text returned no items", file=sys.stderr)
                return 1

            if args.no_llm:
                pipeline_response = _run_symbolic_mapping(
                    client,
                    args.backend,
                    items,
                    args.threshold,
                    args.max_per_branch,
                    api_key,
                )
            else:
                pipeline_response = _run_pipeline(
                    client,
                    args.backend,
                    items,
                    args.provider,
                    model_label,
                    api_key or "",
                    args.threshold,
                    args.max_per_branch,
                )
    except httpx.HTTPError as e:
        print(f"ERROR: backend request failed: {e}", file=sys.stderr)
        return 1
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    session = _build_session_file(
        input_doc=input_doc,
        parse_result=parse_result,
        pipeline_response=pipeline_response,
        provider=None if args.no_llm else args.provider,
        model=None if args.no_llm else model_label,
        threshold=args.threshold,
    )

    # Write pretty-printed JSON (no partial writes)
    tmp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(session, indent=2, ensure_ascii=False) + "\n")
    tmp_path.replace(output_path)

    # Summary
    mapping = pipeline_response.get("mapping", {})
    completed = session["completed"]
    total = session["total_nodes"]
    histogram = _fanout_histogram(mapping)
    print("", file=sys.stderr)
    print(f"✓ Wrote {output_path.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"  Items:            {total}", file=sys.stderr)
    print(f"  Auto-mapped:      {completed}  (unmapped: {total - completed})", file=sys.stderr)
    print(f"  Fan-out:          {histogram}", file=sys.stderr)
    print(f"  pipeline_version: {session['pipeline_version']}", file=sys.stderr)
    print(f"  folio_version:    {session['folio_version']}", file=sys.stderr)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv[1:]))
