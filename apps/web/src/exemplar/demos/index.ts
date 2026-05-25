// Curated demo payloads live as JSON under apps/web/src/exemplar/demos/ and are
// loaded entirely client-side (no network). See getDemoPayload below.

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

// Other areas are lazy-loaded on demand. `import.meta.glob` makes Vite
// statically discover every {slug}.demo.json at build time and emit ONE lazy
// chunk per file — and, critically, resolve correctly in the production build
// as well as the dev server.
//
// This replaces a previous `import(/* @vite-ignore */ \`./${slug}.demo.json\`)`
// approach. That worked in `vite dev` (files served straight from source) but
// silently failed in `vite build`: @vite-ignore told Vite not to bundle the
// JSON, so at runtime the relative import 404'd against the hashed asset dir,
// getDemoPayload caught the error and returned null, and the UI fell through to
// the LIVE lean pipeline. Glob imports are emitted as real chunks, so prod
// resolves them. (See https://vite.dev/guide/features.html#glob-import.)
const DEMO_MODULES = import.meta.glob('./*.demo.json') as Record<
  string,
  () => Promise<{ default: DemoPayload }>
>;

const LAZY_LOADERS: Record<string, () => Promise<{ default: DemoPayload }>> = {};
for (const [path, loader] of Object.entries(DEMO_MODULES)) {
  // './banking-finance.demo.json' -> 'banking-finance'
  const slug = path.slice('./'.length, -'.demo.json'.length);
  LAZY_LOADERS[slug] = loader;
}

// In-memory cache to avoid re-fetching within a session:
const _demoCache: Record<string, DemoPayload> = {};

// getDemoPayload is async — App.tsx#handleExemplarSelect (the only call site)
// awaits it. Every area resolves through the same glob-backed lazy loader.
export async function getDemoPayload(slug: string): Promise<DemoPayload | null> {
  if (_demoCache[slug]) return _demoCache[slug];
  const loader = LAZY_LOADERS[slug];
  if (!loader) return null;
  try {
    const mod = await loader();
    _demoCache[slug] = mod.default;
    return _demoCache[slug];
  } catch {
    // Defensive: a missing/corrupt payload returns null so the caller falls
    // through to lean mode rather than throwing.
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
