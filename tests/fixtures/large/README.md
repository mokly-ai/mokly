# Large Mokly Consumer

A deterministic, synthetic workload for finding catalogue-size bottlenecks.
It uses the real build, watched server, component usage collector, Firna controls,
React Native Web styling and Git Changes path. Nothing is added to the basic
example's generated files or shipped as product data.

```bash
npm run fixture:large
npm run dev:large -- --debug-timings
npm run benchmark:large
npm run fixture:large -- --areas 2 --screens 10 --rows 6
npm run benchmark:large -- --areas 2 --screens 10 --rows 6
npm run fixture:large -- --stylesheets 8 --stylesheet-share 0.75
npm run benchmark:large -- --stylesheets 8 --stylesheet-share 0.75
npm run fixture:large -- --inline-styles
npm run dev:large -- --inline-styles --debug-timings
npm run benchmark:large -- --inline-styles
npm run fixture:large -- --derived
npm run dev:large -- --derived --debug-timings
npm run benchmark:large -- --derived
```

`fixture:large` creates a `.context/mokly-large-*` directory, builds its output
and commits a `main` baseline **inside that isolated fixture**, not in Mokly's
repository. It reports setup time separately and saves a size-keyed record for reuse.
The record key includes the stylesheet count, share, inline-style mode, and
output mode. After committing, setup appends one unrelated
`.scale-unrelated-rule` rule to `assets/shared-1.css`. That is the only initial
worktree edit; the generated documents stay current. The selector occurs in no
screen, so `dev:large` exercises rule exclusion without adding a screen or flow
to Changes. The benchmark replaces that edit with each deterministic scenario
below. Committed `dev:large` and `benchmark:large` reuse the prepared baseline
bytes. Neither mode repeats package compilation. Run `npm run build` explicitly
after changing Mokly's source. Missing setup fails with the matching preparation
command; `--config` can select an existing fixture. `dev:large` serves until
Ctrl-C.

`benchmark:large` launches Chrome, starts a fresh server and measures command
start to searchable navigation with a real selected preview visible. It verifies
record count, both viewports/themes, a successful Action label Props edit and a
whole page. It runs three classification scenarios: no changes, one component
head-style edit, and one screen-markup edit. Expected navigation membership is
zero, one component, and the edited screen plus its use case, respectively. Each
scenario runs with a new server and browser context for cold and warm samples.
JSON records separate listening, usable startup, Props, cached delivery,
complete Changes and classification times. It also records the interval-union
share of background classification spent in `review.inline-style-analysis`.

Chrome is launched before timing; “cold” means application-cold, not a flushed
OS page cache. The benchmark emits the complete six-sample matrix before
returning a failure if any usable startup is five seconds or above. A bounded
classification failure is recorded as that sample and does not hide the later
samples, but still makes the command fail after the report. Changes and
exhaustive rendering have no five-second budget; the cumulative variant alone
uses a fifteen-minute delivery ceiling. Generated fixtures remain for
inspection.

`--inline-styles` selects a separate fixture record and renderer. It uses one
process-global React Native Web sheet whose deterministic owner and per-view
rules accumulate in exhaustive build order. A later screen therefore carries
rules registered while earlier component variants and screens rendered, even
when it does not use those components. The component-style scenario edits only
the area-one Action rule; the correctness test requires exactly that component
in Changes, its three consuming screens as affected, and a later area-two
non-consumer absent from both sets.

### Measured default-size run

The 2026-09-28 committed-output measurement used Linux x64, Node 24.19.0,
an Intel Xeon processor at 2.90 GHz, eight logical CPUs and 16.3 GiB RAM. Both
fixtures used 30 areas, 40 screens per area, 12 rows per screen, four shared
stylesheets and a 0.5 stylesheet share: 1,410 routes and 5,550 documents.

| Fixture          | Setup      | Fixture size |
| ---------------- | ---------- | ------------ |
| Default          | 67,016 ms  | 189 MB       |
| Cumulative sheet | 201,623 ms | 855 MB       |

| Fixture          | Scenario        | State | Usable | Classification    | Inline union | Share |
| ---------------- | --------------- | ----- | ------ | ----------------- | ------------ | ----- |
| Default          | No changes      | Cold  | 5,463  | 28,270.31         | 0            | 0%    |
| Default          | No changes      | Warm  | 4,842  | 27,499.08         | 0            | 0%    |
| Default          | Component style | Cold  | 4,783  | 29,540.95         | 1,091.24     | 3.69% |
| Default          | Component style | Warm  | 4,943  | 30,266.03         | 1,086.13     | 3.59% |
| Default          | Screen markup   | Cold  | 4,803  | 29,074.38         | 9.88         | 0.03% |
| Default          | Screen markup   | Warm  | 4,708  | 28,631.25         | 8.84         | 0.03% |
| Cumulative sheet | No changes      | Cold  | 5,032  | 135,135.97        | 0            | 0%    |
| Cumulative sheet | No changes      | Warm  | 4,952  | 126,913.33        | 0            | 0%    |
| Cumulative sheet | Component style | Cold  | 4,978  | OOM at 139,423.70 | ≥101,798.38  | n/a   |
| Cumulative sheet | Component style | Warm  | 4,856  | OOM at 141,340.97 | ≥109,169.22  | n/a   |
| Cumulative sheet | Screen markup   | Cold  | 4,753  | 132,221.30        | 9.80         | 0.01% |
| Cumulative sheet | Screen markup   | Warm  | 4,972  | 138,256.26        | 21.32        | 0.02% |

Times are milliseconds. A successful classification row uses the background
`changes.classify` span and the clipped interval union defined by the timing
contract. The two OOM rows have no completed background classification span:
their displayed bounds are the supervising Serve span until the fixed 1 GiB
worker terminated. Their inline values are lower bounds from 397 and 400
completed intervals; each run also had an unfinished inline interval, so no
contract share can be computed.

The five-second navigation target **does not hold**: the default no-change cold
sample took 5,463 ms and the cumulative no-change cold sample took 5,032 ms.
Listener readiness was the largest measured part of those interactive samples
(3,524 ms and 3,315 ms); background classification begins outside that usable
navigation boundary. For successful default classifications,
`review.compare-screens` dominated at roughly 24–26 seconds while inline
analysis stayed at or below 3.69%. Cumulative no-change and screen-markup runs
were dominated by traversing the much larger documents even with zero or
near-zero inline share. For the component edit, completed inline intervals
already occupied 73% cold and 77% warm of the supervisor-observed time before
the heap failure, making cumulative inline parsing and attribution the dominant
bounded-classification cost. This milestone records the evidence without a
speculative optimization.

### Derived baselines

`--derived` uses a separate record for the same dimensions and leaves generated
HTML and the manifest untracked. Setup packs the already-built Mokly package
into `tooling/mokly.tgz`, pins Firna and its peers from this repository's
lockfile, creates the consumer's own lockfile and installs it. Source, public
CSS/SVG, the package archive and lockfile form the fixture's Git baseline.
`node_modules` and `.mokly-cache` remain ignored. Source-only setup does not
build or prewarm the baseline cache.

Cold Serve executes `npm ci` and
`npx --no-install mokly build --config mokly.config.ts` from the archived
commit. It therefore uses the fixture commit's packaged Mokly and dependencies,
even after this checkout's package changes. The current side uses the CLI in
this checkout. Regenerate the fixture to baseline a newer package version.

Before each scenario, the benchmark resets only the pinned baseline entry while
holding its lock, requires a real cold rebuild, then requires a cache hit on the
warm restart. Stop other servers using the fixture before running it; an active
builder makes the reset fail. Normal `dev:large` reuses completed entries. The
npm download and OS caches are retained in both cases; “cold” refers to
rebuilt-output caching.

Every sample must provide usable navigation within five seconds. JSON additionally
reports `baselineMs`, `baselineReadyMs`, `preparingToPendingMs`, `cacheHit` and
`baselinePhases`. These come from builder timings, so they also work without
Serve's preparing UI. A warm hit has zero `preparingToPendingMs`. Baseline
preparation and final Changes are measured separately from navigation and have
no five-second budget. To smoke-test faster, add matching
`--areas 2 --screens 10 --rows 6` options to both setup and benchmark.

Defaults are 30 areas, 40 screens per area, and 12 records per screen. Each area
adds two registered components with three saved variants, a page and one flow
per ten screens. The default therefore has 1,410 routed entries and 5,550
documents plus the manifest. Collections are additional non-routed entries.
Each screen and component variant renders in mobile/desktop and light/dark.
Flows reuse the canonical screens rather than adding documents. Shared panels
contain nested actions and caller-owned slots; screens also invoke repeated
actions. Local CSS imports and SVG resources exercise resource validation and
watch discovery. Templates use the basic example's theme tokens.

Four additional shared stylesheets are generated by default. Every sheet is
linked by the first 50% of screens in each area, in all four viewport/scheme
documents. This adds four direct CSS dependencies to 600 screens in the default
fixture; pages and saved component variants keep only the existing catalogue
stylesheet. `catalogue.css` and its imported `tokens.css` are always present and
are additional to the configured shared-sheet count.

`--areas`, `--screens` and `--rows` take positive integers; screens must be at
least two per area. To reproduce a source edit, change an entry module in the
printed directory, or its shared `entries/screens.tsx`, then observe rebuild
and Changes timings. To compare repeated startups, reuse the printed config
path instead of generating a new baseline every time.

`--stylesheets` takes a non-negative integer (default `4`).
`--stylesheet-share` takes a fraction from `0` to `1` inclusive (default `0.5`).
The share rounds up per area: `--screens 3 --stylesheet-share 0.34` links the
first two screens of each area to every shared sheet. Zero stylesheets disables
the CSS edit; a zero share still edits the first sheet when present, but links
no screens to it. Small CI instances use the same inexpensive defaults. Pass
matching size options to setup and benchmark, including with `--config`.

`benchmark:large` enables `--debug-timings` automatically and emits `review.*`
spans for background classification to stderr, including `review.css-analysis`
for linked rule parsing, diffing, matching and reduction and
`review.inline-style-analysis` for inline span discovery, rule analysis and
attribution.
It does not write comparison artifacts. To measure the complete artifact path
on the same prepared fixture, run
`node dist/cli/bin.js export --config <printed-config> --base main --out .context/site --debug-timings`.
The output must stay inside the fixture; review timing rows are inclusive, and
overlapping traversals must not be added to their parent duration.

This is representative structure and volume, not private consumer data or an
exact prediction of production timing. OS, hardware, cache state, markup complexity
and instance counts matter. Benchmark while other heavy checks are idle. There
are no fixed timing thresholds in CI's small correctness suite. Small fixtures exercise the same generator
in `tests/large_fixture.test.ts`; CLI timing tests cover stdout/byte stability,
child propagation and watched rebuilds.

Renderers must produce valid standalone views regardless of request order. Libraries
with global style registries may include different unused CSS depending on prior
views; foreground previews preserve the requested view's real styles. Background
output retains exhaustive Build order, avoiding artificial changes to committed
artifacts. Full output and Changes remain asynchronous and are not included in the
five-second interactive target.

Key files: `generate.ts` produces consumer sources; `area.tsx`, `components.tsx`
and `screens.tsx` define the catalogue; `renderer.tsx` collects native styles;
`renderer_inline.tsx` and `inline_styles.tsx` provide the cumulative variant;
`scripts/large/setup.mjs` owns baseline setup, `toolchain.mjs` archives the
derived tooling, `baseline.mjs` resets the pinned cache safely,
`scenarios.mjs` applies deterministic edits, `timings.mjs` aggregates spans, and
`benchmark.mjs` owns browser acceptance. The
[diagnostic contract](../../../docs/protocol/mokly-timings.md) describes timing
records, inclusive durations and process boundaries.
