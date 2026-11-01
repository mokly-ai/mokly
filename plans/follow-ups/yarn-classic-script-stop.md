# Stop Yarn Classic dependency scripts

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 150, finding 42 of the review of user decision 135 B.
- **Location:** `crates/mokly-platform/src/unix.rs:54`,
  `crates/mokly-platform/src/unix.rs:82`,
  `crates/mokly-compare/src/process.rs:100` to line 117,
  `docs/protocol/mokly-base-install-processes.md:57`, and
  `docs/protocol/mokly-runtime.md:231`.
- **Reason:** On 2026-10-29 the coordinator split this Large change from the
  pull request of the base install fixes, so that those fixes did not wait
  for it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Process owner:** the platform code in `crates/mokly-platform` that
    starts each child in its own process group and stops the whole group.
    Base installs, Git commands, and sidecars use it.
  - **Scripts opt-in:** the `review.baseInstallScripts` setting and the
    `--base-install-scripts` flag, which turn on dependency lifecycle
    scripts in a base install.
  - **Session:** a Unix set of process groups. A process that calls
    `setsid` leaves its old group and session.
  - **Subreaper:** a Linux process with the `PR_SET_CHILD_SUBREAPER`
    setting. It becomes the new parent of its orphaned descendants.
- **Background:**
  - On Linux and macOS the process owner starts each child with `setsid`,
    so the child leads a new session and process group.
  - To stop it, the owner signals that group with `kill(-pid, signal)`.
    Cancellation sends `SIGTERM`, then `SIGKILL` one second later. The time
    limit and the byte and output bounds send `SIGKILL` at once. After a
    normal finish, the owner sends `SIGKILL` to the group.
  - On Windows the owner uses a kill-on-close job object, which already
    holds every descendant. Windows keeps it and needs no change.
  - The Git runner uses the same owner. It kills its group after every Git
    command, also after the command has finished.
  - `docs/protocol/mokly-base-install-processes.md#bounds-and-stops` states
    the requirement. A stop signals the manager's process group and every
    process that descends from the manager through parent links when the
    stop starts, also a process in a new session. On Linux, a stop while
    the manager runs also signals a descendant whose parent exited before
    the stop.
  - The same section states the two limits that remain. On macOS, a stop
    does not signal a descendant outside the manager's process group whose
    parent exited before the stop. After a normal finish, Mokly signals only
    the manager's process group.
  - `docs/protocol/mokly-runtime.md#shutdown` says that no orphan process
    survives a normal shutdown, a failed startup, or an interruption, except
    for those two limits.
  - Both pages start with a status line that names this item, because no
    code meets the requirement yet. The work removes both status lines and
    updates `crates/mokly-platform/README.md`.
  - On 2026-10-28 the user chose option C. The user rejected A, because the
    runtime shutdown contract already says that no orphan process survives.
    The user rejected B, because Yarn Classic projects would lose the
    scripts opt-in.
  - Design call of 2026-10-28: the two limits that C leaves stay documented
    limits. No answered decision asks for more, and each limit needs a new
    design that tracks processes.
  - Design note: on Linux, the manager can become a subreaper, so that an
    orphan inside the owned tree stays reachable through parent links while
    the manager runs. Record this mechanism in code comments, not in the
    protocol page. A subreaper can keep zombie processes until it exits.
  - A stop of a reaped or childless tree must cost only a few system calls,
    with no table scan and no walk, because the Git runner stops its group
    after every command.
  - The work of C follows these rules:
    - Record the identity of the root, its PID and start time, when the
      owner attaches to the child, before the child is reaped.
    - Confirm each process identity, its PID and start time, right before a
      walk from it or a signal to it, because a PID can be reused.
    - Before a signal, stop the group with `SIGSTOP`. Find the descendants
      through parent links, and stop each new one at once. Walk again until
      no new one appears, with a bound on the number of walks.
    - On Linux, walk `/proc/{pid}/task/{tid}/children`. When those files
      are absent, scan `/proc/*/stat` instead. On macOS, use libproc:
      `proc_listchildpids` or `proc_listallpids`, with `proc_pidinfo` and
      `PROC_PIDTBSDINFO`.
    - On Linux, prefer a pidfd for each signal. Fall back to `kill` when the
      kernel returns `ENOSYS`.
    - Keep the identities that a first signal finds, and walk from them for
      the next signal. Then the `SIGKILL` that follows a `SIGTERM` still
      reaches a descendant whose parent died after the `SIGTERM`.
    - After `SIGTERM`, send `SIGCONT` to the group and to each found
      descendant, so that the stopped processes run their handlers.
    - A process that is gone counts as stopped. On macOS, keep the rule of
      `crates/mokly-platform/src/unix_group_members.rs`: when a group signal
      fails with `EPERM`, the group counts as stopped only when a complete
      list of its members shows no live process.
    - When the process state cannot be read, signal the group, and then
      return an error.
    - The public `ProcessGroup` and `ProcessGroups` traits in
      `crates/mokly-platform/src/processes.rs` keep their methods. So
      `mokly-git`, `mokly-sidecar`, and `mokly-compare` need no change.
    - Tests start a new session through a helper mode of the test binary
      that calls `setsid()`, because macOS has no `setsid` command.
      `signal_leaf_helper` in `crates/mokly-platform/tests/process_tests.rs`
      shows the pattern.
    - Tests treat a zombie as gone: the state `Z` in `/proc/{pid}/stat` on
      Linux, and `SZOMB` on macOS.
  - As context only: a first attempt exists on the branch
    `conductor/rust-rebuild-150-process-tree-stops`.
- **Problem:** Yarn Classic 1.22.22 starts each dependency lifecycle script
  with Node's `detached: true` on Linux and macOS, at
  `node_modules/yarn/lib/cli.js:34328`. So the script leads a new session,
  and the group signal does not reach it. Classic passes on only `SIGTERM`,
  and only to the shell that it started directly. An earlier review of the
  scripts opt-in reproduced the escape on Linux and macOS. A probe with Yarn
  1.22.22 on Linux on 2026-10-28 gave these results:
  - A group `SIGKILL`, as the time limit sends, left the script running.
  - A group `SIGTERM` and then `SIGKILL`, as cancellation sends, stopped a
    simple script. A child of a script kept running.
  - After a normal finish, a background child of a script survived the
    group `SIGKILL`.
- **Impact if no action:** A cancelled or stopped base install can leave
  consumer scripts running after Mokly exits. They can keep using resources
  and changing files. A dependency install builds in place in its private
  cache entry, so a surviving script can write into the next install attempt
  for the same key and leave a bad entry.
- **Root question:** How should Mokly stop every process that a base
  install starts, also outside its process group?
- **Options:**
  - **A.** Document the process leak. The processes and the cache risk stay.
    Effort: Small.
  - **B.** Keep lifecycle scripts off for Yarn Classic on Unix, and warn
    when the user asks for them. Classic projects lose the scripts opt-in.
    Effort: Small.
  - **C.** Make the process owner stop every descendant, also in new
    sessions. Before it sends a signal, it stops the group. Then it finds
    every descendant through parent links and signals each one. Effort:
    Large.
- **Left out:** Another group signal cannot reach a new session.
- **Wider fix:** C. Ownership of every descendant removes the class for
  every child process.
- **Previous examples:** None found.
- **Recommendation:** C. It keeps the scripts opt-in for Yarn Classic and
  meets the no-orphan rule of the runtime contract.
- **Action:** fix after merge, apply C, because the user chose C on
  2026-10-28, and the Large change gets its own pull request.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6109).
