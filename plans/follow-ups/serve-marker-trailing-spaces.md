# Remove trailing spaces from the Serve marker fixture

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 163 (final review R2): `git diff --check` reports
trailing spaces in `packages/viewer/tests/serve_marker_documents.ts`,
an exact-bytes Serve HTML fixture in a template string. No gate runs
`git diff --check`. Severity Low, effort not recorded. Options: A,
remove the six trailing-space lines and update exact-byte assertions
if needed; B, add a narrow check exception for this fixture.
Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6205).
