# Support a hash character in module paths

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #227 and its completed plan.
- **Location:** `crates/mokly-render/src/graph.rs`.
- **Reason:** The review or plan deferred this work until after PR #227.

`entry_modules` splits a handle at its first hash. A module path that contains a hash can select the wrong stylesheet module.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/per-entry-render-keys.md?plain=1#L556).
