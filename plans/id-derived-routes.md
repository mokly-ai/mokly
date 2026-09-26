# Id-Derived Routes, Unified Variants, And Identity-Keyed Wire

Status: Planned; not started. Created 2026-09-26 with the user's consent after
discussing route redundancy on the navigation-path branch; the variant
unification and the wire cleanup were folded in the same day. The work is
implemented on this branch, `calummoore/halifax-v2`, and the user opens a
pull request when it is ready. Mokly is not live, so this plan adds no
backwards compatibility: readers it rewrites accept only the new versions,
and there are no migration guards or transitional shapes.

**Problem:** every routed entry carries two hierarchies. `navPath` is the list
of folder labels; `route` is an author-chosen `.html` path built from a root
`path`, folder `segment`s, and leaf or variant `slug`s. Only the id is a
reference; the route is a second identity that can move while the id stays.
That second identity owns a long tail of rules and duplicates: three
`invalid-route` rules, `duplicate-route`, variant route derivation and
matching, `duplicate-variant-slug`, the forbidden variant `route` field,
folder `segment` and root `path` errors, route-keyed removed-entry identity
with the "reused id at a distinct route" precedence rule, the
`id/<id>/index.html` export alias that writes every shell page twice,
`idRoutes` in the static delivery metadata, the `/id/` redirect and history
normalization, and paired helpers (`validateRoute` twice, `screenVariantRoute`
with `isScreenVariantRoute` and `isScreenVariantSlug`, `fragmentRoute` beside
`componentFragmentRoute`, `validateCatalogueRoute` beside
`isSafeCatalogueRoute`).

Variants are modelled twice as well. A screen variant is a routed entry with a
global id and `variantOf`; a component variant is a local prop preset inside
its component, selected by a `?variant=` query, stored in a `variants` array,
rendered beneath `components/<id>.variants/`, and given its own removal rules
("removed variants can remain on a surviving component"), its own query
parsing (`variantValues` with invalid, empty, and duplicate values), and its
own fragment helper.

The wire formats repeat the same redundancy. The private manifest, the public
read model, review results, changed-route sets, and the viewer's indexes all
carry `route`, `fragments`, `darkFragments`, and view paths that are functions
of kind, id, viewport, and color scheme, and about 119 viewer files compare
entries by route instead of by id.

**Decision (agreed with the user):** identity is kind plus id, and nothing
derivable from kind, id, viewport, color scheme, and configuration travels on
the wire or is stored in an index. Every variant of either kind is a routed
entry with a global id and `variantOf`. Authors never write `route`, `slug`,
`segment`, or `path`; `navPath` is the only hierarchy input, and nothing but
the id moves a route. Ids stay flat kebab-case. Hierarchy does not move into
ids because ids are references (`screenId`, `variantOf`, `useCaseIds`,
`mock:<id>`): a folder move must stay one changed entry, not a removal plus an
addition, and folder labels must stay free text rather than slugs.

| Kind      | Document               | Generated views                          |
| --------- | ---------------------- | ---------------------------------------- |
| Screen    | `screens/<id>.html`    | `screens/<id>.<viewport>[.dark].html`    |
| Page      | `pages/<id>.html`      | The document is the page                 |
| Use case  | `user-flows/<id>.html` | None; the document is logical            |
| Component | `components/<id>.html` | `components/<id>.<viewport>[.dark].html` |

A variant of either kind is an entry of its parent's kind, so the table covers
it. Ids contain no `.`, so `<id>.<suffix>.html` never collides with another
id's document. The `.variants/` directory scheme disappears for both kinds.
The four prefixes are reserved output directories under `mockupsDir` and enter
the existing collision inventory. The shell URL is `/view/<document>` and the
canonical share URL is therefore `/view/<kind prefix>/<id>.html`.

**Further decisions:**

- One shared path module exported from `@mokly/viewer/data` owns
  `documentPath(kind, id)`, `viewPath(kind, id, viewport, scheme)`,
  `viewHref(kind, id)`, and the URL parser for `/view/<document>`. The builder,
  server, export, review, and shell all call it; `fragmentRoute`,
  `componentFragmentRoute`, `catalogueViewHref`, `routeHref`,
  `artifactRouteForEntry`, `logicalArtifactRoutes`, `snapshotPath(side,
route)`, and the four "routed entry" type aliases are deleted or rewritten
  on top of it.
- Wire formats carry identity only. Manifest v7 entries have no `route`,
  `fragments`, `darkFragments`, or view paths; read model v3 entries have no
  `route` or `views` paths; review result v4 addresses entries and views by id
  and view axes and never stores artifact URLs; the server and export hand the
  shell changed ids, not changed routes. Static delivery v3 keeps
  `canonicalPath` because it names the exported page's own file, not an entry.
- Version numbers are bumped once (manifest 7, read model 3, review result 4,
  delivery 3, snapshot identity v2). Shapes evolve across milestones and are
  published only when the plan lands, so intermediate shapes need no versions.
- A component parent entry owns the prop schema, slots, controls, and color
  schemes and has no views of its own; its page shows its first variant in
  authored order, as it does today. A component variant entry carries `props`,
  the supplied slots, and `variantOf`, copies the parent `navPath`, and is a
  nav child, a search result, a Changes row, and a `mock:` link target exactly
  like a screen variant. Selecting a variant is navigation to a sibling entry;
  the `?variant=` query and `variantValues` are deleted.
- The strict readers accept only the new versions. The historical manifest
  boundary keeps accepting v6 without new work because derived baselines
  rebuild the merge-base commit with that commit's own Mokly version, so the
  upgrade PR's baseline arrives as v6 with authored routes. That reader
  normalizes every historical entry into an internal shape whose artifact
  paths are read from v6 fields or computed for v7, so authored routes never
  leave the historical boundary. Removing the v3–v5 and legacy-page readers is
  a separate cleanup.
- Removed entries key by id: a baseline entry is removed when no current
  entry has its id, for every kind, including variants. A removed record has
  no route; its URL and artifact names derive from kind and id, its baseline
  bytes are located inside the historical boundary, and `snapshotId` hashes
  `["mokly-historical-snapshot-v2", catalogueIdentity, sourceKind,
sourceIdentity, entryKind, entryId]`. The "a current entry excludes
  historical content with its id unless a snapshot is requested" rule stays,
  and the "reused id at a distinct route" case can no longer occur. A removed
  variant whose parent survives is an ordinary removed entry with
  `variantOf`.
- Entry arrays sort by kind name in UTF-16 order (`component`, `page`,
  `screen`, `use-case`) and then id, which is the order derived documents
  already have; variants of one parent still follow it in authored order.
- Every resolver that turns an id into a URL has the catalogue read model
  (the shell, the builder, the server), so frame-link activation resolves ids
  through `byId`. Unknown ids stay unavailable. The `id/<id>/index.html`
  alias, `idRoutes`, the development `/id/` redirect, the preview
  `_redirects`, and `resolveDeliveryHref` are removed; the delivery parser
  and writer change in the same milestone.
- Milestone 1 also audits the manifest and read model for other fields that
  are derivable from identity and configuration, decides each, and records
  the decision in the docs. Known candidates: `viewports` (always mobile and
  desktop for screens) and `dependencies` (the union of `sourcePath` and
  `declaredDependencies`). The default is to drop a derivable field.
- No runtime migration guard: the TypeScript input types are the contract, and
  an unknown key is ignored at runtime as it is today. `defineComponent` keeps
  rejecting unknown variant fields.
- Windows device names such as `con`, `nul`, `prn`, `aux`, `com1`, and `lpt1`
  are valid kebab-case ids, so `invalid-id` now rejects them; the shared tag
  and link grammar is unchanged.
- One-time churn is accepted: the first Changes comparison after upgrading
  lists every entry once because every document moved, and a committed-output
  catalogue's pending-orphan cleanup removes the old files.
- Backend milestones may change `packages/viewer` registry, catalogue,
  review, navigation, and other data-layer modules and make mechanical shell
  edits with no behavior change, following the navigation-path and
  screen-variant plans; shell behavior changes live in `ui` milestones.
- No mockup milestone: this repository has no `docs/mockups`, and the shell
  reuses the existing screen-variant rows, breadcrumbs, and details for
  component variants. Dropping the details Route row and route search are
  the only visible changes and are listed in a `ui` milestone.

## Milestone 1: Documentation and protocol contract

Rewrite the protocol docs and guides so they define derived documents, the
removed authoring fields, unified variants, identity-only wire formats,
id-keyed removal, the new schema versions, and the URL surface before any
code changes.

- [ ] [`mokly-nav-paths.md`](../docs/protocol/mokly-nav-paths.md): remove
      root `path`, folder `segment`, and leaf `slug` route derivation; state
      that nothing but the id moves a document; variants of both kinds copy
      the parent path; keep label, conflict, order, and key rules unchanged.
- [ ] [`mokly-authoring.md`](../docs/protocol/mokly-authoring.md): drop
      `RoutedEntryInput` and every `route`, `slug`, `segment`, and `path`
      field from the interfaces; add the document table, the reserved
      prefixes, and the shared path helpers; add the device-name id rule;
      define the new `defineRoot` errors exactly:
      `root navPath must be an array`, `root <labels> has no children`, and
      `folder <labels> has no children`, where `<labels>` joins the root
      `navPath` plus ancestor and current folder titles with `›` using
      `String(title)`; remove the authored-route grammar sentences while
      keeping the static asset segment rule.
- [ ] Generalize [`mokly-screen-variants.md`](../docs/protocol/mokly-screen-variants.md)
      into the variant contract for screens and components, renamed to
      `mokly-variants.md` with every link updated: global ids, `variantOf`,
      copied `navPath`, derived documents, inheritance per kind, forbidden
      fields `variants` and `navPath`, public grouping, and removal.
- [ ] [`mokly-pages.md`](../docs/protocol/mokly-pages.md) and
      [`mokly-page-migration.md`](../docs/protocol/mokly-page-migration.md):
      `PageInput` without `route`, nested pages without `slug`, output at
      `mockupsDir/pages/<id>.html`, no `/id/` URL.
- [ ] [`mokly-components.md`](../docs/protocol/mokly-components.md),
      [`mokly-component-manifest.md`](../docs/protocol/mokly-component-manifest.md),
      [`mokly-component-explorer.md`](../docs/protocol/mokly-component-explorer.md),
      [`mokly-component-review.md`](../docs/protocol/mokly-component-review.md),
      [`mokly-instances.md`](../docs/protocol/mokly-instances.md),
      [`mokly-design-components.md`](../docs/protocol/mokly-design-components.md),
      and [`mokly-design-component-library.md`](../docs/protocol/mokly-design-component-library.md):
      component variants as entries with global ids; the parent shape without
      `variants`; manifest v7 without path fields; the explorer's variant
      selection as sibling navigation without `?variant=`; review result v4
      and instance records addressing variant entry ids; `MockLink` targeting
      a variant.
- [ ] [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md),
      [`mokly-changes.md`](../docs/protocol/mokly-changes.md),
      [`mokly-catalogue-changes.md`](../docs/protocol/mokly-catalogue-changes.md),
      [`mokly-removed-previews.md`](../docs/protocol/mokly-removed-previews.md),
      and [`mokly-export.md`](../docs/protocol/mokly-export.md): read model
      v3 without `route` or view paths, `variantsById` covering both kinds,
      removal keyed by id, snapshot identity v2, changed ids instead of
      changed routes, the reused-id precedence text deleted, current-entry
      precedence kept, kind-then-id sort order, component variant rows in
      Changes.
- [ ] [`mokly-component-review.md`](../docs/protocol/mokly-component-review.md)
      and [`mokly-changes.md`](../docs/protocol/mokly-changes.md): review
      result v4 addresses screens, components, variants, and views by id and
      view axes; artifact locations under the generation directory follow the
      shared path helper and are never stored in the result.
- [ ] [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md):
      delete the `id/<id>/index.html` row and the static alias paragraphs;
      delivery v3 without `idRoutes`; the `/view/<document>` grammar and its
      parser; extensionless normalization resolves through the parser and
      `byId`.
- [ ] [`mokly-navigation.md`](../docs/protocol/mokly-navigation.md): frame
      activation derives a `/view/<document>` destination from the marker id
      through the read model; delete the `/id/` redirect and the
      `/id/<id>?snapshot=` rejection rule.
- [ ] Audit the manifest and read model fields derivable from identity and
      configuration (`viewports`, `dependencies`, and any others found),
      decide each, and record the decisions in the manifest and catalogue
      contracts.
- [ ] Sweep `mokly-runtime.md`, `mokly-design-links.md`,
      `mokly-configuration.md`, `mokly-rendering.md`, `mokly-shell-design.md`,
      `mokly-upload.md`, `mokly-viewer.md`, `mokly-viewer-appearance.md`, and
      `mokly-guides.md` for `route`, `slug`, `segment`, `fragments`, `/id/`,
      `idRoutes`, `?variant=`, and `variantValues`; leave only
      historical-manifest mentions.
- [ ] Update the authoring guides under `docs/guides/authoring/`, the start
      guide, the root `README.md` Authoring section, `examples/basic/README.md`,
      `src/catalogue/README.md`, `src/components/README.md`,
      `src/export/README.md`, `src/review/README.md`, and
      `packages/viewer/README.md`.
- [ ] Confirm the docs agree with each other with one grep for the removed
      terms; run `npm run format:check` on the changed Markdown; review the
      diff; commit.

## Milestone 2: Authoring, registry, and manifest documents

Derive documents in `src`, delete the authored route surface, and convert the
example catalogue. The manifest still carries a `route` computed by the shared
helper until Milestone 4, component variants stay local, the shell is
untouched, and the export still writes aliases, so the product works end to
end.

- [ ] Create the shared path module in `@mokly/viewer/data` with
      `documentPath`, `viewPath`, `viewHref`, and the `/view/<document>`
      parser; move `fragmentRoute` and `componentFragmentRoute` behind it and
      delete the `src` copy of `fragmentRoute`.
- [ ] Types in `src/authoring/types.ts` and `src/components/types.ts`: remove
      `RoutedEntryInput`; drop `route` from every input, `slug` from
      `ScreenVariantInput`, `NestedScreenInput`, and `NestedPageInput`,
      `segment` from `NestedFolderInput`, and `path` from `RootInput`.
- [ ] `defineScreen`, `definePage`, `defineUseCase`, and `defineComponent`
      compute their document with the helper, and a screen variant derives
      its own document from its id; `defineRoot` and `flattenChild` stop
      threading a directory and use the new error texts.
- [ ] Failure-first tests: documents per kind, nested trees, screen variants,
      the device-name id rule, and the new `defineRoot` errors.
- [ ] Registry: delete `validateRoute` in `entry_metadata.ts`,
      `duplicateViolations(…, "route")`, the variant route match,
      `duplicate-variant-slug`, `screenVariantRoute`, `isScreenVariantRoute`,
      `isScreenVariantSlug`, and the `route` and `slug` entries of the
      forbidden variant fields; keep `invalid-nested-nav-path` and the
      `navPath` equality check.
- [ ] Manifest: write `schemaVersion: 7`; strict validation accepts only 7
      and requires `route === documentPath(kind, id)` until Milestone 4 drops
      the field; rename `ManifestV6` types to `ManifestV7`; the historical
      boundary accepts 3–7.
- [ ] Key `removedManifestEntries` by id for every kind.
- [ ] Build and export inputs: `logical_routes.ts`, ownership, and page output
      use the helper; delete `validateCatalogueRoute` (no callers) and keep
      `manifest_values.validateRoute` for historical reads only.
- [ ] Convert `examples/basic` (7 `route:`, 95 `slug:`, 30 `segment:`, and 1
      `path:` across 42 files) and the `scripts/large` fixture generator.
- [ ] `npm run build`, `npm run example:build`, `npm run example:check`, and
      `npm run dev`: the navigation tree is unchanged, the welcome screen
      renders at `/view/screens/example-welcome.html`, and `/id/example-welcome`
      still redirects.
- [ ] Committed-output smoke: build once on the old layout, then on the new;
      old files disappear as pending orphans and Changes lists every entry
      once.
- [ ] `npm run test:prepared` and the affected browser tests pass; commit.

## Milestone 3: Component variants as entries

Flatten component variants into entries with global ids, mirroring
`defineScreen`, and carry them through the manifest, read model, review,
instances, and removal. Path fields on the new entries are computed by the
helper and dropped in Milestone 4. Shell changes are compile-only: the explorer
keeps its `?variant=` selection by reading the parent's variants through
`variantsById`, so behavior is unchanged until Milestone 5.

- [ ] `defineComponent` validates variant ids with the global id grammar,
      returns the parent entry followed by one entry per variant in authored
      order (`kind: "component"`, `variantOf`, `props`, supplied slots,
      copied `navPath`, inherited color schemes), and the module-bound loader
      flattens the array; the parent has no `variants`.
- [ ] Manifest v7 component shapes: the parent without `variants` or views;
      variant entries rendered at `components/<variant-id>.<viewport>[.dark].html`;
      `componentViews` per variant entry; delete the `.variants/` directory.
- [ ] Registry validation: `variantOf` rules apply to components (parent
      exists, is a component, is not itself a variant, shares `navPath`); at
      least one variant per component; `duplicate-id` covers variant ids.
- [ ] Read model v3 in `src/catalogue/projection.ts` and
      `packages/viewer/src/catalogue/*`: `CatalogueComponent` without
      `variants`; a component variant entry type with `props`, supplied
      slots, views, and `comparison`; `variantsById` and hierarchy cover
      components; regenerate `docs/protocol/fixtures/catalogue-v2.json` as
      `catalogue-v3.json`; the reader accepts only v3.
- [ ] Removal and Changes: a removed component variant is an ordinary removed
      entry with `variantOf`; changed-entry computation treats variant
      entries like screens; delete the surviving-component removed-variant
      paths in `src` and the viewer data layer.
- [ ] Review and instances in `src/review/*` and `packages/viewer/src/review/*`:
      variant addresses, `variantId` contexts, and instance records name the
      variant entry id; the builder picks the parent's first variant entry
      for the component page.
- [ ] Compile-only shell adaptation: `workspace_data.ts` builds
      `WorkspaceVariant` rows from `variantsById` so the variant bar,
      controls, and comparison keep working with `?variant=`; no behavior
      change.
- [ ] Convert the 18 example component definitions to global variant ids and
      update the design catalogue entries that reference them.
- [ ] Failure-first tests for flattening, validation, manifest, read model,
      removal, and review addressing; `npm run example:check`; `npm run dev`
      smoke: component pages and variant selection behave as before; commit.

## Milestone 4: Identity-keyed wire formats and internals

Remove every derivable path field from the manifest, read model, review
result, server responses, and export inputs, and key every index, comparison,
and URL on kind and id through the shared helper. Shell edits are mechanical
(`entry.route === x` becomes `entry.id === x`, `routeHref(entry.route)`
becomes `viewHref(entry.kind, entry.id)`), and the URL surface is unchanged
because derived documents already produce it.

- [ ] Manifest v7: drop `route`, `fragments`, `darkFragments`, and component
      view paths, plus the fields the Milestone 1 audit decided to drop;
      strict validation checks identity, and the `ManifestEntry` types lose
      the path fields.
- [ ] Historical boundary: `parseHistoricalManifest` normalizes v3–v7 entries
      into an internal shape with artifact paths read from stored fields or
      computed for v7; `src/review`, removed previews, and baseline reads use
      that shape and never a stored route.
- [ ] Read model v3: drop `route` and view paths; `byRoute` becomes `byId`;
      removed entries lose `route`; snapshot identity v2; entry arrays sort
      by kind then id; regenerate `catalogue-v3.json`.
- [ ] Review result v4: `src/review/paths.ts`, `screen_views.ts`,
      `component_metadata.ts`, `asset_references.ts`, and the viewer
      `review/*` readers address entries and views by id and axes; artifact
      files under the generation directory are named by the helper; the
      reader accepts only v4.
- [ ] Server and export inputs: `computeChangedRoutes` and `changedRoutes`
      become changed ids; `ExportRoutes`, `site.ts`, `run.ts`, `view_routes.ts`,
      `fragments.ts`, `review_routes.ts`, and the controls use the helper;
      `logical_routes.ts` is deleted.
- [ ] Shell and client data layer: `routeFromUrl` parses `/view/<document>`
      into kind and id and resolves through `byId`; `routeHref`,
      `catalogueViewHref`, `activeRoute`, `selectionForRoute`,
      `catalogueRouteEntry`, `hostRoute`, `sameShellRoute`, and the
      comparison, preview, capability, frame-instance, head, details, and
      nav-row route comparisons key on id; delete the four routed-entry
      aliases.
- [ ] Tests and fixtures: unit, catalogue conformance, review, server, export,
      and browser suites updated; one grep confirms no `.route` reads remain
      outside the historical boundary; `npm run dev` smoke shows identical
      navigation, Changes, comparisons, and removed previews; commit.

## Milestone 5: Explorer navigation by variant entry

Tags: ui

Component variants become nav rows, breadcrumbs, details, and Changes rows
through the existing screen-variant presentation, and selecting a variant
navigates to its entry.

- [ ] Nav tree, breadcrumbs, head, details, and Changes rows treat component
      variants like screen variants; the parent row discloses them.
- [ ] The variant bar links to sibling variant entries; controls state,
      comparison, and preview expiration key on the current entry; delete
      `?variant=` parsing, `variantValues`, and the unknown- or
      duplicate-variant selection error.
- [ ] Removed component variants render as removed rows with the parent
      title, using the existing removed-variant presentation.
- [ ] Failure-first viewer unit and browser tests: selecting a variant changes
      the URL, Back/Forward restore it, a removed variant opens with its
      `snapshot` query, and a `mock:` link to a variant lands on it;
      smoke-test through `npm run dev`; commit.

## Milestone 6: Viewer navigation without the id alias

Tags: ui

The shell resolves ids through the read model and builds `/view/` URLs
directly, so it stops depending on `idRoutes` and `/id/`. The details Route
row and route search go, since the ID chip and id search carry the same
information. The export still writes delivery v2 until Milestone 7; the shell
ignores `idRoutes`.

- [ ] `same_origin_navigation.ts` returns the logical destination (id,
      fragment, target) and the shell resolves it through `catalogue.byId` and
      `viewHref`; `frame_event_router.tsx` stops building `/id/` hrefs; an
      unknown id yields the missing view.
- [ ] Remove `/id/` handling from `store_browser.ts`, `store_host_routes.ts`,
      and `store_browser_routes.ts`; remove the alias branch and
      `collidingLegacy` from `routeFromUrl`; extensionless `/view/`
      normalization resolves through the parser and `byId`.
- [ ] Delete the reused-id precedence paths in `entry_selection.ts`,
      `capability_adoption.ts`, and `catalogue.ts` while keeping current-entry
      precedence over historical content.
- [ ] Remove the details Route row and route matching from search; search
      keeps id, title, tags, and folder labels.
- [ ] Failure-first viewer unit and browser tests: frame click, modifier
      click, and named-target navigation land on `/view/` URLs; Back/Forward
      and reload keep entry identity; a removed entry still opens with its
      `snapshot` query; smoke-test through `npm run dev`; commit.

## Milestone 7: Export, server, and delivery v3

Stop writing the alias, move static delivery to v3 in the parser and the
writer together, and remove the development redirect and preview redirects.

- [ ] `parseStaticDelivery` accepts only `schemaVersion: 3` without
      `idRoutes`; delete `resolveDeliveryHref`; remove `idRoutes` from
      `site.ts` and `run.ts`; `site.ts` writes each shell once at
      `view/<document>`.
- [ ] Delete `redirectId` and the `/id/` branch in `http_routes.ts`; `/id/`
      now returns the not-found view.
- [ ] `scripts/preview/artifact.mjs` drops `idRoutes` and the `/id/`
      `_redirects` lines.
- [ ] Regenerate `docs/protocol/fixtures/export-ownership-v1.json` and the
      export inventory tests so no `id/` or `.variants/` path remains.
- [ ] Failure-first tests: delivery v2 is rejected, export inventory has no
      `id/` files, the server answers `/id/…` with 404, package smoke passes.
- [ ] Static export smoke: run `mokly export` on the example, serve the
      directory with a plain static file server, and check
      `/view/screens/example-welcome.html`, a component variant entry, frame
      links, `?fragment=`, Back/Forward, and a removed entry with
      `?snapshot=`.
- [ ] Commit.

## Milestone 8: Verification, close-out, and review

- [ ] Update key-code pointers in the touched READMEs and confirm
      `plans/README.md` describes the completed state.
- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit as a `feat!:` change with a `BREAKING CHANGE:` footer naming the
      removed authoring fields, global component variant ids, the document
      layout, identity-only manifest v7, read model v3, review result v4,
      delivery v3, and the removed `/id/` URLs; push.
- [ ] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Post-merge follow-up (non-blocking)

- Separate cleanup: delete the historical v3–v5 manifest readers and the
  legacy v2 page migration once no derived baseline can still produce them.
- Update Mokly Cloud and any external documentation that links to
  `/id/<id>` URLs or reads `route` from the public read model.
- Re-run `npm run benchmark:large` after the release to confirm the single
  shell write speeds up export.
