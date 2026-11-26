# FM-7 encrypted-save failure acceptance

## Delivery status

The branch integrates PR #18 and repairs the encrypted-save failure path. The replacement PR supersedes **#18, #17 and #15**. Publication and merge remain with the controller and campaign gate; this clone has no remote and no push or PR operation was attempted.

Browser runtime acceptance and fresh screenshots are **pending**. This lane explicitly prohibits Chromium launches because Unix sockets are denied. No browser launch was attempted and historical screenshots imported with PR #18 are not current acceptance evidence.

## Source and scope

- Assigned implementation base: `1e3a397eff31ae1bc7969f6e22b914daddc99b28`; the plan checkpoint was `af86426b`.
- Required PR head: `3894f2987fcf2d5d6579660623b3b9d54b6d5939`, present and replayed as the complete 17-commit merge-base-to-head range, without conflicts.
- Final source and test commit: `abaa3d23c476aeb35cc8e086440a0293c491e85f`.
- Replay tip: `c95df479`. Its tree matched PR #18 except for the preserved FM-7 plan.
- The local `main` ref is older than the assigned base. No reset or upstream reconciliation was attempted; the controller must compare against its actual publication target.
- The branch includes the inherited source and tests, including the device-key coordinator, exact-two-encryptions browser regression, and desktop Settings/ModelChooser warning regressions. None of their assertions was deleted or weakened.
- The regulatory exemplar, dependency versions, backend code and persisted vault format are unchanged by the FM-7 repair. No migration, release, new service, credential action or security-setting change was introduced.

The chief plan excerpts and common mandate file are unavailable in this clone. Build execution follows the user's explicit FM-7 build instruction and supplied standing rules. The controller still needs to reconcile the chief Goal Capsule and cited campaign requirements before publication; this receipt does not claim they were read.

## Behavior verified locally

The browser persistence hook keeps preference separate from the complete vault write. Only a successful ciphertext-and-metadata write marks the current key saved. A failure leaves the connection valid and the key in memory, shows a safe provider error and a Save unconfirmed badge, and keeps the unsaved warning. Explicit retry supports the same key without another connection test. Automatic retries do not loop on unrelated config updates.

Tests cover pending saves, both Save & Close validation paths, payload and metadata exceptions, independent provider errors, edit/removal invalidation, same-value replacement, and a late duplicate failure after success. Both Settings and ModelChooser receive the app-owned status. Desktop warning policy and explicit keychain writes remain intact.

A metadata-write exception can leave ciphertext stored without provider metadata. This repair reports that state as unsaved; it does not introduce transactional rollback or a new storage format.

## Verification

Toolchain: Node `22.22.1`, pnpm `9.15.9`, Python `3.14.0`. Dependencies were installed using the committed frozen locks. Python used `uv sync --frozen --extra dev`; `folio-python` is `0.3.6` and `folio-resolve` is `0.4.0`, without an editable sibling install. Frontend packages used a writable lane cache after the default package cache proved read-only.

| Check | Result |
| --- | --- |
| `pnpm test` | Passed: 263 tests (44 core, 60 UI, 159 web), 27 files |
| `pnpm test:api` | Passed: 542 tests, 31 existing optional dependency skips |
| `pnpm typecheck:browser` | Passed |
| `pnpm exec playwright test --list` | Passed: 41 tests in 5 files discovered; no browsers launched |
| `pnpm build` | Passed; existing large-chunk and Browserslist warnings remain |
| `git diff --check` | Passed |
| `pnpm lint` | Blocked by existing missing ESLint 9 flat configuration |
| `pnpm exec tsc --project apps/web/tsconfig.json --noEmit` | Fails with 23 existing diagnostics; exported PR #18 baseline has 26 and current source adds none after path/line normalization |
| `FM7_CAPTURE_EVIDENCE=1 pnpm test:browser` | Pending on a socket-capable host |

The TypeScript baseline comparison used separate disposable source trees, the same compiler and dependencies, and workspace source mappings. The three eliminated diagnostics were redundant comparisons of a narrowed manual key source against other sources. Existing remaining errors concern demo-test mock types, mapping graph types and Settings/ProviderCard declarations. This receipt does not call repository-wide lint or TypeScript checks passed.

### Regression strength

Before the implementation, the added Settings test failed because a manual browser key with remember intent closed without the warning. After the fix it passes.

A deliberate mutation moving the saved-source transition before `storeEncryptedKey` made three tests fail: the payload-write failure test, metadata-write failure test and Settings integration failure/retry test. The mutation was restored, and the complete frontend suite passed afterward.

## Review outcome

The simplification pass checked reuse, quality, efficiency, tests and comments. It consolidated the status type and connection-error fallback, avoided repeated no-op status updates, and added same-value replacement coverage without changing inherited assertions.

The full code review covered correctness, testing, maintainability, security, reliability, adversarial cases and frontend races. It found three defects, each reproduced by a new failing regression before repair:

1. An endpoint edit could leave automatic saving disabled after revalidation. The hook now invalidates the obsolete attempt and permits the newly validated configuration to save.
2. A metadata exception could leave an indexed replacement restorable despite session-only wording. The failure message, badge and browser close warning now describe an unconfirmed save. The regression proves the partial ciphertext and index remain while the UI stays unsaved.
3. Endpoint/model edits during Save & Close could accept an obsolete validation result. Both fields now participate in the request identity, and separate tests prove late results cannot validate, save or close the edited configuration.

All three were independently rechecked after repair; 28 focused tests passed. The complete frontend suite also passed afterward. No known review finding remains unapplied. Regression tests hold the lessons directly, so no separate learning document was added.

Cross-model review was disabled by the checkout configuration. The local adversarial review ran, but this does not replace the controller's Astra/Fable campaign gate.

## Browser handoff

On a host that permits Chromium and local sockets, run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck:browser
FM7_CAPTURE_EVIDENCE=1 pnpm test:browser
```

The final command builds the production web app, runs every offline browser case, and writes the new masked captures to:

- `docs/plans/evidence/fm-7/browser-encrypted-save-failed.png`
- `docs/plans/evidence/fm-7/browser-encrypted-save-retry-restored.png`

**These PNGs have not been generated or inspected in this lane.** The controller must inspect and commit them and record the full browser result before accepting the item. The harness retains synthetic profiles and verified backups and closes its contexts in teardown. No live provider account or API key is needed.

Affected UI: `/` with Settings open, and the inline ModelChooser. Browser presentation at desktop and narrow widths is pending; local component tests verify accessible error/status rendering and interaction policy.
