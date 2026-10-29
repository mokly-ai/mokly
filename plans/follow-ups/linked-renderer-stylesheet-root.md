# Keep styles for a renderer reached through a link

- **Severity:** High. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #240 and its completed plan.
- **Location:** `crates/mokly-render/src/stylesheets.rs` and `crates/mokly-render/src/graph.rs`.
- **Reason:** The review or plan deferred this work until after PR #240.

A renderer configured through a linked directory keeps the link path while the module graph uses the real path. Its stylesheet root is then omitted and the build succeeds without the styles.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/normalize-config-relative-paths.md?plain=1#L327).
