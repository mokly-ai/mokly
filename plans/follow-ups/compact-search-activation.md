# Close compact search after row activation

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `packages/viewer/src/shell/top_bar.tsx`.
- **Reason:** The review found this problem outside the change that it reviewed.

An open compact search hides the menu button and stays open after the user activates a row.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4900).
