# Verification scripts

These scripts support the Rust verification task runner in
[`xtask`](../../xtask/README.md). Public test commands and strict evidence
rules live in the [verification contract](../../docs/protocol/ci-verification.md).

## Browser partitioning

The strict runner discovers the complete Playwright inventory before selecting
a shard. Both hosted CI and the remote executor call this runner. It assigns
whole specs by descending estimated cost to the least-cost shard that has
room under the existing test-count cap. An oversized spec still executes;
the aggregate reports its existing count-limit failure.

[`browser-shard-weights.json`](./browser-shard-weights.json) holds scheduling
inputs in milliseconds per test. The source is the per-test observations from
hosted run `39455750846` at `b1f3c86ffdfa0e002b6a090863e4a91fc7e6da86`.
For each `specFile`, sum `observedTests.durationMs`, divide by its observed
test count, and round to three decimal places. Refresh the inputs from a
complete, successful four-shard browser report set. Keep the source reports
and the resulting measurements under `.context/`.

The scheduler multiplies each weight by the current discovered test count.
New specs use the median known per-test weight. Removed specs cannot enter
the assignment because discovery owns membership. File names break ties in
byte order. Scheduling weights are estimates, never elapsed-time assertions.

The strict runner passes escaped exact file patterns to Playwright instead
of its count-based `--shard` selection. The reporter must observe the same
test IDs as independent discovery. Unsharded strict runs and developer
Playwright selection keep their complete or requested inventories.

### Key code

- [`browser-partition.mjs`](./browser-partition.mjs) selects weighted whole-file
  partitions and escapes their Playwright file filters.
- [`playwright.mjs`](./playwright.mjs) discovers tests and preserves the spec
  identity of tests registered through shared helpers.
- [`run-browser.mjs`](./run-browser.mjs) runs a selected partition and checks
  its observed test IDs against independent discovery.
- [`shard-balance.mjs`](./shard-balance.mjs) enforces the existing test-count
  share limit when evidence is aggregated.
