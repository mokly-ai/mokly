# Reduce catalogue-wide owned-proof memory

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 97 (review 2 finding 3): owned proof state waits
for the whole catalogue. Decision 73 C made owned instance proof wait
for catalogue-wide own-page proof. So every view keeps two
whole-document instance indexes and candidate proofs until all views
are collected, an estimated 190 MB across 5,850 views at 1,000
elements per side, not measured. Severity Medium, effort Medium.
Options: A, pass the state by value only, which engine fix round 3
applied on `rebuild/defaults-engine`; B, keep compact candidates:
deduplicated instance chains per owner and rule identity, candidates
only for owners with changed rules, and one address pair per view,
Medium; C, a counted test at two catalogue sizes, Medium (estimate).
Recommended: B, because it removes a memory regression that
`rebuild/defaults-engine` adds.

## Decision

- **Source:** Review.
- **Category:** performance.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly reduce catalogue-wide owned-proof memory?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Medium.
  - **C.** Use option C from the Task section. Effort: Medium.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** B.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** B. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5878).
