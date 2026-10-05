# Fingerprinted Materials: Narrow Remeasurement

Fixed M9 `14447151` still regresses on the cumulative style route: 211.85 s cold
and 217.75 s warm versus M8's 193.95 s and 197.22 s, +9.2% and +10.4%.
The supervisor therefore stopped the gate and push and requested the separate
[200-view investigation](./fingerprinted-materials-route-investigation.md). No further implementation change is authorized here.

The fixed linked-stylesheet results improve against their contemporary controls.
Default ranges now overlap in all four measured cells. Warm default no-change
still averages 8.6% slower; it is not a demonstrated win. The original
`b11e51d0` results remain in the [preceding measurement report](./fingerprinted-materials-measurements.md), unchanged.

## Method And Evidence

October 5, 2026, same boot and host as the prior round: Intel Xeon @ 2.90 GHz,
eight logical CPUs, 2899.962 MHz throughout, 16,643 MiB RAM, no swap. Node 24.19.0
and system Chrome 153.0.8010.52 were used. Clean M8 `5e5111dc` lives at
`/tmp/mokly-m9-m8-control`; fixed M9 is `14447151a74073c4cdcc4fbe2502dd86210125fb`.
Each tree's own engine was rebuilt before timing. Both stayed clean throughout.

The same committed default/cumulative fixtures, sizes, fixture commits,
template digest and dependencies as the original report were reused. Default
order was M8, M9, M9, M8 for no-change and linked; cumulative was M8 then M9 for
style and linked. Each includes cold and warm; these are fresh-server scenarios,
not flushed OS caches. Every sample records CPU model/MHz, uptime, memory and
steal before/after; aggregate eight-CPU steal was 0.03–0.18 s, 0.003191–0.008985%.
No suite, profile or unrelated build overlapped timed samples.

All 24 classification samples are `ok` with exact expected membership. None is
incomplete, so no uncapped classification-only supplement is required. All six
matrix commands exit 1 because the separate five-second usable-startup target
fails in 20/24 samples; browser assertions and classification succeed. Every
sample is retained. All 5,560 files per fixture match their setup hashes after
the matrices and after the default GC profiles. The route-input preparation
also restores these same hashes before probing; final restoration checks pass too.

Evidence is `.context/delegation/scalable/m9-remeasurements/`: `driver.log`, the
six `m9-{control,candidate}-{default-1,default-2,cumulative}` report/log stems,
`*.command.json`, per-sample `*.machine-{before,after}.json`, `summary.json`, and
`samples.csv`. The summary validates all reported durations/counts against raw
worker events. The CSV retains all material, normalization, fingerprint/hash,
document and inline counters, heap, readiness and headroom for every sample.
M8's unavailable M9 counters remain absent, not synthetic zeros.

## Timed Results

Default cells are classification ms / heap MiB.

| Cell                   | M8 A1             | M9 B1             | M9 B2             | M8 A2             |
| ---------------------- | ----------------- | ----------------- | ----------------- | ----------------- |
| no-changes/cold        | 21433.80 / 229.23 | 19101.67 / 225.22 | 20067.01 / 224.06 | 18830.46 / 232.82 |
| no-changes/warm        | 17879.43 / 176.37 | 21372.65 / 195.44 | 19333.00 / 317.76 | 19590.85 / 195.82 |
| linked-stylesheet/cold | 30681.01 / 227.56 | 29254.43 / 230.20 | 27494.19 / 211.41 | 28017.08 / 231.16 |
| linked-stylesheet/warm | 28201.61 / 200.51 | 29993.35 / 247.27 | 27011.82 / 207.87 | 29250.95 / 426.92 |

Cumulative cells are classification ms / heap MiB / readiness ms / headroom ms.

| Cell                   | M8                                   | M9                                   |
| ---------------------- | ------------------------------------ | ------------------------------------ |
| component-style/cold   | 193945.62 / 258.78 / 478949 / 427318 | 211854.34 / 205.67 / 493239 / 412775 |
| component-style/warm   | 197224.57 / 256.41 / 482734 / 423409 | 217745.92 / 255.50 / 502586 / 403406 |
| linked-stylesheet/cold | 91183.44 / 272.19 / 382068 / 524252  | 84144.90 / 288.36 / 366034 / 540264  |
| linked-stylesheet/warm | 95145.31 / 288.27 / 384971 / 521350  | 85323.38 / 290.45 / 364695 / 541112  |

Each ratio uses its own session’s same-host M8 control.

| Cell                              | b11e51d0 / contemporaneous M8 | 14447151 / contemporaneous M8 |
| --------------------------------- | ----------------------------- | ----------------------------- |
| default/no-changes/cold           | 1.1037 (1.0425–1.1664)        | 0.9728 (0.8912–1.0657)        |
| default/no-changes/warm           | 1.0330 (0.9930–1.0737)        | 1.0863 (0.9868–1.1954)        |
| default/linked-stylesheet/cold    | 1.0790 (1.0018–1.1603)        | 0.9668 (0.8961–1.0442)        |
| default/linked-stylesheet/warm    | 1.0796 (1.0457–1.1138)        | 0.9922 (0.9235–1.0635)        |
| cumulative/component-style/cold   | 1.0775 (one pair)             | 1.0923 (one pair)             |
| cumulative/component-style/warm   | 1.1116 (one pair)             | 1.1041 (one pair)             |
| cumulative/linked-stylesheet/cold | 1.0757 (one pair)             | 0.9228 (one pair)             |
| cumulative/linked-stylesheet/warm | 1.0100 (one pair)             | 0.8968 (one pair)             |

Ratios are mean(M9)/mean(M8). Default envelopes are min(M9)/max(M8) through
max(M9)/min(M8), not confidence intervals. Each cumulative cold/warm cell is
one pair with no within-cell spread. This session's observed style ranges are
193.95–197.22 s for M8 and 211.85–217.75 s for M9. Across both sessions, M8 is
189.01–197.22 s and M9 is 204.14–217.75 s. The non-overlap is preserved; profiles
and warmed probes do not replace those unprofiled measurements.

Headroom is the same conservative lower bound as the original report:
`900000 + usableMs + propsMs + cachedPreviewMs - 2 - changesReadyMs`. Fixed M9's
smallest margin is 403,406 ms. All heaps remain below 1,024 MiB; peak is 426.92 MiB.

## Counts And Work

Shared integer counts agree across trees, repeats and temperature states.

| Fixture/scenario   | fast/style/complete | pageAnalysis parses/bytes | all parses/bytes |
| ------------------ | ------------------- | ------------------------- | ---------------- |
| default/no-changes | 5520/0/0            | 5520 / 117677702          | 5520 / 117677702 |
| default/linked     | 3120/0/2400         | 7920 / 173212319          | 7950 / 173222501 |
| cumulative/style   | 0/5520/0            | 5520 / 669071362          | 5550 / 669081544 |
| cumulative/linked  | 3120/0/2400         | 7920 / 993590172          | 7950 / 993600354 |

Only cumulative style performs inline analysis: 11,040 elements, 32,447,024
segments, 32,441,326 hits, 5,698 parses and zero fallbacks on either tree. Other
measured scenarios have zero inline counts because equal styles skip analysis.

| Cell                         | material B | material norm B | source norm B | fingerprint B | hashes | FP views |
| ---------------------------- | ---------- | --------------- | ------------- | ------------- | ------ | -------- |
| default/no-changes           | 0          | 0               | 0             | 0             | 0      | 0        |
| default/linked-stylesheet    | 108426000  | 275201520       | 38279244      | 26204577      | 2480   | 2400     |
| cumulative/component-style   | 0          | 0               | 1338168848    | 0             | 0      | 0        |
| cumulative/linked-stylesheet | 109503084  | 278443812       | 42675900      | 294639188     | 2400   | 2400     |

`materialHashBytes` is zero in every fixed-M9 sample. Each linked cell has
192,000 seams / 4,608,000 window units. Fast/style cells have zero seams,
fingerprints, material bytes and material-normalization bytes. The route still
normalizes the original source in its preceding quick attempt, which accounts
for 1,338,168,848 source-normalization bytes with diagnostics enabled.

On cumulative style, M8's exclusive inline-rule work is 95.19/97.26 s cold/warm;
M9's is 105.61/110.52 s. HTML parsing is 29.30/28.73 s versus 33.02/30.93 s.
The same counted work takes longer. These locations do not alone identify the
cause; the focused probe separates diagnostics, shared algorithms and GC.
On linked, fixed M9 reduces normalization plus projection from 5.29/5.38 s
to 1.84/1.88 s, while adding fingerprint preparation/hash work. Whole-worker
time nevertheless improves in this pair; broader acceptance is not claimed.

## GC Profiles And Stop

Timings do not expose GC duration, so two additional worker-only default
no-change cold profiles run after the entire timed set, M8 then M9. The M6
off-by-default inspector harness samples at 1,000 microseconds, beginning and
ending at `changes.classify`; compilation and renderer startup are excluded.
Both classifications succeed with 5,520 fast views and identical shared counts.
M9's profiler command exits 1 only for its 5,404 ms startup result; M8's is 4,982 ms.

| Capture                | M8 classify/GC ms | M9 classify/GC ms  |
| ---------------------- | ----------------- | ------------------ |
| original b11e51d0 pair | 16742.19 / 733.15 | 19816.74 / 2535.20 |
| fixed 14447151 pair    | 18621.24 / 873.03 | 19559.61 / 2356.31 |

GC remains elevated in the fixed profile pair (+1,483.27 ms). Single profile
pairs do not establish the allocation owner or override the ABBA spread.
GC is weighted self time from CPU samples, not a timing-record total. The only
negative-delta correction in the new captures is 49 microseconds for M9.
`gc-comparison.json`, `profile-validation.json`, raw `profiles/*.cpuprofile`
and metadata/summary files retain this evidence.

## Decision 13 Context

Fixed cumulative style still exceeds the contextual 73,520.37/75,738.78 ms
limits by a wide margin. Its C/B ratios are about 5.76/5.75, against 2.
Linked's C/B ratios are about 1.69/1.77 and meet that contextual threshold.
The cumulative no-change cell was not rerun in this narrow set, so it does not
produce a fresh style/no-change ratio or replace the earlier failed 1.25 target.
There is no regenerated acceptance pair or derived spot sample here.

No gate or push runs at this stop. The earlier complete code-checkpoint suites
remain recorded; this reporting-only work runs Markdown/link/diff validation.
The supervisor will decide the scope of any further fix from the focused
investigation, before another code checkpoint or measurement round.
