# Inline Parse-Reuse Measurements

Milestone 4 diagnostic evidence for the
[scalable analysis plan](../../plans/scalable-inline-style-analysis.md),
recorded October 1, 2026. This is not final performance acceptance.

## Provenance And Procedure

Measured clean code commit: `fefb4f30b92a1cefa60cf1244b830ee06966305a`, following
`e4307a46` and feedback fix `b4597e75`. Node 24.19.0; Linux x64; Intel Xeon
2.90 GHz; eight logical CPUs; 16.3 GiB RAM. No tracked files changed during
measurement. Both complete unit/browser suites and static checks passed first.

The accepted committed cumulative fixture remains
`.context/mokly-large-reUW91`: 30 areas, 40 screens/area, 12 rows/screen,
four stylesheets, share 0.5, 1,590 entries and 5,550 documents. Its
`templateDigest` is
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`;
`fixtureCommit` is `2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`.
`preparedMoklyCommit` remains `4b09b13e6b537b1c02278bfbefd75e62b85f8af5`;
both prepared/current dirty flags are false. Rendering dependencies match
the reference: React/react-dom 19.2.7, react-native-web 0.21.2, @firna/ui
0.14.0, lightningcss 1.33.0, parse5 8.0.1, css-select 7.0.0 and css-what 8.0.0.

After an idle process audit, one `nohup` matrix ran:

```sh
npm run benchmark:large -- --inline-styles \
  --scenario no-changes --scenario component-style
```

All cold/warm outcomes are retained. Matrix exit 1 reflects the cold
component-style delivery ceiling and three startup samples above five seconds;
there is no retry or discarded sample. Restoration succeeds: renderer/output
setup state is rebuilt and setup's intentional unused linked rule remains.

Machine records bracket the matrix from 15:44:30Z to 16:41:56Z:

| Record                | Before             | After              |
| --------------------- | ------------------ | ------------------ |
| `nproc`               | 8                  | 8                  |
| Total memory, MiB     | 16643              | 16643              |
| Used/free memory, MiB | 973 / 12336        | 1121 / 12145       |
| Available memory, MiB | 15300              | 15150              |
| Swap total/used, MiB  | 0 / 0              | 0 / 0              |
| Uptime                | 6:24               | 7:21               |
| Load, 1/5/15 minute   | 0.39 / 1.37 / 1.92 | 1.13 / 1.66 / 1.97 |

## Smoke Samples

Times are milliseconds; missing completed-worker data is not estimated.

| Scenario        | State | Outcome    | Classification | Heap MiB | Supervisor Upper Bound | Usable |
| --------------- | ----- | ---------- | -------------- | -------- | ---------------------- | ------ |
| no-changes      | cold  | ok         | 169883.19      | 275.54   | absent                 | 5205   |
| no-changes      | warm  | ok         | 172255.45      | 279.20   | absent                 | 5653   |
| component-style | cold  | incomplete | absent         | absent   | 630362.15              | 5209   |
| component-style | warm  | ok         | 587185.73      | 316.08   | absent                 | 4962   |

Both no-change samples produce the expected empty Changes set; all 5,520
compared views take the fast path. Cold component-style times out before
complete membership and final heap/count records; its recorded inline-analysis
lower bound is 362150.68 ms. Warm component-style completes with exactly the
expected `area-1-action` membership; all 5,520 views take the complete path.
Unlike Milestone 3, at least one style sample now completes, without a recorded
worker heap-limit failure. No-change heap/time remain near the M3 checkpoint.

| Scenario/State       | HTML Parses | UTF-8 HTML Bytes | HTML ms   | Inline-rule ms | Normalization ms |
| -------------------- | ----------- | ---------------- | --------- | -------------- | ---------------- |
| no-changes/cold      | 26520       | 3306455349       | 112811.07 | 0              | 18394.52         |
| no-changes/warm      | 26520       | 3306455349       | 115215.11 | 0              | 18505.82         |
| component-style/warm | 66270       | 7868856736       | 275602.74 | 234140.05      | 13637.69         |

No-change work parses ranges 15,840 times and references 10,680 times. Style
work parses ranges 22,080 times, references 22,110 times, style discovery
11,040 times and inline matching 11,040 times. HTML parsing and residual
inline rule work dominate; owner matching itself is only 3322.22 ms.
The cold incomplete sample has no final document-work totals.

The `review.inline-style-analysis` counts record appears in every completed
sample. Both no-change records have all five fields zero. The warm style
record is:

| Elements | Segments | Segment Hits | Segment Parses | Fallbacks |
| -------- | -------- | ------------ | -------------- | --------- |
| 11040    | 32447024 | 32441326     | 5698           | 0         |

Reuse is real: only 5,698 distinct misses enter native parsing, while more
than 32 million segment occurrences hit verified runs. Per-view assembly,
diffing and canonical composition still revisit the cumulative rule list;
Milestone 5 targets that residual work, not another native parser rewrite.

## Cold Per-Element Comparison

Isolated comparison uses the same host/runtime, three imported source engines,
fresh caches and forced GC before each sample. Inputs/imports are outside the
clock. One untimed warmup per engine/workload precedes nine rounds whose
interleaved engine order rotates. Report the median, preserving every sample.
The real setup fixture supplies 85,011-byte and 156,590-byte RNW sheets;
the third workload contains 1,000 unique Emotion-style elements (41,340 bytes).

| Input                  | M3 `b87df3a2` ms | Initial M4 `e4307a46` ms | Final `fefb4f30` ms | Final / M3 |
| ---------------------- | ---------------- | ------------------------ | ------------------- | ---------- |
| RNW 85 KB              | 217.35           | 259.27                   | 281.99              | 1.2974     |
| RNW 157 KB             | 415.70           | 505.02                   | 510.15              | 1.2272     |
| 1,000 Emotion elements | 178.81           | 221.38                   | 223.35              | 1.2491     |

**The requested approximately 10% cold-cost target is not met.** Stored
derived data/accounting, native sentinel verification and per-segment immutable
retention remain added cold work. Duplicate ordinal copies, root-boundary
recovery and trusted-run detachment are removed, but these measurements do not
demonstrate a cold improvement. The plan records the remaining cost for the
supervisor's decision rather than treating reuse gains as a cold-path pass.

The earlier feedback candidate `b4597e75` is also retained, not discarded:
M3/initial-M4/candidate medians were 206.49/250.32/265.28 ms (85 KB),
404.14/477.85/499.45 ms (157 KB), and 169.47/196.72/213.95 ms (Emotion).
This variation reinforces using interleaved comparisons, not cross-run minima.

## Evidence

All paths are beneath `.context/delegation/scalable/`:

- Matrix: `m4-cumulative.log`, `m4-cumulative.json`, `.exit` and launcher log.
- Machine/idle audit: `m4-cumulative.machine-before.txt`,
  `m4-cumulative.machine-after.txt`, `m4-cumulative.idle-processes.txt`.
- Cold comparison: `m4-cold-cost.mjs`, `m4-cold-cost.json`, `m4-cold-cost.log`,
  `m4-cold-cost-final-{machine-before,machine-after,idle-processes}.txt`.
- Earlier comparison: `m4-cold-cost-first.{json,log}` and
  `m4-cold-cost-{machine-before,machine-after,idle-processes}.txt`.

The [fixture benchmark contract](../../tests/fixtures/large/benchmark-contract.md)
and [timing contract](../protocol/mokly-timings.md) define fields/outcomes.
