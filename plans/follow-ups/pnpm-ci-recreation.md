# Make pnpm recreation independent of CI

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 158 (pnpm CI fix finding 1): pnpm recreates a
tracked `node_modules` only under CI. A tracked
`node_modules/.modules.yaml` that needs recreation fails locally with
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, which gives tier three,
but succeeds under CI, which gives tier two. Severity Medium, product
bug, effort Small. Options: A, turn off the recreation prompt for
private installs, Small; B, document the CI-dependent result, effort
not recorded. Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6158).
