# Scalable Inline Style Analysis

Make inferred inline style ownership work, and work fast, on a full-size React
Native Web catalogue. Mokly must stop retaining memory it does not need, bound
the memory it caches, parse each distinct CSS rule once, parse each page file
once, and settle pages whose only difference is page style text without the
full comparison. The target is that the React Native Web scale fixture
classifies within twice the normal fixture's baseline time, and that one
component style change costs at most 25% more than no change. The ownership
contract, Changes membership, evidence and presentation stay as delivered,
apart from the documented cases in Decisions 4, 5 and 10.

## Base And Prerequisites

This plan builds on the
[inferred inline style ownership plan](./inferred-inline-style-ownership.md),
which is implemented but not yet merged, on branch `calummoore/irvine-v6` at
`6a2ff27e`. Before Milestone 1 starts, `origin/main` at `b4314fec` (pull
request #123, which replaces collections with navigation paths, derives
routes from entry ids, keeps Changes to recorded evidence and moves the
manifest to schema v7) is merged into this branch, so the contracts and code
this plan changes are current. That plan's Milestone 8 scale diagnosis is the
evidence for this plan, and its review findings stay recorded there. This plan
resolves these of them: Milestone 3 finding 1 (Decision 4), Milestone 4
finding 1 and Milestone 5 finding 3 (Decision 9), Milestone 5 finding 2
(Decision 5), and Milestone 8 findings 1, 2 and 4 (Decisions 7 and 8 and
Milestone 2).

The analysis this plan changes lives under `src/review/css/` and is specified
by [inline style ownership](../docs/protocol/mokly-inline-styles.md) and
[CSS change attribution](../docs/protocol/mokly-css-attribution.md). The
comparison decisions are specified by
[component change attribution](../docs/protocol/mokly-component-changes.md),
the background worker by [on-demand work](../docs/protocol/mokly-on-demand.md),
and the scale fixture by [its README](../tests/fixtures/large/README.md) and
[timings](../docs/protocol/mokly-timings.md).

## Problem

### Memory And CSS Parsing

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

### Page Work

Without the memory and CSS costs, the remaining cost follows page size and the
number of full comparisons. With no change, the normal fixture (189 MB of page
files) classifies in about 28 seconds and the cumulative fixture (855 MB, 4.5
times larger) in about 130 seconds, 4.6 times longer.

5. The quick check settles a view only when its text is identical. A component
   style change alters the cumulative sheet in every page file, so 5,520 of the
   5,550 views take the full comparison, although only the screens of one of
   the 30 product areas use that component.
6. No step shares a parsed page. The full comparison parses each page file 12
   times when page styles changed and 8 times otherwise: component boundaries
   in the original and the normalized page, style element discovery, the
   selector matching tree, and resource discovery in both comparison
   materials. A changed linked stylesheet adds 4 more parses. The quick check
   parses each page file up to 4 times.
7. Comparison materials keep the page's style text. The canonical rule list
   appended to them is as large as the sheet, so every normalization,
   comparison and hash in the full comparison runs over it.

### Evidence

The committed `--inline-styles` fixture template also differs from the one
that was measured, and its per-view class names depend on render order, so the
recorded numbers cannot be reproduced and cross-area edits look like false
component changes. The benchmark cannot record a worker killed by the heap
limit, and it no longer exercises linked-stylesheet analysis. These must be
fixed before this plan can prove its result.

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
   its references. The rule diff groups by the address key and the canonical
   renderer sorts by rank and identity, so both share one definition. The
   block form joins the address, so `@layer a;` against `@layer a{}` becomes a
   diffed, unresolved change on both the linked and the inline path. This
   resolves Milestone 3 finding 1 of the prerequisite plan.
5. **Analysis work follows the changed segments.** Before the rule diff,
   identical segment texts cancel between the two sides as a multiset,
   earliest occurrences first, because equal text parses to equal rules. Only
   the remaining segments' rules enter the rule diff. Unchanged
   reference-bearing rules are found from the stored references, and each is
   paired only with a copy that actually matched: a cancelled segment or an
   exact rule match. This resolves Milestone 5 finding 2 of the prerequisite
   plan, where one rule object could receive two attributions. Each side's
   canonical rule list is composed from the stored per-rule text of every
   segment, omitting only the analyzed occurrences selected as excluded or
   owned.
6. **Results do not change otherwise.** Attributions, owned sets, retained
   selectors, the all-excluded flag, material equality, Changes membership,
   evidence and presentation equal the delivered engine's for every input,
   except the cases documented in Decisions 4, 5 and 10. Differential tests
   enforce this for every decision below.
7. **The scale fixture is value-stable and self-identifying.** Per-view atomic
   rules derive from a hash of the view key, not render order. The fixture
   record and every benchmark report carry a digest of the fixture templates,
   and the benchmark rejects a fixture generated from different templates.
8. **Scale evidence records every outcome.** The benchmark records ok, error,
   incomplete (the worker stopped without ending classification) and
   membership-mismatch samples with the timing data available. The classifying
   worker reports its peak V8 heap use, where document work goes, and the
   inline analysis's segment reuse.
9. **Each page file side is parsed once.** A page analysis parses one side's
   original text once, with source locations. It supplies the validated
   component ranges, the unowned style elements, the paired ignored regions,
   the element tree for selector matching, and every resource reference with
   the source span of the attribute or text that holds it. The quick check,
   the full comparison, the style-only route and linked-stylesheet matching
   read it; no other step parses the page. A comparison material's references
   are derived from it: a reference drops out with a replaced, removed or
   ignored span that contains its source span, caller-slot copies keep the
   references of the content they copy, and inserted text contributes its
   own. The full comparison therefore parses each side at most once. When the
   two texts are identical, the quick check parses only the head side and
   skips projection and normalization. The fast path no longer runs inline
   analysis, which resolves Milestone 4 finding 1 and Milestone 5 finding 3 of
   the prerequisite plan. Referenced HTML resources are still parsed as today.
10. **Selector matching uses the original page.** Inline and linked-stylesheet
    matching evaluate selectors against each side's original tree from its
    page analysis. An element that starts inside a paired ignored region is
    never a matching subject, but it stays in the tree as context for
    combinators, `:has()` and structural pseudo-classes such as `:nth-child`
    and `:empty`. Owners are resolved against the original ranges. This
    replaces matching on the ignore-normalized page, where removing an ignored
    region changed the context of the elements around it, and it removes the
    normalized parses. Results change only where that context differs; the new
    result follows the real page, so a rule whose subject is outside an
    ignored region is no longer falsely excluded.
11. **Comparison materials carry fingerprints instead of style text.** When
    the inline analysis runs, the canonical rule list appended to a material
    becomes one comment holding the SHA-256 digest of its canonical rendering.
    When the analysis is skipped because the outer sources are identical and
    reference-free, each unowned style element is replaced in place by a
    comment holding the digest of its outer source, so its position still
    counts. The references of fingerprinted rules come from their stored
    references. Material equality and every result are unchanged, but
    materials no longer grow with the page's style sheet.
12. **Style-only differences skip the full comparison.** When a paired view's
    texts differ only inside the text of one unowned style element, Mokly
    decides the view from that element's rule diff and the head page analysis,
    without projection, materials or the implementation check. The route
    applies only when every condition in the Design Summary holds; otherwise
    the full comparison runs. It produces exactly the full comparison's
    result, including evidence.
13. **Performance targets.** Classification time is the background worker's
    `changes.classify` duration, measured by the large benchmark in committed
    mode for every scenario, cold and warm. The reference is the mean of two
    Milestone 2 runs of the default fixture, per scenario and state. At
    acceptance, using the mean of two complete runs of each fixture:
    - the cumulative fixture classifies each scenario within twice the
      reference for the same scenario and state;
    - on each fixture, the component-style scenario takes at most 1.25 times
      the no-change scenario in the same state;
    - no default-fixture scenario takes more than 1.05 times its reference;
    - every sample completes with the expected Changes membership and a
      `heapPeakMiB` below 1,024, including one derived-mode cold
      component-style sample on the cumulative fixture.

## Non-Goals

- A selector index; matching is under 0.1% of the analysis time.
- Any change to the inline style ownership contract's scope, attribution
  rules, evidence schema, Changes membership or shell presentation beyond
  Decisions 4, 5 and 10.
- The five-second navigation target, which `origin/main` also missed cold in a
  paired run, and the background build that renders every page before
  classification (about 90 seconds on the cumulative fixture).
- Moving prefetched document buffers or derived-mode outputs out of memory.

## Design Summary

### Contracts

Three new protocol documents own the new rules, because the inline style
contract already exceeds the protocol length guideline:

- `docs/protocol/mokly-css-parse-reuse.md` owns segmentation, verification and
  fallback, both caches and their byte estimate, per-rule derived data,
  changed-segment analysis and its equivalence guarantee.
- `docs/protocol/mokly-page-analysis.md` owns the page analysis, derived
  material references, original-page matching, the identical-text quick
  check and fingerprinted materials.
- `docs/protocol/mokly-style-only-route.md` owns the route's conditions,
  results, fallback and equivalence guarantee.

The inline style, CSS attribution, component change, on-demand and timing
contracts reference them.

### Caches And Segments

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

### Page Analysis

A page analysis is created on first use for one view side and discarded with
its view. It parses the side's original text, in its own marker dialect, once
with source locations. Paired ignore ids come from the pair: a marker scan of
both texts with the existing one-sided material rule. An element is ignored
when its start offset lies inside a paired region. A reference record holds
the raw value, its kind and the source span of its attribute or text node.

A comparison material is a sequence of kept original spans, replacement texts
and appended copies of original spans. Its references are the records inside
kept or copied spans, minus those inside paired ignored regions, plus the
references of replacement and appended text. Fingerprint comments carry none;
fingerprinted rules contribute their stored references. The contract makes
this derived set normative. It equals the set found by parsing the material
whenever replaced and ignored spans contain whole nodes, which a differential
test checks over every fixture.

After dialect normalization of the base, when the two texts are identical and
the usage topology is equal, the quick check reads only the head analysis. Its
references serve the resource check on both sides, the usage signals give the
reasons, the state is `unchanged` and there are no ignored ids. Every other
quick check keeps its current decision, reading the page analyses.

### Fingerprints

A rule fingerprint is `<!--mokly-inline-rules:<digest>-->` and an in-place
style element fingerprint is `<!--mokly-inline-style:<digest>-->`, where the
digest is the base64url SHA-256 of the canonical rendering or of the element's
outer source. Neither form uses a review marker prefix.

### Style-Only Route

The route runs after a failed quick check. Every condition must hold:

1. The view is paired, both sides use the same path, both have usage records,
   and the usage topology is equal.
2. The base contains no retired marker prefix, and the common prefix and
   common suffix of the two texts leave one changed window per side.
3. The head analysis has an unowned eligible style element whose content
   contains the head window.
4. Neither window contains `<`, and neither do the eight code units before the
   windows. The HTML tokenizer's state then enters both windows as plain style
   text, stays there, and leaves both identically, so the base window lies in
   the same element and the suffix parses identically on both sides.
5. Both element texts parse, and no added, removed or changed rule of the
   element carries a reference or has resolved selectors that use `:empty`,
   `:contains` or `:icontains`. References are judged by stored per-rule
   references, because a reference can straddle a window boundary.
6. The quick check's resource test passes on the head analysis's references,
   collected through each side's reader: no Git changed path in committed mode
   and no byte change in derived mode.

The markup is then identical on both sides, and so are the element's
references, so the diffed rules are attributed once, on the head tree, for
both sides. The view receives the full comparison's
state, `material` flag, reasons including the usage signals, owned set and
`inlineStyles` evidence, with no ignored ids and no owned resources. A
test-only switch beside `useFastPath` disables the route.

### Diagnostics

The `review.compare-screens` counts record gains `heapPeakMiB` and
`stylePath`; `fastPath + completePath + stylePath` equals `views`. One
`review.inline-style-analysis` counts record after the component-aware loop
carries `elements`, `segments`, `segmentHits`, `segmentParses` and
`fallbacks`. One `review.document-work` counts record carries `htmlParses`,
`htmlParseBytes`, `htmlParseMs`, `rangeMs`, `styleDiscoveryMs`,
`referenceMs`, `matchingMs`, `normalizationMs`, `projectionMs`,
`implementationMs`, `inlineRuleMs` and `hashMs`. All of them are collected only
when timings are enabled.

## Milestone 1: Protocol And Documentation Contract

Summary: define the complete contract for bounded memory, parse reuse, the
page analysis, original-page matching, fingerprinted materials, the style-only
route, diagnostics, fixture identity, benchmark outcomes and the performance
targets before any code changes. Documentation-only; validated with Prettier
and a diff review.

- [x] Register this plan in [`plans/README.md`](./README.md).
- [ ] Create `docs/protocol/mokly-css-parse-reuse.md` from Decisions 2 to 6
      and the Caches And Segments summary: segmentation semantics and
      anomalies, batched parsing and per-segment verification, fallback
      conditions, the equivalence guarantee, both caches with the byte
      estimate and flat keys, per-rule derived data, changed-segment
      cancellation, reference pairing and rule-list composition.
- [ ] Create `docs/protocol/mokly-page-analysis.md` from Decisions 9 to 11 and
      the Page Analysis and Fingerprints summaries: analysis contents and
      coordinates, paired ignore ids, reference records, derived material
      references, original-page matching with the ignore rule, the
      identical-text quick check, and both fingerprint forms.
- [ ] Create `docs/protocol/mokly-style-only-route.md` from Decision 12 and the
      Style-Only Route summary: every condition, the results, the fallback to
      the full comparison, the equivalence guarantee and the `stylePath`
      count.
- [ ] Register the three documents in the
      [protocol index](../docs/protocol/README.md), each with a Delivery Status
      naming this plan as the approved target.
- [ ] In [`mokly-inline-styles.md`](../docs/protocol/mokly-inline-styles.md),
      state that the fast path runs no inline analysis and that style-only
      differences take the route; make the Rules step reference parse reuse
      and matched-copy reference pairing; make matching and owners use the
      original page; replace the appended rule text with fingerprints; state
      that the route emits the full comparison's evidence; and add the
      approved-target sentence for this plan to its Delivery Status.
- [ ] In [`mokly-css-attribution.md`](../docs/protocol/mokly-css-attribution.md),
      replace the parser-cache paragraph with the bounded stylesheet-file
      cache, add the statement-or-block form to the rule address and identity
      with the `@layer a;` against `@layer a{}` case, and make
      linked-stylesheet matching use the original page with the ignore rule.
- [ ] In [`mokly-component-changes.md`](../docs/protocol/mokly-component-changes.md),
      describe the identical-text quick check, place the style-only route
      between the quick check and the full comparison, reference the page
      analysis, and add the approved-target sentence.
- [ ] In [`mokly-on-demand.md`](../docs/protocol/mokly-on-demand.md), state
      that the background worker retains compilation outputs only in derived
      mode.
- [ ] In [`mokly-timings.md`](../docs/protocol/mokly-timings.md), add the
      Diagnostics summary's counts records and the four benchmark sample
      outcomes.
- [ ] In [`tests/fixtures/large/README.md`](../tests/fixtures/large/README.md),
      describe value-stable per-view rules, the template digest and its
      rejection rule, the `--scenario` filter, the `linked-stylesheet`
      scenario, setup-state restoration, sample outcomes, peak heap, document
      work and the Decision 13 targets, each marked as the approved target of
      this plan.
- [ ] Validate the changed Markdown with `npx prettier --check` and review the
      diff; documentation-only work does not require `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 2: Deterministic Scale Fixture And Complete Benchmark Evidence

Summary: make the cumulative fixture reproducible, make the benchmark record
every outcome and where document work goes, restore linked-stylesheet
coverage, and measure the baseline that the performance targets use.

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
- [ ] Add a `linked-stylesheet` scenario that keeps setup's unused
      `shared-1.css` rule, expects zero Changes and reports the clipped
      `review.css-analysis` share; restore `renderer.tsx` and `shared-1.css`
      to their setup state after the matrix.
- [ ] Sample the classifying isolate's used V8 heap after each compared view
      and emit the maximum as `heapPeakMiB` in the `review.compare-screens`
      counts record.
- [ ] Emit the `review.document-work` counts record, collected only when
      timings are enabled, and add an HTML parse counter at every current
      parse site.
- [ ] Record `heapPeakMiB` and the document-work counts per benchmark sample.
- [ ] Extend `tests/large_baseline_benchmark.test.ts` with ok, error,
      incomplete (heap-limit shaped), mismatch and window-straddling records,
      the digest rejection, the scenario filter and state restoration.
- [ ] Regenerate both fixtures. Run the default fixture's full committed
      matrix twice and record the per-scenario, per-state mean as the
      Decision 13 reference. Run the cumulative matrix once and record every
      sample, whatever its outcome, as the baseline.
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
      Caches And Segments semantics over normalized text with code-unit
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
      canonical text and references. Make `diffCssRules`,
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
unchanged reference-bearing rules only with matched copies, and compose rule
lists from stored rule text.

- [ ] Cancel identical segment texts between sides as a multiset before the
      rule diff; diff only the remaining segments' rules with element-level
      ordinals.
- [ ] Find unchanged reference-bearing rules from the stored references and
      pair each only with a cancelled segment's copy or an exact rule match.
- [ ] Compose each side's actual and projected rule lists from stored per-rule
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
- [ ] Record the no-change and component-style samples of both fixtures.
- [ ] Update `src/review/README.md` and the contracts' Delivery Status for
      delivered parts; run the suite and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 6: Cost Breakdown Checkpoint

Summary: measure where classification time goes once the memory and CSS costs
are gone, and confirm that the page-work milestones target the largest
measured costs. Documentation-only; validated with Prettier and a diff review.

- [ ] Run the full committed matrix once on each fixture with document-work
      counts, and capture one CPU profile of the background worker's
      classification for the no-change and component-style scenarios on the
      cumulative fixture.
- [ ] Record per scenario the classification time, `heapPeakMiB`, HTML parses
      and per-step times, and the profiles' top self-time functions, in the
      fixture README beside the Milestone 2 baseline.
- [ ] Confirm that Milestones 7 to 9 address the largest measured costs, in
      that order. If the data shows otherwise, reorder or amend those
      not-started milestones and record why in this milestone.
- [ ] Validate the changed Markdown with `npx prettier --check` and review the
      diff.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 7: Shared Page Analysis

Summary: parse each page file side once and share the result across the quick
check, the full comparison and linked-stylesheet matching; match selectors on
the original page; give identical texts a single-parse quick check.

- [ ] Add a page analysis module under `src/review/` that parses one side on
      first use with source locations and exposes validated ranges, unowned
      style spans, paired ignored regions, the element tree with its ignore
      rule, and reference records with source spans. Let
      `validateComponentRanges`, `findUnownedInlineStyles` and HTML reference
      extraction accept a parsed document, keeping their string entry points
      for other callers.
- [ ] Derive comparison-material references from the page analysis and use
      them for resource discovery. Add a differential test that the derived
      set equals the set found by parsing the material for every view of the
      design catalogue, the small large fixtures and the inline test
      catalogues.
- [ ] Match inline and linked-stylesheet selectors on the original trees with
      the ignore rule, resolve owners on the original ranges, and remove the
      normalized parses. Add tests for a sibling combinator and `:nth-child`
      next to an ignored region on both paths; every other existing CSS and
      inline test stays unchanged.
- [ ] Add the identical-text quick check and remove inline analysis from the
      fast path. Test in committed and derived modes that a zero-change
      classification emits no `review.inline-style-analysis` span and parses
      each view once.
- [ ] Assert with document-work counts that a full comparison parses each side
      at most once.
- [ ] Run the fast-path, comparison-mode and Changes equivalence suites
      unchanged.
- [ ] Record the no-change and component-style samples of both fixtures.
- [ ] Update `src/review/README.md` and the contracts' Delivery Status for
      delivered parts; run the suite and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 8: Style-Only Route

Summary: settle views whose only difference is inside one unowned style
element from the rule diff and the head page analysis, with results identical
to the full comparison.

- [ ] Implement the route between the quick check and the full comparison
      with every Style-Only Route condition, and the test-only switch that
      disables it.
- [ ] Count routed views as `stylePath` in the `review.compare-screens` counts
      record.
- [ ] Add a differential test (route enabled against disabled, identical
      results) over excluded, owned, entry and unresolved diffed rules; an
      entry-owned input change; historical-dialect bases; committed and
      derived modes; and each fallback: a markup change, a start-tag
      attribute change, two changed style elements, a `<` or a reference in
      or beside the window, a changed reachable resource, a text-dependent
      pseudo-class, a parse failure and unequal topology.
- [ ] Test that every view in the small cumulative fixture's component-style
      scenario whose markup is unchanged takes the route.
- [ ] Record the no-change and component-style samples of both fixtures.
- [ ] Update `src/review/README.md` and the contracts' Delivery Status for
      delivered parts; run the suite and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 9: Fingerprinted Comparison Materials

Summary: keep page style text out of comparison materials so the full
comparison's text work no longer grows with the style sheet.

- [ ] Replace the appended canonical rule text with the rule fingerprint, and
      style elements of skipped analyses with in-place fingerprints; take the
      references of fingerprinted rules from their stored references.
- [ ] Add a differential test: state, `material`, reasons, resource evidence
      and owned sets equal those of text materials for every inline, CSS and
      Changes test catalogue, and a moved identical style element still
      changes the material.
- [ ] Record the no-change and component-style samples of both fixtures.
- [ ] Update `src/review/README.md` and the contracts' Delivery Status for
      delivered parts; run the suite and `cargo xtask check`.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 10: Performance Acceptance And Final Alignment

Summary: prove the Decision 13 targets on both fixtures, record what now
dominates, and leave every document aligned.

- [ ] Regenerate both fixtures. Run the full committed matrix twice on each,
      and the derived-mode cold component-style sample on the cumulative
      fixture.
- [ ] Acceptance: every Decision 13 condition holds. If one does not, record
      it, add a new milestone before this one for the dominant measured cost,
      and leave this TODO open.
- [ ] Record the final samples against the Milestone 2 baseline, and name the
      new dominant costs, in the fixture README.
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

- Smoke the published package against a React Native Web catalogue whose
  renderer collects `getStyleElement()` output.
