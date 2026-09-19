# CSS Change Attribution

## Status And Outcome

Milestones 1 through 19 are complete, committed, and pushed. The first review
reported fourteen findings, addressed in Milestones 11 through 14. The second
review reported nine, addressed in Milestones 16 through 18. The third review
confirmed six closed, two partially closed, and one not closed, and reported
nine further findings that await the user's decision; the most severe is a
residual live-versus-complete evidence divergence through changed embedded
documents.

A single edit to a shared stylesheet currently marks every screen that links
that stylesheet as a dependency change, and a broad `review.sharedImpact` glob
marks every entry in the catalogue. A large consumer showed 1,382
Changes for a branch whose real diff was 98 files and three moved guide routes.
The Mokly side of that count came from two sources: a blanket
`docs/mockups/*.css` shared-impact glob in the consumer configuration, and
file-level attribution of the guide additions in `docs/mockups/home.css` to
every screen that loads it.

This plan makes CSS dependency evidence rule-aware. A changed stylesheet stays
conservative evidence for a screen only when at least one changed rule could
apply to that screen's document. When no changed rule can match, the screen is
reported as unaffected by that stylesheet. Selector matchability is a sound
exclusion, not a visual proof: the analysis never claims a screen is unchanged
when a rule matches, and it treats every construct it cannot resolve as a
potential match. Browser-verified refinement is deferred to a later plan.

Language stays TypeScript. Rust is not adopted; the review pipeline has no
measured hot spot, and CSS parsing is delegated to `lightningcss`, whose core is
already native. Milestone 3 records timings so that decision rests on evidence.

Related contracts:

- [Changes and screen comparisons](../docs/protocol/mokly-changes.md)
- [Component change attribution](../docs/protocol/mokly-component-changes.md)
- [Component comparison v3 schema](../docs/protocol/mokly-component-review.md)
- [Startup diagnostics and scale fixtures](../docs/protocol/mokly-timings.md)

## Scope

In scope:

- Rule-level diffing of before/after CSS reachable from a screen's document.
- Selector matchability of changed rules against the before and after
  documents of each view.
- Conservative handling of unresolvable constructs.
- New evidence shape that distinguishes matched-rule impact from plain
  dependency impact, and a Changes membership rule that uses it.
- Timing spans and a scale fixture variant with shared stylesheets.
- Protocol, README, and example documentation updates.

Out of scope, tracked as follow-up plans:

- Browser-backed matched-rule and computed-style refinement.
- Import-graph ownership inference for CSS Modules or CSS-in-JS.
- Mapping bundled stylesheet output back to source modules.
- Pixel or screenshot comparison.
- Any change to that consumer; it only needs the glob removed.

## Design Summary

Attribution for a changed CSS resource on one view proceeds in three stages.

1. Parse both sides with `lightningcss` and produce an ordered list of rules,
   each carrying its selector list, declarations, and enclosing conditions
   (`@media`, `@container`, `@supports`, `@layer`, nesting parents). Diff the
   two lists into changed, added, and removed rules, ignoring whitespace and
   comments. A stylesheet whose only differences are formatting produces no
   changed rules.
2. For each changed rule, test its selectors against the view's before
   document and after document using `css-select` over the existing parse5
   tree. A match on either side keeps the rule.
3. Reduce. If any kept rule exists, the resource remains dependency evidence
   and the view records the rule selectors that matched. If no rule matched,
   the resource is recorded as examined-and-excluded and does not contribute
   to Changes membership for that view.

Every uncertain case resolves to "keep":

- A selector `css-select` cannot parse.
- `:host`, `::part`, `::slotted`, and other shadow-scoped selectors.
- Universal, `:root`, `html`, and `body` selectors.
- Custom property declarations (`--*`) changed anywhere, because inheritance
  can reach any descendant.
- `@font-face`, `@keyframes`, `@property`, `@counter-style`, and other rules
  without selectors.
- Changed `@import` or `url()` references (already handled by the resource
  graph; the new analysis must not weaken that path).
- A parse failure on either side of the stylesheet.

Conditions such as `@media` and `@container` are not evaluated; a rule inside a
condition is treated exactly like a rule outside it. Evaluating conditions
needs a viewport and element sizes, which belongs to the deferred browser
refinement.

The analysis runs only on CSS resources that are already in `changedPaths`
and already reachable through the resource graph. It never widens the set of
examined files, so unreferenced public files continue to add nothing.

## Evidence schema

A dependency reason gains an optional `analysis` record:

```ts
{
  kind: "dependency";
  path: string;
  analysis?: {
    status: "matched" | "unresolved";
    selectors: readonly string[]; // matched or kept selectors, sorted
  };
}
```

Excluded resources are recorded on the view, not as reasons:

```ts
excludedResources: readonly { path: string; reason: "no-matching-rule" }[];
```

## Baseline timings

Measured on 2026-09-14 in the Amazon Linux 2023 x86_64 cloud sandbox
(8 CPUs, approximately 16 GiB RAM, Node v24.14.1), with other heavy checks idle.
These are single diagnostic runs before rule-aware attribution, not performance
thresholds or statistical estimates.

`npm run fixture:large` prepared the full default fixture in 80,329 ms:
30 areas, 40 screens per area (1,200 screens), 60 registered components with
three saved variants each, 12 records per screen, 1,410 routed entries and
5,550 documents. Four shared stylesheets are each linked by the first 20
screens per area: 600 screens, or 50%, in all viewport/scheme documents.
The existing catalogue stylesheet and its imported tokens sheet are additional
(two more CSS files). Setup commits the unedited stylesheets, then adds an
unrelated rule only to `assets/shared-1.css`.

`npm run benchmark:large` completed at full size. Cold/warm usable startup was
4,139 / 4,100 ms, both below five seconds. Complete Changes reached Browse at
147,173 / 146,663 ms, with 660 changed routes in both runs: 600 linked screens
and 60 flows. No smaller benchmark fallback was needed. Cold means a fresh
application process, without flushing OS caches.

Serve classification does not write artifacts. A supplementary full-size
`node --max-old-space-size=12288 dist/cli/bin.js export --config <full-config> --base main --out .context/site --debug-timings`
failed with JavaScript heap exhaustion after approximately 481 seconds, before
the artifact-write span began. Review comparison had completed; complete-site
assembly/validation remains outside those review spans. No export optimization
is part of this milestone.

The separately labelled small Export used
`npm run fixture:large -- --areas 2 --screens 10 --rows 6`, then
`node dist/cli/bin.js export --config <small-config> --base main --out .context/site --debug-timings`.
It has 20 screens, four components with three variants each, six records per
screen, 28 routed entries and 130 documents; each of four shared stylesheets
is linked by ten screens (50%). It uses the default Node heap allowance.
This is a control measurement for the artifact-write stage, not a claim of the
largest export that fits or an estimate for the full-size export.

Durations below are milliseconds. For repeated stage names, each cell is the
union of `[end.elapsedMs - end.durationMs, end.elapsedMs]` intervals within one
session, so overlapping viewport traversals count once. Parent rows include children; do not sum rows
or compare elapsed clocks across sessions. Each full Serve run has three
comparison-loop spans and 22,110 resource traversals. Small Export has three
changed-path spans, two manifest reads, three comparison loops, and 516 resource
traversals (including the two snapshot-copy closures). A dash means that stage
did not run in that command.

| Span                     | Full Serve cold (ms) | Full Serve warm (ms) | Small Export (ms) |
| ------------------------ | -------------------: | -------------------: | ----------------: |
| `review.base-commit`     |                10.13 |                 9.56 |              7.41 |
| `review.changed-paths`   |             1,293.63 |             1,344.31 |             79.90 |
| `review.base-manifest`   |               971.23 |               983.36 |            102.94 |
| `review.base-documents`  |             1,760.44 |             1,920.90 |             39.19 |
| `review.compare-screens` |            43,411.58 |            43,579.36 |            808.19 |
| `review.resource-graph`  |            23,825.88 |            23,860.31 |            934.41 |
| `review.write-artifact`  |                    — |                    — |             97.99 |
| `changes.classify`       |            47,975.63 |            48,354.97 |                 — |
| `export`                 |                    — |                    — |          6,895.22 |

### Post-change timings (Milestone 10)

Measured on 2026-09-14 in the same Amazon Linux 2023 x86_64 sandbox with
8 CPUs and approximately 16 GiB RAM, with other heavy checks idle. These runs
use Node v24.21.0 rather than the baseline's v24.14.1; both tables are single
diagnostic runs, not statistical estimates of the attribution change's cost.

Regenerated the same full fixture with `npm run fixture:large` (81,596 ms
setup), then ran `npm run benchmark:large`, which enables `--debug-timings`.
The dimensions remain 30 areas, 40 screens per area, 12 records per screen,
four shared stylesheets and a 0.5 screen share: 1,410 routes and 5,550 documents.
Cold/warm usable startup was 4,150 / 4,210 ms, both below five seconds.
Complete Changes reached Browse at 158,136 / 158,362 ms and reported zero
changed routes in both runs: the unrelated rule is now excluded from all
600 linked screens and their flows.

Regenerated the same small control with
`npm run fixture:large -- --areas 2 --screens 10 --rows 6` (2,460 ms setup;
four shared stylesheets, 0.5 share, 28 routes and 130 documents), then ran
`node dist/cli/bin.js export --config <small-config> --base main --out .context/site --debug-timings`
with the default Node heap. Small Export completed in 7,098.35 ms, including
102.56 ms of artifact writes. The baseline's failed full-size Export was not
repeated; the small run remains an artifact-write control only.

The table uses the same per-session interval unions as the baseline. Each full
Serve run has three comparison loops, 22,110 resource traversals and 4,800
CSS-analysis passes; Small Export has three comparison loops, 516 resource
traversals and 80 CSS-analysis passes. The new `review.css-analysis` span covers
CSS parse-cache lookup or parsing, diffing, matching and reduction, excluding
resource reads and input document-tree preparation as defined in the
[timing contract](../docs/protocol/mokly-timings.md).

| Span                     | Full Serve cold (ms) | Full Serve warm (ms) | Small Export (ms) |
| ------------------------ | -------------------: | -------------------: | ----------------: |
| `review.base-commit`     |                12.06 |                10.95 |              7.54 |
| `review.changed-paths`   |             1,352.91 |             1,296.36 |             69.96 |
| `review.base-manifest`   |             1,012.47 |               989.67 |            107.26 |
| `review.base-documents`  |             1,907.63 |             1,882.01 |             57.83 |
| `review.compare-screens` |            53,579.69 |            54,120.25 |            954.99 |
| `review.resource-graph`  |            23,236.04 |            23,484.21 |            899.15 |
| `review.css-analysis`    |             1,549.84 |             1,528.28 |             35.84 |
| `review.write-artifact`  |                    — |                    — |            102.56 |
| `changes.classify`       |            58,195.83 |            58,599.32 |                 — |
| `export`                 |                    — |                    — |          7,098.35 |

The CSS pass did not exceed ten percent of full-size review time: it used
2.66% cold and 2.61% warm of the background worker's `changes.classify` span,
so this measurement does not trigger the blob-id rule-cache follow-up plan.

### Review-fix timings (Milestone 12)

Measured on 2026-09-14 in the same Amazon Linux 2023 x86_64 sandbox
(8 CPUs, approximately 16 GiB RAM), using Node v24.21.0 with other heavy
checks idle. The baseline used Node v24.14.1; Milestone 10 used v24.21.0.
These remain single diagnostic cold/warm runs, not statistical estimates.

Regenerated the full default fixture with `npm run fixture:large`
(69,293 ms setup), then reused its immutable baseline for
`npm run benchmark:large` on the final implementation. The benchmark enables
`--debug-timings`. Dimensions remain 30 areas, 40 screens per area, 12 rows,
four shared stylesheets and a 0.5 share: 1,410 routes and 5,550 documents.
Cold/warm usable startup was 3,597 / 3,556 ms;
complete Changes reached Browse at 116,548 /
115,542 ms. Both runs passed the five-second startup limit
and reported zero changed routes. No Export measurement was repeated.

The cause addressed by Finding 6 was unnecessary base-side fragment reads,
paired normalization, and base resource-graph traversal for views without
changed stylesheet resources. That work is outside `review.css-analysis`.
Base documents are now batched only for material changes and CSS consumers;
verified resource deletions and before-only resources of changed/moved documents
retain their existing discovery. Finding 12 also puts reference discovery through
the shared tokenizer, with a cheap candidate check that preserves escaped spellings.

The table uses per-session interval unions, matching the earlier measurements.
Each run has three comparison loops, 22,110 resource traversals and 4,800
CSS-analysis passes; every background span completed successfully.

| Span                     | Full Serve cold (ms) | Full Serve warm (ms) |
| ------------------------ | -------------------: | -------------------: |
| `review.base-commit`     |                 9.22 |                 9.15 |
| `review.changed-paths`   |             1,127.48 |             1,158.70 |
| `review.base-manifest`   |               872.57 |               871.74 |
| `review.base-documents`  |             1,556.75 |             1,549.33 |
| `review.compare-screens` |            39,461.52 |            39,571.78 |
| `review.resource-graph`  |            16,443.83 |            16,517.14 |
| `review.css-analysis`    |             1,224.90 |             1,218.65 |
| `review.write-artifact`  |                    — |                    — |
| `changes.classify`       |            43,312.35 |            43,430.34 |

The corrected end-to-end deltas, including work outside the CSS-analysis span:

| Span                     |      Cold vs baseline |       Warm vs baseline |    Cold vs Milestone 10 |    Warm vs Milestone 10 |
| ------------------------ | --------------------: | ---------------------: | ----------------------: | ----------------------: |
| `changes.classify`       | -4,663.28 ms (-9.72%) | -4,924.63 ms (-10.18%) | -14,883.48 ms (-25.57%) | -15,168.98 ms (-25.89%) |
| `review.compare-screens` | -3,950.06 ms (-9.10%) |  -4,007.58 ms (-9.20%) | -14,118.17 ms (-26.35%) | -14,548.47 ms (-26.88%) |

The CSS pass is 2.83% cold and
2.81% warm of background `changes.classify`.
That does not measure the total attribution overhead: document preparation,
resource discovery, base-side work and the other review stages are included only
in the end-to-end rows. The ten-percent CSS-pass trigger for a parsed-rule-cache
follow-up is not reached. The deltas include all Milestone 12 changes and run
variance; they are not an isolated estimate of the base-read optimization.

### Re-review timings (Milestone 17)

Measured on 2026-09-15 in the Amazon Linux 2023 x86_64 sandbox
(8 CPUs, approximately 16 GiB RAM), using Node v24.21.0. This task's other
heavy checks were idle during the benchmark; a separate design task was active
in the workspace. These are single diagnostic cold/warm runs, not statistical
estimates of the fix's cost.

Regenerated the full default fixture with `npm run fixture:large`
(61,977 ms setup), then ran `npm run benchmark:large`, which enables
`--debug-timings`. Dimensions remain 30 areas, 40 screens per area, 12 rows,
four shared stylesheets and a 0.5 share: 1,410 routes and 5,550 documents.
Cold/warm usable startup was 3,644 / 3,613 ms; complete Changes reached Browse
at 113,716 / 117,889 ms. Both runs passed the five-second startup limit and
reported zero changed routes. No Export measurement was repeated.

The table uses the same per-session interval unions as Milestone 12; parent
rows include child work. Each run has three comparison loops, 22,110 resource
traversals and 4,800 CSS-analysis passes. All 26,918 background spans per run
completed successfully. The default fixture changes only CSS; the new
deleted-image and cross-path equivalence tests cover the restored base graph
traversal for changed documents without CSS in the diff.

| Span                     | Full Serve cold (ms) | Full Serve warm (ms) |
| ------------------------ | -------------------: | -------------------: |
| `review.base-commit`     |                 8.03 |                 8.33 |
| `review.changed-paths`   |             1,100.52 |             1,130.90 |
| `review.base-manifest`   |               800.24 |               860.62 |
| `review.base-documents`  |             1,541.64 |             1,569.35 |
| `review.compare-screens` |            38,581.27 |            40,596.07 |
| `review.resource-graph`  |            16,256.31 |            16,920.60 |
| `review.css-analysis`    |             1,155.48 |             1,291.35 |
| `review.write-artifact`  |                    — |                    — |
| `changes.classify`       |            42,322.10 |            44,434.52 |

Compared with Milestone 12, `changes.classify` was 990.25 ms lower cold
(-2.29%) and 1,004.18 ms higher warm (+2.31%). The CSS pass was 2.73% cold and
2.91% warm of background classification, below the ten-percent follow-up
trigger. Document preparation, discovery and validation remain outside the CSS
span; the end-to-end figures include that work and run variance.

## Milestone 1: Define the rule-aware attribution contract

Documentation-only milestone. The protocol must be complete and approved by
the user before mockups or code land.

Completed. Added `docs/protocol/mokly-css-attribution.md` and updated the
changes, component-changes, component-review, and index docs.

- [x] Add `docs/protocol/mokly-css-attribution.md` covering: the three
      stages in the Design Summary, the exact keep-list of unresolvable constructs, the rule
      that conditions are not evaluated, the invariant that the analysis only
      narrows existing dependency evidence and never adds files, and the
      statement that a matched rule is potential impact rather than visual
      proof.
- [x] Define the evidence schema extension described under "Evidence schema"
      above, in both the v2 `ReviewResult` and v3 `ReviewResultV3` contracts.
      Absent fields mean the analysis did not run, so historical results
      without them remain valid.
- [x] Update `docs/protocol/mokly-changes.md` and
      `docs/protocol/mokly-component-changes.md` so the dependency and
      shared-impact paragraphs reference the new contract and state that a
      CSS dependency edit keeps a view in Changes only when analysis matched
      or was unresolved.
- [x] Update `docs/protocol/mokly-component-review.md` with the schema
      change and the validation rule that `analysis.selectors` is sorted and
      duplicate-free, and that an `excludedResources` path must be in
      `changedPaths`.
- [x] Add the new document to `docs/protocol/README.md`.
- [x] Validate Markdown with `npm run format:check` and check every relative
      link resolves.

## Milestone 2: Surface the evidence in the shell

Tags: mockup

Completed. Delivered as the `design/review/impact/stylesheets/` sub-page with
`design-review-style-matched`, `design-review-style-unresolved`, and
`design-review-style-excluded`, each with mobile and desktop variants. The
impact group was split into a child collection to respect the five-screen
limit. The contract's Shell Presentation section now names the owning screens.

Design the inspector evidence before any implementation so the user can
approve the visible outcome. Show examined-and-excluded resources and matched selectors in the inspector so
a reviewer can see why a screen stayed out of Changes.

- [x] Read `docs/protocol/mokly-shell-design.md` and the existing evidence
      designs under `examples/basic/entries/design/`.
- [x] Add mobile and desktop screens to the design catalogue showing a screen
      with a dependency reason carrying matched selectors, and a screen with
      an excluded resource. Keep the owning page within the five-screen limit
      and reuse the existing inspector components.
- [x] Copy must read as product language: "This stylesheet changed but none
      of the changed styles apply to this screen", not selector or parser
      terms in the headline. Selectors may appear in the details list.
- [x] Build and check the example, run the design tests, and open each changed
      page from disk in both variants.
- [x] Delegate this milestone to an Opus 5 agent at maximum reasoning effort;
      the main session reviews the result against the protocol before
      continuing.

## Milestone 3: Measure the current review pipeline

Establish where review time goes before changing attribution, so the
language decision and later performance claims rest on data.

Completed. Spans, fixture options, tests, and the recorded baseline above
were delivered by a Codex session and verified by the coordinator.

- [x] Add `review.*` timing spans under the existing `--debug-timings`
      contract for base-commit resolution, changed-path discovery, base
      manifest read, base document batch read, per-screen comparison loop,
      resource graph traversal, and artifact write. Follow the span rules in
      `docs/protocol/mokly-timings.md`.
- [x] Extend the large fixture generator under `tests/fixtures/large` with a
      configurable number of shared stylesheets linked by a configurable share
      of screens, and record a baseline in which one shared stylesheet gains
      an unrelated rule.
- [x] Run `benchmark:large` against that fixture and record per-span timings
      in this plan under a "Baseline timings" heading, with fixture sizes.
- [x] Add tests for the new spans in the existing timings test file, and
      update `docs/protocol/mokly-timings.md` with the new stage names.
- [x] Run `npm run test`, `npm run typecheck`, `npm run lint`, and
      `npm run format:check`.

## Milestone 4: Rule diffing

Add the CSS parsing and diff layer with no change to classification yet.

Completed. `src/review/css/` (types, rules, diff, source, serialization) and
its tests were delivered by a Codex session and verified by the coordinator.
Lightning CSS ships native binaries without a WASM fallback, so CI gained a
cross-platform parse check.

- [x] Add `lightningcss` with `npm install` (no pinned version) and confirm the
      package installs on the CI platform matrix used by
      `docs/protocol/npm-release.md`.
- [x] Create `src/review/css/` with `rules.ts` (parse a stylesheet into the
      ordered rule list with enclosing conditions), `diff.ts` (changed, added,
      removed rules), and `types.ts`. Keep each file under 300 lines.
- [x] Put the parser behind a small interface so tests can inject fixtures
      without a real parse, consistent with the existing reader interfaces in
      `src/review`.
- [x] Tests under `tests/review_css_rules.test.ts` and
      `tests/review_css_diff.test.ts`: whitespace-only edits yield no rules;
      comment-only edits yield no rules; added rule; removed rule; changed
      declaration; rule moved without change yields no rules; nested rules;
      `@media`, `@container`, `@supports`, and `@layer` preserved as
      conditions; parse failure surfaces as an unresolved result rather than a
      thrown error.
- [x] Run tests, typecheck, lint, format check.

## Milestone 5: Selector matchability

Add the document matching layer, still without changing classification.

Completed. The matcher, parse5 document adapter, nesting resolver, pseudo
handling, and `analyzeStylesheetChange` entry point were delivered by a Codex
session and verified by the coordinator. `css-what` was added alongside
`css-select` for typed selector rewrites.

- [x] Add `css-select` with `npm install`. It operates on the parse5 tree via
      `domhandler` adapters; confirm the adapter works with the tree shape
      produced by the existing `parse5` usage in `src/html_references.ts`, or
      add a thin adapter in `src/review/css/document.ts`.
- [x] Create `src/review/css/match.ts`: given changed rules and a document,
      return the kept rules with the reason (`matched` or `unresolved`).
      Implement the keep-list from Milestone 1 exactly.
- [x] Tests under `tests/review_css_match.test.ts`: unused class selector
      excluded; matching class kept; matching only in the after document kept;
      universal selector kept; `:root` kept; custom property change kept;
      `@font-face` kept; unparseable selector kept; shadow-scoped selector
      kept; rule inside `@media` treated identically to one outside.
- [x] Run tests, typecheck, lint, format check.

## Milestone 6: Integrate with classification

Wire the analysis into both classification paths so Changes membership uses it.

Completed. Delivered by a Codex session and verified by the coordinator:
both result versions, live Serve, watched updates, and publication run the
same cached analysis; `reasons` and `excludedResources` are recorded per view;
the newline-only test now asserts exclusion; the serializer boundary fix landed
with regressions.

- [x] In `src/review/component_view.ts`, before pushing a dependency reason
      for a CSS resource, run the analysis against the view's before and after
      documents and either attach `analysis` or record the resource under
      `excludedResources`. Non-CSS resources are unchanged.
- [x] Apply the same rule in the v2 path in `src/review/screen_compare.ts` so
      catalogues without registered components get identical behaviour.
- [x] Apply the same rule in the live Serve membership calculation in
      `src/server/changed_content.ts` and `src/server/changed_resources.ts` so the Changes count, background classification,
      and complete comparison agree.
- [x] Ensure the analysis reads base CSS through the existing batched Git
      reader and never falls back to individual reads for the CSS pass.
- [x] Update `src/review/result_records.ts` and `result_validation.ts` for
      the new fields; reject unsorted or duplicate selectors and excluded
      paths absent from `changedPaths`.
- [x] Re-examine `tests/server_changed_assets.test.ts`. The case that appends
      a newline to a CSS file currently asserts the consumers are in Changes.
      Under this plan a newline-only edit yields no changed rules and the
      consumers are excluded. Rewrite that case to append a rule whose
      selector matches, and add a sibling case for a newline-only edit that
      asserts exclusion.
- [x] Add end-to-end tests under `tests/changes_css_attribution.test.ts` using
      an isolated Git fixture: a guide-only rule added to a shared stylesheet
      leaves an unrelated auth screen out of Changes and in
      `excludedResources`; a rule matching the auth screen keeps it in; a
      custom property edit keeps every consumer in with `unresolved`; a font
      or image edit still keeps consumers through the existing resource path;
      a broad `sharedImpact` glob continues to add nothing on its own.
- [x] Run the existing review, component, publication, and export test suites
      and the browser suite; both viewports and colour schemes must produce
      the same exclusions.
- [x] Fix the declaration serializer so a comment between a function name
      and its opening parenthesis (for example `url/**/("a.svg")`) is not
      normalized to the valid form; add parser and diff regressions for
      identifier and function boundary cases. Discovered during Milestone 5
      review.
- [x] Run tests, typecheck, lint, format check, and `cargo xtask check`.

## Milestone 7: Implement the shell evidence

Tags: ui

Completed. Delivered by an Opus 5 agent and verified by the coordinator:
`src/client/style_evidence.ts`, inspector rendering of matched, unresolved,
and excluded evidence, the client-derived stage heading, unit tests, and a
browser spec. Review found that catalogues without registered components
receive no per-view evidence in the shell; Milestones 8 and 9 below cover
that backend and UI work.

- [x] Extend `src/client/workspace_evidence.ts` and the inspector rendering to
      show matched selectors under a dependency reason and to list excluded
      resources in a secondary details section.
- [x] Add client tests and a browser spec under `tests/browser` asserting the
      copy and that excluded resources never appear as Changes rows.
- [x] Run tests, typecheck, lint, format check, browser tests, and
      `cargo xtask check`.

## Milestone 8: Deliver per-view evidence for screen-only catalogues

Catalogues without registered components produce a schema-v2 result, and the
shell only receives per-view evidence from the schema-v3 workspace payload.
Their matched, unresolved, and excluded stylesheet evidence is therefore
computed but never shown. Deliver that evidence to the shell without forcing
component classification on screen-only catalogues.

Completed. Delivered by a Codex session and verified by the coordinator: the
workspace payload carries a v2 per-view evidence slice, the inspector merges
loaded comparison evidence with classification evidence, and the unreachable
legacy v2 card was removed.

- [x] Add a failing browser or client test first: a screen-only catalogue with
      a shared stylesheet edit must show the excluded section on an unaffected
      screen and the matched list on an affected screen.
- [x] Extend the shell workspace payload so a schema-v2 catalogue supplies the
      same per-view `reasons` and `excludedResources` slice the v3 payload
      does, produced by the existing v2 classification rather than a second
      analysis pass. Keep the schema versions unchanged.
- [x] Make `renderWorkspaceEvidence` merge the loaded comparison's evidence
      with the classification evidence instead of replacing the panel, so the
      legacy v2 evidence card in `src/client/diff_views.ts` is either reached
      or deleted. Remove it if it becomes redundant.
- [x] Update `docs/protocol/mokly-css-attribution.md` Delivery Status and
      `docs/protocol/mokly-changes.md` so v2 catalogues are no longer listed
      as an exception.
- [x] Run tests, typecheck, lint, format check, browser tests, and
      `cargo xtask check`.

## Milestone 9: Show evidence for screen-only catalogues in the shell

Tags: ui

Completed. Verified by an Opus 5 agent that no production wiring was needed;
browser coverage now asserts matched, unresolved, and excluded rendering for
screen-only catalogues in both viewports. Review noted that the mockups show
the stage heading above the current preview while the shell only renders it
inside a loaded comparison; that is carried into the final review.

- [x] Wire the new v2 evidence slice into the inspector using the helpers in
      `src/client/style_evidence.ts`; no new copy or layout.
- [x] Extend `tests/browser/css_evidence.spec.ts` with a screen-only fixture
      asserting matched, unresolved, and excluded rendering in both viewports.
- [x] Run tests, typecheck, lint, format check, browser tests, and
      `cargo xtask check`.

## Milestone 10: Documentation, examples, and timings

- [x] Update `README.md`, `examples/basic/README.md`, and
      `docs/protocol/mokly-package.md` so guidance on `review.sharedImpact`
      describes it as a fallback for files the resource graph cannot see, and
      states that linked stylesheets are attributed by rule.
- [x] Update `src/review/README.md` (create it if absent) with the CSS module
      layout and the keep-list.
- [x] Re-run `benchmark:large` on the Milestone 3 fixture and record the new
      timings beside the baseline. If the CSS pass exceeds ten percent of
      total review time on the full-size fixture, open a follow-up plan for
      caching parsed rules per blob id before considering a native module.
- [x] Add `CHANGELOG.md` entry under the unreleased heading.
- [x] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [x] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md` after the push. Report findings
      with severity, context, impact, lettered options, and a recommendation;
      do not change the implementation.

## Milestone 11: Define the review-fix contract

Documentation-only milestone. Record the contract changes the review fixes
need before code lands.

- [x] In `docs/protocol/mokly-css-attribution.md`, add an "Analysis scope"
      rule: a stylesheet is in scope for rule analysis only when it is a public
      file inside `mockupsDir`; stylesheets outside that scope keep file-level
      `sharedImpact` evidence in both result versions, and both classification
      paths use one shared predicate. Amend the Membership Rule and Validation
      sections accordingly.
- [x] Add `material?: true` to `ViewReview` in the Evidence Schema section:
      present exactly when the view's normalized documents differ. Update the
      Shell Derivation rule so a view reads as a style outcome only when
      `material` is absent, and drop the sentence saying material and
      resource-only views are indistinguishable. Mirror the field in
      `docs/protocol/mokly-changes.md` and `docs/protocol/mokly-component-review.md`.
- [x] In Shell Presentation, state that the stage heading is rendered only
      inside a loaded comparison and is never shown for an excluded-only screen;
      state that the unresolved lead without selectors ends without a colon;
      state that the terminal status line uses the entry kind ("screen" or
      "saved view"); and state that the evidence container uses the mockup's
      paragraph and list spacing.
- [x] In the Kept Constructs section, add that any failure escaping the
      matcher or parser for one resource is converted to an `unresolved`
      reason for that resource rather than aborting classification.
- [x] Add to the Inputs section that per-view evidence records are emitted
      only for views with at least one reason or excluded resource.
- [x] Correct the Milestone 6 checklist reference from `src/server/changed.ts`
      to `src/server/changed_content.ts` and `src/server/changed_resources.ts`.
- [x] Validate Markdown and relative links.

## Milestone 12: Backend review fixes

Completed. Delivered by a Codex session and verified by the coordinator on
the combined tree with Milestone 13. Classification is now about ten percent
faster than the original baseline because base-side reads and traversal are
deferred to views with changed stylesheets.

Fix the classification, analysis, payload, and documentation findings.

- [x] Finding 1. Add `analysisOwnsStylesheet(path, config)` to
      `src/review/css/paths.ts` and use it in both `screen_compare.ts` and
      `component_classification.ts` so only public stylesheets under
      `mockupsDir` are stripped from `sharedImpact`. Add a failing test first:
      a screen-only catalogue with a `src/styles/**` glob keeps a token
      stylesheet in `sharedImpact` in v2 and v3.
- [x] Finding 2. Emit `material: true` on a view when its normalized documents
      differ, in `screen_compare.ts` and `component_view.ts`; validate and
      round-trip it in `result_records.ts`, `result_validation.ts`, and the
      client decoder; require its absence in `isStyleOnlyView`. Test: a view
      with both a material change and a matched stylesheet reads "Screen
      changed".
- [x] Finding 6. Defer base-side work in `src/server/changed_content.ts` and
      `src/server/changed_resources.ts`: read and normalize the base fragment
      and traverse the base resource graph only when the view has at least one
      changed stylesheet resource. Re-run `benchmark:large` on the Milestone 3
      fixture and record the corrected end-to-end delta beside the CSS share
      in the timings section, naming the cause.
- [x] Finding 7. Skip per-view evidence records with no reasons and no
      excluded resources, and screens left with no views, in
      `classifyChangedContent` and `assembleExport`. Add tests.
- [x] Finding 8. Wrap the per-resource analysis in
      `CssResourceAnalysis.analyze` so any escaping error becomes an
      `unresolved` reason for that resource; move `selectOne` inside the
      guarded region in `document_query.ts`. Add a test with an injected
      throwing matcher.
- [x] Finding 9. Remove the strict `readMany` fallback from
      `SelectedAssetReader.readManyIfExists`; fall through to per-route
      optional reads. Add a test with a reader that has `readMany` only.
- [x] Finding 10. Delete the `.mb-impact-card` rules from
      `src/server/shell/css_review.ts`.
- [x] Finding 12. Make `extractCssReferences` in `src/html_references.ts` use
      the CSS tokenizer in `src/review/css/source.ts` for `url()` and
      `@import` extraction so one tokenizer defines URL boundaries. Add tests
      for `url(a/*/b.svg)`, a quoted URL containing `/*`, and a comment
      before `url(`.
- [x] Finding 13. Correct `README.md` to say two test workers.
- [x] Finding 14. Add a file-level doc comment to each module under
      `src/review/css/` that lacks one.
- [x] Run tests, typecheck, lint, format check, and `cargo xtask check`.

## Milestone 13: Correct the stylesheet evidence mockups

Tags: mockup

Completed. Delivered by an Opus 5 agent and verified by the coordinator.
The matched, unresolved, and new unnamed screens depict a loaded side-by-side
comparison; the excluded screen shows the plain preview and ends with
"No changes to this screen." The browser eligibility allowlist gained the
three comparison-bearing style screens.

- [x] Finding 3. Change the matched and unresolved design screens to depict a
      loaded comparison stage (side by side, as `design-review-changed` does)
      with the "Styles this screen uses changed" heading inside that stage.
      Remove the stage heading from the excluded screen so it shows the plain
      current preview.
- [x] Finding 4. Add the terminal "No changes to this screen." line to the
      excluded mockup card, after the examined-and-excluded list.
- [x] Finding 5. Add an unresolved example without selectors, using the lead
      "This change can apply anywhere on the screen, so the screen stays in
      Changes." with no list, inside the existing unresolved screen or as a
      variant of it within the five-screen limit.
- [x] Finding 11. Record in `docs/protocol/mokly-shell-design.md` that the
      shell evidence container adopts the mockup's paragraph and list spacing
      while keeping its separator treatment; adjust the mockup card only if
      that decision changes its appearance.
- [x] Build and check the example, run the design tests, and open each changed
      page from disk in both variants.

## Milestone 14: Shell review fixes

Tags: ui

Completed. Delivered by an Opus 5 agent and verified by the coordinator:
one entry-kind wording helper, the colon-free empty unresolved lead, the
mockup's evidence spacing, and browser coverage for the terminal line, the
empty unresolved case, and the material-plus-stylesheet heading.

- [x] Finding 4. Branch the terminal status line on entry kind: "No changes
      to this screen." for screens and "No changes to this saved view." for
      variants, through one shared wording helper also used by
      `diff_views.ts`.
- [x] Finding 5. Use a colon-free unresolved lead when there are no
      selectors; update the existing empty-selector test.
- [x] Finding 11. Add paragraph and list spacing rules to
      `.mbk-comparison-evidence` matching the mockup card.
- [x] Extend the client unit tests and `tests/browser/css_evidence.spec.ts`
      for the corrected copy, the material-plus-stylesheet heading, and the
      empty unresolved case.
- [x] Run tests, typecheck, lint, format check, browser tests, and
      `cargo xtask check`.

## Milestone 15: Commit and review the fixes

- [x] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [x] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md` after the push. Report findings
      with severity, context, impact, lettered options, and a recommendation;
      do not change the implementation.

## Milestone 16: Define the re-review fix contract

Documentation-only milestone.

- [x] Finding 1. In `docs/protocol/mokly-changes.md`, state that live
      classification walks a changed or moved document's base-side resource
      graph regardless of whether any stylesheet changed, so verified
      deletions of non-stylesheet resources keep marking consumers; only
      unchanged, unmoved views without a changed stylesheet skip the walk.
      Correct `src/review/README.md` to match.
- [x] Finding 4. In `docs/protocol/mokly-css-attribution.md`, remove the two
      sentences saying a historical result without `material` is treated as
      unknown, and replace them with the reason historical results are safe:
      the style label also requires an `analysis`-bearing reason, which only
      producers that emit `material` write.
- [x] Finding 5. Reword the analysis-scope validation rule so producers
      guarantee scope during discovery through `analysisOwnsStylesheet` and
      assert it, while the shared decoder validates stylesheet identity only.
- [x] Finding 6. Split `docs/protocol/mokly-css-attribution.md` at the Shell
      Presentation seam into the analysis contract and a new
      `docs/protocol/mokly-css-evidence-shell.md` presentation contract; move
      the stylesheet evidence paragraphs from `mokly-shell-design.md` into the
      new document; cross-link both; update the protocol index and every
      inbound link.
- [x] Finding 2. Add to the shell presentation contract that no design screen
      without a comparison toolbar renders a comparison stage heading.
- [x] Finding 3. Reword the spacing paragraph so the mockup card is required
      to render 8px above paragraphs and lists and 14px after a list, and the
      shell matches it.
- [x] Validate Markdown and relative links.

## Milestone 17: Backend re-review fixes

Completed. Delivered by a Codex session and verified by the coordinator on
the combined tree with Milestone 18. The base graph is collected for every
changed or moved document; a cross-path equivalence test guards live and
complete classification; producers assert analysis scope.

- [x] Finding 1. In `src/server/changed_resources.ts`, collect the base graph
      whenever a stylesheet changed or the document changed or moved; drop the
      conjunct that also requires a stylesheet in `changedPaths`. Add a
      failing test first in `tests/server_changed_lazy_base.test.ts`: a
      changed document whose deleted image is its only evidence, with no
      stylesheet anywhere in the diff, keeps the consumer in Changes.
- [x] Finding 1. Add a cross-path equivalence test asserting
      `classifyChangedContent` and `compareReview` retain the same reason
      set per view for the same fixture, parameterised over a diff with and
      without a stylesheet. Re-run `benchmark:large` on the Milestone 3
      fixture and record the figures in the timings section.
- [x] Finding 5. Assert in `screen_compare.ts` and
      `component_classification.ts` that every analysed reason path satisfies
      `analysisOwnsStylesheet`, failing with `review-invalid`; unit test it
      with an injected out-of-scope analysed reason.
- [x] Finding 7. Add a doc comment to `renderWorkspaceEvidence` naming the
      merge contract and linking the shell derivation rule.
- [x] Finding 8. Replace the `.mb-impact-card` assertion in
      `tests/browser/component_explorer_runtime.spec.ts` with one asserting
      the diff stage contains no evidence panel and evidence lives only in
      the workspace evidence container.
- [x] Run tests, typecheck, lint, format check, browser tests, and
      `cargo xtask check`.

## Milestone 18: Correct the impact mockups

Tags: mockup

Completed. Delivered by an Opus 5 agent and verified by the coordinator. The
shared-impact and ignored-only screens render the plain preview; the
eligibility spec forbids stage headings without a toolbar; the audit found
and fixed three equal-specificity collisions between mockup card rules and
later inspector rules.

- [x] Finding 2. Remove the `ComparisonStage` wrapper from
      `design-review-shared-impact` and `design-review-ignored-only` so both
      render the plain current preview like `design-review-style-excluded`.
      Remove the `unchanged` and `ignored-only` state labels from the design
      parts if nothing else uses them.
- [x] Finding 2. Extend `tests/browser/design_comparison_eligibility.spec.ts`
      to assert that any design screen without a comparison toolbar has no
      comparison stage heading.
- [x] Finding 3. Raise the specificity of the `.mbk-comparison-details`
      paragraph and list rules in `examples/basic/generated/design-review.css`
      so the card renders 8px above and 14px after a list despite the later
      inspector stylesheet; audit the design catalogue for other `mbk-*` card
      rules overridden by `ce-*` rules of equal specificity and fix any found
      the same way.
- [x] Build and check the example, run the design tests and the eligibility
      browser spec, and open each changed page from disk in both variants.

## Milestone 19: Commit and review the re-review fixes

- [x] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [x] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md` after the push. Report findings
      with severity, context, impact, lettered options, and a recommendation;
      do not change the implementation.

## Follow-up plans (not part of this change)

- Browser-backed refinement: use Chrome's matched-rules and computed-style
  data through the existing Playwright dependency to evaluate conditions,
  specificity, and inheritance for views the static pass kept.
- Ownership inference: derive `ownedDependencies` from component modules that
  import CSS Modules or define styles inline.
- Bundle mapping: attribute compiled stylesheet output back to source modules
  for consumers who ship a single built CSS file.
