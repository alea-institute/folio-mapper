# Phase 3: New (Fresh Session in New Tab) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 3-new-session
**Areas discussed:** Button behavior & existing 'New', Session isolation (localStorage), Placement & visibility, Confirmation UX

---

## Button Behavior & Existing 'New'

| Option | Description | Selected |
|--------|-------------|----------|
| Replace: New = open fresh tab | Existing 'New' becomes folio-enrich behavior; drops the Save/Discard popover | ✓ |
| Keep both buttons | Existing in-place 'New Project' stays AND add a separate 'New Tab' button | |
| Keep in-place, add new-tab as default | New-tab primary, in-place reset available via secondary menu | |

**User's choice:** Replace: New = open fresh tab
**Notes:** Opening a new tab is non-destructive, so the Save/Discard/Cancel `NewProjectModal` popover is no longer needed and gets deleted.

---

## Session Isolation (localStorage)

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral — in-memory only | New tab runs without persistence; lost on close/refresh; original tab 100% safe | |
| Persistent & recoverable per tab | Each tab gets its own namespaced storage; both auto-save and survive restart independently | ✓ |
| Switch sessions to sessionStorage | Per-tab isolation like folio-enrich, but loses cross-restart recovery | |

**User's choice:** Persistent & recoverable per tab
**Notes:** Robust for real parallel work. Tab identity rides in sessionStorage; per-tab namespaced localStorage keys. Heavier (namespacing + recovery rework) but the durable choice.

### Follow-up: Recovery (brand-new tab, no identity)

| Option | Description | Selected |
|--------|-------------|----------|
| Recover most recent session | Show existing recovery modal for most-recent session | |
| Show a session picker | List all saved sessions; choose Resume / Start New / Delete | ✓ |
| Always start fresh | Brand-new tab always blank; recovery only on refresh within a tab | |

**User's choice:** Show a session picker
**Notes:** New UI component. Most powerful for multi-session work.

### Follow-up: Lifecycle / Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Keep last N (e.g. 5), evict oldest | Cap stored sessions; drop least-recently-active when exceeded | ✓ |
| Manual delete from picker | Never auto-evict; user prunes via picker delete control | |
| Time-based expiry (e.g. 30 days) | Auto-remove sessions not opened in N days | |

**User's choice:** Keep last N (~5), evict least-recently-active (LRU)
**Notes:** folio-mapper sessions are large (candidate lists, judge annotations) against a ~5–10 MB localStorage budget, so a predictable cap matters.

---

## Placement & Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible (all screens) | Show 'New' on input, confirming, AND mapping screens (matches folio-enrich) | ✓ |
| Mapping screen only | Keep it where current button lives — mapping only | |
| Mapping + confirming | Show once input is loaded, not on the empty input screen | |

**User's choice:** Always visible (all screens)
**Notes:** Requires surfacing the button on the input/confirming layouts, which don't currently render the Header. Label kept as "New" + plus icon (Claude discretion, consistent with both apps).

---

## Confirmation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Instant, no confirmation | Click → fresh tab opens immediately (matches folio-enrich) | ✓ |
| Confirm only if unsaved changes | Open instantly when clean; confirm if in-progress work exists | |

**User's choice:** Instant, no confirmation
**Notes:** Non-destructive, so no prompt warranted.

### Follow-up: beforeunload Warning

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it | Drop the beforeunload "Leave site?" warning — redundant with auto-save + recovery | ✓ |
| Keep it as a safety net | Leave warning in place for extra reassurance | |

**User's choice:** Remove it
**Notes:** Sessions auto-save per tab and are recoverable from the picker, so the warning is redundant friction.

---

## Claude's Discretion

- Exact namespaced-key scheme and tab-id generation (uuid vs counter).
- Session picker visual design (reuse `SessionRecoveryModal` modal pattern).
- Mounting approach for the always-visible "New" button on input/confirming screens (shared mini-header vs per-layout).
- Button label/icon: "New" + plus icon (consistent with both apps).

## Deferred Ideas

- Live cross-tab sync (real-time reflection of edits between open tabs).
- Server-side / cloud session storage.
- Session rename/labeling in the picker.
