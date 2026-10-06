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
shard assignments. The CI After section records the new layout and the decision
to retain the single-change control.

## CI After

[PR run 37464638941](https://github.com/mokly-ai/mokly/actions/runs/37464638941)
passed, including Required CI, for
[draft PR #139](https://github.com/mokly-ai/mokly/pull/139). Unit reports record
merge commit `1cb28f09`: branch head `f83efe0d` merged into main `f66c274d`.
All four Node 22.14.0 reports completed successfully with no failures, skips,
or cancellations. The baseline reports record `781da7ae` from run 37354719684.

Durations below come from `observedFiles[].durationMs`, divided by 1000.
Shard indices come from the reports; sorted file indices are zero-based.
The new source-edit and committed-baseline files were part of the old library
file. Their combined time must be compared with that original file's duration.

| File                                              |              Before |   After | After shard (index) | After tests |
| ------------------------------------------------- | ------------------: | ------: | ------------------- | ----------: |
| `tests/design_library_attribution.test.ts`        |             615.1 s |  23.9 s | 2 (345)             |           2 |
| `tests/component_design_attribution.test.ts`      |             192.1 s |  23.6 s | 3 (242)             |           1 |
| `tests/design_library_source_edits.test.ts`       | In old library file |  87.4 s | 1 (348)             |           6 |
| `tests/design_library_committed_baseline.test.ts` | In old library file |  47.7 s | 3 (346)             |           1 |
| `tests/attribution_result_helpers.test.ts`        |         Not present | 0.012 s | 2 (77)              |           6 |

The helper duration is 0.0 s when rounded to one decimal place (0.012 s shown
above). The heaviest unit file is now `design_library_source_edits.test.ts` at
87.4 s.

Shard wall time comes from report `durationMs`. Summed file time is the sum of
`observedFiles[].durationMs`; file count is that array's length; test count is
the sum of `observedFiles[].tests`. All four shards run two files concurrently.

| Shard | Period | Wall time | Summed file time | Files | Tests |
| ----- | ------ | --------: | ---------------: | ----: | ----: |
| 1     | Before |   690.7 s |         1201.0 s |   188 |  1071 |
| 1     | After  |   305.2 s |          527.3 s |   192 |  1020 |
| 2     | Before |   330.8 s |          552.4 s |   188 |   995 |
| 2     | After  |   250.7 s |          424.5 s |   191 |  1076 |
| 3     | Before |   290.5 s |          491.5 s |   188 |  1058 |
| 3     | After  |   280.8 s |          476.0 s |   191 |  1042 |
| 4     | Before |   768.0 s |         1246.6 s |   187 |  1090 |
| 4     | After  |   330.5 s |          562.5 s |   191 |  1172 |

Across shards, summed file time fell from **3491.5 s** to
**1990.4 s**, a **1501.1 s** reduction. The observed inventory
changed from 751 files / 4214 tests to 765 files / 4310 tests.
The slowest shard fell from **768.0 s** to **330.5 s**, clearly below the
baseline. The four attribution files account for **624.6 s** of the total
reduction: **807.2 s → 182.6 s** (41.6% of the total drop).

This is one run per side. Other files also ran faster:
`example_baseline.test.ts` fell from 83.4 s to 34.2 s, and
`publish_receiver_rejections.test.ts` fell from 64.7 s to 26.0 s. Part of the
remaining drop likely comes from less CPU contention with the concurrent file
and from runner variance. These reports do not separate those effects, so the
full reduction must not be attributed only to this test restructure.

**Control decision:** keep the single-change `tag-chip` control. The library
attribution file takes 23.9 s in CI, below the plan's 60 s threshold.

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
These are summed isolated file times. The CI After section records shard wall
times separately.

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
1.2.2 as patched. Main CI had the same failure at that time, and unit jobs
depend on the repository job. The patch therefore unblocked the audit required
for CI shard measurement. Commit `a8bf3926` changes only version, resolved URL,
and integrity in the source-map-js lockfile entry; `package.json` stays
unchanged. `main` later merged the identical change in #140. After merge commit
`ff357b56` brought in `main` at `80ceb445`, the branch's lockfile diff against
`main` is empty, and the pull request records #140 as superseding the branch
change.

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
The orchestrator pushed `f83efe0d` and opened draft PR #139 after this local
run. CI timing and the control decision are recorded above. The final push and
post-push review remain with the orchestrator.

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
