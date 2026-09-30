# CI Verification

## Delivery Status

The suite CLI, evidence, workflow graph, fixture reuse, and every repository
ratchet are implemented. [Hosted measurements](../reviews/ci-performance.md)
record timing and coverage. `cargo xtask check` remains the complete local gate;
a validated hosted aggregate is reusable evidence for its exact tree.

## Verification Boundary

`cargo xtask check` is the complete local and release complete-mode entrypoint.
With no options it runs every gate sequentially in one checkout, beginning with
the live workspace dependency audit. A selected suite is partial evidence and
must never report that the complete gate passed. CI's validated aggregate of all
required jobs and reports is complete verification of their exact tree; the
[release evidence contract](./npm-release-evidence.md) defines reuse.

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

| Gate             | Commands and owned behavior                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository       | Live dependency audit first; Prettier; ESLint; JavaScript/TypeScript length, protocol-cap, unused-internal-export, and public-package-export ratchets; Rust formatting, Clippy, tests, and file-length audit.                                                                                                                                                                              |
| Package          | One ordinary package/example preparation; TypeScript declaration and no-emit checks; derived example check; both package manifests, script-free dry-run allowlists, licenses, browser graph, CLI shebang, inspector budget and exact version relationship; one real viewer/CLI archive pair; all five clean consumer smokes using that pair. Real `prepack` builds remain part of packing. |
| Unit/integration | One ordinary package/example preparation followed by every discovered Node test file, with at most two files active. A shard runs its whole-file partition.                                                                                                                                                                                                                                |
| Browser          | One ordinary package/example preparation followed by every non-hydration Playwright spec, with `fullyParallel: false`, one worker, existing timeouts and zero retries. A shard runs its whole-file partition.                                                                                                                                                                              |
| Hydration        | One ordinary package/example preparation followed by every Playwright spec whose filename contains `hydration`, using the same browser settings without sharding.                                                                                                                                                                                                                          |
| Native platforms | On macOS and Windows, build once and run export transaction and destination-race tests, CSS parser/diff tests, and baseline/process-tree tests.                                                                                                                                                                                                                                            |
| Required CI      | Evaluate the result and evidence from the repository job, every package runtime selected for this event, all selected unit, browser, and hydration runtime combinations, and both native platforms.                                                                                                                                                                                        |

Complete and selected suites share gate definitions; adding a suite command adds
it to the complete gate. In-process auditors fail like subprocesses.

File-length, protocol-cap, and unused-internal-export ratchets use
`git merge-base HEAD origin/main`; the public-package-export ratchet instead
uses the newest matching release tags reachable from `HEAD`. The
[owning contract](./verification-ratchets.md) defines the module extensions,
shrink-only baselines, and recursive `docs/protocol/**` scan excluding
`fixtures/`.

ESLint derives global ignores from `.gitignore` before adding its broader
ESLint-only ignores. Ignored build, cache, report, and tool scratch paths,
including Wrangler scratch, cannot make a later complete gate fail.

The public `npm test` and `npm run test:browser` commands prepare package and
example output; the latter runs both Playwright projects and every spec.
Filtering or selecting a project is partial verification. `npm test` and
`test:prepared` share recursive discovery of `.test.ts` and `.test.tsx` files
under `tests/` and `packages/viewer/tests/`, with two-file concurrency. The
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

## CI Workflow Graph

The hosted job graph, checkout ownership, runtime profiles, runner policy,
30-minute timeouts, and stable `Required CI` status follow the separate
[CI workflow graph contract](./ci-workflow.md). The suites below own the report
evidence that status validates.

## Inventory And Report Evidence

Unit and Playwright inventories are discovered on the executing runtime, not
fixed in advance. Browser or hydration discovery asks Playwright; an empty suite
fails.

Development hydration registers one browser test per unique generated catalogue
route at discovery time, plus the home and missing-route cases. Each route keeps
the normal test deadline and error assertions; catalogue growth cannot exhaust a
shared route-loop deadline. Unit coverage checks that browser discovery includes
every generated route exactly once.

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

## Dependency Cache And Security

CI caches npm's download cache only. `actions/setup-node` keys it from the
committed `package-lock.json`; jobs that can run historical installs also add a
lockfile read from the merge-base commit. `npm ci` always runs, including after
a cache hit, and every platform's optional native package remains available. A
cache miss is an ordinary cold install and never permits a skipped command.

The live workspace audit runs first in the repository prerequisite and does not
depend on cache state. The complete local and release commands retain the same
audit-first ordering. Every selected package-runtime job also preserves the
separate production audit of the freshly resolved ESM consumer, which is outside
the workspace lockfile and overrides; the release profile proves it on both
runtimes. Intentionally isolated clean-cache consumer tests keep private empty
npm caches. Release publishing retains its uncached, OIDC-scoped boundary and
exact-artifact checks.

## Fixture Lifetime And Cleanup

Prepared package/example output belongs to one suite invocation. Navigation and
design-link specs share one unique read-only ordinary-preview artifact per
browser worker. Before serving, the fixture proves that its owned output path
was absent and validates a current-build ownership marker. Mutable source trees,
Git repositories, generated directories, ports, servers and child processes
remain worker/job local. Setup failure triggers the same cleanup as normal
teardown. Cleanup drains the complete POSIX process group or Windows job before
removing owned output. If termination cannot be confirmed, teardown fails and
retains the owned output for diagnosis; concurrent and repeated close calls
share that same completion or failure.

`changedFixture` owns live test resources through `onCleanup`. It drains them in
reverse registration order before deleting the consumer tree. Every registered
cleanup runs even if another fails; failures retain the tree for diagnosis.
Servers and workers must use this boundary instead of a later test `after` hook,
which can run after directory removal or be skipped when an earlier hook fails.

Every report-producing wrapper creates a unique verification owner identity and
passes its registry and resource root to the child. A wrapper nested beneath
another owner creates a child identity in the same registry; cancellation acts
only on that owner subtree, so concurrent sibling commands cannot terminate or
remove each other's work. Independently grouped process scopes atomically
register before releasing their command worker and unregister only after normal
drainage. Abrupt cancellation signals the direct process tree and every
registered descendant group, rescans for registrations racing with shutdown,
escalates from TERM to KILL within the existing bound, and waits for all groups
to stop before removing the subtree's resources. Invalid ownership records or a
group that cannot be drained fail verification and retain resources for
diagnosis. Windows retains kill-on-close job ownership; the hierarchy adds an
outer cancellation fallback rather than replacing the job boundary.

A dedicated preview-preparation spec still runs the real cold
`npm run preview:build`, verifies generated-output digest stability, and serves
the fresh artifact. Historical rebuilds, source mutation, missing-source export,
clean-install and cache-invalidation behavior continue to create independent
inputs because preparation is part of what those tests verify. Fixture phases
emit `[mokly:fixture-timing]` JSON with the fixture, phase, duration, status,
and whether the operation itself is under test.

Full-catalogue browser preparations share a five-minute setup budget in
`tests/helpers/fixture_timing.ts`. Cold package/example builds, baseline
exports, and ordinary publication fixtures use that budget independently of the
default one-minute browser test timeout. Assertion deadlines, retries, and
worker limits remain unchanged; server readiness retains its own bound.

Wrangler Pages fixtures pass port zero and adopt the exact readiness URL
Wrangler reports; they do not release a probe socket before server startup.
Miniature Playwright projects used inside unit tests set an explicit output
directory beneath their temporary harness so runner metadata cannot enter the
consumer repository's publication fingerprint. Unit tests that fork compiled CLI
entrypoints set an empty `execArgv`, preventing the parent test runner's loader
and concurrency flags from changing child startup behavior.

## Failure, Cancellation And Cleanup

Commands stop their local sequence at the first failure and propagate the
subprocess error. CI cancellation may interrupt a job, but the aggregate treats
that result as unsuccessful. Report-producing wrappers install exit and signal
handling, drain their complete hierarchical ownership subtree, preserve partial
timing evidence when possible, and never write a successful outcome until
independent completeness checks pass.

Temporary fixtures use repository-local `.context` or operating-system temp
directories and remove owned output on success and failure. A fixture drains
dependent servers, workers, watchers, and other runtime resources in reverse
registration order before removing its workspace. Concurrent or repeated fixture
removal shares one teardown, and a dependent cleanup failure retains the
workspace for diagnosis. Tests that create a runtime after obtaining a shared
fixture register that cleanup through the fixture's `beforeRemove` lifecycle;
they must not add a later test-runner teardown hook that can race workspace
removal. Source-level verification enforces this ownership rule for shared
fixture helpers. Failed browser and hydration jobs retain only the uploaded
diagnostic artifacts selected by the workflow. Jobs must not delete, overwrite
or reuse another job's writable output.

## Acceptance Measurement

The baseline is the 18 September 2026
[main run](https://github.com/mokly-ai/mokly/actions/runs/35364820627), which
took 32m43s, and the
[successful PR run](https://github.com/mokly-ai/mokly/actions/runs/35360449325),
which took 31m19s. The main run's Node 22.14 job recorded 13m06s for 1,807 unit
tests, 14m54s for 452 browser tests, 2m18s for package checks and five
consumers, and 36s for dependency and Chromium installation. The run consumed
65.667 summed job minutes. These counts and consumption describe the baseline
only.

Acceptance uses two successful PR workflow runs of the same implementation
commit: one after a controlled fresh npm workflow cache and one with restored
caches. Record wall-clock time to `Required CI`, queue delay, runner
availability/concurrency, the slowest shard, suite and preparation durations,
dynamic inventories, and total runner minutes. Record hosted-run billing/cost
data when GitHub exposes it; otherwise record the applicable repository plan and
the calculated runner-minute consumption.

The initial 6–10 minute goal assumes enough concurrent hosted runners and is not
an acceptance waiver. Queue time and the up-to-22 downstream verification jobs
must be reported separately from execution. Compare shard balance and the
measured setup/teardown phases of the slow export fixtures before changing
partitioning. Coverage, assertion deadlines, worker limits, audits and zero
retry behavior are never relaxed to meet the timing target.

Candidate `992c6a1` passed an empty-start cache attempt and two restored-cache
attempts with complete dynamic inventories on both runtimes. The
[measurement record](../reviews/ci-performance.md) retains all three observed
results, including two queue-constrained misses and a 9m06s `Required CI`
success with all 20 downstream runner slots available. Native whole-file
sharding remains appropriate for the measured workload.
