import { describe, it, expect } from 'vitest';
import demoPI from '../exemplar/demos/personal-injury.demo.json';
import demoSoloCriminal from '../exemplar/demos/solo-criminal.demo.json';
import demoFamilyLaw from '../exemplar/demos/family-law.demo.json';
import demoEmploymentLabor from '../exemplar/demos/employment-labor.demo.json';
import demoCorporateMa from '../exemplar/demos/corporate-ma.demo.json';
import demoIpTech from '../exemplar/demos/ip-tech.demo.json';
import demoCommercialLit from '../exemplar/demos/commercial-lit.demo.json';
import demoRealEstate from '../exemplar/demos/real-estate.demo.json';
import demoBankingFinance from '../exemplar/demos/banking-finance.demo.json';
import demoImmigration from '../exemplar/demos/immigration.demo.json';

/**
 * Guard: no demo payload may surface a candidate branch_group for a FOLIO branch
 * that the backend excludes from search results. A viewer expanding the candidate
 * tree should never see "ZZZ - SANDBOX: UNDER CONSTRUCTION" or "Standards
 * Compatibility" — they are unpolished / predecessor-standard branches.
 *
 * COUPLING: this set mirrors EXCLUDED_BRANCHES in
 * backend/app/services/branch_config.py (the source of truth). If that set
 * changes, update this list to match. The pipeline candidate path
 * (stage1_filter.py) applies the same filter so re-curated demos stay clean.
 */
const EXCLUDED_BRANCHES = new Set<string>([
  'Standards Compatibility',
  'ZZZ - SANDBOX: UNDER CONSTRUCTION',
]);

interface BranchGroup {
  branch?: string;
}
interface MappingItem {
  branch_groups?: BranchGroup[];
}

function collectBranches(payload: Record<string, unknown>): string[] {
  const mr = payload['mapping_response'] as { items?: MappingItem[] } | undefined;
  const items = mr?.items ?? [];
  const branches: string[] = [];
  for (const item of items) {
    for (const group of item.branch_groups ?? []) {
      if (group.branch) branches.push(group.branch);
    }
  }
  return branches;
}

describe('demo mode excluded branches', () => {
  it.each([
    ['personal-injury',  demoPI],
    ['solo-criminal',    demoSoloCriminal],
    ['family-law',       demoFamilyLaw],
    ['employment-labor', demoEmploymentLabor],
    ['corporate-ma',     demoCorporateMa],
    ['ip-tech',          demoIpTech],
    ['commercial-lit',   demoCommercialLit],
    ['real-estate',      demoRealEstate],
    ['banking-finance',  demoBankingFinance],
    ['immigration',      demoImmigration],
  ] as [string, Record<string, unknown>][])(
    '%s demo has no candidate branch_group in EXCLUDED_BRANCHES',
    (_slug, payload) => {
      const offending = collectBranches(payload).filter((b) => EXCLUDED_BRANCHES.has(b));
      expect(offending).toEqual([]);
    },
  );
});
