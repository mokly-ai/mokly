# Fingerprinted Material Measurements

The [fixed-code remeasurement](./fingerprinted-materials-remeasurement.md)
preserves 24 further samples of `14447151` against same-session M8 controls.
Linked improves; cumulative style remains 9.2–10.4% slower. The supervisor has
stopped the gate/push. The [200-view investigation](./fingerprinted-materials-route-investigation.md)
records overlapping warmed probes, per-function costs and unresolved production
attribution. The original `b11e51d0` measurements below remain unchanged.

M9 has not improved end-to-end classification in this measurement set. The
48 unprofiled classifications all return `ok` with exact expected membership,
but default no-change cold is 10.4% slower than M8 and default linked-stylesheet
is about 8% slower. Cumulative style is 7.8% slower cold / 11.2% slower warm;
cumulative markup is about 4% slower and linked is 7.6% slower cold / 1.0% warm.

The material byte bound is delivered, but that alone is not a wall-time win.
The [worker profile report](./fingerprinted-materials-profiles.md) identifies
avoidable M9 work, separates existing validation/composition from additions,
and proposes scoped fixes with savings estimates. This report preserves the
pre-fix measurements. The supervisor subsequently approved all three option-A
fixes for a separate [checkpoint](./fingerprinted-materials-performance-checkpoint.md)
and narrow remeasurement before the gate/push. No recorded review finding is approved.

## Provenance And Method

Measured on October 4, 2026: M9 `b11e51d03d1fb510e60c98b52433dd08a70cea6d`
against clean M8 `5e5111dc6e1df740873e614f822b2727df1674b5` at
`/tmp/mokly-m9-m8-control`. Both engines were built before measurement and stayed
clean throughout the unprofiled and profiled runs. The branch was not renamed.

The host reported `Intel(R) Xeon(R) Processor @ 2.90GHz`, eight CPUs,
2899.962 MHz on every CPU, 16,643 MiB RAM and no swap. Node was 24.19.0;
benchmarks used system Chrome 153.0.8010.52. Before and after every matrix and
sample, snapshots retain `/proc/cpuinfo`, `uptime`, `nproc`, `free -m`, CPU ticks,
steal and a process-name inventory. No suite, unrelated build or profile ran
alongside an unprofiled matrix. Per-sample aggregate steal was 0.02–0.19 seconds,
0.002130–0.009752% of aggregate CPU ticks; seconds are across eight CPUs.

Both committed fixtures retain 30 areas / 40 screens / 12 rows, four linked
sheets, share 0.5, 1,590 entries, 5,550 documents and 5,520 compared views.
Default `.context/mokly-large-y6t0te` has fixture commit
`8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22`; cumulative
`.context/mokly-large-reUW91` has `2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`.
The template digest is
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
Preparation remains clean `4b09b13e`. Dependency maps match exactly: React/DOM
19.2.7, RNW 0.21.2, Firna 0.14.0, Lightning CSS 1.33.0, parse5 8.0.1,
css-select 7.0.0 and css-what 8.0.0. Neither fixture was regenerated.

The selected engine ran the following command through the Node 24.19.0 wrapper:

```bash
npm exec --yes --package=node@24.19.0 -- node scripts/large/cli.mjs benchmark \
  --config /absolute/fixture/mokly.config.ts \
  --scenario no-changes --scenario component-style \
  --scenario screen-markup --scenario linked-stylesheet
```

Cumulative adds `--inline-styles`. The retained driver adds a harness-only
`--import` observer and sample label to save host state before the sample clock;
Serve/workers do not inherit that observer. `NODE_OPTIONS`, profile variables
and `PLAYWRIGHT_CHANNEL` were unset. Every exact invocation is in `*.command.json`.
Default order was M8, M9, M9, M8 (A1, B1, B2, A2), then cumulative M8 and M9.
Cold/warm both use fresh servers; cold does not mean a flushed OS page cache.

All 48 samples were retained, with no retries or incomplete cells, so no paired
uncapped unprofiled supplement was necessary. All browser assertions completed.
The independent five-second usable-startup budget failed in 22/48 samples:
3/16 default M8, 10/16 default M9, 3/8 cumulative M8 and 6/8 cumulative M9.
Five matrices exited 1 for that budget; A2 exited 0. This is not classification
acceptance. SHA-256 restoration checks cover all 5,560 renderer, identity and
mockup files per fixture after the matrices and again after profiling; all match.

## Evidence

All commands, samples, raw diagnostics and host snapshots are under
`.context/delegation/scalable/m9-measurements/`. `summary.json` cross-checks every
reported count and worker duration against its raw background session;
`samples.csv` retains 48 rows with per-sample heap, paths, every emitted work and
inline count, readiness, headroom, CPU model/MHz, uptime and steal. Missing M8
material counters remain absent, not invented zeros. Repeat and cross-tree
shared integer counts agree. Full durations remain in the raw document-work
records. `builds.json`, `fixture-preflight.json`, `restoration-after-*.json`,
`driver.log`, and `*.machine-{before,after}.json` retain setup and restoration.

Report stems are `m9-{control,candidate}-default-{1,2}` and
`m9-{control,candidate}-cumulative`, with `.json`, `.samples.json`,
`.stdout.log`, `.stderr.log`, `.log`, `.command.json` and `.exit` siblings.
A detached launcher initially exited before producing any benchmark sample;
`launch-note.txt` retains that infrastructure event. Profiling has its own
separate bootstrap note and evidence in the linked report.

Below, `none`, `style`, `markup`, `linked` mean the four command scenarios in
order. Times are worker `changes.classify` milliseconds; heap is sampled worker
heap, not process RSS. Each default cell retains both samples from each tree.

## Default samples: classification ms / heap MiB

| Cell        | A1 M8             | B1 M9             | B2 M9             | A2 M8             |
| ----------- | ----------------- | ----------------- | ----------------- | ----------------- |
| none/cold   | 17852.12 / 275.60 | 19056.09 / 281.37 | 20822.94 / 316.69 | 18279.65 / 225.89 |
| none/warm   | 18284.61 / 218.34 | 18495.10 / 226.69 | 19632.07 / 233.41 | 18625.89 / 289.55 |
| style/cold  | 17603.82 / 188.58 | 19138.20 / 188.65 | 16712.34 / 191.43 | 16514.83 / 178.54 |
| style/warm  | 18323.71 / 183.10 | 17172.96 / 188.18 | 16688.27 / 197.68 | 16224.11 / 154.86 |
| markup/cold | 18622.71 / 314.05 | 18552.89 / 313.51 | 17615.60 / 194.73 | 18333.01 / 225.67 |
| markup/warm | 17670.04 / 186.41 | 16462.89 / 173.73 | 18729.50 / 311.46 | 16047.57 / 179.34 |
| linked/cold | 27923.87 / 369.94 | 30797.48 / 231.87 | 27972.96 / 247.39 | 26543.82 / 218.52 |
| linked/warm | 25860.14 / 277.77 | 28497.03 / 270.97 | 27042.24 / 230.82 | 25584.95 / 197.41 |

## Cumulative samples: classification ms / heap MiB

| Cell        | M8                 | M9                 |
| ----------- | ------------------ | ------------------ |
| none/cold   | 57626.26 / 272.96  | 58762.64 / 284.74  |
| none/warm   | 59203.73 / 229.21  | 58971.91 / 290.42  |
| style/cold  | 189453.24 / 260.28 | 204139.20 / 260.58 |
| style/warm  | 189010.35 / 258.29 | 210095.19 / 257.24 |
| markup/cold | 58550.35 / 250.86  | 60919.48 / 269.85  |
| markup/warm | 57944.89 / 278.48  | 60231.84 / 286.68  |
| linked/cold | 82526.34 / 294.03  | 88776.57 / 309.25  |
| linked/warm | 83744.05 / 278.61  | 84584.73 / 296.72  |

The default ratio is mean(M9) / mean(M8). Its envelope runs from min(M9) /
max(M8) to max(M9) / min(M8), using unrounded recorded durations. It is not a
confidence interval. A cumulative cell has one pair and no within-cell spread.
The default cold no-change and both linked ranges do not overlap; preserve
those regressions rather than substitute the later profiled timings.

## Same-host M9/M8 ratios

| Fixture/cell           | Ratio  | Cross-sample envelope |
| ---------------------- | ------ | --------------------- |
| default/none/cold      | 1.1037 | 1.0425–1.1664         |
| default/none/warm      | 1.0330 | 0.9930–1.0737         |
| default/style/cold     | 1.0508 | 0.9494–1.1588         |
| default/style/warm     | 0.9801 | 0.9107–1.0585         |
| default/markup/cold    | 0.9787 | 0.9459–1.0120         |
| default/markup/warm    | 1.0437 | 0.9317–1.1671         |
| default/linked/cold    | 1.0790 | 1.0018–1.1603         |
| default/linked/warm    | 1.0796 | 1.0457–1.1138         |
| cumulative/none/cold   | 1.0197 | one pair              |
| cumulative/none/warm   | 0.9961 | one pair              |
| cumulative/style/cold  | 1.0775 | one pair              |
| cumulative/style/warm  | 1.1116 | one pair              |
| cumulative/markup/cold | 1.0405 | one pair              |
| cumulative/markup/warm | 1.0395 | one pair              |
| cumulative/linked/cold | 1.0757 | one pair              |
| cumulative/linked/warm | 1.0100 | one pair              |

The cumulative delivery deadline begins after interactive work. The conservative
headroom below is `900000 + usableMs + propsMs + cachedPreviewMs - 2 - changesReadyMs`;
the two-millisecond subtraction covers rounding. It is a lower bound, not the
exact deadline margin. M9's narrowest measured margin is 400,304 ms, style cold.

## Cumulative readiness and conservative headroom ms

| Cell        | M8 ready | M8 headroom | M9 ready | M9 headroom |
| ----------- | -------- | ----------- | -------- | ----------- |
| none/cold   | 325373   | 580354      | 327957   | 577884      |
| none/warm   | 330016   | 575696      | 330188   | 575552      |
| style/cold  | 462074   | 443624      | 506038   | 400304      |
| style/warm  | 456032   | 449863      | 499078   | 406904      |
| markup/cold | 343339   | 562702      | 346279   | 559725      |
| markup/warm | 331737   | 574170      | 331420   | 574462      |
| linked/cold | 350645   | 555093      | 369419   | 536642      |
| linked/warm | 355240   | 550460      | 356540   | 549470      |

Counts below are identical across cold/warm and repeats; path/HTML/inline counts
also agree across M8 and M9. Full per-sample records remain in the CSV and JSON.
Only `pageAnalysis` and, where present, 30 reference parses (10,182 bytes) occur.

## Shared path and parse counts

| Fixture/scenario  | fast/style/complete | pageAnalysis parses/bytes | all parses/bytes |
| ----------------- | ------------------- | ------------------------- | ---------------- |
| default/none      | 5520/0/0            | 5520 / 117677702          | 5520 / 117677702 |
| default/style     | 5336/184/0          | 5520 / 117677702          | 5550 / 117687884 |
| default/markup    | 5516/0/4            | 5524 / 117770627          | 5554 / 117780809 |
| default/linked    | 3120/0/2400         | 7920 / 173212319          | 7950 / 173222501 |
| cumulative/none   | 5520/0/0            | 5520 / 669071362          | 5520 / 669071362 |
| cumulative/style  | 0/5520/0            | 5520 / 669071362          | 5550 / 669081544 |
| cumulative/markup | 5516/0/4            | 5524 / 669285114          | 5554 / 669295296 |
| cumulative/linked | 3120/0/2400         | 7920 / 993590172          | 7950 / 993600354 |

## Shared inline counts

| Fixture/style | elements | segments | hits     | parses | fallbacks |
| ------------- | -------- | -------- | -------- | ------ | --------- |
| default       | 736      | 56628    | 56468    | 160    | 0         |
| cumulative    | 11040    | 32447024 | 32441326 | 5698   | 0         |

Every other scenario has zero inline element/segment/hit/parse/fallback counts:
its equal reference-free styles skip inline analysis. Those zero counts do not
mean the page contains no styles. All cumulative style views take the route,
with one page analysis per view and no fingerprint/material work.

## M9 material counters

| Fixture/scenario  | FP views | Material B | Material norm B | Source norm B | FP B/hashes      | seams/units      |
| ----------------- | -------- | ---------- | --------------- | ------------- | ---------------- | ---------------- |
| default/none      | 0        | 0          | 0               | 0             | 0 / 0            | 0 / 0            |
| default/style     | 0        | 0          | 0               | 7906920       | 0 / 0            | 0 / 0            |
| default/markup    | 4        | 181880     | 461592          | 275494        | 43953 / 8        | 320 / 7680       |
| default/linked    | 2400     | 108426000  | 275201520       | 38279244      | 26204577 / 2480  | 192000 / 4608000 |
| cumulative/none   | 0        | 0          | 0               | 0             | 0 / 0            | 0 / 0            |
| cumulative/style  | 0        | 0          | 0               | 1338168848    | 0 / 0            | 0 / 0            |
| cumulative/markup | 4        | 182630     | 464394          | 524564        | 163853 / 4       | 320 / 7680       |
| cumulative/linked | 2400     | 109503084  | 278443812       | 42675900      | 294639188 / 2400 | 192000 / 4608000 |

`B` in this table means UTF-8 bytes. `materialHashBytes` is zero in every M9
sample: provenance seeds already bypass the HTML closure-identity hash. M8
predates these counters. Each linked fixture has 2,400 fingerprinted views,
80 checked seams / 1,920 window units per fingerprinted view. Fingerprint inputs
grow from 26.2 MB to 294.6 MB across fixtures; material and material-normalization
inputs stay near 109 MB and 278 MB despite much larger sheets. These are distinct
renderers, not the N/N+1 proof; that proof remains in the accepted code checkpoint.

## Cumulative M9 exclusive work ms

| Cell        | classify  | HTML     | inline rules | references | normalization | hash    | Rest     |
| ----------- | --------- | -------- | ------------ | ---------- | ------------- | ------- | -------- |
| none/cold   | 58762.64  | 29696.68 | 0.00         | 5900.00    | 0.00          | 728.88  | 21103.46 |
| none/warm   | 58971.91  | 29825.67 | 0.00         | 5853.65    | 0.00          | 674.59  | 21284.71 |
| style/cold  | 204139.20 | 30043.52 | 102250.01    | 17134.55   | 2282.24       | 775.92  | 48208.74 |
| style/warm  | 210095.19 | 31034.09 | 106198.44    | 17523.31   | 2336.76       | 925.76  | 48538.44 |
| markup/cold | 60919.48  | 30126.46 | 1.98         | 6265.07    | 8.43          | 732.80  | 22348.11 |
| markup/warm | 60231.84  | 29767.56 | 1.96         | 6224.16    | 9.22          | 739.17  | 21987.43 |
| linked/cold | 88776.57  | 45270.92 | 1420.80      | 9589.65    | 1876.12       | 1342.15 | 25035.90 |
| linked/warm | 84584.73  | 43447.49 | 1398.07      | 9240.19    | 1935.59       | 1081.99 | 23619.14 |

`Rest` subtracts all ten exclusive work fields, including the omitted small
range/discovery/matching/projection/implementation fields. It is not a phase or
a GC measurement. Inline-rule work dominates style at 102.3–106.2 s, with
30.0–31.0 s parsing and 48.2–48.5 s outside the measured synchronous fields.
HTML parsing dominates the other cumulative scenarios: about 30 s for none/markup
and 43.4–45.3 s for linked. The linked normalization/projection reduction is real,
but the total worker samples are still slower; the profile report explains the
limits of causal attribution and the remaining M9 costs.

## Decision 13 Context, Not Acceptance

Here B is the historical M2 default reference in the fixture README, D is this
session's two-run M9 default mean and C is its one M9 cumulative sample. This is
not regenerated two-run acceptance, does not include the derived spot sample,
and does not substitute the current M8 control for the prescribed reference.

## Decision 13 context only

| Cell        | C/B    | <=2  | D/B    | <=1.05 |
| ----------- | ------ | ---- | ------ | ------ |
| none/cold   | 1.7593 | pass | 0.5970 | pass   |
| none/warm   | 1.7575 | pass | 0.5682 | pass   |
| style/cold  | 5.5533 | FAIL | 0.4876 | pass   |
| style/warm  | 5.5479 | FAIL | 0.4471 | pass   |
| markup/cold | 1.7509 | pass | 0.5197 | pass   |
| markup/warm | 1.5536 | pass | 0.4539 | pass   |
| linked/cold | 1.7794 | pass | 0.5890 | pass   |
| linked/warm | 1.7583 | pass | 0.5772 | pass   |

## Style/no-change context only

| Fixture/state   | Ratio  | <=1.25 |
| --------------- | ------ | ------ |
| default/cold    | 0.8990 | pass   |
| default/warm    | 0.8881 | pass   |
| cumulative/cold | 3.4740 | FAIL   |
| cumulative/warm | 3.5626 | FAIL   |

The cumulative style targets still fail: 204,139.20 ms cold and 210,095.19 ms warm
exceed the 73,520.37 / 75,738.78 ms contextual limits; style/no-change is
3.4740 / 3.5626 against 1.25. Other C/B and every D/B cell meet their contextual
ratio threshold. All measured heaps are below 1,024 MiB (maximum 369.94 MiB),
and membership is exact. The separate startup budget still fails as recorded.
No Decision, threshold or review finding was changed. The M9 measurement TODO is
complete; that reporting stop awaited the approved fixes' checkpoint and narrow
remeasurement. The follow-up linked above records their completion and the
remaining gate/push blocker. Only report/plan Markdown validation ran at this stop.

Documentation validation: `npm exec --yes --package=node@24.19.0 -- npx prettier
--check` passes for both reports, the fixture README and the plan. Relative-link
checks and `git diff --check` / `git diff --cached --check` pass. The deletion
audit matches the recorded pre-task baseline; no new deletion is introduced.
The implementation stays at the accepted checkpoint; no runtime suite or
`cargo xtask check` is rerun and nothing is pushed at this supervisor-directed stop.
