# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the question requires otherwise.

## Stack

- **Language for scripts:** Python 3.11+ via `backend/.venv/bin/python` (the project's existing backend venv). Avoid creating new venvs unless a spike's question genuinely requires isolation.
- **FOLIO access:** `folio-python` (already a backend dependency). Loads from GitHub on first call, caches under `~/.folio/cache`. Subsequent runs warm in <1s.
- **LLM stages:** When a spike requires LLM-style reasoning (segmentation, ranking, judging), default to having Claude (in the current session) play the role inline — this honors the user's Claude Max plan budget rather than spending API tokens. Only pay-per-token if the spike's whole point is measuring real provider behavior.

## Structure

```
.planning/spikes/
  MANIFEST.md          — index of all spikes with verdicts
  CONVENTIONS.md       — this file
  NNN-descriptive/
    README.md          — full spike write-up with frontmatter
    items.json         — input fixture (when applicable)
    run_*.py           — runner script(s)
    candidates.json    — captured output
    ORIGINAL-*.md      — preserved original definition if migrated from another location
```

## Patterns

- **Coverage probes** before output-fidelity spikes. Question "does the data exist?" is cheaper than "does the pipeline produce X?" — answer the first to de-risk the second.
- **Per-item handcrafted search terms** in spike scripts mirror what Stage 0 LLM segmentation would emit, keeping the script LLM-free while still exercising the real Stage 1 search path.
- **Investigation Trail in README** is mandatory: document each iteration's surprise + adjustment, not just the final verdict.
- **Branch-membership filter** beats keyword-vocabulary filter when assessing FOLIO relevance — legally-meaningful concepts live in specific branches (Objectives, Area of Law, Actor/Player, etc.), not all of them contain the word "law".

## Tools & Libraries

- `folio-python>=0.2.0` — primary FOLIO interface
- `rapidfuzz` (transitively via folio-python) — drives `search_by_label` scoring
- Avoid: starting the full backend uvicorn just to query FOLIO; load `folio-python` directly.
