# FM-5 desktop unsaved-key warning acceptance

## Result

The key editor now restores persistence eligibility only in browsers. Desktop
edits preserve the existing preference, so replacing a key after Forget or
Clear all still triggers the unsaved-key warning. Browser replacements continue
to save without a password and restore after a complete browser restart.

Verified on 2026-11-08 against implementation commit `c838566b`, including
production fix `9375ad8c`, on `drawdown/fm-5`. The retained `drawdown/fm-2` tip
`8270dd85` is an ancestor. No existing test or assertion was removed or weakened;
the current regulatory exemplar and all historical fm-2 evidence are unchanged.

## Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @folio-mapper/ui test -- src/components/settings/ProviderCard.test.tsx` before the fix | 2 expected failures, 6 passes: desktop session-only edits incorrectly changed the preference to true. |
| `pnpm exec playwright test tests/browser/passwordless-key-desktop.spec.ts --grep 'warns after'` against the original production build | All 4 cases failed at the missing unsaved-warning assertion: Forget/Clear all crossed with prior Test/direct Save & Close. |
| `pnpm test` after the fix | 221 passed: core 39, UI 36, web 146, across 23 files. |
| `pnpm typecheck:browser` | Passed, including the extended synthetic keychain and all new specs. |
| `pnpm test:browser` | Fresh production build succeeded; all 27 Playwright cases passed in 35.2 seconds, one worker, zero retries. |
| `pnpm test:api` | 542 passed, 31 skipped in 15.95 seconds. Skips are 21 embedding tests requiring optional `faiss`, and 10 NLP/search tests requiring spaCy models (including `en_core_web_lg`). |
| `git diff --check` | Passed. |

The first full frontend run overlapped browser regression execution and timed out
in two unchanged `useSession` tests at their existing 5-second limit. A complete
rerun on its own passed without changing tests, timeout settings or retries.

Supplemental checks remain subject to existing repository limitations:

- `pnpm lint` cannot start because the repository lacks an ESLint 9 flat config;
  the fm-2 base also lacks that config.
- `pnpm exec tsc --noEmit --project packages/ui/tsconfig.json` reports existing
  mapping/graph and settings type errors. Running the same compiler against an
  isolated source copy of `drawdown/fm-2` produced byte-for-byte identical
  diagnostics. No typecheck finding was introduced by this repair.
- The production build retains existing warnings about Browserslist age and a
  large bundled chunk.

Toolchain: Node 22.22.1, pnpm 9.15.9, Vitest 2.1.9, Playwright 1.64.1,
Python 3.13.11, uv 0.9.22. Dependencies were installed from the unchanged frozen
locks, including backend development extras. A writable pnpm cache was required
because the default store was read-only; no dependency versions changed.

## Browser coverage and screenshots

The affected route is `/`, using its LLM Provider Settings dialog. All cases
passed with no unexpected application requests, page errors or console errors.
Expected error-path messages remain explicitly covered by the inherited harness.
The existing 390-pixel viewport acceptance case also passed.

The desktop cases run the real App removal callbacks, ProviderCard editor and
LLMSettings close behavior. They verify both warning paths after each removal,
no automatic keychain write, Close without saving, and an explicit Save to
keychain followed by restoration from the synthetic keychain. The in-memory
keychain is consistent across the test session's page reloads/browser restarts;
its mutation ledger stores synthetic credential identifiers rather than values.
This is Chromium simulation of the preload boundary, not native OS keychain or
Electron packaging acceptance.

Browser cases additionally prove that validating the unchanged forgotten key
does not save it, whereas a newly entered replacement saves and survives a full
restart after either removal action. All inherited restart, encryption, removal
race, recovery, resolver precedence and demo protections passed.

These fresh 1440-by-1050 Playwright screenshots were visually inspected. Password
input rows and their abbreviated key labels are masked; only synthetic data was
used. They were copied from the existing screenshot attachments without changing
the fm-2 evidence exporter.

- [Desktop unsaved-key warning](desktop-unsaved-key-warning.png): settings remain
  open with the warning, Session only badge, and both explicit choices visible.
- [Browser replacement restored](browser-replacement-restored.png): after restart,
  the replacement is validated with Encrypted and Key saved indicators visible.

## Review and controller handoff

The independent simplification review found no issues across reuse, quality,
efficiency, test value and comments; no changes were required. The one-line
runtime correction, additive regression coverage and this receipt are the full
repair scope. Local implementation review is recorded in the final build report.

The controller should publish this branch as the replacement that **supersedes
PR #15**, retaining its fm-2 work and adding the desktop warning repair. This
clone has no remote; no push, PR, merge or deployment was attempted. Campaign
Astra/Fable reviews and the merge gate remain controller-owned. Live PR #15
state is not independently verified by this offline clone.

The chief repository's scoped Goal Capsule and campaign requirement excerpts
remain unavailable here. This build follows the lane rules supplied directly by
the controller; the controller must reconcile the canonical campaign excerpts
before publication. No new decision from Damien, held change, migration, data
rewrite, release or outside service is needed.
