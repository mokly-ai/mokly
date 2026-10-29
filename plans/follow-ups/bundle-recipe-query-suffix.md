# Support query and hash suffixes in bundle recipes

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan.
- **Location:** `packages/mokly/src/sidecar/bundle-recipe.ts`.
- **Reason:** The review or plan deferred this work until after PR #226.

An import with a query or hash suffix fails with “Bundled source bytes were not recorded.” The same defect exists on `origin/main`.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L413).
