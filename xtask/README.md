# Mokly xtask

`xtask` owns repository-local verification for the Mokly workspace. It is an
internal binary and is not published to npm or crates.io.

## Responsibilities

- Run the current source-level TypeScript, package, example, and Rust suite.
- Run the baseline dependency audit by default and fail on new issues or
  audit errors. Support strict mode for release and dependency update checks.
- Enforce the Rust file-length limit.
- Enforce changed repository-wide TypeScript/JavaScript (300 lines) and
  protocol Markdown (250 lines or an exact reviewed cap) limits against the
  fetched `origin/main` baseline.
- Ratchet JavaScript/TypeScript length, protocol caps, and internal exports
  against the branch point, and published-package exports against release tags.
- Keep the complete local gate aligned with the approved independent CI suites.
- Run explicit and automatic remote checks on 11 Testboxes with complete shard
  evidence.
- Stop warmed boxes on failure, success, SIGINT and SIGTERM.

## What This Crate Does

The crate provides the implementation behind `cargo xtask check`,
`cargo xtask rust-file-length-lint`, and `cargo xtask source-file-length-lint`.
Every spawned command runs from the workspace root even if xtask starts in a
subdirectory. The source audit finds that root with Git, covers `.ts`, `.tsx`,
`.js`, `.jsx`, `.mjs`, `.cjs`, `.mts` and `.cts` anywhere in the repository plus
`docs/protocol/**/*.md`, and excludes only Git-ignored untracked files.
`--all` audits every tracked or non-ignored untracked scoped file.
During an uncommitted merge, the changed-file audit compares the resolved tree
directly with `origin/main`, so main-only additions do not become false
violations before the merge commit exists.
The Node unit/integration suite runs at most half the available CPUs' worth of
test files at once, never fewer than two. The hydration suite runs half the
available CPUs as Playwright workers, never fewer than one, and the browser
suite keeps one worker. Each Playwright worker owns one example server and runs
whole spec files. Set `MOKLY_UNIT_CONCURRENCY` or `MOKLY_PLAYWRIGHT_WORKERS` to a
positive integer to override these values. The
[test concurrency contract](../docs/protocol/ci-suite-evidence.md#test-concurrency)
defines them. Individual concurrency tests and their existing timeouts remain
unchanged.
For targeted unit and browser runs during development, use the
[developer test commands](../docs/protocol/developer-test-commands.md).
The [baseline audit contract](../docs/protocol/dependency-audit-baseline.md)
defines the complete check's default, `npm run dependencies:check -- --baseline`,
covering every dependency category from the lockfile. Issues already present at
the merge base print as inherited notices. New issues or operational audit
errors stop subsequent checks. `--dependency-audit strict` instead calls
`npm run dependencies:check`, which fails on all uncovered findings and invalid
exception records. Both modes require registry access. Reviewed exceptions
have exact dev-only paths, inclusive UTC end dates, and a maximum 31-day window under the
[dependency security contract](../docs/protocol/dependency-security.md).
Packed-consumer smokes separately audit the consumer's resolved production
dependencies without workspace overrides or audit exceptions.

The [CI verification contract](../docs/protocol/ci-verification.md) defines the
suite boundaries, shard evidence, and fail-closed CI aggregate. Selected suites
are partial verification. The unqualified command runs the complete gate.
`--executor remote` runs that gate on Testboxes. `auto` selects remote mode when
an org key and every availability check pass. It otherwise selects local mode.
The [repository ratchet contract](../docs/protocol/verification-ratchets.md) owns
the exact scopes and exceptions. Length, protocol-cap, and
unused-internal-export analysis compare against
`git merge-base HEAD origin/main`; module analysis covers `.ts`, `.tsx`, `.mts`,
`.cts`, `.js`, `.mjs`, and `.cjs` under the three source roots, the
internal-export baseline rejects entries absent at that merge base, and protocol
caps scan `docs/protocol/**` recursively except `fixtures/`. The
public-package-export ratchet instead compares each released package with its
newest matching release tag reachable from `HEAD`. Full history and tags are
required; when a release manifest records a release but the tag is unavailable,
fetch them with `git fetch --tags origin` and retry. All four checks belong to
the repository suite and complete gate.

The sole current unused-export exception is the component renderer imported by
generated consumer-module source: `src/build/consumer_entry.ts` emits that
re-export as source text, so there is no static module edge for the analyser to
follow. Its exact entry lives in the shrink-only reviewed baseline. A comparison
commit that predates the baseline file permits that one-time bootstrap; after
the file lands, candidate entries must already exist at the merge base. Ordinary
CI runs functional suites on the minimum Node 22.14 runtime. Release Please pull
requests add Node 24; CI resolves the latest patch in its repository
prerequisite and explicitly shares that exact result with dependent jobs,
keeping shard evidence consistent across runner caches. The single release
publishing job independently resolves the latest Node 24.

Hydration coverage discovers a separate browser test for one representative
route per example entry shape, as
[development hydration coverage](../docs/protocol/ci-verification-hydration.md)
defines. A new screen adds a test only when it adds a new shape, and no route
shares a test deadline. The unsharded `hydration` suite runs those
filename-selected specs separately from `browser`.
Tests using `changedFixture` register servers and workers with
`fixture.onCleanup` to drain them before removing their working tree.

## Quick Start

```bash
cargo xtask check
cargo xtask check --dependency-audit strict
cargo xtask check --executor local
cargo xtask executor
cargo xtask executor --executor local
cargo xtask check --executor remote
cargo xtask check --suite repository
cargo xtask check --suite repository --dependency-audit strict
cargo xtask check --suite package
cargo xtask check --suite unit --shard 1/4
cargo xtask check --suite browser --shard 1/4
cargo xtask check --suite hydration
cargo xtask rust-file-length-lint --all
cargo xtask source-file-length-lint
cargo xtask source-file-length-lint --all
```

`--shard INDEX/TOTAL` is valid only for the unit and browser suites. Omitting it
runs the full selected suite. Package, unit, browser, and hydration suites
prepare their required output before invoking prepared npm scripts. The unit
suite runs `npm run prepare:unit`, which also writes the
[example compilation snapshot](../docs/protocol/ci-example-snapshot.md)
that unit tests load instead of compiling the example in every test file; the
other suites run `npm run prepare:verification`.

`--dependency-audit <baseline|strict>` defaults to `baseline`. It is valid for
the complete gate or repository suite. An explicit mode flag with another suite
returns a typed error before subprocesses start. Ordinary pull requests and all
pushes use baseline mode; same-repository dependency update and Release Please
pull requests use strict mode. Release publishing uses strict mode for its
direct audit and complete fallback. The scheduled `main` audit also
uses strict mode under the linked update pull request contract. A remote
complete gate passes the same mode to the repository command on its Testbox.

`--executor auto|local|remote` overrides `MOKLY_CHECK_EXECUTOR`.
An absent flag and variable select `auto`. Explicit `local` skips remote checks.
Explicit `remote` rejects `--suite` and GitHub Actions.
Push local `HEAD` before a remote check. Install `blacksmith`, `rsync` and `ssh`.
PATH lookup skips entries when file access fails.
Set `BLACKSMITH_ORG_TOKEN` to use org-key login through stdin.
Remote mode can use the current CLI login when the key is absent.
Login saves the key in `~/.blacksmith/credentials`.
It replaces any saved login for the same organization.
The CLI never receives the key in arguments or remote commands.
Every xtask child removes the shared secret environment list, which currently
contains only `BLACKSMITH_ORG_TOKEN`. Key login still uses standard input.
Availability checks name all missing programs in one diagnostic, in the order
`blacksmith`, `rsync`, `ssh`, with their install hints.
Warmup uses the Testbox workflow from `main`.
Set `MOKLY_TESTBOX_REF=<pushed branch>` only to test a changed Testbox workflow
before it merges.
It does not change the required source fingerprint or `HEAD`.

The [remote contract](../docs/protocol/remote-verification.md) defines the
availability order, probe barrier, report aggregate and cleanup.
Warmup uses a 30-minute idle timeout. Readiness still uses `10m`.
Each command worker downloads its report and cleans up its box when it ends.
It does not wait for other commands. Final cleanup covers only remaining boxes.
Different boxes clean up in parallel. Each box keeps its own attempt order.
The status table can prove a box already completed. That box needs no stop or
GitHub cancellation. Cleanup keeps run IDs from warmup and probe output as a
fallback when status fails or names no run. A failed stop gets retries after
5 seconds and 10 more seconds, with at most three attempts per box.
Final cleanup counts each box once if it is neither stopped nor proven completed.
That count fails the check. A recovered stop does not fail it.
An interrupt reports the same count. Each remaining box gets a warning with
its manual stop command and the 30-minute idle timeout.
After a failed GitHub cancellation, xtask reads the run state with
`gh run view <id> --json status --jq .status`. A completed run
gets an information line. Other states and failed reads keep the warning.
The aggregate runs after all commands and cleanup end.
Each check creates new report and log directories under `.context/`.
Their shared run name is UTC `YYYYMMDDTHHMMSSZ` followed by `-<process-id>`.
Decision, information and warning lines start with `[xtask/executor]`.
One function formats warnings that embed errors. Each error keeps its module
prefix. Remote errors use `[xtask/remote]`. No line repeats a prefix.
Suite progress and summaries start with `[xtask/remote]`.
Failed commands show their last 60 log lines and the log path.
Failed aggregate and fingerprint reads show captured stdout and stderr after
their warning. The summary names the aggregate outcome as `passed` or `failed`.
Automatic mode checks the key before looking for programs.
No key prints one information line and selects local mode.
`cargo xtask executor` prints exactly `<executor>: <reason>` on stdout.
It checks availability without warming boxes or running suites.
The CLI version and diagnostics stay on stderr. Both decisions exit 0.
Invalid or rejected modes exit nonzero.
Automatic preparation failures stop their boxes before the full local fallback.
Typed results prevent fallback after suites start or an interrupt arrives.
Failed preparation cleanup also prevents fallback.
Before fallback after an armed signal handler, xtask releases the handler.
SIGINT, SIGTERM or SIGHUP after release ends xtask at once with exit status 130.
Xtask reads the interrupt flag again after release. An earlier signal prevents
fallback. Terminal output is best effort. Closed stdout or stderr cannot stop
cleanup. A guard tracks boxes that are not yet stopped or proven completed.
It uses the normal cleanup rules when a panic unwinds the runner.
It never panics itself and does no cleanup on a normal return.

## Development

Run the crate tests directly when changing command orchestration:

```bash
cargo test --package xtask
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
```

The `*_adapter_tests.rs` files under `src/remote/_tests_/` test the operating
system boundaries with real shell children and temporary directories. They
cover streamed logs, private stdin, child environments, process-group cleanup,
fresh log files, PATH permissions and interrupt state order. They use readiness
signals and expected-state waits. They do not assert elapsed time.

### Key Code

- [`src/cli.rs`](./src/cli.rs) parses and dispatches commands.
- [`src/application.rs`](./src/application.rs) selects the effective executor.
- [`src/remote/runner.rs`](./src/remote/runner.rs) owns remote phase order.
- [`src/remote/contracts.rs`](./src/remote/contracts.rs) defines injected
  environment, Git, CLI, clock, script, log, signal and output boundaries.
- [`src/remote/cleanup.rs`](./src/remote/cleanup.rs) owns box state, captured run
  IDs, stop retries and final cleanup counts.
- [`src/remote/reporting.rs`](./src/remote/reporting.rs) formats error warnings
  with one copy of each module prefix.
- [`src/remote/process.rs`](./src/remote/process.rs) streams output and kills
  child process groups on interrupts.
- [`src/command.rs`](./src/command.rs) defines the injected command-runner
  boundary.
- [`src/child_environment.rs`](./src/child_environment.rs) defines the shared
  secret environment list for local commands, remote requests and helpers.
- [`src/check/request.rs`](./src/check/request.rs) validates suite, shard, and
  dependency audit selections before subprocesses start.
- [`src/check/commands.rs`](./src/check/commands.rs) defines the shared suite
  commands. [`src/check/runner.rs`](./src/check/runner.rs) runs them through
  injected process and file auditors.
- [`../scripts/verification/unit-selection.mjs`](../scripts/verification/unit-selection.mjs)
  validates developer test arguments before preparation checks;
  [`unit-execution.mjs`](../scripts/verification/unit-execution.mjs) shares
  Node execution and reporter evidence across complete and selected runs.
- [`../scripts/package/browser_graph_analysis.mjs`](../scripts/package/browser_graph_analysis.mjs)
  validates the delivered browser module graph;
  [`../scripts/package/consumer_cases`](../scripts/package/consumer_cases) and
  [`../scripts/package/imported_styles.mjs`](../scripts/package/imported_styles.mjs)
  own every clean packed-consumer smoke. The
  [consumer fixtures README](../tests/fixtures/consumers/README.md) states what
  each copied project tests.
- [`../scripts/verification/example-snapshot.mjs`](../scripts/verification/example-snapshot.mjs)
  produces, encodes, and decodes the example compilation snapshot, and
  [`example-snapshot-key.mjs`](../scripts/verification/example-snapshot-key.mjs)
  owns its path, source inventory, and freshness key;
  [`prepared.mjs`](../scripts/verification/prepared.mjs) checks that prepared
  output exists before a runner starts.
- [`../scripts/verification/repository-ratchets.mjs`](../scripts/verification/repository-ratchets.mjs)
  dispatches the repository ratchets, and
  [`../scripts/verification/ratchets/git.mjs`](../scripts/verification/ratchets/git.mjs)
  owns their merge-base workspace and reachable release-tag views.
- [`../scripts/verification/dependency-audit.mjs`](../scripts/verification/dependency-audit.mjs)
  runs strict and baseline audits. The scheduled workflow uses
  [`dependency-audit-pr.mjs`](../scripts/verification/dependency-audit-pr.mjs)
  to maintain the update pull request and preserve human commits.
- [`../scripts/verification/ratchets/typescript-length.mjs`](../scripts/verification/ratchets/typescript-length.mjs),
  [`protocol-caps.mjs`](../scripts/verification/ratchets/protocol-caps.mjs),
  [`internal-exports.mjs`](../scripts/verification/ratchets/internal-exports.mjs),
  and
  [`public-exports.mjs`](../scripts/verification/ratchets/public-exports.mjs)
  own the four policies.
  [`package-exports.mjs`](../scripts/verification/ratchets/package-exports.mjs)
  maps package export targets to source for both export audits, while
  [`public-export-surface.mjs`](../scripts/verification/ratchets/public-export-surface.mjs)
  expands relative star re-exports with the shared module resolver;
  [`module-commonjs.mjs`](../scripts/verification/ratchets/module-commonjs.mjs)
  and
  [`module-imports.mjs`](../scripts/verification/ratchets/module-imports.mjs)
  supply CommonJS export and import-use discovery, and
  [`unused-internal-exports.txt`](./unused-internal-exports.txt) is the sorted
  shrinking exception baseline.

### Related Docs

- [Repository README](../README.md)
- [CI and npm release contract](../docs/protocol/npm-release.md)
- [CI verification](../docs/protocol/ci-verification.md)
- [CI suite evidence](../docs/protocol/ci-suite-evidence.md)
- [CI example compilation snapshot](../docs/protocol/ci-example-snapshot.md)
- [Remote verification](../docs/protocol/remote-verification.md)
- [Testbox execution](../docs/protocol/remote-verification-testbox.md)
- [Dependency security](../docs/protocol/dependency-security.md)
- [Baseline dependency audit](../docs/protocol/dependency-audit-baseline.md)
- [Dependency update pull request](../docs/protocol/dependency-audit-update-pr.md)
