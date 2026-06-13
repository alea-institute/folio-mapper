---
title: Passwordless LLM API Key Persistence (Device-Key Vault)
type: feat
status: completed
date: 2026-06-13
origin: docs/brainstorms/2026-06-09-passwordless-llm-key-persistence-brainstorm.md
---

# ✨ Passwordless LLM API Key Persistence (Device-Key Vault)

## Overview

Remove the passphrase ceremony from folio-mapper's web key persistence. Today a user must
(1) **create a passphrase** the first time they save a key and (2) **re-enter that passphrase
every session** to unlock it. This plan replaces the passphrase-derived encryption key with an
**auto-generated, non-extractable AES-256-GCM `CryptoKey`** stored in IndexedDB, so a validated
key is **silently encrypted once and silently restored every session** — no password, ever, while
still being encrypted at rest.

Per-decision (see brainstorm: `docs/brainstorms/2026-06-09-passwordless-llm-key-persistence-brainstorm.md`),
this is the **device-key encrypted browser** approach, chosen over a folio-enrich-style server-side
store (reverses the "never persist keys server-side" hardening; fragile on Railway DEV) and over
plaintext localStorage (fails "relatively secure").

## Problem Statement / Motivation

The current flow (`apps/web/src/App.tsx:247-288`, `useKeyResolution.ts:69-108`,
`packages/ui/src/components/settings/PassphraseModal.tsx`):

- **Create friction:** `handleRememberKey` → `setShowCreatePassphrase(true)` → `PassphraseModal mode="create"`
  forces an 8+ char passphrase + confirm before the first key can be saved.
- **Unlock friction:** on every load, `useKeyResolution` sees `hasCanary()` and sets
  `needsPassphrase`, rendering the unlock modal (`App.tsx:773`, `App.tsx:972`). The user re-types
  the passphrase or loses their saved keys for the session.

Both deployments (DEV Railway, PROD openlegalstandard.org / AWS) are **single-user**, so per-browser
persistence is sufficient and there is no multi-user key-isolation requirement
(see brainstorm: Key Decisions).

## Proposed Solution

Keep the existing AES-256-GCM envelope and localStorage layout (`VaultPayload`, `VAULT_PREFIX`,
vault meta). Swap **only the key source**: instead of `PBKDF2(passphrase, salt)`, derive the
AES key from a **device key** generated once via `crypto.subtle.generateKey({name:'AES-GCM',
length:256}, /* extractable */ false, ['encrypt','decrypt'])` and persisted as a non-extractable
`CryptoKey` object in IndexedDB. The raw bytes never exist in JS or localStorage; only the
encrypted key payloads sit in localStorage.

**Save default = auto-persist (ON).** A key that passes a connection test is silently saved
(device-key encrypted). The `rememberKey` flag defaults to `true` and the explicit checkbox is
replaced by a "Forget key" / "Forget all saved keys" affordance (the existing
`handleClearSavedKey` / `handleClearAllSavedKeys` already implement the clearing logic).

**Layers untouched:** the 4-layer resolver order stays env → OS keychain → browser vault →
manual. Only **Layer 3 (browser vault)** changes from passphrase-unlock to silent device-key
decrypt. Desktop (Electron `safeStorage` keychain) is unaffected.

## Technical Approach

### Architecture

```
                          ┌─────────────────────────────────────┐
  user pastes key  ──────▶│ ProviderCard  (Settings)            │
  + connection test pass  └───────────────┬─────────────────────┘
                                          │ auto-persist (rememberKey=true)
                                          ▼
   App.tsx handleRememberKey ── encryptKeyDevice(key) ──┐
                                                        ▼
                              packages/core/src/llm/device-key.ts
                              getOrCreateDeviceKey() ──▶ IndexedDB
                                                        (non-extractable CryptoKey)
                                          │
                                          ▼
                              storeEncryptedKey(provider, payload)  ──▶ localStorage
                                                                        (VaultPayload JSON)

  ── on app load ──
   useKeyResolution (Layer 3, web only):
     getVaultMeta() ▶ loadEncryptedKey(p) ▶ decryptKeyDevice(payload) ▶ updateConfig({apiKey})
     (silent — NO passphrase modal)
```

### Crypto / storage details

- **IndexedDB**: DB `folio-mapper-keyvault`, object store `device-key`, single record key `aesKey`.
  Store the `CryptoKey` object directly (structured clone preserves non-extractable keys in all
  Chromium/Firefox/WebKit engines and Electron). No raw key material is serialized.
- **Envelope unchanged**: random 12-byte IV per encryption; `VaultPayload { iv, cipher }`. The
  `salt` field becomes vestigial — keep it optional in the type for backward-compat of any
  on-disk JSON, but device-key encryption no longer uses it.
- **Failure modes are graceful**: if IndexedDB is cleared (key gone) or a payload is corrupt,
  `decryptKeyDevice` rejects → resolver skips that provider → key source falls to `none` → user
  re-enters once. No crash, no prompt.

### New / changed surface

| File | Change |
|------|--------|
| `packages/core/src/llm/device-key.ts` | **NEW.** `getOrCreateDeviceKey()`, `hasDeviceKey()`, `clearDeviceKey()`. Promise-wrapped IndexedDB helpers. |
| `packages/core/src/llm/key-vault.ts` | Add `encryptKeyDevice(plaintext)`, `decryptKeyDevice(payload)`. Mark `encryptKey/decryptKey(passphrase)`, `storeCanary/validateCanary/hasCanary` as **legacy** (kept only for one-time cleanup detection, or removed — see Migration). Keep `storeEncryptedKey/loadEncryptedKey/removeEncryptedKey/getVaultMeta/clearVault` as-is. |
| `packages/core/src/index.ts` | `export * from './llm/device-key'`. |
| `packages/core/src/llm/types.ts` | `VaultPayload.salt` → optional. `rememberKey` stays. `KeySource` already has `'saved'`. |
| `apps/web/src/hooks/useKeyResolution.ts` | Layer 3 becomes **silent device decrypt**. Remove `needsPassphrase`, `unlockVault`, `dismissPassphrase`. Add one-time legacy-canary cleanup. |
| `apps/web/src/App.tsx` | Delete `vaultPassphraseRef`, `showCreatePassphrase`, `pendingSaveProviderRef`, `handleCreatePassphrase`, and both `keyResolution.needsPassphrase` modal renders (~`:773`, `:972`) + create-passphrase render. Simplify `handleRememberKey` to `encryptKeyDevice → storeEncryptedKey → setKeySource('saved')`. Wire auto-persist on validated key. Optionally `clearDeviceKey()` inside `handleClearAllSavedKeys`. |
| `packages/ui/src/components/settings/PassphraseModal.tsx` | **DELETE.** Remove its export from `packages/ui/src/index.ts`. |
| `packages/ui/src/components/settings/ProviderCard.tsx` | Replace the "Remember key" checkbox (`:201`) with a "Saved ✓ / Forget key" affordance; `rememberKey` defaults `true`. |
| `packages/ui/src/components/settings/LLMSettings.tsx` | Adjust the unsaved-key warning logic (`:192`) now that saving is automatic. |
| `apps/web/src/store/llm-store.ts` | `makeDefaultConfigs` `rememberKey: true`. Keep `partialize` stripping `apiKey` (encrypted copy lives only in the vault). |
| `packages/core/src/llm/device-key.test.ts` | **NEW.** Uses `fake-indexeddb`. |
| `packages/core/src/llm/key-vault.test.ts` | Update for device functions; drop passphrase-only cases that are removed. |
| `package.json` (workspace/core) | Add `fake-indexeddb` (**dev**, approved). |

### Migration (legacy passphrase vault)

The legacy vault is, by design, undecryptable without the passphrase we are removing, so silent
re-encryption is impossible (see brainstorm: Resolved Questions). On first load, if a legacy
canary (`folio-mapper-vault-canary`) is present, **clear the legacy vault + canary once** and let
the user re-enter each key a single time (it then persists passwordlessly). Surface a one-time,
non-blocking toast: "Saved keys are now passwordless — re-enter your key once and it'll stick."

## System-Wide Impact

- **Interaction graph:** `ProviderCard` test-connection → store `connectionStatus='valid'` →
  auto-persist effect → `encryptKeyDevice` → `getOrCreateDeviceKey` (IndexedDB) → `storeEncryptedKey`
  (localStorage). On load: `App` mounts → `useKeyResolution` effect → Layer 1 `fetchKeyStatus`
  (env) → Layer 2 keychain (desktop) → Layer 3 device decrypt → `updateConfig`/`setKeySource`.
- **Error propagation:** all vault/IDB calls are `try/catch` → skip provider, never throw to render.
  `getOrCreateDeviceKey` failure (e.g., IDB blocked in private mode) → fall back to **session-only
  manual** (current behavior when nothing is saved).
- **State lifecycle risks:** auto-persist must fire **only on a validated, non-empty key** and must
  be **debounced/idempotent** (re-encrypting the same key on every render is wasteful and races the
  store). Guard on `connectionStatus === 'valid' && apiKey && keySource !== 'saved'`.
- **API surface parity:** `handleClearSavedKey` / `handleClearAllSavedKeys` already cover both
  desktop (keychain) and web (vault) — extend web-clear to also `clearDeviceKey()` on "clear all".
- **Demo cost-safety:** unaffected — `resolveLlmConfig` still returns `null` for demo sessions
  (`apps/web/src/lib/llm-config.ts:18`). Auto-loading a key into the store does **not** bypass the
  demo guard (see memory: Demo cost-safety, `project_demo_cost_safety`). Add a regression test
  asserting a saved key + demo session still yields `null`.
- **Integration scenarios unit tests miss:** (1) save → reload page → key auto-restored without
  prompt; (2) reload with IndexedDB cleared but localStorage intact → graceful re-entry; (3) legacy
  canary present → one-time cleanup + re-entry; (4) desktop build → keychain still wins, vault path
  skipped; (5) demo session with a saved key → zero live calls.

## Acceptance Criteria

### Functional
- [x] Saving an LLM key never shows a passphrase/password prompt (create or unlock).
- [x] A validated key auto-persists (device-key encrypted) with no checkbox interaction.
- [x] Reloading the app silently restores saved keys; provider shows `keySource = 'saved'`.
- [x] "Forget key" (per provider) and "Forget all saved keys" remove the encrypted payload(s);
      "Forget all" also clears the device key from IndexedDB.
- [x] Legacy passphrase vault is detected once, cleared, and the user re-enters keys a single time.
- [x] Desktop build still uses the OS keychain; the vault path is skipped (`window.desktop`).

### Non-Functional / Security
- [x] Device key is generated `extractable: false`; raw key material never appears in JS or localStorage.
- [x] API keys never persist in the zustand-persisted `folio-mapper-llm` blob (only in the vault).
- [x] IndexedDB/localStorage failures degrade to session-only manual entry without errors in the UI.
- [x] Demo sessions remain zero-token with a saved key present.

### Quality Gates
- [x] New `device-key.test.ts` (with `fake-indexeddb`) covers generate-once, persistence, clear.
- [x] `key-vault.test.ts` updated for `encryptKeyDevice`/`decryptKeyDevice` round-trip + tamper-fail.
- [x] `llm-config` demo-guard regression test added.
- [x] `pnpm test` (vitest, 146 tests) + `pnpm build` (vite) pass; no dangling `PassphraseModal` imports.
      (Repo has no eslint config and does not tsc-clean pre-existing; touched files are tsc-clean. Browser
      screenshot not possible — no X server in this environment.)

## Success Metrics
- Zero passphrase prompts across a save→reload→reuse cycle.
- One key entry per provider per browser, persisting indefinitely until "Forget".

## Dependencies & Risks
- **New dev dependency:** `fake-indexeddb` (approved). Dev-only; no runtime impact.
- **Risk — private/incognito IndexedDB:** some browsers restrict IDB; mitigated by graceful
  fallback to session-only manual entry.
- **Risk — security posture shift:** auto-persist-by-default stores a (encrypted) secret without
  explicit opt-in, and the device-key scheme drops the passphrase "second factor." Accepted per
  user goal ("enter once, persist, relatively secure"); mitigated by non-extractable key + clear
  "Forget" controls + honest in-UI copy about browser-bound storage.
- **Risk — auto-persist races/loops:** mitigated by the idempotent guard above.

## Implementation Phases

### Phase 1: Core device-key + vault (no UI) ✅
- [x] Add `device-key.ts`; add `encryptKeyDevice`/`decryptKeyDevice`; export; make `salt` optional.
- [x] Add `fake-indexeddb` dev dep; write `device-key.test.ts` + update `key-vault.test.ts`.

### Phase 2: Resolver + App wiring ✅
- [x] Rewrite Layer 3 in `useKeyResolution.ts` (silent decrypt; drop passphrase API; legacy cleanup).
- [x] Simplify `App.tsx` (remove passphrase state/modals/handlers; auto-persist on validated key;
  `clearDeviceKey()` on clear-all).

### Phase 3: UI cleanup ✅
- [x] Delete `PassphraseModal.tsx` + export; remove ProviderCard pre-test "Remember key" checkbox
  (auto-persist replaces it); default `rememberKey: true`; add one-time migration notice banner.

### Phase 4: Verify ✅
- [x] Unit suite (146) + production build green. Browser walkthrough blocked by no X server;
  device-key runtime path is covered by `fake-indexeddb` tests instead.

## Alternative Approaches Considered
- **Server-side store (folio-enrich parity):** rejected — reverses no-server-side-keys hardening,
  fragile on Railway DEV, exposes keys on internet-facing PROD (see brainstorm).
- **Plaintext localStorage:** rejected — fails "relatively secure" (see brainstorm).

## Sources & References

### Origin
- **Brainstorm:** [docs/brainstorms/2026-06-09-passwordless-llm-key-persistence-brainstorm.md](../brainstorms/2026-06-09-passwordless-llm-key-persistence-brainstorm.md)
  — carried forward: device-key approach chosen over server-side/plaintext; both deployments
  single-user; keep "never store keys server-side"; auto-migrate legacy vault on next use.
  Decided during planning: **auto-persist default ON**; **add `fake-indexeddb`**.

### Internal References
- Existing vault: `packages/core/src/llm/key-vault.ts`
- Resolver (4-layer): `apps/web/src/hooks/useKeyResolution.ts`
- Save/clear handlers + modals: `apps/web/src/App.tsx:226-319`, `:773`, `:972`
- Passphrase UI (to delete): `packages/ui/src/components/settings/PassphraseModal.tsx`
- Store persistence/partialize: `apps/web/src/store/llm-store.ts:75-105`
- Demo guard: `apps/web/src/lib/llm-config.ts:18`
- Desktop keychain: `apps/desktop/src/preload.ts`, `apps/desktop/src/main.ts`

### External References
- MDN — `SubtleCrypto.generateKey` (non-extractable keys): https://developer.mozilla.org/docs/Web/API/SubtleCrypto/generateKey
- Storing non-extractable `CryptoKey` in IndexedDB (structured clone): https://developer.mozilla.org/docs/Web/API/Web_Crypto_API
- `fake-indexeddb`: https://github.com/dumbmatter/fakeIndexedDB
