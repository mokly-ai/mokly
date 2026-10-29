# Keep healthy remote Testbox runs alive

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `.github/workflows/blacksmith-testbox.yml`.
- **Reason:** The review found this problem outside the change that it reviewed.

The 30-minute job timeout stopped a healthy Node file-delivery run before it downloaded the report.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4209).
