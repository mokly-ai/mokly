# Scalable Inline Style Analysis

Make inferred inline style ownership work on a full-size React Native Web
catalogue. Mokly must stop retaining memory it does not need, bound the memory
it caches, and read each distinct CSS rule once instead of re-reading every
page's cumulative style sheet in full. The ownership contract, Changes
membership, evidence and presentation stay as delivered, apart from two
documented edge cases this work resolves.

## Base And Prerequisites

This plan builds on the
[inferred inline style ownership plan](./inferred-inline-style-ownership.md),
which is implemented but not yet merged, on branch `calummoore/irvine-v6` at
`6a2ff27e`. That plan's Milestone 8 scale diagnosis is the evidence for this
plan, and its review findings stay recorded there. The analysis this plan
changes lives under `src/review/css/` and is specified by
[inline style ownership](../docs/protocol/mokly-inline-styles.md) and
[CSS change attribution](../docs/protocol/mokly-css-attribution.md). The
background worker is specified by
[on-demand work](../docs/protocol/mokly-on-demand.md), and the scale fixture by
[its README](../tests/fixtures/large/README.md) and
[timings](../docs/protocol/mokly-timings.md).

## Problem

React Native Web keeps one style sheet for a whole build. Each page's head
therefore carries the rules of every page rendered before it. On the full-size
cumulative fixture (1,410 routes, 5,550 documents), one component style edit
changes that sheet on 5,520 views: 5,280 unique sheets per side, a median of
101,000 characters and 2,874 rules, 15.2 million rule occurrences per side,
and exactly one diffed rule per view. Classification then exhausts the 1 GiB
background worker heap after about 140 seconds.

1. The worker keeps the whole compilation output map (645 MB) although
   committed-mode classification reads committed files instead.
2. The classification-lifetime parse cache has no bound (340 MB, about 1.06
   million rule objects), and its keys are slices that keep whole documents
   alive.
3. Lightning CSS parsing is 78% of the analysis time. Every view re-parses its
   full cumulative sheet on both sides, although almost every rule was already
   parsed for an earlier view. Even without the memory limit, parsing alone
   extrapolates to about 48 minutes.
4. After parsing, the per-rule work repeats too: the diff and the canonical
   renderer rebuild each rule's identity string on every use.

The committed `--inline-styles` fixture template also differs from the one
that was measured, and its per-view class names depend on render order, so the
recorded numbers cannot be reproduced and cross-area edits look like false
component changes. The benchmark cannot record a worker killed by the heap
limit. Both must be fixed before this plan can prove its result.

## Decisions

1. **The background worker keeps compilation outputs only in derived mode.**
   Committed-mode classification already reads committed files, so the worker
   drops its reference after handing the compilation to the parent. Derived
   mode is unchanged.
2. **Parse caches are byte-bounded LRUs.** One classification has a
   stylesheet-file cache (whole file text to parse result) and a rule-segment
   cache (one top-level rule's text to its parsed rules). Each is bounded by an
   estimated retained size of 64 MiB. Keys are flat copies that never keep a
   larger document alive. Eviction can only cost time; it never changes a
   result.
3. **Inline elements are parsed one top-level rule at a time, with reuse.** An
   element's normalized text is split into top-level rule segments by a fast
   scanner with the boundary semantics of the existing tokenizer. Cached
   segments are reused. An element's missing segments are parsed together in
   one parser call and split back by top-level rule. Each segment must yield
   exactly one top-level rule starting at its own start. An element falls back
   to whole-element parsing on any scanner anomaly, any verification
   mismatch, any batch parse failure, or any `@charset`, `@import` or
   `@namespace` segment, whose meaning depends on neighboring rules. The
   assembled rule list, including ordinals and parse failures, equals the
   whole-element parse.
4. **Each distinct rule's derived data is computed once.** When a rule is
   parsed, Mokly stores its address key (conditions, selectors, at-rule name,
   prelude and statement-or-block form), its identity key (address plus
   declarations), its sheet-leading rank, its canonical rendered text and
   whether it carries a reference. The rule diff groups by the address key and
   the canonical renderer sorts by rank and identity, so both share one
   definition. The block form joins the address, so `@layer a;` against
   `@layer a{}` becomes a diffed, unresolved change on both the linked and the
   inline path. This resolves Milestone 3 finding 1 of the prerequisite plan.
5. **Analysis work follows the changed segments.** Before the rule diff,
   identical segment texts cancel between the two sides as a multiset,
   earliest occurrences first, because equal text parses to equal rules. Only
   the remaining segments' rules enter the rule diff. Unchanged
   reference-bearing rules are found from the stored reference flag, and each
   is paired only with a copy that actually matched: a cancelled segment or an
   exact rule match. This resolves Milestone 5 finding 2 of the prerequisite
   plan, where one rule object could receive two attributions. Each side's
   canonical fragment is composed from the stored per-rule text of every
   segment, omitting only the analyzed occurrences selected as excluded or
   owned.
6. **Results do not change otherwise.** Attributions, owned sets, retained
   selectors, the all-excluded flag, both materials, Changes membership,
   evidence and presentation equal the delivered engine's for every input,
   except the two documented cases above. Differential tests enforce this.
7. **The scale fixture is value-stable and self-identifying.** Per-view atomic
   rules derive from a hash of the view key, not render order. The fixture
   record and every benchmark report carry a digest of the fixture templates,
   and the benchmark rejects a fixture generated from different templates.
8. **Scale evidence records every outcome.** The benchmark records ok, error,
   incomplete (the worker stopped without ending classification) and
   membership-mismatch samples with the timing data available. The classifying
   worker reports its peak V8 heap use, and the inline analysis reports its
   segment reuse.

## Non-Goals

- Reusing parse5 trees across range validation, span discovery and matching,
  a selector index (matching is under 0.1% of the analysis time), or reducing
  the complete-path cost of large documents. The acceptance measurement
  records these costs for follow-up plans.
- Any change to the inline style ownership contract's scope, attribution
  rules, evidence schema, Changes membership or shell presentation beyond
  Decisions 4 and 5.
- The five-second navigation target, which `origin/main` also missed cold in
  a paired run, and the linked-stylesheet benchmark scenario recorded as
  Milestone 8 finding 2 of the prerequisite plan.
- Moving prefetched document buffers or derived-mode outputs out of memory.

## Design Summary

The contract lives in a new CSS parse reuse protocol document,
`docs/protocol/mokly-css-parse-reuse.md`, created in Milestone 1, because the
inline style contract already exceeds the protocol length guideline. It owns
segmentation, verification and fallback, both caches and their byte estimate,
per-rule derived data, changed-segment analysis and its equivalence guarantee,
and the diagnostics counts. The inline
style, CSS attribution, on-demand and timing contracts reference it.

The byte estimate for a cache entry is two bytes per UTF-16 code unit of its
key and of every string it retains, plus 96 bytes per rule and 64 bytes per
entry. The estimate is recomputed on insertion only.

Segmentation normalizes an element's text exactly as the parser does (strip a
leading byte-order mark, convert `\r\n`, `\r` and `\f` to `\n`), then scans
code units once. It skips comments, quoted strings with escapes, escapes,
unquoted `url(` tokens and bracket nesting. It treats top-level `<!--` and
`-->` as separators. A top-level rule ends at a top-level `;` before any block
or at the `}` matching its first top-level `{`. An unterminated construct, an
unmatched closing bracket or trailing non-whitespace is an anomaly.

## Milestone 1: Protocol And Documentation Contract

Summary: define the complete contract for bounded memory, parse reuse,
changed-segment analysis, fixture identity and benchmark outcomes before any
code changes. Documentation-only; validated with Prettier and a diff review.

- [x] Register this plan in [`plans/README.md`](./README.md).
- [ ] Create `docs/protocol/mokly-css-parse-reuse.md` with Decisions 2 to 6
      and the Design Summary as normative text: segmentation semantics and
      anomalies, batched parsing and per-segment verification, fallback
      conditions, the equivalence guarantee, both caches with the byte
      estimate and flat keys, per-rule derived data, changed-segment
      cancellation and reference pairing, fragment composition, and a
      Delivery Status naming this plan as the approved target. Register it in
      the [protocol index](../docs/protocol/README.md).
- [ ] In [`mokly-inline-styles.md`](../docs/protocol/mokly-inline-styles.md),
      make the Rules step reference parse reuse, state that unchanged
      reference-bearing rules pair only with matched copies, and add the
      approved-target sentence for this plan to its Delivery Status.
- [ ] In [`mokly-css-attribution.md`](../docs/protocol/mokly-css-attribution.md),
      replace the parser-cache paragraph with the bounded stylesheet-file
      cache, add the statement-or-block form to the rule address and identity,
      and state that `@layer a;` against `@layer a{}` is a diffed, unresolved
      change.
- [ ] In [`mokly-on-demand.md`](../docs/protocol/mokly-on-demand.md), state
      that the background worker retains compilation outputs only in derived
      mode.
- [ ] In [`mokly-timings.md`](../docs/protocol/mokly-timings.md), add
      `heapPeakMiB` to the `review.compare-screens` counts record, add one
      `review.inline-style-analysis` counts record after the component-aware
      loop with `elements`, `segments`, `segmentHits`, `segmentParses` and
      `fallbacks`, and describe the four benchmark sample outcomes.
- [ ] In [`tests/fixtures/large/README.md`](../tests/fixtures/large/README.md),
      describe value-stable per-view rules, the template digest and its
      rejection rule, the `--scenario` filter, sample outcomes and peak heap,
      each marked as the approved target of this plan.
- [ ] Validate the changed Markdown with `npx prettier --check` and review the
      diff; documentation-only work does not require `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 2: Deterministic Scale Fixture And Complete Benchmark Evidence

Summary: make the cumulative fixture reproducible and the benchmark able to
record any outcome, then measure the pre-change baseline on the corrected
fixture.

- [ ] In `tests/fixtures/large/inline_styles.tsx`, derive each per-view rule's
      value from a stable hash of the view key instead of the global render
      counter, so class names depend only on style values.
- [ ] Add a small-fixture test: adding a screen to one area leaves every other
      area's generated documents byte-identical and out of Changes.
- [ ] Record a digest of the fixture templates in the fixture record at setup
      and in every benchmark report; make `preparedFixture` reject a fixture
      whose digest differs from the current templates, naming the preparation
      command.
- [ ] Model every sample outcome in `scripts/large/timings.mjs` and
      `benchmark.mjs`: `ok`, `error` (the worker's `changes.classify` ended
      with status `error`), `incomplete` (started but never ended; report the
      Serve span as an upper bound and the completed inline union as a lower
      bound) and `membership-mismatch` (ended `ok` with the wrong Changes).
      Include every inline end record in the union, whatever its status.
- [ ] Add a repeatable `--scenario <name>` filter to the benchmark.
- [ ] Sample the classifying isolate's used V8 heap after each compared view
      and emit the maximum as `heapPeakMiB` in the `review.compare-screens`
      counts record; record it per benchmark sample.
- [ ] Extend `tests/large_baseline_benchmark.test.ts` with ok, error,
      incomplete (heap-limit shaped), mismatch and window-straddling records,
      the digest rejection, and the scenario filter.
- [ ] Regenerate the cumulative fixture and record the cold component-style
      sample as the pre-change baseline in the fixture README, whatever its
      outcome.
- [ ] Update the fixture README and timing contract text to delivered status;
      run the suite and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 3: Bounded Memory

Summary: stop retaining committed-mode outputs in the worker and bound the
stylesheet-file parse cache, without changing any result.

- [ ] In `src/server/demand/background_worker.ts`, keep `compilation.outputs`
      only when `generatedOutput` is `derived`, through a small pure helper
      with unit tests for both modes; committed classification keeps reading
      committed files.
- [ ] Add a byte-bounded LRU in `src/review/css/` implementing the contract's
      estimate, with flat key copies; replace the unbounded map in
      `CssResourceAnalysis`, keeping the injected-parser path.
- [ ] Unit-test the LRU: byte accounting, eviction order, hits refreshing
      recency, an entry larger than the bound, and flat keys.
- [ ] Add a differential test: component-aware classification results are
      identical with a zero-byte bound and with the default bound.
- [ ] Record, without requiring completion, a cold cumulative component-style
      sample with its outcome and `heapPeakMiB`.
- [ ] Update `src/review/README.md`, `src/server/README.md` and the
      contracts' Delivery Status for delivered parts; run the suite and
      `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 4: Rule Segment Parse Reuse

Summary: parse each distinct top-level rule once per classification and
compute each distinct rule's derived data once, with results identical to
whole-element parsing.

- [ ] Add a segment scanner module under `src/review/css/` implementing the
      Design Summary's semantics over normalized text with code-unit
      comparisons, returning ordered segment ranges or an anomaly.
- [ ] Add batched segment parsing to the Lightning CSS parser: parse an
      element's missing segments joined by newlines in one call, attribute the
      output rules to segments by top-level rule start, and verify exactly one
      top-level rule per segment starting at its start.
- [ ] Add the rule-segment cache (byte-bounded LRU, 64 MiB) whose entries hold
      segment-local rules and their derived data; assemble element rule lists
      in `parseInlineRuleList` with rebased ordinals; implement every fallback
      condition.
- [ ] Compute derived data once per parsed rule, for inline and stylesheet-file
      parses alike: address key with block form, identity key, rank,
      canonical text and reference flag. Make `diffCssRules`,
      `diffCssRuleLists`, `cssRuleIdentity` and `renderInlineRules` use it.
- [ ] Emit the `review.inline-style-analysis` counts record after the
      component-aware loop.
- [ ] Add scanner unit tests: comments, strings containing braces and quotes,
      escapes, unquoted `url(` containing braces, nested blocks and at-rules,
      CDO and CDC, and each anomaly.
- [ ] Add a differential test: segment assembly equals whole-element parsing,
      including ordinals and failures, over every CSS input in the existing
      `review_css_*` tests, React Native Web sheets from the small large
      fixture, Emotion-style per-component elements, and seeded random edits
      (insert, delete and reorder rules; inject comments, strings and
      escapes).
- [ ] Add tests that a sequence of cumulative sheets parses each distinct
      segment once through an injected counting parser, that each fallback
      condition falls back, and that `@layer a;` against `@layer a{}` is a
      diffed, unresolved change on both paths.
- [ ] Run the existing inline, CSS, fast-path and Changes suites unchanged,
      then the full suite and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 5: Changed-Segment Analysis

Summary: make per-view analysis cost follow the changed segments, pair
unchanged reference-bearing rules only with matched copies, and compose
fragments from stored rule text.

- [ ] Cancel identical segment texts between sides as a multiset before the
      rule diff; diff only the remaining segments' rules with element-level
      ordinals.
- [ ] Find unchanged reference-bearing rules from the stored flag and pair each
      only with a cancelled segment's copy or an exact rule match.
- [ ] Compose each side's actual and projected fragments from stored per-rule
      text for all segments, omitting only analyzed occurrences selected as
      excluded or owned, without allocating per-rule objects for cancelled
      segments.
- [ ] Add a differential test: for before and after element pairs covering
      cumulative sequences, duplicates, formatting-only edits, reference
      rules, custom properties, nested and conditional rules and element
      splits, attributions, owned sets, retained selectors, the all-excluded
      flag and both materials equal the Milestone 4 engine's, except the
      duplicate-copy case tested below.
- [ ] Add a test for the duplicate-copy case (a rule with a custom property and
      a reference present once before and twice after): the added copy stays
      `unresolved`, the view is `changed` with a `material` reason, and no
      rule object carries two attributions.
- [ ] Update `src/review/README.md` and the contracts' Delivery Status for
      delivered parts; run the suite and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 6: Scale Acceptance And Final Alignment

Summary: prove the full-size cumulative catalogue classifies within the worker
heap and record what now dominates, then leave every document aligned.

- [ ] Regenerate the default and cumulative fixtures and run the full
      committed matrix on both, plus the derived cold component-style sample on
      the cumulative fixture.
- [ ] Acceptance: every cumulative sample completes with the expected Changes
      membership and a `heapPeakMiB` below 1,024. If a sample does not, record
      it, add a new milestone for the dominant retainer or cost, and leave this
      TODO open.
- [ ] Record per sample the classification time, inline union share,
      `heapPeakMiB` and segment counts, compare them with the Milestone 2
      baseline, and name the new dominant costs in the fixture README.
- [ ] Re-read every document this plan touched against the implementation,
      fix drift, and remove the approved-target sentences naming this plan.
- [ ] Run the full suite, `npm run package:smoke`, and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Consider a follow-up plan for the costs this plan measures but does not
  address: parse5 tree reuse and the complete-path cost of large documents.
- Smoke the published package against a React Native Web catalogue whose
  renderer collects `getStyleElement()` output.
