# Classification Cost Model And Cold Inline Cost

This is the [M6 checkpoint](./large-fixture-cost-checkpoint.md)'s conditional
model, not acceptance or a promise of timings. Its measured commit is
`1887eff66087cfccf53a70820df87d6efdb8ecec`, `moklyDirty: false`, Node 24.19.0.
The committed fixtures have 1,590 entries, 5,550 documents, 5,520 compared
views, 30/40/12 dimensions, four sheets and share 0.5. `templateDigest`:
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
Default/cumulative `fixtureCommit`: `8c9bb514f5d6810efa0b8146ef4d03d8e2aa7a22` /
`2f8f5d04961b799ea0bc6ff140981dd28aadf6eb`; preparation was clean `4b09b13e`.
`renderingDependencies`: React/React DOM 19.2.7, React Native Web 0.21.2,
Firna 0.14.0, lightningcss 1.33.0, parse5 8.0.1, css-select 7.0.0, css-what 8.0.0.
Host observations, raw evidence paths and full profiles are in the companion reports.

## Per-view Path Costs

Divide worker classification by 5,520 completed views; this **amortizes**
manifest/Git/prefetch/page work too. Only all-fast and all-complete rows identify
a path-specific amortized cost. Mixed rows constrain, but do not separately
measure, fast/complete durations. `stylePath` does not yet exist.

| Fixture/scenario                | Fast / complete | Amortized ms/view cold / warm | Path interpretation    |
| ------------------------------- | --------------- | ----------------------------- | ---------------------- |
| Quiet default/no-changes        | 5520 / 0        | 8.43 / 8.83                   | All fast               |
| Quiet default/component-style   | 5336 / 184      | 8.11 / 7.70                   | Mixed, 3.33% complete  |
| Quiet default/screen-markup     | 5516 / 4        | 8.22 / 7.76                   | Mixed, 0.072% complete |
| Quiet default/linked-stylesheet | 3120 / 2400     | 9.73 / 10.97                  | Mixed, 43.48% complete |
| Cumulative/no-changes           | 5520 / 0        | 35.00 / 38.34                 | All fast               |
| Cumulative/component-style      | 0 / 5520        | 95.13 / 91.58                 | All complete           |
| Cumulative/screen-markup        | 5516 / 4        | 35.17 / 31.71                 | Mixed, 0.072% complete |
| Cumulative/linked-stylesheet    | 3120 / 2400     | 54.13 / 46.87                 | Mixed, 43.48% complete |

With M5 included, observed all-fast costs span 6.15–8.83 ms default and
30.32–38.34 ms cumulative; perturbed default extends to 9.09 ms. Cumulative
complete style spans 91.58–104.16 ms. Counts show additional HTML work per
complete view versus no-change: about 7.36 parses for default style, 7.20 for
cumulative style, 10.50 for markup and 6.01 for linked CSS. These are scenario
increments, not a universal per-entry parse count.

An additive estimate `complete = (T - fastCount * noChangeMsPerView) / completeCount`
gives 11.4–13.7 ms default linked and 58.0–79.0 ms cumulative linked, assuming
the same fast cost and fixed overhead. It gives **negative** costs for quiet
default style/markup and cumulative warm markup: machine drift and unequal
view sizes overwhelm the small changed population. Do not publish those as
measured costs. Mixed-path attribution needs future within-run path observations;
the work-count/profile model below is more reliable than subtracting two runs.

## Inline Cost Per View

From the complete cumulative style profile, divide each disjoint category by
5,520. The profile costs more than the matrix; these describe its shares and
work distribution, not unprofiled per-view timers.

| Inline/material operation           | Profile ms/view | Classification share | Sheet-proportional today?            |
| ----------------------------------- | --------------- | -------------------- | ------------------------------------ |
| Segment scanner                     | 2.404           | 2.174%               | Yes                                  |
| Cache lookup/retention              | 4.708           | 4.258%               | Yes, even with hits                  |
| Run lookup/assembly                 | 3.865           | 3.496%               | Yes                                  |
| Run cancellation                    | 2.870           | 2.596%               | Yes                                  |
| Residual diff                       | 0.099           | 0.090%               | No, changed runs only here           |
| Attribution                         | 0.742           | 0.671%               | Changed rules/reference pairs        |
| Composition/filtering               | 4.672           | 4.225%               | Yes                                  |
| Canonical sorting                   | 4.156           | 3.758%               | Yes                                  |
| Canonical material-text building    | 6.942           | 6.278%               | Yes                                  |
| Inline replacement application      | 0.012           | 0.011%               | Span/page size                       |
| Native parsing/stored-data creation | 0.748           | 0.677%               | Distinct misses, not all occurrences |

Scanning/cache/assembly totals **10.98 ms/view**, cancellation/diff 2.97,
composition/sorting/text 15.77. The supervisor's niced 3,000-rule microbenchmark
was 13.4 ms lookup, 1.4 cancellation/diff and 7.1 composition. The profile
confirms the first-order lookup cost, but exposes extra sorting, two sides and
four material-text outputs absent from a narrower composition timer. These
different clocks/scopes are not expected to agree numerically. `cssRuleData`
alone has 4.43% self-time, largely repeated getters inside canonical work,
not a repeat native parse.

Material comparison itself has no dedicated operation counter: replacement
application is tiny, while string creation, normalization (2.575%), hashing
(0.264%) and their GC are visible. String equality can execute in caller/native
frames. Do not attribute the entire residual/orchestration share to equality.

Cancellation policy is not the dominant successful-input cost: 2.596% versus
9.928% lookup/scan/assembly and 14.261% composition/sorting/text. The recorded
M5 review's hypothetical +3 ms/view for naive per-rule cancellation would add
16.56 s (3.2–3.3% of these matrix style times). Its fallback microbenchmark's
roughly 20.5 ms/view penalty would add about 113 s if all 5,520 views had that
input. **Neither alternative nor that workload was measured here**; every
matrix has zero segment fallbacks. The findings remain recorded, unimplemented,
and any cancellation-policy change still requires approval of Decision 5.

## What The Planned Work Removes

Keep M7 → M8 → M9; page construction is first by both counts and profiles.
Original non-page view text totals 117,677,702 bytes default and 669,071,362
cumulative (measured after restoration). One original parse per identical view
would replace 566,968,795 / 3,306,455,349 parsed bytes: about 79/80% less.
Two original-side parses for full cumulative style replace 7,868,856,736 bytes:
about **83% less**. Source-location/reference bookkeeping and the 30-page phase
mean these are workload estimates, not exact future counters.

| Milestone        | Removes for cumulative style                                                                                                                                                       | Retains                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| M7 page analysis | Duplicate range, style-discovery, matcher and material-reference HTML parses; duplicated extraction; fast-path projection/normalization/inline work on identical texts             | Both original-side trees on full views; segment scan/cache/assembly, cancellation, residual diff, composition/sorting, full material text |
| M8 route         | Base tree and full projection/material/implementation work on eligible views; material comparison can use residual multisets instead of composing cancelled rules (new proof TODO) | Head tree; both sides' segment scanning/lookups and cancellation; residual diff/attribution, conservative head resource proof             |
| M9 fingerprints  | Long style text in full-path normalization, reference rediscovery and material equality/hashing, with guarded string fallback                                                      | Raw source parsing; scanning/lookups/cancellation; sorting and canonical digest input on full paths; reserved-prefix fallback             |

M8 eligibility is not yet measured. Treat 5,336 non-consumer views as a candidate
population, not a guaranteed routed set; the 184 consumer views may qualify too.
Test all guards first. The existing contract permits comparing retained rule
multisets without page materials, but the implementation must prove that unchanged
cancelled occurrences have equal retention. A residual-only comparison must
preserve grouped/nested displacement and matched-reference policies, or fall back.

Fingerprints alone do **not** stop composition/sorting; their SHA-256 still
needs canonical input. No-change quick checks after M7 already avoid materials,
so M9 cannot be credited a second time for those savings. M7 also removes
fast-path inline calls that currently skip parsing, not 32 million style-segment
lookups: those occur on non-identical sheets and remain on the route.

## Conditional Timing Ranges

Counts and profile shares lead; the quiet matrix supplies the central inputs.
For transparency, the M7 sensitivity calculation uses
`P7 = T - H*(1-rH) - N*(fast/views) - R*(1-rR)`:
`H`, `N`, `R` are exclusive HTML, normalization and reference times;
`rH = originalBytes*(fast+2*complete)/views/parsedBytes`;
`rR = (fast+2*complete)/referenceParses`. This approximates cost by source
bytes and one reference inventory per retained tree. It keeps every other
operation and fixed residual, without subtracting GC again.

Use each saved M5/M6 cell with unchanged analysis code to carry run spread;
include the perturbed default as a stress envelope, not its central source.
Vary retained HTML/reference cost by ±25% for source-location overhead,
different-sized views, copies and new bookkeeping. These are **sensitivity
ranges, not confidence intervals or proven upper bounds**. M7 central default
projections are about 20–28 s; cumulative no-change 64–72 s and style 256–268 s.

| Fixture/scenario             | M7 sensitivity range cold / warm, s | Decision 13 cell ceilings cold / warm, s |
| ---------------------------- | ----------------------------------- | ---------------------------------------- |
| Default/no-changes           | 14–26 / 13–26                       | 35.072 / 35.231                          |
| Default/component-style      | 18–25 / 15–31                       | 38.598 / 39.763                          |
| Default/screen-markup        | 19–28 / 17–22                       | 36.534 / 40.707                          |
| Default/linked-stylesheet    | 23–29 / 25–39                       | 52.387 / 50.513                          |
| Cumulative/no-changes        | 47–73 / 48–81                       | 66.803 / 67.107                          |
| Cumulative/component-style   | 252–312 / 241–278                   | 73.520 / 75.739                          |
| Cumulative/screen-markup     | 57–74 / 52–67                       | 69.588 / 77.538                          |
| Cumulative/linked-stylesheet | 88–114 / 81–103                     | 99.785 / 96.214                          |

For eligible style views M8 can remove roughly half the retained tree/reference
cost, full normalization and much implementation/hash work. Avoiding cancelled
rule composition removes another 14.261% of the profiled classification budget.
Scale those shares to each unprofiled style sample, not the profiled milliseconds;
allow 96.7–100% eligibility and the retained-cost uncertainty above. This gives
roughly **130–175 s** after M7/M8/M9, with no assumed new lookup/cancellation
optimization. Even its optimistic end exceeds both cumulative style cell ceilings
and `1.25 *` the 47–81 s projected no-change envelope (59–101 s).

Default `D/B <= 1.05` looks reachable across this modeled noise range with M7.
Its style/no-change ratio is not robust across independently varying cells;
M5's projected cold ratio is about 1.22 while the perturbed warm ratio is about
1.41. Cumulative style **needs more work across the whole range**. No-change,
cold markup and linked cumulative targets depend on noise/retained-tree cost;
warm markup looks reachable across its range. None of these statements replaces
the [normative acceptance procedure](../../tests/fixtures/large/benchmark-contract.md#classification-performance-acceptance).

## Plan Consequences

M8 gains a proof/work-bound TODO for residual multiset equality, not a changed
attribution policy. A new **M9A residual-cost checkpoint** before acceptance
targets the still-sheet-proportional scanning, lookup/assembly and cancellation:
13.85 profiled ms/view, about 63–72 s when scaled to the observed unprofiled
style envelope. Removing only full material text cannot remove that floor.
It must verify default cold cost too, and request approval if an algorithm needs
new cache semantics or a contract/Decision change. No such design is chosen here.

M7 still needs deliberate resolution of the previously recorded page/component-free
scope finding; M10's reference noise/template-change findings also remain for
the user's decision. This checkpoint changes neither Decisions nor contracts,
does not implement review findings, and does not claim final acceptance.

## Cold Inline Parse Experiment

`.context/delegation/scalable/m6-cold-cost.json/.log` retain all **135** samples.
Compare M3 `b87df3a2`, initial M4 `e4307a46`, current `1887eff6`, on the stable
M4 RNW inputs (85,011 and 156,590 UTF-8 bytes, one element each) and 1,000 unique
Emotion-style elements (41,340 bytes total). One untimed warmup, nine rotating
interleaved rounds, fresh caches, forced GC before each sample; imports, input
loading and result counting outside the clock. Production element paths use
their version's real API; native whole parsing is a separate experiment.
Machine audits bracket the single run; no tracked source changed or sample was retried.

| Workload                       | M3 median ms (min–max) | M4 median ms (min–max)  | Current median ms (min–max) | Current/M3 |
| ------------------------------ | ---------------------- | ----------------------- | --------------------------- | ---------- |
| RNW 85 KB, element path        | 243.82 (210.55–415.66) | 293.01 (265.30–501.51)  | 319.12 (267.01–520.29)      | 1.3088     |
| RNW 157 KB, element path       | 490.54 (453.26–860.22) | 571.04 (510.52–1029.24) | 582.88 (525.39–931.35)      | 1.1883     |
| 1,000 Emotion elements         | 194.88 (178.47–334.55) | 242.13 (212.88–364.18)  | 239.58 (227.23–380.52)      | 1.2294     |
| RNW 85 KB, native whole parse  | 221.89 (216.00–418.63) | 258.08 (232.22–481.67)  | 236.07 (214.81–436.07)      | 1.0639     |
| RNW 157 KB, native whole parse | 486.71 (435.68–822.63) | 636.12 (448.96–946.02)  | 676.84 (455.74–861.86)      | 1.3906     |

Cold element medians still regress **18.8–30.9%** against M3. Broad spreads,
including the native 157 KB median exceeding the segmented element median,
preclude subtracting separate medians to infer precise segment overhead.
The default style profile's native/first-use-data group is only 0.124% and its
inline-analysis interval is about 3.4–3.8% in the quiet matrix; repeated HTML
work, not cold native parsing, explains most of the default budget.
The supervisor's provisional cold-cost acceptance remains; Decision 13 binds.
M9A must recheck unique-sheet/Emotion cost and schedule lazy derived work only
if it remains a measured obstacle, with cache-retention/equivalence proofs intact.
