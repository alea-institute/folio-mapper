# fm-9 browser CI verification

Date: 2026-11-26. Branch: `drawdown/fm-9`.

Plan: `docs/plans/2026-11-26-0057-chore-fm-9-browser-ci-plan.md`.

## Revision and scope

- Build started clean at `5c079b40`, the committed plan on top of `aefe330b`.
- Implementation: `49aef859aa506980b4c303215b9347ca1905ca62`.
- The implementation changes only `.github/workflows/ci.yml` and `README.md`.
  This receipt is the only subsequent deliverable file.
- The existing workflow prefix, including triggers, permissions, concurrency,
  Vitest, and API jobs, is byte-identical to the build baseline. The desktop
  workflow, application, tests, browser configuration, manifests, and lockfiles
  are unchanged.
- No page changed, so no screenshot evidence is required for this item.
- No remote is configured. Publication, hosted acceptance, and campaign reviews
  belong to the controller. The chief plan and common mandate files are absent
  from this clone; their cited sections remain a controller source check. The
  supplied campaign rules govern this build.

The unauthenticated [repository page](https://github.com/alea-institute/folio-mapper)
identified the repository as Public during this run, consistent with the public
repository exception for GitHub Actions. The controller should recheck visibility
with its authorized tooling before publication or workflow administration.

## Implementation

The independent `Browser (Playwright)` job inherits PR/main/manual triggers and
uses Node 22, pnpm 10.34.9, a frozen install, and the lock-pinned Playwright CLI to
install Chromium with Linux dependencies. It invokes the existing build-and-test
script with list and HTML reporters. A failed, non-canceled job attempts to upload
the entire `playwright-report/` directory for seven days. Missing reports warn;
successful uploads do not suppress the original failed step.

The uploader is pinned to `cf430e030ddbb5b0abf93d22962f4752f3646cd9`.
An unauthenticated `git ls-remote` against the action repository confirmed that
the [v7.0.2 tag](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)
resolves to that SHA. Its [action metadata](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/action.yml)
supports the selected inputs and runs on Node 24 internally; application tests
still use Node 22.

## Executed checks

Toolchain: Node 22.22.1, pnpm 10.34.9, Playwright 1.64.1, Python 3.12.12,
uv 0.9.22, actionlint 1.7.12.

| Check | Result |
| --- | --- |
| Frozen Node install | Passed with pnpm 10.34.9; lockfile unchanged |
| `uv sync --locked --extra dev --python 3.12` in `backend` | Passed; lockfile unchanged |
| `pnpm test` | Passed: core 44, UI 44, web 146; 234 tests in 24 files |
| `.venv/bin/python -m pytest tests/ -v -ra` in `backend` | Passed: 542 tests; 31 existing optional skips for unavailable FAISS or spaCy/models |
| `pnpm typecheck:browser` | Passed |
| `pnpm exec playwright test --list` | Discovered 33 tests in all five existing spec files |
| `pnpm build` | Passed; existing large-chunk warning remains |
| `PLAYWRIGHT_HTML_OPEN=never pnpm test:browser --reporter=list,html --list` | Passed: real script builds, forwards reporter/discovery arguments, and discovers all 33 cases without starting a browser/server |
| `actionlint .github/workflows/ci.yml` | Passed with no findings |
| `git diff --check` and baseline comparison | Passed; protected files and existing job blocks unchanged |

Frontend checks, typechecking, build, and discovery ran on the implementation
commit. API tests ran against the same unchanged backend tree while the workflow
and README edits were in progress. The controller still runs final-head gates
before publication.

The shell initially supplied pnpm 9.15.9, so Corepack selected 10.34.9 for all
Node checks, including nested scripts. The default pnpm store was read-only and
`XDG_CACHE_HOME` was unset; the successful frozen install used
`--store-dir "${XDG_CACHE_HOME:-$HOME/.cache}/pnpm/store"`. This is a lane-only
setup adjustment, not a repository setting. API setup emitted the expected
socket warning but completed successfully.

## Failure-path checks

Temporary isolated probes used the installed Playwright CLI, an independent
configuration without a browser or web server, and synthetic data. They did not
modify any repository test, and no probe or generated report is committed.

- A deliberately failed assertion exited 1 with list and HTML reporters and
  `PLAYWRIGHT_HTML_OPEN=never`. Inspection of the generated report's embedded
  results confirmed one unexpected failure. A synthetic PNG attachment was
  copied under `playwright-report/data/` with bytes identical to its input and
  referenced by the report. A text-attachment probe also confirmed that text
  attachments can be embedded directly in the report.
- A separate temporary package retained the real `test:browser` script and
  substituted a build that exits 23. The invocation remained nonzero, retained
  the build's exit code in its log, and did not create a report.

These checks prove local report generation and shell short-circuiting. They do
not prove browser acceptance, visual report usability, GitHub dispatch, the
upload action's hosted warning, or artifact download. Those remain pending.
No permanent test was added because this is workflow configuration; validation
uses the existing suites, actionlint, preservation checks, and failure probes.

## Pending controller checks

This lane denies the sockets required by Chromium and the preview server. No
browser launch was attempted. On an unrestricted host, using Node 22 and pnpm
10.34.9, run from the final implementation checkout:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm test:browser
PLAYWRIGHT_HTML_OPEN=never pnpm test:browser --reporter=list,html
```

Run the frontend and API gates on the final published head as well. Keep every
existing assertion intact; an application failure belongs to its own mandate
item. Close all browser contexts and preview servers after verification.

After publication, confirm PR/main dispatch and all three independent checks.
In a separate validation branch or preserved checkout, exercise a real browser
failure with a harmless image attachment and a setup/build failure. Confirm the
failed browser check stays failed after upload, download and open its complete
report, and confirm the missing-report warning for failures before reporting.
Do not merge the intentional failure probe. Successful, canceled, and terminated
runs must not be represented as failure-artifact proof.

Local implementation is complete. Campaign acceptance remains pending the host
browser runs, hosted delivery evidence, and controller review gates.
