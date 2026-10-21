# CI Workflow Graph

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Workflow Boundary

`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual
`workflow_dispatch` for any branch. A manual run uses the selected branch's
workflow file, which must include that trigger. The workflow has read-only
repository contents permission and cancels superseded runs.
The repository job is every verification job's shared prerequisite and runs the
audit-first repository suite. The
[baseline audit contract](./dependency-audit-baseline.md) sets
`DEPENDENCY_AUDIT` to `baseline` for ordinary pull requests, every push,
and every manual dispatch. It
sets `strict` for same-repository dependency update and Release Please pull
requests. The suite receives `--dependency-audit "$DEPENDENCY_AUDIT"`. Fork
branch names and labels cannot select strict mode.

The baseline audit for a push to `main` compares the pushed commit with itself.
It fails only on audit errors (report, input, or registry). The daily strict
audit and the strict release audit own new advisories on `main`.

`.github/workflows/dependency-audit.yml` runs a daily off-hour strict audit on
`main` and supports manual dispatch. Its write permissions, JSON report, token,
branch, and create, refresh, and close behavior follow the
[dependency update pull request contract](./dependency-audit-update-pr.md).
It also runs the Rust advisory audit, even when the npm audit or its update
automation fails. That audit reports Rust findings without changing a branch.

The repository job's full-history checkout uses `fetch-depth: 0`. It must fetch
release tags for the public-package-export ratchet, plus `origin/main` and
enough history for merge-base ratchets and the baseline dependency audit. The
baseline audit reads the root manifest, lockfile, and exception file from that
comparison commit. The same-repository preview deployment resolves
`origin/main` as the comparison base of its pull request build. The viewer,
browser, and native jobs check out full history but never read remote-tracking
references. Shared browser example servers use the intentionally unresolved
base `refs/mokly/browser-suite-no-base`. Real Changes specs own Git fixtures.

Each downstream job starts from a fresh checkout and owns its writable build,
report, and trace output. No job receives a live checkout or writable build
directory from another job.

## Runtime Profiles

For ordinary pull requests, pushes to `main`, and manual dispatch, the workflow fans out to:

- one viewer job on Node 22.15.0;
- four browser shards on Node 22.15.0;
- one static-delivery job on Node 22.15.0; and
- native jobs on macOS and Windows at Node 22.15.0.

For a same-repository Release Please pull request, the viewer job and every
browser shard and static-delivery job also run on Node 24. A release pull request selects this profile
only when its head repository is this repository and either its head ref
starts with `release-please--` or it has an `autorelease:` label. A fork cannot
opt into the more expensive profile by choosing a matching branch name.

The repository job resolves floating Node 24 once. An explicit shell step reads
`process.versions.node` and exposes that exact version, the selected matrix,
and the report-runtime identities as job outputs. Every viewer and browser job
selected for Node 24, plus `Required CI`, requests the captured version. Matrix
labels and report runtime identities stay `node-24`; reports record the exact
installed version. The aggregate rejects mixed versions within a group. The
setup action itself does not provide the installed version output.

Node 22.15 is the ordinary functional runtime because it is the package's
declared minimum. The Node 24 repository prerequisite runs on every event. A
Node 24-only regression can therefore reach unreleased `main`, but the
dual-runtime Release Please gate must catch it before versions, tags, or npm
artifacts can be published. Release Please normally updates its pull request
after a releasable merge, keeping that feedback close to the originating change
without paying for both functional profiles on every ordinary event.

The [package contract](./mokly-package.md#node-support) defines supported Node
versions and exclusions. CI runtime representatives do not change that range.

Local verification uses the supported floor at 22.15.0 and Node 24.21.0. These
are tested representatives rather than the bounds of the supported range. The
repository's `.nvmrc` and the preview workflow are pinned to 24.21.0. CI
resolves the latest Node 24 patch once per run, while publishing resolves its
own latest patch. The dependency-free shim owns the support bounds and the
local tested-version list. Tests keep them aligned with the package engines, the
lockfile, the README, `.nvmrc`, and the event-selected runtime profiles.

## Job Execution

Matrix jobs use `fail-fast: false`, so one failing shard does not erase evidence
from its peers. Chromium is installed only in browser jobs. Every job that runs
the binary builds it for its host from `rust-toolchain.toml`; Rust formatting,
Clippy, and the complete Rust tests run in the repository job and in the native
jobs. Every cargo-running CI and release job runs `rustup toolchain install`
before cargo. rustup installs the `rust-toolchain.toml` pin, Rust 1.95.0 with
rustfmt and Clippy, and that file selects the toolchain for every cargo command
in the checkout.

Every npm-running CI job installs npm 11.21.0, the exact `packageManager`
version in `package.json`, and runs `npm ci`. The scheduled audit installs no
dependencies before its strict lockfile-only audit; updates use
`npm ci --ignore-scripts` and `npm update <package> --ignore-scripts`. CI
caches only npm downloads. Every cached CI job keys npm's download cache from
the checked-out `package-lock.json`. Only the repository audit reads a
comparison-commit lockfile, for baseline evaluation rather than a cache key. The
[deterministic repository-input rule](./ci-verification.md#deterministic-test-repository-inputs)
and
[cache and security semantics](./ci-verification-security.md#dependency-cache-and-security)
own these boundaries.

Make every lockfile change with the pinned npm. The pin must stay at npm 11.11.0
or newer: older versions drop the lockfile's `libc` fields, which select the
glibc or musl build of a native package
([npm/cli#9025](https://github.com/npm/cli/pull/9025)), and the
`@mokly/native-<target>` packages depend on that selection. A tooling test
keeps every workflow npm pin equal to `packageManager`, requires CI and release
jobs to set up that npm before `npm ci`, and rejects pins older than npm
11.11.0.

Linux and Windows jobs across the CI, preview, release, and Dependency Audit
workflows use Blacksmith's 2-vCPU tiers, except the design matrix below. macOS jobs use the provider's smallest
available tier, which is 6 vCPUs. The publishing exception is any job that publishes
to npm with trusted publishing, the release `publish` job: it runs on
GitHub-hosted `ubuntu-24.04` with `actions/checkout`, because npm creates
provenance only on GitHub-hosted runners and rejects a publish from a
self-hosted runner such as Blacksmith. A tooling test enforces both rules.
A second, narrow exception permits only the release matrix's `darwin-x64`
build on GitHub-hosted `macos-26-intel`, with `actions/checkout`. Blacksmith's
macOS hosts are ARM64. This row keeps native Intel build and execution coverage;
it has no npm publishing permission. Every other native release row follows
the Blacksmith size rule. Browser shards, static-delivery jobs, and native jobs have a 60-minute
execution timeout. The other CI jobs keep a 30-minute timeout. These limits
are hang guards, not speed requirements. Each limit must allow at least three
times the job's typical duration, including setup and builds. The longer
limits preserve the four browser shards without reducing test coverage.

Action revisions are immutable commit hashes with reviewed version comments,
runtime versions are explicit, and fork pull requests receive no release
secrets or write permissions.

## Required CI

The stable `Required CI` branch-rule status uses `if: always()` and fails closed
unless every prerequisite result is exactly `success`. It validates the report
aggregate against the runtime profile emitted by the repository job: five
viewer and browser reports for ordinary events and ten for a Release Please
pull request.

Static delivery is also required. It builds the example with Changes disabled
and checks portable design journeys through static HTTP and `file://`.
Both modes require every assigned test to pass once. Empty discovery, skips,
duplicate results, missing results, and reporter errors fail the job.
Its reports stay separate from the five- or ten-report suite aggregate.

Required CI is a report aggregator. It checks out the validator and installs
Node. It needs no npm dependencies or Rust build.

A failed, skipped, cancelled, absent, duplicated, wrong-runtime, wrong-shard,
wrong-commit, unsupported-profile, missing, or extra report fails the aggregate.
The aggregate never infers success from a matrix job's presence alone.

Stable report artifact names allow a failed-job rerun to replace its own report
while keeping successful sibling reports from an earlier attempt. A complete
workflow rerun replaces all report artifacts. Browser failure artifacts are
attempt-specific and include `.context/playwright-results/`.

The [CI verification contract](./ci-verification.md) defines suite ownership,
report completeness, caching, and failure semantics. The
[release verification evidence contract](./npm-release-evidence.md) defines when
the dual-runtime aggregate can prove an immutable release tree.

## Design Attribution Matrix

`.github/workflows/design-attribution.yml` runs nightly and through manual
`workflow_dispatch`. It runs the `design-matrix` Cargo target on
`blacksmith-8vcpu-ubuntu-2404` after building the workspace. It has a 120-minute
job timeout and a separate 90-minute test-process hang guard with a 30-second
termination grace period. Both guards must allow at least three times typical
duration. Each run saves its source tree and duration log as an artifact.
This workflow is optional. `Required CI` does not depend on it.

## Testbox Workflow Target

The [remote verification contract](./remote-verification.md) defines
`.github/workflows/blacksmith-testbox.yml`. The workflow has `workflow_dispatch`
with an optional `testbox_id` input. It also has `push` with `branches: ["**"]`
and a path filter for its own workflow file. Branch pushes must match both
filters. Tag pushes do not run it. An empty `testbox_id` makes `begin-testbox`
use validation mode. The push run registers the workflow before merge.

One job runs on `blacksmith-2vcpu-ubuntu-2404` with a 30-minute timeout. It has
`contents: read` permission and no secrets. It checks out full history with
`persist-credentials: false`. It prepares Node 22.15.0, npm 11.21.0, Rust
1.95.0 from `rust-toolchain.toml`, and Chromium. It records the installed
lockfile digest after `npm ci` and `cargo xtask build-native` both succeed.
The native build precedes the lockfile stamp. It exposes the job environment
to Testbox SSH sessions.
`run-testbox` keeps the job alive until the idle timeout.

The workflow pins `useblacksmith/checkout` v1, `useblacksmith/begin-testbox` v2,
`actions/setup-node` v6.5.0 and `useblacksmith/run-testbox` v2 to reviewed
commits. The
[Testbox workflow contract](./remote-verification-testbox.md#workflow) defines
the exact revisions and step order. `Required CI` does not depend on this
workflow. The hosted CI graph and its release profile keep their required jobs.

## Workflow Verification

Tooling tests under `tests/` verify workflow files by their properties and by
running their scripts. The policy test requires every `uses:` revision across
the workflows and composite actions to be a 40-character lowercase commit. It
forbids untrusted pull request fields in `ci.yml` `run:` steps and `${{` in
Dependency Audit `run:` steps. It requires a full-history checkout in every CI
and preview job that installs dependencies. It keeps the viewer and browser
jobs on the checked-out lockfile. It checks that `.nvmrc`, the package and
lockfile engines, and the README agree with the shim's tested Node versions and
supported range. It checks that the Testbox Node.js version matches the CI
native job and that the Testbox npm and Rust steps match the CI repository job.
The [repository input contract](./ci-test-repository-inputs.md) describes its
example server check.

The script test executes the Node profile selector with and without a release
pull request and derives the expected outputs from the shim's tested Node
versions and the release evidence runtimes. It also executes the Testbox
lockfile stamp and the Testbox environment step on Linux hosts with controlled
inputs and asserts their outputs. It executes the release workflow's complete
verification step in a temporary Git checkout, with a newer `GITHUB_SHA` and a
stub `cargo`, and asserts that the gate receives the checked-out commit.

The `Required CI` guard, remote-state, pull request title, npm pin, release
evidence, and runner size tests keep their property checks. The policy and
script tests assert no literal job names, step order, matrix values, or run
strings; review owns those.

## Related Docs

- [Protocol index](./README.md)
- [CI verification](./ci-verification.md)
- [Remote verification](./remote-verification.md)
- [CI and npm release](./npm-release.md)
- [Release verification evidence](./npm-release-evidence.md)
