# Isolate Git settings in every Rust test

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-166-approved-windows-paths`: the wider fix of user
  item 173. It moves here from `plans/follow-ups/isolated-git-test-helper.md`,
  an item of 2026-10-29 from PR #199. Updated on 2026-11-27, from finding 193
  of round 3 of the review of branch
  `calummoore/mokly-source-package-override-jkum`.
- **Location:**
  - Helpers without isolation:
    `crates/mokly-publish/tests/support/checkout.rs:14`,
    `crates/mokly-cli/tests/publish_tests.rs:10`,
    `crates/mokly-cli/tests/html_dependencies_tests.rs:45`,
    `crates/mokly-cli/tests/serve_js/html_dependency_tests.rs:9`, and
    `crates/mokly-cli/tests/html_dependencies/large.rs:9`.
  - A helper that sets only `GIT_CONFIG_NOSYSTEM`:
    `crates/mokly-render/tests/integration/base_stylesheet_support.rs:226`.
  - Direct calls without isolation in `crates/mokly-cli/tests`:
    `changes_failures_tests.rs:158` and `:173`,
    `design_behaviour/fixture.rs:25`, and `design_support/mod.rs:23`.
  - Direct calls without isolation in `crates/mokly-compare/tests`:
    `filter_resource_tests.rs:28`, `:88`, and `:116`, and
    `planning_io_tests.rs:127`.
  - Direct calls without isolation in `crates/mokly-git/tests`:
    `checkout_batch_tests.rs:21`, `lfs_tests.rs:46`, and
    `promisor_tests.rs:23` and `:192`.
  - Direct call without isolation:
    `crates/mokly-publish/tests/checkout_status_tests.rs:111`.
  - Mokly runs from tests:
    - the 28 test files under `crates/mokly-cli/tests` that start
      `env!("CARGO_BIN_EXE_mokly")`, such as `run_configured` at
      `crates/mokly-cli/tests/changes_support/mod.rs:53`
    - the 16 test files that build the product `SystemRunner`, such as
      `Fixture::repository` at `crates/mokly-git/tests/support/mod.rs:65`
  - The owner of the CLI child homes: `Cache::environment` at
    `crates/mokly-cli/tests/process_support/cache.rs:21`.
  - The shared test support crate: `crates/mokly-test-support`.
- **Reason:** The fix moves the test Git calls of five crates and `xtask` to
  one launcher, outside the purpose of the branches that found the class.

- **Terms:**
  - **Isolated Git:** a `git` process with `GIT_CONFIG_GLOBAL` set to
    `/dev/null`, or `NUL` on Windows, and `GIT_CONFIG_NOSYSTEM=1`. It skips
    the global and system configuration files of the user. It still reads
    the default ignore file and the default attributes file.
  - **Global Git settings:** the user's `~/.gitconfig`, the file
    `$XDG_CONFIG_HOME/git/config`, and the system Git configuration. Every
    `git` command reads them unless the caller turns them off.
  - **Default ignore file:** the file that Git reads when no configuration
    sets `core.excludesFile`: `$XDG_CONFIG_HOME/git/ignore`, or
    `~/.config/git/ignore` when `XDG_CONFIG_HOME` is unset or empty. The
    default attributes file, `git/attributes`, is in the same folder.
  - **Test support module:** a shared module under the `tests/` directory of
    a crate, such as `support` or `engine_support`. A test file includes it
    with `mod`.
  - **Pipe deadlock:** a stall in which the test blocks writing the standard
    input of Git, and Git blocks writing a full output pipe.
- **Background:**
  - Rust tests start `git` with `Command::new("git")` to build fixture
    repositories. A search on 2026-11-27 found 33 such calls. One is the
    product Git runner, 13 are isolated test calls, 18 are test calls
    without isolation, and one test call sets only `GIT_CONFIG_NOSYSTEM`. A
    search on 2026-11-01 had found 32 calls.
  - With Git 2.50.1 on 2026-11-01, a global `commit.gpgsign = true` with a
    failing `gpg.program` made `git commit` fail with
    `fatal: failed to write commit object`. The same setting did not fail
    `git commit-tree`. An isolated commit passed.
  - The two isolation variables do not turn off every file of the user. A
    probe with Git 2.43.0 on 2026-11-27 set both variables:
    - `$XDG_CONFIG_HOME/git/ignore` with `/vendor/` made `vendor/a.css` an
      ignored file.
    - With `XDG_CONFIG_HOME` unset, `~/.config/git/ignore` applied in the
      same way.
    - `$XDG_CONFIG_HOME/git/attributes` gave a file an attribute.
    - A local `core.excludesFile` with an empty value stopped the default
      ignore file.
    - A set `XDG_CONFIG_HOME` also stopped `~/.config/git/ignore`, which
      held `/other/` in each case. So an empty folder in `XDG_CONFIG_HOME`
      turns off both default files. Git's `xdg_config_home` in `path.c`
      gives this rule.
  - On 2026-11-27 a review found that a global ignore file with `/vendor/`
    turns a nested repository into an ignored path. Then two tests fail,
    because they expect the nested repository status:
    - `crates/mokly-git/tests/working_path_status_tests.rs`, with the nested
      repository `vendor/theme`.
    - `crates/mokly-cli/tests/changes_path_status_warnings_tests.rs`, with
      the nested repository `vendor/nested` and the submodule
      `vendor/submodule`.
    - The same ignore file also made `git submodule add` into `vendor/` fail
      at fixture setup.
  - The fix of that review sets an empty local `core.excludesFile` directly
    after `git init` in the two fixture builders: `Fixture::new` at
    `crates/mokly-git/tests/support/mod.rs:20` and `base` at
    `crates/mokly-cli/tests/changes_support/mod.rs:99`. It covers only the
    ignore rules of these two fixtures.
  - Mokly runs from tests keep the Git settings of the developer:
    - 16 test files build the product `SystemRunner`: 8 in `mokly-git`, 6 in
      `mokly-compare`, 1 in `mokly-publish`, and 1 in `mokly-render`. An
      example is `Fixture::repository`. The runner starts `git` with the
      environment of the test process.
    - 28 test files under `crates/mokly-cli/tests` start the Mokly CLI with
      `env!("CARGO_BIN_EXE_mokly")`. An example is `run_configured`, which
      sets a temporary `HOME`. The CLI still gets an inherited
      `GIT_CONFIG_GLOBAL`, `XDG_CONFIG_HOME`, and the system configuration.
    - `Cache::environment` gives the home variables of a CLI child in 7 of
      these test files. It sets `HOME`, `XDG_CACHE_HOME`, and
      `LOCALAPPDATA`, and no Git variable.
    - So a test that classifies paths through the product reader or the CLI
      can pass or fail by the settings of the developer.
    - Four methods of the `Runner` trait take environment entries for each
      call, at `crates/mokly-git/src/command.rs:68` to line 99.
      `SystemRunner` passes them to `git_command` at
      `crates/mokly-git/src/system.rs:68`. `run`, which most readers use,
      takes none, and `SystemRunner` has no default entries that a test
      could set for every call.
  - The isolated test calls are copies in several places:
    - `git` and `git_input` in the test support module `support` of
      `mokly-compare`, at `crates/mokly-compare/tests/support/mod.rs:77` and
      `:82`. `git_input` writes standard input from a scoped thread while
      `wait_with_output` reads the output, so a large input cannot cause a
      pipe deadlock. Seventeen test files of `mokly-compare` include
      `mod support;`.
    - The local helper `git` at
      `crates/mokly-compare/tests/engine_support/mod.rs:233` is private, and
      it sends no input. Other local helpers are at
      `crates/mokly-compare/tests/deep_tree_tests.rs:43`,
      `crates/mokly-cli/tests/changes_failures_tests.rs:9`,
      `crates/mokly-cli/tests/changes_support/mod.rs:15`,
      `crates/mokly-git/tests/support/mod.rs:39`, and
      `xtask/src/remote/_tests_/git_test_runner.rs:25`.
    - The `xtask` runner also removes the Git repository variables and the
      secret variables, and it points `GIT_CONFIG_GLOBAL` at a file of its
      own.
    - Inline calls at `crates/mokly-git/tests/edge_cases_tests.rs:54`,
      `:126`, and `:146`, at `crates/mokly-git/tests/lfs_tests.rs:30`, and at
      `crates/mokly-git/tests/promisor_tests.rs:99` and `:183`.
  - Five helpers without full isolation run `git commit`, so the global
    setting above makes their tests fail:
    - `git` at `crates/mokly-publish/tests/support/checkout.rs:14`. Its
      `init` commits at line 46. The module comment says "Isolated real Git
      fixture construction", but the helper sets neither variable.
    - `git` at `crates/mokly-cli/tests/publish_tests.rs:10`, with a commit at
      line 33.
    - `git` at `crates/mokly-cli/tests/html_dependencies_tests.rs:45`, with a
      commit at line 96.
    - `git` at `crates/mokly-cli/tests/serve_js/html_dependency_tests.rs:9`,
      with a commit at line 38.
    - `git` at
      `crates/mokly-render/tests/integration/base_stylesheet_support.rs:226`,
      which sets only `GIT_CONFIG_NOSYSTEM`, with a commit at line 71.
  - `git_bytes` at `crates/mokly-cli/tests/html_dependencies/large.rs:9` has
    no isolation either. It makes a commit with `git commit-tree` at line 48.
    It writes all of its input before it reads the output.
  - Thirteen direct calls without isolation only read data or set
    repository settings:
    - `rev-parse` at `crates/mokly-cli/tests/changes_failures_tests.rs:158`
      and `:173`.
    - `ls-files` in the Mokly checkout at
      `crates/mokly-cli/tests/design_behaviour/fixture.rs:25` and
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
      `crates/mokly-git/tests/promisor_tests.rs:23` and `:192`.
    - `update-index --index-info` at
      `crates/mokly-publish/tests/checkout_status_tests.rs:111`.
  - The shared test support crate `crates/mokly-test-support` gives trace
    capture, durable fixture folders, and reap records. `mokly-cli`,
    `mokly-compare`, `mokly-git`, `mokly-render`, and three other crates use
    it as a development dependency. `mokly-publish` and `xtask` do not. It
    has no Git helper.
  - On 2026-10-28 the user chose to isolate the large-sources test with the
    shared helper of `mokly-compare`, given a form that sends standard input.
    `crates/mokly-compare/tests/large_sources_tests.rs` now calls
    `support::git_input`. The same answer rejected a separate fix in each
    other helper, because one shared isolated helper is the structural fix.
  - The product Git runner at `crates/mokly-git/src/system_command.rs:8`
    reads the settings of the user on purpose. This work does not change it
    for users.
- **Problem:** Eighteen Git calls in the tests of four crates read the global
  Git settings of the developer, and one more call reads the global file.
  Five of them commit, so a global `commit.gpgsign = true` makes their tests
  fail. The isolated calls still read the default ignore and attributes
  files. The Mokly runs of 44 test files read the Git settings of the
  developer. A temporary `HOME` in a CLI test skips only `~/.gitconfig`. On 2026-11-27 a global ignore rule changed the expected status
  of two tests in this way.
- **Impact if no action:** Test results depend on the Git configuration of
  the developer, not on the code. Each new test that copies a local helper,
  or that runs Mokly from a test, adds one more call to fix.
- **Root question:** How do all Rust tests that run Git, directly or through
  Mokly, stay independent of the Git settings of the developer?
- **Options:**
  - **A.** In each of the six helpers and the 13 direct calls without full
    isolation, set the two variables and point `XDG_CONFIG_HOME` at an empty
    folder. New tests can still copy a helper without them,
    and the Mokly runs from tests keep the settings of the developer. The
    2026-10-28 answer rejected this approach for the other helpers. Effort:
    Small.
  - **B.** Add one isolated Git launcher to `crates/mokly-test-support`.
    Effort: Large, because it moves callers in five crates and `xtask`, and
    it reaches the Mokly runs of 44 test files.
    - The launcher sets the two isolation variables and points
      `XDG_CONFIG_HOME` at an empty folder, so Git reads no default ignore
      or attributes file.
    - Give it a form without input and a form that writes standard input
      from a separate thread while it reads the output, as
      `support::git_input` does.
    - Give the same Git environment to each CLI child of the 28 CLI test
      files. `Cache::environment` already owns the child homes of 7 of
      them, so it can own the Git variables too.
    - Give the same Git environment to the product `SystemRunner` of the 16
      test files, through default environment entries that only tests set.
    - Move every Git call of the Rust tests to it, and delete the local
      helpers. Keep the behaviour of the product Git runner for users.
  - **C.** Do B, and add a repository check that rejects
    `Command::new("git")` in Rust tests outside the shared crate. The check
    is a new gate, which only the user can approve. Effort: Large.
- **Left out:**
  - Set the two variables for every test process in the `[env]` table of
    `.cargo/config.toml`. `cargo run` and `cargo xtask` read the same table,
    so the product and the task runner would also ignore the Git settings of
    the developer.
  - Clear one known Git variable in a test. It misses the other global
    settings.
  - Set a local `core.excludesFile` in each fixture builder only, as the fix
    of 2026-11-27 does. It covers the ignore rules of two fixtures, not the
    other settings or the other tests.
  - Change the environment of the product Git reader for users. Users need
    Mokly to follow their effective ignore rules.
- **Wider fix:** B. One shared launcher removes the call without isolation
  from every crate, and it also isolates the Mokly runs from tests. C only
  adds detection on top of B, and it adds a gate.
- **Previous examples:**
  - `crates/mokly-compare/tests/large_sources_tests.rs` had its own Git
    helper without isolation until the 2026-10-28 fix moved it to
    `support::git_input`.
  - On 2026-11-27 a global ignore file changed the expected status in
    `crates/mokly-git/tests/working_path_status_tests.rs` and
    `crates/mokly-cli/tests/changes_path_status_warnings_tests.rs`. The fix
    set an empty local `core.excludesFile` in both fixture builders.
- **Related:**
  - [ignored-module-path-spelling.md](./ignored-module-path-spelling.md):
    same fixtures. Its tests must set `core.precomposeUnicode` and
    `core.ignoreCase` in the fixture repository, which the launcher of B
    keeps apart from the settings of the developer.
  - [ignored-module-large-index.md](./ignored-module-large-index.md): same
    fixtures. Its tests also classify paths through the product reader.
  - [non-serve-process-cache-homes.md](./non-serve-process-cache-homes.md):
    same cause. CLI children in tests keep parts of the environment of the
    developer. Its option A moves two launchers to `Cache::environment`,
    which B here extends with the Git variables.
  - [plain-git-fsmonitor-override.md](./plain-git-fsmonitor-override.md):
    same code. Its option D changes `git_command`, which the default test
    entries of B here also reach.
  - [xtask-fixture-runtime-host-cache.md](./xtask-fixture-runtime-host-cache.md):
    same child environment. It moves the `HOME` of fixture generation into
    the fixture root. It asks whether a child step needs the Git
    configuration of the real home.
- **Recommendation:** B. One launcher fixes the 19 calls and the Mokly runs
  from tests, and it stops new copies. The 2026-10-28 answer named one shared
  helper the structural fix. C best protects the codebase, but it needs the
  approval of the user, because it adds a gate.
- **Action:** fix after merge, apply B, because it changes the tests of five
  crates and `xtask`, outside the purpose of the branches that found the
  class.

The earlier item is
[isolated-git-test-helper.md at the commit before its deletion](https://github.com/mokly-ai/mokly/blob/208205c24cb0b6d9f78bfe507ef0373af25f11ba/plans/follow-ups/isolated-git-test-helper.md).
