# FM-8 integration acceptance

Date: 2026-11-26. Branch: `drawdown/fm-8`.

**Status: source integrated and local non-browser verification passed; browser acceptance remains incomplete.** The controller's replacement PR supersedes #19, #17 and #15. No PR was opened or pushed from this lane.

## Integrated revision

The supplied main snapshot is `aefe330bcbc86280b5de6aa4c248889d38c3c76d`. The assigned branch initially contained that snapshot and the committed fm-8 plan (`d4e6c1fb`). The local `main` label remains at the older ancestor `af4a764922fe1f6fb05d47ae27b54d48faaee465`; it was not used to reset the branch. There are no configured remotes.

All required objects were present. The prescribed replay completed without conflicts:

| Original commit | Replayed commit | Change |
| --- | --- | --- |
| `af86426b` | `c74874b9` | Preserve fm-7 plan |
| `717f2ba9` | `9cd253df` | Confirm encrypted persistence before closing |
| `2916918d` | `f5ae5461` | Guard saves across configuration edits |
| `abaa3d23` | `e39474b8` | Failure, retry and pending-save regressions |
| `31ebea80` | `895f51ff` | Preserve historical fm-7 receipt |

The tested source revision is `895f51ff8b58d80d0af43acf15fa2c86744b7738`. This receipt is a subsequent documentation-only change.

`git diff 31ebea80 HEAD -- apps packages tests README.md` was empty at the tested revision. The complete application and test tree matches PR #19's head. Relative to the supplied main snapshot, the branch includes the persistence hook, App and shared UI wiring, unit and integration tests, browser failure/retry tests, and README changes. It is not a plan-only branch.

Backend source, dependency manifests and locks, workflows, regulatory exemplar data, device-key coordination and its earlier regression tests remain unchanged from the supplied base. No tests or assertions were deleted, skipped or weakened by this integration.

## Fresh verification

Toolchain: Node `22.22.1`, pnpm `9.15.9`, uv `0.9.22`, Python `3.14.0`. Node dependencies were installed from the frozen lockfile using a writable cache. API dependencies used `uv sync --locked --extra dev --no-editable`. Installed `folio-resolve==0.4.0` and `folio-python==0.3.6` match the declarations and lock; neither is editable.

| Command | Result |
| --- | --- |
| `pnpm test` | Passed: 263 tests; 44 core, 60 UI, 159 web |
| `pnpm test:api` | Passed: 542 tests; 31 existing optional skips; 19 deprecation warnings |
| `pnpm typecheck:browser` | Passed |
| `pnpm exec playwright test --list` | Discovered 41 tests in five files; no browser launched |
| `pnpm build` | Passed; emitted the bundle-size warning |
| `git diff --check` | Passed |
| `pnpm lint` | Blocked by missing ESLint flat configuration; reproduced on the supplied base |
| `pnpm exec tsc --project apps/web/tsconfig.json --noEmit` | 23 diagnostics, all also present among the base's 26 diagnostics |
| `FM7_CAPTURE_EVIDENCE=1 pnpm test:browser` | Not run: browser launch explicitly prohibited in this lane |

The API skips comprise 21 FAISS-dependent cases in `backend/tests/test_embedding.py`, eight spaCy-model cases in `backend/tests/test_nlp.py`, and two spaCy-model cases in `backend/tests/test_search_expansion.py`. The optional embedding and NLP extras were not installed. No skip was introduced.

Lint and app typechecking were compared with a separate source snapshot of `aefe330b` using the same installed dependencies. After normalizing line offsets, the integrated app diagnostics are a subset of the baseline diagnostics: the replay removes three redundant-comparison errors and introduces none. Remaining errors concern fetch mocks, mapping graph types/nullability, connection-result typing and a provider-source comparison. These checks are not reported as passing.

The passing frontend suite includes the real vault-write exception/Settings-warning integration, metadata partial-write reporting, unchanged-key retry, pending and obsolete result guards, duplicate-save outcomes, provider isolation, desktop/browser preference matrices, and the inherited concurrent device-key creation tests. Imported regressions were used unchanged; this was an exact integration replay, not a new repair requiring replacement tests.

## Review

The existing fm-8 plan was revalidated against the checkout. Coherence, feasibility, scope, design, security and adversarial plan review returned no findings; no plan edit was needed.

The simplification pass covered reuse, quality, efficiency, test value and comments. No source changes were warranted. One suggestion to remove the hook's state-ownership comment was declined as low value for this exact replay; it documents the distinction between save preference and successful persistence. All proof tests remain untouched.

Code review covered correctness, testing, maintainability, security, reliability, frontend races and adversarial failure scenarios. All seven returned no source findings. Browser runtime coverage and screenshot inspection remain explicit verification gaps. The checkout disables automatic cross-model review; local review does not replace the controller's Astra/Fable gate.

## Pending controller gates

The lane's socket restriction and explicit no-browser instruction prevent runtime acceptance. No Chromium launch was attempted, and no screenshot was generated or inspected. Settings and ModelChooser on the app's root page remain unverified in a real browser on this revision.

On a permitted host with the committed dependencies installed, run:

```bash
pnpm exec playwright install chromium
FM7_CAPTURE_EVIDENCE=1 pnpm test:browser
```

The existing capture helper writes these paths when the corresponding tests run; neither file is present yet:

- `docs/plans/evidence/fm-7/browser-encrypted-save-failed.png`
- `docs/plans/evidence/fm-7/browser-encrypted-save-retry-restored.png`

Inspect masking and both rendered states, commit the images, and append revision-specific runtime results here. The fm-7 directory is the existing helper's destination; the new images must come from fm-8's integrated source. Test discovery and browser typechecking do not substitute for this gate.

The controller must also compare with live target main, reconcile the chief campaign plan's Goal Capsule and the cited campaign rules (the chief repository is absent from this lane), scan the branch, publish the replacement PR, and run campaign review. The imported fm-7 receipt remains historical; this receipt supplies the fresh local evidence. No product decision, credential, spend, migration, data rewrite, package release or new external service is needed for the remaining work.
