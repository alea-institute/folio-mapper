---
status: passed
phase: 03-new-session
source: [03-VERIFICATION.md]
started: 2026-05-22T22:00:00Z
updated: 2026-05-22T22:30:00Z
verified_by: live-browser (chrome-devtools MCP, dev server localhost:58173)
---

## Current Test

[all items verified via live browser]

## Tests

### 1. "New" button visible on input screen
expected: Button visible immediately in header on the input screen, no hasActiveSession guard.
result: PASS — "+ New" button + "Open recent session" clock icon render in the header on the input screen with no active session (a11y snapshot uid New tab/Open recent session + screenshot).

### 2. "New" button opens a fresh tab instantly
expected: New tab opens to a fresh empty session via ?new=1 (param stripped); no confirmation dialog; original tab untouched.
result: PASS — clicking "New" opened a second page at the pathname with search="" (?new=1 stripped by the security guard), a fresh folio-tab-id, empty session, on the input screen; no confirm dialog; original tab unchanged.

### 3. Auto-resume on browser reopen (zero clicks)
expected: Most-recent session content loads automatically in a fresh tab; no recovery modal.
result: PASS — with a registry + source session seeded and no tab identity, reload generated a NEW tabId (distinct from source), COPIED the source data under the new namespaced key (data preserved), screen=mapping, no recovery modal, and the pre-resolve placeholder key was cleaned up (CR-02 fix). Render path with valid data confirmed via Test 5 refresh-recovery.

### 4. Picker delete removes row without reopening
expected: Deleted row vanishes immediately; picker stays open showing remaining session(s).
result: PASS — picker listed 2 entries with real filenames (CurrentTab.csv / OtherSession.xlsx), Resume/Delete per row, Start New, Close. Deleting one removed the row in-place, modal stayed open, registry shrank to 1, deleted session's data key removed. Escape-to-close and initial focus on close button confirmed (WR-03).

### 5. Multi-tab isolation
expected: Each tab keeps its own namespaced session; registry shows distinct entries (no clobbering).
result: PASS — two live tabs held distinct UUID identities; both per-tab namespaced keys coexisted in shared localStorage with no clobbering. Refresh within a tab kept its own identity and recovered its own session text (criterion #5).

### 6. Legacy single-session migration
expected: Old folio-mapper-session-mapping / -input keys migrate to namespaced keys; old keys removed; session resumes with no data loss.
result: PASS — seeded legacy keys + no identity; reload generated a tabId, migrated both legacy payloads into namespaced keys (data preserved), removed both legacy keys, no error prompt.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None — all human verification items passed under live-browser testing.
