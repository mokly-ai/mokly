# Repository Gate And Length Audits

Continuation of [CI Verification](./ci-verification.md).

## Repository Boundary

The repository suite runs these checks in this order:

1. The live npm dependency audit, in baseline or strict mode. It reads only
   the lockfile and runs before any install, so the CI job installs no
   dependencies before the suite.
2. The root npm lockfile install.
3. The Rust advisory audit.
4. The [cargo-nextest preflight](#rust-test-runner).
5. The MIT dependency [boundary check](#dependency-boundary).
6. Whitespace checks on every Git-visible text file.
7. The generated TypeScript byte-identity check.
8. `npm run palette:check`, the drift check of the stylesheets that the
   `@mokly/ui` palette module generates.
9. The read-only source checks, in three lanes that run at the same time.
   Each lane runs its checks in order:
   - Prettier, once for the whole repository.
   - ESLint, once for the whole repository; the ast-grep rule tests and the
     Rust and npm source scan; the unit tests of the npm boundary and cloud
     skip validator; the changed-file source and protocol
     [length audit](#length-audits); and the four
     [repository ratchets](./verification-ratchets.md): JavaScript and
     TypeScript file length, protocol document caps, unused internal
     exports, and public package exports.
   - Rust formatting for every crate, Clippy with warnings denied for
     `mokly-*` and `xtask`, and Clippy with warnings denied for the
     `mokly-cli` `design-matrix` feature.
10. `cargo xtask build-native`, then the `@mokly/ui`, `@mokly/model`,
    `@mokly/frame`, `@mokly/viewer`, and `@mokly/mokly` builds, in that order.
11. The Rust tests of `mokly-*` and `xtask` with nextest, then their doc tests
    with `cargo test --doc`.
12. The Rust file-length audit of every crate and xtask.

A lane stops at its first failed check. The other lanes run to their end, so
one run reports each failed lane. The suite then fails with the first failure
in lane order and runs no later step. Each check prints a line when it starts.
When it ends, it prints its output as one block, so the output of different
lanes does not mix. No check of a lane
writes a file that a check of another lane reads. The lanes save about a
minute, because Prettier and ESLint each use one core while Clippy uses the
others. Faster tool modes were rejected: Prettier's experimental CLI reports
files that its standard CLI accepts.

The [cloud suites](./ci-verification.md#cloud-suites) own Clippy and tests for
`mkc-` crates. The whole-repository Markdown link test runs once in Viewer.
Whitespace rejects trailing spaces, trailing tabs, missing final newlines,
and final blank lines. One `git check-attr` call reads the attributes of every
file. `-text` preserves fixture bytes. `whitespace=-blank-at-eol` permits
trailing whitespace, and `-blank-at-eof` permits final blank lines. All other
checks still apply. Binary files are outside the whitespace check.

The suite compiles and lints the feature-gated design matrix target but does
not run it; the nightly
[Design Attribution Matrix](./ci-workflow.md#design-attribution-matrix) runs
it. Leaving that target to the nightly run alone was rejected, because a
compile error then stays hidden until the nightly run fails.

The [baseline audit contract](./dependency-audit-baseline.md#xtask-and-ci-selection)
selects the npm audit mode and defines its comparison rules. Report, input,
and registry errors fail in both modes. Reviewed path and expiry rules follow
[Dependency Security](./dependency-security.md#reviewed-workspace-exceptions).

The Rust audit follows [Dependency Security](./dependency-security.md#rust-advisory-audit).
It fails on vulnerabilities and audit errors in both npm audit modes.

Generated TypeScript must match the Rust-owned types byte for byte. Missing,
changed, or extra generated files fail the repository suite and its CI job.
The check writes no files. Authors regenerate and commit changed output.

The repository and native suites build the host native package and the five
JavaScript packages in the order of item 10 before the Mokly Rust tests. The
real sidecar smoke tests and the `xtask` fixtures that run the workspace
`mokly` command require these fresh outputs on every host, including a clean
checkout.

Every xtask subprocess starts at the workspace root, even when xtask starts
elsewhere.

## Suite Shards

The repository and native suites accept `--shard INDEX/TOTAL`. No shard, or
one shard of one, runs the complete suite. With two or more shards, each
shard runs one test partition of the [test unit rule](#test-units):

- Repository shard 1 runs every item of the
  [repository list](#repository-boundary) except the cargo-nextest
  preflight, the builds of item 10, and the Rust tests of item 11. Repository
  shard `k`, from 2, runs test partition `k - 1` of `TOTAL - 1`.
- Native shard 1 checks Rust formatting, runs Clippy, and runs test partition
  1 of `TOTAL`. Native shard `k`, from 2, runs test partition `k` of `TOTAL`.
- Test partition 1 of two or more is the library shard. It runs only the
  preflight, the library unit tests, and the doc tests. These read no npm
  package and no native binary, so it runs no npm install and none of the
  builds of item 10. On `main` it builds the native binary before its Rust
  build cache saves, so the saved entry stays complete.
- Every other test partition runs the preflight and the builds of item 10,
  then its share of the units. A repository test shard first installs the
  root npm lockfile. A native test partition keeps the `--no-fail-fast`
  behaviour of the complete native suite, and native shard 1 also runs its
  tests after a failed check.

The shards of a suite together run every check and every test once. Decision:
the repository checks run on their own shard, so no test shard waits for them.
Native shard 1 runs the checks with the library shard, because both read no
npm package and ended about 3 minutes early, and macOS runs at most five jobs
at a time. Rejected for the repository suite: its checks shard keeps its own
Rust cache entry, and one job cannot keep two entries. Rejected: one test
build per platform in a `cargo nextest archive` that the test shards download.
The test shards would wait for that build, its upload, and its download.

### Native Test Scope

The Native suite leaves out a reviewed list of platform-neutral Rust tests.
The Repository suite still runs every Rust test on Linux, and the Native
suite runs every doc test. The list excludes; a new test runs on every
platform until a change adds it to the list. A test stays in the Native
suite when it touches paths, links, file names or their case, line endings,
processes and signals, file watching, sockets and ports, stack depth,
temporary folders, Git subprocesses, the sidecar Node process, or locks.
Every test of `mokly-platform`, `mokly-git`, `mokly-sidecar`, `mokly-watch`,
`mokly-catalogue`, `mokly-static`, and `mokly-server` stays. A test leaves
only when it checks pure logic, such as Changes classification, CSS
attribution, the catalogue model, HTML repair, or scale counts. When in doubt,
the test stays. A test unit that the list leaves out as a whole is not built.
Decision: an exclude list, because an include list would run new platform
code on Linux only.

### Test Units

A test unit is one Cargo target selection: `--lib` for the unit tests of
every library, `--bin {name}`, or `--test {name}`. A unit holds every
selected target with that kind and name. The units cover each target of
`mokly-*` and `xtask` that the complete nextest run selects: each target
with tests whose required features Cargo's resolved features enable. The
test shards read the targets and the features from `cargo metadata`, so a
new crate or a new test lands on a shard without an edit.

The first test shard runs `--lib` with the doc tests. Their builds need every
crates.io dependency of the Rust tests, so only this shard saves the Rust
build cache of its job. With two or more test shards, it runs no other unit.
The other units go to the other test shards by weight, the heaviest first,
each to the shard with the least weight so far. Decision: keep `--lib` whole
on a shard without builds. Rejected: a `--lib` slice by crate on each shard,
because `-p "mokly-*" -p xtask --lib` builds every library test binary, 85 to
112 seconds on the native hosts, on each shard that runs a slice.
`scripts/verification/rust-test-weights.json` holds the measured compile
seconds of each unit, the measured test seconds of each unit on each CI host,
a default for a unit that it does not name, and the doc test weight of the
first test shard. Each host places its units by its own test seconds. The
weight file can split a heavy unit other than `--lib` into nextest slices,
`--partition slice:{k}/{n}` of that unit alone. Each slice goes to a shard
like a unit, and the shard runs it in its own nextest command, so every test
of the unit runs exactly once. The same units and weights give the same
partition on every run of a host. Decision: keep test seconds for each host,
because one mean over the hosts left one Windows test shard about 3 minutes
slower than the others. A weight changes only the balance, never the set of
tests. A shard without units runs no nextest command.

Each test shard selects `-p "mokly-*" -p xtask` and adds the target
arguments of its units, so it compiles only the test binaries of its units.
Decision: shard by test target, not by `--partition`, because every
partition shard compiled every test binary. Rejected: one `-p` crate set
for each shard. It changed the resolved features of up to 27 crates.io
dependencies, so the shards could not share one Rust build cache.

## Rust Test Runner

The Repository, Native, and cloud Rust suites run their Rust tests with
[cargo-nextest](https://nexte.st). Nextest runs each test in its own process
and runs the test binaries of all selected crates in parallel. Then
`cargo test --doc` runs the doc tests of the same crates, because nextest
does not run doc tests. A test shard runs its test units under the
[shard rule](#suite-shards). Native passes `--no-fail-fast` to both commands.
Cloud Rust sets `CI=1` for both and rejects their reported skips.

The repository, native, and Testbox jobs, and the Workspace checks
partitions that run cloud Rust or the toolchain pins, install the
pinned nextest version as a prebuilt binary with `taiki-e/install-action`,
right after the Rust build cache restore.
`.config/nextest.toml` requires at least that version. The Repository, Native,
and cloud Rust suites run `xtask/scripts/require-nextest.mjs` before their Rust
builds. When
`cargo nextest` is missing or older than the requirement, the preflight fails
and prints `cargo install cargo-nextest --locked --version {version}` and the
prebuilt binary page. In Native, the doc tests also run after failed nextest
tests, so one job reports both kinds of failure.

An in-process lock reaches no other test process. Tests that share a fixed
fixture parent or a database budget therefore run in a one-thread nextest
test group: the plan fixture tests of `mokly-render` and the billing and
GitHub scenarios of `mkc-api`. A new user of such a fixture joins its group.

Decision: the gate uses nextest. Rejected: `cargo test`, which runs one test
binary at a time and leaves cores idle while one binary finishes.

## Dependency Boundary

No `mokly-*` crate and no `xtask` depends on an `mkc-` crate. The check reads
Cargo metadata and covers normal, dev, build, target-specific, and renamed
dependencies.

No MIT package under `packages/` depends on a cloud npm project: a project
under `apps/`, or `packages/app/`, `packages/desktop/`, or `packages/tokens/`.
The check covers normal, dev, peer, and optional manifest dependencies. It
also checks source imports, exports, dynamic imports, CommonJS requests, and
type imports. Relative paths and TypeScript aliases cannot cross the boundary.
`packages/tokens/` is a cloud package and may use cloud code.

The cloud-owned `stripe-catalogue` binary may depend on cloud crates. Its
xtask entry point starts it as a subprocess. Xtask has no cloud crate dependency.

## Length Audits

The changed-file length audit checks the files changed against fetched
`origin/main`, plus working-tree and untracked files. It covers every
repository TypeScript and JavaScript file (`.ts`, `.tsx`, `.js`, `.jsx`,
`.mjs`, `.cjs`, `.mts`, `.cts`) and the Markdown under `docs/protocol`. There
are no directory exclusions beyond Git-ignored untracked files. Tracked files
remain in scope. During an uncommitted merge, the audit compares the resolved
tree with `origin/main`. Outside a merge, it uses the branch-point diff and the
working-tree changes.

Source modules have a 300-line limit. Protocol pages have a 250-line limit or
their exact reviewed cap in `xtask/protocol-document-caps.json`. When that file
is absent, every protocol page has the 250-line limit. The
[protocol document cap ratchet](./verification-ratchets.md#protocol-document-caps)
defines the cap table. `cargo xtask source-file-length-lint` runs this audit
alone. Use `--all` to audit every scoped file instead of only the changed set.

The Rust file-length audit checks every Rust file under `xtask/` and `crates/`
on every run. Each file has a 300-line limit, with no ratchet and no override.
`cargo xtask rust-file-length-lint` runs it alone. A finding fails the suite
like a failed command.

## ESLint Rules

ESLint carries the repository's source-level rules beyond style. The local
`mokly` plugin provides `no-directory-literals` for Mokly-owned directory
names, `no-artifact-path-literals` for comparison artifact paths under the
[artifact path contract](./mokly-artifact-paths.md), and
`no-late-fixture-teardown` and `no-eager-fixture-setup` for test fixture
ownership under [CI suite evidence](./ci-suite-evidence.md). The
[test-timing guard](./ci-test-timing.md#eslint-guard) is also an ESLint rule.
A rule that must scan every file belongs here, in `npm run lint`, not in a Node
test.
