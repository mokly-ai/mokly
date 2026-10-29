# Classify moz-document blocks consistently

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-css/src/token_grammar.rs`.
- **Reason:** The review found this problem outside the change that it reviewed.

The scanners treat an `@-moz-document` block outside a style rule as a style block, while lightningcss parses it as an `@media` block.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6675).
