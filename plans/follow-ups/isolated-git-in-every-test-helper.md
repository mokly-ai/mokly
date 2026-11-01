# Isolate Git in every Rust test helper

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-166-windows-paths-and-links`: the wider fix of user
  item 173. It moves here from `plans/follow-ups/isolated-git-test-helper.md`,
  an item of 2026-10-29 from PR #199.
- **Location:**
  - Helpers without isolation:
    `crates/mokly-publish/tests/support/checkout.rs:14`,
    `crates/mokly-cli/tests/publish_tests.rs:10`,
    `crates/mokly-cli/tests/html_dependencies_tests.rs:24`,
    `crates/mokly-cli/tests/serve_js/html_dependency_tests.rs:9`, and
    `crates/mokly-cli/tests/html_dependencies/large.rs:9`.
  - Direct calls without isolation in `crates/mokly-cli/tests`:
    `changes_failures_tests.rs:158` and `:173`,
    `design_behaviour/fixture.rs:27`, and `design_support/mod.rs:23`.
  - Direct calls without isolation in `crates/mokly-compare/tests`:
    `filter_resource_tests.rs:28`, `:88`, and `:116`, and
    `planning_io_tests.rs:127`.
  - Direct calls without isolation in `crates/mokly-git/tests`:
    `checkout_batch_tests.rs:21`, `lfs_tests.rs:46`, and
    `promisor_tests.rs:59` and `:140`.
  - Direct call without isolation:
    `crates/mokly-publish/tests/checkout_status_tests.rs:111`.
- **Reason:** The fix moves the test Git calls of five crates to one shared
  helper, outside the purpose of the branch that isolated
  `large_sources_tests.rs`.

- **Terms:**
  - **Isolated Git:** a `git` process with `GIT_CONFIG_GLOBAL` set to
    `/dev/null`, or `NUL` on Windows, and `GIT_CONFIG_NOSYSTEM=1`. It ignores
    the global and system Git settings of the user.
  - **Global Git settings:** the user's `~/.gitconfig` and the system Git
    configuration. Every `git` command reads them unless the caller turns
    them off.
  - **Test support module:** a shared module under the `tests/` directory of
    a crate, such as `support` or `engine_support`. A test file includes it
    with `mod`.
  - **Pipe deadlock:** a stall in which the test blocks writing the standard
    input of Git, and Git blocks writing a full output pipe.
- **Background:**
  - Rust tests start `git` with `Command::new("git")` to build fixture
    repositories. A search on 2026-11-01 found 32 such calls. One is the
    product Git runner, 13 are isolated test calls, and 18 are test calls
    without isolation.
  - With Git 2.50.1 on 2026-11-01, a global `commit.gpgsign = true` with a
    failing `gpg.program` made `git commit` fail with
    `fatal: failed to write commit object`. The same setting did not fail
    `git commit-tree`. An isolated commit passed.
  - The isolated test calls are copies in several places:
    - `git` and `git_input` in the test support module `support` of
      `mokly-compare`, at `crates/mokly-compare/tests/support/mod.rs:69` and
      `:74`. `git_input` writes standard input from a scoped thread while
      `wait_with_output` reads the output, so a large input cannot cause a
      pipe deadlock. Twelve test files of `mokly-compare` include
      `mod support;`.
    - Local helpers at
      `crates/mokly-compare/tests/engine_support/mod.rs:214`,
      `crates/mokly-compare/tests/deep_tree_tests.rs:44`,
      `crates/mokly-cli/tests/changes_failures_tests.rs:9`,
      `crates/mokly-cli/tests/changes_support/mod.rs:15`,
      `crates/mokly-git/tests/support/mod.rs:38`, and
      `xtask/src/remote/_tests_/git_test_runner.rs:25`. The helper of
      `engine_support` is private, and it sends no input.
    - The `xtask` runner also removes the Git repository variables and the
      secret variables, and it points `GIT_CONFIG_GLOBAL` at a file of its
      own.
    - Inline calls at `crates/mokly-git/tests/edge_cases_tests.rs:54`,
      `:126`, and `:146`, at `crates/mokly-git/tests/lfs_tests.rs:30`, and at
      `crates/mokly-git/tests/promisor_tests.rs:42` and `:131`.
  - Four helpers without isolation run `git commit`, so the global setting
    above makes their tests fail:
    - `git` at `crates/mokly-publish/tests/support/checkout.rs:14`. Its
      `init` commits at line 46. The module comment says "Isolated real Git
      fixture construction", but the helper sets neither variable.
    - `git` at `crates/mokly-cli/tests/publish_tests.rs:10`, with a commit at
      line 33.
    - `git` at `crates/mokly-cli/tests/html_dependencies_tests.rs:24`, with a
      commit at line 79.
    - `git` at `crates/mokly-cli/tests/serve_js/html_dependency_tests.rs:9`,
      with a commit at line 38.
  - `git_bytes` at `crates/mokly-cli/tests/html_dependencies/large.rs:9` has
    no isolation either. It makes a commit with `git commit-tree` at line 47.
    It writes all of its input before it reads the output.
  - Thirteen direct calls without isolation only read data or set
    repository settings:
    - `rev-parse` at `crates/mokly-cli/tests/changes_failures_tests.rs:158`
      and `:173`.
    - `ls-files` in the Mokly checkout at
      `crates/mokly-cli/tests/design_behaviour/fixture.rs:27` and
      `crates/mokly-cli/tests/design_support/mod.rs:23`.
    - `config` and `lfs install --local` at
      `crates/mokly-compare/tests/filter_resource_tests.rs:28`, `:88`, and
      `:116`.
    - `config core.autocrlf false` at
      `crates/mokly-compare/tests/planning_io_tests.rs:127`.
    - `cat-file --filters` at
      `crates/mokly-git/tests/checkout_batch_tests.rs:21`, and
      `lfs install --local` at `crates/mokly-git/tests/lfs_tests.rs:46`.
    - `rev-list` and `remote set-url` at
      `crates/mokly-git/tests/promisor_tests.rs:59` and `:140`.
    - `update-index --index-info` at
      `crates/mokly-publish/tests/checkout_status_tests.rs:111`.
  - No shared test support crate exists. Each crate keeps its own helpers.
  - On 2026-10-28 the user chose to isolate the large-sources test with the
    shared helper of `mokly-compare`, given a form that sends standard input.
    `crates/mokly-compare/tests/large_sources_tests.rs` now calls
    `support::git_input`. The same answer rejected a separate fix in each
    other helper, because one shared isolated helper is the structural fix.
  - The product Git runner at `crates/mokly-git/src/system_command.rs:8`
    reads the settings of the user on purpose. This work does not change it.
- **Problem:** Eighteen Git calls in the tests of four crates read the global
  Git settings of the developer. Four of them commit, so a global
  `commit.gpgsign = true` makes their tests fail.
- **Impact if no action:** Test results depend on the Git configuration of
  the developer, not on the code. Each new test that copies a local helper
  adds one more call to fix.
- **Root question:** How do all Rust tests that run Git stay independent of
  the Git settings of the developer?
- **Options:**
  - **A.** Set the two isolation variables in each of the five helpers and
    the 13 direct calls without isolation. New tests can still copy a helper
    without them. The 2026-10-28 answer rejected this approach for the other
    helpers. Effort: Small.
  - **B.** Add one isolated Git helper to a new test support crate, which the
    tests of every crate use as a development dependency. Give it a form
    without input and a form that writes standard input from a separate
    thread while it reads the output, as `support::git_input` does. Move
    every Git call of the Rust tests to it, and delete the local helpers.
    Keep the product Git runner unchanged. Effort: Medium.
  - **C.** Do B, and add a repository check that rejects
    `Command::new("git")` in Rust tests outside the shared crate. The check is
    a new gate, which only the user can approve. Effort: Medium.
- **Left out:**
  - Set the two variables for every test process in the `[env]` table of
    `.cargo/config.toml`. `cargo run` and `cargo xtask` read the same table,
    so the product and the task runner would also ignore the Git settings of
    the developer.
  - Clear one known Git variable in a test. It misses the other global
    settings.
- **Wider fix:** B. One shared helper removes the call without isolation from
  every crate. C only adds detection on top of B, and it adds a gate.
- **Previous examples:** `crates/mokly-compare/tests/large_sources_tests.rs`
  had its own Git helper without isolation until the 2026-10-28 fix moved it
  to `support::git_input`.
- **Recommendation:** B. One helper fixes the 18 calls and stops new copies,
  and the 2026-10-28 answer named it the structural fix. C best protects the
  codebase, but it needs the approval of the user, because it adds a gate.
- **Action:** fix after merge, apply B, because it changes the tests of five
  crates, outside the purpose of the branch that isolated the large-sources
  test.

The earlier item is
[isolated-git-test-helper.md at the commit before its deletion](https://github.com/mokly-ai/mokly/blob/1066bc769eb018068f1d0821595dc0ae8daaff56/plans/follow-ups/isolated-git-test-helper.md).
