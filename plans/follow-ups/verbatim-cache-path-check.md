# Normalize verbatim cache paths before safety checks

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 179 (delta review 4):
`crates/mokly-compare/src/locations.rs:40`: `dunce` keeps the verbatim
`\\?\` form for a path over 260 characters or with a reserved name, so
the "cache inside the repository" check can compare a verbatim path
with a plain path. It misses only when `LOCALAPPDATA` points into the
repository through such a path. Severity Low, product bug, effort not
recorded. Options (estimate): A, normalize both paths the same way
before the comparison; B, document the limit. Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6375).
