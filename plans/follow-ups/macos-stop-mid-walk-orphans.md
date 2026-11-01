# A macOS stop misses mid-walk orphans

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-process-tree-stops`. The Milestone 1 check of
  its plan found the gap. A design call of the same day reworded the limit,
  and the coordinator's review withdrew that call.
- **Location:** `docs/protocol/mokly-base-install-processes.md:67` to line 70,
  `docs/protocol/mokly-runtime.md:231` to line 232,
  `crates/mokly-platform/src/unix_process_tree/group.rs:50` to line 68,
  `crates/mokly-platform/src/unix_process_tree/walk.rs:39` to line 70,
  `crates/mokly-platform/src/unix_process_table/macos.rs:20` to line 46, and
  `crates/mokly-platform/src/unix.rs:67` to line 72.
- **Reason:** Each option changes a stated limit of the stop requirement, and
  no user decision covers that change.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Stop:** the signals that Mokly sends to an owned process tree, for
    example when a base install is cancelled or reaches its time limit.
  - **Manager:** the package manager process that Mokly starts for a base
    install, which is the root of the owned process tree.
  - **Walk:** the search in
    `crates/mokly-platform/src/unix_process_tree/walk.rs` that finds and stops
    each descendant of the manager through parent links.
  - **Subreaper:** a Linux process that adopts each orphan among its
    descendants, as the manager does on Linux.
  - **Mid-walk orphan:** a descendant outside the manager's process group
    whose parent exits after the stop starts and before the walk stops that
    parent.
- **Background:**
  - The section "Bounds And Stops" of
    `docs/protocol/mokly-base-install-processes.md` states the requirement. A
    stop "signals the manager's process group and every process that
    descends from the manager through parent links when the stop starts."
  - The same section states two limits. The macOS limit reads: "On macOS, a
    stop does not signal a descendant outside the manager's process group
    whose parent exited before the stop."
  - `docs/protocol/mokly-runtime.md`, section "Shutdown", says that no orphan
    process survives a normal shutdown, a failed startup, or an interruption,
    except for the base install limits.
  - On 2026-10-28, the user chose the current stop design. The owner of
    process trees finds the descendants through parent links, also in new
    sessions, and signals every one.
  - That user decision rejected a documented limit in place of the fix,
    because the runtime contract says that no orphan process survives. It
    also rejected scripts off for Yarn Classic on Unix, because Classic
    projects would lose the opt-in.
  - A design call of 2026-10-28 kept two documented limits, because both
    need a new tracking design. On macOS, it named an orphan outside the
    manager's process group. A design call is an agent's call, not a user
    decision.
  - `crates/mokly-platform/src/unix_process_tree/group.rs:50` first sends
    `SIGSTOP` to the manager's process group. A process outside that group
    keeps running until the walk stops it.
  - Yarn Classic 1.22.22 starts each dependency lifecycle script in a new
    session, so the script is outside the group. Lifecycle scripts run in a
    base install only when `review.baseInstallScripts` or
    `--base-install-scripts` turns them on.
  - `group.rs:57` to line 64 then runs the walk. Line 68 keeps the
    identities that the walk found, so that the next stop of the same tree
    signals them again.
  - `walk.rs:39` to line 70 reads the children of the manager and of each
    process that the walk has found. It stops each new child at once. The
    passes repeat while a pass finds a new process, up to 64 passes.
  - `crates/mokly-platform/src/unix_process_table/macos.rs:20` to line 46
    lists the direct children of one PID with `proc_listchildpids`. It
    confirms each child with `proc_pidinfo`. On macOS, no subreaper exists, so
    an orphan moves to launchd, PID 1.
  - On Linux, `crates/mokly-platform/src/unix.rs:67` to line 72 makes the
    manager a subreaper. An orphan then moves to the manager, and a later pass
    of the walk finds it.
  - The Git runner, at `crates/mokly-git/src/system.rs:72`, and the render
    sidecar, at `crates/mokly-sidecar/src/process_factory.rs:111`, attach the
    same owner of process trees. So the same macOS gap reaches their trees.
  - `docs/protocol/mokly-runtime.md:231` to line 232 makes an exception only
    for "the base install limits". That exception does not cover a Git or
    sidecar tree.
  - `docs/protocol/mokly-git.md` says that a Git helper process never
    outlives its command.
  - Two records quote the macOS limit:
    `plans/follow-ups/install-pipe-wait-after-stop.md` and
    `plans/follow-ups/macos-process-tree-smoke-test.md`. A change of the
    limit changes them too.
  - Both protocol pages start with a status line that links this item. A
    branch that applies an answer removes both lines only when both pages
    then match the code.
  - No run has reproduced this timing on macOS. A read of the code shows the
    gap.
- **Problem:** On macOS, the stop never signals a mid-walk orphan. The orphan
  moves to launchd, so the walk cannot reach it. The requirement covers such
  an orphan, but the recorded limit does not name it.
- **Impact if no action:** On macOS, a rare stop can leave a script's child
  running after Mokly exits. The two protocol pages then promise more than
  the code does.
- **Root question:** What must a stop on macOS reach when a parent outside
  the manager's process group exits while the stop runs?
- **Options:**
  - **A.** Reword the macOS limit to "whose parent exits before the stop
    reaches that parent".
    - Extend the runtime words "except for the base install limits" to the
      same macOS limit for Git and sidecar trees.
    - Remove both status lines with these two changes.
    - A widens a stated limit of the requirement.
    - Effort: Small.
  - **C.** Track the descendants while the manager runs, so that an orphan
    stays known after its parent exits.
    - It needs the new tracking design that the design call of 2026-10-28
      left out.
    - It also covers the recorded macOS limit for each process that a read
      has seen.
    - Without a macOS source of fork events that names each child, tracking
      reads the table from time to time. A process that starts and loses its
      parent between two reads still escapes.
    - The macOS limit then names a descendant outside the manager's process
      group that starts and loses its parent between two reads of the table.
    - Extend the runtime words "except for the base install limits" to the
      same macOS limit for Git and sidecar trees.
    - Both status lines go only with these two changes.
    - Effort: Large.
  - **D.** On macOS, read one snapshot of the whole process table when the
    stop starts. Find every descendant by its identity, PID and start time,
    from that snapshot.
    - Then a child stays known after its parent exits, and the stop signals
      it by identity.
    - It reads every host process on each stop of a live tree.
    - A read through libproc takes one call per process: `proc_listallpids`
      lists the PIDs, and `proc_pidinfo` reads each one. A parent that exits
      during that read can still hide its child. So D moves the window, but
      it does not close it.
    - The macOS limit then names a descendant outside the manager's process
      group whose parent exits before the stop reads that descendant.
    - Extend the runtime words "except for the base install limits" to the
      same macOS limit for Git and sidecar trees.
    - Both status lines go only with these two changes.
    - Effort: Medium.
  - **E.** On macOS, when the walk finds a process that leads its own process
    group, also list that group with `proc_listpgrppids`. Stop and signal
    each new member by identity.
    - This reaches a mid-walk orphan whose exited parent led the orphan's
      process group. A Yarn Classic script leads such a group, and its
      children stay in it unless they start their own session.
    - For this gap, the walk must still find the exited parent.
    - Since `32069985`, the macOS reader passes 1 to `proc_pidinfo`, so it
      also reads a zombie: an exited process that its parent has not reaped.
    - In the XNU source, `proc_listchildpids` lists a zombie child too,
      because `proc_listpids` with `PROC_PPID_ONLY` visits the list of zombies.
    - So the walk now finds an exited parent while its own parent is stopped
      and has not reaped it. No macOS run has confirmed this timing.
    - `crates/mokly-platform/src/unix_group_members/system.rs` still passes 0
      to `proc_pidinfo`. There a zombie member gives ESRCH, which counts as
      not live before the zombie check at line 54.
    - E adds one group read for each group leader that the walk finds.
    - The macOS limit then names an orphan outside the manager's process
      group when the walk finds no leader of the orphan's process group.
    - Extend the runtime words "except for the base install limits" to the
      same macOS limit for Git and sidecar trees.
    - Both status lines go only with these two changes.
    - Effort: Medium.
- **Shared assumptions:**
  - The stop finds the descendants in user space, through the process table.
    Source: the user decision of 2026-10-28. Every option keeps it.
  - Lifecycle scripts can start their own sessions. Source: the user decision
    of 2026-10-28, which rejected scripts off for Yarn Classic on Unix. Every
    option keeps it.
  - Mokly needs no root and no special entitlement on macOS, so it reads the
    process table through libproc. Source: the code in `macos.rs`. No page
    states it, but its reason holds: Mokly runs as the user, on a developer
    Mac or in CI. The fork watch under **Left out** drops it.
  - The requirement keeps its scope: each process that descends from the
    manager when the stop starts. Source: the protocol page. A keeps that
    scope, and it changes only the stated limit and its runtime exception.
- **Left out:**
  - Keep the recorded limit and the code, and delete this item and both
    status lines. It fails the goal, because both pages keep promising more
    than the code does. It also breaks the status-line rule of `AGENTS.md`,
    because a page whose behaviour is not implemented yet starts with a
    status line.
  - Run a second walk after the first. On macOS, no parent link leads from a
    found process to the orphan, so it fails the goal.
  - Contain the tree in the operating system, such as a Linux cgroup. macOS
    has no such container, so it fails the goal.
  - Watch forks with Endpoint Security or DTrace. Both need root or an Apple
    entitlement, so they fail the goal for a normal user.
  - Turn scripts off on macOS. It breaks the user decision of 2026-10-28,
    which kept the scripts opt-in for Yarn Classic projects on Unix.
- **Wider fix:** C. It keeps each descendant that a read has seen, so it also
  narrows the recorded macOS limit. A process that no read saw still
  escapes.
- **Previous examples:** Commit `9c4dce18` of 2026-10-29, which reached `main`
  in `7d0682af`, narrowed the same sentence, because its first text claimed
  more than the code does. On 2026-11-01, a design call reworded the limit to
  the words of A without a user decision. The coordinator's review withdrew
  that call on the same day.
- **Related:**
  - `plans/follow-ups/macos-process-tree-smoke-test.md` holds the post-merge
    macOS run of the same stop code. Its script waits for its child, so that
    run cannot show this gap.
  - `plans/follow-ups/install-pipe-wait-after-stop.md` covers a survivor that
    holds an output pipe of the base install. A mid-walk orphan can be such a
    survivor. That item recommends a bounded wait after a stop, which also
    ends the wait for it.
  - `plans/follow-ups/git-helpers-outlive-commands.md` holds the promise of
    the Git page that no Git helper outlives its command. The gap of this
    item also reaches Git helpers. Both items change the runtime words
    "except for the base install limits", so one branch can apply both
    answers.
- **Recommendation:** A. It makes both pages true at Small effort, and each
  code option still leaves a case that the pages must name. C best protects
  the codebase, because it also narrows the recorded macOS limit.
- **Action:** ask the user, because A widens a stated limit that no user
  decision covers, and the code options have real costs.
