# CI Suite Evidence

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This document supplements the [CI verification contract](./ci-verification.md)
with process ownership, test concurrency, failure cleanup, browser shard
balance, and acceptance measurement rules for the viewer and browser suites.
Test timing follows [CI Test Timing](./ci-test-timing.md).

## Fixture Lifetime And Cleanup

A test owns the state it creates. Temporary directories, Git repositories,
ports, servers, and child processes, including the sidecars a `mokly` process
starts, stay worker- or test-local. Test files that run at the same time share
only the read-only source tree and the build under test; no suite shares a
prepared output, a baseline, a compiled example, or a generated tree. Setup
failure triggers the same cleanup as normal teardown. Cleanup drains the
complete POSIX process group or Windows job before it removes owned
directories. If termination cannot be confirmed, teardown fails and keeps the
owned directories for diagnosis; concurrent and repeated close calls share that
same completion or failure.

Browser hosts, served design checks, and packed smoke use the shared Serve
process module under `scripts/verification`. It registers a suspended worker
before releasing the shim. Before signalling a registered group, cleanup
records its process tree and each separate sidecar group. Cleanup drains these
groups even if the test worker stops or Serve needs a forced kill. This tree
drain is the first safeguard. Sidecar parent-death protection is the second:
Linux uses `PR_SET_PDEATHSIG` with `SIGKILL`; a parent-pipe watchdog runs on
every platform. A killed Serve binary therefore ends its sidecars even before
the host begins its drain.

A fixture that owns live resources drains them in reverse registration order
before it deletes its directory. Every registered cleanup runs even if another
fails; a failure keeps the directory for diagnosis. Servers and child processes
use this boundary instead of a later test `after` hook, which can run after
directory removal or be skipped when an earlier hook fails.

Every report-producing wrapper creates a unique verification owner identity and
passes its registry and resource root to the child. A wrapper nested beneath
another owner creates a child identity in the same registry; cancellation acts
only on that owner subtree, so concurrent sibling commands cannot terminate or
remove each other's work. Independently grouped process scopes atomically
register before releasing their command worker and unregister only after
normal drainage. Abrupt cancellation signals the direct process tree and every
registered descendant group, rescans for registrations racing with shutdown,
escalates from TERM to KILL within the existing bound, and waits for all groups
to stop before removing the subtree's resources. Invalid ownership records or a
group that cannot be drained fail verification and keep resources for
diagnosis. Windows keeps kill-on-close job ownership; the hierarchy adds an
outer cancellation fallback rather than replacing the job boundary. The
process-owner record is the version 1 shape of the
[format inventory](./mokly-format-versions.md).

Browser global setup starts the example servers and waits for their readiness
within a ten-minute setup budget, independent of the default one-minute browser
test timeout. Server readiness has its own bound, and assertion deadlines and
retries do not change. Fixture phases emit `[mokly:fixture-timing]` JSON with
the fixture, phase, duration, status, and whether the operation itself is under
test. Tests that fork compiled Node entry points set an empty `execArgv`, so
the parent test runner's loader and concurrency flags cannot change child
startup behavior.

## Test Concurrency

`scripts/verification/concurrency.mjs` owns how many tests run at once. Node
runs at most half of `os.availableParallelism()` test files at once, and never
fewer than two. Playwright uses one worker unless `MOKLY_PLAYWRIGHT_WORKERS` is
set. Each spec file runs in one worker because `fullyParallel` stays `false`.
The 2-vCPU hosted runners therefore run two Node test files and one Playwright
worker, and an eight-CPU workstation runs four Node test files.

Browser specs keep one worker by default. The viewer gives a same-origin
preview five seconds to load, as the
[frame adapter contract](./mokly-frame-adapter.md) states, and the first
on-demand render of a page can exceed that while other workers load the CPU.
Pages that load correctly alone then fail.

`MOKLY_UNIT_CONCURRENCY` replaces the Node test file limit and
`MOKLY_PLAYWRIGHT_WORKERS` replaces the Playwright worker count. Each accepts
only a positive decimal integer without a sign or leading zero, up to
JavaScript's maximum safe integer. Any other value stops the command before
tests start. Both runners print the value they use.

Each Playwright worker owns one example server. Global setup starts and readies
the workers concurrently. It starts the shim
with `--base refs/mokly/browser-suite-no-base --no-watch --port 0 --sidecars 1`.
The shared example does not test Changes. Its intentionally unresolved base
produces `unavailable` and one `git-failed` diagnostic. Real Changes specs
own separate Git fixtures. Serve binds a free loopback port and
prints its listening address. Setup waits for the initial usage publication
and for Changes to leave its pending or preparing state. It fails on an
unavailable example render. It publishes the addresses to workers through
`MOKLY_PLAYWRIGHT_URLS`; `TEST_PARALLEL_INDEX` selects each worker's address.
There is no fixed port range and no reuse of an existing server. A server renders
through its render graph and sidecar pool. Each process keeps its own cache.
Use `MOKLY_PLAYWRIGHT_WORKERS` rather than Playwright's `--workers`: setup
rejects a worker count above the number of servers.

`MOKLY_PLAYWRIGHT_STATIC_DIR` selects an already-built catalogue directory.
The same host interface serves its exact files and directory indexes on a free
port. This mode neither builds the site nor adds fallback routes. The default
host remains Serve. `MOKLY_PLAYWRIGHT_FILE_DIR` also selects this static host
for Browse pages and opens portable design documents from that directory with
`file://` URLs. Its supported specs are listed in
[developer commands](./developer-test-commands.md#browser-selection). These
delivery modes are manual checks; continuous runs and the private file fixture
belong to M8's copied-static-output TODO. Fixtures that test private inputs
still own their own hosts.

Browser specs support POSIX systems only. Specs must not depend on an empty Changes set:
remote Testboxes hold branch edits as working-tree changes against their base.

## Failure, Cancellation And Cleanup

Commands stop their local sequence at the first failure and propagate the
subprocess error. CI cancellation may interrupt a job, but the aggregate treats
that result as unsuccessful. Report-producing wrappers install exit and signal
handling, drain their complete hierarchical ownership subtree, preserve partial
timing evidence when possible, and never write a successful outcome until
independent completeness checks pass.

Temporary fixtures use repository-local `.context` or operating-system temp
directories and remove owned output on success and failure. A fixture drains
dependent servers, child processes, watchers, and other runtime resources in
reverse registration order before removing its workspace. Concurrent or
repeated fixture removal shares one teardown, and a dependent cleanup failure
keeps the workspace for diagnosis. A test that creates a runtime after it
obtains a shared fixture registers that cleanup through the fixture's
`beforeRemove` lifecycle; it must not add a later test-runner teardown hook that
can race workspace removal. The ESLint rule `mokly/no-late-fixture-teardown`
enforces this ownership rule in every JavaScript and TypeScript module under
`tests/`: within the module scope and within each function, it reports a member
call named `after`, such as `t.after(...)`, that starts at or after the first
shared-fixture call in the same scope. A call inside a nested function belongs
only to that function's scope. Failed browser jobs keep only the uploaded
diagnostic artifacts selected by the workflow. Jobs must not delete, overwrite,
or reuse another job's writable output.

A fixture shared across a test file registers its teardown synchronously when
the file loads and starts setup on first use. Teardown waits for setup to
settle, then runs owned cleanups in reverse registration order, even if setup
failed. It attempts every cleanup before reporting a cleanup failure. A run that
selects none of the file's tests starts no setup and leaves no owned output.
Module-scope code must not start fixture setup eagerly. The file fixture helper
under `tests/helpers/` provides this boundary; the ESLint rule
`mokly/no-eager-fixture-setup` rejects a shared-fixture call that is not inside
a function, in any JavaScript or TypeScript module under `tests/`.

## Browser Shard Balance

Playwright assigns whole spec files to the four `chromium` shards and balances
them by test count. The evidence aggregate requires browser shard file
assignments to be pairwise disjoint; every browser spec therefore stays whole,
and no spec uses parallel mode.

The aggregate also bounds balance. After the browser test assignments prove
disjoint and complete, `validateShardReports` in
`scripts/verification/report-validation.mjs` applies the bound in
`scripts/verification/shard-balance.mjs`. The limit is the `fullTests`
inventory divided by the shard count, times `BROWSER_SHARD_SHARE_LIMIT` (1.25),
rounded up. The group fails at the first shard whose `assignedTests` count
exceeds that limit, with this message:

```text
browser shard <index>/<total> holds <count> of <inventory> tests, above the limit of <limit>; split a large spec into smaller spec files
```

The bound uses test counts because that is what Playwright balances; shard
durations stay a measurement from the shard reports. It runs wherever shard
reports are validated: `Required CI`, the remote Testbox gate, and release
evidence validation, where a shard above the limit makes the evidence invalid
and stops the publish. The local sequential gate runs unsharded and does not
apply it. No test lists the Playwright inventory to check balance; a tooling
test checks the bound with synthetic shard reports.

## Acceptance Measurement

Acceptance of a change to the CI partition or runner policy uses two successful
pull request workflow runs of the same commit: one after a controlled fresh npm
workflow cache and one with restored caches. Record the wall-clock time to
`Required CI`, queue delay, runner availability and concurrency, the slowest
shard, suite and server-readiness durations, the dynamic inventories, and
total runner minutes. Record hosted-run billing data when GitHub exposes it;
otherwise record the applicable repository plan and the calculated
runner-minute consumption. Keep the measurement record under `.context/`.

Queue time and the downstream verification jobs are reported separately from
execution. Compare shard balance and the measured server-readiness phases
before changing partitioning, and confirm the resulting shard layout with
actual CI reports before claiming a balance improvement. Coverage, assertion
deadlines, worker limits, audits, and zero-retry behavior are never relaxed to
meet a timing target. Hosted runners keep the worker limits that
[Test Concurrency](#test-concurrency) derives for their CPU count. Whole-file
sharding is the partition; the browser balance rule above records its
boundary.
