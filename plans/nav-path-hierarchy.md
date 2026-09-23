# Path-Based Navigation Hierarchy

Status: created 2026-09-23 with the user's consent after the design discussion
in this workspace. No milestone is started. This plan supersedes the
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
leaf. Nested `defineRoot` trees derive it from the root title and the ancestor
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
- Nested folders keep an explicit `segment` for routes; titles never move
  routes. The root gains an optional `title`. Without it, direct children are
  top-level, matching today's optional root collection.
- One clean schema break: manifest v6 and catalogue read model v2, removing
  `collections`, `childIds`, `ManifestCollection`, and `CatalogueCollection`
  with no compatibility shim in the current readers. Historical baselines from
  v3 to v5 remain readable at the comparison boundary because every entry
  since v3 already carries a derived `navPath`.
- Empty folders are unsupported. None are authored anywhere today.
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
- Removed-entry `ancestors` (`{ id, title }[]`) becomes `navPath` labels in
  the change DTO and the read model.
- Persisted disclosure keys move from `collection:<section>:<id>` to
  `folder:<section>:<path key>`, where the path key joins labels with `/`.
  Obsolete `collection:` keys are ignored on restore under the existing
  obsolete-key rule, so an old workspace opens with default disclosures once.
- The implementation commit uses `feat!:` with a `BREAKING CHANGE:` footer so
  Release Please records the schema and authoring break.

**Out of scope:** ordering configuration, a nested `component` marker, folder
metadata of any kind, mockups, filesystem-derived paths (see the follow-up
below), and the design-catalogue variant conversion
owned by [Screen Variants Follow-up](./screen-variants-follow-up.md) (which
will edit `navPath` values instead of collection memberships when it lands).

## Milestone 1: Contract documentation

Rewrite every protocol document, guide, and README passage that defines or
describes collections so the documentation is the complete contract for the
milestones that follow. Documentation only: no `cargo xtask check`; validate
the Markdown and review the diff instead.

- [ ] `docs/protocol/mokly-authoring.md`: replace the collection hierarchy
      section and interfaces. Define `navPath` on `EntryInput`, remove
      `CollectionInput` and `RootCollectionInput`, add `NestedFolderInput`
      (`title`, `segment`, `children`, inherited `address`, `dependencies`,
      `relatedDocs`) and the `folder` marker, redefine `RootInput` (`path`,
      optional `title`, `children`, inherited fields), state that nested
      leaves derive `navPath` and reject an authored one, and record the label,
      merge, collision, ordering, and variant-inheritance rules above.
- [ ] `docs/protocol/mokly-pages.md`: rewrite the purpose paragraph and the
      example around `navPath`, drop "a collection can claim a page", update
      the rejected-field list, and say pages with an empty `navPath` are
      top-level.
- [ ] `docs/protocol/mokly-rendering.md` and
      `docs/protocol/mokly-component-manifest.md`: manifest v6 entry shape
      (four kinds, authored `navPath`, no collection variant, no `childIds`),
      sorting text without collections, and the v6 statement.
- [ ] `docs/protocol/mokly-catalogue.md`: read model v2 with no
      `collections`, `CatalogueNode` as `{ kind: "folder"; label; children }`
      or `{ kind: "entry"; id; children? }`, `navPath` on routed entries and
      removed entries, the ordering rule, the versioning paragraph, and the
      `fixtures/catalogue-v2.json` fixture replacing v1.
- [ ] `docs/protocol/mokly-catalogue-changes.md`: `ancestors` becomes
      `navPath` labels; reword "no synthetic collection" as no recreated
      folder.
- [ ] `docs/protocol/mokly-runtime.md`: the validation failure list, the
      "Collections are navigation folders" passage, the changed-projection
      paragraph, breadcrumb derivation, and disclosure keys (`folder:` keys,
      obsolete `collection:` keys ignored).
- [ ] `docs/protocol/mokly-screen-variants.md`: replace every collection rule
      with `navPath` inheritance and the rejected `navPath` field on variants.
- [ ] Smaller passages: `mokly-navigation.md` (a folder is not a destination),
      `mokly-viewer.md` (disclosure key kinds), `mokly-design-components.md`
      (`design-root.childIds` and the nested marker), `mokly-instances.md`,
      `mokly-timings.md`, and `docs/protocol/README.md` (manifest v6 primary,
      historical v3 to v5, read model link text).
- [ ] Guides and READMEs: retitle `docs/guides/authoring/collections-and-tags.md`
      to "Folders and tags" and rewrite its hierarchy section; update the
      nested example in `docs/guides/authoring/screens.md`, the `childIds`
      text in `docs/guides/authoring/pages.md`, the example in
      `docs/guides/start/your-first-screen.md`, the root `README.md` feature
      line, authoring example, and guide table, and the hierarchy paragraphs
      in `examples/basic/README.md`. Check `tests/guides_authoring.test.ts`
      and `tests/guides_structure.test.ts` for title expectations.
- [ ] Run `npx prettier --check` on the changed Markdown, confirm every
      relative link resolves, and read the diff for contradictions with
      `mokly-derived-baselines.md`, `mokly-removed-previews.md`, and
      `mokly-export.md`.
- [ ] Commit `docs(protocol): define path-based navigation` and push.

## Milestone 2: Authoring, registry, manifest v6, and read model v2

Backend and data layer. At completion `defineCollection` and `collection` no
longer exist, leaves carry `navPath`, nested trees derive it, the manifest is
v6, the public read model is v2, historical v3 to v5 baselines still compare,
and Browse renders the same navigation it renders today. Shell modules change
only where the removed collection kind no longer compiles; group keys keep the
`collection:` prefix with the path key inside until Milestone 3 renames them,
so persisted disclosures keep working across this milestone.

- [ ] Authoring: in `src/authoring/types.ts` and `src/authoring/definitions.ts`
      add `navPath` to `EntryInput`, remove `defineCollection`, `collection`,
      `CollectionInput`, `CollectionDefinition`, `NestedCollectionInput`,
      `NestedCollectionMarker`, and `RootCollectionInput`, add `folder`,
      `NestedFolderInput`, and `NestedFolderMarker`, give `RootInput` an
      optional `title`, derive `navPath` during flattening, and reject an
      authored `navPath` on nested screens and pages. Update `src/index.ts`
      exports and the generated consumer API in
      `src/build/consumer_entry.ts`.
- [ ] Variants: in `src/authoring/variants.ts` replace `childIds` with
      `navPath` in the forbidden fields and copy the parent's `navPath` onto
      each flattened variant.
- [ ] Components: make `ComponentInput` in `src/components/types.ts` and its
      validation in `src/components/definition.ts` carry `navPath` like the
      other entry inputs.
- [ ] Registry validation: `src/registry/entry_validation.ts` (label rules as
      `invalid-nav-path`, no collection branch, updated page field list),
      `entry_metadata.ts`, `relationships.ts` and `variant_validation.ts`
      (variant `navPath` must equal the parent's, replacing
      `variant-claimed`), `manifest_relationships.ts`, `manifest_entries.ts`,
      `manifest_validation.ts`, `entry_order.ts`, and `prepare.ts`.
- [ ] Hierarchy: rewrite `packages/viewer/src/registry/hierarchy.ts` to build
      one folder tree per section from `navPath`, exposing folder nodes
      (`key`, `label`, `path`, child folders, entries), `ancestorsById` as
      labels, `byId`, `variantsById`, and `variantParentById`, with
      `invalid-nav-path` and `nav-path-conflict` issues. Delete the cycle,
      duplicate-child, missing-child, and multiple-parents code; cycles are
      impossible by construction.
- [ ] Manifest v6: `packages/viewer/src/registry/types.ts` (`ManifestV6`,
      unions, `HistoricalManifest`), `src/registry/manifest.ts` (emit authored
      `navPath`, no derivation), `manifest_validation.ts` (primary requires
      v6, historical accepts v2 to v6, historical collection entries dropped),
      `src/baseline/manifest.ts`, `src/catalogue/views.ts`,
      `src/components/manifest_validation.ts`, `src/registry/changes.ts`, and
      `src/registry/changed_routes.ts` (`navPath` replaces
      `ancestorCollections` in the change projection).
- [ ] Remaining consumers: `src/build/logical_routes.ts`, `compile.ts`,
      `mock_links.ts` (drop the collection-link error), `source_freshness.ts`,
      `src/export/site.ts`, `src/server/view_routes.ts`,
      `src/catalogue/changes.ts`, `src/review/component_metadata.ts`, and
      `src/review/component_classification.ts`.
- [ ] Read model v2: `packages/viewer/src/catalogue/types.ts`,
      `entry_reader.ts` (no `readCollection`, `navPath` on entries),
      `reader.ts`, `references.ts` (folder validation replaces the collection
      forest checks), `tree.ts` (folder nodes), and
      `src/catalogue/projection.ts` (`schemaVersion: 2`, no `collections`,
      `navPath` on routed and removed entries). Replace
      `docs/protocol/fixtures/catalogue-v1.json` with `catalogue-v2.json` and
      update any package file list that names it.
- [ ] Shell compile-only updates with no behavior change: remove the
      impossible collection guards in `packages/viewer/src/shell/*` and
      `packages/viewer/src/standalone/*`, build group nodes from folder nodes
      in `nav_tree.ts` with `collection:<path key>` keys, and keep crumbs,
      details rows, target resolution, Changes activation, and previews
      working from labels.
- [ ] Migrate the catalogues that must build for the checks to pass:
      `examples/basic/entries/catalogue.mockup.tsx`,
      `examples/basic/entries/design/design.mockup.tsx`,
      `examples/basic/entries/design/library/library.mockup.ts`, the consumer
      fixtures under `tests/fixtures/consumers/*`, `tests/fixtures/large/*`,
      every helper under `tests/helpers/*` that defines collections, and
      `tests/browser/css_evidence_fixture.ts` and `navigation_fixture.ts`,
      keeping screen ids and routes unchanged.
- [ ] Failure-first tests: rewrite `tests/hierarchy.test.ts` (folders per
      section, byte-identical merge across modules, case and whitespace
      conflicts, folder-versus-leaf conflict, slash and empty labels, variant
      inheritance, deterministic order) and `tests/nav_tree.test.ts` (path
      keys, identical labels merge, reparenting through `navPath`, top-level
      entries gain no invented group); extend `tests/authoring.test.tsx` and
      `tests/authoring_variants.test.tsx` (folder marker, root title, derived
      `navPath`, nested leaf and variant rejecting `navPath`);
      `tests/manifest_files.test.ts` and `tests/manifest_variants.test.ts`
      (v6 round trip, v5 rejected as primary, historical v5 with collections
      accepted and collections dropped); `tests/catalogue_projection.test.ts`,
      `tests/viewer_catalogue_variants.test.ts`, and the reader conformance
      test for the v2 fixture; `tests/server_changed_hierarchy.test.ts`
      (`navPath` change marks the entry changed; v5 baseline against v6
      current); `tests/build_navigation_links.test.ts` (no collection target).
- [ ] Update the remaining affected tests listed by
      `grep -rl "childIds\|defineCollection\|navPath" tests packages/viewer/tests`
      so every suite passes, including `catalogue_history`,
      `variant_validation`, `pages`, `page_model`, `export_*`, `package`,
      `design_library_inventory`, `nav_sections`, `shell`,
      `server_navigation`, `compatibility_navigation`, `changes_activation`,
      and the removed-preview suites (`ancestors` to `navPath`).
- [ ] `npm run build`, `npm test`, `npm run example:build`, and
      `npm run example:check` pass.
- [ ] Commit `feat!: replace collections with navigation paths` with a
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
- When [Screen Variants Follow-up](./screen-variants-follow-up.md) converts the
  design catalogue, its collection-membership edits become `navPath` edits.
- Add an ordering configuration only if a real catalogue needs non-alphabetical
  folders.
- Filesystem-derived `navPath` (Storybook's implicit mode) was considered on
  2026-09-23 and deliberately left out. If real usage asks for it, plan it
  separately with three rules settled up front: how directory names become
  labels, a per-glob prefix for multiple entry roots, and precedence with
  authored and tree-derived values. It is additive and needs no schema break.
