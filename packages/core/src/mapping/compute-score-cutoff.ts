import type { BranchGroup, FolioCandidate } from '../folio/types';
import type { BranchState } from './types';

/**
 * Applies a global score threshold to a **pre-sorted** (descending) candidate array
 * while guaranteeing that a sparse branch is never fully suppressed.
 *
 * This mirrors the mandatory-branch floor pattern (`sorted.slice(0, Math.max(topN, 3))`)
 * for non-mandatory branches: even if every candidate in a branch falls below the global
 * threshold (e.g. "Area of Law" max=52 when "Service" pulls the cutoff to 59), the branch
 * still surfaces its top `floor` candidates so the user can evaluate them.
 *
 * Algorithm (Option A — per-branch flooring):
 *   - If `threshold <= 0`: return `sorted` unchanged (no cutoff active).
 *   - Otherwise: compute the union of
 *       (a) candidates with score >= threshold, AND
 *       (b) the top `floor` candidates (by position in the pre-sorted array).
 *     Deduplicate by `iri_hash`, preserve descending order, do NOT mutate input.
 *
 * @param sorted    Candidates already sorted descending by score. Not mutated.
 * @param threshold Global score cutoff (from `computeScoreCutoff`). 0 means "no cutoff".
 * @param floor     Minimum candidates to retain per branch even when all are below
 *                  threshold. Defaults to 3 (matches the mandatory-branch guarantee).
 */
export function selectVisibleCandidates(
  sorted: FolioCandidate[],
  threshold: number,
  floor = 3,
): FolioCandidate[] {
  // No cutoff active — return all candidates (matches `threshold <= 0` branch in callers)
  if (threshold <= 0) return sorted;

  // Build thresholded set
  const thresholded = sorted.filter((c) => c.score >= threshold);

  // If thresholded set already meets the floor guarantee, nothing more to do
  if (thresholded.length >= floor) return thresholded;

  // Floor guarantee: include top `floor` candidates (or all of them if branch is smaller)
  // The thresholded candidates are already a subset of the top-N slice so we just extend
  // from the sorted array, skipping those already in the thresholded set.
  const seen = new Set(thresholded.map((c) => c.iri_hash));
  const result = [...thresholded];

  for (const c of sorted) {
    if (result.length >= Math.min(floor, sorted.length)) break;
    if (!seen.has(c.iri_hash)) {
      result.push(c);
      seen.add(c.iri_hash);
    }
  }

  // Result is in descending order: thresholded portion is already sorted descending, and
  // any appended floored candidates come from `sorted` (also descending) after all
  // qualifying ones, so the order is preserved.
  return result;
}

/**
 * Converts a "Top N" count into a numeric score cutoff for **non-mandatory**
 * branches only.
 *
 * Pools all candidate scores from non-mandatory, non-excluded branches into a
 * single list, sorts descending, and returns the Nth score. Mandatory branches
 * are excluded because they use independent per-branch slicing instead.
 *
 * Returns 0 if topN >= 50 (the "All" sentinel) or if non-mandatory branches
 * have fewer than topN candidates total.
 */
export function computeScoreCutoff(
  branchGroups: BranchGroup[],
  topN: number,
  branchStates: Record<string, BranchState>,
): number {
  // topN >= 50 is the "All" sentinel — show everything; !topN guards NaN/undefined
  if (!topN || topN >= 50) return 0;

  // Pool all scores from non-mandatory, non-excluded branches
  const scores: number[] = [];
  for (const group of branchGroups) {
    const state = branchStates[group.branch];
    if (state === 'excluded' || state === 'mandatory') continue;
    for (const c of group.candidates) {
      scores.push(c.score);
    }
  }

  // Fewer candidates than topN — no cutoff needed
  if (scores.length <= topN) return 0;

  // Sort descending, return the Nth score (0-indexed: topN - 1)
  scores.sort((a, b) => b - a);
  return scores[topN - 1];
}
