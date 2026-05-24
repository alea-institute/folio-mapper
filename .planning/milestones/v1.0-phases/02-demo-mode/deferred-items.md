# Deferred Items — Phase 02 (Demo Mode)

Items discovered during execution that are OUT OF SCOPE for the current plan and tracked here for future cleanup.

## Pre-existing TypeScript errors (discovered in 02-01)

Running `npx tsc --noEmit` from `packages/ui/` surfaces several pre-existing type errors unrelated to demo-mode work. They were present before Plan 02-01 started and are NOT touched by Demo Mode changes. None originate from `ExemplarPanel.tsx` or any file modified in this phase.

Files with pre-existing errors:
- `packages/ui/src/components/mapping/graph/EntityGraph.tsx` — implicit-any parameter
- `packages/ui/src/components/mapping/graph/useELKLayout.ts` — missing `EntityGraphResponse` export from `@folio-mapper/core`; many implicit-any params and untyped `{}` property accesses
- `packages/ui/src/components/settings/LLMSettings.tsx` — comparison-no-overlap errors on `keySource` union
- `packages/ui/src/components/settings/ProviderCard.tsx` — comparison-no-overlap errors on `keySource` union

The plan's verification step `pnpm -w typecheck` is also non-existent (no such script in the workspace root `package.json`). Suggested follow-up: either fix the pre-existing errors and add a `typecheck` script, or document the actual gate (`pnpm test` per package). Out of scope for Phase 02; flag for a tooling-hardening pass.
