# Prepare new head generations before their renders

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Closed experiment record.
- **Added:** 2026-11-19, from the performance orchestrator's decision to keep
  the head preload of branch `calummoore/mokly-generation-prefetch` as a
  record and to open no product pull request for it. Updated 2026-11-21 with
  the official result of experiment D and its rejection by the user, from the
  prototype on branch `calummoore/mokly-edit-critical-path-o9ma`. Updated
  2026-11-22 with the frame measurement of the viewer live-update work, from
  the branch `calummoore/mokly-viewer-live-update-lpaj`.
- **Location:** `crates/mokly-sidecar/src/pool_preparation.rs`
  (`Pool::prepare` and `Pool::restore`), `crates/mokly-sidecar/src/pool_return.rs`
  (`Pool::maintain_return`), `crates/mokly-sidecar/src/pool_head.rs`
  (`Pool::record_head`), `crates/mokly-sidecar/src/pool_releases.rs`
  (`Pool::record_release` and `clean_idle`), `crates/mokly-render/src/bundle.rs`
  (the core's `cssModules` and `describe` after a bundle),
  `crates/mokly-cli/src/serve_return.rs` (the Serve background worker), and
  `packages/mokly/src/sidecar/session.ts` (`restoreGeneration`, `describe`, and
  `dispose`).
- **Reason:** The user rejected experiment D, the third measured attempt
  without a net edit gain, on 2026-11-21, so no work follows.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Head generation:** one bundled version of the catalogue JavaScript of
    the working repository. A sidecar process needs `restoreGeneration`,
    `cssModules`, `describe`, and `bindings` for it before it renders a view.
  - **Bundling process:** the sidecar process that ran the `bundle` request of
    a generation, so it holds that generation already.
  - **`serve.background`:** the Serve timing stage that renders the changed
    views of an edit over all sidecar processes.
  - **Head preload:** the attempt of 2026-11-19. After the core's `describe`
    of a new head generation, the Serve background worker prepared that
    generation on each other idle head process, one process at a time.
  - **mokly-cloud:** the measurement catalogue of the performance
    orchestrator: 167 entries, 1,508 views, 4 vCPU, and a pool of 4 sidecars.
    Experiment D of 2026-11-21 used two sidecars.
- **Background:**
  - Timeline of 2026-11-18 on mokly-cloud: a normal Serve edit took about
    2.85 s from the file write to Changes ready. The head bundle runs on one
    process, and the core then sends `cssModules` and `describe` to that
    process. The core then runs `render.inputs` and `graph.prepare` for about
    350 ms, and `graph.prepare` sends one `bindings` request. Then
    `serve.background` renders about 44 changed views over the 4 processes.
  - In that timeline, each of the 3 processes that did not bundle spent
    110 ms to 250 ms on `restoreGeneration`, `cssModules`, and `describe` when
    the first render reached it. That work is on the critical path of
    `serve.background`. The same processes are idle during the 350 ms before
    it.
  - Both attempts kept these rules: idle head processes only, one call at a
    time on a process, a stop before the next call when a request waits or
    when a call that Serve admitted has not reached the pool queue yet, no
    process start, the newest head generation only, the existing release
    path, and no output change. Both measurements used release builds, the
    same dist, 6 interleaved rounds against main `3e624480e`, and one cgroup
    for each run.
  - Attempt 1, commit `062429a48`, preloaded `restoreGeneration`,
    `cssModules`, and `describe`:
    - `serve.background` per edit fell from 740, 540, and 466 ms to 616, 430,
      and 364 ms, about 110 ms less.
    - The mean sidecar bundle of the three edits went from 1,323, 1,248, and
      1,213 ms to 1,276, 1,357, and 1,388 ms: 47 ms less, then 109 and 175 ms
      more.
    - `watch.action` went from 2,023, 1,761, and 1,664 ms to 2,037, 1,923,
      and 1,900 ms.
    - Edit to ready rose from 2.83 s to 2.88 s.
    - Peak memory demand, cgroup anonymous memory plus swap, rose from a mean
      of 2,818 MiB to 3,043 MiB, about 8%.
  - A pool test and a Serve trace of attempt 1 explain the memory. The trace
    used `examples/basic`, 4 sidecars, and five edits, with the preload on
    and off. The release path drops a preloaded generation exactly as a
    rendered one, and at the next bundle no process holds more than the
    newest head generation. But the core releases the old head generation
    only when the new state replaces the published one, at the start of the
    next `serve.background`. So each preloaded process evaluated the new
    generation while the old one was still published, and held two evaluated
    head generations until that release. Without the preload, a render first
    disposes the old generation and then loads the new one.
  - Attempt 2, commit `1e01658c0`, preloaded only `restoreGeneration` and
    `cssModules`, and the first render still sent `describe`:
    - `serve.background` per edit fell from 738, 557, and 476 ms to 630, 516,
      and 419 ms, 69 ms less on average.
    - `watch.action` went from 2,029, 1,781, and 1,582 ms to 2,089, 1,836,
      and 1,743 ms: 60, 55, and 161 ms more.
    - The mean sidecar bundle went from 1,315, 1,270, and 1,128 ms to 1,343,
      1,272, and 1,219 ms.
    - Edit to ready went from 2.82 s to 2.86 s.
    - Peak memory demand stayed equal: 2,812 MiB and 2,817 MiB.
  - The orchestrator reads attempt 2 as CPU contention. The three restores
    run during validation, `render.inputs`, and `graph.prepare`. For each
    restore, the core encodes the recipe payload of about 4.5 MB, and the
    Node process parses it.
  - Without the bundle, attempt 1 still cost `watch.action` about 50 to 60 ms
    for each edit, and attempt 2 about 30 to 70 ms. Attempt 2 also showed a
    bundle 91 ms slower on the third edit, so the overlap may not be the only
    cause of slower later bundles.
  - The acceptance bar of 2026-11-19 is a net edit-to-ready gain of at least
    30 ms for each edit on mokly-cloud, peak memory demand within 2% of main,
    and no slower sidecar bundle on later edits. Both attempts missed it.
  - Official experiment D of 2026-11-21 is the third attempt. The section
    "Official experiment D, 2026-11-21" at the end of this record holds its
    fixture, design, bars, results, checks, and outcome. D prepared the new
    generation on one idle head process before the publication, and that
    process first disposed its older head generations. Its warm edits were
    0.07 s slower than `main`, and its peak memory was 3.8% higher. The user
    rejected it.
  - Experiment D is not option D of this record. The letter D names the
    experiment there. Option D below is a different approach, and nobody
    measured it.
  - The frame measurement of 2026-11-22 tested no preload. It measured the
    frame update of an open view page, on `main` and on the branch of the
    viewer live-update work. With two head sidecar processes, the one that did
    not bundle ran `describe` at its first render, in 60 to 101 ms. That
    render took 130 to 230 ms, and a first render on a warm process took
    35 to 70 ms. None of the three attempts measured the frame update. The
    last section of this record, "Frame measurement, 2026-11-22", holds its
    fixture, results, and outcome.
- **Problem:** The processes that did not bundle a new head generation still
  prepare it on the critical path of `serve.background`. The two attempts of
  2026-11-19 to prepare it earlier cost as much CPU in the core window, or as
  much memory and bundle time, as they saved. Experiment D of 2026-11-21
  prepared it earlier with a disposal first, and it was slower and used more
  memory than `main`.
- **Impact if no action:** Each edit on mokly-cloud keeps 110 ms to 250 ms of
  preparation on each process that did not bundle, inside `serve.background`.
  That range comes from the 4-sidecar timeline of 2026-11-18. This record
  holds no isolated measurement of it with two sidecars. The preparation also
  delays the frame update of an open view page: on 2026-11-22, 6 to 11 of 28
  frames waited 50 ms or more.
- **Root question:** How can Serve take the preparation of a new head
  generation off the critical path of `serve.background`, without a slower
  core window, a slower later bundle, or more peak memory?
- **Options:**
  - **A.** Change nothing. This is the settled outcome of 2026-11-21. Effort:
    Small.
  - **B.** Attempt 1 with an eviction first. Before the preload evaluates the
    new generation on a process that did not bundle it, the pool disposes the
    old head generation on that process. The bundling process keeps the old
    generation, so requests of the published state can still find it. No
    process then holds two evaluated head generations. Cost: a new pool rule
    that disposes a live generation on one process, a restore when a request
    of the old state reaches an evicted process, and the window CPU of three
    restores and evaluations. On 2026-11-21, experiment D tested a bounded
    form of B with two sidecars. It missed its speed and memory bars, and the
    user rejected it. Effort: Medium.
  - **C.** A cheaper restore payload. Encode the recipe of a generation once
    and reuse the bytes for each process, or write it once to a shared file
    that each process reads. This cuts the core-side encoding from three times
    to once, and a shared file can also cut the Node parse. Cost: a pool or
    protocol change, file lifetime rules for a shared file, and a measurement
    of the Node parse share. This record holds no measurement of C. Effort:
    Large.
  - **D.** A cheaper preparation in the sidecar, with no preload. Make
    `restoreGeneration` and `describe` themselves faster, for example with a
    lighter recipe format or an evaluation that skips modules that no changed
    view needs. This shortens the critical path on every process without new
    background work. Cost: sidecar changes in evaluation, and new evidence
    that the skipped modules cannot change a view. This record holds no
    measurement of option D. Option D is not experiment D. Effort: Large.
  - **E.** B and C together. This record holds no measurement of E. Effort:
    Large.
- **Left out:**
  - A preload that starts after the new state is published, because the
    release of the old generation and the first renders both happen at the
    start of `serve.background`, so no idle time is left for it.
  - A preload of every candidate at once, because it adds CPU contention in
    the core window, which both measurements show as the main cost.
  - A preload of one process for each edit, because it saves at most a third
    of the gain against the same cost for each process.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** PR #313 keeps head processes ready after base work,
  and PR #315 ranks idle processes by the loaded state that a call needs.
  Commit `fd3b3b126` holds the rejected prototype of experiment D.
- **Related:**
  - [serve-sidecar-prestart.md](./serve-sidecar-prestart.md) also proposes a
    replay of the generation before the background pass. Its measurements
    should use the overlap rule above.
  - [sidecar-loaded-state-selection.md](./sidecar-loaded-state-selection.md)
    chooses processes by their loaded state. An eviction rule as in option B
    changes that state, so design the two together.
  - [dispose-older-head-generations.md](./dispose-older-head-generations.md)
    holds a separate post-merge task: a disposal rule at render time, and an
    earlier start of the background pass after a publication. Experiment D
    disposed older generations only in its early preparation, before the
    publication. So D did not test that task, and the task stays open.
  - [serve-postcompile-import-proof-cost.md](./serve-postcompile-import-proof-cost.md)
    and [serve-watch-candidate-plan-cost.md](./serve-watch-candidate-plan-cost.md)
    record experiments H and C of the same day. Both stopped without a
    candidate. Experiment C is not option C of this record.
- **Recommendation:** A. The first recommendation was B, measured once.
  Experiment D measured a bounded form of B on 2026-11-21. It missed its speed
  and memory bars, and the user rejected it. Its result rejects the assumption
  that a disposal before each early restore is enough to meet those bars. The
  section "Rejected assumption" below gives the evidence.
- **Action:** No action. The rejection of experiment D on 2026-11-21 is
  settled, and no current decision waits for the user. A later proposal that
  differs materially from these three attempts needs new evidence and its own
  scope approval. The frame measurement of 2026-11-22 is new evidence, but the
  performance orchestrator kept option A on 2026-11-22, and only the user can
  reopen the preload.

The code of both attempts is on the branch
[`calummoore/mokly-generation-prefetch`](https://github.com/mokly-ai/mokly/tree/1e01658c0a6c5420e340364f09f8aff87fae1c41),
commits `062429a48` and `1e01658c0`. The rejected prototype of experiment D is
commit
[`fd3b3b126`](https://github.com/mokly-ai/mokly/tree/fd3b3b12679a791679640053bb341b58956c0912)
on the branch `calummoore/mokly-edit-critical-path-o9ma`.

## Official experiment D, 2026-11-21

The Serve edit experiments of 2026-11-21 named this attempt D. Two other
bounded experiments of that day, H and C, have their own records. The
**Related** line above names them.

### Fixture and method

- The catalogue is the `mokly-ai/mokly-cloud` repository at commit
  `194fdb78`, of 2026-11-06, with its retention change #85. Two local scratch
  commits sit on top: `5b981d5d`, for Mokly 0.19.0, and `bbed663a`, with a
  `mokly.subset.json` that the runs did not use.
- The runs use the catalogue's own `mokly.config.json`. Its roots are
  `docs/mockups/src/entries/**/*.mockup.{ts,tsx}`. Its renderer is
  `docs/mockups/src/render.tsx`. It renders light and dark. Serve runs with
  `--base HEAD`.
- The setup has 1,508 views, 4 vCPU, and two sidecars.
- The control is `main` at `77021d88cf483f56943b7ebaea462ca787c29951`, PR
  #452. The candidate is the prototype at
  `fd3b3b12679a791679640053bb341b58956c0912`. Each arm uses its own core and
  its matching sidecar dist, copied under `ts/node_modules/@mokly/`.
- The official edit changes the `TITLE` text on line 35 of
  `docs/mockups/src/screens/product/settings/slug-editor.tsx`. Each session
  restores the exact source afterwards.
- A snapshot-quiet gate guards the runs against the workspace snapshot agent.
- The performance orchestrator owns the official measurements.
- An edit endpoint is the time from an edit to Changes ready. A cold ten-edit
  session starts cold and makes ten edits. The whole-tree peak is the peak
  memory of the core, the sidecars, and esbuild together.

### Design of the prototype

- D starts after the first Changes result of the session and after a
  successful `serveEdit` head bundle of the edit.
- It prepares one existing idle head process other than the bundling
  process. It uses the existing Serve maintenance worker and starts no
  process.
- It renders no document, publishes no state, and sends no early `bindings`
  request.
- It never selects a process that holds a live PostCSS context of the current
  attempt.
- The selected process first disposes its older loaded head generations. The
  pool keeps the recipes of every live generation centrally.
- The process then restores the new generation, installs the maps of the
  current lifetime, and runs a quiet `describe`. The quiet evaluation waits
  until the core starts its visible `describe`.
- Until the new head state is published, a request of the older published
  state uses another process or waits for the bundling process.
- Before each call, D yields to a queued request, an admission wait, or a
  claim in transit. A call that already runs on the bundling process
  continues.
- These events end pending early work: a new, second, or failed bundle, a
  failed serialized candidate, a publication, the final release, a stop, and
  disabled background work. The existing epoch cleanup stays.
- Counters count started, adopted, and aborted preparations and the waits of
  older-state requests.
- A new lifetime with the same id ends the pending return warm-up of the old
  lifetime.
- So D tested a bounded form of option B of this record.

### Acceptance bars

- A net gain of at least 80 ms on warm edits.
- Later bundles, first Changes, and readiness no slower beyond noise.
- Waits of older-state requests rare and short.
- A whole-tree peak of cold ten-edit sessions at most 2% above `main`.

The original combined goal of 250 ms was not established.

### Results

Six warm rounds of one-line edits:

| Measure                                      | `main`                 | D                      |
| -------------------------------------------- | ---------------------- | ---------------------- |
| Edit endpoint, first, second, and third edit | 2.23, 1.92, and 1.91 s | 2.36, 2.00, and 1.90 s |
| Edit endpoint, mean                          | 2.02 s                 | 2.09 s, 0.07 s slower  |
| `sidecar.bundle` median of the edits         | 773 ms                 | 782 ms                 |
| First Changes                                | 4.45 s                 | 4.57 s                 |
| Session CPU                                  | 23.3 s                 | 23.9 s                 |

- D started 18 early preparations, adopted 18, and aborted 0. Older-state
  requests waited 0 times.
- So D worked as designed. No failed adoption and no older-state wait
  explains the miss.
- The measurements do not show the cause of the extra memory and CPU.

Four alternating cold ten-edit pairs, whole tree:

| Measure                        | `main`                             | D                                  |
| ------------------------------ | ---------------------------------- | ---------------------------------- |
| Whole-tree peak, runs in order | 3,062, 3,148, 3,117, and 2,962 MiB | 3,292, 3,185, 3,113, and 3,168 MiB |
| Whole-tree peak, mean          | 3,072 MiB                          | 3,190 MiB, 3.8% more               |
| Edit endpoint, mean            | 1.98 s                             | 1.99 s                             |

Four unchanged-restart rounds, in the final block. An unchanged restart
starts Serve again with no unreverted edit.

| Measure             | `main`   | D        |
| ------------------- | -------- | -------- |
| Edit endpoint, mean | 2.10 s   | 2.17 s   |
| First Changes       | 4.47 s   | 4.55 s   |
| `serve.ready`       | 1,310 ms | 1,361 ms |
| Session CPU         | 23.8 s   | 24.6 s   |

- The workspace snapshot agent overlapped two D sessions of this block, for 8
  and 12 samples. Those two rounds are slightly noisier.
- That noise cannot change the outcome. The warm 80 ms bar and the 2% memory
  bar already fail on their own.

### Rejected assumption

- The first recommendation of this record was B, measured once. It gave this
  reason: "Attempt 1 gave the larger background gain, and its two misses, more
  memory and slower later bundles, follow from the overlap that B removes. Its
  window cost without the bundle was about 55 ms, so B can pass the bar if the
  bundle slowdown goes with the overlap." It also said that option C best
  attacks the window cost, and that C could follow B when the window cost
  alone blocked the bar.
- D tested the assumption behind that reason. The assumption: a disposal of
  older head generations before each early restore is enough to meet the
  speed and memory bars.
- D did not meet its speed and memory bars, although it adopted all 18 early
  preparations and no older-state request waited. So the result rejects that
  assumption.
- The result does not show a cause for the extra memory and CPU. It does not
  rule out a different algorithm.

### Checks of the prototype

These checks ran on the prototype after `main` at `77021d88c` was merged into
it:

- Targeted tests passed: sidecar 216 of 216, Serve 144 of 144, render 16 of
  16, and Node 25 of 25.
- 22 selected tests ran 10 times each. All 220 exact runs passed.
- The first run of the 19 new tests took 0.104715 s in total, with the
  executable startup.
- Focused all-target Clippy of the affected crates, the npm build, the
  package `tsc`, targeted ESLint, Prettier, the Markdown links, and the cap
  and deletion audits passed.
- Failing tests or mutations came first for these cases:
  - disposal and restore before the maps
  - maps of the current epoch with the same id
  - overlap with a running claim
  - a pause for a claim in transit or an admission wait
  - the exclusion of a live PostCSS context
  - the end of pending work at a publication, a new bundle, a failed bundle,
    a release, and a stop
  - the visible evaluation output
  - the rejected-revision hook and the failed-candidate hook
  - an adoption that a stop blocks
  - the wait accounting of older-state requests, with a fake clock
- A local debug Serve smoke with the head only made one edit and one restore.
  It counted 2 started, 1 adopted, 1 aborted, and 0 waits. It restored the
  authored source exactly. It is not an official result, and it is not a byte
  proof of the candidate output.

These checks did not run. They waited for an acceptance that did not come:

- The complete gate and the repository suite.
- The four-fixture proof of equal published bytes, `main` against D.
- The post-push production review, the pull request, and CI. The CI wait of
  the prototype exited with code 3, because no CI run existed.

These partial checks do not establish full product correctness or CI acceptance.

### Outcome

- On 2026-11-21, the user rejected D. No production stage 2, product pull
  request, or merge follows.
- `main` never held D. The protocol docs and the product on `main` stay
  unchanged.
- The prototype branch `calummoore/mokly-edit-critical-path-o9ma` at
  `fd3b3b12679a791679640053bb341b58956c0912` stays as evidence only. Nothing
  on it is in force, and it is not for merging.

## Frame measurement, 2026-11-22

On 2026-11-22, the viewer live-update work measured how soon the frames of an
open view page show an edit. It tested no preload. Its two arms were `main` at
`3362e250d` and the branch `calummoore/mokly-viewer-live-update-lpaj`, with
the core of commit `529039532`. That branch compresses the JSON answers of
Serve, adds validators to resources, and starts requested views first in the
background pass.

### Fixture and probe

- The catalogue is the `mokly-ai/mokly-cloud` repository at commit
  `194fdb78`, on 4 vCPU. Serve runs with `--base HEAD`.
- The edit is the official edit of experiment D: the `title` text on line 35
  of `docs/mockups/src/screens/product/settings/slug-editor.tsx`. Each edit
  renders 44 changed documents in `serve.background`.
- Two head sidecar processes serve the renders. The second process is the
  head process that did not bundle. After the rebuild, it is cold: it does not
  hold the new head generation yet. A warm process holds it already.
- The browser probe opens `/view/product/settings/project/slug/`, the view
  page of the first changed entry in catalogue order. A view page shows the
  views of one entry in frames. This page shows two frames, mobile and
  desktop. Each frame loads one frame document.
- An update event is the message of the Serve event stream for one
  publication.

### Timed pair

- One session for each arm ran with `--debug-timings`. These times come from
  warm edits 2 to 4 of each session.
- In every edit of both arms, the bundling process ran `describe` during the
  rebuild, in 45 to 54 ms. The second process ran `describe` at its first
  render after the rebuild, in 60 to 101 ms.
- The timings have no span for `restoreGeneration` or `cssModules`. So this
  measurement gives no separate time for them.
- The `render.document` span of the first render on the second process after
  the rebuild took 130 to 230 ms. The first renders on a warm process took
  35 to 70 ms.
- The view page requested its two frame documents about 30 to 115 ms after
  the first update event of the edit. A frame document whose render still
  runs waits for that render.

### Untimed series

The untimed series ran without `--debug-timings`, with the arms interleaved.
Each arm had 4 warm sessions of 4 edits and 2 cold sessions of 2 edits. The
wait of a frame document is the time from its sent request to its response
headers.

| Measure                                              | `main`  | Branch   |
| ---------------------------------------------------- | ------- | -------- |
| Frame documents that waited 50 ms or more            | 6 of 28 | 11 of 28 |
| First frame paint after the first update event, mean | 184 ms  | 196 ms   |
| Last frame paint after the first update event, mean  | 275 ms  | 296 ms   |

- The 28 frame documents of each arm come from 14 edits: edits 2 to 4 of the
  warm sessions and edit 2 of the cold sessions. The longest wait was 185 ms.
- The paint times use the Chrome clock. Their means cover the 12 edits 2 to 4
  of the warm sessions.
- So the last frame paint came about 90 to 100 ms after the first frame paint,
  on average.

### Outcome for this record

- None of the three attempts of this record measured the frame update of an
  open view page. They measured `serve.background`, `watch.action`, the
  bundle, memory, and the time from an edit to Changes ready.
- The branch also starts requested views first in the background pass. In
  this probe, that rule does not avoid the cold second process. The entry that
  the probe opens is already the first changed entry in catalogue order. So
  the pass starts the four documents of the entry first on both arms. One of
  the first renders always reaches the cold second process.
- On 2026-11-22, the performance orchestrator decided that a load of the new
  generation into idle head processes after each head bundle is the head
  preload of this record. The three attempts of that preload missed their
  bars, and the user rejected the third. Only the user can reopen it.
- The orchestrator called this measurement new evidence, because the three
  attempts measured published Changes, not the frame. Option A stays the
  outcome for now.
