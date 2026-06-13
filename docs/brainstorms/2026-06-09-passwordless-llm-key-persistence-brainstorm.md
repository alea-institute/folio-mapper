# Brainstorm: Passwordless LLM API Key Persistence

**Date:** 2026-06-09
**Status:** Ready for planning
**Author:** Damien Riehl (with Claude)

## What We're Building

Replace folio-mapper's passphrase-protected browser key vault with a **passwordless,
encrypted-at-rest** persistence scheme so the user can paste an LLM API key **once**
and have it silently restored every session — no password to create, no password to
re-enter. Inspired by the frictionless experience in the `folio-enrich` repo, but
adapted to folio-mapper's browser-centric, "never store keys server-side" architecture.

**Concrete user goals:**
1. No "create a password" step.
2. No "re-enter password every session" step.
3. Enter the key once → it persists across sessions.
4. Still relatively secure (encrypted at rest).

## Why This Approach (Device-Key Encrypted Browser Persistence)

Chosen over two alternatives:
- **Server-side (folio-enrich-style):** most faithful to what the user likes, but reverses
  folio-mapper's deliberate "keys never persisted server-side / sent via headers" hardening,
  is fragile on Railway DEV (ephemeral FS resets on redeploy), and exposes raw keys if the
  internet-facing PROD box is compromised. Larger refactor.
- **Plaintext localStorage:** simplest, but keys sit unencrypted on disk — fails the
  "relatively secure" goal.

The **device-key** approach wins because it:
- Removes *both* friction points exactly (no passphrase create, no re-entry).
- Keeps keys encrypted at rest.
- Is the **smallest delta** — the AES-GCM vault already exists (`packages/core/src/llm/key-vault.ts`);
  we swap the PBKDF2-from-passphrase key for an auto-generated, non-extractable device key and
  auto-unlock on load.
- Behaves **identically on Railway DEV and AWS PROD** (no server-side storage involved).
- Preserves the existing security posture: keys still travel per-request via headers and are
  never written to the server.

## How It Works (high level — details belong in the plan)

- On first key entry, generate (once) a **non-extractable AES-GCM `CryptoKey`** and persist its
  handle in **IndexedDB**. The raw key bytes are never exposed to JS.
- Encrypt each provider's API key with that device key → store ciphertext in `localStorage`
  (reuse existing `VaultPayload` shape: salt/iv/cipher).
- On app load, `useKeyResolution` silently loads the device key from IndexedDB, decrypts each
  stored key, and hydrates `llm-store`. **No passphrase modal.**
- This replaces **Layer 3 (browser vault)** in the existing 4-layer resolver
  (env → OS keychain → browser vault → manual). Layers 1, 2, 4 are untouched.
- Desktop build is unaffected — it already uses the OS keychain (Electron `safeStorage`),
  which is passwordless and more secure; the device-key path is the **web** fallback.

## Key Decisions

- **Surface:** Both DEV (Railway) and PROD (openlegalstandard.org / AWS) are confirmed
  **single-user** web deployments — so per-browser persistence is sufficient; no multi-user
  key-isolation concerns.
- **Storage split:** device key handle → IndexedDB (non-extractable); encrypted key payloads →
  localStorage. Keeps the unlock secret separate from the ciphertext.
- **No server-side key storage:** maintains the existing hardening rule; keys continue to be
  sent per-request via headers.
- **Desktop keychain stays:** no change to the Electron `safeStorage` path.

## Resolved Questions

- **Q: Migrate existing passphrase-vault users?**
  A: On next successful key use, re-encrypt under the device key and remove the old
  canary/passphrase artifacts. The passphrase modal is deleted. No forced re-entry unless
  the old vault can't be auto-read (then fall back to manual entry).
- **Q: What if IndexedDB or localStorage is partially cleared?**
  A: Decrypt fails gracefully → treat as "no saved key" → user re-enters (same failure mode as
  folio-enrich losing an env var). No crash, no password prompt.
- **Q: Server-side vs client-side, given single-user?**
  A: Client-side device-key chosen — avoids Railway ephemerality, avoids exposing keys on the
  internet-facing PROD box, and is the smaller change.

## Open Questions

_None blocking. Implementation specifics (exact IndexedDB schema, "forget saved keys" UX
affordance, whether to also offer a manual export/import) to be decided in the plan._

## Next

Run `/ce:plan` when ready to implement.
