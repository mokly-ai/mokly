# CI Workflow Graph

## Workflow Boundary

`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual
`workflow_dispatch` for any branch. A manual run uses the selected branch's
workflow file, which must include that trigger. The workflow has read-only
repository contents permission and cancels superseded runs.
The runtime profile job is every verification job's only prerequisite, so the
repository job's audit-first suite runs in parallel with the others. The suite
receives `--dependency-audit "$DEPENDENCY_AUDIT"`, and the
[baseline audit contract](./dependency-audit-baseline.md#xtask-and-ci-selection)
selects that mode for each event.

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
references, under the
[repository input contract](./ci-test-repository-inputs.md). Every CI and
preview job that installs dependencies checks out full history with
`fetch-depth: 0`.

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

The runtime profile job resolves floating Node 24 once per run and publishes
that exact version, the selected matrix, and the report-runtime identities as
job outputs. The repository job, `Required CI`, and every viewer, browser, and
static-delivery job selected for Node 24 install that exact version. Matrix
labels and report runtime identities stay `node-24`; reports record the exact
installed version. The aggregate rejects mixed versions within a group.

Node 22.15 is the ordinary functional runtime because it is the package's
declared minimum. The Node 24 repository job runs on every event. A
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
own latest patch. The shim's supported range and its tested-version list must
agree with the package engines, the lockfile, the README, `.nvmrc`, and the
event-selected runtime profiles.

## Job Execution

Matrix jobs use `fail-fast: false`, so one failing shard does not erase evidence
from its peers. Chromium is installed only in the browser and static-delivery
jobs. Every job that runs
the binary builds it for its host from `rust-toolchain.toml`; Rust formatting,
Clippy, and the complete Rust tests run in the repository job and in the native
jobs. Native jobs build the checked-out `@mokly/mokly` sidecar package after
`npm ci`, so Rust integration tests use matching sidecar sources. Every
cargo-running CI and release job runs `rustup toolchain install`
before cargo. rustup installs the `rust-toolchain.toml` pin, Rust 1.95.0 with
rustfmt and Clippy, and that file selects the toolchain for every cargo command
in the checkout.
Native jobs run workspace tests with `--no-fail-fast` so one job reports every
failing test binary.

Every npm-running CI job installs npm 11.21.0, the exact `packageManager`
version in `package.json`, and runs `npm ci`. The scheduled audit installs no
dependencies before its strict lockfile-only audit; updates use
`npm ci --ignore-scripts` and `npm update <package> --ignore-scripts`. CI
caches npm downloads and Rust dependency builds. Every cached CI job keys npm's
download cache from the checked-out `package-lock.json`. Only the repository
audit reads a comparison-commit lockfile, for baseline evaluation rather than a
cache key. The
[deterministic repository-input rule](./ci-verification.md#deterministic-test-repository-inputs)
and [cache and security semantics](./ci-verification-security.md#dependency-cache-and-security)
own these boundaries.

Make every lockfile change with the pinned npm. The pin must stay at npm 11.11.0
or newer: older versions drop the lockfile's `libc` fields, which select the
glibc or musl build of a native package
([npm/cli#9025](https://github.com/npm/cli/pull/9025)), and the
`@mokly/native-<target>` packages depend on that selection. Every workflow npm
pin equals `packageManager`. CI and release jobs set up that npm before
`npm ci`.

Linux and Windows jobs across the CI, preview, release, native bootstrap, and
Dependency Audit workflows use Blacksmith's 2-vCPU tiers, except the design
matrix below and the CI Windows native job. That job uses 8 vCPUs, because on
2 vCPUs its complete Rust build and test run is usually the slowest CI job.
macOS jobs use the provider's smallest available tier, which is 6 vCPUs. The publishing exception is any job that publishes
to npm with trusted publishing, the release `publish` job: it runs on
GitHub-hosted `ubuntu-24.04` with `actions/checkout`, because npm creates
provenance only on GitHub-hosted runners and rejects a publish from a
self-hosted runner such as Blacksmith.
A second, narrow exception permits only the `darwin-x64` row of the release,
release-check, and native bootstrap build matrices on GitHub-hosted
`macos-26-intel`, with `actions/checkout`. Blacksmith's
macOS hosts are ARM64. This row keeps native Intel build and execution coverage;
it has no npm publishing permission. Every other native build row follows
the Blacksmith size rule.

In the CI workflow, the repository job has a 75-minute timeout and each viewer
job has a 40-minute timeout. Browser shards, static-delivery jobs, and native
jobs have a 60-minute timeout. `Required CI` has a 30-minute timeout. Job
timeouts are hang guards, not speed requirements. Each limit must allow at
least three times the job's typical duration, including setup and builds. The
longer limits preserve the four browser shards without reducing test coverage.

Action revisions are immutable 40-character lowercase commit hashes with
reviewed version comments, in every workflow and composite action. Runtime
versions are explicit, and fork pull requests receive no release secrets or
write permissions. No `run:` step in `ci.yml` interpolates an untrusted pull
request field. The `run:` steps of the Dependency Audit and native bootstrap
workflows contain no `${{` expression.

## Required CI

The stable `Required CI` branch-rule status uses `if: always()` and fails closed
unless every prerequisite result is exactly `success`. It validates the report
aggregate against the runtime profile job's selection: five
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
`workflow_dispatch`. It runs the `design_attribution_tests` test target of
`mokly-cli` with the `design-matrix` Cargo feature on
`blacksmith-8vcpu-ubuntu-2404` after building the workspace. It has a 120-minute
job timeout and a separate 90-minute test-process hang guard with a 30-second
termination grace period. Both guards must allow at least three times typical
duration. Each run saves its source tree ID and its timed test log as an
artifact. This workflow is optional. `Required CI` does not depend on it.

## Testbox Workflow Target

`.github/workflows/blacksmith-testbox.yml` prepares the Testboxes of the
[remote verification contract](./remote-verification.md). The
[Testbox workflow contract](./remote-verification-testbox.md#workflow) defines
its triggers, job, step order, and action revisions. Its Node.js version equals
the version of the CI native jobs. Its npm and Rust setup equals the setup of
the CI repository job. `Required CI` does not depend on this workflow. The
hosted CI graph and its release profile keep their required jobs.

## Related Docs

- [Protocol index](./README.md)
- [CI verification](./ci-verification.md)
- [Remote verification](./remote-verification.md)
- [CI and npm release](./npm-release.md)
- [Release verification evidence](./npm-release-evidence.md)
