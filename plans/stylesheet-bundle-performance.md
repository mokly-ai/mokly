# Stylesheet Bundle Performance

Status: Active. On branch
`conductor/perf-5-parallel-css-bundling-and-the-cross-attempt-stylesheet-cache`,
no pull request yet. The work has two pull requests: step A, then step B.
The plan closes when the step B pull request merges.

Graph preparation bundles the stylesheet roots on one thread, one root after
another. On `examples/basic`, one preparation bundles 35 roots in 1.3 to
2.0 s. Startup runs two preparations, and each rebuild runs one. The
cross-attempt stylesheet cache should make an unchanged root free in the next
preparation, but it almost never hits. This plan is item 8 of the startup
performance profile, measured on 2026-10-27 at `a9dd1e81` with a release build
on 8 cores and 8 sidecars.

Step A bundles the roots in parallel on the render workers and registers the
results in root order, so the generation does not change. Step B adds the
reason for each bundle to its `css.bundle` timing record and fixes the cache
gate that fails. This plan does not cover the second startup preparation
itself (perf 0), the PostCSS round-trip overhead (the "PostCSS in Rust"
workspace), or the base side, whose runtime and caches are new for each
classification (perf 6). The class-map bundles of validation stay serial.
Step B turns them into cache hits.

Decision 0 (2026-10-27, made by the user before this plan): implement the
recommendation of item 8, step A first and then step B. Step A bundles the
roots in parallel and keeps the output and its order. Step B records why the
cache missed, fixes that gate, and keeps a stamp that covers every input of a
bundle, including the files that Tailwind scans.

Contract owners:

- [Timings contract](../docs/protocol/mokly-timings.md), the `css.bundle`
  record.
- [Consumer PostCSS contract](../docs/protocol/mokly-sidecar-postcss.md), the
  read evidence and its cache bounds.
- [Imported stylesheet PostCSS contract](../docs/protocol/mokly-imported-styles-postcss.md),
  dependency retention.
- [Watch contract](../docs/protocol/mokly-watch.md), invalidation through the
  render graph.
- The [mokly-graph README](../crates/mokly-graph/README.md), the
  [mokly-render README](../crates/mokly-render/README.md), and the
  [mokly-cli README](../crates/mokly-cli/README.md).

## Baseline

The table gives the release build of `a9dd1e81` on this machine. The warm
column is the median of three runs with a warm OS cache directory. The cold
column is one run.

| Metric                                        | Cold        | Warm        |
| --------------------------------------------- | ----------- | ----------- |
| `serve.ready`                                 | 21.0 s      | 18.8 s      |
| `serve.background`                            | 20.7 s      | 18.5 s      |
| `changes.classify`                            | 174.5 s     | 74.9 s      |
| `review.base-tree`                            | 142.4 s     | 45.7 s      |
| `review.capture-side`                         | 7.3 s       | 7.0 s       |
| `review.compare-views`                        | 30.6 s      | 28.0 s      |
| `sidecar.render` count                        | 2,182       | 2,181       |
| `css.bundle` count and union                  | 152, 14.3 s | 152, 14.1 s |
| `css.bundle` union, startup `graph.prepare` 1 | 1.37 s      | 1.46 s      |
| `css.bundle` union, startup `graph.prepare` 2 | 1.75 s      | 1.55 s      |
| `css.bundle` union, base-side `graph.prepare` | 5.89 s      | 6.26 s      |

Edit run, one comment line in `specs/example/screens/details.mockup.ts`:
`watch.action` 15.4 s, `serve.background` after the edit 23.4 s,
`changes.classify` after the edit 104.8 s, and 143.3 s from the edit to the end
of the second classification. Small React fixture: `serve.ready` 10.6 s,
`serve.background` 3.2 s, `changes.classify` 13.9 s, 12 `css.bundle` spans in
0.3 s, 324 `sidecar.render` spans.

Evidence: `.context/perf5-parallel-stylesheets/baseline.md`.

## Diagnosis

A throwaway build printed the cache outcome of each stylesheet request. It was
not committed. Findings:

1. Every new record passed the consistency gate, 152 of 152.
2. A record that survived passed the stamp gate. The rebuild after a screen
   edit hit every root of its graph preparation.
3. The failing gate is a third gate: the 64 MiB byte bound of each stylesheet
   store. Each record holds its own copy of the PostCSS context's module read
   evidence and a stamp of it. That evidence has about 551 module paths with
   two versions each and 503 file identities. The store charges about 1.7 MB
   for each record. One attempt makes 39 records, about 66 MB. When a record
   does not fit, the store removes all records. So the second startup attempt
   found no record for any of its 39 roots. The attempt-local store also
   cleared, which bundled 35 roots again later: 3 in the background pass and
   32 in Changes.
4. With the bound raised to 512 MiB, the second startup attempt made 39
   shared hits and no `css.bundle` span. Its validation fell from 1.5 s to
   0.4 s and its graph preparation from 2.5 s to 0.9 s.
5. A hit is still slow. Its stamp check recomputes about 578 file digests and
   503 identities, about 17 ms for each root. A new stamp costs about 16 ms,
   and the evidence replay about 3 ms.
6. Each PostCSS round trip costs about 20 ms, of which the plugins use about
   0.9 ms. The core holds one PostCSS cache lock across the round trip and
   across the read inventory of the context's 551 modules, about 14 ms.

Evidence: `.context/perf5-parallel-stylesheets/baseline.md` and
`.context/perf5-parallel-stylesheets/diagnostic.patch`.

## Corrections to the item text

1. The example has a Tailwind root.
   `examples/basic/src/components/workspace-note/utilities.css` imports the
   Tailwind theme and utilities with `source(none)` and `@source "../.."`.
   Its root depends on 14 scanned files by content and on two directory
   listings.
2. The rebuild after a JavaScript edit did not bundle all roots again. Its
   graph preparation bundled none, and its validation bundled two, whose
   records a clear had removed. The second startup preparation bundled all 39.
3. The cache has three gates, not two. The byte bound is the gate that fails.
4. A hit cannot carry `shared-hit` or `local-hit` on a `css.bundle` record
   and also produce zero `css.bundle` spans. Decision 3 chooses.
5. Parallel roots alone do not reach 0.8 s. The PostCSS lock serializes about
   34 ms for each root, about 1.2 s for one preparation. Decision 2 chooses.

## Open decisions

The user answers these before implementation. The report message gives the
full layout of each decision.

1. Gate fix for step B. A: raise both stylesheet bounds to 512 MiB. B: keep
   one copy of a PostCSS context's module evidence for all records of that
   context, charge it once, and check its stamp once for each attempt. C: B,
   and evict records by age instead of clearing the store. Recommended: B.
2. PostCSS lock in step A. A: parallel roots only. B: also run the read
   inventory outside the PostCSS cache lock. C: B, and also release the lock
   during the round trip with one in-flight request for each input.
   Recommended: B.
3. Hit records. A: `css.bundle` records only real bundles and carries the
   miss reason. A hit has no span. B: `css.bundle` wraps every request and
   also carries `local-hit` and `shared-hit`. C: a new `css.stylesheet` span
   wraps every request and carries the outcome, and `css.bundle` stays a
   child on a miss. Recommended: A.
4. Miss values of the `cache` field. A: `no-record`, `stamp-mismatch`, and
   `inconsistent-evidence`. B: A and `evicted`, for a record that the byte
   bound removed. Recommended: B.
5. PostCSS context across attempts. A: keep one context for each attempt.
   B: keep a context across attempts while its inputs do not change.
   Recommended: A.

## Design

### Step A

- `RenderWorkers` gets a `stylesheets` method with a `StylesheetWorker` job.
  The trait default runs the jobs in order on the caller. `ThreadWorkers`
  runs them on its pool inside the caller's span, like `run`, and keeps the
  input order. `CancellableWorkers` forwards to its inner workers and checks
  cancellation before each job.
- Graph preparation collects the roots in their map order and runs one job
  for each root. Each job checks cancellation and bundles its root. The
  registration loop then reads the results in root order. It keeps the
  existing names, module names, resources, sources, dependency directories,
  and cache inserts. The first failed root in root order gives the error,
  as today.
- With option B of decision 2, the PostCSS adapter caches the raw sidecar
  result before it releases its cache lock. The read inventory runs outside
  the lock, and a second short lock stores the processed record. Requests of
  one context still reach the sidecar one at a time, and equal inputs still
  make one `processCss` call.
- Bundling has no warnings. The `Bundle` type carries none, and the dependency
  usage records are ordered sets. The output check compares the generation:
  routes, CSS bytes, keys, sources, and warnings.

### Step B

- The cache layer opens the `css.bundle` span around the inner bundle and
  records `cache` with the miss reason. The shared store keeps the keys of
  records that it removed under the byte bound or kept attempt-local, with
  their reason. The timing layer copies the `cache` field to the end record.
- With option B of decision 1, a record keeps its own read evidence. The
  context's module evidence goes into one shared entry with its stamp and
  consistency, keyed by its digest. The store charges the entry once. An
  attempt checks the entry's stamp once and replays it once. A hit returns
  the same bundle and the same evidence as today.
- The stamp keeps every input: sources, assets, plugin dependency digests,
  directory listings, and the module evidence. Tailwind reports each scanned
  directory with a glob. The dependency inventory digests every matching
  file, so the stamp covers the scanned files by content and by listing.

## Milestone 1: Documentation, step A

Step A keeps the behaviour at every boundary, so no protocol page changes.
The timings contract already says that parallel graph work overlaps.

- [ ] Confirm that `docs/protocol/mokly-runtime.md`,
      `docs/protocol/mokly-timings.md`, and `docs/architecture/rust-core.md`
      stay true. Change nothing that stays true.
- [ ] Update `crates/mokly-graph/README.md`: preparation bundles the roots on
      the render workers and registers them in root order, and each root job
      checks cancellation. Name `stylesheets` under `### Key Code`.
- [ ] Update `crates/mokly-render/README.md`: one context's PostCSS requests
      reach the sidecar one at a time, and the read inventory runs outside the
      PostCSS cache lock.

## Milestone 2: Parallel roots in graph preparation, step A

Write each failing test first.

- [ ] Add `StylesheetWorker` and `RenderWorkers::stylesheets` to
      `crates/mokly-graph/src/workers.rs`, and implement it on
      `ThreadWorkers`.
- [ ] Forward `stylesheets` in `crates/mokly-cli/src/cancelled_work.rs` with
      a cancellation check before each job. Without it, production keeps the
      serial trait default.
- [ ] Run the root jobs in `crates/mokly-graph/src/graph.rs` and register
      the results in root order. Keep the file under 300 lines. Move the
      registration into its own module when the file needs the room.
- [ ] Apply decision 2 in `crates/mokly-render/src/postcss.rs`.
- [ ] Tests:
  - [ ] `crates/mokly-graph/tests`: a fixture with at least six roots gives
        the same routes, CSS bytes, keys, sources, and warnings with one
        worker and with eight workers.
  - [ ] `crates/mokly-graph`: with two failed roots, preparation returns the
        error of the first root in root order, also when the later root fails
        first. The test controls the order with signals, not with time.
  - [ ] `crates/mokly-graph`: `ThreadWorkers::stylesheets` keeps the input
        order and runs two jobs at the same time. A job waits for a signal
        from the other job, with a polling deadline of at least 10 s.
  - [ ] `crates/mokly-graph`: `css.bundle` spans on worker threads keep the
        `graph.prepare` span as their parent.
  - [ ] `crates/mokly-cli`: `CancellableWorkers::stylesheets` forwards to its
        inner workers, and a cancelled job returns the cancelled diagnostic.
  - [ ] `crates/mokly-render`: while one request runs its read inventory, a
        request for another input of the same context completes its sidecar
        call. Two requests for one input make one sidecar call.
- [ ] Run `cargo xtask check --suite repository`.

## Milestone 3: Output check and measurement, step A

- [ ] Run the mockup check: `npm run build`, then build `examples/basic` with
      `--strict` into `.context/perf5-parallel-stylesheets/after-a`. Build it
      with the `a9dd1e81` binary into a second directory. Compare the two
      directories byte for byte, and record each difference with its reason.
- [ ] Smoke test: run `npm run dev`, open one screen of each stylesheet
      group, and check that its CSS applies. Save a screenshot under
      `.context/perf5-parallel-stylesheets/`.
- [ ] Measure with the shared method: cold and warm serve, the edit run, and
      the React fixture. Check the acceptance: the `css.bundle` union inside
      one startup `graph.prepare` is under 0.8 s. Add one line for each
      catalogue below.

## Milestone 4: Verification, commit, review, and pull request, step A

- [ ] Run the targeted tests: `cargo test -p mokly-graph`,
      `cargo test -p mokly-render`, `cargo test -p mokly-cli`,
      `npm test -- tests/markdown_links.test.ts`, and `npm run format:check`.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the step A pull request with the before and after table. Put its
      link in the status paragraph.

## Milestone 5: Documentation and protocol, step B

Step B starts after the step A pull request merges. Its pull request opens
after the orchestrator reports that perf 4 merged. perf 0 also changes
`crates/mokly-cli/src/serve_trace.rs` and the timings contract, so merge
`origin/main` first.

- [ ] Update `docs/protocol/mokly-timings.md`: define the `cache` field of
      the `css.bundle` end record and its values, under decisions 3 and 4.
- [ ] Update the read evidence bound sentence of
      `docs/protocol/mokly-sidecar-postcss.md` under decision 1.
- [ ] Update the dependency retention section of
      `docs/protocol/mokly-imported-styles-postcss.md`: a cached stylesheet
      bundle is reused only while its sources, assets, plugin-reported files,
      reported directory listings, and PostCSS module evidence are unchanged.
      Record decision 1 next to the rule.
- [ ] Confirm that the invalidation section of `docs/protocol/mokly-watch.md`
      stays true.
- [ ] Update `crates/mokly-render/README.md`: the bounds, the shared module
      evidence, and the miss reasons. Update `crates/mokly-cli/README.md`
      when it lists timing fields.

## Milestone 6: Miss reason on `css.bundle`, step B

Write each failing test first.

- [ ] Open the `css.bundle` span in
      `crates/mokly-render/src/stylesheet_cache.rs` around the inner bundle,
      with the `cache` field. Keep the keys of removed and attempt-local
      records with their reason in the shared store.
- [ ] Copy the `cache` field to the end record in
      `crates/mokly-cli/src/serve_trace.rs`.
- [ ] Tests:
  - [ ] `crates/mokly-render`: each miss value under decision 4, with a
        mocked tree and a mocked inner bundler.
  - [ ] `crates/mokly-cli`: the timing layer copies `cache` to the
        `css.bundle` end record and logs no path.

## Milestone 7: Gate fix, step B

Write each failing test first.

- [ ] Apply decision 1 in `crates/mokly-render/src/stylesheet_cache.rs`,
      `crates/mokly-render/src/input_stamp.rs`, and new modules beside them.
      Keep each file under 300 lines.
- [ ] Unit tests in `crates/mokly-render`:
  - [ ] Thirty-nine records with 551 shared module paths fit in one 64 MiB
        store.
  - [ ] Hits on two roots and on eight roots of one context check the shared
        module stamp once for each attempt. Count the tree's digest and
        identity calls.
  - [ ] A hit returns the same CSS and the same read evidence as the miss
        that made the record, and it replays the same observations.
  - [ ] A changed module file makes every record of that context miss with
        `stamp-mismatch`.
- [ ] Integration tests in `crates/mokly-render/tests/integration` with the
      real sidecar:
  - [ ] A second preparation with no change makes no `processCss` call and
        no inner bundle.
  - [ ] A preparation after a JavaScript edit makes no inner bundle.
  - [ ] An edit to one stylesheet bundles only the roots that import it.
  - [ ] A Tailwind fixture: a new file with a new class name in the scanned
        directory makes the Tailwind root bundle again, and its CSS contains
        the new class.

## Milestone 8: Measurement, step B

- [ ] Measure with the shared method: cold and warm serve, the edit run, and
      the React fixture. Add an edit to one stylesheet. Check the acceptance:
      the second startup preparation and the rebuild after the JavaScript
      edit have no `css.bundle` span, and the stylesheet edit bundles only
      the roots that import it. Add one line for each catalogue below.

## Milestone 9: Verification, commit, review, and pull request, step B

- [ ] Run the targeted tests: `cargo test -p mokly-render`,
      `cargo test -p mokly-cli`, `npm test -- tests/markdown_links.test.ts`,
      and `npm run format:check`.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the step B pull request with the before and after table. Put its
      link in the status paragraph.
