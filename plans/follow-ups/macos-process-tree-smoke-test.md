# Smoke-test escaped process trees on macOS

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-process-tree-stops`: the post-merge task of
  its plan and of the follow-up record of user item 150, which that branch
  resolves.
- **Location:** None. The task runs a base install on a hosted macOS
  runner.
- **Reason:** The plan kept this run for after the merge, and the Linux
  workspace that built the change has no macOS host.

- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies that Changes runs when the base lockfile differs from the
    working tree. Lifecycle scripts run in it only when
    `review.baseInstallScripts` or `--base-install-scripts` turns them on.
  - **Escaped session:** a process that a package manager or one of its
    scripts starts in a new session, so a signal to the manager's process
    group does not reach it. Yarn Classic 1.22.22 starts each dependency
    lifecycle script this way on Linux and macOS.
  - **Stop:** Mokly ends a package manager because of cancellation, the
    time limit, the byte bound, or the bound on its output.
- **Background:**
  - Since commits `41bde015` and `4b245b40`, a stop on Linux and macOS sends
    `SIGSTOP` to the manager's process group. It then follows parent links
    to each descendant, also in a new session, and signals each one.
  - `docs/protocol/mokly-base-install-processes.md#bounds-and-stops` states
    the requirement and two limits. On macOS, a stop does not signal a
    descendant outside the manager's process group whose parent exits
    before the stop reaches that parent. After a normal finish, Mokly
    signals only the manager's process group.
  - On macOS, `crates/mokly-platform/src/unix_process_table/macos.rs` reads
    the process table through libproc: `proc_listchildpids`, and
    `proc_pidinfo` with `PROC_PIDTBSDINFO`. macOS has no subreaper, so an
    orphan moves to launchd.
  - The CI job "Native" in `.github/workflows/ci.yml` runs
    `cargo test --workspace` on the hosted macOS runner
    `blacksmith-6vcpu-macos-26` for each pull request. It runs the
    real-process tests in `crates/mokly-platform/tests/process_tree_tests.rs`
    and `crates/mokly-compare/tests/script_session_tests.rs`. These tests
    use helper processes and a fake Node manager that starts a detached
    child. The test of an orphan that the subreaper adopts runs on Linux
    only.
  - No run has used a real Yarn Classic install with lifecycle scripts on
    macOS.
  - A probe on Linux on 2026-10-28, before the change, showed Yarn Classic
    scripts that survived group signals. A script survived a group
    `SIGKILL`, and a child of a script survived `SIGTERM` and then
    `SIGKILL`.
  - The time limit of a base install is 120 seconds, at
    `crates/mokly-cli/src/base_dependencies.rs:170`.
- **Task:**
  1. After the item 150 change is on `main`, start a hosted macOS runner,
     for example with a temporary workflow job on
     `blacksmith-6vcpu-macos-26`.
  2. Install Node 22 and Yarn Classic 1.22.22 on the runner's `PATH`.
     Mokly does not download a package manager.
  3. Make a scratch repository with a small HTML catalogue. Give its base
     commit a `yarn.lock` that differs from the working tree, so that
     Changes runs a base install.
  4. Give the base dependencies a local package whose `install` script
     starts a long child, such as `sleep 1000 > /dev/null 2>&1 & wait`.
     Send the child's output away, so that the run does not meet the pipe
     wait of `plans/follow-ups/install-pipe-wait-after-stop.md`.
  5. Run `mokly build` with `--base-install-scripts`, and interrupt it while
     the script runs. Then list the processes of the runner's user, and
     check that neither the script nor its child survives.
  6. Run it again, and let the 120-second time limit stop the install. Check
     the processes in the same way.
  7. Save the commands, the process lists, and the result under `.context/`
     of the run.
- **Impact if no action:** A macOS-only defect of the stop, for example in
  the libproc reader, stays unseen until a user meets surviving scripts on a
  Mac. Such scripts keep running after Mokly exits.
- **Needs:** The item 150 change on `main`, and a hosted macOS runner with
  Node 22 and Yarn Classic 1.22.22. No credentials.
- **Done when:**
  - Both stops on macOS leave no process of the script or its child
    running.
  - The evidence is saved, and this item is deleted.
  - A survivor, if one remains, has its own follow-up item with its process
    list.
