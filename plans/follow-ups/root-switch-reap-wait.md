# Replacements start before the old process is reaped

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the options check of the first-edit warm
  sidecars plan, branch `calummoore/mokly-first-edit-warm-sidecars-8npz`. The
  recycle part comes from the failed-reap options check of the same plan, on
  the same day.
- **Location:** `crates/mokly-sidecar/src/pool_sources.rs:36` and line 42,
  `crates/mokly-sidecar/src/pool_exchange.rs:55`,
  `crates/mokly-sidecar/src/pool_recycle.rs:46-59`,
  `crates/mokly-sidecar/src/process_control.rs:51` and line 58, and
  `crates/mokly-sidecar/src/pool_return.rs:109`.
- **Reason:** The warm sidecars change kept the root switch of a request,
  recycle, and their existing tests unchanged, so their reap rule needs its
  own branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Slot:** one place for one sidecar process in the pool. `--sidecars` or
    `MOKLY_SIDECARS` sets the number of slots. The default is the core count.
  - **Root switch:** a request for another source root ends the idle process
    of a slot and starts a new process there.
  - **Recycle:** the replacement of a worker after 500 renders or over 1 GiB
    of resident memory, under `docs/protocol/mokly-sidecar-memory.md`.
  - **Reap:** wait for the exit of a child process and collect its exit
    status.
  - **Return pass:** the background work that Serve starts after each Changes
    publication. It replaces idle base processes with head processes, one at
    a time.
- **Background:**
  - Each sidecar process serves one source root: the working repository for
    the head, or the extracted base commit for the base. The section Source
    Root Workers of `docs/protocol/mokly-sidecar-modules.md` says that all
    roots share the configured pool bound.
  - At a root switch, `Pool::isolate` sends the kill through
    `Reason::RootSwitch.kill`, at `pool_sources.rs:36`. It empties the slot at
    line 42. The request then starts the new process, at
    `pool_exchange.rs:55`.
  - `ProcessControl::kill`, at `process_control.rs:51`, only sends SIGKILL to
    the process group on Unix. It does not wait for the exit. `finish`, at
    line 58, waits for the exit, reaps the child, and waits for the stderr
    drain until its deadline. It fails when a kill inside it fails.
  - Recycle calls `shutdown` and then `finish` with a two-second deadline, at
    `pool_recycle.rs:46-50`. When `finish` fails, it logs
    `sidecar recycle shutdown failed` through `tracing::warn!`, sends the kill
    again, and empties the slot, at lines 51-59. The next request can then
    start a process in that slot beside an old process whose exit nobody
    confirmed.
  - The CLI installs only the `--debug-timings` tracing layer, and that layer
    prints no warning events. So the user sees no message for a failed
    recycle.
  - On 2026-11-18 the warm sidecars change added the return pass. The pass
    ends the old process and waits for its exit and reaping before it starts
    the new process. `Pool::retire_return`, at `pool_return.rs:109`, sends
    the kill and then calls `finish`. When `finish` fails, it retires only
    that slot. The slot keeps its control registered and stays out of use,
    and the other slots continue. The first such failure also ends background
    return for the life of the pool. When no usable slot remains, the pool
    stops. Serve reports the original failure on stderr through the sidecar
    `Diagnostics` reporter, followed by a warning that background sidecar
    preparation is disabled until Serve restarts.
  - `docs/protocol/mokly-sidecar-root-scheduling.md` records these rules. It
    rejects a start after the kill signal alone, because the old and the new
    process could then run together beyond the pool size.
  - That change kept the root switch and recycle unchanged, because its task
    kept every existing pool test unchanged. These tests mock a kill without
    `finish` at a root switch:
    - `changing_source_roots_kills_the_old_process_before_spawning_in_the_new_root`
      in `crates/mokly-sidecar/src/_tests_/pool_sources_tests.rs`.
    - The root selection tests in
      `crates/mokly-sidecar/src/_tests_/pool_root_selection_tests.rs`.
    - `live_root_switch_stops_under_the_selecting_caller` in
      `crates/mokly-cli/src/_tests_/sidecar_stop/retirement_tests.rs`.
- **Problem:** Two replacement paths can start a new process before the old
  process is confirmed ended. A root switch never waits for the exit. Recycle
  empties the slot after a failed `finish`, and its warning stays hidden.
- **Impact if no action:** During each root switch, the pool can run one
  process more than its size for a short time. When base work switches several
  slots at once, the excess can reach one process for each slot. This part is
  common. After a failed recycle `finish`, which is rare, an unconfirmed
  process can run beside its replacement for longer, and the user gets no
  message.
- **Root question:** How does every replacement in a slot keep the old and the
  new process inside the pool bound, and tell the user when it cannot?
- **Options:**
  - **A.** Change nothing. SIGKILL usually ends the process quickly, so the
    overlap is short. A failed recycle `finish` stays hidden. Effort: Small.
  - **B.** Fix each path. The root switch calls `finish` with the two-second
    deadline after its kill. Recycle keeps its slot out of use when `finish`
    fails, and it reports the failure on stderr. Add the `finish` expectations
    to the tests above. The `root-switch` stop span then includes the
    reaping. Effort: Medium.
  - **C.** Send the root switch and recycle through `Pool::retire_return`, the
    end-and-reap step of the return pass, so that one transition owns every
    replacement in a slot. Both paths then retire their slot and report on
    stderr when they cannot confirm the reap. Update the same tests. Effort:
    Medium.
- **Left out:** A pool that counts exiting processes against its size,
  because it gives the same bound as B with more state. A reuse of the slot
  after a failed `finish`, as recycle does now, because the old process can
  still run.
- **Wider fix:** C. One transition for every replacement leaves no kill-only
  path and no hidden failure.
- **Previous examples:** `Pool::retire_return` in
  `crates/mokly-sidecar/src/pool_return.rs` keeps the reap rule for the return
  pass, and Serve reports its failures on stderr.
- **Related:**
  - [sidecar-loaded-state-selection.md](./sidecar-loaded-state-selection.md)
    changes which process a request replaces. A branch that does one should
    check the other.
  - [forced-kill-reap-wait.md](./forced-kill-reap-wait.md): every
    end-and-reap step, the shared step of C included, waits without a
    deadline after a forced kill. A fix there changes what a failed reap
    means here.
- **Recommendation:** C. One end-and-reap transition keeps every replacement
  inside the bound and reports every failure, with no second path that can
  drift.
- **Action:** fix after merge, apply C, because the warm sidecars change kept
  the root switch, recycle, and their tests unchanged.
