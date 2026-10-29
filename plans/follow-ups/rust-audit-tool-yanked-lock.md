# Avoid yanked packages in the cargo-audit tool lock

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #225 and its completed plan.
- **Location:** `scripts/verification/rust-audit-tool.mjs`.
- **Reason:** The review or plan deferred this work until after PR #225.

The repository suite installs cargo-audit with `--locked`. The recorded lock selected a yanked Tokio release.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L392).
