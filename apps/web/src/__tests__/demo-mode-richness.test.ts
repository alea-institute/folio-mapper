import { describe, it, expect } from 'vitest';
import demoPI from '../exemplar/demos/personal-injury.demo.json';
import demoSoloCriminal from '../exemplar/demos/solo-criminal.demo.json';
import demoFamilyLaw from '../exemplar/demos/family-law.demo.json';
import demoEmploymentLabor from '../exemplar/demos/employment-labor.demo.json';
import demoCorporateMa from '../exemplar/demos/corporate-ma.demo.json';
import demoIpTech from '../exemplar/demos/ip-tech.demo.json';
import demoCommercialLit from '../exemplar/demos/commercial-lit.demo.json';
// Remaining areas added by Plan 05 as their demo.json is committed:
// import demoRealEstate from '../exemplar/demos/real-estate.demo.json';
// import demoBankingFinance from '../exemplar/demos/banking-finance.demo.json';
// import demoImmigration from '../exemplar/demos/immigration.demo.json';

/**
 * D-03 visible-mix assertion harness.
 *
 * Each demo payload must have 0 < completed < total_nodes — a visible mix of
 * auto-accepted and pending-review nodes, ensuring the demo shows the UI in a
 * meaningful intermediate state rather than all-accepted or all-pending.
 *
 * Table is parametrized — per-area plans add one import + one row each.
 *
 * NOTE on Personal Injury: the SHIPPED PI demo was curated at threshold 0.30
 * and has completed === total_nodes === 19 (all-accepted). It fails D-03 until
 * re-curated with --provider anthropic --threshold 0.85 in Plan 03. The entry
 * is marked as todo and will join the active table after re-curation.
 */

// Type narrowing helper — demo JSONs have total_nodes and completed at top level:
function getRichness(payload: Record<string, unknown>) {
  const total = payload['total_nodes'] as number;
  const completed = payload['completed'] as number;
  return { total, completed, ratio: completed / total };
}

describe('demo mode richness (D-03)', () => {
  // Add new rows here as each area's demo.json is committed and passes D-03.
  // PI re-curated in Plan 03 (--provider anthropic) now shows a visible mix.
  // Remaining areas added by Plans 04-05:
  // ['corporate-ma',     demoCorporateMa],
  // ['ip-tech',          demoIpTech],
  // ['commercial-lit',   demoCommercialLit],
  // ['real-estate',      demoRealEstate],
  // ['banking-finance',  demoBankingFinance],
  // ['immigration',      demoImmigration],
  it.each([
    ['personal-injury',  demoPI],
    ['solo-criminal',    demoSoloCriminal],
    ['family-law',       demoFamilyLaw],
    ['employment-labor', demoEmploymentLabor],
    ['corporate-ma',     demoCorporateMa],
    ['ip-tech',          demoIpTech],
    ['commercial-lit',   demoCommercialLit],
  ] as [string, Record<string, unknown>][])(
    '%s demo has 0 < completed < total_nodes (visible mix)',
    (_slug, payload) => {
      const { total, completed } = getRichness(payload);
      expect(completed).toBeGreaterThan(0);
      expect(completed).toBeLessThan(total);
    },
  );
});
