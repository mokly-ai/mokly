# M9 Core-Only Remeasurement

The diagnostics split in `8da4d1a9` meets the supervisor's continuation rule.
Across four cumulative style pairs, mean M9/M8 is **1.0050** (+0.50%), below
1.03, and the ranges overlap. M8 averages **250,718.78 ms** and M9
**251,972.51 ms**. All 26 timed classifications succeed with exact membership.
This is permission to proceed to the gate, not Decision 13 acceptance.

Two default cold cells remain slower: no-change is **6.9% higher on average**
with overlapping ranges; linked-stylesheet is **4.8% higher** with disjoint
ranges. Warm default cells are lower on average and overlap. The cumulative
linked pair is 2.4% lower for M9, with only one sample per tree.

## Method And Browser Decision

Measured October 5, 2026 on the post-reboot **Intel Xeon @ 2.50GHz** host,
2500.000 MHz on all eight logical CPUs, Node 24.19.0, 16,643 MiB RAM and no swap.
System Chrome 153.0.8010.52 runs the benchmarks. M8 `5e5111dc` is the clean,
separately built `/tmp/mokly-m9-m8-control`; M9 is clean `8da4d1a9`.
No suite, profile or unrelated heavy work overlaps timing samples. Each run and
sample records CPU model/MHz, uptime, memory, logical CPUs and steal before/after.
Aggregate eight-CPU steal over complete sample intervals is 2.09–15.11 s,
0.070266–0.565469%; these are not isolated classification-worker pause times.

Both existing committed fixtures are reused, with unchanged dimensions,
rendering dependencies, baseline commits and M2 `templateDigest`:
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
Default baseline: `8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22`; cumulative:
`2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`. Only the fixture README may change;
the benchmark contract and hashed templates remain intact. All 5,560 setup
source/output/identity files per fixture match after every run and the companion.

Timed samples use **only M8-level core collection**, explicitly setting
`MOKLY_MATERIAL_WORK=0`. No timed record or worker event contains material
counters or companion fields. The default order is M8, M9, M9, M8, each with
no-change and linked-stylesheet cold/warm. Cumulative starts with two alternating
M8/M9 style-cold pairs, then one M8/M9 linked-cold pair. After the initial
borderline style result, the supervisor requests two more alternating style-cold
pairs. Every sample is retained. The final rule uses all four pairs:
`mean(M9) / mean(M8) <= 1.03` **or** overlapping min/max ranges. Both conditions
hold. Per-pair ratios below preserve the +0.5%, +7.4%, −2.7%, −3.3% variation;
ratios of means are not replaced with averages of those ratios.

The [code checkpoint](./fingerprinted-materials-detail-checkpoint.md) records
4,909 unit and 219 hydration passes, package/static checks and ten caught
mutations. Its full browser run had 722 passes, one failure and two timeouts.
Focused repetitions passed 21/21 on each tree, and full clean M8 passed 725/725.
The supervisor accepts the code and orders one bounded M9 rerun. That pinned
Chromium rerun has **724 passes and one 60 s mobile `design_links` timeout**,
with no skips. The other two cases pass. The supervisor's explicit known-spec
rule therefore classifies these as host-timing flakes and permits continuation,
using both runs and the [M6/M7 host history](./shared-page-browser-gate.md).
No UI or timeout changes are made; the three-case repeat condition is not met.

All sample classifications are `ok`; none is incomplete, so no uncapped
classification-only supplement is needed. Every timed command exits 1 solely
because usable startup exceeds the separate five-second budget in **26/26**
samples; browser assertions and classification succeed. Heap peaks range from
155.44 to 318.62 MiB. Headroom stays positive for every cumulative sample.

One uncommitted cold-only launcher initially imported Playwright from both
trees and failed before preparation, Serve or a sample clock began. Its command,
error and host snapshots remain in `launcher-import-failure/`. Resolving
Playwright from the selected tree fixes the wrapper; import checks pass on both
trees and hashes confirm no fixture edit. No timed sample is discarded or retried.

## Every Timed Sample

Default classification ms / heap MiB.

| Cell                   | M8 A1              | M9 B1              | M9 B2              | M8 A2              |
| ---------------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| no-changes/cold        | 24,551.78 / 155.44 | 24,342.48 / 194.44 | 26,810.68 / 296.44 | 23,313.50 / 203.84 |
| no-changes/warm        | 27,102.60 / 196.60 | 25,240.90 / 257.97 | 26,898.20 / 203.00 | 26,485.84 / 318.62 |
| linked-stylesheet/cold | 34,645.09 / 204.85 | 36,235.29 / 317.85 | 37,603.44 / 239.40 | 35,801.68 / 229.28 |
| linked-stylesheet/warm | 38,645.66 / 271.57 | 34,867.89 / 297.91 | 37,829.55 / 309.56 | 35,678.86 / 292.11 |

Cumulative classification ms / heap MiB; every sample cold.

| Cell/pair | M8                  | M9                  | M9/M8  |
| --------- | ------------------- | ------------------- | ------ |
| style 1   | 254,616.77 / 208.90 | 255,972.79 / 255.00 | 1.0053 |
| style 2   | 252,007.03 / 254.28 | 270,604.63 / 255.95 | 1.0738 |
| style 3   | 253,565.92 / 259.18 | 246,618.82 / 215.94 | 0.9726 |
| style 4   | 242,685.41 / 257.23 | 234,693.78 / 256.64 | 0.9671 |
| linked    | 118,731.18 / 284.83 | 115,864.25 / 277.92 | 0.9759 |

| Cell                              | Mean M9/M8 | Ratio envelope |
| --------------------------------- | ---------- | -------------- |
| default/no-changes/cold           | 1.0687     | 0.9915–1.1500  |
| default/no-changes/warm           | 0.9730     | 0.9313–1.0156  |
| default/linked-stylesheet/cold    | 1.0481     | 1.0121–1.0854  |
| default/linked-stylesheet/warm    | 0.9781     | 0.9022–1.0603  |
| cumulative/component-style/cold   | 1.0050     | 0.9218–1.1150  |
| cumulative/linked-stylesheet/cold | 0.9759     | single pair    |

Cumulative readiness ms / headroom lower-bound ms.

| Cell/pair | M8                | M9                |
| --------- | ----------------- | ----------------- |
| style 1   | 644,971 / 262,999 | 642,336 / 265,764 |
| style 2   | 647,274 / 261,319 | 653,458 / 254,288 |
| style 3   | 632,949 / 274,894 | 632,574 / 275,169 |
| style 4   | 634,152 / 273,569 | 619,504 / 288,051 |
| linked    | 521,602 / 386,388 | 508,744 / 399,364 |

Ratio envelopes are `min(M9)/max(M8)` through `max(M9)/min(M8)`, not confidence
intervals. Default cells have two samples per tree; cumulative style has four;
linked has one. Keep states separate. Headroom is the same conservative lower
bound used in prior reports:
`900000 + usableMs + propsMs + cachedPreviewMs - 2 - changesReadyMs`.

## Counts And Dominant Work

Shared integer work is identical across engines and repeats within each scenario.
Every sample's full document/inline fields, heap, readiness and host observations
are preserved in the raw JSON and `samples.csv` (26 rows, 50 columns).

| Fixture/scenario  | fast/style/complete | pageAnalysis parses/bytes | all parses/bytes |
| ----------------- | ------------------- | ------------------------- | ---------------- |
| default/no-change | 5520/0/0            | 5520 / 117677702          | 5520 / 117677702 |
| default/linked    | 3120/0/2400         | 7920 / 173212319          | 7950 / 173222501 |
| cumulative/style  | 0/5520/0            | 5520 / 669071362          | 5550 / 669081544 |
| cumulative/linked | 3120/0/2400         | 7920 / 993590172          | 7950 / 993600354 |

Only cumulative style analyzes inline rules: 11,040 elements, 32,447,024
segments, 32,441,326 hits, 5,698 parses and zero fallbacks, per sample. Other
measured scenarios have zero inline counters. The style route keeps one head
page analysis per view and builds no page materials.

Cumulative style's mean exclusive inline-rule work is **124.30 s M8 / 126.38 s
M9**; HTML parsing is **42.84 / 41.62 s** and references **21.98 / 22.76 s**.
Inline-rule work plus parsing accounts for about two thirds of M9 classification.
The 32.4 million segment occurrences remain despite only 5,698 native parses.
These unchanged work volumes, source processing and composition remain costly;
bounded material consumers do not remove that style-route work.

In cumulative linked, normalization plus projection falls from **7.06 s** to
**2.30 s**, while inline preparation plus hashing grows from **2.24 s** to
**3.89 s**. Original HTML parsing still takes **63.45 / 64.23 s**, more than half
the M9 classification. The complete-path material saving is visible, but total
improvement is only 2.4% in this pair. Default linked cold still regresses;
this measurement does not claim all M9 costs disappeared.

## Separate Companion Counts

One independent M9 cumulative style pass enables `MOKLY_MATERIAL_WORK=1` and
emits `review.material-work`. Its `Material companion` record is explicitly
`timed: false`, with no classification/startup/readiness duration or cold/warm
label. Identity, exact membership and core integer work match the timed style
samples. No companion value is copied into a timed record or ratio.

`materialBytes`, `materialNormalizationBytes`, `materialHashBytes`,
`inlineFingerprintBytes`, `inlineFingerprintHashes`, `fingerprintedViews`,
`fingerprintSeams` and `fingerprintSeamUnits` are all **zero**.
`sourceNormalizationBytes` is **1,338,168,848**, the original-source work of
the quick attempt/page pass. This proves that the routed views add no material,
fingerprint or seam work. Timed material fields are absent, not invented zeros.
No fresh linked material-detail pass was requested; its historical counters
remain in the earlier reports, not in these timed samples.

## Earlier Rounds And Decision 13 Context

The [original b11e51d0 measurements](./fingerprinted-materials-measurements.md)
and [14447151 remeasurement](./fingerprinted-materials-remeasurement.md) retain
all recorded values. Those runs were on Xeon 2.90GHz with combined diagnostics;
this round is on 2.50GHz with core-only timings. Compare each round's own
same-host M8 ratios, not absolute cross-host times:

| Cold cell         | b11e51d0 / its M8 | 14447151 / its M8 | 8da4d1a9 / its M8 |
| ----------------- | ----------------- | ----------------- | ----------------- |
| default/no-change | 1.1037            | 0.9728            | 1.0687            |
| default/linked    | 1.0790            | 0.9668            | 1.0481            |
| cumulative/style  | 1.0775            | 1.0923            | 1.0050            |
| cumulative/linked | 1.0757            | 0.9228            | 0.9759            |

The original full-collector style regression no longer meets the supervisor's
stop rule. This is a narrow continuation decision, not universal equivalence of
timing distributions or a completed acceptance matrix. As context only, M9's
251.97 s cumulative style mean exceeds the original Decision 13 cold limit of
73.52 s, and 115.86 s linked exceeds its 99.79 s limit. These are different-host
comparisons and cannot decide acceptance. No cumulative no-change sample was
requested here, so no fresh style/no-change ratio is computed; the earlier
1.25-ratio target failure is not replaced by another host's denominator. All
sample membership/heap conditions hold, but the separate startup budget fails.
Full acceptance, including all scenarios/states and the derived spot sample,
remains open; the planned residual-sheet checkpoint owns further cost work.

## Evidence And Gate

Evidence directory: `.context/delegation/scalable/m9-core-measurements/`.
`browser.json/.log`, `browser-decision.json` and `browser-artifacts/` retain
the bounded browser run. `fixture-preflight.json`, `restoration-*.json` and the
setup SHA-256 inventories pin inputs and restoration. `driver.log`,
`driver-cumulative.log` and `driver-extra.log` preserve the full sequence.
Each `default-*`, `cumulative-style-*` and `cumulative-linked-*` stem has raw
stdout/stderr, report, command and before/after host snapshots; cumulative
snapshots include a separate sample boundary. `summary.json`, `samples.csv`
and `decision.json` validate scope, exact counts, means, spreads and the revised
four-pair decision against raw worker records. The companion has its own
`cumulative-style-m9-companion.*` files and `companion-validation.json`.
All scripts and raw data remain uncommitted under `.context/`.

Final `cargo xtask check` exits 1 at `npm run dependencies:check`, before the
other suites, for the known `braces` advisory GHSA-vfj7-8cjw-p6xm. The independent
audit confirms that it is the sole advisory behind 13 transitive high findings.
The registry still reports `braces` 3.0.3; the audit proposes breaking React Native
chain downgrades, not a patched braces release. Dependencies, overrides and the
gate stay unchanged. The brief explicitly permits pushing after the remaining
checks pass independently; the separate main-merge audit decision remains open.

All remaining checks pass with authored files frozen during the suites:

| Check                 | Result                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Package               | Fresh build, type/declaration checks, example validation and all five packed-consumer scenarios pass. |
| Full unit             | 4,909 passed; zero failures/skips/cancellations.                                                      |
| Full pinned browser   | 725 passed; zero failures/skips/cancellations. All three earlier failure cases pass.                  |
| Full pinned hydration | 219 passed; zero failures/skips/cancellations.                                                        |
| Repository statics    | Format, lint, protocol/file/export ratchets, Rust fmt/clippy and 11 Rust tests pass.                  |

Every Node command uses 24.19.0. The combined command and each selected suite
explicitly set `PLAYWRIGHT_CHANNEL=chromium` and `MOKLY_MATERIAL_WORK=0`:

```bash
PLAYWRIGHT_CHANNEL=chromium MOKLY_MATERIAL_WORK=0 npm exec --yes --package=node@24.19.0 -- cargo xtask check
for suite in package unit browser hydration; do
  PLAYWRIGHT_CHANNEL=chromium MOKLY_MATERIAL_WORK=0 npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite "$suite"
done
npm exec --yes --package=node@24.19.0 -- npm run format:check
npm exec --yes --package=node@24.19.0 -- npm run lint
npm exec --yes --package=node@24.19.0 -- node scripts/verification/repository-ratchets.mjs
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

`gate/check.log`, `gate/audit.json`, `gate/braces-latest.json`,
`gate/verification.json`, the per-suite logs/JSON and static logs retain the
commands, exits, counts and browser artifacts. The final browser pass requires
no timing exception; earlier failures and the supervisor's bounded-run decision
remain visible above. Reporting-only final edits receive formatting, link and
diff checks. The deletion audit matches the pre-existing 345-entry baseline;
no new deletion, dependency, UI, timeout or hashed-template change is included.
Push under the documented audit-blocker rule, then stop for the supervisor's
formal M9 review. Decision 13 and the residual-sheet milestone remain open.
