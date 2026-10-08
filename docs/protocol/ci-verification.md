# CI Verification

## Delivery Status

The suite CLI, evidence, workflow graph, fixture reuse, and all five
repository ratchets are implemented. [Hosted measurements](https://github.com/mokly-ai/mokly/blob/f66c274/docs/reviews/ci-performance.md)
record timing and coverage. `cargo xtask check` is the complete gate.
A validated hosted aggregate is reusable evidence for its exact tree.
Public argument forwarding, cancellation and title validation are implemented.
Remote execution and automatic selection are implemented. Dependency audit
modes and scheduled update pull requests are implemented under the
[audit contracts](./dependency-audit-update-pr.md).
The [test helper export ratchet](./verification-ratchets-test-helpers.md) is
implemented with its own shrink-only baseline.

## Verification Boundary

`cargo xtask check` is the complete repository and release gate.
The local executor runs every gate sequentially in one checkout.
It starts with the live baseline workspace audit. It fails on new issues and
reports inherited ones as notices. `--dependency-audit strict` selects strict
mode for the complete gate or repository suite;
[baseline auditing](./dependency-audit-baseline.md) owns the CLI and CI mode
rules. The complete gate can instead run on Testboxes under the implemented
[remote verification contract](./remote-verification.md).
Only active reviewed path exceptions cover findings.
[Dependency security](./dependency-security.md) defines their UTC expiry and
31-day limit. The packed-consumer production audit has no exceptions.
A selected suite is partial evidence and must never claim a complete pass.
CI's validated aggregate is complete evidence for its exact tree.
[Release evidence](./npm-release-evidence.md) defines reuse.

The CLI is:

```bash
cargo xtask check
cargo xtask check --dependency-audit strict
cargo xtask check --suite repository
cargo xtask check --suite package
cargo xtask check --suite unit --shard 1/4
cargo xtask check --suite browser --shard 1/4
cargo xtask check --suite hydration
```

`--shard INDEX/TOTAL` uses one-based positive integers, requires
`INDEX <= TOTAL`, limits both values to JavaScript's maximum safe integer, and
is valid only with `unit` or `browser`. Unit sharding is delegated to Node's
`--test-shard`; browser sharding is delegated to Playwright's `--shard`.
Omitting `--shard` runs the complete selected suite. Unknown suites, malformed
shards, missing values, and attempts to shard the repository, package, or
hydration suite fail before any subprocess starts.

## Gate Ownership

| Gate             | Commands and owned behavior                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository       | Live audit first: baseline for ordinary PRs, pushes, and local checks; strict for release and dependency update PRs. Prettier; ESLint; JavaScript/TypeScript length, protocol-cap, unused-internal-export, unused-test-helper-export, and public-package-export ratchets; Rust formatting, Clippy, tests, and file-length audit.                                                       |
| Package          | One ordinary package/example preparation; TypeScript declaration and no-emit checks; derived example check; both package manifests, script-free dry-run allowlists, licenses, browser graph, CLI shebang, inspector budget and exact version relationship; one real viewer/CLI archive pair; every clean consumer smoke using that pair. Real `prepack` builds remain part of packing. |
| Unit/integration | One ordinary package/example preparation and one example compilation snapshot, followed by every discovered Node test file, with at most the [shared file concurrency](./ci-suite-evidence.md#test-concurrency) active. A shard runs its whole-file partition.                                                                                                                         |
| Browser          | One ordinary package/example preparation followed by every non-hydration Playwright spec, with `fullyParallel: false`, the [shared worker count](./ci-suite-evidence.md#test-concurrency), existing timeouts and zero retries. A shard runs its whole-file partition.                                                                                                                  |
| Hydration        | One ordinary package/example preparation followed by every Playwright spec whose filename contains `hydration`, using the same browser settings without sharding and with the [hydration worker default](./ci-suite-evidence.md#test-concurrency). Its route-inventory spec runs its independent route tests in parallel mode.                                                         |
| Native platforms | On macOS and Windows, build once and run export transaction, destination-race, writer-lock and cache-ignore tests, CSS parser/diff tests, and baseline/process-tree tests.                                                                                                                                                                                                             |
| Required CI      | Evaluate the result and evidence from the repository job, every package runtime selected for this event, all selected unit, browser, and hydration runtime combinations, and both native platforms.                                                                                                                                                                                    |

Complete and selected suites share gate definitions; adding a suite command adds
it to the complete gate. In-process auditors fail like subprocesses.

File-length, protocol-cap, unused-internal-export, and unused-test-helper-export
ratchets use `git merge-base HEAD origin/main`. The public-package-export
ratchet instead uses the newest matching release tags reachable from `HEAD`. The
[owning contract](./verification-ratchets.md) defines the module extensions,
shrink-only baselines, and recursive `docs/protocol/**` scan excluding
`fixtures/`.

The repository prerequisite also runs the workspace-root source/protocol
length audit. It covers changed repository TypeScript/JavaScript and protocol
Markdown plus non-ignored untracked files. Protocol pages over 250 lines use
only the exact reviewed caps in `xtask/protocol-document-caps.json`; `cargo xtask
source-file-length-lint --all` audits every scoped file. This remains in
addition to the repository ratchets.
The full scope and failure semantics are in
[Repository Gate And Length Audits](./ci-verification-repository.md).

ESLint derives global ignores from `.gitignore` before adding its broader
ESLint-only ignores. Ignored build, cache, report, and tool scratch paths,
including Wrangler scratch, cannot make a later complete gate fail.

The [developer test commands](./developer-test-commands.md) define public unit
and browser entrypoints, selection, preparation, and the developer skip policy.
Strict unit discovery recursively includes `.test.ts` and `.test.tsx` files
under `tests/` and `packages/viewer/tests/`, with the
[shared file concurrency](./ci-suite-evidence.md#test-concurrency).
The prepared runners and every `cargo xtask check` suite reject skips and todos.
Node unit tests stay outside Playwright's `tests/browser/` directory.
Playwright matches only `**/*.spec.ts`; `chromium` ignores filenames containing
`hydration`, while `hydration` matches only them.

Public `package:check` and `package:smoke` preserve caller arguments, including
`--artifacts DIR`, across nested npm. Prepared test commands skip preparation,
reject arguments other than the optional shard, and fail when required output is
missing; prepared package commands may instead receive the gate's archive pair.
Xtask prepares output per suite and calls only prepared consumers; output is
reused only within that suite. `npm test` and the xtask unit suite run
`npm run prepare:unit`; a complete unit run requires the example compilation
[snapshot](./ci-example-snapshot.md) it writes.

Builds under test are not removed. Package dry-run allowlist inspection retains
`--ignore-scripts`, while real packing keeps lifecycle builds. Historical
baseline reconstruction, clean consumers and caches, source mutation, startup,
and cache invalidation retain independent preparation.

## Deterministic Test Repository Inputs

The [test repository contract](./ci-test-repository-inputs.md) defines isolated
fixture history, checked-out lockfiles and remote-state protection.

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

This type list is fixed. The unit test asserts the list directly; it does not
derive policy from Git history, remote-tracking references, or the commit
examples in `docs/dev/git.md`.

An invalid title exits unsuccessfully and prints exactly:

```text
Pull request titles must use type(scope)!: description with type build, chore, ci, docs, feat, fix, perf, refactor, revert, style, or test. Keep any scope lowercase and the whole title to 72 characters or fewer.
```

The check protects release notes because this repository squash-merges pull
requests and release-please reads the squash title on `main`. A breaking title
retains its `BREAKING CHANGE:` explanation in the squash body; title validation
does not inspect or synthesize that body.

## CI Workflow Graph

The hosted job graph, checkout ownership, runtime profiles, runner policy,
30-minute timeouts, and stable `Required CI` status follow the separate
[CI workflow graph contract](./ci-workflow.md).
The suites below own the report evidence that status validates.
Inventory and evidence rules remain here because local xtask suites and
hosted jobs share them.

## Inventory And Report Evidence

Unit and Playwright inventories are discovered on the executing runtime, not
fixed in advance. Browser or hydration discovery asks Playwright; an empty suite
fails. A failed browser discovery reports the load errors from Playwright's JSON
output as well as its standard error.

Development hydration registers one browser test per entry shape of the
generated example catalogue at discovery time, plus the home and missing-route
cases, as [development hydration coverage](./ci-verification-hydration.md)
defines. Each test keeps the normal deadline and error assertions, and unit
coverage checks that discovery lists each shape exactly once. That page also
owns the generated resource audit. Browser error assertions accept only Chrome's
report that a viewer-owned sandboxed frame (`/static/`, a temporary render, or
`about:srcdoc`) blocked a script, as `tests/browser/console_notices.ts` defines.

Each suite report records the commit SHA, runtime, suite, optional shard,
complete discovered file inventory, assigned file inventory, observed executed
files, per-file timing, process outcome, and skipped/cancelled evidence. Browser
and hydration reports also record the all-project spec inventory and every test
by stable project, spec file, defining file, line, column and title path; the
Playwright reporter records each observed test's result, duration, and
serialized errors. A test's spec file is the `*.spec.ts` file that Playwright
loaded. Its defining file, line and column locate the `test()` call, which can
be in a helper module that the spec imports. Every Playwright file inventory,
assignment, observed file and per-file timing names spec files, so a shared
helper never joins an inventory or spans shards.
Unit reports retain the Node reporter's failure names and diagnostics. Once
execution starts, the wrapper writes a report after the test process exits on
success or failure, then validates it. A discovery or preparation failure before
execution may leave no report; the shard job and aggregate still fail. Reporter
callback failures or missing output can therefore never turn into success.

For an unsharded report for a complete suite, the observed file set must equal
independent discovery exactly. For sharded CI, the aggregate requires all four
reports for each runtime and sharded suite, proves assignments are non-empty and
pairwise disjoint, and compares their union and observed execution against a
separately discovered complete suite inventory. Browser evidence also requires
the observed test IDs across the four shards to equal independent unsharded
discovery exactly once. Each runtime requires one unsharded hydration report;
every browser-like report must carry the same all-project inventory, and the
browser and hydration file inventories must be disjoint and exhaust it. A
missing file or test, duplicate assignment or observed test, unexpected file or
test, skipped or cancelled test, browser shard above the
[share limit](./ci-suite-evidence.md#browser-shard-balance), non-zero exit,
signal exit, or absent/invalid report fails verification. Per-file and per-test durations are retained so
imbalance can be measured without changing whole-file partitioning.

Report artifacts have stable, unique suite, runtime and shard names and use
replacement uploads. A failed-job rerun can therefore replace its own report
while successful reports from an earlier attempt in the same workflow run stay
available; whole-workflow reruns replace all report artifacts. The aggregate
downloads only the `verification-*` report namespace. Browser trace artifacts
remain attempt-specific. Unit, browser, and hydration jobs retain inventory,
timing, and failure details; Playwright failures additionally retain traces and
Playwright error context. A successful `Required CI` job plus its revalidated
complete report aggregate is reusable complete verification for the tree the
reports name within that event's runtime profile; individual reports remain
partial evidence. Release publication accepts only the dual-runtime Release
Please profile, then applies the additional tree, live unit-inventory, and live
Playwright-inventory checks in the
[release evidence contract](./npm-release-evidence.md). The ordinary nine-report
profile cannot skip the complete publish gate. Reports are retained for 14 days,
which bounds their release reuse; missing or expired evidence falls back to the
complete gate.

The cache and audit continuation is [Dependency Cache And Security](./ci-verification-security.md).

Global setup currently prepares one baseline and cache for isolated fixture
copies. The [fixture preparation contract](./ci-fixture-preparation.md) defines
the approved replacement with committed-output fixtures and keeps the 600-second
limit. Existing workflow and audit contracts remain in force.
