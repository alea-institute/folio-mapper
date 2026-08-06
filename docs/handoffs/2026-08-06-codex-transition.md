---
title: "folio-mapper — Codex transition handoff (folio-resolve migration wrap-up)"
summary: "folio-resolve migration is done and pinned exact at 0.3.1; v1.1 regulatory-exemplars branch is ready to merge whenever someone picks it up."
created_at: "2026-08-06"
repository: "folio-mapper"
branch: "main"
head: "46151f1e"
---

# folio-mapper — handoff to Codex execution

Written for a session that has never seen this repo and cannot ask me anything. Execution moves to Codex for the rest of the week; this is what git history won't tell you on its own.

## Where things actually stand

The **folio-resolve migration** (folio-mapper donated code to a shared library, then had to consume it back) is **complete and stable** as of commit `53a6120e`. `backend/pyproject.toml` pins `folio-resolve==0.3.1` — an exact pin, not a range. `stage3_judge.py` is down to a thin adapter (137 lines) that delegates to `folio_resolve.judge.parse_judge_json`. Test suite: 520 passed / 10 skipped, unchanged before and after the 0.3.1 bump.

**The 0.2.1 → 0.3.0 → 0.3.1 zigzag, and why it matters if you touch this again:** Damien originally approved publishing folio-resolve 0.2.1. Before that publish happened, the library's `main` had already moved to 0.3.0 (an in-flight eval-loop feature line). I surfaced that drift to him via a Cockpit decision sheet rather than publish the stale number, because PyPI versions are permanent — see `briefs/qa/folio-mapper-2026-07-29-resolve-021-release.json` and its `-answers.json` in the cockpit repo if you want the full record. **He chose to publish 0.3.0 instead** (not the original 0.2.1), reasoning captured in that answers file. That work then surfaced a second, more interesting bug (see below), which is why the final pin is 0.3.1, not 0.3.0.

## The real gotcha: editable installs hide version drift

`53a6120e`'s commit message documents something worth repeating because it will bite again if a future session does local library dev the "obvious" way: `backend/pyproject.toml` has a comment inviting `uv pip install -e ../../folio-resolve` for local development against the sibling repo. Someone did that at some point, and it went undetected because **three different places disagreed about the version and nothing flagged it**:

- `pyproject.toml` declared `>=0.3.0`
- `uv.lock` had resolved and locked `0.2.0`
- the actual `.venv` was running an editable install pointed at `../../folio-resolve/src`, i.e. whatever branch was checked out there at the time — unreleased HEAD, not any tagged version

All three were technically "satisfied" by the version constraint while the running code was none of them. If you do local library dev against a sibling checkout again, know that going in and pin/reinstall the wheel explicitly before trusting test results — don't leave the editable install in place past the session that needed it.

`docs/migration/2026-08-05-v0.3.1-consumer-impact.md` (in the **folio-resolve** repo, not here) documents 0.3.1's fixes from the library side, including a search-terms reorder (F13) that's real but order-invariant where it lands in mapper.

## Deliberately not done: no golden-capture regeneration

`53a6120e` explicitly did **not** regenerate `migration/captures/baseline.json` or the derived `candidate.json`/`delta.json` when bumping to 0.3.1. Reason, verbatim from that commit: `baseline.json` is a **pre-swap capture of a fork that was deleted at migration time and cannot be reproduced**. Regenerating the candidate/delta pair would flip `env.folio_resolve_consumed` and write `buckets={"term_delta": 1}`, which breaks two live assertions in `tests/test_folio_resolve_pin.py`. If a future task looks like "just regenerate the golden baseline," read that test file first — it currently asserts on the *absence* of that bucket, and that absence is intentional, not an oversight.

## v1.1 regulatory-exemplars — unmerged, ready, nobody owns the decision

`feat/v1.1-regulatory-exemplars` is still not merged to `main` as of this writing. It adds four regulatory exemplars (Environmental Compliance, Energy & Utilities, Securities Enforcement, Data Privacy & Cybersecurity) to the demo carousel, taking it 10 → 14, all with zero-token cached demo payloads. As of the last check (2026-07-29): phases 4–6 complete, 40/40 exemplar leaves resolving to an exact FOLIO concept, and a `git merge-tree` simulation against `main` showed only `README.md` and `backend/uv.lock` overlapping, no conflicts. **I have not re-verified this against today's `main`** (which has since moved with the resolve migration's stage-2 and the 0.3.1 pin) — treat "no conflicts" as true as of 2026-07-29, not as of now. One open product question lives inside that branch's own planning docs: whether to keep Securities Enforcement as one of the four, or swap it for a more distinct area. That's Damien's call, not a technical blocker.

## Unverified / not independently checked by me this session

- Whether `feat/v1.1-regulatory-exemplars` still merges cleanly onto the current `main` (pin bump + stage-2 collapse landed since the last check).
- Whether `docs/migration/2026-08-05-v0.3.1-consumer-impact.md` in the folio-resolve repo still matches what's on PyPI (I did not re-open that repo this session).

## Cockpit process note (applies to this repo generally, not just this task)

This repo follows the shared cockpit conventions in `/home/damienriehl/Coding Projects/CLAUDE.md`: decisions Damien needs to make go through `briefs/qa/*.json` asks with a paired HTML sheet in `briefs/board/`, not chat-only prose. If you land on a decision point mid-task, write the ask before proceeding rather than asking in chat and hoping it's remembered — see that file's "Cockpit freshness" section for the exact mechanics (answers-back flow, `qa-state.json`, retiring finished asks).

## Suggested next steps, roughly in priority order

1. If resuming the v1.1 branch: re-run the `merge-tree` conflict check against current `main` before assuming last week's clean-merge finding still holds.
2. If touching the resolve pin again: check `backend/.venv`'s actual installed version (`python -c "import folio_resolve; print(folio_resolve.__version__)"`) against both `pyproject.toml` and `uv.lock` before trusting any of them alone — that's exactly the drift that bit this repo once already.
3. Nothing in the migration itself is currently blocking or half-finished; it reads as closed out.
