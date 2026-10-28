# Parallel Background Pass

Status: Active. [PR #225](https://github.com/mokly-ai/mokly/pull/225) is open.
The plan closes when its PR merges.

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

5. Admission order, decided on 2026-10-28 during milestone 2 under the user's
   rule to apply the recommended option without a stop: A, a fair one-permit
   turn in `Workers::background`, so queued background renders wait for a
   worker one at a time, in request order. Rejected: B, weaken decision 3 to a
   best-effort order. Reason: 300 stress runs of the first window design
   failed twice. One run started a later route first: a worker freed on a
   blocking thread between two polls of one sweep let a later render take
   it. The other run was a drop-order problem in the test harness, fixed in
   the tests. The window's poll order alone cannot prevent the first
   failure, and the turn needs about ten lines. After the turn, 500 runs
   passed.
6. Acceptance targets, decided on 2026-10-28 during milestone 3 under the same
   rule: A, keep the bounded window as built and report the targets as
   missed. On this machine the example pass takes 4.9 to 5.3 s against the
   4 s target, and the React fixture pass 1.8 to 2.0 s against 1 s.
   Rejected: B, extend this branch into the sidecar pool and the graph,
   because the remaining time lies outside the pass scheduler and this
   item's files, and the perf 1, 4, and 5 items change those areas. Reason:
   the measured causes are outside the window:
   - The first wave waits 0.75 to 0.85 s while the pool spawns five more
     sidecars and replays the generation on each.
   - Sidecar renders run about 1.7 times slower under eight-way load. The
     example pass uses 70 to 85 % of the eight cores.
   - The completion publication takes about 0.35 s after the last render.
     Decision A of item 5 keeps it as one step.
   - Concurrent misses repeat about 6 document compositions and 11
     stylesheet bundles per example pass, about 0.2 s of work in total.

   On 2026-10-28 the orchestrator accepted the measured result for this item.
   The sidecar pre-start is a follow-up for a later item.

   Follow-up: start the sidecars and replay the generation before the pass,
   or let a request take the first sidecar that becomes ready. Expected gain
   about 0.8 s per pass. Area: the sidecar pool and Serve startup.
   Follow-up: coalesce concurrent stylesheet bundles of one root; the pass
   bundles 14 instead of 3. Area: the stylesheet cache of the perf 5 item.
   Follow-up: coalesce concurrent compositions of one document key; cache
   hits drop from 106 to 99 or 100 on the example and from 408 to 377 to 380
   on the React fixture. Area: the graph session render.

7. Background warnings, review finding 1, decided on 2026-10-28 under the
   user's rule: B, report each view's build warnings in catalogue order
   through the window, with a failed view's warnings directly before its
   diagnostic. A background render now returns its warnings, and a failure
   keeps them; the pass reports them through `Documents::report`. Rejected:
   A, document the completion order, because warning lines would change
   order between runs, which decision 4 rejected for failures. Rejected: C
   and D, one sorted block at the end of the pass, because a warning would
   wait for the whole pass. Rejected: E, order sidecar console lines too,
   because it changes the sidecar protocol on both sides. The two backend
   warning tests on `origin/main` keep their foreground branches; their
   background branches now assert the returned warnings and the report.
8. Failure report tests, review finding 2: D, a model test of the window's
   release rule over every end order, and a pass test that sees the reports
   while the pass still runs. Rejected: A or B alone, because each misses one
   rejected option of decision 4. The shared rule of options C and E is
   raised to the user as a decision.
9. Cancellation tests, review finding 3: A, tests that stop or replace a pass
   while its renders wait for admission, and clearer names for the two older
   tests. Rejected: C, a second cancellation flag in `Work::background`,
   because the dropped window already stops queued renders.
10. Decision 5 evidence, review finding 4: A, correct decision 5 to the
    recorded 300 runs with one out-of-order start and one harness fault.
11. Discard tests, review 2 finding 1, answered by the orchestrator on
    2026-10-28: A, one deterministic test for each path that ends a pass
    while a failure is held: an announced replacement, a replacement that a
    render's end reveals, and a stop. Rejected: B, a token that `settle`
    needs while the pass is current, because the tests already pin every
    path with no product change.
12. Warning hook rustdoc, review 2 finding 2, auto-fix: A, the
    `RenderWarnings::report` rustdoc and one test name state that the usage
    pass delivers a background render's warnings after it returns.

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
  priority. It needs one change for decision 3: queued background renders
  take a fair turn, so they reach a free worker in request order. See
  decision 5.
- `mokly-runtime.md` mentions the pass in one sentence of its Serve section.
  The on-demand contract owns the rules of the pass. The page has 247 of its
  250 lines, so its change keeps the line count.
- On this machine the baseline differs from the item's table: warm
  `changes.classify` takes 83.0 s, and the React fixture's pass takes 2.8 s.
  The targets stay: under 4 s on the example, under 1 s on the fixture.
- The React fixture pass has 166 routes: 160 views, 2 pages, and 2 Markdown
  documents in two schemes. Its 574 documents also count the reads of linked
  documents that link validation makes.

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
- **Admission.** Each render still calls `Work::background`. That call takes a
  fair one-permit turn, then waits until no foreground request is active and a
  worker permit is free. A foreground request takes the next free permit
  before any queued background render. An active background render is not
  interrupted.
- **Order.** The window keeps its renders in start order and polls them in
  that order, so each render queues for the turn in catalogue order. The turn
  then admits them in that order. The window needs no new dependency.
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

- [x] Add the tests under `crates/mokly-server/src/_tests_/background_batch/`
      with real `Workers`, gated `DocumentsMock` renders, and mocked
      publications. Use gates, event order, and counts, never elapsed time.
  - [x] A batch yields to a foreground request: two workers, a batch of
        two, and four routes. At most two renders run at once. A foreground
        request that arrives while both run starts before the third route.
  - [x] Queued renders start in catalogue order: one worker and a batch of
        three wait behind a foreground request. They start in route order.
  - [x] A replacement during a batch cancels it: the replaced generation's
        queued routes never render. The replacement's routes render. Only
        the replacement publishes its completion.
  - [x] A stop during a batch returns without a completion publication, and
        no queued route starts.
  - [x] Failures report once in catalogue order: routes end in the order
        b, c, a, and c and a fail. The diagnostics receive a, then c, and
        receive nothing before a ends.
- [x] Add the window module and the `batch` field of `UsagePass`. Rewrite
      `fill` over the window. Add the module under `### Key Code` in
      `crates/mokly-server/README.md`.
- [x] Decision 5: add `queued_background_renders_admit_in_request_order` to
      `crates/mokly-server/src/_tests_/work/background_tests.rs`, see it fail,
      then add the fair turn to `Workers::background`.
- [x] Add `PoolScheduling::limit` in `crates/mokly-cli/src/serve_pool.rs`.
      Add the batch size function to `crates/mokly-cli/src/serve_delivery.rs`
      with a unit test, and set the batch there.
- [x] Add the `batch` field to the existing pass tests and to
      `crates/mokly-server/tests/http/evidence_tests.rs`. Keep every
      assertion. Keep the existing foreground tests green.
- [x] Repeat the pass and worker tests 500 times, and check that the two
      order tests fail on mutated code.

Evidence: `.context/parallel-background-pass/tests-before-fix.txt`,
`admission-order-before-fix.txt`, `repeat-runs.txt`, and
`mutation-checks.txt`.

- [x] Run `cargo test -p mokly-server`, `cargo test -p mokly-cli`,
      `cargo clippy --all-targets -- -D warnings` for both crates, and
      `cargo fmt --all -- --check`.
- [x] Run `cargo xtask check --suite repository`.

## Milestone 3: Measurement and smoke test

Measure after the change with the same method and machine, and prove that
Browse works.

- [x] Rebuild the release binary. Run the example serve run, the edit run,
      and the React fixture run with the shared method. Rerun when two runs
      differ by more than ten percent. Report every baseline number for the
      new build in this plan and in the pull request body.
  - The machine drifted between the baseline and the first after-runs:
    `serve.ready` fell from 21.1 s to 16.6 s with no related change. The
    table below therefore pairs the baseline binary with the new binary in
    interleaved runs on the same machine state.
- [x] Check the acceptance: `serve.background` under 4 s on the example with
      702 documents and 606 fragments, and under 1 s on the React fixture.
      Not met: see decision 6.
- [x] Run the foreground probe, `.context/perf/run-probe.mjs`, on the new
      build, and compare it with the baseline probe.
- [x] Smoke test: run `npm run dev`, open Browse in Chrome while the pass
      runs, open one screen and its Changes state, and save a screenshot
      under `.context/parallel-background-pass/`. The screen opened 2.6 s
      after listening while the pass ran. After Changes, it shows
      Unmodified, with no console or page errors.

Paired runs on 2026-10-28, baseline `a9dd1e81` against `e7a0d824`, two
interleaved pairs per catalogue and one edit pair:

| Number                                  | Baseline                   | Bounded batches               |
| --------------------------------------- | -------------------------- | ----------------------------- |
| Example `serve.ready`                   | 20.0 s, 21.4 s             | 18.7 s, 18.9 s                |
| Example `serve.background`              | 20.7 s, 20.1 s             | 5.3 s, 4.9 s                  |
| Example pass counts                     | 702, 606, 106 cache hits   | 702, 606, 99 to 100           |
| Example `changes.classify`, warm        | 78.5 s                     | 85.9 s, 70.5 s                |
| of which `review.base-tree`, warm       | 49.3 s                     | 52.7 s, 42.9 s                |
| of which `review.capture-side`          | 7.2 s, 7.2 s               | 8.1 s, 6.9 s                  |
| of which `review.compare-views`         | 29.8 s, 27.9 s             | 31.3 s, 26.3 s                |
| Example `sidecar.render` count          | 2,184, 2,182               | 2,183, 2,186                  |
| Example `css.bundle` count and union    | 152, 13.9 s and 15.3 s     | 162 to 163, 14.7 s and 12.5 s |
| Edit run: `watch.action`                | 14.1 s                     | 15.5 s                        |
| Edit run: `serve.background` after edit | 19.0 s                     | 4.1 s                         |
| Edit run: `changes.classify` after edit | 93.3 s                     | 94.0 s                        |
| Edit run: edit to second classification | 126.3 s                    | 113.6 s                       |
| React `serve.ready`                     | 9.8 s, 11.1 s              | 10.2 s, 10.3 s                |
| React `serve.background`                | 2.5 s, 2.9 s               | 2.0 s, 1.8 s                  |
| React pass counts                       | 574, 162, 408 cache hits   | 574, 162, 377 to 379          |
| React `changes.classify`                | 13.7 s, 14.3 s             | 13.5 s, 14.8 s                |
| React `sidecar.render` count            | 324                        | 324                           |
| React `css.bundle` count and union      | 12, 0.4 s and 0.3 s        | 12, 0.3 s and 0.4 s           |
| Probe during the pass, p50 and p90      | 7 ms, 12 to 13 ms          | 8 to 9 ms, 31 to 32 ms        |
| Probe during the pass, max              | 702 to 713 ms, one request | 41 to 53 ms                   |

The first baseline example run made a cold base extraction, 167.4 s, so the
warm `changes.classify` row uses the other run. The pass now uses 70 to 85 %
of the eight cores, against 15 % before.

Evidence: `.context/parallel-background-pass/after.md`, `smoke.txt`, and the
two `smoke-*.png` screenshots, with the raw records `pair-*`, `after-*`,
`probe-after-*`, `cpu-*`, `scale-react-*`, and `exp*` under `.context/perf/`.

## Milestone 4: Verification, commit, review, and pull request

The perf brief orders the pull request before the review, so the pull
request TODO comes before the review TODO here.

- [x] Run `npm test -- tests/markdown_links.test.ts` and
      `npm run format:check`.
- [x] Run the complete gate, `cargo xtask check`. All seven remote suites
      passed on `6a2361f1`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Open the pull request with the before and after table. Put its link in
      the status paragraph.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Review 1 on `ba885017`: four findings, all confirmed by the validity
    check, none `Auto-fix: yes`. The options check changed the
    recommendation of finding 2 to D. Decisions 7 to 10 apply the
    recommendations under the user's rule. The options check also found that
    no test covered a failure that waits for an earlier render when a
    replacement arrives; a test now covers it.
  - Review 2 on `a260d9f7`: two Low findings, both confirmed by the
    validity check after one retry, which a rate-limit error had stopped.
    The orchestrator chose A for both: decisions 11 and 12. Each discard
    test fails on every one of five runs of its mutation. A stress run of
    the new tests then failed once in 500: a test stopped waiting when a
    later route started, but route 0's blocking thread can report its start
    later. The batch tests now wait for every expected start, and 1,000
    runs passed.
  - The shared `plans` skill in `futex-ai/skills`: a rule that a plan proves
    each rejected option of a decision with one mutation and its failing
    test, which review 1 findings 2 and 3 and review 2 finding 1 proposed.
    Separate branch.
  - `docs/guides/cli/serve.md`: the guide says that Serve prints a
    generation's warnings once when its output finishes, and before
    `Catalogue ready`, but views rendered after readiness print their
    warnings when they are reported. Separate branch.
  - `scripts/verification/rust-audit-tool.mjs`: the repository suite installs
    cargo-audit 0.22.2 with `--locked`, which pins the yanked tokio 1.54.0.
    Separate branch.
  - `Cargo.lock`: `pulldown-cmark` 0.13.4 has RUSTSEC-2026-0414, fixed in
    0.13.5. Since the advisory database update of 2026-10-28, the Rust
    dependency audit fails on `origin/main` and on every branch. Separate
    branch.

  Evidence: `.context/parallel-background-pass/review-1.md`,
  `validity-1.md`, `options-1.md`, `review-2.md`, `validity-2.md`, and
  `mutation-checks.txt`.

- [x] Update the pull request body with the review outcome.
- [x] The complete gate passes on the final commit. On `9e9a2b0f` the
      repository suite stopped at the Rust dependency audit on
      RUSTSEC-2026-0414, which `origin/main` had too. The merge `b91896c5`
      brings the fix from PR #230, and CI on PR #225 then passed every
      required check.
