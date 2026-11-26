# Shard Weights

Five CI suites split their tests over parallel shard jobs. Four of them
place whole test files or test units by measured weights, so that the shards
of one suite end at about the same time. The weights are committed JSON
files. A stale weight changes only the balance of the shards, never the set
of tests that runs. The `CI timing` job of each run warns when the shards of
one group spread too far apart, under the
[shard balance rules](../protocol/ci-duration-budgets.md#shard-balance).

| Suite and CI jobs                               | Weight file                                                    | Source of the weights                                                             |
| ----------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Browser (`Browser (...)`)                       | `scripts/verification/browser-shard-weights.json`              | The browser reports of each run                                                   |
| Viewer (`Viewer (...)`)                         | `scripts/verification/viewer-shard-weights.json`               | The viewer reports of each run                                                    |
| Rust tests (`Repository (...)`, `Native (...)`) | `testSeconds` of `scripts/verification/rust-test-weights.json` | The logs of the passed Repository and native jobs of each run                     |
| App (`App checks {n}/{total}`)                  | `packages/app/src/_tests_/browser-shard-weights.json`          | The logs of the App checks jobs of the newest run in which every App shard passed |
| Mockup (`Mockup checks {n}/{total}`)            | None                                                           | Playwright's `--shard` splits the disk suite by test count                        |

## Refresh Every Weight File

Run this command from the repository root:

```bash
npm run ci:refresh-shard-weights -- --runs 5
```

It reads the newest runs of the CI workflow that a push to `main` started
and that passed, `--runs` of them, from 1 to 100, and 5 when the option is
missing. It then rewrites every weight file of the table through the
refresh code of each suite, which the sections below describe. Review the
diff and commit the files.

- It needs the GitHub CLI, signed in with `gh auth login`, because it
  downloads the reports with `gh run download`. It reads the API with
  `GITHUB_TOKEN` when that is set, and with `gh auth token` otherwise.
- It needs the installed npm dependencies, because the app weight script
  runs through `tsx`.
- It keeps the downloads and the logs under `.context/shard-weights/` and
  removes that directory first.
- A run whose reports cannot be downloaded, for example because they
  expired, is left out of the browser and viewer weights with a message.
- The app weight script reads one complete run, so the app weights come from
  one run only.
- It does not refresh `compileSeconds` of the Rust weights, because that part
  comes from a local build. See [Rust Test Weights](#rust-test-weights).

Refresh the weights after a change that moves a lot of test time, and when
the `CI timing` summary warns about a weighted group. When the warning stays
after a refresh, the cause is not a stale weight. Look at the shard
placement or the shard count of that suite.

## Browser Partitioning

The strict runner discovers the complete Playwright inventory before selecting
a shard. Both hosted CI and the remote executor call this runner. It assigns
whole specs by descending estimated cost to the least-cost shard that has
room under the existing test-count cap. If greedy placement exceeds the cap,
a deterministic capacity search retries whole-file placements, largest test
counts first. It retains the weighted assignment when that assignment fits.
If no complete nonempty assignment fits, every spec still executes and the
aggregate reports its existing count-limit failure.

[`browser-shard-weights.json`](../../scripts/verification/browser-shard-weights.json) holds scheduling
inputs in estimated milliseconds per test. The Playwright reporter records a
`wallMs` for each observed test: the time that its worker slot spent since
the previous test ended. That time includes the hooks, fixtures, and worker
restarts before the test. For each report and `specFile`, the weight sums
`wallMs` and divides by the observed test count. The committed weight is the
median of these per-test costs over the reports, rounded to three decimal
places.

Specs go in order of their larger share of the total estimated cost or of
the total test count. Specs with many tests therefore take their places
before the count cap fills.

[`browser-host-needs.mjs`](../../scripts/verification/browser-host-needs.mjs) marks the specs whose
static relative import graph reaches `tests/browser/static_test.ts`, the only
reader of the copied static example. For each count of copy shards, placement
puts the marked specs on those shards first, each charged
`COPIED_HOST_SETUP_MS` once, then the other specs on all shards. It keeps the
count with the shortest longest shard. A shard without a marked spec passes
`MOKLY_PLAYWRIGHT_COPIED_HOST=skip`, so global setup skips that build. Removed
specs leave the weights unused, and new specs take the median weight.

The scheduler multiplies each weight by the current discovered test count.
New specs use the median known per-test weight. Removed specs cannot enter
the assignment because discovery owns membership. File names break ties in
stable string order. Scheduling weights are estimates, never elapsed-time assertions.

The strict runner passes escaped exact file patterns to Playwright instead
of its count-based `--shard` selection. The reporter must observe the same
test IDs as independent discovery. Unsharded strict runs and developer
Playwright selection keep their complete or requested inventories.

## Viewer Partitioning

A strict viewer run with `--shard INDEX/TOTAL` discovers every Node test file
and runs only the files of its shard. It assigns whole files by descending
measured duration to the shard with the least estimated work.
[`viewer-shard-weights.json`](../../scripts/verification/viewer-shard-weights.json) holds the median
measured duration of each file in milliseconds. A new file uses the median
weight. The selected files keep their discovery order.

## Rust Test Weights

[`rust-test-weights.json`](../../scripts/verification/rust-test-weights.json) holds two parts of the
weight of each Rust test unit, such as `--test cli`, in seconds.
`compileSeconds` is the build time of the unit's test targets in the report
of `cargo test --no-run --timings`, times 1.5. Every host shares it.
`testSeconds` holds one map for each CI host, `linux`, `macos`, and
`windows`. Each map gives the nextest time of the unit on that host: the
median of each test over the runs that passed it, then the sum over the
tests of the unit. The weight of a unit on a host is its compile seconds
plus its test seconds on that host. `xtask` embeds the file. The Repository
test shards use the `linux` map, and the native test shards use the map of
their own host, as the
[test unit rule](../protocol/ci-verification-repository.md#test-units)
says. A unit that neither part names gets `defaultSeconds`. `splits` runs
a heavy unit, such as the render integration tests, as nextest slices on
separate shards. A stale
weight changes only the balance of the shards, never the set of tests.

[`rust-test-weights.mjs`](../../scripts/verification/rust-test-weights.mjs) refreshes each part:

```bash
GITHUB_TOKEN=$(gh auth token) node scripts/verification/rust-test-weights.mjs --run {run} --run {run}
node scripts/verification/rust-test-weights.mjs --compile
```

`--run` reads the logs of the passed Repository and native jobs of each CI
run and replaces the `testSeconds` map of each host that those jobs measured.
A host that no given run measured keeps its committed map. Give the newest
`main` runs. A run with a failed or unfinished test shard gives fewer samples
of that shard's tests on its host. When no given run passed a shard, its
tests are missing from their unit on that host, so give runs in which every
test shard passed. `--compile` builds every Rust test target in a new target directory
under `.context/`, so that Cargo reuses no build, and replaces
`compileSeconds` from its timing report. Cargo leaves a reused build out of
the report. The compile part changes only when the build of a unit changes.

## Shard Totals And One-Suite Refresh

[`ci-shards.json`](../../scripts/verification/ci-shards.json) holds the viewer and browser shard
totals. The CI matrices, [`aggregate.mjs`](../../scripts/verification/aggregate.mjs), and remote
verification read it, so a shard count change is one edit.

To refresh only the browser and viewer weights from runs that you choose,
download their passed CI reports:

```bash
gh run download {run} -R mokly-ai/mokly -p 'verification-*' -D .context/shard-reports/{run}
node scripts/verification/shard-weights.mjs --reports .context/shard-reports
```

Download several runs into separate directories. The script reads every
report under the directory, skips reports that did not pass, and writes both
weight files. Compare the shard durations of the next CI run with the
targets of the
[shard balance rules](../protocol/ci-suite-evidence.md#viewer-shard-balance).

To refresh only the app weights from one run of your choice, save the logs of
every App checks job of that run, for example with
`gh run view --log --job {job}`. Then run
`npx tsx src/_tests_/update-browser-shard-weights.ts {log}...` from
`packages/app`. A measured spec takes its new seconds. A current spec that the
logs do not measure keeps its committed seconds, and a removed spec loses its
entry.
