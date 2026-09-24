# Path-Based Navigation Hierarchy

Status: Milestones 1 and 2 are complete and committed. Milestones 3–4 have
not started. Created 2026-09-23 with the user's
consent after the design discussion in this workspace. This plan supersedes the
collection-forest contract delivered by
[Hierarchy-Inferred Breadcrumbs](./hierarchy-inferred-breadcrumbs.md); that
plan stays in Completed as history.

**Goal:** Replace authored collection entities and their `childIds` edges with
a Storybook-style navigation path on every leaf. A folder exists because a leaf
names it. It has no id, description, dependencies, related docs, route, or
entry status. Today a collection is a group row nobody can open: the shell
never renders its description, rationale, or related docs, Changes skips it,
and the shell already re-sorts every level alphabetically, so the authored
`childIds` order is invisible. Authors currently edit two files to place one
screen, and a forgotten collection edit silently leaves the screen at the root.

**Architecture:** Every routed entry (screen, page, use case, component)
carries `navPath: readonly string[]`, the ordered folder labels from the top of
its section down to its parent folder. Flat authoring writes `navPath` on the
leaf. Nested `defineRoot` trees derive it from the root `navPath` and the ancestor
`folder` titles, so nested leaves never write it and there is exactly one
source per authoring style. The manifest stores `navPath` as authored data
(schema v6). The hierarchy analysis builds one folder tree per section from
shared prefixes. Navigation, breadcrumbs, disclosure keys, the public tree
(read model v2), changed-entry projection, and review metadata all consume that
tree. `variantOf` is unchanged: a variant inherits its parent's `navPath` and
cannot declare its own.

**Decisions locked by the design discussion (raise before implementing if the
user should reconsider):**

- Field name `navPath`, type `readonly string[]`, optional on input and
  defaulting to `[]` (top-level). `path` is already `defineRoot`'s route
  directory, and an array avoids escaping separators inside labels.
- Ordering: folders first, then leaves, each alphabetical by label with
  `localeCompare`, ties broken by key or id. This is what the shell does
  today. The public tree adopts the same order. No `storySort`-style
  configuration.
- Merging and collisions: byte-identical labels under the same parent merge
  into one folder, across files and modules. Labels under one parent that
  differ only by Unicode case folding or by whitespace are a build error. A
  folder and a leaf with the same label under one parent are a build error
  whose message suggests moving the leaf inside the folder. Labels are
  non-empty, carry no leading or trailing whitespace, and never contain `/`,
  which is the reserved key separator.
- Nested folders keep a required, non-empty `segment` for routes; titles never
  move routes. Refined during Milestone 2 (supervisor): the root takes
  `navPath?: readonly string[]` instead of `title?: string`, because the example
  design tree needs a two-label prefix (Design → Mokly design) with unchanged
  routes; one label is `navPath: ["X"]`. Without it, direct children are
  top-level.
- One clean schema break: manifest v6 and catalogue read model v2, removing
  `collections`, `childIds`, `ManifestCollection`, and `CatalogueCollection`
  with no compatibility shim in the current readers. Historical baselines from
  v3 to v5 remain readable at the comparison boundary because every entry
  since v3 already carries a derived `navPath`.
- Empty folders are unsupported. #115 retained one intentionally empty v5
  collection, `design-browse-tags` (Tag states); its folder row disappears
  after migration because none of its former screens remains a folder member.
- No mockup milestone. Folder rows render exactly as collection rows do now,
  and no inspector surface changes.
- The guide slug `authoring/collections-and-tags` is kept because it is a
  published cloud route; only its title and content change.

**Compatibility notes:**

- `parseHistoricalManifest` keeps accepting v2 (opt-in), v3, both v4
  envelopes, v5, and v6. When a baseline is v3 to v5, its `collection`
  entries are dropped before hierarchy analysis: they are never routed
  targets, breadcrumb sources, or removed-entry candidates. The baseline's
  routed entries use their stored `navPath` as-is, so a v5 baseline compares
  against a v6 current catalogue without special cases.
- Removed entries retain the baseline entry's own `navPath` labels in the
  change DTO and read model; there is no separate `ancestors` field.
- Persisted disclosure keys move from `collection:<section>:<id>` to
  `folder:<section>:<path key>`, where the path key joins labels with `/`.
  Obsolete `collection:` keys are ignored on restore under the existing
  obsolete-key rule, so an old workspace opens with default disclosures once.
- The implementation commit uses `feat!:` with a `BREAKING CHANGE:` footer so
  Release Please records the schema and authoring break.

**Out of scope:** ordering configuration, a nested `component` marker, folder
metadata of any kind, mockups, and filesystem-derived paths (see the follow-up
below). [Screen Variants Follow-up](./screen-variants-follow-up.md) delivered
the design-catalogue variant conversion in #115 before this milestone.

## Milestone 1: Contract documentation

Rewrite every protocol document, guide, and README passage that defines or
describes collections so the documentation is the complete contract for the
milestones that follow. Documentation only: no `cargo xtask check`; validate
the Markdown and review the diff instead.

- [x] `docs/protocol/mokly-authoring.md`: replace the collection hierarchy
      section and interfaces. Define `navPath` on `EntryInput`, remove
      `CollectionInput` and `RootCollectionInput`, add `NestedFolderInput`
      (`title`, `segment`, `children`, inherited `address`, `dependencies`,
      `relatedDocs`) and the `folder` marker, redefine `RootInput` (`path`,
      optional `title`, `children`, inherited fields), state that nested
      leaves derive `navPath` and reject an authored one, and record the label,
      merge, collision, ordering, and variant-inheritance rules above.
- [x] `docs/protocol/mokly-pages.md`: rewrite the purpose paragraph and the
      example around `navPath`, drop "a collection can claim a page", update
      the rejected-field list, and say pages with an empty `navPath` are
      top-level.
- [x] `docs/protocol/mokly-rendering.md` and
      `docs/protocol/mokly-component-manifest.md`: manifest v6 entry shape
      (four kinds, authored `navPath`, no collection variant, no `childIds`),
      sorting text without collections, and the v6 statement.
- [x] `docs/protocol/mokly-catalogue.md`: read model v2 with no
      `collections`, `CatalogueNode` as `{ kind: "folder"; label; children }`
      or `{ kind: "entry"; id; children? }`, `navPath` on routed entries and
      removed entries, the ordering rule, the versioning paragraph, and the
      `fixtures/catalogue-v2.json` fixture replacing v1.
- [x] `docs/protocol/mokly-catalogue-changes.md`: remove the separate
      `ancestors` field; the baseline entry retains its own `navPath` labels.
      Reword "no synthetic collection" as no recreated folder.
- [x] `docs/protocol/mokly-runtime.md`: the validation failure list, the
      "Collections are navigation folders" passage, the changed-projection
      paragraph, breadcrumb derivation, and disclosure keys (`folder:` keys,
      obsolete `collection:` keys ignored).
- [x] `docs/protocol/mokly-screen-variants.md`: replace every collection rule
      with `navPath` inheritance and the rejected `navPath` field on variants.
- [x] Smaller passages: `mokly-navigation.md` (a folder is not a destination),
      `mokly-viewer.md` (disclosure key kinds), `mokly-design-components.md`
      (`design-root.childIds` and the nested marker), `mokly-instances.md`,
      `mokly-timings.md`, and `docs/protocol/README.md` (manifest v6 primary,
      historical v3 to v5, read model link text).
- [x] Guides and READMEs: retitle `docs/guides/authoring/collections-and-tags.md`
      to "Folders and tags" and rewrite its hierarchy section; update the
      nested example in `docs/guides/authoring/screens.md`, the `childIds`
      text in `docs/guides/authoring/pages.md`, the example in
      `docs/guides/start/your-first-screen.md`, the root `README.md` feature
      line, authoring example, and guide table, and the hierarchy paragraphs
      in `examples/basic/README.md`. Check `tests/guides_authoring.test.ts`
      and `tests/guides_structure.test.ts` for title expectations.
- [x] Add the sorted, two-space, LF-terminated
      `docs/protocol/fixtures/catalogue-v2.json` fixture as the v2 translation
      of v1 without removing v1 yet; link it from the read model and previews.
- [x] Sweep non-historical docs and READMEs beyond the initial file list for
      stale collection/childIds assumptions, plus current version references.
- [x] Run `npx prettier --check` on changed Markdown and canonical JSON, a
      relative-link check on every changed Markdown, and confirm every
      relative link resolves, and read the diff for contradictions with
      `mokly-derived-baselines.md`, `mokly-removed-previews.md`, and
      `mokly-export.md`.
- [x] Run `npx tsx --test tests/guides_*.test.ts` without changing tests:
      19/20 pass. The unchanged public-export test reads the v5 `src/index.ts`
      and still expects the removed helper `collection` to be documented.
      Milestone 2 removes that export and reruns the suite to a full pass.
- [x] Commit `docs(protocol): define path-based navigation` and push.

## Milestone 2: Authoring, registry, manifest v6, and read model v2

Backend and data layer. At completion `defineCollection` and `collection` no
longer exist, leaves carry `navPath`, nested trees derive it, the manifest is
v6, the public read model is v2, historical v3 to v5 baselines still compare,
and Browse renders the same navigation it renders today. Shell modules change
only where the removed collection kind no longer compiles; group keys keep the
`collection:` prefix with the path key inside until Milestone 3 renames them,
so persisted disclosures keep working across this milestone.

- [x] Align the #115 documentation additions with `navPath`; document the deliberate
      disappearance of the empty `design-browse-tags` folder and that the
      Screen Variants Follow-up conversion has landed.
- [x] Authoring: in `src/authoring/types.ts` and `src/authoring/definitions.ts`
      add `navPath` to `EntryInput`, remove `defineCollection`, `collection`,
      `CollectionInput`, `CollectionDefinition`, `NestedCollectionInput`,
      `NestedCollectionMarker`, and `RootCollectionInput`, add `folder`,
      `NestedFolderInput`, and `NestedFolderMarker`, give `RootInput` an
      optional `navPath`, derive `navPath` during flattening, and reject an
      authored `navPath` on nested screens and pages. Update `src/index.ts`
      exports and the generated consumer API in
      `src/build/consumer_entry.ts`.
- [x] Reject a `defineRoot` with a non-empty `navPath` and no children at authoring time (there
      is no entry on which to report a path-label issue), while an empty-path
      empty root emits no definitions. Cover the exact error alongside empty
      nested folders and nested authored-path violations.
- [x] Variants: in `src/authoring/variants.ts` replace `childIds` with
      `navPath` in the forbidden fields and copy the parent's `navPath` onto
      each flattened variant.
- [x] Components: make `ComponentInput` in `src/components/types.ts` and its
      validation in `src/components/definition.ts` carry `navPath` like the
      other entry inputs.
- [x] Registry validation: `src/registry/entry_validation.ts` (nested authored-path
      rule, no collection branch, updated page field list),
      `entry_metadata.ts`, `relationships.ts` and `variant_validation.ts`
      (variant `navPath` must equal the parent's, replacing
      `variant-claimed`), `manifest_relationships.ts`, `manifest_entries.ts`,
      `manifest_validation.ts`, `entry_order.ts`, and `prepare.ts`.
- [x] Hierarchy: rewrite `packages/viewer/src/registry/hierarchy.ts` to build
      one folder tree per section from `navPath`, exposing folder nodes
      (`key`, `label`, `path`, child folders, entries), `ancestorsById` as
      labels, `byId`, `variantsById`, and `variantParentById`, with
      `invalid-nav-path` and `nav-path-conflict` issues. Delete the cycle,
      duplicate-child, missing-child, and multiple-parents code; cycles are
      impossible by construction.
- [x] Review fixes: keep flat removed rows after current hierarchy in route/id
      order; centralize label diagnostics in hierarchy analysis and attach
      folder/leaf conflicts to the leaf independent of input order. Cover
      regressions and restore the previous nav-tree leaf/variant/tag assertions.
- [x] Review fixes: reject explicit null/non-array `navPath` on every routed
      authoring helper, including a screen with variants, without a raw TypeError
      or duplicate validation issue; keep `defineRoot` authoring failures typed
      through the source-attributed consumer facade.
- [x] Bundle-boundary regressions: reject forbidden variant-authored `route`,
      `variants`, and `navPath` (including explicit `undefined`) in real builds;
      share CLI-read markers through registry symbols and guard the authoring
      facade against private symbols.
- [x] Preserve typed, source-attributed authoring errors across bundled runtime
      copies without duplicated prefixes; keep ordinary evaluation errors
      wrapped as bundling failures.
- [x] Attribute folder-spelling conflicts once per spelling and source module
      to its lowest-id entry, independent of discovery order, and name every
      spelling and the readable section/parent. Cover reversed orders and
      multi-entry modules in tests; align the protocol and build README.
- [x] Verify the bundle-boundary and conflict fixes with build, typecheck,
      lint, format, the full unit suite, example build/check, parity script,
      and the relevant browser specs before supervisor review.
- [x] Review fixes: remove production-dead cross-section `buildNavTree` and
      migrate its remaining tests to independent `buildNavSections`; author
      example component paths through `libraryMetadata`/`defineComponent`
      rather than re-spreading registered entries; reset browser disclosure
      state to a known starting route before asserting it.
- [x] Repair browser assertions discovered by the full verification gate:
      catalogue fetch expects v2, saved component fragments expect v6, the
      light-only fixture targets the current authored source, and the watch
      disclosure reset runs after navigation's unload persistence.
- [x] Manifest v6: `packages/viewer/src/registry/types.ts` (`ManifestV6`,
      unions, `HistoricalManifest`), `src/registry/manifest.ts` (emit authored
      `navPath`, no derivation), `manifest_validation.ts` (primary requires
      v6, historical accepts v2 to v6, historical collection entries dropped),
      `src/baseline/manifest.ts`, `src/catalogue/views.ts`,
      `src/components/manifest_validation.ts`, `src/registry/changes.ts`, and
      `src/registry/changed_routes.ts` (`navPath` replaces
      `ancestorCollections` in the change projection).
- [x] Remaining consumers: `src/build/logical_routes.ts`, `compile.ts`,
      `mock_links.ts` (drop the collection-link error), `source_freshness.ts`,
      `src/export/site.ts`, `src/server/view_routes.ts`,
      `src/catalogue/changes.ts`, `src/review/component_metadata.ts`, and
      `src/review/component_classification.ts`.
- [x] Read model v2: `packages/viewer/src/catalogue/types.ts`,
      `entry_reader.ts` (no `readCollection`, `navPath` on entries),
      `reader.ts`, `references.ts` (folder validation replaces the collection
      forest checks), `tree.ts` (folder nodes), and
      `src/catalogue/projection.ts` (`schemaVersion: 2`, no `collections`,
      `navPath` on routed and removed entries). Replace
      `docs/protocol/fixtures/catalogue-v1.json` with `catalogue-v2.json` and
      update any package file list that names it.
- [x] Repoint every v1 fixture reference (including `tests/`,
      `packages/viewer/tests/`, `scripts/package/archive.mjs`,
      `tests/helpers/release_fixture.ts`, `tests/helpers/bootstrap_fixture.ts`,
      and `src/catalogue/README.md`) to the v2 fixture; delete v1 only after
      all readers and fixtures have migrated. Re-run the guide export-coverage
      test after removing old public collection exports; this test cannot pass
      against the new guide while Milestone 1 leaves `src/index.ts` unchanged.
- [x] Remove the Milestone 1 transitional target-contract notes once the
      implementation lands: both the note above the authoring example and
      “The target output requires manifest v6” in `README.md`, the target
      contract note in `docs/protocol/README.md`, and “follows in Milestone 2”
      in `examples/basic/README.md`.
- [x] Align the design mock's navigation row kinds with the folder contract,
      without visual changes: rename `collection` to `folder` in the prop schema
      enum, view, section helper, and saved variants under
      `examples/basic/entries/design/library/chrome/catalogue-navigation*.ts(x)`,
      `examples/basic/entries/design/components/parts/navigation.tsx`, and
      other design mock data. Update descriptions and comments that still call
      folders “collections,” including `page_screens.tsx` and
      `parts/removed_page.tsx`, to match `mokly-shell-design.md`.
- [x] Extend `docs/protocol/fixtures/catalogue-v2.json` so the v2 reader and
      byte-equality round-trip exercise nested folders, a top-level entry
      with `navPath: []`, and a screen with a variant nested in its entry-node
      `children` and carrying its parent's `navPath`. Keep removed-entry
      previews and canonical sorted-key/two-space/LF formatting.
- [x] Transfer the canonical-fixture Prettier exception from the deleted v1
      JSON fixture to v2; match `serializeCatalogue` byte-for-byte rather than
      compressing nonempty arrays into Prettier's preferred JSON layout.
- [x] Verify the change DTO and public `removedEntries` retain each baseline
      entry's own `navPath` labels without a separate `ancestors` field;
      cover removed screens, pages, components, and variants in tests.
- [x] Shell compile-only updates with no behavior change: remove the
      impossible collection guards in `packages/viewer/src/shell/*` and
      `packages/viewer/src/standalone/*`, build group nodes from folder nodes
      in `nav_tree.ts` with `collection:<path key>` keys, and keep crumbs,
      details rows, target resolution, Changes activation, and previews
      working from labels.
- [x] Migrate the catalogues that must build for the checks to pass:
      `examples/basic/entries/catalogue.mockup.tsx`,
      `examples/basic/entries/design/design.mockup.tsx`,
      `examples/basic/entries/design/library/library.mockup.ts`, the consumer
      fixtures under `tests/fixtures/consumers/*`, `tests/fixtures/large/*`,
      every helper under `tests/helpers/*` that defines collections, and
      `tests/browser/css_evidence_fixture.ts` and `navigation_fixture.ts`,
      keeping screen ids and routes unchanged.
- [x] Compare the v6 example against the saved v5 manifest: all 115 routed
      entries keep id, kind, route, variantOf, and navPath; section-scoped
      non-empty folder paths match and only `design-browse-tags` disappears.
- [x] Failure-first tests: rewrite `tests/hierarchy.test.ts` (folders per
      section, byte-identical merge across modules, case and whitespace
      conflicts, folder-versus-leaf conflict, slash and empty labels, variant
      inheritance, deterministic order) and `tests/nav_tree.test.ts` (path
      keys, identical labels merge, reparenting through `navPath`, top-level
      entries gain no invented group); extend `tests/authoring.test.tsx` and
      `tests/authoring_variants.test.tsx` (folder marker, root path, derived
      `navPath`, nested leaf and variant rejecting `navPath`);
      `tests/manifest_files.test.ts` and `tests/manifest_variants.test.ts`
      (v6 round trip, v5 rejected as primary, historical v5 with collections
      accepted and collections dropped); `tests/catalogue_projection.test.ts`,
      `tests/viewer_catalogue_variants.test.ts`, and the reader conformance
      test for the v2 fixture; `tests/server_changed_hierarchy.test.ts`
      (`navPath` change marks the entry changed; v5 baseline against v6
      current); `tests/build_navigation_links.test.ts` (no collection target).
- [x] Update the remaining affected tests listed by
      `grep -rl "childIds\|defineCollection\|navPath" tests packages/viewer/tests`
      so every suite passes, including `catalogue_history`,
      `variant_validation`, `pages`, `page_model`, `export_*`, `package`,
      `design_library_inventory`, `nav_sections`, `shell`,
      `server_navigation`, `compatibility_navigation`, `changes_activation`,
      and the removed-preview suites (`ancestors` to `navPath`).
- [x] Migrate browser selectors and recovery fixtures to the transitional
      `collection:<path key>` identity without renaming persisted disclosure
      fields before Milestone 3; run navigation-related browser coverage.
- [x] Update packed-consumer smoke expectations: the ESM public export list
      includes `folder` in sorted order, its catalogue reader requires v2,
      and component/themed example manifests require v6.
- [x] `npm run build`, `npm test`, `npm run example:build`, and
      `npm run example:check` pass.
- [x] After the review fixes, complete a fresh `cargo xtask check` (all suites)
      without editing during the gate, then report the result for supervisor review.
- [x] Commit `feat!: replace collections with navigation paths` with a
      `BREAKING CHANGE:` footer and push.

## Milestone 3: Viewer shell folders

Tags: ui

Rename the shell's navigation identity from collection ids to folder path keys,
migrate persisted disclosure state, and update the browser coverage. No visual
change: rows, icons, crumbs, and the details inspector look the same.

- [ ] `packages/viewer/src/shell/nav_tree.ts` emits `folder:<path key>` group
      keys; `nav_model.ts` derives `folder:<section>:<path key>` disclosure
      keys; `nav_rows.tsx` renders `data-nav-folder`; update the module and
      icon comments in `nav_tree.ts`, `nav_rows.tsx`, `icons.tsx`, and
      `head.tsx`.
- [ ] Persistence: rename `closedCollectionIds` and
      `filterBaselineClosedCollectionIds` to `closedFolderKeys` and
      `filterBaselineClosedFolderKeys` across `store_state.ts`,
      `store_actions.ts`, `store_initial.ts`, `standalone/recovery.ts`, and
      `standalone/early_disclosures.ts`; accept only `section:`, `folder:`,
      and `variants:` keys and ignore obsolete `collection:` keys on restore.
- [ ] Confirm `docs/protocol/mokly-runtime.md` and
      `docs/protocol/mokly-viewer.md` already describe these keys exactly as
      implemented; correct the docs if Milestone 1 left a gap.
- [ ] Browser coverage: update `tests/browser/browse.spec.ts`,
      `browse_navigation.spec.ts`, `changes_continuity.spec.ts`, and
      `watch.spec.ts` (reparent by editing a `navPath`, wait for reload,
      verify navigation and crumbs move together while unrelated disclosures
      survive) plus any `packages/viewer/tests/shell_state*.test.ts` that
      names disclosure keys.
- [ ] Smoke test through `npm run dev`: a deeply nested screen, a variant, a
      use case, a page, and a top-level entry at desktop and mobile widths;
      Collapse all; reload persistence of open folders; the Changes filter;
      search inside a folder.
- [ ] Commit `refactor(viewer): key navigation folders by path` and push.

## Milestone 4: Verification, close-out, and review

- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Re-read every document touched in Milestone 1 against the shipped
      behavior and correct drift; confirm `plans/README.md` describes this
      plan's state.
- [ ] Run `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`; the only deletion
      is `docs/protocol/fixtures/catalogue-v1.json`, replaced by the v2
      fixture, and it is recorded in the commit and PR description.
- [ ] Commit and push.
- [ ] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Post-merge follow-up (non-blocking)

- Smoke the published package from a consumer that authors `navPath` in flat
  files and derives it in a nested tree.
- Add an ordering configuration only if a real catalogue needs non-alphabetical
  folders.
- Filesystem-derived `navPath` (Storybook's implicit mode) was considered on
  2026-09-23 and deliberately left out. If real usage asks for it, plan it
  separately with three rules settled up front: how directory names become
  labels, a per-glob prefix for multiple entry roots, and precedence with
  authored and tree-derived values. It is additive and needs no schema break.
