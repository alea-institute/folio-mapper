# Phase 3: New (Fresh Session in New Tab) - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Replicate the folio-enrich "New" button in folio-mapper: a header button that **opens a fresh browser tab** with a brand-new, empty session, leaving the current tab and its work fully intact.

This **replaces** folio-mapper's existing in-place "New Project" reset (and its `NewProjectModal` Save/Discard/Cancel popover). To make multi-tab safe, session persistence becomes **per-tab namespaced** (today it is a single shared `localStorage` session), and recovery on a fresh tab is handled by a new **session picker**.

**In scope:** new-tab "New" button (always visible), per-tab session namespacing, session-picker recovery UI, LRU cleanup of stored sessions, removal of the old in-place reset popover and the `beforeunload` warning.

**Out of scope:** live cross-tab sync (editing tab A reflecting in tab B in real time), server-side session storage, changing the export/file-load session format, demo-mode behavior.

</domain>

<decisions>
## Implementation Decisions

### Button Behavior
- **D-01:** "New" opens a **fresh browser tab** (folio-enrich pattern: `window.open(pathname + '?new=1', '_blank')`), current tab untouched. This **replaces** the existing in-place reset behavior.
- **D-02:** **Delete** the `NewProjectModal` Save/Discard/Cancel popover and the `handleNewProject` / `handleSaveAndNew` / `handleDiscardAndNew` in-place-reset flow in `useSession.ts` — no longer needed since opening a new tab is non-destructive.
- **D-03:** Clicking "New" is **instant** — no confirmation prompt.

### Session Isolation
- **D-04:** Sessions become **persistent & recoverable per tab.** Each tab persists its own session under a namespaced `localStorage` key; no tab can clobber another tab's saved work.
- **D-05:** Tab identity rides in **`sessionStorage`** (survives refresh within a tab, dies on tab close). On `?new=1`, generate a new tab identity, start fresh, and strip the query param via `history.replaceState` (folio-enrich pattern).
- **D-06:** Existing single-session localStorage data should be **migrated/adopted** gracefully into the new namespaced model so current users don't lose in-progress work on upgrade. (Researcher to confirm migration approach.)

### Recovery
- **D-07:** **Auto-resume on return.** When the user returns to the app after a full browser close/reboot (a brand-new tab with no `sessionStorage` tab identity) and saved sessions exist, the system **automatically restores the most-recently-active session** — the user lands directly in it with everything already mapped. **Zero clicks, no recovery-modal gate.** (This refines the earlier "show a picker on return" decision: auto-resume is the default; the picker is on-demand — see D-07b.)
- **D-07b:** The **session picker** still ships, but as an **on-demand affordance** reachable from the header (e.g., an "Open recent / Switch session" control near the "New" button). It lists all saved sessions with metadata (created date, progress, item counts) → **Resume / Start New / Delete** per entry. It is NOT a forced gate on app load.
- **D-08:** A **refresh within an existing tab** recovers that tab's own session directly (via its `sessionStorage` tab identity).
- **D-13:** **Persistence survives full browser close/reboot.** Session data lives in `localStorage` (not `sessionStorage`), so a complete browser shutdown and reboot does not lose mapped work; on next visit to the page (e.g., `mapper.openlegalstandard.org`) the most-recent session is auto-restored per D-07. (`sessionStorage` is used only for the per-tab *identity* pointer, which is intentionally allowed to die on tab/browser close — falling back to D-07 most-recent auto-resume.)

### Cleanup / Lifecycle
- **D-09:** Cap stored sessions at **~5** (LRU): when exceeded, evict the **least-recently-active** session. Keeps the localStorage footprint predictable and the picker manageable. (folio-mapper sessions are large — candidate lists, judge annotations — against a ~5–10 MB localStorage budget.)

### Placement & Label
- **D-10:** The "New" button is **always visible** — on the input, confirming, AND mapping screens. Requires surfacing it on the input/confirming layouts, which do **not** currently render the `Header` component.
- **D-11:** Label is **"New"** with the existing **plus icon** (consistent with both folio-enrich and current folio-mapper).

### beforeunload Warning
- **D-12:** **Remove** the existing `beforeunload` "Leave site?" warning in `useSession.ts` — redundant now that every tab auto-saves and is recoverable via the picker.

### Claude's Discretion
- Exact namespaced-key scheme and tab-id generation (uuid vs counter).
- Session picker visual design (modal vs full-screen) — should reuse existing modal patterns (`SessionRecoveryModal`) for consistency.
- The on-demand entry point for the session picker (D-07b) — dropdown near "New", a "Recent sessions" header control, etc.
- Where/how the always-visible "New" button mounts on input/confirming screens (shared mini-header vs adding to each layout).
- "Most-recently-active" tiebreak metric for auto-resume (last-modified timestamp vs last-opened timestamp) — track an `updatedAt`/`lastOpenedAt` per session.
- The existing startup `SessionRecoveryModal` is **replaced** by silent auto-restore (D-07) plus the on-demand picker (D-07b); it no longer gates app load.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external ADRs/specs exist for this feature — requirements are captured in the decisions above. The key reference is the source pattern (folio-enrich) and the existing folio-mapper session machinery being modified.

### Source Pattern (folio-enrich — separate repo, READ-ONLY reference)
- `/home/damienriehl/Coding Projects/folio-enrich/frontend/index.html` (~lines 3007–3012) — the "New" button: `onclick="window.open(window.location.pathname+'?new=1','_blank')"`
- `/home/damienriehl/Coding Projects/folio-enrich/frontend/index.html` (~lines 3593–3595) — `?new=1` detection + `sessionStorage` clear + `history.replaceState` to strip the param

### folio-mapper code being modified (this repo)
- `apps/web/src/hooks/useSession.ts` — current session lifecycle: `clearStores()`, `handleNewProject`, recovery modal trigger, `beforeunload` handler, Ctrl+S save. The in-place reset flow (D-02) and `beforeunload` (D-12) are removed/reworked here.
- `apps/web/src/store/session-storage.ts` — debounced localStorage adapter (`DEBOUNCE_MS = 5000`, `createDebouncedStorage()`); per-tab namespacing (D-04/D-05) lands here.
- `apps/web/src/store/input-store.ts` — `reset()`, persisted fields (`screen`, `textInput`, `parseResult`), key `folio-mapper-session-input`.
- `apps/web/src/store/mapping-store.ts` — `resetMapping()`, persisted mapping state, key `folio-mapper-session-mapping`.
- `apps/web/src/store/llm-store.ts` — key `folio-mapper-llm`; **intentionally NOT part of per-session reset** (LLM settings persist across new sessions).
- `packages/ui/src/components/layout/Header.tsx` (~lines 95–115) — current "New" button location; becomes the new-tab button (D-01) and must be made always-visible (D-10).
- `packages/ui/src/components/session/NewProjectModal.tsx` — popover to **delete** (D-02).
- `packages/ui/src/components/session/SessionRecoveryModal.tsx` — recovery modal; template/pattern for the new **session picker** (D-07).
- `apps/web/src/App.tsx` (~lines 698–727, 990–1109) — screen routing (`'input' | 'confirming' | 'mapping'`), Header wiring; the always-visible button (D-10) and `?new=1` startup detection wire in here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SessionRecoveryModal`** (`packages/ui/src/components/session/SessionRecoveryModal.tsx`): full-screen overlay with session metadata (created date, progress, counts) and Resume/Start-Fresh/Download buttons — strong template for the new **session picker** (extend from single-session to a list).
- **`createDebouncedStorage()`** (`session-storage.ts`): the persist adapter; namespacing keys per tab plugs in here cleanly.
- **`resetMapping()` / `reset()`** (mapping + input stores): already provide clean-slate state — reuse for "Start New" in the picker.
- **Existing "New" button JSX + plus-icon SVG** (`Header.tsx`): repurpose for the new-tab action.

### Established Patterns
- **Zustand `persist` middleware** with `partialize` (see `llm-store.ts`) — namespaced per-tab storage must respect what each store persists; LLM store stays global (not per-tab).
- **localStorage keys**: `folio-mapper-session-mapping`, `folio-mapper-session-input` (per-tab namespaced after this phase), `folio-mapper-llm` (stays global).
- **Header only renders on the mapping screen today** — D-10 (always-visible) requires a deliberate change to input/confirming layouts.
- **Recovery currently fires on app startup** when localStorage has a session; this becomes the picker (no-identity tab) vs direct-recover (refreshed tab) branch.

### Integration Points
- **App startup** (`App.tsx`): detect `?new=1` → fresh tab + strip param; else resolve tab identity from `sessionStorage` → direct recover or show picker.
- **Header → all three screens**: surface the always-visible "New" button.
- **Persist layer**: route reads/writes through the per-tab namespaced key; enforce LRU cap (D-09) on write.

</code_context>

<specifics>
## Specific Ideas

- Match folio-enrich exactly on the open mechanism: `window.open(window.location.pathname + '?new=1', '_blank')`, then on load `if (params.has('new')) { /* fresh */ history.replaceState(null,'',pathname) }`.
- Session picker should show enough to distinguish sessions at a glance: created date, % complete, completed/skipped/total item counts (the same metadata `SessionRecoveryModal` already surfaces).

</specifics>

<deferred>
## Deferred Ideas

- **Live cross-tab sync** (real-time reflection of edits between open tabs) — out of scope; per-tab isolation is the explicit model here. Future phase if ever needed.
- **Server-side / cloud session storage** — out of scope; persistence stays client-side localStorage.
- **Session rename / labeling in the picker** — nice-to-have for distinguishing sessions beyond date/progress; defer unless picker UX needs it.

</deferred>

---

*Phase: 3-new-session*
*Context gathered: 2026-05-22*
