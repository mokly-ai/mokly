# Sequential evidence capture slows each real compile

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from the Milestone 5 measurement of the bundle disk
  cache change, on branch `calummoore/lisbon-h906`.
- **Location:** `packages/mokly/src/sidecar/physical-inputs.ts:45` to line
  78, and `packages/mokly/src/sidecar/resolution-evidence.ts:57` to line 58.
- **Reason:** A change of the capture needs an independent repeated
  measurement first, and the accepted warm-restart and strict-output results
  do not depend on it.

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
  `examples/basic`. In the three pairs recorded here, `watch.action` went
  from 4.543 s to 7.211 s, from 2.823 s to 5.418 s, and from 4.517 s to
  5.054 s.
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
- **Action:** fix after merge, apply D, because the gain needs an independent
  repeated measurement first, and the accepted zero-warm-compile and
  strict-output results do not depend on it.
