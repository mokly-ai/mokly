# Cache unused compiled recipes

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Add a byte-bounded cache of unused compiled recipes, revalidated before
reuse, under F8 decision 59 option C. Revalidate compiler and resolution
inputs, and agree the byte budget before implementation. The current
recipe lifetime stays in force under option A until this work lands.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5417).
