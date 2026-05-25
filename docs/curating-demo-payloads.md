# Curating a Demo Payload

Operator-facing workflow for regenerating `apps/web/src/exemplar/demos/{slug}.demo.json` after a material pipeline or FOLIO change.

A demo payload is a snapshot of a full FOLIO Mapper session — input text, parse result, pipeline mappings, candidates, selections, version stamps — committed to the repo so the **Demo Mode** toggle on the input screen can load it instantly with zero LLM calls at runtime.

## When to recurate

- FOLIO ontology version bumped and IRIs shifted
- Pipeline scoring logic changed (Stage 2/3 LLM behavior, threshold defaults, embedding re-rank weights)
- New practice area being added (mirror spike 001 first to validate FOLIO coverage; see `.planning/spikes/001-demo-pi-curation/README.md`)
- A user reports a stale-preset banner that you want to clear by regenerating against the current build

## Prerequisites

- Working LLM API key for one of: Anthropic, OpenAI, Google (skip this for the `--no-llm` symbolic-only path)
- `backend/.venv` set up with `folio-python` and the project's backend deps installed
- The frontend backend running locally on port 58000 (`pnpm dev:api`)

## Workflow (LLM-backed — recommended)

```bash
# Terminal A
pnpm dev:api

# Terminal B
export GOOGLE_API_KEY=...                   # or ANTHROPIC_API_KEY / OPENAI_API_KEY
backend/.venv/bin/python scripts/curate_demos.py \
  --area personal-injury \
  --provider google \
  --threshold 0.3 \                         # low → HIGH recall (many candidates/item)
  --accept-threshold 0.9                    # high → only confident items auto-accept (D-03 visible mix)
# → writes apps/web/src/exemplar/demos/personal-injury.demo.json

# --threshold and --accept-threshold are decoupled: keep --threshold low for
# recall, --accept-threshold high (~0.9) so each demo lands at 0 < completed <
# total (a mix of auto-accepted + pending-review items). Omitting
# --accept-threshold falls back to --threshold (the old all-accepted behavior).

# Sanity-check the output
jq '.version, .total_nodes, .pipeline_version, .folio_version' \
   apps/web/src/exemplar/demos/personal-injury.demo.json

# Commit
git add apps/web/src/exemplar/demos/personal-injury.demo.json
git commit -m "feat(demos): regenerate personal-injury after pipeline 0.x.y"
```

## Workflow (no-LLM — for bootstrapping or CI)

The script also supports a symbolic-only curation path that uses the keyword + embedding + spaCy search via `/api/mapping/candidates` without any LLM ranking. Useful when:

- You don't have an API key handy
- You want a deterministic baseline payload
- You're running in CI and can't spend tokens

```bash
# Terminal A
pnpm dev:api

# Terminal B (no API key required)
backend/.venv/bin/python scripts/curate_demos.py \
  --area personal-injury \
  --no-llm
```

## Adding a new practice area

1. **Coverage probe.** Copy `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py` and adapt the items list. Goal: confirm each prospective enrichment item has ≥4 high-confidence FOLIO matches across diverse branches.
2. **Author the input file.** Create `scripts/demos/{slug}.input.json` with the lean exemplar text + 2–3 enrichment items inserted into their thematic branches.
3. **Register the slug.** Add the slug to `apps/web/src/exemplar/demos/index.ts` `DEMO_PAYLOADS` map (mirror the existing `personal-injury` entry).
4. **Run the curation script** (see workflows above).
5. **Run the test suite** to confirm round-trip + no-network invariants still pass:
   ```bash
   cd apps/web && pnpm vitest run
   ```
6. **Commit** the generated JSON, the input file, and the manifest change in one logical commit.

## What NOT to commit

- **LLM API keys.** The script never embeds them, but verify before committing:
  ```bash
  grep -E "(sk-|api_key.*[a-zA-Z0-9]{20,})" apps/web/src/exemplar/demos/{slug}.demo.json
  ```
- **PII or client matter content.** Every demo payload ships to every user; treat it as public.
- **Backend or curation logs** that may contain prompts or responses.

## How Demo Mode consumes the payload at runtime

1. User toggles the **Demo** button on the input screen.
2. Clicking a card whose slug appears in `DEMO_PAYLOADS` triggers `getDemoPayload(slug)`.
3. The payload passes through `validateSession()` (the same gate used for drag-drop session files).
4. `loadSessionFromObject()` hydrates the input + mapping stores — purely synchronous, no network calls.
5. App compares the payload's `pipeline_version` / `folio_version` against the running build. Mismatch → dismissible amber banner ("Demo preset may be slightly stale"). Banner is non-blocking.
6. The mapping screen appears with the exact state the curator saw at generation time.

## See also

- `.planning/phases/02-demo-mode/` — phase plans + context
- `.planning/spikes/001-demo-pi-curation/README.md` — feasibility findings + enrichment selection rationale
- `apps/web/src/exemplar/demos/index.ts` — slug manifest
- `scripts/curate_demos.py --help` — full CLI reference
