# Residual Sheet Cost Checkpoint

Cumulative component-style remains the clear residual failure: **232.152 s cold /
222.292 s warm**, versus **75.810 / 76.477 s** for no-change. The same-session
style/no-change ratios are **3.0623 / 2.9067**, against 1.25. Reaching that ratio
requires removing **24.889 / 22.952 ms per view**, about 88% / 87% of the extra
style cost. No remedy, cache semantics, Decision or contract change is approved
or implemented by this checkpoint.

The estimates below do not establish a combination that reaches every
Decision 13 target. Recommend seeking approval for residual equality plus the
bounded, cache-free work first; an exact-sheet cache cannot close this gap.
Keeping 1.25 requires further design that removes more repeated work; incremental
indexing is one unapproved candidate. Target changes and re-referencing remain open.

## Measurement Set

**M9A diagnostic matrix (2.50 GHz)**, October 5, 2026, at documentation-only
`b7fec023`, code-identical to accepted `9865774e`. Default then cumulative, one
complete committed matrix each, all four scenarios/states, core collection only.
All 16 classifications are ok with exact membership; heap is 155.22–313.13 MiB.
All 16 miss the separate startup budget. No uncapped supplement was needed.
Two subsequent worker-only profiles complete successfully. Fixtures are restored.

The [evidence companion](./residual-sheet-cost-evidence.md) records identity,
CPU/MHz/steal, commands, counts, per-path costs, readiness/headroom and verification.
Every snapshot is the same Xeon 2.50 GHz boot, eight CPUs at 2500 MHz, Node 24.19.0.
These are diagnostic samples, not acceptance or a new reference.

## Ratios And Every Current Cell

`D` and `C` below are this session's single default/cumulative worker durations.
`B` is the two-run M2 default mean on the **different 2.90 GHz host** in the
[fixture README](../../tests/fixtures/large/README.md#milestone-2-reference-and-cumulative-baseline).
Ceilings are exactly `1.05*B` and `2*B`, calculated before display rounding.

`C/D` and style/no-change use only this session; they need no cross-host
adjustment. `C/D` is context, not a replacement acceptance denominator.
Raw `C/B` and `D/B` are cross-host. Adjusted columns divide their raw values by
1.45 through 1.29, the supervisor's rounded range from unchanged M8 controls
across the earlier 2.90 GHz and final 2.50 GHz sessions. This assumes the old
host/session multiplier transfers to each current cell; it includes noise and
is neither a MHz conversion nor a confidence interval. Same-session M8/M9
controls previously gave cumulative style 1.0050 with overlapping ranges.

**A different `machine` already fails acceptance**, whatever a ratio says.
Re-reference/host selection belongs to the user. One matrix, existing fixtures
and no derived spot sample also do not satisfy the final acceptance procedure.
Each current cell has one sample: within-cell spread is not measured.

| Cell                   | Default s | Cumulative s | Default ceiling s | Cumulative ceiling s | D/B raw | D/B adjusted  | C/B raw | C/B adjusted  |     C/D |
| ---------------------- | --------: | -----------: | ----------------: | -------------------: | ------: | ------------- | ------: | ------------- | ------: |
| no-changes/cold        |    24.210 |       75.810 |            35.072 |               66.803 |  0.7248 | 0.4999–0.5619 |  2.2697 | 1.5653–1.7594 |  3.1314 |
| no-changes/warm        |    21.713 |       76.477 |            35.231 |               67.107 |  0.6471 | 0.4463–0.5016 |  2.2792 | 1.5719–1.7669 |  3.5221 |
| component-style/cold   |    23.163 |      232.152 |            38.598 |               73.520 |  0.6301 | 0.4346–0.4885 |  6.3153 | 4.3554–4.8956 | 10.0225 |
| component-style/warm   |    23.756 |      222.292 |            39.763 |               75.739 |  0.6273 | 0.4326–0.4863 |  5.8700 | 4.0483–4.5504 |  9.3573 |
| screen-markup/cold     |    22.868 |       83.518 |            36.534 |               69.588 |  0.6572 | 0.4533–0.5095 |  2.4003 | 1.6554–1.8607 |  3.6521 |
| screen-markup/warm     |    26.878 |       90.400 |            40.707 |               77.538 |  0.6933 | 0.4781–0.5374 |  2.3318 | 1.6081–1.8076 |  3.3633 |
| linked-stylesheet/cold |    34.539 |      119.109 |            52.387 |               99.785 |  0.6923 | 0.4774–0.5366 |  2.3873 | 1.6464–1.8506 |  3.4485 |
| linked-stylesheet/warm |    33.466 |      113.356 |            50.513 |               96.214 |  0.6957 | 0.4798–0.5393 |  2.3563 | 1.6250–1.8266 |  3.3872 |

| Fixture/state   | Style/no-change | Style limit s | Style saving required s | Required ms/view |
| --------------- | --------------: | ------------: | ----------------------: | ---------------: |
| default/cold    |          0.9568 |        30.262 |                   0.000 |            0.000 |
| default/warm    |          1.0941 |        27.142 |                   0.000 |            0.000 |
| cumulative/cold |          3.0623 |        94.763 |                 137.389 |           24.889 |
| cumulative/warm |          2.9067 |        95.596 |                 126.696 |           22.952 |

Every default `D/B` and default style/no-change ratio is below its threshold.
Every raw cumulative `C/B` exceeds 2 on this host; under the specified adjustment,
no-change, markup and linked fall below 2 throughout the range. Their retained
cost is principally original-page parsing/reference work, not a demonstrated
new ratio blocker. Cumulative style fails **both** style/no-change and adjusted
`C/B` throughout: repeated run work and canonical composition remain the obstacle.
No estimate replaces a current M9 time in these tables.

## Per-path And Complete-path Findings

All-fast cost is 4.386/3.934 ms per view default and 13.734/13.854 cumulative
(cold/warm). All-style cumulative is 42.057/40.270. These amortize worker setup
and other catalogue work. Mixed rows cannot isolate the 184 default routed
views or four markup completions. The [per-path table](./residual-sheet-cost-evidence.md#paths-page-size-and-complete-path-cost)
records every count and explains the linked complete-view allocations:
8.69–8.96 ms on 23.14 KB pages and 29.22–32.62 ms on 135.22 KB pages, depending
on state and allocation assumption; these ranges are not measured spread.

M9 review finding 2's earlier same-host paired core buckets show **+0.08–0.13 ms**
per ordinary complete view and **-1.30 ms** per large complete view. Its default
cold +1696 ms splits into +303 ms in fingerprint-related buckets, +452 ms HTML,
+125 ms other timed work and +816 ms unattributed; warm is faster overall despite
the small changed-code cost. The companion preserves the full split and fast-path
drift control. A size threshold versus accepting that cost remains undecided;
no review recommendation is implemented.

## Worker Profiles And The Retained Remainder

The two subsequent cold profiles cover only `changes.classify`, with the M6
opt-in inspector harness, 1000-us sampling, core collection and uncapped delivery.
Both return exact membership and matrix-identical integer work/path/inline counts.
Style/no-change classification is **240075.12 / 77072.47 ms**; these do not replace
matrix times. Sampling weights total 240092.310 / 77072.164 ms. Two negative style
deltas totaling 18.180 ms are clamped to zero (0.0076%); none occur in no-change.
All self, disjoint-group and call-path weights reconcile exactly.

Below is weighted sampled wall time per 5520 views, not OS CPU utilization.
Categories are disjoint; named inclusive call costs later overlap. Lazy head
analysis reached through `styleWindowSpans` is charged to parsing/references,
not to window work. Inlined normalization callbacks retain their getter scope.

| Step                                                          | Style ms/view | No-change ms/view |
| ------------------------------------------------------------- | ------------: | ----------------: |
| Head HTML parse                                               |         7.030 |             6.694 |
| Original validation / other page analysis                     |         0.390 |             0.393 |
| Quick-check normalization                                     |         0.438 |             0.000 |
| Segment scanner                                               |         2.543 |             0.000 |
| Segment cache / retention                                     |         3.057 |             0.000 |
| Run lookup / assembly                                         |         2.597 |             0.000 |
| Run cancellation                                              |         2.163 |             0.000 |
| Residual diff / attribution                                   |         0.316 |             0.000 |
| Composition / filtering, excluding data lookups               |         2.317 |             0.000 |
| Canonical text / reference projection, excluding data lookups |         4.742 |             0.000 |
| Canonical sorting, excluding data lookups                     |         0.886 |             0.000 |
| Rule-data access, self                                        |         5.394 |             0.000 |
| Window / source guards                                        |         0.727 |             0.130 |
| Original / canonical reserved-prefix checks                   |         0.301 |             0.000 |
| Reference extraction / resource proof, excluding data lookups |         3.414 |             2.177 |
| Metadata / dependency comparison                              |         0.930 |             0.015 |
| Native parsing / first-use data                               |         0.415 |             0.000 |
| GC                                                            |         1.696 |             1.207 |
| Idle / wait                                                   |         2.168 |             1.989 |
| Hash, files, Git, diagnostics, separate HTML                  |         1.148 |             0.763 |
| Remaining orchestration                                       |         0.820 |             0.593 |

Inclusive preparation is 10.911 ms/view; the compositor is 12.630, including
projection 7.881 and sorting 2.421. Rule-data self cost is mostly projection
3.139, sorting 1.549 and the required-reference walk 0.683 ms/view. The latter
walk (`ruleReferences`) is **1.090 self / 1.771 inclusive**; longest-window work
is **0.449 / 0.449**. Function/location self and inclusive totals are retained.
Do not add these overlapping figures to the disjoint table.

M8 finding 4's untimed work is visible: the reference walk, longest-window and
prefix checks total about 13.92 profiled seconds. Metadata/dependency loops add
about 5.05 s over no-change, iterating the much larger changed-path set. These
are existing operations; no new timers or remedies were inserted. GC/idle are
separate, not silently assigned to CSS. Remaining orchestration is 4.52 s,
including 1.50 s of `(program)` samples plus validation, propagation and dispatch.

The current cold counters are inline rules 114.78 s, HTML 39.28 s, references
22.04 s and unattributed 48.59 s. No-change has HTML 40.21 s, references 7.34 s
and unattributed 24.94 s. Holding other buckets fixed, deleting _all_ inline-rule
time still leaves **117.38 s**, above the 94.76 s ratio ceiling. That is a
conditional counter floor, not proof that the other work cannot be reduced.
GC sampled during callbacks already affects their wall timers; it cannot be
added again to explain the counter remainder.

## Reconciliation With M6

M6's **2.90 GHz** 130–175 s projection credited unapproved residual-material
savings and held the remainder fixed; delivered M8/M9 still compose whole sheets.
Its 63–72 s residual estimate was not an all-cost bound. Current scan/cache/run/
cancellation is 10.37 profiled ms/view, and composition/sorting/projection with
its data access is 12.64. The [host-labelled reconciliation](./residual-sheet-cost-evidence.md#reconciliation-with-m6-and-earlier-hosts)
records M7–M9 history. The new model retains every unremoved part of the total.

## Candidate Decisions And Proof Obligations

Savings below are **unimplemented sensitivities**, in current cold ms/view.
Scale each disjoint profile budget by `232152.27/240092.310`; no GC gain is
credited. Fractions state assumptions after replacement overhead, not measured
speedups or confidence bounds. All candidates retain existing oracles, mutations
and seeded proofs; freeze the delivered route as an additional test-only oracle
where necessary. Existing review divergences are not silently repaired.

| Candidate                                              | Saving ms/view / method                                          | Approval boundary                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A: within-view bounded scan                            | 0.6–1.1; 25–45% of scanner cost, at most half removable          | Contract-preserving if the proof below holds; same cache semantics              |
| B: residual material equality                          | 9.2–11.6; 75–95% of the 12.219 ms material budget                | User approval and route Result/proof contract amendment                         |
| C: per-rule cancellation                               | 0–0 credited; no fallback work to recover here                   | Decision 5 change; potentially different grouped outcomes                       |
| D1: exact element/run cache across views               | 0–0.024 gross upper bound; key/copy cost could make net negative | New cache semantics; not recommended for this bottleneck                        |
| D2: incremental cross-view scan/run/cancellation index | 5.0–8.5 if 50–85% of its budget is removed; locality unproved    | New cache/index semantics and a further design/proof; not an approved algorithm |
| E1: use verified reference ordinals                    | 0.9–1.4; remove 50–80% of the required-reference walk            | Contract-preserving with fallback handling below                                |
| E2: native chunked longest-window comparison           | 0.2–0.4; remove 50–90% of that loop                              | Contract-preserving exact UTF-16 comparison                                     |
| E3: read rule data once during composition             | 2.3–3.4; 50–75% of its getter self-time                          | Per-view data only; overlaps B                                                  |
| E4: lazy reverse dependency/path index                 | 0.4–0.7; 40–75% of metadata/path work                            | New classification-local index/cache semantics require approval                 |
| E5: compact occurrence queues / cancellation masks     | 0.5–1.0; 25–50% of cancellation                                  | Preserve identity-run policy and earliest matching; overlaps D2                 |

**A proof.** Normalize with the delivered BOM/CRLF/CR/form-feed rules and retain
coordinate mapping during the head pass. Restart base scanning at a safe boundary
before the edit, including changed trivia; do not restart inside an atomic escape,
string, identifier or URL without its state. Reuse the equal prefix, rescan until
an aligned suffix checkpoint has the identical full scanner state, then shift and
reuse suffix boundaries. Equal state plus equal remaining units gives equal
future transitions by induction. Equal bracket depth alone is insufficient.
Without convergence, continue scanning to the end. Uncertain coordinate mapping
uses the original scan; anomalies retain whole-element fallback.
Native verification, contextual-at-rule fallback, document ordinals and the
base-then-head cache access/batch order remain unchanged. This bounds work by the
enclosing scanner region and convergence distance, not every arbitrary edit's
width. Lookup, cancellation and a head scan remain sheet-proportional.

Test A against the unchanged scanner and whole parser: all edit positions,
BOM/CRLF seams, empty windows, strings/comments/URLs/escapes/CDO, grouped rules,
anomalies, injected failures, tiny/zero caches and committed/derived results.
A code-unit work-bound test must grow unchanged prefixes/suffixes while keeping
the edited region fixed; ordinary sheets and unique/Emotion cold cases must not regress.

**B proof.** Use delivered occurrence selection/attribution. Equal retained residual
multisets plus symmetric retention of cancelled occurrences imply equal complete
sorted multisets. Prove actual and projected equality separately. A nonzero
identity difference is not by itself proof of unequal concatenated canonical
text: use delivered composition whenever the proof is insufficient. Preserve
condition 5 over all relevant original and composed material, including cancelled
rules; do not skip marker validation because residuals cancel. A streaming or
stored-key safety proof needs its own proof against canonical text; otherwise
compose. Keep grouped displacement, matched-reference copies, resource proof,
errors and fallback counting. Tests need selected ordinals, duplicates, ownership,
all M8 marker cases and a work bound forbidding cancelled-rule sorting/copying/
joining for proven equality. No new cached safety metadata is implicitly approved.

**C.** The recorded M5 probe found naive per-rule cancellation about 3 ms slower
at 3000 rules, but whole-element fallback about 22 versus 1.3–1.5 ms. The M5
checkpoint was 2.90 GHz; the finding does not retain an independent probe host
snapshot, so no current-host conversion is claimed. This matrix has zero fallbacks
and nearly flat runs: credit no saving. Approval would replace the grouped
exception with exact full-diff pairing tests, including references and failures;
it is a semantic choice, not a prerequisite assumed by this performance model.

**D.** An untimed restored-source inventory verifies the routed populations and
exact segment totals. Default has 5 distinct sheets in 368 elements / 184 routed
views; potential repeated segment work is 98.06%. Cumulative has **5508 distinct
sheets in 5520 elements**, only **0.299%** repeatable segment work even with an
unbounded exact-key cache. Under the contract's two-bytes-per-unit accounting,
unique base keys alone require **1157.76 MiB**, before run graphs.
Existing segment hits therefore do not justify an element cache. D2 would need
reuse between _different_ sheets, reliable locality, convergence and possibly
persistent cancellation indexes. Never bulk-cancel a common suffix without
proving earliest duplicate pairing survives. Tests must cover arbitrary source
order, grouped displacement, reference-bearing pairs, different eligibility,
cache limits/evictions/oversize values, detached strings and reachable run-graph
accounting, production GC release and unique-sheet cold costs. No budget or
index representation is selected here.

**E.** Verified runs have reference ordinals; whole-element fallback runs currently
synthesize an empty list even when they contain URLs. E1 must retain the current
walk for those runs/pairs. E2 needs exact longest-prefix/suffix tests, including
surrogates and empty windows. E3/E5 need byte/result/ordinal differentials and
allocation/GC checks; they cannot change selected duplicate copies or Decision 5.
E4 must preserve exact reasons versus directory-prefix evidence, overlapping
owners, shared globs and path order; test against the current policy on seeded
paths, with work bounds and no index construction on unchanged catalogues.

GC is 9.36 s style versus 6.66 s no-change in these profiles. The difference is
only 0.489 ms/view and has no reliable allocating-owner attribution; no direct
GC remedy/saving is assumed. M8's regex-backtracking finding remains serious but
is not exercised by these ordinary sheets; its fix and M9's redundant-guard
finding remain unimplemented, and neither is credited toward style-route savings.

## Combinations And The User's Decision

The model retains every unremoved bucket. Warm uses cold profile fractions,
explicitly an assumption; neither warm profiling nor prototype timings exist.
B replaces E3's material-data saving; D2 replaces the queue saving and applies
only to scan/lookup/cancellation left after A. No new fast-path work is allowed.

| Bundle                | Cold s        | Warm s        | Style/no-change cold / warm | Adjusted C/B cold / warm |
| --------------------- | ------------- | ------------- | --------------------------- | ------------------------ |
| A + cache-free E      | 191.77–207.43 | 183.63–198.62 | 2.53–2.74 / 2.40–2.60       | 3.60–4.37 / 3.34–4.07    |
| B + A + cache-free E  | 146.48–169.36 | 140.26–162.17 | 1.93–2.23 / 1.83–2.12       | 2.75–3.57 / 2.55–3.32    |
| Previous + D1 (gross) | 146.35–169.36 | 140.13–162.17 | 1.93–2.23 / 1.83–2.12       | 2.75–3.57 / 2.55–3.32    |
| B + A + D2 + E1/E2/E4 | 106.66–144.28 | 102.13–138.15 | 1.41–1.90 / 1.34–1.81       | 2.00–3.04 / 1.86–2.83    |

All ranges exceed the literal 2.90 GHz style ceilings, 73.520 / 75.739 s.
Even D2's optimistic range misses 1.25; its adjusted cold C/B is only near 2 at
one optimistic endpoint, and warm straddles 2. Thus **none of these proposed
ranges meets all targets**. Making _every_ named material/scan/lookup/cancellation/
reference-walk/window/metadata cost free leaves 92.53 s cold, only **2.23 s** for
replacement work before the same-session ratio fails. This is an idealized bound,
not an implemented option or proof that future designs cannot do better.

Prior identical-code, core-only 2.50 GHz style cold samples span 234.69–270.60 s;
this session is 232.15 s. Applying the largest same-code cold factor, 1.166, as a
stress sensitivity lifts the cache-free B bundle's upper prediction to about
197.4 s, style/no-change 2.60 and adjusted C/B 4.16 at factor 1.29. This is not
measured post-change spread; no single-sample warm cell is declared robust.
Shared parsing improvements must move both numerator and denominator:
`S'=S-cssSaving-H`, `N'=N-H`; the ratio gap increases by `0.25*H` when common
work alone is removed. They cannot be counted as style-only savings.

The user has two concrete scope choices; no target is changed by this report:

- **Keep 2 and 1.25:** approve further design/proof for D2 or another measured
  remedy aimed at nearly eliminating repeated work, alongside B and cache-free steps.
  Its replacement budget is extremely tight and success is unproven. Exact-source caching and per-rule
  cancellation alone cannot provide it.
- **Cap scope at B + A + cache-free E:** if measurements confirm the model, consider
  changing only cumulative component-style `C/B` to **4.25** and cumulative
  style/no-change to **2.75**, covering the stated host-adjusted stress envelope.
  Without that stress allowance the modeled ceilings would be 3.75 and 2.25.
  Leave default and other cumulative ratios unchanged. These are proposed user
  choices, not acceptance claims; re-reference must be decided separately.

Recommend B plus the bounded cache-free work as the first reviewable implementation
scope, followed by measurement before adopting weaker targets or a large new
cache. A and E1/E2/E3/E5 are contract-preserving only with their stated proofs;
B, C, D and E4 cross explicit approval boundaries. The plan's design TODO remains
at that decision point. No review finding or candidate has been implemented.

## Evidence And Validation

Raw evidence and uncommitted tooling: `.context/delegation/scalable/m9a-residual/`.
`diagnostic-{default,cumulative}.*` retain every sample, command, log and host
snapshot; `summary.json`, `samples.csv` (16 rows / 44 fields), `matrix-validation.json`
and restoration manifests cross-check them. `profiles/` retains both CPU profiles,
metadata, self/inclusive functions, disjoint weights and caller ownership.
`source-frequency-{default,cumulative}.json` pins the untimed inventory;
`historical-complete-buckets.json` and `cost-model.json` retain exact calculations.
The inventory's initial filename-filter error is recorded; no timed sample or
profile was repeated. Every source/fixture restoration and code-identity check passes.

Validation uses the Node 24.19.0 prefix for `npx prettier --check` on this report,
the fixture README and plan; relative-file/anchor checks, arithmetic/evidence
assertions and `git diff --check` pass. This is documentation-only: the repository's
Markdown exception applies, so no runtime suite or `cargo xtask check` is rerun.
The deletion audit matches accepted `9865774e` against current `origin/main`;
mainline integration remains M10. The checkpoint is committed/pushed for the
supervisor's review, then stops before any remedy.
