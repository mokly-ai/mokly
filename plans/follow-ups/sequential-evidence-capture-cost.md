# Captured cold compiles stay slower than main

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from the Milestone 5 measurement of the bundle disk
  cache change, on branch `calummoore/lisbon-h906`. On 2026-11-18 the
  performance orchestrator accepted that change, PR #312, with an explicit
  cold exception. This item then changed from the capture work of that pull
  request to the cold cost that remains.
- **Location:** `packages/mokly/src/sidecar/physical-inputs.ts:41` to line
  70, `packages/mokly/src/sidecar/physical-inputs.ts:215` to line 227,
  `packages/mokly/src/sidecar/bundle-recipe.ts:129`,
  `packages/mokly/src/sidecar/resolution-evidence.ts:57` to line 58,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs:111` to line 123, and
  `crates/mokly-sidecar/src/pool_requests.rs:144` to line 145.
- **Reason:** The orchestrator accepted the cold cost for PR #312, and work
  after the bundle result needs new lifecycle, cancellation, error, and
  identity rules.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Reuse evidence:** the record of each file, directory list, absent path,
    and link that decides which file each import of a compiled bundle
    selects.
  - **Captured compile:** a `bundle` request in the `full` capture mode that
    runs esbuild. Since 2026-11-18, these are the head compiles of Serve
    before it publishes its first state, each base side compile, and each
    compile of `build` and `publish`. A later head compile of Serve uses the
    `serveEdit` mode and captures nothing.
  - **Capture request:** one unique pair of an import specifier and its
    importing directory. The sidecar captures its reuse evidence before
    esbuild resolves the import.
  - **In-compile capture:** the capture requests that run while esbuild
    compiles.
  - **Physical finish check:** the read of every recorded input again after
    the last compile attempt. A difference makes the evidence incomplete.
  - **Witness:** a stat record of one directory or metadata file, kept from
    the first touch until after the compile. The witnesses decide whether the
    bundle cache may store the compilation.
  - **Barrier:** one wait of at most 50 ms before the first observation of a
    captured compile, when a recent change could otherwise fail the
    witnesses.
  - **Recipe save:** the offer of a served compilation to the bundle store,
    after a successful `bundle` request.
  - **Critical path:** the work from a core `bundle` request to its result.
- **Background:**
  - The sidecar compiles the catalogue JavaScript with esbuild in `bundle()`,
    in `packages/mokly/src/sidecar/bundle.ts`. In a captured compile, one
    evidence owner, `ResolutionEvidence`, serves the native and the planned
    attempts of one call, and it finishes once after the last attempt.
  - The esbuild plugin `mokly-reuse-evidence` awaits `record()` in its
    `onResolve` callback, at
    `packages/mokly/src/sidecar/resolution-evidence.ts:57` to line 58. So the
    observations and the witnesses of a path exist before esbuild resolves
    the import that reads that path. This order keeps stored evidence
    coherent with the files that esbuild selected.
  - `PhysicalInputs.request` at
    `packages/mokly/src/sidecar/physical-inputs.ts:41` merges duplicate
    requests by specifier and directory before any queue. It charges each key
    to an 8 MiB bound. Lines 59 to 68 chain each new unique request on one
    `pending` promise, so unique requests run one at a time, and each
    `onResolve` call waits for every earlier request. Since 2026-11-18, each
    request reads the file system with synchronous calls inside that queue.
  - On 2026-11-16, the bundle disk cache change chose this queue in place of
    a schedule-dependent count of requests in flight. Completeness and the
    byte bounds then never depend on scheduling. The test "duplicate
    resolution requests keep complete evidence without depending on queue
    scheduling", in `tests/sidecar_reuse_capture.test.ts:149`, records 5,000
    duplicate requests and requires complete evidence.
  - The same owner keeps four bounds of 8 MiB each: retained observations,
    parsed metadata, visited paths, and request keys. The witnesses share the
    visited-path bound, and the barrier preflight counts its own paths
    against the same 8 MiB limit. Each metadata file is bounded at 1 MiB. An
    exceeded evidence bound clears `complete`. An exceeded witness or
    preflight bound clears only `durable`.
  - After the last attempt, `PhysicalInputs.finish`, at
    `packages/mokly/src/sidecar/physical-inputs.ts:215` to line 227, waits for
    the queue. It runs the physical finish check at line 224, and it finishes
    the witnesses at line 225. The check reads with synchronous calls, in
    `current` at `packages/mokly/src/sidecar/physical-input-reader.ts:192`.
    `bundleRecipe` awaits the finish at
    `packages/mokly/src/sidecar/bundle-recipe.ts:129`. Then it computes the
    identity, which depends on completeness at line 144, and the sidecar
    returns the result.
  - In the pool, `complete_bundle` makes the recipe save of a `full` request
    at `crates/mokly-sidecar/src/pool_bundle_cache.rs:111` to line 123.
    `crates/mokly-sidecar/src/pool_requests.rs:144` to line 145 runs it
    before the request returns. So the in-compile capture, the physical
    finish check, and the save are all on the critical path of a captured
    compile.
  - Capture runs only for a captured compile. A warm restart reuses a memory
    or disk compilation, so it captures nothing.
  - History in PR #312, from 2026-11-17 to 2026-11-18:
    - At first, the capture chained asynchronous file system calls in the
      same queue. On `examples/basic`, each measured capture took 1.4 s to
      2.0 s, and 1.2 s to 1.7 s of that work ran while a compile was in
      flight.
    - On 2026-11-18 the orchestrator measured `mokly-cloud` with the change
      at `e253021fb` against `main` at `bc4f4cc40`, on 4 vCPU, with pool size
      4 and `--base HEAD`. Each edit bundle took 4.8 s to 5.0 s, against
      2.0 s to 2.4 s on `main`. Its native compile with capture took about
      2.4 s, against about 0.8 s. The cold strict build, after the bundle
      cache was removed, took 24.0 s, against 18.1 s. Each compile of this
      catalogue makes 13,227 `onResolve` calls, over 4,638 inputs and 15,251
      import edges. Without the capture, the JavaScript thread is busy for
      about 63% of the bundle.
    - The orchestrator then moved option D of this item into PR #312: measure,
      then cut the work of each request or run the requests in a bounded
      pool. That D is not an option of this updated item. The capture moved
      to synchronous reads inside the one queue, with `realpathSync.native`.
      Optional probes and repeated observations were cut.
    - Three-run local medians on a `mokly-cloud` checkout at `194fdb789`,
      with 167 entries, 4,443 modules, and 8,576 unique capture requests: the
      capture took 2,546.864 ms before these changes, 713.348 ms with
      synchronous reads, 475.623 ms after the optional-probe trim, and
      355.864 ms after first-touch kinds were shared. In the last set, the
      observation took 239.786 ms, the physical finish check 117.605 ms, and
      the witness finish 1.231 ms. Every set kept the same evidence and module
      hashes, and complete and durable evidence.
    - A dedicated `worker_threads` worker that owned the queue was also
      measured. In one local product edit matrix of 2026-11-18, the mean edit
      to delivered Changes was 4,067.588 ms on `main`, 5,038.830 ms with the
      synchronous capture, and 5,641.939 ms with the worker. The orchestrator
      dropped the worker. It also forbade asynchronous file system calls and
      the libuv pool for the capture.
    - On 2026-11-18 the orchestrator chose C1 for Serve edits: a Serve edit
      compile captures nothing and stores nothing. Startup compiles and
      strict builds keep capture and storage.
  - The orchestrator's final check of 2026-11-18 compared the change at
    `d9561ad63` with `main` at `24b238ca4` on `mokly-cloud`. The runs were
    interleaved. Each arm used a release core with its own sidecar dist, on
    4 vCPU, with pool size 4 and `--base HEAD`. Each warm and each cold run
    did a strict build, then a Serve start with three JavaScript edits, then
    a restart with the edits kept. A cold run removed the cache before its
    strict build. A fully cold run removed the cache before a Serve start
    with no strict build. The values for `main` and then the change:
    - Edit to Changes ready, over all 15 JavaScript edits of each arm: 4.18 s
      and 4.21 s on average.
    - Warm: `serve.ready` 3.05 s and 1.87 s, the first Changes 15.6 s and
      13.2 s, and the strict build 17.3 s and 16.3 s.
    - Restart with the edits kept: `serve.ready` 2.91 s and 3.82 s, and the
      first Changes 15.2 s and 14.7 s.
    - Fully cold Serve, three rounds: `serve.ready` 3.26 s and 3.73 s, 0.47 s
      later, and the first Changes 16.2 s and 17.0 s, 5.1% later as reported.
    - Cold strict build, six rounds: 17.04 s and 18.28 s, 7.3% longer as
      reported, about 0.6 s for each captured side.
    - Warm peak memory: 3,065 MiB and 3,074 MiB for the whole process tree,
      and 870 MiB and 874 MiB for the core. Each arm ran at most four
      sidecars.
  - On 2026-11-18 the orchestrator accepted the change with an explicit cold
    exception. Its reasons: the edits were equal, the warm starts gained, the
    first Changes after a restart with kept edits came 0.5 s earlier, the
    memory was equal, and the change is the base for plan reuse.
  - `plans/follow-ups/bundle-cache-request-cost.md` holds the cost of the
    save path. Its one-time probes measured 23.400 to 122.441 ms for a first
    write into a new store root. Its product timing records estimated about
    94 ms for one save, about 1 to 7 percent of a compiling request.
  - Since 2026-11-17, each Windows directory witness also adds one open, one
    stat, and one close at the first touch and again after the compile. That
    cost is not measured.
  - Every option must keep these goals:
    - The capture of an import finishes before its `onResolve` callback
      returns, so its witnesses and observations come before esbuild reads
      the same path. The barrier stays before the first observation.
    - One evidence owner serves every attempt of one `bundle()` call and
      finishes once.
    - Every byte bound stays exact. Duplicates merge before any queue. An
      exceeded bound clears `complete`. Completeness and the final evidence
      never depend on scheduling.
    - Only complete and durable evidence reaches the disk. In-process reuse
      keeps its rules. A complete compilation keeps a deterministic identity,
      and an incomplete compilation gets a fresh identity.
    - Each step keeps one owner for its lifecycle, its cancellation, and its
      errors. Work after the bundle result belongs to the pool. A stop, a
      cancellation, or an abort ends it, and nothing runs after the pool
      stops. Its failures change no bundle result.
    - The capture decisions of 2026-11-18 stay: a Serve edit compile captures
      nothing, and startup compiles and strict builds keep capture and
      storage.
    - No public setting, gate, retry, elapsed-time test, or weaker assertion
      is added. Every existing test stays.
- **Problem:** A captured compile keeps its in-compile capture, its physical
  finish check, and its recipe save on the critical path. In the final check,
  the cold strict build took 7.3% longer than on `main`, as reported, about
  0.6 s for each captured side. A fully cold Serve start reached
  `serve.ready` 0.47 s later, and its first Changes came 5.1% later, as
  reported.
- **Impact if no action:** Each cold strict build and each fully cold Serve
  start keeps about 0.6 s for each captured side. A hosted CI runner that
  starts with an empty cache directory runs each `build` and `publish` cold.
  Both commands use the `full` capture mode, so each run pays the capture
  cost, and the runner then loses the new entries. No CI guide keeps the
  cache directory of the operating system between runs. So such a runner
  can pay the cold cost on every run. A restart with kept edits reached
  `serve.ready` 0.91 s after `main` in the final check. Its head compiles
  with capture, which C1 accepts. Edits and warm starts keep their results,
  because edits capture nothing and warm starts do not compile.
- **Root question:** How does a captured compile return its bundle result
  about as fast as a compile without capture, while the bundle cache still
  gets complete, coherent, bounded, and stable evidence?
- **Options:**
  - **A.** Change nothing. The accepted cold exception stays, about 0.6 s for
    each captured side in the final check. Effort: Small.
  - **B.** Trim the in-compile capture further. Profile a captured compile,
    and cut the repeated or optional work that the profile names. Keep the
    evidence equal byte for byte, and keep the physical finish check and the
    save on the critical path. In the last local medians, the physical
    finish check alone took 117.605 ms of the 355.864 ms of capture, so B
    cannot remove it. Effort: Medium.
  - **C.** Keep only the in-compile capture on the critical path, with the
    trims of B where a profile shows a gain. Move the physical finish check
    and the recipe save after the bundle result:
    - One owner finishes the evidence after the result. C must define the
      state of a compilation whose check has not ended, for reuse, for
      storage, and for its identity.
    - The identity depends on completeness today, at
      `packages/mokly/src/sidecar/bundle-recipe.ts:144`. C must keep the rule
      that an incomplete compilation gets a fresh identity, or record a new
      identity rule first.
    - The save waits for the finished check. It uses the writer of option E
      of `plans/follow-ups/bundle-cache-request-cost.md`, so this item
      designs no second writer.
    - The work after the result belongs to the pool. A stop, a cancellation,
      or an abort ends it, and its failures change no bundle result.
    - A save after the response changes the `catalogue.bundle` span and the
      save warnings of the decision of 2026-11-16. That decision blocks
      option E of the request-cost item, so a recorded decision must come
      first.
    - A one-shot `build` or `publish` must still finish or drop the save
      before it exits. So C shortens its wall time only by the overlap of
      that work with the rest of the command. For the first Changes of
      Serve, the move can recover the cost. A measurement of C also
      measures the wall time of the command.
    - Effort: Large.
- **Left out:**
  - An `onResolve` callback that does not await the capture. esbuild could
    then read a directory before its witness and its observation exist,
    which breaks the order that keeps stored evidence coherent.
  - A capture after the compile, from the metafile. A change during the
    compile could then reach complete evidence, as on `main` before the
    bundle disk cache change.
  - Unbounded concurrency over all requests. It breaks the memory bound of
    metadata reads and the number of open files.
  - Asynchronous file system calls, the libuv pool, and the dedicated
    worker. On 2026-11-18 the orchestrator forbade the first two for the
    capture, and it dropped the worker after it measured slower edits. This
    also rules out a bounded pool of asynchronous capture requests.
  - No capture for startup compiles or strict builds. C1 of 2026-11-18 keeps
    their capture and storage, which give the warm starts.
  - Incremental capture from earlier evidence. A cold compile has no earlier
    capture in its process. A restart with kept edits is the subject of
    `plans/follow-ups/serve-pause-warm-head.md`.
  - Moving only the save. It is option E of
    `plans/follow-ups/bundle-cache-request-cost.md`, and C includes it.
    Alone, it leaves the physical finish check on the critical path.
  - A public setting for the concurrency or for turning capture off, and an
    elapsed-time gate. New settings and gates are out of this work.
  - Larger byte bounds. They change memory, not time.
- **Wider fix:** C. One owner then holds the evidence work after the compile
  and the save, so a later check or store step cannot lengthen the critical
  path.
- **Previous examples:**
  - C1 of 2026-11-18 removed the capture from each Serve edit compile.
  - The reuse check of the sidecar checks consumed file digests and
    directory lists with four workers through `everyInput`, at
    `packages/mokly/src/sidecar/file-digests.ts:52`.
  - `plans/follow-ups/capture-batch-window.md` records a similar scheduling
    cost of fixed batches when Mokly captures rendered views.
- **Related:**
  - `plans/follow-ups/serve-plan-record-start-cost.md`, the same code: a
    captured compile also counts, returns, and stores its plan. One profile
    can separate that cost from evidence capture.
  - `plans/follow-ups/in-process-resolution-coherence.md`, the same code: its
    recommended option adds ranking work at this capture boundary. A new
    capture schedule must keep that work possible, and the measurement of
    this item should include its cost.
  - `plans/follow-ups/bundle-cache-request-cost.md`, a shared wider fix: its
    option E moves the save out of the bundle response, and C here needs
    that move. Apply them together. That item keeps the profile, the copies,
    and the flush of the save path, and this item does not repeat them.
  - `plans/follow-ups/serve-pause-warm-head.md`, the same code: each pause
    compile of its option B is a captured compile, and a restart with kept
    edits compiles the head with capture. C here shortens both.
- **Recommendation:** C, with the trims of B where a profile shows a gain.
  The performance orchestrator gave this direction on 2026-11-18. B alone
  cannot remove the physical finish check or the save, and A keeps the cold
  cost.
- **Action:** fix after merge, apply C, because the orchestrator accepted the
  cold cost for PR #312 and gave this direction for the work after it.
  Record a decision first where C changes the identity rule or the
  `catalogue.bundle` span rule of 2026-11-16.
