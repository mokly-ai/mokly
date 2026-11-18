# Warm the head entry after a Serve pause

- **Severity:** Medium. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from the performance orchestrator's decision on item 1
  of the capture policy for Serve edits, on branch `calummoore/lisbon-h906`.
  The orchestrator chose C1 for PR #312 and recorded C4 as this item for the
  plan reuse work.
- **Location:** `crates/mokly-cli/src/serve_rebuild.rs:91`,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs:62`,
  `crates/mokly-sidecar/src/pool_exchange.rs:35`,
  `crates/mokly-sidecar/src/pool_shutdown.rs:7`,
  `packages/mokly/src/sidecar.ts:59` to line 67, and
  `docs/protocol/mokly-base-cache.md:67` to line 68.
- **Reason:** The orchestrator kept C4 out of PR #312, because it adds
  cancellation, scheduling, and storage rules. On 2026-11-18 it also kept C4
  outside the plan reuse change of branch
  `calummoore/mokly-sidecar-plan-reuse-srh7`, which adds no idle compile, no
  stop capture, and no promotion of an edit recipe.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Edit compile:** a head `bundle` request with `capture: "serveEdit"`.
    Serve sends it from each head preparation that starts after the process
    publishes its first state.
  - **Pause compile:** the one captured head compile that C4 runs after a
    fixed quiet period, when nothing else runs.
  - **Warming entry:** a stored compilation that no preparation served yet,
    such as a finished pause compile.
  - **Plan reuse:** the change after PR #312, with its rules in
    `docs/protocol/mokly-sidecar-plans.md`. A Serve edit reuses the native
    plan of the last captured compile while a Rust check proves its evidence
    complete, durable, and current. Imports outside the plan use full
    resolution.
- **Background:**
  - On 2026-11-18 the performance orchestrator chose C1 for Serve edits,
    under the user's delegation of 2026-11-16. An edit compile in Serve
    captures nothing and stores nothing. Startup compiles and strict builds
    keep capture and storage. So after unreverted edits, the next start finds
    a stale head entry: the base hits, and the head compiles.
  - A fresh options check of the orchestrator's capture decisions read the
    source on 2026-11-18. On a restart after unreverted edits, the core loads
    the stale head entry in `seed_bundle` at
    `crates/mokly-sidecar/src/pool_bundle_cache.rs:62`. The sidecar restores
    the entry and rejects it, and then the head compiles with capture. Main
    compiles that head once, with no capture, so this start can be slower
    than main. C1 accepts this head compile. The local measurement for PR
    #312 reports the `serve.ready` time and the first Changes time of this
    restart against main.
  - The orchestrator's final check of 2026-11-18 measured this restart. It
    compared the change at `d9561ad63` with `main` at `24b238ca4` on
    `mokly-cloud`, in interleaved runs on 4 vCPU with pool size 4. The
    restart reached `serve.ready` at 2.91 s on `main` and 3.82 s with the
    change, and its first Changes at 15.2 s and 14.7 s.
  - C4, the orchestrator's variant: C1, plus one captured head compile of the
    current head after a fixed quiet period, when nothing else runs. At most
    one extra request runs for each pause. A new edit or a stop cancels it
    cleanly. It uses no extra process and the existing pool bound. A restart
    after a finished pause is then warm.
  - The cost notes that root gave the orchestrator on 2026-11-18, which the
    orchestrator asked this item to keep:
    - The quiet period is a fixed 30 s after ready Changes, with no pending
      foreground work. This is a policy estimate, not measured user
      behaviour. The proposal also weighed 10 s, which starts in more
      edit-and-look cycles, and 60 s, which more stops come before. The
      default watch debounce is 75 ms, at
      `crates/mokly-watch/src/plan.rs:53`.
    - Warming-only storage: a pause compile is not a served compilation. The
      cache keeps "the latest compilation that a command served and could
      store", at `docs/protocol/mokly-base-cache.md:67` to line 68. So C4
      needs approval to let the cache store that bounded, complete, and
      durable result.
    - Worker-only cancellation: `cancel_requests` at
      `crates/mokly-sidecar/src/pool_exchange.rs:35` stops the whole pool
      through `cancel_busy` at `crates/mokly-sidecar/src/pool_shutdown.rs:7`.
      The sidecar reads no frame during a request, at
      `packages/mokly/src/sidecar.ts:59` to line 67. esbuild runs `build`,
      with no cancellable `BuildContext`. So C4 needs a request cancellation
      that kills only its worker, keeps the pool, and restores live
      generations as required.
    - No edit queues behind the background compile. Worker replacement and
      restore can still cost time. That overlap needs a separate measured
      case.
    - The measured cases include pool size 1.
    - One pause request can run two esbuild attempts. So C4 adds one bundle
      request for each pause, not always one compiler invocation.
  - The trigger owner is the rebuild loop of Serve, `run` at
    `crates/mokly-cli/src/serve_rebuild.rs:91`. Only that loop sees watch
    batches, actions, and the stop.
  - Plan reuse on C4:
    - Each finished pause compile that gives a record replaces the plan
      record of its bundle settings. A pause compile is a captured compile,
      so the plan reuse rules already keep its record. A pause compile
      without a record keeps the older record.
      If that compile replaces the disk entry without a plan, the older
      record stays only in the process. The next warm start has no plan.
    - A cancelled pause compile keeps the old record.
    - After a topology change, the next pause restores plan reuse.
    - The plan reuse rules keep the native plan of `bundle()` in
      `packages/mokly/src/sidecar/bundle.ts` with the evidence of the same
      captured compile. They store the plan beside the compiled recipe in
      the bundle cache entry. `restoreGeneration` carries no plan. A warm
      start gets the stored plan only after a sidecar accepts that stored
      compilation.
    - The Rust check is `physical_inputs::current`, at
      `crates/mokly-render/src/physical_inputs.rs:113`. Plan reuse also
      needs the `durable` flag, which that check does not read.
    - The plan record gives the import targets of a captured compile. Option
      D below also needs such a record. Plan reuse stores no edit compile, so
      D still needs the targets of each edit compile.
  - Every option keeps these goals: no setting, gate, or retry; no extra
    process; the existing pool bound; only complete and durable evidence on
    disk; and the first-touch order, the barrier, one capture owner, and
    every bound of each captured compile.
- **Problem:** Under C1, a restart after unreverted edits compiles the head.
  Before the compile, it restores the stale head entry, which the sidecar
  then rejects. No path refreshes the stored head entry while Serve runs.
- **Impact if no action:** Each restart after unreverted edits pays one stale
  restore and one head compile with capture. The orchestrator's local
  measurement of a restart after unreverted edits gives that cost for PR
  #312.
- **Root question:** How can Serve lower the cost of a restart after
  unreverted edits, without slowing any edit or weakening a stored entry?
- **Options:**
  - **A.** Change nothing. C1 stays, and a restart after unreverted edits
    compiles the head. Effort: Small.
  - **B.** C4, with every cost note above: the 30 s quiet period, a warming
    entry rule in the cache contract, worker-only request cancellation that
    keeps the pool, no edit queued behind the background compile, and the
    measured cases with pool size 1. Effort: Large.
  - **C.** The direction of C7, which the options check of 2026-11-18
    added: C1, plus a check in the core that can only reject a stored
    entry. Before the pool restores the entry, the core compares its
    consumed source digests with the current files, and it skips the
    restore at the first difference. When all digests match, the restore
    runs as today, so the reuse check of the sidecar still decides each
    hit. A restart after unreverted edits then skips the stale restore,
    but it still compiles the head. It changes the decision in the section
    "Bundle Cache Seeding" of `docs/protocol/mokly-sidecar-recipes.md`,
    which rejected a check of the stored compilation in the binary. That
    decision weighed a check that can accept an entry, which needs the
    toolchain identity in the binary. A check that can only reject needs
    none. Nobody has measured the gain. Effort: Medium.
  - **D.** The direction of C8, which the same check added: C1, plus a
    store of the served edit compile with the evidence of the last
    captured compile. Off the edit path, the core checks that each
    resolution request of the edit compile resolved to the same file in
    that compile, and that a full read of that evidence still matches the
    files. When both facts hold, the core stores the edit compile. A new
    import or a changed target stores nothing, as in C1. It needs no
    second compile, no cancellation, no quiet period, and no warming entry
    rule, because it stores a served compilation. It needs the
    request-to-target record that plan reuse also needs, a new stability
    proof, and an identity rule for a promoted compilation. After each
    JavaScript edit, it adds a full evidence read and a store write, off
    the edit path. Effort: Large.
- **Left out:**
  - C5, one captured head compile at a graceful stop. The orchestrator
    rejected it on 2026-11-18. It delays every graceful stop and gives
    nothing on a forced stop.
  - C6, capture on every edit with plan reuse in PR #312. The orchestrator
    rejected it on 2026-11-18. It keeps capture on every edit.
  - A worker thread, asynchronous `fs`, and the libuv pool. The orchestrator
    forbade them for the capture on 2026-11-18.
  - A setting or a time gate. No work may add one.
  - Capture after the edit compile. It observes after esbuild resolves, so
    it loses the first-touch order and the barrier.
  - Capture on some edits only. Each captured edit adds its cost to the
    mean edit time, so it fails the edit gate.
- **Wider fix:** None. This is one policy.
- **Previous examples:** The return pass of PR #313 is background pool work
  that never delays foreground work. `schedule_return` and `maintain_return`
  at `crates/mokly-sidecar/src/pool_return.rs:13` and line 39 run it through
  the `mokly-head-return` worker, which
  `crates/mokly-cli/src/serve_return.rs:45` starts. Its rules, including how a
  stop or a cancellation ends it, are in
  `docs/protocol/mokly-sidecar-root-scheduling.md`.
- **Related:**
  - `plans/follow-ups/forced-kill-reap-wait.md`, the same code: a forced kill
    waits for its reap without a deadline. The worker-only cancellation of B
    kills and reaps a worker.
  - `plans/follow-ups/root-switch-reap-wait.md`, the same code: a replacement
    starts before the old process is reaped. B replaces the cancelled worker.
  - `plans/follow-ups/sequential-evidence-capture-cost.md`, the same code:
    each pause compile of B is a captured compile, and a restart after
    unreverted edits compiles the head with capture. Its option C moves the
    physical finish check and the recipe save off the critical path of the
    bundle result, which shortens both.
- **Recommendation:** B, in its own change after the plan reuse work. It
  makes restarts after a pause warm and keeps each edit on the C1 path. C
  and D stay alternatives for that change. C is smaller, but the restart
  stays cold. D shares the request-to-target record of plan reuse, but it
  needs a new stability proof.
- **Action:** ask the user, because B and D change the rules of a bundle
  entry, C changes a seeding decision of the compiled recipe rules, and no
  measurement yet decides the quiet period, the cost of an edit that arrives
  during a pause compile, or the gain of C.
