# Large Consumer Fixture

Status: In progress under the [Rust rebuild plan](../../../plans/rust-rebuild.md).

The generator makes HTML and React catalogues with the same entry paths,
viewports, colour schemes, component variants, slots, pages, flows, related
Markdown, CSS imports, and images. React uses Firna and React Native Web.
HTML starts no sidecar. Defaults produce 1,590 routes and 5,790 documents.
Component parents have their own views as well as three saved variants.

Build the workspace before these opt-in commands. Select small dimensions on
a shared machine. Run one benchmark at a time.

```sh
npm run build
npm run fixture:large -- --variant html --areas 2 --screens 12 --rows 8 --root .context/large-html
npm run benchmark:large -- --root .context/large-html --scenario all --sidecars 2
npm run fixture:large -- --variant react --areas 2 --screens 12 --rows 8 --root .context/large-react
npm run benchmark:large -- --root .context/large-react --scenario all --sidecars 2
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
select all four. Unavailable Changes and watch integrations return a deferred
record with their owner. They do not count as successful measurements. Serve
checks navigation search, real previews, both axes, live props, and a page.
Cold and warm runs each use a new Serve process and browser context.

The harness needs `ps`, Chrome (or `PLAYWRIGHT_CHANNEL`), and a Unix host.
It samples aggregate RSS and uses a 1,750,000 KiB safety cutoff. Time and RSS are
observations. They are not assertions or proposed acceptance budgets.
A safety stop records failure and keeps completed measurements and diagnostics.
Each fixture's `.context/` holds its setup record, logs, timing records, and
`measurements.json`. See the [scale contract](../../../docs/protocol/mokly-timings.md#scale-fixture)
and [reference capture procedure](../../../docs/protocol/rust-rebuild-procedures.md#reference-capture).
