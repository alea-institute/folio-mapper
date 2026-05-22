---
status: partial
phase: 03-new-session
source: [03-VERIFICATION.md]
started: 2026-05-22T22:00:00Z
updated: 2026-05-22T22:00:00Z
---

## Current Test

[awaiting human/live-browser testing]

## Tests

### 1. "New" button visible on input screen
expected: Button visible immediately in header on the input screen, no hasActiveSession guard.
result: [pending]

### 2. "New" button opens a fresh tab instantly
expected: New tab opens to a fresh empty session via ?new=1 (param stripped); no confirmation dialog; original tab untouched.
result: [pending]

### 3. Auto-resume on browser reopen (zero clicks)
expected: Most-recent session content loads automatically in a fresh tab; no recovery modal.
result: [pending]

### 4. Picker delete removes row without reopening
expected: Deleted row vanishes immediately; picker stays open showing remaining session(s).
result: [pending]

### 5. Multi-tab isolation
expected: Each tab keeps its own namespaced session; registry shows distinct entries (no clobbering).
result: [pending]

### 6. Legacy single-session migration
expected: Old folio-mapper-session-mapping / -input keys migrate to namespaced keys; old keys removed; session resumes with no data loss.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
