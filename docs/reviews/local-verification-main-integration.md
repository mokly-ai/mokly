# October Main Integration Verification

On October 5, 2026, merge `40135a9e` integrated `origin/main` at `800fe9f8`
into `calummoore/newport-beach-v3`, from source tip `72fa0309`.
The [plan](../../plans/local-verification-performance.md#milestone-5-integrate-october-main-changes)
records the conflict decisions and verification changes.

## Complete Gate

`cargo xtask check` passed in **54m56.047s** with exit code zero. The environment
was Linux x86_64, Node 24.21.0, npm 11.19.0, and Cargo 1.98.1. Node exposed seven
available CPUs on an eight-logical-CPU VM. The runner admitted two jobs at once;
each unit runner retained two-file concurrency, and browser runners retained
one worker and zero retries.

| Suite                 | Passing tests | Complete inventory           |
| --------------------- | ------------: | ---------------------------- |
| Node unit/integration |         3,674 | 643 files                    |
| Browser               |           740 | 138 specs across four shards |
| Hydration             |           223 | 11 specs, unsharded          |
| Rust                  |            17 | xtask tests                  |

All **4,654 tests** passed. The nine unit/browser/hydration reports contained no
failures, skips, cancellations, missing files, or duplicate assignments.
The gate also passed formatting, lint, source/export audits, type checks,
package and example builds, generated-output checks, and packed-consumer smokes.
The workspace dependency audit retained main's approved expiring exception;
packed-consumer audits retained their existing rules.

## Source Identity And Preservation

The gate checked temporary commit `ce2aac95` with tree
`1a94452b30078f63c8ae23256044504a77e402cd`. Its two parents were the intended
branch and main tips. A matching committed baseline was needed because main's
browser example compares against `HEAD`, and the pre-merge tip had an older
catalogue schema. The real merge commit has exactly that tested tree and those
same two parents. Later verification-record updates change Markdown only.

Every path in the merge's remerge diff was inspected before pushing. No file
was deleted relative to main. All five mainline design-attribution test bodies
were preserved exactly across the split files. The required final review of the
complete main-relative diff runs separately, after pushing.

## Timing And Coverage Limits

This is one complete integration check, not a new two-run warm benchmark.
The inventory and concurrency policy differ from the older measurements, so
its wall time is not a direct speed comparison. The existing 20,000-file
PostCSS assertion passed in **1,420.3ms**, below its unchanged 2,500ms limit.
Pure path normalization was optimized; physical filesystem checks remain.

Node 22 and native macOS/Windows CI were not rerun in this Linux workspace.
The final gate's local evidence is under `.context/merge-main/full-check.log`,
`full-check-result.json`, `reports/`, and `report-summary.json` in the same
ignored directory. Earlier failed attempts are retained separately and are not
counted as successful verification.
