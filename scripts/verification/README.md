# Verification scripts

The Cargo task runner calls these scripts for repository, viewer, browser, and
dependency verification. The [development guide](../../docs/development/README.md)
describes the complete gate and focused commands.
Public test commands and strict evidence rules live in the
[verification contract](../../docs/protocol/ci-verification.md).

## Key code

- [`run-viewer.mjs`](./run-viewer.mjs) runs the viewer suite for `npm test`
  and, with `--strict`, for `npm run test:viewer:prepared`.
- [`browser-developer.mjs`](./browser-developer.mjs) runs the selected
  Playwright specs of `npm run test:browser` after it checks the build.
- [`run-browser.mjs`](./run-browser.mjs) runs the strict browser suite, or one
  shard of it, and writes its report.
- [`static-delivery.mjs`](./static-delivery.mjs) runs the static HTTP and
  `file://` delivery checks of `npm run test:delivery:prepared`.
- [`dependency-audit.mjs`](./dependency-audit.mjs) and
  [`audit-rust.mjs`](./audit-rust.mjs) run the npm and Rust dependency audits.
- [`aggregate.mjs`](./aggregate.mjs) holds `validateCiReports`, which checks
  that a commit has every CI suite report for each runtime profile.
- [`repository-ratchets.mjs`](./repository-ratchets.mjs) holds
  `runRepositoryRatchets`, which runs every maintainability ratchet of the
  Repository suite.
- [`testbox-suite.mjs`](./testbox-suite.mjs) runs one suite command on a remote
  Testbox.

## Workflow syntax

Run `actionlint` without arguments from the repository root to check every
GitHub Actions workflow. It automatically reads
[`.github/actionlint.yaml`](../../.github/actionlint.yaml), which lists the
exact Blacksmith runner labels used by the workflows. Keep this list aligned
with the workflow runners. Use no runner-label ignore pattern or alternate
configuration file. This is a separate manual check.

## Rust advisory audit

Run `npm run dependencies:check:rust`. It needs Node, Cargo, and the installed
npm dependencies, because the tool installer reads the release archive with
`tar`. `audit-rust.mjs` starts `rust-audit.mjs` at the repository root.

The wrapper checks the UTC review deadline before starting a process. It reads
the locked dependency graph through Cargo metadata and checks `lightningcss`.
It gets pinned cargo-audit from the [tool installer](#rust-audit-tool) and runs
that executable for a live JSON audit. The report gives the effective ignore
list and severity and target filters, including configuration changes outside
the repository file. Only the approved advisory can be ignored. The severity
must be null, and effective target lists must be empty. Native tools parse
their own TOML inputs.
Every command failure propagates.

The [dependency security contract](../../docs/protocol/dependency-security.md#rust-advisory-audit)
defines the approved exception and review conditions. `tests/rust_audit.test.ts`
injects time, the installer, and command results to cover expiry, version
changes, extra IDs, filters, invalid output, and failure propagation without a network or
elapsed-time assertion.

## Rust audit tool

The audit wrapper calls `ensureRustAuditTool(root)` in
[`rust-audit-tool.mjs`](./rust-audit-tool.mjs). It downloads cargo-audit 0.22.2
from crates.io and verifies the release archive's pinned SHA-256 before
extraction. It uses the reviewed dependency graph in
[the tool lockfile](../../.cargo/audit-tool/Cargo.lock), isolates the source
from the parent Cargo workspace, and builds with `cargo install --locked`.

The tool lives under `.context/rust-audit-tool/{identity}/bin/`. Its identity
includes the host platform and architecture, source version, source checksum,
and complete lockfile bytes.
The installer writes its completion marker only after a successful build.
Failed or interrupted installs cannot become cache hits. It removes the
temporary source tree after installation. Compiled dependencies use
`target/rust-audit-tool/`. Both locations stay ignored.

In CI, the Repository job's Rust build cache restores
`.context/rust-audit-tool/`, so most runs reuse the installed tool. The cache
key hashes the tool lockfile and this installer. A new pin or lock therefore
misses the cache, and the next `main` run saves the new tool.
`tests/ci_rust_cache.test.ts` imports the directory and lockfile paths from
the installer to keep the workflow aligned. It checks that every CI cargo job
restores the Rust build cache, that only `main` saves it, that Testboxes never
save it, and that the audit tool key covers the tool inputs. It also checks the
CI build settings and that the release workflows use no build cache.

The installer returns the exact installed executable. The wrapper runs the
live workspace advisory query with it on every invocation, including cache
hits. The installer does not change the wrapper's advisory policy. The daily
read-only audit job installs the existing npm dependencies with lifecycle
scripts disabled before it uses the installer.

To update tool dependencies, extract the pinned source into an isolated
workspace, apply Cargo updates with the repository's Rust toolchain, and
review the resulting lockfile. Audit it explicitly with
`cargo audit --file .cargo/audit-tool/Cargo.lock`, then build and exercise the
tool through `npm run dependencies:check:rust`. The tool source stays pinned
unless its version and archive checksum are updated together.

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
inputs in estimated milliseconds per test. They use the median per-test cost
of complete, successful hosted browser runs.

For each sample and `specFile`, sum `observedTests.durationMs` and divide by
its observed test count. Take the median of the available per-test sample
costs for each file and round to three decimal places. A file absent from an
older sample uses the available samples. Refresh from complete, successful
browser report sets and retain the source reports and calculations under
`.context/`.
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

The remote command runs [`refresh-source-mtimes.mjs`](./refresh-source-mtimes.mjs)
before this wrapper. It refreshes every regular copied path that differs from
the warmup base, so the first Cargo build cannot reuse a stale native binary.

No browser command also runs delivery. The remote plan gives static delivery
its own seventh Testbox and requires its exit result. Browser and viewer
reports retain the existing five-report aggregate. The delivery parent
validates its own HTTP and file reports before returning success.

### Testbox workflow reference

[`tests/ci_workflow_scripts.test.ts`](../../tests/ci_workflow_scripts.test.ts)
executes the lockfile stamp step and the environment step on Linux hosts with
controlled inputs and asserts the written files. The environment run redirects
`/etc/environment` to a temporary file and stubs `sudo`. It also requires the
environment step to write every workflow `env` entry.
[`tests/ci_testbox_alignment.test.ts`](../../tests/ci_testbox_alignment.test.ts)
keeps the Testbox runner, workflow `env`, and Rust cache options equal to those
of the CI suite jobs, and requires the Testbox cache to never save. Step order
and action pins are review-owned literals.

Pin each action to these immutable revisions. Keep the version comments.

| Action                        | Commit                                     | Comment    |
| ----------------------------- | ------------------------------------------ | ---------- |
| `useblacksmith/checkout`      | `25227e61ff9dafe400e22fa487b673eac4e4409a` | `# v1`     |
| `useblacksmith/begin-testbox` | `233448af4bfdc6fca509a7f0974411ac6d8a8043` | `# v2`     |
| `actions/setup-node`          | `249970729cb0ef3589644e2896645e5dc5ba9c38` | `# v6.5.0` |
| `Swatinem/rust-cache`         | `d1527c8f67ef9af357290475d4af4b0fab8f12e0` | `# v2.9.3` |
| `useblacksmith/run-testbox`   | `5ca05834db1d3813554d1dd109e5f2087a8d7cbc` | `# v2`     |
