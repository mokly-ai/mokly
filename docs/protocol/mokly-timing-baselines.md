# Baseline And Fixture Timings

Continuation of [mokly-timings](./mokly-timings.md).

## Historical baseline phases

`baseline.resolve` measures repository-root validation and resolving (or accepting
an already pinned) merge-base commit. It precedes the `baseline` builder span,
which includes cache validation, lock waiting, extraction, commands, output
adoption and cleanup. Both run in the process owning preparation, never inside
the disposable classification worker. A failed phase ends with `status: error`;
diagnostics retain neither the command argv nor captured error output.

On a cache miss, `baseline.extract` includes Git object validation, archive
reading and confined extraction. Each configured argv has its own zero-based
`baseline.command[<index>]` span, including non-zero-exit validation. The exact
configured command list is unchanged by profiling. `baseline.adopt` includes
baseline-manifest/output validation, output adoption, deleting source and
writing the completion marker. The parent ends after cleanup and lock release,
with `cacheHit: false`. A reused entry ends with `cacheHit: true` and omits the
extraction, command and adoption spans. A waiter can also finish as a cache hit.

## Representative local fixture

The repository's large consumer is synthetic and opt-in. Its generator and
screen/component templates live under `tests/fixtures/large`. A small instance
of the same generator runs in automated tests. A full-sized instance must be
smoke-tested using the opt-in browser benchmark's under-five-second usable-startup
assertion. It runs with other heavy checks idle; CI's small correctness fixtures
have [no machine-specific wall-clock assertion](./ci-test-timing.md).

The [fixture README](../../tests/fixtures/large/README.md) describes setup/caching for 1,590 entries and 5,550 documents.
Samples report startup/Props/preview/Changes times, baseline phases, classification
inline/CSS shares or incomplete bounds, and available heap/document-work counts.
The [benchmark contract](../../tests/fixtures/large/benchmark-contract.md)
owns identity, scenarios and the procedure for later acceptance.
CI follows [deterministic test timing](./ci-test-timing.md).

`fixture:large` explicitly prepares and records an isolated baseline under
`.context`; setup time includes the toolchain install and Git. It also includes
exhaustive Build when `--tracked-output` is set. Setup time is reported separately.
`dev:large` and `benchmark:large` reuse that fixture without compiling the package.
Rebuild Mokly explicitly after package-source edits. A fixture whose generated
output is tracked reuses complete Git blobs. The default fixture ignores
`mokly-generated/` and commits only source, authored resources and tooling.
Setup always archives a packaged Mokly version and a consumer lockfile and
installs the fixture's toolchain. For the default fixture, Serve rebuilds the archived
commit through its `baselineBuild` recipe; no cached or committed HTML stands in
for that build.
The benchmark launches Chrome before timing a fresh Serve subprocess and measures
searchable navigation with real preview content, then repeats in a fresh server
and browser context for an OS-warm restart. “Cold” means application-cold, not a
flushed OS page cache. It also verifies theme/viewport changes, a real Props edit,
whole-document pages and eventual Changes. Stdout reports each measurement as JSON.

For the rebuilt-baseline fixture, the benchmark clears only the pinned cache entry under the
builder's exclusive lock before the cold run. A locked entry fails setup; stop
other fixture servers before benchmarking. The warm run retains that output.
Both runs enforce `usableMs < 5000` and require successful baseline timings with
`cacheHit: false` and `true` respectively. `baselineMs` measures the whole builder;
`baselineReadyMs` measures command start to receipt of its completion, using the
benchmark process's clock. `preparingToPendingMs` is the cold builder duration,
or zero when preparing is skipped on a hit. This phase measurement remains
available even on Serve versions without the `preparing` presentation; it is
not a browser paint measurement. `baselinePhases` records extraction, each
command, and adoption separately. `changesReadyMs` still waits for delivered
complete Changes in Browse. No wall-clock threshold is imposed on rebuilds.
