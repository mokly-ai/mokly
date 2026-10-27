# Parallel Background Pass

Status: Active. On branch `conductor/perf-3-parallel-background-pass`, no
pull request yet. The plan closes when its PR merges.

After Serve listens, its background pass renders every view. The pass fills
the render cache and the usage of every entry detail, and Changes starts
after it ends. The pass renders one view at a time: `UsagePass::fill` in
`crates/mokly-server/src/background.rs` awaits each render before it starts
the next one. On `examples/basic`, 702 documents and 606 fragments take
19.0 s, and every watched rebuild runs the pass again.

This plan renders the pass in bounded batches. On 2026-10-27, before this
plan, the user chose option A of performance item 5: bounded batches sized to
the worker count. The foreground priority, the cancellation on replacement,
and the completion publication as one step after the pass stay. Changes still
starts only after the pass. Running the two at the same time is a separate
decision of the perf 6 item. The plan does not change the sidecar admission
gate, the render cache, or the Changes phases.

Contract owners:

- [On-demand Serve contract](../docs/protocol/mokly-on-demand.md): the pass,
  foreground priority, batches, failure reports, and cancellation.
- [Runtime contract](../docs/protocol/mokly-runtime.md): the summary of
  background work in its Serve section.
- The [mokly-server README](../crates/mokly-server/README.md) and the
  [mokly-cli README](../crates/mokly-cli/README.md).

## Decisions

The user answered these on 2026-10-27, after the plan review.

1. Batch shape: A, a sliding window, which starts the next view when any
   view of the batch ends. Rejected: B, fixed batches, which start N views
   and wait for all N, like the comparison capture. Reason: the estimate
   below gives 2.6 s for A and 4.1 s for B at eight, and the target is 4 s.
2. Batch size: B, the smaller of the worker count and the sidecar count, at
   least one. Rejected: A, the worker count, because with fewer sidecars
   than workers its extra renders wait in the sidecar queue, where
   foreground calls have no priority. Rejected: C, the worker count minus
   one, because it slows every pass by one eighth on eight cores and by half
   on two cores. Reason: B equals A by default.
3. Start order: A, catalogue order. When several queued renders wait for one
   free worker, the first in catalogue order starts. Rejected: B, no order
   inside the batch. Reason: A costs nothing in the window design and keeps
   tests deterministic.
4. Failure reports: B, failures in catalogue order, each as soon as every
   earlier render of the pass has ended. Rejected: A, a report when each
   render ends, because the order then changes between runs. Rejected: C,
   every report when the pass ends, because a report can wait for the whole
   pass. Reason: B keeps the serial pass's order and delays a report by at
   most the earlier renders that still run.

Each failure is reported once, through `Diagnostics::failed`. A failure that
is not reported before a stop or a replacement is discarded, as the serial
pass discards a failure that ends after one.

## Corrections to the item text

- The pass bound is the Serve worker scheduler, `Workers` in
  `crates/mokly-server/src/work.rs`: the core count, at most eight. The
  render thread pool, `ThreadWorkers`, has one thread per core. Both are
  eight on the measuring machine.
- The sidecar pool spawns its processes on demand. During the serial pass
  only one sidecar runs: it rendered 500 fragments, recycled, and the next
  process rendered 54. The parallel pass spawns up to eight sidecars. Each
  costs about 0.3 s to spawn and 0.2 to 0.3 s to replay the generation, in
  parallel. The base side then reuses them.
- `Workers::background` already admits concurrent calls with foreground
  priority, so the change needs no edit in `work.rs`.
- `mokly-runtime.md` mentions the pass in one sentence of its Serve section.
  The on-demand contract owns the rules of the pass. The page has 247 of its
  250 lines, so its change keeps the line count.
- On this machine the baseline differs from the item's table: warm
  `changes.classify` takes 83.0 s, and the React fixture's pass takes 2.8 s.
  The targets stay: under 4 s on the example, under 1 s on the fixture.

## Baseline

Measured on 2026-10-27 with the shared method of the perf workspaces: 8 cores,
16 GB, the release build of the merge base `a9dd1e81`, and a warm OS cache
directory. Each catalogue value is the median of three runs. The edit run
ran once.

| Number                                  | `examples/basic`                 | Small React fixture             |
| --------------------------------------- | -------------------------------- | ------------------------------- |
| `serve.ready`                           | 21.1 s                           | 11.3 s                          |
| `serve.background`                      | 19.0 s, 702 documents, 606 frags | 2.8 s, 574 documents, 162 frags |
| `changes.classify`                      | 83.0 s                           | 15.2 s                          |
| of which `review.base-tree`             | 50.9 s                           | 14.5 s                          |
| of which `review.capture-side`          | 7.8 s                            | 1.9 s                           |
| of which `review.compare-views`         | 30.8 s                           | 0.4 s                           |
| `sidecar.render` count                  | 2,098                            | 324                             |
| `css.bundle` count and union            | 152, 14.5 s                      | 12, 0.3 s                       |
| Edit run: `watch.action`                | 16.6 s                           |                                 |
| Edit run: `serve.background` after edit | 20.4 s, 670 documents, 554 frags |                                 |
| Edit run: `changes.classify` after edit | 102.6 s                          |                                 |
| Edit run: edit to second classification | 139.6 s                          |                                 |

A window estimate from the serial render durations gives 2.6 s for a sliding
window of eight and 4.1 s for fixed batches of eight. During the serial pass,
uncached foreground document requests took 7 ms at the median and 12 to
13 ms at the 90th percentile.

Evidence: `.context/parallel-background-pass/baseline.md`, with the raw
records under `.context/perf/`.

## Design

The design follows the decisions above.

- **Window.** `fill` walks the routes in catalogue order and keeps at most
  `batch` renders in flight. Before it starts a route, it checks the stop
  signal and the replacement, and it skips a route that already has a
  completion. It then waits for the first render of the window to end, a
  stop, or a publication update. A new module beside `background.rs` holds
  the window, so both files stay under 200 lines.
- **Admission.** Each render still calls `Work::background`. That call waits
  until no foreground request is active and a worker permit is free. A
  foreground request takes the next free permit before any queued
  background render. An active background render is not interrupted.
- **Order.** The window keeps its renders in start order and polls them in
  that order. When several renders wait for one free permit, the first in
  catalogue order takes it. The window needs no new dependency.
- **Failures.** The window holds a failure until every earlier render has
  ended. Then it reports the held failures in catalogue order.
- **Cancellation.** A stop or a replacement returns from `fill` and drops the
  window. A queued render never starts. A render that already runs on a
  blocking thread finishes under its deadlines, and its result is discarded,
  as the one active render of the serial pass is today.
- **Publication.** One `completed_many` call after every route has ended, as
  today.
- **Batch size.** `UsagePass` gets a `batch` field. The server crate does
  not know the sidecar count, so the CLI composition root sets the field. A
  pure function in `crates/mokly-cli/src/serve_delivery.rs` gives the
  smaller of the worker count and the sidecar count, at least one. It reads
  the sidecar count from a new `limit` method of `PoolScheduling` in
  `crates/mokly-cli/src/serve_pool.rs`. The call in `entry_serve.rs`, which
  the perf 0 item changes, stays as it is.

## Milestone 1: Documentation and protocol

State the batch requirements and the decisions in force, so that the review
can check the code against them.

- [x] Record the answers to the open decisions above, with the date.
- [x] Update `docs/protocol/mokly-on-demand.md`, "Foreground Documents": a
      queued background render does not start while a foreground request
      is active, and a foreground request that finds every worker busy
      waits for the first active render to end.
- [x] Update `docs/protocol/mokly-on-demand.md`, "Background Work And
      Replacement": the batch bound, the start order, the failure reports,
      and the cancellation of queued renders. Put the decisions in force for
      decisions 1 and 2 next to their requirements, with the rejected
      option and the reason.
- [x] Update the Serve section of `docs/protocol/mokly-runtime.md`: the
      background work renders in bounded batches under the on-demand
      contract. Keep the page at or under its 250-line cap.
- [x] Update `crates/mokly-server/README.md`: `UsagePass` renders a bounded
      sliding window. The `### Key Code` entry of the new module waits for
      milestone 2, when the module exists.
- [x] Update `crates/mokly-cli/README.md`: Serve sizes the pass from the
      worker count and the sidecar pool bound.

## Milestone 2: Bounded batches in the usage pass

Render the pass in bounded batches and size them in the Serve composition.
Write each failing test before its code.

- [ ] Add `crates/mokly-server/src/_tests_/background_batch_tests.rs` with
      real `Workers`, gated `DocumentsMock` renders, and mocked
      publications. Use gates, event order, and counts, never elapsed time.
  - [ ] A batch yields to a foreground request: two workers, a batch of
        two, and four routes. At most two renders run at once. A foreground
        request that arrives while both run starts before the third route.
  - [ ] Queued renders start in catalogue order: one worker and a batch of
        three wait behind a foreground request. They start in route order.
  - [ ] A replacement during a batch cancels it: the replaced generation's
        queued routes never render. The replacement's routes render. Only
        the replacement publishes its completion.
  - [ ] A stop during a batch returns without a completion publication, and
        no queued route starts.
  - [ ] Failures report once in catalogue order: routes end in the order
        b, c, a, and c and a fail. The diagnostics receive a, then c, and
        receive nothing before a ends.
- [ ] Add the window module and the `batch` field of `UsagePass`. Rewrite
      `fill` over the window. Add the module under `### Key Code` in
      `crates/mokly-server/README.md`.
- [ ] Add `PoolScheduling::limit` in `crates/mokly-cli/src/serve_pool.rs`.
      Add the batch size function to `crates/mokly-cli/src/serve_delivery.rs`
      with a unit test, and set the batch there.
- [ ] Add the `batch` field to the existing pass tests and to
      `crates/mokly-server/tests/http/evidence_tests.rs`. Keep every
      assertion. Keep the existing foreground tests green.
- [ ] Run `cargo test -p mokly-server`, `cargo test -p mokly-cli`,
      `cargo clippy --all-targets -- -D warnings` for both crates, and
      `cargo fmt --all -- --check`.
- [ ] Run `cargo xtask check --suite repository`.

## Milestone 3: Measurement and smoke test

Measure after the change with the same method and machine, and prove that
Browse works.

- [ ] Rebuild the release binary. Run the example serve run, the edit run,
      and the React fixture run with the shared method. Rerun when two runs
      differ by more than ten percent. Report every baseline number for the
      new build in this plan and in the pull request body.
- [ ] Check the acceptance: `serve.background` under 4 s on the example with
      702 documents and 606 fragments, and under 1 s on the React fixture.
- [ ] Run the foreground probe, `.context/perf/run-probe.mjs`, on the new
      build, and compare it with the baseline probe.
- [ ] Smoke test: run `npm run dev`, open Browse in Chrome while the pass
      runs, open one screen and its Changes state, and save a screenshot
      under `.context/parallel-background-pass/`.

## Milestone 4: Verification, commit, review, and pull request

- [ ] Run `npm test -- tests/markdown_links.test.ts` and
      `npm run format:check`.
- [ ] Run the complete gate, `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request with the before and after table when every other
      milestone TODO is ticked. Put its link in the status paragraph.
