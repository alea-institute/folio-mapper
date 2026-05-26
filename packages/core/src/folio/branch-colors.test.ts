import { describe, it, expect } from 'vitest';
import { BRANCH_COLORS, EXCLUDED_BRANCHES } from './branch-colors';

describe('branch picker exclusion', () => {
  it('EXCLUDED_BRANCHES covers sandbox and standards-compatibility', () => {
    expect(EXCLUDED_BRANCHES.has('Standards Compatibility')).toBe(true);
    expect(EXCLUDED_BRANCHES.has('ZZZ - SANDBOX: UNDER CONSTRUCTION')).toBe(true);
  });

  it('keeps the full color map so any concept still resolves a color', () => {
    // Exclusion is presentation-only — the color map must stay complete.
    expect(BRANCH_COLORS.STANDARDS_COMPATIBILITY?.name).toBe('Standards Compatibility');
  });

  it('the input-panel branch list (BRANCH_COLORS minus EXCLUDED) hides excluded branches', () => {
    // Mirrors App.tsx#allFolioBranches.
    const pickerNames = Object.values(BRANCH_COLORS)
      .filter((b) => !EXCLUDED_BRANCHES.has(b.name))
      .map((b) => b.name);

    for (const excluded of EXCLUDED_BRANCHES) {
      expect(pickerNames).not.toContain(excluded);
    }
    expect(pickerNames.length).toBeGreaterThan(0);
  });
});
