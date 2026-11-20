# Keep or probe the copies after Serve preparation

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-19, from branch `calummoore/mokly-publish-path`, at the
  decision of the performance orchestrator, which owns this item.
- **Location:** `crates/mokly-cli/src/serve.rs` (`CatalogueServe::prepare`,
  the `prepared.clone()` that it passes to `graph.prepare`) and
  `crates/mokly-cli/src/serve_state.rs` (`NativeServeState::project`, the
  copies `(*snapshot).clone()` and `(*snapshot.generation).clone()`).
- **Reason:** The measured slowdown has no proven cause, so a change of these
  copies needs its own probe and measurement.

- **Category:** Performance.
- **Terms:**
  - **Startup usage pass:** the first `serve.background` pass of Serve, which
    renders every view after the first publication.
- **Background:**
  - Each Serve preparation copies the prepared catalogue before
    `graph.prepare` and then drops the original. Each projection copies the
    projected snapshot and its generation, then drops the projected values.
    Neither copy changes output.
  - Branch `calummoore/mokly-publish-path` removed both copies in commit
    `f9388f441`, because they cost time between the end of `graph.prepare`
    and the publication: 2.9 ms on `examples/basic` (1.9 ms to copy and drop
    the projected snapshot, 1.0 ms to drop the catalogue copy) and 16.2 ms on
    the large React fixture of `scripts/large/` (5,850 documents: 11.1 and
    2.4 ms for the snapshot, 2.7 ms for the catalogue), means of release
    builds on 4 vCPU on 2026-11-19. The copy of the catalogue itself runs
    before `graph.prepare`, and no run measured it. Commit `10487c8cc`
    restored both copies.
  - Without the copies, the startup usage pass of the large React fixture
    took 2.4 s longer, about 4.7%, in 5 of 6 interleaved rounds: 53.6 s
    against 51.1 s with the copies, and 51.6 s on `main`.
  - On mokly-cloud, the same commit gave the first Changes result 0.53 s
    later than `main`, later in 10 of 12 pairs, with a startup usage pass
    about 0.3 s to 0.5 s longer.
  - The work counts were identical: the same numbers of rendered documents,
    fragments, sidecar renders, cache hits, misses, and evictions, and
    process recycles. The time rose in the core render spans and in the
    sidecar render spans alike.
  - The large HTML fixture and `examples/basic` showed no difference.
  - The cause is not proven. The best guess is a memory layout effect: the
    copies give the render generation and the first snapshot freshly
    allocated, compact data, which the renders of JavaScript entries then
    read.
  - On 2026-11-19 the performance orchestrator chose to keep both copies.
- **Task:**
  1. Do not remove either copy without a new startup measurement of a large
     JavaScript catalogue.
  2. Probe whether a deliberate compact copy speeds up the renders, for
     example a copy of other prepared data after preparation, and find the
     data that the renders read.
  3. Measure the startup usage pass and the first Changes result against
     `main` on the large React fixture and on mokly-cloud.
- **Impact if no action:** A later change can remove a copy again and slow the
  startup usage pass of JavaScript catalogues without a visible reason.
- **Needs:** The mokly-cloud measurement of the performance orchestrator.
- **Done when:** A measurement shows whether a compact copy changes the
  startup usage pass, and this item records the result or the change merges.
