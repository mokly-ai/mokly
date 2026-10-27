# Startup Diagnostics And Scale Fixtures

## Opt-In Timings

`--debug-timings` is a common boolean CLI option for `serve` (including the
default command), `build`, and `publish`. It takes no value. Help and version
are immediate. Ordinary commands emit no timing output.

Enabled commands write JSON lines to stderr prefixed with `[mokly:timing] `.
Stdout, exit behaviour, output bytes, validation, and the order of work are
unchanged. The flag measures work; it does not skip checks or change caching.
It always selects the terminal reporter's plain mode, even when stdout is a
TTY or `MOKLY_OUTPUT=rich`, so spinner frames and rich diagnostics cannot
interleave with the JSON-lines contract.

Each record has `schemaVersion: 1`, a process-local `session`, `pid`, `role`,
`stage`, numeric `id`, optional `parentId`, and monotonic `elapsedMs` since
the session began. `event` is `start`, `end`, or `counts`. Span ends add
`durationMs` and `status` (`ok` or `error`). Counts carry named numeric
totals. `role` is `core` for the Mokly binary and `sidecar` for a sidecar
process; the core forwards sidecar records on the same stderr stream
unchanged. The stage names and available counts are diagnostic details, not a
stable public API. No documents, props, file contents, environment values, or
error text are logged.

Parent spans include their children; never sum parent and child durations.
Parallel graph work overlaps, and asynchronous work may outlive its parent.
Process-local elapsed times cannot be compared across processes; use `role`
and `pid` to separate the core from each sidecar. A start without an end
identifies work still in progress or a terminated process. `ok` means a
phase returned successfully, not that optional Git evidence was available.
Serve classification succeeds when ready or unavailable state commits.
Replaced or failed publications keep error status. A `review.capture` span succeeds only after
its files are installed. Its Serve duration includes queue time.

## Core Spans

| Stage                                            | Measures                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `config.load`                                    | configuration discovery, loading, and validation                                                                                     |
| `catalogue.discover`                             | the root walk, front matter and folder parsing, and path derivation                                                                  |
| `catalogue.describe`                             | the wait for the sidecar's `bundle` and `describe` results and their validation                                                      |
| `catalogue.validate`                             | registry, relationship, link, marker, and stylesheet validation                                                                      |
| `graph.prepare`                                  | stylesheet inputs, render plans, and generation keys before document rendering                                                       |
| `render.document`                                | one composed document: substitution, slots, composition, link rewriting, and assembly; carries `viewport` and `scheme`               |
| `render.fragment`                                | the wait for one sidecar render, or an HTML component render in the core                                                             |
| `css.bundle`                                     | one stylesheet bundle on `lightningcss`; `css.postcss` nests inside it for the consumer module                                       |
| `index.build`, `detail.build`                    | the catalogue index and one entry detail                                                                                             |
| `serve.ready`                                    | command start to the listening URL                                                                                                   |
| `serve.background`                               | the background pass over every view, with a `counts` record of `documents`, `fragments`, and `cacheHits`                             |
| `watch.action`                                   | one watch action from debounce end to publication; carries `action`                                                                  |
| `changes.classify`                               | one Changes classification, in Serve and in `build`                                                                                  |
| `review.base-commit`                             | merge-base resolution and commit validation; a pinned commit reuses the result without another Git span                              |
| `review.base-tree`                               | base source preparation and complete rendering, including bounded tree/blob reads, extraction, and dependency preparation            |
| `review.base-extraction`                         | the base source key, the cache lookup, and the extraction when no complete entry exists; carries `action`, `reuse` or `extract`      |
| `review.base-dependencies`                       | the dependency tier decision and, in the second tier, the bounded install; the end carries `tier`                                    |
| `review.compare-views`                           | the comparison loop; its `counts` record carries `views`, `unchanged`, `changed`, and `ignoredOnly`                                  |
| `review.capture-side`                            | base validation and bounded capture or reuse; completed counts carry `views`, `uncapturedViews`, `retainedBytes`, and `encodedBytes` |
| `review.resource-graph`                          | reference discovery and transitive traversal for one view or document side                                                           |
| `review.css-analysis`                            | the parse, diff, match, and reduce pass for one changed stylesheet and one document pair, cache hits included                        |
| `review.capture`                                 | one on-demand comparison generation, or the static comparison generation of `build`                                                  |
| `output.write`                                   | the static output transaction: `output.stage`, `output.install`, `output.rollback` after a failed install, `output.cleanup`          |
| `output.fingerprint`, `output.input-digests`     | selected root capture and later inventoried source digests; carry `inputPaths` and `retainedBytes`                                   |
| `output.recheck`                                 | final selected membership, identity, and live digest verification; carries `inputPaths` and `retainedBytes`                          |
| `output.input-read`                              | a static captured-tree read; carries `action` (`private` or `public`), `readBytes`, and `retainedBytes`                              |
| `upload.plan`, `upload.blobs`, `upload.complete` | the exchange rounds of `publish`                                                                                                     |

Review spans use the same session, role, and parent context as their caller:
under `changes.classify` in Serve and under `output.write` in `build`. The
`review.capture-side` span carries `side`, with `base` for the base generation
and `head` for the head generation. Build and publish emit the head capture
under `output.write` before `changes.classify`. The base capture appears under
`review.base-tree`. A repeated discovery for the same side, route, content
digest, and exclusion identity is a defect. A contained parse or selector failure in
`review.css-analysis` returns unresolved evidence with status `ok`; an
escaping error ends the span with `error`. The spans log no paths,
selectors, CSS, or document text.

Dependency `tier` is numeric: 1 for working dependencies, 2 for the base
installation, and 3 for fallback. A successful fallback has status `ok`.
Comparison counts cover the final view and document union. `changed` includes
added and removed views; `unchanged` and `ignoredOnly` are separate totals.
Only a completed comparison emits these counts. `review.base-extraction`,
`review.base-dependencies`, and `review.compare-views` start with error status and
record `ok` only after successful work.

Static input counters on `output.*` stages are observations. Their
`retainedBytes` counts private source payload once per captured path.
It excludes map metadata and other byte owners.
Reads below a `css.bundle` span describe calls that reach the captured tree;
inner cache hits and bundle copies do not appear as captured reads.

`sidecar.operation` carries `event: "counts"`, `count: 1`, `operation`, and
`worker`, the sidecar PID. Operations are `esbuild`, `postcss-start`, and
`postcss-stop`. The worker emits each event at the actual operation boundary,
including failed compilations. Replay and evaluation-only reuse add no
`esbuild` count. These records contain no authored data.

`review.capture-side` starts with status `error` and records `ok` only after
successful work. Completed captures emit counts, including a zero-view capture
when no input fits. `views` counts retained documents on `side`.
`uncapturedViews` counts documents that use that side's source fallback. These
counts sum to the number of documents on that side, including on reuse.
`encodedBytes` counts compressed document and CSS payloads. `retainedBytes` adds
the capture's metadata, closures, generated digests, route keys, and
conservative container charges. Each side has a separate 256 MiB capture bound
beside the render cache. These charges are not measured RSS. Serve can hold an
accepted capture while building its replacement.

## Sidecar Spans

[Sidecar timing records](./mokly-sidecar-timings.md) define request spans,
process startup and retirement, replacement reasons, and parent ownership.

For aggregate stage time, take the union of each stage's
`[elapsedMs - durationMs, elapsedMs]` end-record intervals within one session.
For the scale fixture's CSS share of Changes time, divide the union of
`review.css-analysis` intervals by the `changes.classify` duration of the same
session, separately for cold and warm runs. Do not use whole startup time or
sums across sessions.

## Scale Fixture

The repository's large consumer is synthetic and opt-in. Its generator
produces an HTML variant and a React variant of the same catalogue: nested
folders, component entries with variants, repeated and nested component usage,
slots, both viewports and colour schemes, catalogue links, pages, use cases,
Markdown documents, imported CSS, and images, with configurable sizes. It is a
repeatable workload for locating scaling costs, not a claim of identical
production data or timings. The fixture provides a base commit so Changes
performs a real comparison, and the benchmark expects zero Changes.

The benchmark runs four scenarios on each variant, with the sidecar count held
constant and other heavy work idle:

1. `build`: command start to exit, and the peak resident size of the core
   and the sidecars.
2. `serve` startup: `usableMs`, command start to searchable navigation with
   real preview content in a browser, measured cold and then in a fresh
   server and browser context for an OS-warm restart; `changesReadyMs`
   waits for delivered Changes in Browse. "Cold" means application-cold,
   not a flushed page cache.
3. Changes: the `changes.classify` duration and the CSS share, cold and warm.
4. Watch: an edit to one screen, one component, and one stylesheet, each
   measured from the file write to the frame reload in the browser.

A scenario that waits for Changes fails when Changes is unavailable.
Unavailable Changes never counts as zero Changes. Resident sizes are sampled
observations, not exact operating system high-water marks. The
[large fixture README](../../tests/fixtures/large/README.md) describes the
generator, its options, the toolchain modes, the harness limits, and the
commands.

CI's small correctness fixtures have
[no machine-specific wall-clock assertion](./ci-test-timing.md).

## Budgets

| Budget                             | Rule                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `usableMs`                         | under 5000 ms for HTML and under 15000 ms for React, cold and warm, on the acceptance build                                    |
| full isolated fixture setup        | under 60000 ms                                                                                                                 |
| isolated setup-family peak RSS     | under 1.5 GiB, including the setup harness and its descendants                                                                 |
| sidecar deadlines and recycling    | the values of the [sidecar contract](./mokly-sidecar.md#cancellation-and-timeouts)                                             |
| base dependency preparation        | 120 seconds (120,000 ms) shared by version discovery and all selected installs; expiry uses the documented dependency fallback |
| comparison cache namespace         | 2 GiB (2,147,483,648 bytes) per repository and namespace, separately for extraction and dependency installs                    |
| render cache bounds                | the byte bounds of the [runtime contract](./mokly-runtime.md#render-graph-and-cache)                                           |
| `build` time and peak memory       | recorded per variant from scenario 1                                                                                           |
| `changesReadyMs` and the CSS share | recorded per variant from scenarios 2 and 3                                                                                    |
| watch edit-to-reload               | recorded per edit kind from scenario 4                                                                                         |

Startup acceptance uses an optimized release native binary. The harness
verifies that binary before timing and identifies its profile and digest in
the results. Build preparation is outside the startup measurement.
Decision: React startup keeps complete-catalogue readiness under its own
budget. Usable navigation before every entry is ready was not chosen because
it changes the readiness and validation order and needs pending entries and
delayed errors.

Isolated setup includes catalogue generation, package archives, dependency
installation, and Git setup. The product build is a prerequisite outside this
measurement. Setup records keep elapsed time, sampled peak RSS, and failures.
An observation at or above either setup budget fails isolated setup.

A row whose value is a recording rule rather than a number is measured and
reported, not enforced. The runtime enforces cache and dependency-preparation limits. The benchmark
enforces numeric acceptance thresholds and fails when one is exceeded. A startup observation
at or above its variant's budget produces a failed result with its measured
values and reason.
