# Fingerprinted Material CPU Profiles And Proposed Scope

M9 adds avoidable work on complete views and small eager allocations on shortcut
views. These captures do not explain the entire unprofiled regression. Cumulative
style reverses direction under profiling, and cumulative linked is nearly equal.
The [measurement report](./fingerprinted-materials-measurements.md) retains every
unprofiled result, including the regressions. No profile replaces a timing sample.
The supervisor requested this report and a stop before the gate/push; the proposed
fixes below are not implemented or approved.

## Capture And Attribution

Eight cold, worker-only profiles use the accepted off-by-default M6 inspector
preload, 1,000-microsecond sampling, Node 24.19.0 and system Chrome 153.0.8010.52.
For each cell, M8 `5e5111dc` precedes M9 `b11e51d0`: default no-change, default
linked, cumulative style, cumulative linked. These clean engines/fixtures and
the host are the same as the unprofiled measurements. Captures begin/end only at
the background worker's `changes.classify` events. None includes compilation or
renderer startup. Every capture reaches successful classification end and exact
membership. Shared path/work/inline counts match the corresponding unprofiled
cell; the M9 byte/fingerprint counts also match exactly.

Default profiles keep the ordinary delivery cap. Cumulative profiles use M6's
uncapped delivery helper with the same interactive startup, removing only the
wait ceiling. No heap cap, browser channel, source code or comparison option was
changed. Host snapshots, commands, full sample records, restoration markers and
logs are retained per profile. All 5,560 files in each fixture again match setup.

Evidence is `.context/delegation/scalable/m9-measurements/`:
`profiles-driver.log`, `profile-{m8,m9}-{default,cumulative}-<scenario>-cold.*`,
`profiles/*.cpuprofile`, their `.metadata.json` / `.summary.json` siblings,
`profile-comparison.json`, `profile-costs.csv` and the analysis scripts.
The first launcher imported Playwright from both worktrees and failed before
fixture preparation, browser launch or a sample. `profile-bootstrap-failure/`
retains it. The corrected harness shares the identical `scripts/large` helpers
(the two commits have no diff there), while selecting each tree's CLI and identity.

CPU samples are weighted by `timeDeltas`; self charges only the leaf, inclusive
charges its descendants too. Inclusive rows overlap and must not be added.
Module/caller scopes include callbacks when V8 inlines a small public wrapper.
In particular, M8's `reviewIgnoreRegions` often disappears from stacks: the
constructor/window rows include the actual `ignore.ts` validator, not just that
wrapper. The extra-metadata rows exclude that existing validation. Canonical
composition rows name the retained rendering functions and can be inlined too.
Small zero cells mean no sampled time; source/control-flow checks distinguish
an unexecuted path from a sub-millisecond operation. Negative sample deltas are
clamped to zero as in the M6 summary, retained in metadata: the largest correction
is 70.012 ms for M8 cumulative linked (0.075%); the other corrections are 0–0.074 ms.
Self/group/path totals are checked against all sampling weight.

## Profile wall time and GC

| Cell                         | M8 classify ms | M9 classify ms | M8 GC ms | M9 GC ms |
| ---------------------------- | -------------- | -------------- | -------- | -------- |
| default/no-changes           | 16742.19       | 19816.74       | 733.14   | 2535.20  |
| default/linked-stylesheet    | 27178.60       | 27817.42       | 2155.18  | 2988.86  |
| cumulative/component-style   | 219948.38      | 198974.70      | 8814.74  | 8224.93  |
| cumulative/linked-stylesheet | 93727.59       | 93396.15       | 6455.15  | 7283.58  |

The default no-change profile adds 3,074.55 ms in M9, of which sampled GC rises
1,802.06 ms and shared-page parsing rises 676.66 ms. Those are observed locations,
not proof that M9's extra allocations caused all that GC. Cumulative style's
11,204.84 ms reduction in existing `inlineMaterialReplacements` inclusive time
accounts for much of its reversed profile result. These single profiled pairs
cannot establish a causal speedup or erase the fixed unprofiled ABBA result.

## Costs Per View

Every table cell is **self / inclusive microseconds per compared view**, dividing
by 5,520 in every capture. For a fingerprint-only linked cost per affected complete
view, multiply by 2.3 (5,520 / 2,400). GC is shown separately; it has no reliable
allocation-owner attribution. New marker callbacks are the two extra constructor
filter/map callbacks, identified in the measured M9 build. Their native allocation
work may also appear in constructor self time or GC.

## default self / inclusive microseconds per compared view

| Cost                                      | m8/no-changes   | m9/no-changes   | m8/linked-stylesheet | m9/linked-stylesheet |
| ----------------------------------------- | --------------- | --------------- | -------------------- | -------------------- |
| Constructor ignore validation + metadata  | 25.98 / 46.70   | 31.58 / 55.99   | 39.47 / 71.81        | 42.65 / 76.32        |
| Constructor metadata excluding validation | 0.00 / 0.00     | 2.13 / 4.65     | 0.38 / 0.38          | 2.50 / 5.57          |
| New component marker callbacks            | 0.00 / 0.00     | 0.97 / 0.97     | 0.00 / 0.00          | 1.16 / 1.16          |
| Window base validation + metadata         | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 0.00 / 0.00          |
| Window base metadata excluding validation | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 0.00 / 0.00          |
| pairedIgnoreIds base metadata             | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 0.00 / 0.00          |
| Normalization byte counting               | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 1.55 / 15.01         |
| Fingerprint preparation                   | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 15.97 / 183.64       |
| Guard including indexes                   | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 11.17 / 107.46       |
| Guard recipe construction                 | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 2.50 / 16.66         |
| materialRecipe                            | 0.00 / 0.00     | 0.00 / 0.00     | 2.57 / 10.80         | 6.88 / 21.24         |
| Recipe normalization model                | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 6.85 / 6.85          |
| StyleSeamOffsets                          | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 14.15 / 27.03        |
| MaterialMarkerOffsets                     | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 1.54 / 9.65          |
| allSkippedOccurrencesEligible             | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 28.27 / 28.27        |
| Fingerprint source safety                 | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 1.15 / 12.67         |
| Fingerprint hashing and byte counter      | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 2.32 / 16.19         |
| fingerprintAtSeam                         | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 6.91 / 34.76         |
| Style crossing query                      | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 3.40 / 3.58          |
| Marker openness query                     | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 6.37 / 6.37          |
| inlineMaterialReplacements                | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 0.19 / 0.39          |
| Canonical projection                      | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 0.00 / 0.00          |
| canonicalInlineRules                      | 0.00 / 0.00     | 0.00 / 0.00     | 0.00 / 0.00          | 0.00 / 0.00          |
| GC                                        | 132.82 / 132.82 | 459.28 / 459.28 | 390.43 / 390.43      | 541.46 / 541.46      |

## cumulative self / inclusive microseconds per compared view

| Cost                                      | m8/component-style | m9/component-style | m8/linked-stylesheet | m9/linked-stylesheet |
| ----------------------------------------- | ------------------ | ------------------ | -------------------- | -------------------- |
| Constructor ignore validation + metadata  | 67.35 / 130.90     | 66.21 / 128.40     | 122.71 / 225.95      | 123.52 / 231.21      |
| Constructor metadata excluding validation | 0.00 / 0.00        | 2.69 / 4.43        | 0.39 / 0.39          | 3.68 / 6.19          |
| New component marker callbacks            | 0.00 / 0.00        | 1.34 / 1.34        | 0.00 / 0.00          | 0.77 / 0.77          |
| Window base validation + metadata         | 79.58 / 154.16     | 76.44 / 163.21     | 0.00 / 0.00          | 0.00 / 0.00          |
| Window base metadata excluding validation | 0.00 / 0.00        | 2.32 / 4.30        | 0.00 / 0.00          | 0.00 / 0.00          |
| pairedIgnoreIds base metadata             | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 0.00 / 0.00          |
| Normalization byte counting               | 0.00 / 0.00        | 1.35 / 63.96       | 0.00 / 0.00          | 1.55 / 14.12         |
| Fingerprint preparation                   | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 72.41 / 557.89       |
| Guard including indexes                   | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 13.70 / 226.74       |
| Guard recipe construction                 | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 4.84 / 20.74         |
| materialRecipe                            | 0.00 / 0.00        | 0.00 / 0.00        | 6.48 / 20.41         | 6.16 / 25.17         |
| Recipe normalization model                | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 8.50 / 8.50          |
| StyleSeamOffsets                          | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 58.66 / 93.22        |
| MaterialMarkerOffsets                     | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 7.57 / 47.26         |
| allSkippedOccurrencesEligible             | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 47.56 / 47.56        |
| Fingerprint source safety                 | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 3.30 / 96.98         |
| Fingerprint hashing and byte counter      | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 3.09 / 108.97        |
| fingerprintAtSeam                         | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 10.18 / 37.67        |
| Style crossing query                      | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 2.73 / 3.50          |
| Marker openness query                     | 0.00 / 0.00        | 0.00 / 0.00        | 0.00 / 0.00          | 6.37 / 6.37          |
| inlineMaterialReplacements                | 0.78 / 11217.30    | 1.93 / 9187.44     | 0.00 / 0.19          | 0.00 / 0.97          |
| Canonical projection                      | 2913.95 / 6101.54  | 2369.36 / 5120.36  | 0.00 / 0.00          | 0.00 / 0.00          |
| canonicalInlineRules                      | 266.27 / 2596.75   | 261.41 / 2165.96   | 0.00 / 0.00          | 0.00 / 0.00          |
| GC                                        | 1596.87 / 1596.87  | 1490.02 / 1490.02  | 1169.41 / 1169.41    | 1319.49 / 1319.49    |

## What M9 Adds

- **Constructor metadata:** `reviewIgnoreMetadata` still performs the same original
  validation that M8 performed through `reviewIgnoreRegions`. M9 additionally makes
  a material-id set, signal spans, another header lookup and component-marker
  arrays. The latter data is unnecessary for settled fast/style views. Extra
  non-validator metadata plus marker callbacks sample 31.055 ms in default
  no-change and 55.621 ms in cumulative style, across all views. That is small
  compared with either whole-worker regression. Fixtures have no material signals;
  the extra full-source signal-span scan when signals exist is not measured here.
- **Base pairing:** no sampled base `reviewIgnoreMetadata` call occurs under
  `pairedIgnoreIds`. This is corroborated by production flow: the non-identical
  quick check has already stored `pages.normalization`; the getter returns its
  paired ids before its new base-text branch. The style window separately validates
  base regions in both M8 and M9. Its M9 wrapper adds 23.758 ms of derivation; the
  full 900.894 ms is not all new work. Disabled-fast-path test cases can reach the
  new getter branch, but these production profiles do not.
- **Complete preparation:** linked views skip inline analysis in both fixtures.
  M9 fingerprint preparation is 1,013.682 ms default / 3,079.529 ms cumulative,
  or 0.422 / 1.283 ms per fingerprinted complete view. Its inclusive guard costs
  593.166 / 1,251.579 ms. Those totals include the nested rows, not additions to them.
- **Recipes and seams:** the extra text-path recipe construction used by the guard
  costs 91.967 / 114.460 ms inclusive. Recipes hold offsets/inserts; they do not
  build sheet-sized page strings. There are four normalization inventories and
  ten inspections per successful view; 80 seams and 1,920 window units per linked
  complete view. Numeric crossing/open-state queries and windows scale with
  pieces/seams and indexed positions, not retained sheet interiors.
- **Original-source scans:** `StyleSeamOffsets`, `MaterialMarkerOffsets`, occurrence
  `indexOf` proofs, original-prefix checks and style-safety checks inspect original
  text. Their scans grow with source/sheet length (and distinct skipped sources).
  The three named index/occurrence operations cost 358.525 / 1,037.995 ms inclusive.
  Additional source-safety work inside fingerprint preparation costs 69.922 /
  535.322 ms. These occur only on complete views; the source-safety helper itself
  also has pre-existing uses in the quick check.
- **SHA-256:** fingerprint hashing plus its byte counter costs 89.396 / 601.510 ms,
  over 26,204,577 / 294,639,188 UTF-8 bytes and 2,480 / 2,400 hashes. Required hash
  input grows with the sheet; within-view digest reuse is already present.
  `materialHashBytes` is zero, so these fixtures gain no downstream HTML-hash saving.
- **Canonical composition:** neither linked case renders canonical rule sheets
  before fingerprinting: analysis is skipped, and the text replacement helper
  returns an empty recipe. Routed style views do compose canonical retained
  multisets in M8 and M9; M9 emits no fingerprint and constructs no fingerprint
  index there. M9's profile spends 50,714.650 ms in that existing composition
  entry point, including 28,264.409 ms projection and 11,956.109 ms sorting.
  These inclusive components overlap the parent and remain sheet-proportional.
- **Opt-in byte accounting:** style-route normalization now counts 1,338,168,848
  source bytes. That costs 353.051 ms inclusive in the M9 style profile. It is
  diagnostic overhead, not a production fingerprint; disabled collection does
  no byte-length work. Identical fast views record none of this work.

The four exclusive normalization/projection/inline-rule/hash buckets on cumulative
linked fall from 6,051.90 to 4,964.25 ms in the unprofiled cold pair, and from
6,377.41 to 5,254.84 ms in the profiled pair. Constructor work and GC sit partly
outside those buckets, so this is not a complete marginal-cost proof. It does
show that the total +6,250.23 ms cold regression cannot simply be assigned to
those guard/material buckets. HTML/reference work and the uninstrumented remainder
also increased. No claim of noise-free causation or recovered performance is made.

## Proposed Fixes — Supervisor Decision Required

1. **Low: eager fingerprint bookkeeping reaches fast/style views.** A (recommended):
   retain eager original validation, but derive material ids/signals and the extra
   component-marker inventory only when consumed; restore a regions-only path for
   window validation. B: retain current eager work. B keeps the extra allocation
   pressure and signal-bearing pages' additional scan. A's expected direct saving
   is about **0.02–0.04 s for default no-change, 0.04–0.06 s for cumulative style**;
   measured derivation/callback envelopes are 31 / 56 ms. Any GC benefit is unknown.
   Add tests that shortcuts never request fingerprint-only inventories, including
   pages with valid signals outside styles, while validation errors remain identical.
2. **Low: identical base/head sources repeat source proofs.** A (recommended):
   share immutable marker/style indexes within the view when their exact source and
   skipped-style inputs agree; share occurrence results only when eligible positions
   agree too. B: change the `indexOf` algorithm or add a cross-view cache. A preserves
   the general occurrence rule and bounded lifetime; B adds proof/retention risks
   for an unmeasured gain. Half of the measured index/occurrence work is an
   optimistic ceiling: **0.179 s default / 0.519 s cumulative linked**. Expect roughly
   **0.15–0.18 s / 0.45–0.52 s** before remeasurement. These fixtures have identical
   base/head HTML in linked views. Test same-source/different-eligibility cases and
   retain the seeded seam/occurrence proofs; do not bypass any seam condition.
3. **Low: complete preparation repeats a successful source-safety proof.** A
   (recommended): retain that proof only on quick-check fall-through, and reuse it
   for skipped, equal ordered style sources whose exact guard inputs agree. With
   either switch disabled or missing proof, run the current guard. B: keep rescanning.
   Leave `style_source_safety.ts`, its rules and the route unchanged. The measured
   removable envelope is **0.070 s default / 0.535 s cumulative linked**; expect
   roughly **0.05–0.07 s / 0.40–0.54 s** after matching/cache overhead. Tests must
   preserve every marker regression and demonstrate no added source scan on shortcuts.

Recommend those three bounded changes first, with direct linked savings around
**0.20–0.25 s default / 0.85–1.06 s cumulative**, plus small lazy-metadata savings.
These are estimates from sampled existing work, not measured improvements or a
promise to recover the whole regression. They will not bring cumulative style
near Decision 13. Keep the existing correctness oracles/mutations and rerun the
required checkpoint and same-host measurements after approval.

Deferring M8 text rendering to fallback has **no material saving in these measured
complete cells**: they already skip canonical rendering, and page material strings
are built after admission. Resolved complete views may benefit, but this set does
not measure that case. Reusing an identical actual single/pair seam inspection on
these marker-free fixtures has a roughly **0.04 s** direct ceiling; caching the
normalization inventory is smaller still. Neither warrants broadening marker
semantics. The style route's expensive canonical composition is existing work;
residual-multiset equality remains the unapproved M9A candidate and is not proposed
as an automatic M9 fix. Byte-count caching could save at most part of 0.353 s on
style here, with added diagnostic-cache complexity; it is not the initial priority.

The larger unprofiled slowdown remains only partly explained. Controlled repeat
measurements after a narrowly scoped change are needed to attribute any GC gain
and remaining variance. No gate or push was attempted after measurement; the
supervisor will choose the scope. No M8 review finding or comparison semantics
were changed, and the formal M9 review remains pending.
