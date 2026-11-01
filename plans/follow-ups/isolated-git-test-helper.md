# Use the isolated Git test helper

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 173, from decision 7 of the W8 work.
- **Location:** `crates/mokly-compare/tests/large_sources_tests.rs:10-34`,
  `crates/mokly-compare/tests/support/mod.rs:67-85`, and
  `crates/mokly-compare/tests/engine_support/mod.rs:214-231`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Global Git settings:** the user's `~/.gitconfig` and the system Git
    configuration, which every `git` command reads unless a test turns them
    off.
  - **Test support module:** a shared module under
    `crates/mokly-compare/tests/`, such as `support` or `engine_support`,
    that a test file includes with `mod`.
  - **Pipe deadlock:** a stall where the test blocks while it writes Git's
    standard input, and Git blocks while it writes a full output pipe that
    nobody reads.
- **Background:**
  - `support::git`, at `support/mod.rs:67-85`, is public. It runs `git` with
    `GIT_CONFIG_GLOBAL` set to `/dev/null`, or `NUL` on Windows, and
    `GIT_CONFIG_NOSYSTEM=1`. So the developer's settings cannot change a
    test. It sends no standard input. Ten test files of the crate include
    `mod support;`.
  - `engine_support/mod.rs:214-231` has a second isolated `git` function
    with the same two variables. It is private to that module, and it sends
    no input either.
  - `large_sources_tests.rs:10-15` includes `engine_support` for its
    `Fixture`. It does not include `support`.
  - The test's own private `git` function, at lines 17-34, sets neither
    variable. It writes all of `input` to standard input at line 26, and
    only then reads the output at line 27.
  - The test sends input twice: to `git hash-object -w --stdin` at lines
    42-47, and 100,001 index lines to `git update-index --index-info` at
    lines 51-55.
  - Optional history: on 2026-10-28, commit `79b43e7c` on the unmerged
    branch `conductor/rust-rebuild-166-windows-paths-and-links` implemented
    A. It added `git_input(root, args, input)` to `support/mod.rs` and kept
    `git` as a call with empty input. A scoped writer thread sent the input
    while `wait_with_output` read the output. The test then included
    `mod support;`, and its local function was removed. That commit is not
    on `main`, it is not an approval, and the work does not need it.
- **Problem:** A global setting such as `commit.gpgsign = true` can make the
  large-sources test fail on a developer machine.
- **Impact if no action:** The test result depends on the developer's Git
  configuration, not on the code.
- **Root question:** How do Rust tests that run Git stay independent of the
  developer's Git settings?
- **Options:**
  - **A.** Use the shared isolated `support::git` helper. Include
    `mod support;` in `large_sources_tests.rs`. Add a form of the helper that
    sends standard input, and delete the local `git` function. Write the
    input from a separate thread while the helper reads the output. A write
    before the read can cause a pipe deadlock when Git fills its output pipe
    first. Effort: Small.
  - **C.** Keep the local `git` function, and set the two isolation
    variables in it. It changes only the test file. Its direct
    `Command::new("git")` stays, so the check of B would reject it. Its
    write before the read stays too. Effort: Small.
  - **B.** Apply A, and add a check that rejects `Command::new("git")` in
    Rust tests outside the support modules. It adds a gate. Effort: Medium.
  - **D.** Add one isolated Git helper in a new shared test support crate.
    Move every Git caller of the Rust tests to it. It needs a new shared
    support boundary and a caller migration in several crates. Effort: Large.
- **Left out:** Clear one known Git variable in the test. It misses the
  other global settings.
- **Wider fix:** D. One shared helper removes the unisolated case in every
  crate. B only detects the class, and it adds a gate.
- **Previous examples:**
  - `crates/mokly-publish/tests/support/checkout.rs:14-26` starts `git` with
    neither variable, and `init` runs `git commit` at line 46. A global
    setting such as `commit.gpgsign = true` can fail it in the same way.
  - `crates/mokly-compare/tests/deep_tree_tests.rs:44-51` and
    `crates/mokly-cli/tests/changes_failures_tests.rs:9-16` start `git`
    directly, but they set both variables, so they are isolated.
- **Recommendation:** D. One shared isolated helper removes the local-settings
  dependency in every Rust test crate. Its new crate and caller migration affect
  effort, not approval. The user's reserved choice still waits for an answer.
- **Action:** ask the user, because on 2026-10-21 the user ruled that new review
  items wait for the user after the merge. The branch that lands the chosen
  option deletes this item.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6319).
