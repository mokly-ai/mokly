# CI Verification

## Delivery Status

The suite CLI, inventory evidence, event-specific parallel workflow graph, and
existing fixture reuse are implemented; the linked shared-baseline
preparation for Milestone 14 remains an approved target. The
[hosted acceptance measurement](../reviews/ci-performance.md) records the
delivered timing, capacity, cache, cost, and coverage evidence. The
authoritative complete local and complete-mode release gate remains
`cargo xtask check`; the full hosted aggregate is reusable evidence for its
exact tree. The public package forwarding and hierarchical cancellation
additions below are implemented by the corresponding review-follow-up
milestones.

## Verification Boundary

`cargo xtask check` is the complete local verification entrypoint and the
release workflow's complete-mode entrypoint. With no options it runs every gate
sequentially in one checkout, beginning with the live workspace dependency
audit. A selected suite is partial evidence and must never report that the
complete gate passed. CI's validated aggregate of every required job and all
sharded reports is complete verification of the exact tree named by those
reports; the [release evidence contract](./npm-release-evidence.md) defines how
a publish may reuse that proof.

The CLI is:

```bash
cargo xtask check
cargo xtask check --suite repository
cargo xtask check --suite package
cargo xtask check --suite unit --shard 1/4
cargo xtask check --suite browser --shard 1/4
```

`--shard INDEX/TOTAL` uses one-based positive integers, requires
`INDEX <= TOTAL`, limits both values to JavaScript's maximum safe integer, and
is valid only with `unit` or `browser`. Unit sharding is delegated to Node's
`--test-shard`; browser sharding is delegated to Playwright's `--shard`.
Omitting `--shard` runs the complete selected suite. Unknown suites, malformed
shards, missing values, and attempts to shard the repository or package suite
fail before any subprocess starts.

## Gate Ownership

| Gate             | Commands and owned behavior                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository       | Live `npm run dependencies:check` first; Prettier check; ESLint; `cargo fmt --all -- --check`; workspace Clippy with warnings denied; workspace Rust tests; Rust file-length audit.                                                                                                                                                                                                        |
| Package          | One ordinary package/example preparation; TypeScript declaration and no-emit checks; derived example check; both package manifests, script-free dry-run allowlists, licenses, browser graph, CLI shebang, inspector budget and exact version relationship; one real viewer/CLI archive pair; all five clean consumer smokes using that pair. Real `prepack` builds remain part of packing. |
| Unit/integration | One ordinary package/example preparation followed by every discovered Node test file, with at most two files active. A shard runs its whole-file partition.                                                                                                                                                                                                                                |
| Browser          | One ordinary package/example preparation followed by every discovered Playwright spec, with `fullyParallel: false`, one worker, existing timeouts and zero retries. A shard runs its whole-file partition.                                                                                                                                                                                 |
| Native platforms | On macOS and Windows, build once and run export transaction and destination-race tests, CSS parser/diff tests, and baseline/process-tree tests.                                                                                                                                                                                                                                            |
| Required CI      | Evaluate the result and evidence from the repository job, every package runtime selected for this event, all selected unit and browser runtime/shard combinations, and both native platforms.                                                                                                                                                                                              |

The complete command and selected suites must be generated from the same gate
definitions. Adding a command to a suite therefore adds it to the complete
gate. The Rust file-length auditor is a repository-gate operation implemented
inside xtask rather than a subprocess in the command list; it has the same
failure semantics as the listed commands.

The public npm entrypoints `npm test`, `npm run typecheck`, and
`npm run test:browser` remain clean-checkout entrypoints: each prepares its
required package output, and both test commands also prepare the example. The
browser command supports Playwright listing, filtering, and selected spec paths;
any filtered selection is partial verification. The public unit command retains
its complete explicit file inventory and concurrency limit. Public
`package:check` and `package:smoke` wrappers preserve every caller argument
across their nested npm boundary; in particular, `--artifacts DIR` reaches the
prepared consumer as the same two arguments. Internal prepared test entrypoints
skip preparation, reject arguments other than the optional shard, and fail when
required output is missing. Prepared package commands may instead receive the
archive pair created by the package gate. Xtask suite invocations prepare their
own output and call only the prepared consumers. Output is reused only for the
lifetime of that suite invocation.

Builds that are themselves under test are not removed. Package dry-run
allowlist inspection retains its existing `--ignore-scripts` boundary, while
real packing keeps its lifecycle builds. Historical baseline reconstruction,
clean consumer installation, clean-cache npx execution, source mutation,
startup, and cache-invalidation regressions retain independent preparation.

## CI Graph And Checkout Ownership

The repository job is the shared prerequisite for every verification job. Each
downstream job starts from a fresh checkout and owns its writable build,
example, fixture, report, and trace output. No live checkout or writable build
directory is transferred between jobs. All jobs that resolve `origin/main` or
create historical baselines receive complete Git history.

For ordinary pull requests and pushes to `main`, the workflow fans out to:

- one package job on Node 22.14.0;
- four unit shards on Node 22.14.0;
- four browser shards on Node 22.14.0; and
- native jobs on macOS and Windows at Node 22.14.0.

For a same-repository Release Please pull request, the package job and every
unit/browser shard also run on Node 24. A release pull request is recognized
only when its head repository is this repository and either its head ref starts
with `release-please--` or it has an `autorelease:` label. A fork cannot opt
itself into the more expensive profile by choosing a matching branch name.

The repository job resolves floating Node 24 once, then an explicit shell step
reads `process.versions.node` and exposes that exact version plus the selected
matrix and report-runtime identities as job outputs. Every package, unit, and
browser job selected for Node 24, plus the Required CI aggregate, requests the
captured version. CI therefore adopts new Node 24 patches without allowing
differing runner caches to give sibling shards different versions. Matrix labels
and report runtime identities remain `node-24`; reports still record the exact
installed version, and the aggregate continues to reject mixed versions within
a group. The setup action itself does not provide the installed version output.

Node 22.14 is the ordinary functional runtime because it is the package's
declared minimum. The Node 24 repository prerequisite still runs on every
event. Deferring the second complete functional run means a Node 24-only
regression can reach unreleased `main`, but the dual-runtime Release Please gate
must catch it before versions, tags or npm artifacts can be published. Release
Please normally updates its pull request after a releasable merge, keeping that
feedback close to the originating change without paying for both full suites on
every ordinary pull-request and `main` run.

Matrix jobs use `fail-fast: false`, so one failing shard does not erase evidence
from its peers. Chromium is installed only in browser jobs. Rust formatting,
Clippy and tests run only in the repository job; selected suite jobs still
compile xtask to dispatch their gate. Jobs that execute npm use npm 11.7.0. All
Linux and Windows jobs across the CI, preview, and release workflows use
Blacksmith's 2-vCPU tiers. Native macOS verification uses the provider's
smallest available tier, which is 6 vCPUs. CI jobs have read-only repository
permissions and a 20-minute execution timeout. Superseded workflow runs remain
cancellable.

The stable `Required CI` job uses `if: always()` and fails closed unless every
required job result is exactly `success`. It also validates the evidence
aggregate described below against the runtime profile emitted by the repository
job: eight unit/browser reports for ordinary events and sixteen for a Release
Please pull request. A failed, skipped, cancelled, absent, duplicated,
wrong-runtime, wrong-shard, wrong-commit, unsupported-profile, missing or extra
report fails the aggregate. The aggregate may not infer success from a matrix
job's presence alone.

## Inventory And Report Evidence

Test totals are discovered on the executing runtime; no fixed count is part of
the contract. Before execution, the unit runner independently discovers all
matching `.test.ts` and `.test.tsx` files across the root and viewer suites. The
browser runner independently asks Playwright for the current spec inventory.
Discovery fails on an empty suite.

Development hydration registers one browser test per unique generated catalogue
route at discovery time, plus the home, missing-route and id-redirect cases.
Each route keeps the normal test deadline and error assertions; catalogue growth
cannot exhaust a shared route-loop deadline. Unit coverage checks that browser
discovery includes every generated route exactly once.

Each runner records the commit SHA, runtime, suite, optional shard, complete
discovered file inventory, assigned file inventory, observed executed files,
per-file timing, process outcome, and skipped/cancelled evidence. Browser
discovery additionally records every test by stable project, relative file,
line, column and title path; the Playwright reporter records each observed
test's result, duration, and serialized errors. Unit reports retain the Node
reporter's failure names and diagnostics. Once execution starts, the wrapper
writes a report after the test process exits on success or failure, then
validates it. A discovery or preparation failure before execution may leave no
report; the shard job and aggregate still fail. Reporter callback failures or
missing output can therefore never turn into success.

For an unsharded run, the observed file set must equal independent discovery
exactly. For sharded CI, the aggregate requires all four reports for each
runtime and suite, proves assignments are non-empty and pairwise disjoint, and
compares their union and observed execution against a separately discovered
complete inventory. Browser evidence also requires the observed test IDs across
the four shards to equal independent unsharded discovery exactly once. A
missing file or test, duplicate assignment or observed test, unexpected file or
test, skipped or cancelled test, non-zero exit, signal exit, or absent/invalid
report fails verification. Per-file and per-test durations are retained so
imbalance can be measured without changing whole-file partitioning.

Report artifacts have stable, unique suite, runtime and shard names and use
replacement uploads. A failed-job rerun can therefore replace its own report
while successful reports from an earlier attempt in the same workflow run stay
available; whole-workflow reruns replace all report artifacts. The aggregate
downloads only the `verification-*` report namespace. Browser trace artifacts
remain attempt-specific. Unit and browser jobs retain inventory, timing, and
failure details; browser failures additionally retain traces and Playwright
error context. A successful `Required CI` job plus its revalidated complete
report aggregate is reusable complete verification for the tree the reports
name within that event's runtime profile; individual reports remain partial
evidence. Release publication accepts only the dual-runtime Release Please
profile, then applies the additional tree and live unit-inventory checks in the
[release evidence contract](./npm-release-evidence.md). The ordinary
eight-report profile cannot skip the complete publish gate. Reports are
retained for 14 days, which bounds their release reuse; missing or expired
evidence falls back to the complete gate.

## Dependency Cache And Security

CI caches npm's download cache only. `actions/setup-node` keys it from the
committed `package-lock.json`; jobs that can run historical installs also add a
lockfile read from the merge-base commit. `npm ci` always runs, including after
a cache hit, and every platform's optional native package remains available.
A cache miss is an ordinary cold install and never permits a skipped command.

The live workspace audit runs first in the repository prerequisite and does not
depend on cache state. The complete local and release commands retain the same
audit-first ordering. Every selected package-runtime job also preserves the
separate production audit of the freshly resolved ESM consumer, which is
outside the workspace lockfile and overrides; the release profile proves it on
both runtimes. Intentionally isolated clean-cache consumer
tests keep private empty npm caches. Release publishing retains its uncached,
OIDC-scoped boundary and exact-artifact checks.

## Fixture Lifetime And Cleanup

The [fixture preparation and lifetime contract](./ci-fixture-preparation.md)
owns fixture isolation, process ownership, the 600-second real-export fixture
budget, and the approved once-per-invocation example baseline preparation.
The global sharing change is a Milestone 14 target, not yet implemented.

## Failure, Cancellation And Cleanup

Retain the [failure and cleanup contract](./ci-fixture-preparation.md#failure-cancellation-and-cleanup):
fail the sequence, drain its owned process tree and preserve failed evidence.
No shared preparation may weaken ownership or turn missing tests into success.

## Acceptance Measurement

The [measurement contract](./ci-fixture-preparation.md#acceptance-measurement)
retains the original hosted CI baseline and exact-tree acceptance requirements.
[Shared baseline measurements](./ci-fixture-preparation.md#timing-and-acceptance-for-shared-preparation)
add comparable before/after browser and fixture timings for Milestone 14.
