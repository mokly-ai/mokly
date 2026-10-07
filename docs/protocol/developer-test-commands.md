# Developer Test Commands

## Delivery Status

The `test:unit` command, `npm test` forwarding, and developer file and name
selection are implemented. Public test preparation and the strict prepared
runners retain their existing behavior. This page owns public developer
commands. [CI verification](./ci-verification.md)
owns prepared commands, strict discovery, shards, and complete report evidence.

## Public Commands And Preparation

- `npm run test:unit` prepares package and example output, then calls the
  developer unit runner. With no arguments, it runs the complete discovered
  unit inventory under the existing developer skip policy and writes the
  existing evidence report.
- `npm test` forwards all arguments to `test:unit` through `npm run ... --`,
  using the forwarding pattern already used by `package:check`.
- `npm run test:browser` keeps its existing preparation and Playwright argument
  forwarding. Without filters, it runs both projects and all browser specs.

`npm test`, `npm run test:unit`, and `npm run test:browser` always prepare
package and example output first. They therefore test the current `src/`,
including after a source change. Preparation runs before the developer runner
starts; argument rejection must still happen before any test process starts.

The raw commands `node --import tsx --test <file>` and
`npx playwright test <spec>` skip preparation and test the last build. After a
`src/` change, run `npm run prepare:verification` before using either raw
command. One preparation can serve repeated raw runs while source stays
unchanged.

The `test:prepared`, `test:browser:prepared`, and `test:hydration:prepared`
commands keep the [strict runner contract](./ci-verification.md#gate-ownership).
They are not public developer selection commands.

## Developer Unit Arguments

The runner accepts zero or more file paths and zero or more name patterns.
File and pattern arguments can appear together in any order. The usage text is:

```text
usage: npm test -- [<file> ...] [<pattern> ...]
       npm run test:unit -- [<file> ...] [<pattern> ...]
pattern: --test-name-pattern=<regex> | --test-name-pattern <regex>
```

Put every argument after `--` in npm commands. npm can consume flags before
that separator and omit them from the script arguments. Before any other work,
the developer parser rejects a non-empty `npm_config_test_name_pattern` or
`npm_config_shard` value. Its error says that npm consumed the flag and shows
the separator form: `npm test -- --test-name-pattern=<regex>` for patterns or
`npm run test:prepared -- --shard INDEX/TOTAL` for shards. Empty values and
unrelated npm configuration do not trigger this guard. The parser accepts an
environment parameter for this check, with `process.env` as the default.

Before starting a test process, the developer runner follows this order:

1. Parse and validate the arguments, including flag forms, pattern values,
   file existence, and path normalization.
2. Validate the [shared file concurrency](./ci-suite-evidence.md#test-concurrency).
3. Discover the unit inventory with `discoverUnitFiles(repositoryRoot)` and
   validate file membership against that inventory.
4. Check required package and example output with
   `requirePrepared(repositoryRoot)`.
5. Run tests.

The [strict discovery rules](./ci-verification.md#gate-ownership) define the
inventory roots and file extensions. Empty discovery fails before execution.
Both complete and selected developer runs use this same discovered inventory.

The selected helper owns inventory discovery, file membership validation,
prepared-output checks, and execution. A complete run first obtains its
identity and report path, then removes the old report and event file before
discovery and preparation checks. Thus failed discovery or preparation cannot
leave stale complete evidence. Both complete policies use this same sequence.

### File Paths

Resolve relative paths against the repository root, even when the runner starts
in a different directory. Accept `./` prefixes, redundant separators, `..`
segments that stay inside the repository, platform path separators, and
absolute paths inside the repository. Normalize every accepted path to its
repository-relative POSIX form before comparing it with the inventory.
Paths that normalize to the same file execute that file only once.
Resolve the root and linked parent folders, leaving each file name unchanged.

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
followed by usage. Show the pattern exactly as typed inside double quotes;
do not apply JSON escaping. Validation happens
before inventory discovery, prepared-output checks, or test execution. Forward
every pattern unchanged and in argument order to Node; Node applies repeated
patterns as alternatives.

Reject `--shard` with or without a value, including the equals form. Its error
must name `npm run test:prepared` and
`cargo xtask check --suite unit --shard`. Every other flag fails with the usage
text, preceded by `unknown option <flag>`. Only the strict runners accept shards.

### Developer Failure Reports

Argument and inventory-membership errors are expected failures. The developer
entrypoint catches only `ExpectedFailure`, prints its complete message to stderr,
and sets exit code 1 without a stack or Node version footer. Missing preparation,
empty discovery, concurrency errors, and other internal faults retain Node's
default error report. The strict entrypoint and complete report schema stay unchanged.

## Selected Unit Runs

At least one file or pattern argument makes the invocation a selected run.
File arguments select their normalized, de-duplicated files. A pattern without
file arguments selects the complete discovered inventory. It still uses the
selected-run policy and writes no evidence report.

Execute only the selected files, with the
[shared file concurrency](./ci-suite-evidence.md#test-concurrency) and existing
verification reporter. Before Node starts, print
`unit test files active at once: <count>` with the value used for this run.
Pass name patterns to Node before its file arguments.
Allow skipped and todo tests, including intentional Windows skips, under the
current developer policy. Print their combined count. Zero matching tests in a
selected file is not a failure; the reporter must still observe that file and
complete normally.

The [selected-run result contract](./developer-test-results.md) defines exact
counts, warnings, classified failure reports, and interrupted-process messages.
Selected runs fail files with a top-level pass but no per-file summary.
Complete and strict runs still require per-file summaries.

Selected runs never create, remove, or change any file under
`.context/verification-reports`. They ignore `MOKLY_VERIFICATION_REPORT`, even
when it points outside that directory. An existing complete report must stay
unchanged. Store reporter events in a separate temporary directory and remove
that temporary output after the run, including on failure or cancellation.

An invocation without file or pattern arguments remains the complete developer
run. Keep its existing skip and todo policy, printed count, and evidence report
behavior, including the `MOKLY_VERIFICATION_REPORT` override. Report validation
for that complete inventory follows
[CI verification](./ci-verification.md#inventory-and-report-evidence),
with the developer allowance for skips and todos.

## Browser Selection

Select browser tests by spec path and Playwright's `-g` name filter:

```bash
npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"
```

After preparation, the same selection can use
`npx playwright test tests/browser/pages.spec.ts -g "retain metadata"`.
The browser suite sets `forbidOnly`. Use paths and `-g` to select tests; never
use `.only`. The project partition and spec discovery remain defined in
[CI verification](./ci-verification.md#gate-ownership).

## Development Workflow And Verification Boundary

During development, run only test files that cover the change. Require a 100%
pass rate for the tests that run. Run `cargo xtask check --suite repository`
early to catch formatting, lint, file length, export, and Rust failures before
long test runs. Leave complete unit and browser suite runs to the complete gate.

Run the complete `cargo xtask check` once before saying work is complete.
A local run stops at the first failed suite. A
[remote run](./remote-verification.md) reports every failed suite.
After a failure, fix it and rerun the narrowest command that covers it. Use the
targeted commands for failing unit test files or browser specs. Use the failed
`--suite` for repository or package findings. Then run the complete gate once
more. If the gate cannot run, explain the blocker and list the checks already
run. Documentation-only and plan-only changes retain the exception in
[AGENTS.md](../../AGENTS.md): validate Markdown and review the diff.

Any selected unit run, filtered Playwright run (including project selection),
or single `cargo xtask check --suite` run is partial verification. A complete
developer unit or public browser run alone also does not prove the complete
gate. Only the complete `cargo xtask check`, or the validated CI aggregate
defined in [CI verification](./ci-verification.md#verification-boundary),
provides complete verification.
