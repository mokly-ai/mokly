# Large Mokly Consumer

A deterministic, synthetic workload for finding catalogue-size bottlenecks.
It uses the real build, watched server, component usage collector, Firna controls,
React Native Web styling and Git Changes path. Nothing is added to the basic
example's generated files or shipped as product data.

## Delivery Status

The deterministic generator, four-scenario benchmark and identity/diagnostic
records are delivered. Milestone 2 records the verified-code reference below.
The identity, stable-value, scenario-matrix and acceptance rules in the
[benchmark contract](./benchmark-contract.md) are
the approved target of [scalable analysis](../../../plans/scalable-inline-style-analysis.md):
Milestone 2 records the reference; Milestone 4 adds segment-reuse diagnostics;
Milestones 3 to 9 record optimization samples; Milestone 6 records the cost
checkpoint; Milestone 10 runs the acceptance procedure and removes this target
schedule. The Milestone 2 reference and cumulative baseline are recorded below.

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
whole page. It runs four classification scenarios: no changes, one component
head-style edit, one screen-markup edit, and setup's unused linked rule. Expected
membership is zero, one component, the edited screen plus its use case, and zero. Each
scenario runs with a new server and browser context for cold and warm samples.
JSON records separate listening, usable startup, Props, cached delivery,
complete Changes and classification times, inline-style and linked-CSS interval
unions/shares, incomplete bounds, and available heap/document-work counts.

Zero stylesheets means no initial stylesheet edit. Zero share still adds the
unused setup rule when a sheet exists, but no screen reaches it.
Either usable startup at five seconds or above fails the command.
Chrome is launched before timing; “cold” means application-cold, not a flushed
OS page cache. The benchmark emits the complete eight-sample matrix before
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

### Milestone 2 reference and cumulative baseline

Measured the committed code `4b09b13e6b537b1c02278bfbefd75e62b85f8af5`, with
`moklyDirty: false`, after targeted/full unit/Chromium tests and post-commit
format, lint and type checks. Both fixtures have 1,590 entries and 5,550
documents at 30/40/12, four shared sheets and share 0.5. Setup took 73,005 ms
default and 251,535 ms cumulative. Three superseded fixture roots were removed.
The shared `templateDigest` is
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
The default `fixtureCommit` is `8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22`;
cumulative is `2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`.
`renderingDependencies`: React/React DOM 19.2.7, React Native Web 0.21.2,
Firna 0.14.0, lightningcss 1.33.0, parse5 8.0.1, css-select 7.0.0, css-what 8.0.0.

Default reference: two complete committed matrices, all 16 outcomes `ok`, exact
membership, and heap peaks 310.51–430.46 MiB. Times are worker milliseconds;
`B` is the arithmetic mean of the two recorded values, displayed to three decimals.

| Scenario          | State | Run 1    | Run 2    | Reference B |
| ----------------- | ----- | -------- | -------- | ----------- |
| no-changes        | cold  | 34096.80 | 32706.55 | 33401.675   |
| no-changes        | warm  | 33843.50 | 33263.71 | 33553.605   |
| component-style   | cold  | 38395.24 | 35125.13 | 36760.185   |
| component-style   | warm  | 36225.34 | 39513.44 | 37869.390   |
| screen-markup     | cold  | 33135.69 | 36452.67 | 34794.180   |
| screen-markup     | warm  | 34986.60 | 42551.30 | 38768.950   |
| linked-stylesheet | cold  | 50488.64 | 49296.69 | 49892.665   |
| linked-stylesheet | warm  | 49406.31 | 46808.17 | 48107.240   |

Cumulative baseline: one complete committed matrix; six `ok` samples have exact
membership. Both component-style workers hit the fixed heap ceiling with no
classification end or counts record. `—` means absent, never zero. `Upper` is
the completed supervisor wait, not a worker duration; inline lower bounds are
100,967.51 ms cold and 98,743.44 ms warm. No incomplete share is computed.

| Scenario          | State | Outcome    | Worker ms | Upper ms  | Heap MiB | HTML parses | HTML bytes |
| ----------------- | ----- | ---------- | --------- | --------- | -------- | ----------- | ---------- |
| no-changes        | cold  | ok         | 164633.17 | —         | 910.55   | 26520       | 3306455349 |
| no-changes        | warm  | ok         | 168499.00 | —         | 898.55   | 26520       | 3306455349 |
| component-style   | cold  | incomplete | —         | 130747.93 | —        | —           | —          |
| component-style   | warm  | incomplete | —         | 131839.19 | —        | —           | —          |
| screen-markup     | cold  | ok         | 162489.18 | —         | 896.95   | 26562       | 3307097240 |
| screen-markup     | warm  | ok         | 165865.80 | —         | 892.23   | 26562       | 3307097240 |
| linked-stylesheet | cold  | ok         | 234042.41 | —         | 911.92   | 40950       | 5246857089 |
| linked-stylesheet | warm  | ok         | 238105.78 | —         | 901.51   | 40950       | 5246857089 |

Per-step parse counts are identical across completed samples of each scenario,
including both fixtures where available. Unlisted steps are zero in their
completed records; incomplete samples have no document-work record at all.

| Scenario                       | Range | Reference | Style discovery | Inline matching | Stylesheet matching | Total |
| ------------------------------ | ----- | --------- | --------------- | --------------- | ------------------- | ----- |
| no-changes                     | 15840 | 10680     | 0               | 0               | 0                   | 26520 |
| component-style (default only) | 16048 | 11090     | 368             | 368             | 0                   | 27874 |
| screen-markup                  | 15836 | 10718     | 8               | 0               | 0                   | 26562 |
| linked-stylesheet              | 15840 | 15510     | 0               | 0               | 9600                | 40950 |

HTML construction dominates exclusive document work. Default per-scenario
means over both states/runs are 18,936.76 / 20,234.60 / 20,311.40 / 29,420.41 ms
in table order; cumulative completed-state means are 111,823.15 / absent /
110,567.73 / 166,775.05 ms. Cumulative normalization adds 17,283.86–17,839.69 ms
per completed scenario, reference work 8,892.33–14,673.08 ms, and hashes
3,182.83–5,720.65 ms. Default component inline-rule work averages 563.79 ms;
cumulative component work cannot be recovered from its absent counters. The
unused linked edit still incurs 9,600 matching parses despite zero Changes.

Machine: Amazon Linux 2023 x64, Node 24.19.0, Intel Xeon 2.90 GHz, `nproc: 8`,
16,643 MiB RAM (16.3 GiB), no swap. No other build/test/benchmark ran; tracked
files stayed unchanged throughout all matrices. Before/after `free -m` and
`uptime` observations (loads are 1/5/15 minutes):

| Run        | Free MiB      | Available MiB | Uptime        | Load before → after             |
| ---------- | ------------- | ------------- | ------------- | ------------------------------- |
| default 1  | 10223 → 10036 | 15101 → 14969 | 15:30 → 15:53 | 0.31/0.90/1.64 → 1.43/1.96/1.96 |
| default 2  | 10147 → 9942  | 15080 → 14919 | 15:54 → 16:17 | 0.79/1.75/1.88 → 1.72/2.26/2.15 |
| cumulative | 10115 → 9994  | 15092 → 15016 | 16:18 → 17:36 | 0.88/1.97/2.06 → 1.14/1.71/1.91 |

Every matrix exited 1: usable startup exceeded five seconds in 4/8 default-1,
7/8 default-2 and 5/8 cumulative samples; cumulative also has the two heap
failures. Usable ranges were 4,908–5,311, 4,895–5,558 and 4,644–5,519 ms.
Warm classification was not consistently faster. No sample was retried or
dropped; this records a reference, not a performance-acceptance pass. Both
fixtures restored setup renderer/output bytes and only the unused CSS edit.

Logs and full JSON (including every per-step byte/time counter) are under
`.context/delegation/scalable/`: `m2-reference-default-1.log` / `.json`,
`m2-reference-default-2.log` / `.json`, `m2-baseline-cumulative.log` / `.json`.
Each prefix also has `.machine-before.txt`, `.machine-after.txt`,
`.idle-processes.txt`, `.driver.log` and `.exit`; setup logs are
`m2-fixture-default-setup.log` and `m2-fixture-cumulative-setup.log`.
The [September 28 measurements](../../../docs/dev/large-fixture-history.md)
remain historical evidence, not this template-identified reference.

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

`baselineMs` is the inclusive builder span; `baselineReadyMs` is benchmark
command start to receipt of its successful completion, on the benchmark clock.
`preparingToPendingMs` is the cold builder duration or zero on a hit, not a
browser paint measurement. `baselinePhases` preserves extraction, every
command and adoption separately; `changesReadyMs` ends only on delivered
complete Browse Changes. These phases do not share the navigation budget.

Defaults are 30 areas, 40 screens per area, and 12 records per screen. Each area
adds two registered components, each with three saved variants, a page and one flow
per ten screens. The default therefore has 1,590 routed entries and 5,550
documents plus the manifest. Folder paths group entries without additional records.
Each screen and component variant renders in mobile/desktop and light/dark.
Flows reuse the canonical screens rather than adding documents. Shared panels
contain nested actions and caller-owned slots; screens also invoke repeated
actions. Local CSS imports and SVG resources exercise resource validation and
watch discovery. Templates own their digest-covered theme tokens.

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

`benchmark:large` enables `--debug-timings` and emits background `review.*`
spans to stderr, including `review.inline-style-analysis`. The delivered
four-scenario matrix adds `review.css-analysis` coverage through the
`linked-stylesheet` row for parsing, diffing, matching and reduction; the
unused rule expects zero Changes. Reports retain counts and every outcome.
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
and `screens.tsx` define the catalogue; `theme.ts` owns digest-covered tokens;
`renderer.tsx` collects native styles;
`renderer_inline.tsx` and `inline_styles.tsx` provide the cumulative variant;
`scripts/large/setup.mjs` owns baseline setup and `identity.mjs` validates provenance;
`toolchain.mjs` archives derived tooling; `baseline.mjs` resets the pinned cache;
`scenarios.mjs` applies edits; `cancellation.mjs` owns signal cleanup;
`matrix.mjs` restores setup; `sample.mjs` retains events; `outcomes.mjs` derives
outcomes; `interactive.mjs` checks browser behavior; `timings.mjs` aggregates
spans; `benchmark.mjs` owns acceptance. The
[diagnostic contract](../../../docs/protocol/mokly-timings.md) describes timing
records, inclusive durations and process boundaries.

## Benchmark Contract

The focused [benchmark contract](./benchmark-contract.md) owns
[template identity and stable values](./benchmark-contract.md#template-identity-and-stable-values),
[scenario state and restoration](./benchmark-contract.md#scenario-matrix-and-restoration),
and [classification performance acceptance](./benchmark-contract.md#classification-performance-acceptance).
Keep measurements and setup guidance here; do not duplicate its normative rules.
