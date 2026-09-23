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
npm run fixture:large -- --tracked-output
npm run dev:large -- --tracked-output --debug-timings
npm run benchmark:large -- --tracked-output
```

`fixture:large` creates a `.context/mokly-large-*` directory, builds its output
and commits a `main` baseline **inside that isolated fixture**, not in Mokly's
repository. It reports setup time separately and saves a size-keyed record for reuse.
The record key includes the stylesheet count, share, and tracked-output choice. After committing, setup
appends one unrelated `.scale-unrelated-rule` rule to `assets/shared-1.css`.
That is the only worktree edit; when built, generated documents stay current. The
selector occurs in no screen, so rule attribution examines and excludes the
edited sheet from each linked view. It adds no screens or flows to Changes.
Tracked-output `dev:large` and `benchmark:large` reuse those baseline bytes.
Neither choice repeats package compilation. Run `npm run build` explicitly after changing Mokly's
source. Missing setup fails with the matching preparation command; `--config`
can select an existing fixture. `dev:large` serves until Ctrl-C.

`benchmark:large` launches Chrome, starts a fresh server and measures command start
to searchable navigation with a real selected preview visible. It verifies record
count, both viewports/themes, a successful Action label Props edit and a whole page.
Then it waits for complete Changes and verifies zero changed routes for the
unrelated stylesheet rule. It repeats with a new server and browser context for
a warm restart. Zero stylesheets or a zero share also yield zero Changes.
JSON records separate listening, usable startup, Props, cached delivery and Changes
times. Either usable startup at five seconds or above fails the command.
Chrome is launched before timing; “cold” means application-cold, not a flushed
OS page cache. Generated fixtures remain for inspection.

### Untracked baselines

The default uses a separate record for the same dimensions and leaves generated
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

The benchmark resets only the pinned baseline entry while holding its lock,
requires a real cold rebuild, then requires a cache hit on the warm restart.
Stop other servers using the fixture before running it; an active builder makes
the reset fail. Normal `dev:large` reuses completed entries. The npm download and
OS caches are retained in both cases; “cold” refers to rebuilt-output caching.

Both runs must provide usable navigation within five seconds. JSON additionally
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
for rule parsing, diffing, matching and reduction.
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
`scripts/large/setup.mjs` owns baseline setup, `toolchain.mjs` archives the derived
tooling, `baseline.mjs` resets the pinned cache safely, and `benchmark.mjs` owns browser
acceptance. The
[diagnostic contract](../../../docs/protocol/mokly-timings.md) describes timing
records, inclusive durations and process boundaries.
