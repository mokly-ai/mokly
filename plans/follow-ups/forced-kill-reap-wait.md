# Forced kill reap waits without a deadline

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the failed-reap options check of the first-edit
  warm sidecars plan, branch `calummoore/mokly-first-edit-warm-sidecars-8npz`.
- **Location:** `crates/mokly-sidecar/src/process_clock.rs:63-65`,
  `crates/mokly-sidecar/src/process_control.rs:58-62`,
  `crates/mokly-sidecar/src/pool_recycle.rs:46-50`,
  `crates/mokly-sidecar/src/pool_shutdown.rs:45` and line 83, and
  `crates/mokly-sidecar/src/pool_return.rs:119`.
- **Reason:** Shutdown, cancellation, and recycle on `main` share this wait,
  so a fix changes stop behaviour outside the warm sidecars change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Reap:** wait for the exit of a child process and collect its exit
    status.
  - **Forced kill:** the kill of the whole process tree of a sidecar through
    `ProcessControl::kill`. On Unix it sends SIGKILL to the process group.
  - **Uninterruptible sleep:** a process state in which a process acts on no
    signal, SIGKILL included, until a kernel operation ends. A wait on a hung
    network file system is one example.
- **Background:**
  - `ProcessControl::finish`, at
    `crates/mokly-sidecar/src/process_control.rs:58-70`, waits for the exit of
    a sidecar until a deadline. When the process has not exited by then, it
    sends the forced kill and calls `Wait::reaped`, at lines 61-62.
  - `SystemClock::reaped`, at `crates/mokly-sidecar/src/process_clock.rs:63-65`,
    waits on the reaper channel with no deadline. Its doc comment says: "Wait
    for the reaper after forced termination, without another graceful
    period."
  - These callers run `finish`:
    - Cancellation in `Pool::cancel_busy`, at
      `crates/mokly-sidecar/src/pool_shutdown.rs:45`.
    - Graceful shutdown in `Pool::stop`, at line 83 of the same file. Forced
      termination in that function only sends the kill.
    - Recycle, at `crates/mokly-sidecar/src/pool_recycle.rs:46-50`.
    - The return pass in `Pool::retire_return`, at
      `crates/mokly-sidecar/src/pool_return.rs:119`.
  - A process in uninterruptible sleep does not exit after the forced kill
    until its kernel operation ends. `finish` then does not return:
    - Shutdown or cancellation of the command waits without end.
    - A recycle blocks the request that triggered it.
    - A return step keeps its slot and the Serve worker that drives the pass.
  - `docs/protocol/mokly-sidecar.md` says that shutdown drains in-flight work
    and that the binary kills survivors after two seconds. It also says that a
    sidecar never outlives its binary.
    `docs/protocol/mokly-sidecar-lifecycle.md` says that a process tree that
    still runs at the deadline is killed. No page says what happens when the
    kill does not end the process.
  - The failed-reap options check of 2026-11-18 found this wait. It left the
    wait out of the warm sidecars change, because recycle and shutdown on
    `main` share it. Nobody reproduced a process that ignores SIGKILL.
- **Problem:** After a forced kill, the pool waits without a deadline for the
  process to exit.
- **Impact if no action:** A process that ignores SIGKILL can keep Serve from
  exiting, block a render, or hold a slot without end.
- **Root question:** What does Mokly do when a forced kill does not end a
  sidecar process?
- **Options:**
  - **A.** Change nothing. The wait keeps the process bound and the rule that
    a sidecar never outlives its binary, at the cost of a possible hang.
    Effort: Small.
  - **B.** Bound the reap wait after the forced kill. After the deadline,
    report the process on stderr and continue. The pool keeps that slot out
    of use, as the return pass does after a failed reap. Shutdown then exits,
    and the killed process ends when the kernel lets it. Effort: Medium.
  - **C.** Bound the wait only for shutdown and cancellation, so that the
    command can always exit. Keep the unbounded wait in recycle and the return
    pass. Cost: two rules for one wait, and a recycle can still block a
    request. Effort: Medium.
- **Left out:** Another kill signal, because the process already has SIGKILL
  pending. A longer graceful period, because the wait follows a forced kill,
  and more time does not end a process that ignores SIGKILL.
- **Wider fix:** B. One bounded rule covers every caller of the forced reap.
- **Previous examples:**
  [install-pipe-wait-after-stop.md](./install-pipe-wait-after-stop.md): a
  stopped base install also waits without a bound, for output pipes that its
  descendants hold.
- **Related:** [root-switch-reap-wait.md](./root-switch-reap-wait.md): its
  shared end-and-reap step would inherit this wait.
- **Recommendation:** B. One bounded wait keeps every caller live and reports
  the stuck process, and the pending kill still ends it when the kernel lets
  it.
- **Action:** ask the user, because B relaxes the rule that a sidecar never
  outlives its binary, and no recorded decision covers that change.
