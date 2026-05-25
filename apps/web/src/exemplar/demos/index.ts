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

// New areas: lazy-loaded on demand (Vite splits each into its own chunk).
// Each entry will be resolved when the corresponding {slug}.demo.json file
// is committed. Until then, getDemoPayload catches the ModuleNotFoundError and
// returns null — falling through to lean mode.
//
// Implementation note: import() uses a template literal rather than a static
// string so that Vite's vite:import-analysis plugin cannot statically resolve
// the module paths before the JSON files are committed. Vite treats template-
// literal dynamic imports as truly runtime-dynamic and does not attempt to
// validate that the files exist at transform time. Each slug's import() will
// split into its own lazy chunk once the corresponding JSON is committed.
const _mkLoader =
  (slug: string): (() => Promise<{ default: DemoPayload }>) =>
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — template-literal import; path is valid once JSON is committed
  () => import(/* @vite-ignore */ `./${slug}.demo.json`);

const LAZY_LOADERS: Record<string, () => Promise<{ default: DemoPayload }>> = {
  'solo-criminal':    _mkLoader('solo-criminal'),
  'family-law':       _mkLoader('family-law'),
  'employment-labor': _mkLoader('employment-labor'),
  'corporate-ma':     _mkLoader('corporate-ma'),
  'ip-tech':          _mkLoader('ip-tech'),
  'commercial-lit':   _mkLoader('commercial-lit'),
  'real-estate':      _mkLoader('real-estate'),
  'banking-finance':  _mkLoader('banking-finance'),
  'immigration':      _mkLoader('immigration'),
};

// In-memory cache to avoid re-fetching within a session:
const _demoCache: Record<string, DemoPayload> = {};

export const DEMO_PAYLOADS: Record<string, DemoPayload> = {
  'personal-injury': personalInjuryDemo as DemoPayload,
};

// getDemoPayload becomes async — callers that were already in async functions
// only need `await` added. App.tsx line 554 is the only call site.
export async function getDemoPayload(slug: string): Promise<DemoPayload | null> {
  if (DEMO_PAYLOADS[slug]) return DEMO_PAYLOADS[slug];
  if (_demoCache[slug]) return _demoCache[slug];
  const loader = LAZY_LOADERS[slug];
  if (!loader) return null;
  try {
    const mod = await loader();
    _demoCache[slug] = mod.default;
    return _demoCache[slug];
  } catch {
    // JSON file not yet committed (per-area plans add them in Plans 02–10).
    // Gracefully return null so the caller falls through to lean mode.
    return null;
  }
}

// Must be hardcoded — cannot derive dynamically from async loaders:
export const DEMO_AVAILABLE_SLUGS: ReadonlySet<string> = new Set([
  'personal-injury',
  'solo-criminal',
  'family-law',
  'employment-labor',
  'corporate-ma',
  'ip-tech',
  'commercial-lit',
  'real-estate',
  'banking-finance',
  'immigration',
]);

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
 * Strip SemVer build metadata (everything from the first `+`) before comparing.
 * Per the SemVer spec, build metadata MUST be ignored when determining version
 * precedence — `0.10.0+01f7ecb` and `0.10.0` are the same version. The curation
 * script stamps a git hash as build metadata, while the runtime version is the
 * plain `x.y.z` from package.json, so a raw string compare always (wrongly)
 * reports demos as stale.
 */
function normalizeVersion(v: string): string {
  return v.split('+')[0];
}

/**
 * Pure version-drift detector. Returns the input vector unchanged when any
 * comparable pair of versions disagrees, or null when nothing is comparable
 * or everything matches. Inputs that are null on either side are treated as
 * "cannot determine" — we never fire the banner on missing data. Build metadata
 * is ignored, so a git-hash suffix alone never trips the banner.
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
    normalizeVersion(payloadPipelineVersion) !== normalizeVersion(runtimePipelineVersion);
  const folioStale =
    payloadFolioVersion !== null &&
    runtimeFolioVersion !== null &&
    normalizeVersion(payloadFolioVersion) !== normalizeVersion(runtimeFolioVersion);
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
