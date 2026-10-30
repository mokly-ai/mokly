# Use the isolated Git test helper

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 173, from decision 7 of the W8 work.
- **Location:** `crates/mokly-compare/tests/large_sources_tests.rs:17-34`
  and `crates/mokly-compare/tests/support/mod.rs:67-85`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Global Git settings:** the user's `~/.gitconfig` and the system Git
    configuration, which every `git` command reads unless a test turns them
    off.
- **Background:**
  - `support::git`, at `support/mod.rs:67-85`, runs `git` with
    `GIT_CONFIG_GLOBAL` set to `/dev/null`, or `NUL` on Windows, and
    `GIT_CONFIG_NOSYSTEM=1`. So the developer's settings cannot change a
    test.
  - `large_sources_tests.rs:17-34` has its own `git` function. It starts
    `git` without those variables, and it writes `input` to the command's
    standard input, which `support::git` does not support.
- **Problem:** A global setting such as `commit.gpgsign = true` can make the
  large-sources test fail on a developer machine.
- **Impact if no action:** The test result depends on the developer's Git
  configuration, not on the code.
- **Root question:** How do Rust tests that run Git stay independent of the
  developer's Git settings?
- **Options:**
  - **A.** Use the isolated `support::git` helper. Give it a form that
    writes standard input, or set the same two variables in the local
    function. Effort: Small.
  - **B.** Apply A, and add a check that rejects `Command::new("git")` in
    Rust tests outside the support modules. It adds a gate. Effort: Medium.
- **Left out:** Clear one known Git variable in the test. It misses the
  other global settings. Fewer than three approaches exist, because each
  test either uses the isolation or a check enforces it.
- **Wider fix:** B. The check stops new tests that skip the isolation.
- **Previous examples:** Other Rust test files also start `git` directly,
  for example `crates/mokly-compare/tests/deep_tree_tests.rs` and
  `crates/mokly-cli/tests/changes_failures_tests.rs`. This item did not
  check whether they isolate the global settings.
- **Recommendation:** A. It removes the known dependence on local settings.
  B best protects the class, and it needs the user's approval because it
  adds a gate.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user ruled that new review items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6319).
