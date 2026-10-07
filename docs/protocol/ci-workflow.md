# CI Workflow Graph

## Delivery Status

Implemented. CI selects baseline or strict mode by event and pull request.
The Dependency Audit workflow maintains strict findings on `main`.

## Workflow Boundary

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It has
read-only repository contents permission and cancels superseded workflow runs.
The repository job is every verification job's shared prerequisite and runs the
audit-first repository suite. The [baseline audit contract](./dependency-audit-baseline.md)
sets `DEPENDENCY_AUDIT` to `baseline` for ordinary pull requests and every push.
It sets `strict` for same-repository dependency update and Release Please pull
requests. The suite receives `--dependency-audit "$DEPENDENCY_AUDIT"`.
Fork branch names and labels cannot select strict mode.

The baseline audit for a push to `main` compares the pushed commit with itself.
It fails only on audit errors (report, input, or registry). The daily strict
audit and the strict release audit own new advisories on `main`.

`.github/workflows/dependency-audit.yml` runs a daily off-hour
strict audit on `main` and supports manual dispatch. Its write permissions,
JSON report, token, branch, and create, refresh, and close behavior follow the
[dependency update pull request contract](./dependency-audit-update-pr.md).

The repository job's full-history checkout uses `fetch-depth: 0`. It must fetch
release tags for the public-package-export ratchet, plus `origin/main` and
enough history for merge-base ratchets and the baseline dependency audit.
The baseline audit reads the root manifest, lockfile, and exception file from
that comparison commit. The same-repository Preview deployment resolves
`origin/main` for its branch comparison and branch-point lockfile. The package, unit, browser, and
hydration jobs keep complete history for fixture-owned historical baselines but
never read remote-tracking references.

Each downstream job starts from a fresh checkout and owns its writable build,
example, fixture, report, and trace output. No job receives a live checkout or
writable build directory from another job.

## Runtime Profiles

For ordinary pull requests and pushes to `main`, the workflow fans out to:

- one package job on Node 22.14.0;
- four unit shards on Node 22.14.0;
- four browser shards and one unsharded hydration job on Node 22.14.0; and
- native jobs on macOS and Windows at Node 22.14.0.

For a same-repository Release Please pull request, the package job, every unit
and browser shard, and the hydration job also run on Node 24. A release pull
request selects this profile only when its head repository is this repository
and either its head ref starts with `release-please--` or it has an
`autorelease:` label. A fork cannot opt into the more expensive profile by
choosing a matching branch name.

The repository job resolves floating Node 24 once. An explicit shell step reads
`process.versions.node` and exposes that exact version, the selected matrix, and
the report-runtime identities as job outputs. Every package, unit, browser, and
hydration job selected for Node 24, plus `Required CI`, requests the captured
version. Matrix labels and report runtime identities remain `node-24`; reports
still record the exact installed version. The aggregate rejects mixed versions
within a group. The setup action itself does not provide the installed version
output.

Node 22.14 is the ordinary functional runtime because it is the package's
declared minimum. The Node 24 repository prerequisite still runs on every event.
A Node 24-only regression can therefore reach unreleased `main`, but the
dual-runtime Release Please gate must catch it before versions, tags, or npm
artifacts can be published. Release Please normally updates its pull request
after a releasable merge, keeping that feedback close to the originating change
without paying for both functional profiles on every ordinary event.

The supported range is Node.js `>=22.14.0 <24.14.0` or `>=24.19.0`. Node 24.14.0
through 24.18.x can abort concurrent ESM-to-CommonJS loading before JavaScript
can handle an error. The upstream
[`cjs_lexer::Parse` empty-`MaybeLocal` fix](https://github.com/nodejs/node/pull/63885)
shipped in Node 24.19.0. Lazy-loading individual dependencies reduces exposure
but cannot remove this process-wide parser path, so the CLI rejects affected
versions before loading its application modules.

Local verification uses the supported floor at 22.14.0 and Node 24.21.0. These
are tested representatives rather than the bounds of the supported range. The
repository's `.nvmrc` and preview workflow remain pinned to 24.21.0. CI
resolves the latest Node 24 patch once per run, while publishing resolves its
own latest patch. The dependency-free CLI bootstrap owns the support bounds and
local tested-version list. Tests keep them aligned with package engines, the
lockfile, README, `.nvmrc`, and the event-selected runtime profiles.

## Job Execution

Matrix jobs use `fail-fast: false`, so one failing shard does not erase evidence
from its peers. Chromium is installed only in browser and hydration jobs. Rust
formatting, Clippy, and tests run only in the repository job; selected suite
jobs still compile xtask to dispatch their gate.

Every npm-running CI job installs npm 11.21.0, the exact `packageManager`
version in `package.json`, and runs `npm ci`. The scheduled audit installs no
dependencies before its strict lockfile-only audit; updates use
`npm ci --ignore-scripts` and `npm update <package> --ignore-scripts`. CI
caches only npm downloads. Every cached CI job keys npm's download cache from
the checked-out `package-lock.json`. Only the repository audit reads a
comparison-commit lockfile, for baseline evaluation rather than a cache key. The
[deterministic repository-input rule](./ci-verification.md#deterministic-test-repository-inputs)
and [cache and security semantics](./ci-verification-security.md#dependency-cache-and-security)
own these boundaries.

Make every lockfile change with the pinned npm. The pin must stay at npm 11.11.0
or newer: older versions drop the lockfile's `libc` fields, which select the
glibc or musl build of a native package
([npm/cli#9025](https://github.com/npm/cli/pull/9025)). Without those fields,
`npm ci` on Linux installs both builds.
[`tests/npm_pin.test.ts`](../../tests/npm_pin.test.ts) keeps every workflow
npm pin equal to `packageManager`, requires CI and release jobs to set up that
npm before `npm ci`, and rejects pins older than npm 11.11.0.

Linux and Windows jobs across CI, preview, release, and Dependency Audit workflows use
Blacksmith's 2-vCPU tiers. Native macOS verification uses the provider's
smallest available tier, which is 6 vCPUs. The one exception is any job that
publishes to npm with trusted publishing, today only the release `publish` job:
it runs on GitHub-hosted `ubuntu-24.04` with `actions/checkout`, because npm
creates provenance only on GitHub-hosted runners and rejects a publish from a
self-hosted runner such as Blacksmith. `tests/workflow_runner_sizes.test.ts`
enforces both rules. Every job in `ci.yml` has a 30-minute execution timeout.

Action revisions are immutable commit hashes with reviewed version comments,
runtime versions are explicit, and fork pull requests receive no release secrets
or write permissions.

## Required CI

The stable `Required CI` branch-rule status uses `if: always()` and fails closed
unless every prerequisite result is exactly `success`. It validates the report
aggregate against the runtime profile emitted by the repository job: nine
unit/browser/hydration reports for ordinary events and eighteen for a Release
Please pull request.

A failed, skipped, cancelled, absent, duplicated, wrong-runtime, wrong-shard,
wrong-commit, unsupported-profile, missing, or extra report fails the aggregate.
The aggregate never infers success from a matrix job's presence alone.

Stable report artifact names allow a failed-job rerun to replace its own report
while retaining successful sibling reports from an earlier attempt. A complete
workflow rerun replaces all report artifacts. Browser and hydration failure
artifacts remain attempt-specific.

The [CI verification contract](./ci-verification.md) defines suite ownership,
report completeness, caching, and failure semantics. The
[release verification evidence contract](./npm-release-evidence.md) defines when
the dual-runtime aggregate can prove an immutable release tree.

## Testbox Workflow Target

The [Blacksmith remote verification plan](../../plans/blacksmith-remote-verification.md)
approves `.github/workflows/blacksmith-testbox.yml`. The workflow is implemented.
Validation mode and both box suite smoke checks pass.
The complete explicit remote check also passes.
The workflow has `workflow_dispatch` with an optional `testbox_id` input.
It also has `push` with `branches: ["**"]` and a path filter for its own
workflow file. Branch pushes must match both filters. Tag pushes do not run it.
An empty `testbox_id` makes `begin-testbox` use validation mode.
The push run registers the workflow before merge.

One job runs on `blacksmith-2vcpu-ubuntu-2404` with a 30-minute timeout.
It has `contents: read` permission and no secrets.
It checks out full history with `persist-credentials: false`.
It prepares Node 22.14.0, npm 11.21.0, Rust 1.95.0 and Chromium.
It records the installed lockfile digest and exposes the job environment to
Testbox SSH sessions. `run-testbox` keeps the job alive until the idle timeout.

The workflow pins `useblacksmith/checkout` v1, `useblacksmith/begin-testbox` v2,
`actions/setup-node` v6.5.0 and `useblacksmith/run-testbox` v2 to reviewed commits.
The [Testbox workflow contract](./remote-verification-testbox.md#workflow)
defines the exact revisions and step order. `Required CI` does not depend on
this workflow. The hosted CI graph and its release profile keep their current
required jobs.

## Related Docs

- [Protocol index](./README.md)
- [CI verification](./ci-verification.md)
- [Remote verification](./remote-verification.md)
- [CI and npm release](./npm-release.md)
- [Release verification evidence](./npm-release-evidence.md)
