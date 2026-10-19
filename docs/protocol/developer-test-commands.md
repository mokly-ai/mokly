# Developer Test Commands

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Public Commands And Preparation

- `npm test -- [<file> ...] [<pattern> ...]` builds first with `npm run build`,
  then calls the developer Node test runner. With no arguments, it runs the
  complete discovered Node test inventory under the developer skip policy and
  writes the evidence report. The inventory is the tooling tests under `tests/`
  and the viewer tests under `packages/viewer/tests/`.
- `cargo test -p <crate>` runs one crate's Rust tests, and
  `cargo test --workspace` runs them all. The repository suite runs the complete
  set; a selected crate is partial verification. Sidecar integration tests
  require `npm run build --workspace @mokly/viewer` then
  `npm run build --workspace @mokly/mokly` before a raw Cargo run.
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

The `test:prepared` and `test:browser:prepared` commands keep the
[strict runner contract](./ci-verification.md#gate-ownership). They are not
public developer selection commands.

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
configuration do not trigger this guard. The parser accepts an environment
parameter for this check, with `process.env` as the default.

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

The selected helper owns inventory discovery, file membership validation, the
build check, and execution. A complete run first obtains its identity and
report path, then removes the old report and event file before discovery and
the build check. Thus failed discovery or a missing build cannot leave stale
complete evidence. Both complete policies use this same sequence.

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

Argument and inventory-membership errors are expected failures. The developer
entrypoint catches only `ExpectedFailure`, prints its complete message to
stderr, and sets exit code 1 without a stack or Node version footer. A missing
build, empty discovery, concurrency errors, and other internal faults keep
Node's default error report. The strict entrypoint and the complete report
schema do not change with selection.

## Selected Runs

At least one file or pattern argument makes the invocation a selected run. File
arguments select their normalized, de-duplicated files. A pattern without file
arguments selects the complete discovered inventory. It still uses the
selected-run policy and writes no evidence report.

Execute only the selected files, with the
[shared file concurrency](./ci-suite-evidence.md#test-concurrency) and the
verification reporter. Before Node starts, print
`test files active at once: <count>` with the value used for this run. Pass
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

Select browser tests by spec path and Playwright's `-g` name filter:

```bash
npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"
```

After a build, the same selection can use
`npx playwright test tests/browser/pages.spec.ts -g "retain metadata"`. The
browser suite sets `forbidOnly`. Use paths and `-g` to select tests; never use
`.only`. [CI verification](./ci-verification.md#gate-ownership) defines spec discovery.

Shared Serve uses `refs/mokly/browser-suite-no-base` and waits for settled usage and unavailable Changes.
It requires one `git-failed` line. Real Changes specs own separate Git fixtures.

Global setup copies the current-only example for most `static_*.spec.ts`,
`stage_centring`, and `review_snapshot_links`. A second two-commit fixture
serves comparison specs; [fixture APIs](../../tests/browser/README.md) describe both.
To supply current-only output, set `MOKLY_PLAYWRIGHT_STATIC_DIR`. For example:

```bash
npx mokly build --config examples/basic/mokly.config.json --no-changes --out ../../.context/example
MOKLY_PLAYWRIGHT_STATIC_DIR=.context/example npm run test:browser -- tests/browser/browse_chrome.spec.ts
```

The host uses exact files and a free port. Supplied output must have Changes disabled.
Browser specs support POSIX only. Do not assume empty Changes in remote Testboxes.
`MOKLY_PLAYWRIGHT_FILE_DIR` selects the same built directory for design checks
that open portable documents directly through `file://` URLs.

For example, after the build above:

```bash
MOKLY_PLAYWRIGHT_FILE_DIR=.context/example npm run test:browser -- tests/browser/component_inspector.spec.ts
```

File mode is checked by a manual run. Supported specs under `tests/browser/`
are `comparison_design`, `component_controls`, `component_design`,
`component_design_inspection`, `component_design_selection`, `component_evidence`,
`component_inspector`, `component_surfaces`, `component_workspace`,
`design_comparison_eligibility` (and `_2`, `_3`, `_4`),
`design_comparison_scrolling`, `design_comparison_stacks`,
`design_component_stacks`, `design_index_entries`, `design_library`,
`design_modern_controls`, `design_portable`, `design_scroll_together`,
`design_stylesheet_evidence`, `design_top_bar`, `example_links`, and
`phone_chrome`; each name has the `.spec.ts` suffix. File mode opens exact
output bytes without an HTTP fallback.

Browser traces and screenshots stay under `.context/playwright-results/`.

## Development Workflow And Verification Boundary

During development, run only the test files that cover the change: `npm test`
for Node test files, `cargo test -p <crate>` for a crate, and
`npm run test:browser` for browser specs. Require a 100% pass rate for the tests
that run. Run `cargo xtask check --suite repository` early to catch formatting,
lint, file-length, export, and Rust failures before long test runs. Leave
complete viewer and browser suite runs to the complete gate.

Run the complete `cargo xtask check` once before saying work is complete. A
local run stops at the first failed suite. A
[remote run](./remote-verification.md) reports every failed suite. After a
failure, fix it and rerun the narrowest command that covers it. Use the
targeted commands for failing test files, crates, or browser specs. Use the
failed `--suite` for repository or viewer findings. Then run the complete gate
once more. If the gate cannot run, explain the blocker and list the checks
already run. Documentation-only and plan-only changes keep the exception in the
`finish-work` skill, which [AGENTS.md](../../AGENTS.md) names: validate the
changed Markdown and review the diff.

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

The publish client uses reqwest with rustls and the AWS-LC provider. Its
non-FIPS build compiles bundled C and assembly for the target. Install a
supported C compiler and archiver for each target. The normal Linux build
uses the cc builder; CMake is a fallback. Windows x64 uses the provider's
prebuilt NASM objects when that feature is enabled by rustls. Cross builds
need target headers, libraries, and a linker as well as the Rust target.

The workspace forces `AWS_LC_SYS_USE_SYSTEM=0` in `.cargo/config.toml`.
This disables automatic host AWS-LC discovery through `OPENSSL_DIR` and
pkg-config. Release checks inspect all five binaries for unintended crypto
shared-library dependencies. Run the native CI on macOS and Windows before
release acceptance. The [AWS-LC requirements](https://aws.github.io/aws-lc-rs/requirements/index.html)
list the supported native toolchains.
