# Scalable Inline Style Analysis

Make inferred inline style ownership work, and work fast, on a full-size React
Native Web catalogue. Mokly must stop retaining memory it does not need, bound
the memory it caches, reuse repeated CSS parses, share each view-side page
parse, and settle pages whose only difference is page style text without the
full comparison. The target is that the React Native Web scale fixture
classifies within twice the normal fixture's baseline time, and that one
component style change costs at most 25% more than no change. The ownership
contract, Changes membership, evidence and presentation stay as delivered,
apart from the documented cases in Decisions 4, 5, 9 and 10. The contracts
linked below own the precise algorithms and exceptions, not this overview.

## Base And Prerequisites

This plan builds on the
[inferred inline style ownership plan](./inferred-inline-style-ownership.md),
which is implemented but not yet merged, on branch `calummoore/irvine-v6` at
`6a2ff27e`. Task 0 merged `origin/main` at `b4314fec` (pull
request #123, which replaces collections with navigation paths, derives
routes from entry ids, keeps Changes to recorded evidence and moves the
manifest to schema v7) in merge commit `7fd34132`, before Milestone 1;
verification fixes followed in `31ffae9b` and `b3cec159`. The contracts and code
this plan changes now use main's identity and navigation model. That plan's Milestone 8 scale diagnosis is the
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
and the scale fixture by [its README](../tests/fixtures/large/README.md),
[benchmark contract](../tests/fixtures/large/benchmark-contract.md) and
[timings](../docs/protocol/mokly-timings.md).

## Problem

These measurements are historical evidence from the prerequisite plan before
the main merge, not performance references for this plan. The current default
fixture has **1,590 entries and 5,550 documents**; Milestone 2 regenerates it
and records the template-identified reference used for acceptance.

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
   [On-demand work](../docs/protocol/mokly-on-demand.md) owns the transfer and
   release rule; committed-mode classification continues reading files.
2. **Parse caches are byte-bounded LRUs.**
   [Cache lifetime and accounting](../docs/protocol/mokly-css-parse-reuse.md#cache-lifetime-and-accounting)
   owns both independent bounds, estimates, flat copies, recency and oversize
   behavior. Eviction changes time only.
3. **Inline elements reuse verified top-level segments.**
   [Scanner](../docs/protocol/mokly-css-parse-reuse.md#segment-scanner) and
   [batch verification](../docs/protocol/mokly-css-parse-reuse.md#batched-parsing-and-verification)
   own exact keys, native-root attribution, flattened runs and whole-element
   fallbacks. Assembly equals whole parsing, including form, ordinals and failures.
4. **Rule data has one definition.**
   [Stored rule data](../docs/protocol/mokly-css-parse-reuse.md#stored-rule-data)
   owns the address, identity, rank, canonical text, references and custom flag.
   Its block-form correction on both CSS paths resolves prerequisite
   Milestone 3 finding 1.
5. **Analysis work follows changed segments and actual matched copies.**
   [Cancellation](../docs/protocol/mokly-css-parse-reuse.md#changed-segment-cancellation)
   and [composition](../docs/protocol/mokly-css-parse-reuse.md#unchanged-references-and-composition)
   own residual diffing, unchanged-reference pairing and selected-occurrence
   omission. Cached identity-run cancellation retains full-diff pairing for
   flat sheets, including formatting duplicates; only differently shaped
   grouped/nested runs can displace shared identities. The contract owns the
   proof, equality criterion and explicit differential outcomes. That narrow
   displacement and correcting double attribution are approved differences.
   Matched-copy pairing resolves prerequisite Milestone 5 finding 2.
6. **Results do not change otherwise.** Differential tests compare full
   attributions, owners, selectors, all-excluded status, material equality,
   membership and evidence. Only the block-form correction (Decision 4),
   matched-copy/displacement cases (5), provenance/parser-context and flat
   ignore-eligibility cases (9), and original-context matching (10) may differ
   from the delivered engine.
   These exceptions require exact expected results, not blanket exemptions.
7. **The scale fixture is value-stable and self-identifying.**
   [Template identity and stable values](../tests/fixtures/large/benchmark-contract.md#template-identity-and-stable-values)
   owns digest framing, records, mismatch rejection and value derivation.
8. **Scale evidence records every outcome.**
   [Timing counts](../docs/protocol/mokly-timings.md#component-analysis-counts)
   and [sample outcomes](../docs/protocol/mokly-timings.md#benchmark-sample-outcomes)
   own fields, units, rounding, worker/infrastructure errors and partial bounds.
   [Scenario state](../tests/fixtures/large/benchmark-contract.md#scenario-matrix-and-restoration)
   owns filtering and restoration.
9. **Each page file side is parsed once.**
   [Page analysis](../docs/protocol/mokly-page-analysis.md#scope-and-lifetime)
   owns original coordinates, contents and sharing; its
   [derived references](../docs/protocol/mokly-page-analysis.md#derived-material-references)
   are normative. Whole-node edits alone do not guarantee the old reparsed
   material's extraction visibility; the contract settles partial spans and
   parser-context/copy cases explicitly. The same flat ignore spans govern
   style eligibility, including raw-text markers; the contract's explicit
   case replaces delivered DOM-comment discovery. Its
   [identical-text check](../docs/protocol/mokly-page-analysis.md#identical-text-quick-check)
   removes all fast-path inline work, resolving prerequisite Milestone 4
   finding 1 and Milestone 5 finding 3. Referenced HTML parsing stays separate.
10. **Selector matching uses original-page context.**
    [Original-page matching](../docs/protocol/mokly-page-analysis.md#original-page-matching)
    owns the subject-only ignore predicate, structural context, owner ranges
    and the intentional difference from ignore-normalized matching.
11. **Guarded fingerprints preserve string materials.**
    [Fingerprinted materials](../docs/protocol/mokly-page-analysis.md#fingerprinted-materials)
    owns the reserved-prefix guard, plain-string fallback, both forms, digest
    encoding, placement, stored references and the equality guarantee,
    including a moved identical element. No material consumer changes format.
12. **Style-only differences skip full comparison when proven safe.**
    [The route](../docs/protocol/mokly-style-only-route.md) owns ordering,
    every eligibility condition (including ignore/material-span safety),
    results, fallbacks, its test switch and per-view proof. It equals the full
    comparison under the same new policies, not a second attribution policy.
13. **Performance acceptance is a reproducible procedure.**
    [Classification performance acceptance](../tests/fixtures/large/benchmark-contract.md#classification-performance-acceptance)
    is the sole normative definition of samples, means, ratios, heap/membership
    requirements and pass/fail treatment. Historical Problem measurements are
    never substituted for the Milestone 2 reference.

## Non-Goals

- A selector index; matching is under 0.1% of the analysis time.
- Any change to the inline style ownership contract's scope, attribution
  rules, evidence schema, Changes membership or shell presentation beyond
  Decisions 4, 5, 9 and 10.
- The five-second navigation target, which `origin/main` also missed cold in a
  paired run, and the background build that renders every page before
  classification (about 90 seconds on the cumulative fixture).
- Moving prefetched document buffers or derived-mode outputs out of memory.

## Design Summary

### Contracts

Three focused protocol documents own the new analysis rules:

- `docs/protocol/mokly-css-parse-reuse.md` owns segmentation, verification and
  fallback, both caches and their byte estimate, per-rule derived data,
  changed-segment analysis and its equivalence guarantee.
- `docs/protocol/mokly-page-analysis.md` owns the page analysis, derived
  material references, original-page matching, the identical-text quick
  check and fingerprinted materials.
- `docs/protocol/mokly-style-only-route.md` owns the route's conditions,
  results, fallback and equivalence guarantee.

The merged inline ownership, resource and evidence contracts reference these
owners. The unchanged decision lives in
[`mokly-component-review-fast-path.md`](../docs/protocol/mokly-component-review-fast-path.md),
usage shapes in [`mokly-component-usage-records.md`](../docs/protocol/mokly-component-usage-records.md),
and shell presentation in
[`mokly-css-evidence-presentation.md`](../docs/protocol/mokly-css-evidence-presentation.md).
Usage/evidence wire shapes and presentation do not change. Page analysis,
fingerprints and the route apply only to component-aware classification;
the [scope contract](../docs/protocol/mokly-page-analysis.md#scope-and-lifetime)
defines the shared loop's either-manifest flag. Component-free catalogues and
the separate page path keep their existing classifier/matching/cache policy.

### Caches And Segments

Use the [parse-reuse contract](../docs/protocol/mokly-css-parse-reuse.md).
Verification concerns native top-level roots; one root may flatten to several
records. Parsing equivalence and changed-pairing equivalence are distinct:
the latter is exact for flat identity runs and has only the Decision 5
grouped/nested displacement exception. Both future differential suites follow
the contract's explicit equality domains.

### Page Analysis

Use the [page-analysis contract](../docs/protocol/mokly-page-analysis.md).
It owns lifetime, original coordinates, marker pairing, reference provenance,
copy visibility and original-tree matching. The unchanged decision first
tries its single-analysis identical-text check; all successful quick checks
avoid inline analysis. Committed mode keeps head-only resource traversal;
derived mode traverses both readers independently and compares membership/bytes.
The plan does not introduce another marker dialect or normalized page tree.

### Fingerprints

Use [fingerprinted materials](../docs/protocol/mokly-page-analysis.md#fingerprinted-materials)
for the reserved-prefix guard, string-material compatibility and both forms'
references/equality proof; preserve occurrence position when analysis is skipped.

### Style-Only Route

Use the [style-only contract](../docs/protocol/mokly-style-only-route.md).
Its tokenizer and whole-rule-reference proofs justify bypassing projection,
page materials and implementation work. Failed proofs reuse preparation on
full fall-through. The disabled route is the differential oracle.

### Diagnostics

Use [timing counts and outcomes](../docs/protocol/mokly-timings.md#component-analysis-counts)
for opt-in collection, units, isolate sampling and partial records. The
[benchmark contract](../tests/fixtures/large/benchmark-contract.md#scenario-matrix-and-restoration)
owns benchmark states, identity and the Decision 13 acceptance procedure.

## Milestone 1: Protocol And Documentation Contract

Summary: define the complete contract for bounded memory, parse reuse, the
page analysis, original-page matching, fingerprinted materials, the style-only
route, diagnostics, fixture identity, benchmark outcomes and the performance
targets before any code changes. Documentation-only; validated with Prettier
and a diff review.

- [x] Register this plan in [`plans/README.md`](./README.md).
- [x] Create `docs/protocol/mokly-css-parse-reuse.md` from Decisions 2 to 6
      and the Caches And Segments summary: segmentation semantics and
      anomalies, batched parsing and per-segment verification, fallback
      conditions, the equivalence guarantee, both caches with the byte
      estimate and flat keys, per-rule derived data, changed-segment
      cancellation, reference pairing and rule-list composition.
- [x] Create `docs/protocol/mokly-page-analysis.md` from Decisions 9 to 11 and
      the Page Analysis and Fingerprints summaries: analysis contents and
      coordinates, paired ignore ids, reference records, derived material
      references, original-page matching with the ignore rule, the
      identical-text quick check, and both fingerprint forms.
- [x] Create `docs/protocol/mokly-style-only-route.md` from Decision 12 and the
      Style-Only Route summary: every condition, the results, the fallback to
      the full comparison, the equivalence guarantee and the `stylePath`
      count.
- [x] Register the three documents in the
      [protocol index](../docs/protocol/README.md), each with a Delivery Status
      naming this plan as the approved target.
- [x] Discovered: main split inline ownership across
      [`mokly-inline-styles.md`](../docs/protocol/mokly-inline-styles.md),
      [`resources`](../docs/protocol/mokly-inline-style-resources.md) and
      [`evidence`](../docs/protocol/mokly-inline-style-evidence.md).
      Retarget the former combined-document TODO: ownership references parse
      reuse, original matching and fingerprints; resources references exact
      matched occurrences and derived seeds; evidence defines unchanged
      delivery from the route. Add approved-target schedules to each owner.
- [x] In [`mokly-css-attribution.md`](../docs/protocol/mokly-css-attribution.md),
      replace the parser-cache paragraph with the bounded stylesheet-file
      cache, add the statement-or-block form to the rule address and identity
      with the `@layer a;` against `@layer a{}` case, and make
      linked-stylesheet matching use the original page with the ignore rule.
- [x] Discovered: main moved the unchanged decision to
      [`mokly-component-review-fast-path.md`](../docs/protocol/mokly-component-review-fast-path.md).
      Retarget that part of the former component-changes TODO there: reference
      the identical-text check and its single analysis, remove inline work,
      and place the style-only attempt before full fall-through.
      [`Component changes`](../docs/protocol/mokly-component-changes.md) references
      page matching/material references and the decision owner. Add target
      schedules to both; do not duplicate the algorithm.
- [x] Discovered: confirm the merged
      [`usage`](../docs/protocol/mokly-component-usage-records.md) and
      [`presentation`](../docs/protocol/mokly-css-evidence-presentation.md)
      contracts remain authoritative and unchanged; no wire/presentation rule
      belongs back in the inline or comparison document.
- [x] In [`mokly-on-demand.md`](../docs/protocol/mokly-on-demand.md), state
      that the background worker retains compilation outputs only in derived
      mode.
- [x] In [`mokly-timings.md`](../docs/protocol/mokly-timings.md), add the
      Diagnostics summary's counts records and the four benchmark sample
      outcomes.
- [x] Discovered: keep fixture usage and measurements in
      [`tests/fixtures/large/README.md`](../tests/fixtures/large/README.md), and
      move the normative rules into its focused
      [`benchmark contract`](../tests/fixtures/large/benchmark-contract.md):
      describe value-stable per-view rules, the template digest and its
      rejection rule, the `--scenario` filter, the `linked-stylesheet`
      scenario, setup-state restoration, sample outcomes, peak heap, document
      work and the Decision 13 targets, each marked as the approved target of
      this plan.
- [x] Discovered: align Decisions and Design Summary with their sole contract
      owners, record duplicate-pair displacement and provenance visibility
      refinements, and require explicit expected cases in later differential
      TODOs. Add ignore/material-span safety to the route's tests.
- [x] Discovered: guard fingerprints with the reserved prefix on both original
      texts, retaining plain-string materials, equality and hashing. Require
      moved-style/authored-lookalike and verbatim-fallback differential proof
      in Milestone 9; do not introduce token-sequence consumers.
- [x] Discovered: style-only equivalence needs the full view-wide rule diff:
      unchanged other elements can fail parsing or displace duplicate pairs.
      Specify reuse of those runs and require both cases in Milestone 8 tests,
      rather than silently deciding from an isolated element diff.
- [x] Discovered: remove obsolete marker-dialect requirements throughout the
      plan, label pre-merge measurements historical, and use current fixture
      dimensions outside those measurements. Preserve existing protocol caps
      and history rules without source/test edits.
- [x] Discovered: apply Milestone 1 feedback to identity-run cancellation,
      flat/grouped pairing proofs, CDO-word anomalies, string-form imports and
      flat ignore eligibility, with explicit M4, M5 and M7 test obligations.
- [x] Discovered: preserve committed head-only resource traversal and its
      occurrence bound, guard every child-content pseudo including `:parent`,
      and keep all route test obligations in the route contract.
- [x] Discovered: define the ignored fixture-root identity record and four
      report identity fields, template-only mismatch and heap acceptance,
      and start-only delivery-ceiling observations without fabricated ends.
      Split the fixture README and retarget all owning links.
- [x] Validate the changed Markdown with `npx prettier --check` and review the
      diff; check every changed-file link/anchor and re-read all touched
      contracts against the plan. Documentation-only work does not require
      `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 1 review findings

Reported by the post-push review of commits `d9a04f33` and `1132e082`, after
the supervisor check's fixes. Finding 3 is addressed in Milestone 2 because
Milestone 2 implements the fixture identity; the others are recorded for the
user's decision.

1. Medium. The contracts scope page analysis and original-page matching to
   "component-aware classification", but the code splits by path, not by
   catalogue type: the shared per-view loop (`compareComponentView`,
   `ResourceComparison`) runs for every catalogue, while pages in component
   catalogues and every view of component-free catalogues also go through
   `classifyChangedContent`, which has its own parse cache and
   ignore-normalized matching. Milestone 7's "remove the normalized parses"
   would therefore either change component-free results or require an
   unplanned second path. Recommended: define component-aware as the shared
   loop when either manifest registers components, pass that flag through
   `ComponentViewContext` and `ResourceComparison`, state that component-free
   catalogues and the page path keep current matching (and how their parse
   cache relates), limit the Milestone 7 TODO accordingly, and add
   component-free and component-catalogue page regression tests.
2. Medium. Acceptance requires the Milestone 2 reference and the Milestone 10
   run to share one `templateDigest`, but nothing defines what to do if it
   changes (Milestone 10 merges `origin/main`, which has changed the fixture
   templates before), so acceptance could become impossible. Recommended: a
   re-reference procedure in the benchmark contract (rebuild the recorded
   reference commit with only the template change applied, rerun the two
   default matrices, record both digests), a Milestone 10 digest-comparison
   TODO right after the merge, and running Milestone 2's checks before
   recording the reference.
3. Low. The digest omitted `examples/basic/theme.ts`, which the generator
   copies into every fixture. Addressed in Milestone 2: the fixture owns its
   theme, a test proves generation reads nothing outside
   `tests/fixtures/large/`, and reports record rendering dependency versions.
4. Low. Milestone 4 records no benchmark samples, although the fixture README
   says Milestones 3 to 9 do and AGENTS.md requires smoke tests for new
   features. Recommended: add a Milestone 4 TODO to record the no-change and
   component-style samples of both fixtures and confirm the
   `review.inline-style-analysis` counts record appears in the benchmark
   JSON.

## Milestone 2: Deterministic Scale Fixture And Complete Benchmark Evidence

Summary: make the cumulative fixture reproducible, make the benchmark record
every outcome and where document work goes, restore linked-stylesheet
coverage, and measure the baseline that the performance targets use.

Code checkpoint: `46510f43` and `4f8872fa` passed initial verification. The
supervisor's feedback fixes are committed in `4b09b13e` after 62 targeted,
2,869 unit and 725 Chromium tests; committed-code format/lint/type checks pass.
Two default reference matrices and one cumulative baseline are recorded in
the [fixture README](../tests/fixtures/large/README.md#milestone-2-reference-and-cumulative-baseline)
from that exact clean commit. All 24 requested samples remain, including both
cumulative component heap failures and startup-budget failures; no retry or
discard. The final `cargo xtask check` passes: 11 Rust, 2,869 unit, 725 Chromium
and 219 hydration tests; no skips or cancellations. Check/push follows recording.

- [x] In `tests/fixtures/large/inline_styles.tsx`, derive each per-view rule's
      value from a stable hash of the view key instead of the global render
      counter, so class names depend only on style values.
- [x] Discovered: adding a screen necessarily adds unused rules to later
      cumulative sheets. Test that every other area's existing view values,
      class names and non-style markup remain byte-identical and its entries
      stay out of Changes, as the fixture contract specifies, rather than
      requiring impossible complete-document byte equality.
- [x] Record a digest of the fixture templates in the fixture record at setup
      under the [benchmark identity contract](../tests/fixtures/large/benchmark-contract.md#template-identity-and-stable-values)
      and in every benchmark report; make `preparedFixture` reject a fixture
      whose digest differs from the current templates, naming the preparation
      command.
- [x] Discovered: the fixture owns its theme; prove generation from an isolated
      copy of only `tests/fixtures/large/`. Record resolved `renderingDependencies`
      in root identity and every report; acceptance requires identical maps.
- [x] Model every sample outcome in `scripts/large/timings.mjs` and
      `benchmark.mjs` under the timing contract, including infrastructure/
      measurement errors without fabricated worker ends, incomplete upper/
      lower bounds, exact id-set mismatches and all-status interval unions.
- [x] Add a repeatable `--scenario <name>` filter to the benchmark.
- [x] Add a `linked-stylesheet` scenario that keeps setup's unused
      `shared-1.css` rule, expects zero Changes and reports the clipped
      `review.css-analysis` share; restore `renderer.tsx` and `shared-1.css`
      to their setup state after the matrix.
- [x] Sample the classifying isolate's used V8 heap after each compared view
      and emit the maximum as `heapPeakMiB` in the `review.compare-screens`
      counts record.
- [x] Emit the `review.document-work` counts record, collected only when
      timings are enabled, and add an HTML parse counter at every current
      parse site.
- [x] Record `heapPeakMiB` and the document-work counts per benchmark sample.
- [x] Extend `tests/large_baseline_benchmark.test.ts` with ok, error,
      incomplete (heap-limit shaped and start-only delivery ceiling), mismatch
      and window-straddling records, including benchmark-clock wait-to-stop
      without an invented worker or supervisor end;
      the digest rejection, the scenario filter and state restoration.
- [x] Discovered: keep tests below the file-size cap by placing outcomes in
      `tests/large_sample_outcomes.test.ts`, identity/isolation in
      `tests/large_template_identity.test.ts`, matrix/restoration in
      `tests/large_scenario_matrix.test.ts`, and interruption in
      `tests/large_scenario_cancellation.test.ts` instead of growing the baseline file.
- [x] Discovered: install matrix-wide cancellation, disable Playwright signal
      exits, abort preparation builds, stop active Serve and skip remaining
      samples while restoring all setup bytes before exit. Prove both signal phases
      with child processes and test restoration with an edited final row.
- [x] Discovered: isolate templates under the OS temporary directory and
      compare complete generated trees. Inject the heap sampler and pin every
      completed real view plus a rejection; reuse main's path-count owner.
      Test real Serve page/component collection including both legacy steps;
      rename the synthetic nested-scope test to its actual proof.
- [x] Discovered: define the exact token/provider fallback and update key-file
      and sample-field summaries before fixing the measurement template digest.
- [x] Discovered: preserve the previous measurements in
      `docs/dev/large-fixture-history.md` and link them from the fixture README,
      leaving room for current tables without changing the template digest.
- [x] Discovered: register the sampler test's timer through
      `fixture.beforeRemove()` so dependent cleanup precedes fixture teardown;
      keep the lifecycle lint in targeted verification.
- [x] Discovered: update the fixture README, benchmark contract and timing
      contract's Delivery Status for M2 before regenerating fixtures and
      recording the reference. The benchmark contract participates in the
      template digest; later measurement tables belong in the excluded README.
- [x] Discovered: update established diagnostic-envelope, path-count and
      derived-fixture ignore-list assertions for numeric document-work/heap
      counts and the ignored root identity. Retain strict byte, field and
      parentage checks rather than weakening existing tests.
- [x] Discovered: disabled per-view sampling must add no promises to the
      delivered batch. Pin that bound against the direct comparison oracle;
      malformed identity records must suggest a usable preparation command.
- [x] Discovered: finish targeted tests and the full suite, commit the code
      locally, then run `npm run format:check`, `npm run lint` and
      `npm run typecheck` under Node 24.19.0. Report and stop before regenerating
      either default-size fixture or measuring; resume only on the supervisor's
      approval. No push until the final `cargo xtask check` passes.
- [x] Regenerate both fixtures. Run the default fixture's full committed
      matrix twice and record the per-scenario, per-state mean as the
      Decision 13 reference. Run the cumulative matrix once and record every
      sample, whatever its outcome, as the baseline.
- [x] Run the suite and `cargo xtask check` after recording the reference.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 2 review findings

Reported by the post-push review of commits `46510f43` to `e7729725`.
Recorded for the user's decision.

1. Medium. The recorded Decision 13 reference is noisier than the 5%
   default-fixture tolerance it will be judged against. The reference meets
   every procedural rule (digest, outcomes, membership and heap re-derived
   from the raw JSON), but the two runs of the same code disagree by up to
   19.5% of a cell mean (screen-markup warm: 34,986.60 against 42,551.30 ms,
   the slower run parsing HTML at 23.4 MB/s against 26.4 to 30.4 MB/s in the
   other default samples), and by 8.7 to 9.5% in three more cells. An
   unchanged rerun could therefore fail `D/B <= 1.05`, while an outlier-high
   reference cell can hide a real regression; the report's `machine` record
   also identifies a hardware class, not a host. Recommended: make acceptance
   a paired, interleaved comparison on one host in one session (rebuild the
   reference commit `4b09b13e` and alternate its matrices with the
   candidate's), keep the Milestone 2 tables as history, require a reference
   or comparison to have a within-cell spread below the tolerance (otherwise
   add runs), and add a tested script that evaluates every Decision 13
   condition from the JSON reports.
2. Low. On an output-mode mismatch, `preparedFixture` suggests a preparation
   command for the recorded mode instead of the requested one (for example no
   `--derived` when `--derived` was requested), and that branch is untested.
   Recommended: suggest the requested mode with the recorded size, name the
   mode found, and add a table-driven test over every rejection branch
   (missing, malformed, digest, mode in both directions; via the index and via
   `--config`) asserting the exact suggested command.
3. Low. `ComponentComparisonCounts.add` has no caller, and four modules
   (`src/css_references.ts`, `src/review/css/diff.ts`,
   `src/review/css/inline_rule_matching.ts`, `src/review/css/inline_rendering.ts`)
   have the new import above their module description comment. Recommended:
   delete the method and move the comments back to line 1.

## Milestone 3: Bounded Memory

Summary: stop retaining committed-mode outputs in the worker and bound the
stylesheet-file parse cache, without changing any result.

- [x] In `src/server/demand/background_worker.ts`, keep `compilation.outputs`
      only when `generatedOutput` is `derived`, through a small pure helper
      with unit tests for both modes; committed classification keeps reading
      committed files.
- [x] Discovered: compact the incoming runtime, omit committed `existingOutputs`
      and clear its worker-data property after consumption. Audit compiled-message
      closures, weak consumer-runtime caches and classification-local readers;
      only derived generated bytes and necessary classification reads remain.
- [x] Add a byte-bounded LRU in `src/review/css/` implementing the contract's
      estimate, with flat key copies; replace the unbounded map in
      `CssResourceAnalysis`, keeping the injected-parser path.
- [x] Unit-test the LRU: byte accounting, eviction order, hits refreshing
      recency, an entry larger than the bound, and flat keys.
- [x] Discovered: prove flat keys and all retained string slots in child processes
      with `--expose-gc` and 48 MiB parents, including a sliced-key hit regression.
      Pin replacement accounting, zero/oversize non-retention, cached failures,
      opaque payload bypass and UTF-16 preservation individually.
- [x] Add a differential test: component-aware classification results are
      identical with a zero-byte bound and with the default bound.
- [x] Discovered: finish targeted tests, full unit/browser suites and
      format/lint/typecheck under Node 24.19.0, commit the code, report and stop
      before measurements for the supervisor's code checkpoint.
- [x] Discovered: move actual worker state into an injected compile/post/classify
      module and pin fresh/existing committed/derived transitions plus the parent
      worker factory's compact inputs; rename helper-only tests to their proof.
- [x] Discovered: broaden zero/default-bound classification differentials to
      statement/block at-rules, grouped/nested conditions, custom properties,
      references, failure and the real design library in both output modes.
- [x] Discovered: decode GC helper URLs for spaced checkouts, remove the
      non-discriminating property-name probe/copy, enumerate the exact safe
      error classes and rely on freezing for property flags.
- [x] Discovered: keep the fixture README below 300 lines by linking a focused
      developer report for the M3 samples, provenance and full document-work
      records rather than growing the existing baseline tables.
- [x] After that checkpoint is accepted, record, without requiring completion,
      cold cumulative `no-changes` and `component-style` samples in the same
      filtered matrix with each outcome, `heapPeakMiB`, classification time and
      document work. Do not measure before authorization.
- [x] Update `src/review/README.md`, `src/server/README.md` and the
      contracts' Delivery Status for delivered parts.
- [x] Run the suite and `cargo xtask check` on the final measured result.
- [x] Discovered: after the VM reboot interrupted the final Chromium run,
      verify dependencies, build output, Chrome and both setup fixtures survived;
      rerun the complete check from the start under Node 24.19.0.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 3 review findings

Reported by the post-push review of commits `783e1f3d`, `4c2ac767` and
`b87df3a2`. Recorded for the user's decision.

1. Medium. A cached CSS parse failure keeps its whole HTML page alive outside
   the 64 MiB bound. The error snapshot in `src/review/css/cache_error.ts` is
   built with `new Error()`, which also records the call stack in a hidden V8
   slot that deleting `stack` does not clear; a frame's closure in
   `parseCssRules` holds the style text, which is a slice of the page. A probe
   through `parseInlineRuleList` with an invalid style sliced from a 48 MiB page
   retained 48 MiB after GC (0 MiB with a zero bound or with
   `Error.stackTraceLimit = 0`), while the repository's GC probe calls the
   cache directly and cannot see this path. Recommended: build the snapshot
   error with `Error.stackTraceLimit = 0` (restored in `finally`), add a GC test
   that enters through the production path with a sliced invalid style,
   correct the contract and README claims, and require retention tests to use
   the production path. Status: Milestone 4's segment cache stores failures
   through the same helper and must meet the same no-document-retention rule,
   so its production-path retention tests cover this.
2. Low. A component-aware classification creates two whole-input caches: the
   page phase (`classifyChangedContent` through `ChangedResourceGraph`) and the
   component phase each construct their own `CssResourceAnalysis`, contrary to
   the contract's one cache per classification, and the test-only
   `cssCacheBytes` reaches only the second. Recommended: create one
   `CssResourceAnalysis` in `readCatalogueChanges`, pass it to both phases as a
   required argument, and extend the zero-versus-default-bound test through
   `readCatalogueChanges`. Related to Milestone 1 finding 1.

## Milestone 4: Rule Segment Parse Reuse

Summary: parse each distinct top-level rule once per classification and
compute each distinct rule's derived data once, with results identical to
whole-element parsing.

- [x] Discovered: prove the final native rule ends before a fixed sentinel;
      test duplicate and cross-element hash/at-keyword/NUL URL lookalikes at
      default and zero bounds, plus seeded inputs and sentinel mutations.
- [x] Discovered: remove duplicate boundary recovery and document-ordinal
      copies; derive cached data from detached material once; rename the
      disabled-counter test to its actual collector/emission proof.
- [x] Discovered: report interleaved cold per-element costs against `b87df3a2`
      and `e4307a46`; target about 10% of the former, recording any excess
      and remaining cost for the supervisor's decision.
- [x] Discovered: supervisor decision on remaining cold costs: final/M3
      ratios are 1.2974 (85 KB RNW), 1.2272 (157 KB RNW) and 1.2491
      (1,000 Emotion elements), above the requested approximately 1.10.
      Preserve the measured evidence in
      [the parse-reuse checkpoint](../docs/dev/large-fixture-parse-reuse.md).
      Accepted for now: inline analysis is about 3.6% of default-fixture
      classification, so this 23–30% cold regression costs about 1% there;
      reuse eliminated nearly all cumulative parse work (32.4 million segments,
      5,698 parses, no fallbacks). Decision 13's default-fixture ratio remains
      binding. M6 reports cold inline parse cost; a later milestone reduces it
      if default component-style or screen-markup exceeds the tolerance,
      for example by making canonical text and references lazy.

- [x] Discovered: meet the supervisor's premeasurement checkpoint: targeted
      tests, full unit/Chromium/hydration suites and format/lint/typecheck,
      then commit locally, report and stop. Do not measure or push until approved.
- [x] Discovered: production-path GC probes for valid, invalid, whole-fallback
      and cached-run style slices expose hidden V8 error-stack retention. Build
      shared failure snapshots with stack recording disabled/restored in `finally`;
      verify both entry points and every new derived string slot release their pages.
      Failed batches still use whole-element fallback, never unverified segment runs.
- [x] Discovered: after approval, smoke-measure cold cumulative `no-changes`
      and `component-style`, including the inline counts record, before the final
      `cargo xtask check` and push. Preserve all outcomes; do not measure early.

- [x] Add a segment scanner module under `src/review/css/` implementing the
      Caches And Segments semantics over normalized text with code-unit
      comparisons, returning ordered segment ranges or an anomaly.
- [x] Add batched segment parsing to the Lightning CSS parser: parse an
      element's missing segments joined by newlines in one call, attribute the
      output rules to segments by top-level rule start, and verify exactly one
      top-level rule per segment starting at its start.
- [x] Add the rule-segment cache (byte-bounded LRU, 64 MiB) whose entries hold
      segment-local rules, derived data and the cached ordered identity-run
      key; assemble element rule lists
      in `parseInlineRuleList` with rebased ordinals; implement every fallback
      condition.
- [x] Compute derived data once per parsed rule, for inline and stylesheet-file
      parses alike: address key with block form, identity key, rank,
      canonical text, references and the custom-property flag. Make `diffCssRules`,
      `diffCssRuleLists`, `cssRuleIdentity` and `renderInlineRules` use it.
- [x] Emit the `review.inline-style-analysis` counts record after the
      component-aware loop.
- [x] Add scanner unit tests: comments, strings containing braces and quotes,
      escapes, unquoted `url(` containing braces, nested blocks and at-rules,
      CDO and CDC, and each anomaly.
- [x] Discovered: include `<!--a{color:red}`, `<!---->`,
      `<!--body{color:red}-->` and `b{color:blue}<!--a{color:red}` in both scanner
      and assembly differential tests: each is a CDO-word anomaly and whole
      fallback must preserve the delivered unresolved result.
- [x] Add a differential test: segment assembly equals whole-element parsing,
      including ordinals and failures, over every CSS input in the existing
      `review_css_*` tests, React Native Web sheets from the small large
      fixture, Emotion-style per-component elements, and seeded random edits
      (insert, delete and reorder rules; inject comments, strings and
      escapes).
- [x] Add tests that a sequence of cumulative sheets parses each distinct
      segment once through an injected counting parser, that each fallback
      condition falls back, and that `@layer a;` against `@layer a{}` is a
      diffed, unresolved change on both paths.
- [x] Discovered: assert stored references include `theme.css` for string-form
      `@import "theme.css";` through the whole-input/fallback path, using the
      shared reference definition rather than a bare-prelude detector.
- [x] Run the existing inline, CSS, fast-path and Changes suites, preserving
      assertions outside the Decision 4 form correction; run the full
      unit/Chromium/hydration suites.
- [x] Discovered: after the approved smoke measurements, run the complete
      `cargo xtask check` before pushing, as the supervisor's checkpoint requires.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 4 review findings

Reported by the post-push review of commits `e4307a46`, `b4597e75`,
`fefb4f30` and `2c36ff4e`. Recorded for the user's decision.

1. Medium. An inline style element whose batch can never be verified is
   re-batched every time it appears, so it costs more than before this
   milestone. The batch runs before the whole-input cache is consulted, and a
   failed batch is never remembered. Elements containing a rule Lightning CSS
   rejects but browsers accept (`.clearfix{*zoom:1}`, `color:red !ie`) or a
   nested at-rule without a trailing semicolon (`.btn{@apply px-4 py-2}`)
   always fail verification; an 11 KB element seen 50 times ran 50 failed
   batches plus one whole parse (73 ms against 12 ms), and 150 cumulative
   sheets containing one such rule ran 300 failed batches on top of 150 whole
   parses and never cached a segment, so one such rule disables reuse for
   every later cumulative sheet. Results stay correct. Recommended: when a
   batch fails, re-parse its unseen segments singly (or by halving), cache
   those that verify, and store a size-counted "needs whole parsing" marker
   for each segment that fails alone, so later elements containing it fall
   back without a batch; optionally check the whole-input cache first; update
   the contract's fallback section; and replace the tests that pin
   re-batching with work-bound tests (a counting parser bounded by distinct
   inputs) for a repeated failing element and for cumulative sheets with one
   failing rule, in both forms.
2. Low. The seeded mutation test inserts, deletes and reorders whole rules but
   never injects strings, escapes or other characters inside rules, although
   the plan TODO says it does; a character-level fuzz of about 72,000 cases
   found no mismatch, so this is a coverage gap, not a current bug.
   Recommended: add a character-level mode to the seeded test (insert tokens
   at random positions inside rules, share the cache across cases, print the
   seed, assert minimum successful batches and cache hits), as a shared
   generator and oracle in `tests/helpers/css_segments.ts` that Milestone 5
   reuses.

## Milestone 5: Changed-Segment Analysis

Summary: make per-view analysis cost follow the changed segments, pair
unchanged reference-bearing rules only with matched copies, and compose rule
lists from stored rule text.

- [x] Discovered: capture the M4 engine before changing analysis; verify code,
      targeted/full unit/Chromium/hydration and static checks, commit locally,
      then report and stop before M5 measurements or its final cargo/push gate.

- [x] Cancel segments by their cached ordered identity-run keys, earliest
      base occurrence first, before the rule diff; diff only the remaining
      runs with original document-wide ordinals.
- [x] Find unchanged reference-bearing rules from the stored references and
      pair each only with a cancelled segment's copy or an exact rule match.
- [x] Compose each side's actual and projected rule lists from stored per-rule
      text for all segments, omitting only analyzed occurrences selected as
      excluded or owned, without allocating per-rule objects for cancelled
      segments.
- [x] Discovered: a counting diff and cached-rule Proxy own-key checks prove that
      N-to-N+1 cumulative sheets with N = 10 and 1,000 send one rule to the
      diff and attribution, and composition copies zero cached rules.
- [x] Add a differential test: for before and after element pairs covering
      cumulative sequences, duplicates, formatting-only edits, reference
      rules, custom properties, nested and conditional rules and element
      splits, attributions, owned sets, retained selectors, the all-excluded
      flag and both materials equal the Milestone 4 engine's for every flat
      sheet (including differently formatted duplicates and React Native Web)
      and the contract's agreeing-survivor grouped/nested domain. Compare
      ordered diffs and actual occurrence pairs under those equality domains;
      flat runs require equal ordinals too. No broad duplicate exemption is
      allowed.
- [x] Discovered: the differential TODO's flat-sheet equality domain excludes
      Decision 5's matched-copy correction, explicitly tested below; its
      grouped/nested agreeing-survivor domain excludes the documented ordinal
      and global-order displacement. Decisions 5 and 6 approve those narrow
      differences; keep exact expected outcomes rather than blanket exemptions.
- [x] Discovered: mixed fallback/segmented elements must send all rules to
      full diff (`[4,3]`/`[3,4]`), preserving the grouped example's `entry`
      attribution. Mutation checks must reject `&&` becoming `||`.
- [x] Discovered: remove production-only test adapters, full-list getters and
      the optional reference-index fallback. Move M4 whole-list rebasing to
      test helpers; production exposes runs only. Deleting
      `src/review/css/inline_rule_lists.ts` is explicitly supervisor-authorized.
- [x] Discovered: sort canonical material once per side, derive projected order
      by filtering, and prove the sort count and ordering against real runs.
- [x] Discovered: the final unused-export ratchet requires the canonical sorter
      to be private; it has only same-module production callers. Preserve the
      measurements' `a78b6113` provenance; this visibility-only gate fix changes
      no parsing, cancellation, composition or fixture input.
- [x] Discovered: assert explicit changed pairs and final outcomes for
      displaced shared identities across differently shaped grouped/nested
      runs, including the contract's worked example and custom-property/URL
      variants. The flat red/blue/green example must agree with full diff.
      Test full-diff fallback when either side cannot segment.
- [x] Add a test for the duplicate-copy case (a rule with a custom property and
      a reference present once before and twice after): the added copy stays
      `unresolved`, the view is `changed` with a `material` reason, and no
      rule object carries two attributions.
- [x] Record the no-change and component-style samples of both fixtures in
      [the changed-segment checkpoint](../docs/dev/large-fixture-changed-segments.md):
      all eight outcomes are `ok`; both cumulative style samples complete;
      HTML parsing and residual inline work still dominate.
- [x] Update `src/review/README.md` and the contracts' Delivery Status for
      delivered parts.
- [x] After the code checkpoint and approved measurements, run the suite and
      `cargo xtask check` on the measured result before pushing.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 5 review findings

Reported by the post-push review of commits `5ecbb3bc`, `a78b6113` and
`1887eff6`. Recorded for the user's decision.

1. Medium. Cancellation keys whole top-level blocks (a rule, or a whole
   `@media` or nested group) rather than single rules, which has two effects.
   First, the approved displacement exception: when the same rule sits inside
   differently shaped grouped or nested blocks, the result differs from the
   ordinary full diff, and the tests show a component-owned rule becoming
   `unresolved`, the owned set emptying and the projected material changing.
   Second, one element on either side that cannot be segmented (an
   `@import`, `@charset` or `@namespace` element, a scanner anomaly or a
   failed batch) switches cancellation off for the whole page pair; a niced
   micro-benchmark measured about 22 ms against 1.3–1.5 ms per view at 3,000
   rules (6,001 rules sent to the diff instead of 1), and no scale sample has
   a fallback, so the checkpoint cannot show it. The diff's exact-match step
   pairs each after-copy with the earliest unused identical before-copy, and a
   rule's identity includes its address, so cancelling per rule by stored
   identity key, earliest-first in document order, reproduces the full diff's
   matches, leftovers, ordinals and reference pairs for every input. Block
   keys save little: every view already looks up every segment and composes
   and sorts every rule on each side. Naive per-rule cancellation measured
   about 3 ms more per view at 3,000 rules, mostly identity lookups that
   per-run identity-key arrays stored with each cached run should avoid (not
   measured). Recommended: cancel per rule, including the rules of fallback
   elements; send leftovers to the ordinary diff; pair matched
   reference-bearing rules as today; store per-run identity-key arrays; drop
   the `segmented` gate, the displacement exception, the grouped equality
   domains and the Style-Only Route's displacement conditions; and replace the
   displacement tests with exact full-diff equality tests for grouped, nested
   and fallback inputs. This changes Decision 5, so it needs the user's
   approval, and it should be decided before Milestone 8 because it changes
   the route contract. Alternatives: keep block keys but feed a fallback
   element's rules in as single-rule runs (removes only the slowdown), or keep
   the design and document and measure the slowdown.
2. Low. The checkpoint says both cumulative component-style samples now
   complete within the delivery ceiling, but the cold sample delivered Changes
   at 869,377 ms, about 40 s (4–5%) inside the fixed 900 s inline wait, which
   is smaller than this session's 59 s cold/warm spread and the 26 s HTML-time
   drift between the Milestone 4 and 5 warm runs; Milestone 4's warm sample
   had also completed, at 898,953 ms. Neither the report nor the sample record
   states `changesReadyMs`, the ceiling or the headroom, so completion reads
   as a reliable Milestone 5 gain and a slower profiled run could come back
   `incomplete`. Recommended: record `changesReadyMs`, the effective ceiling
   and the headroom in each sample's JSON and in the checkpoint tables, make
   the ceiling a benchmark option for profiled runs with an outcome test, and
   reword the claim to "completed with about 4% headroom".
3. Low. The 1,000-case seeded differential compares only with the captured
   Milestone 4 engine, and its generator has no reference-bearing rule and no
   component instance, so it never produces an unchanged reference pair or an
   `owned` rule, the two behaviors Milestone 5 changed; those paths have only
   a few fixed cases, so a regression in `referenceOrdinals` indexing across
   element splits and duplicates would escape randomized coverage.
   Recommended: add a second oracle (the same analysis with cancellation
   disabled, through a parser without `parseSegments`) that requires exact
   equality of rules, pairs, ordinals, attributions and both materials; add
   `url()` rules (duplicates and element splits) and component-owned ranges to
   the generator; keep the Milestone 4 comparison for the reference-free
   subset; and share the generator and oracle in a helper that the
   classification-level differential and Milestone 8's route tests reuse.

## Milestone 6: Cost Breakdown Checkpoint

Summary: measure where classification time goes after bounded memory and parse
reuse, and confirm that the page-work milestones target the largest costs.
Documentation-only; validated with Prettier, documentation tests and a diff review.

- [x] Run the full committed matrix once on each fixture with document-work
      counts, and capture one CPU profile of the background worker's
      classification for the no-change and component-style scenarios on the
      cumulative fixture.
- [x] Discovered: preserve the perturbed first default matrix, then use the
      supervisor-authorized quiet repeat as the default model source. Carry
      M5/perturbed/quiet spread, never drop a sample or rerun after a disconnect.
- [x] Discovered: add the requested default style profile. All three profiles
      cover complete worker classification only; the ignored, off-by-default
      harness has an explicit uncapped option, leaving matrix ceilings/schema
      unchanged. Document observed overhead/drift and retained raw profiles.
- [x] Record per scenario the classification time, `heapPeakMiB`, HTML parses
      and per-step times, and the profiles' top self-time functions, in the
      fixture README beside the Milestone 2 baseline.
- [x] Discovered: keep the 300-line fixture README concise by linking the
      focused [M6 report](../docs/dev/large-fixture-cost-checkpoint.md), with
      separate [profiles](../docs/dev/large-fixture-cost-profiles.md) and
      [model/cold-cost](../docs/dev/large-fixture-cost-model.md) sections.
- [x] Discovered: record every cumulative `changesReadyMs` and the effective
      deadline/headroom lower bounds. Existing clocks do not retain the exact
      wait start; report the limitation, not an invented alignment or new field.
- [x] Discovered: report cold inline parse cost explicitly in the breakdown
      and evaluate default component-style and screen-markup against Decision
      13's tolerance; if exceeded, schedule the cold-cost reduction accepted
      provisionally in Milestone 4 before final acceptance.
- [x] Confirm that Milestones 7 to 9 address the largest measured costs, in
      that order. If the data shows otherwise, reorder or amend those
      not-started milestones and record why in this milestone.
- [x] Discovered: retain M7 → M8 → M9; add M8's residual-material equality
      work-bound proof and M9A's residual sheet/cold-cost checkpoint. Current
      scanning/lookup/cancellation survives the three planned steps; cumulative
      style is projected at 130–175 s, still beyond Decision 13. Decisions and
      contracts remain unchanged; M5 findings are recorded, not implemented.
- [x] Validate the changed Markdown with `npx prettier --check` and review the
      diff.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 6 review findings

Reported by the post-push review of commit `e5025e64`. Recorded for the
user's decision.

1. Medium. The cost model keeps every operation it does not model unchanged
   through all milestones, including the unmeasured remainder ("Rest": 33.3/34.0
   s for cumulative style, 24.0/26.4 s for cumulative no-change, about 37% of the
   no-change projection), so by its own numbers Milestone 9A cannot close the
   cumulative component-style gap: removing all of M9A's 63–72 s from the
   projected 130–175 s still leaves about 58–112 s (recomputed per saved sample,
   65–96 s cold and 61–82 s warm, mostly above the 73.5/75.7 s ceilings). The
   remainder is about 25 s of head-page parsing, reference and resource
   discovery, and the 33 s Rest, none broken down or assigned to a milestone,
   although M9A's summary says it will "close the measured cost left by M7 to
   M9". The model also omits work the identical-text quick check removes by
   contract (hashing, projection, implementation comparison: 5.5–7.1 s on
   cumulative no-change), which moves that cell's cold upper bound from 72.4 to
   about 66.9 s against a 66.8 s ceiling. Recommended: extend the model
   (documentation only) to break down Rest and the other retained costs from
   the saved profiles, credit each milestone with everything its contract
   removes, add a post-M9A projection with partial and full removal of the sheet
   work for every Decision 13 cell, and then widen M9A or add a milestone for
   the largest remaining non-sheet cost, or ask the user whether the
   cumulative-style target should change; also add a plan rule that checkpoint
   projections account for every part of the measured total and show the
   post-plan result for each Decision 13 cell.
2. Medium. The new Milestone 8 TODO (residual-multiset material equality, a
   ban on sorting, copying or joining cancelled rules, a fallback to ordinary
   composition, and counting and differential tests) adds behavior and tests
   that the route contract does not contain, although that contract says its
   proof section owns all of Milestone 8's test obligations, the existing M8
   TODO calls it the sole test list, and the contract's Result section says to
   compose and compare the retained multisets; the 130–175 s projection relies
   on that saving (14.261% of the profiled time). The TODO and M9A also fix the
   current block-level cancellation in place, while the recorded Milestone 5
   finding 1 proposes replacing it before Milestone 8, and no TODO makes
   Milestone 8 wait for that decision. Recommended: draft the route-contract
   change (Result and proof sections) for the user's approval, make the M8 TODO
   "after approval, update the contract, then implement", add a first M8 TODO
   to obtain the user's decision on Milestone 5 finding 1, and add a plan rule
   that any amendment adding behavior or tests goes through the owning
   contract, with approval while contracts are frozen.
3. Low. "Warm cumulative markup looks reachable across its range" is not
   supported: Milestone 5 measured only no-change and component-style, so the
   cumulative screen-markup and linked-stylesheet cells come from a single run
   with no measured variation, and the same catalogue's same-code warm
   no-change varied by 25.7%, which would take that cell's 66.72 s upper bound
   to about 83.9 s, above its 77.538 s ceiling. Recommended: mark single-run
   cells "variation not measured", widen them by the largest same-code
   variation seen on that catalogue (or record a second run next time),
   reclassify warm cumulative markup as noise-dependent, and state the
   single-run rule in the method paragraph.
4. Low. Nearly every number matches the saved evidence, but the Inclusive
   Paths table shows "—" (defined as no sampled stack) for two non-zero values
   (`compareUnchangedComponentView` 0.38% in the cumulative-style profile and
   the `inline_attribution.js:10` callback 3.10% in the default-style profile);
   five range upper bounds are one second above what the stated formula gives
   after rounding outward (default no-change warm 24.45 against 26, default
   style cold 23.55 against 25, cumulative style cold 310.29 against 312 and
   warm 276.89 against 278, cumulative linked cold 112.93 against 114); no
   model script or output is saved; and the profile step categories behind
   every share the plan relies on are ordered regular expressions in an
   ignored file, undocumented in the report. Recommended: fix the cells and
   define "—", save the model script and output beside the evidence and
   regenerate the range table, document the category order, and add a TODO to
   commit the off-by-default profiling option and summarizer under
   `scripts/large/` with tests, generating report tables from saved summaries.

## Milestone 7: Shared Page Analysis

Summary: parse each page file side once and share the result across the quick
check, the full comparison and linked-stylesheet matching; match selectors on
the original page; give identical texts a single-parse quick check.

- [x] Add a page analysis module under `src/review/` that parses one side on
      first use with source locations and exposes validated ranges, unowned
      style spans, paired ignored regions, the element tree with its ignore
      rule, and reference records with source spans. Let
      `validateComponentRanges`, `findUnownedInlineStyles` and HTML reference
      extraction accept a parsed document, keeping their string entry points
      for other callers.
- [x] Derive comparison-material references from the page analysis and use
      them for resource discovery. Add a differential test that the derived
      resource seeds and transitive closures equal discovery from old text
      materials for every view of the design catalogue, small large fixtures
      and inline test catalogues in the contract's visibility-preserving
      domain. Assert explicit provenance-derived sets for partial spans,
      template/caller copies and parser-recovery visibility differences.
- [x] Match inline and linked-stylesheet selectors on the original trees with
      the ignore rule, resolve owners on the original ranges, and remove the
      normalized parses in the component-aware shared loop only. Add original-context tests for a sibling combinator,
      `:nth-child`, `:has()` and `:empty` next to/containing ignored content on
      both paths; every other existing CSS and inline test stays unchanged.
- [x] Add the identical-text quick check and remove inline analysis from the
      fast path. Test in committed and derived modes that a zero-change
      classification emits no `review.inline-style-analysis` span and parses
      each view once.
- [x] Discovered: preserve the mode-specific resource-graph bounds in the
      timing contract; prove committed quick checks never traverse the base
      reader and derived quick checks compare both closures independently.
- [x] Discovered: test flat ignore markers inside raw text, including the
      textarea-bounded style case and its paired/one-sided expected results
      under [ignore pairing](../docs/protocol/mokly-page-analysis.md#contents-and-ignore-pairing).
- [x] Assert with document-work counts that a full comparison parses each side
      at most once.
- [x] Discovered: clarify the contract's existing component-aware scope, pass
      the either-manifest flag through view/resource contexts, and retain
      component-free and separate page matching/cache behavior. Regression
      tests cover both output modes; embedded HTML stays in its reader cache.
- [x] Discovered: failed non-identical quick checks must not reuse their
      unattributed projection as a complete inline result. A failing M6-oracle
      test pins owned unchanged references after ignored edits; full attribution
      reuses analyses/discovery. Owned reference traversal uses stored values,
      not synthetic `<style>` HTML; parse5 interception covers that path.
- [x] Discovered: preserve embedded-resource reference discovery after paired
      normalization, independently of original-tree matching. A failing
      committed/derived oracle case pins parser-recovery reachability; those
      resource-only parses remain separately counted. Keep producer references
      in a weak association so every existing M4/M5 material assertion is unchanged.
- [x] Discovered: split material delivery and closure caching from orchestration,
      and move the root-specific resource test into a focused file. Use a real
      template copy for that ownership test; parser-discarded select references
      have separate explicit old/new oracle cases.
- [x] Discovered: code checkpoint before measurements: finish targeted and full
      unit/browser/hydration suites, format/lint/typecheck and docs validation,
      commit locally, report and stop for the supervisor. Measurements, the
      retained-byte report, `cargo xtask check` and push follow approval.
- [x] Discovered: style discovery shares the reference inventory traversal;
      the standalone finder does not consume a parsed document, regions or an
      alternate source. Remove those dead parameters instead of retaining a
      misleading parsed-document interface from the original TODO.
- [x] Discovered: supervisor regressions clarify existing source provenance,
      implied/clone subject status, ownership-only projection, stable discovery,
      marker stripping and flat ignore enclosure. Cache raw pair normalization;
      skip unused one-sided normalization and embedded material derivation.
      Pin adopted root attributes, split style spans, reader independence and
      exact UTF-16 offsets, and record well-formed table/SVG receiver differences
      against M6. These are documentation-gap clarifications, not new Decisions.
- [x] Discovered: supervisor-fix checkpoint: prove regressions fail first,
      rerun targeted/full unit/Chromium/hydration/static/docs checks, add new
      Conventional Commits without amending, report and stop before measuring.
- [x] Discovered: second supervisor round: capture provenance during the one
      parse with parse5's exported Parser and default adapter. Remove regex
      donor recovery and its dead unregistered-tree fallback; enforce typed
      registration errors. Record creating-token offsets for empty implied
      subjects, preserve all-descendant/root/clone policies and test both modes
      against M6 on inline, linked and embedded paths. Run the entire extractor
      corpus through the production parser, with lookalike/integration-point/
      clone/HTML-select cases; replace the global-body tests with real `.page`
      and `head` matches. Prove regressions fail first, then complete targeted,
      unit, pinned hydration/browser and static/docs checks. Commit locally and
      stop. Retain the six known host-timing signatures and the supervisor's
      subsequently authorized Browse startup exception, with all raw failures.
- [x] Discovered: classify additional Browse light-only and desktop component
      preview waits from the full round-two browser run. Run both specs alone
      with pinned Chromium and three repetitions on the fixed tree and clean,
      prepared M6. Retain server logs/traces: fixed 104/105, M6 105/105, with
      neither extra failure deterministic. The short control does not reproduce
      them. The supervisor's bounded ABBA startup comparison resolves the hold,
      without UI or timeout changes or more full-suite retries.
- [x] Discovered: run the bounded cold Serve experiment alone on clean prepared
      M6 and detached fixed-source snapshots, ABBA twice, retaining all eight
      runs' completed classification, document/inline counts, observed idle and
      server CPU. Fixed/M6 mean ratios 0.5102 / 0.9693 / 0.9092 meet the stated
      decision rule; record Browse as an additional host-timing exception and
      commit locally. This is not large-fixture or Decision 13 acceptance.
- [x] Discovered: third supervisor round: document ignored-tag root attribute
      adoption and precedence as existing original-tree context; pin both orders
      on inline, linked and embedded paths in both modes against M6. Validate
      creating-token/clone provenance once during analysis construction, outside
      selector error containment. Strengthen the corpus with producer spellings,
      every source-less offset and clone originals; correct the distinct clone-
      identity claim and conditional subject wording. Remove the dead attribute
      guard. Prove tests fail first, then targeted/full unit/pinned hydration/
      static/docs checks, commit locally and stop; no measurement or full browser
      retry is required at this checkpoint.
- [x] Discovered: investigate the post-reboot browser gate using clean pre-M7
      `e5025e64`, not M7 `ee4ead64`. Run the six failed specs cold and directly
      time fresh ordinary-preview exports on M6, delivered M7 and the fixed
      tree. Record the pre-reboot preparation/freshness evidence and all failed
      runs in [the browser-gate report](../docs/dev/shared-page-browser-gate.md).
      M6 reproduces the wait/setup failures; all three direct exports complete
      with zero classification work. The supervisor's slower-host diagnosis
      supersedes the initial commit hold; record that decision without UI/test edits.
- [x] Discovered: finish pinned hydration (219/219 pass) and record the
      supervisor-approved local commit exception for the six host-timing browser
      specs. Their complete green gate moves to M10, not to a timeout change.
      Final `cargo xtask check` uses explicit `PLAYWRIGHT_CHANNEL=chromium`;
      record that setting. Scale benchmarks keep default system Chrome; stop
      and report interactive failure, never silently change the channel.
- [x] Discovered: report retained HTML bytes and per-step work, including the
      page pass and resource documents, against M6's roughly 80% identical-view
      and 83% complete-style byte reductions. Account for source-location and
      reference-inventory overhead rather than treating byte ratios as timings.
      [Same-host M7 evidence](../docs/dev/shared-page-analysis-measurements.md)
      records the delivered 79.76%/82.99% cumulative byte reductions, original
      per-view source payload bounds, scoped page counts and every exclusive
      counter. These payload/workload bytes are not live DOM or total heap.
- [x] Run the fast-path, comparison-mode and Changes equivalence suites;
      preserve assertions outside the page contract's explicit provenance/
      ignore-eligibility/context cases. Retain the delivered text-material
      oracle and record old
      and new expectations for every intentionally adapted test, including
      select/template and malformed-HTML projected-resource fixtures.
- [x] Record the no-change and component-style samples of both fixtures.
      Discovered: after the supervisor's code check, prepare clean M6
      `e5025e64` separately (same analysis code as measured `1887eff6`) on this
      host, using identical commands for cold/warm no-change and component-style
      in one session: default fixture ABBA (M6, M7, M7, M6); cumulative once
      each, M6 then M7. Keep incomplete fixed-wait samples on either tree; for
      each affected cell also use M6's off-by-default uncapped classification-only
      harness, unprofiled, on both trees (M6 then M7), retaining both results.
      Report M7 `changesReadyMs`/inline ceiling headroom, retained HTML bytes and
      per-step work against M6's roughly 80% identical/83% complete-style byte
      reductions, alongside every run's document-work counts. Report same-host ratios
      and spread; label M2–M6 cross-host numbers as historical context. Record
      `machine.cpu`, `/proc/cpuinfo` model/MHz and CPU steal time per snapshot.
      Do not change Decision 13's machine requirement or its contract.
      Completed October 2–3, 2026 on clean `4d6a9956` and `e5025e64`:
      24 matrix samples (22 ok, two incomplete M6 style), four supplemental
      uncapped samples (all ok), no retries or browser-channel switches.
      Ratios/spread, CPU/MHz/steal and raw evidence are linked above; all setup
      sources and outputs restore byte-identically. M8 was unstarted at that
      measurement checkpoint; its implementation checkpoint is now delivered.
- [x] Update `src/review/README.md` and the contracts' Delivery Status for
      delivered parts; run the suite and `cargo xtask check`.
      Documentation and individual suites/non-audit Repository checks pass.
      The pinned-Chromium combined command remains audit-blocked, not passed.
      The supervisor closed M7 for the authorized push described below; the
      audit-exception decision for merging to `main` remains open for the user.
- [x] Discovered: the final pinned-Chromium `cargo xtask check` stopped at the
      dependency audit, before any suite, on the unpatched braces advisory
      `GHSA-vfj7-8cjw-p6xm` (13 transitive high reports through React Native/Metro).
      The supervisor pushed `96ddc06c` on October 3, 2026 under the user's
      instruction to continue all milestones, with the audit blocker documented
      in commit bodies. This resolves the former decision-before-push hold only;
      dependencies, overrides and the gate are unchanged, and the merge-to-main
      audit exception remains the user's decision. The browser report retains
      both audits; separate hydration passes 219/219 and report/docs checks pass.
- [x] Discovered: after the local evidence commit, run package, unit,
      pinned-Chromium browser and hydration individually through xtask. Record
      every result in the checkpoint in new commits, never amends. Clean
      `237c5a6c` passes package, all 3,482 unit tests, all 725 pinned browser
      tests and all 219 hydration tests; no failures/skips/cancellations. Every
      known browser timing spec passes this run, so no browser exception is
      needed. Non-audit Repository checks also pass. The initial push/M8 hold
      was subsequently resolved by the supervisor's October 3 instructions:
      retain M5's cancellation contract and defer M6's residual-equality proposal.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
      The supervisor pushed `96ddc06c` on October 3, 2026 under the user's
      instruction to continue all milestones, with the known `braces` audit
      blocker documented in the commit bodies.
- [x] Use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.
      The supervisor ran this review on local commits `ee4ead64` through
      `b3a88d07` before the push, explicitly authorized during the audit hold.
      The later push above resolved that hold; M8's code checkpoint is delivered.
      Findings below remain recorded for the user's decision, not implemented.

### Milestone 7 review findings

Reported by the review of local commits `ee4ead64`, `b9e1256d`, `991071c5`,
`4d6a9956`, `237c5a6c` and `b3a88d07`, run before the push while it was held
by the repository-wide `braces` audit blocker. The supervisor subsequently
pushed `96ddc06c` on October 3, 2026 as recorded above. Findings remain for the
user's decision; the audit exception for merging to `main` is still open.

1. Medium. Page provenance relies on parse5 internals marked `@internal`: the
   `Parser` class and its token callbacks, `static parse` constructing
   `new this(...)`, and the tree builder passing each token's own `attrs`
   array to `adoptAttributes` and `createElement`. The provenance contract
   says upgrades are guarded by the extractor-corpus test, but `package.json`
   declares `"parse5": "^8.0.1"` and the published package has no shrinkwrap
   or tests, so consumer installs take the newest 8.x without that guard.
   In isolated copies, renaming the start-tag callback makes page analysis
   throw for practically every page, and copying the attribute array at the
   two adoption-agency clone sites silently turns a clone of an ignored
   `<b class="tag">` into a `.tag` match without any validation error.
   Nobody is affected yet (8.0.1 is the newest release). Recommended: pin
   `parse5` to exactly 8.0.1 in the manifest and lock, state the pin in the
   provenance contract, and add a test that the dependency spec stays exact;
   optionally add a first-use self-check that parses a fixed sample (nested
   `<body>`, one adoption-agency clone, a stray `</p>`) and raises a typed error
   naming the installed version if spans, originals or offsets differ.
2. Low. The contract requires page analyses to be discarded with their view,
   and the code appears correct (pair is view-local, side tables are weak, the
   discovery cache keeps only seed identities and route sets, and cumulative
   heap peaks stay near 280–290 MiB), but no test proves it, although the
   analyses are the largest per-view objects and Milestone 3 showed such
   retention escapes code reading. Recommended: a child-process `--expose-gc`
   test that tracks every page-analysis document with a FinalizationRegistry
   across an identical-text view, a settled non-identical view and a
   fall-through view, asserting collection while readers stay alive, plus the
   same for embedded-resource reader trees after classification; and a rule
   that any contract setting a lifetime for a parse tree or cache needs a
   production-path GC test.
3. Low. Two report statements do not match the retained evidence: the browser
   report's duration comparison used 705 tests passing in both runs, not 702
   (the stated median and percentiles reproduce exactly with 705), and the
   measurement report's system Chrome 153.0.8010.52 appears in no benchmark
   JSON, log or command file, only as hard-coded report text. Recommended:
   correct the count, mark the Chrome version as not recorded, and record the
   browser executable and version in each sample's `machine` record (with a
   benchmark-contract update and a test) so reports derive it from raw data.

## Milestone 8: Style-Only Route

Summary: settle views whose only difference is inside one unowned style
element from the rule diff and the head page analysis, with results identical
to the full comparison.

Supervisor decision, October 3, 2026: M5 finding 1 is not approved; retain
block-level cancellation and its grouped/nested displacement contract. The
residual-multiset equality TODO was removed by the supervisor (see M6 finding
2): M8 composes and compares retained multisets exactly as the route contract
states. The candidate is recorded under M9A, not approved for implementation.

Supervisor decision on finding 4, October 3, 2026: option B is a pure fallback.
The complete path remains the oracle under Decision 6; original ignore spans
validate/pair/record content, while actual canonical materials decide state and
emitted ignore evidence. Non-identical quick checks and the style route reject
paired regions or markers intersecting eligible unowned style outer spans.
The original proposal recommending A is retained as evidence; A is not approved
and no complete-path result or Decision changes. The reserved `<!--mokly-`
condition-5 gap fix was separately approved earlier; approval history lives here
and in checkpoint reports, outside the normative rule.

- [x] Implement the route between the quick check and the full comparison
      with every Style-Only Route condition, and the test-only switch that
      disables it.
- [x] Count routed views as `stylePath` in the `review.compare-screens` counts
      record.
- [x] Implement every differential and per-view path proof in the
      [route contract's sole test list](../docs/protocol/mokly-style-only-route.md#fallback-counters-and-proof).
      It owns positive cases, precise window/reference guards, all fallbacks
      including `:parent`, view-wide grouped/nested displacement and the
      complete-path oracle. Do not maintain a second case list here.
- [x] Discovered: reuse all unchanged element runs and full-path preparation
      as the route contract requires; never decide from a changed-element-only
      diff.
- [x] Discovered: pin failed conservative seed coverage when a style-text
      reference record touches a paired ignore but canonicalization retains
      the reference. Require full fallback under condition 6's source/span
      proof, using the existing raw seeds without another resource policy;
      clarify this proof in the route contract and retain regression-first evidence.
- [x] Discovered: finish targeted/full unit, pinned-Chromium browser and
      hydration suites and static checks, commit the code checkpoint locally,
      report and stop before measuring. Measurements, `cargo xtask check` and
      push follow supervisor approval; the final review remains the supervisor's.
- [x] Discovered: the supervisor approved closing the marker-normalization
      gap with the reserved `<!--mokly-` substring guard on original eligible
      content and all composed canonical materials. Amend condition 5 and its
      sole test list, add regression-first per-view and seeded coverage, and
      reuse prepared runs and safe attribution on fallback. No Decision or
      full-path result changes; retain the proposal/reproduction evidence.
- [x] Discovered: preserve full material validation when removing an eligible
      style would split paired ignore boundaries (including a marker in a tag
      attribute). Pin the failure first and complete condition 3's conservative
      source/span proof; retain the interrupted verification run and repeat the
      final suites after the fix. No full-path behavior changes.
      The [code checkpoint](../docs/dev/style-only-route-checkpoint.md) records all
      completed implementation/proof work, the supervisor-approved gap fix and final
      verification. Measurements, the combined gate and push remain pending approval.

- [x] Discovered: address supervisor findings 1–4 with failing regressions first:
      equal raw edited-style references and missing-base-seed fallback; dropped
      eligible-style reference proof; review markers in tags; and option B's
      shared paired-ignore/style intersection fallback. Preserve complete-path
      semantics and clarify the three contracts together.
- [x] Discovered: close findings 5–10 with isolated per-view guard tests in both
      modes, confirmed mutation failures, and production path-count assertions
      on the cumulative RNW fixture and a mixed batch. Remove the dead tag-slice
      proof and explain why route-only fallback tests bypass the quick check.
- [x] Discovered: correct M7 push/audit history and move approval history out
      of normative condition 5 (findings 11–12). Record the supervisor's option B
      decision and retain the ignore-evidence proposal and reproduction logs.
- [x] Discovered: finish targeted, full unit/pinned-Chromium browser/hydration
      and static checks after the supervisor fixes; make new local Conventional
      Commits and stop before measuring or pushing. The
      [supervisor checkpoint](../docs/dev/style-only-route-supervisor-checkpoint.md)
      records regression-first evidence, 15 rejected mutations, 673 targeted,
      3,757 unit, 725 browser and 219 hydration passes, package/static checks
      and the unchanged-source verification snapshots.

- [x] Discovered: second supervisor round (starting `563de1e5`): add failing
      per-view regressions for all review-marker quick-check gaps, indirect
      missing derived resources, proof-induced diagnostic changes and differing
      style eligibility across ignored parser context. Generalize quick-check
      guards, use optional proof traversal without changing required-read
      diagnostics, preserve complete reads, and document actual-material `ignoredIds`.
- [x] Discovered: the second-round literal review-prefix guard does not cover
      a CSS selector escape that serializes into an orphan review marker.
      The supervisor rejected the broad `<`/backslash fallback and approved a
      pure CSS-escape decoder with ASCII-case-insensitive `<!--mokly-` detection.
      Keep the literal outer guard and ordered style-source equality. Decoder
      unit tests, all-switch per-view regressions, a seeded differential and
      ordinary utility/string controls prove the narrow rule; RNW stays 64/64
      fast for no change and 64/64 style for component styles in both modes.
      Preserve the proposal, rejected prototype and failing probes under
      `.context/delegation/scalable/m8-round2-escaped-marker-proposal.md`.
- [x] Discovered: verify the second-round fixes with targeted/full unit,
      pinned-Chromium browser/hydration and static checks; retain evidence in
      the [second checkpoint](../docs/dev/style-only-route-second-checkpoint.md),
      commit locally and stop before measuring/pushing. All 923 targeted, 3,989
      unit, 725 browser and 219 hydration tests pass, along with package/static
      checks and 13 mutation checks. Full suites ran with frozen authored files.

- [x] Discovered: third supervisor round (starting `38515667`): reproduce
      separator-joined reserved markers and false URL contexts before fixing
      the conservative decoded guard and decoder. Add the mixed-batch proof
      poisoning regression, cache only successful underlying probe reads, and
      prove closure identity and optional-to-required transfer by mutation.
      Correct the evidence link and extend the seeded differential/controls.
- [x] Discovered: finish the third-round targeted/full unit, pinned-Chromium
      browser/hydration and static checks on frozen sources; retain the
      [third checkpoint](../docs/dev/style-only-route-third-checkpoint.md),
      commit locally and stop before measuring or pushing. All 1,461 targeted,
      4,527 unit, 725 browser (full rerun) and 219 hydration tests pass, alongside
      package/static checks and eight rejected mutations. Preserve the first
      browser run's ArrowDown timeout and the same failure on clean prepared M7;
      no UI, timeout or authored-source change was made during verification.

- [x] Record the no-change and component-style samples of both fixtures.
      The [M8 measurement report](../docs/dev/style-only-route-measurements.md)
      retains all 24 samples against clean M7 `96ddc06c` on the same 2.90GHz host:
      default ABBA and one cumulative pair, both scenarios cold/warm. Every
      classification completes with exact membership; no uncapped supplement
      is triggered. M8 routes all 5,520 cumulative style views, reducing time
      19.5% cold / 10.3% warm. Default results show no consistent speedup and
      both contextual Decision 13 style thresholds remain unmet. CPU/steal,
      heap, full document/inline counts, delivery headroom and restoration
      hashes are retained; no Decision, contract or implementation changes.
- [x] Update `src/review/README.md` and the contracts' Delivery Status for
      delivered parts; run the suite and `cargo xtask check`.
      The October 3–4 post-measurement gate runs with Node 24.19.0 and pinned
      Chromium. The combined command stops at the documented unpatched braces
      audit; under the brief's exception, package, 4,527 unit, 725 browser
      (full rerun), 219 hydration and all non-audit repository checks pass.
      Preserve the first browser run's ArrowDown timeout and the exact matching
      failure on clean prepared M7 (1/30); no source, UI or timeout changes.
      The measurement report retains all verification commands and evidence.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
      Push follows the supervisor's approval of `f28a6251` and the documented
      audit-blocker rule. Formal M8 review and later milestones remain pending.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 8 review findings

Reported by the post-push review of commits `b76a2a90`, `563de1e5`,
`38515667`, `f28a6251` and `5e5111dc`. Recorded for the user's decision.

1. Medium. The quick checks' reserved-marker regex
   `/<(?:[\t\n\f\r !-]|\/\*[\s\S]*?\*\/)*mokly-/i`
   (`src/review/style_source_safety.ts:28-29`, prescribed verbatim in
   `mokly-component-review-fast-path.md:113-115`) backtracks exponentially:
   its comment branch can end at any later `*/`, so every split of a comment
   run is tried. A sheet with a `<` (such as the legacy `<!--` wrapper)
   followed later by a run of consecutive comments doubles the time per extra
   comment: 33 ms at 20 comments, 435 ms at 24, an extrapolated 30 s per view
   at 30 and hours at 40, on every identical view (and both sides of
   ignore-only views), with no timeout; repeated unterminated `</*` is
   quadratic, and escape decoding is repeated for every view sharing a sheet.
   Recommended: match each comment exactly one way
   (`\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\/`) or use a linear scanner, with a
   time-bounded regression test and the contract updated; cache the guard
   result by style text; and add a regex-safety lint (for example
   `eslint-plugin-regexp`'s `no-super-linear-backtracking`) across `src/`.
2. Low. A reserved marker that appears only after the full comparison removes
   an eligible style element is invisible to the style route and both quick
   checks: HTML treats `<<style>` as a literal `<` followed by a style
   element, so `<` + `<style>…</style>` + `!--mokly-review-material:<id>:<64 hex>-->`
   is valid input that becomes a real marker once the element is removed. In
   both modes the route returns `style`/`changed` and the quick checks return
   `fast`/`unchanged` or `ignored-only` where the full comparison throws
   "material signal for clock has no region". It needs a raw `<` immediately
   before `<style>`, which React produces only through raw HTML injection.
   Recommended: one shared join guard (check the 9 code units before and after
   each run of adjacent eligible styles for `<!--mokly-`) used by the route
   and both quick checks in both modes and under all four switch settings,
   both contracts amended, and the join rule stated in Milestone 9's
   reserved-prefix guard.
3. Low. In committed mode the route and the identical-text quick check still
   throw a missing-file error the full comparison never raises: raw seeds
   include `url()` inside selector arguments, which stored rule references skip,
   and the head side of the proof still uses required reads (only the base side
   became optional in Milestone 8). With `.x::foo(url(../missing.svg)){…}` and the
   file absent, the route throws while the full comparison returns `changed`
   (identical-text check: throws versus `unchanged`). Recommended: traverse the
   head proof closure with optional reads too and fall back on any absence, and
   adopt one shared rule and test that an optimization never raises a read
   error (any read failure is a failed proof).
4. Low. The measurement report's figures all match the raw evidence, but its
   own table shows unattributed time ("Rest") on routed cumulative views rising
   from 32.16 to 45.20 s cold and from 29.43 to 49.03 s warm while no-change
   Rest moves about 1 s, and the text attributes the remaining cost only to
   inline-rule work. A probe on real cumulative pages finds 2.7–3.0 ms per view
   of untimed route work on about 159 KB pages (walking every head rule's stored
   references through a generator about 1.3 ms, the prefix/suffix window scan
   about 0.56 ms, flattening and scanning the composed rule blocks about
   0.5–0.7 ms), roughly 10 s of the growth. Recommended: a report addendum and a
   Milestone 9A TODO; a document-work timer for the route's own steps, cached
   per-run reference lists or an equivalent cheaper proof, a native chunked
   window comparison and a work-bound test; and a reporting rule that any Rest
   change beyond same-code spread must be explained.

## Milestone 9: Fingerprinted Comparison Materials

Summary: keep page style text out of comparison materials so the full
comparison's text work no longer grows with the style sheet. See the
[checkpoint report](../docs/dev/fingerprinted-materials-checkpoint.md).

- [x] Discovered: resolve the [normalization-created fingerprint prefix gap](../docs/dev/fingerprinted-materials-guard-gap.md)
      with the supervisor-approved bounded seam guard over delivered material
      recipes. Preserve exact text on either-side original or joined prefixes,
      including normalization, copies and inserts. The eight all-switch/mode
      regressions now retain changed/material. Option B was rejected because
      it does not protect rule fingerprints. M8 review findings stay unmodified.
- [x] Discovered: fix expanded catalogue replay supplementary reads in the
      test harness alone. Before/after coverage stays 7,844 fingerprinted views
      across 382 catalogues and 764 mode pairs; the RNW cases retain 64/64.
- [x] Discovered: preserve the delivered M8 text renderer and an internal
      test-only material switch before changing construction. Compare complete
      results/errors and retained references against that oracle in both modes.
- [x] Discovered: keep every M8 marker fallback on delivered text materials;
      prove literal, escaped and separator-joined cases, and that the style route
      performs no fingerprint work. Preserve full validation and error identity.
- [x] Discovered: prove bounded constructed material, material-normalization
      and downstream hash inputs as cumulative sheets grow; record fingerprint
      input work separately from the material consumers it replaces.

- [x] Replace the appended canonical rule text with the rule fingerprint, and
      style elements of skipped analyses with in-place fingerprints; take the
      references of fingerprinted rules from their stored references. Apply
      the reserved-prefix guard to both originals and all rewrite seams; retain
      verbatim text materials on guarded views; materials and consumers stay strings.
- [x] Add a differential test: state, `material`, reasons, resource evidence
      and owned sets equal those of text materials for every inline, CSS and
      Changes test catalogue, with all movement, reserved-prefix fallback and
      string-normalization/hashing cases under the
      [fingerprint proof](../docs/protocol/mokly-page-analysis.md#fingerprinted-materials).
- [x] Discovered: address the supervisor's M9 checkpoint findings test-first:
      retain skipped styles with raw source references; reject reserved markers
      created/completed by material seams; add seeded guard-model/catalogue
      differentials, isolated guard mutations and exact counter integration tests.
- [x] Discovered: compare catalogue replays with their original same-mode
      outcome, explicitly exclude the named pre-existing alias divergences,
      pin coverage, update delivery/index docs, and remove redundant conditions.
      The [follow-up report](../docs/dev/fingerprinted-materials-follow-up.md)
      records the fixes, seeded proofs, mutation evidence and named alias issue.
- [x] Discovered: finish the follow-up targeted/full unit, pinned browser and
      hydration suites plus static checks; record all mutation results, commit
      new checkpoint commits without pushing, and stop before measuring. All
      1,646 targeted, 4,736 unit, 725 pinned-browser and 219 hydration tests pass;
      all 19 mutation attempts failed tests (the second round identifies the
      insert-opener attempt as test-only); earlier evidence is retained. Package
      and static checks pass with no authored changes during the frozen run.
- [x] Discovered: second supervisor follow-up: prove every skipped style's
      exact outer-source occurrence is eligible on each original side; otherwise
      keep text. Add compiled instance/slot/ignore regressions and seeded cases,
      investigate seam-created copies, and retain RNW/design fingerprint coverage.
- [x] Discovered: marker stripping inside an owned style admits a new identical
      copy. Extend the skipped proof with indexed style prefixes/endings and bounded seam
      windows; record the compiled failure and the conservative fallback rule.
- [x] Discovered: remove unreachable seam incoming/insert-index branches,
      document closed producer inserts, and correct the earlier mutation claim.
      The [second follow-up report](../docs/dev/fingerprinted-materials-second-follow-up.md)
      records the regression, mutation and unchanged fixture-coverage evidence.
- [x] Discovered: finish second-round targeted/full unit, pinned-browser and
      hydration suites and static checks; commit locally and stop before measuring.
      All 1,698 targeted, 4,788 unit, 725 pinned-browser and 219 hydration tests
      pass, plus package/static checks. All eight mutations are caught; RNW
      64/64, design 428/428 and replay 7,844 fingerprinted-view counts are unchanged.
      The frozen verification recorded no authored-file changes.
- [x] Discovered: third supervisor round: require original/delivered identity
      for skipped styles; reject marker/header rewrites touching their outer spans.
      Add compiled tag-marker regressions and a seeded kind.
- [x] Discovered: make style-copy seam checks position-exact for the same source
      length and ending, restore interleaved-style fingerprints, and compare a seeded
      guard model with brute-force crossing occurrences. Prove bounded reads with
      search/slice/regexp spies and mutations; report before/after coverage.
      The [third follow-up report](../docs/dev/fingerprinted-materials-third-follow-up.md)
      records failing regressions, the seeded proof and nine caught mutations.
- [x] Discovered: finish third-round targeted, package, full unit, pinned browser,
      hydration and static verification; commit a new local checkpoint and stop
      before measurements or pushing. All 1,732 targeted, 4,822 unit, 725 pinned
      browser and 219 hydration tests pass; package and static checks pass with
      no authored changes during verification. Nine mutations are caught. RNW,
      design and replay coverage is unchanged; interleaving improves from 0/16
      to 16/16 fingerprinted views.
- [ ] After supervisor checkpoint approval, record all four scenarios
      (no-changes, component-style, screen-markup, linked-stylesheet), cold/warm,
      against M8 `5e5111dc` on the same host: default ABBA and one cumulative pair.
      Retain every sample, path/document/material/normalization counts and heap;
      use paired unprofiled uncapped runs for any incomplete cells per the brief.
- [x] Update relevant READMEs and the contracts' Delivery Status for delivered
      fingerprints, preserve the 250-line protocol caps, and record the approved
      gap fix and M8 review findings.
- [x] Discovered: extend the CLI timing envelope assertion with the nine new
      integer counters and the bounded-seam invariant. The initial full run
      caught its obsolete field allowlist in three tests; retain unknown-field
      rejection and verify timing does not change exported bytes.
- [x] Discovered: finish focused tests and mutation checks, package, full unit,
      pinned-Chromium browser/hydration and non-audit static checks. Commit the
      code checkpoint without pushing; report and stop before measurements. The
      [checkpoint report](../docs/dev/fingerprinted-materials-checkpoint.md) records
      1,540 focused, 4,631 unit, 725 browser and 219 hydration passes, all 13
      caught mutations, the final 117-test rerun and passing static checks.
- [ ] After approved measurements, run `cargo xtask check` with pinned Chromium
      under the brief's audit-blocker rule.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 9A: Residual Sheet Cost Checkpoint

Summary: close the measured cost left by M7 to M9 before acceptance. M6's
[model](../docs/dev/large-fixture-cost-model.md#plan-consequences) leaves
sheet-proportional scanning, cache/run lookup and cancellation (about 63–72 s
in the cumulative style envelope), even when full material composition is
avoided. This is new measured work, not permission to implement the recorded
M5 review's alternative cancellation design.

Unapproved candidate moved from M8 by the supervisor: prove actual/projected
material equality from residual multisets and equal retention of cancelled
occurrences, avoiding sorting/copying/concatenation of cancelled rules for
equality alone. This requires the user's approval and a change to the route
contract's Result and proof sections before implementation (M6 finding 2).

- [ ] Reconcile the post-M9 counts/profiles with M6's ranges. Record per-path
      costs and identify the remaining obstacle to every Decision 13 ratio;
      if the targets already hold, record that evidence instead of adding work.
- [ ] If residual sheet work still dominates, design a contract-preserving
      bound on unchanged-prefix/suffix scanning, lookup and cancellation, or
      another measured remedy. Preserve current segment equivalence, bounded
      flat retention, ordinals, grouped displacement and pair-wide fallback.
      Ask for approval before any new cache semantics or Decision/contract
      change; the checkpoint does not choose an unapproved algorithm.
- [ ] Implement an approved remedy only if required; add failing work-bound
      tests first, plus full-result differentials and production-path GC tests.
      Prove that unique-sheet/Emotion cold costs do not conceal a default
      regression; consider lazy derived data only if the breakdown supports it.
- [ ] Update relevant READMEs and delivered statuses if code changes; finish
      targeted/full unit/browser/static checks, commit the code checkpoint and
      stop for supervisor verification before measuring.
- [ ] Record supervisor-approved no-change/style cold/warm samples on both
      fixtures and unique-sheet cold-cost evidence, retaining every outcome;
      confirm which targets now hold and any remaining design decision.
- [ ] Validate documentation, run the suite and `cargo xtask check` on the
      measured result if implementation changed; documentation-only conclusions
      use the repository's Markdown validation exception.
- [ ] `git add -A`, commit with Conventional Commits, and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 10: Performance Acceptance And Final Alignment

Summary: prove the Decision 13 targets on both fixtures, record what now
dominates, and leave every document aligned.

- [ ] Discovered: before regenerating fixtures or running acceptance, fetch
      and merge the latest `origin/main` under
      [Mainline Feature Preservation](../AGENTS.md#mainline-feature-preservation).
      Capture the source tip, audit main's additions, reconcile each path
      without bulk side-taking, preserve delivered features and record the
      reconciliations/deletion audits in the merge commit. Leave PR #122 and
      later main commits unmerged until this step; do not rebase or force-push.
- [ ] Discovered: before final acceptance, the complete browser and hydration
      suites, including `component_design_navigation`, `design_library_runtime`,
      `design_links`, `preview_design_links`, `preview_navigation` and
      `standalone_appearance_history`, must pass in CI with pinned Chromium or
      on a host whose `machine.cpu` matches the M2 reference (2.90GHz Xeon).
      Include the additional Browse light-only and desktop component-preview
      waits retained by the second-round gate investigation; no skipped or
      excepted tests satisfy this final complete-suite gate.
      The reboot moved M7 to a 2.50GHz host; the six specs fail fixed waits on
      M6 too, with median per-test slowdown 1.46×. The M7 checkpoint exception
      is not final acceptance. Keep benchmark machine-contract decisions pending
      the user's resolution; this TODO changes no Decision 13 condition.
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
