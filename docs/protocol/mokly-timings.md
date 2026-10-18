# Startup Diagnostics And Scale Fixtures

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

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
totals. `role` is `core` for the Rust binary and `sidecar` for a sidecar
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

## Core Spans

| Stage                                            | Measures                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `config.load`                                    | configuration discovery, loading, and validation                                                                            |
| `catalogue.discover`                             | the root walk, front matter and folder parsing, and path derivation                                                         |
| `catalogue.describe`                             | the wait for the sidecar's `bundle` and `describe` results and their validation                                             |
| `catalogue.validate`                             | registry, relationship, link, marker, and stylesheet validation                                                             |
| `graph.prepare`                                  | stylesheet inputs, render plans, and generation keys before document rendering                                              |
| `render.document`                                | one composed document: substitution, slots, composition, link rewriting, and assembly; carries `viewport` and `scheme`      |
| `render.fragment`                                | the wait for one sidecar render, or an HTML component render in Rust                                                        |
| `css.bundle`                                     | one stylesheet bundle on `lightningcss`; `css.postcss` nests inside it for the consumer module                              |
| `index.build`, `detail.build`                    | the catalogue index and one entry detail                                                                                    |
| `serve.ready`                                    | command start to the listening URL                                                                                          |
| `serve.background`                               | the background pass over every view, with a `counts` record of `documents`, `fragments`, and `cacheHits`                    |
| `watch.action`                                   | one watch action from debounce end to publication; carries `action`                                                         |
| `changes.classify`                               | one Changes classification, in Serve and in `build`                                                                         |
| `review.base-commit`                             | merge-base resolution and commit validation; a pinned commit reuses the result without another Git span                     |
| `review.changed-paths`                           | changed-path discovery, deduplication, and sorting                                                                          |
| `review.base-tree`                               | base source preparation and complete rendering, including bounded tree/blob reads, extraction, and dependency preparation   |
| `review.base-dependencies`                       | the dependency tier decision and, in the second tier, the bounded install; the end carries `tier`                           |
| `review.compare-views`                           | the comparison loop; its `counts` record carries `views`, `unchanged`, `changed`, and `ignoredOnly`                         |
| `review.resource-graph`                          | reference discovery and transitive traversal for one view or document side                                                  |
| `review.css-analysis`                            | the parse, diff, match, and reduce pass for one changed stylesheet and one document pair, cache hits included               |
| `review.capture`                                 | one on-demand comparison generation, or the static comparison generation of `build`                                         |
| `output.write`                                   | the static output transaction: `output.stage`, `output.install`, `output.rollback` after a failed install, `output.cleanup` |
| `output.fingerprint`, `output.input-digests`     | selected root capture and later inventoried source digests; carry `input_paths` and `retained_bytes`                        |
| `output.recheck`                                 | final selected membership, identity, and live digest verification; carries `input_paths` and `retained_bytes`               |
| `output.input-read`                              | a static captured-tree read; carries `action` (`private` or `public`), `read_bytes`, and `retained_bytes`                   |
| `upload.plan`, `upload.blobs`, `upload.complete` | the exchange rounds of `publish`                                                                                            |

Review spans use the same session, role, and parent context as their caller:
under `changes.classify` in Serve and under `output.write` in `build`. A
repeated discovery for the same side, route, content digest, and exclusion
identity is a defect. A contained parse or selector failure in
`review.css-analysis` returns unresolved evidence with status `ok`; an
escaping error ends the span with `error`. The spans log no paths,
selectors, CSS, or document text.

Dependency `tier` is numeric: 1 for working dependencies, 2 for the base
installation, and 3 for fallback. A successful fallback has status `ok`.
Comparison counts cover the final view and document union. `changed` includes
added and removed views; `unchanged` and `ignoredOnly` are separate totals.
Only a completed comparison emits these counts. `review.base-dependencies`,
`review.compare-views`, and `review.changed-paths` start with error status and
record `ok` only after successful work.

Static input counters are observations. `retained_bytes` counts private source
payload once per captured path. It excludes map metadata and other byte owners.
Reads below a `css.bundle` span describe calls that reach the captured tree;
inner cache hits and bundle copies do not appear as captured reads. The harness
matches these spans to the RSS samples before and after their received interval.
These samples can include adjacent work and can count shared pages more than once.

`sidecar.operation` carries `event: "counts"`, `count: 1`, `operation`, and
`worker`, the sidecar PID. Operations are `esbuild`, `postcss-start`, and
`postcss-stop`. The worker emits each event at the actual operation boundary,
including failed compilations. Replay and evaluation-only reuse add no
`esbuild` count. These records contain no authored data.

## Sidecar Spans

The core selects sidecar timing through the optional `hello.params.timings`
boolean. It defaults to `false`. No environment variable carries this choice.
An enabled sidecar writes its timing records to stderr. The core forwards
complete records unchanged; other stderr lines remain diagnostics.

A sidecar emits records with `role: "sidecar"` and its own `pid` and session
for `sidecar.bundle`, `sidecar.describe`, `sidecar.render` (with `kind`:
`screen`, `component`, `story`, or `page`), and `sidecar.process-css`, each
measured inside the process from request receipt to response write. The core
emits `sidecar.spawn` for a spawn up to the `hello` exchange, and
`sidecar.recycle` for a replacement. The difference between a core
`render.fragment` span and the matching sidecar span is transport and queue
time.

Spawn and replacement spans start with error status and record `ok` only after
hello succeeds. A replacement span encloses its spawn/hello span.

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
Markdown documents, imported CSS, and images, with configurable sizes. A small
instance of the generator runs in automated tests; a full-sized instance is
smoke-tested with the opt-in benchmark. It is a repeatable workload for
locating scaling costs, not a claim of identical production data or timings.

The fixture provides a base commit so Changes performs a real comparison:
after the base commit, setup adds an unrelated rule to the first shared
stylesheet, so classification exercises real rule evidence and attribution
excludes the unrelated rule from every linked screen; the benchmark expects
zero Changes, including use cases. `--toolchain install` archives the CLI,
viewer, native package, and consumer lockfile, then installs head dependencies.
`--toolchain workspace` reuses the workspace dependencies and saves their
lockfile for evidence. Every result names the mode. Setup time is separate;
workspace reuse has no install-time measurement.

The benchmark harness runs four scenarios on each variant, with the sidecar
count held constant and other heavy work idle:

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

The benchmark launches the browser before timing a fresh Serve process,
verifies viewport and scheme changes, a live prop edit, pages, and eventual
Changes, and reports each measurement as JSON on stdout. It writes one progress
line to stderr when each scenario starts. A fresh Serve process and browser
context define each restart. The browser process starts before measurement.

The harness samples process RSS every 50 ms. It reports the maximum sum for
the CLI shim, core, and sidecar descendants across process groups, plus the maximum for the whole harness tree,
including the browser. Chrome uses at most two renderer processes and disables
GPU acceleration. These are sampled observations, not exact operating system
high-water marks. `--memory-stop-kib` defaults to 1,750,000 KiB of whole-tree
RSS. Set a larger limit on a suitable machine, or use 0 to disable the stop.
The report records the limit. This safety stop is not an acceptance budget.

Sidecar deadlines follow the sidecar contract. `--sidecar-timeout-ms` explicitly
sets `MOKLY_SIDECAR_TIMEOUT_MS` for the child. Each report records this option,
the inherited timeout variable, exact `NODE_OPTIONS`, Node heap limit,
`GOMAXPROCS`, and `GOMEMLIMIT`. Overrides affect measurements and must accompany
any comparison. Build and listening waits have 300-second liveness deadlines.
Browser operations allow 60 seconds. A deadline fails the run and preserves
its diagnostic. Shutdown sends SIGTERM, then SIGKILL after 10 seconds if needed.

Fixtures and logs belong in ignored directories. The CLI checks `git check-ignore`
and warns when the chosen root is not confirmed ignored. It rejects options
that do not apply to the selected command. Use the
[large fixture commands](../../tests/fixtures/large/README.md) to select dimensions,
a variant, a memory stop, and one of the four scenarios.

CI's small correctness fixtures have
[no machine-specific wall-clock assertion](./ci-test-timing.md).

## Budgets

| Budget                                               | Rule                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `usableMs`                                           | under 5000 ms, cold and warm, on both fixture variants                                              |
| sidecar deadlines and recycling                      | the values of the [sidecar contract](./mokly-sidecar.md#cancellation-and-timeouts)                  |
| dependency install time limit                        | the second tier's limit; a run over it falls to the third tier with the `base-dependencies` warning |
| render cache, extraction cache, install cache bounds | the byte bounds of the [runtime contract](./mokly-runtime.md#render-graph-and-cache)                |
| `build` time and peak memory                         | recorded per variant from scenario 1                                                                |
| `changesReadyMs` and the CSS share                   | recorded per variant from scenarios 2 and 3                                                         |
| watch edit-to-reload                                 | recorded per edit kind from scenario 4                                                              |

This table holds the budgets with the values the user approved. A row whose
value is a recording rule rather than a number is measured and reported, not
enforced; a number enters the row when the user approves it. The benchmark
enforces every numeric row and fails when one is exceeded. A startup observation
at or above 5000 ms produces a failed result with its measured values and reason.
