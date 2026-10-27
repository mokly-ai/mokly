# Developer Test Commands

Status: In progress under the [shared UI package plan](../../plans/ui-package.md).

## Public Commands And Preparation

- `npm test -- [<file> ...] [<pattern> ...]` builds first with `npm run build`,
  then calls the developer Node test runner. With no arguments, it runs the
  complete discovered Node test inventory under the developer skip policy and
  writes the evidence report. The inventory is the tooling tests under `tests/`,
  the viewer tests under `packages/viewer/tests/`, and the UI package tests
  under `packages/ui/tests/`.
- `cargo test -p <crate>` runs one crate's Rust tests, and
  `cargo test --workspace` runs the default targets. The repository suite runs the default
  set; a selected crate is partial verification. Sidecar integration tests
  require `npm run build --workspace @mokly/viewer` then
  `npm run build --workspace @mokly/mokly` before a raw Cargo run.
- Run the on-demand design matrix with `cargo test -p mokly-cli --features design-matrix --test design_attribution_tests`; the default workspace tests and the gate do not run it. The repository suite compiles and lints it with `cargo clippy -p mokly-cli --features design-matrix --all-targets -- -D warnings`.
- `npm run test:browser -- [<spec> ...] [-g "<name>"]` builds first, then
  forwards its arguments to Playwright. Without filters, it runs every browser
  spec against `mokly serve` of the example catalogue.

`npm test` and `npm run test:browser` always build first, so they test the
current sources, including after a change to the viewer, the shim, the sidecar,
or a crate. The build runs before the developer runner starts; argument
rejection still happens before any test process starts.

`npm run typecheck` resolves public authoring declarations from package
output. Run `npm run build` first. The viewer suite supplies this preparation.

The raw commands `node --import tsx --test <file>` and
`npx playwright test <spec>` skip the build and test the last build. After a
source change, run `npm run build` before using either raw command. One build
can serve repeated raw runs while the sources stay unchanged. No test
command prepares a baseline, a compiled example snapshot, or a packed archive.

The `test:prepared`, `test:viewer:prepared`, and `test:browser:prepared`
commands keep the [strict runner contract](./ci-verification.md#gate-ownership).
They are not public developer selection commands.

## Developer Test Arguments

The runner accepts zero or more file paths and zero or more name patterns. File
and pattern arguments can appear together in any order. The usage text is:

```text
usage: npm test -- [<file> ...] [<pattern> ...]
pattern: --test-name-pattern=<regex> | --test-name-pattern <regex>
```

Put every argument after `--` in npm commands. npm can consume flags before
that separator and omit them from the script arguments. Before any other work,
the developer parser rejects a non-empty `npm_config_test_name_pattern` value.
Its error says that npm consumed the flag and shows the separator form
`npm test -- --test-name-pattern=<regex>`. Empty values and unrelated npm
configuration do not trigger this guard.

Before starting a test process, the developer runner follows this order:

1. Parse and validate the arguments, including flag forms, pattern values, file
   existence, and path normalization.
2. Validate the [shared file concurrency](./ci-suite-evidence.md#test-concurrency).
3. Discover the Node test inventory and validate file membership against it.
4. Check that the build under test exists.
5. Run tests.

The [strict discovery rules](./ci-verification.md#gate-ownership) define the
inventory roots and file extensions. Empty discovery fails before execution.
Both complete and selected developer runs use this same discovered inventory.

A complete run, under the developer or the strict policy, removes its old
report before discovery and the build check. A failed discovery or a missing
build therefore cannot leave stale complete evidence.

### File Paths

Resolve relative paths against the repository root, even when the runner starts
in a different directory. Accept `./` prefixes, redundant separators, `..`
segments that stay inside the repository, platform path separators, and
absolute paths inside the repository. Normalize every accepted path to its
repository-relative POSIX form before comparing it with the inventory. Paths
that normalize to the same file execute that file only once. Resolve the root
and linked parent folders, leaving each file name unchanged.

A directory, missing file, path outside the repository, or file absent from the
discovered inventory fails. Each error names the original argument. A
`.spec.ts` argument fails and also names `npm run test:browser -- <path>` so the
caller can use the browser command. These errors must precede test execution.

### Name Patterns And Rejected Flags

Accept both `--test-name-pattern=<regex>` and `--test-name-pattern <regex>`.
Each occurrence requires a non-empty value. A missing or empty value reports
`--test-name-pattern needs a non-empty value`, followed by usage. Each value
must follow Node CLI regex syntax, including `/pattern/flags` values. An invalid
regex reports `invalid --test-name-pattern value "<value>": <SyntaxError message>`,
followed by usage. Show the pattern exactly as typed inside double quotes; do
not apply JSON escaping. Validation happens before inventory discovery, the
build check, or test execution. Forward every pattern unchanged and in argument
order to Node; Node applies repeated patterns as alternatives.

Reject `--shard` with or without a value, including the equals form: Node tests
have no shards. Its error names `cargo xtask check --suite browser --shard` as
the only sharded suite. Every other flag fails with the usage text, preceded by
`unknown option <flag>`.

### Developer Failure Reports

Argument and inventory-membership errors are expected failures. An expected
failure prints its complete message to stderr and exits with code 1, without a
stack or Node version footer. A missing build, empty discovery, concurrency
errors, and other internal faults keep Node's default error report. The strict entrypoint and the complete report
schema do not change with selection.

## Selected Runs

At least one file or pattern argument makes the invocation a selected run. File
arguments select their normalized, de-duplicated files. A pattern without file
arguments selects the complete discovered inventory. It still uses the
selected-run policy and writes no evidence report.

Execute only the selected files, with the
[shared file concurrency](./ci-suite-evidence.md#test-concurrency) and the
verification reporter. Before Node starts, print
`unit test files active at once: <count>` with the value used for this run. Pass
name patterns to Node before its file arguments. Allow skipped and todo tests,
including intentional Windows skips, under the developer policy. Print their
combined count. Zero matching tests in a selected file is not a failure; the
reporter must still observe that file and complete normally.

The [selected-run result contract](./developer-test-results.md) defines exact
counts, warnings, classified failure reports, and interrupted-process messages.
Selected runs recognize top-level file passes without summaries as zero-test
files. Complete and strict runs still require per-file summaries.

Selected runs never create, remove, or change any file under
`.context/verification-reports`. They ignore `MOKLY_VERIFICATION_REPORT`, even
when it points outside that directory. An existing complete report must stay
unchanged. Store reporter events in a separate temporary directory and remove
that temporary output after the run, including on failure or cancellation.

An invocation without file or pattern arguments is the complete developer run.
It keeps the skip and todo policy, the printed count, and the evidence report
behavior, including the `MOKLY_VERIFICATION_REPORT` override. Report validation
for that complete inventory follows
[CI verification](./ci-verification.md#inventory-and-report-evidence), with
the developer allowance for skips and todos.

## Browser Selection

The [browser command contract](./developer-browser-commands.md#browser-selection)
defines selected browser runs and the required static-delivery check.

## Partial Verification

Any selected Node test run, selected crate test, filtered Playwright run, or
single `cargo xtask check --suite` run is partial verification. A complete
developer `npm test` or public browser run alone also does not prove the
complete gate. Only the complete `cargo xtask check`, or the validated CI
aggregate defined in
[CI verification](./ci-verification.md#verification-boundary), provides
complete verification.

## Packed Consumer Smoke

`npm run package:smoke` checks the installed archives in a scratch consumer.
See [Packed Consumer Smoke](./packed-consumer-smoke.md) for its commands,
coverage, process cleanup, and native browser requirements.

## Native TLS Build Tools

The workspace forces `AWS_LC_SYS_USE_SYSTEM=0` in `.cargo/config.toml`, so a
build never uses a host AWS-LC library. Release checks inspect all five
binaries for unintended crypto shared-library dependencies. The
[publish crate guide](../../crates/mokly-publish/README.md#what-this-crate-does)
names the C toolchain that the bundled TLS provider needs. A cross build also
needs the target's headers, libraries, linker, and Rust target. The
[AWS-LC requirements](https://aws.github.io/aws-lc-rs/requirements/index.html)
list the supported native toolchains.
