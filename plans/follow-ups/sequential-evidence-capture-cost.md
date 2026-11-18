# Sequential evidence capture slows each real compile

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix in this pull request.
- **Added:** 2026-11-17, from the Milestone 5 measurement of the bundle disk
  cache change, on branch `calummoore/lisbon-h906`.
- **Location:** `packages/mokly/src/sidecar/physical-inputs.ts:45` to line
  78, and `packages/mokly/src/sidecar/resolution-evidence.ts:57` to line 58.
- **Reason:** The performance orchestrator moved option D into this pull
  request on 2026-11-18. The edit regression also occurs on `mokly-cloud`,
  and edit-to-Changes time is the main merge metric.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Reuse evidence:** the record of each file, directory list, absent path,
    and link that decides which file each import of a compiled bundle
    selects.
  - **Capture request:** one unique pair of an import specifier and its
    importing directory. The sidecar captures its reuse evidence before
    esbuild resolves the import.
  - **Real compile:** a `bundle` request that runs esbuild, because no memory
    or disk compilation passed the reuse check.
  - **Witness:** a stat record of one directory or metadata file, kept from
    the first touch until after the compile. The witnesses decide whether the
    bundle cache may store the compilation.
  - **Barrier:** one wait of at most 50 ms before the first observation of a
    real compile, when a recent change could otherwise fail the witnesses.
- **Background:**
  - The sidecar compiles the catalogue JavaScript with esbuild in `bundle()`,
    in `packages/mokly/src/sidecar/bundle.ts`. One evidence owner,
    `ResolutionEvidence`, serves the native and the planned attempts of one
    call, and it finishes once after the last attempt.
  - The esbuild plugin `mokly-reuse-evidence` awaits `record()` in its
    `onResolve` callback, at
    `packages/mokly/src/sidecar/resolution-evidence.ts:57` to line 58. So the
    observations and the witnesses of a path exist before esbuild resolves
    the import that reads that path. This order keeps stored evidence
    coherent with the files that esbuild selected.
  - `PhysicalInputs.request` at
    `packages/mokly/src/sidecar/physical-inputs.ts:45` merges duplicate
    requests by specifier and directory before any queue. It charges each key
    to an 8 MiB bound. Lines 67 to 76 chain each new unique request on one
    `pending` promise, so unique requests run one at a time, and each
    `onResolve` call waits for every earlier request.
  - On 2026-11-16, the bundle disk cache change chose this queue in place of
    a schedule-dependent count of requests in flight. Completeness and the
    byte bounds then never depend on scheduling. The test "duplicate
    resolution requests keep complete evidence without depending on queue
    scheduling", in `tests/sidecar_reuse_capture.test.ts:143`, records 5,000
    duplicate requests and requires complete evidence.
  - The same owner keeps four bounds of 8 MiB each: retained observations,
    parsed metadata, visited paths, and request keys. The witnesses share the
    visited-path bound, and the barrier preflight counts its own paths
    against the same 8 MiB limit. Each metadata file is bounded at 1 MiB. An
    exceeded evidence bound clears `complete`. An exceeded witness or
    preflight bound clears only `durable`. After the compile, the final
    checks run with at most four workers, through `everyInput` at
    `packages/mokly/src/sidecar/file-digests.ts:52`.
  - Capture runs only for a real compile. A warm restart reuses a memory or
    disk compilation, so it captures nothing.
  - Measurements of 2026-11-17 on `examples/basic`, on one Linux machine,
    against `main` at `794b30a91`:
    - Warm restarts gained. The `serve.ready` median fell from 3.018 s to
      2.316 s, with zero warm compiles and zero esbuild operations on the
      head and the base. Strict build output stayed byte-identical.
    - A copy of the sidecar with timing wrappers measured the head capture
      after a JavaScript edit. It ran 3,143 unique requests with 1,665.0 ms
      of request work, and 1,631.1 ms of that work ran while a compile was in
      flight. The capture took 1,872.3 ms in total: 1,667.4 ms of
      observation, 198.3 ms of the physical finish check, and 6.6 ms of the
      witness finish check. The witness preflight took 2.7 ms, and the
      barrier waited 0 ms. The first head and base captures took 1,982.3 ms
      and 1,979.8 ms.
    - One uninstrumented pair of the same JavaScript edit ran before and
      after the change. `watch.action` rose from 4.543 s to 7.211 s. The time
      from the edit to the end of the next classification rose from 10.423 s
      to 13.823 s. The `sidecar.bundle` span of the edit rose from 2,767.5 ms
      to 5,731.9 ms, and its native compile span from 1,140.6 ms to
      3,514.8 ms. Both runs compiled twice after the edit.
    - Single cold runs also rose: the basic `serve.ready` from 4.158 s to
      5.336 s, and the basic build from 16.837 s to 20.447 s.
  - These numbers prove no cause. The pair is one sample, with no median.
    The after run reused disk compilations at startup, so its first compile
    came at the edit. The copied sidecar timed its own wrappers.
  - Final measurements of 2026-11-17, on the same machine, against `main` at
    `0accb6818`, with the change at `f032dd04c`:
    - All 28 release cases passed. All nine warm cases of the change had zero
      compiles and zero esbuild operations. All eight strict outputs matched
      byte for byte.
    - Warm medians of three runs went from before to after as follows. Basic
      `serve.ready` went from 3.031 s to 2.611 s, and React `serve.ready` from
      1.831 s to 1.116 s. The basic build wall time went from 13.584 s to
      12.212 s. `changes.classify` went from 4.839 s to 4.583 s in basic
      Serve, and from 4.766 s to 4.186 s in the basic build. In React it went
      from 2.036 s to 1.240 s. `serve.background` went from 4.327 s to
      4.760 s in basic Serve, and from 0.482 s to 0.494 s in React.
    - Single cold runs went from before to after as follows. Basic
      `serve.ready` went from 6.687 s to 6.063 s, and React `serve.ready` from
      1.569 s to 3.296 s. Basic Serve `changes.classify` went from 8.375 s to
      11.767 s, and React from 1.977 s to 3.621 s. The basic build wall time
      went from 15.795 s to 19.888 s.
    - One uninstrumented pair of the JavaScript edit ran before and after the
      change. `watch.action` went from 2.823 s to 5.418 s, which is 2.595 s
      more. The time from the edit to the end of the next classification went
      from 7.342 s to 11.035 s, which is 3.693 s more. The `sidecar.bundle`
      span of the edit went from 1,626.5 ms to 4,085.2 ms, and its native
      compile span from 642.9 ms to 2,167.2 ms. Both runs compiled twice after
      the edit.
    - The copied sidecar measured 1,553.332 ms of capture for the edited head.
      Of that, 1,377.483 ms was observation, 171.095 ms the physical finish
      check, and 4.755 ms the witness finish check. The witness preflight
      took 2.382 ms outside that total. The capture ran 3,143 unique requests
      with 1,375.761 ms of request work, and 1,354.092 ms of that work ran
      during a compile.
    - The first head and base captures took 1,447.745 ms and 1,956.214 ms,
      with 3,143 and 3,156 unique requests. No capture of the set called the
      barrier wait, so each actual wait was 0 ms.
    - Each edit and each cold value is one sample for each release, not a
      median. The after run again reused disk compilations at startup, so its
      first compile came at the edit. These numbers prove no cause and no
      overall speed change.
  - Final measurements of 2026-11-18, on the same machine, against `main` at
    `e8c964cb1`, with the change at `1c3545ddf`:
    - All 28 release cases passed. All nine warm cases of the change had zero
      compiles and zero esbuild operations. All eight strict outputs matched
      byte for byte.
    - Warm medians of three runs went from before to after as follows. Basic
      `serve.ready` went from 3.058 s to 2.439 s, and React `serve.ready` from
      1.659 s to 1.173 s. The basic build wall time went from 15.286 s to
      13.203 s, and its `build` span from 15.239 s to 13.148 s.
      `changes.classify` went from 4.833 s to 4.014 s in basic Serve, and from
      5.211 s to 3.991 s in the basic build. In React it went from 1.974 s to
      1.267 s. `serve.background` went from 4.789 s to 4.232 s in basic Serve,
      and from 0.461 s to 0.429 s in React.
    - Single cold runs went from before to after as follows. Basic
      `serve.ready` went from 4.532 s to 5.216 s, and React `serve.ready` from
      1.898 s to 2.832 s. `changes.classify` went from 7.706 s to 9.445 s in
      basic Serve, and from 7.030 s to 10.611 s in the basic build. In React
      it went from 2.227 s to 3.563 s. `serve.background` went from 4.549 s to
      4.492 s in basic Serve, and from 0.448 s to 0.368 s in React. The basic
      build wall time went from 16.916 s to 22.780 s, and its `build` span from
      16.873 s to 22.737 s.
    - One uninstrumented pair of the JavaScript edit ran before and after the
      change. `watch.action` went from 4.517 s to 5.054 s, which is 0.537 s
      more. The time from the edit to the end of the next classification went
      from 6.185 s to 6.542 s, which is 0.357 s more. The `sidecar.bundle`
      span of the edit went from 2,406.5 ms to 3,841.9 ms, and its native
      compile span from 700.5 ms to 2,025.7 ms. Both runs compiled twice after
      the edit.
    - The copied sidecar measured 1,830.916 ms of capture for the edited head.
      Of that, 1,622.151 ms was observation, 203.536 ms the physical finish
      check, and 5.230 ms the witness finish check. The witness preflight
      took 2.550 ms outside that total. The capture ran 3,135 unique requests
      with 1,615.969 ms of request work, and 1,585.581 ms of that work ran
      during a compile.
    - The first head capture took 1,672.856 ms. Of that, 1,499.174 ms was
      observation, 167.970 ms the physical finish check, and 5.712 ms the
      witness finish check. Its witness preflight took 5.198 ms. It ran 3,135
      unique requests with 1,496.607 ms of request work, and 1,459.971 ms of
      that work ran during a compile.
    - The first base capture took 1,738.768 ms. Of that, 1,503.628 ms was
      observation, 225.302 ms the physical finish check, and 9.838 ms the
      witness finish check. Its witness preflight took 2.636 ms. It ran 3,148
      unique requests with 1,500.541 ms of request work, and 1,459.076 ms of
      that work ran during a compile.
    - No capture of the set called the barrier wait, so each actual wait was
      0 ms. All three captures had complete and durable evidence.
    - Each edit and each cold value is one sample for each release, not a
      median. The after run again reused disk compilations at startup, so its
      first compile came at the edit. These numbers prove no cause and no
      overall speed change.
  - Final measurements of 2026-11-18, on the same machine, against `main` at
    `bc4f4cc40`, with the change at `3d55fdbd1`:
    - All 28 release cases passed. All nine warm cases of the change had zero
      compiles and zero esbuild operations. All eight strict outputs matched
      byte for byte.
    - Warm medians of three runs went from before to after as follows. Basic
      `serve.ready` went from 2.815 s to 2.354 s, and React `serve.ready` from
      1.242 s to 0.795 s. The basic build wall time went from 12.388 s to
      10.773 s, and its `build` span from 12.348 s to 10.732 s.
      `changes.classify` went from 4.366 s to 3.905 s in basic Serve, and from
      3.949 s to 3.429 s in the basic build. In React it went from 1.407 s to
      1.000 s. `serve.background` went from 4.063 s to 4.152 s in basic Serve,
      and from 0.264 s to 0.331 s in React.
    - Single cold runs went from before to after as follows. Basic
      `serve.ready` went from 3.887 s to 4.797 s, and React `serve.ready` from
      1.117 s to 2.668 s. `changes.classify` went from 7.092 s to 8.326 s in
      basic Serve, and from 5.936 s to 8.031 s in the basic build. In React
      it went from 1.513 s to 2.679 s. `serve.background` went from 5.590 s to
      4.186 s in basic Serve, and from 0.277 s to 0.334 s in React. The basic
      build wall time went from 13.552 s to 17.902 s, and its `build` span from
      13.509 s to 17.869 s.
    - One uninstrumented pair of the JavaScript edit ran before and after the
      change. `watch.action` went from 2.585 s to 4.282 s, which is 1.697 s
      more. The time from the edit to the end of the next classification went
      from 3.398 s to 5.110 s, which is 1.712 s more. That next
      `changes.classify` went from 0.296 s to 0.343 s. The `sidecar.bundle`
      span of the edit went from 1,624.0 ms to 3,257.4 ms, and its native
      compile span from 610.5 ms to 1,704.8 ms. Both runs compiled twice after
      the edit.
    - One uninstrumented pair of the CSS edit ran before and after the
      change. The edit changes the background of a standalone stylesheet.
      `watch.action` went from 0.821 s to 0.804 s. The time from the edit to
      the end of the next classification went from 1.255 s to 1.250 s, and
      that next `changes.classify` went from 0.301 s to 0.320 s. Neither run
      compiled or ran an esbuild operation after the CSS edit.
    - The copied sidecar measured 1,470.307 ms of capture for the edited head.
      Of that, 1,258.384 ms was observation, 205.056 ms the physical finish
      check, and 6.867 ms the witness finish check. The witness preflight
      took 2.229 ms outside that total. The capture ran 3,135 unique requests
      with 1,255.354 ms of request work, and 1,231.207 ms of that work ran
      during a compile.
    - The first head capture took 1,674.533 ms. Of that, 1,419.945 ms was
      observation, 247.560 ms the physical finish check, and 7.028 ms the
      witness finish check. Its witness preflight took 3.894 ms. It ran 3,135
      unique requests with 1,414.636 ms of request work, and 1,383.496 ms of
      that work ran during a compile.
    - The first base capture took 1,714.232 ms. Of that, 1,498.871 ms was
      observation, 206.782 ms the physical finish check, and 8.578 ms the
      witness finish check. Its witness preflight took 3.719 ms. It ran 3,148
      unique requests with 1,495.961 ms of request work, and 1,463.703 ms of
      that work ran during a compile.
    - No capture of the set called the barrier wait, so each actual wait was
      0 ms. All three captures had complete and durable evidence.
    - Each edit and each cold value is one sample for each release, not a
      median. The after run of the JavaScript edit again reused disk
      compilations at startup, so its first compile came at the edit. These
      numbers prove no cause and no overall speed change.
  - The performance orchestrator measured `mokly-cloud` on 2026-11-18. The
    catalogue has 167 entries and 1,508 views. The runs used 4 vCPU, pool
    size 4, and `--base HEAD`. Each arm used a release core with its own
    sidecar dist: `main` at `bc4f4cc40` and the change at `e253021fb`. Each
    run did a strict build, then a Serve start with two edits of line 35 of
    `slug-editor.tsx`. The runs were interleaved, three warm and two cold for
    each arm. A cold run removed the bundle cache first, so only its strict
    build was cold. A warm run reset line 35 first, so its strict build
    missed one side. The table gives these values for `main` and then the
    change:
    - Warm: edit 1 to Changes ready 4.49 s and 7.70 s, and edit 2 3.97 s and
      7.22 s. `watch.action` took 3.08 s and 6.26 s for each edit.
    - Cold: edit 1 4.67 s and 7.49 s, and edit 2 4.05 s and 7.61 s.
      `watch.action` took 3.25 s and 6.31 s.
    - The strict build wall time was 19.4 s and 20.0 s warm, and 18.1 s and
      24.0 s cold. `serve.ready` came at 3.30 s and 2.01 s warm, and 3.43 s
      and 1.92 s cold. The first Changes at startup came at 16.9 s and 13.4 s
      warm, and 17.0 s and 13.8 s cold.
    - The core Serve peak RSS was 839 MiB and 941 MiB warm, and 853 MiB and
      942 MiB cold. Each arm ran at most four sidecars.
    - Each edit bundle of the change took 4.8 s to 5.0 s, against 2.0 s to
      2.4 s on `main`. Its native compile with capture took about 2.4 s,
      against about 0.8 s. A disk hit still took 0.9 s to 1.0 s of sidecar
      time for each side.
    - Each compile of this catalogue makes 13,227 `onResolve` calls, over
      4,638 inputs and 15,251 import edges. Without the capture, the
      JavaScript thread is busy for about 63% of the bundle.
  - Local measurements of 2026-11-18 used a `mokly-cloud` checkout at
    `194fdb789`, with 167 entries, 4,443 modules, and 4 vCPU. Each arm ran
    three fresh sidecar sessions in sequence, with timing wrappers. These are
    not interleaved product edit times.
    - The capture median was 2,546.864 ms before the change. It was
      713.348 ms with synchronous reads in the same queue, and 475.623 ms
      after the optional-probe trim.
    - Every run had 8,576 unique requests, one evidence hash, one module
      hash, the same four byte counters, and complete and durable evidence.
  - The performance orchestrator made these calls on 2026-11-18, under the
    user's delegation of 2026-11-16:
    - Apply D of this item in this pull request. Profile one real compile
      with `--cpu-prof`, then apply B, C, or both.
    - First measure synchronous file system calls inside the one existing
      queue, with `realpathSync.native` so that results match `fs/promises`
      `realpath`. Then trim the JavaScript work that the profile shows.
    - If the capture still costs more than 150 ms per real `mokly-cloud`
      compile, ask before a larger design.
    - The synchronous capture stayed above 150 ms. So root asked one question
      with its own letters: A, reduce repeated observations in the current
      design; B, evaluate bounded asynchronous capture workers; C, prepare
      another capture design. These letters are not the options of this
      item.
    - The orchestrator authorized that A, a form of B of this item. Share
      first-touch stat observations and cut repeated traversal. Keep the
      queue, the order, the bounds, and byte-identical evidence. Keep each cut
      only when its repeated median improves. The target is at most 150 ms of
      capture per real `mokly-cloud` compile.
    - If that A stays above 150 ms, evaluate one variant of that B. One
      dedicated `worker_threads` worker owns the one queue and the evidence,
      and runs the synchronous capture. Each `onResolve` awaits the reply for
      its own request, so the capture still finishes before esbuild reads the
      path. Every byte bound stays in the worker. Measure edit to Changes
      ready, not only the capture span.
    - Do not use asynchronous file system calls or the libuv pool again. This
      rules out the asynchronous pool of C of this item. The worker variant
      above keeps one owner and one order.
    - That C, a new capture design, needs the orchestrator's approval first.
      A proposal must also cover capture in Serve only for startup compiles
      and strict builds, a Rust recheck of the earlier evidence for each edit
      compile with no new disk entry, and the cost to warm restarts after
      edits.
    - No setting, gate, retry, or weaker assertion is added, and every goal
      below stays.
  - Since 2026-11-17, each Windows directory witness also adds one open, one
    stat, and one close at the first touch and again after the compile. That
    cost is not measured.
  - Every option must keep these goals:
    - The capture of an import finishes before its `onResolve` callback
      returns, so its witnesses and observations come before esbuild reads
      the same path. The barrier stays before the first observation.
    - One evidence owner serves every attempt of one `bundle()` call and
      finishes once.
    - Every byte bound stays. Duplicates merge before any queue. An exceeded
      bound clears `complete`. Completeness and the final evidence never
      depend on scheduling.
    - In-process reuse, the identities, and the rule that only complete and
      durable evidence reaches the disk stay as they are.
    - No public setting, gate, retry, elapsed-time test, or weaker assertion
      is added. Every existing test stays.
- **Problem:** Evidence capture runs the unique requests of a real compile
  one at a time, and esbuild waits for each capture in `onResolve`. On
  `examples/basic`, 1.2 s to 1.7 s of capture work ran while a compile was in
  flight, in each measured capture.
- **Impact if no action:** Each JavaScript edit in Serve, each cold start,
  and each start after a change keep the measured capture work on the path
  of their real compile: 1.4 s to 2.0 s for each capture on
  `examples/basic`. In the four JavaScript edit pairs recorded here,
  `watch.action` went from 4.543 s to 7.211 s, from 2.823 s to 5.418 s, from
  4.517 s to 5.054 s, and from 2.585 s to 4.282 s.
  No stable causal slowdown is proven. Warm restarts keep their gain,
  because they do not compile.
- **Root question:** How does a real compile record complete, coherent, and
  bounded reuse evidence in less time?
- **Options:**
  - **A.** Change nothing. Each real compile of `examples/basic` keeps 1.4 s
    to 2.0 s of measured capture work on its path. Effort: Small.
  - **B.** Cut the work of each request and keep the one queue. A profile
    names the repeated work, for example repeated configuration and manifest
    checks of one directory, or repeated ancestor walks of bare imports. The
    evidence stays equal byte for byte. It cannot overlap file system waits.
    Effort: Medium.
  - **C.** Run the unique requests through a bounded pool of workers, for
    example four, as `everyInput` does, in place of one chain. Duplicates
    still merge before the pool, and each `onResolve` still awaits its own
    capture. Byte charges stay exact, because JavaScript runs one callback at
    a time, and an exceeded bound still clears `complete`. It needs a test
    that the final evidence and its completeness do not depend on the order
    of the requests. It holds up to one 1 MiB metadata read for each worker
    at a time. Effort: Medium.
  - **D.** Measure, then apply B, C, or both. Profile the capture of a real
    compile, and repeat the JavaScript edit run for a median before any
    change. Apply C when the chain mostly waits on file system calls, and B
    when JavaScript work dominates. Keep each step only when a repeated
    median of the edit run improves and every goal holds. Effort: Medium.
  - **E.** Capture incrementally for a rebuild in the same process. Keep the
    observations of the previous complete compilation, check them again, and
    capture only new requests. An old observation is not a first touch in the
    new compile, so it needs a new witness and coherence design. Effort:
    Large.
- **Left out:**
  - An `onResolve` callback that does not await the capture. esbuild could
    then read a directory before its witness and its observation exist,
    which breaks the order that keeps stored evidence coherent.
  - A capture after the compile, from the metafile. A change during the
    compile could then reach complete evidence, as on `main` before the
    bundle disk cache change.
  - Unbounded concurrency over all requests. It breaks the memory bound of
    metadata reads and the number of open files.
  - A public setting for the concurrency or for turning capture off, and an
    elapsed-time gate. New settings and gates are out of this work.
  - Larger byte bounds. They change memory, not time.
- **Wider fix:** None. One owner, `PhysicalInputs.request`, holds the cost,
  so no class of call sites exists.
- **Previous examples:** The final checks of the same owner already run with
  four workers through `everyInput`. `plans/follow-ups/capture-batch-window.md`
  records a similar scheduling cost of fixed batches when Mokly captures
  rendered views.
- **Related:** `plans/follow-ups/in-process-resolution-coherence.md`, the
  same code: its recommended option adds ranking work at this capture
  boundary. A new capture schedule must keep that work possible, and the
  measurement of this item should include its cost.
- **Recommendation:** D. It keeps every goal, and it applies only the change
  that an independent repeated measurement supports. C may give the larger
  gain if the chain mostly waits on the file system, but nobody has measured
  that.
- **Action:** fix in this pull request, apply D. The performance orchestrator
  selected this outcome on 2026-11-18. The profile is recorded, and
  synchronous reads in the existing queue were measured. Next, apply the
  authorized choice A of 2026-11-18, with the target of at most 150 ms per
  real `mokly-cloud` compile. If A stays above 150 ms, evaluate the dedicated
  `worker_threads` variant, and measure edit to Changes ready. Do not use
  asynchronous file system calls or the libuv pool. Ask the orchestrator
  before any new capture design. Every goal above stays.
