# Bounded-Memory Scale Measurements

Diagnostic evidence for Milestone 3 of the
[scalable inline style plan](../../plans/scalable-inline-style-analysis.md),
recorded on October 1, 2026. This checkpoint measures memory retention; it is
not the final [performance acceptance](../../tests/fixtures/large/benchmark-contract.md#classification-performance-acceptance).
The [fixture README](../../tests/fixtures/large/README.md) retains the Milestone 2
reference and setup instructions.

## Provenance And Procedure

Measured clean Mokly commit: `4c2ac767feca756627cc16bba75f81200c0e0eeb`, including
the initial bounded-memory implementation `783e1f3d`. No tracked files changed
during measurement. The accepted committed cumulative fixture was reused after
checking its whole-template digest, dimensions and rendering dependencies:

- Root: `.context/mokly-large-reUW91`.
- Dimensions: 30 areas, 40 screens/area, 12 rows/screen, four stylesheets,
  share 0.5, `inlineStyles: true`; 1,590 entries and 5,550 documents.
- `templateDigest`:
  `5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
- `fixtureCommit`: `2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`.
- `preparedMoklyCommit`: `4b09b13e6b537b1c02278bfbefd75e62b85f8af5`;
  both current and prepared `moklyDirty` are false.

`renderingDependencies` and `preparedRenderingDependencies` match each other
and the Milestone 2 reference:

| Package          | Resolved Version |
| ---------------- | ---------------- |
| react            | 19.2.7           |
| react-dom        | 19.2.7           |
| react-native-web | 0.21.2           |
| @firna/ui        | 0.14.0           |
| lightningcss     | 1.33.0           |
| parse5           | 8.0.1            |
| css-select       | 7.0.0            |
| css-what         | 8.0.0            |

After targeted tests, the complete unit/Chromium/hydration suites and
format/lint/typecheck passed, the code was committed. A process audit confirmed
no test suite, build, other benchmark or `cargo xtask check` was running.
One filtered matrix ran with `nohup`; every cold/warm sample was retained:

```sh
npm run benchmark:large -- --inline-styles \
  --scenario no-changes --scenario component-style
```

The machine is Linux x64, Node 24.19.0, Intel Xeon at 2.90 GHz, eight logical
CPUs and 16.3 GiB RAM. Before/after records bracket the entire matrix, including
preparation and restoration, at `06:47:21Z` and `07:44:05Z` on October 1:

| Record              | Before         | After          |
| ------------------- | -------------- | -------------- |
| `nproc`             | 8              | 8              |
| Total memory, MiB   | 16643          | 16643          |
| Used memory, MiB    | 1149           | 1196           |
| Free memory, MiB    | 9972           | 9906           |
| Available, MiB      | 15090          | 15043          |
| Swap total/used     | 0/0            | 0/0            |
| Uptime              | 22:27          | 23:24          |
| Load, 1/5/15 minute | 0.14/1.21/1.80 | 1.14/1.97/2.27 |

## Samples And Comparison

Times are milliseconds. Worker duration and supervisor upper bound are
different measurements; incomplete rows do not have a worker duration or share.
Heap is the maximum completed-view V8 sample, never parent RSS.

| Scenario        | State | Outcome    | Worker Duration | Heap MiB | Supervisor Upper Bound | Inline Lower Bound | Usable |
| --------------- | ----- | ---------- | --------------- | -------- | ---------------------- | ------------------ | ------ |
| no-changes      | cold  | ok         | 168370.13       | 275.75   | absent                 | not applicable     | 4971   |
| no-changes      | warm  | ok         | 184080.04       | 285.81   | absent                 | not applicable     | 5251   |
| component-style | cold  | incomplete | absent          | absent   | 619676.16              | 541118.36          | 5146   |
| component-style | warm  | incomplete | absent          | absent   | 629561.36              | 550392.09          | 5097   |

Both no-change rows deliver exactly the expected empty Changes set; each
completes 5,520 views, all fast-path, with zero complete-path views and zero
inline/CSS analysis union/share. The component-style rows expect only
`area-1-action`; neither delivers complete membership. They hit the fifteen-minute
delivery ceiling, not a recorded worker heap-limit failure. The cold error is
`The operation was aborted due to timeout`; the warm error is
`Changes was not delivered to Browse before the deadline`.
Their heap, document-work and comparison counts records are absent after worker
termination; do not turn these into zero counts or claim a measured heap bound.
Their completed linked-CSS interval lower bounds are zero.

The matrix exits 1: two classifications are incomplete and three of four
`usableMs` values miss the independent five-second navigation target.
`classificationComplete` and `targetHeld` are false. No sample was retried or
dropped. The final restoration is byte-identical to the pre-matrix snapshot of
all 5,559 renderer/output files, including `shared-1.css` and the manifest.

Against the recorded Milestone 2 cumulative baseline:

| no-changes State | Baseline Heap | Current Heap | Reduction | Baseline Duration | Current/Baseline |
| ---------------- | ------------- | ------------ | --------- | ----------------- | ---------------- |
| cold             | 910.55 MiB    | 275.75 MiB   | 69.72%    | 164633.17         | 1.0227           |
| warm             | 898.55 MiB    | 285.81 MiB   | 68.19%    | 168499.00         | 1.0925           |

Memory improves substantially; completed classification does not get faster.
The baseline component-style rows failed at the worker heap limit, with
supervisor bounds of 130747.93/131839.19 ms (cold/warm), whereas these workers
continue to the delivery ceiling. That is not a completed performance comparison
or an acceptance pass. Reusing cumulative CSS parses remains future work.

## Document Work

Both completed rows have exactly the baseline's per-step parse counts/bytes:

| Parse Step | Attempts | UTF-8 Input Bytes |
| ---------- | -------- | ----------------- |
| range      | 15840    | 1989252358        |
| reference  | 10680    | 1317202991        |
| total      | 26520    | 3306455349        |

No other nonzero parse-step fields occur. Exclusive local operation durations
are recorded separately from inclusive spans:

| Field            | Cold      | Warm      |
| ---------------- | --------- | --------- |
| htmlParseMs      | 112218.68 | 123637.03 |
| rangeMs          | 2223.84   | 2460.02   |
| styleDiscoveryMs | 0         | 0         |
| referenceMs      | 9854.93   | 11179.14  |
| matchingMs       | 0         | 0         |
| normalizationMs  | 18696.30  | 19878.55  |
| projectionMs     | 350.17    | 379.70    |
| implementationMs | 1340.80   | 1535.99   |
| inlineRuleMs     | 0         | 0         |
| hashMs           | 3173.55   | 3668.42   |

HTML parsing accounts for 66.65%/67.16% of the cold/warm worker durations.
Normalization and reference extraction are the next largest measured local
steps. No-change work is unchanged, not shifted into CSS matching.
For component-style only completed inline-stage interval lower bounds survive;
there is no final document-work record from which to assign per-step totals.
The full counts and incomplete fields are retained in the JSON rather than
estimated from supervisor time.

## Evidence Files

The final `cargo xtask check` passed from the start under Node 24.19.0 after
the VM reboot interrupted its first run. Recovery verified dependencies, build
output, an actual Playwright Chrome launch and both fixtures' setup state;
the cumulative fixture still matches all 5,559 recorded output hashes. The
complete gate passes 2,959 unit, 725 Chromium and 219 hydration tests.

All raw evidence is under `.context/delegation/scalable/`:

- `m3-cumulative.log` and `m3-cumulative.json`: the sole measured matrix and
  every sample, including failures and provenance.
- `m3-cumulative.machine-before.txt`, `m3-cumulative.machine-after.txt` and
  `m3-cumulative.idle-processes.txt`: machine and process evidence.
- `m3-cumulative-launcher.log`, `m3-cumulative.exit` and
  `m3-cumulative-launch-note.txt`: execution and extraction record.
- `m3-fixture-verification.json`, `m3-fixture-setup-hashes.json` and
  `m3-measurement-verification.log`: identity, unchanged parse counts and
  byte-for-byte setup restoration.
- `milestone-3-feedback-report.md`: code/test fixes and the final verification,
  commit, push and mainline audit report.
- `m3-recovery-verification.log`, `m3-cargo-check-recovery.log` and
  `m3-cargo-check-recovery.exit`: recovery evidence and the complete passing
  gate; `m3-cargo-check-interrupted.log` retains the stopped run.
