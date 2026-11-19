# Dispose older head generations before evaluating the newest

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-19, from branch `calummoore/mokly-publish-path`, at the
  decision of the performance orchestrator, which owns this item.
- **Location:** `crates/mokly-sidecar/src/pool_requests.rs` (`Pool::execute`),
  `crates/mokly-sidecar/src/pool_cleanup.rs` (`cleanup`),
  `crates/mokly-sidecar/src/pool_head.rs` (`Head::warm`),
  `crates/mokly-sidecar/src/pool_releases.rs` (`Pool::record_release` and
  `clean_idle`), and `crates/mokly-server/src/background.rs`
  (`UsagePass::run`).
- **Reason:** The performance orchestrator kept the pool rule and the earlier
  start of the background pass out of that branch, because the pool rule is a
  behaviour change of its own, with its own risks and measurement.

- **Category:** Performance.
- **Terms:**
  - **Head generation:** one bundled version of the catalogue JavaScript of
    the working repository. A sidecar process restores and evaluates it before
    it renders a view of it.
  - **Bundling process:** the sidecar process that ran the `bundle` request of
    a generation, so it holds that generation already.
  - **Release:** the moment when the last core owner of a render generation
    drops it. `BundleLease::drop` in `crates/mokly-render/src/leases.rs` then
    records the release in the pool.
  - **Window:** the time from the end of `graph.prepare` to the start of
    `serve.background` on a watched Serve edit.
  - **Pass snapshot:** the published snapshot that one background usage pass
    renders. `UsagePass::run` captures it at the start of the pass.
- **Background:**
  - After the pool records a release, the pool's release thread disposes the
    generation on each idle process (`clean_idle`). A busy process disposes
    it at the start of its next request (`cleanup` in `Pool::execute`), and
    only then does that request restore and evaluate its own generation.
  - So a process that did not bundle disposes the old head generation before
    it evaluates the new one only when the release comes before the first
    render of the new generation that reaches the process.
  - On `main`, the background task drops its previous pass snapshot before it
    starts `serve.background`. That drop took 17 ms on `examples/basic` and
    68 ms on the large React fixture of `scripts/large/` (30 areas, 5,850
    documents), means of release builds on 4 vCPU on 2026-11-19. In that time
    the rebuild thread drops the replaced snapshot, which is the last owner of
    the old render generation. The old render generation started to drop
    before the first background render in 18 of 18 rebuilds on
    `examples/basic` and in 11 of 12 on the large fixture.
  - Test builds of branch `calummoore/mokly-publish-path` tried an earlier
    start: the background task handed its previous pass snapshot to a drop
    on a blocking thread of the runtime, one drop at a time, and started the
    pass at once. A drop that arrived during another drop ran on the caller.
    These builds also held the watch plan reuse, and they did not copy the
    prepared catalogue or the projected snapshot. The merged branch holds the
    watch plan reuse and keeps both copies, and it has no earlier start.
  - The effect of the earlier start alone, on `examples/basic`, between two
    builds with the plan reuse and without the copies: the window fell from
    47.8, 50.3, and 52.6 ms to 33.4, 30.0, and 31.7 ms (3 runs each). No such
    pair ran on the large fixture. There, the drop that the earlier start
    removes took 68 ms on `main`.
  - The first background renders then started about 1 ms after the
    publication. On the large fixture, the old render generation started to
    drop after the first background render in 12 of 12 rebuilds, against 1 of
    12 on `main`. The processes that did not bundle then evaluated the new
    head generation while they still held the old one, until their next
    request.
  - Peak RSS of the Serve process tree on `examples/basic`, 4 sidecars:
    - `main` and the build with the earlier start ran as 3 interleaved pairs.
      `main`: 2,537, 2,539, and 2,540 MiB. With the earlier start: 2,636,
      2,577, and 2,737 MiB, a mean of 4.4% more.
    - The build with the plan reuse and without the copies, but without the
      earlier start, ran 3 times after those pairs: 2,464, 2,539, and
      2,472 MiB. Against it, the earlier start added a mean of 6.4%.
  - The merged state, the plan reuse alone with both copies (commit
    `10487c8cc`), measured by the performance orchestrator on mokly-cloud on
    2026-11-19, 12 interleaved rounds against `main` `3e624480e`:
    - Window per edit: 129, 92, and 92 ms on `main`, 127, 42, and 42 ms with
      the change.
    - Edit-to-ready mean: 2.89 s on `main`, 2.81 s with the change.
    - First Changes result: 12.96 s on `main`, 12.74 s with the change.
    - Peak memory demand: 2,905 MiB on `main`, 2,768 MiB with the change.
  - The same overlap raised the peak memory demand of mokly-cloud by about 8%
    in attempt 1 of the head preload.
  - On 2026-11-19 the performance orchestrator chose, under the user's
    delegation of 2026-11-16, to merge the plan reuse alone, without the
    earlier start, and to make the pool rule below the root fix, in its own
    branch and measurement.
- **Task:**
  1. Add a pool rule: before a head process that did not bundle the newest
     head generation (`Head::warm`) runs a render of that generation,
     `Pool::execute` disposes the older head generations that the process
     holds, also when their release is not recorded yet. A later request of an
     older state on that process restores its generation as today.
  2. Add pool tests for these cases:
     - Such a process disposes the older head generation before it evaluates
       the newest one.
     - A later request of the older state restores it.
     - The bundling process and the processes of a base source root keep
       their generations.
  3. Then start the background pass at once after a publication: the
     background task hands its previous pass snapshot to a drop on a blocking
     thread, one drop at a time, and a drop that arrives during another drop
     runs on the caller.
  4. Measure mokly-cloud against `main`: the window, the edit-to-ready mean,
     and the peak memory demand.
- **Impact if no action:** The window keeps the background task's drop of its
  previous pass snapshot. A foreground render right after a publication can
  still meet the overlap on a large catalogue.
- **Needs:** The merged change of branch `calummoore/mokly-publish-path`, and
  the mokly-cloud measurement of the performance orchestrator.
- **Done when:** The pool rule and its tests are merged, the background pass
  starts without the drop, and a mokly-cloud measurement shows the window
  gain with a peak memory demand within 2% of `main`.
- **Related:** [serve-head-generation-preload.md](./serve-head-generation-preload.md)
  proposes the same eviction rule as its option B. The rule of this item also
  lets that preload evaluate a new generation without a second evaluated head
  generation on the process.
