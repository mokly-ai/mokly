# Continue extraction into the shared UI package

- **Severity:** Low. **Effort:** Large.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #243 and its completed plan.
- **Location:** `packages/viewer`, `packages/ui`, and the design library.
- **Reason:** The review or plan deferred this work until after PR #243.

Move the remaining chrome, controls, inspector, and preview components in separate slices. Then move shell tokens. Remove the embedded selector transform after every shell rule is authored under the root class.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L533).
