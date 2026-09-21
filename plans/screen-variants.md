# Screen Variants

Status: active. Created 2026-09-19 with the user's consent after the design
discussion in this workspace, then rewritten the same day when the user chose
own routes over a query parameter. Milestones 1 to 8 are complete; Milestones
10 to 12 apply the approved review findings; Milestone 9 needs the user's
approval first.

**Goal:** Let a screen declare variants beside its default render, show them as
an expandable list under the screen's navigation row, give each variant its
own catalogue id and URL, and show changed variants in the Changes filter.
Today the only way to record "the same screen with one small shift" is a
second sibling screen in the same collection, which is how the design
catalogue's Shell states and Tag states collections are built.

**Architecture:** A variant is an ordinary screen entry with one extra edge:
`variantOf` names its parent screen. Authors write `variants: [...]` inside
`defineScreen` or nested `screen`, and the helper flattens each variant into a
full screen definition the way `defineRoot` flattens trees, deriving the route
`<parent-route-stem>.variants/<slug>.html` and inheriting the parent's
address, tags, color schemes, dependencies, and related docs unless the
variant overrides them. Everything keyed by route or id then works unchanged:
rendering, fragment paths, `MockLink`, use-case steps, `/id` aliases, static
export files, changed-route detection, per-screen comparison results, selected
live comparisons, and viewer selection. The navigation tree groups variants
under their parent row from the `variantOf` edge, and Changes shows changed
variant rows inside that group.

**Decisions locked by the design discussion (raise before implementing if the
user should reconsider):**

- Own routes and ids, not a query parameter. Every variant is deep-linkable
  as a real file without JavaScript, and no new link grammar is needed.
- Light/dark is not a variant. Scheme stays a view axis on the existing
  toggle. Dark-only changes are surfaced through per-view evidence on the view
  controls and by landing on the first changed view; see Milestone 7.
- Variant ids are ordinary global catalogue ids, never derived from position.
  Authors write the full id, for example `welcome-empty`.
- The parent navigation row is the link to the parent screen and carries a
  separate disclosure button with `aria-expanded`. It is not a `<details>`
  summary, because a summary cannot also be a link.
- Exactly one level: a variant cannot declare variants, and a variant cannot
  be claimed by a collection. It belongs to the parent's collection through
  the parent.
- A variant is a full screen for Changes: it is its own row inside its parent's
  group, and the Changes count counts changed variants. The parent row carries
  an aggregate mark when any variant changed so the group stays visible.
- Manifest schema stays at v5. `variantOf` is an additive optional field, and
  the derived route already satisfies the existing fragment-path rule.
  Comparison schemas stay at v2 and v3 unchanged. The public read model v1
  gains optional `variantOf` on screens, which its additive-field rule allows.
- Proposed, pending the user's explicit approval before Milestone 9 starts:
  the shipped `examples/basic` design catalogue converts the light-only
  `design-browse-dark-scheme`/`design-browse-light-only` pair and the four tag
  states into variants of `design-browse-screen` (Welcome). Ids stay the
  same because variants keep global ids; only their routes and collection
  membership change, which retires six routes on `origin/main` and needs
  approval under the mainline preservation rule. Without approval, Milestone 9
  is skipped and the standalone screens stay.

**Spec:** [`docs/protocol/mokly-screen-variants.md`](../docs/protocol/mokly-screen-variants.md)
plus the targeted updates listed in Milestone 1.

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
  `workspace_data.ts` (292), `stages.tsx` (287), and the design library's
  `catalogue-navigation.view.tsx` (261) are already near the cap; extract
  before extending them.
- Mockup milestones and UI milestones are separate. If a `mockup` or `ui`
  milestone finds missing backend work, add a new backend milestone
  immediately after it, then a new tagged milestone holding the blocked
  tasks, without editing completed milestones.
- Add the failing test before fixing any regression discovered on the way.
- Do not delete or override anything on `origin/main` without explicit
  approval. The only removal this plan proposes is the design-catalogue route
  retirement in Milestone 9; it needs the user's approval first and must be
  named in that commit message.

## Milestones

---

### Milestone 1: Protocol contract for screen variants

Documentation only. At completion every contract below defines the complete
behavior the later milestones implement, with no guesswork left for the
authoring API, derived routes, manifest field, navigation, Changes, the public
read model, and the viewer.

#### Task 1.1: New screen-variants contract

**Files:**

- Create: `docs/protocol/mokly-screen-variants.md`
- Modify: `docs/protocol/README.md` (index entry)

**Steps:**

- [x] Write Delivery Status, Purpose And Boundary, Authoring (the
      `ScreenVariantInput` shape, flattening, derived route, inheritance and
      overrides, the one-level and no-collection-claim rules, validation
      failures), Generated Output And Manifest (`variantOf`, sorting, v5
      validation), Links And Flows (ordinary ids, portable rewrite, use-case
      steps), Navigation (parent row, disclosure button, child rows, keys,
      active-row invariant, search, Collapse all, drawer), Changes (own rows,
      aggregate mark, counts, landing, removed variants), Public Read Model
      And Viewer, Verification, and Related Docs.

#### Task 1.2: Align the existing contracts and guides

**Files:**

- Modify: `docs/protocol/mokly-authoring.md`, `docs/protocol/mokly-rendering.md`,
  `docs/protocol/mokly-component-manifest.md`, `docs/protocol/mokly-changes.md`,
  `docs/protocol/mokly-catalogue-changes.md`, `docs/protocol/mokly-navigation.md`,
  `docs/protocol/mokly-runtime.md`, `docs/protocol/mokly-shell-design.md`,
  `docs/protocol/mokly-catalogue.md`, `docs/protocol/mokly-viewer.md`,
  `docs/protocol/mokly-pages.md`, `docs/architecture/build-pipeline.md`
- Modify: `docs/guides/authoring/screens.md`, `docs/guides/catalogue/browse.md`,
  `docs/guides/catalogue/changes.md`, `README.md`, `plans/README.md`

**Steps:**

- [x] Apply each change, keeping every touched contract internally consistent
      and moving detail into the new contract rather than growing the old
      ones. Where a contract says variants are component-only, replace the
      statement rather than leaving a contradiction.
- [x] Run `npx prettier --check` on the changed Markdown and confirm every
      relative link resolves.
- [x] Milestone close-out: commit `docs(protocol): define screen variants`
      and push.

---

### Milestone 2: Design mockups for variant rows and variant states

Tags: mockup

At completion the design catalogue depicts the expandable variant row in the
navigation, a selected variant, the Changes filter with a changed variant
sub-row, a removed variant, and the changed-view marks on the view controls,
at mobile and desktop widths, using only screen components. The Welcome
scheme and tag artboards stay standalone screens in this milestone; their
conversion into real variants is Milestone 9.

#### Task 2.1: Catalogue navigation library component

**Files:**

- Modify: `examples/basic/entries/design/library/chrome/catalogue-navigation.tsx`
  (row schema gains `kind: "variant"`, an optional `variants` disclosure state
  on screen rows, and an optional `changed` mark), a saved variant `variants`
  depicting Welcome expanded with two variants, and a saved variant
  `changed-variants` depicting the Changes filter with one changed sub-row
- Modify: `examples/basic/entries/design/library/chrome/catalogue-navigation.view.tsx`
  (extract row rendering into `catalogue-navigation-row.view.tsx` first, then
  add the parent link plus disclosure button and the variant rows)
- Modify: `examples/basic/entries/design/parts/nav_data.ts` (Welcome gains
  variant rows as the depicted fixture),
  `examples/basic/generated/design-library/chrome/catalogue-navigation.css`
  (disclosure button, variant depth, changed dot; no left-edge accent rail)
- Modify: `docs/protocol/mokly-design-component-library.md` (variant ids)

**Steps:**

- [x] Add the schema fields, saved variants, and view markup; keep the
      library README's authoring rules.
- [x] Style the disclosure button as a 16px chevron control at the row's
      trailing edge, the variant rows one indent step deeper with the screen
      icon, and the changed mark as the existing changed dot. Verify no
      pseudo-element, border, or gradient adds a left-edge rail.
- [x] `npm run build && npm run example:build && npm run example:check`.
- [x] Follow-up after review: give variant rows their own glyph, a screen
      outline over a second partially drawn screen, on a `mbk-nav-ico variant`
      wrapper, and name it in the contracts.

#### Task 2.2: New Browse states

**Files:**

- Modify: `examples/basic/entries/design/design.mockup.tsx` (register the
  new collection), `examples/basic/entries/design/parts/destinations.ts` and
  `navigation_states.ts` (destinations and typed navigation records for the
  four new screens)
- Create: `examples/basic/entries/design/browse/variants/screens.tsx` with
  `design-browse-variant-selected` (a Welcome variant selected with the nav
  list expanded and the breadcrumb ending in Welcome),
  `design-browse-variant-changes` (Changes filter, Welcome group open, only
  its changed variant sub-row shown with the parent's aggregate mark),
  `design-browse-variant-removed` (a removed variant sub-row with Removed
  status and the current empty state), `design-browse-changed-views` (light
  selected, theme toggle and viewport dropdown carrying changed marks, status
  reading Unmodified for the shown view); one canonical
  `design-browse-variants` collection page under `design/browse/variants/`
  rendering the selected-variant screen and linking the children
- Modify: `examples/basic/entries/design/parts/screen_heads.tsx`,
  `examples/basic/entries/design/parts/nav.tsx`,
  `examples/basic/entries/design/parts/shell.tsx` (view-control changed marks),
  `examples/basic/generated/design.css` and `design-stage.css`
- Modify: `examples/basic/notes.md`, `docs/protocol/mokly-shell-design.md`
  inventory, `docs/protocol/mokly-design-links.md` inventory and control table
- Test: `tests/design_links.test.ts`, `tests/design_screens.test.tsx`,
  `tests/browser/design_links.spec.ts`, `tests/browser/comparison_design.spec.ts`

**Steps:**

- [x] Author the four screens, each with one mobile and one desktop
      component, and the canonical collection page; keep the page at no more
      than five screens. Put implementation notes in descriptions and
      rationale, never inside the artboard. Depict the variant rows with the
      static nav fixture only; no screen in this milestone uses the
      `variants` authoring field, which does not exist yet.
- [x] Extend the design links contract's control table: the parent row opens
      the Welcome default, the Empty workspace variant row opens the
      selected-variant screen, the selected-variant screen's Changes filter
      opens the changed-variant screen and that screen's All filter returns,
      the removed-variant and changed-views screens' All filters open the
      Welcome default, and the theme toggle on the changed-views screen opens
      the dark comparison screen.
- [x] `npm run build && npm run example:build && npm run example:check`, then
      open every changed generated page from disk with Playwright screenshots
      saved under `.context/` and read them to confirm layout at both widths.
- [x] Milestone close-out: commit `docs(design): add screen variant mockups`
      and push.

---

### Milestone 3: Authoring, flattening, and manifest field

Backend only, no shell changes. At completion `defineScreen` and nested
`screen` accept validated variants and flatten them into screen definitions
with derived routes and inherited metadata, the manifest carries `variantOf`,
the hierarchy and public projection know the edge, and Browse still renders
each variant as an ordinary screen because nothing reads the edge yet.

#### Task 3.1: Authoring types, flattening, and validation

**Files:**

- Modify: `src/authoring/types.ts` (`ScreenVariantInput`,
  `ScreenInput.variants?`, `NestedScreenInput.variants?`,
  `ScreenDefinition.variantOf?`), `src/authoring/definitions.ts`
  (`defineScreen` returns the parent when no variants are declared and
  otherwise a `ScreenDefinition[]`-compatible result; nested `screen`
  flattens variants beside the parent)
- Create: `src/authoring/variants.ts` (derive the variant route from the
  parent route and slug, merge inherited fields, brand and attribute each
  flattened definition to the defining module)
- Create: `src/registry/variant_validation.ts` (`variantOf` names an
  existing screen that is not itself a variant; a variant is not claimed by
  any collection; a variant route matches the derived form; slugs are unique
  within a parent; a variant cannot declare `variants`)
- Modify: `src/registry/entry_validation.ts`, `src/registry/relationships.ts`
  (call the new checks), `src/registry/prepare.ts` (accept the flattened
  result shape from `mockups` exports)
- Test: `tests/authoring.test.tsx`, the suite owning `crossReferenceViolations`

**Steps:**

- [x] Keep one helper with a conditional overload: `defineScreen` returns one
      `ScreenDefinition` when `variants` is absent and a readonly parent-first
      `ScreenDefinition[]` when it is present. The packed NodeNext consumer
      covers both return shapes, and the authoring contract records the choice.
- [x] Write failing tests: two variants flatten into two extra screens with
      routes `screens/welcome.variants/<slug>.html`, `variantOf: "welcome"`,
      inherited address, tags, schemes, dependencies, and related docs, and
      per-variant overrides applied; duplicate slugs, a slug that is not a
      route segment, a variant declaring `variants`, a variant claimed by a
      collection, and a `variantOf` pointing at a variant each produce a
      source-attributed violation; nested `screen` behaves the same.
- [x] Implement; keep `definitions.ts` under 300 lines by moving variant
      flattening into the new module.
- [x] `npm test` green.

#### Task 3.2: Manifest, hierarchy, and public projection

**Files:**

- Modify: `packages/viewer/src/registry/types.ts` (`ManifestScreen.variantOf?`),
  `src/registry/manifest.ts` (emit it), `src/registry/manifest_entries.ts`
  and `src/registry/manifest_relationships.ts` (validate it),
  `packages/viewer/src/registry/hierarchy.ts` (`variantsById` and
  `variantParentById` beside the collection maps; a variant's ancestors are
  its parent's ancestors), `src/registry/changed_routes.ts` (the projection
  includes `variantOf`), `src/catalogue/projection.ts`,
  `packages/viewer/src/catalogue/types.ts` and `entry_reader.ts` (public
  `variantOf`), `docs/protocol/fixtures/catalogue-v1.json`
- Test: `tests/manifest_files.test.ts`, `tests/catalogue_projection.test.ts`,
  `tests/catalogue_reader.test.ts`, `packages/viewer/tests/*` for the
  hierarchy

**Steps:**

- [x] Write failing tests: the manifest omits `variantOf` on ordinary screens
      and emits it on variants; validation rejects an unknown parent, a
      parent that is a variant, and a variant listed in `childIds`; the
      hierarchy exposes variants under their parent with the parent's
      ancestors; reparenting a variant marks it changed; the public model
      and reader round-trip the field and the fixture stays valid.
- [x] Implement.
- [x] `npm test` green; `npm run package:smoke` green.

#### Task 3.3: Example catalogue variant and docs

**Files:**

- Modify: `examples/basic/entries/catalogue.mockup.tsx` (Welcome gains an
  `empty-workspace` variant whose input is blank and whose action is
  disabled), `examples/basic/notes.md`, `README.md` authoring example,
  `docs/guides/authoring/screens.md`

**Steps:**

- [x] Add the variant, rebuild, and check; confirm the manifest diff adds
      exactly one screen entry with `variantOf` and its fragment paths.
- [x] Smoke: `npm run dev`, open the variant through `/id/example-welcome-empty`,
      confirm it renders as an ordinary screen with the Welcome breadcrumb.
- [x] Milestone close-out: commit `feat(registry): add screen variants` and
      push.

---

### Milestone 4: Changes aggregation and removed variants

Backend only. At completion the catalogue change snapshot lets the shell mark
a parent whose variant changed, removed variants are retained as removed
screens under their parent, and use-case propagation and affected-consumer
evidence treat variants as the screens they are.

#### Task 4.1: Variant Changes and removal snapshots

**Files:**

- Modify: `src/registry/changes.ts` (`RemovedEntrySnapshot.entry` retains the
  complete baseline screen DTO, including `variantOf` when present, so a
  removed variant can be placed under a surviving parent; ancestors are the
  parent's ancestors),
  `src/server/changed.ts` and `src/registry/changed_routes.ts` (no new
  membership rule; document that a variant is its own route), `packages/viewer/src/shell/context.ts`
  (no new field; the aggregate mark is derived in the shell from
  `changedRoutes` and the hierarchy), `src/publication/*` and `src/export/site.ts`
  (removed variants publish like removed screens)
- Test: `tests/catalogue_screen_changes.test.ts`, `tests/changes.test.ts`,
  `tests/export_changes.test.ts`

**Steps:**

- [x] Write failing tests: a variant-only edit yields the variant route in
      `changedRoutes` and not the parent route; deleting a variant yields a
      removed entry carrying `variantOf` and the parent's ancestors; deleting
      the parent and its variant yields removed entries for both; a use case
      that steps through the variant is propagated; the component
      affected-consumer list names the variant as a screen.
- [x] Implement.
- [x] `npm test` green.
- [x] Milestone close-out: commit `feat(changes): track variant removals`
      and push.

---

### Milestone 5: Shell navigation rows

Tags: ui

At completion the served and exported shells show the expandable variant row,
the active-row invariant holds for variants across navigation, Back, Forward,
search, and the Changes filter, the variant disclosure state persists, the
breadcrumb of a variant ends in its parent's title, and the parent screen's
details list its variants.

#### Task 5.1: Navigation tree and rows

**Files:**

- Modify: `packages/viewer/src/shell/nav_tree.ts` (`NavLeafNode.variants?`
  built from the hierarchy's variant maps; variants never appear as top-level
  or collection leaves), `packages/viewer/src/shell/nav.tsx` (extract
  `LeafRow` and `GroupRow` into `nav_rows.tsx` first; the screen row becomes a
  `div.mbk-nav-leaf` holding the link and, when variants exist, a
  `button[data-nav-variants-toggle][aria-expanded][aria-controls]`, followed
  by `div[data-nav-disclosure="variants:<section>:<id>"][data-nav-variants]`
  with one ordinary `a[data-nav-row]` per variant carrying a `VariantIcon`
  added to `packages/viewer/src/shell/icons.tsx` that matches the mockup
  glyph), new
  `packages/viewer/src/shell/css_nav_variants.ts`,
  `packages/viewer/src/client/browse_navigation.ts` (`variants:` keys are
  valid disclosure keys), `packages/viewer/src/client/browse_state.ts`
  (capture and restore the new disclosure elements; `Collapse all` closes
  them), `packages/viewer/src/client/browse_controls.ts` (toggle handling),
  `packages/viewer/src/client/browse_navigation_state.ts` (ancestor reveal
  opens `data-nav-variants`; a parent stays visible when a variant matches
  search or the Changes filter; the parent carries `data-changed-variants`
  when any child row is changed), `packages/viewer/src/client/browse_evidence.ts`
  (evidence refresh updates the aggregate mark), `packages/viewer/src/shell/head.tsx`
  (crumbs for a variant end with the parent title as a link),
  `packages/viewer/src/shell/details.tsx` (a Variants row on the parent and a
  Variant of row on the variant)
- Also modified while implementing: new `packages/viewer/src/shell/nav_rows.tsx`
  (the extracted rows plus the variant list), new
  `packages/viewer/src/shell/details_rows.tsx` (inspector metadata rows, so
  `details.tsx` stays short), new `packages/viewer/src/client/disclosures.ts`
  (one reader/writer over `<details>` groups and variant lists),
  `packages/viewer/src/shell/css_details.ts` (the screen chip's muted icon),
  `packages/viewer/src/viewer/input.ts` and
  `packages/viewer/src/client/browse.ts` (the control actions object), and
  `src/server/client_modules.ts` (serve `disclosures.js`)
- Test: `tests/nav_tree.test.ts`, `tests/shell.test.ts`,
  `tests/client_navigation_state.test.ts`, `tests/client_browse_navigation.test.ts`,
  `tests/client_browse.test.ts`, new `tests/client_browse_controls.test.ts`,
  new `tests/browser/browse_variants.spec.ts`,
  `tests/browser/navigation_fixture.ts`, `tests/browser/static_example.spec.ts`

**Steps:**

- [x] Write failing tests: tree nodes carry variants in authored order under
      their parent only; shell HTML renders the link, toggle, and variant
      rows with the expected attributes and no toggle for a screen without
      variants; navigating to a variant marks its row current, opens its
      list and ancestors, and renders the parent crumb as a link; Back
      returns to the parent row; Collapse all closes the list; search reveals
      a parent through a matching variant title; the Changes filter shows
      only changed variant rows, keeps the parent visible through the
      aggregate mark, and expands the list; the disclosure survives reload
      through storage; the exported example works without a server; a
      browser test drives all of it against a fixture with two variants and
      against the `examples/basic` Welcome variant.
- [x] Implement; keep `nav.tsx` and each CSS module under 300 lines.
- [x] Update the runtime and shell design contracts' Delivery Status and the
      browse guide.
- [x] Smoke: `npm run dev`, expand Welcome, open the variant, use Back and
      Forward, search for the variant title, Collapse all.
- [x] `npm test && npm run test:browser` green.
- [x] Milestone close-out: commit `feat(browse): group screen variants` and
      push.

---

### Milestone 6: Changes presentation for variants

Tags: ui

At completion the Changes filter matches the Milestone 2 mockups: a changed
screen's group shows its changed variant rows, a parent whose default is
unmodified still appears through its aggregate mark and opens its first
changed variant when activated from Changes, and a removed variant appears as
a Removed row under its surviving parent with the current empty state.

#### Task 6.1: Changed and removed variant rows

**Files:**

- Add: `packages/viewer/src/shell/nav_changed.ts` (the mark's class,
  attribute and wording, shared by the markup and the client),
  `packages/viewer/src/shell/css_nav_changed.ts` (the trailing dot and the
  visually hidden wording, drawn from `data-changed` and
  `data-changed-variants`), `packages/viewer/src/shell/nav_leaf_rows.tsx`
  (leaf rows split out of `nav_rows.tsx`),
  `packages/viewer/src/client/browse_landing.ts` (`changesLandingHref`),
  `packages/viewer/src/client/browse_evidence_variants.ts` (removed variant
  rows reconciled inside their parent's list)
- Modify: `packages/viewer/src/shell/nav_tree.ts` and
  `packages/viewer/src/shell/nav.tsx` (removed variants attach to their
  current parent from `RemovedEntrySnapshot.variantOf` rather than rendering
  as flat rows), `packages/viewer/src/shell/nav_rows.tsx` (collection groups
  only), `packages/viewer/src/shell/css.ts`,
  `packages/viewer/src/client/browse.ts` (a Changes-filter activation of a
  parent that is not itself changed navigates to its first changed variant),
  `packages/viewer/src/client/browse_navigation_state.ts` (All hides a
  removed variant; search ignores the mark's wording),
  `packages/viewer/src/client/browse_evidence.ts`,
  `src/server/client_modules.ts`
- Verify unchanged: `packages/viewer/src/shell/workspace_data.ts` (status of
  a variant is its own; the parent's status ignores its variants) and
  `packages/viewer/src/shell/nav_filter.tsx` (count stays the length of
  `changedRoutes`); both already key on the entry's own route, so this task
  adds their tests rather than changing them
- Test: `tests/shell.test.ts`, `tests/client_browse_landing.test.ts`,
  `tests/client_browse_navigation.test.ts`,
  `tests/catalogue_screen_changes.test.ts`, `tests/helpers/fake_dom.ts`,
  `tests/browser/navigation_fixture.ts`,
  `tests/browser/browse_variants.spec.ts`,
  `tests/browser/evidence_removed_variant.spec.ts`,
  `tests/browser/changes_continuity.spec.ts`,
  `tests/browser/removed_comparison_eligibility.spec.ts`,
  `tests/browser/publish_current.spec.ts`

**Steps:**

- [x] Write failing tests for each behavior in the milestone summary,
      including a removed variant's row placement, its Removed status, and
      the parent's Unmodified status when only the variant changed.
- [x] Implement and update the changes guide and runtime contract.
- [x] Smoke against a fixture repository with a committed baseline: edit a
      variant only, then delete it, confirming the rows, count, landing, and
      comparison at each step.
- [x] Milestone close-out: commit `feat(browse): show changed variants` and
      push.

---

### Milestone 7: Changed-view evidence on the view controls

Tags: ui

At completion a screen whose change is confined to one viewport or scheme
tells the reviewer where to look: the theme toggle and viewport dropdown mark
the views with a changed state, opening a changed screen from Changes lands on
its first changed viewport and scheme instead of the sticky selection, and
the details inspector lists the changed views. Scheme remains a view axis.
The per-view states already exist in the review result and the lightweight
screen-view evidence, so this milestone reads them without new server work.

#### Task 7.1: View marks and landing

**Files:**

- Add: `packages/viewer/src/shell/view_marks.ts` (the changed-view axes, their
  canonical order and reader label, the mark's class/ids/wording, and the pure
  rule both the server render and the client apply),
  `packages/viewer/src/shell/workspace_views_data.ts` (`changedViews`
  derivation, comparison result first and lightweight screen-view evidence
  second), `packages/viewer/src/shell/workspace_input_changes.ts` (split out of
  `workspace_data.ts` so it stays under the cap),
  `packages/viewer/src/shell/css_workspace_marks.ts` (the dot, its clipped
  wording, and the hidden metadata row),
  `packages/viewer/src/client/workspace_views.ts` (control sync, mark
  application, and the initial view an arrival opens on),
  `packages/viewer/src/client/browse_clicks.ts` (the delegated click path
  extracted from `browse.ts`)
- Modify: `packages/viewer/src/shell/workspace_controls.tsx` (each control
  carries its dot and its `aria-describedby` wording),
  `packages/viewer/src/shell/workspace_data.ts` (publish `changedViews`),
  `packages/viewer/src/shell/metadata.ts` (`ShellEvidence.screenViews`),
  `packages/viewer/src/shell/details.tsx` and `details_rows.tsx` (a
  `Changed views` row), `packages/viewer/src/shell/inspector.tsx`,
  `packages/viewer/src/shell/workspace.tsx`, `packages/viewer/src/shell/css.ts`,
  `packages/viewer/src/viewer/public_workspace.ts` (the published read model
  names the same views), `packages/viewer/src/client/workspace.ts`,
  `packages/viewer/src/client/workspace_updates.ts` (marks and the row refresh
  with evidence), `packages/viewer/src/client/workspace_preview.ts`,
  `packages/viewer/src/client/browse_landing.ts` (the Changes-landing intent),
  `packages/viewer/src/client/browse.ts`, `src/server/client_modules.ts`
- Test: `tests/view_marks.test.ts`, `tests/workspace_views_data.test.ts`,
  `tests/client_workspace_evidence.test.ts`, `tests/client_browse_landing.test.ts`,
  `tests/client_workspace_comparison.test.ts`, `tests/shell.test.ts`,
  `tests/helpers/fake_dom.ts`, `tests/browser/changed_views.spec.ts`

**Steps:**

- [x] Write failing tests: a dark-only material change marks the theme
      toggle and lists `Mobile · Dark, Desktop · Dark` in details; opening
      that screen from Changes lands on dark; opening it from All keeps the
      sticky selection; a light-only catalogue renders no scheme mark.
- [x] Implement, keeping the changed mark distinct from the pressed state
      and never relying on color alone.
- [x] Update the runtime and shell design contracts and the changes guide.
- [x] Milestone close-out: commit `feat(browse): mark changed views` and
      push.

---

### Milestone 8: Per-view evidence for every variant and every export

Backend only. Added after the Milestone 7 review: two findings there are
real product gaps rather than polish. A component workspace derives its
changed views from the first saved variant only, so the marks can describe a
variant other than the one on screen; and a static export of a screen-only
catalogue publishes no per-view states, so the exported shell shows neither
the marks nor the Changed views row that the served shell shows for the same
catalogue. At completion the evidence always describes what is on screen, in
Serve and in every export.

#### Task 8.1: Changed views per saved variant

**Files:**

- Modify: `packages/viewer/src/shell/workspace_data.ts` and
  `workspace_views_data.ts` (`WorkspaceData.changedViews` becomes a record
  keyed by saved-variant id for components, with one entry for screens;
  derive each variant's views from its own `ComponentVariantReview`),
  `packages/viewer/src/client/workspace_views.ts` and `workspace.ts`
  (`syncViewControls` and `applyInitialView` read the selected variant's
  entry, the way `workspaceViews` already filters by `variantId`),
  `packages/viewer/src/viewer/public_workspace.ts` (the published model keys
  the same way from each variant's views), `docs/protocol/mokly-runtime.md`
  (one sentence: the evidence describes the selected saved variant)
- Test: `tests/workspace_views_data.test.ts`, `tests/client_workspace_evidence.test.ts`,
  `tests/browser/changed_views.spec.ts` (a component whose second variant
  changed only in dark shows the theme mark only while that variant is
  selected)

**Steps:**

- [x] Write the failing tests, then implement.
- [x] `npm test && npm run test:browser` green.

#### Task 8.2: Per-view states in screen-only exports

**Files:**

- Modify: `src/export/site.ts` (map the v2 result's `screens[].views[]`
  `viewport`, `colorScheme`, and `state` into `screenViews` beside the
  existing `screenEvidence`, so `ShellEvidence` stays the one source for
  served and exported shells), `docs/protocol/mokly-export-delivery.md` and
  `docs/protocol/mokly-changes.md` (the exported shell carries the same
  per-view evidence as Serve)
- Test: `tests/export_changes.test.ts` (an exported screen-only catalogue with
  a dark-only change renders the theme mark and the Changed views row),
  `tests/browser/static_comparisons.spec.ts` or `publish_current.spec.ts`

**Steps:**

- [x] Write the failing tests, then implement.
- [x] `npm test && npm run test:browser` green.
- [x] Milestone close-out: run `cargo xtask check`; commit
      `fix(browse): keep view evidence on screen` and push.

---

### Milestone 9: Design catalogue conversion and verification

Tags: mockup

Requires the user's explicit approval of the route retirement recorded in the
locked decisions; without it, skip Task 9.1 and go straight to Task 9.2. At
completion the Welcome design screen owns the dark-scheme, light-only, and four
tag states as variants under `design/browse/views/screen.variants/`, the
inventories list the new routes, and the plan is closed.

#### Task 9.1: Convert the design states to Welcome variants

**Files:**

- Modify: `examples/basic/entries/design/browse_screens.tsx` (Welcome's
  `design-browse-screen` gains `variants: [...]` composed from the dark-scheme
  and tag-state screen components), `examples/basic/entries/design/browse_scheme_screens.tsx`,
  `examples/basic/entries/design/browse_tag_screens.tsx`,
  `examples/basic/entries/design/browse/states/tags/*.tsx` (export screen
  components and variant inputs rather than entries),
  `examples/basic/entries/design/design.mockup.tsx` (drop the moved children
  from their collections), `docs/protocol/mokly-shell-design.md` and
  `docs/protocol/mokly-design-links.md` inventories, `examples/basic/notes.md`,
  `tests/design_links.test.ts`, `tests/design_screens.test.tsx`,
  `tests/browser/design_links.spec.ts`, `tests/browser/preview_design_links.spec.ts`

**Steps:**

- [ ] Confirm the user's approval is recorded in this plan before touching
      any file.
- [ ] Convert, rebuild, check, and run the design link suites; confirm the
      manifest keeps every design id, moves exactly six routes, and adds
      `variantOf` to those six entries. Name the retired routes in the
      commit message as the authorized removal.
- [ ] Smoke through `npm run dev` and `npm run preview:build`: expand the
      Welcome design row, open each variant, follow a design link into a
      variant from a mini screen.
- [ ] Update `plans/README.md` to move this plan to Completed, and the
      README feature paragraph.
- [ ] Milestone close-out: run `cargo xtask check`; commit
      `refactor(design): model Welcome states as variants` and push.

#### Task 9.2: Review

- [x] After the push, review the complete local diff against `origin/main`
      using [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
      Report numbered findings with severity, context, impact, lettered
      options, and a recommendation without changing the implementation.
      The findings are recorded below under Review Findings.

### Milestone 10: Contract updates for the review fixes

Define the four contract changes the review fixes need so the code milestones
that follow have no guesswork: per-view status and comparison eligibility,
authored sibling-variant order, the embedded Viewer's variant relationship and
Changes activation, and the parent row's leaf container under filtering.

- [ ] Finding 3 contract: in `docs/protocol/mokly-changes.md` (Screen
      controls) and `docs/protocol/mokly-runtime.md` (Browse Shell per-view
      paragraph), state that the status beside the title and the comparison
      band describe the shown view: for one viewport and one scheme they
      follow that view's own state; while Both is selected the shown state is
      Changed when any shown view is Changed, else Added when any is Added,
      else Removed when any is Removed, else Unmodified. Comparison
      eligibility follows the shown status, so a changed screen viewed in an
      unchanged view shows `Unmodified` with no band and the view-control
      marks point at the changed views; switching viewport, scheme, or saved
      variant recomputes both. Unknown or pending per-view evidence keeps the
      route-level status. Add the same rule to
      `docs/protocol/mokly-component-workspace-design.md` (Comparison
      Availability) and one sentence to `docs/guides/catalogue/changes.md`.
- [ ] Finding 4 contract: in `docs/protocol/mokly-screen-variants.md`, replace
      "manifest entry order (the route order)" with authored order, and in
      `docs/protocol/mokly-component-manifest.md` and
      `docs/protocol/mokly-catalogue.md` state that variant screens of one
      parent are emitted in authored order directly after their parent,
      before the next route in route order, so the manifest and public
      entry arrays keep authored sibling order while every other entry keeps
      route order.
- [ ] Findings 1 and 2 contract: in `docs/protocol/mokly-viewer.md`
      (Selection, Events And Imperative Use) and
      `docs/protocol/mokly-screen-variants.md` (Public Read Model And
      Viewer), state that the Viewer rebuilds `variantOf` for current and
      removed screens so the rendered hierarchy, crumbs, details rows,
      aggregate mark, and removed-variant adoption match Serve, and that a
      shell activation while Changes is selected proposes one atomic
      selection: an aggregate-only parent proposes its first visible changed
      variant, and a changed row proposes the first changed view's viewport
      and scheme unless the link names them; a direct `select` call keeps the
      supplied axes.
- [ ] Finding 5 contract: in `docs/protocol/mokly-runtime.md` (Browse Shell
      navigation paragraph) and `docs/protocol/mokly-screen-variants.md`
      (Navigation), state that a parent row hidden by search or the Changes
      filter hides its leaf container, so no disclosure button remains
      visible or focusable without its row.
- [ ] Finding 6: correct the README feature paragraph and the variants
      contract's Delivery Status to one current statement that Milestones 1
      to 8 are implemented and verified.
- [ ] Validate the changed Markdown with Prettier and review the diff; commit
      `docs(protocol): define the review fix contracts` and push.

### Milestone 11: Backend fixes for order, Viewer data, and per-view status

Apply findings 4, 1, and 3 in the data layers: authored sibling order through
registry canonicalization and the public projection, the Viewer's manifest
reconstruction, and per-view status and eligibility in the workspace data.

- [ ] Finding 4: keep authored sibling-variant order. In
      `src/registry/prepare.ts`, sort variants directly after their parent in
      their flattened (authored) order rather than by route; apply the same
      rule in `src/catalogue/projection.ts` (`entryOrder`) and in the
      manifest validation that checks entry order, so a manifest whose
      variants are out of authored order is still accepted only when the
      order matches this rule. Test: `tests/authoring_variants.test.tsx` and
      `tests/manifest_variants.test.ts` author `zeta` before `alpha` and
      assert the prepared registry, the manifest, the hierarchy
      `variantsById`, the nav tree, and the public tree keep
      `[parent, zeta, alpha]`.
- [ ] Finding 1: copy `variantOf` in `displayEntry`
      (`packages/viewer/src/viewer/projection.ts`) for current and removed
      screens. Test: a new `tests/viewer_catalogue_variants.test.ts` builds a
      public model with a parent, a current variant, and a removed variant,
      runs `viewerCatalogue`, and asserts `variantsById`,
      `variantParentById`, the removed entry's `variantOf`, and the served
      nav tree from `buildNavSections`.
- [ ] Finding 3: per-view status. Extend `WorkspaceData` with typed per-view
      states keyed like `changedViews` (`viewStates: Record<key,
    { viewport, colorScheme, state }[]>`, where `state` is the review
      state) derived in `workspace_views_data.ts` from the same sources as
      `changedViews`, and a pure `shownStatus(states, viewport, scheme,
    fallback)` in a new `packages/viewer/src/shell/view_status.ts` that
      applies the Both aggregation rule from Milestone 10 and returns the
      fallback when no per-view evidence exists. Comparison eligibility for
      the shown view is `isComparisonEligible(shownStatus, kind)`. Derive the
      same keyed states in `public_workspace.ts` from each view's published
      comparison. Tests: `tests/view_status.test.ts` for the rule, and
      `tests/workspace_views_data.test.ts` for the keyed states.
- [ ] `npm test` green; commit
      `fix(catalogue): keep authored variant order and per-view status` and
      push.

### Milestone 12: Shell and client fixes for status, landing, and the leaf row

Tags: ui

Apply findings 3, 5, and 2 in the shell and clients: the badge and band follow
the shown view, the hidden parent hides its leaf container, and the embedded
Viewer shares the Changes activation decision.

- [ ] Finding 3: `packages/viewer/src/shell/workspace.tsx` renders the
      initial badge and band from `shownStatus` for Both and light;
      `packages/viewer/src/client/workspace_views.ts` recomputes the badge
      text, `data-status`, and the band's `hidden` state (returning the
      comparison mode to Current when the band hides) inside
      `applyViewEvidence`, so viewport, scheme, saved-variant, and evidence
      changes all pass through one path. Update the assertion in
      `tests/browser/changed_views.spec.ts` to expect `Unmodified` with the
      band hidden in light and `Changed` with the band shown after switching
      to dark, add the Both case, and add a component case through the Saved
      variant control. Reword the `design-browse-changed-views` mockup
      description to a direct arrival (not from Changes) and regenerate the
      example catalogue.
- [ ] Finding 5: in `applyVariantVisibility`
      (`packages/viewer/src/client/browse_navigation_state.ts`), set the
      leaf container's `hidden` to the parent link's `hidden`, and add the
      matching `.mbk-nav-leaf[hidden]` rule in `css_nav_variants.ts`. Test:
      `tests/client_browse_navigation.test.ts` asserts the container is
      hidden when a search hides the parent and shown again when the search
      clears; `tests/browser/browse_variants.spec.ts` asserts the toggle is
      not visible while the parent is filtered out.
- [ ] Finding 2: extract the Changes activation decision into
      `packages/viewer/src/client/changes_activation.ts`:
      `changesActivation(row, data?)` returns `{ href, viewport?, scheme? }`
      from `changesLandingHref` and the destination's first changed view when
      the link names neither axis. `browse_clicks.ts` keeps its current
      behaviour through it; `viewerInput` resolves the destination entry
      through it and proposes `{ screenId, viewport, colorScheme }` in one
      `select` call, using the public model's per-view comparison states for
      the destination. Tests: `tests/browser/viewer_variants.spec.ts` gains an
      aggregate-parent activation and a dark-only landing in uncontrolled and
      controlled mode.
- [ ] Milestone close-out: run `cargo xtask check`; commit
      `fix(browse): follow the shown view and share Changes activation` and
      push.
- [ ] After the push, review the complete local diff against `origin/main`
      using [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      and report findings without changing the implementation.

## Review Findings (approved, addressed in Milestones 10 to 12)

Review of the complete branch diff after the Milestone 8 push, run with the
review prompt by two independent reviewers. The user approved fixing all six;
Milestones 10 to 12 apply them. Task 9.1 remains unapproved and untouched.

1. **P2, the embeddable Viewer drops `variantOf`.** `displayEntry` in
   `packages/viewer/src/viewer/projection.ts` rebuilds a manifest screen from
   the public entry without copying `variantOf`, so a Viewer host sees every
   variant as a root row with no grouping, crumb, details rows, aggregate
   mark, or removed-variant adoption. Recommended: copy the field for current
   and removed entries and add a public-model-to-Viewer round-trip test that
   asserts the rendered hierarchy.
2. **P2, Viewer link activation skips the Changes rules.** `viewerInput`
   treats every anchor as an ordinary route: an aggregate-only parent opens
   the parent and `revealSelection` then drops the filter to All, and a
   changed row keeps the sticky viewport and scheme instead of landing on the
   first changed view. Recommended: extract one typed Changes-activation
   decision shared by standalone Browse and the Viewer, returning the
   destination id, viewport, and scheme together, with controlled and
   uncontrolled Viewer browser coverage.
3. **P2, per-view evidence never drives the status or the comparison band.**
   `workspaceData` derives status and comparison eligibility from route-level
   membership only, so a dark-only change shows `Changed` and offers
   comparisons while the light view on screen is known unchanged. The Changes
   contract, this plan, and the approved `design-browse-changed-views` mockup
   all require `Unmodified` with no band for the shown view; the browser test
   locks in the conflicting `Changed`. Recommended: carry typed per-view state
   keyed by screen or saved variant, define the `Both` aggregation rule, and
   recompute status and eligibility whenever viewport, scheme, saved variant,
   or evidence changes, with tests for each transition. Also reword the
   mockup description, which calls its light state an arrival from Changes.
4. **P2, registry sorting rewrites authored variant order.**
   `prepareRegistry` sorts every entry by route before the manifest is built,
   so sibling variants land in slug order (`zeta` before `alpha` authors as
   `[parent, alpha, zeta]`), contradicting the authored-order promise in the
   variants contract and the navigation section, while one contract sentence
   calls manifest order "the route order". Recommended: preserve a
   parent-local authored ordinal through canonicalization, fix the sentence,
   and add an authoring-to-navigation test with reverse-lexical slugs.
5. **P3, a filtered-out parent leaves an orphan chevron.** `applyNavVisibility`
   hides the parent link but not the `mbk-nav-leaf` container, so a search
   that matches only another row still shows the parent's focusable
   `Show variants of …` button on its own line (confirmed by screenshot).
   Recommended: hide the leaf container whenever its link is hidden, in the
   same helper that reconciles variant visibility, and cover it with a
   navigation-state unit test.
6. **P3, delivery wording is stale.** The README says navigation grouping
   "follows in its UI milestone", the variants contract's Delivery Status
   describes Milestones 5 to 7 as pending and omits Milestone 8, and this
   plan's header repeats itself. Recommended: state once that Milestones 1 to
   8 are implemented and Milestone 9 awaits approval.

## Post-merge follow-up (non-blocking)

- Group a component's Affected screens list by parent screen once variants
  are common enough for the flat list to get long.
- Consider a variants count on the home stage beside screens and components
  once the user has seen the feature in use.
