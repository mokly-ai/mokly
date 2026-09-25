# CI Evidence, Cache And Cleanup

Continuation of [CI Verification](./ci-verification.md).

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
the fresh artifact. Historical rebuilds, source mutation, missing-source
export, clean-install and cache-invalidation behavior continue to create
independent inputs because preparation is part of what those tests verify.
Fixture phases emit `[mokly:fixture-timing]` JSON with the fixture, phase,
duration, status, and whether the operation itself is under test.

Full-catalogue browser preparations share a five-minute setup budget in
`tests/helpers/fixture_timing.ts`. Cold package/example builds, baseline exports,
and ordinary publication fixtures use that budget independently of the default
one-minute browser test timeout. Assertion deadlines, retries, and worker limits
remain unchanged; server readiness retains its own bound.

Wrangler Pages fixtures pass port zero and adopt the exact readiness URL
Wrangler reports; they do not release a probe socket before server startup.
Miniature Playwright projects used inside unit tests set an explicit output
directory beneath their temporary harness so runner metadata cannot enter the
consumer repository's publication fingerprint. Unit tests that fork compiled
CLI entrypoints set an empty `execArgv`, preventing the parent test runner's
loader and concurrency flags from changing child startup behavior.

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
registration order before removing its workspace. Concurrent or repeated
fixture removal shares one teardown, and a dependent cleanup failure retains
the workspace for diagnosis. Tests that create a runtime after obtaining a
shared fixture register that cleanup through the fixture's `beforeRemove`
lifecycle; they must not add a later test-runner teardown hook that can race
workspace removal. Source-level verification enforces this ownership rule for
shared fixture helpers. Failed browser jobs retain only the uploaded diagnostic
artifacts selected by the workflow. Jobs must not delete, overwrite or reuse
another job's writable output.

## Acceptance Measurement

The baseline is the 18 September 2026
[main run](https://github.com/mokly-ai/mokly/actions/runs/35364820627), which
took 32m43s, and the
[successful PR run](https://github.com/mokly-ai/mokly/actions/runs/35360449325),
which took 31m19s. The main run's Node 22.14 job recorded 13m06s for 1,807 unit
tests, 14m54s for 452 browser tests, 2m18s for package checks and five consumers,
and 36s for dependency and Chromium installation. The run consumed 65.667
summed job minutes. These counts and consumption describe the baseline only.

Acceptance uses two successful PR workflow runs of the same implementation
commit: one after a controlled fresh npm workflow cache and one with restored
caches. Record wall-clock time to `Required CI`, queue delay, runner
availability/concurrency, the slowest shard, suite and preparation durations,
dynamic inventories, and total runner minutes. Record hosted-run billing/cost
data when GitHub exposes it; otherwise record the applicable repository plan
and the calculated runner-minute consumption.

The initial 6–10 minute goal assumes enough concurrent hosted runners and is not
an acceptance waiver. Queue time and the up-to-twenty downstream verification
jobs must be reported separately from execution. Compare shard balance and the
measured setup/teardown phases of the slow export fixtures before changing
partitioning. Coverage, assertion deadlines, worker limits, audits and zero
retry behavior are never relaxed to meet the timing target.

Candidate `992c6a1` passed an empty-start cache attempt and two restored-cache
attempts with complete dynamic inventories on both runtimes. The
[measurement record](../reviews/ci-performance.md) retains all three observed
results, including two queue-constrained misses and a 9m06s `Required CI`
success with all 20 downstream runner slots available. Native whole-file
sharding remains appropriate for the measured workload.
