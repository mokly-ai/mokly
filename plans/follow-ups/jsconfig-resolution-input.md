# Include jsconfig paths in resolution inputs

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan.
- **Location:** `packages/mokly/src/sidecar/resolution-inputs.ts`.
- **Reason:** The review or plan deferred this work until after PR #226.

esbuild reads `jsconfig.json` path aliases, but the bundle reuse inputs omit that file.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L421).
