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

The [fixture README](../../tests/fixtures/large/README.md) describes setup/caching for 1,590 entries and 5,550 documents.
Samples report startup/Props/preview/Changes times, baseline phases, classification
inline/CSS shares or incomplete bounds, and available heap/document-work counts.
The [benchmark contract](../../tests/fixtures/large/benchmark-contract.md)
owns identity, scenarios and acceptance; CI has no wall-clock assertion.
