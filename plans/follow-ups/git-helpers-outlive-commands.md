# Git helpers can outlive their command

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-process-tree-stops`. The work on
  `plans/follow-ups/macos-stop-mid-walk-orphans.md` found it outside the diff
  of that branch.
- **Location:** `docs/protocol/mokly-git.md:32` to line 33,
  `docs/protocol/mokly-runtime.md:231` to line 232,
  `crates/mokly-git/src/system.rs:68` to line 72 and line 165, and
  `crates/mokly-platform/src/unix_process_tree/group.rs:57` to line 64.
- **Reason:** The promise is older than the branch that found it, and the
  choice between its options needs the user.

- **Source:** Implementation.
- **Category:** Docs or spec.
- **Terms:**
  - **Owner of process trees:** the code in `crates/mokly-platform` that
    starts a child in a new session and stops the child's process tree.
  - **Stop:** the signals that the owner sends when Mokly cancels a command,
    or when a time limit or an output bound ends it.
  - **Normal finish:** the command exits by itself, and the Git runner reaps
    it.
  - **Walk:** the search in
    `crates/mokly-platform/src/unix_process_tree/walk.rs` that finds and stops
    each descendant through parent links.
- **Background:**
  - `docs/protocol/mokly-git.md`, section "Cancellation And Fetch", says: "A
    Git helper process never outlives its command."
  - The Git runner starts each Git command through the owner.
    `crates/mokly-git/src/system.rs:68` configures the child, and line 72
    attaches the owner.
  - `system.rs:165` calls `group.kill()` after every command, also after a
    normal finish.
  - `crates/mokly-platform/src/unix_process_tree/group.rs:57` to line 64 runs
    the walk only before the root is reaped, or when an earlier stop kept
    identities. After a normal finish, the runner has reaped Git, so the kill
    signals only the process group.
  - The child starts a new session, so its process group holds Git and each
    helper that stays in the group. A helper that calls `setsid` leaves the
    group, so the kill after a normal finish does not reach it.
  - A check on 2026-11-01 with Git 2.50.1 on Linux found that
    `git credential-cache--daemon` stays in the process group of the helper
    that starts it. So the kill after the command reaches that daemon.
  - The promisor fetch passes `--no-auto-maintenance`, at
    `crates/mokly-git/src/fetch.rs:81`, so it starts no detached maintenance
    run.
  - Nobody checked which helper of a Mokly Git command starts its own session.
    An SSH master that a `ControlPersist` setting keeps in the background is
    one candidate.
  - The section "Bounds And Stops" of
    `docs/protocol/mokly-base-install-processes.md` states two limits of the
    same owner. Both also apply to Git commands:
    - "After a normal finish, Mokly signals only the manager's process
      group". For Git, this holds on Linux and macOS.
    - "On macOS, a stop does not signal a descendant outside the manager's
      process group whose parent exited before the stop."
  - `docs/protocol/mokly-runtime.md:231` to line 232 says that no orphan
    process survives a normal shutdown, a failed startup, or an interruption.
    Its exception names only "the base install limits", not a Git tree.
  - On Windows, `crates/mokly-platform/src/windows.rs:74` sets only
    `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. No helper can leave that job, so the
    promise holds on Windows.
  - Before this branch, the owner signalled only the process group, on a stop
    and after a normal finish. At `7d0682af`,
    `crates/mokly-platform/src/unix.rs:85` sent only `kill(-pid, signal)`.
  - So the promise was false before this branch too, and on more paths: a
    stop then also missed each helper in its own session. This branch made a
    stop reach such a helper through the walk.
- **Problem:** The Git page says that a Git helper process never outlives its
  command. After a normal finish, a helper that leaves the process group
  outlives it on Linux and macOS. On macOS, a stop can also miss a helper
  under the recorded limit.
- **Impact if no action:** A reader trusts a promise that the code does not
  keep. A helper that starts its own session keeps running after its command,
  and it can survive the exit of Mokly.
- **Root question:** What should the Git page promise about a helper process
  that leaves the process group of its command?
- **Options:**
  - **A.** Narrow the promise of the Git page with an exception for the
    limits in "Bounds And Stops".
    - Link that section of `docs/protocol/mokly-base-install-processes.md`,
      as the runtime page does.
    - Extend the runtime words "except for the base install limits" to Git
      trees.
    - It narrows a requirement of the Git page.
    - Effort: Small.
  - **B.** Keep the promise, and track the descendants of each Git command
    while it runs. Signal each one after a normal finish too.
    - It needs a new tracking design. A design call of 2026-10-28 kept the
      two recorded limits, because both need such a design.
    - It adds reads of the process table to every Git command.
    - It ends a helper that a user's configuration keeps on purpose.
    - Effort: Large.
  - **C.** State the stop requirement and its limits once, for every tree
    that the owner holds.
    - These trees are base installs, Git commands, and the render sidecar.
    - Give that statement its own protocol page. The base install, Git, and
      runtime pages then link it.
    - The runtime page has 250 lines, the cap of the length lint, so the
      statement cannot move there.
    - It moves a requirement, and it widens the limits to every owned tree.
    - Effort: Medium.
- **Shared assumptions:**
  - The base install, the Git runner, and the render sidecar share one
    owner. Source: the code. Its reason holds, because one owner gives one
    behaviour to test. Every option keeps it.
  - After a normal finish, the owner signals only the process group. Source:
    "Bounds And Stops" and `group.rs:57`. It is a stated limit, but no user
    decision chose it. B drops it.
  - A helper can start its own session. Source: Git, SSH, and the user's
    configuration choose the helpers, not Mokly. Every option keeps it.
- **Left out:**
  - Change nothing. The Git page keeps promising more than the code does, so
    it fails the goal.
  - Turn off each Git helper that can start its own session. The user's Git
    and SSH configuration chooses the helpers, so Mokly cannot know each one.
    It fails the goal.
  - Contain each Git command in the operating system, such as a Linux
    cgroup. macOS has no such container, so it fails the goal.
- **Wider fix:** C. One statement covers every owned tree, so no page can
  promise more than the owner does.
- **Previous examples:** Commit `9c4dce18` of 2026-10-29, which reached `main`
  in `7d0682af`, narrowed the macOS limit of the base install page. Its first
  text claimed more than the owner does.
- **Related:** `plans/follow-ups/macos-stop-mid-walk-orphans.md` holds
  another macOS gap of the same owner, and it also reaches Git helpers. Both
  items change the runtime words "except for the base install limits", so
  one branch can apply both answers.
- **Recommendation:** A. It makes the Git page true at Small effort, in the
  form that the runtime page already uses. C best protects the codebase,
  because one statement then covers every owned tree.
- **Action:** ask the user, because A narrows a requirement of the Git page,
  and no user decision covers that change.
