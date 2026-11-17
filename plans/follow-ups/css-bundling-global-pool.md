# Off-pool CSS bundling starts the global Rayon pool

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-17, from the options check of the parallel render input
  keys plan, on branch `calummoore/mokly-parallel-render-keys-6m85`.
- **Location:** `crates/mokly-css/src/delivery.rs:41`,
  `crates/mokly-cli/src/serial_stylesheets.rs:19`,
  `crates/mokly-render/src/bundle.rs:240` and line 255,
  `crates/mokly-graph/src/evaluation.rs:33`, and `src/bundler.rs:476` of the
  `lightningcss` 1.0.0-alpha.72 dependency.
- **Reason:** Nobody measured the effect, and the branch that found it changes
  only render input key scheduling, so the measurement is a separate task.

- **Terms:**
  - **Render pool:** `ThreadWorkers` in `crates/mokly-graph/src/workers.rs`,
    the dedicated Rayon pool of the core for render, preparation, and
    comparison jobs.
  - **Global Rayon pool:** the process-wide Rayon pool. A parallel iterator
    uses it when its thread belongs to no pool.
  - **Base root:** a stylesheet root of the historical catalogue version that
    Serve's Changes prepares beside the live catalogue.
  - **Admission gate:** the Serve sidecar admission in
    `crates/mokly-cli/src/serve_pool.rs`. It serves foreground requests before
    queued base work.
  - **Stylesheet root:** one stylesheet bundle that Mokly compiles and
    delivers, a `StylesheetRoot` in `crates/mokly-css/src/types.rs`.
- **Background:**
  - The CLI sizes the render pool with `std::thread::available_parallelism()`,
    at `crates/mokly-cli/src/render_runtime.rs:88`. The doc comment of
    `ThreadWorkers` says that the pool is independent of global Rayon
    settings.
  - `bundle` in `crates/mokly-css/src/delivery.rs:41` creates a `lightningcss`
    `Bundler` and runs it on the calling thread. Its source provider reads
    only an in-memory map of prepared sources. So the bundle step reads no
    file and makes no sidecar call.
  - `lightningcss` 1.0.0-alpha.72 loads the imports of each stylesheet in
    parallel. Its `src/bundler.rs:476` calls `par_iter_mut` over the rules of
    the stylesheet. Its `bundler` feature enables `rayon`, and
    `crates/mokly-css/Cargo.toml:16` enables that feature.
  - `Cargo.lock` holds one `rayon` 1.12.0 and one `rayon-core` 1.13.0. Only
    `lightningcss` and `mokly-graph` depend on `rayon`. So `lightningcss` and
    the render pool use the same Rayon runtime.
  - A Rayon parallel iterator runs on the pool of its current worker thread.
    On a thread outside every pool, it runs on the global Rayon pool.
    `rayon-core` 1.13.0 creates that pool on first use, with
    `RAYON_NUM_THREADS` threads or one thread for each logical CPU. The pool
    stays until the process exits.
  - `ThreadWorkers::new` gives the render pool an explicit thread count. So
    `RAYON_NUM_THREADS` changes only the global Rayon pool.
  - Graph preparation bundles stylesheet roots through
    `RenderWorkers::stylesheets`, at `crates/mokly-graph/src/graph.rs:123`.
    `ThreadWorkers::stylesheets` runs each root inside the render pool. So the
    parallel import loads of `lightningcss` stay on that pool.
  - `SerialStylesheets` in `crates/mokly-cli/src/serial_stylesheets.rs:19`
    wraps the render workers for Serve's background base work, at
    `crates/mokly-cli/src/serve_changes_native.rs:175`. It does not override
    `stylesheets`, so the trait default bundles each base root on the calling
    thread.
  - That choice prevents a deadlock. A base root can wait at the admission
    gate while a foreground render holds a sidecar lease. On the shared render
    pool, enough waiting base roots would hold every worker that the
    foreground render needs. The first review of PR #228 found this deadlock
    on 2026-10-28, with the severity High.
  - The bundle step runs only after its source map is complete. So a base
    root waits at the admission gate, if at all, before the bundle step
    starts.
  - Each base root that `lightningcss` bundles therefore runs its parallel
    import loads on the global Rayon pool, beside the render pool and the
    sidecar processes.
  - Two more call sites call the stylesheet compiler directly, outside
    `RenderWorkers::stylesheets`. `class_maps` calls it at
    `crates/mokly-render/src/bundle.rs:240` and line 255, and `describe`
    calls `class_maps`. Stylesheet resource evaluation calls it at
    `crates/mokly-graph/src/evaluation.rs:33`.
  - Nobody checked which threads run these two call sites. On a thread
    outside every pool, they also use the global Rayon pool.
  - No run measured the effect. The threads of the global pool are idle
    between bundles. During a bundle, they compete for CPU with the render
    workers and the sidecars. Nobody measured their memory either.
  - Any later fix must keep two constraints. No base root may wait at the
    admission gate on a worker that foreground renders need. The core must
    bound its runnable threads and its memory.
  - Candidate directions for a later decision. None of them is chosen:
    - Change nothing. By default, the global pool keeps one thread for each
      logical CPU.
    - Split each off-pool root job. Keep the source preparation, which can
      wait at the admission gate, on the caller. Run the pure `lightningcss`
      bundle step on the render pool. That step makes no sidecar call, so it
      cannot hold a worker at the gate. This needs a split between
      preparation and bundling in `mokly-css`, and a change at each off-pool
      call site.
    - Build the global Rayon pool once at process start, with a small fixed
      size such as one thread. The second pool stays. The call must run
      before any Rayon use, and the setting applies to every dependency in
      the process.
    - Run base stylesheet bundling on the separate background base pool that
      `plans/follow-ups/background-base-render-pool.md` proposes. That pool
      adds its own bounded thread set, and it leaves the two direct call
      sites unchanged.
    - Use one Rayon pool for all CPU work of the core. Build the global pool
      at process start with the size of the render pool, and let
      `ThreadWorkers` run on it. This bounds every Rayon user. Tests then
      cannot create render pools of different sizes in one process, and the
      render pool loses its independence from global Rayon settings.
  - The options check of 2026-11-17 rated two more directions weaker. A fork
    of `lightningcss` that loads imports in sequence also removes the
    parallel loads on the render pool. An import flattener of Mokly's own
    costs much more for the same bound.
  - A return of base roots to the shared render pool breaks the deadlock
    constraint above.
- **Task:**
  1. On a machine with 4 vCPUs, run a release build of Serve with Changes on
     a catalogue whose base side bundles stylesheet roots. The HTML and React
     fixtures from `scripts/large/` are examples.
  2. Run it once with the default settings and once with
     `RAYON_NUM_THREADS=1`. The second run bounds only the global Rayon pool.
  3. In each run, record the `--debug-timings` records, the thread count of
     the core process, and its peak resident size. Note whether the thread
     count rises when base stylesheet roots bundle.
  4. Compare the `changes.classify` durations, the `render.document`
     durations that overlap base bundling, and the peak resident sizes of the
     two runs.
  5. Find from the call chain which threads run the bundles of `class_maps`
     and of stylesheet resource evaluation.
  6. If the default run is slower or uses more memory beyond run-to-run
     noise, write a decision from the candidate directions. Run the options
     check of the `implementation-review` skill over it before any code
     change.
  7. Apply the decision test of the `decisions-and-findings` skill to any
     change of pool behaviour.
- **Impact if no action:** Nobody learns whether off-pool bundles slow Serve
  or raise its peak memory on small machines. A later pool change would then
  rest on a guess.
- **Needs:** A machine with 4 vCPUs and a release build of Mokly. The task
  needs no deployed change and no credentials.
- **Done when:** One recorded measurement on 4 vCPUs compares the two runs.
  With no harm, a branch deletes this item and gives the numbers in its
  commit message. With harm, a decision with its options check replaces this
  item.
- **Related:** `plans/follow-ups/background-base-render-pool.md` gives Serve's
  background base work its own render pool. Both items come from the same
  admission gate. One candidate direction depends on that item, and its pool
  would also hold the base bundle loads.
