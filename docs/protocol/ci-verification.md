# CI Verification

## Delivery Status

The suite CLI, evidence, workflow graph, fixture reuse, and every repository
ratchet are implemented. [Hosted measurements](https://github.com/mokly-ai/mokly/blob/f66c274/docs/reviews/ci-performance.md)
record timing and coverage. `cargo xtask check` is the complete gate.
A validated hosted aggregate is reusable evidence for its exact tree.
Public argument forwarding, cancellation and title validation are implemented.
Remote execution and automatic selection are implemented.

## Verification Boundary

`cargo xtask check` is the complete repository and release gate.
The local executor runs every gate sequentially in one checkout.
It starts with the live workspace dependency audit. The complete gate can
instead run on Testboxes under the pending
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
| Repository       | Live dependency audit first; Prettier; ESLint; JavaScript/TypeScript length, protocol-cap, unused-internal-export, and public-package-export ratchets; Rust formatting, Clippy, tests, and file-length audit.                                                                                                                                                                          |
| Package          | One ordinary package/example preparation; TypeScript declaration and no-emit checks; derived example check; both package manifests, script-free dry-run allowlists, licenses, browser graph, CLI shebang, inspector budget and exact version relationship; one real viewer/CLI archive pair; every clean consumer smoke using that pair. Real `prepack` builds remain part of packing. |
| Unit/integration | One ordinary package/example preparation followed by every discovered Node test file, with at most the [shared file concurrency](./ci-suite-evidence.md#test-concurrency) active. A shard runs its whole-file partition.                                                                                                                                                               |
| Browser          | One ordinary package/example preparation followed by every non-hydration Playwright spec, with `fullyParallel: false`, the [shared worker count](./ci-suite-evidence.md#test-concurrency), existing timeouts and zero retries. A shard runs its whole-file partition.                                                                                                                  |
| Hydration        | One ordinary package/example preparation followed by every Playwright spec whose filename contains `hydration`, using the same browser settings without sharding and with the [hydration worker default](./ci-suite-evidence.md#test-concurrency). Its route-inventory spec runs its independent route tests in parallel mode.                                                         |
| Native platforms | On macOS and Windows, build once and run export transaction and destination-race tests, CSS parser/diff tests, and baseline/process-tree tests.                                                                                                                                                                                                                                        |
| Required CI      | Evaluate the result and evidence from the repository job, every package runtime selected for this event, all selected unit, browser, and hydration runtime combinations, and both native platforms.                                                                                                                                                                                    |

Complete and selected suites share gate definitions; adding a suite command adds
it to the complete gate. In-process auditors fail like subprocesses.

File-length, protocol-cap, and unused-internal-export ratchets use
`git merge-base HEAD origin/main`; the public-package-export ratchet instead
uses the newest matching release tags reachable from `HEAD`. The
[owning contract](./verification-ratchets.md) defines the module extensions,
shrink-only baselines, and recursive `docs/protocol/**` scan excluding
`fixtures/`.

The repository prerequisite also runs the workspace-root source/protocol
length audit. It covers changed repository TypeScript/JavaScript and protocol
Markdown plus non-ignored untracked files. Protocol pages over 250 lines use
only the exact reviewed caps in `tests/protocol_doc_sizes.test.ts`; `cargo xtask
source-file-length-lint --all` audits every scoped file. This remains in
addition to main's repository ratchets.
The full scope and failure semantics are in
[Repository Gate And Length Audits](./ci-verification-repository.md).

ESLint derives global ignores from `.gitignore` before adding its broader
ESLint-only ignores. Ignored build, cache, report, and tool scratch paths,
including Wrangler scratch, cannot make a later complete gate fail.

The public `npm test` and `npm run test:browser` commands prepare package and
example output; the latter runs both Playwright projects and every spec.
Filtering or selecting a project is partial verification. `npm test` and
`test:prepared` share recursive discovery of `.test.ts` and `.test.tsx` files
under `tests/` and `packages/viewer/tests/`, with the same file concurrency. The
developer runner fails on failures, cancellations, and unreported files; it
tolerates skipped and todo tests (including intentional Windows skips) and
prints their count. The prepared runner and every `cargo xtask check` suite
reject skips and todos. Node unit tests stay outside Playwright's
`tests/browser/` directory. Playwright matches only `**/*.spec.ts`; `chromium`
ignores filenames containing `hydration`, while `hydration` matches only them.

Public `package:check` and `package:smoke` preserve caller arguments, including
`--artifacts DIR`, across nested npm. Prepared test commands skip preparation,
reject arguments other than the optional shard, and fail when required output is
missing; prepared package commands may instead receive the gate's archive pair.
Xtask prepares output per suite and calls only prepared consumers; output is
reused only within that suite.

Builds under test are not removed. Package dry-run allowlist inspection retains
`--ignore-scripts`, while real packing keeps lifecycle builds. Historical
baseline reconstruction, clean consumers and caches, source mutation, startup,
and cache invalidation retain independent preparation.

## Deterministic Test Repository Inputs

Unit and browser tests must depend only on the tree under test and fixture-owned
state. The example preview unit test copies the checked-out example and tooling
into an isolated fixture repository, commits that fixture-owned baseline,
applies one deterministic source edit and asserts its exact changed
destinations and count. The browser suite's example server runs with
`--base HEAD` and compares with the checked-out `HEAD`; every worker's server
uses that same command. A fixture repository may create and read its own
remotes because those references are fixture-owned inputs inside the test tree.

CI's package, unit, browser, and hydration jobs key npm's download cache from
the checked-out `package-lock.json`; none resolves `origin/main` or reads a
branch-point lockfile. Identical trees must produce identical test results; the
release workflow's exact-tree evidence reuse depends on that determinism.

The remaining automated checks for repository inputs are deliberately narrow:

- [`tests/preview.test.ts`](../../tests/preview.test.ts) owns the isolated
  fixture baseline, deterministic edit and exact changed-result assertions.
- [`tests/deployment.test.ts`](../../tests/deployment.test.ts) requires the
  browser server command to use `--base HEAD`.
- [`tests/ci_workflow.test.ts`](../../tests/ci_workflow.test.ts) requires the
  package, unit, browser, and hydration jobs to use the checked-out lockfile and
  never resolve `origin/main` or a branch-point lockfile.

Nothing scans test code for remote-branch reads. New tests rely on review to
keep this deterministic-input rule.

No workflow or composite-action `run:` step may delete remote Git state. In a
shared Git worktree, such a command deletes the shared repository's remotes,
remote-tracking references or upstream settings.
[`tests/ci_workflow_remote_state.test.ts`](../../tests/ci_workflow_remote_state.test.ts)
enforces this as a text check across workflow and composite-action steps, using
the command scanner in
[`tests/helpers/remote_state_commands.ts`](../../tests/helpers/remote_state_commands.ts).
It cannot see commands inside scripts that a step calls.

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

This type list is fixed. Its unit test checks that it covers the Conventional
Commit examples in `AGENTS.md`; it does not derive policy from Git history or
remote-tracking references.

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
Inventory and evidence rules remain here because local selected suites and
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

Each runner records the commit SHA, runtime, suite, optional shard, complete
discovered file inventory, assigned file inventory, observed executed files,
per-file timing, process outcome, and skipped/cancelled evidence. Browser and
hydration reports also record the all-project spec inventory and every test by
stable project, relative file, line, column and title path; the Playwright
reporter records each observed test's result, duration, and serialized errors.
Unit reports retain the Node reporter's failure names and diagnostics. Once
execution starts, the wrapper writes a report after the test process exits on
success or failure, then validates it. A discovery or preparation failure before
execution may leave no report; the shard job and aggregate still fail. Reporter
callback failures or missing output can therefore never turn into success.

For an unsharded run, the observed file set must equal independent discovery
exactly. For sharded CI, the aggregate requires all four reports for each
runtime and sharded suite, proves assignments are non-empty and pairwise
disjoint, and compares their union and observed execution against a separately
discovered complete suite inventory. Browser evidence also requires the observed
test IDs across the four shards to equal independent unsharded discovery exactly
once. Each runtime requires one unsharded hydration report; every browser-like
report must carry the same all-project inventory, and the browser and hydration
file inventories must be disjoint and exhaust it. A missing file or test,
duplicate assignment or observed test, unexpected file or test, skipped or
cancelled test, non-zero exit, signal exit, or absent/invalid report fails
verification. Per-file and per-test durations are retained so imbalance can be
measured without changing whole-file partitioning.

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
