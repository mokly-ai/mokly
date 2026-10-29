# Identify the static CORS console notice source

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `tests/browser/static_cors.spec.ts`.
- **Reason:** The review found this problem outside the change that it reviewed.

The public embedded-viewer case reported one blocked-script notice from `about:blank` and passed unchanged in isolation. Confirm the notice origin before changing the fixture.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4701).
