# Plain Git commands can start a filesystem monitor

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-16, from the branch `calummoore/plain-git-spawns`, review round 1, finding 1.
- **Location:** `crates/mokly-git/src/system_command.rs` (`git_command`),
  `crates/mokly-git/src/conversion_paths.rs:38`,
  `crates/mokly-git/src/source_key.rs:39`,
  `crates/mokly-git/src/history.rs:19`, and
  `crates/mokly-cli/src/serve_changes_native.rs:48`.
- **Reason:** Only a Linux checkout with a hook-mode `core.fsmonitor` meets it, and only when a stop comes while such a command runs, so the outcome rules defer a Small fix of a Rare problem that is not High.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Plain group:** the process mode `ProcessMode::PlainGroup` of
    `crates/mokly-git/src/command.rs`. The child starts in its own process
    group through `Command::process_group(0)`, with no `pre_exec` hook, so
    the standard library uses `posix_spawn` instead of a fork of the core. It
    gets no new session and no Linux subreaper.
  - **Full tree:** the default mode `ProcessMode::FullTree`. A `pre_exec` hook
    starts a new session and, on Linux, makes the child a subreaper, so the
    owner can still stop orphan descendants.
  - **Filesystem monitor:** Git's `core.fsmonitor` setting. It names a hook
    command, such as Git's sample Watchman hook, or, on macOS and Windows,
    `true` for Git's built-in monitor daemon. Git starts it when a command
    reads the index.
- **Background:**
  - On 2026-11-16 the plain group was chosen for `rev-parse`, `merge-base`,
    `ls-tree`, `rev-list` with lazy fetch disabled, `config` without editing,
    and `check-attr`, because these commands start no other process. The rule
    in `docs/protocol/mokly-git.md`, section "Cancellation And Fetch", says
    that a helper-free command owns a process group and every other command
    owns the full tree.
  - `git check-attr` reads the index, also with `--attr-source`
    (`builtin/check-attr.c` calls `repo_read_index`). The index read calls
    `tweak_fsmonitor`, which can start the configured hook. Git 2.43.0 ran a
    configured hook from `check-attr --attr-source=HEAD` in a check on
    2026-11-16, and `-c core.fsmonitor=false` stopped it.
  - A revision name that starts with `:` also makes `rev-parse --verify` read
    the index. Git 2.43.0 ran the hook for `:README.md^{commit}`. Serve's ref
    poll and `merge_base_of` pass the configured base name to `rev-parse`.
  - The plain-group calls are: `check-attr` in
    `crates/mokly-git/src/conversion_paths.rs:38` (checkout conversion paths)
    and `crates/mokly-git/src/source_key.rs:39` (the checkout settings hash),
    and `rev-parse` in `crates/mokly-git/src/history.rs:19` and
    `crates/mokly-cli/src/serve_changes_native.rs:48`.
  - Two methods use the checkout settings hash: `Repository::source_key` and
    `Repository::checkout_identity`. `CachedExtraction` in
    `crates/mokly-compare/src/extraction.rs` computes the source key when a
    base looks up or builds its source extraction. A Serve base preparation
    samples the checkout identity before its first base read, in
    `NativeBase::prepare` of `crates/mokly-cli/src/changes_base.rs`.
    Before each reuse of a kept base, `ServeBase::find_kept` in
    `crates/mokly-cli/src/serve_base.rs` samples it again through
    `FreshnessChecks::current` of `crates/mokly-compare/src/base_freshness.rs`.
    So the checkout sample
    and the reuse check add `check-attr` runs to Serve classifications, and a
    stop can come while one runs.
  - Every plain request goes through `git_command` in
    `crates/mokly-git/src/system_command.rs`, also the requests that call
    sites build without `command_with_mode`.
  - `config --null --list --includes`, which the checkout settings hash
    includes, lists command-line `-c` settings too.
- **Problem:** A hook that the monitor starts, such as the Watchman server, can
  start its own session. In the plain group on Linux, no subreaper adopts it,
  so a stop of the Git command does not reach it, and it keeps running.
- **Impact if no action:** On a Linux checkout with a hook-mode monitor, a stop
  during one of these commands can leave the monitor's daemon running. On macOS
  and Windows, both modes reach the same monitor processes, so nothing changes
  there. `plans/follow-ups/git-helpers-outlive-commands.md` grades a helper
  that outlives a normal finish Low.
- **Root question:** How can every Git command in a plain process group stay
  free of helper processes when the user's Git configuration enables a
  filesystem monitor?
- **Options:**
  - **A.** Put the two `check-attr` calls back on the full tree. Update the
    command list in `crates/mokly-git/README.md`. Effort: Small.
  - **B.** Route both `check-attr` calls through one attribute-query helper
    that always passes `-c core.fsmonitor=false`, with request-capture tests.
    It leaves the `rev-parse` case open. Effort: Small.
  - **C.** Start every managed child through the spawn trampoline of
    `plans/follow-ups/managed-child-spawn-trampoline.md`, so no command
    depends on a list of helper-free commands. Effort: Large.
  - **D.** `git_command` puts `-c core.fsmonitor=false` before the arguments
    of every plain request. Add the plain and the full-tree case to
    `request_mode_alone_selects_process_configuration` in
    `crates/mokly-git/src/_tests_/system_tests.rs`: the plain command starts
    with the override, and the full-tree command does not. Save one real-Git
    run as the one-time proof. Add one line to `crates/mokly-git/README.md`.
    Cost: the checkout source key changes one time, because
    `config --list --includes` then lists the override, so each cached base
    source is extracted one more time. The checkout identity changes in the
    same way. Serve keeps a base only in memory, so a new binary starts with
    no kept base, and this costs nothing more. Effort: Small.
- **Left out:** Change nothing, because it fails the goal. A one-time probe of
  `core.fsmonitor` that selects the full tree, because B and D run no extra
  command and keep the plain speed. A plain spawn in a new session, because it
  gives no Linux subreaper. A test that runs every plain call site with a
  configured hook, because it is a test for the class and D removes the case.
  A Mokly attribute engine, because the conversion runs in Git's
  `cat-file --filters` and a second engine must match Git on every rule.
- **Wider fix:** D. It sets the override in the one place that every plain
  request goes through, so a new plain call site cannot start the monitor. C
  is the launcher-wide fix of the class.
- **Related:**
  - A second case of the same cause is fixed and has no item. A Git setting
    or build let a plain command start a process. In a partial
    clone, a Git build that ignores `GIT_NO_LAZY_FETCH=1` let a plain
    `ls-tree -l` start `git fetch`. `tree_request` in
    `crates/mokly-git/src/repository_command.rs` gives `ls-tree` the full tree
    when `GitRepositories::open` finds a promisor remote. Both fixes live in
    the request construction of `mokly-git` and do not conflict.
  - `plans/follow-ups/managed-child-spawn-trampoline.md`: option C.
  - `plans/follow-ups/git-helpers-outlive-commands.md`: helpers that start
    their own session, after a normal finish, in both modes.
  - [isolated-git-in-every-test-helper.md](./isolated-git-in-every-test-helper.md):
    the same code. Its option B gives `SystemRunner` default environment
    entries for tests, which reach `git_command` as option D here does.
- **Recommendation:** D. It covers `check-attr` and `rev-parse` and every
  later plain call, keeps Git's attribute results and the speed gain, and
  costs one re-extraction of each cached base.
- **Action:** fix after merge, apply D, because the problem is Rare and Low,
  and the fix does not get harder after the merge.
