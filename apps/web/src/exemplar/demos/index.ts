// Static ES-module imports of curated demo payloads. Tree-shakable; no network.
// Per Phase 2 CONTEXT decision: in-app static imports under apps/web/src/exemplar/demos/.
import personalInjuryDemo from './personal-injury.demo.json';

/**
 * A curated demo session payload. Conforms to SessionFile (see
 * packages/core/src/session/index.ts) PLUS two snapshot fields used by the
 * version-mismatch banner (Plan 02-03).
 */
export interface DemoPayload {
  // Sentinel: this is a partial of SessionFile — full validation runs in
  // validateSession() at load time. We do not duplicate the SessionFile
  // shape here to avoid drift.
  version: string;
  pipeline_version?: string;
  folio_version?: string;
  [key: string]: unknown;
}

export const DEMO_PAYLOADS: Record<string, DemoPayload> = {
  'personal-injury': personalInjuryDemo as DemoPayload,
};

export function getDemoPayload(slug: string): DemoPayload | null {
  return DEMO_PAYLOADS[slug] ?? null;
}

/** Slugs for which a demo payload is bundled. Use to gate the Demo button per card. */
export const DEMO_AVAILABLE_SLUGS: ReadonlySet<string> = new Set(Object.keys(DEMO_PAYLOADS));

/**
 * Runtime app version, baked in via Vite `define: __APP_VERSION__` from
 * apps/desktop/package.json (the project's source-of-truth version per
 * MEMORY.md). Compared against a demo payload's `pipeline_version` to detect
 * drift. Falls back to 'unknown' if the define is missing (e.g. running under
 * vitest without the define).
 */
export const RUNTIME_PIPELINE_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';

export interface VersionVector {
  payloadPipelineVersion: string | null;
  payloadFolioVersion: string | null;
  runtimePipelineVersion: string | null;
  runtimeFolioVersion: string | null;
}

/**
 * Pure version-drift detector. Returns the input vector unchanged when any
 * comparable pair of versions disagrees, or null when nothing is comparable
 * or everything matches. Inputs that are null on either side are treated as
 * "cannot determine" — we never fire the banner on missing data.
 */
export function detectStalePreset(args: VersionVector): VersionVector | null {
  const {
    payloadPipelineVersion,
    payloadFolioVersion,
    runtimePipelineVersion,
    runtimeFolioVersion,
  } = args;
  const pipelineStale =
    payloadPipelineVersion !== null &&
    runtimePipelineVersion !== null &&
    payloadPipelineVersion !== runtimePipelineVersion;
  const folioStale =
    payloadFolioVersion !== null &&
    runtimeFolioVersion !== null &&
    payloadFolioVersion !== runtimeFolioVersion;
  return pipelineStale || folioStale ? args : null;
}

/**
 * Best-effort runtime FOLIO version probe. The backend does not currently
 * expose owl_version, so this resolves to null and the staleness check skips
 * the FOLIO comparison (banner still fires on pipeline-version mismatch).
 * Kept as an async helper so a future backend endpoint can plug in here
 * without changing callers.
 */
export async function fetchRuntimeFolioVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/embedding/status');
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const v = json.folio_version;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}
