# CI Verification

## Delivery Status

The suite CLI, inventory evidence, event-specific parallel workflow graph, and
fixture reuse in this document are implemented. The
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

The ESLint configuration derives global ignores from the repository
`.gitignore`, then layers its broader ESLint-only ignores. Git-ignored build,
cache, report and tool scratch paths are therefore outside the repository gate
even when an earlier suite leaves them in the checkout; in particular, Wrangler
scratch from the browser suite cannot make a later complete gate fail.

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

The supported range is Node.js `>=22.14.0 <24.14.0` or `>=24.19.0`. Node
24.14.0 through 24.18.x can abort concurrent ESM-to-CommonJS loading before
JavaScript can handle an error. The upstream
[`cjs_lexer::Parse` empty-`MaybeLocal` fix](https://github.com/nodejs/node/pull/63885)
shipped in Node 24.19.0. Lazy-loading individual dependencies reduces exposure
but cannot remove this process-wide parser path, so the CLI rejects affected
versions before loading its application modules.

Local verification uses the supported floor at 22.14.0 and Node 24.21.0. Those
are the tested representatives rather than the bounds of the supported range.
The repository's `.node-version` and preview workflow remain pinned to
24.21.0. CI resolves the latest Node 24 patch once per run, and publishing
resolves its own latest patch. The dependency-free CLI bootstrap owns the
support bounds and local tested-version list; tests keep that range aligned
with the package engines, lockfile, README and `.node-version`, and separately
validate the event-selected CI runtime profiles.

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
