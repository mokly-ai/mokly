# Use one typed lockfile model

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 123 (wider fix of pnpm and Yarn review findings 3
and 4): one typed lockfile model. Parse pnpm and Yarn lockfiles into
a typed model with importer and locator context, check only path
fields, and test it with a differential corpus against Yarn's parser.
Effort Large. It is a wider fix, so the hub grades no severity. The
follow-up line on `rebuild/base-pnpm-yarn-fix1` names the same wider
fix. Options: A, keep the scalar scans with the targeted fixes, Small
(estimate); B, the typed model, Large. Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6009).
