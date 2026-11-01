# Stopped base install waits for held output pipes

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-process-tree-stops`. The finding check of its
  first review round found it outside the scope.
- **Location:** `crates/mokly-compare/src/process.rs:87` to line 97,
  `crates/mokly-compare/src/process.rs:113` to line 137, and
  `crates/mokly-compare/src/commands.rs:103` to line 148.
- **Reason:** The wait predates the change that found it, and the review of
  that change found it outside the diff.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies when the base needs JavaScript rendering and its
    dependency inputs differ from the working tree.
  - **Stop:** Mokly ends a package manager because of cancellation, the
    time limit, the byte bound, or the bound on its output. It signals the
    manager's process group and each descendant that it finds through
    parent links.
  - **Output pipes:** the standard output and standard error of the
    manager. `SystemSpawner` in `process.rs` reads each one in its own
    thread. A child process inherits them unless its parent redirects them.
  - **Survivor:** a process that descends from the manager and outlives the
    stop.
- **Background:**
  - The base needs JavaScript rendering when its catalogue has a JavaScript
    entry module or a stories file, or its configuration names a renderer
    or PostCSS. `crates/mokly-cli/src/changes_base.rs:87` to line 102
    prepares base dependencies only then. An HTML-only catalogue needs no
    install. The dependency inputs are the tracked package manifests and
    lockfiles. With pnpm or Yarn lockfiles, they also hold the manager
    configuration files.
  - `TimedCommands::run` in `crates/mokly-compare/src/commands.rs` runs
    each manager command of a base install. Its loop, at lines 103 to 144,
    calls `Child::poll` and pauses 5 ms between calls.
  - `OwnedChild::poll` in `crates/mokly-compare/src/process.rs:87` to line
    97 is true only when the manager has exited and both reader threads have
    finished. A reader finishes only when its pipe closes.
  - After a cancellation, the loop sends `SIGTERM` at once and `SIGKILL`
    one second later, through `Shutdown::step` in
    `crates/mokly-git/src/control.rs:77`. The time-limit check at line 115
    and the byte-bound check at line 118 skip a cancelled run. So the loop
    ends only when `poll` is true.
  - After the time limit, a byte-bound error, or a `poll` error, the loop
    ends. Lines 145 to 147 call `child.kill()` once and ignore its error.
    Line 148 then calls `child.finish()`.
  - `OwnedChild::finish`, at `process.rs:113` to line 125, waits for the
    manager at line 114. It joins both reader threads at lines 115 and 116,
    and only then kills the group at line 117. A join waits until its pipe
    closes.
  - `Drop for OwnedChild`, at lines 128 to 137, kills the group, waits for
    the manager, and then joins both readers.
  - When output passes the 1 MiB bound, `capture`, at lines 139 to 150,
    kills the group from its reader thread. The other reader still waits
    for its own pipe.
  - The time limit of a base install is 120 seconds, at
    `crates/mokly-cli/src/base_dependencies.rs:170`.
  - `docs/protocol/mokly-base-install-processes.md#bounds-and-stops`
    states two limits of a stop. On macOS, a stop does not signal a
    descendant outside the manager's process group whose parent exits before
    the stop reaches that parent. After a normal finish, Mokly signals only
    the manager's process group.
  - The same page requires one monotonic deadline for version discovery and
    every install. `docs/protocol/mokly-base-dependencies.md:201` says that
    cancellation stops preparation.
  - The integration test `crates/mokly-compare/tests/script_session_tests.rs`
    starts its detached child with `stdio: 'ignore'`, so the child holds no
    pipe. No test covers a survivor that holds a pipe.
  - Commit `d935e6a6`, the Rust rebuild of 2026-10-25, already had the same
    loop and the same `finish`.
- **Problem:** After a stop, the base install waits without a bound for both
  output pipes to close. A survivor that inherited a pipe keeps it open, so
  the install never ends. The order inside `finish`, the joins before the
  group kill, does not cause the wait. On each path that can block, a kill
  or the cancellation signals run before `finish`. Two cases can leave such
  a survivor:
  - On macOS, an orphan under the documented limit.
  - A background process in a new session that a script left behind. The
    manager exits normally, but `poll` stays false, so `run` waits until the
    time limit. The one kill at line 146 then misses the process, and the
    join in `finish` waits without a bound.
- **Impact if no action:** The base install never ends, and so neither does
  the `build`, the `publish`, or the Serve comparison that waits for it. In
  `build` and `publish`, a second interrupt still forces the exit, under
  `docs/protocol/mokly-terminal-errors.md`. Without a user, as in CI, the
  command waits until something outside Mokly stops it.
- **Root question:** How does a stopped base install always end, also when
  a process that the stop cannot reach holds one of its output pipes?
- **Options:**
  - **A.** Bound the wait after a stop. After the last signal of the stop,
    wait a short grace period for the manager and both pipes. Then stop
    waiting. Leave the reader threads detached. Return the result that
    the stop already gives, such as `Cancelled` or `InstallTimeout`. Count
    the grace period with the `Clock` of `TimedCommands`, so that a test can
    use a fake clock. Give `Drop` the same bound. A detached reader thread
    and its pipe stay until the survivor exits. A adds no new error.
    Effort: Medium.
  - **B.** Do A. Also, when the manager exits by itself and a pipe stays
    open, stop waiting after the grace period. Use the manager's own
    exit status. Such a base then gets tier two, not the time-limit
    fallback after 120 seconds. The survivor keeps running, as the
    normal-finish limit allows. This changes the dependency tier of these
    bases. Effort: Medium.
  - **C.** Give the manager no pipe that a descendant can hold. Write its
    standard output and standard error to files in the private entry, and
    read them after the manager exits. No thread waits on a pipe. The output
    bound becomes a size check of the files in the poll loop, so output can
    pass the bound between two checks. A survivor can keep writing to the
    files after the stop. Effort: Large.
  - **D.** Do A, but fail with a new typed error after the grace period.
    Give the error a `base-dependencies` reason that names the held output.
    This adds a new failure at the boundary that no requirement covers.
    Effort: Medium.
- **Left out:**
  - Kill the group before the joins in `finish`. On each path that can
    block, a kill already runs before `finish`, so the order alone does not
    end the wait.
  - Make the stop reach every survivor, for example by tracking the
    descendants while the manager runs. It needs a new tracking design, and
    a process that escapes anyway still blocks the install.
  - Contain the tree in the operating system, such as a Linux cgroup. It
    fails the goal on macOS, which has no such feature.
  - Close Mokly's read end of a pipe from another thread to wake the
    reader. It is not safe on Unix, because a closed descriptor number can
    be reused while the reader still uses it.
  - Change nothing, and document the wait as a third limit. It breaks the
    deadline and the cancellation rules, which stay.
- **Wider fix:** None beyond A. `TimedCommands` and `OwnedChild` own every
  wait of a base install command, so A covers each one. C also removes the
  pipe reads, but it changes how the output bound works.
- **Previous examples:** None found in the base install code. The Git runner
  reads its pipes in its own code, in `crates/mokly-git/src/system.rs` and
  `crates/mokly-git/src/pipes.rs`. This item did not check that code.
- **Recommendation:** A. It makes every stopped install end with the result
  that the stop already gives, and it needs no new requirement. C best
  removes the pipe wait, but its output bound is weaker.
- **Action:** fix after merge, apply A, because the wait is a product bug
  that predates the change that found it. A returns only the results that
  the deadline and the cancellation rules already require, so no condition
  of the decision test holds.
