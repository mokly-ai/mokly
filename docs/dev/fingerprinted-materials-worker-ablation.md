# M9 Full-Worker Ablation

Reverting the M9 **diagnostics group** recovers 15,085.30 ms on average,
**2.7328 ms per view**, in two alternating production-worker pairs. Reverted
runs span 208.03–210.14 s; M9 controls span 223.90–224.44 s. The ranges do not
overlap. Recovery is 2.4930–2.9727 ms/view; the mean is about 74–85% of the previously
observed 3.2–3.7 ms/view gap. The supervisor's stop condition is met at group A;
groups B and C are not run. No fix, gate or push is performed.

This identifies a benchmark-instrumentation regression, not extra fingerprint
work on the style route. The material collector and its byte passes are opt-in
diagnostics; ordinary use without timings does not perform them. The experiment
isolates that group, not a particular added method or V8 mechanism. No claim
that direct UTF-8 scanning alone accounts for the recovered time is supported.

The [GC diagnostics](./fingerprinted-materials-gc.md) show substantially more
major collections in M9 at nearly equal allocation volume, with a small,
constant forced-GC live-heap difference. Together, the results support the
supervisor's process-wide GC/runtime-state hypothesis. They do not establish
a growing page-retention leak or justify changing comparison semantics.

## Controls And Method

Measured October 5, 2026, on the same Intel Xeon @ 2.90 GHz host: eight CPUs,
2899.962 MHz throughout, Node 24.19.0, system Chrome 153.0.8010.52. M9 code is
`14447151`; HEAD `5ea98bf4` adds only the preceding measurement reports. The
clean M8 worktree at `/tmp/mokly-m9-m8-control` is `5e5111dc`. Each tree uses its
own already-prepared `dist`; no engine file is modified. The cumulative fixture,
its commit, template digest and dependency versions match the
[narrow remeasurement](./fingerprinted-materials-remeasurement.md).

Each sample runs the real cumulative `component-style` cold benchmark: fixture
preparation, Serve/preview interaction, background compilation, reader preparation,
classification and delivery. The production 1,024 MiB old-generation limit and
900,000 ms delivery wait remain. Cold means a fresh server, not a flushed OS cache.
CPU model/MHz, uptime, memory and steal are saved before/after every run and sample.
There are no concurrent suites, profiles or unrelated builds. Across the eight
GC/forced/ablation samples, aggregate eight-CPU steal is 0.14–0.33 s,
0.003562–0.007405%; CPU cgroup throttling is zero.

After the natural and forced-GC pairs finish, an uncommitted synchronous loader
substitutes frozen M8 compiled modules in the M9 classification worker. Original
and substituted hashes are checked and recorded. Imports retain the original M9
module URL, so unrelated dependencies still come from M9. A separate preflight
compares all 200 views from the prior immutable bundle, after warm-up and across
three repetitions, with identical results and per-view style-path assertions.

Both ablated and control workers install the same loader. Controls substitute
no modules, avoiding an unmatched loader-registration effect on startup, GC or
JIT history. Neither ablation variant enables GC tracing, forced GC or CPU
profiling. The shared preload records only timing boundaries/counts and two
heap snapshots; it hashes the full result after the classification timer ends.
Each run restores and verifies all 5,560 files in both fixtures before continuing.

## Group A: Exact Substitutions

The eight substitutions cover only diagnostics. M9 page analysis, pair metadata,
fingerprint preparation and all comparison rules remain in place.

| Module under `dist/`                | Substitution                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `diagnostics/document_work.js`      | Exact M8 collector layout and methods; removes nine M9 fields and material scope.      |
| `diagnostics/timings.js`            | M8 implementation plus a linkage-only `documentMaterialWork` that calls its operation. |
| `components/comparison_material.js` | Exact M8 implementation; removes added normalization counting.                         |
| `review/view_resources.js`          | Exact M8 implementation; removes added HTML-hash byte counting.                        |
| `review/ignore.js`                  | Retains M9 parsing/metadata; removes only normalization counter calls/import.          |
| `review/page_inline_material.js`    | Retains M9 materials; removes fingerprint byte/hash/view counter calls.                |
| `review/fingerprint_seams.js`       | Retains M9 guards; removes the seam counter call.                                      |
| `review/page_projection.js`         | Retains M9 recipes/materials; removes assembled-material byte counting.                |

The compatibility export preserves the operation; it does not disable material
construction or validation. It supplies no material-counter scope. Those complete
paths are not reached by this fixture: every compared view settles on the route.
Source substitutions and their exact hashes are in `overrides.json` and each
sample's worker record. Prepared B/C substitutions remain unexecuted tooling.

## Two Alternating Pairs

Order is reverted M9, M9, reverted M9, M9. Times are worker `changes.classify`
milliseconds. Instrumentation overhead remains inside that interval; no duration
is subtracted. The full result SHA is identical in every sample.

| Pair | Reverted ms / heap MiB | M9 ms / heap MiB   | Recovered ms | Recovered ms/view |
| ---- | ---------------------- | ------------------ | ------------ | ----------------- |
| 1    | 210140.06 / 258.15     | 223901.46 / 258.29 | 13761.40     | 2.4930            |
| 2    | 208030.95 / 263.35     | 224440.15 / 258.87 | 16409.20     | 2.9727            |
| Mean | 209085.505             | 224170.805         | 15085.30     | 2.7328            |

Reverted/M9 is 0.9327: a 6.73% reduction against these same-session controls.
The cross-sample recovery envelope is also 13,761.40–16,409.20 ms, or
2.4930–2.9727 ms/view. It is a spread, not a confidence interval. Both pair
deltas exceed half of the prior upper 3.7 ms/view gap. This does not prove
that every remaining difference from historical M8 is explained.

All four samples retain 5,520 style / zero fast / zero complete views;
5,520 `pageAnalysis` parses / 669,071,362 bytes; 5,550 total parses /
669,081,544 bytes. Inline work is 11,040 elements, 32,447,024 segments,
32,441,326 hits, 5,698 parses and zero fallbacks. Membership is exactly
`area-1-action` and `components/area-1-action.html`. The complete Review result
hash is `e7cdeb37ae70eccbb90bbc37185b137b2ab72616002d95ed03904153f29bc057`.

M9 controls emit zero material, material-normalization, fingerprint, material-hash
and seam work, plus 1,338,168,848 source-normalization bytes. Reverted samples
correctly lack the nine M9 fields; absence is not recorded as zero. The original
integer work counters and comparison results agree exactly. Three ablation
commands exit 1 for the separate five-second startup target; the second reverted
run is 4,946 ms and exits 0. All classifications and browser assertions succeed.

## Interpretation And Proposed Scope

The group result explains why small direct callback costs in CPU profiles were
insufficient. Diagnostics can affect GC/JIT state beyond their own sampled self
time. The prior warmed probe found about 0.030–0.059 ms/view in the new byte
counter, an entire direct-cost envelope of only 0.17–0.33 s per catalogue.
That is not an explanation for the controlled 13.76–16.41 s recovery.

Compilation garbage is a confounder, not proof of retained M9 data: initial
uncollected heaps in the ablation pairs are 67.05 / 795.18 MiB, then
739.17 / 815.08 MiB, reverted / M9. Both reverted runs are faster despite very
different entry garbage. Fixed-view forced-GC measurements show only a constant
2.3 MiB live difference after 1,000 views. The experiment stops at group-level
attribution; collector object layout, call placement and individual byte passes
have not been separately ablated.

1. **Medium: detailed M9 diagnostics distort the benchmark's timing result.**
   Leaving the current measurement method unchanged mixes the optimization's
   execution cost with a substantial diagnostic tax.

   **A — recommended: separate timing from detailed work collection.** Give the
   benchmark an internal core-collection mode retaining the M8 timing/path/HTML/
   inline/heap behavior, with M9 material and source-byte collection in a distinct
   detailed pass over the same prepared immutable inputs. Compare full results
   and shared counts, and associate the detailed record with those input hashes.
   Keep normal diagnostic behavior and exact counters available; label companion
   counts as such rather than copying them into a timed sample. Amend the
   benchmark documentation for that distinction and remeasure both trees under
   the same mode. This is a measurement change, not a faster style algorithm.
   The measured whole-group recovery is **13.76–16.41 s per 5,520 views**, with a
   **15.09 s mean**; that is a target to verify, not a promise for a new implementation.

   **B — keep one-pass detailed collection and optimize it.** Isolate the extra
   counters from the hot core collector, and reuse exact UTF-8 lengths already
   available for the same inputs where safe. Preserve per-view lifetime and
   counter semantics; do not substitute file byte sizes for decoded-string sizes
   without proving identity. This retains one-pass reports but needs narrower
   ablations to establish which change restores the runtime behavior. Byte-scan
   caching alone has only the small direct ceiling above; a 15 s recovery cannot
   be honestly predicted for it from this experiment.

Ordinary operation without timing collection pays no material byte-counting
passes or collector-state work. The enabled full-worker experiment does not
measure an exact disabled-mode speedup; previous disabled warmed probes were
equal. No fingerprint guard, route condition or comparison result is changed.
Groups B/C are skipped under the supervisor's explicit first-recovery rule.
The supervisor decides the next fix scope; the gate and push remain blocked.

## Evidence And Verification

Tooling and raw evidence stay uncommitted under
`.context/delegation/scalable/m9-full-worker-ablation/`: `run.mjs`,
`worker-preload.mjs`, `ablation-loader.mjs`, `overrides.json`, frozen overrides,
`a-{reverted,m9}-{1,2}.*`, `a-summary.json`, `stop.json`, the GC/forced records,
commands, host snapshots and restoration manifests. No sample is discarded,
overwritten or incomplete. The first-recovery decision is recorded explicitly.

`validate.py` verifies all eight diagnostic/ablation results, route/work counts,
Node/host identity, clean engine trees and every fixture restoration. Loader
preflight, GC observer/trace pairing and all forced checkpoints pass. Only report,
README and plan Markdown is changed. The accepted implementation's suites are
unchanged; no full suite, `cargo xtask check` or push is run at this reporting stop.

Verification commands pass: `python3` on `parse-gc.py gc-m8 gc-m9`,
`summarize-forced.py`, `phase-summary.py a` and `validate.py` in the evidence
directory; `npm exec --yes --package=node@24.19.0 -- npx prettier --check` on
the two new reports, the three preceding measurement/investigation reports,
fixture README and plan; relative-link validation (127 links); and
`git diff --check` / `git diff --cached --check`. The 345-entry deletion audit
matches the pre-task baseline. Only reporting Markdown is committed locally.
