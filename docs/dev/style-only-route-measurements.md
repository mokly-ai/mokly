# Style-only Route Measurements

M8 routes all 5,520 cumulative style views and reduces classification by
19.5% cold / 10.3% warm against the same-host M7 control. Default-fixture results
show no consistent speedup. Both contextual Decision 13 style thresholds remain
unmet; native parse reuse is unchanged and substantial inline work remains.

Approved M8 measurements of `f28a62517eaeca6becdac59bddc153f37ea2769c`, following
the [third checkpoint](./style-only-route-third-checkpoint.md), against M7
`96ddc06c7bb6e4e3b4e130c598ffacd8828f3014`. This records the requested two scenarios,
not Decision 13 acceptance. No implementation, contract or dependency changes
are made in this measurement step. Formal M8 review remains the supervisor's.

## Method And Identity

Both checkouts were clean, separately built under Node 24.19.0 before measurement;
M7 lives at `/tmp/mokly-m8-control-96ddc06c`. Existing committed fixtures were reused
without regeneration: 30 areas, 40 screens, 12 rows, four sheets, share 0.5,
1,590 entries, 5,550 documents and 5,520 compared views. Both trees validated the
same root identities and resolved dependency maps before starting.

- Template digest: `5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
- Default fixture: `.context/mokly-large-y6t0te`, commit
  `8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22`.
- Cumulative fixture: `.context/mokly-large-reUW91`, commit
  `2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`.
- Preparation remains clean `4b09b13e6b537b1c02278bfbefd75e62b85f8af5`.
- React/React DOM 19.2.7, React Native Web 0.21.2, Firna 0.14.0,
  lightningcss 1.33.0, parse5 8.0.1, css-select 7.0.0, css-what 8.0.0.

The serial `nohup` driver runs the original CLI from each checkout:

```sh
npm exec --yes --package=node@24.19.0 -- node \
  --import <evidence>/sample-observer.mjs scripts/large/cli.mjs benchmark \
  --config <fixture>/mokly.config.ts \
  --scenario no-changes --scenario component-style
```

Cumulative adds `--inline-styles`. The observer only inserts a host snapshot
at entry to `benchmarkSample`, before page creation and the sample clock.
Serve and worker children do not inherit `--import`; production comparison and
measurement boundaries are unchanged. The exact commands and observer source
are retained. `PLAYWRIGHT_CHANNEL`, `NODE_OPTIONS` and worker-profile variables
are unset: system Chrome **153.0.8010.52**, no profiling.

Default order is **M7, M8, M8, M7** (A1, B1, B2, A2); cumulative is **M7 then M8**
(C7, C8). Each cold/warm cell has a fresh server/browser context; cold does not
flush OS caches, and committed warm does not reuse a classification worker.
All 24 cells are retained without retries. None is `incomplete`, so the paired
unprofiled uncapped supplement is not triggered. Every classification outcome
is `ok`, with exact membership: none for no-change; only `area-1-action` and
`components/area-1-action.html` for style. Interactive assertions all complete.
All six matrices exit 1 because at least one usable-startup value exceeds the
separate 5,000 ms target; these are not overall benchmark passes.

## Host And Isolation

Every matrix and sample has before/after `/proc/cpuinfo`, `/proc/stat`, `nproc`,
`free -m`, `uptime`, process-table and clean-checkout snapshots. All report
Intel(R) Xeon(R) Processor @ 2.90GHz, eight CPUs at **2899.930 MHz**, Linux x64,
16,643 MiB RAM, no swap. No other heavy work overlaps measurements. Steal seconds
are aggregate tick deltas divided by `CLK_TCK=100`; percentage divides by the
aggregate eight-CPU tick delta. These are not one core's wall-clock seconds.

| Run     | UTC start / end (2026-10-03) | Available MiB before / after | Steal s / %     |
| ------- | ---------------------------- | ---------------------------- | --------------- |
| A1 (M7) | 21:44:12 / 21:54:46          | 15075 / 14885                | 0.14 / 0.002754 |
| B1 (M8) | 21:54:46 / 22:05:19          | 14885 / 14967                | 0.15 / 0.002956 |
| B2 (M8) | 22:05:19 / 22:16:01          | 14967 / 15009                | 0.14 / 0.002721 |
| A2 (M7) | 22:16:01 / 22:26:29          | 15008 / 14958                | 0.14 / 0.002782 |
| C7      | 22:26:29 / 23:05:45          | 14956 / 15049                | 0.48 / 0.002545 |
| C8      | 23:05:45 / 23:44:03          | 15047 / 14992                | 0.44 / 0.002390 |

After all measurements, SHA-256 checks confirm byte-identical restoration of
both renderers, identity records and every generated mockups file. Only setup's
unused CSS rule remains modified in each fixture's Git status. Source checkouts
stay clean through measurements; tracked reporting edits and verification follow.

## Every Sample

`none` means `no-changes`; `style` means `component-style`. Times are milliseconds.
Worker time is the completed background `changes.classify` span; Changes-ready
uses the separate launch clock. Heap is sampled `used_heap_size`, not RSS.
Per-sample CPU model/MHz are the invariant above; steal deltas are shown below.
Full per-sample document work, inline counts, load and memory remain in JSON.

| Run     | Cell       | Worker ms | Heap MiB | Usable ms | Changes ready ms | Steal s / %     |
| ------- | ---------- | --------- | -------- | --------- | ---------------- | --------------- |
| A1 (M7) | none/cold  | 18194.90  | 183.55   | 5646      | 110567           | 0.03 / 0.003366 |
| A1 (M7) | none/warm  | 18635.39  | 293.73   | 5143      | 105779           | 0.02 / 0.002338 |
| A1 (M7) | style/cold | 18441.19  | 254.61   | 5039      | 109238           | 0.03 / 0.003411 |
| A1 (M7) | style/warm | 19244.36  | 275.47   | 5273      | 109564           | 0.03 / 0.003398 |
| B1 (M8) | none/cold  | 19574.38  | 288.38   | 5169      | 110472           | 0.04 / 0.004497 |
| B1 (M8) | none/warm  | 18675.30  | 191.03   | 5179      | 111214           | 0.03 / 0.003341 |
| B1 (M8) | style/cold | 18616.18  | 185.30   | 5314      | 107971           | 0.03 / 0.003447 |
| B1 (M8) | style/warm | 16636.02  | 234.56   | 5064      | 104887           | 0.03 / 0.003536 |
| B2 (M8) | none/cold  | 18671.34  | 301.04   | 5160      | 110692           | 0.03 / 0.003363 |
| B2 (M8) | none/warm  | 18688.71  | 229.18   | 5097      | 111272           | 0.03 / 0.003346 |
| B2 (M8) | style/cold | 18621.43  | 178.73   | 4933      | 108296           | 0.03 / 0.003437 |
| B2 (M8) | style/warm | 18507.40  | 219.80   | 5144      | 108792           | 0.03 / 0.003421 |
| A2 (M7) | none/cold  | 17920.56  | 295.01   | 5052      | 107086           | 0.02 / 0.002318 |
| A2 (M7) | none/warm  | 18072.38  | 197.23   | 4771      | 103869           | 0.03 / 0.003586 |
| A2 (M7) | style/cold | 18137.11  | 168.05   | 4801      | 105320           | 0.03 / 0.003538 |
| A2 (M7) | style/warm | 17421.52  | 187.22   | 5089      | 108960           | 0.02 / 0.002282 |
| C7      | none/cold  | 56968.74  | 271.66   | 5314      | 331714           | 0.08 / 0.003001 |
| C7      | none/warm  | 60651.41  | 244.29   | 4868      | 333774           | 0.09 / 0.003359 |
| C7      | style/cold | 238355.41 | 223.39   | 5482      | 524934           | 0.12 / 0.002853 |
| C7      | style/warm | 234068.83 | 281.89   | 5500      | 520003           | 0.12 / 0.002875 |
| C8      | none/cold  | 60858.07  | 263.24   | 5131      | 335632           | 0.08 / 0.002966 |
| C8      | none/warm  | 59602.89  | 281.19   | 5100      | 341192           | 0.08 / 0.002918 |
| C8      | style/cold | 191831.09 | 263.61   | 4940      | 474568           | 0.10 / 0.002624 |
| C8      | style/warm | 209926.14 | 263.74   | 4792      | 489688           | 0.12 / 0.003051 |

### Inline Delivery Headroom

The cumulative wait is 900,000 ms **after interactive work**, not after launch.
`900000 + usableMs + propsMs + cachedPreviewMs - 2` is a conservative lower bound
on the launch-clock ceiling; two milliseconds cover integer rounding. Subtract
`changesReadyMs` to obtain the headroom lower bound. Untimed remaining interactions
mean these are not exact deadlines. No worker duration is substituted.

| Run | Cell       | Changes ready ms | Ceiling >= ms | Headroom >= ms |
| --- | ---------- | ---------------- | ------------- | -------------- |
| C7  | none/cold  | 331714           | 906207        | 574493         |
| C7  | none/warm  | 333774           | 905745        | 571971         |
| C7  | style/cold | 524934           | 906366        | 381432         |
| C7  | style/warm | 520003           | 906381        | 386378         |
| C8  | none/cold  | 335632           | 906036        | 570404         |
| C8  | none/warm  | 341192           | 905972        | 564780         |
| C8  | style/cold | 474568           | 905851        | 431283         |
| C8  | style/warm | 489688           | 905657        | 415969         |

## Same-host Ratios And Decision 13 Context

Default ratios divide the two M8 cell means by the two M7 means. The observed
envelope is `min(M8)/max(M7)` through `max(M8)/min(M7)`, not a confidence interval.
Cumulative has one sample per tree/state; it has no within-cell spread estimate.

| Fixture / scenario / state      | M8/M7  | Observed envelope |
| ------------------------------- | ------ | ----------------- |
| default/no-changes/cold         | 1.0590 | 1.0262–1.0923     |
| default/no-changes/warm         | 1.0179 | 1.0021–1.0341     |
| default/component-style/cold    | 1.0180 | 1.0095–1.0267     |
| default/component-style/warm    | 0.9585 | 0.8645–1.0623     |
| cumulative/no-changes/cold      | 1.0683 | single pair       |
| cumulative/no-changes/warm      | 0.9827 | single pair       |
| cumulative/component-style/cold | 0.8048 | single pair       |
| cumulative/component-style/warm | 0.8969 | single pair       |

Default cold no-change is 5.9% higher by means, with all observed M8 values above
M7; warm no-change is 1.8% higher. Default cold style is 1.8% higher; warm style
is 4.1% lower by means but its envelope crosses 1.0. The default fixture therefore
does not demonstrate a consistent classification speedup. Cumulative no-change
has mixed cold/warm movement; its single pairs cannot characterize noise.

The following compares M8's single cumulative samples with the contextual
Decision 13 thresholds: style/no-change <= 1.25 and cumulative style <= 2 × B.
`B` is the [M2 reference](../../tests/fixtures/large/README.md), 36,760.185 ms cold
and 37,869.390 ms warm for component-style. This earlier session also reported
a 2.90GHz Xeon, but it is not a same-session control. M7's earlier 2.50GHz report
is not used as this run's denominator. Neither this filtered matrix nor these
single samples constitute acceptance; M10's full procedure remains open.

| State | M8 style ms | Style / no-change (<= 1.25) | 2 × B ms | Style / B (<= 2) |
| ----- | ----------- | --------------------------- | -------- | ---------------- |
| cold  | 191831.09   | 3.1521                      | 73520.37 | 5.2184           |
| warm  | 209926.14   | 3.5221                      | 75738.78 | 5.5434           |

Both contextual style thresholds remain unmet. No acceptance rule, reference
sample, result policy or planned review decision is changed by this observation.

## Paths, Document Work And Inline Reuse

Counts match exactly across cold/warm peers and default repetitions for each
engine/fixture/scenario. Full per-sample records were cross-checked against the
raw background-worker diagnostics. M7 predates the `stylePath` field: `—` below
means absent in that implementation, not an invented recorded zero.

| Engine / fixture / scenario | Fast / style / complete | HTML parses | UTF-8 parse bytes | Page-analysis parses / bytes |
| --------------------------- | ----------------------- | ----------- | ----------------- | ---------------------------- |
| M7/default/none             | 5520 / — / 0            | 5520        | 117677702         | 5520 / 117677702             |
| M7/default/style            | 5336 / — / 184          | 5734        | 121628282         | 5704 / 121618100             |
| M7/cumulative/none          | 5520 / — / 0            | 5520        | 669071362         | 5520 / 669071362             |
| M7/cumulative/style         | 0 / — / 5520            | 11070       | 1338152906        | 11040 / 1338142724           |
| M8/default/none             | 5520 / 0 / 0            | 5520        | 117677702         | 5520 / 117677702             |
| M8/default/style            | 5336 / 184 / 0          | 5550        | 117687884         | 5520 / 117677702             |
| M8/cumulative/none          | 5520 / 0 / 0            | 5520        | 669071362         | 5520 / 669071362             |
| M8/cumulative/style         | 0 / 5520 / 0            | 5550        | 669081544         | 5520 / 669071362             |

M8 routes all 184 default views with edited sheets and all 5,520 cumulative style views;
other default views remain fast. Every M8 no-change view stays fast. M8 style
has exactly one original-page analysis per compared view; the only other HTML
work is the unchanged separate page-resource pass (30 parses / 10,182 bytes).
No route base-page parse is added. Cumulative style parse bytes fall by almost
50%; default style bytes fall about 3.24%. Neither workload runs projection
in the M8 style route. The aggregate implementation counter includes usage-signal
work and other views; it is not evidence of a route implementation comparison.

| Engine / fixture / scenario | Inline spans | Elements | Segments | Hits     | Parses | Fallbacks |
| --------------------------- | ------------ | -------- | -------- | -------- | ------ | --------- |
| M7/default/none             | 0            | 0        | 0        | 0        | 0      | 0         |
| M7/default/style            | 184          | 736      | 56628    | 56468    | 160    | 0         |
| M7/cumulative/none          | 0            | 0        | 0        | 0        | 0      | 0         |
| M7/cumulative/style         | 5520         | 11040    | 32447024 | 32441326 | 5698   | 0         |
| M8/default/none             | 0            | 0        | 0        | 0        | 0      | 0         |
| M8/default/style            | 184          | 736      | 56628    | 56468    | 160    | 0         |
| M8/cumulative/none          | 0            | 0        | 0        | 0        | 0      | 0         |
| M8/cumulative/style         | 5520         | 11040    | 32447024 | 32441326 | 5698   | 0         |

No-change emits no inline-analysis span; its all-zero final counts are present
records. Style keeps the same view-wide segment occurrences and native parse
reuse. Routing removes repeated page/material work but still visits and composes
retained rule data. Exclusive timings below show remaining work, not a CPU
profile or an allocation/GC attribution. `Rest` is the worker duration minus all
ten exclusive document-work durations; it is not a named phase.

| Run / style state | HTML s | References s | Inline rules s | Other exclusive s | Rest s |
| ----------------- | ------ | ------------ | -------------- | ----------------- | ------ |
| C7/cold           | 67.41  | 20.77        | 100.17         | 17.85             | 32.16  |
| C7/warm           | 62.13  | 22.10        | 103.19         | 17.22             | 29.43  |
| C8/cold           | 30.86  | 15.80        | 94.03          | 5.94              | 45.20  |
| C8/warm           | 30.30  | 17.90        | 106.41         | 6.27              | 49.03  |

M8 inline-rule work alone is 94.03–106.41 s, already above the contextual
73.52–75.74 s total style ceilings. Native parse reuse does not remove this
remaining work; the planned later cost checkpoint remains necessary.

## Evidence And Verification

Evidence: `.context/delegation/scalable/m8-measurements/`. Matrix prefixes are
`m8-control-default-{1,2}`, `m8-candidate-default-{1,2}`, `m8-control-cumulative`
and `m8-candidate-cumulative`. Each retains original `.json`, `.samples.json`,
combined/stdout/stderr logs, `.exit`, `.pid`, command JSON and matrix plus
per-sample before/after machine JSON. `driver.log`, `run-session.mjs`,
`sample-observer.mjs`, `machine.mjs`, `fixture-preflight.json`, both build logs,
`browser-version.txt`, both `*.setup-{before,after}.sha256`, and
`summary.json`/`summary.log` retain provenance and derived checks. No sample was
retried. `launch-note.txt` records an initial launcher that ended before any
benchmark began; it produced no sample or machine record.

Verification on October 3–4 used Node 24.19.0 and
`PLAYWRIGHT_CHANNEL=chromium`. The combined `cargo xtask check` exits 1 at the
known **braces <= 3.0.3 / GHSA-vfj7-8cjw-p6xm** dependency audit (13 high entries,
one root advisory, through the dev Firna/React Native/Metro chain). The registry
still reports latest braces 3.0.3; the audit's suggested breaking dependency
downgrade is not a patched braces release. No dependency, override or gate changes.
The brief authorizes pushing with this documented blocker after the remaining
checks pass; the audit-exception decision for merging to main remains open.

All Node commands below use the prefix `npm exec --yes --package=node@24.19.0 --`:

```sh
cargo xtask check
cargo xtask check --suite package
cargo xtask check --suite unit
cargo xtask check --suite browser
cargo xtask check --suite hydration
npm run format:check
npm run lint
node scripts/verification/repository-ratchets.mjs
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo xtask rust-file-length-lint --all
```

The combined gate and selected xtask suites also use the Node prefix and pinned
browser environment. Package includes build, typecheck, example validation,
package validation and all five consumer scenarios for both packages.

| Run                | Result                        | UTC interval            | Evidence prefix        |
| ------------------ | ----------------------------- | ----------------------- | ---------------------- |
| Package            | pass                          | 10-03 23:47–23:50       | `final-package`        |
| Unit               | 4,527 / 4,527                 | 10-03 23:50–10-04 00:05 | `final-unit`           |
| Browser first      | 724 pass, 1 ArrowDown timeout | 10-04 00:05–00:33       | `final-browser`        |
| Clean M7 control   | 29 pass, 1 matching timeout   | 10-04 00:35–00:38       | `final-control-scroll` |
| Browser full rerun | 725 / 725                     | 10-04 00:39–01:07       | `final-browser-retry`  |
| Hydration          | 219 / 219                     | 10-04 01:07–01:24       | `final-hydration`      |

All suites have zero skips/cancellations. The scroll failure is `ArrowDown`,
expected true / received false after 5,000 ms at `pressTogether` line 62, caller
line 79. Clean prepared M7 reproduces the exact normalized stack in 1/30 attempts
with retries disabled; `final-control-command.json` records its pinned-browser
command, port and preparation. No UI, assertion, timeout or source changes were
made. Both failure traces/context files and JSON reports remain in
`final-browser-failure/` and `final-control-failure/`; `final-control-comparison.json`
proves the match. The complete browser rerun then passes.

Non-audit repository checks pass: format, lint, ratchets, Rust fmt/Clippy,
11 Rust tests and the nine-file length audit. Evidence includes
`final-check.log/.exit`, `final-audit.json`, `braces-latest.txt`,
`final-repository.log/.json`, per-suite reports/logs, both verification-driver
logs and `final-verification{,-retry}.json`. `final-frozen-files.json` hashes all
authored files; checks after every suite found no changes. Only final reporting
and plan bookkeeping follow, with Markdown checks before commit. No new deletion
relative to the accepted `f28a6251` baseline is introduced; existing mainline
integration work remains deferred to M10. The supervisor runs the formal review.
