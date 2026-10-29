# Test every axis of Affected links

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 144 (103 C review finding 2): Affected link tests
do not check their axes. `tests/browser/branch_point_affected.ts`
lines 126 to 193 take the expected viewport from the link itself, and
`packages/viewer/tests/affected_comparison.test.ts` lines 134 to 168
do not read the Affected link URLs. Severity Low, test, effort
Medium. Options: A, add the expected viewport and scheme to the
fixture, and assert the query and the Details text, Small
(estimate); B, a shared helper with independent destination, axis,
comparison, and Details expectations, Medium. Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6099).
