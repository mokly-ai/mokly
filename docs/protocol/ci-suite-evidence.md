# CI Suite Evidence

This document supplements the [CI verification contract](./ci-verification.md)
with process ownership, test concurrency, failure cleanup, browser errors, and
browser shard balance for the viewer and browser suites. Test timing follows
[CI Test Timing](./ci-test-timing.md).

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

Browser hosts, served design checks, and packed smoke start Serve as a
registered process group of their verification owner. Cleanup drains Serve's
process tree and each separate sidecar group, even if the test worker stops or
Serve needs a forced kill. A killed Serve binary also ends its sidecars itself,
on every platform, before the host begins its drain.

A fixture that owns live resources drains them in reverse registration order
before it deletes its directory. Every registered cleanup runs even if another
fails; a failure keeps the directory for diagnosis. Servers and child processes
use this boundary instead of a later test `after` hook, which can run after
directory removal or be skipped when an earlier hook fails.

Every report-producing wrapper is a verification owner with a unique identity.
A wrapper nested beneath another owner is a child owner in the same registry.
Cancellation acts only on that owner's subtree, so concurrent sibling commands
cannot terminate or remove each other's work. Every process group that a test
helper creates, including fault commands and detached Serve helpers, joins its
owner before its command runs and leaves only after normal drainage. Abrupt
cancellation signals the direct process tree and every registered descendant
group, including a group that registers during shutdown. It escalates from TERM
to KILL within its bound. It waits for every group to stop before it removes
the subtree's resources. Invalid ownership records or a group that cannot be
drained fail verification and keep resources for diagnosis. Windows keeps
kill-on-close job ownership; the hierarchy adds an outer cancellation fallback
rather than replacing the job boundary. The process-owner record is the
version 1 shape of the [format inventory](./mokly-format-versions.md).

Browser global setup starts the example servers and waits for their readiness
within a ten-minute setup budget, independent of the default one-minute browser
test timeout. Server readiness has its own bound, and assertion deadlines and
retries do not change. Fixture phases emit `[mokly:fixture-timing]` JSON with
the fixture, phase, duration, status, and whether the operation itself is under
test.

## Test Concurrency

Node runs at most half as many test files at once as the host's available
parallelism, and never fewer than two. Playwright uses one worker unless
`MOKLY_PLAYWRIGHT_WORKERS` is set. Each spec file runs in one worker because
`fullyParallel` stays `false`. A 2-vCPU or 4-vCPU runner therefore runs two
Node test files and one Playwright worker. An eight-CPU workstation runs four
Node test files. Hosted runners keep these limits for their CPU count.

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
unavailable example render. There is no fixed port range and no reuse of an
existing server. Each server keeps its own render cache.
Use `MOKLY_PLAYWRIGHT_WORKERS` rather than Playwright's `--workers`: setup
rejects a worker count above the number of servers.

Global setup starts Serve readiness and both copied builds concurrently under
one cancellation signal and setup budget. It builds the example with
`mokly build --no-changes`. It builds native Changes from a separate temporary
Git repository with two commits, independent of checkout depth. It copies only
build output, removes the original build and fixture sources, and serves each
copy through an exact-file host inside the same four shards. A shard shares
its immutable copies; different runs own different directories. A setup
failure cancels sibling work, waits for every task to settle, then drains all
created hosts before removing output. Teardown attempts every cleanup and
restores every fixture environment variable.

`MOKLY_PLAYWRIGHT_STATIC_DIR` selects an already-built catalogue directory.
The same host interface serves its exact files and directory indexes on a free
port. This mode neither builds the site nor adds fallback routes. The default
host remains Serve. `MOKLY_PLAYWRIGHT_FILE_DIR` also selects this static host
for Browse pages and opens portable design documents from that directory with
`file://` URLs. Its supported specs are listed in
[developer commands](./developer-browser-commands.md#browser-selection). An
explicit directory is also the input of the suite's isolated current-only copy.
Its index must have `changesStatus: "disabled"`; otherwise setup rejects it with
an instruction to build with `--no-changes`. The comparison fixture always
owns a fresh build. CI and the complete local gate check both static HTTP and
direct `file://` delivery against a fresh example build. Remote verification
runs these checks as its separate
[static-delivery command](./remote-verification-testbox.md#remote-commands).
The four-shard inventory stays unchanged. Selected delivery reports cannot
replace complete browser evidence. Each mode requires a nonempty inventory and
exactly one passing result per assigned test.
Fixtures that test private inputs still own their own hosts.

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
obtains a shared fixture registers that cleanup with the fixture, so that it
runs before the workspace removal. It must not add a later test-runner
teardown hook that can race workspace removal. The ESLint rule
`mokly/no-late-fixture-teardown` enforces this ownership rule in every
JavaScript and TypeScript module under `tests/`. It reports a test-runner
`after` call that follows the first shared-fixture call in the same scope.
Failed browser jobs keep only the uploaded diagnostic artifacts selected by the
workflow. Jobs must not delete, overwrite, or reuse another job's writable
output.

A fixture shared across a test file registers its teardown synchronously when
the file loads and starts setup on first use. Teardown waits for setup to
settle, then runs owned cleanups in reverse registration order, even if setup
failed. It attempts every cleanup before reporting a cleanup failure. A run that
selects none of the file's tests starts no setup and leaves no owned output.
Module-scope code must not start fixture setup eagerly. The ESLint rule
`mokly/no-eager-fixture-setup` rejects a shared-fixture call that is not inside
a function, in any JavaScript or TypeScript module under `tests/`.

## Browser Errors

Every browser spec fails on an unexpected console error or page error. This
covers the default context, extra contexts, and popups, including pages that a
test closes. Two console notices are expected in every spec. The first is a
script that a viewer-owned sandboxed frame (`/static/`, a temporary render, or
`about:srcdoc`) blocked. The second is the exact `about:blank` denial from
Playwright's recorder or clock injection, with an empty or `about:blank`
source location. A test that causes another error declares its kind and exact
message pattern. A console resource failure also declares the exact resource
URL. Sandbox denials, synthetic console sentinels, and page errors can omit the
URL when their location is unstable or absent; their exact message must
identify the expected failure. No sleep synchronizes an assertion.

## Browser Shard Balance

Hosted CI and remote verification assign whole spec files to four `chromium`
shards using measured per-test costs. The evidence aggregate requires file
assignments to be pairwise disjoint; every browser spec therefore stays whole,
and no spec uses parallel mode.

The aggregate also bounds shard size. After the browser test assignments prove
disjoint and complete, the limit is the complete test inventory divided by
the shard count, times 1.25, rounded up. The group fails at the first shard whose test count
exceeds that limit, with this message:

```text
browser shard <index>/<total> holds <count> of <inventory> tests, above the limit of <limit>; split a large spec into smaller spec files
```

Scheduling keeps this count bound while balancing estimated work. Every
discovered test must run, including tests without a prior duration sample.
Rebalancing targets shard durations within 15 percent of each other.
Durations stay observations, not passing conditions for tests.
The count bound runs wherever shard
reports are validated: `Required CI`, the remote Testbox gate, and release
evidence validation, where a shard above the limit makes the evidence invalid
and stops the publish. The local sequential gate runs unsharded and does not
apply it. The [verification script reference](../../scripts/verification/README.md#browser-partitioning)
describes the scheduling inputs and discovery boundary.

Coverage, assertion deadlines, worker limits, audits, and zero-retry behavior
are never relaxed to meet a timing target. Job hang guards follow the
[CI workflow graph](./ci-workflow.md#job-execution).
