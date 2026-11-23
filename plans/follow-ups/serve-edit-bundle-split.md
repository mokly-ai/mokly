# Split of the warm Serve edit bundle

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Closed experiment record.
- **Added:** 2026-11-21, from the bounded split of the Serve edit bundle on
  branch `calummoore/mokly-edit-bundle-path-kv2o`, on `main` at `377111494`,
  PR #463.
- **Location:**
  - `packages/mokly/src/sidecar/bundle.ts:177`: `bundleAttempt`, which runs
    the guarded compile at line 252.
  - `packages/mokly/src/sidecar/kept-context.ts`: `KeptContext`, the esbuild
    build context that each sidecar process keeps for its guarded compiles.
  - `packages/mokly/src/sidecar/plugins.ts:46` and `:181`: the file load
    callback and the resolve callback of each compile.
  - `packages/mokly/src/sidecar/native-plan.ts:128`: `plannedResult`, which
    answers a planned resolve during the compile.
  - `packages/mokly/src/sidecar/planned-relative.ts:27`:
    `PlannedRelative.create`, the setup of the guarded attempt.
  - `packages/mokly/src/sidecar/bundle-recipe.ts:43`: `bundleRecipe`, the
    phases after the compile.
  - `crates/mokly-render/src/plan_inputs.rs:16`: the plan check, `current`.
- **Reason:** Two changes of 2026-11-22 took four options of this record. The
  first took B, C, and G and met its goal of 100 ms. The second took E, a kept
  esbuild context, and gained 98 ms in the user's official check. Each option
  that stays projects 10 ms or less without a protocol change, or it needs a
  protocol decision or more memory than the budget, so no work follows here.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Warm edit:** a one-line edit in a running Serve session after the first
    ready Changes. The measured edit changes the `title:` text on line 35 of
    `docs/mockups/src/screens/product/settings/slug-editor.tsx` in mokly-cloud.
  - **Guarded attempt:** the `serveEdit` compile with a plan. esbuild resolves
    the safe relative imports itself, a resolve callback answers the others
    from the plan, and the guarded import proof checks the result.
  - **Seed:** the `restoreGeneration` request with which the pool installs the
    last released recipe of the same bundle settings before a `bundle`
    request, so that the sidecar's reuse check can accept it.
  - **ABBA order:** sessions in the order A, B, B, A on one fixture, with the
    arm installed again before each session.
- **Background:**
  - The task asked for a split of the edit bundle, then one change that makes
    a warm edit reach published Changes at least 100 ms sooner. The same
    bytes, warnings, and diagnostics, and a whole-tree memory peak within 2%
    of `main`, were required. The task stopped when no set of safe changes
    projected at least 60 ms.
  - Another workspace owned `Codec::decode` in `crates/mokly-sidecar`, the
    sidecar pool, `session.ts`, and `compiled.ts`. A third one owned
    `describe.ts` and `export-order.ts`. This split measured their parts and
    changed none of these files.
  - On 2026-11-22, a change on the same branch took options B, C, and G of
    this record, as the user decided on 2026-11-21. It also cut the released
    recipe seed: the pool sends no released recipe that the current files
    already rule out, and the sidecar's reuse check reads the likely changed
    inputs first. It changed the pool and `compiled.ts` with the user's
    approval.
  - On 2026-11-22, a second change took option E on branch
    `calummoore/mokly-edit-esbuild-context-3amj`: each sidecar process keeps
    one esbuild build context for its guarded compiles, under
    `docs/protocol/mokly-sidecar-kept-context.md`. The user chose it on
    2026-11-22, after an official check of a prototype whose pass rules were
    written before the data. Option I and a warm-up compile were measured and
    not taken. The section "Kept esbuild context" below gives their numbers.
  - The section "Measurements" below gives the fixture, the method, and every
    number of the split. Its section "After the change of 2026-11-22" gives
    the user's official measurement of that change: a warm edit of mokly-cloud
    reached published Changes 103 ms sooner, within the memory budget.
- **Problem:** After the changes of 2026-11-22, a warm edit of mokly-cloud
  reaches published Changes in about 1.72 s. Each edit after the first
  compiles in about 450 ms, and the first edit of a process in about 700 ms,
  because that compile creates the kept context and warms a new esbuild
  service.
- **Impact if no action:** Each warm edit keeps its current bundle time.
- **Root question:** How can a warm one-line edit of mokly-cloud reach
  published Changes sooner than after the change of 2026-11-22, through a
  shorter edit bundle, with the same bytes, warnings, and diagnostics, and a
  memory peak within 2% of `main`?
- **Options:** The changes of 2026-11-22 took options B, C, G, and E, so
  their entries are gone. E: each sidecar process keeps one esbuild build
  context for its guarded compiles. B: the guarded import proof observes each module path
  once and makes no `DependencyUsage.resolved` call for a relative name,
  where the call did nothing. C: the core checks the plan record on up to
  four threads. G: a compile without a full capture owner leaves the module
  sources out of its identity, and its random runtime key keeps the identity
  fresh. The other options keep their letters.
  - **A.** Change nothing more. Effort: Small.
  - **H.** Skip the `DependencyUsage.resolved` call for relative names also
    during the compile, as B did in the proof: in `plannedResult`, for about
    3,238 planned relative resolves, and in the full-path resolve callback.
    No protocol change. Projected: at most about 10 ms of main-thread time.
    Effort: Small.
  - **D.** Do the reads of the phases after the compile while the compile
    runs. The main thread is idle about half of the compile. Candidates are
    the per-file digests (the inputs phase, 20 ms) and the directory and
    manifest reads of `resolutionInputs` (25 ms) for the module directories
    of the plan. Measured for the digests: the inputs phase went from 20 ms
    to 16 ms, and the compile did not get faster. Projected for the reads:
    15 to 20 ms less. The timing page says that these reads follow the
    compile, so the reads part changes a protocol sentence. Effort: Medium.
  - **F.** Run the plan check beside the compile. The core sends the plan at
    once and checks the record on a thread while the sidecar compiles. When
    the check fails, the core disposes the guarded generation, so that it
    never becomes a released recipe, and sends the request again without a
    plan. Projected: about 20 ms, the whole check. It changes the rule of
    the section "Edit Requests" of `docs/protocol/mokly-sidecar-plans.md`
    that a request carries a plan only after the check. It adds a second
    compile after a recorded input changes, and a discard of the first
    attempt's errors and warnings. Effort: Medium.
  - **I.** Pin the kept context of E to one head process: send every
    `serveEdit` bundle to it, and stop the esbuild service of every other
    process after its bundle. Measured on 2026-11-22: in every traced session
    the head bundle rank already sent each edit to one idle process, so a pin
    gained nothing. Stopping the other services lowered only startup peaks:
    cold mokly-cloud without edits went from 2,716 to 2,132 MiB. A first edit
    on the startup head process then paid a cold service, 91 to 134 ms more
    compile, as on examples/basic with 2 sidecars. It needs the pool, a
    request field, and a new decision. Effort: Large.
  - **J.** Install the plan once in each sidecar and send only a reference
    after that. It removes the transfer and the parse of the 2.3 MB plan, 11
    to 14 ms for each edit. It reverses the decision of the section "Kept
    Records" of `docs/protocol/mokly-sidecar-plans.md`, which rejected plan
    copies installed in workers. The pool files belong to another workspace.
    Effort: Large.
  - **K.** Send a smaller bundle response. `modules[].digest` repeats the
    digests of `compiled.inputs`, and `inputDirectories` repeats as
    `metadataDirectories`. It changes the wire format and `Codec::decode`,
    which belongs to another workspace. Effort: Large.
- **Left out:**
  - Native resolution of more imports. 3,238 of the 3,548 planned resolve
    callbacks are relative imports whose targets have their own parse
    settings, such as a package `type`. Without the callbacks, esbuild
    changes the output: one import became
    `__toESM(require(".../react/index.js"), 1)`, the node-mode interop of a
    module in a `"type": "module"` package.
  - Native loads of files without the load callback. They save about 40 ms of
    the compile, but the recipe must digest the exact bytes that the compiler
    consumed, and a read after the compile can see newer bytes.
  - Garbage collector settings for Node or for esbuild. Each setting that
    helps adds more memory than the 2% budget, about 60 MiB over four
    processes. A lower target for the service of the kept context,
    `GOGC=50`, cut its memory at the peak by 78 MiB, but its first build took
    120 ms longer and the mean of 3 warm edits gained only 3 ms.
  - A warm-up compile at idle after the first ready Changes, in the process
    that the head bundle rank picks next. It would remove the first-edit
    compile penalty, about 175 to 200 ms of `sidecar.bundle`: about 60 ms on
    the mean of 3 warm edits alone, about 94 ms with a kept context. But a
    warm restart without edits stays at 1,447 to 1,462 MiB and never starts
    esbuild, and one compile adds a service of 300 to 440 MiB, up to 725 MiB
    during the build. A session without edits must stay within the memory
    budget, so it fails.
  - Fewer callbacks through esbuild options such as `alias` and `external`.
    They change error texts or need importer data that the options cannot
    express.
  - A transform cache for each module with Mokly's own linking. It cannot
    give esbuild's exact bytes.
  - A cache of file bytes or of plan check results that a stat check guards.
    A write inside one timestamp tick passes such a check.
  - A worker thread for the reads after the compile. It adds heap in each of
    four processes, and D overlaps the same reads without one.
  - A memo of `PlannedRelative.create` across edits. The concurrent prototype
    did not shorten it, and a memo needs J and still needs fresh package
    metadata reads.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** PR #448 let esbuild resolve safe relative imports in
  the guarded attempt. PR #449 and PR #463 shortened the reuse reads and the
  response work of the bundle.
- **Related:**
  - [serve-postcompile-import-proof-cost.md](./serve-postcompile-import-proof-cost.md)
    holds the guarded import proof. The change of 2026-11-22 applied two of
    its three estimated cuts, as option B of this record.
  - [esbuild-memory-after-bundle.md](./esbuild-memory-after-bundle.md) holds
    the memory that each esbuild service keeps after a bundle. The kept
    context of E lives in a service that the edit process keeps anyway, and it
    held no more memory than an idle service. I depends on its option B.
  - [release-recipe-encode-under-pool-lock.md](./release-recipe-encode-under-pool-lock.md)
    holds the encode of each released recipe under the pool lock, which the
    change of 2026-11-22 did not cover.
- **Recommendation:** A. The changes of 2026-11-22 took B, C, G, and E.
  Without a protocol change, H and the digests of D project at most about
  10 ms and 4 ms. Each other option needs a protocol decision, and I gained
  nothing in the measured sessions.
- **Action:** No action. A later proposal that takes one of these options
  needs its own scope decision and new measurements after the changes of
  2026-11-22.

## Measurements

### Fixture and method

- mokly-cloud at `194fdb78`, cloned outside the Mokly checkout, with `npm ci`
  in `ts/`. A release core and the dist of `main` at `377111494` replaced the
  installed `@mokly` packages. The runs used `mokly.config.json`,
  `--base HEAD`, `--debug-timings`, and the default pool of 4 sidecars.
- The machine had 4 vCPU (AMD EPYC 4585PX), 7.9 GB of memory, and Node
  24.22.1.
- Each edit added a new text to the title, so no cache held its documents.
  The harness waited for ready Changes and then for 1 s without timing
  records before the next edit.
- The harness aligned the clocks per process: the origin of each process is
  the lowest receive time minus `elapsedMs` of its records. A temporary
  Node preload outside the repository wrapped the esbuild hooks and the
  sidecar calls and wrote wall-clock times.
- Warm values below are the means of edits 2 to 6 of four `main` sessions in
  ABBA order, 20 edits, unless a line names another set.

### Split of one warm edit, ms after the file write

| Part                                               | Mean  | Median |
| -------------------------------------------------- | ----- | ------ |
| Start of `watch.action`                            | 76    | 78     |
| Start of `catalogue.bundle`                        | 86    | 86     |
| Start of `sidecar.bundle`, after the request parse | 180   | 168    |
| Start of the compile                               | 241   | 246    |
| Compile                                            | 620   | 599    |
| Guarded import proof, the gap after the compile    | 39    | 40     |
| `mapped-lookups`, `graph`, `inputs`, `resolution`  | 95    | 92     |
| Tail to the response write callback                | 55    | 52     |
| End of `catalogue.bundle`                          | 1,066 | 1,028  |
| `sidecar.describe` inside `catalogue.validate`     | 77    | 73     |
| End of `catalogue.validate`                        | 1,184 | 1,168  |
| `render.inputs` and `graph.prepare`                | 68    | 65     |
| Publication of the new generation                  | 1,297 | 1,260  |
| Ready Changes                                      | 2,190 | 2,203  |

The core ended `catalogue.bundle` 12 ms (median) after the sidecar's write
callback, so the read and decode of the 5.95 MB response overlap the write.

### Before the compile

Probed sessions, edits 2 to 6, with some probe overhead:

- The core's plan check took about 20 ms of CPU for each edit, in
  `plan_inputs::current`. A sampling profile of the core showed it.
- The pool sent a seed of 5.96 MB before each edit bundle. With a seed, the
  time from the start of `catalogue.bundle` to the sidecar's receipt of the
  bundle request was 96 to 234 ms. Without one, on the first edit of a
  session, it was 46 to 76 ms.
- The bundle request with its 2.3 MB plan took 11 to 14 ms, once 55 ms, from
  the end of the seed call to its receipt.
- The sidecar's `reuse()` took 15 to 64 ms over the seeded recipe, and 13 ms
  without a seed. It always failed, because the edited file had changed.
- Then the bundle setup took 7 to 12 ms and `PlannedRelative.create` 18 to
  35 ms.

### The compile

- One guarded compile made 9,506 plugin callbacks: 4,443 file loads with
  6.6 MB of source, 3,548 resolves through the plan filters, 450 for `react`
  and `react-dom`, 290 for the JSX runtime with 1 load of its shim, 193 for
  `mokly:runtime`, 186 for `@mokly/mokly` with 186 virtual loads, 168
  configured files, and 41 style and CSS hooks.
- Of the 3,548 plan resolves, 2,478 were relative imports inside
  `node_modules`, 745 relative imports in the repository, 15 relative
  `require` calls, and 310 bare imports.
- In probed Serve sessions, esbuild's Go process used 1.7 to 2.4 s of CPU in
  each compile, about 2.1 cores. The Node main thread was busy about half of
  the compile.
- Offline replay of one captured edit request, 7 interleaved rounds, mean
  compile: 598 ms. Without the file load hook: 559 ms. Without the plan
  resolve hooks: 502 ms, with the changed output. Without both: 404 ms.
- A profile of five offline bundles gave the main thread per bundle: about
  73 ms in esbuild's JavaScript protocol, 28 ms of UTF-8 decoding, 21 ms of
  pipe writes, 29 ms of file reads, and 39 ms of garbage collection.

### Kept esbuild context

- Offline, interleaved with fresh compiles in the same process: fresh median
  564 ms, rebuild median 437 ms. esbuild's CPU fell from about 1,380 ms to
  about 750 ms. The esbuild process held 510 to 540 MB after the rebuilds.
  Six edits gave equal results: code, module graph, digests,
  inputs, directory lists, sources, and peers, in the sorted wire form,
  without the identity, the toolchain, and the random runtime key.
- In Serve, four session pairs of 6 edits, `main` first in each pair: compile
  mean 759 ms against 672 ms on `main`, and peak PSS mean 3,813 MiB against
  3,019 MiB. The order note below favours the second session, so the order
  does not explain the slower compile. One
  traced session sent its 5 edit bundles to 3 processes. It created 3
  contexts and reused one twice. The pool ranks bundle requests by the last
  compilation of each slot, and the return pass replaces processes, so one
  process cannot keep the context.
- On 2026-11-22, on `main` at `1a2534d03`, with a release core on 4 vCPU,
  traced sessions sent every edit to one process: 9 of 9 cold mokly-cloud
  edits, 2 of 2 warm ones, and 9 of 9 on examples/basic with 2 and with 4
  sidecars. The head bundle rank chose the idle process that compiled last
  each time. So the 3 contexts of the run above came from a prototype that
  changed the timing, not from the rank.
- A rebuild still runs every plugin callback: 4,443 file loads and 3,548
  planned resolves. So it saves about 100 ms of the compile of about 600 ms,
  not more. The guarded attempt registers 428 KB of filter regular
  expression source, which each fresh build compiles again and a context
  compiles once.
- A first prototype kept the plugin state of the request that created the
  context, through the hook closures of the context: the file contents, the
  plan, and its maps. It raised the cold 10-edit peak by 63 and 68 MiB in two
  runs of 4 pairs, all in the Node heap. With hook shapes only in the
  context, 6 cold 10-edit pairs gave a peak 90 MiB lower than `main` (−2.8%).
- The esbuild service of the edit process held 311 to 442 MiB after each
  bundle on `main`, and 306 to 397 MiB with a kept context.

### After the kept context (2026-11-22)

The user's official check compared the prototype at `7d3aa2731` with `main`
at `67e726c64`. Both arms used the release core of `main`, so only the dist
differed, and each arm had its own warm cache.

| Measure                                                                | `main`                 | Kept context                          |
| ---------------------------------------------------------------------- | ---------------------- | ------------------------------------- |
| mokly-cloud, 6 warm rounds of 3 edits: edit to published Changes       | 1.81 s                 | 1.72 s (−98 ms; 5 of 6 rounds faster) |
| Same: compile of edits 2 and 3                                         | 559 and 579 ms         | 448 and 454 ms                        |
| Same: compile of edit 1                                                | 721 ms                 | 694 ms                                |
| mokly-cloud, 8 pairs of warm restarts: `serve.ready`                   | 1,060 ms               | 1,044 ms                              |
| mokly-cloud, 4 pairs of cold 10-edit sessions: whole-tree peak         | 3,092 MiB              | 3,096 MiB (+0.2%)                     |
| examples/basic, 2 sidecars, 4 warm pairs: edit; restore; first Changes | 1,771; 1,084; 4,584 ms | 1,754; 1,090; 4,413 ms                |
| examples/basic, 2 sidecars, 4 cold pairs: whole-tree peak              | 2,067 MiB              | 2,084 MiB (+0.81%)                    |

### Sidecar cuts

A prototype with five cuts ran against `main` in ABBA order, 20 warm edits
each: a synchronous `realpath` for the `@mokly/mokly` importer, concurrent
checks in `PlannedRelative.create`, digests in the file load callback, one
`observe` per path, and no `DependencyUsage.resolved` call for relative names
in the proof.

- The proof went from 39 ms to 26 ms and the inputs phase from 20 ms to
  16 ms. The setup before the compile did not change.
- The compile was 48 ms slower and the publication 80 ms later. These lie
  within the noise of about 50 ms between sessions.
- Peak PSS: 3,054 MiB against 3,056 MiB.
- Six offline edits gave equal results to `main`.

### After the change of 2026-11-22

The user's official gate compared the change at `0ddfe044b` with `main` at
`249fa1aa5` on mokly-cloud, in 6 warm rounds of 3 edits each. A warm edit
reached published Changes in 1,882 ms against 1,984 ms, and `watch.action`
took 1,210 ms against 1,322 ms. For each edit, `catalogue.bundle` took 930 ms
against 1,011 ms, and the `sidecar.bundle` span of the bundling process 887 ms
against 917 ms. So the seed, the transfer, and the decode took 43 ms against
94 ms. In 4 cold sessions of 10 edits for each arm, the whole-tree memory
peak was 3,149 MiB against 3,155 MiB on `main`.

### Method note

Runs on two fixtures, with the sessions in the order A then B, showed B about
200 ms faster to publication. `main` gave the same faster times when it ran
second on the second fixture. ABBA order on one fixture showed no gain for
the same arm B. Compare arms only in ABBA order on one fixture.
