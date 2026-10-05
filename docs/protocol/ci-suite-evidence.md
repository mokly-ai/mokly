# CI Suite Evidence

This document supplements the [CI verification contract](./ci-verification.md)
with fixture ownership, failure cleanup, browser shard balance, and acceptance
measurement rules for the unit, browser, and hydration suites.

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

Ordinary-preview artifacts are prepared in an owned Node child process. This
keeps React rendering outside Playwright's expanded debug-stack context. The
five-minute fixture limit stays unchanged. The child's preparation deadline
leaves ten seconds for process drainage before that fixture limit expires.

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

## Browser Shard Balance

Playwright assigns whole non-hydration spec files to the `chromium` browser
shards and balances them by test count. Specs whose filenames contain
`hydration` run unsharded in the separate `hydration` project and CI job, so
they do not participate in browser shard balance. The evidence aggregate
requires browser shard file assignments to be pairwise disjoint; every browser
spec therefore stays whole and no spec uses parallel mode.

[`tests/browser_shard_balance.test.ts`](../../tests/browser_shard_balance.test.ts)
first lists the all-project Playwright inventory, then the complete `chromium`
inventory and each `chromium` shard in the CI browser job's matrix. It fails
when any shard holds more than 125% of an even share of the browser tests, and
it runs the aggregate's `validateShardReports` over reports whose
`playwrightFiles` carry the all-project inventory while `fullFiles` and
`fullTests` carry the `chromium` inventory. A spec split across shards therefore
fails before CI does.

The test performs each listing one at a time. Playwright writes compiled test
modules to a shared on-disk cache without an atomic rename, so concurrent
listings on an empty cache can load a module that another listing is still
writing. The bound applies to test counts, because that is what Playwright
balances; shard durations remain a measurement from the shard reports. When the
bound fails, split a large non-hydration spec into smaller spec files.

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
sharding remains appropriate for the measured workload; the browser balance
rule above records the current partition boundary.
