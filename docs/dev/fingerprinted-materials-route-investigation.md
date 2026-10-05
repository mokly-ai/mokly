# M9 Style-Route Cost Investigation

The subsequent [full-worker ablation](./fingerprinted-materials-worker-ablation.md)
isolates the diagnostics group: reverting it recovers 2.73 ms/view across two
non-overlapping alternating pairs. The report below preserves the earlier warmed
investigation and its uncertainty at that point. The gate/push await the
supervisor's decision on the diagnostic collection method.

The requested warmed differential **does not reproduce the production regression**.
M9 is 0.982× M8 with collection enabled and 0.997× with it disabled; ranges
overlap. The only identified added route work is opt-in source-normalization
UTF-8 counting, about 0.030 ms/view in the primary profile. It does not explain
the production gap of 3.24–3.72 ms/view. The
[full remeasurement](./fingerprinted-materials-remeasurement.md) preserves that
gap and the stop before the gate/push. No performance fix is implemented here.

The slower retained-input profile locates extra time in GC and existing
composition/parsing, but neither that pair nor allocation sampling establishes
which M9 change causes it. Calling this an identified fingerprint-guard cost,
or dismissing the full-worker regression as noise, would overstate the evidence.

## Requested Differential

All harness code and raw evidence are uncommitted, off by default, under
`.context/delegation/scalable/m9-remeasurements/`. There is no production switch,
module replacement or engine edit. Each process imports its selected tree's own
`dist`: M8 `5e5111dc` or fixed M9 `14447151`, on the same Xeon 2.90 GHz host,
Node 24.19.0, with before/after CPU/MHz, uptime, memory and steal snapshots.
No other benchmark, build or suite overlaps any timed probe.

`route-prepare.mjs` builds the real cumulative component-style scenario once,
captures both original manifests and immutable bytes, and restores the fixture.
It selects ordinal `floor(i * 5520 / 200)`, for `i=0..199`, in production
classification order. Mean head size is 120,656 bytes (full catalogue: 121,209),
range 9,987–216,786. The 73,194,549-byte input bundle has SHA-256
`f0668f47e04f407d111cf188520c1e2dc6ed14ec56f333b99244a66c4858dbf3`.
All runs read this same bundle. Unselected metadata remains present for ownership.

Each process prepares memory readers before comparison, then warms all 200 views.
One context, resource-closure cache and CSS parser cache live through warm-up and
three measured repetitions. Comparisons are sequential and timed individually
with `performance.now()`. With collection enabled, ordinary timing events and
document work run; an in-memory sink retains counts and discards span events,
avoiding terminal IO. With collection disabled neither collector is constructed.
Results, SHA checks, assertion work and report serialization occur after the
per-view clocks. This isolates comparison; it is not a full-classifier benchmark.

For each mode the process order is M8, M9, M8, M9, M8, M9. Twelve timed processes
produce 36 measured repetitions, 7,200 comparisons plus warm-ups. Afterwards,
one separate CPU profile per tree/mode covers three repetitions after warm-up,
600 comparisons per profile. No profiler touches timed repetitions. Inspector
sampling is 1,000 microseconds. Raw `timeDeltas` weight self/inclusive costs;
inclusive rows overlap and cannot be added. Small wrappers may be inlined;
zero sampled time is not proof that a shared helper never executes.

## Per-View Timings

Times are ms/view. A process mean averages its three 200-view repetitions.
The envelope uses min/max process means, not a confidence interval.

| Collection | M8 mean; process range | M9 mean; process range | M9/M8; envelope       |
| ---------- | ---------------------- | ---------------------- | --------------------- |
| enabled    | 21.612; 21.198–21.876  | 21.219; 20.838–21.474  | 0.9818; 0.9525–1.0130 |
| disabled   | 22.299; 21.901–22.957  | 22.228; 20.952–23.564  | 0.9968; 0.9126–1.0759 |

Across individual repetition means, enabled M8 spans 20.750–22.775 and M9
20.027–22.063; disabled M8 spans 21.258–23.911 and M9 20.712–24.712. Disabled
runs followed enabled runs, so subtracting their means does not measure collector
overhead. The within-mode alternating comparison is the controlled quantity.

Every view settles `style` and every result hash agrees across both trees,
configurations, repetitions and profiles. Each measured enabled repetition has:

- 200 style, zero fast/complete views; 200 `pageAnalysis` parses, 24,131,213 bytes.
- 400 inline elements; 1,170,046 segments, all hits; zero parses/fallbacks after warm-up.
- Zero material, material-normalization, fingerprint, downstream material-hash
  and seam work; M9 records 48,262,426 source-normalization bytes.

## Primary CPU Profiles

Each cell is **self / inclusive ms per view**, divided by 600. Module-scope
rows include callbacks. `parseDocument` in M8 is aligned with the renamed
`parseReviewDocument` in M9. The complete function-by-function self/inclusive
diffs are `route-{enabled,disabled}-function-diff.csv`; `route-costs.json` retains
the scope rollups. Profile durations are diagnostic, not timing replacements.

| Cost                              | M8 enabled      | M9 enabled      | M8 disabled     | M9 disabled     |
| --------------------------------- | --------------- | --------------- | --------------- | --------------- |
| Page construction                 | 0.0657 / 5.5217 | 0.0605 / 5.4276 | 0.0568 / 5.7284 | 0.0676 / 5.7075 |
| Flat ignore validation            | 0.2706 / 0.5536 | 0.2492 / 0.5428 | 0.2702 / 0.5502 | 0.2561 / 0.5854 |
| Source-normalization byte counter | 0 / 0           | 0 / 0.0302      | 0 / 0           | 0 / 0           |
| Inline preparation                | 0.0971 / 6.9409 | 0.0753 / 6.8344 | 0.0695 / 7.2764 | 0.0802 / 7.2916 |
| Segment cache/scanning            | 1.2588 / 5.4376 | 1.1878 / 5.4219 | 1.2612 / 5.7126 | 1.3391 / 5.7266 |
| Canonical composition             | 3.1849 / 4.7435 | 2.9046 / 4.4722 | 3.5068 / 5.0124 | 3.3854 / 5.0168 |
| Canonical projection              | 1.1694 / 2.4360 | 1.0288 / 2.2503 | 1.1894 / 2.4362 | 1.1337 / 2.4840 |
| Canonical sorting                 | 0.2217 / 1.3412 | 0.2242 / 1.3024 | 0.2457 / 1.4610 | 0.2547 / 1.4875 |
| Rule-data lookup                  | 2.3637 / 2.3637 | 2.3249 / 2.3249 | 2.4369 / 2.4369 | 2.6310 / 2.6310 |
| Existing style-source guards      | 0.0020 / 0.0020 | 0.0054 / 0.0054 | 0.0036 / 0.0036 | 0.0018 / 0.0018 |
| GC                                | 0.7251 / 0.7251 | 0.7041 / 0.7041 | 0.7862 / 0.7862 | 0.8169 / 0.8169 |

The M9-only counter adds a sheet-proportional byte scan when diagnostics run.
It counts original quick-check inputs, not composed canonical text. The route
constructs no page materials or fingerprints; no fingerprint/occurrence/marker
index frames occur. Original validation and route tag checks remain required.
`pairedIgnoreIds` returns normalization already cached by the failed non-identical
quick check; the M9 base-only validation branch is not reached here. The old
`reviewIgnoreMetadata` wrapper is absent at this checkpoint.

`inline_rendering.ts` adds only the complete-path `withInlineAppendix` helper;
its route composition algorithm is unchanged from M8. Both trees still sort and
render both retained multisets. The unchanged flat-ignore validator, canonical
composition and rule-data lookups have no repeatable positive M9 delta in the
primary captures. There is no additional source-safety/occurrence scan on the route.

## Worker And Retained-Input Controls

To check why the smaller probe differs from production, supplementary processes
use a worker with `maxOldGenerationSizeMb: 1024`, exactly the production setting.
V8 reports a total heap limit of 1,275,068,416 bytes, including its other spaces.
They compare the same 200 inputs serially or in batches of four. Two alternating
M8/M9 pairs per case each retain three repetitions. Batched times are elapsed
wall time divided by views, not the overlapping promise latencies.

A final three-pair control retains all 5,527 document/resource routes in both
readers: 669,072,700 bytes per side, about 1.37 GB external memory before warm-up.
Unselected documents use restored baseline bytes solely as retained memory;
they are never compared. All 200 compared base/head inputs remain exact. This
models reader volume; it does not reproduce renderer/compiler heap history.

| Supplement                 | M8 mean; process range | M9 mean; process range | Ratio  |
| -------------------------- | ---------------------- | ---------------------- | ------ |
| worker, serial             | 22.560; 22.109–23.011  | 22.144; 22.130–22.158  | 0.9816 |
| worker, batches of four    | 22.304; 21.885–22.723  | 22.375; 22.100–22.651  | 1.0032 |
| worker, full reader volume | 25.295; 21.872–27.139  | 25.332; 21.315–27.376  | 1.0015 |

All unprofiled ranges overlap. The retained-input pair with CPU profiling does
show M9 slower (27.015 versus 23.264 ms/view). Its largest costs are below;
this one pair is not a stable causal ablation and does not replace its timed set.

| Retained-input profile cost | M8 self / inclusive | M9 self / inclusive |
| --------------------------- | ------------------- | ------------------- |
| GC                          | 0.8972 / 0.8972     | 2.5069 / 2.5069     |
| Canonical composition       | 2.5715 / 5.1010     | 3.9779 / 6.2835     |
| Page construction           | 0.0569 / 5.7961     | 0.0480 / 6.4747     |
| Normalization byte counter  | 0 / 0               | 0.0018 / 0.0426     |

Two final separate diagnostic captures sample allocations every 32 KiB, including
objects collected by minor/major GC. Across 600 comparisons, sampled gross JS
allocation is 7,697,606,480 bytes M8 and 7,715,466,840 M9 (+0.23%). Dominant
sites are existing parse5 tokenization, iterators/maps, segment scanning and
canonical rendering. There is no large new M9 allocation site. This samples
allocation volume, not live retention or external-buffer allocation, and cannot
attribute the GC difference to a particular M9 change. Allocation-profile
durations are excluded from all unprofiled comparisons.

## Finding And Proposed Next Scope

1. **Medium: the production style-route regression remains unexplained.** The
   17.91/20.52 s cold/warm gap remains a gate/push blocker. The requested probe
   excludes browser delivery, compilation history, cold caches and terminal IO;
   matching heap limits, batching and retained reader volume separately still
   does not reproduce a stable M9-only gap. The slower profile names where time
   went (GC and existing composition/parsing), not which change caused it.

   **A — recommended:** authorize a full-worker lifecycle ablation before another
   production fix. Use an uncommitted loader to substitute the M8 versions of
   route-reachable M9 changes one group at a time: diagnostics byte counters,
   page-analysis/pair bookkeeping, then module initialization. Preserve original
   eager validation and all comparison results. Capture after the real renderer
   and full reader preparation, with identical view order, fresh caches and
   retained outputs. A repeatable recovered delta would identify the code to fix;
   repeat the uncapped unprofiled comparison around that candidate before approval.
   No saving can honestly be promised yet. The recovery target is 3.24–3.72 ms/view,
   not an estimate that the proposed diagnostic work will achieve it.

   **B — bounded counter-only optimization:** reuse already-computed exact UTF-8
   lengths in diagnostic accounting where inputs agree, preserving all counters.
   Its entire measured cost is only 0.030–0.059 ms/view across these profiles,
   an optimistic ceiling of 0.17–0.33 s per 5,520 views; actual reusable work is
   smaller. This cannot repair the measured production gap, so it is not
   recommended as the response to this blocker. No unapproved residual-multiset
   optimization or guard weakening is proposed.

## Evidence And Verification

`route-inputs.{bin,json}`, `route-{prepare,sample,run,analyze,costs}.*`, all
`route-<tree>-<mode>-<kind>-<repeat>.*` records, `route-summary.json`, and the two
function-diff CSVs reproduce the requested protocol. `worker{1,4}-*`, `retained4-*`,
`allocation4-*`, their drivers, CPU/heap profiles and `route-supplements.json` /
`route-allocations.json` retain every supplementary capture. All commands and
host snapshots are saved. No measured sample was discarded or rerun in place.

Per-view style assertions, equal result hashes, parse/count bounds, fixture hash
restoration and clean engine identities pass. The preliminary JS syntax checks and
both worker-only default-profile validations pass. Tracked changes are report,
README and plan Markdown only; the harness remains ignored under `.context/`.
No code fix, contract change, full suite, gate or push is performed at this stop.
The accepted `14447151` implementation and its completed suites remain unchanged.

Validation commands (all pass): `python3` on `summarize.py`,
`validate-profiles.py`, `validate-evidence.py` and
`check-restoration.py after-investigation` in the evidence directory;
`npm exec --yes --package=node@24.19.0 -- npx prettier --check` on both new
reports, the original measurement report, fixture README and plan;
`git diff --check` and `git diff --cached --check`. All 117 relative links in
those five documents resolve. The deletion audit matches the 345-entry
pre-task baseline; this reporting change introduces no deletion.
