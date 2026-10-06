# Attribution Test Consolidation Measurements

The change keeps the attribution guarantees and reduces repeated compilation
and classification. Product code stays unchanged. The approved
[plan](../../plans/attribution-test-consolidation.md) defines the scenarios,
grouping rules, and exact assertions.

## CI Baseline

[Main run 37354719684](https://github.com/mokly-ai/mokly/actions/runs/37354719684)
used Node 22.14.0 on 2 vCPU runners. The
`verification-unit-node-22.14.0-shard-*` artifacts contain the per-file and
per-shard reports. Whole files use sorted index modulo four, with two files
running concurrently in each shard.

| File                                         | Tests | Duration | Shard (sorted index) |
| -------------------------------------------- | ----: | -------: | -------------------- |
| `tests/design_library_attribution.test.ts`   |    33 |    615 s | 4 (339)              |
| `tests/component_design_attribution.test.ts` |    10 |    192 s | 1 (236)              |

| Shard | Wall time | Summed file time |
| ----- | --------: | ---------------: |
| 1     |     691 s |           1201 s |
| 2     |     331 s |            552 s |
| 3     |     290 s |            492 s |
| 4     |     768 s |           1247 s |

The two attribution files account for 807 s of 3492 s summed unit file time
(23%). These figures describe the baseline only. Added files change later
shard assignments. CI after figures and the control decision remain pending.

## Local Baseline

The sandbox has eight cores and uses Node 22.14.0. The primary before figures
are the unchanged current-merge runs: 612.961 s and 123.173 s. They use the same
base and conditions as the after runs. Each file ran alone with
`node --import tsx --test <file>`; the table records TAP's whole-file
`duration_ms`, including fixture setup and teardown. All baseline tests passed.

The previous session measured 831.826 s and 154.260 s before the main merge.
Those figures provide historical context only. The scripts and raw logs are
local-only scratch artifacts and are not part of this repository.

| File                                              |   Before whole-file duration | Final after duration |
| ------------------------------------------------- | ---------------------------: | -------------------: |
| `tests/design_library_attribution.test.ts`        |                    612.961 s |             39.105 s |
| `tests/component_design_attribution.test.ts`      |                    123.173 s |             32.692 s |
| `tests/design_library_source_edits.test.ts`       | Included in old library file |            142.444 s |
| `tests/design_library_committed_baseline.test.ts` | Included in old library file |             62.987 s |

The original library file includes all twelve source edits and the committed
baseline. Compare its before duration with the sum of the three resulting
library files. New file timings have no independent whole-file before figure.

## Local Operation Evidence

An uncommitted script drove the real fixture to measure copy/compilation,
classification, and rebuild operations. Another script applied each of the
twelve source edits alone and recorded exact change paths, reason kinds, and
impacting components. These previous-session scripts and raw logs are local-only
scratch artifacts. The operation figures below provide historical context.

| Operation                                      | Duration |
| ---------------------------------------------- | -------: |
| Fixture copy and `compileCatalogue`            |   17.0 s |
| `classifyComponents` with no changed paths     |   12.0 s |
| One library stylesheet: tag-chip, 45 consumers |   11.1 s |
| One library stylesheet: top-bar, 111 consumers |   16.4 s |
| All sixteen library stylesheets in one pass    |   18.7 s |
| All nine shared design stylesheets in one pass |   20.9 s |
| All twenty-five stylesheets in one pass        |   21.5 s |
| Rebuild after one source edit                  |   20.3 s |
| Classification after that source edit          |   13.9 s |

## Verification During Consolidation

Record intermediate file timings here. Final measurements run all four files
individually, one after another, with no other heavy work running.

| Step                                                      | File or check                                     |  Duration | Result                            |
| --------------------------------------------------------- | ------------------------------------------------- | --------: | --------------------------------- |
| Helper verification                                       | `tests/attribution_result_helpers.test.ts`        |   0.220 s | 6 passed; no compilation          |
| Unchanged current-merge verification                      | `tests/design_library_attribution.test.ts`        | 612.961 s | 33 passed                         |
| Unchanged current-merge verification                      | `tests/component_design_attribution.test.ts`      | 123.173 s | 10 passed                         |
| Library CSS consolidated; source cases still in this file | `tests/design_library_attribution.test.ts`        | 382.350 s | 18 passed                         |
| Shared CSS consolidated                                   | `tests/component_design_attribution.test.ts`      |  27.641 s | 1 passed; all nine scopes checked |
| Initial file split verification                           | `tests/design_library_attribution.test.ts`        |  38.513 s | 2 passed                          |
| Initial file split verification                           | `tests/component_design_attribution.test.ts`      |  27.891 s | 1 passed                          |
| Initial file split verification                           | `tests/design_library_source_edits.test.ts`       | 130.643 s | 6 passed                          |
| Initial file split verification                           | `tests/design_library_committed_baseline.test.ts` |  60.797 s | 1 passed                          |

The unchanged current-merge runs are the primary before figures. Earlier
consolidated runs above predate the review corrections; final after measurements
are rerun after those corrections.

The initial library consolidation run failed because a new chain assertion
required only `top-bar/tag-picker/tag-chip`. The result also had
`tag-picker/tag-chip`. The run stopped after this failure. Inspection of
`affectedConsumers` confirmed that screen invocations include the top-bar
instance, while its saved variant uses top-bar as the context entry and starts
the instance chain at tag-picker. The approved contract required the long
chain's presence. Both passes now require the exact pair, preserving that
guarantee and checking agreement with the single-change control. This chain correction did not change the source-edit grouping. A later
review moved the control-label edit into build 5 to preserve same-file variant
isolation. The number of builds remains five.

## Review Corrections

The shared-style test now checks each entry's complete dependency reasons,
including exact paths and unresolved `body` analysis. The source groups keep
all three `top-bar.tsx` edits in different builds. Build 3 has the saved title;
build 4 has the saved query; build 5 combines the control label and screen
removal. The table still has five builds. The plan states the residual masking
limit and the rule that protects same-file variant attribution.

The corrected shared-style file passed in 28.014 s. The corrected source-edit
file passed all five groups in 135.715 s. Formatting, ESLint, and prepared type
checks passed. The first contract-restoration check reported
`mokly-component-design.md has 251 lines`. Tightening only the new test
paragraph restored the 250-line cap. All five protocol size/history tests then
passed. The interrupted run's owned fixture directory was removed.

## Final Local Measurements

All four files ran individually in sequence after the review corrections, with
no other heavy work running. All ten tests passed. The library scenarios took
244.537 s across the three files, versus 612.961 s before (60.1% less).
All attribution scenarios took 277.228 s, versus 736.134 s before (62.3% less).
These are summed isolated file times. CI shard wall times remain pending.

## Final Verification

`cargo xtask check` initially ran after the implementation and timing commits
and after `git fetch origin main`. It stopped at the live dependency audit. A retry with
`cargo xtask check --suite repository` reported the same failure:

```text
Uncovered advisory GHSA-68fv-2mgg-jv7q; package: source-map-js; severity: high.
[xtask/command] `npm run dependencies:check` failed with status 1
```

This branch includes a lockfile-only update from source-map-js 1.2.1 to 1.2.2.
Runtime PostCSS and development Tailwind both resolve it. The
[reviewed advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) identifies
1.2.2 as patched. Main CI has the same failure, and unit jobs depend on the
repository job. The patch therefore unblocks the audit required for CI shard
measurement. Commit `a8bf3926` changes only version, resolved URL, and integrity
in the source-map-js lockfile entry; `package.json` stays unchanged. The pull
request description must flag this dependency update for the user's review.

A clean `npm ci` installed 1.2.2 for both parents. The live
`npm run dependencies:check` passed with the existing reviewed Braces exception.
No new exception was added. The earlier scope decision is closed.

Before this dependency patch, the functional suites ran separately on
Node 22.14.0:

| Check             | Result                                                 | Suite duration |
| ----------------- | ------------------------------------------------------ | -------------: |
| Package           | Both packed packages passed all six consumer scenarios |   Not recorded |
| Unit              | 4310 passed; no failures, skips, or cancellations      |     1158.863 s |
| Browser, Chrome   | 844 passed across 168 files; no skips or cancellations |     1345.261 s |
| Hydration, Chrome | 263 passed across 11 files; no skips or cancellations  |      830.007 s |

Repository formatting, ESLint, source length, all four ratchets, Rust formatting,
Clippy, all 15 Rust tests, and the Rust length audit passed when run separately
from the blocked audit. All changed TypeScript files remain below 300 lines;
the component-design protocol remains at 250 lines. The six projection tests
passed in 0.220 s without compilation. All targeted attribution and protocol
checks passed after correcting the two documented initial assertion failures.

The earlier complete-gate attempt failed at the audit. After the lockfile update
and decision notes were committed, the single unqualified `cargo xtask check`
ran on `e8369ec5` and passed end to end with exit code 0. The run used
Node 22.14.0 and the installed Chrome channel. No suite filter or retry was used.
CI timing, push, the control decision, PR status, and post-push review remain
with the orchestrator. No push or PR was made.

### Complete-Gate Measurement

The complete run started at 10:58:23 UTC and ended at 12:09:43 UTC on
2026-10-06. A local-only stream observer used a monotonic clock at xtask's
suite command markers. Suite wall time includes preparation; runner time comes
from the suite evidence reports and excludes preparation. Total wall time also
includes the initial Cargo startup. The observer and raw reports are local-only
scratch artifacts, not repository files.

| Suite      | Result                                                                  | Suite wall time |             Runner time |
| ---------- | ----------------------------------------------------------------------- | --------------: | ----------------------: |
| Repository | Audit, format, lint, length, ratchets, Clippy, and 15 Rust tests passed |        66.238 s | Not separately recorded |
| Package    | Build, types, example, artifacts, and six consumer scenarios passed     |       208.609 s | Not separately recorded |
| Unit       | 4310 passed; no failures, skips, or cancellations                       |      1499.296 s |              1463.651 s |
| Browser    | 844 passed across 168 files; no skips or cancellations                  |      1676.426 s |              1634.914 s |
| Hydration  | 263 passed across 11 files; no skips or cancellations                   |       830.156 s |               788.210 s |

Total complete-gate wall time: **4280.759 s**
(71 minutes, 20.759 seconds). All five suites passed in the same gate invocation.
The dependency audit retained only the existing reviewed Braces exception; no
new exception was added. The full run reported no functional failure, skip, or
cancellation. The plan's local complete-gate TODO is checked.
