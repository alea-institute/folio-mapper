---
phase: 03-new-session
verified: 2026-05-22T00:00:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app in a browser. Confirm a 'New' button (plus icon, label 'New') is visible in the header on the input screen (before any file upload)."
    expected: "Button visible immediately, no hasActiveSession guard needed."
    why_human: "Header renders onNewTab conditionally ({onNewTab && ...}); grepping confirms it is wired via AppShell on the input/confirming path, but visual confirmation that the prop reaches the live DOM is required."
  - test: "Click 'New' from the input screen. Confirm a new browser tab opens to the same URL with ?new=1 stripped (or just the pathname), and the original tab is untouched."
    expected: "New tab opens to a fresh empty session. No confirmation dialog appears. Original tab retains its state."
    why_human: "window.open behavior and tab isolation cannot be verified by grep or unit tests."
  - test: "Open the app in Tab A, do some mapping work. Open a new incognito/fresh tab (simulating a browser reopen). Confirm the session is silently resumed in the new tab — no recovery modal appears."
    expected: "The most-recent session's content is loaded automatically with zero clicks."
    why_human: "Auto-resume boot resolver runs in a useEffect after store rehydration. The flow involves timing, Zustand persist APIs, and localStorage. Unit tests cover the copy-under-new-tabId logic but the live browser path needs human validation."
  - test: "Open the session picker (clock icon in the header). With two saved sessions, delete one entry. Confirm the deleted row disappears from the still-open picker without closing and reopening."
    expected: "Deleted row vanishes immediately; picker remains open showing the remaining session(s)."
    why_human: "In-place list refresh (setPickerSessions(readRegistry()) after onDelete) requires visual confirmation that React re-renders correctly without a close/reopen cycle."
  - test: "Have two tabs open simultaneously with different sessions in progress. Make changes in Tab A (wait >5s for debounce). Switch to Tab B and open the session picker. Confirm Tab A's session is in the list as a separate entry, not merged into Tab B's session."
    expected: "Each tab maintains its own namespaced session. The registry shows two distinct entries."
    why_human: "Multi-tab isolation is the core promise of the phase and requires two live browser tabs to verify."
  - test: "Load the app in a browser where the old single-session localStorage keys exist (folio-mapper-session-mapping and folio-mapper-session-input). Confirm the session is transparently recovered without any data loss or error prompt."
    expected: "Legacy data migrates to a namespaced key; old keys removed; session resumes seamlessly."
    why_human: "Migration path runs once at module load via resolveTabIdentity. Requires a real browser with pre-seeded legacy keys to confirm no data loss in production conditions."
---

# Phase 3: New Session (Multi-Tab) Verification Report

**Phase Goal:** Replicate the folio-enrich "New" button — a header button that opens a fresh browser tab with a brand-new empty session, leaving the current tab and its work intact. This replaces folio-mapper's existing in-place "New Project" reset. To make multi-tab safe, session persistence becomes per-tab namespaced (today it is a single shared localStorage session), and recovery on a fresh tab is handled by a new session picker.

**Verified:** 2026-05-22
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "New" button opens a fresh tab via `?new=1`; current tab untouched, no confirmation prompt | VERIFIED | `useSession.handleNewTab` = `window.open(window.location.pathname + '?new=1', '_blank')` (useSession.ts:233-235). No confirm() anywhere. Tested by `useSession.test.ts` D-01/D-03 case (line 73-107). |
| 2 | Session persistence is per-tab namespaced — no tab can clobber another tab's saved work | VERIFIED | `input-store.ts:83` name=`INPUT_KEY`, `mapping-store.ts:707` name=`MAPPING_KEY`. Both keys are `folio-mapper-session-${tabId}-{mapping\|input}`. `adoptSession()` always copies under a NEW crypto.randomUUID() so no two tabs share a key. CR-01 fix: onWrite derives activeTabId from `tabIdFromMappingKey(name)` (live persist key), never from frozen `tabIdentity.tabId`. |
| 3 | Returning after full browser close auto-resumes the most-recent session (zero clicks) | VERIFIED (code path) / UNCERTAIN (live browser) | Boot resolver in useSession.ts:134-148 — D-07 branch: reads registry, calls `adoptSession(registry[0].tabId)`. Unit test at useSession.test.ts:112-161 asserts new tabId written to sessionStorage and data copied. Live browser behavior requires human verification (SC #3 below). |
| 4 | Session picker available on-demand from the header; Resume / Start New / Delete per entry | VERIFIED | `SessionPickerModal.tsx` exists with Resume (line 150-156), Delete (line 157-163), and Start New (line 171-177) buttons. Wired in App.tsx (line 798-810 for mapping screen, 993-1004 for input/confirming). Clock-icon trigger in Header.tsx (line 112-124). |
| 5 | A refresh within an existing tab directly recovers that tab's own session | VERIFIED | `tab-identity.ts:66-68` — D-08 branch: `sessionStorage.getItem('folio-tab-id')` returns existing id on refresh, `skipHydration: false` (only true for isNewTab), so Zustand persist hydrates from the tab's own namespaced key. Boot resolver early-returns at `tabIdentity.hasIdentity` check (useSession.ts:139). |
| 6 | Stored sessions are capped (~5, LRU eviction) to bound localStorage footprint | VERIFIED | `session-registry.ts:16` `MAX_SESSIONS = 5`. `upsertRegistry` sorts desc by updatedAt, splices off records past index 5, removes their two namespaced data keys (lines 62-71). Session-registry tests: D-09 eviction and D-09 current-tab-never-evicted (test lines 93-145). |
| 7 | Old in-place reset, startup SessionRecoveryModal gate, and beforeunload warning are removed | VERIFIED | `NewProjectModal.tsx` does not exist in session/ directory. No `NewProjectModal` import in App.tsx or anywhere in codebase. No `SessionRecoveryModal` render in App.tsx (grep returns 0). No `beforeunload` in useSession.ts (grep returns 0). No `handleNewProject`, `handleSaveAndNew`, `handleDiscardAndNew`, `handleCancelNewProject` in useSession.ts (grep returns 0). |
| 8 | Existing single-session localStorage data migrates gracefully (no lost in-progress work on upgrade) | VERIFIED (code path) / UNCERTAIN (live browser) | `tab-identity.ts:73-80` — D-06 branch: detects `folio-mapper-session-mapping` or `-input`, generates migratedId, calls `migrateToNamespacedKeys()`, copies both values to namespaced keys, removes legacy keys. tab-identity.test.ts has 3 cases for D-06 (lines 89-136) including both-keys-migrated assertion. Live browser with pre-seeded legacy keys needs human validation. |

**Score:** 7/8 truths fully verified in code + tests; truth #3 (auto-resume) and #8 (migration) have verified code paths but require live browser human validation for production confidence.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/store/tab-identity.ts` | Synchronous tab identity resolver + namespaced key exports | VERIFIED | Exports `resolveTabIdentity`, `tabIdentity`, `MAPPING_KEY`, `INPUT_KEY`, `PLACEHOLDER_TAB_ID`, `mappingKeyFor`, `inputKeyFor`, `tabIdFromMappingKey`. 118 lines, no framework imports. |
| `apps/web/src/store/session-registry.ts` | Registry CRUD with LRU eviction | VERIFIED | Exports `readRegistry`, `upsertRegistry`, `deleteFromRegistry`, `SessionRecord`, `REGISTRY_KEY`, `MAX_SESSIONS`. WR-02 shape validation included. |
| `apps/web/src/store/session-storage.ts` | Debounced storage with onWrite callback | VERIFIED | `createDebouncedStorage(opts?: { onWrite? })` — onWrite fired after successful localStorage.setItem (line 39). Zero-arg backward compat retained. |
| `apps/web/src/store/mapping-store.ts` | Persist under MAPPING_KEY with skipHydration + registry onWrite | VERIFIED | `name: MAPPING_KEY` (line 707), `skipHydration: tabIdentity.isNewTab` (line 709). CR-01 fix: onWrite uses `tabIdFromMappingKey(name)` not frozen `tabIdentity.tabId` (line 160). WR-01 fix: sourceFile from input store (lines 175-177). |
| `apps/web/src/store/input-store.ts` | Persist under INPUT_KEY with skipHydration | VERIFIED | `name: INPUT_KEY` (line 83), `skipHydration: tabIdentity.isNewTab` (line 85). |
| `apps/web/src/hooks/useSession.ts` | Boot resolver, handleNewTab, picker triggers; removals of D-02/D-12 | VERIFIED | `adoptSession()` helper (lines 19-40) shared by boot resolver and picker-resume (WR-06 fix). WR-04 fix: `if (tabIdentity.isNewTab) { setRehydrated(true); return; }` (lines 94-97). |
| `apps/web/src/hooks/useSession.test.ts` | D-12, D-01/D-03, D-07/Pitfall5 tests | VERIFIED | 3 substantive test cases: no-beforeunload (D-12), handleNewTab with window.open (D-01/D-03), auto-resume copies under new tabId (D-07). |
| `apps/web/src/store/tab-identity.test.ts` | D-05, D-06, D-08 boot-path tests | VERIFIED | 9 test cases covering all 4 boot branches + key-construction helpers. |
| `apps/web/src/store/session-registry.test.ts` | D-07 sort, D-09 eviction, D-14 updatedAt, delete | VERIFIED | 12 test cases including eviction, current-tab-never-evicted, sort order, delete, LLM key untouched. |
| `packages/ui/src/components/session/SessionPickerModal.tsx` | Multi-session list picker with Resume/Delete/Start New | VERIFIED | 200 lines. WR-03 fix: Escape closes (line 46-47), focus moves to close button on mount (line 43), Tab trap implemented (lines 50-63). Backdrop click closes (line 73-74). |
| `packages/ui/src/components/layout/Header.tsx` | Always-visible New button + clock picker trigger; no hasActiveSession guard | VERIFIED | `onNewTab` prop (line 8), `onOpenSessionPicker` prop (line 9). No `hasActiveSession`, no `newProjectPopover`, no `onNewProject`. New button rendered when `onNewTab` truthy — no other guard (lines 93-110). |
| `packages/ui/src/components/layout/AppShell.tsx` | onNewTab + onOpenSessionPicker pass-through to Header | VERIFIED | Both props in `AppShellProps` (lines 8-9) and passed through to Header (line 21). |
| `apps/web/src/App.tsx` | handleNewTab on all screens + on-demand SessionPickerModal; NewProjectModal removed | VERIFIED | Mapping screen Header: `onNewTab={session.handleNewTab}` + `onOpenSessionPicker={session.handleOpenSessionPicker}` (lines 721-722). AppShell for input/confirming: same (line 958). Two SessionPickerModal renders (lines 798-810, 993-1004). No SessionRecoveryModal startup gate. |
| `packages/ui/src/index.ts` | Exports SessionPickerModal, not NewProjectModal | VERIFIED | Line 53: `export { SessionPickerModal }`. No NewProjectModal export. SessionRecoveryModal kept as barrel export (file exists as analog/template, not rendered as gate). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tab-identity.ts` | sessionStorage 'folio-tab-id' | getItem/setItem at module load | WIRED | Line 6: `const TABID_SESSIONKEY = 'folio-tab-id'`, used in all 4 boot branches. |
| `session-registry.ts` | localStorage 'folio-mapper-session-registry' | read/upsert/delete | WIRED | Line 15: `REGISTRY_KEY = 'folio-mapper-session-registry'`, used in all 3 functions. |
| `input-store.ts` | `tab-identity.ts` INPUT_KEY | import INPUT_KEY, tabIdentity | WIRED | Confirmed at lines 83, 85 of input-store.ts. |
| `mapping-store.ts` | `tab-identity.ts` MAPPING_KEY | import MAPPING_KEY, tabIdentity | WIRED | Confirmed at lines 707, 709 of mapping-store.ts. |
| `mapping-store.ts` | `session-registry.ts` upsertRegistry | createDebouncedStorage onWrite | WIRED | Lines 154-190: debouncedStorage onWrite calls `upsertRegistry(record)`. CR-01 fix confirmed: derives tabId from `tabIdFromMappingKey(name)`, not frozen constant. |
| `useSession.ts` | `session-registry.ts` readRegistry | boot resolver D-07 | WIRED | Line 8: `import { readRegistry }`, used at line 142 in boot resolver effect. |
| `App.tsx` | `SessionPickerModal` | render gated by session.showSessionPicker | WIRED | Lines 798-810 (mapping screen) + 993-1004 (input/confirming screen). Both fully wired. |
| `Header.tsx` | onNewTab prop | always-rendered New button onClick | WIRED | Lines 93-110: `{onNewTab && <button onClick={onNewTab} ...>New</button>}`. No additional guard. |
| `App.tsx` | `session-registry.ts` readRegistry/deleteFromRegistry | picker onDelete handler | WIRED | Lines 804-805, 999-1000: `deleteFromRegistry(tabId); setPickerSessions(readRegistry())`. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `SessionPickerModal.tsx` | `sessions` prop | `pickerSessions` state in App.tsx, seeded from `readRegistry()` | readRegistry reads localStorage 'folio-mapper-session-registry', populated by onWrite debounce callback from mapping-store | FLOWING |
| `mapping-store.ts` onWrite | `SessionRecord` | `useMappingStore.getState()` + `useInputStore.getState()` | Both real store state reads; sourceFile from `input.parseResult?.source_filename` (WR-01 fix applied) | FLOWING |
| `adoptSession()` resume copy | mapped/input data | `localStorage.getItem(mappingKeyFor(srcTabId))` | Reads real previously-persisted namespaced key | FLOWING (when key exists); STATIC_FALLBACK if key is absent (treated as fresh start, correct behavior) |

---

### Behavioral Spot-Checks

The phase produces frontend React code and Zustand stores — no standalone CLI or API server runnable without the full app stack. Spot-checks are replaced by test suite verification.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tab-identity tests pass | Confirmed passing per REVIEW.md (80 web + 28 ui tests, all green, resolved_commit: 6c316e8) | 80 web + 28 ui | PASS (trust review evidence; full re-run would need build environment) |
| No `NewProjectModal` anywhere | `grep -r NewProjectModal apps/ packages/ --include="*.ts" --include="*.tsx"` | 0 results | PASS |
| No `beforeunload` in useSession | `grep -n beforeunload apps/web/src/hooks/useSession.ts` | 0 results | PASS |
| No `hasActiveSession` guard on New button | `grep hasActiveSession packages/ui/src/components/layout/Header.tsx` | 0 results | PASS |
| CR-01 fix present | `grep -n tabIdFromMappingKey apps/web/src/store/mapping-store.ts` | Line 160: `const activeTabId = tabIdFromMappingKey(name)` | PASS |
| Placeholder guard present | `grep PLACEHOLDER_TAB_ID apps/web/src/store/mapping-store.ts` | Line 163: early return on placeholder | PASS |

---

### Probe Execution

No probe scripts declared or applicable for this phase (frontend-only, no CLI/migration scripts).

---

### Requirements Coverage

Requirements for this phase are the D-* decisions from `03-CONTEXT.md` (no REQUIREMENTS.md file exists — confirmed by the VALIDATION.md note: "Phase 3 has no REQUIREMENTS.md").

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| D-01 | 03-02, 03-03 | New tab opens fresh session | SATISFIED | `handleNewTab` in useSession.ts; `{session.showSessionPicker && <SessionPickerModal>}` in App.tsx |
| D-02 | 03-02, 03-03 | Remove in-place NewProjectModal reset | SATISFIED | NewProjectModal.tsx deleted; App.tsx has 0 references |
| D-03 | 03-02, 03-03 | No confirmation on New | SATISFIED | window.open with no confirm(); unit tested |
| D-04 | 03-01, 03-02 | Per-tab namespaced localStorage | SATISFIED | MAPPING_KEY/INPUT_KEY per-tab; LLM store untouched |
| D-05 | 03-01 | ?new=1 generates fresh tabId | SATISFIED | resolveTabIdentity branch 1; tested |
| D-06 | 03-01 | Legacy data migration | SATISFIED | migrateToNamespacedKeys; 3 test cases |
| D-07 | 03-02 | Auto-resume most-recent session (zero clicks) | SATISFIED (code) | Boot resolver + adoptSession; unit tested; live browser needs human check |
| D-07b | 03-03 | On-demand session picker | SATISFIED | SessionPickerModal; clock-icon trigger; all screens |
| D-08 | 03-01, 03-02 | Refresh reuses tab's own keys | SATISFIED | D-08 branch in resolveTabIdentity; hasIdentity early return in boot resolver |
| D-09 | 03-01 | LRU cap of 5 sessions | SATISFIED | MAX_SESSIONS = 5; eviction tested |
| D-10 | 03-03 | New button visible on all screens | SATISFIED | AppShell forwards onNewTab; mapping-screen Header wired; no hasActiveSession guard |
| D-11 | 03-03 | New button has plus icon + "New" label | SATISFIED | Header.tsx lines 100-109: plus SVG + "New" text |
| D-12 | 03-02 | Remove beforeunload warning | SATISFIED | 0 occurrences in useSession.ts; unit tested |
| D-13 | 03-01 | Session survives browser close (localStorage) | SATISFIED | Persist adapter writes to localStorage (survives close); session-storage.ts uses localStorage.setItem |
| D-14 | 03-01, 03-02 | updatedAt stamped at write time | SATISFIED | onWrite fires after debounced setItem; `now = new Date().toISOString()` inside onWrite callback |

---

### Anti-Patterns Found

No TBD, FIXME, XXX, or HACK markers found in any phase-modified file. "placeholder" occurrences are intentional sentinel values (PLACEHOLDER_TAB_ID constant), not debt markers.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

---

### Human Verification Required

#### 1. "New" Button Visible on Input Screen

**Test:** Open the app in a browser. Confirm a "New" button (plus icon, label "New") is visible in the header on the input screen before any file upload or mapping is loaded.

**Expected:** Button renders immediately, with no gate condition based on whether a session is active.

**Why human:** The button is gated by `{onNewTab && ...}` in Header.tsx. The onNewTab prop is wired through AppShell in the input/confirming path. Grep confirms the prop is passed at the AppShell call site, but visual confirmation that it appears in the live DOM is required.

#### 2. "New" Button Opens a Fresh Tab Instantly

**Test:** From the input screen, click the "New" button. Observe whether a new browser tab opens with a fresh empty session, and whether the original tab is untouched.

**Expected:** New tab opens immediately with an empty app state. No confirmation dialog appears. Original tab retains its data.

**Why human:** `window.open` and tab isolation cannot be verified programmatically in unit tests.

#### 3. Auto-Resume on Browser Reopen (Zero Clicks)

**Test:** Work on a session in Tab A (add some mappings). Close the entire browser. Reopen the app URL in a fresh tab. Confirm the previous session is silently resumed with no recovery modal or prompt.

**Expected:** Session content appears immediately. No picker, no modal, no click required.

**Why human:** The auto-resume path involves the boot resolver running in a useEffect after Zustand persist rehydration. Timing, Zustand persist callbacks, and localStorage reads are covered by unit tests, but the live browser end-to-end flow requires human validation.

#### 4. Picker Delete Removes Row Without Reopening

**Test:** With at least two saved sessions, open the session picker (clock icon). Delete one session entry. Confirm the row disappears from the open picker without closing and reopening it.

**Expected:** Deleted row vanishes immediately; picker stays open showing remaining sessions.

**Why human:** Requires visual confirmation that `setPickerSessions(readRegistry())` triggers React re-render and removes the row visibly in the live UI.

#### 5. Multi-Tab Isolation (Two Live Tabs)

**Test:** Open the app in Tab A and work on a session. Open a new tab via the "New" button (Tab B) and do some different work. Wait more than 5 seconds (debounce interval). Check Tab A's session picker — confirm Tab B's session appears as a separate entry, not merged.

**Expected:** Two distinct registry entries. Neither tab's work overwrites the other.

**Why human:** Multi-tab storage isolation is the core safety guarantee of the phase. Requires two simultaneous live browser tabs to verify.

#### 6. Legacy Migration on Upgrade

**Test:** Manually set `localStorage['folio-mapper-session-mapping'] = '<some JSON>'` and `localStorage['folio-mapper-session-input'] = '<some JSON>'` in a browser's devtools console, then reload the page. Confirm the session is recovered, the old keys are removed, and namespaced keys appear.

**Expected:** Session content loads; legacy keys `folio-mapper-session-mapping` and `folio-mapper-session-input` are absent; namespaced keys `folio-mapper-session-<uuid>-mapping` and `-input` contain the migrated data.

**Why human:** Migration runs once at module load on the first boot that encounters legacy keys. Requires a real browser with pre-seeded keys to confirm no data loss.

---

### Gaps Summary

No gaps blocking goal achievement were found. All 8 success criteria have verified code paths and substantive implementations. The 6 human verification items above are live-browser behavioral checks that cannot be verified programmatically — they are required before the phase can be marked `passed`.

The critical CR-01/CR-02 review blocker (registry using stale module-level tabIdentity.tabId) is confirmed fixed: `mapping-store.ts` onWrite now calls `tabIdFromMappingKey(name)` to derive the active tabId from the live persist key, and guards against the placeholder sentinel. The `adoptSession()` helper in `useSession.ts` consolidates the duplicate resume logic (WR-06). The `SessionPickerModal` implements Escape-to-close, focus-on-open, and Tab trapping (WR-03). `readRegistry` validates parsed JSON shape before use (WR-02). The `rehydrated` gate handles skipHydration for ?new=1 tabs (WR-04).

---

_Verified: 2026-05-22_
_Verifier: Claude (gsd-verifier)_
