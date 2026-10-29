# Check test helper trees for unused exports

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 109 (F18 decision 39): extend the unused internal
export check to the test helper trees. It is a stricter check, so it
needs the user. Covers finding 36. Previous examples: `ec52f856` and
`fe3624df`. Severity Low, effort Medium. Options: A, keep the current
scope, Small (estimate); B, check `tests/browser`, `tests/helpers`,
and `packages/viewer/tests`, and leave the catalogue fixtures out,
Medium. F20 removed all 47 unused exports, so B starts with no
baseline entries. Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5953).
