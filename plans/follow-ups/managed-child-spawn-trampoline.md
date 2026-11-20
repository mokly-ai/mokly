# Full child setup still forks the core

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-16, from branch `calummoore/plain-git-spawns`.
- **Location:** `crates/mokly-platform/src/unix.rs:64`, `crates/mokly-platform/src/processes.rs:35`, and `crates/mokly-git/src/system.rs:69`.
- **Reason:** A shared launcher changes every managed child and needs its own packaging and lifecycle checks.

- **Terms:**

  - **Core:** The Rust process that runs Mokly commands and supervises children.
  - **Trampoline:** A small executable that sets up process ownership, then replaces itself with the requested child.
  - **Subreaper:** A Linux process that adopts orphan descendants while it runs.
  - **Plain group:** A Unix process group that starts without a child setup hook.

- **Background:**

  Mokly owns child trees through `ProcessGroups` in
  `crates/mokly-platform/src/processes.rs`. Full Unix setup in
  `crates/mokly-platform/src/unix.rs` uses a `pre_exec` hook. The hook starts a
  new session and sets `PR_SET_CHILD_SUBREAPER` on Linux. The hook forces Rust's
  standard library to fork the core before it starts the child.

  A probe touched 800 MB, then ran 40 `git rev-parse` commands. Full setup cost
  29.7 ms wall time per command. `posix_spawn` with a separate process group
  cost 1.2 ms. A Serve edit profile put about 8% of core samples in fork
  page-table copying and exec teardown. These observations establish the cost.
  The later change needs fresh measurements for the full launcher.

  Helper-free Git commands can select `ProcessMode::PlainGroup` in
  `crates/mokly-git/src/command.rs`. Commands that can start helpers keep full
  setup. Sidecars, package managers, and PostCSS children also keep full setup.
  Windows uses its kill-on-close job for both Git modes.

- **Problem:**

  Full Unix child setup still forks the core. Its cost grows with the core's
  memory, even when the child itself needs little work.

- **Impact if no action:**

  Commands that need full ownership retain the process start cost. Repeated
  starts consume CPU and delay work in a large Serve process.

- **Root question:**

  How can every managed child start without forking the core while full tree
  ownership stays intact?

- **Options:**

  - **A.** Start a small trampoline through `posix_spawn`. It creates the
    session and Linux subreaper before it executes the requested program.
    Package it with every supported native distribution. Effort: Large.

- **Left out:**

  - Keep the full `pre_exec` path. It retains the fork cost and fails the goal.
  - Use a plain group for every child. A helper can start another session and
    escape ownership. This breaks the child lifecycle requirement.
  - Keep a persistent process broker. It adds a separate IPC lifecycle and
    failure boundary that the trampoline avoids. The trampoline is simpler for
    this goal.

- **Wider fix:**

  A. Route every managed Unix child through one launcher. Keep the same child
  PID across the trampoline's exec, so the existing identity guard can attach
  before reaping. Keep argument vectors, directories, environments, pipes, and
  spawn errors explicit. Do not use a shell. Preserve full session and
  subreaper setup before the target program starts. Keep Windows job setup.

  The Git runner, render sidecar, dependency installer, and PostCSS worker must
  all use the launcher. Test cancellation, exited children before attachment,
  helpers in other sessions, orphan adoption, output bounds, and spawn errors.
  Verify launcher discovery in packaged distributions and every development
  entry point. Measure start cost from a large core on Linux and macOS.

  The decision dated 2026-11-16 selects this trampoline as separate work. The
  plain Git group change does not implement it. The
  [Git runtime contract](../../docs/protocol/mokly-git.md#cancellation-and-fetch)
  and [runtime shutdown contract](../../docs/protocol/mokly-runtime.md#shutdown)
  remain the lifecycle requirements.

- **Previous examples:**

  `crates/mokly-platform/src/unix.rs` holds the full setup used by managed
  children. `crates/mokly-git/src/system.rs` selects the Git mode and keeps one
  shared ownership and cancellation path.

- **Related:**

  - [plain-git-fsmonitor-override.md](./plain-git-fsmonitor-override.md): a
    plain-group `check-attr` or `rev-parse` can start the user's filesystem
    monitor hook, because the index read starts it.
  - A second case has a direct fix and no item. In a partial clone, a
    plain-group `ls-tree -l` could lazy-fetch on a Git build that ignores
    `GIT_NO_LAZY_FETCH=1`. `tree_request` in
    `crates/mokly-git/src/repository_command.rs` keeps full setup for
    `ls-tree` when the repository has a promisor remote, so these tree reads
    pay the fork cost.
  - Both cases have the same cause: a list of helper-free commands depends on
    the user's configuration and the Git build. The launcher of option A
    removes the need for that list and for its promisor condition, so it is
    also the wider fix of both cases.

- **Recommendation:**

  A. It removes the fork of the large core while preserving full child setup.

- **Action:**

  Fix after merge, apply A. The shared launcher and its packaging extend beyond
  the helper-free Git change.
