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
packs the CLI, viewer, and host native package, pins consumer dependencies,
and runs an isolated install. Its setup time is separate from the benchmark.

The four scenarios are `build`, `serve`, `changes`, and `watch`. Use `all` to
select all four. Serve checks navigation search, real previews, both axes, live props, and a page.
Cold and warm runs each use a new Serve process and browser context.
For ordinary development, reuse a generated configuration with
`npx mokly serve --config .context/large-html/mokly.config.json`.

The harness needs `ps`, Chrome (or `PLAYWRIGHT_CHANNEL`), and a Unix host.
It samples aggregate RSS. `--memory-stop-kib` defaults to 1750000; use 0 to
disable it. React Serve needs a larger stop on a machine with more memory.
Do not raise the stop on a shared machine without sufficient capacity.
A safety stop records failure and keeps completed measurements and diagnostics.
The opt-in benchmark fails if usable startup is at or above 5000 ms.

Sidecar deadlines use their normal contract unless `--sidecar-timeout-ms` is
set. Reports record this override, `MOKLY_SIDECAR_TIMEOUT_MS`, `NODE_OPTIONS`,
`GOMAXPROCS`, and `GOMEMLIMIT`. These values can change time and memory use.
Default build and listening waits stop after 300 seconds. Browser operations allow
60 seconds. Shutdown escalates to SIGKILL after 10 seconds.

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
