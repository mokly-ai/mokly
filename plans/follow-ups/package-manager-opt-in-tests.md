# Test script opt-in for each package manager

- **Severity:** Low. **Effort:** Medium (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 154, finding 47 of the review of user decision 135 B.
- **Location:** `tests/static_cold_base_tiers.test.ts:42`,
  `tests/static_base_managers.test.ts:51`, and
  `crates/mokly-compare/src/_tests_/manager_command_tests.rs:150`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Test (estimate).
- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies that Changes runs when the base lockfile differs from the
    working tree.
  - **Scripts opt-in:** the `review.baseInstallScripts` setting and the
    `--base-install-scripts` flag, which turn on dependency lifecycle
    scripts in a base install.
- **Background:** The scripts opt-in works and is tested as follows.
  - Base installs run with lifecycle scripts off by default.
  - A user decision of 2026-10-21 added the scripts opt-in, from the working
    tree only, and `--no-base-install-scripts` to turn it off again.
  - For a scripts-on install, `manager_command::arguments` in
    `crates/mokly-compare/src/manager_command.rs` removes `--ignore-scripts`
    and `--mode=skip-build`.
  - `docs/protocol/mokly-base-dependencies.md` supports npm, pnpm 10 through
    12, Yarn Classic 1, and Yarn Berry 4 for base installs.
  - `tests/static_cold_base_tiers.test.ts` runs a lifecycle marker through an
    npm fixture, with the setting and with the flag.
  - `tests/static_base_managers.test.ts` proves only the scripts-off case for
    pnpm, Yarn Classic, and Yarn Berry.
- **Problem:** Only npm proves the opt-in end to end. pnpm, Yarn Classic, and
  Yarn Berry have only the command-level check
  `scripts_on_install_commands_omit_only_script_suppression_flags`.
- **Impact if no action:** A manager can ignore the opt-in, or run scripts
  through another control, and no test fails.
- **Root question:** How should Mokly prove that each package manager runs
  dependency scripts when the user opts in?
- **Options:**
  - **A.** Keep the command-level checks of
    `manager_command_tests.rs`, which already assert the scripts-on
    arguments for each manager. Effort: Small (estimate).
  - **B.** Add one end-to-end marker case for each package manager. Each case
    builds a base whose lifecycle script writes a marker, with the opt-in, and
    requires the marker. Effort: Medium (estimate).
- **Left out:** The review record that held the other options of this item
  is not available. One shared fixture cannot prove the different script
  controls of each manager. Only two distinct approaches exist: check the
  command, or check the process result.
- **Wider fix:** B. A marker case for each manager proves the behaviour at
  the process boundary for every manager.
- **Previous examples:** The npm case in
  `tests/static_cold_base_tiers.test.ts` proves the opt-in for npm. The
  scripts-off cases in `tests/static_base_managers.test.ts` prove that no
  marker appears for each manager.
- **Related:**
  [package-manager-script-guard-fixtures.md](./package-manager-script-guard-fixtures.md)
  adds marker fixtures for the hook guards of pnpm and Yarn. Both items
  extend the same base manager fixtures, so one branch can do both.
- **Recommendation:** B. It proves the opt-in where it matters, in the
  manager process.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user reserved the choice for each open review item of the rebuild.
  Condition 6 also holds, because the item concerns missing tests.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6141).
