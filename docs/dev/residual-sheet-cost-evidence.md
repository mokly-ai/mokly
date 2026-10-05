# Residual Sheet Cost Evidence

Supporting measurements for the [M9A checkpoint](./residual-sheet-cost-checkpoint.md).
The checkpoint contains every current classification time and Decision 13 ratio,
the disjoint CPU breakdown and the unapproved design options. These records are
diagnostic; no reference or acceptance rule changes.

## Measurement Set And Host

**M9A diagnostic matrix (2.50 GHz)**, October 5, 2026; not acceptance and not a new
reference. Code is accepted M9 `9865774e`, measured at documentation-only
`b7fec023`. That first commit records the formal M9 findings verbatim in the
[plan](../../plans/scalable-inline-style-analysis.md#milestone-9-review-findings).
No finding was implemented. Node 24.19.0, system Chrome 153.0.8010.52,
Intel Xeon @ 2.50GHz, eight CPUs, every recorded MHz value 2500.000, one boot.

One full committed matrix per fixture, default then cumulative, with
`MOKLY_MATERIAL_WORK=0`: core M8-level collection only. Commands use
`node scripts/large/cli.mjs benchmark --config <prepared-config>`; cumulative
adds `--inline-styles`. Every state has a fresh server; cold does not flush OS
caches. No other heavy work overlapped. Before/after every run and sample,
snapshots retain CPU/model/MHz, `nproc`, `free -m`, `uptime`, processes and steal.

Matrices ran 19:45:37–21:43:59 UTC. All **16 classifications are ok**, exact
membership, heap **155.22–313.13 MiB**; none needed an uncapped supplement.
All 16 miss the independent five-second startup budget, so both commands exit 1.
Sample-interval steal is 0.30–1.10 s / 0.015809–0.067019% across eight CPUs,
not a one-core classification pause. Cumulative Changes-ready is 443194–598393 ms;
headroom lower bounds are 308766–463976 ms under the 900000 ms post-interaction
wait. Each exact ready/ceiling/headroom value is retained in `samples.csv`.
The bound is `900000 + usableMs + propsMs + cachedPreviewMs - 2 - changesReadyMs`.

Both fixtures retain 30/40/12 dimensions, four sheets, share 0.5, 5550 documents
and 5520 compared views. Default/cumulative fixture commits are `8c9bb514` /
`2f8f5d04`; template digest
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
Preparation remains `4b09b13e`; all eight rendering-dependency versions match
M2 and the prior controls. All 5560 setup files per fixture return byte-identically
after both matrices and both profiles. No hashed template file changed.

## Paths, Page Size And Complete-path Cost

Only all-fast/all-style rows identify an amortized path cost: worker time also
includes manifest, Git, reader preparation and the separate page pass. Mixed rows
cannot isolate their small changed population by division. In particular, a
subtraction for the 184 default routed views gives a negative cold estimate;
it would be misleading to publish that as a route timer.

| Fixture/scenario             | Fast/style/complete | HTML parses / bytes | Page analysis parses / bytes | Aggregate ms/view cold / warm |
| ---------------------------- | ------------------- | ------------------- | ---------------------------- | ----------------------------: |
| default/no-changes           | 5520/0/0            | 5520 / 117677702    | 5520 / 117677702             |                 4.386 / 3.934 |
| default/component-style      | 5336/184/0          | 5550 / 117687884    | 5520 / 117677702             |                 4.196 / 4.304 |
| default/screen-markup        | 5516/0/4            | 5554 / 117780809    | 5524 / 117770627             |                 4.143 / 4.869 |
| default/linked-stylesheet    | 3120/0/2400         | 7950 / 173222501    | 7920 / 173212319             |                 6.257 / 6.063 |
| cumulative/no-changes        | 5520/0/0            | 5520 / 669071362    | 5520 / 669071362             |               13.734 / 13.854 |
| cumulative/component-style   | 0/5520/0            | 5550 / 669081544    | 5520 / 669071362             |               42.057 / 40.270 |
| cumulative/screen-markup     | 5516/0/4            | 5554 / 669295296    | 5524 / 669285114             |               15.130 / 16.377 |
| cumulative/linked-stylesheet | 3120/0/2400         | 7950 / 993600354    | 7920 / 993590172             |               21.578 / 20.536 |

Other than no-change, each row includes 30 separate reference parses / 10182 bytes.
Style inline counts remain default **736 elements / 56628 segments / 56468 hits /
160 parses**, cumulative **11040 / 32447024 / 32441326 / 5698**; zero fallbacks.
Every other scenario records zero inline counts. Integer counts agree across
states and with the previous M8/M9 evidence. The route builds no page materials
or fingerprints; detailed material collection is absent, not reported as zero.

For linked, an allocation is `(Tlinked - 3120*Tnone/5520)/2400`, assuming equal
fast-view cost and fixed overhead. A size sensitivity allocates no-change HTML
time by the fast subset's original byte share and other time by view share.
Complete-page size is the extra base-page bytes divided by 2400. These are
**allocations, not isolated per-view timers or observed spread**; different view
sizes and shared resource work limit them. Overall parsed-page means are about
21.79/124.98 KB, the review's 22/125 KB; complete-view means are larger below.

| Fixture/state   | Complete-page bytes | Same-fast-cost allocation ms/complete | HTML-byte-weighted allocation ms/complete |
| --------------- | ------------------: | ------------------------------------: | ----------------------------------------: |
| default/cold    |            23139.42 |                                 8.690 |                                     8.824 |
| default/warm    |            23139.42 |                                 8.831 |                                     8.958 |
| cumulative/cold |           135216.17 |                                31.775 |                                    32.617 |
| cumulative/warm |           135216.17 |                                29.221 |                                    30.071 |

M9 review finding 2 is supported by the **earlier paired core-only session on
2.50 GHz**, not by comparing this new M9 run with an old M8 time. Changes below
are mean(M9)-mean(M8), milliseconds; divide the four fingerprint-related buckets
(`inlineRuleMs`, `hashMs`, `normalizationMs`, `projectionMs`) by 2400. They include
shared work and GC, so this is a net bucket estimate, not a causal timer.
Totals use unrounded values; displayed buckets can differ by 0.01 ms.

| Linked cell     | Four changed-code buckets | Per complete view |    HTML | Other timed buckets | Unattributed | Whole worker |
| --------------- | ------------------------: | ----------------: | ------: | ------------------: | -----------: | -----------: |
| Default cold    |                   +303.20 |         +0.126 ms | +452.21 |             +124.52 |      +816.05 |     +1695.98 |
| Default warm    |                   +185.04 |         +0.077 ms | -492.03 |             -260.84 |      -245.70 |      -813.54 |
| Cumulative cold |                  -3110.17 |         -1.296 ms | +779.65 |             -695.12 |      +158.71 |     -2866.93 |

Thus fingerprints cost about 0.08–0.13 ms on ordinary complete views and save
about 1.30 ms on large ones. Most default cold regression is outside those four
buckets; the old pure-fast control has the same cold-slower/warm-faster pattern.
A size threshold versus explicit acceptance of that small cost remains a user
decision. Neither it nor the other M9 review recommendations is implemented.

## Every Cumulative Delivery And Heap Sample

| Cumulative cell        | Heap MiB | Changes ready ms | Ceiling lower bound ms | Headroom lower bound ms |
| ---------------------- | -------: | ---------------: | ---------------------: | ----------------------: |
| no-changes/cold        |   229.90 |           443194 |                 907170 |                  463976 |
| no-changes/warm        |   284.78 |           447369 |                 907233 |                  459864 |
| component-style/cold   |   257.23 |           598393 |                 907159 |                  308766 |
| component-style/warm   |   217.71 |           596300 |                 907506 |                  311206 |
| screen-markup/cold     |   230.04 |           458854 |                 907667 |                  448813 |
| screen-markup/warm     |   230.26 |           479599 |                 907918 |                  428319 |
| linked-stylesheet/cold |   283.87 |           501892 |                 907632 |                  405740 |
| linked-stylesheet/warm |   294.38 |           494465 |                 907886 |                  413421 |

## Reconciliation With M6 And Earlier Hosts

[M6's model](./large-fixture-cost-model.md) and profiles were **2.90 GHz**.
The first [M7 measurements](./shared-page-analysis-measurements.md) were **2.50 GHz**;
[M8's measurement session](./style-only-route-measurements.md) and early M9
measurements/profiles/ablation were **2.90 GHz**. Final M9 core-only controls and
this checkpoint are **2.50 GHz**. Historical combined M9 detail instrumentation
is not mixed into the current core-only budget or spread.

M6 correctly prioritized repeated page parsing. Current style has one original
head parse per view, no base parse, and no page projection. Its 32.45 million
segment visits and 5698 misses did not disappear. Current scan/cache/assembly/
cancellation, including associated data access, is 10.37 profiled ms/view;
material composition/sorting/projection with its data access is 12.64. M6 had
13.85 and 15.77 on a different host and full path; these are not same-host deltas.

The M6 130–175 s projection assumed the **unapproved residual-material equality**
saving and held the remainder fixed. Delivered M8/M9 still compose canonical
strings. Its 63–72 s residual-work estimate was never an all-cost bound. Current
host-adjusted style spans about 153–180 s; overlap with that old modeled range
does not validate its assumptions. The new model accounts for every sampled
part of the measured total and retains unremoved work.

## Run Snapshots

All times UTC, October 5. `nproc=8`, total memory 16643 MiB, no swap; model/MHz
are constant above. Every raw before/after snapshot also preserves the complete
`free -m` output, uptime/load and process inventory. Steal spans the whole run,
including preparation/restoration, not just worker classification.

| Run                    | UTC start / end     | Available MiB before / after | Steal s / aggregate % |
| ---------------------- | ------------------- | ---------------------------: | --------------------: |
| Default matrix         | 19:45:37 / 20:13:53 |                15074 / 14955 |       4.63 / 0.033714 |
| Cumulative matrix      | 20:13:56 / 21:43:56 |                14984 / 14893 |       7.61 / 0.017370 |
| Style cold profile     | 21:46:41 / 22:06:30 |                15072 / 14948 |       1.64 / 0.017056 |
| No-change cold profile | 22:06:33 / 22:23:04 |                14967 / 15043 |       1.06 / 0.013246 |

The two profile outcomes are ok; their command exits are startup-budget only.
Profile heap is 269.37 / 294.22 MiB, style/no-change. Both profiles stop at
`classification-end`, with no failure and no material-detail record. Integer
counts match the corresponding matrix cells exactly. Profiles use the existing
uncapped delivery helper; their delivery ceiling/headroom is not the matrix's.

## Evidence Checks

All evidence/tooling stays uncommitted under
`.context/delegation/scalable/m9a-residual/`. `summarize-matrix.py` checks original
worker spans, every counts record, outcomes, membership and schema absence of
material/companion fields. `matrix-validation.json` additionally pins host, boot,
Node version, complete samples and restoration. `profile-summary.mjs` reconciles
all positive sampling weights to self, disjoint groups and paths, keeping
inclusive costs separate. `source-frequency.mjs` checks eligible head styles,
5520-view population and equality to production element/segment counts;
`source-frequency-bootstrap-note.txt` records its corrected light-filename filter.
`cost-model.py` preserves exact arithmetic and overlapping-budget exclusions.

Markdown, relative file/anchor checks, arithmetic and `git diff --check` are
validated for the reports, plan and fixture README. This documentation-only
checkpoint uses the repository exception to the runtime suite/xtask gate.
The separate M9 review-record commit is `b7fec023`; no source or hashed fixture
change occurs. The analysis checkpoint stops before an implementation decision.

Exact validation commands (Node-based commands use Node 24.19.0):

```sh
npm exec --yes --package=node@24.19.0 -- npx prettier --check \
  docs/dev/residual-sheet-cost-checkpoint.md \
  docs/dev/residual-sheet-cost-evidence.md \
  plans/scalable-inline-style-analysis.md tests/fixtures/large/README.md
python3 .context/delegation/scalable/m9a-residual/summarize-matrix.py
npm exec --yes --package=node@24.19.0 -- node \
  .context/delegation/scalable/m9a-residual/profile-summary.mjs
npm exec --yes --package=node@24.19.0 -- node \
  .context/delegation/scalable/m9a-residual/source-frequency.mjs
python3 .context/delegation/scalable/m9a-residual/cost-model.py
python3 .context/delegation/scalable/m9a-residual/validate-docs.py
git diff --check
git diff --cached --check
```

The evidence assertions cover 16 completed cells, two complete worker profiles,
all counted paths/bytes/segments, one host/boot, four restored runs and both
inventory populations. Documentation validation checks four Markdown files,
133 relative file links and 34 anchors, plus verbatim M9 findings and arithmetic.
