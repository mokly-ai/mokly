# CI Verification

## Delivery Status

The suite CLI, inventory evidence, parallel workflow graph, and fixture reuse in
this document are implemented. Hosted cold-cache and restored-cache acceptance
measurements are tracked by
[`plans/ci-performance.md`](../../plans/ci-performance.md). The authoritative
complete local and release gate remains `cargo xtask check`.

## Verification Boundary

`cargo xtask check` is the complete local and release verification entrypoint.
With no options it runs every gate sequentially in one checkout, beginning with
the live workspace dependency audit. A selected suite is partial evidence and
must never report that the complete gate passed.

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
| Required CI      | Evaluate the result and evidence from the repository job, both package runtimes, all unit and browser runtime/shard combinations, and both native platforms.                                                                                                                                                                                                                               |

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
its complete explicit file inventory and concurrency limit. Internal prepared
test entrypoints skip preparation, reject arguments other than the optional
shard, and fail when required output is missing. Prepared package commands may
instead receive the archive pair created by the package gate. Xtask suite
invocations prepare their own output and call only the prepared consumers.
Output is reused only for the lifetime of that suite invocation.

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

After the repository job succeeds, the workflow fans out to:

- package jobs on Node 22.14.0 and Node 24;
- four unit shards on each Node runtime;
- four browser shards on each Node runtime; and
- native jobs on macOS and Windows at Node 22.14.0.

Matrix jobs use `fail-fast: false`, so one failing shard does not erase evidence
from its peers. Chromium is installed only in browser jobs. Rust formatting,
Clippy and tests run only in the repository job; selected suite jobs still
compile xtask to dispatch their gate. Jobs that execute npm use npm 11.7.0. All
jobs have read-only repository permissions. Superseded workflow runs remain
cancellable.

The stable `Required CI` job uses `if: always()` and fails closed unless every
required job result is exactly `success`. It also validates the evidence
aggregate described below. A failed, skipped, cancelled, absent, duplicated,
wrong-runtime, wrong-shard, or wrong-commit report fails the aggregate. The
aggregate may not infer success from a matrix job's presence alone.

## Inventory And Report Evidence

Test totals are discovered on the executing runtime; no fixed count is part of
the contract. Before execution, the unit runner independently discovers all
matching `.test.ts` and `.test.tsx` files across the root and viewer suites. The
browser runner independently asks Playwright for the current spec inventory.
Discovery fails on an empty suite.

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
error context. Reports are diagnostic evidence, not a substitute for successful
commands or assertions.

## Dependency Cache And Security

CI caches npm's download cache only. `actions/setup-node` keys it from the
committed `package-lock.json`; jobs that can run historical installs also add a
lockfile read from the merge-base commit. `npm ci` always runs, including after
a cache hit, and every platform's optional native package remains available.
A cache miss is an ordinary cold install and never permits a skipped command.

The live workspace audit runs first in the repository prerequisite and does not
depend on cache state. The complete local and release commands retain the same
audit-first ordering. Both package-runtime jobs also preserve the separate
production audit of the freshly resolved ESM consumer, which is outside the
workspace lockfile and overrides. Intentionally isolated clean-cache consumer
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

A dedicated preview-preparation spec still runs the real cold
`npm run preview:build`, verifies generated-output digest stability, and serves
the fresh artifact. Historical rebuilds, source mutation, missing-source
export, clean-install and cache-invalidation behavior continue to create
independent inputs because preparation is part of what those tests verify.
Fixture phases emit `[mokly:fixture-timing]` JSON with the fixture, phase,
duration, status, and whether the operation itself is under test.

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
handling, preserve partial timing evidence when possible, and never write a
successful outcome until independent completeness checks pass.

Temporary fixtures use repository-local `.context` or operating-system temp
directories and remove owned output on success and failure. Failed browser jobs
retain only the uploaded diagnostic artifacts selected by the workflow. Jobs
must not delete, overwrite or reuse another job's writable output.

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
