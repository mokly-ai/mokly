# Head graph preparation slows large catalogue edits

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the branch
  `calummoore/mokly-comparison-proof-cost-mcnn`. The options check of its plan
  for cheaper proofs of reused Serve comparisons put this cost outside its
  scope.
- **Location:** `crates/mokly-graph/src/graph.rs:51` and line 68,
  `crates/mokly-graph/src/planning.rs:21`, line 36, line 64, and line 104,
  `crates/mokly-graph/src/planning_resources.rs:23`,
  `crates/mokly-graph/src/routing_records.rs:50`,
  `crates/mokly-cli/src/serve_services.rs:104`, and
  `crates/mokly-cli/src/serve_trace_stages.rs:14-18`.
- **Reason:** The branch that measured this cost changes only the proof work
  inside `review.compare-views`, and graph preparation ends before that span
  starts.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Graph preparation:** `Graph::prepare` in
    `crates/mokly-graph/src/graph.rs`. It builds one immutable render
    generation, with its stylesheet bundles and document plans, before any
    document renders. Its timing stage is `graph.prepare`.
  - **Timing records:** the JSON lines with the prefix `[mokly:timing] ` that
    `--debug-timings` writes to stderr. Each span end gives `stage`, `id`,
    `parentId`, and `durationMs` in whole milliseconds.
  - **Edit-to-Ready time:** the time from the file write of an edit until an
    observer reads the index body that shows Changes ready for that edit. The
    observer reads the index after each Serve event.
  - **Large HTML fixture:** the catalogue that `npm run fixture:large`
    generates, under `tests/fixtures/large/README.md`. Its defaults give 30
    areas, 40 screens, 12 rows, 4 stylesheets, 1,620 routes, and 5,850 views.
    It starts no sidecar.
  - **Performance orchestrator:** the coordinating agent of the Changes
    performance work. It holds the design decisions that the user gave it.
- **Background:**
  - Measurement setup, on 2026-11-18:
    - `main` at `bc4f4cc401f871e2fb3f4fd3be65f2d6533f524f`.
    - An optimized release binary from
      `cargo build --locked --release --package mokly-cli --bin mokly --target x86_64-unknown-linux-gnu`,
      with `CARGO_INCREMENTAL=0` and no profile or `RUSTFLAGS` override.
    - Linux x86_64, four CPUs, 8 GB of memory, and Node 24.22.1.
    - The default large HTML fixture, from
      `npm run fixture:large -- --variant html --root {fixture}`.
    - The command
      `mokly serve --config {fixture}/mokly.config.json --base {fixture setup commit} --port 0 --sidecars 2 --debug-timings`.
    - Three samples. Each sample is a new Serve process. It reaches the first
      Ready, then appends ` measurement` to the `<h1>` heading of
      `specs/area-1/screens/activity-group-1/screen-1.screen.html`. Then it
      restores the exact original bytes.
    - Persistent disk caches stayed. Each process started with empty memory
      caches.
    - Each sample records four `graph.prepare` spans, in this order: the
      first head generation, the first base generation, the edited head, and
      the restored head.
  - The edit cycle on the large HTML fixture, in milliseconds, for samples 1,
    2, and 3:
    - Edit-to-Ready time: 5,029.3, 4,194.6, and 4,305.0. The median is
      4,305.0.
    - `watch.action`: 2,177, 1,862, and 2,005. This span runs from the end of
      the watcher debounce to the publication of the new catalogue state.
    - `graph.prepare`, inside `watch.action`: 1,496, 1,235, and 1,446. The
      median is 1,446. This is 29% to 34% of each edit-to-Ready time.
    - `serve.background`: 158, 113, and 105.
    - `changes.classify`: 2,620, 2,154, and 2,122.
    - `review.compare-views`, inside `changes.classify`: 2,308, 1,907, and
      1,875. The median is 1,907.
    - Each edit-to-Ready time is `watch.action`, `serve.background`, and
      `changes.classify`, plus 66 to 74 ms outside these spans.
    - The other children of the edit's `watch.action` have these medians:
      `catalogue.validate` 288, `detail.build` 134 summed over its records,
      `index.build` 59, `catalogue.discover` 29, and `config.load` 2.
  - The split inside the edit's `graph.prepare`, in milliseconds, for samples
    1, 2, and 3:
    - `graph.prepare.documents`: 1,477, 1,209, and 1,424. It is 98% to 99% of
      `graph.prepare`.
    - `graph.prepare.resources`, inside `graph.prepare.documents`: 315, 230,
      and 299.
    - 1,501 `graph.prepare.routing-records` spans, inside
      `graph.prepare.documents`, sum to 43, 26, and 25. Each record gives
      whole milliseconds, so these sums are approximate.
    - The rest of `graph.prepare.documents` has no sub-stage: 1,119, 953, and
      1,100.
    - No `css.bundle` record falls inside the edit's `graph.prepare`. So the
      stylesheet cache served every stylesheet root of the edit.
  - The other preparations of the same processes, in milliseconds:
    - The first head generation bundled six stylesheet roots. It took 1,263,
      1,355, and 1,175.
    - The first base generation took 1,537, 1,569, and 1,495.
    - The restored head took 1,446, 1,323, and 1,249.
  - `examples/basic`, with 590 views and JavaScript entries, ran under the
    same setup. Its edit changes `specs/example/team/invite.screen.html`.
    - Its edit-to-Ready median is 830.9 ms.
    - Its edit `graph.prepare` took 69, 64, and 91 ms.
    - Its `review.compare-views` median is 116 ms.
  - The code, by reading only. Nobody timed these parts:
    - Each Serve preparation attempt reads its sources through a new
      read-once `SourceSnapshot`, at `crates/mokly-cli/src/serve_services.rs:104`.
    - `planning::documents` opens `graph.prepare.documents` at
      `crates/mokly-graph/src/planning.rs:21`. It first runs
      `Resources::prepare`, the `graph.prepare.resources` span.
    - Then it digests each entry source at line 36, resolves the component
      keys, and builds the plans of each entry at line 64.
    - For each view, at line 104, it matches stylesheet links, serializes the
      entry to JSON, and hashes the document key.
    - These loops run on the calling thread. The render workers serve only
      cancellation checks there.
  - Requirements that stay:
    - `documentKey` is the document node's key, the hash of its inputs, and
      exists before the render. Source: `docs/protocol/mokly-rendering.md`.
    - A watched change recomputes only the nodes whose keys moved. Source:
      the Render Graph section of `docs/architecture/rust-core.md`.
    - Stage names and counts are diagnostic details, not a stable public API.
      Source: `docs/protocol/mokly-timings.md`.
    - On 2026-11-16 the user asked to keep improving the speed and the
      reliability of Changes, and to merge in several pull requests without
      asking.
    - The same user decision forbids any change that can exhaust a machine's
      memory. The user gave the design decisions of this work to the
      performance orchestrator.
  - The branch that found this cost targets only `review.compare-views`, with
    a target median of 953.5 ms or less on the large HTML fixture. It does
    not change graph preparation.
- **Problem:** On the large HTML fixture, each edit spends a median of
  1,446 ms in head graph preparation. About 1.1 s of that time has no
  sub-stage, so the timing records do not show which work costs most.
- **Impact if no action:** Each edit of the large HTML fixture keeps 1.2 to
  1.5 s of preparation before Serve can publish. When the comparison gets
  faster, this preparation becomes a larger part of each edit.
- **Root question:** How can Serve finish the head graph preparation of an
  edit sooner, with the same plans, keys, warnings, and errors?
- **Options:**
  - **A.** Change nothing. Large edits keep about 1.4 s of preparation.
    Effort: Small.
  - **B.** Profile first, in a later branch. Add a temporary probe that times
    the parts of `planning::documents`: the entry source digests, the
    component keys, the routing keys, the stylesheet links, the entry JSON,
    and the key hashes. Run three edit samples with release builds on the
    large HTML fixture and on `examples/basic`. Also run the fixture at two
    smaller sizes, to show how each part grows. Keep the probe and its results
    out of the repository, and add no test. Then record the split in this
    item, and recommend the option for the largest measured part. Cost: one
    measurement and no product change. Effort: Medium.
  - **C.** Add permanent sub-stages for the main parts of
    `graph.prepare.documents`, and allow them in
    `crates/mokly-cli/src/serve_trace_stages.rs`. Every `--debug-timings` run
    then shows the split. Cost: more timing records for each preparation. The
    timings contract needs no change, because stage names are diagnostic
    details. Effort: Small.
  - **D.** Keep the plan work of unchanged entries between generations. A
    store with a fixed byte bound keeps the inputs and the plans of each
    entry. A new generation then recomputes only the entries whose inputs
    changed. Cost: a new store across generations, and exact invalidation. A
    missed input would publish a stale document key. Effort: Large.
  - **E.** Run the planning loops of `planning::documents` on the render
    workers, and keep the plan order and the first error. Cost: preparation
    then competes with foreground renders, and the result merge must stay
    deterministic. It helps only when the split shows CPU-bound work. Effort:
    Medium.
- **Left out:**
  - Skip graph preparation, or keep the old generation, after an edit. The
    edit changes document keys and the generation key, so it breaks the
    rendering contract.
  - Publish before preparation ends. The index and the details come from the
    new generation, so they cannot come first.
  - Keep stylesheet bundles across restarts. The measured edit preparation
    bundled no stylesheet, so this does not reduce the cost.
  - More render workers or a faster machine. This does not reduce the work of
    one preparation.
  - Changes to `catalogue.validate` or to the other children of
    `watch.action`. They are separate phases, and each needs its own measured
    item.
- **Assumptions:**
  - Preparation output stays equal: plans, document keys, the generation key,
    warnings, and errors. Source: the rendering contract and the architecture
    page. Every option keeps it.
  - A store that lives across generations has a fixed byte bound. Source: the
    user decision of 2026-11-16. D must meet it.
  - One machine and one fixture shape show the cost. Source: the measurement
    of 2026-11-18. B checks smaller sizes and `examples/basic`.
- **Wider fix:** D. It removes repeated work for unchanged entries, whichever
  part of preparation costs most. It needs a bounded store and exact
  invalidation.
- **Previous examples:**
  - On 2026-11-18 the work on cheaper comparison proofs ran a one-time timing
    split before it chose an option. The split showed that one part, the link
    checks, took 88.1% of the measured proof work.
  - `stylesheet-cache-across-restarts.md` records a startup split of
    2026-10-30. There, 35 stylesheet bundles took 0.88 s of a 1.14 s
    `graph.prepare`. That split covered startup, not edits.
- **Related:**
  - [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md):
    it owns stylesheet work after a restart. The measured edit preparation
    bundled no stylesheet, so that item does not own this cost.
  - [stylesheet-roots-span-parent.md](./stylesheet-roots-span-parent.md): the
    `graph.prepare.stylesheet-roots` stage runs outside `graph.prepare`. In
    the `examples/basic` edits it is a child of `watch.action`. A split must
    not count it inside `graph.prepare`.
  - [macos-serve-timing.md](./macos-serve-timing.md): it reads the same timing
    records on macOS. Its stage list can add the sub-stages of B or C.
- **Recommendation:** B. No option is clearly best until a split names the
  work inside `graph.prepare.documents`, and B names it without a product
  change. D best protects the codebase, at Large effort.
- **Action:** fix after merge, apply B, because the cost lies outside the
  comparison work of the branch that measured it, and the split must come
  before a choice among C, D, and E.
