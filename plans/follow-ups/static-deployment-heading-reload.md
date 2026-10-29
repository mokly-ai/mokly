# Stabilize headings during deployment reload

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `tests/browser/static_deployment.spec.ts`.
- **Reason:** The review found this problem outside the change that it reviewed.

A browser check matched two transient headings during a deployment reload. The next remote gate passed. The suspected source is reload ordering.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L1715).
