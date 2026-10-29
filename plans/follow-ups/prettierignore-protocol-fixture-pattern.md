# Restore the protocol fixture pattern in prettierignore

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #221 and its completed plan.
- **Location:** `.prettierignore`.
- **Reason:** The review or plan deferred this work until after PR #221.

The protocol fixture comment has no path below it. Prettier therefore formats every protocol fixture. Add the intended pattern or remove the stale comment.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L387).
