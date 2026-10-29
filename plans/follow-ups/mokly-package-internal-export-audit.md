# Audit internal exports in the Mokly package

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan.
- **Location:** `scripts/verification/ratchets/internal-exports.mjs`.
- **Reason:** The review or plan deferred this work until after PR #226.

The source roots still name `src`, so the audit skips `packages/mokly/src`.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L427).
