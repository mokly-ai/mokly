# Local Coverage Check

## Delivery Status

The coverage checker is implemented as a local developer command. It is not
part of `cargo xtask check` or hosted CI, and no workflow, gate, or release
step may call it. `tests/verification_coverage_contract.test.ts` enforces that
boundary against the workflow files and the xtask check sequence.

## Commands

```bash
npm run coverage
npm run coverage:prepared
npm run coverage -- tests/build.test.ts packages/viewer/tests/server.test.tsx
```

`npm run coverage` prepares package and example output, then runs the coverage
check. `coverage:prepared` skips preparation and fails when the prepared output
named by `scripts/verification/prepared.mjs` is missing. Both accept optional
repository-relative unit test files. Every file must belong to the discovered
unit inventory; an unknown file or any option fails before a test starts. With
no files, the check runs the complete inventory and checks thresholds. With
files, it runs only those files, reports their coverage, and records that the
thresholds were not checked. The result of a selection is partial evidence.

## Measurement

The runner discovers the same recursive `.test.ts` and `.test.tsx` inventory
under `tests/` and `packages/viewer/tests/` as the unit suite. It runs that
inventory with `tsx` and Node's `--experimental-test-coverage`, and pairs the
evidence reporter with `scripts/verification/coverage-reporter.mjs`. It runs as
many test files at once as the unit suite: `unitTestConcurrency()` in
`scripts/verification/concurrency.mjs` sets the limit, as the
[test concurrency contract](./ci-suite-evidence.md#test-concurrency) defines,
and `MOKLY_UNIT_CONCURRENCY` overrides it.

Built output executes from `dist/` and `packages/viewer/dist/`. The runner adds
`--enable-source-maps` to `NODE_OPTIONS`, and the include globs name both the
generated roots and the source roots, so Node maps generated coverage back to
`src/` and `packages/viewer/src/`. Node sets `NODE_V8_COVERAGE` for the test
processes and passes it to every child process unless the child's environment
sets it. A child with a bounded environment therefore still records its
coverage and source maps, so CLI runs from tests add to the same measurement.

Node keeps the raw V8 coverage in a `node-coverage-*` directory under the system
temporary directory and deletes it at the end of the run. A complete run needs
several gigabytes of free space there and takes much longer than the unit
suite. An interrupted run can leave that directory behind; delete it before the
next run.

The summary keeps only files under `src/` and `packages/viewer/src/`. A
generated file that does not map back to a source file is listed separately as
unmapped and is excluded from the totals. This happens to generated output
without a source map, and to a built module with a dynamic `import()` that a
test process loads: tsx rewrites that module and replaces its source map with
one that points at the built file. Child processes run without tsx, so their
coverage of the same module still maps to its source. Totals sum the per-file
line, branch, and function counts; a percentage is covered over total, and an
empty total counts as 100%.

## Thresholds

`scripts/verification/coverage-thresholds.json` is a JSON object with exactly
the keys `lines`, `branches`, and `functions`, each a number from 0 to 100. A
complete run fails when any total percentage is below its threshold, and names
each failing metric with both percentages to two decimals. The thresholds are
reviewed minimums for the complete inventory. Set each one to the whole-number
part of the measured complete-run percentage minus one point, measured on the
Node version in `.nvmrc`. Raise them after measuring higher coverage, and lower
them only with a reviewed reason in the same change. A malformed thresholds
file fails before any test runs.

## Output

Before it starts the tests, the runner recreates the Git-ignored `coverage/`
directory. It then writes:

- `coverage/lcov.info`: an lcov tracefile with the same content as Node's own
  lcov reporter, using paths relative to the repository root. It lists every
  file in Node's summary, so unmapped generated files appear in it too.
- `coverage/summary.json`: `schemaVersion` 1, `suite` `coverage`, the commit,
  runtime, and Node version, `complete`, `testFiles`, `thresholds`,
  `thresholdsChecked`, `findings`, `totals`, the sorted source `files`,
  `unmapped` files, the `skipped` count, retained test `failures`,
  `durationMs`, and `outcome` with the exit code, signal, and `passed` or
  `failed` status.

Before the tests start, the console prints
`unit test files active at once: <limit>`, as the unit runner does. After the
tests, it prints the totals, up to ten files with the lowest line coverage, any
unmapped files, the skipped or todo count, the thresholds or a note that a
selection skipped them, both output paths, and one `coverage check passed` or
`coverage check failed: <reason>` line per problem. The runner deletes the
intermediate reporter files after it reads them.

## Failure Semantics

The command exits with status 1, after writing the summary, when the tests
fail, cancel, or exit by signal, when either reporter does not complete, when
Node reports no coverage summary, or when a complete run misses a threshold.
Skipped and todo tests are tolerated and counted, matching the developer unit
runner. Discovery, selection, an invalid `MOKLY_UNIT_CONCURRENCY`, thresholds,
and prepared-output failures happen before the test process starts; they write
no summary and leave an earlier `coverage/` directory unchanged.

## Inspector Coverage In Tests

Under `NODE_V8_COVERAGE`, V8's precise coverage counters are process-wide, so a
test that measures call counts through the inspector must take one
`Profiler.takePreciseCoverage` sample immediately after
`Profiler.startPreciseCoverage` to reset the counters before the measured
work. `packages/viewer/tests/host_capabilities_rendering.test.tsx` follows this
rule so the same assertion holds with and without the coverage check. Each
sample also resets the counts that Node's own coverage collects in that test
process, and stopping precise coverage or disconnecting the session switches V8
to function-level coverage for the rest of the process. That test file
therefore adds little to the measured totals.

## Required Coverage

- `tests/verification_coverage.test.ts` owns the threshold validation,
  selection, summary, and formatting behavior.
- `tests/verification_coverage_reporter.test.ts` owns the reporter: the
  retained summary, an lcov tracefile identical to Node's lcov reporter output,
  and the fail-closed environment check.
- `tests/verification_coverage_runner.test.ts` runs the command end to end in
  an isolated harness from `tests/helpers/coverage_harness.ts`: mapped sources,
  lcov output, a missed threshold, a partial selection, an unknown file that
  leaves earlier output unchanged, a failing test, a coverage reporter that
  does not complete, the shared file limit with `MOKLY_UNIT_CONCURRENCY=1`
  running one test file at a time, and an invalid limit that stops the command
  before a test starts.
- `tests/verification_coverage_mapping.test.ts` runs built output in a child
  with a bounded environment: output with a source map maps back to its source,
  and output without one is listed as unmapped.
- `tests/verification_coverage_contract.test.ts` owns the npm commands, the
  ignored output directory, and the rule that CI and the gate never run it.
