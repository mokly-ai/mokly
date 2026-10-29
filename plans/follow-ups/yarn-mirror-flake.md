# Diagnose the Yarn Classic mirror fallback

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 192 (test):
`tests/static_base_manager_mirror.test.ts`, "a cold Yarn Classic base
installs ordinary versions from its committed offline mirror", fell
back to tier 3 instead of tier 2 once on hosted CI (PR #200 run
40194214551, attempt 1) and passed on the rerun. Severity Low, test,
effort not recorded. Options (estimate): A, find the cause from a
reproduction with the manager output captured; B, also print the
manager output in the failure message. Recommended: A.

## Decision

- **Source:** Review.
- **Category:** test.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly diagnose the Yarn Classic mirror fallback?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Small.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** B.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6503).
