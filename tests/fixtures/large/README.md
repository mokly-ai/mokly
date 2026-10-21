# Large Consumer Fixture

Status: In progress under the [Rust rebuild plan](../../../plans/rust-rebuild.md).

The generator makes HTML and React catalogues with the same entry paths,
viewports, colour schemes, component variants, slots, pages, flows,
Markdown documents, CSS imports, and images. React uses Firna and React Native Web.
HTML starts no sidecar. Defaults produce 1,620 routes and 5,850 documents.
Component parents have their own views as well as three saved variants.

Build the workspace before these opt-in commands. Select small dimensions on
a shared machine. Run one benchmark at a time.

```sh
npm run build
npm run fixture:large -- --variant html --areas 2 --screens 12 --rows 8 --root .context/large-html
npm run benchmark:large -- --root .context/large-html --scenario all --sidecars 2
npm run fixture:large -- --variant react --areas 2 --screens 12 --rows 8 --root .context/large-react
npm run benchmark:large -- --root .context/large-react --scenario build --sidecars 2
```

Generation requires an empty directory. Options are `--areas`, `--screens`
(at least two), `--rows`, `--stylesheets`, and `--stylesheet-share` (0 to 1).
Shared stylesheets apply to the leading `ceil(screens * share)` screens in
each area. Setup commits the source, then adds one non-matching CSS rule.
Generated output stays ignored.

`--toolchain workspace` is the default. It links the workspace dependencies
and records their lockfile. It measures no install time. `--toolchain install`
packs the CLI, viewer, and every native package, pins consumer dependencies,
and runs an isolated install. Only the host native package needs a built binary.
Other native archives carry their available metadata and remain optional.
Their platform selectors prevent installation on the host. Local overrides
keep all five targets in the consumer lockfile without registry publication.
Full isolated setup must finish below 60000 ms and stay below 1.5 GiB sampled
RSS for the setup harness and its descendants. Both limits are exclusive.
Setup includes generation, package archives, npm, and Git. Product builds
finish before the setup clock and RSS sampler start. Workspace reuse has no
isolated-setup budget. Setup writes its result and samples to `.context/setup.json`,
also when installation or a budget fails. A budget failure exits unsuccessfully
after preserving the complete fixture record. Setup time is separate from Serve.

The four scenarios are `build`, `serve`, `changes`, and `watch`. Use `all` to
select all four. Serve checks navigation search, real previews, both axes, live props, and a page.
Use `--scenario startup` for focused cold/warm startup acceptance. It keeps
those browser checks and the real base, but does not wait for Changes or review
availability. Its result omits those measurements. `all` keeps the four complete
scenarios; `serve` includes delivered Changes and available review.
Cold and warm runs each use a new Serve process and browser context.
Both keep the native comparison caches. Cold means application-cold, not an
empty disk cache. Serve prepares the pinned fixture base through M9: HTML
reads Git sources; React acquires source and dependency leases. The harness
records the announced cache directory and never resets a baseline output.
Serve reports delivered Changes readiness and review availability separately.
Changes verifies the browser's own event stream, delivered index, Changes
control, and advertised review. The unrelated CSS edit must list no Changes.
Its report includes each classification duration and the union of CSS analysis
intervals on that classification's core clock. These are observations.
Watch uses one Serve process. It edits one screen, one component, and one
stylesheet in turn. Each edit records the browser publication, changed frame,
ready index, Changes control, and available review. The browser clock starts
immediately before the driver requests the file write. This includes driver
dispatch. Publication and index timestamps come from the shell's own stream
and fetch responses. Frame and control times include browser assertion work.
Every edit restores its original bytes. The next edit waits for the restored
frame and Changes state. A failed run keeps completed edits in its report.
When Serve stops during a measurement, the harness closes that measurement's
browser context and waits for source restoration before it reports failure.
For ordinary development, reuse a generated configuration with
`npx mokly serve --config .context/large-html/mokly.config.json`.

The harness needs `ps`, Chrome (or `PLAYWRIGHT_CHANNEL`), and a Unix host.
It samples aggregate RSS. `--memory-stop-kib` defaults to 1750000; use 0 to
disable it. React Serve needs a larger stop on a machine with more memory.
Do not raise the stop on a shared machine without sufficient capacity.
A safety stop records failure and keeps completed measurements and diagnostics.
Startup acceptance uses an optimized release native binary. Before a Serve
benchmark, workspace mode builds that binary and installs it in the host
native package. Isolated generation builds it before packing, outside setup
timing. An installed fixture verifies its recorded binary digest before Serve.
Each startup result records the release profile, target, source, and digest.
The opt-in benchmark fails at or above 5000 ms for HTML or 15000 ms for React,
for both cold and warm startup.

Sidecar deadlines use their normal contract unless `--sidecar-timeout-ms` is
set. Reports record this override, `MOKLY_SIDECAR_TIMEOUT_MS`, `NODE_OPTIONS`,
`GOMAXPROCS`, and `GOMEMLIMIT`. These values can change time and memory use.
Default build and listening waits stop after 300 seconds. Browser operations allow
60 seconds. The watch scenario uses a 30-minute browser liveness allowance for
the full-size React catalogue. This allowance covers initial rendering,
delivered Changes, review fetches, and restoration. It is a harness liveness
guard, not an edit-to-reload budget or a product timeout. Shutdown escalates
to SIGKILL after 10 seconds.

`generate` accepts variant, toolchain, and size flags. `benchmark` reads those
from the fixture record and rejects overrides. It accepts scenario, sidecar,
memory-stop, and sidecar-timeout flags. Each scenario prints a progress line.
Both commands warn if Git does not confirm that `--root` is ignored.
Each fixture's `.context/` holds its setup record, logs, timing records, and
`measurements.json`. See the [scale contract](../../../docs/protocol/mokly-timings.md#scale-fixture)
and [reference capture procedure](../../../docs/protocol/rust-rebuild-procedures.md#reference-capture).

Build reports include input-capture and recheck spans, retained private source
payload, per-root CSS preparation, and bracketing RSS samples. These are
observations, not acceptance budgets. Captured read totals exclude inner cache
hits and bundle copies. An unfinished span stays marked `incomplete`.
Programmatic build probes can pass `{ buildChanges: false }` to `benchmark`
to isolate current-source preparation from comparison work.
They can set `buildDeadlineMs` for an observation that needs a longer build wait.
The report records the chosen deadline. It changes no acceptance or memory budget.
