# A failed benchmark sample skips detached process groups

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the options check of decision 4 in the
  generation affinity plan, branch
  `calummoore/mokly-sidecar-generation-affinity-jmbb`: a new problem outside
  its scope.
- **Location:** `scripts/large/memory.ts:106-117`, line 123, and lines
  133-137, `scripts/large/memory_lifecycle.ts:16-28`,
  `scripts/large/lifetime.ts:37`, `scripts/large/signals.ts:8`, and
  `tests/large_memory_lifecycle.test.ts:62` and line 83.
- **Reason:** The generation affinity branch changes only sidecar pool
  selection and untracked scratch evidence, and this harness code is already
  on `main`.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Large benchmark:** the opt-in harness `npm run benchmark:large` under
    `scripts/large/`. It measures build, Serve, Changes, and watch on a
    generated large fixture.
  - **Shim:** the `mokly` Node process that the harness starts. It starts the
    native core, and the core starts the sidecars.
  - **Detached group:** a process group that a descendant leads in its own
    session, apart from the group of the shim.
  - **Owned tree:** the shim and every process below it by parent links, as
    one `ps` table shows them.
- **Background:**
  - `scripts/large/process.ts:17-20` starts the shim with `detached: true`,
    so the shim leads its own group. The core runs in that group.
    `lifetime` signals that group, `-pid`, at `scripts/large/lifetime.ts:37`.
  - The core starts each sidecar in a new session. `NodeFactory` calls
    `ProcessGroups::configure` at
    `crates/mokly-sidecar/src/process_factory.rs:99`. That call runs `setsid`
    at `crates/mokly-platform/src/unix.rs:63-64`. Other helpers that the core
    starts through `ProcessGroups` also get their own groups. So a signal to
    the group of the shim does not reach them.
  - The sampler, `monitor` in `scripts/large/memory.ts`, reads
    `ps -eo pid=,ppid=,pgid=,rss=` every 50 ms. Two paths end a run through
    `abort`, at lines 106-117:
    - The RSS stop, at lines 133-137, passes every PID of the owned tree from
      the same table. `monitorChild`, at
      `scripts/large/memory_lifecycle.ts:16-28`, first kills the group of the
      shim with SIGKILL. Then `killProcesses`, at `scripts/large/signals.ts:8`,
      sends SIGKILL to each PID of that tree, also to the detached sidecars.
    - A sampling failure, at line 123, passes only the PID of the shim. The
      run then ends with the group kill and the shim kill only. No signal
      reaches a detached group.
  - The current path signals no PID without a current table. The comment at
    `scripts/large/memory.ts:110` says that the harness signals the owned
    group while its leader is unreaped and its ID is reserved. After a failed
    read, the harness knows no current PID of a descendant.
  - `tests/large_memory_lifecycle.test.ts` pins both paths. In its fixture,
    PID 20 is the shim, 21 the core, and 30 a sidecar in group 30:
    - "failed sampling kills the live owned group before its shim", at line
      62, expects the events `group` and `pid:20`, in that order.
    - "memory stop kills the group before detached sidecars", at line 83,
      expects `group`, `pid:30`, `pid:21`, and `pid:20`.
    - The tests from line 101 check that a child exit during a sample sends
      no signal and reads `ps` once.
  - After the core dies, the sidecars have their own protection. On Linux,
    `crates/mokly-sidecar/src/process_parent.rs:77` sets `PR_SET_PDEATHSIG`
    to SIGKILL for each sidecar. `docs/protocol/mokly-sidecar.md:29` says that
    a sidecar never outlives its binary, on every platform, through pipe
    closure or parent death. So a sidecar should end after the core's SIGKILL.
    The harness does not check this. Each other descendant in a detached
    group depends on its own protection.
  - No test runs this path with live descendants. On 2026-11-18, 14 local
    benchmark runs on the branch above had no sampling failure. All 130 PIDs
    that they recorded had ended afterwards. Nobody has reproduced a process
    that stayed alive.
  - The exact effect of a real `ps` failure on live descendants still needs
    investigation.
- **Problem:** After a failed `ps` read, the benchmark ends only the group of
  the shim and the shim. It sends no signal to detached groups, so the
  sidecars and other detached descendants depend on their own protection. The
  RSS stop ends that whole owned tree.
- **Impact if no action:** A detached descendant without working protection
  stays alive after a failed run, and the harness does not report it. On a
  shared host it keeps its memory until somebody ends it.
- **Root question:** How does the benchmark end every process of a run that
  it stops, also after a failed sample, without a signal to a process that it
  does not own?
- **Options:**
  - **A.** Change nothing. A sampling failure keeps ending only the group of
    the shim and the shim. Detached descendants rely on their own protection.
    Effort: Small.
  - **B.** On a sampling failure, stop the owned tree of the newest
    successful table, as the RSS stop does. Those PIDs can be one or more
    sample intervals old, so a reused PID can get SIGKILL. The stop also
    misses processes that started after that table. Effort: Small.
  - **C.** On a sampling failure, read the table once more. Stop the owned
    tree from that read when it succeeds. Keep the current stop when it fails
    too. A second failure leaves the same gap. Effort: Small.
  - **D.** On a sampling failure, send SIGTERM to the group of the shim, so
    that the core can stop its own sidecars. Keep the existing 10-second
    escalation to SIGKILL. The run can then grow without a sample for up to
    10 seconds, and the stop relies on the core's own shutdown. Effort: Small.
  - **E.** Give both abort paths one shared owned-tree stop. Effort: Medium.
    - It first kills the group of the shim, while the shim is unreaped.
    - Then it sends SIGKILL to each process of the owned tree in a current
      table, as the RSS stop does now. For a sampling failure, it first
      tries one more read.
    - It never signals a PID that no current table confirms. When no read
      succeeds, it reports each descendant of the newest earlier table that
      it could not confirm.
    - It keeps every assertion of `tests/large_memory_lifecycle.test.ts`,
      such as the signal order and the single read after a child exit.
    - It needs no longer timeout.
    - The best confirmation after a failed read, such as one more `ps` read
      or a process start time, needs investigation.
- **Left out:**
  - An owner of the whole tree from the operating system, such as a Linux
    cgroup or a child subreaper. `tests/fixtures/large/README.md:73` says
    that the harness runs on any Unix host, and these exist only on Linux.
  - A check that only reports the processes that stay alive. It finds the
    gap but does not close it.
  - A longer wait for descendants to exit. It raises a time limit, and it
    ends no process.
- **Wider fix:** E. One shared stop gives every abort path the same
  owned-tree rule, so a later abort path cannot skip the detached groups.
- **Previous examples:** None found. The RSS stop, at
  `scripts/large/memory.ts:133-137`, already ends the whole sampled tree.
- **Related:**
  [large-benchmark-memory-default.md](./large-benchmark-memory-default.md)
  proposes a live floor. That floor must end a run with the complete tree
  stop, not through the sampling-failure path.
- **Recommendation:** E. One shared stop ends the whole owned tree on both
  paths when a current table exists, and it never signals an unconfirmed PID.
- **Action:** fix after merge, apply E, because the generation affinity
  branch changes only sidecar pool selection and scratch evidence, not the
  benchmark harness.
