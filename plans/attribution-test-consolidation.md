# Attribution Test Consolidation

Status: Active

Restructure `tests/design_library_attribution.test.ts` and
`tests/component_design_attribution.test.ts` so they keep every guarantee at a
fraction of the runtime. The change is test-only. It does not change
classification, compilation, or any product behaviour. The dominant product
cost is recorded under the non-blocking section as a separate plan candidate.

Contract owners:

- [Component design](../docs/protocol/mokly-component-design.md) names the
  shared-stylesheet attribution test.
- [CSS change attribution](../docs/protocol/mokly-css-attribution.md) defines
  dependency reasons and the kept `body` selector.
- [Component review result v5](../docs/protocol/mokly-component-review.md)
  defines `changes`, `reasons`, and `affectedConsumers`.
- [CI suite evidence](../docs/protocol/ci-suite-evidence.md) owns shard balance
  and acceptance measurement.
- [Design library README](../examples/basic/specs/design/library/README.md)
  lists the verification commands and what the tests retain.

## Measured Baseline

The latest green main run,
[GitHub Actions run 37354719684](https://github.com/mokly-ai/mokly/actions/runs/37354719684)
on 2 vCPU runners, recorded these unit file durations in the
`verification-unit-node-22.14.0-shard-*` reports:

| File                                         | Tests | CI duration | Shard (index) | Shard wall time | Shard file time |
| -------------------------------------------- | ----: | ----------: | ------------- | --------------: | --------------: |
| `tests/design_library_attribution.test.ts`   |    33 |       615 s | 4 (339)       |           768 s |          1247 s |
| `tests/component_design_attribution.test.ts` |    10 |       192 s | 1 (236)       |           691 s |          1201 s |
| Shards 2 and 3 for comparison                |       |             |               |   331 s / 290 s |   552 s / 492 s |

Unit shards take whole files by sorted index modulo four
(`nodeShardFiles` in `scripts/verification/evidence.mjs`) and run two files at
a time. The two files hold 807 s of the 3492 s unit file time (23%) and set the
unit critical path. The 33 tests are five top-level tests plus 28 subtests
(16 + 5 + 5 + 2). The design library has sixteen components in
`tests/helpers/design_library.ts`, not 23.

Local measurements in this sandbox (Node 22.14.0, 8 cores) through the real
fixture in `tests/helpers/design_library_fixture.ts`. The whole files take
832 s and 154 s here with `node --import tsx --test <file>`, and the library
subtests take 13–19 s, close to the CI figures:

| Operation                                       | Local time |
| ----------------------------------------------- | ---------: |
| Fixture (copy sources + `compileCatalogue`)     |     17.0 s |
| `classifyComponents` with zero changed paths    |     12.0 s |
| One library stylesheet (tag-chip, 45 consumers) |     11.1 s |
| One library stylesheet (top-bar, 111 consumers) |     16.4 s |
| All 16 library stylesheets in one pass          |     18.7 s |
| All 9 shared design stylesheets in one pass     |     20.9 s |
| All 25 stylesheets in one pass                  |     21.5 s |
| Rebuild after one source edit (`fixture.build`) |     20.3 s |
| `classifyComponents` after that source edit     |     13.9 s |

Cost model: every `classifyComponents` call pays about 12 s before it looks at
a change, because `classificationContext` builds new readers and caches and
every view is normalized and parsed again. Affected views add about 0.04 s
each. Every `compileCatalogue` call costs 16–20 s; a rebuild after one source
edit plus its classification costs about 31 s. Today the two files make 19
compilations and 39 classifications: five fixtures, thirteen rebuilds, sixteen
library edits, nine shared edits, twelve source-edit classifications, and two
classifications in the committed-baseline test. That is about 850 s at CI
speed, which matches the 807 s observed.

## What The Tests Prove Today

`tests/design_library_attribution.test.ts`:

1. `each exclusive library stylesheet changes its component and only affects real consumers`
   (16 subtests). Per component: reset, append `body { outline-width: 3px; }`
   to its stylesheet, classify. The only change is `design/library/<group>/<slug>`.
   Every shared component has real screen consumers in the manifest
   (`generatedViews` usage instances). The affected screen consumers equal
   exactly those consumers. For `tag-chip`, the `chrome/top-bar` consumer's
   evidence lists only variant `design/library/chrome/top-bar/tag-picker` and
   the chain `top-bar/tag-picker/tag-chip`.
2. `real implementation and saved metadata edits have distinct impact`
   (5 subtests). Each edit rebuilds and classifies. `top-bar.view.tsx` and
   `tag-chip.view.tsx` edits change only their component and affect consumers.
   The three `top-bar.tsx` metadata edits change only `chrome/top-bar/search`,
   `chrome/top-bar`, and `chrome/top-bar/search`, and affect no consumer.
3. `real screen inputs, destinations, slots and ordered instances remain screen-owned`
   (5 subtests). Five `use-case.tsx` edits each change only
   `design/browse/views/use-case` and affect no consumer.
4. `screen query and field values remain direct changes in their owning designs`
   (2 subtests). `picker.tsx` changes only `design/browse/views/screen/tag-picker`;
   `fixtures.ts` changes only `design/components/controls/states/invalid`.
5. `the committed catalogue uses one baseline view batch and agrees across Serve and comparison`.
   A committed-mode fixture edits `tag-chip.view.tsx`, writes the build, and
   proves `computeChangedPaths`, one baseline view batch, single resource
   reads, and `compareReview` agreement with `classifyComponents`.

`tests/component_design_attribution.test.ts` (9 subtests): per shared
stylesheet, reset, append `body { gap: 17px; }`, classify. The expected entries
are those whose rendered views link the stylesheet; their screen count is 39,
11, 0, or every `design/` screen, and their component count is 69. `changes`
equals that set exactly. Every change stays under `design/` except for
`design.css`, whose change set is unchanged and whose path appears in
`sharedImpact`.

Isolation is part of every guarantee: a change to one stylesheet is never
attributed to another component or to an unrelated screen.

## Evidence For One Multi-Edit Pass

Code evidence:

- `affectedConsumers` in `src/review/component_affected.ts` groups records by
  `affectedConsumerOrderKey({ changedComponentId, consumer })`. Each record
  carries `changedComponentId`, so consumer attribution is per changed
  component, not per classification.
- `ChangedEntry.reasons` carries one `DependencyReason` per stylesheet path.
  `CssResourceAnalysis.analyze` in `src/review/css/resource_analysis.ts`
  analyses each changed resource independently against the same parsed
  documents, and `uniqueReasons` merges reasons by `kind:path`. A view's
  evidence for one stylesheet does not depend on which other stylesheets
  changed.
- `propagateOwnedCss` in `src/review/component_resource_attribution.ts` adds
  each stylesheet path to its owning component's `sharedImpact`, so the owner
  mapping is visible per path.
- `body` is a kept global selector
  ([CSS change attribution, Kept Constructs](../docs/protocol/mokly-css-attribution.md#kept-constructs)),
  so the marker rule always keeps the stylesheet as evidence with
  `analysis: { status: "unresolved", selectors: ["body"] }`.

Measured evidence from one pass over all sixteen library stylesheets:

- `changes` equals exactly the sixteen library paths.
- Every component's reasons equal exactly
  `[{ kind: "dependency", path: <its stylesheet>, analysis: { status: "unresolved", selectors: ["body"] } }]`,
  identical to the single-edit result. Its `sharedImpact` equals
  `[<its stylesheet>]`.
- The screen consumers per `changedComponentId` equal the manifest consumers
  and equal the single-edit consumers for every sampled component.
- The `changedComponentId` set equals the sixteen paths. The `tag-chip` to
  `top-bar` evidence lists only the `tag-picker` variant.

Measured evidence from one pass over the nine shared stylesheets:

- For every stylesheet, the changed entries whose reasons name that stylesheet
  equal the expected set exactly (39/69, 111/69, 11/69, 0/69 screens/components).
- `sharedImpact` equals `["examples/basic/generated/design.css"]`; no change is
  outside `design/`; no component becomes an affected-consumer source.

Conclusion: one pass preserves every per-component and per-stylesheet
assertion, and the exact reason lists make isolation explicit. A stylesheet
attributed to the wrong component would appear as an extra reason or an extra
change in the same result.

## Options And Decisions

| Option                                        | Evidence                                                                                             | Decision                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| One multi-edit pass per stylesheet family     | Per-change reasons and per-id consumers above; 18.7 s and 20.9 s instead of 16 × 13 s and 9 × 14 s   | Adopt for both files.                                                                                       |
| A few single-edit cases for isolation         | The one-changed-resource fallback is the production case; one control costs about 13 s               | Keep one control (`tag-chip`, the deepest chain). No control in the shared file; the mechanism is the same. |
| Group edits by directory or consumer set      | A single pass loses no information because reasons are per path                                      | Not needed.                                                                                                 |
| Reuse the before compilation across subtests  | The fixture already keeps `before` and `resources`; today each top-level test builds its own fixture | One module-level fixture per file through the `after` hook of `node:test`; five compilations become one.    |
| Reuse parsed resources across classifications | `classificationContext` constructs `ComponentMaterialReader` and `CssResourceAnalysis` per call      | Not reachable from tests; recorded as the product follow-up.                                                |
| Source edits need a real rebuild              | `compileCatalogue` has no subset or incremental mode (`src/build/compile.ts`, `load_graph.ts`)       | Group edits only where expectations stay distinct; move them to their own files.                            |

## Target Layout

| File                                              | Content                                                          | Expected local time |
| ------------------------------------------------- | ---------------------------------------------------------------- | ------------------: |
| `tests/design_library_attribution.test.ts`        | One fixture, one sixteen-stylesheet pass, one `tag-chip` control |               ~50 s |
| `tests/component_design_attribution.test.ts`      | One fixture, one nine-stylesheet pass                            |               ~38 s |
| `tests/design_library_source_edits.test.ts`       | One fixture, five grouped rebuilds for the twelve source edits   |              ~170 s |
| `tests/design_library_committed_baseline.test.ts` | The committed-mode baseline test, unchanged in substance         |               ~65 s |

Adding files shifts the sorted index of every later file, so every shard
assignment after index 339 rotates. A simulation with the CI durations and the
estimates above predicts shard file time of roughly 740 / 680 / 1010 / 570 s
(wall time about 505 s on the heaviest shard, down from 768 s) and total unit
file time of about 3010 s, down from 3492 s. The heaviest
remaining files are `example_baseline.test.ts` (83 s) and
`publish_receiver_rejections.test.ts` (65 s). Milestone 6 confirms the real
layout with a CI run.

The shared compilation snapshot planned in another workspace would remove the
17 s fixture compilation from each of these four files. Rebuilds inside the
source-edit file are unaffected by that snapshot. This plan does not depend on
it.

## Milestone 1: Document the consolidated verification contract (completed)

Update every document that describes these tests or the fixture before the
tests change. Documentation-only; validate the Markdown and review the diff.

- [x] Update the `Verification And Maintenance` section of
      `docs/protocol/mokly-component-design.md`: the shared-stylesheet test
      changes all nine stylesheets in one classification, derives each
      stylesheet's scope from the changed entries whose dependency reasons name
      that stylesheet, and keeps the exact counts, the `design/` confinement,
      and the `design.css` shared-impact evidence. The file is at its 250-line
      cap; shorten text in place rather than growing it.
- [x] Update the `Verification` section of
      `examples/basic/specs/design/library/README.md`: list the four test files
      in the command, describe the one-pass library attribution with its
      single-change control, the grouped source-edit file, and the committed
      baseline file, and keep the paragraph about what the tests retain exact.
- [x] Add a `Unit Shard Balance` section to `docs/protocol/ci-suite-evidence.md`:
      whole-file partition by sorted index modulo four, two concurrent files,
      per-file durations as the measure, and the rule that a scenario suite
      classifies once per scenario rather than once per subtest. Link the
      measurement record below. Do not name plan milestones in protocol
      documents; `tests/protocol_doc_history.test.ts` rejects that pattern.
- [x] Create `docs/reviews/attribution-test-consolidation.md` with the CI run
      link, the per-file and per-shard baseline table, and the local operation
      table above. Milestone 6 appends the after figures.
- [x] Run `npx prettier --check` on the changed Markdown, run
      `node --import tsx --test tests/protocol_doc_sizes.test.ts tests/protocol_doc_history.test.ts`,
      and review the diff.

## Milestone 2: Result projections and one fixture per file

Pure helpers that make the single-pass assertions readable, plus their own
fast tests. No attribution test changes yet; the repository stays green.

- [ ] Add `tests/helpers/attribution_result.ts` with documented pure
      projections over `ReviewResultV5`: `changedEntryPaths(result)`,
      `reasonsOf(result, path)`, `impactingIds(result)`,
      `screenConsumersOf(result, changedComponentId)`,
      `usageVariantsOf(result, changedComponentId, consumerPath)`,
      `usageChainsOf(result, changedComponentId, consumerPath)`, and
      `stylesheetScope(result, stylesheetPath)`. Keep it under 300 lines.
- [ ] Add `manifestScreenConsumers(manifest, componentId)` beside those
      projections; it replaces the inline `generatedViews` loop in the test.
- [ ] Add `tests/helpers/design_stylesheets.ts`: the nine shared stylesheet
      records with their expected screen and component counts, the library
      stylesheet path helper, and the two marker rules as named constants with
      a doc comment that `body` is a kept global selector.
- [ ] Add `tests/attribution_result_helpers.test.ts`: unit tests of every
      projection against a small hand-built v5 result with two changed
      components, a nested consumer chain, a screen consumer, and two
      stylesheet reasons. No compilation; it must run in well under a second.
- [ ] Document in `tests/helpers/design_library_fixture.ts` that a test file
      passes the module-level `after` hook from `node:test` to share one
      fixture across its top-level tests, and keep the `t.after` form for
      single-test use. Keep the file under 300 lines.
- [ ] Run the new helper tests and both unchanged attribution files; all pass.

## Milestone 3: One pass for the sixteen library stylesheets

Replace the sixteen-subtest loop with one classification and one control.
Tests 2–4 share the new module-level fixture; test 5 keeps its committed
fixture. All four stay in the file until Milestone 5 moves them.

- [ ] Record the before timing:
      `node --import tsx --test tests/design_library_attribution.test.ts`
      (local 8-core figure and the CI figure, 615 s) in the measurement record.
- [ ] Share one fixture across the file through the module-level `after` hook.
- [ ] Add `library stylesheets attribute only to their own component in one pass`:
      append the marker rule to all sixteen stylesheets, classify once, and
      assert: `changedEntryPaths` equals the sixteen library paths; for every
      component, `reasonsOf` equals exactly the single dependency reason for its
      own stylesheet with `status: "unresolved"` and `selectors: ["body"]`, its
      `sharedImpact` equals `[<its stylesheet>]`, `screenConsumersOf` is
      non-empty and equals `manifestScreenConsumers`; `impactingIds` equals the
      sixteen paths; the `tag-chip` to `chrome/top-bar` evidence lists only the
      `top-bar/tag-picker` variant and includes the
      `top-bar/tag-picker/tag-chip` chain.
- [ ] Keep one single-change control subtest for `tag-chip` with today's
      assertions (`changes`, manifest consumers, top-bar evidence) so the
      one-changed-resource fallback stays covered and agrees with the
      multi-pass projection for that component.
- [ ] Run the file; record the after timing in the measurement record.

## Milestone 4: One pass for the nine shared design stylesheets

Replace the nine-subtest loop with one classification whose per-stylesheet
scope comes from the dependency reasons.

- [ ] Record the before timing:
      `node --import tsx --test tests/component_design_attribution.test.ts`
      (local figure and the CI figure, 192 s).
- [ ] Rewrite the file around one module-level fixture: append the marker rule
      to all nine stylesheets, classify once, and per stylesheet compute the
      expected entries from the rendered outputs as today, assert the counts
      table (39, 11, 0, or every `design/` screen; 69 components), and assert
      `stylesheetScope` equals the expected paths exactly.
- [ ] Assert that `changedEntryPaths` equals the union of the expected sets,
      every path outside `design.css`'s scope starts with `design/`,
      `sharedImpact` includes `examples/basic/generated/design.css`, and
      `affectedConsumers` is empty because shared stylesheets have no owner.
- [ ] Run the file; record the after timing.

## Milestone 5: Source-edit groups and the committed baseline in their own files

Move tests 2–5 out of `design_library_attribution.test.ts`. Group source
edits into one rebuild only when every edit keeps its own proof under the
rules below: its own change path or reason kinds, its own impacting
expectation, and no other member that could mask a wrong attribution.

Measured single-edit signatures (change path, reason kinds, impacting
components) from the real fixture:

| Edit                               | Change path                                 | Reasons                          | Impacting  |
| ---------------------------------- | ------------------------------------------- | -------------------------------- | ---------- |
| `top-bar.view.tsx` class           | `design/library/chrome/top-bar`             | dependency (view file), material | `top-bar`  |
| `tag-chip.view.tsx` label          | `design/library/controls/tag-chip`          | dependency (view file), material | `tag-chip` |
| `top-bar.tsx` `title: "Search"`    | `design/library/chrome/top-bar/search`      | material, metadata               | none       |
| `top-bar.tsx` `label: "Query"`     | `design/library/chrome/top-bar`             | metadata                         | none       |
| `top-bar.tsx` `query: "tag:forms"` | `design/library/chrome/top-bar/search`      | material, metadata               | none       |
| `use-case.tsx` title               | `design/browse/views/use-case`              | inputs                           | none       |
| `use-case.tsx` destination         | `design/browse/views/use-case`              | inputs                           | none       |
| `use-case.tsx` slot                | `design/browse/views/use-case`              | material                         | none       |
| `use-case.tsx` reorder             | `design/browse/views/use-case`              | material, structure              | none       |
| `use-case.tsx` removal             | `design/browse/views/use-case`              | material, structure              | none       |
| `picker.tsx` tag                   | `design/browse/views/screen/tag-picker`     | inputs                           | none       |
| `fixtures.ts` cornerRadius         | `design/components/controls/states/invalid` | material                         | none       |

Grouping rules, derived from those signatures:

- An edit that makes a component impacting rebuilds alone. Sharing a build
  with another impacting edit could hide a wrong attribution to the other
  component, for example a `top-bar` edit attributed to nested `tag-chip`.
- Edits that expect no impacting component may share one build. The merged
  `affectedConsumers` must be empty, which proves each member individually
  impacts nothing, and `changes` must equal the union of their expected paths
  with the union of their reason kinds per path, which proves each member was
  detected and attributed only to its owning entry.
- Two edits with the same path share a build only when their reason kinds
  are disjoint, so each edit keeps its own detection signal. Equal or subset
  signatures (`title` and `destination`; `reorder` and `removal`; `slot`
  against either) stay in separate builds.

Resulting builds (five instead of twelve):

| Build | Edits                                                                                                            | Expected `changes`                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `top-bar.view.tsx`                                                                                               | `chrome/top-bar` {dependency, material}; `impactingIds` = `[top-bar]`; consumers equal the manifest                                            |
| 2     | `tag-chip.view.tsx`                                                                                              | `controls/tag-chip` {dependency, material}; `impactingIds` = `[tag-chip]`; consumers equal the manifest                                        |
| 3     | `top-bar.tsx` title, `top-bar.tsx` label, `use-case.tsx` title, `use-case.tsx` slot, `picker.tsx`, `fixtures.ts` | `top-bar` {metadata}; `top-bar/search` {material, metadata}; `use-case` {inputs, material}; `tag-picker` {inputs}; `states/invalid` {material} |
| 4     | `top-bar.tsx` query, `use-case.tsx` destination, `use-case.tsx` reorder                                          | `top-bar/search` {material, metadata}; `use-case` {inputs, material, structure}                                                                |
| 5     | `use-case.tsx` removal                                                                                           | `use-case` {material, structure}                                                                                                               |

Builds 3–5 assert `affectedConsumers` equals `[]`. Every build asserts
`changedEntryPaths` equals exactly the listed paths and `reasonsOf` equals
exactly the listed kinds per path (dependency reasons name the edited source
file). Today's `affects` boolean becomes the exact `impactingIds` list.

- [ ] Create `tests/design_library_source_edits.test.ts` with one module-level
      fixture and the five builds above as subtests. Each subtest resets,
      applies its edits, rebuilds once, classifies once, and asserts the table.
- [ ] Add a doc comment above the table in the test that states the grouping
      rules, so a future edit that changes a signature is regrouped rather than
      silently merged.
- [ ] Create `tests/design_library_committed_baseline.test.ts` holding test 5
      with its committed-mode fixture, unchanged in substance.
- [ ] Remove tests 2–5 from `tests/design_library_attribution.test.ts`; keep
      every file under 300 lines.
- [ ] Run the four files individually and record each timing.

## Milestone 6: Timing verification, measurement record, commit, and review

Prove the runtime reduction locally and in CI, record it, and close the plan
with the required commit, push, and review steps.

- [ ] Run each of the four files individually with
      `node --import tsx --test <file>` and record the after durations next to
      the baseline in `docs/reviews/attribution-test-consolidation.md`.
- [ ] Run `cargo xtask check`.
- [ ] Commit and push the branch. Wait for the CI run, then download the
      `verification-unit-*` artifacts with
      `gh run download <run-id> --name verification-unit-node-22.14.0-shard-<n>`
      and record `durationMs` for the four files and the four shard wall
      times against 615 s, 192 s, and 768 / 691 / 331 / 290 s. If the heaviest
      shard is not clearly below the baseline, record the observed layout and
      the next heaviest files before closing the plan.
- [ ] If `tests/design_library_attribution.test.ts` is above 60 s in CI,
      decide whether to drop the 13 s `tag-chip` control and record the
      decision in the measurement record.
- [ ] Mark the plan status and record any approved removals in the PR
      description.
- [ ] Run `git add -A`, commit with a Conventional Commits message, and push.
- [ ] After the push, review the complete local diff against `origin/main`
      with [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      and report findings without changing the implementation.

## Post-merge follow-up (non-blocking)

- Product candidate plan, `classification document reuse`: a
  `classifyComponents` call on the unchanged example costs about 12 s with
  in-memory readers because every view is normalized and parsed again
  (`normalizeReviewPair`, `referencedRoutes`, and CSS document matching all
  parse with parse5; a CPU profile of compile plus classify shows 36% in
  parse5 tokenizing). Candidate: cache normalized documents and reference
  discovery by content digest across calls, or accept a caller-supplied cache
  through `ComponentClassificationInput`. Measure with `--debug-timings` spans
  `review.compare-screens`, `review.resource-graph`, and `review.css-analysis`.
- Shared compilation snapshot (other workspace): after this plan each of the
  four files still compiles the example once (17 s). The snapshot removes that
  cost; the rebuilds in the source-edit file remain.
- Unit shard balance: consider a ratchet or evidence check over the CI unit
  reports that flags any unit file above a duration budget, as the browser
  suite does by test count in `tests/browser_shard_balance.test.ts`.
