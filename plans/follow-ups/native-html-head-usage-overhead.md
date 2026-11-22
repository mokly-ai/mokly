# Native HTML head usage keeps unattributed overhead

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from branch `calummoore/mokly-first-changes-4-busier-sidecars-3nds`, step 4 of the first-Changes series, after the performance orchestrator accepted this cost as a trade-off.
- **Location:** the start and the lookup of every view: `crates/mokly-server/src/background.rs:79` (`UsagePass::fill_window`), `crates/mokly-server/src/work_background.rs:82` (`Workers::background_render`), `crates/mokly-server/src/background_read.rs:75` and line 61 (`GraphDocuments::read_background` and `BackgroundMiss::complete`), `crates/mokly-server/src/background_admission.rs:26` (`Admission::acquire`), `crates/mokly-server/src/background_batch.rs:69` (`Window::start_dispatched`), `crates/mokly-graph/src/background_render.rs:23` and line 120 (`Session::read_background_document` and the private miss's `finish`), `crates/mokly-graph/src/session_lookup.rs:20` and line 48 (`Session::raw_lookup` and `Session::compose_miss`), and `crates/mokly-graph/src/workers.rs:178` and line 215 (`ThreadWorkers::background` and `ThreadWorkers::document`). The native document steps: `crates/mokly-graph/src/session_render.rs:47` (`Session::finish_artifact`), `crates/mokly-graph/src/validation.rs:69`, `crates/mokly-html/src/composition.rs:130`, `crates/mokly-html/src/compose_start.rs:35`, `crates/mokly-html/src/source_locations.rs:10`, `crates/mokly-html/src/source_checks.rs:40` and line 125, `crates/mokly-html/src/normalization.rs:51`, and `crates/mokly-catalogue/src/html_driver_events.rs:70`.
- **Reason:** On 2026-11-20 the performance orchestrator accepted this cost for the measured Cloud and React gains, after a time-boxed profile investigation found no Small change that owns most of it.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Head usage pass:** the background pass after Serve readiness that renders every current view, records usage, and fills the render cache. Its timing stage is `serve.background`.
  - **First Changes:** the time from the Serve start until the browser shows ready Changes for the first time. Base capture and comparison run after the head usage pass and before that moment.
  - **Large HTML fixture:** the catalogue of `npm run fixture:large -- --variant html`, described in `tests/fixtures/large/README.md`. Its defaults give 1,620 entries, 5,850 documents, and 5,760 usage views. It starts no sidecar.
  - **Handoff:** a JavaScript view without saved slots releases its worker once its own root succeeds and its charge fits the 4 MiB budget. It then finishes in a bounded completion stage. A view whose charge does not fit keeps its worker.
  - **Performance orchestrator:** the coordinating agent of the Changes performance work. It holds the design decisions that the user gave it.
- **Background:**

  - Step 4 makes the head usage pass of JavaScript catalogues finish sooner. It adds the handoff, one token stream for fragment parsing and source checks, and one parse5 tree per Node render. `docs/protocol/mokly-on-demand-background.md` holds the rules of the background pass.
  - A native HTML view has an HTML template, so it never hands off. At the frozen candidate `969133546`, `UsagePass::fill_window` chose the path of each view before the view started. `Start::eligible` decided from immutable metadata. It read no cache, did no IO, and prepared no root.
  - At that candidate, a view that could not hand off took main's ordinary path: `Window::start`, `Work::background`, and `RenderGeneration::render`, with no `Stage`. `ThreadWorkers::document` ran it on the dedicated Rayon render pool.
  - There `Session::artifact` composed the document, walked its closure, checked its logical links, and inserted it into the render cache. A link check renders its target views inline.
  - Current path, since the worker-first change of 2026-11-20 on the same branch: every view first looks up its document on the render pool, in a Tokio blocking job that holds a worker permit. A cache or store hit finishes there. A miss, native views included, releases its permit and waits for a batch place, which reads the current sidecar capacity. It then takes a permit again and resumes in a second blocking job, without a second lookup. A native miss gets no `Stage`. `ThreadWorkers::document` composes it on the render pool, and `Session::finish_artifact` walks its closure, checks its links, and inserts it. This item holds no measurement of this path.
  - The frozen control is `main` at `6995b84b75465f090ef41c6c0ddb768381b7fde8`. The candidate is step 4 at `969133546bc8f030f4f1c87d20eec8921497d7a7`. Both are release builds from separate checkouts and Cargo targets.
  - Each arm used its own `packages/mokly` dist. The viewer dist was identical. The host had 4 CPUs, Linux 6.8.0-117-generic, Node 24.21.0, npm 11.21.0, Rust 1.98.1, and Bun 1.4.4.

  Acceptance sample on the large HTML fixture, 2026-11-20:

  - Each arm ran one excluded cold primer. Then four warm pairs ran in the order AB, BA, AB, BA. A is main, and B is step 4. Each delta is step 4 minus main within one pair.
  - Each arm had its own new cache. Each warm run reused its own arm's preceding cache. Every HTML disk cache held zero files before its start. The OS page cache was not flushed.
  - The harness sent its usual 30 or 31 foreground requests during each pass. No HTML start had a live sidecar.

  |   Pair | Order | Main first Changes, ms | First Changes delta, ms | Main usage pass, ms | Usage delta, ms | Usage CPU delta, s | Peak delta, bytes |
  | -----: | ----- | ---------------------: | ----------------------: | ------------------: | --------------: | -----------------: | ----------------: |
  |      1 | AB    |               15,928.4 |             +563.734724 |               7,592 |            +193 |          +0.273183 |          -638,976 |
  |      2 | BA    |               16,259.5 |             +267.027380 |               7,611 |            +140 |          -0.030283 |        -4,349,952 |
  |      3 | AB    |               16,379.3 |             +117.350224 |               7,684 |            +157 |          +0.084070 |       +11,780,096 |
  |      4 | BA    |               16,404.5 |             +317.013606 |               7,548 |            +253 |          +0.375808 |        -1,122,304 |
  | Median |       |                        |             +292.020493 |                     |            +175 |       +0.178626733 |          -880,640 |
  - Each median is the median of four signed paired deltas. Do not add or subtract medians of different measures. The first Changes median is about 1.8% of main's first Changes.
  - The step-4 criterion was a paired median within +200 ms. It failed by 92.020493 ms. All four pairs had later first Changes and a longer usage pass on step 4.
  - Per pair, the first Changes delta minus the usage delta is +370.7, +127.0, -39.6, and +64.0 ms. This is arithmetic on the table, not a measured split.
  - During the usage pass, the Serve cgroup used about 1.1 to 1.4 CPU seconds per second in both arms. Peak memory is the largest sampled anon plus swap of the Serve tree until the first ready Changes.
  - Render-cache gauges stayed in the same range in both arms: 254.7 to 254.8 million usage-cache bytes, 5,703 to 5,722 entries, and no restore failure. They were not exactly equal. Every capture counted 5,850 views, and every comparison counted 5,850 unchanged views.
  - The seven saved Serve output pairs of the run were equal within scope: the final ready index, every current detail, manifests, and catalogue projections, with order significant.
  - Only deployment ID, revision, generation, and the identity fields that derive from them were normalized. Raw Serve HTML, resource bodies, intermediate publications, and the browser console were not compared.

  Accepted trade-off:

  - The one warm React proxy pair showed first Changes 3,942.4 ms sooner: 57,674.6 ms on main and 53,732.2 ms on step 4. Usage CPU rose 0.045 s. The startup peak fell 203,096,064 bytes.
  - On the mokly-cloud catalogue, the performance orchestrator measured three interleaved startup rounds per arm. First Changes fell from 12.53 s to 11.53 s. Startup session CPU fell from 49.1 s to 47.9 s. It accepted the memory result.
  - On 2026-11-20 at about 11:25 UTC, the performance orchestrator allowed one CPU profile of the large HTML usage pass per frozen arm, until about 12:25 UTC.
  - Its call: if no Small change owns most of the cost, stop, accept the measured HTML cost as a trade-off, and record this item. The profile found no such owner.

  CPU profile, 2026-11-20:

  - One profile ran per arm, main first and then step 4. Each recorded one usage pass with a new empty cache. Exactly two Serve starts ran. No repeat ran. No code, build, or setting changed.
  - `perf record` used `cpu-clock:u` at 499 Hz, 16 KiB DWARF stacks, CLOCK_MONOTONIC, and switch records. The recorder attached before the start, outside the Serve cgroup. No sample was lost.
  - The binaries had symbols and unwind tables but no debug information. Timing records selected the window only. Perf samples gave the CPU attribution. Each sample weighs about 2.004 ms.

  | Observation                    |    Main |  Step 4 |
  | ------------------------------ | ------: | ------: |
  | Usage wall time, ms            |   8,640 |   8,070 |
  | Usage native CPU samples       |   3,747 |   3,615 |
  | Usage sampled user CPU, s      |   7.509 |   7.244 |
  | Usage Serve cgroup CPU, s      |   9.587 |   9.253 |
  | Post-usage window, ms          | 7,482.3 | 7,281.4 |
  | Post-usage sampled user CPU, s |  10.846 |  10.186 |
  - These profiles reverse the acceptance difference: the step-4 usage pass was 570 ms shorter. Run order and profiler load differ. So they support no causal timing claim and no saving.
  - Each cell below gives sampled ms and the share of usage user CPU. Inclusive values overlap, so do not add them.

  | Top inclusive frame                 |            Main |          Step 4 |
  | ----------------------------------- | --------------: | --------------: |
  | `ArtifactWorker::artifact`          | 5,330.7, 70.99% | 5,493.0, 75.82% |
  | `validation::links`                 | 4,483.0, 59.70% | 4,809.6, 66.39% |
  | `document_composition::document`    | 4,418.8, 58.85% | 4,998.0, 68.99% |
  | `HtmlComposer as Composer::compose` | 2,216.4, 29.52% | 2,100.2, 28.99% |
  | `normalization::composed`           | 1,577.2, 21.00% | 1,949.9, 26.92% |
  | `pipeline::runner::run`             | 1,551.1, 20.66% | 1,799.6, 24.84% |
  | `source_locations::template`        | 1,533.1, 20.42% | 1,609.2, 22.21% |

  | Top self frame                    |          Main |        Step 4 |
  | --------------------------------- | ------------: | ------------: |
  | `_mi_page_malloc_zero`            | 937.9, 12.49% | 795.6, 10.98% |
  | `__memmove_avx512_unaligned_erms` |  721.4, 9.61% |  723.4, 9.99% |
  | `__memcmp_evex_movbe`             |  418.8, 5.58% |  422.8, 5.84% |
  | `mi_free`                         |  258.5, 3.44% |  276.6, 3.82% |
  | `mi_theap_malloc_aligned`         |  132.3, 1.76% |  124.2, 1.72% |
  | `<jetscii::simd::Bytes>::find`    |  116.2, 1.55% |  132.3, 1.83% |
  - Both arms spend most CPU in document composition and recursive link checks. The step-4 frames `raw_prepared` and `finish_artifact` wrap work that main ran in `raw` and `artifact`, so their time is not new.
  - The self-frame leaders are allocation, copy, compare, and free in both arms. The copy and compare differences are about one and two samples.
  - Narrow step-4 evidence, inclusive sampled ms, main / step 4: Stage or transient budget 0 / 0, active-job accounting 0 / 0, eligibility 0 / 14, composition `Start` 0 / 24, and background `Window` 2 / 6.
  - Direct lock and channel self frames took 32.1 ms on main and 22.0 ms on step 4. They are futex mutex and condition-variable functions, so they do not measure blocking time.
  - Eligibility is seven step-4 samples, and `Start` is twelve. Zero samples do not prove zero cost, because optimized code can inline or omit a frame. The Rayon `StackJob` frame with `LockLatch` encloses rendering, so it is no lock cost.
  - Within these sampling limits, no changed operation was identified as owning most of the +0.178626733 s median CPU difference.

  Threads, as sums over the threads of each group, main / step 4:

  | Thread group         | Threads |    Runtime, s | Runqueue wait, s | Sampled futex sleep, s | Perf off-CPU, s |
  | -------------------- | ------: | ------------: | ---------------: | ---------------------: | --------------: |
  | Rayon render workers |   4 / 4 | 7.536 / 7.330 |    3.791 / 2.813 |        22.996 / 22.177 | 27.112 / 25.039 |
  | Tokio blocking jobs  |   7 / 8 | 0.675 / 0.576 |    1.123 / 0.890 |        57.372 / 61.947 | 59.640 / 63.635 |
  | Tokio async runtime  |   4 / 4 | 1.345 / 1.320 |    1.126 / 0.893 |        23.107 / 21.485 | 33.236 / 30.985 |
  | Main                 |   1 / 1 | 0.016 / 0.008 |    0.007 / 0.009 |          8.640 / 8.070 |   8.636 / 8.067 |
  | Other native         |   3 / 3 | 0.000 / 0.000 |    0.000 / 0.001 |        17.280 / 16.140 | 25.920 / 24.210 |
  - Each arm had four distinct dedicated render workers. Their sampled futex sleep was 66.5% of their combined wall time on main and 68.7% on step 4.
  - The snapshots saw seven Tokio blocking threads on main and eight on step 4. This shows no new pool limit and no lasting count change.
  - Runtime and runqueue wait come from kernel schedstat counters with interpolated boundaries. Futex sleep comes from sampled sleeping states. Perf off-CPU includes runnable wait and sleep. Their totals need not match.
  - Four more Rayon threads, outside the render pool, first appear 736 ms after usage on main and 704 ms on step 4. No sampled base or comparison frame falls inside either usage window.

  Profile limits:

  - Only one main-then-step-4 pair ran. There is no balanced order, no repeat, and no confidence interval.
  - A known thread or main entry frame appears in 75.8% of main's sampled weight and 69.3% of step 4's. So unwind coverage differs. Tail calls, frame omission, and partial stacks also weaken cross-arm inclusive comparison.
  - Task snapshots asked for 50 ms. The largest gaps were 134.6 ms on main and 148.8 ms on step 4. Native timestamps have 1 ms resolution.
  - Main's recorder wrapper rejected the expected interrupt exit, `-2`, after a correct stop. The footer, data, lost-sample, and cleanup checks passed, so main's recording stayed valid. Only the unspent step-4 start then ran, with a corrected guard.
  - That stop skipped main's later detail inventory and screenshot. The step-4 inventory confirmed 5,850 documents and 5,760 ready usage views. No acceptance claim depends on the skipped capture.

  Code that step 4 changed on the path of every native view, by reading only. Nobody measured it, and the profile names none of it as an owner:

  - The eligibility call on the async task, the active-job count in `Workers::background_job`, and the `has_room` and `shrink_to` bookkeeping of `Window`.
  - `source_checks::validate`, which every native template parse calls. Its `scan` now records each token through a `RefCell` and counts page tags. Main matched each token and returned at the first violation.
  - The optional token observer check for each token in `EventSink::send` of the shared HTML driver. Native template parses pass no observer.
  - `HtmlComposer::compose`, which now runs `compose_root` and `Start::new`. `Start::new` runs main's former inline start steps and copies the parent path once.
  - The binary layout: the step-4 binary is 109,496 bytes larger.
  - Commit `0b2295917` holds the token stream, the overlap, and the composition changes together. So a commit bisection cannot separate them.
  - Current path note, 2026-11-20: the worker-first change removed the eligibility call on the async task and `Workers::background_job`. Each native miss now runs two blocking jobs, the lookup and the resumed render, with a batch admission and a second permit wait between them. Its eligibility check runs on the render pool at the miss. Option B's merged-tree check covers this path.

  Later `main` and the requirements that stay:

  - After the frozen control, `main` received the lower step 3 of the same series, PR #385 at `c6d2fffa4`. It also received other changes, such as PR #391 in the shared HTML source map.
  - The user forbade another main merge and another performance matrix before this pull request. So no record measures this change on the merged tree.
  - Output stays equal: documents, usage, resources, warnings, diagnostics, and their order. No fragment request repeats. Source: `docs/protocol/mokly-on-demand-background.md`.
  - Both stages keep their bound: the smaller of the worker count and the sidecar capacity, at least one. Each batch entry and each completion entry reads the current capacity. A view start reads none, and a view that the cache or the render store serves needs no capacity reading for either stage. Source: that page and "Capacity" in `docs/protocol/mokly-sidecar-memory.md`.
  - A view with an HTML template takes no completion place. Every miss, native views included, takes a batch place. Foreground renders keep priority. Views start in request order and then in catalogue order, as the user decided on 2026-11-22, and they report in catalogue order.
  - The handoff budget stays 4 MiB, outside the 256 MiB render cache. The cache total does not grow, and no allocator option changes. Source: the protocol and the performance orchestrator's calls of 2026-11-20.
  - The path of a view depends on that view only. The performance orchestrator rejected a catalogue-wide switch on 2026-11-20. The Cloud and React handoff gains stay.
  - Step 4's acceptance required memory within 2% of main on basic, large HTML, and large React. A later fix keeps that bound unless the performance orchestrator sets another.
  - A fix adds no process, setting, gate, retry, sleep, timeout increase, or pool change without a new decision.
  - This item adds no work to the pull request that records it. Work starts only when the user or the performance orchestrator asks for it.

  Reproduction from the frozen arms:

  1. Check out each arm in its own worktree. After a squash merge, fetch the step-4 commit through the pull request head.
  2. Check disk and memory before each Cargo build. Build one arm at a time. Set `CARGO_INCREMENTAL=0`, `CARGO_PROFILE_DEV_DEBUG=0`, and a separate `CARGO_TARGET_DIR` before each arm's commands. Run `npm ci` and `npm run build`. Build the core with `cargo build --locked --release -p mokly-cli`.
  3. Generate one fixture with `npm run fixture:large -- --variant html --root {fixtureRoot}` and the default sizes. Setup commits the sources, then adds one non-matching CSS rule.
  4. Use that setup commit as `{fixtureCommit}`. The measured fixture commit was `5a359c55515dab89b34295feea88a5f4ac3207f7`. A new fixture gets its own.
  5. Start each arm's release core with `mokly serve --config {fixtureRoot}/mokly.config.json --watch --debug-timings --base {fixtureCommit} --port {freePort}`.
  6. Use the default sidecar pool. An explicit sidecar count changes the stage bound.
  7. Give each arm its own `XDG_CACHE_HOME`. Set `MOKLY_PACKAGE_ROOT` and `MOKLY_VIEWER_DIST` to that arm's `packages/mokly` and `packages/viewer/dist`.
  8. Run one excluded cold primer per arm, then balanced warm pairs. A new empty cache matches the zero files of the measured HTML warm caches. Do not flush the OS page cache.
  9. Record first Changes in a browser, the `serve.background` span, cgroup CPU, and peak anon plus swap. Keep every row and every primer.
  10. For profiles, use the same recorder settings in both arms, and alternate the arm order. Accept the interrupt exit only after the footer, data, lost-sample, and stop checks pass.

- **Problem:** On the large HTML fixture, step 4 shows first Changes a paired median of 292 ms later than the frozen control. Its head usage pass takes 175 ms longer, with 0.179 s more CPU. The one-pair CPU profile names no change that owns most of this cost.
- **Impact if no action:** Large native HTML catalogues keep first Changes about 0.3 s, or 1.8%, later than before step 4. A later source change can target the wrong code.
- **Root question:** How, if at all, can a large native HTML catalogue get first Changes as soon as before step 4, and keep the handoff gain and every bound?
- **Options:**
  - **A.** Change nothing. The accepted trade-off stays, with the Cloud and React gains. The native delay keeps no known owner. Effort: Small.
  - **B.** Measure first, in a later branch, with no product change. Effort: Medium.
    - Reconfirm on the merged tree first. Compare the `main` commit that merges this change with its parent, in four balanced warm pairs. If the paired median is within the earlier +200 ms criterion, record it and stop.
    - Otherwise, when the task starts, predeclare a balanced design of profiles and counter runs on the frozen arms, before any result is known.
    - Then choose only the focused ablations that the data supports. Each restores main's form of one code difference above, on top of step 4, with output equality.
    - The design can also measure why the render workers sleep about two thirds of the pass.
    - Record the split in this item. Recommend the option for the largest measured part. Run an options check before any source change.
    - Cost: several release builds and measurement hours. The result can show no single owner.
  - **C.** Restore main's form of the listed code differences without a measurement. Keep the handoff and the token stream of JavaScript callbacks. Cost: output equality needs a new proof. The gain can be zero, because the profile found no owner there. Effort: Medium.
  - **D.** Add permanent per-pass totals of the native document steps to `--debug-timings`: composition, source checks, normalization, closure walk, link checks, and cache insertion. Cost: counters in hot code, and no cost removed alone. Stage names are diagnostic details under `docs/protocol/mokly-timings.md`, so the contract stays. Effort: Medium.
  - **E.** Lower the native document cost below main's without an owner. Cut allocation, copies, and compares in composition and recursive link checks, which lead the self frames in both arms. Cost: an equal-output proof for each changed step, and an unknown gain. Effort: Large.
  - **F.** Use the idle CPU of the native pass. The Serve cgroup used about 1.1 to 1.4 of 4 CPUs, and the render workers slept most of the time. Cost: the cause is unknown. A new stage bound changes the on-demand requirement and needs a decision. More live trees need a new memory check. Effort: Large.
- **Left out:**
  - Another one-pair profile with the same method. Its sampling noise and reversed timing cannot resolve this delay, so B is better on every point.
  - A catalogue-wide switch to main's path when no view can hand off. The performance orchestrator rejected it on 2026-11-20, because mixed catalogues keep the native overhead.
  - A revert of step 4. It loses the accepted Cloud and React gains.
  - More workers, threads, or sidecars, a larger render cache, or an allocator option. Each breaks a bound that stays.
  - Skipping normalization or link checks for native views. That has no equal-output proof.
  - A CI timing gate for large HTML. It removes no cost, and a new gate needs the user's approval.
- **Shared assumptions:**
  - The frozen sample describes one 4-CPU host, one fixture size, and the frozen arms. Source: the measurements of 2026-11-20. B drops the frozen-arm part with its merged-tree check.
  - The requirements above stay. Source: the protocol pages and the performance orchestrator's calls of 2026-11-20. F drops the stage-bound requirement, so it needs a decision.
  - The earlier +200 ms paired-median criterion marks a small enough delay. Source: the step-4 criterion of the performance orchestrator. A accepts the larger delay, as the orchestrator did for this pull request.
- **Wider fix:** None. The structural fix for the known class is in force: a view that cannot hand off allocates no stage. From `969133546` it took main's ordinary path. Since the worker-first change of 2026-11-20, it takes the shared lookup, a batch place, and a resumed render without a prepared root. The remaining cost has no known owner, so no other class is known. D only makes a later cost of this kind visible.
- **Previous examples:**
  - In step 4, two fixes moved native views off the staged path. The four-pair first Changes median was +548.3 ms at `2772eca02`, +431.2 ms at `33b63f5aa`, and +292.0 ms at `969133546`. These are separate samples.
  - `plans/follow-ups/compact-copies-after-preparation.md` records a large React usage pass that ran 2.4 s slower with identical work counts. Its cause stayed unproven.
- **Recommendation:** B. It is clearly the best next attribution step, because no code optimization has measured support yet. It first checks that the delay still exists on the merged tree. D best keeps later native costs visible.
- **Action:** fix after merge, apply B, because the performance orchestrator accepted this cost for this pull request, and a measured split must come before a choice among C, E, and F.

History, not needed for the work: the raw profiles, thread snapshots, and acceptance rows of 2026-11-20 stayed in the ignored folders `.context/busier-sidecars/html-residual-profile/` and `.context/busier-sidecars/measurements/exact-dispatch-confirmation-01/` of the step-4 workspace. The profile report SHA-256 was `30606fa9b14d269586e6fde70aacb077ee2674656464162cd8455313182442e2`. The frozen native SHA-256 values were `174e6f4b2fde8002df8861d9b48406eeca0c7019fc70c526ebc72184d7765701` for main, 53,401,024 bytes, and `133ac5d7541523193a8e11223ca762c718667f4ea11b580ad94e2b7fdd105512` for step 4, 53,510,520 bytes. The run descriptor SHA-256 was `d6a2d8f48f759cb0831537e618c7aeaa0c74f2e6bf07ba42d119a02029ddbd9b`.
