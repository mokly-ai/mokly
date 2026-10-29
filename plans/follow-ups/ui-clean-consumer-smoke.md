# Smoke-test UI package resolution in a clean consumer

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #243 and its completed plan.
- **Location:** A clean npm consumer.
- **Reason:** The review or plan deferred this work until after PR #243.

Release `0.17.0` is the first release with `@mokly/ui`. Install `@mokly/viewer` in a clean registry consumer. Confirm that `@mokly/ui` resolves and that `styles.css` contains the component rules.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L530).
