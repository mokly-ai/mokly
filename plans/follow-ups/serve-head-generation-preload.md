# Prepare new head generations before their renders

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-19, from the performance orchestrator's decision to keep
  the head preload of branch `calummoore/mokly-generation-prefetch` as a
  record and to open no product pull request for it.
- **Location:** `crates/mokly-sidecar/src/pool_preparation.rs`
  (`Pool::prepare` and `Pool::restore`), `crates/mokly-sidecar/src/pool_return.rs`
  (`Pool::maintain_return`), `crates/mokly-sidecar/src/pool_head.rs`
  (`Pool::record_head`), `crates/mokly-sidecar/src/pool_releases.rs`
  (`Pool::record_release` and `clean_idle`), `crates/mokly-render/src/bundle.rs`
  (the core's `cssModules` and `describe` after a bundle),
  `crates/mokly-cli/src/serve_return.rs` (the Serve background worker), and
  `packages/mokly/src/sidecar/session.ts` (`restoreGeneration`, `describe`, and
  `dispose`).
- **Reason:** Two measured attempts of 2026-11-19 gave no net edit-to-ready
  gain, so a new attempt needs the performance orchestrator's choice of
  approach and a new measurement.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Head generation:** one bundled version of the catalogue JavaScript of
    the working repository. A sidecar process needs `restoreGeneration`,
    `cssModules`, `describe`, and `bindings` for it before it renders a view.
  - **Bundling process:** the sidecar process that ran the `bundle` request of
    a generation, so it holds that generation already.
  - **`serve.background`:** the Serve timing stage that renders the changed
    views of an edit over all sidecar processes.
  - **Head preload:** the attempt of 2026-11-19. After the core's `describe`
    of a new head generation, the Serve background worker prepared that
    generation on each other idle head process, one process at a time.
  - **mokly-cloud:** the measurement catalogue of the performance
    orchestrator: 167 entries, 1,508 views, 4 vCPU, and a pool of 4 sidecars.
- **Background:**
  - Timeline of 2026-11-18 on mokly-cloud: a normal Serve edit took about
    2.85 s from the file write to Changes ready. The head bundle runs on one
    process, and the core then sends `cssModules` and `describe` to that
    process. The core then runs `render.inputs` and `graph.prepare` for about
    350 ms, and `graph.prepare` sends one `bindings` request. Then
    `serve.background` renders about 44 changed views over the 4 processes.
  - In that timeline, each of the 3 processes that did not bundle spent
    110 ms to 250 ms on `restoreGeneration`, `cssModules`, and `describe` when
    the first render reached it. That work is on the critical path of
    `serve.background`. The same processes are idle during the 350 ms before
    it.
  - Both attempts kept these rules: idle head processes only, one call at a
    time on a process, a stop before the next call when a request waits or
    when a call that Serve admitted has not reached the pool queue yet, no
    process start, the newest head generation only, the existing release
    path, and no output change. Both measurements used release builds, the
    same dist, 6 interleaved rounds against main `3e624480e`, and one cgroup
    for each run.
  - Attempt 1, commit `062429a48`, preloaded `restoreGeneration`,
    `cssModules`, and `describe`:
    - `serve.background` per edit fell from 740, 540, and 466 ms to 616, 430,
      and 364 ms, about 110 ms less.
    - The mean sidecar bundle of the three edits went from 1,323, 1,248, and
      1,213 ms to 1,276, 1,357, and 1,388 ms: 47 ms less, then 109 and 175 ms
      more.
    - `watch.action` went from 2,023, 1,761, and 1,664 ms to 2,037, 1,923,
      and 1,900 ms.
    - Edit to ready rose from 2.83 s to 2.88 s.
    - Peak memory demand, cgroup anonymous memory plus swap, rose from a mean
      of 2,818 MiB to 3,043 MiB, about 8%.
  - A pool test and a Serve trace of attempt 1 explain the memory. The trace
    used `examples/basic`, 4 sidecars, and five edits, with the preload on
    and off. The release path drops a preloaded generation exactly as a
    rendered one, and at the next bundle no process holds more than the
    newest head generation. But the core releases the old head generation
    only when the new state replaces the published one, at the start of the
    next `serve.background`. So each preloaded process evaluated the new
    generation while the old one was still published, and held two evaluated
    head generations until that release. Without the preload, a render first
    disposes the old generation and then loads the new one.
  - Attempt 2, commit `1e01658c0`, preloaded only `restoreGeneration` and
    `cssModules`, and the first render still sent `describe`:
    - `serve.background` per edit fell from 738, 557, and 476 ms to 630, 516,
      and 419 ms, 69 ms less on average.
    - `watch.action` went from 2,029, 1,781, and 1,582 ms to 2,089, 1,836,
      and 1,743 ms: 60, 55, and 161 ms more.
    - The mean sidecar bundle went from 1,315, 1,270, and 1,128 ms to 1,343,
      1,272, and 1,219 ms.
    - Edit to ready went from 2.82 s to 2.86 s.
    - Peak memory demand stayed equal: 2,812 MiB and 2,817 MiB.
  - The orchestrator reads attempt 2 as CPU contention. The three restores
    run during validation, `render.inputs`, and `graph.prepare`. For each
    restore, the core encodes the recipe payload of about 4.5 MB, and the
    Node process parses it.
  - Without the bundle, attempt 1 still cost `watch.action` about 50 to 60 ms
    for each edit, and attempt 2 about 30 to 70 ms. Attempt 2 also showed a
    bundle 91 ms slower on the third edit, so the overlap may not be the only
    cause of slower later bundles.
  - The acceptance bar of 2026-11-19 is a net edit-to-ready gain of at least
    30 ms for each edit on mokly-cloud, peak memory demand within 2% of main,
    and no slower sidecar bundle on later edits. Both attempts missed it.
- **Problem:** The processes that did not bundle a new head generation still
  prepare it on the critical path of `serve.background`. The two attempts to
  prepare it earlier cost as much CPU in the core window, or as much memory
  and bundle time, as they saved.
- **Impact if no action:** Each edit on mokly-cloud keeps 110 ms to 250 ms of
  preparation on each process that did not bundle, inside `serve.background`.
- **Root question:** How can Serve take the preparation of a new head
  generation off the critical path of `serve.background`, without a slower
  core window, a slower later bundle, or more peak memory?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Attempt 1 with an eviction first. Before the preload evaluates the
    new generation on a process that did not bundle it, the pool disposes the
    old head generation on that process. The bundling process keeps the old
    generation, so requests of the published state can still find it. No
    process then holds two evaluated head generations. Cost: a new pool rule
    that disposes a live generation on one process, a restore when a request
    of the old state reaches an evicted process, and the window CPU of three
    restores and evaluations. Effort: Medium.
  - **C.** A cheaper restore payload. Encode the recipe of a generation once
    and reuse the bytes for each process, or write it once to a shared file
    that each process reads. This cuts the core-side encoding from three times
    to once, and a shared file can also cut the Node parse. Cost: a pool or
    protocol change, file lifetime rules for a shared file, and a measurement
    of the Node parse share. Effort: Large.
  - **D.** A cheaper preparation in the sidecar, with no preload. Make
    `restoreGeneration` and `describe` themselves faster, for example with a
    lighter recipe format or an evaluation that skips modules that no changed
    view needs. This shortens the critical path on every process without new
    background work. Cost: sidecar changes in evaluation, and new evidence
    that the skipped modules cannot change a view. Effort: Large.
  - **E.** B and C together. Effort: Large.
- **Left out:**
  - A preload that starts after the new state is published, because the
    release of the old generation and the first renders both happen at the
    start of `serve.background`, so no idle time is left for it.
  - A preload of every candidate at once, because it adds CPU contention in
    the core window, which both measurements show as the main cost.
  - A preload of one process for each edit, because it saves at most a third
    of the gain against the same cost for each process.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** PR #313 keeps head processes ready after base work,
  and PR #315 ranks idle processes by the loaded state that a call needs.
- **Related:**
  - [serve-sidecar-prestart.md](./serve-sidecar-prestart.md) also proposes a
    replay of the generation before the background pass. Its measurements
    should use the overlap rule above.
  - [sidecar-loaded-state-selection.md](./sidecar-loaded-state-selection.md)
    chooses processes by their loaded state. An eviction rule as in option B
    changes that state, so design the two together.
  - [dispose-older-head-generations.md](./dispose-older-head-generations.md)
    plans the eviction rule of option B for the earlier start of the
    background pass after a publication. When that item merges, option B
    needs only the preload itself.
- **Recommendation:** B, measured once. Attempt 1 gave the larger background
  gain, and its two misses, more memory and slower later bundles, follow
  from the overlap that B removes. Its window cost without the bundle was
  about 55 ms, so B can pass the bar if the bundle slowdown goes with the
  overlap. C best attacks the window cost, and it can follow B when the
  window cost alone blocks the bar.
- **Action:** ask the user, because two measured attempts missed the
  acceptance bar, so no option is clearly best before a new measurement. The
  performance orchestrator decides under the user's delegation of
  2026-11-16.

The code of both attempts is on the branch
[`calummoore/mokly-generation-prefetch`](https://github.com/mokly-ai/mokly/tree/1e01658c0a6c5420e340364f09f8aff87fae1c41),
commits `062429a48` and `1e01658c0`.
