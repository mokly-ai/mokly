# Verification scripts

The Cargo task runner calls these scripts for repository, viewer, browser, and
dependency verification. The [development guide](../../docs/development/README.md)
describes the complete gate and focused commands.
Public test commands and strict evidence rules live in the
[verification contract](../../docs/protocol/ci-verification.md).

## Rust advisory audit

Run `npm run dependencies:check:rust`. It needs Node and Cargo but no installed
npm dependency. `audit-rust.mjs` starts `rust-audit.mjs` at the repository root.

The wrapper checks the UTC review deadline before starting a process. It reads
the locked dependency graph through Cargo metadata and checks `lightningcss`.
It installs pinned cargo-audit with its locked dependencies and runs a live JSON
audit. The report gives the effective ignore list, including configuration
changes outside the repository file. Only the approved advisory can be ignored.
Native tools parse their own TOML inputs. Every command failure propagates.

The [dependency security contract](../../docs/protocol/dependency-security.md#rust-advisory-audit)
defines the approved exception and review conditions. `tests/rust_audit.test.ts`
injects time and command results to cover expiry, version changes, extra IDs,
invalid output, and failure propagation without a network or elapsed-time assertion.

## Browser partitioning

The strict runner discovers the complete Playwright inventory before selecting
a shard. Both hosted CI and the remote executor call this runner. It assigns
whole specs by descending estimated cost to the least-cost shard that has
room under the existing test-count cap. If greedy placement exceeds the cap,
a deterministic capacity search retries whole-file placements, largest test
counts first. It retains the weighted assignment when that assignment fits.
If no complete nonempty assignment fits, every spec still executes and the
aggregate reports its existing count-limit failure.

[`browser-shard-weights.json`](./browser-shard-weights.json) holds scheduling
inputs in estimated milliseconds per test. They combine per-test observations
from hosted run `39455750846` at `b1f3c86f` and remote runs
`20261020T191118Z-972099` at `300c4dae` and `20261020T194406Z-997895` at
`ec47233e`. All three browser report sets passed. The first remote complete
gate failed its repository audit on a new advisory. The second gate passed.

For each sample and `specFile`, sum `observedTests.durationMs` and divide by
its observed test count. Average the available per-test sample costs for each
file and round to three decimal places. A file absent from an older sample
uses the available samples. Refresh from complete, successful browser report
sets and retain the source reports and calculations under `.context/`.
Report fixture and whole-job durations separately to check the actual balance.

The scheduler multiplies each weight by the current discovered test count.
New specs use the median known per-test weight. Removed specs cannot enter
the assignment because discovery owns membership. File names break ties in
stable string order. Scheduling weights are estimates, never elapsed-time assertions.

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

## Remote delivery

[`testbox-suite.mjs`](./testbox-suite.mjs) accepts `--suite static-delivery`
as a separate remote command. It shares the fingerprint, staging, history,
and dependency preparation used by the other commands. It builds with
`npm run build` and then runs `npm run test:delivery:prepared`. Build failures,
signals, and either delivery failure produce a nonzero command result.

No browser command also runs delivery. The remote plan gives static delivery
its own seventh Testbox and requires its exit result. Browser and viewer
reports retain the existing five-report aggregate. The delivery parent
validates its own HTTP and file reports before returning success.

### Testbox workflow reference

[`tests/ci_workflow_scripts.test.ts`](../../tests/ci_workflow_scripts.test.ts)
executes the lockfile stamp step and the environment step on Linux hosts with
controlled inputs and asserts the written files. The environment run redirects
`/etc/environment` to a temporary file and stubs `sudo`. Step order and action
pins are review-owned literals.

Pin each action to these immutable revisions. Keep the version comments.

| Action                        | Commit                                     | Comment    |
| ----------------------------- | ------------------------------------------ | ---------- |
| `useblacksmith/checkout`      | `25227e61ff9dafe400e22fa487b673eac4e4409a` | `# v1`     |
| `useblacksmith/begin-testbox` | `233448af4bfdc6fca509a7f0974411ac6d8a8043` | `# v2`     |
| `actions/setup-node`          | `249970729cb0ef3589644e2896645e5dc5ba9c38` | `# v6.5.0` |
| `useblacksmith/run-testbox`   | `5ca05834db1d3813554d1dd109e5f2087a8d7cbc` | `# v2`     |
