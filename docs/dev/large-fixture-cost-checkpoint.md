# Classification Cost Checkpoint

Milestone 6 evidence, not performance acceptance. The
[profile breakdown](./large-fixture-cost-profiles.md) and
[cost model and cold-path experiment](./large-fixture-cost-model.md) complete
this report. No measurement was repeated after the reporting-session disconnect.

## Provenance And Execution

Measured `1887eff66087cfccf53a70820df87d6efdb8ecec`, `moklyDirty: false`,
under Node 24.19.0 on Amazon Linux x64, KVM, Intel Xeon 2.90 GHz:
four physical cores, eight logical CPUs, 16,643 MiB RAM, no swap.
The code differs from M5's measured `a78b6113` only in export visibility,
not analysis or fixture inputs. The complete source gate already passed:
11 Rust, 3,151 unit, 725 Chromium and 219 hydration tests, plus static,
package and example checks (`m5-final-check.log`, exit 0).

Both committed fixtures retain 30 areas, 40 screens, 12 rows, four shared
sheets and share 0.5: 1,590 entries, 5,550 documents, 5,520 compared views.
`templateDigest`:
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
Prepared code `4b09b13e6b537b1c02278bfbefd75e62b85f8af5` was clean.
Default/cumulative `fixtureCommit` values are respectively
`8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22` and
`2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`.
`renderingDependencies`: `react`/`react-dom` 19.2.7,
`react-native-web` 0.21.2, `@firna/ui` 0.14.0, `lightningcss` 1.33.0,
`parse5` 8.0.1, `css-select` 7.0.0, `css-what` 8.0.0.

Commands were `npm run benchmark:large --` and its `--inline-styles` variant,
with no scenario filter. Each matrix retained all eight cold/warm samples.
The quiet default matrix is the primary default timing source. The first
default matrix is preserved as **perturbed**, not relabelled or discarded:
the supervisor's M5 review ran about 23:41–00:04 UTC across October 1–2,
including niced microbenchmarks and possibly tests on sibling threads.
The linked warm slowdown after that window also shows ordinary machine noise.

Runs used `nohup`, process audits and before/after `nproc`, `free -m`, `uptime`.
No implementer build, suite or other measurement ran concurrently; no tracked
file changed. All fixtures ended restored to setup, with only the intentional
unused `mockups/assets/shared-1.css` rule differing from their baseline.

| Run                          | UTC interval, October 1–2, 2026 | Free MiB before/after | Available MiB before/after | Uptime before/after | Load before → after (1/5/15 min) |
| ---------------------------- | ------------------------------- | --------------------- | -------------------------- | ------------------- | -------------------------------- |
| Default perturbed            | Oct 1 23:46:03–Oct 2 00:21:34*  | 11699 / 11551         | 15145 / 15069              | 14:25 / 15:01       | 0.16/0.58/1.28 → 0.39/1.40/1.76  |
| Cumulative                   | Oct 2 00:21:34–02:07:25         | 11553 / 11523         | 15071 / 15112              | 15:01 / 16:47       | 0.39/1.40/1.76 → 1.02/1.71/1.98  |
| Cumulative no-change profile | Oct 2 02:07:36–02:25:06         | 11497 / 11523         | 15087 / 15127              | 16:47 / 17:04       | 0.87/1.65/1.95 → 1.12/1.66/1.81  |
| Cumulative style profile     | Oct 2 02:25:06–02:49:42         | 11523 / 11554         | 15127 / 15197              | 17:04 / 17:29       | 1.12/1.66/1.81 → 1.10/1.75/2.00  |
| Default style profile        | Oct 2 02:49:42–02:54:34         | 11551 / 11445         | 15193 / 15103              | 17:29 / 17:34       | 1.10/1.75/2.00 → 1.42/1.75/1.94  |
| Default quiet                | Oct 2 02:54:34–03:23:09         | 11448 / 11325         | 15105 / 15030              | 17:34 / 18:02       | 1.42/1.75/1.94 → 1.44/2.09/2.10  |
| Cold-cost experiment         | Oct 2 03:23:09–03:24:15         | 11232 / 11497         | 14936 / 15201              | 18:02 / 18:03       | 1.44/2.09/2.10 → 1.18/1.89/2.03  |

\* The perturbed launcher failed after the final report/restoration, before
persisting the process exit and immediate machine-after snapshot. Its JSON
was recovered byte-for-byte from the final `Benchmark` line; no sample was
rerun. Its exit is **not recorded**, and its after observation is explicitly a
delayed recovery snapshot. Other matrices exit 1 solely for `usableMs >= 5000`.

## Completed Matrices

All **24 outcomes are `ok`**, with exact membership: none for no-change/linked,
`area-1-action` for component-style, and `area-1-screen-1`/`area-1-flow-1`
for markup. Heap is sampled worker `used_heap_size`, not RSS. Durations are
completed worker milliseconds; startup is independent of classification success.

| Scenario/state         | Default perturbed ms / heap MiB | Default quiet ms / heap MiB | Cumulative ms / heap MiB | Quiet default / reference B |
| ---------------------- | ------------------------------- | --------------------------- | ------------------------ | --------------------------- |
| no-changes/cold        | 50170.43 / 204.83               | 46541.69 / 182.48           | 193202.31 / 295.21       | 1.3934                      |
| no-changes/warm        | 43202.10 / 189.19               | 48754.14 / 250.64           | 211651.72 / 299.93       | 1.4530                      |
| component-style/cold   | 46128.71 / 221.76               | 44765.40 / 198.45           | 525132.57 / 300.38       | 1.2178                      |
| component-style/warm   | 57093.57 / 192.27               | 42481.21 / 178.97           | 505537.11 / 297.40       | 1.1218                      |
| screen-markup/cold     | 54095.17 / 239.07               | 45381.73 / 172.16           | 194115.06 / 279.47       | 1.3043                      |
| screen-markup/warm     | 39304.51 / 209.40               | 42808.92 / 187.48           | 175065.06 / 276.88       | 1.1042                      |
| linked-stylesheet/cold | 56159.99 / 226.59               | 53683.14 / 190.89           | 298794.33 / 282.74       | 1.0760                      |
| linked-stylesheet/warm | 75889.45 / 196.20               | 60532.58 / 197.16           | 258706.57 / 297.22       | 1.2583                      |

The M2 reference means remain in the [fixture README](../../tests/fixtures/large/README.md#milestone-2-reference-and-cumulative-baseline).
No current default cell meets `D/B <= 1.05`; no cumulative cell meets `C/B <= 2`.
Current cumulative style/no-change ratios are 2.7180 cold and 2.3885 warm,
not 1.25. These are checkpoint single samples, not acceptance's two-run means.

### Same-code Spread

These are milliseconds, not a causal before/after comparison. M5 did not
measure markup/linked; `—` means absent. Observed bounds include perturbation;
the quiet source remains the basis of the model, with this spread carried as
uncertainty. Identical parse counts do not imply identical elapsed time.

| Scenario/state         | M5 default | M6 perturbed | M6 quiet | Observed min–max  |
| ---------------------- | ---------- | ------------ | -------- | ----------------- |
| no-changes/cold        | 35143.25   | 50170.43     | 46541.69 | 35143.25–50170.43 |
| no-changes/warm        | 33940.58   | 43202.10     | 48754.14 | 33940.58–48754.14 |
| component-style/cold   | 41698.02   | 46128.71     | 44765.40 | 41698.02–46128.71 |
| component-style/warm   | 36132.87   | 57093.57     | 42481.21 | 36132.87–57093.57 |
| screen-markup/cold     | —          | 54095.17     | 45381.73 | 45381.73–54095.17 |
| screen-markup/warm     | —          | 39304.51     | 42808.92 | 39304.51–42808.92 |
| linked-stylesheet/cold | —          | 56159.99     | 53683.14 | 53683.14–56159.99 |
| linked-stylesheet/warm | —          | 75889.45     | 60532.58 | 60532.58–75889.45 |

The perturbed run is 10.6–58.0% slower than M5 in the four comparable cells;
quiet remains 7.4–43.6% slower. Quiet warm is still slower for no-change and
linked. Do not explain every difference as supervisor interference or infer
a new code regression from unchanged analysis code.
Perturbed cold no-change HTML time is 26,473.21 ms versus M5's 19,320.87 ms
for the same 26,520 parses; quiet is 25,289.17 ms. The prescribed clean repeat
does not eliminate ordinary noise, which remains part of the model's range.

## Counts And Exclusive Work

Counts agree between cold/warm and between default matrices. `stylePath` is
not implemented. All other HTML parse steps, including referenced-HTML and
legacy matching, are unreached in these scenarios; build parses are excluded.

| Fixture/scenario             | Fast / complete | HTML parses | UTF-8 bytes | Range / reference / discovery / inline-match / linked-match parses |
| ---------------------------- | --------------- | ----------- | ----------- | ------------------------------------------------------------------ |
| Default/no-changes           | 5520 / 0        | 26520       | 566968795   | 15840 / 10680 / 0 / 0 / 0                                          |
| Default/component-style      | 5336 / 184      | 27874       | 594185052   | 16048 / 11090 / 368 / 368 / 0                                      |
| Default/screen-markup        | 5516 / 4        | 26562       | 567249132   | 15836 / 10718 / 8 / 0 / 0                                          |
| Default/linked-stylesheet    | 3120 / 2400     | 40950       | 894014959   | 15840 / 15510 / 0 / 0 / 9600                                       |
| Cumulative/no-changes        | 5520 / 0        | 26520       | 3306455349  | 15840 / 10680 / 0 / 0 / 0                                          |
| Cumulative/component-style   | 0 / 5520        | 66270       | 7868856736  | 22080 / 22110 / 11040 / 11040 / 0                                  |
| Cumulative/screen-markup     | 5516 / 4        | 26562       | 3307097240  | 15836 / 10718 / 8 / 0 / 0                                          |
| Cumulative/linked-stylesheet | 3120 / 2400     | 40950       | 5246857089  | 15840 / 15510 / 0 / 0 / 9600                                       |

Default style: 736 element-side occurrences, 56,628 segments, 56,468 hits,
160 parses, zero fallbacks. Cumulative style: 11,040 elements, **32,447,024
segments**, 32,441,326 hits, 5,698 parses, zero fallbacks. Other rows present
zero segment counts: analysis skips equal style sources. Reuse is excellent;
scanning, looking up and composing all the retained rules still costs time.

Operation fields below are **exclusive seconds**, rounded to three decimals
only for display. `Rest` is classification minus their sum, not an invented
operation. HTML time includes GC occurring inside a parse; never add the
profile's GC share to these totals. Inline/CSS interval unions are separate,
inclusive diagnostics, not another exclusive work field.

| Fixture/scenario/state            | HTML    | Range | Discovery | References | Matching | Normalize | Project | Implementation | Inline rule | Hash  | Rest   |
| --------------------------------- | ------- | ----- | --------- | ---------- | -------- | --------- | ------- | -------------- | ----------- | ----- | ------ |
| Quiet/no-changes/cold             | 25.289  | 1.548 | 0         | 2.348      | 0        | 4.026     | 0.275   | 1.349          | 0           | 1.214 | 10.494 |
| Quiet/no-changes/warm             | 25.898  | 1.699 | 0         | 2.715      | 0        | 4.165     | 0.326   | 1.488          | 0           | 1.307 | 11.156 |
| Quiet/component-style/cold        | 23.970  | 1.408 | 0.038     | 2.227      | 0.107    | 3.586     | 0.282   | 1.301          | 0.265       | 1.187 | 10.395 |
| Quiet/component-style/warm        | 22.679  | 1.226 | 0.022     | 1.996      | 0.102    | 3.346     | 0.269   | 1.177          | 0.266       | 1.276 | 10.122 |
| Quiet/screen-markup/cold          | 24.765  | 1.568 | 0.002     | 2.390      | 0        | 3.795     | 0.268   | 1.339          | 0.001       | 1.165 | 10.088 |
| Quiet/screen-markup/warm          | 23.460  | 1.387 | 0.002     | 2.170      | 0        | 3.642     | 0.287   | 1.261          | 0.001       | 1.115 | 9.484  |
| Quiet/linked-stylesheet/cold      | 31.611  | 1.187 | 0         | 2.624      | 1.358    | 3.187     | 0.347   | 1.499          | 0.178       | 1.664 | 10.028 |
| Quiet/linked-stylesheet/warm      | 35.595  | 1.414 | 0         | 3.070      | 1.533    | 3.814     | 0.381   | 1.648          | 0.199       | 1.626 | 11.252 |
| Cumulative/no-changes/cold        | 129.277 | 2.673 | 0         | 11.766     | 0        | 20.069    | 0.458   | 1.553          | 0           | 3.453 | 23.952 |
| Cumulative/no-changes/warm        | 139.529 | 3.214 | 0         | 13.101     | 0        | 22.295    | 0.547   | 1.927          | 0           | 4.665 | 26.374 |
| Cumulative/component-style/cold   | 296.607 | 4.012 | 1.095     | 22.539     | 3.856    | 15.390    | 0.936   | 1.823          | 139.717     | 5.887 | 33.271 |
| Cumulative/component-style/warm   | 287.413 | 4.205 | 1.053     | 21.126     | 3.797    | 15.204    | 0.922   | 1.741          | 129.859     | 6.234 | 33.985 |
| Cumulative/screen-markup/cold     | 129.016 | 2.676 | 0.003     | 11.806     | 0        | 19.931    | 0.458   | 1.577          | 0.016       | 4.026 | 24.607 |
| Cumulative/screen-markup/warm     | 114.781 | 2.381 | 0.002     | 10.414     | 0        | 18.925    | 0.402   | 1.444          | 0.001       | 3.867 | 22.850 |
| Cumulative/linked-stylesheet/cold | 215.649 | 3.182 | 0         | 19.284     | 2.579    | 22.224    | 0.654   | 2.118          | 0.271       | 7.307 | 25.527 |
| Cumulative/linked-stylesheet/warm | 180.845 | 2.614 | 0         | 17.081     | 2.117    | 19.471    | 0.571   | 1.905          | 0.272       | 6.625 | 27.206 |

Quiet default inline interval shares are 3.84/3.36% for style and
0.04/0.05% for markup; cumulative style is 48.08/48.06%. Linked-CSS shares
are 3.02/3.04% default and 1.04/0.99% cumulative. The inline union includes
HTML discovery/matching but excludes later composition, so it cannot be used
as a single measure of all inline cost. Git/file I/O is not the dominant step.

## Delivery Ceiling And Headroom

Every cumulative sample delivered Changes. The fixed wait is **900,000 ms**,
starting after interactive checks, whereas `changesReadyMs` starts at Serve
launch. The exact wait-start offset is not recorded. Existing disjoint
`usableMs + propsMs + cachedPreviewMs - 2` gives a conservative offset lower
bound (2 ms covers rounding). Thus the effective deadline/headroom below are
**lower bounds**, not exact deadlines or a changed benchmark schema. Unrecorded
interaction gaps only increase them. Build/transfer time is outside worker
classification but inside Changes readiness.

| Cumulative scenario/state | changesReadyMs | Effective deadline ≥ ms | Headroom ≥ ms |
| ------------------------- | -------------- | ----------------------- | ------------- |
| no-changes/cold           | 551280         | 907672                  | 356392        |
| no-changes/warm           | 553166         | 906635                  | 353469        |
| component-style/cold      | 864873         | 907273                  | 42400         |
| component-style/warm      | 833678         | 907739                  | 74061         |
| screen-markup/cold        | 518445         | 907299                  | 388854        |
| screen-markup/warm        | 479645         | 907316                  | 427671        |
| linked-stylesheet/cold    | 617555         | 906559                  | 289004        |
| linked-stylesheet/warm    | 621365         | 908383                  | 287018        |

Cold style has only about 4.7% of the fixed wait in proven headroom. Completion
is not a robust latency margin; no incomplete sample was retried or omitted.
Profiles used a separate, explicit uncapped helper, never the matrix timings.

## Evidence Locations

All stems below are under `.context/delegation/scalable/`; evidence is ignored,
not a repository artifact. Raw records, identities and precise unrounded model
inputs remain available; Markdown tables are derived displays only.

- `m6-default`, `m6-cumulative`, `m6-default-clean`: `.log`, `.json`,
  `.metrics.json`, `.exit`, machine/process/worktree observations and launcher
  logs. `m6-default.launcher-recovery.txt` explains the missing exit.
- `m6-profiles/`: all three `.cpuprofile`, `.metadata.json`, `.summary.json`
  sets; corresponding `m6-profile-*.log/.json` retain the enclosing samples.
- `m6-cold-cost.json/.log`: every interleaved sample, identity and medians.
- `evidence-summary.mjs` checks worker ends/counts against report durations;
  `profile-summary.mjs` weights the profiles. Both analyze saved evidence only.
- `m6-profile-probe` and `m6-profile-uncapped-probe`: passing `.log/.exit`
  evidence for worker-only injection, completion, cancellation and errors.
- `m6-remaining.launcher.log`: all measurements finished; the last process
  audit and fixture statuses confirm restoration and no remaining owned work.
