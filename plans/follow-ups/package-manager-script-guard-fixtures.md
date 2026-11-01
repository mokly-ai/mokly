# Add fixtures for package-manager script guards

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 121, finding 7 of the pnpm and Yarn review, joined by fix round 2 finding 5.
- **Location:** `crates/mokly-compare/src/manager_command.rs:25`,
  `crates/mokly-compare/src/manager_command.rs:157`,
  `tests/helpers/base_manager_fixture.ts:15`, and
  `tests/static_base_managers.test.ts:96`.
- **Reason:** On 2026-10-21 the user deferred the open review items of PR #199
  until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies that Changes runs when the base lockfile differs from the
    working tree.
  - **Hook guard:** a flag or variable that stops a package manager from
    loading code from the base, such as a pnpmfile or another Yarn release.
- **Background:** The hook guards of base installs are as follows.
  - A base install must run no code from the base commit while scripts are
    off.
  - For pnpm, `manager_command::arguments` passes `--ignore-pnpmfile`, and
    `variables` sets `npm_config_ignore_pnpmfile` and
    `pnpm_config_ignore_pnpmfile`.
  - For Yarn, `variables` sets `YARN_IGNORE_PATH=1`, so neither a Berry
    `yarnPath` nor a Classic `yarn-path` starts another Yarn.
  - The allowed list of install variables leaves out `YARN_PLUGINS`.
  - Since a user decision of 2026-10-21, Yarn Classic reads its project and
    user configuration. Mokly therefore no longer passes `--no-default-rc`,
    and a test asserts that it is absent.
  - At command level, `manager_arguments_tests.rs` pins the pnpm arguments,
    and `manager_command_tests.rs` checks that `YARN_PLUGINS` is not allowed.
  - `docs/protocol/mokly-base-dependencies.md:183` requires pnpm installs
    to disable pnpmfile hooks and manager switching. Line 191 says that
    Yarn path redirection is disabled.
- **Problem:** No marker fixture proves any hook guard at the process
  boundary. No test asserts `YARN_IGNORE_PATH` or the two pnpmfile variables.
  A later fix review also reported that the lifecycle marker checks of
  `tests/static_base_managers.test.ts` and
  `tests/helpers/base_manager_fixture.ts` look in the wrong place. Nobody
  has rerun the marker checks to confirm that report.
- **Impact if no action:** A manager release or a refactor can run a base
  hook while every command-level test still passes.
- **Root question:** How should Mokly prove that no base hook runs during a
  scripts-off base install?
- **Options:**
  - **A.** Assert each guard flag and variable in the manager command tests.
    Effort: Small.
  - **C.** Apply A. Then check these points once, outside the test suite,
    and save the output under `.context/`:
    - Run cold base installs with a `.pnpmfile.cjs`, a `.pnpmfile.mjs`, a
      Berry `yarnPath` script, and a Classic `yarn-path` in an ancestor
      `.yarnrc`. No hook marker may appear. When a marker appears, copy the
      manager, its version, and the marker path into this item, and keep it
      open.
    - Find where the lifecycle scripts of
      `tests/helpers/base_manager_fixture.ts` write their markers in a base
      install. When `tests/static_base_managers.test.ts:96-107` reads other
      paths, correct those paths in the suite.
    - Risk: each check covers only the manager versions of that run.
    - Effort: Small.
- **Left out:**
  - One generic marker cannot reach the different hook locations of pnpm
    and Yarn.
  - Only two distinct approaches exist: check the command, or also check
    the process result. Since the `testing` skill of 2026-10-30, the process
    result is a one-time proof, so C checks it once, outside the suite.
  - Former option B: Apply A. Also add cold-build fixtures that write a
    marker file. Use a `.pnpmfile.cjs`, a `.pnpmfile.mjs`, a Berry
    `yarnPath` script, and a Classic `yarn-path` in an ancestor `.yarnrc`.
    The test requires each marker to be absent. Correct the marker
    locations of the existing lifecycle checks. Effort: Medium. Under the
    `testing` skill of 2026-10-30, these fixtures check package-manager
    behaviour, so they run once as a proof under `.context/`, not in the
    suite. C keeps them in that form, with the marker correction.
- **Wider fix:** None. The fixtures of former option B check
  package-manager behaviour, which the `testing` skill keeps out of the
  suite, so they are not a wider fix.
- **Previous examples:** The scripts-off cases of
  `tests/static_base_managers.test.ts` already use a lifecycle marker that
  the test requires to be absent.
- **Recommendation:** C. It covers each concern of the Problem and keeps
  package-manager checks out of the suite. The recommendation was former
  option B before the `testing` skill of 2026-10-30. It was then A, which
  does not cover the lifecycle checks that the Problem names.
- **Action:** ask the user, because on 2026-10-21 the user reserved the choice
  for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5996).
