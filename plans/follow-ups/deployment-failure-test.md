# Make the deployment test observe its step failure

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 143 (89 B and 90 C review finding 2): a
deployment spec never delivers its step failure. On
`rebuild/viewer-90c`, `tests/browser/static_deployment_flow.spec.ts`
lines 130 to 182 pass on the abort alone: the replacement aborts the
step's load before its 404 can arrive. Severity Low, test, effort
Small. Options: A, rename the test, reword its comment and
`tests/browser/README.md` lines 82 to 88, and record and assert the
abort, Small. Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6090).
