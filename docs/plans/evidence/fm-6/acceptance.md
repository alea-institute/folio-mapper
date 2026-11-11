# FM-6 key persistence integration acceptance

The replacement PR supersedes **#17 and #15**. This branch contains their source,
tests, harness and historical evidence, plus both gate repairs. Publication and
the campaign's final Astra/Fable review and merge remain controller-owned.

## Integration

- Assigned base: `1e3a397eff31ae1bc7969f6e22b914daddc99b28`.
- Plan commit: `61e06b0b`; PR head: `fff81f0508524830b48f487ffe1c62b741a761fa`.
- All 12 PR commits were cherry-picked, without conflicts, through `765ac925`.
  At that point, comparison with the PR head showed only the additional FM-6 plan.
- Device-key repair: `75501ad7`; desktop chooser repair: `5ad01dbc`.
- The local `main` reference is older than the controller-assigned base. The
  controller must compare against live main when publishing. No remote was added.
- The chief campaign plan is absent from this clone. This build follows the
  supplied standing lane rules; reconciliation of the canonical excerpts remains
  a controller check, not a product decision.

## Repairs and failing-before proof

Concurrent callers now share one pending device-key operation. Clear all
invalidates earlier operations and orders deletion before later reads or creation.
Settled operations release only their own pending slot; failures permit retry.
Keys remain non-extractable AES-GCM CryptoKeys in the existing IndexedDB format.

Before the repair, the new core cases failed four assertions: first use and
post-clear concurrent keys were incompatible, concurrently encrypted provider
payloads could not decrypt, and new generation started before a held clear ended.
After the repair, all 21 device-key and vault tests pass, including write abort,
generation failure/retry, repeated clears and obsolete-operation cleanup.

The new browser case retains the unchanged in-memory key after Clear all,
revalidates it, verifies it remains session-only, then explicitly selects Save
(encrypted). It holds native generation and releases the two encryption
completions in reverse order. On the pre-repair production bundle, the next
browser process restored an empty input instead of the saved key. The repaired
bundle restores and successfully validates the original synthetic key.

App now passes desktop mode through ModelChooser to ProviderCard. The stateful
chooser regression failed twice before this change because desktop edits turned
the false remember preference true. The focused component suite now passes all
16 cases. Separately, a temporary negative-control build omitted only App's
ModelChooser prop, with the nested forwarding intact: both chooser validation
paths after Forget failed to show the unsaved-key warning. The source was restored
before the final production build. All four Forget/Clear all and validation-path
combinations now warn without implicit keychain writes. Closing without saving
leaves no key after restart; the explicit warning action saves and restores it.

## Verification on 2026-11-11

| Command | Observed result |
| --- | --- |
| `pnpm --filter @folio-mapper/core test src/llm/device-key.test.ts src/llm/key-vault.test.ts` | 21 passed |
| `pnpm --filter @folio-mapper/ui test src/components/settings/ProviderCard.test.tsx src/components/input/ModelChooser.test.tsx` | 16 passed |
| `pnpm test` | 234 passed: core 44, UI 44, web 146; 24 test files |
| `pnpm typecheck:browser` | Passed |
| `pnpm test:browser` | Fresh production build; 33 passed, one worker, zero retries |
| `pnpm test:api` | 542 passed, 31 established optional skips |
| `git diff --check` | Passed |

The API skips are 21 optional FAISS embedding cases and 10 optional spaCy model
cases. Dependencies were installed from the existing frozen locks with the dev
extra; no dependency versions were changed for FM-6. Chromium ran successfully
despite the sandbox's expected Unix-socket diagnostics during toolchain setup.

Additional checks expose existing repository debt: `pnpm lint` fails because
ESLint 9 has no flat configuration; `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`
reports 26 diagnostics in existing demo tests, mapping graph types, Settings and
ProviderCard. The exported integration baseline reproduces the same diagnostics
after path normalization, and the diagnostic source files are unchanged by FM-6.
Neither check is represented as passing. Browser typechecking and the production
build pass. The build retains existing large-chunk and Browserslist warnings.

## Visual evidence

Both images are fresh Playwright captures from the passing production acceptance
run and were visually inspected. Password rows and key metadata are masked.

- `docs/plans/evidence/fm-6/browser-explicit-save-restored.png` shows the restored,
  encrypted, saved and validated browser key after adverse completion ordering.
- `docs/plans/evidence/fm-6/desktop-model-chooser-unsaved-warning.png` shows the
  warning after editing through the input-screen chooser. This uses a synthetic
  desktop preload/keychain boundary in Chromium, not native OS keychain acceptance.

The inherited narrow-viewport acceptance also passes. All requests use offline
routes and synthetic credentials; profiles are backed up before destructive
storage actions. Existing tests, assertions and exemplar content are preserved.

## Boundaries

Coordination covers callers in one module instance. This change makes no new
cross-tab guarantee. No schema migration, data rewrite, release, outside service,
credential change or product decision is introduced.
