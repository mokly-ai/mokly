# Shorten the work after each warm Serve edit

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the split of the background pass of warm Serve
  edits on branch `calummoore/mokly-edit-background-render-olos`, which the
  performance orchestrator requested.
- **Location:**
  - `crates/mokly-server/src/background.rs:91`: `UsagePass::fill_window`, the
    `serve.background` span, and its window at line 99.
  - `crates/mokly-server/src/work_background.rs`: `Workers::background_render`,
    the lookup, the batch admission, and the resumed render of one view.
  - `crates/mokly-sidecar/src/pool_affinity.rs:36` and `:58`: the generation
    rank that sends a render to an idle process that lacks its generation.
  - `crates/mokly-sidecar/src/pool_preparation.rs:136`, `:159`, and `:208`:
    `Pool::prepare`, `Pool::restore`, and `Pool::prerequisite`, which send
    `restoreGeneration`, `cssModules`, `describe`, and `bindings` before the
    first render of a generation on a process.
  - `crates/mokly-sidecar/src/pool_releases.rs:70` and `:110`:
    `record_release`, which holds the pool lock while
    `crates/mokly-sidecar/src/pool_recipes.rs:73` encodes a whole restore
    request to measure a released recipe, and `clean_idle`, which disposes the
    idle slots one at a time.
  - `crates/mokly-sidecar/src/codec.rs:62`: the request encoder.
  - `packages/mokly/src/sidecar/transport.ts:8`: the frame decoder.
  - `packages/mokly/src/sidecar/evaluate.ts:47`: the `new Function`
    evaluation of the bundle.
  - `packages/mokly/src/sidecar/styles.ts:150` and
    `packages/mokly/src/sidecar/registry-styles.ts:32`: the per-render parse of
    the whole style registry.
  - `crates/mokly-server/src/changes_execution.rs:22`: `changes.classify`, and
    `crates/mokly-cli/src/serve_base.rs:124`, where the kept-base check reads
    the dependency directories that the renders record.
  - `docs/protocol/mokly-on-demand.md:76`: the rule that no base capture or
    comparison starts before the pass of its state ends.
- **Reason:** No set of changes without a protocol change projects 60 ms for
  each warm edit, and the options with more saving wait for the decision of
  the performance orchestrator.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Background pass:** the Serve work after each edit that renders the views
    whose documents changed, the `serve.background` span.
  - **Holder:** the sidecar process that bundled the new head generation, so it
    holds that generation already.
  - **Cold sidecar:** an idle head process that holds only an older head
    generation. Its first render of the new generation needs a preparation.
  - **Preparation:** `restoreGeneration`, `cssModules`, `describe`, and
    `bindings` for a new generation on one cold sidecar.
  - **mokly-cloud:** the measurement catalogue of the performance
    orchestrator: 167 entries, 1,508 views, 4 vCPU, and 4 sidecars.
- **Background:**
  - The request of 2026-11-22: make a warm one-line edit on mokly-cloud reach
    published Changes at least 100 ms sooner, with the same published bytes,
    warnings, and diagnostics, and a whole-tree memory peak within 2% of
    `main`. The stop bar: no set of safe changes that projects 60 ms or more
    for each warm edit. A protocol change needs the approval of the
    orchestrator first.
  - The section "Measurements of 2026-11-22" below gives the method and the
    numbers. The baseline is `main` at
    `9bdb0569d3ac0214bf303c599854a70b20dc2b2c`, PR #467.
  - Each warm edit re-renders 44 views: 11 view paths in light and dark at
    two viewports. Each view makes one sidecar render.
  - The pass is CPU-bound. The core and the sidecars together use a median of
    1,298 ms of CPU while the views of the pass take a median of 380 ms. So 3.4
    of the 4 cores are busy on average, in a range of 3.2 to 3.6. Over 20 warm
    passes, the time to the last view is 23.6 ms plus 0.273 times the CPU of
    the pass. So each millisecond of CPU that leaves the pass saves about
    0.27 ms.
  - All four sidecars render in each pass. The holder starts its first render
    at a median of 17 ms. Each of the three cold sidecars first spends a
    median of 200 ms on its preparation, so it starts its first render at a
    median of 209 ms. The preparation is about 45% of the sidecar time of a
    pass, and the 44 renders are the rest.
  - Each pass has three fragments that take over 100 ms. 90% of their time is
    the preparation on a cold sidecar. No fragment waits for a busy holder.
  - The window, the batch, the worker permits, the completion stage, and the
    Serve gate add almost no wait. A test with twice the views in flight
    changed `serve.background` by +5 ms, within noise, and raised the memory
    peak by about 8%.
  - Inside a preparation, `describe` takes a median of 134 ms. A CPU profile
    splits it into the evaluation of the bundle, its compile, the Babel parse
    of `orderedExports`, garbage collection, and the reply.
    `restoreGeneration` takes a median of 56 ms. Most of it is the encode
    in the core and `JSON.parse` in the sidecar of a 5.9 MB request.
  - React runs its development build in the sidecar. React work is about 70%
    of each render. Mokly's own work after the React render is most of the
    rest, about 28%. The parse of the whole style registry on each render is
    9.3% of the render time.
  - After the last view, the serial work takes about 173 ms: 21 ms to publish
    the usage, 4 ms to the classification, and 152 ms of `changes.classify`.
    The sidecars are idle then.
  - The plan `plans/cheaper-sidecar-describe.md` of branch
    `calummoore/mokly-cheaper-sidecar-describe-dlz0` caches the export names
    of `orderedExports`. The orchestrator accepted it on 2026-11-21 at -42 ms
    for each mokly-cloud edit. It is not on `main`, so it is not in this
    baseline. It also lowers the preparation of each cold sidecar.
- **Problem:** Each warm edit spends about 400 ms in the CPU-bound background
  pass and about 173 ms in serial work after it. The changes that need no
  protocol change cut too little to save 60 ms for each edit.
- **Impact if no action:** Each warm edit on mokly-cloud keeps a background
  pass of about 320 to 540 ms, median 400 ms, and a classification of about
  120 to 190 ms, in these local runs.
- **Root question:** How can a warm edit publish Changes at least 100 ms
  sooner, by removing CPU work and serial waits from the background pass and
  the work after it, with the same output and a whole-tree peak within 2% of
  `main`?
- **Options:**
  - **A.** Change nothing, and close this record. Effort: Small.
  - **B.** Split the serial work after the last view first, then propose cuts
    there. That work is the usage publication, `changes.classify`, and the
    Changes publication. A first split gives the classification step about
    73% and the Changes publication about 23%. The sidecars are idle then, so
    each cut saves its full time, and no protocol change is needed. The
    projection is unknown until the split. Effort: Medium for the split.
  - **C.** Cut the CPU of the pass with no protocol change. Encode each
    restore request once for all cold sidecars. Measure a released recipe
    without an encode under the pool lock, and let the first calls of a pass
    take their slots before the one-at-a-time disposes end. Scan frames with
    the native `indexOf`. Index the style registry by rule, for each
    generation, with a fixed cap and a release at `dispose`. Add a V8 code
    cache for the bundle evaluation. With the owner of the seed path, also
    send a render-only restore without the module graph, the input digests,
    and the directory listings. The projection is about 45 to 50 ms, in a
    range of 35 to 65. The style index needs a memory bound. Effort: Large.
  - **D.** Start the comparisons against the kept base during the pass. The
    base work and the comparisons of the changed views overlap the pass, and
    the classification publishes nothing before the pass ends. This changes
    the rule at `docs/protocol/mokly-on-demand.md:76` for comparisons only.
    The recorded rejection there is about the memory of base renders and
    capture, and those still wait. The options check projects 35 to 75 ms
    net. It is lower when the kept-base check must stay after the renders,
    because that check reads the dependency directories that the renders
    record. It adds about 9 MB, about 0.3%. Effort: Large, with high risk.
  - **E.** Evaluate only the modules that the rendered views need on a cold
    sidecar. The evaluation is about 36% of the preparation, so the projection
    is about 25 to 45 ms. It changes the bundle entry, the evaluation, and
    `describe`, and it needs proof that module order cannot change any
    output. Effort: Large.
  - **F.** C and D together, in stages. The options check projects about 90
    ms, in a range of 65 to 120. Without D, the set projects about 45 ms.
    Effort: Large.
- **Left out:**
  - A second process that holds the new generation before the pass. This is
    the preload family of
    [serve-head-generation-preload.md](./serve-head-generation-preload.md).
    Its third attempt, experiment D of 2026-11-21, was 0.07 s slower and used
    3.8% more memory. This split gives no new reason that removes the memory
    cost.
  - More views in flight than sidecars, or another order of the views and
    their calls. Measured on 2026-11-22: no gain, and about 8% more memory. The
    pass is CPU-bound, so less idle time on a sidecar slows the other work.
  - Coalesced document compositions. The 44 views of a pass have 44 distinct
    document keys, so no composition repeats.
  - The production build of React. It changes published bytes and warnings.
  - A prerequisite `describe` without a reply. It repeats Part B of
    `plans/cheaper-sidecar-describe.md`, which the orchestrator did not build
    on 2026-11-21, because the core would lose its Rust check of the
    definitions. The reply is 0.2 MB, so it saves about 3 ms.
  - Fewer cold sidecars in a pass. The preparation and the renders that it
    enables cost about the same lane time, so the pass ends at about the
    same time.
  - Reuse of evaluated modules across generations. Shared module state could
    make the output depend on the edit history.
  - One render for the four views of a path. Each render call carries its
    viewport and its color scheme, and the renderer can read both.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** PR #225 made the pass parallel. PR #313 and PR #315
  keep head processes ready and rank them by their loaded generation.
- **Related:**
  - [serve-head-generation-preload.md](./serve-head-generation-preload.md)
    records the three rejected attempts to prepare the new generation before
    the pass.
  - [sidecar-loaded-state-selection.md](./sidecar-loaded-state-selection.md)
    holds the open choice of the process for each request.
  - [coalesce-document-composition.md](./coalesce-document-composition.md)
    owns repeated compositions, which this pass does not have.
  - [default-sidecar-count.md](./default-sidecar-count.md) owns the default
    pool size, which this split did not change.
  - The plan `plans/cheaper-sidecar-describe.md` of branch
    `calummoore/mokly-cheaper-sidecar-describe-dlz0` records the Part B call.
    One reason of that call says that render sidecars run `describe` after
    Changes publishes. This split shows three prerequisite `describe` calls
    inside each warm pass, before Changes.
- **Recommendation:** B. The sidecars are idle during the serial work after
  the last view, so each cut there saves its full time with no protocol
  change, and the split also bounds what D can still gain. F best reaches the
  goal if the orchestrator accepts a protocol change and Large work with high
  risk.
- **Action:** ask the user, because two or more options have real trade-offs:
  F projects about 90 ms but needs a protocol change and Large work with high
  risk, and B may find a cheaper path first.

## Measurements of 2026-11-22

All times are in milliseconds. They are local measurements with a probe, not
official Changes timings, and the performance orchestrator owns the official
measurements.

### Method

- The catalogue is the `mokly-ai/mokly-cloud` repository at commit `194fdb78`,
  with its own `mokly.config.json`, `--base HEAD`, and `--debug-timings`.
  `npm ci` ran in `ts/`. The release core and the dist of the measured arm
  were installed over its `@mokly` packages.
- The machine has 4 vCPU and Node 24.22.1. Serve used the default 4 sidecars.
  Each session ran in its own transient systemd scope, and a sampler read the
  anonymous memory and the swap of that scope every 50 ms.
- Each edit changed the `title` text on line 35 of
  `docs/mockups/src/screens/product/settings/slug-editor.tsx` to a new value
  of the same length. After the last edit, the session restored the source
  exactly. A session waited for 4 s without timing records before each edit.
- A warm edit is an edit after the first edit of a session. Each arm had its
  own cache directory.
- A temporary probe, never committed, timed each view of the pass with one
  monotonic clock for the core and the sidecars. It recorded the window
  start, the waits for a worker, a batch place, a completion place, the Serve
  gate, and a pool slot, the preparation, each sidecar exchange, the request
  encode, the result decode, and the thread CPU of the composition. At the
  start and the end of each pass, it read the CPU time of every process of
  the tree. The process-local `elapsedMs` of each sidecar cannot align the
  processes, because each sidecar starts its clock at its own start.

### Split of the warm edits

Twenty warm edits of four sessions. Medians, with the range in brackets:

| Measure                                     | Value                  |
| ------------------------------------------- | ---------------------- |
| Edit to published Changes                   | 1,645 (1,430 to 2,200) |
| `serve.background`                          | 400 (318 to 542)       |
| End of the last view, from the pass start   | 380 (297 to 516)       |
| `changes.classify`                          | 152 (119 to 190)       |
| Views, and sidecar renders, in each pass    | 44 and 44              |
| CPU of the pass, core                       | 217 (176 to 293)       |
| CPU of the pass, four sidecars together     | 1,080 (839 to 1,488)   |
| CPU of the pass, whole tree                 | 1,298 (1,015 to 1,781) |
| Busy cores, whole-tree CPU over view time   | 3.4 (3.2 to 3.6)       |
| First render on the holder                  | 17 (5 to 25)           |
| First render on a cold sidecar              | 209 (120 to 394)       |
| Preparation on a cold sidecar               | 200 (60 cold sidecars) |
| `restoreGeneration` exchange                | 56 (33 to 119)         |
| `describe` exchange on a cold sidecar       | 134 (68 to 246)        |
| Render exchange                             | 14.7 (4.2 to 87.9)     |
| Idle gap between two renders on one sidecar | 2.6 (0.4 to 16.4)      |
| Pool slot wait, sum of a pass               | 17                     |
| Batch wait, sum of a pass                   | 3                      |
| Worker, completion, and gate waits          | 0                      |

- A warm edit took about 78 to the start of `watch.action`.
- `watch.action` took a median of 1,013, in a range of 879 to 1,417.
- `changes.classify` started 3 to 5 after the end of `serve.background`.
- Each pass starts four views at once. One goes to the holder. Three go to
  cold sidecars, which run their preparation. Until the first cold sidecar
  is ready, only the holder renders, one view after the other, with a gap of
  2 to 10 ms between its renders.
- The pool slot waits come at the start of each pass. The release of the old
  head generation then sends one `dispose` to each process, one at a time, 1
  to 4 each. The first call on each process waits for its `dispose`, up to 14
  on the last process. Just before the pass, the released recipe store
  encodes the 5.9 MB restore request of the old generation to measure it.
- Each pass has three fragments of over 100 ms, about 200 ms each. These are
  the first renders on the cold sidecars. The preparation is 70% to 90% of
  each, median 90%.
- Inside `changes.classify`, medians of the 20 warm edits: the base commit
  and the reuse of the kept base take 30, the view comparisons 79, then 32
  without a span, then the index build and the publication 8. The
  comparisons reused 1,464 views and compared 44.
- The memory peaks of the four warm probe sessions were 2,805 to 2,942 MiB.

### Inside one preparation

A CPU profile of the sidecars, with `--cpu-prof` at a 0.5 ms interval, slows
each edit by about 0.6 s, so only its shares count. For a prerequisite
`describe` on a cold sidecar, 198 ms under the profiler:

| Part of `describe`                            | Share |
| --------------------------------------------- | ----- |
| Running the bundle code                       | 28%   |
| Compiling the bundle code, in `evaluate`      | 26%   |
| `orderedExports`, a Babel parse of each entry | 23%   |
| Garbage collection                            | 10%   |
| Definition records and the JSON reply         | 8%    |
| Other                                         | 5%    |

- `restoreGeneration`, 115 ms under the profiler, is mostly the frame decode
  and `JSON.parse` of the request, 58, and idle time while the core encodes
  and sends it, 26.
- The restore request is 5.9 MB: the bundle code 2.7 MB, the module graph
  1.8 MB with 4,445 modules, the input digests 0.8 MB, the directory listings
  0.5 MB, and the entry sources 0.2 MB. The core encodes it once for each
  cold sidecar, in 13 to 17 each, or up to 39 when three run at once. In a
  warm pass, the released recipe store also encodes the 5.9 MB request of
  the released generation, while it holds the pool lock, only to measure its
  size. Only the pass of the first edit of a session measures 9.2 MB.
- A replay of one preparation in a fresh Node process, after an older
  generation, took 71 to 93 for `describe`. Its compile took 20 to 22. A V8
  code cache of 1.2 MB, made by an earlier evaluation, cut the compile to 5
  to 7 and `describe` to 56 to 72.
- A replay of the frame decode of a 10.3 MB test frame took 55 with the
  current byte loop and 48 with the native `indexOf`.
- In a warm render under the profiler, React work in its development build
  is about 70%. Mokly's own work after the React render is about 28%. Its
  largest part is `registryStyles`, which parses the whole style registry
  with PostCSS on each render, 9.3% of the render time.

### After the last view

A later probe session split the serial work after the last view. Other work
on the machine slowed that session, so only its shares count.

| Step after the last view                        | Median, that session |
| ----------------------------------------------- | -------------------- |
| Publication of the usage of the pass            | 31                   |
| Wait before `changes.classify`                  | 4                    |
| The classification step: base work, comparisons | 193, 73% of it       |
| Identity encode of the result, 648 KB           | 4                    |
| Changes metadata files                          | 4                    |
| Git reference check                             | 5                    |
| Changes publication, with the index build       | 59, 23% of it        |

- In the calm sessions, the publication of the usage took about 21, and
  `changes.classify` took a median of 152.
- The sidecars are idle during this work. Each cut here saves its full time.
- `crates/mokly-cli/src/serve_base.rs:124`: the reuse of the kept base reads
  the dependency directories that the renders of the pass record. So that
  check cannot start before the renders end, unless the change proves the
  same result.

### Twice the views in flight

A variant of the probe build doubled the window, the worker permits, and the
batch and completion bound, so that calls waited at the Serve gate instead of
in the window. One interleaved round of four sessions, A B B A, six edits
each, warm edits only:

| Measure                   | Probe build  | Twice in flight | Difference |
| ------------------------- | ------------ | --------------- | ---------- |
| Edit to published Changes | 1,574        | 1,650           | +76        |
| `serve.background`        | 385          | 390             | +5         |
| `watch.action`            | 978          | 1,020           | +42        |
| `changes.classify`        | 140          | 167             | +27        |
| Session memory peak, MiB  | 2,808, 2,805 | 3,065, 3,002    | about +8%  |

- In the variant, the calls of a pass waited 1.0 to 1.5 s in total at the
  gate. The mean render exchange of a pass was 15.4 to 23.2, against 13.7 to
  16.5 in the probe build. The CPU of a pass stayed at about 1.0 to 1.35 s.
- So the idle gaps were not the bound. With the CPU nearly full, a fuller
  queue makes each render slower.
- One round cannot rank the endpoints of the two arms, because single edits
  ranged from 1,444 to 2,135. It shows no gain in the pass.

## Checks of the split

- The probe and the analysis scripts ran only on the local machine. They
  changed no file of the repository. The final probe patch has 695 lines, and
  its SHA-256 is
  `5a67c898a1a9d47a9db8434b71f6bbb57fddbb305dc122e7d04db339a3f0659c`. This
  record holds every fact that it needs from the patch and the evidence.
- A fresh read-only agent ran the options check over this record on
  2026-11-22. It added the release, style index, and render-only restore
  parts of option C, the work after the last view, and the staged set F. It
  corrected the render share of Mokly's work and the classification medians.
  It found that the stop holds only if a protocol change counts as unsafe.
- Every session restored the edited source exactly, and every edit in this
  record published Changes with status `ok`.
- These did not happen: a product change, tests, the repository suite, the
  complete gate, a byte proof, a review, CI, and an official latency or memory
  run. This record makes no acceptance claim.
