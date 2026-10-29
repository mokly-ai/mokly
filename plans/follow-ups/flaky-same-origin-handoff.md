# Stabilize the same-origin handoff browser test

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan.
- **Location:** `tests/browser/same_origin_identity.spec.ts`.
- **Reason:** The review or plan deferred this work until after PR #226.

The unowned exact-resource handoff test failed once because its probe read a null frame document. It passed on rerun and in ten local runs. The suspected source is the handoff race.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L430).
