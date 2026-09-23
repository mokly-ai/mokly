# Complete Local Verification

## Entry Point And Ordering

`cargo xtask check` without a suite or shard is the only complete local gate.
First run the live `npm run dependencies:check` in the initiating checkout; no
snapshot, build, or downstream gate may start if that audit fails. The remaining
repository checks, package checks, four whole-file unit shards and four native
Playwright shards may run concurrently in isolated snapshots, capped at four
process-level workers or the available CPU count, whichever is lower. Prefer
the measured long shards early without changing shard assignment. Repository
and package commands retain their existing order within each suite. `--suite`
and `--shard` keep their existing sequential, partial
behavior, including each selected suite's prerequisite preparation.

An inability to create _any_ snapshots before dispatch may trigger the original
sequential complete gate. Print an unmistakable fallback diagnostic; repeat the
audit if the sequential repository suite does so. Never fall back after any
worker has started or after source drift, failed tests, invalid evidence, or
failed cleanup. A fallback still requires every gate and every unsharded test.

## Source And Output Isolation

Freeze the initial Git index and working-tree view: copy exactly the on-disk
contents and executable modes of all tracked and non-ignored untracked files,
including staged and unstaged changes, symlinks, and staged deletions. Ignore
only Git-ignored local artifacts; never build from `HEAD` while omitting local
edits. Each worker's independent checkout exposes the initiating `HEAD`, full
Git history and `origin/main` for baseline-dependent fixtures. Keep the user's
branch, index, source files, and ignored build artifacts untouched. Each worker
owns its writable build, generated example, report, fixture, test-output and
package directories; immutable installed dependencies may be shared. No worker
may reuse a sibling's writable outputs. Playwright workers get different free
ports and continue to refuse reuse of preexisting servers.

Hash the initial source inventory (paths, file type, mode and contents) before
dispatch and verify each copied snapshot matches it. Recheck the initiating
checkout at the end, and on worker completion where possible; changes to the
source inventory or file contents during the gate fail the complete check even
if every test succeeded. Output outside the inventory is never silently
substituted for a source file. Only temporary paths and process groups created
and verified as owned by this invocation may be removed; if ownership or
drainage cannot be proved, fail and retain resources for diagnosis.

## Failure, Cancellation And Evidence

Stop starting new tasks on the first failure. Drain active child process trees
and their descendants before cleanup; on SIGINT/SIGTERM, signal, escalate within
a bound, and wait before removing owned resources. Register every independently
grouped verifier subprocess with its process owner so ancestor cancellation can
find it even if an intermediate runner exits. The Playwright web server registers
its own process group at startup, before listening, so it is still drained if
Playwright exits early. An interrupted check reports the initiating signal
instead of a failure caused by stopping its children. Do not return a success or
replace a failure with a secondary cleanup error. Conflicting ports are a
failure or cause another free port to be selected _before_ dispatch, never an
excuse to attach to another process.

Unit runners discover the current `.test.ts(x)` file inventory once per runner
and Node distributes complete files across four shards. Browser runners discover
the current Playwright inventory, including one independent, normally timed
development hydration test per generated route; Playwright distributes complete
specs across four shards. Keep at most two simultaneous unit files per runner,
one Playwright worker per runner, zero browser retries, and all assertions. The
real browser preview-build preparation has its own seven-minute fixture budget:
one combined-tree run completed its build in 297 seconds and another exceeded
the former five-minute setup deadline under four-worker contention. Its browser
assertions retain the default test deadline; other full-catalogue setups retain
five-minute budgets. No fixed file or test totals or filtered selections
represent a complete gate. The local aggregator reads only the eight reports from _this_
invocation. Reuse the CI validators: all four shards per suite must have the
same commit and Node runtime, complete independent discovery, nonempty disjoint
assignments, no skipped/cancelled/failed tests, and observed unions exactly
equal to the discovered unit files and browser test IDs. Missing, stale,
duplicate, or unexpected reports fail closed. CI retains four shards on its
required Node 22 runtime; release pull requests add Node 24 with the same
report identities and aggregate contract.

## Measurement

Record total wall time, preparation and per-suite/shard wall time, the dynamic
unit-file and browser-test counts, CPU load, and cold setup separately. Two
successful warm runs on the same eight-CPU machine measure improvement against
the 39m01s September 22, 2026 complete-gate baseline; a cold run is not a
warm-cache comparison. The [measurement record](../reviews/local-verification-performance.md)
contains commands, environment, timings and any misses. Never substitute a
shard, skipped test, different source revision, or hosted CI result for a
successful full local run.
