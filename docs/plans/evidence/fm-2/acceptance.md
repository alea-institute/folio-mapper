# fm-2 passwordless key browser acceptance

Date: 2026-10-26. Branch: `drawdown/fm-2`. Plan:
`docs/plans/2026-10-26-1037-test-passwordless-key-browser-acceptance-plan.md`.

## Scope and result

The existing passwordless workflow is exercised through the built web application
with native Chromium IndexedDB, localStorage and Web Crypto. The current exemplar
is unchanged. The production corrections make Forget and Clear all durable:
auto-save honors `rememberKey`, discards obsolete encryption completions, and
permits a newly entered key to save after successful validation. Clearing also
cancels pending device-key creation; storage success waits for transaction commit.

Starting revision: `52d4d398` (clean, with the plan already committed). Production
fix: `0ab446ad`. Recovery/compatibility coverage: `2ffb8df2`. Initial evidence:
`3f5e1884`. The review repair and final tested production revision are `3543f363`.
The final receipt commit includes the named-credential fixture simplification,
tested-toolchain documentation and refreshed screenshots.

## Verification

Runtime: Node 24.13.0, pnpm 10.28.2, Playwright Test 1.64.1, Chromium
156.0.8078.4 (Playwright revision 1248), Linux; Python 3.13.11 for API tests.

| Command | Actual result |
| --- | --- |
| `pnpm test` baseline / final | 211 / 213 passed: core 37 → 39, UI 28, web 146; only two additive core tests, no existing assertion weakened |
| `pnpm build` before and after the production correction | Passed; existing large-chunk and Browserslist age warnings |
| `pnpm typecheck:browser` | Passed |
| `pnpm exec tsc --project packages/core/tsconfig.json --noEmit` | Passed after the review repair |
| `pnpm test:browser` | Builds successfully; the first combined run exposed a legacy-fixture initialization race, corrected before the final run below |
| `FM2_CAPTURE_EVIDENCE=1 pnpm test:browser` on the final reviewed repair | Fresh build and all 20 cases passed, zero retries; refreshed and inspected all three screenshots |
| `FM2_CAPTURE_EVIDENCE=1 pnpm exec playwright test` after that fresh build | 17 passed, zero retries; captured the two desktop screenshots |
| `pnpm exec playwright test --grep 'legacy canary' --repeat-each 3` | 3 passed after correcting fixture initialization; retries remain disabled |
| `FM2_CAPTURE_EVIDENCE=1 pnpm exec playwright test --grep 'narrow viewport'` | Passed at 390 × 844; save, restored validation and Forget controls remain usable |
| `pnpm test:api` | 542 passed, 31 skipped by existing tests |
| `pnpm lint` | Existing repository has no ESLint 9 configuration; command cannot run |
| `pnpm exec tsc --project apps/web/tsconfig.json --noEmit` | 26 baseline diagnostics, reproduced with both changed production files restored temporarily to the starting revision; identical messages, with one line-number shift; browser-suite type check passes |

Dependencies were installed from the committed pnpm lockfile. For the API
regression run, `uv sync --project backend --frozen --extra dev
--no-install-project --no-python-downloads` installed the locked dependencies.
The default editable project build encounters existing setuptools flat-layout
discovery failure. NumPy 2.4.3 (the lockfile version) was then installed into the
test environment because `test_embedding.py` imports it directly while the dev
extra does not supply it. No backend manifest or lockfile was changed.

## Acceptance matrix

| Requirement | Browser evidence |
| --- | --- |
| R1 | Both Test and Save & Close save without a passphrase; reload and complete persistent-context close/relaunch restore the original value; validating it sends the expected synthetic credential |
| R2 | AES-GCM 256-bit secret CryptoKey is nonextractable with encrypt/decrypt usages; export rejects; ciphertext/IV envelopes exist; general persisted state has empty keys and untested status; plaintext absent from both web-storage snapshots and observed writes |
| R3 | Rejected initial keys remain unsaved; rejected replacement leaves the previous saved value; successful replacement survives process restart |
| R4 | Forget preserves the other provider and the current session key; revalidation and model refresh do not re-save it; new entry saves normally; Clear all removes payloads and device key across reload/restart; delayed native encryption or first-use generation cannot restore cleared state |
| R5 | Missing device key, damaged ciphertext byte, missing payload, targeted database-open failure and targeted payload-write failure all permit manual recovery and subsequent restart restoration |
| R6 | A legacy canary is seeded once before initialization, cleared once with the notice, and a new credential survives later reload/restart without repeated cleanup |
| R7 | Environment overrides browser vault and simulated desktop keychain; simulated keychain overrides browser vault; demo manual search with a restored and revalidated key sends no LLM configuration or authorization and never reaches inference |
| R8–R9 | Unknown API and external requests are deliberately blocked in a guard test; all ordinary cases finish with empty unexpected-request/page-error ledgers; profiles are isolated and all credentials are synthetic |

## Red evidence and correction

Before production edits, the first three persistence cases passed. Forget left
`anthropic` in the vault alongside `openai`; Clear all repopulated `anthropic`;
and a separately delayed native encryption completion also repopulated it after
Clear all. Those three failing assertions remain in the suite and pass after the
correction. No test assertion was weakened.

Full code review used correctness, testing, maintainability, security, reliability,
frontend-race and adversarial lenses (run `20261026-111855-bca094b0`). It confirmed
one remaining R4 gap: delaying the return of a real first-use `generateKey` result
allowed the device key to reappear after Clear all, without restoring ciphertext.
The retained native-browser regression failed with that key record present.
Two additive core tests also failed before the repair: late generation still
resolved, and an IndexedDB write aborted after request success still resolved.
The repair checks cancellation at write admission and resolves only on transaction
completion. All three regressions now pass. A separate delayed-encryption case
proves that an older completion cannot overwrite a validated replacement.
Focused follow-up review found no remaining defect; all actionable findings and
the replacement-race coverage note are addressed. No review finding is deferred.

The first legacy fixture seeded storage after navigation. A faster combined run
allowed the prior page's resolver to clear it before the tested reload. The fixture
now runs before application initialization and uses a persistent fixture marker
to avoid reseeding on subsequent navigations. This was a harness defect, not an
application failure or an accepted retry.

## Evidence and boundaries

- `docs/plans/evidence/fm-2/passwordless-key-restored.png`: restored and revalidated
  Anthropic key, with Encrypted / Key saved visible and key rows masked.
- `docs/plans/evidence/fm-2/passwordless-keys-forgotten.png`: settings after Clear all
  and a browser restart, without saved-key indications. Key rows remain masked.
- `docs/plans/evidence/fm-2/passwordless-key-mobile.png`: restored key and working
  Forget control at a narrow viewport. The existing key row can overflow at this
  width; both the row and its key-preview span are masked. No layout redesign is included.

Screenshots were visually inspected. Profiles are never seeded between the
persistence launches; `BrowserContext.close()` completes before relaunching the
same profile at the same origin. Native readonly transaction completion supplies
the storage checkpoint. Before destructive storage faults, Forget and Clear all,
the synthetic profile is closed, copied, and every regular file's SHA-256 is
compared with the backup. Profiles/backups remain ignored and are not committed.

Only recognized method/path/provider API combinations are fulfilled. Local built
assets are served from the strict loopback server; unknown requests and WebSockets
are blocked. Authorization is compared in memory and recorded only as a synthetic
credential identifier. No provider service, real credential, spend, message, or
outside service is used. The desktop tests cover a simulated preload boundary,
not Electron packaging or actual OS keychain persistence. Other browser engines
and cross-tab synchronization are outside this plan.

The chief campaign plan was absent from this clone, as recorded during planning.
The controller must reconcile its Goal Capsule and campaign R11/R15–R17/R19/R20
with the supplied mandate before accepting publication. No remote or credentials
were added or sought. No schema migration, production data rewrite, release, or
new service is included. CI extension remains fm-4 work.
