# Unchanged View Fast Path

## Status And Outcome

Milestone 1 is complete: the protocol docs, review README, and workspace
README now define the unchanged view decision, its output equivalence
requirement, the derived-mode byte gate, and the `review.compare-screens`
counts record. Implementation has not started. Created after profiling the background Changes classification on
the example catalogue: a run with zero changed paths costs the same as a run
with real changes, because every paired view goes through the complete
comparison regardless of whether anything could differ.

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
range validation, CSS analysis, or implementation diffing. The result must be
byte-identical to the result the complete path produces today for every view.

Success criteria:

- Zero-change classification of `examples/basic` completes `changes.classify`
  in well under one second on the same machine that measured 3.1 seconds.
- `review.resource-graph` span count for a zero-change run is at most one per
  paired view plus one per added or removed view.
- A differential test proves fast-path and complete-path results are deeply
  equal across the shared fixtures, including the large fixture generator's
  small instance.

## Scope

In scope:

- An early unchanged decision in `compareComponentView` for views present on
  both sides.
- Reuse of the single resource discovery performed by that decision when the
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

1. Compute the actual normalized pair with `normalizeReviewPair`, passing the
   historical-marker-stripped base and the marker-stripped head. This is the
   same normalization the complete path uses for its actual comparison. `stripMarkers` currently
   validates ranges when `usage` is present and no ranges are supplied; the
   fast path must not pay that parse, so the marker strip must be separable
   from validation (see Milestone 2).
2. If `actual.base !== actual.head`, take the complete path. The view is
   `changed` under the existing contract.
3. Otherwise discover the head document's reachable resources once through
   `afterReader.resources(after.path, actual.head, () => false)`.
4. If any discovered route, prefixed to a repository path, is in
   `changedPaths`, take the complete path. Owned or excluded stylesheets may
   still produce evidence or exclusions there.
5. In derived mode, additionally compare the bytes of every discovered route
   between the two readers with `changedResourceBytes`. Any difference takes
   the complete path. This is the same check the complete path applies to the
   actual pair, so it cannot report a resource change the complete path would
   not.
6. Otherwise the view is unchanged by resources. Its state is `unchanged` when
   `projected.rawEqual` would be true and `ignored-only` otherwise. `rawEqual`
   compares `normalizeSingleDocument` of each stripped side; the fast path
   computes exactly that string equality, which needs no parse. `ignoredIds`
   come from `actual`. `reasons`, `ownedResources`, and
   `changedImplementations` are empty, and the view carries no `material`,
   `reasons`, or `excludedResources` fields.

Why the shortcut is sound under the existing contract:

- `material` on a view means normalized documents differ. Equal `actual`
  strings means no material change.
- `changedComponentImplementations` compares range contents of paired
  instances. Identical documents have identical ranges, so the set is empty.
- Dependency reasons and `excludedResources` require a path in `changedPaths`
  that is reachable from the view. Step 4 rules that out. The complete path
  discovers resources from the projected documents as well as the actual ones,
  but projection only removes proven component-owned material from the actual
  document, so the projected resource set is a subset of the actual one.
- `resourceChanged` in derived mode requires a reachable byte difference.
  Step 5 rules that out.
- Entry-level `metadata`, `inputs`, `structure`, `added`, and `removed`
  reasons do not depend on `compareComponentView` output for equal documents:
  `inputs` and `structure` are computed by `projectComponentPair` from the
  manifest usage records, not the HTML. The fast path must still compute
  those two signals from usage records so `reasons` stays complete. They are
  cheap `canonicalJson` comparisons of instance metadata and need no parse.

The last point is the one real subtlety: `projectComponentPair` reports
`inputs` and `structure` from manifest usage even when the HTML is identical.
The fast path must call the same helper logic (extracted so it does not require
the projected documents) and push those reasons, otherwise a prop edit that
does not change the render would silently drop its `inputs` reason.

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
      decision" subsection under the materiality policy stating the six-step
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
      most one per paired view plus one per one-sided view).
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

- [ ] In `src/review/component_view.ts`, before range validation for a
      two-sided view, compute the actual normalized pair using the new
      marker-strip helper and compare the strings.
- [ ] When equal, discover head resources once through
      `context.afterReader.resources`, check `context.changed` for each
      prefixed route, and in `compareResourceBytes` mode run
      `changedResourceBytes` over the discovered set against both readers.
- [ ] When no resource is changed, return the fast-path result: state from
      the raw-equality check, `ignoredIds` from the normalized pair, reasons
      limited to `inputs`/`structure` from the extracted helper, empty
      `changedImplementations` and `ownedResources`, no `material`,
      `reasons`, or `excludedResources` on the view.
- [ ] When any check fails, continue into the existing complete path
      unchanged, passing the already-discovered head resource set through so
      `ResourceComparison.compare` on the actual pair does not repeat it.
      This requires an optional `resources` override on
      `ComponentMaterialReader.resources()` or a cache keyed by
      `(route, html)`; choose the cache, since it also benefits the complete
      path and mirrors `ChangedResourceGraph#viewResources`.
- [ ] Emit `timingCounts("review.compare-screens", ...)` from
      `classifyComponents` with `views`, `fastPath`, and `completePath`.
- [ ] Keep `src/review/component_view.ts` under 300 lines; if the fast path
      pushes it over, move the decision into
      `src/review/component_view_fast_path.ts`.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`.
- [ ] Run `cargo xtask check`.
- [ ] `git add -A`, commit, push.

## Milestone 4: Prove equivalence and cover edge cases

- [ ] Add `tests/component_fast_path_equivalence.test.ts`: for each shared
      fixture used by `component_changes.test.ts`,
      `component_asset_changes.test.ts`, `changes_css_*.test.ts`, and the
      small large-fixture instance, run `classifyComponents` once normally and
      once with the fast path disabled through an injected flag on
      `ComponentViewContext`, and `assert.deepEqual` the two
      `ReviewResultV3` values. The flag is test-only and defaults to enabled.
- [ ] Add explicit cases for: identical documents with a changed prop that
      does not alter the render (`inputs` reason must survive); identical
      documents with a changed reachable stylesheet (must take the complete
      path and report `dependency` or exclusion evidence); identical documents
      with a differing ignored region only (`ignored-only`, correct
      `ignoredIds`); derived mode with an identical document and a
      byte-changed image with no Git path (must be `material`); identical
      documents whose only changed resource is component-owned CSS on a
      screen (must still reach `ownedCssReasons`); historical `mokabook-`
      markers on the base side (marker-only rename stays unchanged).
- [ ] Extend `tests/component_classification_performance.test.ts` with a
      zero-change classification that asserts the `review.resource-graph`
      span count bound and the `fastPath === views` count.
- [ ] Extend `tests/cli_timings_review.test.ts` or `review_css_timings.test.ts`
      to assert the new counts record shape under `--debug-timings`.
- [ ] Run the full suite (`npm test`), `npm run test:browser` for the
      `changes` browser specs, and `cargo xtask check`.
- [ ] `git add -A`, commit, push.

## Milestone 5: Measure and record

- [ ] Rebuild the large fixture (`npm run fixture:large`) and run
      `npm run benchmark:large`; record cold and warm `changes.classify`
      durations and the `review.resource-graph` count before and after in
      this plan's status section.
- [ ] Serve the example catalogue with `--no-watch`, `--port 0`, and
      `--debug-timings` and record the zero-change `changes.classify`
      duration.
- [ ] Smoke test watched Serve on the example: edit one screen entry, confirm
      the Changes filter shows only that screen and that the reclassification
      completes visibly faster than before.
- [ ] Update `plans/README.md` to move this plan to Completed on merge.
- [ ] Run `cargo xtask check`.
- [ ] `git add -A`, commit, push.
- [ ] Review: after the push, use `docs/implementation-review-prompt.md` to
      review the complete local diff against `origin/main` and report
      findings without changing the implementation.

## Post-merge follow-up (non-blocking)

- Memoize `ComponentMaterialReader.resources()` by `(route, html)` for the
  complete path if Milestone 3 chose the override instead of the cache.
- Cache `canonicalJson` encodings of usage records across views of the same
  entry.
- Replace the DOM parse in `extractHtmlReferences` with a tokenizer, guarded
  by a differential test over every fixture document.
