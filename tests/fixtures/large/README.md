# Large Mokly Consumer

A deterministic, synthetic workload for finding catalogue-size bottlenecks.
It uses the real build, watched server, component usage collector, Firna controls,
React Native Web styling and Git Changes path. Nothing is added to the basic
example's generated files or shipped as product data.

## Delivery Status

The existing three-scenario benchmark and cumulative renderer are delivered.
The identity, stable-value, scenario-matrix and acceptance sections below are
the approved target of [scalable analysis](../../../plans/scalable-inline-style-analysis.md):
Milestone 2 delivers fixture identity, stable values, four scenarios, outcomes
and heap/document diagnostics; Milestone 4 adds segment-reuse diagnostics;
Milestones 3 to 9 record optimization samples; Milestone 6 records the cost
checkpoint; Milestone 10 runs the acceptance procedure and removes this target
schedule. The new flags/records are not available until their implementation.

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

Zero stylesheets means no initial stylesheet edit. Zero share still adds the
unused setup rule when a sheet exists, but no screen reaches it.
Either usable startup at five seconds or above fails the command.
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

Historical evidence only, not the current template-identified performance
reference. Regenerate the current 1,590-entry fixtures for acceptance below.

The 2026-09-28 committed-output measurement used Linux x64, Node 24.19.0,
an Intel Xeon processor at 2.90 GHz, eight logical CPUs and 16.3 GiB RAM. Both
fixtures used 30 areas, 40 screens per area, 12 rows per screen, four shared
stylesheets, a 0.5 stylesheet share and 5,550 documents. Mainline now counts
1,590 routed entries, including the 180 independently routed saved variants;
the old route count is recorded in the plan's [historical diagnosis](../../../plans/scalable-inline-style-analysis.md#problem).

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

`benchmark:large` enables `--debug-timings` and emits background `review.*`
spans to stderr, including `review.inline-style-analysis`. The approved
four-scenario target adds `review.css-analysis` coverage through the
`linked-stylesheet` row for parsing, diffing, matching and reduction; the
delivered three-scenario matrix does not exercise that row.
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
`scripts/large/setup.mjs` owns baseline setup, `toolchain.mjs` archives derived
tooling, `baseline.mjs` resets the pinned cache safely, `scenarios.mjs` applies
deterministic edits, `timings.mjs` aggregates spans and `benchmark.mjs` owns
browser acceptance. The
[diagnostic contract](../../../docs/protocol/mokly-timings.md) describes timing
records, inclusive durations and process boundaries.

## Template Identity And Stable Values

Preparation records `templateDigest`, `moklyCommit`, `moklyDirty` and the isolated
`fixtureCommit`. `templateDigest` is lowercase hex SHA-256 over every regular
file recursively under `tests/fixtures/large/`, including hidden files, except
the root `README.md`. Sort POSIX relative paths by unsigned UTF-8 byte order.
For each file hash, in order: a four-byte big-endian path-byte length, its UTF-8
path bytes, an eight-byte big-endian content-byte length, and the exact file
bytes. No timestamps, modes or platform separators participate; reject symlinks
rather than hash external content. Length framing makes the concatenation
unambiguous. The two renderer modes use the same digest of the entire tree.

`moklyCommit` is this checkout's HEAD; `moklyDirty` reports tracked/untracked
non-ignored changes from `git status --porcelain`, not the isolated fixture's
intentional scenario edits. Every setup/sample/matrix report carries those
three identity fields. A benchmark reports current Mokly identity and preserves
the preparation record's identity separately as `preparedMoklyCommit` and
`preparedMoklyDirty`; code may evolve while a fixture is reused. The archived
derived baseline toolchain remains the prepared version as described above.

`preparedFixture`, including `--config` reuse, recomputes the digest and rejects
a missing or mismatched recorded value **before starting Serve or editing a
scenario**. It names `npm run fixture:large --` followed by that fixture's
areas/screens/rows/stylesheets/share and applicable `--inline-styles`/`--derived`
flags. It does not silently regenerate or compare measurements from old
templates. Excluding this README permits reporting results without invalidating
the fixture. A changed Mokly commit alone is not a template mismatch.

Per-view atomic values use SHA-256 of the UTF-8 JSON tuple `[area, token]`,
where `token` is the stable rendered-view key, never the registration index.
Derive `zIndex` as `1000 + (first unsigned big-endian 32 bits % 1000000)`.
Class names therefore depend on values only. Adding an entry can add unused
rules to later cumulative sheets; it cannot change any existing view's own
values/classes or non-style markup. Small-fixture proof compares those bytes
and requires every other area's unchanged entries to stay out of Changes,
not impossible byte equality of complete cumulative sheets.

## Scenario Matrix And Restoration

The approved benchmark-only filter is repeatable `--scenario <name>`; examples:
`npm run benchmark:large -- --scenario no-changes --scenario component-style`
and `npm run benchmark:large -- --inline-styles --scenario linked-stylesheet`.
No filter selects all four rows below. Unknown/missing names fail before any
edit; duplicates collapse; selected rows retain the table's order. Each row
gets one cold and one warm fresh-server/browser-context sample, not a warmed
classification worker. Chrome is launched before the measured command.

| Scenario            | Input state relative to isolated Git `main`                       | Expected Changes ids               |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| `no-changes`        | Baseline renderer and baseline `shared-1.css`                     | none                               |
| `component-style`   | Only the area-one Action color constant edited; baseline CSS      | `area-1-action`                    |
| `screen-markup`     | Only screen-one markup constant edited; baseline CSS              | `area-1-screen-1`, `area-1-flow-1` |
| `linked-stylesheet` | Baseline renderer, **keep setup's unused rule** in `shared-1.css` | none                               |

Reset both mutatable files independently before each scenario; never carry a
previous edit into the next one. Build current outputs after preparation,
including in committed mode, before starting its cold server. Derived cache
reset/hit rules remain as above. Zero shared-sheet count makes the linked row
a no-op with zero CSS-analysis union; zero share keeps the unused rule but no
reachable dependency. The ordinary stylesheet edit proves rule exclusion,
not a matching-selector keep. Record `cssAnalysisMs/Share` as well as inline
union/share, using the diagnostic contract's clipped intervals.

In `finally`, restore `renderer.tsx` and `shared-1.css` to **setup state**:
baseline renderer plus the unused setup rule when the sheet exists. Restore
generated current outputs to that state too, without changing the fixture's
Git baseline or archived toolchain. Restore even after failed samples, browser
errors or cancellation; stop owned servers/browser first. A restoration error
fails the command without discarding already recorded samples.

Record every requested sample, continue the matrix after bounded failures,
and write the full report before returning nonzero. The exact `ok`, `error`,
`incomplete`, `membership-mismatch` fields, clocks, rounding and interval unions
are owned by [sample outcomes](../../../docs/protocol/mokly-timings.md#benchmark-sample-outcomes).
Preserve whole `documentWork`/`inlineStyleCounts` records and `heapPeakMiB` when
available. Heap is classifying-isolate used V8 heap sampled after each compared
view, not machine memory or RSS; missing end/count records are missing data.
The independent `usableMs < 5000` check still applies; classification acceptance
below cannot turn a failed navigation assertion into a benchmark success.

## Classification Performance Acceptance

Use default dimensions (30/40/12, four sheets, share 0.5), all four scenarios
and both states in **committed mode**. At the reference step run two complete
default-fixture matrices after regeneration. Retain every sample, including
cumulative failures from its separate baseline matrix; old historical tables
are not substituted for this reference. At acceptance regenerate both current
fixtures and run two complete matrices per fixture, plus one derived-mode
cold cumulative `component-style` sample. Use the same template digest,
dimensions, Node runtime and machine, with other heavy work idle. Record
`nproc`, `free -m` and `uptime` before/after each run.

For scenario `s` and state `t`, let `B(s,t)` be the arithmetic mean of the two
reference default `classificationMs` values. Let `D(s,t)` and `C(s,t)` be the
two-run means for acceptance default/cumulative respectively. Times are the
completed **background worker** `changes.classify` durations, not readiness,
Serve wait, baseline build or inclusive child sums. Calculate means/ratios
from recorded two-decimal durations without rounding intermediates; displayed
ratios may round only after the pass decision. Pass iff **all** hold:

- For every scenario/state, `C(s,t) / B(s,t) <= 2`.
- On each fixture/state, its `component-style` mean divided by its
  `no-changes` mean is `<= 1.25`.
- For every scenario/state, `D(s,t) / B(s,t) <= 1.05`.
- Every reference/acceptance committed sample and the derived spot sample is
  `ok`, has exact expected membership and a present reported `heapPeakMiB < 1024`.

Missing/zero reference durations, missing diagnostics, any failure outcome or
different identity/dimensions/runtime/machine makes acceptance fail, not a
discarded outlier. Do not drop a cold sample, substitute warm, average states,
or replace a failed run with a faster retry. New measured-dominant work must
be planned before claiming success; the plan's final acceptance remains open.
