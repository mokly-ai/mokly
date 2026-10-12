# Shared Page Analysis Measurements

Approved M7 evidence for the [code checkpoint](./shared-page-analysis-checkpoint.md)
and [scalable plan](../../plans/scalable-inline-style-analysis.md), not Decision 13
acceptance. No M8 work, fixture regeneration, contract change or profiling occurs.
All measurements finish before tracked reporting edits or verification starts.

## Method And Identity

Node 24.19.0 compares clean M7 `4d6a99565af3b595528e5096f480f0bf42a0f273`
with separately built, detached, clean M6
`e5025e6421c029296968f7a2d4078384eb71adb5` (same analysis as measured `1887eff6`).
Both report `moklyDirty: false`. Existing committed fixtures remain 30/40/12,
four sheets, share 0.5, 1,590 entries, 5,550 documents and 5,520 paired views.
`templateDigest`: `5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
Default/cumulative `fixtureCommit`: `8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22` /
`2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`; preparation remains clean `4b09b13e`.
Resolved packages remain React/React DOM 19.2.7, React Native Web 0.21.2,
Firna 0.14.0, lightningcss 1.33.0, parse5 8.0.1, css-select 7.0.0, css-what 8.0.0.

On each tree, with the same absolute fixture config:

```sh
node scripts/large/cli.mjs benchmark --config <fixture>/mokly.config.ts \
  --scenario no-changes --scenario component-style
```

Cumulative adds `--inline-styles`. Default order is **M6, M7, M7, M6**
(A1, B1, B2, A2); cumulative is **M6 then M7** (C6, C7), once each.
Each row/state has a fresh server/browser context. Cold means application-cold,
not flushed OS caches; committed warm does not reuse a classification worker.
Chrome launches before the sample clock. Benchmarks keep default system Chrome
153.0.8010.52, with `PLAYWRIGHT_CHANNEL` unset; interactive steps all succeed.

C6's two style cells reach the unchanged fixed delivery wait. Keep them;
subsequently run M6 then M7 for each affected cell with M6's existing off-by-default
uncapped helper. `NODE_OPTIONS` and worker-profile variables are unset: no inspector,
profile overhead or alternate production path. Ordinary Serve/build/browser work
still occurs; the reported classification-only duration is the real worker span,
not launch-to-delivery time. Uncapped results supplement, never replace, the matrix.

## Host And Isolation

Every before/after snapshot records `machine.cpu` and `/proc/cpuinfo` as
**Intel(R) Xeon(R) Processor @ 2.50GHz**, all eight processors at **2499.998 MHz**.
Linux x64, `nproc: 8`, 16.3 GiB RAM, no swap. This is **not** M2–M6's 2.90GHz host.
No other implementer/supervisor build, suite, copy or measurement runs concurrently.
Process tables, `free -m`, `uptime`, code status and CPU snapshots bracket each run;
matrix sample-end snapshots additionally retain model/MHz/steal observations.
Steal is aggregate `/proc/stat` tick delta / `CLK_TCK` (100), not one core's
elapsed time; percentage divides by all eight CPUs' elapsed tick delta.
Full observations retain absolute ticks, uptime, loads, free/available memory.

| Run     | UTC start / end (2026)          | Available MiB before/after | Steal seconds / % |
| ------- | ------------------------------- | -------------------------- | ----------------- |
| A1      | 10-02 22:03:40 / 10-02 22:21:19 | 15152 / 15053              | 0.55 / 0.006455   |
| B1      | 10-02 22:21:19 / 10-02 22:35:35 | 15062 / 15001              | 0.16 / 0.002313   |
| B2      | 10-02 22:35:35 / 10-02 22:49:45 | 15001 / 15059              | 0.13 / 0.001890   |
| A2      | 10-02 22:49:45 / 10-02 23:05:43 | 15060 / 14993              | 0.19 / 0.002449   |
| C6      | 10-02 23:05:43 / 10-03 00:10:30 | 14992 / 15091              | 0.65 / 0.002061   |
| C7      | 10-03 00:23:19 / 10-03 01:14:36 | 15147 / 15137              | 0.53 / 0.002126   |
| U6 cold | 10-03 01:14:36 / 10-03 01:39:19 | 15150 / 15015              | 0.21 / 0.001750   |
| U7 cold | 10-03 01:39:19 / 10-03 01:59:02 | 15015 / 14992              | 0.17 / 0.001778   |
| U6 warm | 10-03 01:59:02 / 10-03 02:23:36 | 14992 / 15062              | 0.24 / 0.002011   |
| U7 warm | 10-03 02:23:36 / 10-03 02:43:00 | 15061 / 15102              | 0.21 / 0.002233   |

The session wrapper stopped **after** C6's final report/restoration because its
guard expected a deadline message, while the deadline-limited fetch produced
`The operation was aborted due to timeout`. Its original log remains; accepting
that delivery-only timeout resumes at C7, without rerunning or altering any sample.
SHA-256 snapshots prove both renderers, identity records and **every mockups file**
return byte-identically to setup, with only setup's unused CSS rule edited in Git.

## Every Matrix Sample

Worker and startup times are milliseconds. Heap is sampled `used_heap_size`,
not RSS. All **22 completed** samples have exact membership: none for no-change,
only `area-1-action` / `components/area-1-action.html` for style. Two C6 cells
remain `incomplete`; missing worker duration, heap, membership and completed counts
are **absent**, not zero. Every matrix exits 1: all 24 usable-startup values exceed
5,000 ms; C6 additionally has its two incomplete cells. No sample is dropped/retried.

| Run | Scenario/state       | Outcome    | Worker ms | Heap MiB | Usable ms | Changes ready ms |
| --- | -------------------- | ---------- | --------- | -------- | --------- | ---------------- |
| A1  | no-changes/cold      | ok         | 62624.44  | 206.98   | 7540      | 202027           |
| A1  | no-changes/warm      | ok         | 48642.72  | 200.93   | 8216      | 189507           |
| A1  | component-style/cold | ok         | 49916.76  | 207.32   | 6656      | 178921           |
| A1  | component-style/warm | ok         | 52860.67  | 204.59   | 6242      | 179545           |
| B1  | no-changes/cold      | ok         | 23254.13  | 195.91   | 5947      | 139984           |
| B1  | no-changes/warm      | ok         | 22906.62  | 183.33   | 5956      | 147917           |
| B1  | component-style/cold | ok         | 23033.65  | 202.23   | 6586      | 144302           |
| B1  | component-style/warm | ok         | 23248.92  | 259.38   | 6291      | 144438           |
| B2  | no-changes/cold      | ok         | 22481.30  | 195.76   | 6264      | 142840           |
| B2  | no-changes/warm      | ok         | 21796.88  | 157.23   | 5918      | 144053           |
| B2  | component-style/cold | ok         | 23854.21  | 267.16   | 5880      | 145950           |
| B2  | component-style/warm | ok         | 24826.49  | 345.04   | 6007      | 146304           |
| A2  | no-changes/cold      | ok         | 47887.83  | 182.86   | 5857      | 169786           |
| A2  | no-changes/warm      | ok         | 46934.97  | 191.06   | 6264      | 168732           |
| A2  | component-style/cold | ok         | 50030.51  | 180.30   | 6660      | 172817           |
| A2  | component-style/warm | ok         | 49706.76  | 195.80   | 6261      | 171273           |
| C6  | no-changes/cold      | ok         | 228455.80 | 289.53   | 6194      | 606506           |
| C6  | no-changes/warm      | ok         | 224061.75 | 271.53   | 6625      | 610188           |
| C6  | component-style/cold | incomplete | —         | —        | 6500      | —                |
| C6  | component-style/warm | incomplete | —         | —        | 6368      | —                |
| C7  | no-changes/cold      | ok         | 79498.50  | 286.10   | 5913      | 462331           |
| C7  | no-changes/warm      | ok         | 77751.19  | 275.18   | 6357      | 461208           |
| C7  | component-style/cold | ok         | 292577.56 | 288.44   | 5872      | 662612           |
| C7  | component-style/warm | ok         | 288522.81 | 279.90   | 5772      | 657275           |

### Inline Delivery Headroom

The cumulative fixed wait is **900,000 ms after interactive work**, not after
launch. Existing fields bound its start by `usableMs + propsMs + cachedPreviewMs - 2`
(two ms conservatively cover integer rounding). Remaining interactions are not
separately timed, so these are **lower bounds**, not invented exact deadlines.
Headroom subtracts `changesReadyMs` from that ceiling lower bound on the launch
clock. Neither a worker clock nor its duration is substituted.

| Run/cell                | Changes ready ms | Effective ceiling >= ms | Headroom >= ms       |
| ----------------------- | ---------------- | ----------------------- | -------------------- |
| C6 no-changes/cold      | 606506           | 907095                  | 300589               |
| C6 no-changes/warm      | 610188           | 907527                  | 297339               |
| C6 component-style/cold | —                | 907410                  | — (deadline reached) |
| C6 component-style/warm | —                | 907275                  | — (deadline reached) |
| C7 no-changes/cold      | 462331           | 906821                  | 444490               |
| C7 no-changes/warm      | 461208           | 907353                  | 446145               |
| C7 component-style/cold | 662612           | 906763                  | 244151               |
| C7 component-style/warm | 657275           | 906661                  | 249386               |

C6's completed supervisor waits are **538376.90 / 541866.44 ms**; completed inline
interval lower bounds are **259219.48 / 263008.64 ms**. These are not classification
times or shares. No `classificationWaitUntilStopMs` or completed document/inline
counts exist in those samples. Raw starts show 5,178 / 5,325 inline attempts before
stopping, not completed view totals. Neither incomplete sample supplies membership.

### Supplementary Uncapped Pairs

Every outcome is `ok`, exact membership; each exits 1 only for usable startup.
Effective ceiling is **none**, and headroom **not applicable**; do not assign the
matrix's finite wait to these rows. Preparation/restoration occurs for each run.

| Run     | Worker ms | Heap MiB | Usable ms | Changes ready ms |
| ------- | --------- | -------- | --------- | ---------------- |
| U6 cold | 571005.48 | 299.87   | 5880      | 941900           |
| U7 cold | 284580.83 | 283.91   | 5718      | 645382           |
| U6 warm | 561616.24 | 305.22   | 5722      | 912011           |
| U7 warm | 281696.60 | 284.19   | 5497      | 641675           |

## Same-host Effect And Spread

Default ratios divide the two M7 cell means by the two M6 means. The conservative
envelope is `min(M7)/max(M6)` to `max(M7)/min(M6)`, not a confidence interval.
The large A1 no-change/cold value is retained (62.624 versus 47.888 s in A2).
Cumulative has one matrix per tree/state: no within-cell spread estimate is
available. Style ratios use **only the paired uncapped worker ends**, never C6's
bounds. C7 matrix style is another 2.8% cold / 2.4% warm above U7.

| Fixture/scenario/state                    | M7/M6  | Observed ratio envelope |
| ----------------------------------------- | ------ | ----------------------- |
| default/no-changes/cold                   | 0.4138 | 0.3590–0.4856           |
| default/no-changes/warm                   | 0.4677 | 0.4481–0.4881           |
| default/component-style/cold              | 0.4691 | 0.4604–0.4779           |
| default/component-style/warm              | 0.4687 | 0.4398–0.4995           |
| cumulative/no-changes/cold                | 0.3480 | Single pair             |
| cumulative/no-changes/warm                | 0.3470 | Single pair             |
| cumulative/component-style/cold, uncapped | 0.4984 | Single pair             |
| cumulative/component-style/warm, uncapped | 0.5016 | Single pair             |

No-change improves about **65%** cumulative; style about **50%**. Default improves
about **53–59%** by means, and at least 50% throughout its observed envelope.
M7 cumulative style/no-change is still **3.6803 cold / 3.7108 warm** in the matrix
(3.5797 / 3.6231 using U7 style); M6's supplementary ratios are 2.4994 / 2.5065.
The ratio rises because no-change benefits more, not because style becomes slower.
The 1.25 target therefore remains far away: retained sheet-wide work still matters.

**Different-host historical context only:** M6 quiet default was 42.481–48.754 s,
cumulative no-change 193.202 / 211.652 s and style 525.133 / 505.537 s on 2.90GHz.
[M6's model](./large-fixture-cost-model.md) projected no-change 47–81 s and style
241–312 s there; these M7 samples happen to overlap parts of those ranges but
are not a same-host test of that projection. Do not compare them directly for
Decision 13 or amend its reference-machine rule. The default reductions are robust
here; final target acceptance and the host question remain for M10/the user.

## Counts, Original Text And Lifetime

Counts repeat exactly across all completed cold/warm peers, default repetitions
and supplemental pairs of each engine/scenario. M6 cumulative style below comes
from U6, **not** inferred missing C6 diagnostics. Unlisted HTML steps are unreached
in completed rows; incomplete rows have no completed work record.

| Engine/fixture/scenario            | Fast / complete | HTML parses | UTF-8 parse bytes | Range / reference / discovery / inline-match / page-analysis parses |
| ---------------------------------- | --------------- | ----------- | ----------------- | ------------------------------------------------------------------- |
| M6 default/no-changes              | 5520 / 0        | 26520       | 566968795         | 15840 / 10680 / 0 / 0 / 0                                           |
| M7 default/no-changes              | 5520 / 0        | 5520        | 117677702         | 0 / 0 / 0 / 0 / 5520                                                |
| M6 default/component-style         | 5336 / 184      | 27874       | 594185052         | 16048 / 11090 / 368 / 368 / 0                                       |
| M7 default/component-style         | 5336 / 184      | 5734        | 121628282         | 0 / 30 / 0 / 0 / 5704                                               |
| M6 cumulative/no-changes           | 5520 / 0        | 26520       | 3306455349        | 15840 / 10680 / 0 / 0 / 0                                           |
| M7 cumulative/no-changes           | 5520 / 0        | 5520        | 669071362         | 0 / 0 / 0 / 0 / 5520                                                |
| M6 cumulative/component-style (U6) | 0 / 5520        | 66270       | 7868856736        | 22080 / 22110 / 11040 / 11040 / 0                                   |
| M7 cumulative/component-style      | 0 / 5520        | 11070       | 1338152906        | 0 / 30 / 0 / 0 / 11040                                              |

The scoped separate page pass retains **30 reference parses / 10,182 bytes**
for style; no legacy stylesheet/resource or embedded-resource parse is reached
in these workloads. M7 originals contribute 121,618,100 default style bytes and
1,338,142,724 cumulative style bytes. Resource-graph starts are M6/M7 **10680/5520**
no-change, **11090/6102** default style and **22110/22110** cumulative style.
No-change emits **zero inline-analysis spans** on both engines; M7's final zero
inline counts record does not mean an engine call. Default style emits 184 spans,
736 elements, 56,628 segments, 56,468 hits, 160 parses, zero fallbacks; cumulative
style emits 5,520 spans, 11,040 elements, 32,447,024 segments, 32,441,326 hits,
5,698 parses, zero fallbacks. No M8 route is implemented or credited.

Observed parsed-byte reductions are **79.24% default no-change, 79.53% default
style, 79.76% cumulative no-change and 82.99% cumulative style**: M6's approximate
80%/83% workload predictions hold. Original source payload retained **by one
view's analyses**, not an aggregate catalogue cache, has these bounds:

| Fixture    | Aggregate one-side original bytes across 5,520 views | Largest single source bytes | Largest paired source bytes |
| ---------- | ---------------------------------------------------- | --------------------------- | --------------------------- |
| default    | 117677702                                            | 23461                       | 46922                       |
| cumulative | 669071362                                            | 218123                      | 436246                      |

The restored inventory verifies all are ASCII (UTF-16 units equal UTF-8 bytes);
the color edit preserves lengths. Actual V8 storage, trees, locations, token/clone
WeakMaps, reference records, reader/prefetch strings, CSS caches and temporary
materials are **not** this payload estimate. Analyses release with the view;
aggregate parsed bytes are not live retained heap. C7 no-change peaks 275.18–286.10
MiB versus C6 271.53–289.53; C7 style 279.90–288.44 versus U6 299.87–305.22.
Default style B2 peaks 345.04 MiB despite fewer parses; GC/sampling/other retained
state prevent inferring a proportional heap reduction from parse counts.

## Exclusive Per-step Work

Seconds, three decimals; `none` means no-changes and `style` component-style.
Discovery excludes parsing; HTML includes GC within the parse. `Rest` is worker
duration minus all ten exclusive counters, **not** a named cost or pure GC.
No M7 CPU profile was requested; timing/counts cannot isolate allocation or GC
overhead. Full per-step byte counts and interval unions remain in the raw evidence.

| Run     | Cell       | HTML    | Range | Discovery | References | Matching | Normalize | Project | Implementation | Inline rule | Hash   | Rest   |
| ------- | ---------- | ------- | ----- | --------- | ---------- | -------- | --------- | ------- | -------------- | ----------- | ------ | ------ |
| A1      | none/cold  | 34.834  | 2.071 | 0.000     | 3.207      | 0.000    | 5.998     | 0.340   | 1.638          | 0.000       | 2.067  | 12.470 |
| A1      | none/warm  | 27.396  | 1.433 | 0.000     | 2.314      | 0.000    | 4.800     | 0.247   | 1.241          | 0.000       | 1.584  | 9.627  |
| A1      | style/cold | 27.937  | 1.417 | 0.035     | 2.306      | 0.092    | 4.763     | 0.251   | 1.207          | 0.323       | 1.505  | 10.080 |
| A1      | style/warm | 29.230  | 1.544 | 0.032     | 2.439      | 0.093    | 4.922     | 0.272   | 1.297          | 0.336       | 1.673  | 11.022 |
| B1      | none/cold  | 8.693   | 0.546 | 0.018     | 1.683      | 0.000    | 0.000     | 0.000   | 0.832          | 0.000       | 0.376  | 11.106 |
| B1      | none/warm  | 8.960   | 0.506 | 0.015     | 1.713      | 0.000    | 0.000     | 0.000   | 0.849          | 0.000       | 0.397  | 10.466 |
| B1      | style/cold | 9.175   | 0.537 | 0.019     | 1.780      | 0.065    | 0.119     | 0.030   | 0.872          | 0.280       | 0.386  | 9.772  |
| B1      | style/warm | 9.771   | 0.501 | 0.018     | 1.677      | 0.066    | 0.123     | 0.033   | 0.837          | 0.286       | 0.388  | 9.549  |
| B2      | none/cold  | 8.496   | 0.529 | 0.017     | 1.632      | 0.000    | 0.000     | 0.000   | 0.827          | 0.000       | 0.364  | 10.617 |
| B2      | none/warm  | 8.649   | 0.530 | 0.015     | 1.685      | 0.000    | 0.000     | 0.000   | 0.841          | 0.000       | 0.368  | 9.709  |
| B2      | style/cold | 9.790   | 0.527 | 0.018     | 1.741      | 0.069    | 0.120     | 0.032   | 0.862          | 0.278       | 0.380  | 10.038 |
| B2      | style/warm | 10.852  | 0.518 | 0.018     | 1.779      | 0.069    | 0.152     | 0.036   | 0.851          | 0.260       | 0.372  | 9.920  |
| A2      | none/cold  | 27.297  | 1.399 | 0.000     | 2.182      | 0.000    | 4.663     | 0.186   | 1.174          | 0.000       | 1.525  | 9.461  |
| A2      | none/warm  | 26.850  | 1.399 | 0.000     | 2.134      | 0.000    | 4.701     | 0.188   | 1.161          | 0.000       | 1.410  | 9.091  |
| A2      | style/cold | 28.612  | 1.462 | 0.021     | 2.289      | 0.078    | 4.654     | 0.213   | 1.212          | 0.253       | 1.577  | 9.659  |
| A2      | style/warm | 28.328  | 1.567 | 0.028     | 2.167      | 0.081    | 4.776     | 0.206   | 1.181          | 0.236       | 1.456  | 9.680  |
| C6      | none/cold  | 155.668 | 2.555 | 0.000     | 13.964     | 0.000    | 22.751    | 0.313   | 1.535          | 0.000       | 6.907  | 24.763 |
| C6      | none/warm  | 152.715 | 2.336 | 0.000     | 13.877     | 0.000    | 22.486    | 0.294   | 1.451          | 0.000       | 7.138  | 23.765 |
| C7      | none/cold  | 41.812  | 0.628 | 0.016     | 8.501      | 0.000    | 0.000     | 0.000   | 0.923          | 0.000       | 1.819  | 25.800 |
| C7      | none/warm  | 41.386  | 0.645 | 0.016     | 7.923      | 0.000    | 0.000     | 0.000   | 0.928          | 0.000       | 1.800  | 25.053 |
| C7      | style/cold | 82.233  | 1.255 | 0.040     | 30.039     | 2.357    | 10.606    | 2.575   | 1.658          | 126.365     | 1.935  | 33.515 |
| C7      | style/warm | 83.730  | 1.310 | 0.035     | 28.124     | 2.465    | 10.870    | 2.850   | 1.699          | 121.457     | 1.947  | 34.036 |
| U6 cold | style/cold | 348.969 | 3.358 | 0.938     | 23.529     | 3.060    | 15.331    | 0.712   | 1.630          | 133.737     | 10.642 | 29.099 |
| U7 cold | style/cold | 78.995  | 1.225 | 0.036     | 29.380     | 2.348    | 10.515    | 2.242   | 1.696          | 123.634     | 1.865  | 32.646 |
| U6 warm | style/warm | 341.034 | 3.271 | 0.904     | 23.424     | 3.153    | 15.507    | 0.704   | 1.629          | 130.405     | 10.568 | 31.018 |
| U7 warm | style/warm | 78.818  | 1.210 | 0.037     | 29.245     | 2.311    | 10.361    | 2.353   | 1.781          | 121.456     | 1.817  | 32.309 |

Cumulative no-change HTML time falls about 73%, normalization/projection vanish,
but reference inventory still costs 7.9–8.5 s. Cumulative style retains 78.8–83.7 s
HTML, 28.1–30.0 s references and 121.5–126.4 s inline-rule work: the last is the
largest exclusive category, with the same 32.4 million segment occurrences.
This measurement does not further split scanner/cancellation/composition without
a profile; [M6's disjoint profile](./large-fixture-cost-profiles.md) remains history.

Fewer parses are not equally cheap parses: cumulative no-change HTML throughput
is M6 21.24–21.65 versus M7 16.00–16.17 MB/s; style U6 22.55–23.07 versus M7
15.98–16.98. Source locations/token provenance add work; shared reference/style
inventory and derivation add non-parse work. These distinct workloads are not
a controlled parser microbenchmark. The original-tree inventory fulfills the
byte model while leaving real cost, consistent with M9A's retained-cost checkpoint.

## Evidence And Final Gate

Evidence directory: `.context/delegation/scalable/m7-measurements/`. Prefixes
`m7-control-default-{1,2}`, `m7-candidate-default-{1,2}`, `m7-control-cumulative`,
`m7-candidate-cumulative`, `m7-uncapped-{control,candidate}-component-style-{cold,warm}`
map to the table labels. Each retains `.json`, `.log`, `.stdout.log`, `.stderr.log`,
`.exit`, `.pid`, command and before/after machine JSON; matrices also retain
every original sample and sample-end CPU snapshot. `summary.json/.log` re-derive
worker ends, membership, counts, ratios, exclusive work and conservative margins
from reports/logs. `html-retention.json`, both `*.setup-{before,after}.sha256`,
build logs, runner sources and all three driver logs remain alongside them.

Final verification uses **`PLAYWRIGHT_CHANNEL=chromium`**, Node 24.19.0:
individual xtask package, 3,482 unit, 725 browser and 219 hydration checks pass.
The combined gate stops at the unpatched dependency audit; **push remains held**.
The [checkpoint](./shared-page-analysis-checkpoint.md#post-measurement-verification-and-push-hold)
retains results; no dependencies/gate/timeouts change and M8 remains unstarted.
