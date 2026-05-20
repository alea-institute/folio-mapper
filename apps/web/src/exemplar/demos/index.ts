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
