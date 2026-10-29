# Import the UI package by name in design mockups

- **Severity:** Low. **Effort:** Large.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #243 and its completed plan.
- **Location:** `examples/basic` design library.
- **Reason:** The review or plan deferred this work until after PR #243.

Import `@mokly/ui` by package name after repository packages can be consumed from the built tree. This replaces direct repository-path imports.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L501).
