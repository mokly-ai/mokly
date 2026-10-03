# CI Fixture Preparation And Lifetime

## Delivery Status

The existing fixture lifecycle, cancellation and historical CI acceptance
sections below describe implemented behavior. The shared example-baseline
preparation section is the approved Milestone 14 target in
[Generated Output Simplification](../../plans/generated-output-simplification.md)
(finding 34 option C). No test implementation changes in this documentation step.
See [CI verification](./ci-verification.md) for suite boundaries and evidence.

## Shared Example Baseline Preparation

Playwright global setup prepares the unchanged example baseline repository and
its rebuilt v8 baseline cache exactly once per browser-suite invocation, before
any test starts. This includes filtered runs and each independent CI shard/job;
no writable checkout or cache is shared between invocations, runtimes or jobs.
Keep the existing global setup's ready-Serve work as well.
Listing/discovery does not trigger this preparation; it runs before execution.

After the main merge, audit every browser fixture that reconstructs this same
example baseline, including indirect helper callers. The current users are
`static-example` in `tests/browser/static_example.spec.ts` and
`design-library-export` in `tests/browser/design_library_export.spec.ts`, through
`tests/helpers/example_baseline.ts`. Record the complete merged call-site list
in the plan before implementing reuse; do not assume these remain the only two.
Only identical baseline inputs share this preparation.

Global setup must:

1. Create a unique owned root under repository `.context/`, using the existing
   verification owner/cleanup boundary. Copy the real example sources and
   tooling, create its Git baseline commit and retain the exact commit id.
2. Invoke the real baseline preparation path once with that fixture's actual
   configuration and recipe. Require a complete v8 manifest, inventory, authored
   closure and completion marker. Do not fake a cache hit, change the recipe,
   track generated output or use the working checkout as the baseline repository.
3. Finish and drain all preparation processes, then publish a run-scoped
   descriptor atomically. It records the prepared root, pinned commit, requested
   catalogue/config path and recipe identity. A worker must receive that exact
   descriptor, not discover a newest directory or rely on module-global memory.
4. Treat the prepared repository and completed cache as immutable templates.
   A missing, partial, mismatched or invalid template fails setup/the consuming
   fixture; never silently rebuild separately in each ordinary fixture.

Every consuming fixture gets its own writable repository/source copy and local
copy of the completed cache, preserving the same baseline commit, relative
catalogue root and recipe. Do not share `.git` refs/index, cache locks/markers,
source edits, generated output, export destinations, ports or server processes.
Use copies or independent clones without hard links for mutable data; no
symlinked cache output. Do not copy live locks, partial source extractions or
transaction leftovers. Existing marker and inventory validation must establish
that the copied cache is a real warm hit; copying is not permission to skip it.

The design-library fixture applies its source edit only after acquiring that
independent copy. The static-example fixture retains its unchanged-HEAD checks.
Neither may write back into the global template. Global teardown runs after
all workers/fixtures drain their resources and removes the template through
its owner. Setup failure and cancellation use the same bounded cleanup path;
unconfirmed termination fails verification and retains diagnostic files.

## Cold Operations And Time Limits

Keep exactly one browser test whose operation under test is a real cold
example-baseline rebuild. It uses an independent empty cache, observes the
actual install/build commands, and verifies the resulting v8 cache/inventory
and comparison result. It must not consume the warmed cache. Identify and
retain that owning test after the merge, adding an explicit regression if cold
work previously happened only incidentally in fixture setup. Keep every
existing UI assertion in the ordinary fixtures that now reuse preparation.

Also retain `tests/browser/preview_preparation.spec.ts` and its real cold
`npm run preview:build`, absent-output proof, generated-byte stability and
fresh-publication checks. It remains independent of the shared baseline setup;
do not replace its operation with a copied prebuilt preview. Other tests may
reuse setup only when setup is not the operation they verify. This decision
does not remove unit/integration baseline, lock, cancellation, invalidation,
source-mutation or clean-install coverage, or change what the preview test builds.

Keep `REAL_EXPORT_FIXTURE_TIMEOUT_MS = 600_000` (600 seconds) unchanged. Apply
the same 600-second ceiling to the one global baseline preparation operation;
do not move repeated unbounded work into global setup. Do not change assertion
deadlines, worker count, retries, sharding, coverage requirements or the full gate.

## Timing And Acceptance For Shared Preparation

Before implementing Milestone 14, measure the merged branch with the old fixture
preparation. Repeat after the change with the same runtime, npm, Chromium,
hardware, worker/shard selection and controlled cache conditions. Record full
browser-suite wall time, startup/global setup/teardown time, complete test
inventories and all fixture phase timings. Report any measurement difference
that prevents a direct comparison; do not compare only assertion durations.

Keep `[mokly:fixture-timing]` records with schema version, fixture, phase,
`durationMs`, status and `operationUnderTest`. Record global source/Git setup,
real baseline install/build/total and each fixture's copy, cache validation and
export phases. Ordinary preparation is `operationUnderTest: false`; the
retained cold-baseline and preview-build operations are true. Warm consumers
must report absent install/build phases as `not-observed` with null duration,
not invented zeroes. Count rebuilds of this shared example baseline: one global
preparation plus the one cold-baseline regression. Report the separate preview
operation and any Serve preparation of a different pinned base on their own
terms. No ordinary consumer may cause another equivalent baseline rebuild.

Acceptance proves isolation between source-mutating fixtures, immutable template
bytes/refs, warm hits for every audited consumer, failed/cancelled preparation
cleanup and continued real cold coverage. Record before/after results in the
plan with retained logs under `.context/`. Run the complete gate, commit and
push before the Milestone 15 review. A timing improvement cannot waive a test,
change the 600-second limit or hide preparation in an unmeasured phase.

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
Fixtures that install, build, and export the complete example share a
600-second setup budget. Assertion deadlines, retries, and worker limits remain
unchanged.

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
