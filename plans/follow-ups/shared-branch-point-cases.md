# Share branch-point cases across Rust and browser tests

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** Branch-point fixtures and tests.
- **Reason:** The review found this problem outside the change that it reviewed.

The protocol requires one set of base commits. Rust reads the JSON fixture, but browser tests write their own sources.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4914).
