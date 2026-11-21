# Split of the warm Serve edit bundle

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Closed experiment record.
- **Added:** 2026-11-21, from the bounded split of the Serve edit bundle on
  branch `calummoore/mokly-edit-bundle-path-kv2o`, on `main` at `377111494`,
  PR #463.
- **Location:**
  - `packages/mokly/src/sidecar/bundle.ts:173`: `bundleAttempt`, which runs
    the guarded compile at line 249.
  - `packages/mokly/src/sidecar/plugins.ts:46` and `:181`: the file load
    callback and the resolve callback of each compile.
  - `packages/mokly/src/sidecar/planned-relative.ts:27` and `:75`:
    `PlannedRelative.create` and the guarded import proof `verify`.
  - `packages/mokly/src/sidecar/bundle-recipe.ts:43`: `bundleRecipe`, the
    phases after the compile.
  - `crates/mokly-render/src/plan_inputs.rs:11`: the plan check of the core.
- **Reason:** The split found no set of safe changes inside the scope of the
  branch that projects 60 ms or more for each warm edit, so no work follows
  here. The largest safe lever is in another owner's files and has its own
  item, [serve-edit-released-recipe-seed.md](./serve-edit-released-recipe-seed.md).

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
  - The section "Measurements" below gives the fixture, the method, and every
    number.
- **Problem:** A warm edit of mokly-cloud spends about 940 to 980 ms in the
  core's `catalogue.bundle` span. The compile takes about 600 ms of it. The
  safe cuts inside the scope of the branch, without a protocol change,
  project about 32 to 54 ms together, and 17 ms of that is measured.
- **Impact if no action:** Each warm edit keeps its current bundle time. The
  seed lever of the related item can still take about 50 to 75 ms.
- **Root question:** How can a warm one-line edit of mokly-cloud reach
  published Changes at least 100 ms sooner through a shorter edit bundle,
  with the same bytes, warnings, and diagnostics, and a memory peak within
  2% of `main`?
- **Options:**
  - **A.** Change nothing in the scope of this branch. This is the outcome of
    the stop rule of the task on 2026-11-21. Effort: Small.
  - **B.** Cheaper guarded import proof. Observe each module path once in
    `ModulePaths.observe`, and skip the `DependencyUsage.resolved` call,
    which does nothing for a relative name. Measured: the proof went from
    39 ms to 26 ms (means of 20 warm edits each, ABBA order). Effort: Small.
  - **C.** Check the plan record in the core on several threads. The check
    took about 20 ms of CPU for each edit, one filesystem comparison after
    another. Projected: 10 to 15 ms less. Effort: Small.
  - **G.** Leave the sources out of a salted identity. A `serveEdit` compile
    mixes its random runtime key into its identity, so the identity is unique
    anyway. Its hash of every module path, import list, and source byte has
    no purpose there. The per-module digests stay. No protocol change.
    Projected: 5 to 12 ms of the inputs phase. Effort: Small.
  - **H.** Skip the `DependencyUsage.resolved` call for relative names also
    during the compile: in `plannedResult`, for about 3,238 planned relative
    resolves, and in the full-path resolve callback. No protocol change.
    Projected: at most about 10 ms of main-thread time. Effort: Small.
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
  - **E.** Keep one esbuild build context in each sidecar process for the
    guarded attempt. Each rebuild delegates every hook to the plugins of the
    current request, and any change of the options or of the hook list
    starts a fresh context. Offline, the compile fell from 564 ms to 437 ms
    (medians) with equal results. In Serve, the pool sent the edits to
    several processes, each process kept its own context, and the peak
    memory rose by 26%. It needs a change in `session.ts`, because the
    operation event of each esbuild call comes from its compile wrapper. It
    also needs a new decision beside the one in the section "Edit Requests",
    which rejected a kept build context in place of plans. Effort: Large.
  - **I.** Pin one esbuild context. Keep the context of E in one head process,
    send every `serveEdit` bundle to that process, and keep that process out
    of the return pass. Stop the esbuild service of every other process after
    its bundle, as option B of
    [esbuild-memory-after-bundle.md](./esbuild-memory-after-bundle.md)
    proposes. Nobody has measured whether the stopped services free more
    memory than one context keeps. It needs the pool, `session.ts`, and a new
    decision. Effort: Large.
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
    processes.
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
  - [serve-edit-released-recipe-seed.md](./serve-edit-released-recipe-seed.md)
    holds the seed lever, the largest safe lever of this split.
  - [serve-postcompile-import-proof-cost.md](./serve-postcompile-import-proof-cost.md)
    estimated the cuts of option B at 5 to 12 ms on another corpus.
  - [esbuild-memory-after-bundle.md](./esbuild-memory-after-bundle.md) holds
    the memory that each esbuild service keeps after a bundle. E adds live
    memory to it, and I depends on its option B.
- **Recommendation:** A for the scope of this branch. Without a protocol
  change, B, C, G, H, and the digests of D project about 32 to 54 ms, below
  the 60 ms bar. With approved protocol sentences for D and F, a measured
  prototype of B, D, F, G, and H projects about 57 to 79 ms, with 17 ms
  measured. E fails the memory bar. The 100 ms goal needs other owners:
  options F and H of the seed item, with B, C, D, and G, project about 105 to
  150 ms.
- **Action:** No action in this branch. A later proposal that combines these
  cuts with the seed lever needs its own scope decision.

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

### Method note

Runs on two fixtures, with the sessions in the order A then B, showed B about
200 ms faster to publication. `main` gave the same faster times when it ran
second on the second fixture. ABBA order on one fixture showed no gain for
the same arm B. Compare arms only in ABBA order on one fixture.
