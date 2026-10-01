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
catalogues without registered components keep their existing classifier.

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
- [ ] Discovered: supervisor decision on remaining cold costs: final/M3
      ratios are 1.2974 (85 KB RNW), 1.2272 (157 KB RNW) and 1.2491
      (1,000 Emotion elements), above the requested approximately 1.10.
      Preserve the measured evidence in
      [the parse-reuse checkpoint](../docs/dev/large-fixture-parse-reuse.md).

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
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 5: Changed-Segment Analysis

Summary: make per-view analysis cost follow the changed segments, pair
unchanged reference-bearing rules only with matched copies, and compose rule
lists from stored rule text.

- [ ] Discovered: capture the M4 engine before changing analysis; verify code,
      targeted/full unit/Chromium/hydration and static checks, commit locally,
      then report and stop before M5 measurements or its final cargo/push gate.

- [ ] Cancel segments by their cached ordered identity-run keys, earliest
      base occurrence first, before the rule diff; diff only the remaining
      runs with original document-wide ordinals.
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
      flag and both materials equal the Milestone 4 engine's for every flat
      sheet (including differently formatted duplicates and React Native Web)
      and the contract's agreeing-survivor grouped/nested domain. Compare
      ordered diffs and actual occurrence pairs under those equality domains;
      flat runs require equal ordinals too. No broad duplicate exemption is
      allowed.
- [ ] Discovered: assert explicit changed pairs and final outcomes for
      displaced shared identities across differently shaped grouped/nested
      runs, including the contract's worked example and custom-property/URL
      variants. The flat red/blue/green example must agree with full diff.
      Test full-diff fallback when either side cannot segment.
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
      resource seeds and transitive closures equal discovery from old text
      materials for every view of the design catalogue, small large fixtures
      and inline test catalogues in the contract's visibility-preserving
      domain. Assert explicit provenance-derived sets for partial spans,
      template/caller copies and parser-recovery visibility differences.
- [ ] Match inline and linked-stylesheet selectors on the original trees with
      the ignore rule, resolve owners on the original ranges, and remove the
      normalized parses. Add original-context tests for a sibling combinator,
      `:nth-child`, `:has()` and `:empty` next to/containing ignored content on
      both paths; every other existing CSS and inline test stays unchanged.
- [ ] Add the identical-text quick check and remove inline analysis from the
      fast path. Test in committed and derived modes that a zero-change
      classification emits no `review.inline-style-analysis` span and parses
      each view once.
- [ ] Discovered: preserve the mode-specific resource-graph bounds in the
      timing contract; prove committed quick checks never traverse the base
      reader and derived quick checks compare both closures independently.
- [ ] Discovered: test flat ignore markers inside raw text, including the
      textarea-bounded style case and its paired/one-sided expected results
      under [ignore pairing](../docs/protocol/mokly-page-analysis.md#contents-and-ignore-pairing).
- [ ] Assert with document-work counts that a full comparison parses each side
      at most once.
- [ ] Run the fast-path, comparison-mode and Changes equivalence suites;
      preserve assertions outside the page contract's explicit provenance/
      ignore-eligibility/context cases. Retain the delivered text-material
      oracle and record old
      and new expectations for every intentionally adapted test, including
      select/template and malformed-HTML projected-resource fixtures.
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
- [ ] Implement every differential and per-view path proof in the
      [route contract's sole test list](../docs/protocol/mokly-style-only-route.md#fallback-counters-and-proof).
      It owns positive cases, precise window/reference guards, all fallbacks
      including `:parent`, view-wide grouped/nested displacement and the
      complete-path oracle. Do not maintain a second case list here.
- [ ] Discovered: reuse all unchanged element runs and full-path preparation
      as the route contract requires; never decide from a changed-element-only
      diff.
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
      references of fingerprinted rules from their stored references. Apply
      the reserved-prefix guard to both original texts and retain delivered
      verbatim materials on guarded views; materials and consumers stay strings.
- [ ] Add a differential test: state, `material`, reasons, resource evidence
      and owned sets equal those of text materials for every inline, CSS and
      Changes test catalogue, with all movement, reserved-prefix fallback and
      string-normalization/hashing cases under the
      [fingerprint proof](../docs/protocol/mokly-page-analysis.md#fingerprinted-materials).
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

- [ ] Discovered: before regenerating fixtures or running acceptance, fetch
      and merge the latest `origin/main` under
      [Mainline Feature Preservation](../AGENTS.md#mainline-feature-preservation).
      Capture the source tip, audit main's additions, reconcile each path
      without bulk side-taking, preserve delivered features and record the
      reconciliations/deletion audits in the merge commit. Leave PR #122 and
      later main commits unmerged until this step; do not rebase or force-push.
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
