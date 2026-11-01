# Remove the viewer's leftover layers

Status: Active. On branch `calummoore/mokly-viewer-responsibilities`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

`@mokly/viewer` has about 33,000 lines of TypeScript. About 22,400 are
browser work, and about 3,500 are the reader and validator of the read model
that `docs/protocol/mokly-viewer.md` requires. Most of the other 5,100 lines
are left over from the replaced TypeScript backend: `viewer/projection.ts:102`
converts the read model into a `live-index-2` manifest and rebuilds a tree
that it then replaces with the tree that Rust wrote. The viewer also
recalculates values that the JSON holds, keeps separate paths for the
standalone and embedded roots, and reads `@mokly/ui` markup from the DOM.

This change removes those layers and keeps the JSON formats and the
behaviour. `plans/follow-ups/viewer-checks-from-rust.md` owns the sharing of
the Rust checks. The survey reports are under `.context/viewer-thin/`.

Contract owners:

- [Embeddable viewer](../docs/protocol/mokly-viewer.md),
  [shell delivery](../docs/protocol/mokly-shell-delivery.md), and
  [shell fetch and fences](../docs/protocol/mokly-shell-fences.md).
- [Catalogue tree](../docs/protocol/mokly-catalogue-tree.md),
  [shared UI package](../docs/protocol/mokly-ui-package.md), and
  [package boundary](../docs/architecture/package-boundary.md).
- The [viewer README](../packages/viewer/README.md) and the
  [shell README](../packages/viewer/src/shell/README.md).

## Decisions

The user made these decisions on 2026-11-01, after the investigation of the
viewer's size, and approved this plan on the same day.
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
3. **The core derives each select option once.** A repeated `enum` or
   `oneOf` value gave repeated options, which the viewer rejects. The user
   first chose to change nothing, then chose option D after the options
   check found it. The reserved-name difference stays until the follow-up.
4. **A removed screen's preview reads the route's fenced detail.** The
   preview read the removed detail a second time and skipped the fence of
   `docs/protocol/mokly-shell-fences.md:43-45`. Option B drops the second
   read, so `docs/protocol/mokly-removed-previews.md` changes. The other
   options were a fence inside the preview's read, and no change.
5. **The viewer owns the text of a comparison failure.** It maps the `code`
   of Serve's error body to one sentence. The other options were Serve's
   raw `message`, the same with a generated type, and today's text.

The options check of 2026-11-01 ran over decisions 1 to 3. Its summary is in
`.context/viewer-leftover-layers/options-check.md`. A second check ran over
decisions 3 to 5 after the user's answers; its summary is in
`.context/viewer-leftover-layers/options-check-2.md`.

The investigation also found that the embedded Light and Dark switch ignores
the own views of component parents (`shell/catalogue.ts:100-109`). This
change counts every entry with views, as
`docs/protocol/mokly-variant-navigation.md:99-101` says.

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
   parent's variants directly after the parent. Removed pages and documents
   keep their order, which `plans/follow-ups/removed-page-row-order.md` holds.
8. The renewal `HEAD` request of a removed preview,
   `previews/request.ts:189`, also omits credentials and rejects another
   origin, so that every read-model request follows one rule.
9. Each public export of `packages/viewer/src/index.ts` keeps its name and
   its shape. `docs/guides/start/upgrade.md:123-129` tells hosts to import
   `ColorScheme`, `Viewport`, and `InsertedComponentStylesheet`. When a
   generated type has the same shape, the public name exports that type.

## Milestone 1: Documentation and follow-up items

Depends on: none

Decisions 4 and 5 change two requirements. The rest of the change keeps
the behaviour.

- [x] Add `plans/follow-ups/viewer-checks-from-rust.md` for option F.
- [x] Add the follow-up items of the investigation and the options check:
      `removed-detail-generation-field.md`, `derived-select-option-repeats.md`,
      `comparison-error-text.md`, `removed-preview-detail-fence.md`,
      `viewer-credential-rule.md`, and `comparison-chrome-address.md`, all
      under `plans/follow-ups/`.
- [x] State decision 4 in `docs/protocol/mokly-removed-previews.md`: a
      removed screen's preview uses the removed detail that the route loads
      and fences, which an embedded viewer takes from its host's `detail`
      source. Check `mokly-viewer.md` and `mokly-shell-fences.md` for the same
      rule.
- [x] State decision 5 in the protocol page of the comparison routes: the
      codes of Serve's error body, and the one sentence that the shell shows
      for a failed comparison.
- [x] Confirm that no protocol or architecture doc names a mechanism that
      this change removes, such as the `live-index-2` manifest or the
      appearance asset in the head. Save the search under
      `.context/viewer-leftover-layers/`. The search is in
      `.context/viewer-leftover-layers/m1-doc-search.md`.

## Milestone 2: Fixes from the investigation

Depends on: 1

- [x] Send the preview JSON of `previews/request.ts` through `fetchJson`,
      and apply design call 8. Decision 2. One regression test shows that
      `requestPreview` uses the helper, because
      `packages/viewer/tests/sources.test.ts:103-137` already tests its rules.
- [x] Show a removed screen's preview from the route's fenced detail, and
      drop the preview's own read of that detail. Decision 4. Delete
      `plans/follow-ups/removed-preview-detail-fence.md`.
- [x] Count the own views of component parents for Dark availability in
      `shell/catalogue.ts`. Add a regression test with components that have
      no variants.
- [x] Derive each select option once in `crates/mokly-model/src/controls.rs`,
      with a Rust test. Decision 3. Delete
      `plans/follow-ups/derived-select-option-repeats.md`, and remove the
      repeated options from `plans/follow-ups/viewer-checks-from-rust.md`.
- [x] Map the `code` of Serve's error body to the sentence of decision 5,
      also where the shell has a second sentence for the same failure. Make
      the unit test send the body that Serve sends. Delete
      `plans/follow-ups/comparison-error-text.md`.

## Milestone 3: Read the generated types directly

Depends on: 2

- [x] Build the shell catalogue from `CatalogueReadModel`: lookups by path,
      variants by parent, removed records, tags, and Dark availability.
      Delete `displayEntry`, the `live-index-2` manifest, and the manifest
      input of `createCatalogue`.
- [x] Use the index `tree` for folders, titles, hidden flags, and ancestor
      titles. Delete `analyzeHierarchy` and the folder-record branches of
      `registry/hierarchy.ts`. Keep `filterHierarchy` under design call 3.
- [x] Replace the hand-written types that restate generated ones:
      `registry/types.ts`, `components/manifest_types.ts`,
      `shell/metadata.ts`, `data/axes.ts`, and
      `shell/workspace_usage_data.ts`. Apply design call 9.
- [x] Stop rebuilding the whole catalogue for each accepted batch of
      details, in `shell/data_commit.ts:40,57-65`.
- [ ] Move the tests that build manifest shapes to the generated shapes, with
      every assertion of live behaviour. Examples are
      `tests/helpers/current_manifest.ts` and
      `packages/viewer/tests/moved_catalogue.test.ts`. Remove a test only
      under the removal rule of the `testing` skill, with its proof.
- [x] Update the READMEs that name a removed module.

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

- [x] Give the `@mokly/ui` components props for the state that the viewer
      writes through the DOM today: the inspector height, expanded state, and
      ARIA values, the resizing state of the inspector and the navigation,
      and the expanded browser frame.
- [x] Give the components that the viewer measures element refs: the device
      frame, the flow step, the stage embed, the workspace preview, and the
      marker layer.
- [x] Give the other package elements that the viewer finds by selector a
      prop or a ref, so that Milestone 7 can remove each selector: the
      Appearance select, the tag picker, the Highlight components toggle, the
      inspector tabs, the main region, the scroll regions, the current
      navigation row and the folder summaries, and the host slots. The DOM
      contract for Milestone 7 is in
      `.context/viewer-leftover-layers/m6-dom-contract.md`.
- [x] Keep every visual result. Run the mockup check of `AGENTS.md` and the
      `@mokly/ui` tests. The check is in
      `.context/viewer-leftover-layers/m6-mockup-check.md`.

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

## Post-merge follow-up (non-blocking)

- [ ] Check that the `detail` source of Mokly Cloud answers a removed
      record's path and `snapshotId`. Under decision 4, a removed screen's
      preview in an embedded viewer needs that answer.
