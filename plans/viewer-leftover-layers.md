# Remove the viewer's leftover layers

Status: Active. On branch `calummoore/mokly-viewer-responsibilities`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

`@mokly/viewer` has about 33,000 lines of TypeScript under
`packages/viewer/src`, and `@mokly/ui` already holds every element and style
of the shell. About 22,400 lines are browser work: frames, comparison,
inspection, data delivery, URL state, and the containers that feed
`@mokly/ui`. About 3,500 lines are the viewer's own reader and validator of
the read model, which `docs/protocol/mokly-viewer.md` requires. The other
5,100 lines derive values from catalogue data. Most of that code is left over
from the TypeScript backend that the Rust rebuild replaced:
`viewer/projection.ts:102` converts the read model into a `live-index-2`
manifest of the old model, builds a folder tree from it, and then replaces
that tree with the tree that Rust wrote (`viewer/catalogue_tree.ts:13-76`).
The viewer also recalculates values that the JSON holds, keeps separate code
paths for the standalone and embedded roots, and reads `@mokly/ui` markup
from the DOM in ways left over from the server-rendered shell.

This change removes those layers and keeps the JSON formats, the protocol
requirements, and the behaviour. It does not make Rust write more results
into the JSON. It does not share the Rust checks with the viewer: the
follow-up item `plans/follow-ups/viewer-checks-from-rust.md` owns that work.
The five survey reports and the notes of the investigation are under
`.context/viewer-thin/`.

Contract owners:

- [Embeddable viewer](../docs/protocol/mokly-viewer.md) and
  [viewer selection](../docs/protocol/mokly-viewer-selection.md).
- [Shell delivery](../docs/protocol/mokly-shell-delivery.md) and
  [shell fetch and fences](../docs/protocol/mokly-shell-fences.md).
- [Catalogue tree](../docs/protocol/mokly-catalogue-tree.md) and
  [shared UI package](../docs/protocol/mokly-ui-package.md).
- [Package boundary](../docs/architecture/package-boundary.md).
- The [viewer README](../packages/viewer/README.md) and the
  [shell README](../packages/viewer/src/shell/README.md).

## Decisions

The user made three decisions on 2026-11-01, at the end of the
investigation of the viewer's size.
[decisions.md](./viewer-leftover-layers/decisions.md) gives each in full,
with its options and the options that it leaves out.

1. **Option B now, option F as a follow-up.** The other options were A,
   change nothing; C, Rust writes more results in index v10 and detail v5;
   D, the Rust checks run as WebAssembly; and E, generated TypeScript
   readers. B removes the largest waste with no format or protocol change.
   F later gives the viewer and `@mokly/mokly` one implementation of the
   checks, as plain JavaScript that `wasm2js` makes from the Rust code. The
   approval covers deleting the old manifest model, the tree rebuild, and
   the recalculated values, with the behaviour kept.
2. **The removed-preview fetch uses `fetchJson`.** `previews/request.ts`
   fetches JSON with an `accept` header and the default credentials, and it
   checks neither the final origin nor the content type, against
   `docs/protocol/mokly-shell-fences.md:49-51`. The other options were B,
   copy the checks into `requestPreview`, and C, change the protocol.
3. **The schema differences stay until the follow-up.** The viewer rejects a
   schema property named `__proto__`, `constructor`, or `prototype`, and
   repeated select options, which Rust accepts. The user chose to change
   nothing, because the follow-up replaces the viewer's checks with the Rust
   ones. The other options were a new build error in the core, and a looser
   viewer check.

The options check of 2026-11-01 ran over the three decisions. Its summary is
in `.context/viewer-leftover-layers/options-check.md`, and decisions.md holds
its new options. It agrees with the user's choices for decisions 1 and 2. For
decision 3 it found option D, which the user has not seen:
`plans/follow-ups/derived-select-option-repeats.md` holds it. Decision 3 stays
in force until the user answers again.

The investigation also found that the embedded Light and Dark switch ignores
the own views of component parents (`shell/catalogue.ts:100-109`). This
change counts every entry with views, as
`docs/protocol/mokly-variant-navigation.md:99-101` says. A second finding of
the investigation, the comparison error text, needs the user, so
`plans/follow-ups/comparison-error-text.md` holds it.

## Design calls

My calls, on 2026-11-01:

1. The behaviour stays. Where the standalone and embedded paths differ, the
   merged path follows the protocol when it states the behaviour. An example
   is the outside click that closes the tag picker, in
   `docs/protocol/mokly-shell-design.md`: in both roots it closes the panel
   on a click anywhere outside it. Where the protocol is silent, the merged
   path keeps each root's current behaviour, and each such difference becomes
   a follow-up item.
2. The viewer keeps all its read-model checks, also the props-key hash check,
   because `mokly-viewer.md` requires them and the follow-up replaces them.
3. The split of the tree into the Specs and Components sections stays in the
   viewer, because `mokly-catalogue-tree.md` gives that job to the viewer.
   The old tree builder goes, because the index `tree` replaces its result.
4. `@mokly/viewer/data` keeps every export, because it is a public entry of a
   published package.
5. The shell README changes only where this change makes it stale. Its
   structure waits for the open decision in
   `plans/follow-ups/shell-readme-length.md`.
6. State that the viewer now writes into `@mokly/ui` markup becomes props and
   refs of the package components, in their own `ui` milestone, with no
   visual change.
7. Flat removed rows keep the order of `removedEntries`. The sort by kind
   and path in `shell/nav_tree.ts:138-150` breaks the sibling order of
   `docs/protocol/mokly-catalogue-serialization.md:8-12`, which puts a
   parent's variants directly after the parent.
8. The renewal `HEAD` request of a removed preview,
   `previews/request.ts:189`, also omits credentials and rejects another
   origin, so that every read-model request follows one rule.
9. Each public export of `packages/viewer/src/index.ts` keeps its name and
   its shape. `docs/guides/start/upgrade.md:123-129` tells hosts to import
   `ColorScheme`, `Viewport`, and `InsertedComponentStylesheet`. When a
   generated type has the same shape, the public name exports that type.

## Milestone 1: Documentation and follow-up items

Depends on: none

The change keeps the behaviour, so no protocol requirement changes. This
milestone records the follow-up items.

- [x] Add `plans/follow-ups/viewer-checks-from-rust.md` for option F.
- [x] Add the follow-up items of the investigation and the options check:
      `removed-detail-generation-field.md`, `derived-select-option-repeats.md`,
      `comparison-error-text.md`, `removed-preview-detail-fence.md`,
      `viewer-credential-rule.md`, and `comparison-chrome-address.md`, all
      under `plans/follow-ups/`.
- [ ] Confirm that no protocol or architecture doc names a mechanism that
      this change removes, such as the `live-index-2` manifest or the
      appearance asset in the head. Save the search under
      `.context/viewer-leftover-layers/`.

## Milestone 2: Fixes from the investigation

Depends on: 1

- [ ] Send the preview JSON of `previews/request.ts` through `fetchJson`,
      and apply design call 8. Decision 2. One regression test shows that
      `requestPreview` uses the helper, because
      `packages/viewer/tests/sources.test.ts:103-137` already tests its rules.
- [ ] Count the own views of component parents for Dark availability in
      `shell/catalogue.ts`. Add a regression test with components that have
      no variants.

## Milestone 3: Read the generated types directly

Depends on: 2

- [ ] Build the shell catalogue from `CatalogueReadModel`: lookups by path,
      variants by parent, removed records, tags, and Dark availability.
      Delete `displayEntry`, the `live-index-2` manifest, and the manifest
      input of `createCatalogue`.
- [ ] Use the index `tree` for folders, titles, hidden flags, and ancestor
      titles. Delete `analyzeHierarchy` and the folder-record branches of
      `registry/hierarchy.ts`. Keep `filterHierarchy` under design call 3.
- [ ] Replace the hand-written types that restate generated ones:
      `registry/types.ts`, `components/manifest_types.ts`,
      `shell/metadata.ts`, `data/axes.ts`, and
      `shell/workspace_usage_data.ts`. Apply design call 9.
- [ ] Stop rebuilding the whole catalogue for each accepted batch of
      details, in `shell/data_commit.ts:40,57-65`.
- [ ] Move the tests that build manifest shapes to the generated shapes, with
      every assertion of live behaviour. Examples are
      `tests/helpers/current_manifest.ts` and
      `packages/viewer/tests/moved_catalogue.test.ts`. Remove a test only
      under the removal rule of the `testing` skill, with its proof.
- [ ] Update the READMEs that name a removed module.

## Milestone 4: Use the values that Rust writes

Depends on: 3

- [ ] Number controls use the bounds and step of `controls`. Delete the
      recalculation in `shell/control_numbers.ts:15-33`.
- [ ] Views use `comparison.eligible` and `comparison.kind` as the index
      writes them. Delete the mapping back to review states in
      `viewer/public_workspace_views.ts:14-21`, and the recalculated
      eligibility of each view in `shell/view_status.ts`. Keep the combined
      status of the shown views, `shell/view_status.ts:118-127`, which the
      index does not hold.
- [ ] Keep the view order and the view lists of the index. Delete the sorts
      in `shell/view_marks.ts:46-56` and `viewer/public_workspace_views.ts`,
      and the rebuilt lists in `components/views.ts` and `registry/views.ts`.
- [ ] Use `identity.title` in `shell/view_title.ts`, and the lengths of the
      index arrays in `shell/home_summary.ts`.
- [ ] Show flat removed rows in the order of `removedEntries`, under design
      call 7. Add a regression test with a removed parent, its removed
      variant, and a removed sibling whose path sorts between them.

## Milestone 5: One code path for both roots

Depends on: 3

- [ ] Merge the Escape handling, the link eligibility, the route
      installation, and the outside click of `shell/store_browser_*.ts` and
      `shell/store_host_routes.ts`, under design call 1.
- [ ] Use one resolver from a selection to an entry, in place of
      `shell/catalogue.ts:56-67`, `catalogue/entry_selection.ts:99-125`, and
      `shell/routes.ts:31-60`.
- [ ] Use one helper each for the Light fallback, rectangle intersection,
      point-in-box tests, frame cleanup, `sameQuery`, and the object index
      source.
- [ ] Remove the import cycle between `shell/` and `viewer/`.
- [ ] Move each test that uses an internal that this milestone deletes to
      the public path, with every assertion.
- [ ] Record each difference that design call 1 keeps as a follow-up item.

## Milestone 6: Package props for viewer state

Tags: ui

Depends on: 1

- [ ] Give the `@mokly/ui` components props for the state that the viewer
      writes through the DOM today: the inspector height, expanded state, and
      ARIA values, the resizing state of the inspector and the navigation,
      and the expanded browser frame.
- [ ] Give the components that the viewer measures element refs: the device
      frame, the flow step, the stage embed, the workspace preview, and the
      marker layer.
- [ ] Keep every visual result. Run the mockup check of `AGENTS.md` and the
      `@mokly/ui` tests.

## Milestone 7: No DOM reads of package markup

Depends on: 4, 5, 6

- [ ] Read the comparison mode from shell state. Delete the `aria-pressed`
      observers and the `mokly:comparison` listeners in
      `viewer/host_bridge_lifecycle.ts:105-141`, `shell/frame_markers.ts:95-98`,
      and `shell/frame_marker_layer.tsx:67-92`.
- [ ] Hold the standalone appearance in React state. Delete the controller in
      `standalone/startup.ts` that writes into rendered elements, and the
      `window.__moklyAppearance` and `window.onAppearance` globals. Keep the
      stored appearance applied before the first render.
- [ ] Use the props and refs of Milestone 6 in place of selectors and class
      changes, for example in `shell/inspector_resize.ts`,
      `shell/nav_resize.ts`, `shell/frame_geometry.ts`, and
      `client/same_origin_adapter.ts:108`.
- [ ] Pass the scheme of each frame through its session, not through the
      `data-fragment-light` and `data-fragment-dark` attributes.
- [ ] Keep the standalone appearance code out of the React-host entry.
- [ ] Move each test that uses an internal that this milestone deletes to
      the public path, with every assertion. An example is
      `packages/viewer/tests/appearance_startup.test.ts:142`.

## Milestone 8: Dead code

Depends on: 7

- [ ] Apply the dead-code test of the `git-commit` skill to each candidate
      that the survey reports name, and delete each one that passes. Save
      the searches under `.context/viewer-leftover-layers/`.
- [ ] Update the viewer README, the shell README, and the package READMEs.

## Milestone 9: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Run the mockup check of `AGENTS.md`. Smoke-test Browse, Changes, a
      comparison, inspection, prop editing, a removed entry, and an
      embedded host through `npm run dev`.
- [ ] Measure the source lines and the gzip size of `shell.js` before and
      after the change. Save the numbers under
      `.context/viewer-leftover-layers/`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
