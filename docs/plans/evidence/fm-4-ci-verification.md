# fm-4 CI verification

## Scope and source

- Plan: `docs/plans/2026-10-26-1246-chore-fm4-vitest-api-ci-plan.md`.
- Starting branch: `drawdown/fm-4`, clean at `6ecf5198` (plan commit over application baseline `ae4c480b`).
- Implementation verified: `13ebe4ce` (API install metadata) and `148dad2e` (workflow). Documentation changes do not alter the tested code.
- The chief campaign plan and mandate-common file are absent from this clone. The build follows the supplied lane instructions; the controller must verify the named upstream sections. No repository or ancestor `AGENTS.md`/`CLAUDE.md` was present in the supplied checkout.

## Environment

Linux; Node 22.22.1; pnpm 10.34.9; CPython 3.12.12; uv 0.9.22; Vitest 2.1.9; pytest 8.4.2; actionlint 1.7.12.

The initial checkout had neither `node_modules` nor a backend virtual environment. Node dependencies were downloaded into an empty package store. A second source-only copy created a fresh backend virtual environment using downloaded package artifacts. No prewarmed application/model cache, sibling editable install, API server, provider credential, or downloaded optional model was needed.

The sandbox denied pnpm's default store location. A writable external store was selected for local verification only; CI needs no store override. Expected sandbox `Failed to create stream fd` messages did not change the successful command exits.

## Findings addressed

1. Initial `uv sync --locked --extra dev --python 3.12` failed because setuptools discovered both `app` and `migration` as top-level packages. Explicit `app*` package discovery fixes installation without changing migration files.
2. After that fix, collection exited 2: 523 tests collected plus `ModuleNotFoundError: No module named 'numpy'` in `tests/test_embedding.py`. Adding the existing NumPy constraint to the dev extra fixes collection. The generated lock diff contains only two added dev-extra entries; no package versions changed.

No tests were added or changed: this is CI/dependency configuration. Existing suites, fresh installation, actionlint, and isolated failure probes provide the verification. No frontend source or UI changed, so Playwright screenshot evidence is not applicable.

## Executed checks

| Check | Result |
| --- | --- |
| Root `pnpm install --frozen-lockfile` | Exit 0; 631 packages; 13.8 seconds; lock unchanged |
| Root `pnpm test` | Exit 0; core 37 tests / 4 files, UI 28 tests / 4 files, web 146 tests / 14 files; **211 passed** |
| Backend `uv sync --locked --extra dev` | Exit 0; NumPy 2.4.3 installed; FOLIO pins retained |
| Backend `.venv/bin/python -m pytest tests/ -v -ra` | Exit 0; **542 passed, 31 skipped**, 4.93 seconds |
| Fresh source-copy install and same API command | Exit 0; **542 passed, 31 skipped**, 5.38 seconds; lock unchanged |
| `actionlint .github/workflows/ci.yml` | Exit 0, no diagnostics |
| `git diff --check` | Exit 0 |
| Scope comparison against `ae4c480b` | Desktop workflow, application code, all existing tests, migration captures, Node manifests and lock unchanged |

The API skips are existing optional integrations: 21 FAISS tests (module absent), 6 tests requiring a spaCy model, and 4 requiring `en_core_web_lg`. They remain skips, not passing tests.

The successful JavaScript run executed all three suites. The root script retains its existing fail-fast behavior; a core/package failure can prevent UI/web execution.

## Failure probes

All deliberate mutations were made in disposable source/manifest copies outside the repository; original tests and manifests were preserved.

- A mismatched TypeScript declaration caused `pnpm install --frozen-lockfile` to exit 1 with `ERR_PNPM_OUTDATED_LOCKFILE`.
- Restricting the dev NumPy constraint below the locked version caused `uv sync --locked --extra dev --python 3.12` to exit 1 because `uv.lock` needed an update.
- Both negative installs left their copied lockfiles byte-identical to the originals.
- An added failing Vitest assertion caused the exact root `pnpm test` command to exit 1; core reported 1 failed / 37 passed, and the root stopped before the later suites.
- An added failing pytest assertion caused the full API command to exit 1 with 1 failed / 542 passed / 31 skipped.

Workflow inspection confirms there is no `continue-on-error`, error-swallowing shell expression, inter-job dependency, path filter, or conditional test suppression. Separate jobs allow API execution when Vitest fails and vice versa; this structural check is not a claim that hosted dispatch was exercised.

## Workflow contract and pins

The workflow runs on PRs targeting `main`, pushes to `main`, and manual dispatch. Jobs are named `Vitest` and `API (pytest)`, each with a 20-minute timeout and `contents: read`. Concurrency includes workflow, event, and ref, so a newer revision can replace an obsolete run without colliding with another event's run. Setup-action caching is disabled.

Release tags were resolved through the public GitHub API, and each pinned `action.yml` was checked for the supplied inputs and Node 24 action runtime. Application Node remains 22.

| Action | Release | Immutable commit |
| --- | --- | --- |
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0) | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [actions/setup-python](https://github.com/actions/setup-python/releases/tag/v7.1.0) | v7.1.0 | `6d4fd22b20465ccc0f7354476588e8df7c9ca0e0` |
| [pnpm/action-setup](https://github.com/pnpm/action-setup/releases/tag/v6.1.0) | v6.1.0 | `ea17c68df8912ef543352723c149a84f56e3d413` |
| [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv/releases/tag/v10.3.2) | v10.3.2 | `07a047e608db84b3d8c06cd9a7c7dcc9c355c18e` |

pnpm 10.34.9 and uv 0.9.22 are explicit executable pins. actionlint 1.7.12 was downloaded from its official release and matched that release's checksum.

## Controller acceptance still pending

This clone has no remote; no push, PR, hosted run, merge, or deployment is claimed. The controller owns publication, first-PR and post-merge-main evidence, and the campaign merge gate. Verify both named checks attach to the intended revision. Manual dispatch normally becomes available once the workflow exists on the default branch.

No migration, data rewrite, package release, outside service, or Damien-only decision was introduced.
