# Align the Statement doc with descriptor parsing

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-css/src/token_sections.rs`.
- **Reason:** The review found this problem outside the change that it reviewed.

The `Statement` doc claims lightningcss block behavior, but the section reader treats an `@font-face` descriptor with a block as a rule.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6696).
