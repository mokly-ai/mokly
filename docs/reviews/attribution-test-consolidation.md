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

`cargo xtask check` ran after the implementation and timing commits and after
`git fetch origin main`. It stopped at the live dependency audit. A retry with
`cargo xtask check --suite repository` reported the same failure:

```text
Uncovered advisory GHSA-68fv-2mgg-jv7q; package: source-map-js; severity: high.
[xtask/command] `npm run dependencies:check` failed with status 1
```

The lockfile has source-map-js 1.2.1 through runtime PostCSS and development
Tailwind. The [reviewed advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
identifies 1.2.2 as patched. The repository lockfile stays unchanged under the
test-only scope. A targeted three-field lockfile proposal is a local-only
artifact. Its scope decision remains open; no exception was added.

The functional suites then ran separately on Node 22.14.0:

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

The complete gate remains unsuccessful because its audit prerequisite failed.
CI timing, push, the control decision, PR status, and post-push review remain
with the orchestrator. No push or PR was made.
