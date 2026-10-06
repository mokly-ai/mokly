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

The sandbox has eight cores and uses Node 22.14.0. The before figures come from
the previous session's `.context/measure/baseline-design-library.log` and
`.context/measure/baseline-component-design.log`. Both files passed. The logs
were measured before the latest `origin/main` merge. The old fourteen-minute
file is not rerun to establish the before figure.

| File                                              |   Before whole-file duration | Final after duration |
| ------------------------------------------------- | ---------------------------: | -------------------: |
| `tests/design_library_attribution.test.ts`        |                    831.826 s |              Pending |
| `tests/component_design_attribution.test.ts`      |                    154.260 s |              Pending |
| `tests/design_library_source_edits.test.ts`       | Included in old library file |              Pending |
| `tests/design_library_committed_baseline.test.ts` | Included in old library file |              Pending |

The original library file includes all twelve source edits and the committed
baseline. Compare its before duration with the sum of the three resulting
library files. New file timings have no independent whole-file before figure.

## Local Operation Evidence

These measurements use the real fixture. The previous session's
`.context/measure/measure.ts` and `source_edits.ts`, with their logs, hold the
operation and single-edit evidence used to approve the grouping.

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
| Final file split verification                             | `tests/design_library_attribution.test.ts`        |  38.513 s | 2 passed                          |
| Final file split verification                             | `tests/component_design_attribution.test.ts`      |  27.891 s | 1 passed                          |
| Final file split verification                             | `tests/design_library_source_edits.test.ts`       | 130.643 s | 6 passed                          |
| Final file split verification                             | `tests/design_library_committed_baseline.test.ts` |  60.797 s | 1 passed                          |

The unchanged files ran individually in this session after the merge. These
verification runs do not replace the approved previous-session before figures.

The initial library consolidation run failed because a new chain assertion
required only `top-bar/tag-picker/tag-chip`. The result also had
`tag-picker/tag-chip`. The run stopped after this failure. Inspection of
`affectedConsumers` confirmed that screen invocations include the top-bar
instance, while its saved variant uses top-bar as the context entry and starts
the instance chain at tag-picker. The approved contract required the long
chain's presence. Both passes now require the exact pair, preserving that
guarantee and checking agreement with the single-change control. The source-edit
grouping is unchanged.
