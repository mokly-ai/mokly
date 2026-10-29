# Move focus after a detail retry

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 160 (W2 finding 1): Props and Usage Try again leave
focus on the page. Severity Low, product bug, effort Medium
(estimate). Options: A, document that a detail retry keeps the
browser's focus, effort not recorded; B, move focus to the loading
status, then to the panel heading, Medium (estimate). Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6183).
