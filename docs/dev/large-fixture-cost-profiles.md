# Classification CPU Profiles

Supporting evidence for the [M6 checkpoint](./large-fixture-cost-checkpoint.md),
not matrix timings. Measured code `1887eff66087cfccf53a70820df87d6efdb8ecec`,
`moklyDirty: false`, Node 24.19.0; the checkpoint records the host observations.
Both fixtures have 1,590 entries, 5,550 documents and 5,520 compared views,
at 30/40/12, four sheets, share 0.5. Their `templateDigest` is
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
Default/cumulative `fixtureCommit`: `8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22` /
`2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`; preparation used clean `4b09b13e`.
`renderingDependencies`: React/React DOM 19.2.7, React Native Web 0.21.2,
Firna 0.14.0, lightningcss 1.33.0, parse5 8.0.1, css-select 7.0.0, css-what 8.0.0.

## Isolation And Interpretation

The ignored session harness wraps Node's builtin `Worker` only for
`dist/server/demand/background_worker.js`, supplying its preload despite the
production worker's empty `execArgv`. Inspector sampling starts at the worker's
`changes.classify` start and stops at its real end. Builds, foreground startup
and the supervising wait are excluded. All three profiles stop at
`classification-end`; every enclosing classification outcome is `ok`.

The harness is outside production code paths and off by default. Its explicit
`--no-delivery-ceiling` option polls for complete classification, with bounded
individual requests and real cancellation/error handling. Without that option,
it uses the ordinary sample helper and its fixed ceiling. Matrix commands,
ceilings and schema are unchanged. The profile report records
`profiling.deliveryCeilingMs: null` and a 1,000 µs sampling interval.

Session-only reproduction, with the Node 24.19.0 directory on `PATH`:

```sh
MOKLY_WORKER_PROFILE_DIR="$PWD/.context/delegation/scalable/m6-profiles" \
MOKLY_WORKER_PROFILE_LABEL="<label>" \
NODE_OPTIONS="--import=$PWD/.context/delegation/scalable/profile-preload.mjs" \
node .context/delegation/scalable/profile-sample.mjs \
  '<label>' component-style cumulative --no-delivery-ceiling
```

This is not a shipped `benchmark:large` flag. The enclosing runner records
machine/process audits and restores setup. Worker-only and uncapped-polling
probes pass, including errors, cancellation and start-without-end cases.

Weight each sampled stack by `timeDeltas`, not by sample count. Self-time is
aggregated by function and location; inclusive function totals deduplicate
recursive frames. Categories below partition sampled stacks, selecting the
enclosing operation; GC and idle have their own categories. Percentages mean
**sampled classification wall time**, not OS CPU utilization. Inclusive
functions/paths overlap and async resumptions can omit callers: do not sum them
or treat a wrapper's inclusive total as a path-duration counter.
One default-profile delta of −53 µs is clamped to zero and disclosed in its
summary; this is negligible against 42,367,996 µs of sampled time.

| Profile                    | Classification ms | Sampled ms | Samples | Unprofiled cold ms | Observed difference | Changes ready ms |
| -------------------------- | ----------------- | ---------- | ------- | ------------------ | ------------------- | ---------------- |
| Cumulative/no-changes      | 224242.66         | 224241.698 | 193611  | 193202.31          | +16.1%              | 552375           |
| Cumulative/component-style | 610366.67         | 610366.613 | 526374  | 525132.57          | +16.2%              | 936841           |
| Default/component-style    | 42368.33          | 42367.996  | 37532   | 44765.40           | −5.4%               | 143500           |

These differences include run-to-run drift: the default negative difference
is not negative profiler overhead (against M5 cold it is +1.6%). They are not
an interleaved overhead experiment. Never substitute these times into the matrix.
All three have no finite delivery ceiling, so ceiling headroom is not applicable;
do not assign them the matrix's bounds. The profiled cumulative style delivery
exceeds 900,000 ms from launch; the uncapped pass retains its complete profile.

## Disjoint Step Shares

Percentages, with `—` meaning no sampled stack in that category. The workload
has no changed linked CSS or referenced HTML; their separate parse counts in
the full matrix must not be extrapolated from this style-only profile.

| Step                                          | Cumulative no-change % | Cumulative style % | Default style % |
| --------------------------------------------- | ---------------------- | ------------------ | --------------- |
| HTML / range validation                       | 36.485                 | 17.953             | 31.930          |
| HTML / reference extraction                   | 19.382                 | 11.990             | 18.760          |
| HTML / style discovery                        | —                      | 9.009              | 0.770           |
| HTML / inline matcher tree                    | —                      | 8.987              | 0.795           |
| HTML / other                                  | 0.135                  | 0.146              | 0.220           |
| Range validation, excluding parsing           | 1.423                  | 0.771              | 3.197           |
| Style discovery, excluding parsing            | —                      | 0.221              | 0.048           |
| Normalization                                 | 8.517                  | 2.575              | 7.305           |
| Projection / implementation materials         | 1.162                  | 1.484              | 2.238           |
| Inline material canonical-text building       | —                      | 6.278              | 0.008           |
| Inline material replacements                  | 0.011                  | 0.011              | 0.086           |
| Segment scanning                              | —                      | 2.174              | 0.117           |
| Cache lookup / retention                      | —                      | 4.258              | 0.014           |
| Run lookup / assembly                         | —                      | 3.496              | 0.086           |
| Run cancellation                              | —                      | 2.596              | 0.043           |
| Residual diff                                 | —                      | 0.090              | 0.013           |
| Inline attribution                            | —                      | 0.671              | 0.203           |
| Canonical composition, excluding sorting/text | —                      | 4.225              | 0.115           |
| Canonical sorting                             | —                      | 3.758              | 0.061           |
| Native parse / first-use stored data          | —                      | 0.677              | 0.124           |
| Inline other                                  | 0.000                  | 0.010              | 0.005           |
| Resource discovery, excluding parsing         | 8.155                  | 5.660              | 9.224           |
| Hashing                                       | 0.482                  | 0.264              | 1.183           |
| File reads                                    | 0.610                  | 0.288              | 2.771           |
| Git / broker                                  | 0.305                  | 0.111              | 0.428           |
| GC                                            | 15.228                 | 8.229              | 2.776           |
| Idle / wait                                   | 4.699                  | 1.817              | 7.363           |
| Diagnostics / runtime                         | 1.427                  | 0.369              | 3.424           |
| Other / orchestration                         | 1.981                  | 1.883              | 6.693           |

Stored-data getters also execute inside sorting/composition and are charged
there, not to fresh parsing. GC samples carry no reliable allocating caller.
Counter operation times already include GC inside operations; this table
separates it. File/Git stack shares exclude external process CPU and cannot
explain all idle time, but their observed small shares do not support an I/O-first plan.

## Top Twenty Self-time Functions

Locations refer to the measured distribution. Abbreviations: `p5` is
`node_modules/parse5/dist/`; `css` is `dist/review/css/`; `review` is
`dist/review/`. Native/regexp frames retain their recorded names.

### Cumulative No-change

| Rank | Function / location                                             | Self % |
| ---- | --------------------------------------------------------------- | ------ |
| 1    | `_callState`, p5/tokenizer/index.js:492                         | 16.08  |
| 2    | `(garbage collector)`                                           | 15.23  |
| 3    | `parse`, p5/index.js:30                                         | 13.76  |
| 4    | `_runParsingLoop`, p5/tokenizer/index.js:205                    | 9.06   |
| 5    | `(idle)`                                                        | 4.70   |
| 6    | `_stateRawtext`, p5/tokenizer/index.js:846                      | 4.16   |
| 7    | `mayContainCssReferences`, dist/css_references.js:5             | 4.01   |
| 8    | `updateNodeSourceCodeLocation`, p5/tree-adapters/default.js:170 | 3.07   |
| 9    | `_emitCurrentCharacterToken`, p5/tokenizer/index.js:396         | 2.32   |
| 10   | `generatedSource`, dist/build/ownership.js:23                   | 1.80   |
| 11   | `parseMaterials`, review/ignore.js:112                          | 1.57   |
| 12   | `parseDocument`, review/ignore.js:51                            | 1.37   |
| 13   | `onCharacter`, p5/parser/index.js:635                           | 1.32   |
| 14   | `RegExp: <!--mokly-review-material:[\s\S]*?-->`                 | 1.25   |
| 15   | `update`                                                        | 1.25   |
| 16   | `RegExp: <!--mokly-review-ignore:[\s\S]*?-->`                   | 1.08   |
| 17   | `render`, review/ignore.js:130                                  | 1.06   |
| 18   | `advance`, p5/tokenizer/preprocessor.js:132                     | 0.93   |
| 19   | `encode`, packages/viewer/dist/components/data.js:95            | 0.75   |
| 20   | `(program)`                                                     | 0.60   |

### Cumulative Component-style

| Rank | Function / location                                             | Self % |
| ---- | --------------------------------------------------------------- | ------ |
| 1    | `_callState`, p5/tokenizer/index.js:492                         | 15.22  |
| 2    | `parse`, p5/index.js:30                                         | 11.35  |
| 3    | `(garbage collector)`                                           | 8.23   |
| 4    | `_runParsingLoop`, p5/tokenizer/index.js:205                    | 6.24   |
| 5    | `cssRuleData`, css/rule_identity.js:17                          | 4.43   |
| 6    | `projection`, css/inline_rendering.js:38                        | 4.29   |
| 7    | `get`, css/byte_lru.js:24                                       | 4.21   |
| 8    | `write`, p5/tokenizer/index.js:235                              | 4.11   |
| 9    | `(anonymous)`, css/inline_rendering.js:26                       | 3.67   |
| 10   | `updateNodeSourceCodeLocation`, p5/tree-adapters/default.js:170 | 3.24   |
| 11   | `mayContainCssReferences`, dist/css_references.js:5             | 3.09   |
| 12   | `element`, css/segment_analysis.js:18                           | 2.24   |
| 13   | `scan`, css/segments.js:11                                      | 2.04   |
| 14   | `(idle)`                                                        | 1.82   |
| 15   | `_emitCurrentCharacterToken`, p5/tokenizer/index.js:396         | 1.81   |
| 16   | `inlineSegmentChanges`, css/inline_segment_changes.js:6         | 1.80   |
| 17   | `compareRules`, css/inline_rendering.js:80                      | 1.06   |
| 18   | `onCharacter`, p5/parser/index.js:635                           | 1.00   |
| 19   | `parseInlineRuns`, css/inline_rule_runs.js:5                    | 0.86   |
| 20   | `parseMaterials`, review/ignore.js:112                          | 0.76   |

### Default Component-style

| Rank | Function / location                                             | Self % |
| ---- | --------------------------------------------------------------- | ------ |
| 1    | `_callState`, p5/tokenizer/index.js:492                         | 17.47  |
| 2    | `_runParsingLoop`, p5/tokenizer/index.js:205                    | 12.60  |
| 3    | `(idle)`                                                        | 7.36   |
| 4    | `advance`, p5/tokenizer/preprocessor.js:132                     | 3.63   |
| 5    | `(garbage collector)`                                           | 2.78   |
| 6    | `parse`, p5/parser/index.js:114                                 | 2.65   |
| 7    | `encode`, packages/viewer/dist/components/data.js:95            | 2.41   |
| 8    | `updateNodeSourceCodeLocation`, p5/tree-adapters/default.js:170 | 1.83   |
| 9    | `parseDocument`, review/ignore.js:51                            | 1.72   |
| 10   | `parseMaterials`, review/ignore.js:112                          | 1.57   |
| 11   | `update`                                                        | 1.36   |
| 12   | `mayContainCssReferences`, dist/css_references.js:5             | 1.35   |
| 13   | `parse`, p5/index.js:30                                         | 1.27   |
| 14   | `(anonymous)`, dist/html_references.js:27                       | 1.27   |
| 15   | `_leaveAttrName`, p5/tokenizer/index.js:332                     | 1.20   |
| 16   | `RegExp: <!--mokly-review-material:[\s\S]*?-->`                 | 1.00   |
| 17   | `RegExp: <!--mokly-review-ignore:[\s\S]*?-->`                   | 0.98   |
| 18   | `Hash`                                                          | 0.98   |
| 19   | `(program)`                                                     | 0.95   |
| 20   | `_stateAttributeName`, p5/tokenizer/index.js:1480               | 0.90   |

## Inclusive Paths

These representative hot paths end at the named function's inclusive share
over all recorded stacks, not the disjoint group's self total. Percentages are
ordered cumulative no-change / cumulative style / default style. The complete
top-30 inclusive lists and top-three sampled tails per group remain in JSON.

| Step / representative ancestry                                        | Inclusive function                     | Shares %              |
| --------------------------------------------------------------------- | -------------------------------------- | --------------------- |
| Fast attempt → projection and resource proof                          | `compareUnchangedComponentView`        | 75.41 / — / 70.18     |
| View → projection → ranges → parse5                                   | `validateRanges`                       | 37.89 / 18.71 / 35.02 |
| View → projection → inline analysis → discovery/matching/diff         | inline_attribution.js:10 callback      | — / 41.82 / —         |
| Inline analysis → parse runs → element/cache/scanner                  | `parseInlineRuns`, inline_rule_runs.js | — / 10.60 / 0.34      |
| Run analysis → cancellation → residual diff                           | `inlineSegmentChanges`                 | — / 2.69 / 0.06       |
| Inline material → canonical-text map/join                             | `projection`, inline_rendering.js      | — / 6.28 / 0.01       |
| View → component projection → replacements/normalization              | `projectComponentPair`                 | 4.64 / 1.98 / 4.18    |
| Material → ignore-region parser/rendering                             | `normalizeReviewPair`                  | 4.71 / 1.30 / 3.95    |
| Resources → referenced routes → HTML extraction → parse5/CSS detector | `extractHtmlReferences`                | 24.36 / 15.55 / 21.01 |

Hot sampled tails explain the remaining groups: resource extraction reaches
`extractCssReferences → mayContainCssReferences` (3.89/3.09/1.22% of all
samples); resource comparison reaches hashing (0.32/0.15/0.84%); Git prefetch
reaches `readBlobBatch → parseBlobBatch` (0.25/0.09/0.24%). File samples
include `projectRealPath → lexicallyExists` and actual reads; GC/idle are
pseudo-roots rather than reliably attributed call paths. The
[per-view breakdown](./large-fixture-cost-model.md#inline-cost-per-view)
separates cancellation from lookup, sorting and material construction.

Evidence is under `.context/delegation/scalable/`: `m6-profile-*.log/.json`,
and `m6-profiles/` files with prefixes `m6-profile-cumulative-no-changes`,
`m6-profile-cumulative-component-style`, `m6-profile-default-component-style`.
Each has exactly one complete `.cpuprofile`, `.metadata.json`, `.summary.json`
set. `profile-summary.mjs` records sample weighting, recursion treatment and
negative deltas; the ignored `profile-preload.mjs`, `profile-sample.mjs`,
`profile-delivery-sample.mjs`, `run-profile-evidence.sh` retain the harness.
