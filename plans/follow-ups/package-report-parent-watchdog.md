# Require the sidecar parent watchdog in package reports

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `scripts/release/package_reports.mjs`.
- **Reason:** The review found this problem outside the change that it reviewed.

The required CLI file list omits `dist/sidecar/parent-watchdog.js`, which the parent input loads by path.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6741).
