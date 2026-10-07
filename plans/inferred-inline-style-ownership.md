# Inferred Inline Style Ownership

Status: Active. Implementation is delivered on this branch. Review findings
remain for the user's decision; mainline integration is in progress.

Replace the renderer-supplied style and resource ownership records with
ownership that Mokly derives from the rendered documents and the component
ranges it already records. Style rules that a styling library places in the
document head, such as React Native Web atomic classes or CSS-in-JS output,
are attributed to the registered components whose markup they can match,
without any consumer code. The renderer contract returns a plain HTML string
again, and the manifest no longer carries `styles` or `resources` tables.

## Base And Prerequisites

This plan is based on `origin/main` at `3699c56`. The records it replaces were
added by the component explorer change (pull request #48) and are defined in
the [rendering contract](../docs/protocol/mokly-rendering.md), the
[manifest schema](../docs/protocol/mokly-component-manifest.md) and the
[attribution contract](../docs/protocol/mokly-component-changes.md). The
rule-level stylesheet analysis this plan reuses was delivered by
[CSS change attribution](./css-change-attribution.md) and lives under
`src/review/css/`. Nothing in this repository returns ownership records: the
example renderer in `examples/basic/renderer.tsx` returns a string, and the
test renderers also use the string-only contract.

## Problem

Component-generated CSS can live in a `<style>` element in `<head>`, outside
every component range. Mokly cannot tell from markup alone which component a
head rule belongs to, so an edit to one component's styles marks every screen
that renders that CSS as changed. Before this plan, the answer was a
renderer-returned record: `{ startOffset, endOffset, componentIds }` for style text and
`{ path, componentIds }` for public files. Those records are now removed. The
three defects below explain why this plan replaced them.

1. The renderer is the wrong party to ask. React Native Web, Emotion,
   styled-components and similar libraries do not report which registered
   component produced a rule, so a consumer would have to instrument its
   styling library to fill in `componentIds`. Nobody has.
2. Byte offsets into HTML that Mokly rewrites are fragile. The builder must
   rebase them through header insertion, link rewriting and the compatibility
   transformer (`src/components/style_ownership.ts`, `src/build/compile.ts`),
   the historical comparison must apply them against original bytes before
   normalizing retired markers, and every reader validates them.
3. Atomic CSS does not fit an ownership record at all. React Native Web keeps
   one process-global sheet that grows with every render in a build, so a
   screen's head contains rules for every screen rendered before it, and an
   edit adds new rules rather than editing owned ones. A per-range record
   cannot describe that, and even a correct record would not stop the added
   rules from marking later screens changed.

## Decisions

1. **Ownership is inferred at comparison time, not asserted at build time.**
   For a paired view, Mokly diffs the rules of the unowned `<style>` elements
   on both sides, matches each diffed rule against both documents, and maps
   every matched element to its innermost recorded range. A rule whose
   matches all belong to paired component instances is owned by those
   components; a rule with any entry-owned match stays with the entry. This is
   the same sound matchability argument the linked-stylesheet analysis
   already relies on, applied to the page's own styles.
2. **The renderer returns a string.** `RenderResult`, `ComponentStyleOwnership`
   and `ComponentResourceOwnership` are removed from the public API. A renderer
   that returns anything other than a complete HTML document string fails the
   build with a typed diagnostic naming the entry and view. Pre-1.0 breaking
   changes are acceptable, and no consumer returns records.
3. **Explicit file ownership stays declarative.** `ownedDependencies` remains
   the way to say that a stylesheet, font or image belongs to a component. The
   `resources` records were redundant with it for every case the repository
   tests, so they are removed rather than re-derived. What this plan adds for
   files is narrower: a `url()` or `@import` reference inside an inferred-owned
   inline rule follows that rule's owner.
4. **Rules that can match nothing are excluded.** A diffed head rule whose
   selectors match no element on either side cannot change the rendered
   result. It is set aside exactly like an excluded stylesheet rule, so a
   cumulative React Native Web sheet no longer marks unrelated screens. Every
   construct the stylesheet analysis keeps conservatively (unparseable,
   shadow-scoped, global, custom-property, selector-less, parse failure) is
   kept here too and stays with the entry as `unresolved`.
5. **Materiality follows attribution, not style bytes.** The comparison
   material for a view removes its unowned `<style>` elements and appends one
   deterministic canonical rendering of the rules that stay with the material
   being compared. Reordered, reformatted or reflowed inline CSS with
   the same rules is therefore not a change, while an entry-retained rule
   edit still is. Snapshots keep the real bytes.
6. **Manifest schema version stays 5.** `ComponentViewRecord` loses `styles`
   and `resources`. Current loading rejects those keys; historical loading at
   the Git boundary and in the rebuilt baseline cache accepts and discards
   them, because a merge-base commit built by an earlier Mokly still carries
   them. A version bump was considered and rejected: it would touch every
   fixture and doc that names v5 for a field removal the historical reader
   must tolerate anyway, and readers of unknown versions already fail with a
   rebuild diagnostic.
   Merge note: after integrating main's identity-keyed v7 schema, retirement applies to the current manifest version without another version bump.
7. **Excluded page styles get their own evidence and presentation.** A view
   whose only inline-style change is excluded stays out of Changes and out of
   the `changed` state, and its Details panel says so with product copy that
   mirrors the excluded-stylesheet card. This needs a new optional view field,
   one new design screen and a shell change, kept in separate milestones.
8. **Matching uses the normalized, marker-retaining documents.** Elements
   inside paired manual-ignore regions never grant a match, matching the
   stylesheet analysis, and the base document is normalized to the current
   marker dialect before its ranges are validated. The original-coordinate
   rule for historical style offsets is retired with the offsets.

## Non-Goals

- Rule-level owner inference for linked stylesheet files. Their ownership
  keeps `ownedDependencies`; extending inference to them is a possible
  follow-up plan, not part of this one.
- Evaluating media, container or supports conditions, specificity, cascade
  order, or inheritance beyond the custom-property keep rule.
- Any change to catalogues without registered components. Their inline style
  edits remain ordinary material changes under the schema-v2 classifier.
- Browser-verified refinement, pixel comparison and screenshots.
- Changing what a component's own page compares: root-owned head rules on a
  saved-variant page stay material for that component, as they are today.

## Design Summary

### Inputs

For one paired view on the complete comparison path, after both sides' ranges
are validated in their own dialect, the analysis locates every `<style>`
element on each side whose start offset lies inside no recorded range. These
are the unowned style elements. When both sides' unowned style text is
byte-identical and no unowned rule carries a reference, the analysis is
skipped and the documents pass through unchanged. Otherwise the paired
ignore-normalized, marker-retaining documents are built, the base normalized
to the current marker dialect, ranges are validated again on that text, and
both documents are parsed with source locations.

Each side's unowned style texts are parsed through the classification's shared
cached `CssRuleParser`, and the two sides' rule lists are diffed as one
multiset with the existing `diffCssRules`. The analyzed rules are the diff's
added, removed and changed rules and every rule on either side that carries a
resource reference in its declarations, own at-rule prelude or non-nesting
condition preludes. One shared detector covers tokenized `url()` plus string-
and `url()`-form `@import`, consistently with resource discovery. An unchanged
reference identity becomes one distinct delta with both sides' rule records.
A parse failure on either side yields no rules and no attribution; both
materials keep the unowned style text verbatim.

### Attribution

Every analyzed rule receives exactly one attribution:

- `unresolved` when the closed keep list of the stylesheet analysis applies:
  a selector the matcher cannot parse, shadow-scoped or global selectors, an
  unresolvable nesting parent, a changed custom property, a selector-less
  at-rule, or a parse failure. Changed references in selector rules are
  attributed by matching; selector-less imports remain unresolved.
- `excluded` when the rule's selectors match no element on either side.
- `entry` when any matched element on either side is entry-owned.
- `owned` with a sorted, non-empty set of component ids when every matched
  element on both sides belongs to a paired component instance with equal
  inputs.

An element's owner is its innermost enclosing range: an instance range gives
that instance; a slot range gives the slot's owner, which is the entry or the
instance that supplied the slot; no enclosing range means the entry. An
instance counts as paired only when the same key names the same component id
on both sides. A paired instance with an equal `propsKey` owns its matches; a
paired instance whose `propsKey` changed passes them to whoever supplied its
inputs, resolved by the same rule, so a caller prop edit under atomic CSS
stays with the caller. An unpaired instance, the root component of a
saved-variant page, and any element in no range all resolve to the entry. A
parse failure on either side yields no attribution and no owned set; both
materials keep the unowned style text verbatim.
State-dependent pseudo-classes and pseudo-elements are stripped before
matching exactly as the stylesheet analysis strips them, so matching can only
widen the owner set, which keeps the result conservative.

### Comparison Material

Two renderings are produced from one analysis. Both remove every unowned
style element from the original document in the original coordinates, in the
same replacement pass as today's `projectOwnedMaterial`, and append one
`<style>` element with the canonical rendering after the document, as
caller-slot material is appended, so the count and attributes of the
library's style elements carry no identity. The projected rendering applies
instance tokens in that pass; the actual rendering applies none.

- The actual material, which decides the view `state` and `material` flag,
  renders every rule except `excluded` ones. Owned rules stay, so an affected
  screen still shows as changed, as it does today.
- The projected material, which decides the entry's `material` reason and
  its projected resource discovery, renders every rule except `excluded` and
  `owned` ones, alongside the existing instance identity tokens.

The view `state` and `material` flag derive from the actual materials: the
changes contract defines `material` as "the actual comparison material
differs", and the single-document normalizations of the actual materials
decide `unchanged` against `ignored-only`.

The canonical rendering sorts rules by their identity, ignores ordinals,
wraps each rule in its conditions outermost first, and emits valid CSS whose
declaration text is the parser's normalized text, so `url()` and `@import`
references survive for reference discovery. Unchanged rules render
identically on both sides, so only entry-retained rule edits make the
projected material differ.

Owned attributions feed the implementation-impact set that
`changedComponentImplementations` produces, so the owning component gets a
`material` reason and its consumers become affected, even when no saved
variant exercises the edited rule. A component's own saved-variant page still
reports root-owned rule edits as material through the ordinary entry path.

Each distinct owner set's reference-bearing rules are rendered into a
canonical fragment and traversed with the corresponding side's ordinary
resource reader at the view path. Retained actual-view dependency reasons use
the union of inferred and declarative owners present in the view. Derived
byte-only changes give those owners `material` impact without inventing Git
evidence. Unchanged reference deltas remove owned/excluded rules symmetrically
from both sides and contribute no inline evidence.

### Evidence

`ViewReview` gains one optional field, allowed in both result schema versions
and emitted only by the component-aware classifier:

```ts
type InlineStyleEvidence =
  | { status: "matched" | "unresolved"; selectors: readonly string[] }
  | { status: "excluded" };

interface ViewReview {
  // existing fields unchanged
  inlineStyles?: InlineStyleEvidence;
}
```

`matched` and `unresolved` mean the entry retained at least one analyzed
diffed rule and list that rule's selectors, sorted and duplicate-free, with
`unresolved` taking precedence and permitted to be empty; `matched` requires
at least one selector. `excluded` means the diff produced at least one rule,
every diffed rule was excluded and the view's resulting state is `unchanged`.
When excluded rules exist but the view is `changed` or `ignored-only`,
retains a reason or has owned rules, the field is omitted, because the view's
other evidence explains it. Views settled by the
unchanged decision, one-sided views and views without unowned inline style
differences carry no field. The live classification snapshot, static exports
and the selected live endpoint carry the field beside `reasons` and
`excludedResources`.

### Membership And States

A view whose unowned inline styles changed only through excluded rules has
equal actual material, so its state is `unchanged`, it has no `material`
flag, it contributes no reason, and it is not in Changes. A view with owned
rule edits is `changed` with `material`, contributes no entry reason for
those rules, and is affected through the owning component. A view with
entry-retained rule edits is `changed` with `material` and a `material`
entry reason. Every other Changes signal is unchanged.

## Milestone 1: Protocol And Documentation Contract

Summary: define document-derived ownership, the string-only renderer
contract, the manifest field removal with historical tolerance, the evidence
field and the shell presentation in the specs before any code changes, and
register the plan. Documentation-only; validated with Prettier and a diff
review rather than `cargo xtask check`.

- [x] Register this plan in [the plans directory](./) (then indexed by `plans/README.md`).
- [x] In [`mokly-rendering.md`](../docs/protocol/mokly-rendering.md), make
      the renderer contract `(input: RenderInput) => string`, delete
      `RenderResult` and the ownership sentence, and state that a non-string
      result fails the build with a typed diagnostic naming the entry,
      viewport and color scheme.
- [x] In [`mokly-component-manifest.md`](../docs/protocol/mokly-component-manifest.md),
      remove `ComponentStyleOwnership`, `ComponentResourceOwnership` and the
      `styles`/`resources` fields from `ComponentViewRecord`; rewrite the
      styles paragraph of "Styles, Validation, And Serialization" as the
      historical-tolerance rule: current v5 records reject those keys,
      historical v5 records accept arrays under those keys and discard them,
      and the schema version stays 5. Drop "style offsets" from the
      inspection-coordinates sentence.
- [x] In [`mokly-component-changes.md`](../docs/protocol/mokly-component-changes.md),
      replace the renderer-record paragraph of "Dependencies And Styles" with
      the inferred-ownership contract (inputs, attribution, materials,
      exclusion, implementation impact), replace every "instances, styles, or
      entry-owned slots" eligibility phrase in the unchanged view decision
      with "instances or entry-owned slots", note that the fast path skips
      the analysis because equal documents have equal unowned styles and that
      reference-bearing unowned rules still run it for projected discovery
      from Milestone 5, rewrite the historical-coordinates paragraph of
      "Baselines And Migration" to the normalized-document rule, and update
      "Required Evidence" from "owned external and head styles" to the
      inferred cases listed in Milestone 4.
- [x] In [`mokly-component-review.md`](../docs/protocol/mokly-component-review.md),
      add `inlineStyles` to the normative `ViewReview` fields with its
      validation rules, remove "styles, and resources" from the
      complete-comparison list, and state the excluded-only membership rule.
- [x] In [`mokly-css-attribution.md`](../docs/protocol/mokly-css-attribution.md),
      add an "Inline Styles" section that defines the analysis scope, the
      attribution outcomes, the two renderings, the evidence field and the
      Milestone 5 reference rule; rewrite the non-goal "Inferring ownership
      from CSS Modules, CSS-in-JS, or bundled output" to name only import
      graphs and bundled output; and replace "explicit or renderer-proven
      ownership" with "explicit or inferred ownership".
- [x] In [`mokly-css-evidence-shell.md`](../docs/protocol/mokly-css-evidence-shell.md),
      add the inline evidence presentation: matched and unresolved inline
      selectors join the existing outcome lists; an excluded-only view leads
      with "Styles on this page changed, but none of the changed styles apply
      to this screen." followed by the entry's terminal no-changes line; the
      shared-component note appears only when a changed component affects the
      entry; and name the new design screen from Milestone 2.
- [x] In [`mokly-timings.md`](../docs/protocol/mokly-timings.md), add the
      `review.inline-style-analysis` span beside `review.css-analysis`. The
      passing-mention edits first made here to `mokly-derived-baselines.md`,
      `mokly-catalogue.md`, `mokly-source-protection.md`,
      `mokly-on-demand.md` and `mokly-component-controls.md` were reverted
      after the second review's finding 5, because those documents describe
      shipped behavior; they move to Milestone 4.
- [x] In [`build-pipeline.md`](../docs/architecture/build-pipeline.md) and
      [`package-boundary.md`](../docs/architecture/package-boundary.md),
      describe the string-only renderer and remove the structured-result
      sentences. The guide edits first made here were reverted after review
      finding 8, because packaged guides describe shipped behavior; they move
      to Milestone 4.
- [x] Check `src/components/README.md`, `src/review/README.md` and
      `src/build/README.md`; the first two describe the shipped record
      behavior and are updated in Milestone 4, the third mentions no records.
- [x] Validate the changed Markdown with `npx prettier --check` and review
      the diff; documentation-only work does not require `cargo xtask check`.
- [x] Discovered: the CSS attribution contract already exceeds the ~250-line
      guideline, so the inline-style contract lives in a new
      [`mokly-inline-styles.md`](../docs/protocol/mokly-inline-styles.md)
      and the CSS contract's "Inline Styles" section is a pointer; register
      the new document in the [protocol index](../docs/protocol/README.md),
      link it from the registered-components contract, and add the
      `inlineStyles` view field to the schema-v2 shape in
      [`mokly-changes.md`](../docs/protocol/mokly-changes.md).
- [x] Discovered: mark each edited contract's Delivery Status with the
      approved-target sentence naming this plan, so the protocol index rule
      holds while the implementation milestones are pending; Milestone 8
      removes those sentences.
- [x] Discovered: `src/build/README.md` mentions no records and needs no
      change.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 1 review findings

Reported by the post-push review of commit `0fc24de`. All nine were applied
by the follow-up documentation commit at the user's request; the list is
retained for traceability, with the applied resolution per item.

1. High. `excluded` inline evidence is defined by rule outcome alone, but its
   validation rule requires an `unchanged` view with no `material` and no
   reason; a view with excluded head rules plus a markup edit satisfies one
   and fails the other. Applied: `excluded` is emitted only when the actual
   materials are equal and the view retains no reason.
2. High. `mokly-changes.md`, `mokly-component-review.md` and
   `mokly-css-attribution.md` still define `material` as "the paired
   ignore-normalized documents differ", which contradicts the new contract
   for excluded-only inline edits. Applied: `mokly-changes.md` now owns the
   definition as "the view's actual comparison material differs" and the
   other contracts reference it.
3. High. Owner pairing uses key and component id only. A caller prop edit
   under atomic CSS adds a head rule matching only that instance, which the
   contract would attribute to the component and turn into a false component
   row. Applied: a paired instance owns its matches only with an equal
   `propsKey`; otherwise the match passes to whoever supplied its inputs.
4. Medium. The Scope section says fast-path views run no analysis while the
   same document and `mokly-component-changes.md` say reference-bearing
   rules do. Applied: the Scope section now says there is nothing to diff
   and states the reference-only pass.
5. Medium. `unchanged` versus `ignored-only` still derives from stripped raw
   documents, so an excluded-only inline edit would report `ignored-only`;
   the actual material is also described as applying instance tokens, which
   it does not. Applied: both normalizations use the actual materials and
   the actual rendering applies no tokens.
6. Medium. A parse failure is said to make "every rule" unresolved, but an
   unresolved diff carries no rules and no rendering is defined.
   Applied: both sides' unowned text stays verbatim, the view reports
   `unresolved` with an empty selector list and no owned set.
7. Medium. Replacing style text only cannot make materials equal when the
   number of unowned style elements or their attributes differ, as Emotion
   output does. Recommended: remove unowned style elements from both
   materials and append one canonical fragment, as caller-slot material is.
   Applied as recommended.
8. Medium. `mokly-changes.md`, `mokly-timings.md` and the components guide
   present the target as implemented. Applied: the plan sentence was added
   to the two contracts and the architecture docs, and the guide edits were
   reverted and moved to Milestone 4.
9. Low. The evidence-shell contract cites an inventory row Milestone 2 adds;
   Required Evidence omits the formatting-only, nested-slot-child and
   cross-path cases; several spliced lines exceed 120 columns. Applied: the
   citation is qualified, Required Evidence is extended and the spliced lines
   are re-wrapped.

Residual: reference detection in `src/review/css/material.ts` handles
`url()` only; Milestone 5 now carries the `@import` detection TODO.

### Milestone 1 second review findings

Reported by the review of commit `0d85872` and applied by the following
documentation commit.

1. Medium. `excluded` emission required only equal actual materials and no
   reason, but `ignored-only` and derived-mode byte-change views satisfy
   that while failing the `unchanged` validation rule, and a reference-only
   pass with no diffed rule satisfied it vacuously. Applied: `excluded`
   requires at least one diffed rule, all excluded, and a resulting
   `unchanged` state; Milestone 6 tests cover the other states.
2. Medium. The contract never said whether unowned spans come from the
   original or the normalized document, or how a style element inside a
   paired ignored region behaves, and the skip test was undefined for split
   elements. Applied: spans and texts come from the original document with
   own-dialect ranges, matching uses the normalized documents, style elements
   inside paired ignored regions are not unowned material, and the skip test
   compares the ordered span sequence; Milestone 3 gains the ignore-span
   helper and test.
3. Medium. Milestone 3 deleted `rebaseStyleOwnership` while the build still
   called it. Applied: the deletion moved to Milestone 4.
4. Medium. Decision 5 and the Inputs sentence kept pre-review wording, and
   the attribution bullet listed a parse failure as a rule outcome. Applied:
   all three rewritten.
5. Low. Five small contracts and two READMEs described the target without
   the approved-target label. Applied: reverted to shipped behavior and
   moved to Milestone 4.
6. Low. One added line exceeded 120 columns. Applied: every long link line
   re-wrapped.
7. Low. The contract described Milestone 5 behavior while its Delivery
   Status named only Milestone 4, and no task updated the `material` comment
   in the viewer types. Applied: the Delivery Status names Milestones 4 to
   7 and Milestone 4 carries the comment task.

## Milestone 2: Excluded Page Styles Design Screen

Tags: mockup

Summary: add the one new inspector state this plan introduces to the
stylesheet-evidence design group, so the shell milestone implements an
approved design. The group currently renders four screens; this is the fifth
and last the page may hold.

- [x] Add `ExcludedPageStyleCard` to
      `examples/basic/entries/design/parts/review.tsx` with the lead sentence
      "Styles on this page changed, but none of the changed styles apply to
      this screen." and the terminal line "No changes to this screen.", with
      no "Examined and excluded" list.
- [x] Add the `design-review-style-page-excluded` screen to
      `examples/basic/entries/design/review_style_screens.tsx`, rendered
      through the same `Shell`, `NavTree` and `PreviewWorkspace` composition
      as the excluded-stylesheet screen, with mobile and desktop variants,
      slug `page-excluded`, and a description that says the page's own styles
      changed, nothing applies, the screen stays out of Changes and offers no
      comparison.
- [x] Add the destination to `examples/basic/entries/design/parts/destinations.ts`
      and the inventory row
      `design/review/impact/stylesheets/page-excluded.html` to the
      [shell design inventory](../docs/protocol/mokly-shell-design.md).
- [x] Discovered: register the new route in the authored design navigation,
      update the stylesheet-evidence group, design-link contract and example
      README inventory, and extend the design tests for its route, inventory
      counts, exact evidence omissions, filter destination, and
      comparison-free presentation.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and visually smoke-test the new page and its siblings through
      `npm run dev`; commit only authored sources.
- [x] Run the relevant design tests and `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 2 review findings

Reported by the post-push review of commits `ef1abc9` and `21702a7`. Not
applied; recorded for the user's decision, with each item's status after the
later milestones.

1. Low. The mockup covers excluded page styles only as a screen's sole
   evidence, while the evidence-shell contract says both an excluded linked
   stylesheet and excluded page styles "lead with" their sentence, so a
   combined state had no approved composition. Recommended: a composition
   rule in the evidence-shell contract (the page-style sentence follows any
   "Examined and excluded" list and precedes the terminal line; "leads with"
   applies only to sole evidence), pinned by a shell test. Status: Milestone 7
   renders an excluded stylesheet's block first, then the page-style sentence,
   then the terminal line, and tests that order; the contract still lacks the
   composition rule.
2. Low. `mokly-shell-design.md` claimed every recorded state was implemented
   before the viewer could show `design-review-style-page-excluded`. Status:
   resolved; Milestone 7 shipped the state.
3. Low. `mokly-design-links.md` says all five style-evidence states are
   entered through filter controls, but the unnamed and page-excluded states
   have no inbound link and the test named for entry checks only exits.
   Recommended: reword the sentence and rename the test. Status: open.

## Milestone 3: Inline Rule Attribution Engine

Summary: build the pure analysis under `src/review/css/` with unit tests,
without changing classification yet. Every module stays under the file-size
target and depends on the existing parser, diff and matcher.

- [x] Add `src/review/css/inline_styles.ts` beside the legacy renderer-record
      discovery in `src/components/style_ownership.ts`. Its span finder takes
      an original document, its own-dialect validated ranges and paired ignore
      ids, and returns ordered `{ start, end, source, text }` records in the
      original coordinates for eligible unowned HTML CSS `<style>` elements.
      Leave `rebaseStyleOwnership` and its callers unchanged until Milestone 4.
- [x] Expose every paired ignored-region id from `normalizeReviewPair` in
      `src/review/ignore.ts`, sharing its one-sided-material pairing rule; the
      span finder walks original current/retired marker comments rather than
      consuming normalized offsets.
- [x] Add `src/review/css/element_owners.ts`: build an owner index from
      validated ranges, instance records, slot records and both sides'
      instance maps, and resolve `ownerAt(offset)` to `{ kind: "entry" }` or
      `{ kind: "component"; componentId }` using the innermost enclosing
      range, the equal-`propsKey` pairing rule with its input-owner fallback,
      and the root rule in the design summary.
- [x] Extend `src/review/css/document_query.ts` with `selectDocument` that
      returns every matched element, sharing the existing token rewrite and
      contained error boundary with `matchesDocument`.
- [x] Add `src/review/css/inline_attribution.ts` exposing
      `attributeInlineRules(input)` for one view: inputs are both sides'
      normalized marker-retaining documents, their validated ranges and usage
      records used to build the paired instance maps, the root component id
      and the cached parser; output is the analyzed rules with attributions,
      the retained selectors by status, and the owned component set. Apply the
      keep list before matching in the documented order.
- [x] Add `src/review/css/inline_rendering.ts` with the deterministic
      canonical rendering of a rule list to CSS text, and
      `inlineMaterialReplacements` that produce the actual and projected
      removal lists for a side's unowned spans plus the appended `<style>`
      fragment, keeping the verbatim text when the diff is unresolved.
- [x] Wrap the per-view analysis in the `review.inline-style-analysis`
      timing span with the same `ok`/`error` status rules as
      `review.css-analysis`, logging no paths, selectors or CSS.
- [x] Discovered: refine the inline-style Scope contract and span tests for
      HTML/CSS namespace, `type`, `media`, template, outer-source/content and
      original-coordinate rules, including historical headers and dialects,
      attribute-only edits, and paired versus one-sided ignored regions.
- [x] Discovered: refactor `diffCssRules` into a shared rule-list diff and
      string entry point, parse each style element independently, rebase its
      ordinals, and test element-split equality and per-element failures.
- [x] Discovered: extract the stylesheet keep preparation into one shared
      ordered function with a changed-reference switch; Milestone 3 keeps
      changed inline references unresolved and Milestone 5 relaxes it.
- [x] Discovered: make owner lookup use normalized source offsets, innermost
      range content, direct slot owners, recursive changed-input ownership,
      the root rule and a defensive cycle guard.
- [x] Discovered: make `selectDocument` and `matchesDocument` share one
      rewritten selector predicate and contained `CssSelectorError` boundary.
- [x] Discovered: preserve statement versus block at-rules in parsed rules and
      canonical rendering, order sheet-leading statements first, and prove
      nested parents, conditions, keyframes and references render faithfully.
- [x] Discovered: make identical outer-source sequences skip without parsing
      and unresolved diffs retain both documents verbatim with no appended
      fragment; reference-only fast-path work remains Milestone 5.
- [x] Discovered: align the timing contract with the pure engine: the span
      includes discovery and direct skipped calls now, classification wiring
      follows in Milestone 4 and reference-only calls in Milestone 5.
- [x] Discovered: update `src/review/README.md` for the pure inline-style
      engine and its not-yet-wired Milestone 3 boundary.
- [x] Add `tests/review_css_inline_attribution.test.ts` covering: owned by
      one component; owned by two components; entry match on one side only;
      unpaired instance resolves to entry; paired instance with changed
      `propsKey` resolves to its input owner, for an entry-supplied and a
      parent-supplied child; root resolves to entry on its own page; slot
      content owned by the entry; slot content owned by a nested
      instance; excluded on both sides; every keep-list construct; parse
      failure on one side; ignored-region elements never match; nesting
      parents; and stripped state pseudo-classes widening the owner set.
- [x] Add `tests/review_css_inline_rendering.test.ts` covering ordering,
      condition wrapping, selector-less at-rules, reference survival through
      `extractCssReferences` from the appended fragment, element removal
      regardless of count or attributes, and verbatim retention on a parse
      failure.
- [x] Add `tests/review_css_inline_timings.test.ts` mirroring the existing
      timings test for the new span.
- [x] Run the new tests and the existing `review_css_*` tests, then
      `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 3 review findings

Reported by the post-push review of commit `95f582d`. Not applied unless
stated; recorded for the user's decision.

1. Low. The rule diff's grouping key ignores the at-rule `block` flag that the
   canonical renderer's identity includes, so `@layer a;` versus `@layer a{}`
   yields no diffed rule but different fragments, an unexplained `material`
   change. Recommended: one shared rule-identity helper for the diff and the
   renderer (`cssRuleIdentity` now exists but the diff does not use it), the
   flag documented in the CSS attribution rule shape, and an invariant test
   that a resolved diff with no diffed rules renders byte-equal fragments.
   Status: open.
2. Low. Restated inline rules lagged the refined contract. Status: the CSS
   attribution pointer was updated in Milestone 5; this plan's Design Summary
   still carries Milestone 1 wording (a byte-identical style-text skip and
   `diffCssRules`). Recommended: replace the plan's normative design prose
   with a summary that links to `mokly-inline-styles.md`.
3. Low. `tests/review_css_inline_attribution.test.ts` was 585 lines. Status:
   resolved by `922bc08`, which split it with all 19 tests preserved; a
   changed-file TypeScript length audit in `cargo xtask check` remains
   recommended.
4. Low. Five owner and evidence rules had no direct test: same component id
   for pairing, owners resolving to the root component id, forwarded slots,
   unresolved precedence with a sorted union, and the owned-set union; all
   behaved correctly when checked. Recommended: one small fixture per rule.
   Status: open.

## Milestone 4: Document-Derived Ownership In Comparisons

Summary: wire the engine into the component-aware classifier, remove the
renderer, build and manifest record plumbing, and rewrite every test that
authored records so the same attribution is proven from documents alone.
This is the breaking change; its commit carries a `BREAKING CHANGE` footer
naming the renderer contract and the removed manifest fields.

- [x] Make `Renderer` return `string` in `src/renderer/types.ts`; remove
      `RenderResult`, `ComponentStyleOwnership` and
      `ComponentResourceOwnership` from `src/index.ts`, `@mokly/viewer`
      `data.ts` and `manifest_types.ts`; fail non-string results in
      `src/build/render.ts` and `src/components/render.tsx` with a
      `build-invalid` diagnostic naming the entry, viewport and color scheme.
- [x] Remove `styles` and `resources` from `ComponentViewRecord` and every
      producer: `src/components/render.tsx`, `src/build/render.ts`,
      `src/build/compile.ts`, `src/build/document_compiler.ts`,
      `src/components/manifest_build.ts` and
      `src/components/output_validation.ts`; delete
      `validateComponentResources`, `src/components/style_ownership.ts` and
      every `rebaseStyleOwnership` call.
- [x] Update the `material` doc comment in
      `packages/viewer/src/review/types.ts` to the changes contract's
      definition.
- [x] Remove the style-offset and record mentions and the "instances,
      styles, or entry-owned slots" eligibility phrase from
      `docs/protocol/mokly-derived-baselines.md`, `mokly-catalogue.md`,
      `mokly-source-protection.md`, `mokly-on-demand.md` and
      `mokly-component-controls.md`, and describe inferred ownership in
      `src/components/README.md` and `src/review/README.md`; these edits
      were reverted from Milestone 1 because those documents describe
      shipped behavior.
- [x] Update `packages/viewer/src/components/view_validation.ts` and
      `src/components/manifest_validation.ts`: current records use exact keys
      without the retired fields; historical validation accepts arrays under
      `styles` and `resources` and discards them before the record is used.
- [x] Replace the `styles` set and `usage.styles` loop in
      `projectOwnedMaterial` with a replacement list parameter; extend
      `projectComponentPair` and `prepareComponentProjection` to run the
      analysis when unowned style text differs, produce the actual and
      projected materials, and return the owned component set and the
      evidence input; pass an empty replacement list for clipped instance
      projections in `changedComponentImplementations`.
- [x] In `src/review/component_view.ts`, compute `actual`, `material` and
      `rawEqual` from the actual material so an excluded-only inline edit is
      `unchanged`, union the owned set into `changedImplementations`, and
      keep every other reason rule unchanged.
- [x] Discovered: keep linked-stylesheet matching on the real paired-normalized
      documents in both projected and actual resource comparisons; add a
      sibling-structure selector regression that material documents would
      falsely exclude.
- [x] Discovered: expose the classification-scoped cached CSS parser and make
      inline analysis lazily prepare one marker-retaining normalized document,
      current-dialect range set and source-located parse per side only after
      differing eligible outer sources are discovered.
- [x] Discovered: run inline analysis only for complete-path paired views with
      usage records on both sides, including zero-instance views; keep
      one-sided and missing-usage behavior unchanged.
- [x] Discovered: carry actual and projected inline replacements through one
      projection pass, omit them from clipped implementation projections, and
      retain owned ids plus selector/all-excluded evidence for later delivery.
- [x] Discovered: retain `styles`, `resources`, `styleOwnership` and
      `resourceOwnership` in the public-catalogue privacy denylist as defence
      in depth after deleting their manifest/API meanings.
- [x] Discovered: update every affected protocol Delivery Status and the
      architecture/package documentation to describe the delivered string-only
      renderer, retired manifest fields and wired comparison material while
      keeping Milestones 5 to 7 explicit.
- [x] Discovered: extend export and Serve timing integration assertions to
      admit and require `review.inline-style-analysis` for component-aware
      classification.
- [x] In `src/review/component_view_fast_path.ts` and
      `tests/component_fast_path_counts.test.ts`, drop `styles` from the
      ownership-edit eligibility; remove the record cases from
      `suppressResource` and `ownedCssReasons` so only `ownedDependencies`
      remain.
- [x] Remove record handling from the Serve, on-demand and watch paths that
      copy `ComponentViewRecord` (`src/server/**`), the viewer projection and
      adapters (`packages/viewer/src/**`), and the test harnesses that build
      records (`packages/viewer/tests/frame_hook_harness.tsx`,
      `tests/component_render_store.test.ts`, `tests/resource_denials.test.ts`,
      `tests/helpers/design_library_fixture.ts`).
- [x] Rewrite `tests/component_historical_styles.test.ts`: the renderer
      returns a string, the historical manifest still carries legacy
      `styles` records that the reader must discard, and every existing edit
      case produces the same Changes membership and affected consumers from
      inference; add a retired-dialect base with reordered head rules to
      prove marker renames and reordering alone change nothing.
- [x] Rewrite the renderer-record cases in `tests/changes_css_ownership.test.ts`,
      `tests/component_asset_changes.test.ts`,
      `tests/component_build_edges.test.ts`,
      `tests/component_rendering.test.ts`, `tests/component_manifest.test.ts`,
      `tests/component_comparison_material.test.ts` and
      `tests/component_fast_path_equivalence.test.ts` to the string contract
      and to historical tolerance, and add the non-string renderer diagnostic
      case.
- [x] Add focused `tests/changes_inline_styles_*.test.ts` files under 300 lines
      with a shared helper, proving Changes rows, view
      states, reasons and affected consumers for: a cumulative sheet that
      adds another component's rules to a later screen (excluded, screen out
      of Changes, state `unchanged`); a component style edit at an actual
      invocation with no matching saved variant (component row, screen
      affected); a rule shared by two components (both rows, screen
      affected); a rule matching entry markup (screen row); an unresolved
      construct (screen row); a formatting-only inline edit (nothing); the
      root component's own page; a nested child inside a caller slot; a
      caller prop edit under atomic CSS (screen row with `inputs` and
      `material`, no component row); a parent changing the props it passes
      to a child (parent row); Emotion-style per-component style elements
      that appear and disappear; a parse failure on one side (screen row,
      `unresolved`, empty selectors); both viewports and color schemes;
      committed and derived modes; and identical results from live
      classification, complete comparison, publication and the selected
      endpoint.
- [x] Add the inline cases to the fast-path differential fixtures so the
      unchanged decision and the complete comparison still agree.
- [x] Update the packaged guides: remove the ownership-record row and
      `RenderResult` from the exported-type tables in
      `docs/guides/authoring/components.md` and
      `docs/guides/authoring/config.md`, and describe inferred head-style
      attribution in the components guide's Ownership section.
- [x] Update `src/components/README.md`, `src/review/README.md` and the
      CHANGELOG-generating commit body; run the full test suite,
      `npm run package:smoke`, and `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 4 review findings

Reported by the post-push review of commits `922bc08` and `f439de0`. Not
applied as review fixes; recorded for the user's decision.

1. Medium. Unchanged views ran the inline engine on the fast path (two extra
   parse5 parses plus a paired normalization per view with instances),
   raising a 416-view no-change `review.compare-screens` from about 1.4 s to
   2.0 s while contracts said the fast path runs no analysis. Recommended:
   projection-only preparation on the fast path, inline analysis only after a
   fall-through, and a span-count assertion for zero-change classification.
   Status: Milestone 5 gates the fast-path call behind a reference prefilter,
   so views without `url(`, `@import` or an escape skip it; see Milestone 5
   finding 3 for the remaining cost.
2. Low. `tests/changes_inline_styles_fast_path.test.ts` never exercised the
   fast path, and the parent-owns-child-prop test did not assert that the
   screen stays out of Changes. Status: Milestone 6 made the shared helper
   require a fast-path settlement, but catalogue-wide; see Milestone 6
   finding 1.
3. Low. Historical manifest validation was loosened beyond the plan: the
   removed `rootId` parameter was replaced by `historical`, so historical
   manifests skip instance prop-schema and declared-slot checks (a
   schema-invalid historical instance is now accepted). Recommended: discard
   the retired keys but validate records strictly, add a rejection test, and
   use an options object instead of positional booleans. Status: open.
4. Low. Leftovers from the record removal: unused `rootComponentId` in
   `projectComponentPair`, unused `before`/`after` in
   `projectedResourceExclusion`, and an unreachable `!usage` branch whose
   `applyReplacements` duplicates `applyInlineMaterial`. Recommended: remove
   them and enable `@typescript-eslint/no-unused-vars` with `args: "all"`.
   Status: open.

## Milestone 5: Resource References Follow Rule Owners

Summary: let a `url()` or `@import` reference inside an owned inline rule
belong to that rule's owner, completing the replacement of the `resources`
records for files reached only through component styles.

- [x] Extend the analyzed rule set with every unowned rule on either side
      that carries a reference, using the parser's declaration and prelude
      text, and run the analysis on the fast path when such rules exist so
      projected discovery applies the same exclusion on both paths.
- [x] Extend the reference detector in `src/review/css/material.ts` to
      `@import` preludes; it currently recognizes `url()` only.
- [x] Discovered: share one reference detector with `extractCssReferences` for
      declarations, an at-rule's own prelude and non-nesting condition
      preludes, including escaped `url()` and string-form `@import` syntax.
- [x] Relax the keep list for inline rules so a changed reference no longer
      forces `unresolved`; the reference-bearing rule is attributed by
      matching like any other rule. Keep the stylesheet-file rule unchanged.
- [x] Generalize `ownedCssReasons` to `ownedResourceReasons`: an actual-view
      dependency reason for a path reached only through owned inline rules
      is attributed to those owners, joining the `ownedDependencies` owners,
      and propagated through the existing `propagateOwnedCss` path.
- [x] Discovered: represent unchanged reference-bearing rules with both source
      records, remove owned or excluded instances symmetrically from both
      projected sides, and omit those unchanged rules from future inline
      evidence inputs.
- [x] Discovered: discover each distinct inline owner set's rule references
      through the side's ordinary resource graph, union those owners with
      declarative owners, and preserve entry reasons for independently
      entry-reachable paths.
- [x] Add focused `tests/changes_inline_references_*.test.ts` files under 300
      lines covering: a changed
      image referenced only by an owned rule (component row, screen
      affected, screen has no dependency reason); the same image also in
      entry markup (screen row too); an image in an excluded rule (nothing);
      an inline `@import` (unresolved, entry retained); and derived-mode byte
      changes without Git evidence on both paths.
- [x] Discovered: gate fast-path inline span discovery behind the shared cheap
      reference prefilter and prove fast/complete equality for owned, excluded
      and entry references plus derived byte-only changes; add nested-parent,
      mixed entry-markup and two-owner coverage.
- [x] Update the CSS attribution and component-changes contracts if the
      implementation exposes a gap, then run the suite and
      `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 5 review findings

Reported by the post-push review of commit `c5b55cc`. The two items the
supervisor had already raised (a re-export and two contract sentences about
non-CSS ownership) were fixed in `a676a95`. The findings below are not
applied; recorded for the user's decision.

1. Medium. Unchanged inline styles that contain a `url()`, `@import` or an
   escape lose their position: the identical-source skip is cancelled, the
   elements are removed and one canonical fragment is appended at the end, so
   reordering such a style relative to a linked stylesheet (a real cascade
   change) is reported as unchanged, where Milestone 4 reported it. The same
   blind spot exists whenever a moved sheet also has an edited rule, because
   the canonical fragment carries no position. Recommended: when no rule
   changed, rewrite each element in place instead of appending, and stop
   treating `data:`, `http(s):` and `#id` references as reference-bearing;
   closing the whole class needs a product decision on the contract's "order
   carries no identity" rule. Status: open.
2. Low. One rule can receive two conflicting attributions: the unchanged
   pairing reuses a copy the diff reported as added, and rendering removes
   every copy with that identity, so with a custom property an `unresolved`
   retained rule can vanish from both materials. Recommended: pair only copies
   the diff matched, remove only those objects, and assert that no rule object
   appears in two analysed entries. Status: open.
3. Low. The fast-path inline analysis cannot change the fast path's decision
   (it already falls back when any raw-document resource changed), so it only
   adds cost, and its document-wide prefilter fires on SVG `url(#id)`,
   backslashes and views without instances. Recommended: remove it from the
   fast path, always prepare it on the complete path, correct the contracts,
   and test that fast-path-settled views run no inline analysis. Status: open.
4. Low. A stale component-review Delivery Status and a packaged guide that did
   not mention reference-following. Status: resolved by the Milestone 8
   documentation sweep.

## Milestone 6: Inline Style Evidence Delivery

Summary: emit, validate and deliver the `inlineStyles` view field through
every classification path so the shell milestone has data in Serve, exports,
publication and the selected endpoint.

- [x] Add `InlineStyleEvidence` to `packages/viewer/src/review/types.ts`,
      extend `ViewResourceEvidence`, allow the key in
      `result_records.ts`, and validate the shape, sorting, uniqueness and
      the non-empty `matched` rule in `result_resources.ts`.
- [x] Emit the field from `compareComponentView` on the complete path under
      the status rules in the design summary; never emit it on the fast path
      or for one-sided views.
- [x] Carry the field in the component-aware live snapshot's schema-v3 result,
      complete/static comparison, publication and selected live endpoint, with
      canonical key ordering and omission when absent.
- [x] Discovered: correct the delivery contract and plan because schema-v2
      `screenEvidence` is produced only for catalogues without registered
      components, where inline ownership never runs; do not add dead copying
      plumbing to that slice.
- [x] Discovered: include `inlineStyles` in the artifact's shared-result
      validation trigger even though resource-closure validation has no inline
      path to traverse.
- [x] Add `tests/review_inline_styles_schema.test.ts`, extend producer-scope and
      delivery tests, and focused `tests/changes_inline_styles_*.test.ts` files
      under 300 lines with the
      field's presence, absence and validation failures, including
      `excluded` on a `changed` or `ignored-only` view or beside a reason,
      `excluded` omitted for a derived-mode resource byte change with no
      reason, `excluded` omitted for a reference-only pass with no diffed
      rule, and `matched` on an `unchanged` view; prove identical evidence
      across live, complete, published and selected results.
- [x] Discovered: require timing counts in every test that claims fast-path
      behavior so at least one view demonstrably settles there; relabel
      differential cases whose fixtures necessarily take the complete path.
- [x] Run the suite and `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 6 review findings

Reported by the post-push review of commits `a676a95` and `efc0fc3`. Not
applied; recorded for the user's decision.

1. Low. The fast-path proof checks the catalogue-wide `fastPath` counter, so
   bystander views satisfy it while the inline scenario views always fall
   through, and the "fast-path views emit no inline evidence" test could not
   fail. Recommended: a test-only per-view observer on
   `ComponentClassificationInput` so `assertFastPathEquivalent` requires the
   named scenario views to settle early, and relabel cases that cannot.
   Status: open.
2. Low. The retained-selector merge is tested only with one selector, while
   every component-aware result is validated at the boundary, so an ordering
   or de-duplication regression would fail classification for the whole
   catalogue. Recommended: an integration test with several shared and
   mixed-case selectors plus an unresolved rule, asserting the exact field in
   complete, live and selected results. Status: open.
3. Low. `ViewResourceEvidence` includes `inlineStyles` although the contracts
   say schema-v2 `screenEvidence` never carries it. Recommended: restore the
   screen-only type and give the shell's merged evidence array its own type.
   Status: open.

## Milestone 7: Inline Style Evidence In The Shell

Tags: ui

Summary: present the Milestone 6 evidence in the Details inspector exactly as
the Milestone 2 design and the evidence-shell contract specify.

- [x] In `packages/viewer/src/shell/workspace_style_evidence.ts`, union
      inline `matched`/`unresolved` selectors into `styleOutcomes` and add
      `excludedPageStyles(views)`, true when at least one compared view of the
      selection carries `inlineStyles.status === "excluded"` and no view
      retains inline evidence.
- [x] In `packages/viewer/src/shell/workspace_evidence.tsx`, render the
      excluded-page-styles lead sentence before the terminal no-changes line,
      and show the "Shared component changes affect this preview" note only
      when a changed component affects the entry.
- [x] Keep `isStyleOnlyView` and the comparison-stage headings unchanged;
      confirm an inline-excluded-only view resolves to `Unmodified` with no
      comparison offered.
- [x] Extend `tests/client_style_evidence.test.ts` and `tests/shell.test.ts`,
      and add a browser test beside `tests/browser/viewer_inspection_ownership.spec.ts`
      that drives the excluded, matched and affected inline cases in the
      mobile sheet and the desktop dock.
- [x] Discovered: mark inline style presentation as shipped in the evidence
      contract, document its derivation and ordering in the shell README, and
      verify the existing shell-design inventory remains accurate.
- [x] Discovered: capture the live page-excluded Details panel and the merged
      `design-review-style-page-excluded` screen at mobile and desktop sizes,
      compare them visually, and retain the images under the milestone's
      delegation screenshot directory.
- [x] Run the unit and browser suites and `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 7 review findings

Reported by the post-push review of the `origin/main` merge `116cc46` and
commit `10c6cdb`. The merge has no findings: every path only main changed is
byte-identical to `d71b03b`, overlapping paths keep both sides, and the
recomputed design counts match a rebuilt manifest. The Milestone 7 findings
are not applied; recorded for the user's decision.

1. Medium. The "Shared component changes affect this preview" note shows on
   previews that did not change: it is gated on `relatedComponents`, which
   lists every consumer of a changed component at whole-entry scope, so an
   unchanged, excluded-only screen shows the note beside "No changes to this
   screen.", contradicting the contract; the tests pass with the old condition
   because they pair a changed comparison with an `Unmodified` status.
   Recommended: require a related changed component and at least one changed
   compared view of the selection, define "affects" that way in the contract,
   and add tests built from a real `ReviewResultV3`. Status: open.
2. Medium. The page-style sentence is decided at the wrong scope: a view
   changed through a component-owned rule carries no inline evidence, so a
   screen whose dark views changed through an owned rule and whose light views
   are excluded says none of the changed styles apply, without a terminal
   line, and an unaffected saved variant of a changed component loses its
   "No changes to this saved view." line. Recommended: show the sentence only
   when no compared view of the selection is `changed`, base the terminal line
   on the selected screen's or variant's status, and compute one selection
   outcome shared by the badge, note, sentence and terminal line. Status:
   open.
3. Low. Four contracts still said the shell presentation was pending. Status:
   resolved by the Milestone 8 documentation sweep.
4. Low. `tests/shell.test.ts` grew to 1,363 lines. Recommended: move the new
   test into a focused file and add a changed-file TypeScript length check.
   Status: open.

## Milestone 8: Scale Evidence And Final Alignment

Summary: measure the analysis against the five-second navigation target on the
scale fixture and leave every document aligned with the shipped behavior.

- [x] Add an `--inline-styles` variant to `scripts/large/` whose renderer
      emits a cumulative head sheet of component rules, extend
      `tests/large_fixture_stylesheets.test.ts` or a sibling for it, and
      record cold and warm classification timings and the
      `review.inline-style-analysis` share in the benchmark output.
- [x] Discovered: update the large benchmark's scheme interaction for the
      merged shell's single Appearance selector while retaining compatibility
      with an older workspace scheme toggle.
- [x] Discovered: let the large benchmark finish and report the full scenario
      matrix before returning its existing five-second acceptance failure, so
      a missed target still produces the required evidence without hiding it.
- [x] Discovered: retain and report failed samples before continuing the matrix;
      the cumulative component-style classification reaches the background
      worker's one-gigabyte heap limit, and that bounded failure is scale
      evidence rather than a reason to hide the later samples.
- [x] Discovered: raise only the opt-in benchmark's Changes wait ceiling for
      the cumulative full-size fixture; exhaustive rendering plus background
      classification has no five-second budget and exceeded the old five-minute
      measurement timeout after completing successfully.
- [x] Discovered: generalize the timing contract's scale-fixture aggregation
      rule to the inline-style share measured here, using the interval union
      clipped to the enclosing background classification span.
- [x] Discovered: align delivered-status and legacy terminology across the
      touched contracts and guides, including the unrelated verification-owner
      wording found by the final search, so retired API names are unambiguous.
- [x] Discovered: correct the milestone summary after measurement showed that
      the five-second target does not hold, and record the navigation miss and
      dominant successful and bounded-classification costs without optimizing.
- [x] Re-read every document touched in Milestone 1 against the
      implementation and fix drift; confirm no README, guide or protocol doc
      still names `RenderResult`, ownership records or style offsets.
- [x] Run the full suite, `npm run package:smoke`, and `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 8 review findings

Reported by the final post-push review of commit `49baa820`, which also
checked whole-branch documentation consistency. Not applied; recorded for the
user's decision.

1. Medium. The committed `--inline-styles` fixture is not the template that
   produced the recorded cumulative numbers: the measured fixture came from an
   earlier template, and the committed one derives each per-view `zIndex` from
   a global render counter, so adding a screen in one area renames classes in
   another and reports a false component change there. Recommended: restore
   value-stable per-view rules, add a small-fixture test that other areas stay
   byte-identical and out of Changes, re-measure, and record a template digest
   in the fixture record and benchmark JSON. Status: open.
2. Medium. `benchmark:large` no longer exercises linked-stylesheet rule
   attribution (setup's unused `shared-1.css` rule is restored before every
   scenario, so no run emits `review.css-analysis`, although the README and
   timing contract still say it does), and it leaves `renderer.tsx` and
   `shared-1.css` in the last scenario's state. Recommended: a
   `linked-stylesheet` scenario that keeps setup's rule and expects zero
   Changes, restoration of setup state after the matrix, and clipped shares
   for every `review.*` analysis stage. Status: open.
3. Medium. The five-second navigation miss was recorded without a control run.
   Status: a paired run on the same VM after the review measured `origin/main`
   at 5,088 ms cold and 4,734 ms warm usable, and this branch at 4,714 ms and
   4,599 ms, so the cold miss is pre-existing and not a regression of this
   plan; it still has no owner. Recommended: a follow-up that owns the target
   and a Delivery Status note in `mokly-on-demand.md`, and the Mokly commit and
   fixture digest in each benchmark JSON.
4. Low. The cumulative matrix and OOM figures were assembled by hand from two
   benchmark revisions, omit one OOM sample, and misstate the unfinished inline
   intervals; the committed benchmark cannot record a worker killed by the heap
   limit or a wrong Changes count. Recommended: model every terminal state,
   test OOM-shaped and window-straddling records, add a resumable scenario
   filter, and regenerate the table. Status: open.
5. Low. The plan omitted the Milestone 2 to 7 review outcomes while declaring
   implementation complete. Status: resolved by recording them here; the plan
   stays Active while findings await a decision.
6. Low. The terminology sweep changed "Invalid ownership records" to "Invalid
   owner registrations" in the unrelated CI verification contract, whose error
   message still says "Invalid verification ownership record". Recommended:
   restore "Invalid verification ownership records". Status: open.

### Scale diagnosis

A read-only diagnosis after the review located the out-of-memory failure of
the cumulative component-style scenario. The edit changes all 5,520
inline-bearing views, which carry 5,280 unique cumulative sheets per side
(median 101 KB, up to 192 KB; 15.2 million parsed rules per side) with exactly
one diffed rule each. At the 1 GiB worker limit, the retained heap was the
background compilation `outputs` map (645 MB) and the classification-lifetime
`CssResourceAnalysis` parse cache (340 MB, about 1.06 million rule objects,
with sliced keys retaining whole documents). CPU was 78% Lightning CSS parsing,
14% the eight parse5 trees built per analyzed view, 2% rule diffing and 0.04%
selector matching. Experiments in a temporary copy:

- A 32-entry parse cache cut peak heap from 1,135 to 925 MiB and time by about
  29% with no lost cache hits.
- Releasing committed-mode compilation outputs cut first-view heap from 733 to
  104 MiB and peak heap to 773 MiB.
- Reusing parse5 trees cut parse5 time by 26% but total time by only 2%.

Ranked follow-up options: (1) release committed-mode compilation outputs and
replace the parse cache with a byte-bounded LRU, which should remove the
out-of-memory failure; (2) prefix-aware incremental parsing of cumulative
sheets, because even without the memory limit full parsing of this fixture
extrapolates to about 48 minutes; (3) parse5 tree reuse; a selector index is
not worth pursuing. The inline analysis is therefore correct but does not yet
scale to a full-size cumulative React Native Web catalogue; option 2 is
needed before that workload is practical.

## Post-merge follow-up (non-blocking)

- Smoke the published package against a React Native Web catalogue whose
  renderer collects `getStyleElement()` output, and confirm a single
  component style edit produces one Changes row with its consumers listed
  under Affected screens.
- Consider a follow-up plan that applies the same rule-level owner inference
  to linked stylesheet files, so `ownedDependencies` becomes an override
  rather than the only way to attribute a shared stylesheet edit.
