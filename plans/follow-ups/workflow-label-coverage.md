# Cover every workflow runner label

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 132 (actionlint review finding): the label
coverage test misses workflow labels. `tests/actionlint_config.test.ts`
scans only `.yml` workflows. It also ignores a job's own `runs-on`
label when the job also has a matrix, as three `ci.yml` jobs do.
Severity Low, effort Small. Options: A, include `.yaml` workflows and
each such job's own `runs-on` label in the label coverage test,
Small. Recommended: A. Missing tests need the user. The rebuild
branch records the first part as a "Finding" line here. Keep one
line when both reach the plan.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6053).
