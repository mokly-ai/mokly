# Make pnpm recreation independent of CI

- **Severity:** Medium. **Likelihood:** Rare (estimate). **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 158, pnpm CI fix finding 1.
- **Location:** `crates/mokly-compare/src/manager_command.rs:21` and
  `crates/mokly-compare/src/manager_environment.rs:17`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies that Changes runs when the base lockfile differs from the
    working tree.
  - **Dependency tier:** the source of a base side's dependencies. Tier two
    is a private base install. Tier three uses the working tree's
    dependencies with a warning.
- **Background:** pnpm and Mokly handle a stale modules directory as follows.
  - pnpm keeps the state of a `node_modules` directory in
    `node_modules/.modules.yaml`.
  - When that state does not match the install, pnpm must remove and recreate
    the directory.
  - Without a terminal, pnpm asks before the removal and then aborts, unless
    it detects CI.
  - `manager_command::arguments` gives pnpm no setting for that prompt.
  - On `main`, `manager_environment::allowed` passes no `CI` or
    `GITHUB_ACTIONS` variable to the install.
- **Problem:** The record found that a base with a tracked
  `node_modules/.modules.yaml` that needs recreation fails locally with
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, which gives tier three. The
  same base succeeded under CI, which gave tier two. Because the install
  environment drops the CI variables, the work must first confirm the current
  result in each environment and pnpm version.
- **Impact if no action:** Such a base falls back to tier three, although
  a private install that skips the prompt could give tier two. Before the
  install dropped the CI variables, CI gave tier two and a local run gave
  tier three. Nobody has measured the current tier in each environment.
- **Root question:** How should a private pnpm install treat a tracked
  `node_modules` state that needs recreation, the same way in every
  environment?
- **Options:**
  - **A.** Turn off the recreation prompt for Mokly's private installs, so
    that pnpm never stops on it. Effort: Small.
  - **B.** Document that the dependency tier can differ in CI. Effort: Small
    (estimate).
- **Left out:** Forcing every install into CI mode can change other
  package-manager behaviour. Removing a tracked `node_modules` from the
  private entry changes the base source that the install reads. A tracked
  `node_modules` can hold vendored dependencies.
- **Wider fix:** A. An install that never prompts gives the same result in
  every environment.
- **Previous examples:** None found.
- **Recommendation:** A. It gives local and CI runs the same tier.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6158).
