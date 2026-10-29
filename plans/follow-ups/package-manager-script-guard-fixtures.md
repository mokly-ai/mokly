# Add fixtures for package-manager script guards

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 121 (pnpm and Yarn review finding 7): marker
fixtures for every script and hook guard. No test asserts
`--ignore-pnpmfile`, `YARN_IGNORE_PATH=1`, `--no-default-rc`, or the
`YARN_PLUGINS` removal. Severity Medium, effort Medium. Missing tests
wait for the user. Options: A, assert each flag in
`manager_command_tests`, Small (estimate); B, A and also cold-build
fixtures, `.pnpmfile.cjs` and `.mjs`, a Berry `yarnPath` script, and
an ancestor Classic `yarn-path`, that write a marker file that the
test requires to be absent, Medium. Recommended: B.

- Fix round 2 finding 5 joins it: the marker fixtures in
  `tests/static_base_managers.test.ts` and
  `tests/helpers/base_manager_fixture.ts` look in the wrong place.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5996).
