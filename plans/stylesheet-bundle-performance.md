# Stylesheet Bundle Performance

Status: Active. Step A merged in
[PR #228](https://github.com/mokly-ai/mokly/pull/228) on 2026-10-28. Step B is
on branch `conductor/perf-5-step-b-stylesheet-cache-reuse`, no pull request
yet. Its pull request opens after perf 4 (#227) merges and `origin/main` is
merged once more. The plan closes when the step B pull request merges.

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
   and also produce zero `css.bundle` spans. Decision 3 resolves it.
5. Parallel roots alone do not reach 0.8 s. The PostCSS lock serializes about
   34 ms for each root, about 1.2 s for one preparation. Decision 2 resolves
   it.
6. perf 0 (#222) removed the second startup preparation. Step B's acceptance
   therefore applies to rebuilds and to the bundles that one attempt makes
   again: a rebuild after a JavaScript edit has no `css.bundle` span, the
   background pass and Changes bundle no root again, and a stylesheet edit
   bundles only the roots that import it. On `d4c6f6a8` such a rebuild still
   bundled 2 roots in 1.26 s, and every run bundled 36 roots again during
   Changes.

## Decisions

The user answered decisions 1 to 5 on 2026-10-27 and approved the plan.

1. Gate fix for step B: B. Keep one copy of a PostCSS context's module
   evidence for all records of that context, charge it once, and check its
   stamp once for each attempt. Rejected: A, raise both bounds to 512 MiB,
   because a hit still costs about 20 ms and about 300 roots fill the bound
   again. Rejected: C, B with eviction by age, because it helps only a
   catalogue that still exceeds the bound. Reason: B removes the duplicated
   evidence that fills the store and makes each hit cheap.
2. PostCSS lock in step A: B. Run the read inventory outside the PostCSS
   cache lock and keep the round trip inside it. Rejected: A, parallel roots
   only, because it reaches about 1.2 s, not 0.8 s. Rejected: C, release the
   lock during the round trip, because only two concurrent contexts gain from
   it. Reason: B is the smallest change that can meet the 0.8 s target.
3. Hit records: A. `css.bundle` records only real bundles and carries the
   miss reason. A hit has no span. Rejected: B, wrap every request, because
   the `css.bundle` count and union then stop matching the baseline.
   Rejected: C, a new `css.stylesheet` span, because it adds a stage that the
   acceptance does not need. Reason: A keeps the item's acceptance of zero
   `css.bundle` spans and keeps the numbers comparable.
4. Miss values of the `cache` field: B. `no-record`, `evicted`,
   `stamp-mismatch`, and `inconsistent-evidence`. Rejected: A, the three
   values without `evicted`, because a record that the byte bound removed
   then looks like a root without a record. Reason: `evicted` names the cause
   that this diagnosis needed a throwaway build to find.
5. PostCSS context across attempts: A. Keep one context for each attempt.
   Rejected: B, keep a context while its inputs do not change, because
   Tailwind keeps class candidates in one context, which the PostCSS contract
   forbids across rebuilds. Reason: with decision 1, an unchanged attempt
   starts no PostCSS child at all.
6. PostCSS critical section, raised during step A on 2026-10-28 and decided
   under the user's rule to apply the recommended option: B. Decision 2
   moved the read inventory out of the cache lock, but the second lock that
   stores the processed record still waited behind queued round trips. The
   startup preparations measured 0.73 s and 1.15 s cold, and 0.67 s and
   0.83 s warm. A per-context request lock now keeps one sidecar request at
   a time, the shared cache lock covers only map operations and the
   dependency inventory, and the cache keeps a running byte charge, so an
   insert no longer recounts all records, which took about 4 ms. Rejected:
   A, keep decision 2 alone, because the second preparation misses 0.8 s.
   Rejected: C, one in-flight cell for each input, because a per-context
   lock gives the same single request with less state. Reason: B removes
   both waits, and the probe measured 0.59 s and 0.57 s.
7. Review finding 3 of step A, a missing test for the check under the
   request lock, decided on 2026-10-28 under the user's rule: C, a test that
   holds the shared cache lock until the request holds its turn, then stores
   the result. The purge-sentinel test D that the fix round wrote stays,
   because it checks the same single call through `process`. Rejected: A, a
   test-only hook in product code, because C and D need none. Rejected: E, a
   single-flight helper, because it has one user today. Reason: C fails when
   the check is removed or moved before the lock.
8. Step A acceptance in a slower machine state, decided on 2026-10-28 under
   the user's rule: A, accept step A as measured and move a per-context memo
   of the PostCSS module read inventory to step B. Rejected: B, add the memo
   in step A, because step B already keeps one copy of the module evidence
   for each context and would rework the same path. Reason: the floor is
   the serial PostCSS chain, which no step A change removes, and the
   acceptance holds in the faster state and in the cold pairs.
9. Wider fix of review round 1 finding 1, answered by the orchestrator on
   2026-10-28: B. Give Serve's background base work its own render pool in a
   separate branch later. This plan keeps the shared render pool. Rejected:
   A, the same change in this branch, because the base comparison capture on
   `origin/main` has the same problem and needs its own review.
10. Review round 2 finding 4, answered on 2026-10-28: E. A failed input keeps
    its diagnostic for the rest of its PostCSS context, and a timeout or a
    crash after its retry fails every request of the context that already
    waits for its turn. Rejected: A and D, because a root that reaches a
    failed input later would send it again. Rejected: B alone, because a hang
    on every input would still cost one deadline pair for each waiting
    request. Rejected: C, failing every later request after a timeout,
    because one transient fault would fail every new stylesheet of a live
    generation until the next rebuild.
11. Review round 2 finding 5, answered on 2026-10-28: D. The generation key
    hashes the output key of each resource in place of its input key, so
    worker timing reaches no published identity. Rejected: A, correct the
    docs only, because the key would still change between equal runs.
    Rejected: B, merge the read evidence for the keys, because it misses the
    dependency digests that also grow. Rejected: C, a fixed request order,
    because it removes much of the gain.

12. Observation replay of shared module evidence, decided on 2026-10-28
    under the user's rule: A. An attempt replays the observations of a
    context entry once, and the observations of a record's own inputs on
    each delivery. The replay test on `origin/main` used an input without
    the source prefix, which is module evidence now, so its assertion moves
    to an input with the prefix and keeps its three replays. Rejected: B,
    replay the whole evidence on each delivery, because each hit then
    replays about 1,100 module versions, about 3 ms. Reason: both admission
    ledgers keep sets of observations, so one replay for each attempt gives
    them the same evidence.
13. Miss reason of a record larger than the byte bound, decided on
    2026-10-28 under the user's rule: A, `evicted`. Rejected: B,
    `no-record`, because the bound is the cause, and decision 4 added
    `evicted` to name that cause.

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
- Under decisions 2 and 6, a per-context request lock keeps one sidecar
  request of a context at a time. Under that lock, the adapter checks the
  shared cache again, so equal inputs still make one `processCss` call, and
  stores the raw result before the next request starts. The shared cache
  lock covers only lookups, inserts, and the dependency inventory, and the
  read inventory runs outside both locks. The cache keeps a running byte
  charge.
- Bundling has no warnings. The `Bundle` type carries none, and the dependency
  usage records are ordered sets. The output check compares the generation:
  routes, CSS bytes, keys, sources, and warnings.

### Step B

- The cache layer opens the `css.bundle` span around the inner bundle and
  records `cache` with the miss reason. The shared store keeps the keys of
  records that it removed under the byte bound or kept attempt-local, with
  their reason, while those keys fit in the bound beside the records. The
  timing layer copies the `cache` field to the start and end records.
- Under decision 1, a record keeps its own read evidence: the entries with
  the source prefix. The context's module evidence goes into one shared
  entry with its stamp and consistency, found by its digest. The store
  charges each distinct entry once. An attempt checks the entry's stamp once
  and replays it once. A new bundle reuses a stored entry with equal
  evidence only when that entry's stamp holds in the attempt. A hit returns
  the same bundle and the same evidence as today.
- Under decision 8, the PostCSS adapter keeps each module's late digest for
  the rest of its context. The tree calls run outside that memo's lock, so
  the read inventories of two inputs still overlap.
- The stamp keeps every input: sources, assets, plugin dependency digests,
  directory listings, and the module evidence. Tailwind reports each scanned
  directory with a glob. The dependency inventory digests every matching
  file, so the stamp covers the scanned files by content and by listing.

## Milestone 1: Documentation, step A

Step A keeps the behaviour at every boundary, so no protocol page changes.
The timings contract already says that parallel graph work overlaps.

- [x] Confirm that `docs/protocol/mokly-runtime.md`,
      `docs/protocol/mokly-timings.md`, and `docs/architecture/rust-core.md`
      stay true. Change nothing that stays true.
- [x] Update `crates/mokly-graph/README.md`: preparation bundles the roots on
      the render workers and registers them in root order, and each root job
      checks cancellation. Name `stylesheets` under `### Key Code`.
- [x] Update `crates/mokly-render/README.md`: one context's PostCSS requests
      reach the sidecar one at a time, and the read inventory runs outside the
      PostCSS cache lock.

## Milestone 2: Parallel roots in graph preparation, step A

Write each failing test first.

- [x] Add `StylesheetWorker` and `RenderWorkers::stylesheets` to
      `crates/mokly-graph/src/workers.rs`, and implement it on
      `ThreadWorkers`.
- [x] Forward `stylesheets` in `crates/mokly-cli/src/cancelled_work.rs` with
      a cancellation check before each job. Without it, production keeps the
      serial trait default.
- [x] Run the root jobs in `crates/mokly-graph/src/graph.rs` and register
      the results in root order. Keep the file under 300 lines. Move the
      registration into its own module when the file needs the room.
- [x] Apply decision 2 in `crates/mokly-render/src/postcss.rs`.
- [x] Tests:
  - [x] `crates/mokly-graph/tests`: a fixture with at least six roots gives
        the same routes, CSS bytes, keys, sources, and warnings with one
        worker and with eight workers.
  - [x] `crates/mokly-graph`: with two failed roots, preparation returns the
        error of the first root in root order, also when the later root fails
        first. The test controls the order with signals, not with time.
  - [x] `crates/mokly-graph`: `ThreadWorkers::stylesheets` keeps the input
        order and runs two jobs at the same time. A job waits for a signal
        from the other job, with a polling deadline of at least 10 s.
  - [x] `crates/mokly-cli/tests/serve_process_tests.rs`: through the real
        timing layer, every `css.bundle` span of two roots keeps the
        `graph.prepare` span as its parent.
  - [x] `crates/mokly-cli`: `CancellableWorkers::stylesheets` forwards to its
        inner workers, and a cancelled job returns the cancelled diagnostic.
  - [x] `crates/mokly-render`: while one request runs its read inventory, a
        request for another input of the same context completes its sidecar
        call. Two requests for one input make one sidecar call.
- [x] Run `cargo xtask check --suite repository`.
- [x] Update the mock order of
      `cancellation_tests::preparation_stops_before_the_next_stylesheet_root`
      in `crates/mokly-graph`: the second root still never bundles, and the
      render-cache insert of the first root now follows the root jobs.

Evidence: `.context/perf5-parallel-stylesheets/repository-suite-a2.log`.

## Milestone 3: PostCSS critical section, step A

Decision 6 extends decision 2. Write each failing test first.

- [x] Add a per-context request lock to `crates/mokly-render/src/postcss.rs`.
      The round trip leaves the shared cache lock, and a check under the
      request lock keeps one call for equal inputs.
- [x] Keep a running byte charge in `crates/mokly-render/src/postcss_cache.rs`,
      so an insert or a purge charges one record and never recounts the cache.
- [x] Tests in `crates/mokly-render`: a cached result returns while another
      input of the same context waits for the sidecar, and the running charge
      equals a full recount after inserts, replacements, purges, and clears.
- [x] Update `crates/mokly-render/README.md` for the request lock and the
      running charge.

Evidence: `.context/perf/probe-a2.jsonl` and `.context/perf/probe-a3.jsonl`.

## Milestone 4: Output check and measurement, step A

- [x] Run the mockup check: `npm run build`, then build `examples/basic` with
      `--strict` into `.context/example-after-a2-pinned`, because the output
      check rejects a nested directory under
      `.context/perf5-parallel-stylesheets/`. Build it with the `a9dd1e81`
      binary into `.context/example-before-pinned`, both at the same HEAD
      with `--base` pinned to `a9dd1e81`. Compare the two directories byte for
      byte, and record each difference with its reason.
  - 2,382 files on each side, no difference. The first check without a
    pinned base differed only in `baseCommit` and `deploymentId`, because
    `origin/main` and the repository HEAD had moved between the two builds.
- [x] Smoke test: run `npm run dev`, open one screen of each stylesheet
      group, and check that its CSS applies. Save a screenshot under
      `.context/perf5-parallel-stylesheets/`.
  - Four pages load every stylesheet with rules and no failed response. The
    welcome screen carries the Tailwind `note-title` utility.
- [x] Measure with the shared method: cold and warm serve, the edit run, and
      the React fixture. Check the acceptance: the `css.bundle` union inside
      one startup `graph.prepare` is under 0.8 s. Add one line for each
      catalogue below.
  - The machine speed drifted during the day, so every number below comes
    from interleaved runs of the `a9dd1e81` binary and the step A binary.
  - `examples/basic`, final binary, three warm pairs: `css.bundle` union in
    the two startup preparations 1.11 s and 1.54 s before, 0.85 s and
    0.81 s after; each run 0.70 to 0.97 s. `graph.prepare` 1.78 s and
    2.50 s before, 1.07 s and 1.06 s after. `serve.ready` 17.14 s to
    15.14 s, `changes.classify` 68.56 s to 60.87 s.
  - `examples/basic`, final binary, two cold pairs: `css.bundle` union in the
    startup preparations 1.07 s and 1.41 s, then 0.84 s and 1.08 s before,
    0.76 s and 0.81 s, then 0.76 s and 0.66 s after.
  - `examples/basic`, binary before the review fixes, three warm pairs in a
    faster machine state: 1.06 s and 1.25 s before, 0.61 s and 0.55 s after.
  - The acceptance holds in the faster machine state and in the cold pairs.
    In the slowest warm set the median sits at 0.81 to 0.85 s. Each PostCSS
    round trip then took 19 to 27 ms under parallel load against 17 ms
    serial, and the chain of 35 round trips is the floor. Decision 8.
  - Edit run, two pairs: `watch.action` 12.32 s and 9.07 s before, 11.74 s
    and 9.95 s after. The second classification took about 10 s longer
    after in both pairs, but its base planning, which this change does not
    touch, grew by the same share.
  - React fixture, 13 interleaved pairs: `serve.background` median 2.15 s
    before, 2.21 s after, within the sidecar render noise.

Evidence: `.context/perf5-parallel-stylesheets/step-a-measurements.md`,
`.context/perf5-parallel-stylesheets/output-diff-final.txt`, and the
`smoke-*.png` screenshots there.

## Milestone 5: Verification, commit, review, and pull request, step A

- [x] Run the targeted tests: `cargo test -p mokly-graph`,
      `cargo test -p mokly-render`, `cargo test -p mokly-cli`,
      `npm test -- tests/markdown_links.test.ts`, and `npm run format:check`.
- [x] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
  - The complete gate passed remotely at `98ac863d`: 7 of 7 commands and 5
    of 5 reports, every suite passed.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Round 1 at `a4c5ce6e`: three findings, all confirmed by the validity
    check. Fixed 1, base stylesheet jobs could deadlock foreground renders,
    High, in `512886be`. Fixed 2, a failed root did not stop later roots,
    Medium, in `136815c6`. Finding 3, no test for the check under the
    request lock, Low, applied under decision 7.
  - Follow-up: give Serve's background base work its own render pool, so no
    base job waits at the admission gate on a worker that a foreground
    render needs. Effort Small. Covers finding 1 and the base comparison
    capture below. Previous examples: none found.
  - Outside the scope: `crates/mokly-graph/src/session_collection.rs`, the
    base comparison capture can fill every render worker with jobs that
    wait at the admission gate. Separate branch.
  - Round 2 at `98ac863d`: the fixes of round 1 are correct, and the early
    stop covers only roots that have not started. Two findings, both
    confirmed and both waiting for the user:
  - 4. Running roots repeat a failed PostCSS request. Severity Medium,
       effort Medium. Recommended: E, keep each failed input for the context
       and give a timeout or crash that used its retry to every waiting
       request.
  - 5. Root keys now depend on PostCSS request order. Severity Low, effort
       Small. Recommended: D, hash each stylesheet's output key into the
       generation key in place of its input key.
  - Open, inside the scope: a plugin that keeps state across the
    stylesheets of one context can now emit different CSS between runs,
    because the request order of a context is no longer fixed.
  - Open, inside the scope: the protected-file diagnostic can name a
    different stylesheet between runs, because request order decides which
    roots list a local file that a plugin loads late.

Evidence: `.context/perf5-parallel-stylesheets/review-a1.md`,
`.context/perf5-parallel-stylesheets/validity-a1.md`, and
`.context/perf5-parallel-stylesheets/review-a2.md`.

- [x] Open the step A pull request with the before and after table. Put its
      link in the status paragraph.

## Milestone 6: Answers to review round 2, step A

Decisions 10 and 11 change behaviour, so the contract and the READMEs change
in the same commits. Write each failing test first.

- [x] Apply decision 10 in `crates/mokly-render/src/postcss_turns.rs`,
      `crates/mokly-render/src/postcss.rs`, and
      `crates/mokly-render/src/failures.rs`. State the rule and the decision
      in `docs/protocol/mokly-sidecar-postcss.md` and the render README.
- [x] Apply decision 11 in `crates/mokly-graph/src/graph.rs`. Update the
      graph README and the server index snapshot, whose `live.generation`
      value changes.
- [x] Tests: a failed input fails again for its context without another
      request. Waiting requests receive a lost child, and a later request
      starts again. Private read evidence keeps the generation key, and a
      delivered CSS change changes it.
- [x] Run the `cargo test` suites of `mokly-graph`, `mokly-render`,
      `mokly-cli`, and `mokly-server`.
- [x] Commit, push, and wait for CI on PR #228.
  - CI at `1ba9180a`: every job passed except Repository. It stopped at
    `npm run dependencies:check:rust` on RUSTSEC-2026-0414 for
    `pulldown-cmark` 0.13.4, which every branch now gets. The branch
    `fix/cargo-audit-pulldown-cmark` fixes it. The later repository commands
    passed locally.

## Milestone 7: Documentation and protocol, step B

Step B runs on branch `conductor/perf-5-step-b-stylesheet-cache-reuse`, made
from `origin/main` at `d4c6f6a8` after step A merged. Its pull request opens
after the orchestrator reports that perf 4 (#227) merged, with `origin/main`
merged first.

- [x] Update `docs/protocol/mokly-timings.md`: define the `cache` field of
      the `css.bundle` end record and its values, under decisions 3 and 4.
- [x] Update the read evidence bound sentence of
      `docs/protocol/mokly-sidecar-postcss.md` under decision 1.
- [x] Update the dependency retention section of
      `docs/protocol/mokly-imported-styles-postcss.md`: a cached stylesheet
      bundle is reused only while its sources, assets, plugin-reported files,
      reported directory listings, and PostCSS module evidence are unchanged.
      Record decision 1 next to the rule.
- [x] Confirm that the invalidation section of `docs/protocol/mokly-watch.md`
      stays true.
- [x] Update `crates/mokly-render/README.md`: the bounds, the shared module
      evidence, and the miss reasons. Update `crates/mokly-cli/README.md`
      when it lists timing fields.
  - The watch contract stays true. The CLI README lists no timing field, so
    it does not change.

## Milestone 8: Miss reason on `css.bundle`, step B

Write each failing test first.

- [x] Open the `css.bundle` span in
      `crates/mokly-render/src/stylesheet_cache.rs` around the inner bundle,
      with the `cache` field. Keep the keys of removed and attempt-local
      records with their reason in the shared store.
- [x] Copy the `cache` field to the `css.bundle` records in
      `crates/mokly-cli/src/serve_trace.rs`.
- [x] Tests:
  - [x] `crates/mokly-render`: each miss value under decision 4, with a
        counting tree and a mocked inner bundler.
  - [x] `crates/mokly-cli`: the timing layer copies `cache` to the
        `css.bundle` end record and logs no path.
  - [x] `crates/mokly-cli/tests/serve_process_tests.rs`: the startup
        `css.bundle` records of the real binary carry `no-record`.

## Milestone 9: Gate fix, step B

Write each failing test first.

- [x] Apply decision 1 in `crates/mokly-render/src/stylesheet_cache.rs`
      and the new `stylesheet_record.rs` and `stylesheet_store.rs` beside
      it. `input_stamp.rs` needs no change. Keep each file under 300 lines.
- [x] Apply decision 8: keep the module baselines of the PostCSS read
      inventory once for each context, so each later result of that context
      projects and hashes no module again. Test it with counted tree calls
      for two and eight results.
- [x] Apply decision 12: move the replay assertion of
      `local_and_shared_cache_hits_replay_original_witnesses_without_a_second_transform`
      to evidence with the source prefix. Keep its three replays.
- [x] Unit tests in `crates/mokly-render`:
  - [x] Thirty-nine records with 551 shared module paths fit in one 64 MiB
        store. The test also shows that 39 copies of the module evidence
        would not fit.
  - [x] Hits on two roots and on eight roots of one context check the shared
        module stamp once for each attempt. Count the tree's digest and
        identity calls.
  - [x] A hit returns the same CSS and the same read evidence as the miss
        that made the record, and it replays the same observations.
  - [x] A changed module file makes every record of that context miss with
        `stamp-mismatch`.
  - [x] The store charges a shared entry once, charges a separate entry with
        equal evidence again, drops an entry that no record uses, and
        forgets the miss reasons that do not fit.
- [x] Integration tests in `crates/mokly-render/tests/integration` with the
      real sidecar. The reuse fixture has 64 roots and a PostCSS
      configuration that loads 1,000 installed modules, so 64 copies of the
      module evidence exceed the bound. The tests count `processCss`
      requests: each attempt has its own PostCSS context, so each inner
      bundle of these roots sends one. Both reuse tests fail on `d4c6f6a8`.
  - [x] A second preparation with no change makes no `processCss` call and
        no inner bundle.
  - [x] A preparation after a JavaScript edit makes no inner bundle.
  - [x] An edit to one stylesheet bundles only the roots that import it.
  - [x] A Tailwind fixture: a new file with a new class name in the scanned
        directory makes the Tailwind root bundle again, and its CSS contains
        the new class.

Evidence: `.context/perf5-step-b/baseline-integration.log`.

## Milestone 10: Measurement, step B

- [x] Measure with the shared method: cold and warm serve, the edit run, and
      the React fixture. Add an edit to one stylesheet. Check the acceptance:
      the rebuild after the JavaScript edit and the Changes classification
      have no `css.bundle` span, and the stylesheet edit bundles only the
      roots that import it. Add one line for each catalogue below.
  - `examples/basic` against `3f44d8cc`: the rebuild after the JavaScript
    edit made 0 `css.bundle` spans, against 2. Changes made 0 head-side
    bundles, against 36 in every run. The stylesheet edit bundled its 4
    importing roots, each with `stamp-mismatch`.
  - `examples/basic` against `9ce75853`, after perf 4 merged: the rebuild
    after the JavaScript edit made 0 spans, against 38, and its
    `watch.action` took 2.54 s, against 4.04 s. The stylesheet edit made 4
    spans, against 38. The output check found no byte difference.
  - React fixture: no change. Its 12 roots fit in the bound on both sides.
  - The base side still bundles its 39 roots in each classification,
    because its runtime is new for each classification (perf 6).

Evidence: `.context/perf5-step-b/step-b-measurements.md`.

## Milestone 11: Verification, commit, review, and pull request, step B

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

## Post-merge follow-up (non-blocking)

- [ ] Decision 9: give Serve's background base work its own render pool in a
      separate branch. It also covers the base comparison capture in
      `crates/mokly-graph/src/session_collection.rs`.
- [ ] Follow-up found by the step B integration fixture: share the PostCSS
      configuration's own source files across the records of a context. A
      configuration that loads many files outside `node_modules` still gives
      each record its own copy of their inputs, dependency digests, and
      evidence, so such a catalogue can exceed the bound again. Effort
      Medium. Separate branch.
