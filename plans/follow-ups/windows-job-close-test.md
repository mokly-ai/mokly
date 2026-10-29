# Make the Windows job-close test effective

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 176 (delta review 1):
`crates/mokly-platform/tests/process_tests.rs:104`: the Windows
job-close test cannot fail when the job does not kill the child,
because `Child::wait` closes stdin, so `set /p` ends cmd by itself.
Severity Medium, test, effort not recorded. Options (estimate): A,
append `&echo leaked` to the command and assert that it never prints;
B, a shared test helper that proves the job killed the child, used by
every job-close test. Recommended: A.

## Decision

- **Source:** Review.
- **Category:** test.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly make the Windows job-close test effective?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Medium.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** B.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6348).
