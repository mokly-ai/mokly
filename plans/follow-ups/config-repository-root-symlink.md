# Use one path rule through a linked repository root

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #240 and its completed plan.
- **Location:** `crates/mokly-catalogue/src/config.rs` and `crates/mokly-catalogue/src/config_paths.rs`.
- **Reason:** The review or plan deferred this work until after PR #240.

When `repoRoot` uses a symbolic link, `roots[].dir` is checked against the link path while other fields use the target. Apply one consistent rule.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/normalize-config-relative-paths.md?plain=1#L322).
