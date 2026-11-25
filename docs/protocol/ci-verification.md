# CI Verification

## Verification Boundary

`cargo xtask check` is the complete repository gate. The local
executor runs the local suites sequentially in one checkout. Native runs only
when selected. The local gate starts with the live workspace dependency audit.
[Baseline auditing](./dependency-audit-baseline.md#xtask-and-ci-selection)
owns the `--dependency-audit` modes and their selection in CLI and CI. The
complete gate can instead run on Testboxes under the
[remote verification contract](./remote-verification.md). Only active reviewed exceptions cover findings.
[Dependency security](./dependency-security.md) defines their UTC expiry and
31-day limit. A selected suite is partial evidence. CI's validated aggregate is complete
evidence for its exact tree.
[Release evidence](./npm-release-evidence.md) defines reuse.

```bash
cargo xtask check
cargo xtask check --dependency-audit strict
cargo xtask check --suite repository
cargo xtask check --suite viewer
cargo xtask check --suite viewer --shard 1/2
cargo xtask check --suite native
cargo xtask check --suite browser
cargo xtask check --suite browser --shard 1/10
```

`--shard INDEX/TOTAL` is valid with `viewer`, `browser`, and `cloud-app`. Both values are one-based
positive integers no larger than JavaScript's maximum safe integer, and
`INDEX` must not exceed `TOTAL`. A Mokly viewer or browser shard runs one weighted whole-file
partition under the [viewer](./ci-suite-evidence.md#viewer-shard-balance) or [browser](./ci-suite-evidence.md#browser-shard-balance) shard balance rule,
not Playwright's count-based `--shard` selection. Omitting `--shard` runs the
complete selected suite. Unknown suites, malformed shards, missing values, and
attempts to shard the repository or native suite fail before any subprocess
starts.

## Gate Ownership

| Gate             | Commands and owned behavior                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository       | Every check of the [repository gate list](./ci-verification-repository.md#repository-boundary), in the listed order, and the [boundary check](./repository-layout.md#boundary).                                                                                                                                                                                                                   |
| Viewer           | The [required type check](./developer-type-checks.md#required-type-check) of every project, then every discovered Node test file, including the frame probe size test of the [frame probe contract](./mokly-frame-probe.md), with at most the [shared file concurrency](./ci-suite-evidence.md#test-concurrency) active. A shard runs its whole-file partition; only shard 1 runs the type check. |
| Browser          | Every Playwright spec against one `mokly serve` of the example catalogue per worker, with `fullyParallel: false`, the [shared worker count](./ci-suite-evidence.md#test-concurrency), the configured Playwright timeouts, and zero retries. A shard runs its whole-file partition.                                                                                                                |
| Native platforms | On macOS and Windows, build the `mokly` binary once, check Rust formatting, run Clippy with warnings denied, and run the Rust tests, for the `mokly-*` crates and `xtask` only.                                                                                                                                                                                                                   |
| Cloud suites     | The cloud checks that no Mokly suite runs, under [Cloud Suites](#cloud-suites).                                                                                                                                                                                                                                                                                                                   |
| Required CI      | Evaluate the results of the runtime profile job, the repository job, every viewer and browser shard, and the static-delivery job on each runtime selected for the event, of both native platforms, and of every cloud job. Validate the viewer and browser report evidence.                                                                                                                       |

Complete and selected local suites share gate definitions. Every Native
command has local coverage; `npm run build` covers `cargo xtask build-native`.
In-process auditors fail like subprocesses.
The local Repository and Viewer suites cover the native build and Rust checks
once. The selected Native suite repeats those checks on the hosted macOS and
Windows runners, for the `mokly-*` crates and `xtask` only. On Linux, the
Native suite also selects only the Mokly crates and `xtask`. The cloud Rust
suite covers cloud crates. Required CI requires both native jobs.
The cloud contract tests of `xtask` run on Linux only.
Decision: the macOS and Windows runs leave out the `mkc-` crates, because
those crates use Diesel with Postgres, which needs `libpq`.

Viewer and Browser build the binary and viewer bundle first through
`npm run build`. Native builds the host binary through
`cargo xtask build-native`. No suite prepares a baseline, a compiled example, a generated
tree, or a packed archive. Serve renders the example catalogue from its sources
into the render cache, and the tests read nothing back from the repository.

The Viewer suite needs a `bun` executable on the `PATH` at the version that
`.bun-version` pins. Without that version, the suite fails at its type check,
also in a local complete gate. No other suite needs Bun. No suite command
installs it. The
[provisioning rules](./developer-type-checks.md#bun-provisioning) say where
each host installs it.

The [repository ratchets](./verification-ratchets.md) define their comparison
commits, scopes, and shrink-only baselines. The
[length audits](./ci-verification-repository.md#length-audits) define the
source, protocol, and Rust file limits and their scope.

ESLint derives global ignores from `.gitignore` before adding its broader
ESLint-only ignores. Ignored build, cache, report, and tool scratch paths cannot
make a later complete gate fail.

The [developer test commands](./developer-test-commands.md) define the public
Node test and browser entry points, selection, and the developer skip policy.
Strict Node test discovery recursively includes `.test.ts` and `.test.tsx` files
under `tests/`, `packages/viewer/tests/`, `packages/ui/tests/`,
`packages/model/tests/`, and `packages/frame/tests/`: the tooling tests, the
viewer tests, and the tests of the UI, model, and frame packages. The strict
runners and every `cargo xtask check` suite reject skips and todos. Node test files stay outside Playwright's `tests/browser/` directory.
Playwright matches only `**/*.spec.ts` in its one `chromium` project.

The strict runners skip the build, reject arguments other than the optional
browser shard, and fail when the build output is missing. The Viewer and
Browser suites run their Node and Playwright tests only through the strict
runners.

## Cloud Suites

The complete gate runs every cloud suite. `--suite` selects one. CI uses Linux.
Seven remote workers cover Rust and desktop, four app shards, web, and infrastructure.
Each worker attempts every assigned suite and reports each failure.

| Suite                  | Required checks                                                           |
| ---------------------- | ------------------------------------------------------------------------- |
| `cloud-rust`           | Clippy, the workspace Mokly build, and tests of every `mkc-` crate        |
| `cloud-migrations`     | SQL pairs, migration checksums, and the append-only base lock             |
| `cloud-typecheck`      | Type checks of every cloud npm project                                    |
| `cloud-app`            | App logic, web export, and browser tests                                  |
| `cloud-mockups`        | Mockup build, compilation, determinism, policy, browser smoke, and types  |
| `cloud-site`           | Site build, types, unit tests, links, and browser checks                  |
| `cloud-openapi`        | Drift of the Rust-owned document and generated TypeScript client          |
| `cloud-fixtures`       | Workspace-built Mokly fixture drift and the Rust dogfood test             |
| `cloud-emails`         | Email template drift and mutation tests                                   |
| `cloud-openapi-lint`   | API error reasons, protocol reason mentions, and GitHub delivery fixtures |
| `cloud-terraform`      | Terraform formatting, validation, and mock-provider tests                 |
| `cloud-origin-router`  | Cloudflare Worker types and tests                                         |
| `cloud-helm`           | Helm lint, golden renders, rejected values, and setting parity            |
| `cloud-infrastructure` | Infrastructure contracts, BuildKit storage evidence, and workload images  |
| `cloud-desktop`        | Electron logic, bundled export, and real-API smoke                        |
| `cloud-toolchain-pins` | Protocol pins, manifests, images, and installed tool versions             |

Cloud Rust, app, and desktop create a database per invocation (role: `CREATEDB`).
`MKC_TEST_DATABASE_URL` selects the server. Cloud Rust needs `libpq`; missing tools and skips fail.

`cloud-app --shard INDEX/TOTAL` builds an independent web export and runs
that browser shard. Shard 1 also runs app logic tests. Without `--shard`, it
runs all logic and browser tests. An inherited app shard cannot restrict an
unsharded run.

The fixtures suite compares bytes from the workspace Mokly build;
`cargo xtask mokly-fixtures` regenerates them. Fixed placeholder versions keep
release numbers out of fixture drift. Published CLI consumers use npm `latest`.

## Deterministic Test Repository Inputs

The [test repository contract](./ci-test-repository-inputs.md) defines fixture
Git state, checked-out lockfiles, and remote-state protection.

## Pull Request Title Contract

A separate pull-request workflow validates titles on `opened`, `edited`,
`reopened` and `synchronize`. It passes the untrusted title through an
environment variable to a repository script; workflow expressions never
interpolate the title into shell source. The workflow runs
`scripts/verification/pull-request-title.mjs`, which reads only
`PULL_REQUEST_TITLE` and needs no installed dependencies.

The complete title is at most 72 Unicode code points, has no leading or
trailing whitespace or newline, and has this Conventional Commits shape:

```text
<type>(<optional-scope>)<optional-!>: <description>
```

`type` is exactly one of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
`refactor`, `revert`, `style` or `test`. When present, `scope` is lowercase
ASCII matching `[a-z0-9._/-]+`. `!` may follow the type or closing scope. The
separator is exactly colon plus one space. `description` is nonempty, begins
and ends with a non-whitespace character, and contains no newline. Examples
include `fix: preserve upload counts`, `chore(main): release 0.13.0` and
`feat(publish)!: upload catalogue content deltas`.

This type list is fixed. It does not derive from Git history,
remote-tracking references, or the commit examples in the shared `git-commit`
skill.

An invalid title exits unsuccessfully and prints exactly:

```text
Pull request titles must use type(scope)!: description with type build, chore, ci, docs, feat, fix, perf, refactor, revert, style, or test. Keep any scope lowercase and the whole title to 72 characters or fewer.
```

The check protects release notes because this repository squash-merges pull
requests and release-please reads the squash title on `main`. A breaking title
keeps its `BREAKING CHANGE:` explanation in the squash body; title validation
does not inspect or synthesize that body.

## CI Workflow Graph

The hosted job graph, checkout ownership, runtime profiles, runner policy,
job timeouts, and stable `Required CI` status follow the separate
[CI workflow graph contract](./ci-workflow.md). The suites below own the report
evidence that status validates. Inventory and evidence rules live here because
local xtask suites and hosted jobs share them.

## Inventory And Report Evidence

Node test and Playwright inventories are discovered on the executing runtime,
not fixed in advance. Browser discovery asks Playwright; an empty suite fails. A
failed browser discovery reports the load errors from Playwright's JSON output
as well as its standard error. Browser error assertions follow the
[browser error rule](./ci-suite-evidence.md#browser-errors).

Each suite report records the commit SHA, runtime, suite, optional shard,
complete discovered file inventory, assigned file inventory, observed executed
files, per-file timing, process outcome, and skipped or cancelled evidence.
Browser reports also record the spec inventory and every test by project, spec
file, defining file, line, column, and title path; the Playwright reporter
records each observed test's result, duration, and serialized errors. A test's
spec file is the `*.spec.ts` file that Playwright loaded. Its defining file,
line, and column locate the `test()` call, which can be in a helper module that
the spec imports. Every Playwright file inventory, assignment, observed file,
and per-file timing names spec files, so a shared helper never joins an
inventory or spans shards. Node test reports keep the Node reporter's failure
names and diagnostics. Once execution starts, the wrapper writes a report after
the test process exits on success or failure, then validates it. A discovery or
build failure before execution may leave no report; the job and the aggregate
still fail. Reporter callback failures or missing output can therefore never
turn into success.

A report's runtime names the Node version that runs its tests. The Bun type
check of the Viewer suite adds no report, report field, runtime, or inventory
entry.

For an unsharded report for a complete suite, the observed file set must equal
independent discovery exactly. For each sharded suite, the aggregate requires
one report per shard of the [CI shard totals](./ci-suite-evidence.md#shard-totals)
for each runtime, proves assignments are non-empty and pairwise disjoint, and
compares their union and observed execution against a separately discovered
complete suite inventory. Browser evidence also requires the observed test IDs
across the browser shards to equal independent unsharded discovery exactly once. A
missing file or test, duplicate assignment or observed test, unexpected file or
test, skipped or cancelled test, browser shard above the
[share limit](./ci-suite-evidence.md#browser-shard-balance), non-zero exit,
signal exit, or absent or invalid report fails verification. Per-file and
per-test durations are kept so imbalance can be measured without changing
whole-file partitioning.

Report artifacts have stable, unique suite, runtime, and shard names and use
replacement uploads. A failed-job rerun can therefore replace its own report
while successful reports from an earlier attempt in the same workflow run stay
available; whole-workflow reruns replace all report artifacts. The aggregate
downloads only the `verification-*` report namespace. Browser trace artifacts
are attempt-specific. Viewer and browser jobs keep inventory, timing, and
failure details; Playwright failures also keep traces and Playwright error
context. A successful `Required CI` job plus its revalidated complete report
aggregate is reusable complete verification for the tree the reports name
within that event's runtime profile; individual reports are partial evidence.
Release publication accepts only the dual-runtime Release Please profile, then
applies the additional tree, live Node test inventory, and live Playwright
inventory checks in the [release evidence contract](./npm-release-evidence.md).
The ordinary single-runtime profile cannot authorize publication. Reports stay
available for 14 days. Missing or expired evidence stops release preparation.
Re-run qualifying CI on the release commit, then retry the release.

The cache and audit continuation is
[Dependency Cache And Security](./ci-verification-security.md).
