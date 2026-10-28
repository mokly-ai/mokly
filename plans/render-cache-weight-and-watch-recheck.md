# Render Cache Weight, Cache Counts, And Watch Recheck

Status: Active. On branch
`conductor/perf-0-cache-weights-cache-counts-and-the-watch-recheck`, no pull
request yet. The plan closes when its PR merges.

This plan is item perf 0 of the startup performance work. An orchestrator
coordinates seven `perf N` workspaces and merges their pull requests. This
pull request merges first, because the other workspaces measure their
changes through its cache counts. It carries two items of the profile that
the orchestrator measured on 2026-10-27.

Item 4, the render cache weight. The render cache is the in-memory LRU of
rendered documents and fragments that Serve, `build`, and Changes share. It
is bounded at 256 MiB of charged bytes. The charge of one artifact is an
estimate of its retained memory. Today the charge counts the usage,
instance, and slot records of a document or fragment at 64 times their JSON
length. On `examples/basic` the head alone charges 632 MiB, so the cache
evicts head entries in the background pass and again while the base
renders. The compare step then composes most head documents again and
renders their fragments again through the sidecars. No timing record
reports cache misses, evictions, or charged bytes.

Item 7, the startup recheck. Watched Serve attaches its first watcher before
the first preparation. A preparation loads the configuration, discovers the
sources, validates them with the sidecar, and plans the render graph. When
the prepared catalogue has watch roots that the first watch plan did not
have, startup prepares the whole catalogue a second time before readiness.
On `examples/basic` the second preparation takes 2.5 to 2.9 s.

Decision 1 and D2 keep the 256 MiB bound. The change does not change the
eviction order, the background pass (perf 3), CSS bundling (perf 5),
per-entry render keys (perf 4), or base retention across edits (perf 6).

## Decisions

Decision 1 (2026-10-27, user): item 4 option C. Charge the actual byte
length of the records, or a small multiple such as two. Keep the documented
256 MiB bound. Emit the cache hit, miss, eviction, and byte counts in the
timing records at the end of `serve.background`, `changes.classify`,
`review.capture-side`, `review.compare-views`, and the build's
`output.write`.

Decision 2 (2026-10-27, user): item 7 option A. Run discovery first and seed
the first watch plan with the discovered roots, so that the roots match after
the preparation and no recheck runs.

Decisions D1 to D4 were asked on 2026-10-27. The user answered on
2026-10-27: apply the recommendations.

- D1, the record multiplier: B, two. Rejected: A, one, and C, an estimate
  from the record fields. Reason: two is the closest small multiple to the
  measured live heap, and one gives the same gain with a lower estimate. C
  must follow every change to the record types.
- D2, the eviction acceptance: A, keep the 256 MiB bound and amend the
  acceptance. Rejected: B, a 384 MiB bound, because it changes decision 1
  and the runtime contract, and C, evict base entries before head entries,
  because it overlaps perf 6. The amended acceptance: zero evictions in
  `serve.background`, a compare step of about 6 s, about 650 fewer sidecar
  renders, and one `catalogue.validate` and one `graph.prepare` before
  `serve.ready`. The post-merge follow-up keeps the head in the cache while
  the base renders.
- D3, the count fields: A, one `render.cache` counts record for each phase.
  Rejected: B, fields on each phase's own counts record, because it renames
  the existing `cacheHits` and loses the counts of a failed review phase,
  and C, totals since the process started, because every reader must
  subtract. Reason: one shape serves all five phases.
- D5 (2026-10-28, agent, under the user's rule of 2026-10-28 to apply the
  recommended option without stopping): open the pull request although the
  local gate fails two release-note checks. The public package export
  ratchet and the test "the repository public surface has complete release
  notes" fail the same way on `origin/main` at `2dd2937f`, because exports
  removed since `v0.14.0` and `viewer-v0.5.0` are not named in the upgrade
  guide. Rejected: fix the upgrade guide here, because it is outside this
  change, and wait for a fix, because the failures do not depend on this
  change.
- D4, the recheck: B, the coverage rule. It supersedes decision 2. Rejected:
  A, decision 2 as written, because discovery reports no roots, C, a narrow
  stylesheet recheck, because it changes the code of perf 5, and D, no
  recheck, because an edit during startup could stay unseen. Reason: B
  removes the second preparation of `examples/basic` and loses no edit.

## Corrections To The Item Text

The item text was written from commit `89c12ef1`. This plan was measured at
`a9dd1e81`, the merge base with `origin/main`.

1. Discovery adds no watch roots. The roots of a watch plan are the
   configured roots, the watch rule roots, and the PostCSS directory
   dependencies. Imported stylesheets become exact watched files, not
   roots. Only the sidecar's `processCss` reports PostCSS directories,
   during graph preparation. On `examples/basic` the extra root is
   `examples/basic/src`, from `@source "../.."` in
   `examples/basic/src/components/workspace-note/utilities.css`. Decision 2
   therefore cannot remove the second preparation.
2. The first watcher already observes all 63 directories that the extra
   root needs: the root's own directory is the parent of the configured
   `src/components` root. An edit in these directories during the first
   preparation is already buffered. The second preparation protects nothing
   on this catalogue.
3. The head already evicts itself in the background pass: 913 evictions at
   the current charge. The base render is not the only cause.
4. A 256 MiB bound cannot hold both sides of `examples/basic` at a
   multiplier of one or two. After the base render, the head and the base
   charge 296 MiB at one and 311 MiB at two. The cache then evicts 640 to
   740 head entries while the base renders. Zero evictions hold for
   `serve.background` only.
5. This machine is faster than the machine of the item's baseline. The
   second preparation takes 2.5 to 2.9 s here, not about 5 s.

## Measurements

Method: the shared method of the orchestrator, release build, eight cores,
eight sidecars, OS cache directory warm. The raw records and the scripts are
under `.context/perf/`. The summary is
`.context/render-cache-weight-and-watch-recheck/baseline.md`.

Before is the base binary at `a9dd1e81`, after is the branch at
`a94e2c9b`. A range gives the warm runs: four before and three after. The
first after run had a cold base extraction, because `HEAD` had moved, and is
left out. The React rows compare an interleaved pair of each, because the
machine drifted during the day.

| Measure on `examples/basic`                        | Before             | After             |
| -------------------------------------------------- | ------------------ | ----------------- |
| `serve.ready`                                      | 12.5 to 13.8 s     | 9.4 to 10.8 s     |
| `catalogue.validate`, `graph.prepare` before ready | 2 and 2            | 1 and 1           |
| second preparation before ready                    | 2.8 to 3.1 s       | none              |
| `serve.background`                                 | 11.5 to 13.4 s     | 10.6 to 12.6 s    |
| evictions in `serve.background`                    | 913, measured      | 0                 |
| `changes.classify`                                 | 50.9 to 58.6 s     | 34.8 to 46.0 s    |
| `review.base-tree`                                 | 32.9 to 37.8 s     | 27.9 to 37.6 s    |
| `review.capture-side`                              | 4.3 to 5.3 s       | 3.9 to 5.1 s      |
| `review.compare-views`                             | 17.2 to 21.8 s     | 6.0 to 7.4 s      |
| `sidecar.render` count, whole run                  | 2,085 to 2,182     | 1,461 to 1,474    |
| `css.bundle` count, union                          | 152, 9.7 to 11.1 s | 114, 7.0 to 9.3 s |
| `watch.action`, two edit runs                      | 10.1 to 10.5 s     | 10.1 to 10.2 s    |
| `serve.background` after the edit                  | 14.1 to 14.9 s     | 13.2 to 15.2 s    |
| `changes.classify` after the edit                  | 71.1 to 76.9 s     | 54.5 to 69.7 s    |
| `review.compare-views` after the edit              | 19.7 to 21.8 s     | 5.8 to 8.2 s      |
| edit to the end of the second classification       | 96.2 to 101.5 s    | 78.0 to 95.0 s    |

| Measure on the React fixture | Before         | After              |
| ---------------------------- | -------------- | ------------------ |
| `serve.ready`                | 7.4 to 7.7 s   | 7.6 to 7.9 s       |
| `serve.background`           | 1.9 s          | 2.0 to 2.1 s       |
| `changes.classify`           | 10.3 to 10.9 s | 9.9 to 10.1 s      |
| `review.capture-side`        | 1.2 to 1.3 s   | 1.2 s              |
| `review.compare-views`       | 0.29 s         | 0.27 to 0.34 s     |
| `sidecar.render` count       | 324            | 324                |
| `css.bundle` count, union    | 12, 0.30 s     | 12, 0.27 to 0.29 s |

The 913 evictions come from the experiment build at the old charge. After
the change, the cache evicts 742 entries while the base renders, and the
compare step misses 763 lookups, as decision D2 accepted. After an edit, the
second background pass evicts about 1,550 entries, because Changes filled
the cache. The React fixture evicts nothing in any phase. The cold run of
`examples/basic` at `a9dd1e81` gave `serve.ready` 12.7 s, `changes.classify`
121.7 s, and 1,996 sidecar renders.

The multiplier measurement used an experiment build. It reports the cache
counts, the resident size, and the live heap at the start and the end of
each phase. The live heap is the in-use total of the allocator. After the
background pass the head holds 1,178 cache entries, and their records are
7.7 MiB of JSON. The head's cache entries hold 179.4 MiB of live heap: the
heap grew 233.9 MiB over the pass with a 4 GiB bound and 54.5 MiB with a
zero bound. The resident size grew 240.0 MiB over the pass with a 4 GiB
bound. That growth includes state outside the cache, so it is an upper
bound.

| Multiplier | Head charge after the background pass | Live heap per charged byte | Resident growth per charged byte |
| ---------- | ------------------------------------- | -------------------------- | -------------------------------- |
| 64         | 631.9 MiB                             | 0.28                       | 0.38                             |
| 2          | 156.8 MiB                             | 1.14                       | 1.53                             |
| 1          | 149.1 MiB                             | 1.20                       | 1.61                             |

| Experiment run         | `serve.background` evictions | `changes.classify` evictions | `review.compare-views` | `sidecar.render` count |
| ---------------------- | ---------------------------- | ---------------------------- | ---------------------- | ---------------------- |
| multiplier 64, 256 MiB | 913                          | 3,279                        | 16.7 s                 | 2,095                  |
| multiplier 2, 256 MiB  | 0                            | 1,244                        | 6.0 s                  | 1,461                  |
| multiplier 1, 256 MiB  | 0                            | 1,190                        | 5.7 s                  | 1,461                  |
| multiplier 64, 4 GiB   | 0                            | 0                            | 1.9 s                  | 1,098                  |

## Design

Record charges. One named constant replaces the three multipliers of the
weight module in `mokly-graph`. Its value is the D1 answer.

Cache counts. Each command creates its one render cache at its composition
root, with the 256 MiB bound, and passes it to the timing layer and to the
render services. Today the render services create the cache themselves, so
the timing layer cannot read it. The timing layer reads the cache
statistics when one of the five phases starts. When the phase closes, it
emits one counts record before the phase's end record. The record carries
the hits, misses, and evictions between the start and the end, and the
charged bytes and entries at the end. Under D3 option A the record has the
stage `render.cache`, the phase span as `parentId`, and the phase's stage as
`phase`. A failed phase also emits its record. The counts cover every cache
operation of the process during the phase, so a parent phase also counts
its nested phases and concurrent foreground work. The counts code lives in
a new module beside the timing layer, so the layer's file stays under the
file cap and its `css.bundle` code stays as perf 5 expects.

Watch recheck, under D4 option B. The watch `Observer` reports whether it
already registers every directory that the roots of a plan need.
`NativeObserver` compares the root walk of the plan with its registered
directories. A candidate whose roots changed still attaches a new observer,
so a failed candidate keeps the active observer. The candidate asks for the
second preparation only when the active observer does not cover the
candidate plan. Otherwise the active observer's buffered events replay into
the new observer at adoption, as they do today. The same rule applies at
startup and on a rebuild, because both use the same candidate step. The
active observer's registrations do not change during a preparation: the
watch queue drains no event while an action runs, and startup drains none
before readiness.

Contract owners:

- [Timings contract](../docs/protocol/mokly-timings.md): the cache counts
  record.
- [Watch contract](../docs/protocol/mokly-watch.md#watch-targets-and-readiness):
  the readiness rule.
- [Runtime contract](../docs/protocol/mokly-runtime.md#render-graph-and-cache):
  the 256 MiB bound, unchanged.
- The [mokly-graph README](../crates/mokly-graph/README.md), the
  [mokly-watch README](../crates/mokly-watch/README.md), and the
  [mokly-cli README](../crates/mokly-cli/README.md).

## Milestone 1: Documentation and protocol

State the count record, the readiness rule, and the charge, so that the
review can check the code against them.

- [x] Update `docs/protocol/mokly-timings.md`: the `render.cache` counts
      record of the D3 answer, its five phases, and its fields. Say that
      the counts cover the whole process during the phase, and that charged
      bytes are an estimate under the runtime bound, not measured memory.
      Keep the `serve.background` counts record as it is.
- [x] Update "Watch Targets And Readiness" in `docs/protocol/mokly-watch.md`
      with the readiness rule of the D4 answer.
- [x] Update `crates/mokly-graph/README.md`: the cache charges the usage,
      instance, and slot records at the D1 multiple of their JSON length.
- [x] Update `crates/mokly-watch/README.md`: the observer reports whether it
      already observes the root directories of a plan.
- [x] Update `crates/mokly-cli/README.md`: each command creates one render
      cache at its composition root and shares it with the timing layer.
- [x] Update the repeated preparation rule of
      `docs/protocol/mokly-build-warnings.md` to point to the readiness rule.
- [x] Confirm that the render cache section of `docs/protocol/mokly-runtime.md`
      stays true. Change nothing that stays true.
- [x] Record the answers to D1 to D4 in this plan, with the date.
- [x] Add the status line of this plan to each page above whose new rule is
      not implemented yet.

## Milestone 2: Record charges

Charge the records at the D1 multiple. No other charge changes.

- [x] Write the failing test first in a new
      `crates/mokly-graph/src/_tests_/weight_tests.rs`: a document's usage
      record and a fragment's instance and slot records add the D1 multiple
      of their JSON length to the charge.
- [x] Replace the three multipliers in `crates/mokly-graph/src/weight.rs`
      with one named constant. Say in the module comment that the charge is
      an estimate.
- [x] Run the tests of `mokly-graph`, `mokly-compare`, `mokly-render`, and
      `mokly-server`. A test that expected an eviction from the old
      multiplier keeps its intent with a smaller bound or a larger record.
- [x] Remove the status line of `crates/mokly-graph/README.md`.

## Milestone 3: Cache counts in the timing records

Emit the counts of the D3 answer at the end of the five phases.

- [x] Write the failing tests first in a new
      `crates/mokly-cli/src/_tests_/cache_trace_tests.rs`, with a mocked
      render cache and the mocked clock. Each of the five phases emits one
      count record before its end record, with the phase differences and
      the end totals. Other stages emit none. A phase that ends with
      `error` still emits. Nested phases each emit their own record.
- [x] Add the cache constructor with the 256 MiB bound to
      `crates/mokly-cli/src/render_runtime.rs`. `Services::new` takes the
      cache instead of creating it.
- [x] Create the cache in `entry_serve.rs`, `entry_build.rs`, and
      `entry_publish.rs`. Pass it to `serve_trace::install`, and through
      `ServeServices`, the build `Context`, and the publish `Output` to
      `Services::new`.
- [x] Add the counts to the timing layer in a new
      `crates/mokly-cli/src/serve_trace_cache.rs`.
- [x] Update the existing trace tests for the new layer field. Three tests
      that assert exact record lists now expect the `render.cache` records.
- [x] Move the timing start-up of Serve into `ServeTiming::start` in
      `serve_timing.rs`, so `entry_serve.rs` stays within the file cap.
- [x] Remove the status line of `docs/protocol/mokly-timings.md`.

## Milestone 4: Startup recheck

Prepare a second time only when a new root reaches a directory that the
active watcher did not observe.

- [x] Write the failing tests first in a new
      `crates/mokly-watch/src/_tests_/native_coverage_tests.rs`: the
      observer covers a plan whose root directories it registered. It does
      not cover a plan whose root reaches an unregistered directory. A
      failed walk and a closed observer cover nothing.
- [x] Add the coverage method to `Observer` in
      `crates/mokly-watch/src/observer.rs`. Implement it in `NativeObserver`
      from the root walk that registration uses.
- [x] Write the failing tests first in
      `crates/mokly-cli/src/_tests_/serve_watch_tests.rs`: changed roots
      that the active observer covers attach a new observer without a
      recheck. Changed roots that it does not cover set the recheck.
- [x] Set `recheck` from the coverage in `candidate` of
      `crates/mokly-cli/src/serve_watch.rs`. Keep the new observer for
      changed roots. Update the module comment of `serve_preparation.rs`.
- [x] Add a process test in a new
      `crates/mokly-cli/tests/serve_js/startup_edit_tests.rs` for an edit
      during startup. A PostCSS plugin reads a file under a directory
      that it reports, signals, and waits for a gate file. The test edits
      the file, then writes the gate.
  - [x] Covered directory: readiness serves the old CSS, then a rebuild
        serves the new CSS.
  - [x] Directory outside every observed directory: the second preparation
        runs, and readiness serves the new CSS.
- [x] Remove the status lines of `docs/protocol/mokly-watch.md`,
      `docs/protocol/mokly-build-warnings.md`, `crates/mokly-watch/README.md`,
      and `crates/mokly-cli/README.md`.
- [x] Confirm that the covered process test fails under the old rule, which
      prepared again on every root change. It waited at readiness until its
      30 s deadline.

## Milestone 5: Measurement after the change

Measure the branch with the same method and compare it with the table
above.

- [x] Build the release binary and the packages with the shared method.
- [x] Run the warm serve run twice, the edit run once, and the React fixture
      twice. Rerun a pair that differs by more than ten percent. The base
      tree phase varied by up to 35 %, so the base binary ran again beside
      the branch, two warm runs, one edit run, and two React runs.
- [x] Add the after values to the table in this plan. Save the records under
      `.context/perf/` and the summary under
      `.context/render-cache-weight-and-watch-recheck/`.
- [x] Confirm the acceptance: one `catalogue.validate` and one
      `graph.prepare` before `serve.ready`, zero evictions in
      `serve.background`, and the D2 outcome for `review.compare-views` and
      the `sidecar.render` count. Evidence:
      `.context/render-cache-weight-and-watch-recheck/after.md`.

## Milestone 6: Verification, commit, review, and pull request

- [x] Run `cargo xtask check --suite repository` early. It failed at the
      public package export ratchet, which fails the same way on
      `origin/main` (D5). The steps after it passed when run by hand:
      `cargo fmt`, both clippy runs, the package builds, and
      `cargo test --workspace`. The file-length lints passed after the
      candidate test moved into its own file.
- [x] Smoke-test watched Serve with `npm run dev -- --port 0`: open a screen,
      edit a screen module, and see the rebuilt screen. The edited title of
      `example/team/invite` reached the served document after a rebuild,
      and the Browse shell rendered the screen.
- [x] Run the targeted tests and the complete gate `cargo xtask check`. The
      local gate stops at the first failed suite, so each suite ran on its
      own: viewer 2,473 of 2,474 passed, with the same pre-existing
      release-note failure (D5), native and browser passed. Logs:
      `.context/render-cache-weight-and-watch-recheck/gate-*.log`.
- [x] Commit with Conventional Commits and push the branch after each
      milestone. `origin/main` moved to `2dd2937f` and was merged in, with no
      overlapping path.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked. Put
      the before and after table in its body and its link in the status
      paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Keep the head entries in the render cache while the base renders, so
      that the compare step renders no head document again. Decision D2
      left 640 to 740 evictions on `examples/basic`. Owner: perf 6 or a
      later workspace.
