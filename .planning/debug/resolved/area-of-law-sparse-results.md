---
status: resolved
trigger: "Area of Law branch shows only 1 candidate for 'Securities Litigation' but SERVICE branch returns 5 results"
created: 2026-04-06T00:00:00Z
updated: 2026-05-22T00:00:00Z
resolution: mitigated-by-later-work
---

## Resolution Update (2026-05-22 — milestone v1.0 close re-test)

Re-ran `search_candidates("Securities Litigation", use_bridging=True)` against current code:
- **Area of Law candidates: 1 (April) → 4 (now)** — Financial Reporting Law, Business and
  Financial Crimes Law, Bankruptcy/Insolvency/Restructuring Law, and Securities and Financial
  Instruments Law (the originally-missing concept) are now discovered.

Mapping to the three diagnosed defects:
- **Defect 1 (no discovery path):** RESOLVED. The embedding/FAISS semantic search (v0.7.0),
  spaCy word-vector expansion (v0.8.3), and Phase 2.6 cross-branch keyword bridging — all added
  after this session — discover Area of Law concepts without relying on the missing
  LEGAL_TERM_EXPANSIONS["securities"] keyword entry. Discovery no longer depends on the keyword gap.
- **Defect 2 (case-sensitive prefix search):** RESOLVED for the primary path —
  `folio_service.py:1315-1323` now title-cases search terms before `search_by_prefix`.
- **Defect 3 (global computeScoreCutoff threshold hides low-scoring non-mandatory branches):**
  STILL PRESENT in `packages/core/src/mapping/compute-score-cutoff.ts`, but mitigated in practice:
  Area of Law is **mandatory by default**, and mandatory branches bypass the global threshold
  (per-branch slicing). Defect 3 only affects users who explicitly un-mark Area of Law as mandatory.
  Tracked as a known UX limitation (per-branch vs global threshold is a deliberate design tradeoff),
  not a v1.0 blocker.

Outcome: user-visible symptom substantially resolved by post-April search work. Closing. Residual
Defect 3 noted as a future enhancement candidate, not fixed here (changing the global threshold
affects scoring across all queries and is out of scope for a milestone close).

## Current Focus

hypothesis: CONFIRMED — Three compounding defects cause Area of Law sparse results
test: traced full search pipeline from raw candidate collection through UI score-cutoff filtering
expecting: N/A — root cause confirmed with evidence
next_action: report findings (find_root_cause mode)

## Symptoms

expected: "Securities Litigation" returns multiple Area of Law candidates (Securities Law, Securities Regulation, Litigation areas, etc.)
actual: Only 1 Area of Law result (Securities and Financial Instruments Law, score ~47-72 depending on environment). SERVICE branch returns 5 results for same input.
errors: No errors — just too few results in Area of Law branch specifically
reproduction: Map screen → input "Securities Litigation" → Area of Law section shows only 1 candidate
started: User says it used to work correctly; regression at unknown point

## Eliminated

- hypothesis: max_per_branch cap cutting off Area of Law
  evidence: Per-branch cap is 10 for normal branches. Only 1-6 Area of Law concepts make it into the scored pool at all, far below the 10-candidate cap.
  timestamp: 2026-04-06

- hypothesis: Area of Law is excluded
  evidence: EXCLUDED_BRANCHES only contains "Standards Compatibility" and "ZZZ - SANDBOX". Area of Law is not excluded.
  timestamp: 2026-04-06

- hypothesis: Phase 2.7 mandatory expansion is at fault
  evidence: Phase 2.7 only runs when mandatory_branches is set. Without mandatory, Area of Law gets 1 raw candidate. The core deficit is in Phase 1 raw collection and Phase 1b signal search.
  timestamp: 2026-04-06

## Evidence

- timestamp: 2026-04-06
  checked: Phase 1 raw candidate collection for "Securities Litigation"
  found: Only 1 Area of Law concept in raw pool ("Securities and Financial Instruments Law"). Search terms generated are ['Securities Litigation', 'securities', 'litigation', 'litigation practice', 'litigation service'].
  implication: Relevant Area of Law concepts (Security Offerings and Capital Markets Law, Broker-Dealer Law, Investment Companies Law) are never discovered in Phase 1.

- timestamp: 2026-04-06
  checked: folio.search_by_prefix() case sensitivity
  found: search_by_prefix("securit") = 0 results; search_by_prefix("Securit") = 41 results including "Security Offerings and Capital Markets Law". All stem prefix searches use lowercase (from _content_words() → _tokenize() which lowercases). Phase 1 prefix searches for ALL search terms also return 0 (all lowercase).
  implication: The entire stem prefix search path (both Phase 1 prefix and stem-prefix) is broken for typical inputs because FOLIO's prefix search is case-sensitive and requires title case.

- timestamp: 2026-04-06
  checked: LEGAL_TERM_EXPANSIONS and BRANCH_SIGNAL_WORDS for "securities" and "litigation"
  found: "securities" has NO entry in LEGAL_TERM_EXPANSIONS. "litigation" maps to ["practice", "service"] — both of which map to "Service" branch via BRANCH_SIGNAL_WORDS. The BRANCH_SIGNAL_WORDS entry "law" → "Area of Law" is only triggered when a content word expands to "law" suffix, but neither "securities" nor "litigation" expands to "law". Only 10 specific words (contract, corporate, employment, bankruptcy, family, immigration, environmental, antitrust, tax, estate) trigger the Area of Law signal path.
  implication: Phase 1b signal search actively populates Service branch candidates but has zero pathway to discover Area of Law concepts for "Securities Litigation".

- timestamp: 2026-04-06
  checked: computeScoreCutoff with topN=5 for Securities Litigation
  found: Backend returns 6 Area of Law candidates (scores: 52.4, 52.4, 52.4, 47.3, 28.4, 17.0) when use_bridging=True. The 5th highest score GLOBALLY across all branches is 59.4 (Service branch dominates). computeScoreCutoff returns 59.4 as the threshold. ALL Area of Law candidates (max score 52.4) fall below the 59.4 threshold and are hidden by the UI.
  implication: Even the 3-6 Area of Law candidates that bridging finds never reach the user's view because the global threshold is pulled up by Service branch's high scores.

- timestamp: 2026-04-06
  checked: Why Monopolization Claims shows 5 Area of Law vs Securities Litigation's 1
  found: Both queries show 0 Area of Law candidates at topN=5 in my test environment (threshold is pulled above Area of Law max scores in both cases). The user's reported difference suggests their environment has a different FOLIO OWL dataset with different alt_labels/definitions producing higher scores, OR they are using mandatory branches for one query but not the other. When mandatory is set, Area of Law bypasses computeScoreCutoff and uses per-branch slicing of top N.
  implication: The user's observation of "1 vs 5" is consistent with: (a) different OWL data with different alt_label coverage, or (b) Area of Law set as mandatory for Monopolization Claims but not Securities Litigation.

## Resolution

root_cause: |
  THREE compounding defects reduce Area of Law candidates to near-zero for "Securities Litigation":

  DEFECT 1 — No discovery path for Area of Law via keyword search:
  The LEGAL_TERM_EXPANSIONS dict has no entry for "securities". "litigation" only expands to ["practice", "service"] — both mapping to Service branch in BRANCH_SIGNAL_WORDS. The "law" → "Area of Law" signal path in BRANCH_SIGNAL_WORDS is only reachable when one of 10 specific domain words (contract, corporate, employment, etc.) appears in the query. Neither "securities" nor "litigation" is in that set. Result: Phase 1b adds zero Area of Law candidates.

  DEFECT 2 — Case-sensitive prefix search with lowercase inputs:
  folio.search_by_prefix() is case-sensitive and only matches title-case prefixes. All search terms come from _content_words() → _tokenize() which lowercases everything. search_by_prefix("securit") = 0 results; search_by_prefix("Securit") = 41 results. Both the Phase 1 prefix search and the stem-prefix search send lowercase strings, making them entirely ineffective. This means "Security Offerings and Capital Markets Law", "Securitization Practice", etc. are never discovered via prefix matching.

  DEFECT 3 — Global score threshold (computeScoreCutoff) eliminates low-scoring branches:
  With topN=5 (default), the UI computes a global threshold by taking the 5th highest candidate score across ALL non-mandatory branches. For "Securities Litigation", Service branch has 4 candidates with scores 87-99 and many at 59.4. The 5th global score is 59.4. Area of Law candidates max at 52.4 — all below the threshold. Even when bridging finds 5-6 Area of Law candidates, the UI hides them all because the global threshold is above their scores. Service branch floods the pool with high-scoring candidates, crowding out Area of Law.

  INTERACTION: Defect 1+2 ensure Area of Law is barely represented in the raw pool. Defect 3 ensures the few that do appear (via bridging) are hidden in the UI. Together they produce 0-1 visible candidates for queries that don't happen to contain one of the 10 "law"-expanding domain words.

fix:
verification:
files_changed: []
