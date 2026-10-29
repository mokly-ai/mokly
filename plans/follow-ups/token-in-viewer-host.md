# Protect tokens in viewer URL hosts

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 178 (delta review 3):
`crates/mokly-publish/src/completion.rs:69`: the check reads the parsed
URL, and URL parsing lowercases the host, so a token in the viewer URL
host prints in lower case. The old check had the same gap, and no test
covers a token in the host. Severity Low, security, effort not
recorded. Options (estimate): A, match the token in the host without
regard to letter case, with a test; B, reject a viewer URL whose host
contains the token (a new rejection, which needs the user's approval).
Recommended: A.

## Decision

- **Source:** Review.
- **Category:** security.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly protect tokens in viewer URL hosts?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Small.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** A.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6365).
