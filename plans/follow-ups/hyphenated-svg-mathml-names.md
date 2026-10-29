# Accept standard hyphenated SVG and MathML names

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-catalogue/src/templates.rs`.
- **Reason:** The review found this problem outside the change that it reviewed.

Standard names such as `annotation-xml` are rejected as unknown elements.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5664).
