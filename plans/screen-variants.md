# Screen Variants

Status: active; created 2026-09-19 with the user's consent after the design
discussion in this workspace. No implementation has started.

**Goal:** Let a screen declare saved variants beside its default render, show
them as an expandable list under the screen's navigation row, select them on
the screen's own route, and give changed variants their own Changes evidence.
Today the only way to record "the same screen with one small shift" is a
second sibling screen in the same collection, which is how the design
catalogue's Shell states and Tag states collections are built.

**Architecture:** Generalize the existing component saved-variant model to
screens instead of inventing a screen-only mechanism. A screen variant has an
id scoped to its screen, a title, an optional description, and its own mobile
and desktop React nodes; the screen's own `mobile`/`desktop` nodes are the
default variant. Every variant renders through the existing per-viewport,
per-scheme pipeline into `<route>.variants/<variant>.<viewport>[.dark].html`,
exactly like component variants. Selection is the existing `?variant=<id>`
route query, so the client variant machinery, comparison fencing, selected
live comparisons, and viewer selection extend rather than duplicate. Changes
keeps one row per screen and marks changed variants under it, matching the
component rule that variants are never independent rows.

**Decisions locked by the design discussion (raise before implementing if the
user should reconsider):**

- Light/dark is not a variant or sub-variant. Scheme stays a view axis on the
  existing toggle. Dark-only changes are surfaced through per-view evidence on
  the view controls and by landing on the first changed view; see Milestone 8.
- The parent navigation row is the link to the default variant and carries a
  separate disclosure button. It is not a `<details>` summary, because a
  summary cannot also be a link.
- Variants share the screen's `colorSchemes`, `tags`, `address`, `route`, and
  `useCaseIds`. A variant declares none of those fields.
- Variant ids use the catalogue-id grammar and are unique within one screen.
  Ids are never global, never routable, and never valid `MockLink` targets.
- A use-case step may name a `variantId`; the step then frames that variant.
- `MockLink` and `mockLink` gain a `variant` input beside `fragment`; the
  logical grammar becomes `mock:<id>[?variant=<variant>][#fragment]` and the
  marker retains the same order. The plain `mock:<id>[#fragment]` form is
  unchanged for every existing document.
- Manifest schema advances to v6 because `ManifestScreen` gains a required
  `variants` array and the fragment-route validator gains variant paths.
  Comparison result schemas stay at v2 and v3 with an additive optional
  `variants` array on screen results. Public catalogue read model v1 gains an
  optional `variants` array on screens, which its additive-field rule allows.
- Proposed, pending the user's explicit approval before Milestone 9 starts:
  the shipped `examples/basic` design catalogue converts the light-only
  `design-browse-dark-scheme`/`design-browse-light-only` pair and the four tag
  states into variants of `design-browse-screen` (Welcome) so the example
  exercises the feature with real screens. That retires six existing ids and
  routes on `origin/main`, which needs approval under the mainline
  preservation rule. Without approval, Milestone 9 is skipped and the
  standalone screens stay. Every other design screen stays as it is either
  way.

**Spec:** [`docs/protocol/mokly-screen-variants.md`](../docs/protocol/mokly-screen-variants.md)
(new, Milestone 1) plus targeted updates to the authoring, rendering,
manifest, changes, navigation, shell-design, catalogue read-model, viewer,
selected-comparison, and design-links contracts.

**Tech stack:** TypeScript ESM (Node 22 test runner via `tsx --test`, tests
import from `../dist`), React 19 static rendering, Playwright Chromium against
`examples/basic` and synthetic fixtures under `.context/`, Rust `xtask` gate.

## Global Constraints

- Run `cargo xtask check` before declaring any milestone complete. It runs
  `format:check`, `lint`, `typecheck`, `npm test`, `example:check`,
  `package:check`, `package:smoke`, `test:browser`, `cargo fmt --check`,
  `clippy -D warnings`, `cargo test`, and the Rust file-length audit.
- After checks pass at each milestone end: `git add -A`, commit with a
  Conventional Commits title of at most 50 characters, and push the branch.
  The final review milestone uses
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
  against `origin/main` after the push. Do not auto-fix review findings;
  report each numbered finding with severity, impact, lettered options, and a
  recommendation.
- Generated example HTML and the manifest are derived and ignored; run
  `npm run build && npm run example:build && npm run example:check` after
  every entry, renderer, or configured-style change and smoke the changed
  pages through `npm run dev`. Authored CSS under `examples/basic/generated/`
  is hand-edited.
- Protocol docs are updated in the same milestone as the behavior they
  describe. Documentation-only milestones validate Markdown with
  `npx prettier --check` on the changed files and a manual link check.
- Keep new modules near 200 lines and below 300. `nav.tsx` (245),
  `workspace_data.ts` (292), `stages.tsx` (287), `screen_compare.ts` (235),
  and the design library's `catalogue-navigation.view.tsx` (261) are already
  near the cap; extract before extending them.
- Mockup milestones and UI milestones are separate. If a `mockup` or `ui`
  milestone finds missing backend work, add a new backend milestone
  immediately after it, then a new tagged milestone holding the blocked
  tasks, without editing completed milestones.
- Add the failing test before fixing any regression discovered on the way.
- Do not delete or override anything on `origin/main` without explicit
  approval. The only removal this plan proposes is the design-catalogue id
  retirement in Milestone 9; it needs the user's approval first and must be
  named in that commit message.

## Milestones

---

### Milestone 1: Protocol contract for screen variants

Documentation only. At completion every contract below defines the complete
behavior the later milestones implement, with no guesswork left for the
authoring API, generated output, manifest v6, links, navigation, Changes,
comparisons, viewer selection, and the public read model.

#### Task 1.1: New screen-variants contract

**Files:**

- Create: `docs/protocol/mokly-screen-variants.md` (about 250 lines)
- Modify: `docs/protocol/README.md` (index entry beside the components
  contracts; Supported Formats table moves both catalogue rows to manifest 6)

**Steps:**

- [ ] Write Delivery Status (approved target tracked by this plan), Purpose,
      and Authoring: the `ScreenVariantInput` shape
      `{ id, title, description?, mobile, desktop }`, the optional
      `variants?: readonly ScreenVariantInput[]` field on `ScreenInput` and
      nested `screen`, id grammar and uniqueness, the reserved id `default`
      rejected for authored variants because the screen's own nodes own it,
      shared-field rule, no inheritance from collections or roots, and
      validation failures with source attribution.
- [ ] Write Generated Output: default fragments keep their current paths;
      each authored variant writes `<route>.variants/<id>.<viewport>.html`
      and `.dark.html` for every effective scheme, rendered through the same
      `renderer({ node, entry, viewport, colorScheme, variantId })` call with
      the variant's node and `variantId` set; ownership headers, collision,
      orphan, resource, link, and fragment validation apply to every variant
      document; cross-view fragment validation for a destination screen now
      covers every variant document as well.
- [ ] Write Manifest v6: `ManifestScreen.variants` is a required array
      (empty when the screen declares none) of
      `{ id, title, description?, fragments, darkFragments?, componentViews? }`
      in authored order; the same `componentViews` rule as component variants
      when components are registered; entry sorting, key ordering, and
      omission rules; historical readers accept v3, both v4 shapes, and v5;
      current loading rejects v5 with the rebuild diagnostic; the live index
      carries the same variant metadata.
- [ ] Write Selection And Routes: `?variant=<id>` on the screen route with
      the existing one-value rule, unknown or duplicate values showing the
      selection error while the default stays reachable, `/id/<id>` opening
      the default, `variant` preserved across viewport and scheme changes and
      through Back and Forward, and static export id aliases unchanged.
- [ ] Write Logical Links: `mockLink(id, options?)` where the second argument
      is either the existing `fragment` string or `{ fragment?, variant? }`;
      `MockLink` gains a `variant` prop; raw form
      `mock:<id>[?variant=<variant>][#fragment]`; the `variant` grammar is the
      catalogue-id grammar; validation that the destination screen declares
      the variant; portable rewrite to that variant's fragment for the source
      viewport and scheme with light fallback; marker bytes carry the same
      logical form; `data-nav-href` accepts the same form; component
      destinations continue to reject `variant` because their selectors are
      shell-owned; use-case and page destinations reject it.
- [ ] Write Use-Case Steps: optional `variantId` on `UseCaseStep`, validated
      against the step screen, framed in the flow, and carried by the public
      read model; a step without `variantId` frames the default.
- [ ] Write Navigation: the screen row for a screen with variants renders a
      link to the default plus a disclosure button with `aria-expanded` and
      `aria-controls`; one child row per variant in authored order with the
      screen icon at one extra depth and the same guide painting; row key
      `variant:<screen-id>:<variant-id>`; disclosure key
      `variants:<section>:<screen-id>` persisted beside collection keys;
      active-row rule extended so the row whose route and variant match the
      current URL is `aria-current`; ancestor disclosure opens the variant
      list; Collapse all closes variant lists; search matches variant titles
      and reveals the parent; a screen row stays visible when any variant
      matches; the responsive drawer shows the same structure.
- [ ] Write Changes: per-variant review views keyed by variant id; one
      Changes row per screen; the Changes filter shows only variant rows with
      Added, Changed, or Removed state under a changed screen, with the list
      expanded; a screen whose default is unmodified but whose variant changed
      is Changed with an aggregate marker; opening from Changes lands on the
      first changed variant; removed variants of a surviving screen keep a
      row with the Removed state and a retained baseline comparison; the
      status beside the title, the comparison band, and selected live
      comparisons describe the selected variant; use-case propagation counts
      a changed variant as a changed screen.
- [ ] Write Public Read Model And Viewer: optional `variants` on
      `CatalogueScreen` with `{ id, title, description?, views, comparison }`;
      `ViewerSelection.variantId` valid for a screen that declares the
      variant; `InstanceRef` and `ScreenNavigateEvent` unchanged in shape;
      controlled-mode proposals for screen variants follow the component
      rules.
- [ ] Write Verification Contract listing the coverage Milestones 3 through
      7 must prove, and Related Docs.

#### Task 1.2: Align the existing contracts

**Files:**

- Modify: `docs/protocol/mokly-authoring.md` (variants field, `MockLink`
  `variant`, step `variantId`), `docs/protocol/mokly-rendering.md`
  (`variantId` for screen renders), `docs/protocol/mokly-component-manifest.md`
  (v6 envelope, screen `variants`), `docs/protocol/mokly-components.md`
  (delivery status note that screens share the variant model),
  `docs/protocol/mokly-changes.md` (per-variant screen views and the v2/v3
  additive `variants` field), `docs/protocol/mokly-component-review.md`
  (`ScreenReviewV3.variants`), `docs/protocol/mokly-selected-comparisons.md`
  (`variant` accepted for screens), `docs/protocol/mokly-navigation.md`
  (logical grammar, variant rows in the visibility invariant),
  `docs/protocol/mokly-runtime.md` (Browse shell section),
  `docs/protocol/mokly-shell-design.md` (navigation bullet, new design
  inventory rows, retired rows), `docs/protocol/mokly-catalogue.md`
  (screen `variants`), `docs/protocol/mokly-viewer.md` (selection rule),
  `docs/protocol/mokly-design-links.md` (inventory and Welcome variant
  destinations), `docs/protocol/mokly-export-delivery.md` (variant query
  on exported screen pages)
- Modify: `docs/architecture/build-pipeline.md` (variant documents in the
  output line), `docs/guides/authoring/screens.md`,
  `docs/guides/authoring/links.md`, `docs/guides/authoring/use-case-flows.md`,
  `docs/guides/catalogue/browse.md`, `docs/guides/catalogue/changes.md`,
  `docs/guides/catalogue/search-and-filters.md`, `README.md` (one feature
  paragraph and the authoring example), `plans/README.md`

**Steps:**

- [ ] Apply each change above, keeping every touched contract internally
      consistent and each under roughly 250 lines by moving detail into the
      new contract rather than growing the old ones. Where a contract states
      "variants are component-only" or "screens have no variants", replace the
      statement rather than leaving a contradiction.
- [ ] Update the Supported Formats table and every "schema v5" statement that
      describes the current manifest to v6, leaving historical-reader text
      intact.
- [ ] Re-read the new contract and every modified contract end to end for
      conflicting statements. Run `npx prettier --check` on the changed
      Markdown and confirm every relative link resolves.
- [ ] Milestone close-out: commit `docs(protocol): define screen variants`
      and push.

---

### Milestone 2: Design mockups for variant rows and variant states

Tags: mockup

At completion the design catalogue depicts the expandable variant row in the
navigation, a selected variant, the Changes filter with changed variant
sub-rows, a removed variant, and the changed-view marks on the view controls,
at mobile and desktop widths, using only screen components. The Welcome
scheme and tag artboards stay standalone screens in this milestone; their
conversion into real variants is Milestone 9, after the authoring field
exists and the user has approved the id retirement.

#### Task 2.1: Catalogue navigation library component

**Files:**

- Modify: `examples/basic/entries/design/library/chrome/catalogue-navigation.tsx`
  (row schema gains `kind: "variant"`, optional `parentKey`, optional
  `variants` disclosure state on screen rows, optional `changed` mark), a new
  saved variant `variants` depicting Welcome expanded with two variants, and
  a saved variant `changed-variants` depicting the Changes filter with one
  changed sub-row
- Modify: `examples/basic/entries/design/library/chrome/catalogue-navigation.view.tsx`
  (extract row rendering into `catalogue-navigation-row.view.tsx` first,
  then add the parent link plus disclosure button and the variant rows)
- Modify: `examples/basic/entries/design/parts/nav_data.ts` (Welcome gains
  variant rows `dark-scheme` and `tag-forms` as the depicted fixture),
  `examples/basic/generated/design-library/chrome/catalogue-navigation.css`
  (disclosure button, variant depth, changed dot; no left-edge accent rail)
- Modify: `docs/protocol/mokly-design-component-library.md` (variant ids)

**Steps:**

- [ ] Add the schema fields, saved variants, and view markup; keep the
      library README's authoring rules (registration, fixtures, and
      navigation tables stay out of the `.view` module's dependencies).
- [ ] Style the disclosure button as a 16px chevron control inside the row
      at the trailing edge, the variant rows one indent step deeper with the
      screen icon, and the changed mark as the existing changed dot. Verify
      no pseudo-element, border, or gradient adds a left-edge rail.
- [ ] `npm run build && npm run example:build && npm run example:check`.

#### Task 2.2: Welcome variants and the new Browse states

**Files:**

- Modify: `examples/basic/entries/design/design.mockup.tsx` (register the
  new collection), `examples/basic/entries/design/parts/destinations.ts` and
  `navigation_states.ts` (destinations and typed navigation records for the
  four new screens)
- Create: `examples/basic/entries/design/browse/variants/screens.tsx` with
  `design-browse-variant-selected` (Welcome with the `dark-scheme` variant
  selected and the nav list expanded), `design-browse-variant-changes`
  (Changes filter, Welcome changed, only its changed variant sub-row shown),
  `design-browse-variant-removed` (a removed variant sub-row with Removed
  status and the baseline comparison band), `design-browse-changed-views`
  (light selected, theme toggle and viewport dropdown carrying changed marks,
  status reading Unmodified for the shown view); one canonical
  `design-browse-variants` collection page under `design/browse/variants/`
  rendering the selected-variant screen and linking the children
- Modify: `examples/basic/entries/design/parts/screen_heads.tsx` (a variant
  strip beneath the title for screens with variants, reusing the component
  page's selection style), `examples/basic/entries/design/parts/nav.tsx`,
  `examples/basic/entries/design/parts/shell.tsx` (view-control changed marks),
  `examples/basic/generated/design.css` and `design-stage.css`
- Modify: `examples/basic/notes.md`, `docs/protocol/mokly-shell-design.md`
  inventory, `docs/protocol/mokly-design-links.md` inventory and control
  table
- Test: `tests/design_links.test.ts`, `tests/design_screens.test.tsx`,
  `tests/browser/design_links.spec.ts`, `tests/browser/comparison_design.spec.ts`

**Steps:**

- [ ] Author the four screens, each with one mobile and one desktop
      component, and the canonical collection page; keep the page at no more
      than five screens. Put implementation notes in descriptions and
      rationale, never inside the artboard. Depict the variant rows with the
      static nav fixture only; no screen in this milestone uses the
      `variants` authoring field, which does not exist yet.
- [ ] Extend the design links contract's control table: parent row opens the
      Welcome default, variant rows open the selected-variant screen, the
      Changes filter on the changed-variants screen opens the removed-variant
      screen's All destination, and the theme toggle on the changed-views
      screen opens the dark comparison screen.
- [ ] `npm run build && npm run example:build && npm run example:check`, then
      open every changed generated page from disk with Playwright screenshots
      saved under `.context/` and read them to confirm layout at both widths.
- [ ] Milestone close-out: commit `docs(design): add screen variant mockups`
      and push.

---

### Milestone 3: Authoring, rendering, and manifest v6

Backend only, no shell changes. At completion `defineScreen` and nested
`screen` accept validated variants, every variant renders to its own
documents, the manifest is v6 with screen variants, historical readers accept
v5, the live index and on-demand renderer know variant views, and Browse
still renders exactly as before because it ignores the new data.

#### Task 3.1: Authoring types and validation

**Files:**

- Modify: `src/authoring/types.ts` (`ScreenVariantInput`,
  `ScreenInput.variants?`, `NestedScreenInput.variants?`,
  `UseCaseStep.variantId?`), `src/authoring/definitions.ts` (pass `variants`
  through `defineScreen` and the nested flattener without inheritance)
- Create: `src/registry/variant_validation.ts` (shared variant list checks
  for screens: array shape, id grammar, uniqueness, reserved `default`,
  nonempty title, optional nonempty description, `mobile`/`desktop`
  presence, and rejection of every other key)
- Modify: `src/registry/entry_validation.ts` (call it for screens; pages and
  collections reject `variants`), `src/registry/relationships.ts` (step
  `variantId` must exist on the step screen)
- Test: `tests/authoring.test.tsx`, `tests/registry_relationships.test.ts`
  (or the existing suite that owns `crossReferenceViolations`)

**Steps:**

- [ ] Write failing tests: a screen with two variants keeps them on the
      definition in authored order; duplicate ids, `default`, an invalid id,
      a missing title, a variant carrying `route` or `tags`, a page with
      `variants`, and a collection with `variants` each produce an
      `invalid-variants` violation naming the screen; a step `variantId`
      that the screen does not declare produces `missing-step-variant`;
      nested `screen` accepts `variants` and nothing inherits them.
- [ ] Implement; keep `entry_validation.ts` under 300 lines by delegating to
      the new module.
- [ ] `npm test` green.

#### Task 3.2: Rendering variant documents

**Files:**

- Modify: `src/build/render.ts` (iterate `[undefined, ...variant ids]` for
  screens as it does for components; pick the variant's node; compute the
  route with `componentFragmentRoute`, renamed to `variantFragmentRoute` in
  `packages/viewer/src/components/paths.ts` with the old name removed and
  every import updated), `src/build/logical_routes.ts` (variant-aware
  artifact resolution for logical links), `src/build/logical_records.ts`,
  `src/build/mock_links.ts` (parse and validate the `variant` part; rewrite
  to the variant fragment; marker retains the logical form),
  `src/build/render_cooperative.ts` and `src/build/document_compiler.ts`
  (selection gains `variantId` for screens so on-demand rendering serves one
  variant view), `src/components/render.tsx` (collector label already
  includes `variantId`; screens now pass it)
- Modify: `packages/viewer/src/navigation/logical.ts` (`LogicalTarget`
  gains `variant?`; `parseLogicalTarget` and `logicalMarker` accept and emit
  `?variant=`), `src/authoring/links.tsx` (`mockLink(id, options?)`,
  `MockLink variant`), `src/server/fragments.ts` (cross-view fragment
  validation covers variant documents)
- Test: `tests/build.test.ts`, `tests/build_links.test.ts`,
  `tests/build_navigation_links.test.ts`, `tests/compatibility_navigation.test.ts`,
  `packages/viewer/tests/*` for the logical parser

**Steps:**

- [ ] Write failing tests: a screen with one variant writes the two default
      fragments plus `<route>.variants/<id>.mobile.html` and
      `.desktop.html`, and the dark pair when dark is enabled; the renderer
      receives `variantId` for variant renders and not for the default;
      `mockLink("welcome", { variant: "error" })` yields
      `mock:welcome?variant=error`; `mockLink("welcome", { variant: "error", fragment: "top" })`
      yields `mock:welcome?variant=error#top`; the string form still works;
      a link to an undeclared variant fails the build naming the screen and
      variant; a `variant` on a component, page, or use-case destination
      fails; the portable rewrite targets the variant document for the
      source viewport and scheme with light fallback; the compatibility
      invariant records include the variant; a fragment must exist in every
      variant document of the destination.
- [ ] Implement; keep `render.ts` under 300 lines by extracting the
      per-entry view enumeration into `src/build/render_views.ts`.
- [ ] `npm test` green.

#### Task 3.3: Manifest v6, historical readers, live index, public projection

**Files:**

- Modify: `packages/viewer/src/registry/types.ts` (`ManifestScreenVariant`,
  `ManifestScreen.variants`, `ManifestV6`, `Manifest` union includes v5 as
  historical), `packages/viewer/src/components/views.ts` (`generatedViews`
  enumerates screen variants with `variantId`), `src/registry/manifest.ts`
  (`schemaVersion: 6`, variant records), `src/registry/manifest_validation.ts`,
  `src/registry/manifest_entries.ts`, `src/components/manifest_validation.ts`
  (variant fragment paths and usage records for screens), `src/registry/catalogue_index.ts`
  (live index carries screen variants), `src/components/render_request.ts`
  (accept a screen as the render target when variants exist),
  `src/registry/changed_routes.ts` (route projection includes screen variant
  metadata and fragment candidates), `src/catalogue/projection.ts` and
  `src/catalogue/views.ts` (public `variants` on screens),
  `packages/viewer/src/catalogue/entry_reader.ts` (read them),
  `packages/viewer/src/catalogue/references.ts`, `docs/protocol/fixtures/catalogue-v1.json`
- Test: `tests/manifest_files.test.ts`, `tests/component_manifest.test.ts`,
  `tests/catalogue_history.test.ts`, `tests/catalogue_projection.test.ts`,
  `tests/catalogue_reader.test.ts`, `tests/manifest_combined.test.ts`

**Steps:**

- [ ] Write failing tests: a v6 manifest serializes `variants: []` for a
      screen without variants and the full records otherwise, in authored
      order with sorted keys; readers reject a variant whose fragment path
      disagrees with the suffix rule, duplicate ids, and a missing
      `componentViews` record when components are registered; current
      loading rejects v5 with the rebuild diagnostic; the historical reader
      accepts v5 and normalizes screens to an empty `variants` list; the
      public projection emits `variants` and the conformance fixture round
      trips.
- [ ] Update every current-manifest literal from 5 to 6 in source, tests, and
      the packed-consumer smoke; keep the v5 historical fixtures.
- [ ] `npm test` green; `npm run package:smoke` green.

#### Task 3.4: Example catalogue variants and docs

**Files:**

- Modify: `examples/basic/entries/catalogue.mockup.tsx` (Welcome gains an
  `empty-workspace` variant whose input is blank and whose action is
  disabled, so the example exercises variants without design-catalogue
  coupling), `examples/basic/notes.md`, `README.md` authoring example,
  `docs/guides/authoring/screens.md`

**Steps:**

- [ ] Add the variant, rebuild, and check; confirm the manifest diff adds
      exactly the new records and paths.
- [ ] Smoke: `npm run dev`, open Welcome, confirm the default still renders
      and `/static/screens/welcome.variants/empty-workspace.mobile.html`
      serves the variant document.
- [ ] Milestone close-out: commit
      `feat(registry): add screen variants to manifest v6` and push.

---

### Milestone 4: Changes, comparisons, and use-case steps

Backend only. At completion review results carry per-variant screen views,
changed-route detection treats a changed variant as a changed screen, the
selected live endpoint serves a screen variant, and a use-case step can frame
a variant.

#### Task 4.1: Screen comparison by variant

**Files:**

- Modify: `src/review/screen_views.ts` (enumerate variant views),
  `src/review/screen_compare.ts` (extract per-view work into
  `src/review/screen_view_compare.ts`; compare default and each paired
  variant; emit `variants: [{ id, title, state, views }]` on the screen
  result with removed variants after current ones), `src/review/component_classification.ts`
  and `src/review/component_view.ts` (screen variant views pair by
  `variantId` through `viewPairs`), `src/server/screen_view_changes.ts`
  (per-variant view states), `src/review/selected.ts` and
  `src/server/selected_review_routes.ts` (`variant` accepted for screens),
  `packages/viewer/src/review/types.ts` and `component_types.ts`
  (`ScreenVariantReview`), `src/review/component_result_sources.ts`
  (validate variant references against both manifests)
- Test: `tests/changes.test.ts`, `tests/catalogue_screen_changes.test.ts`,
  `tests/component_review_schema.test.ts`, `tests/selected_comparisons` suites,
  `tests/review_*` suites that assert result shapes

**Steps:**

- [ ] Write failing tests: editing only a variant's node marks the screen
      route changed, its default views unchanged, and that variant's views
      changed; adding a variant yields an added variant record without an
      added screen; removing a variant yields a removed variant record with
      retained baseline snapshots while the screen stays Changed; a use case
      whose step frames the changed variant is propagated; the selected live
      endpoint with `variant=<id>` on a screen route returns only that
      variant's views and fences a stale response; an unknown variant fails
      without inventing data; v2 output stays byte-identical for a
      variant-free screen-only catalogue.
- [ ] Implement, keeping `screen_compare.ts` under 300 lines.
- [ ] `npm test` green.

#### Task 4.2: Use-case step variants and links

**Files:**

- Modify: `src/registry/manifest_relationships.ts` (validate step
  `variantId` against the manifest screen), `src/registry/manifest.ts` (emit
  it), `src/catalogue/projection.ts` and `packages/viewer/src/catalogue/entry_reader.ts`
  (public step `variantId`), `src/build/logical_routes.ts` (a use-case
  destination resolves through its first step's variant), `src/server/fragments.ts`
  (use-case fragment validation uses the first step's variant document)
- Test: `tests/manifest_files.test.ts`, `tests/build_links.test.ts`,
  `tests/catalogue_projection.test.ts`

**Steps:**

- [ ] Write failing tests for each behavior above, then implement.
- [ ] `npm test` green.

#### Task 4.3: Served routes accept a screen variant query

**Files:**

- Modify: `src/server/view_routes.ts` (parse at most one `variant` value on
  a screen route; a known id becomes `context.activeVariant`, an unknown or
  duplicate value renders the page with the selection error state rather than
  HTTP 400, and the id redirect never carries one), `src/server/fragments.ts`
  (request-visible fragment validation checks the selected variant's
  documents), `packages/viewer/src/shell/context.ts` (`activeVariant?`
  field only; no rendering change yet), `src/export/site.ts` (no new files;
  confirm the exported screen page keeps reading the query progressively)
- Test: `tests/server.test.ts`, `tests/catalogue_server.test.ts`

**Steps:**

- [ ] Write failing tests: `/view/<route>?variant=<id>` returns 200 with the
      active variant in the shell context; two values or an unknown id still
      return 200 with the error state; `/id/<id>` redirects without a
      `variant` query; the `fragment` query is validated against the
      selected variant's documents.
- [ ] Implement.
- [ ] `npm test` green.
- [ ] Milestone close-out: commit `feat(review): compare screen variants`
      and push.

---

### Milestone 5: Shell navigation rows and variant selection

Tags: ui

At completion the served and exported shells show the expandable variant row,
select a variant on the screen route, keep the active-row invariant across
navigation, Back, Forward, search, and the Changes filter, and persist the
variant disclosure state. The variant strip beneath the title matches the
Milestone 2 mockups.

#### Task 5.1: Navigation tree and rows

**Files:**

- Modify: `packages/viewer/src/shell/nav_tree.ts` (`NavLeafNode.variants?`
  with `{ id, title, key }`), `packages/viewer/src/shell/nav.tsx` (extract
  `LeafRow` and `GroupRow` into `nav_rows.tsx` first; the screen row becomes a
  `div.mbk-nav-leaf` holding the link and, when variants exist, a
  `button[data-nav-variants-toggle][aria-expanded][aria-controls]`, followed
  by `div[data-nav-disclosure="variants:<section>:<id>"][data-nav-variants]`
  with one `a[data-nav-row][data-variant-id]` per variant whose `href` is the
  route plus `?variant=`), `packages/viewer/src/shell/css_nav_rows.ts` (new
  file `css_nav_variants.ts` for the toggle, list, depth, and changed dot),
  `packages/viewer/src/client/browse_navigation.ts` (`variants:` keys are
  valid disclosure keys), `packages/viewer/src/client/browse_state.ts`
  (capture and restore the new disclosure elements; `Collapse all` closes
  them), `packages/viewer/src/client/browse_controls.ts` (toggle handling),
  `packages/viewer/src/client/browse_navigation_state.ts` (active row matches
  pathname plus `variant` query; variant rows count as rows for search and
  the Changes filter; a parent stays visible when a variant matches; ancestor
  reveal opens `data-nav-variants`), `packages/viewer/src/client/search_query.ts`
  (unchanged API; row facts include the variant title)
- Test: `tests/nav_tree.test.ts`, `tests/shell.test.ts`,
  `tests/client_navigation_state.test.ts`, `tests/client_browse_navigation.test.ts`,
  `tests/client_browse.test.ts`, `tests/browser/browse_navigation.spec.ts`,
  `tests/browser/browse_history.spec.ts`

**Steps:**

- [ ] Write failing tests: tree nodes carry variants in authored order;
      shell HTML renders the link, toggle, and variant rows with the expected
      attributes and no toggle for a screen without variants; the default row
      is `aria-current` at the bare route and the variant row at
      `?variant=<id>`; navigating to a variant opens its list and the
      ancestors; Back returns to the default row; Collapse all closes the
      list; `tag:` and free-text search reveal a parent through a matching
      variant title; the disclosure survives reload through storage; a
      browser test drives all of it against a fixture screen with two
      variants and against the `examples/basic` Welcome variant.
- [ ] Implement; keep `nav.tsx` and each CSS module under 300 lines.
- [ ] `npm test && npm run test:browser` green.

#### Task 5.2: Variant selection on the screen workspace

**Files:**

- Modify: `packages/viewer/src/shell/workspace_data.ts` (extract variant
  status derivation into `workspace_variants_data.ts`; screens build their
  `variants` list from manifest variants plus removed baseline variants with
  status and comparison eligibility), `packages/viewer/src/shell/workspace.tsx`
  (render the variant strip for screens with at least one variant, as
  links carrying `?variant=` with `aria-current`; keep the component select),
  `packages/viewer/src/shell/stages.tsx` (frame sources for the selected
  variant), `packages/viewer/src/client/workspace_variants.ts`
  (`selectedVariant` handles screens; default when absent), `packages/viewer/src/client/workspace.ts`,
  `packages/viewer/src/client/diff_views.ts` (screen variant comparison
  views), `packages/viewer/src/shell/nav_rows.tsx` (server-rendered
  `aria-current` from `context.activeVariant`), `packages/viewer/src/viewer/selection.ts`,
  `routing.ts`, `frame_views.ts`, `public_stage.tsx`, `public_workspace.ts`
  (viewer selection and stage accept screen variants)
- Test: `tests/component_workspace.test.ts`, `tests/client_workspace_comparison.test.ts`,
  `packages/viewer/tests/selection.test.ts`, `tests/browser/component_workspace.spec.ts`
  (screen cases), `tests/browser/viewer_variants.spec.ts` (screen cases),
  `tests/browser/static_example.spec.ts`

**Steps:**

- [ ] Write failing tests: the workspace JSON lists screen variants with
      status; selecting a variant swaps both frames to its documents and
      updates the URL, title status, and `aria-current` in the strip and the
      nav; viewport and scheme changes retain the variant; an unknown
      variant shows the selection error with the default reachable; the
      viewer commits `{ screenId, variantId }` for a screen and rejects an
      undeclared id; the exported example selects a variant without a
      server.
- [ ] Implement; keep `workspace_data.ts` and `stages.tsx` under 300 lines
      by extracting as noted.
- [ ] Docs: update the runtime contract's Delivery Status and the shell
      design contract to implemented for these states.
- [ ] Smoke: `npm run dev`, expand Welcome, select the variant, use Back and
      Forward, search for the variant title, Collapse all.
- [ ] Milestone close-out: commit `feat(browse): select screen variants`
      and push.

---

### Milestone 6: Changed-variant evidence in the catalogue snapshot

Backend only. At completion the catalogue change snapshot names, per changed
route, which variants changed and which were removed, live Serve and watched
updates refresh that data with evidence, and exported or published catalogues
with Changes carry the same fields. The shell ignores the new fields until
Milestone 7.

#### Task 6.1: Snapshot fields and producers

**Files:**

- Modify: `src/registry/changes.ts` (`CatalogueChangeSnapshot` gains
  `changedVariants` and `removedVariants`, both
  `Readonly<Record<route, readonly variantId[]>>`, sorted and omitted when
  empty), `src/server/changed.ts`, `src/server/component_changes.ts`,
  `src/server/screen_view_changes.ts` (derive them from the review result
  or the lightweight material pass without generating snapshots),
  `src/server/catalogue_update.ts` and `src/server/catalogue_snapshot.ts`
  (carry them into the shell context), `packages/viewer/src/shell/context.ts`
  (`changedVariants?` and `removedVariants?` beside `changedRoutes`),
  `src/server/update_messages.ts` (evidence updates include them),
  `src/export/site.ts`, `src/export/shell_metadata.ts`, and
  `src/publication/*` (publication with Changes carries the fields; ordinary
  publication omits them)
- Test: `tests/catalogue_screen_changes.test.ts`, `tests/changes.test.ts`,
  `tests/export_changes.test.ts`, `tests/server_changed` suites, the
  publication tests that assert shell metadata

**Steps:**

- [ ] Write failing tests: a variant-only edit yields the route in
      `changedRoutes` and its id in `changedVariants`; a deleted variant
      yields the route and its id in `removedVariants` while the screen
      survives; a variant-free catalogue serializes no new fields; watched
      evidence updates replace the fields; a review publication includes them
      and an ordinary publication omits them.
- [ ] Implement.
- [ ] `npm test` green.
- [ ] Milestone close-out: commit `feat(changes): record changed variants`
      and push.

---

### Milestone 7: Changes presentation for variants

Tags: ui

At completion the Changes filter shows changed variant sub-rows under a
changed screen, opening a changed screen from Changes lands on its first
changed variant, removed variants stay comparable, and the mockups from
Milestone 2 are matched.

#### Task 7.1: Changed variant rows and landing

**Files:**

- Modify: `packages/viewer/src/shell/nav_rows.tsx` (`data-changed` on
  variant rows from `context.changedVariants`; removed variant rows from
  `context.removedVariants` rendered with the Removed label and hidden from
  All), `packages/viewer/src/client/browse_navigation_state.ts` (Changes
  shows a variant row only when changed; opens the list when the parent is
  changed), `packages/viewer/src/client/browse_links.ts` (a Changes-filter
  activation of a changed parent whose default is unmodified navigates to its
  first changed variant), `packages/viewer/src/client/browse_evidence.ts`
  (evidence refresh updates variant marks and removed rows),
  `packages/viewer/src/shell/css_nav_variants.ts`
- Test: `tests/shell.test.ts`, `tests/client_navigation_state.test.ts`,
  `tests/client_browse_evidence` suite, `tests/browser/changes_continuity.spec.ts`,
  `tests/browser/removed_comparison_eligibility.spec.ts`,
  `tests/browser/publish_current.spec.ts`

**Steps:**

- [ ] Write failing tests for each behavior in the milestone summary,
      including the Changes count staying per screen and a removed variant
      of a surviving screen opening its retained baseline comparison.
- [ ] Implement and update the changes guide and runtime contract.
- [ ] Smoke against a fixture repository with a committed baseline: edit a
      variant only, confirm the row, count, landing, and comparison.
- [ ] Milestone close-out: commit `feat(browse): show changed variants` and
      push.

---

### Milestone 8: Changed-view evidence on the view controls

Tags: ui

At completion a screen whose change is confined to one viewport or scheme
tells the reviewer where to look: the theme toggle and viewport dropdown mark
the views with a changed state, opening a changed screen from Changes lands on
its first changed viewport and scheme instead of the sticky selection, and
the details inspector lists the changed views. Scheme remains a view axis.
The per-view states already exist in the review result and the lightweight
screen-view evidence, so this milestone reads them without new server work.

#### Task 8.1: View marks and landing

**Files:**

- Modify: `packages/viewer/src/shell/workspace_controls.tsx` (options carry
  `data-view-changed` from workspace data), `packages/viewer/src/shell/workspace_variants_data.ts`
  (`changedViews: readonly { viewport, colorScheme, variantId? }[]` derived
  from the comparison or screen-view evidence), `packages/viewer/src/shell/css_workspace.ts`
  (changed mark on the icon button and select label), `packages/viewer/src/client/workspace.ts`
  (when arriving from a Changes-filter row, set viewport and scheme to the
  first changed view unless the URL already names them),
  `packages/viewer/src/shell/details.tsx` (a Changed views row),
  `packages/viewer/src/client/workspace_evidence.ts` (marks refresh with
  evidence)
- Test: `tests/component_workspace.test.ts`, `tests/client_workspace_evidence.test.ts`,
  `tests/browser/evidence_workspace.spec.ts`, `tests/browser/browse.spec.ts`

**Steps:**

- [ ] Write failing tests: a dark-only material change marks the theme
      toggle and lists `Mobile · Dark, Desktop · Dark` in details; opening
      that screen from Changes lands on dark; opening it from All keeps the
      sticky selection; a light-only catalogue renders no scheme mark.
- [ ] Implement, keeping the changed mark distinct from the pressed state
      and never relying on color alone.
- [ ] Update the runtime and shell design contracts and the changes guide.
- [ ] Milestone close-out: commit `feat(browse): mark changed views` and
      push.

---

### Milestone 9: Design catalogue conversion and verification

Tags: mockup

Requires the user's explicit approval of the id retirement recorded in the
locked decisions; without it, skip Task 9.1 and go straight to Task 9.2.
At completion the Welcome design screen owns the dark-scheme, light-only, and
four tag states as variants, the retired ids are gone from the inventories,
every design link that pointed at them carries `variant`, and the plan is
closed.

#### Task 9.1: Convert the design states to Welcome variants

**Files:**

- Modify: `examples/basic/entries/design/browse_screens.tsx` (Welcome's
  `design-browse-screen` gains `variants: [...]` composed from the dark-scheme
  and tag-state screen components; the standalone entries for those states
  are removed), `examples/basic/entries/design/browse_scheme_screens.tsx`,
  `examples/basic/entries/design/browse_tag_screens.tsx`,
  `examples/basic/entries/design/browse/states/tags/*.tsx` (export screen
  components for reuse rather than entries), `examples/basic/entries/design/design.mockup.tsx`
  (drop the retired children), `examples/basic/entries/design/parts/destinations.ts`
  and `navigation_states.ts` (Welcome variant destinations replace the
  retired ids; links that pointed at retired ids now carry `variant`),
  `docs/protocol/mokly-shell-design.md` and `docs/protocol/mokly-design-links.md`
  inventories, `examples/basic/notes.md`, `tests/design_links.test.ts`,
  `tests/browser/design_links.spec.ts`, `tests/browser/preview_design_links.spec.ts`

**Steps:**

- [ ] Confirm the user's approval is recorded in this plan before touching
      any file.
- [ ] Convert, rebuild, check, and run the design link suites; confirm the
      manifest lost exactly the six retired entries and gained the variant
      records. Name the retired ids in the commit message as the authorized
      removal.
- [ ] Smoke through `npm run dev` and `npm run preview:build`: expand the
      Welcome design row, open each variant, follow a `variant` link from a
      mini screen.
- [ ] Update `plans/README.md` to move this plan to Completed, and the
      README feature paragraph.
- [ ] Milestone close-out: run `cargo xtask check`; commit
      `refactor(design): model Welcome states as variants` and push.

#### Task 9.2: Review

- [ ] After the push, review the complete local diff against `origin/main`
      using [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
      Report numbered findings with severity, context, impact, lettered
      options, and a recommendation without changing the implementation.

## Post-merge follow-up (non-blocking)

- Smoke the published viewer package against a host that selects a screen
  variant through the controlled selection props once the next viewer release
  ships.
- Consider a `variants` summary count on the home stage beside screens and
  components once the user has seen the feature in use.
