# Unchanged View Fast Path

## Status And Outcome

The original implementation and measurement milestones are complete. The fast path
preserves complete-path output across the differential fixture matrix, keeps
resource and derived-byte gates intact, and emits explicit path counts.

All eight approved findings are addressed and pushed. Milestone 9 implements
the approved projection-aware resource proof for Finding 8, including the
related instance-removal case found during supervision. The complete branch
passed its checks and post-push review with no new findings. This plan remains
Active until the PR merges.

The final example measurement took medians of three warmed shortcut runs:
1,064 ms committed and 1,451 ms derived. Complete comparison in the same
process took 1,891 ms and 1,959 ms respectively. The stronger resource proof is
about 44% and 26% faster than complete comparison, while roughly doubling the
earlier shortcut medians of 485 ms and 725 ms. These are local observations,
not fixed performance guarantees. All 276 views retain the shortcut and match
complete output in both modes. Resource discoveries increase from 276 to 446
in committed mode and from 552 to 892 in derived mode.

These historical measurements predate the independent two-sided resource
traversal added by Milestone 7. Measurements on the same VM compare the background worker's
`changes.classify` span, excluding baseline preparation:

| Example zero-change run | Cold process | Warm restart | `review.resource-graph` |
| ----------------------- | -----------: | -----------: | ----------------------: |
| Before                  |        3.2 s |        3.1 s |           2,208 per run |
| After                   |     909.5 ms |    902.26 ms |             277 per run |

That historical result was about 72% faster cold and 71% faster warm, with 87%
fewer resource discoveries. Both after runs sent all 276 paired views through
the fast path. The historical derived-baseline preparation was 18.4 seconds
cold and 0.3 seconds on a warm cache hit; that separate cost is unchanged and
out of scope.

The regenerated default large fixture contained 1,410 routes and 5,550
documents. Its deliberate shared-stylesheet edit produced a mixed workload:
5,520 paired views, 3,120 fast-path views, 2,400 complete-path views, and
12,750 resource discoveries. `changes.classify` took 31.2906 seconds on the
cold process and 32.16244 seconds on the warm restart; the benchmark completed
with zero changed routes as expected. This is a scale smoke test, not the
zero-change acceptance workload above.

A watched title edit to `design-browse-tag-forms` reclassified in 925.27 ms
with 274 fast-path and two complete-path views and 287 resource discoveries.
Browse reported exactly one changed screen, that screen alone, and returned to
zero after the source was restored byte-for-byte.

## Problem

Mokly's Changes filter compares the current catalogue against the merge-base
baseline. `classifyComponents` in `src/review/component_classification.ts`
calls `compareComponentView` for every paired view. For a view present on both
sides that function always:

1. validates component ranges on both documents (two `parse5` parses with
   source locations);
2. projects the pair through `projectComponentPair`;
3. runs `ResourceComparison.compare` on the projected pair and again on the
   actual pair (four resource discoveries, each a full `parse5` parse);
4. in derived mode, runs `changedResourceBytes` on projected and actual
   resource sets (four more discoveries);
5. computes `changedComponentImplementations`, which encodes instance records
   with `canonicalJson`.

Measured on `examples/basic` (122 entries, 276 paired views) with the warm
baseline cache, `changes.classify` takes about 3.1 seconds with zero changed
paths and produces 2,208 `review.resource-graph` spans (8 per view). About
half of the CPU is `parse5`. The cost scales with catalogue size, not with the
size of the change.

## Goal

Make the cost of classification scale with what changed. A paired view whose
normalized documents are identical and whose reachable resources are
unchanged must be reported `unchanged` (or `ignored-only`) without projection,
range validation, CSS analysis, or implementation diffing when it has no
ownership text edits. Views with instances, styles, or entry-owned slots perform the projection and range validation
needed for their additional resource proof, while still skipping CSS analysis
and implementation diffing when safe. The result must be byte-identical to the
result the complete path produces today for every view from valid builder
output. Identical handcrafted malformed ownership records are outside that
guarantee.

Success criteria:

- Zero-change classification of `examples/basic` remains materially faster
  than complete comparison after every required actual and projected resource
  proof.
- `review.resource-graph` span count for a zero-change run is at most one actual
  discovery per fast-path-eligible paired view in committed mode and two in
  derived mode. Views with instances, styles, or entry-owned slots may add one committed or two
  derived projected discoveries; one-sided views add one.
- A differential test proves fast-path and complete-path results are deeply
  equal across the shared fixtures, including the large fixture generator's
  small instance.

## Scope

In scope:

- An early unchanged decision in `compareComponentView` for views present on
  both sides.
- Reuse of each side's resource discovery performed by that decision when the
  view falls through to the complete path.
- Protocol and README updates that define the decision as part of the
  materiality contract.
- Timing counts that expose how many views took each path.
- Tests: differential equivalence, edge cases named below, and a span-count
  assertion on the timing contract.

Out of scope, tracked separately:

- Memoizing `ComponentMaterialReader.resources()` and `canonicalJson` for
  views that take the complete path.
- Replacing the DOM parse in `extractHtmlReferences` with a tokenizer.
- The derived-mode baseline rebuild cost; it is inherent and cached.
- Any change to the live per-document path in `src/server/changed_content.ts`,
  which already caches resource discovery per document text.

## Decision Rule

For a paired view with base document `B` and head document `H`, both retained
as text by the material readers:

1. Normalize historical marker prefixes in `B`, retain component markers on
   both sides, and apply paired manual-ignore normalization. If the results
   differ outside paired ignored regions, take the complete path. This guards
   the marker positions consumed by ownership projection.
2. Compare usage records canonically. Both absent records qualify and one
   absent record does not. With records on both sides, only `props` and
   `propsKey` on entry-owned instances may differ. View axes; instance ids,
   keys, component ids, owners, slot keys and order; instance-owned props and
   prop keys; and all slots, ranges, styles, and resources must match.
   Invocation `source` metadata is excluded, as it is from every projection.
3. If the view route changed, take the complete path. Otherwise compute the actual normalized pair by stripping historical component
   markers from `B`, stripping current component markers from `H`, and applying
   paired manual-ignore normalization. Discover the head closure in committed
   mode and both closures independently in derived mode.
4. When either usage record has instances, styles, or entry-owned slots, validate historical and
   current ranges in their respective dialects, compute the same root-specific
   ownership projection and exclusion callback as complete comparison, require
   projected document equality, and discover projected closures independently.
5. If any actual or projected route, prefixed to a repository path, is in
   `changedPaths`, take the complete path. Owned or excluded stylesheets may
   still produce evidence or exclusions there.
6. In derived mode, compare historical and current closure membership and bytes
   separately for actual and projected material. Any difference takes the
   complete path; equal unions do not establish equivalence.
7. Otherwise the view is unchanged by resources. Its state is `unchanged` when
   `projected.rawEqual` would be true and `ignored-only` otherwise. `rawEqual`
   compares `normalizeSingleDocument` of each stripped side; the fast path
   computes exactly that string equality, which needs no parse. `ignoredIds`
   come from `actual`. Entry-owned input or structure signals remain in the
   comparison reasons; otherwise reasons are empty. `ownedResources` and
   `changedImplementations` are empty, and the view carries no `material`,
   resource `reasons`, or `excludedResources` fields.

Why the shortcut is sound under the existing contract:

- Marker-retaining equality protects every range boundary and projection
  position; marker-stripped equality alone does not.
- Usage-topology equality protects nested inputs, ownership, instance identity,
  slots, ranges, styles, and resources used by projection and
  `changedComponentImplementations`.
- Dependency reasons and `excludedResources` require a path in `changedPaths`
  that is reachable from the view. Step 5 rules that out for eligible views.
  Projection usually removes component-owned material, but HTML parsing can
  discard caller-owned resources that projection exposes. Removing component
  implementation text can also expose a sibling hidden by unclosed HTML. Step
  4 proves the projected closure directly whenever ownership records can edit
  text.
- `resourceChanged` in derived mode requires a reachable byte difference.
  Step 6 rules that out.
- Entry-owned prop values are the sole allowed usage difference. `inputs` and
  `structure` are still computed by the same usage-record helper used by
  `projectComponentPair`, so an unchanged render retains its `inputs` reason.
- Entry-level `metadata`, `added`, `removed`, and dependency reasons are
  computed outside the per-view comparison.

Added and removed views do not use this decision. Their shared one-sided
normalization validates recorded ranges before stripping markers, using the
historical dialect for the base and the current dialect for the head.

## Related Contracts

- [Component change attribution](../docs/protocol/mokly-component-changes.md)
- [Component comparison v3 schema](../docs/protocol/mokly-component-review.md)
- [Derived baselines](../docs/protocol/mokly-derived-baselines.md)
- [Startup diagnostics and scale fixtures](../docs/protocol/mokly-timings.md)
- [Changes and screen comparisons](../docs/protocol/mokly-changes.md)

## Milestone 1: Define the fast-path contract

Document the decision rule so implementation needs no guesswork and so the
existing protocol remains internally consistent.

- [x] In `docs/protocol/mokly-component-changes.md`, add a "Unchanged view
      decision" subsection under the materiality policy stating the decision
      rule above, that it must produce output equal to the complete
      comparison, and that `inputs`/`structure` reasons are derived from
      usage records independently of document text.
- [x] In `docs/protocol/mokly-component-review.md`, state under "Reasons And
      Secondary Evidence" that a view reported `unchanged` or `ignored-only`
      through the fast path carries no `material`, `reasons`, or
      `excludedResources` fields and an empty implementation-impact
      contribution, identical to the complete path.
- [x] In `docs/protocol/mokly-derived-baselines.md`, "Head side", note that
      derived membership's reachable-resource byte comparison also gates the
      fast path, so a byte difference without Git evidence still takes the
      complete comparison.
- [x] In `docs/protocol/mokly-timings.md`, define a `review.compare-screens`
      counts record with `views`, `fastPath`, and `completePath` totals, and
      state the zero-change bound on `review.resource-graph` occurrences (at
      most one per paired view in committed mode and two in derived mode, plus
      one per one-sided view).
- [x] Update `src/review/README.md` with a short description of the two paths
      in `compareComponentView` and where the decision lives.
- [x] Update the workspace `README.md` performance paragraph to say that
      classification cost follows the size of the change once the baseline is
      cached.
- [x] Validate the changed Markdown (`npm run format:check`, `npm run lint`)
      and review the diff.

## Milestone 2: Separate marker stripping from range validation

`stripMarkers` in `src/components/comparison_material.ts` validates ranges
as a side effect when given `usage` without pre-validated ranges. The fast
path needs the stripped text without the parse.

- [x] Add a pure `stripComponentMarkers(html)` that only performs the regex
      replacement, and make `stripMarkers` call it after its optional
      validation. Keep `stripHistoricalMarkers` behavior unchanged.
- [x] Extract the `inputs` and `structure` signal computation from
      `projectComponentPair` into a pure helper that takes only the two
      `ComponentViewRecord`s, and have `projectComponentPair` call it. Its
      output must be unchanged.
- [x] Add unit tests under `tests/` for both helpers, including a case where
      `inputs` is true with identical documents.
- [x] Run the existing component comparison tests to confirm no behavior
      change.
- [x] Run `cargo xtask check`.
- [x] `git add -A`, commit with a Conventional Commits message, push.

## Milestone 3: Implement the fast path

- [x] In `src/review/component_view.ts`, before range validation for a
      two-sided view, compute the actual normalized pair using the new
      marker-strip helper and compare the strings.
- [x] When equal, discover head resources once through
      `context.afterReader.resources`, check `context.changed` for each
      prefixed route, and in `compareResourceBytes` mode run
      `changedResourceBytes` over the discovered set against both readers.
- [x] When no resource is changed, return the fast-path result: state from
      the raw-equality check, `ignoredIds` from the normalized pair, reasons
      limited to `inputs`/`structure` from the extracted helper, empty
      `changedImplementations` and `ownedResources`, no `material`,
      `reasons`, or `excludedResources` on the view.
- [x] When any check fails, continue into the existing complete path
      unchanged, passing the already-discovered head resource set through so
      `ResourceComparison.compare` on the actual pair does not repeat it.
      This requires an optional `resources` override on
      `ComponentMaterialReader.resources()` or a cache keyed by
      `(route, html)`; choose the cache, since it also benefits the complete
      path and mirrors `ChangedResourceGraph#viewResources`.
- [x] Emit `timingCounts("review.compare-screens", ...)` from
      `classifyComponents` with `views`, `fastPath`, and `completePath`.
- [x] Keep `src/review/component_view.ts` under 300 lines; if the fast path
      pushes it over, move the decision into
      `src/review/component_view_fast_path.ts`.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`.
- [x] Run `cargo xtask check`.
- [x] `git add -A`, commit, push.

## Milestone 4: Prove equivalence and cover edge cases

- [x] Add `tests/component_fast_path_equivalence.test.ts`: for each shared
      fixture used by `component_changes.test.ts`,
      `component_asset_changes.test.ts`, `changes_css_*.test.ts`, and the
      small large-fixture instance, run `classifyComponents` once normally and
      once with the fast path disabled through an injected flag on
      `ComponentViewContext`, and `assert.deepEqual` the two
      `ReviewResultV3` values. The flag is test-only and defaults to enabled.
- [x] Add explicit cases for: identical documents with a changed prop that
      does not alter the render (`inputs` reason must survive); identical
      documents with a changed reachable stylesheet (must take the complete
      path and report `dependency` or exclusion evidence); identical documents
      with a differing ignored region only (`ignored-only`, correct
      `ignoredIds`); derived mode with an identical document and a
      byte-changed image with no Git path (must be `material`); identical
      documents whose only changed resource is component-owned CSS on a
      screen (must still reach `ownedCssReasons`); historical `mokabook-`
      markers on the base side (marker-only rename stays unchanged).
- [x] Extend `tests/component_classification_performance.test.ts` with a
      zero-change classification that asserts the `review.resource-graph`
      span count bound and the `fastPath === views` count.
- [x] Extend `tests/cli_timings_review.test.ts` or `review_css_timings.test.ts`
      to assert the new counts record shape under `--debug-timings`.
- [x] Run the full suite (`npm test`), `npm run test:browser` for the
      `changes` browser specs, and `cargo xtask check`.
- [x] `git add -A`, commit, push.

## Milestone 5: Measure and record

- [x] Rebuild the large fixture (`npm run fixture:large`) and run
      `npm run benchmark:large`; record cold and warm `changes.classify`
      durations and the `review.resource-graph` count before and after in
      this plan's status section.
- [x] Serve the example catalogue with `--no-watch`, `--port 0`, and
      `--debug-timings` and record the zero-change `changes.classify`
      duration.
- [x] Smoke test watched Serve on the example: edit one screen entry, confirm
      the Changes filter shows only that screen and that the reclassification
      completes visibly faster than before.
- [x] Update `plans/README.md` to move this plan to Completed on merge.
- [x] Run `cargo xtask check`.
- [x] `git add -A`, commit, push.
- [x] Review: after the push, use `docs/implementation-review-prompt.md` to
      review the complete local diff against `origin/main` and report
      findings without changing the implementation.

## Milestone 6: Review fixes

Close the four validated post-push findings without changing the public
classification contract or the zero-change performance bound.

- [x] Update the component attribution protocol, comparison schema, review
      README, and this decision rule with marker-retaining equality, the exact
      usage-topology precondition, cache reuse, and one-sided validation.
- [x] Add unit and differential regressions for usage topology, all three
      identical-render topology reproductions, malformed and well-formed
      one-sided views, fall-through discovery reuse, and derived discovery
      counts; observe the bug regressions fail before implementation.
- [x] Expand differential coverage over every shared component-change case,
      added and removed component views and screens, CSS attribution scenarios,
      a Git-backed asset-byte change, the historical marker case, and the small
      generated catalogue.
- [x] Implement the conservative fast-path eligibility helper, marker-retaining
      document gate, shared one-sided normalization, and unfiltered derived
      resource-cache reuse while keeping `component_view.ts` under 300 lines.
- [x] Run `npm run build`, targeted tests, `npm test`, and
      `cargo xtask check`, requiring a 100% pass rate.
- [x] `git add -A`, commit the completed work with a Conventional Commits
      message, and push `origin/calummoore/trenton-v2`.
- [x] Merge `origin/main` (viewer package extraction, invocation `source`
      metadata) and exclude `source` from the usage-topology gate through the
      shared `instanceStructure`/`instanceInputs` helpers, so a line shift alone
      keeps every view on the fast path; cover it with a unit test and a
      classification counts test.
- [x] Review: after the push, use `docs/implementation-review-prompt.md` against
      `origin/main` and report findings without changing the implementation.

## Milestone 7: Post-review correctness fixes

Resolve the six approved findings from the completed review while preserving
the shortcut only when it is equivalent for valid builder output.

- [x] Update the protocol, review README, plan decision rule, performance
      wording, and active-plan index before implementation.
- [x] Add differential regressions for added and removed stylesheet imports,
      relocated routes with relative assets, and committed historical-only
      changed dependencies. Verify the added-import and both relocation cases
      fail before the fix; cover cache identity and isolated fixture setup.
- [x] Discover both actual resource closures independently in derived mode,
      make route moves use the complete path in both modes, and preserve real
      discovery/read failures.
- [x] Key resource discovery by a content digest and exclusion callback identity,
      without retaining whole HTML documents as map keys.
- [x] Extract comparison-count tallying from `component_classification.ts`.
- [x] Run formatting, build, type checking, and all relevant tests with a 100%
      pass rate; run the final full `cargo xtask check`.
- [x] `git add -A`, commit the completed work with a Conventional Commits
      message, and push the branch.
- [x] Review: after the push, use `docs/implementation-review-prompt.md` against
      `origin/main` and report findings without changing the implementation.

Validation passed: `cargo xtask check` ran 1,865 Node tests, 452 Chromium tests,
all five packed-consumer scenarios, and three Rust tests. Independent checks
confirmed 24 resource edge cases, isolated fixture startup without `.context`,
and complete-path equivalence for all 276 example views in both modes. The
example used 276 resource discoveries in committed mode and 552 in derived
mode. The added-import and both route-move regressions fail with the original
fast path and pass with the fix; the removed-import control passes both.

The implementation was pushed as `3e671bb`. The post-push review used
`docs/implementation-review-prompt.md` against the complete branch diff and
found one additional issue, independently reproduced by the owner:

7. **Medium — Caller-slot projection can expose resources inside inert templates.**
   The [fast-path resource gate](../src/review/component_view_fast_path.ts#L44)
   discovers actual-document resources only. Valid compiler output with a
   component rendering `<template>{props.children}</template>` and a caller
   supplying `<img loading="lazy" src="../image.svg" />` has no actual resource
   references, but projection moves that slot into ordinary document content.
   The fast path omits a screen dependency in committed mode and a material
   change in derived mode when the image changes. Doing nothing leaves Changes
   membership dependent on the optimization and invalidates the projected-set
   subset assumption above. **A (recommended):** add a conservative reusable
   eligibility guard for template-bearing caller-slot views, compiler-backed
   differential tests in both modes, and a corrected contract. This preserves
   existing comparison behavior at the cost of less optimization for those
   views. **B:** redesign projection and discovery to preserve inert-container
   semantics, a broader behavior change requiring an agreed contract and more
   regression coverage. The user approved Option A; Milestone 8 implements it.

## Milestone 8: Inert template slot eligibility

Prevent actual-document discovery from settling a view when projection can
expose caller-owned resources hidden inside an inert HTML template.

- [x] Correct the protocol and module READMEs: projected resources are not
      universally a subset of actual resources, and eligible-view discovery
      bounds exclude conservatively guarded template-slot views.
- [x] Add compiler-backed committed and derived differential regressions plus
      ordinary-slot and authored-template eligibility controls; capture the
      pre-fix failures under `.context`.
- [x] Add a reusable, inexpensive eligibility guard for caller-owned slots in
      authored templates without an unconditional DOM parse.
- [x] Run formatting, build, type checking, lint, focused tests, and the final
      full `cargo xtask check` with a 100% pass rate.
- [x] `git add -A`, commit the completed work with a Conventional Commits
      message, and push the branch.
- [x] Review: after the push, use `docs/implementation-review-prompt.md` against
      `origin/main` and report findings without changing the implementation.

Validation passed: `cargo xtask check` completed 1,872 Node tests, 452 Chromium
tests, all five packed-consumer scenarios for both packages, and three Rust
tests. The original two regression cases failed before the fix; the expanded
focused suite passed all 34 tests. Independent verification found eight
divergences in a 32-case matrix before the fix and none afterward. All 276
example views still use the fast path and match the complete comparison in
both modes, with 276 committed and 552 derived resource discoveries.

The implementation was pushed as `c76288c`. The complete branch review against
`origin/main` confirmed finding 7 is fixed and identified one new issue,
independently reproduced by the owner:

8. **Medium — Select content exposes the same resource-projection gap.**
   The former template-only guard did not cover a component rendering
   `<select>{props.children}</select>`
   with a caller-supplied lazy image. Compilation succeeds, but HTML parsing
   discards the image from actual select contents while caller-slot projection
   exposes it. The fast path then omits the dependency or material change
   reported by complete comparison in committed or derived mode respectively.
   Doing nothing leaves Changes membership dependent on the optimization.
   **A:** use complete comparison for every view with entry-owned slots. This
   covers the broader class, but removes 146 of 276 example views from the fast
   path, including 138 of 144 screen views. A scratch-only, single-run comparison
   increased committed time from 702 to 2,164 ms and derived time from 1,059 to
   2,310 ms; these timings are indicative, not a formal benchmark.
   **B (recommended):** establish and validate projection-aware resource
   eligibility before allowing the shortcut, with compiler-backed differential
   coverage across HTML contexts and both comparison modes. This broader design
   addresses the underlying assumption while retaining the optimization for
   views that can be proven safe, including a defined fallback when evidence
   is unavailable on either side. **C:** add `select` to the tag guard; this
   treats another example without establishing the general resource guarantee
   and is not recommended. The user approved Option B; Milestone 9 implements it.

## Milestone 9: Projection-aware resource proof (Complete)

Replace element-specific slot guards with direct resource evidence from the
same ownership projection used by complete comparison.

- [x] Update protocols, timing bounds, module READMEs, and this decision rule
      to require separate actual and projected resource proofs.
- [x] Add compiler-backed differential regressions for select placement and
      forwarding, retained template cases, non-image and transitive resources,
      hidden resource-set changes, sibling exposure after instance removal, and
      ordinary-slot fast-path controls; capture pre-fix failures under `.context`.
- [x] Reuse ownership projection and root-specific exclusion policy in the
      shortcut, preserving side-specific derived comparisons and discovery
      cache reuse on fall-through; remove the superseded template tag guard.
- [x] Run formatting, build, type checking, lint, focused tests, and the final
      full `cargo xtask check` with a 100% pass rate.
- [x] `git add -A`, commit the completed work with a Conventional Commits
      message, and push the branch.
- [x] Review: after the push, use `docs/implementation-review-prompt.md` against
      `origin/main` and report findings without changing the implementation.

Validation passed: the final `cargo xtask check` completed 1,890 Node tests,
452 Chromium tests, all five packed-consumer scenarios for both packages,
formatting, lint, type checking, example validation, and three Rust tests.
The focused suite passed 59 tests. Independent owner checks passed all 168
resource/context cases, 16 ownership/historical-marker cases, and eight
instance-removal context cases. The first matrix had 36 mismatches before the
fix. Supervision of the initial entry-slot-only implementation found six
additional mismatches in the instance-removal cases; the final broader proof
resolved all of them. The unchanged example catalogue matches complete output
for all 276 views in both modes; current timings are recorded above.

The implementation was pushed as `db0044f`. The owner and an independent
reviewer used `docs/implementation-review-prompt.md` against the complete
pushed diff from `origin/main` and found no new findings. The working tree was
clean and no files from main were removed. Residual test risk: the fixtures
cannot exhaust every consumer HTML/resource combination; no remaining
divergence was identified.

## Post-merge follow-up (non-blocking)

- Memoize `ComponentMaterialReader.resources()` by `(route, html)` for the
  complete path if Milestone 3 chose the override instead of the cache.
- Cache `canonicalJson` encodings of usage records across views of the same
  entry.
- Replace the DOM parse in `extractHtmlReferences` with a tokenizer, guarded
  by a differential test over every fixture document.
