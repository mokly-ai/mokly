# Use progress as the large benchmark liveness signal

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 162 (batch 25 harness note):
`npm run benchmark:large -- --scenario build` stops at its 300-second
liveness deadline, but the large fixture builds with `--strict --base`
take 467 s (HTML) and 921 s (React). Severity Low, effort not recorded.
Options: A, raise the build scenario's deadline above the measured
build times; B, make the deadline a liveness limit that each progress
line resets. Recommended: B.

## Decision

- **Source:** Design.
- **Category:** test.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly use progress as the large benchmark liveness signal?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Medium.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** B.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** B. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6197).
