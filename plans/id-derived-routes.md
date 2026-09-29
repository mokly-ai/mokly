# Id-Derived Routes, Unified Variants, And Identity-Keyed Wire

Status: Milestones 1–19 implemented, verified, pushed, and reviewed on
`calummoore/halifax-v2` (2026-09-26 to 2026-09-29); Milestones 20–23 carry the
user's decisions on the second follow-up review. Created 2026-09-26 with the
user's consent after discussing route redundancy on the navigation-path
branch; the variant unification and the wire cleanup were folded in the same
day. The work is implemented on this branch, `calummoore/halifax-v2`, and the
user opens a pull request when it is ready. Mokly is not live, so this plan
adds no backwards compatibility: readers it rewrites accept only the new
versions, and there are no migration guards or transitional shapes.

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
the existing collision inventory. The shell URL is `/view/<route>` and the
canonical share URL is therefore `/view/<kind prefix>/<id>.html`.

**Further decisions:**

- One shared path module exported from `@mokly/viewer/data` owns
  `entryRoute(kind, id)`, `viewRoute(kind, id, viewport, scheme)`,
  `viewHref(kind, id)`, and the URL parser for `/view/<route>`. The builder,
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

- [x] [`mokly-nav-paths.md`](../docs/protocol/mokly-nav-paths.md): remove
      root `path`, folder `segment`, and leaf `slug` route derivation; state
      that nothing but the id moves a route; variants of both kinds copy
      the parent path; keep label, conflict, order, and key rules unchanged.
- [x] [`mokly-authoring.md`](../docs/protocol/mokly-authoring.md): drop
      `RoutedEntryInput` and every `route`, `slug`, `segment`, and `path`
      field from the interfaces; add the document table, the reserved
      prefixes, and the shared path helpers; add the device-name id rule;
      define the new `defineRoot` errors exactly:
      `root navPath must be an array`, `root <labels> has no children`, and
      `folder <labels> has no children`, where `<labels>` joins the root
      `navPath` plus ancestor and current folder titles with `›` using
      `String(title)`; remove the authored-route grammar sentences while
      keeping the static asset segment rule.
- [x] Generalize the screen variants contract into
      [`mokly-variants.md`](../docs/protocol/mokly-variants.md) for screens
      and components, renamed from `mokly-screen-variants.md` with every link
      updated: global ids, `variantOf`,
      copied `navPath`, derived documents, inheritance per kind, forbidden
      fields `variants` and `navPath`, public grouping, and removal.
- [x] [`mokly-pages.md`](../docs/protocol/mokly-pages.md) and the then-current
      `mokly-page-migration.md` contract:
      `PageInput` without `route`, nested pages without `slug`, output at
      `mockupsDir/pages/<id>.html`, no `/id/` URL.
- [x] [`mokly-components.md`](../docs/protocol/mokly-components.md),
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
- [x] [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md),
      [`mokly-changes.md`](../docs/protocol/mokly-changes.md),
      [`mokly-catalogue-changes.md`](../docs/protocol/mokly-catalogue-changes.md),
      [`mokly-removed-previews.md`](../docs/protocol/mokly-removed-previews.md),
      and [`mokly-export.md`](../docs/protocol/mokly-export.md): read model
      v3 without `route` or view paths, `variantsById` covering both kinds,
      removal keyed by id, snapshot identity v2, changed ids instead of
      changed routes, the reused-id precedence text deleted, current-entry
      precedence kept, kind-then-id sort order, component variant rows in
      Changes.
- [x] [`mokly-component-review.md`](../docs/protocol/mokly-component-review.md)
      and [`mokly-changes.md`](../docs/protocol/mokly-changes.md): review
      result v4 addresses screens, components, variants, and views by id and
      view axes; artifact locations under the generation directory follow the
      shared path helper and are never stored in the result.
- [x] [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md):
      delete the `id/<id>/index.html` row and the static alias paragraphs;
      delivery v3 without `idRoutes`; the `/view/<route>` grammar and its
      parser; extensionless normalization resolves through the parser and
      `byId`.
- [x] [`mokly-navigation.md`](../docs/protocol/mokly-navigation.md): frame
      activation derives a `/view/<route>` destination from the marker id
      through the read model; delete the `/id/` redirect and the
      `/id/<id>?snapshot=` rejection rule.
- [x] Audit the manifest and read model fields derivable from identity and
      configuration (`viewports`, `dependencies`, and any others found),
      decide each, and record the decisions in the manifest and catalogue
      contracts.
- [x] Sweep `mokly-runtime.md`, `mokly-design-links.md`,
      `mokly-configuration.md`, `mokly-rendering.md`, `mokly-shell-design.md`,
      `mokly-upload.md`, `mokly-viewer.md`, `mokly-viewer-appearance.md`, and
      `mokly-guides.md` for `route`, `slug`, `segment`, `fragments`, `/id/`,
      `idRoutes`, `?variant=`, and `variantValues`; leave only
      historical-manifest mentions.
- [x] Update the authoring guides under `docs/guides/authoring/`, the start
      guide, the root `README.md` Authoring section, `examples/basic/README.md`,
      `src/catalogue/README.md`, `src/components/README.md`,
      `src/export/README.md`, `src/review/README.md`, and
      `packages/viewer/README.md`.
- [x] Confirm the docs agree with each other with one grep for the removed
      terms; run `npm run format:check` on the changed Markdown; review the
      diff; commit.
- [x] Decisions recorded while writing the docs, implemented by the
      milestones named: `defineComponent` returns `{ Component, entries }`
      with the parent first (Milestone 3); `RenderInput.entry` is the variant
      entry and `RenderInput` has no `variantId` (Milestone 3); the changed
      set handed to the shell is `changedIds` (Milestone 4); a removed row's
      identity is `removed:<id>` (Milestone 4); `RemovedPagePreview` is
      schema 2 and carries only the page id, with its document at
      `snapshots/before/pages/<id>.html` (Milestone 4); the read model's page
      preview descriptor is `{ kind: "page" }` and the packaged metadata lives
      at `pages/<id>.json` inside the comparison generation (Milestone 4);
      the selected-comparison endpoint takes `id=<entry id>` or
      `page=<page id>` (Milestone 4); review result v4 is one shape for every
      catalogue with empty component arrays when none are registered
      (Milestone 4); `ScreenNavigateEvent` carries `screenId` only
      (Milestone 4); Details has no Generated or Route row and search
      matches id, title, and tags (Milestone 6); the shared path module
      exports `entryRoute`, `viewRoute`, and `viewHref` (Milestone 2).
- [x] Known dangling links until code lands: `fixtures/catalogue-v3.json`
      is created in Milestone 3, and the example README's generated overview
      paths exist after the Milestone 2 rebuild.

## Milestone 2: Authoring, registry, and manifest documents

Derive documents in `src`, delete the authored route surface, and convert the
example catalogue. The manifest still carries a `route` computed by the shared
helper until Milestone 4, component variants stay local, the shell is
untouched, and the export still writes aliases, so the product works end to
end.

- [x] Create the shared path module in `@mokly/viewer/data` with
      `entryRoute`, `viewRoute`, `viewHref`, and the `/view/<route>`
      parser; move `fragmentRoute` and `componentFragmentRoute` behind it and
      delete the `src` copy of `fragmentRoute`.
- [x] Types in `src/authoring/types.ts` and `src/components/types.ts`: remove
      `RoutedEntryInput`; drop `route` from every input, `slug` from
      `ScreenVariantInput`, `NestedScreenInput`, and `NestedPageInput`,
      `segment` from `NestedFolderInput`, and `path` from `RootInput`.
- [x] `defineScreen`, `definePage`, `defineUseCase`, and `defineComponent`
      compute their document with the helper, and a screen variant derives
      its own document from its id; `defineRoot` and `flattenChild` stop
      threading a directory and use the new error texts.
- [x] Failure-first tests: documents per kind, nested trees, screen variants,
      the device-name id rule, and the new `defineRoot` errors.
- [x] Registry: delete `validateRoute` in `entry_metadata.ts`,
      `duplicateViolations(…, "route")`, the variant route match,
      `duplicate-variant-slug`, `screenVariantRoute`, `isScreenVariantRoute`,
      `isScreenVariantSlug`, and the `route` and `slug` entries of the
      forbidden variant fields; keep `invalid-nested-nav-path` and the
      `navPath` equality check.
- [x] Manifest: write `schemaVersion: 7`; strict validation accepts only 7
      and requires `route === entryRoute(kind, id)` until Milestone 4 drops
      the field; rename `ManifestV6` types to `ManifestV7`; the historical
      boundary accepts 3–7.
- [x] Key `removedManifestEntries` by id for every kind.
- [x] Build and export inputs: `logical_routes.ts`, ownership, and page output
      use the helper; delete `validateCatalogueRoute` (no callers) and keep
      `manifest_values.validateRoute` for historical reads only.
- [x] Convert `examples/basic` (7 `route:`, 95 `slug:`, 30 `segment:`, and 1
      `path:` across 42 files) and the `scripts/large` fixture generator.
- [x] `npm run build`, `npm run example:build`, `npm run example:check`, and
      `npm run dev`: the navigation tree is unchanged, the welcome screen
      renders at `/view/screens/example-welcome.html`, and `/id/example-welcome`
      still redirects.
- [x] Committed-output smoke: build once on the old layout, then on the new;
      old files disappear as pending orphans and Changes lists every entry
      once.
- [x] Resolve historical comparison evidence through a matching current entry
      id before exposing its shell link, while retaining genuinely removed
      evidence as historical.
- [x] `npm run test:prepared` and the complete browser suite pass; commit.

## Milestone 3: Component variants as entries

Flatten component variants into entries with global ids, mirroring
`defineScreen`, and carry them through the manifest, read model, review,
instances, and removal. Path fields on the new entries are computed by the
helper and dropped in Milestone 4. Shell changes are compile-only: the explorer
keeps its `?variant=` selection by reading the parent's variants through
`variantsById`, so behavior is unchanged until Milestone 5.

- [x] `defineComponent` validates variant ids with the global id grammar,
      returns the parent entry followed by one entry per variant in authored
      order (`kind: "component"`, `variantOf`, `props`, supplied slots,
      copied `navPath`, inherited color schemes), and the module-bound loader
      flattens the array; the parent has no `variants`.
- [x] Manifest v7 component shapes: the parent without `variants` or views;
      variant entries rendered at `components/<variant-id>.<viewport>[.dark].html`;
      `componentViews` per variant entry; delete the `.variants/` directory.
- [x] Registry validation: `variantOf` rules apply to components (parent
      exists, is a component, is not itself a variant, shares `navPath`); at
      least one variant per component; `duplicate-id` covers variant ids.
- [x] Read model v3 in `src/catalogue/projection.ts` and
      `packages/viewer/src/catalogue/*`: `CatalogueComponent` without
      `variants`; a component variant entry type with `props`, supplied
      slots, views, and `comparison`; `variantsById` and hierarchy cover
      components; regenerate `docs/protocol/fixtures/catalogue-v2.json` as
      `catalogue-v3.json`; the reader accepts only v3.
- [x] Removal and Changes: a removed component variant is an ordinary removed
      entry with `variantOf`; changed-entry computation treats variant
      entries like screens; delete the surviving-component removed-variant
      paths in `src` and the viewer data layer.
- [x] Review and instances in `src/review/*` and `packages/viewer/src/review/*`:
      variant addresses, `variantId` contexts, and instance records name the
      variant entry id; the builder picks the parent's first variant entry
      for the component page.
- [x] Compile-only shell adaptation: `workspace_data.ts` builds
      `WorkspaceVariant` rows from `variantsById` so the variant bar,
      controls, and comparison keep working with `?variant=`; no behavior
      change.
- [x] Convert the 18 example component definitions to global variant ids and
      update the design catalogue entries that reference them.
- [x] Failure-first tests for flattening, validation, manifest, read model,
      removal, and review addressing; `npm run example:check`; `npm run dev`
      smoke: component pages and variant selection behave as before; commit.

## Milestone 4: Identity-keyed wire formats and internals

Remove every derivable path field from the manifest, read model, review
result, server responses, and export inputs, and key every index, comparison,
and URL on kind and id through the shared helper. Shell edits are mechanical
(`entry.route === x` becomes `entry.id === x`, `routeHref(entry.route)`
becomes `viewHref(entry.kind, entry.id)`), and the URL surface is unchanged
because derived documents already produce it.

- [x] Manifest v7: drop `route`, `fragments`, `darkFragments`, and component
      view paths, plus the fields the Milestone 1 audit decided to drop;
      strict validation checks identity, and the `ManifestEntry` types lose
      the path fields.
- [x] Historical boundary: `parseHistoricalManifest` normalizes v3–v7 entries
      into an internal shape with artifact paths read from stored fields or
      computed for v7; `src/review`, removed previews, and baseline reads use
      that shape and never a stored route.
- [x] Read model v3: drop `route` and view paths; `byRoute` becomes `byId`;
      removed entries lose `route`; snapshot identity v2; entry arrays sort
      by kind then id; regenerate `catalogue-v3.json`.
- [x] Review result v4: `src/review/paths.ts`, `screen_views.ts`,
      `component_metadata.ts`, `asset_references.ts`, and the viewer
      `review/*` readers address entries and views by id and axes; artifact
      files under the generation directory are named by the helper; the
      reader accepts only v4.
- [x] Delete `componentReviewManifest` and the grouped-variant bridge; Review
      classifies flat component variant entries directly for review result v4.
- [x] Server and export inputs: `computeChangedRoutes` and `changedRoutes`
      become changed ids; `ExportRoutes`, `site.ts`, `run.ts`, `view_routes.ts`,
      `fragments.ts`, `review_routes.ts`, and the controls use the helper;
      `logical_routes.ts` is deleted.
- [x] Shell and client data layer: `routeFromUrl` parses `/view/<route>`
      into kind and id and resolves through `byId`; `routeHref`,
      `catalogueViewHref`, `activeRoute`, `selectionForRoute`,
      `catalogueRouteEntry`, `hostRoute`, `sameShellRoute`, and the
      comparison, preview, capability, frame-instance, head, details, and
      nav-row route comparisons key on id; delete the four routed-entry
      aliases.
- [x] Historical relocation preserves qualified SVG `xlink:href` source
      locations, rewrites anchor and SVG href fragments deterministically,
      and retains browser-safe `url(#fragment)` paint references.
- [x] Compare full-catalogue Changes export and preview-build timings against
      Milestone 3 twice each; confirm no material regression and retain the
      original 300-second setup timeout.
- [x] Audit every removed unit-test declaration, port every surviving
      identity-keyed or historical behavior, and record why superseded wire
      path and review-schema cases no longer exist.
- [x] Tests and fixtures: unit, catalogue conformance, review, server, export,
      and browser suites updated; one grep confirms no `.route` reads remain
      outside the historical boundary; `npm run dev` smoke shows identical
      navigation, Changes, comparisons, and removed previews; commit.

## Milestone 5: Explorer navigation by variant entry

Tags: ui

Component variants become nav rows, breadcrumbs, details, and Changes rows
through the existing screen-variant presentation, and selecting a variant
navigates to its entry.

- [x] Nav tree, breadcrumbs, head, details, and Changes rows treat component
      variants like screen variants; the parent row discloses them.
- [x] The variant bar links to sibling variant entries; controls state,
      comparison, and preview expiration key on the current entry; delete
      `?variant=` parsing, `variantValues`, and the unknown- or
      duplicate-variant selection error.
- [x] Removed component variants render as removed rows with the parent
      title, using the existing removed-variant presentation.
- [x] Failure-first viewer unit and browser tests: selecting a variant changes
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

- [x] `same_origin_navigation.ts` returns the logical destination (id,
      fragment, target) and the shell resolves it through `catalogue.byId` and
      `viewHref`; `frame_event_router.tsx` stops building `/id/` hrefs; an
      unknown id yields the missing view.
- [x] Remove `/id/` handling from `store_browser.ts`, `store_host_routes.ts`,
      and `store_browser_routes.ts`; remove the alias branch and
      `collidingLegacy` from `routeFromUrl`; extensionless `/view/`
      normalization resolves through the parser and `byId`.
- [x] Delete the reused-id precedence paths in `entry_selection.ts`,
      `capability_adoption.ts`, and `catalogue.ts` while keeping current-entry
      precedence over historical content.
- [x] Remove the details Route row and route matching from search; search
      keeps id, title, and tags.
- [x] Update watched-reload search coverage to use authored identity instead
      of the removed derived-route match.
- [x] Failure-first viewer unit and browser tests: frame click, modifier
      click, and named-target navigation land on `/view/` URLs; Back/Forward
      and reload keep entry identity; a removed entry still opens with its
      `snapshot` query; smoke-test through `npm run dev`; commit.

## Milestone 7: Export, server, and delivery v3

Stop writing the alias, move static delivery to v3 in the parser and the
writer together, and remove the development redirect and preview redirects.

- [x] `parseStaticDelivery` accepts only `schemaVersion: 3` without
      `idRoutes`; delete `resolveDeliveryHref`; remove `idRoutes` from
      `site.ts` and `run.ts`; `site.ts` writes each shell once at
      `view/<route>`.
- [x] Delete `redirectId` and the `/id/` branch in `http_routes.ts`; `/id/`
      now returns the not-found view.
- [x] `scripts/preview/artifact.mjs` drops `idRoutes` and the `/id/`
      `_redirects` lines.
- [x] Regenerate `docs/protocol/fixtures/export-ownership-v1.json` and the
      export inventory tests so no `id/` or `.variants/` path remains.
- [x] Failure-first tests: delivery v2 is rejected, export inventory has no
      `id/` files, the server answers `/id/…` with 404, package smoke passes.
- [x] Static export smoke: run `mokly export` on the example, serve the
      directory with a plain static file server, and check
      `/view/screens/example-welcome.html`, a component variant entry, frame
      links, `?fragment=`, Back/Forward, and a removed entry with
      `?snapshot=`.
- [x] Coordinator review follow-up: validate delivery `canonicalPath` by
      round-tripping the shared `/view/<route>` parser and audit remaining
      hand-written view-path checks.
- [x] Commit.

## Milestone 8: Verification, close-out, and review

- [x] Update key-code pointers in the touched READMEs and confirm
      `plans/README.md` describes the completed state.
- [x] Run `cargo xtask check`; fix anything it reports until it passes.
- [x] Commit as a `feat!:` change with a `BREAKING CHANGE:` footer naming the
      removed authoring fields, global component variant ids, the document
      layout, identity-only manifest v7, read model v3, review result v4,
      delivery v3, and the removed `/id/` URLs; push.
- [x] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Milestone 9: Review follow-up contract

Rewrite the protocol docs, guides, and READMEs for the user's review decisions
(2026-09-28) before any code changes: no compatibility with baselines built by
earlier Mokly versions, the approved review fixes, and the verification
ratchets. Finding numbers refer to the [review record](#review-record).

- [x] Old baselines (option A; findings 2, 9, 10, 15, 22, 23): the historical
      manifest boundary accepts only manifest v7. An integer version below 7,
      and the legacy `mokabook-manifest.json` and `mockbook-manifest.json`
      baseline names, makes the baseline incompatible: Serve reports Changes
      unavailable, export and publish complete without Changes
      (`changesStatus: "unavailable"`, delivery `comparisonUrl: null`), and
      each prints one plain CLI line saying the comparison base was built
      with an earlier Mokly and Changes return once the base includes this
      version. An integer version above 7 is an invalid newer baseline: Serve
      reports Changes unavailable with its normal safe diagnostic, while
      explicit capture fails under existing rules. Delete historical document
      relocation and its private base, legacy component-variant id expansion
      and its collision rule, v3–v6 path normalization, the v3–v5 readers, and
      the v2 legacy page migration from every doc, including
      `mokly-component-manifest.md`,
      `mokly-changes.md`, `mokly-derived-baselines.md`,
      `mokly-removed-previews.md`, `mokly-catalogue-changes.md`,
      `mokly-nav-paths.md`, `mokly-variants.md`, `mokly-components.md`, and
      `mokly-page-migration.md`. Output-ownership cleanup of old generated
      files stays.
- [x] Identity leftovers: the v3 reader rejects a removed record whose id
      belongs to a current entry, so the same-id history rules go (findings
      14 and 28); `InstanceRef` has no `variantId`, and `ScreenNavigateEvent`
      is `{ screenId, snapshotId?, fragment?, navigation? }` with `snapshotId`
      present exactly when historical content was committed (finding 4);
      `ReviewIgnore` ids keep the plain kebab-case grammar, and only entry ids
      reject Windows device names (finding 15).
- [x] Review fixes: a baseline entry whose id belongs to a current entry of
      another kind is dropped before pairing, so the current entry is added
      (finding 8); one owning paragraph in
      `mokly-component-review-validation.md` states the `review.json` order
      for `screens`, `components`, nested variants, and `changes`, and
      `mokly-changes.md` links to it (finding 11); `RenderInput.entry` is
      `ScreenDefinition | ComponentVariantDefinition` (finding 12); removed
      variants of a surviving parent keep baseline authored order at the
      parent's position in `removedEntries` (finding 25); a removed variant
      whose former parent is not an eligible parent shows the former
      parent's title as a plain-text breadcrumb (finding 27); dark-scheme
      availability counts removed component variants (finding 26);
      screen-only Serve logs a classifier failure and reports Changes
      unavailable (finding 16); snapshot and preview artifact names come from
      shared path builders (finding 17).
- [x] Shell behavior: switching sibling component variants keeps the
      comparison mode, and the workspace reads that one mode (finding 3); an
      unknown frame-link id shows the missing view in uncontrolled and
      standalone shells and a later selection re-applies its route, while a
      controlled Viewer emits only `onError` and keeps its display (finding
      5); component variant rows use a component-shaped variant icon
      (finding 6).
- [x] Verification ratchets (findings 19 and 29): `ci-verification.md` and
      `xtask/README.md` state that `cargo xtask check` fails when a changed
      TypeScript file under `src`, `packages/viewer/src`, or `scripts`
      crosses 300 lines or grows while over 300 lines relative to
      `origin/main`, when a protocol doc cap is raised or added relative to
      `origin/main`, and when an internal export is unused outside a reviewed
      baseline list that can only shrink.
- [x] Release notes (finding 30): `docs/protocol/npm-release.md` names the
      rejected `ViewerSelection.variantId`, the removed `ScreenNavigateEvent`
      `route` and `variantId`, the removed `InstanceRef.variantId`, and the
      end of comparisons against baselines built by earlier Mokly versions.
- [x] Fix the remaining doc and code wording mismatches (finding 20).
- [x] Restore every protocol doc touched by Milestones 1–9 to its
      `origin/main` cap (a renamed doc keeps its predecessor's cap; a new doc
      stays at or below 250 lines) by splitting by responsibility, and lower
      the caps in `tests/protocol_doc_sizes.test.ts`; run
      `npm run format:check` and the protocol doc tests; review the diff;
      commit.

## Milestone 10: Component variant navigation mockups

Tags: mockup

- [x] Update the shared navigation mockup data
      (`examples/basic/entries/design/parts/nav_data.ts`) and the component
      explorer, workspace, and Changes mockups so a component with variants
      shows its disclosure and its variant rows in authored order with a
      component-shaped variant icon, in both mobile and desktop variants,
      keeping the screen-variant presentation unchanged (finding 6).
- [x] Confirm the `design-browse-variant-reparented` mockup shows the former
      parent as a plain-text breadcrumb (finding 27).
- [x] `npm run build`, `npm run example:build`, `npm run example:check`, and a
      visual smoke of the changed design screens through `npm run dev` with
      screenshots; commit.

## Milestone 11: Remove old-baseline compatibility

- [x] Failure-first tests: a v6 baseline makes Serve report Changes
      unavailable with the documented CLI line; export and publish succeed
      without Changes; a v7 baseline still compares; a v8 baseline follows the
      documented invalid-baseline path and never prints the earlier-version line.
- [x] The historical boundary accepts only v7: versions below 7 return the
      incompatible-earlier outcome, versions above 7 return the invalid-newer
      outcome, and v7 receives full validation; delete v2–v6 parsing, the
      legacy baseline manifest names, `legacyPages` and the v2 page migration,
      v3–v6 normalization in `src/registry/historical_manifest.ts`,
      `src/review/historical_document.ts` and every snapshot-base branch in
      export and HTML reference code, legacy component-variant expansion
      (`legacyComponentVariantId`, `legacyComponentVariantEntry`,
      `flattenComponentVariantEntries`,
      `validateHistoricalComponentVariantIds`, legacy variant validators, and
      `HistoricalManifestComponent*` types), and the historical nested-variant
      paths in review and shell data.
- [x] Identity leftovers: the v3 reader rejects removed records whose id is
      current, and the collision branches that can no longer fire go
      (finding 14); delete the removed-variant-on-a-surviving-component path
      (finding 28); review readers validate `ReviewIgnore` ids with the plain
      id grammar (finding 15).
- [x] Dead code (finding 19): delete `withFragmentQuery`, `safeDecode`,
      `validFragmentQuery`, `resolveCatalogueRecord`, `publicPath`,
      `pagePreviewPath`, the `CatalogueVariant` alias, `route()` in
      `catalogue/values.ts`, the unused `viewer/routing.ts` and
      `viewer/public_stage.tsx` (moving their tests to live code), the
      unreachable route-collision check in `compile.ts`, and unread `route`
      and `variantId` fields on definitions and render targets; rename
      route-era identifiers that carry ids.
- [x] Move full-catalogue browser setup that needs Changes onto focused,
      controlled v7 baselines built by the current code; keep the 300-second
      budget and record fixture timings before and after the move.
- [x] Update tests and fixtures; build, lint, format, typecheck, example
      build and check, full unit suite, and affected browser specs; smoke
      Serve and export against a branch point built by an earlier Mokly;
      commit.

## Milestone 12: Review fixes in data, review, and export

- [x] Finding 1: one exported affected-consumer sort key used by the
      producer and the v4 reader; a test feeds producer output with component
      ids `x`, `x-y`, and `x2` through `parseReviewResult`.
- [x] Finding 8: drop a baseline entry whose id belongs to a current entry of
      another kind before pairing; a classify-then-parse test.
- [x] Finding 11: the v4 reader enforces the documented order for `changes`
      and nested component variants; tests.
- [x] Finding 13: the packed-consumer export check derives snapshot paths
      with the shared helper and fails when it checked none.
- [x] Finding 16: screen-only Serve logs a classifier failure and reports
      Changes unavailable; delete the `compareScreen` fallback and its dead
      arguments.
- [x] Finding 16 follow-through: the unified classifier retains verified
      baseline-present resource deletions while newly missing, escaping, and
      unverified resources still make Changes unavailable; tests.
- [x] Finding 17: shared builders for snapshot view, snapshot page, and page
      preview artifact names replace every hand-built copy, and
      `snapshotPath` is deleted; a test fails on hand-built names.
- [x] Finding 18: `parseViewHref` uses a `Map` lookup; tests for
      `constructor`, `__proto__`, and `toString` prefixes.
- [x] Finding 21: shared helpers in `packages/viewer/src/navigation/routes.ts`
      for provider-normalized extensionless view paths and the unknown-id
      destination, used by the shell, `static_workspace_evidence.ts`, and
      both preview scripts (mechanical shell edits only).
- [x] Finding 24: a component parent that fails its own validation stays
      available for relationship checks, so authors see one root-cause
      error; test.
- [x] Finding 25: a projection test pins removed-entry order with
      interleaved ids and a surviving parent.
- [x] Finding 7: table-driven variant validation and manifest relationship
      tests run every rule for screens and components, including stored v7
      `variants`, empty `variants`, and forbidden variant fields.
- [x] Finding 12: the NodeNext consumer fixture type-checks the renderer
      snippet from `mokly-rendering.md`.
- [x] Build, lint, format, typecheck, example build and check, full unit
      suite, and affected browser specs; commit.

## Milestone 13: Verification ratchets and file splits

- [x] Finding 29: split the files that grew past 300 lines in this plan
      (`src/registry/manifest_validation.ts`,
      `src/registry/manifest_entries.ts`, `src/build/mock_links.ts`,
      `packages/viewer/src/shell/workspace_data.ts`,
      `packages/viewer/src/standalone/bootstrap.ts`,
      `packages/viewer/src/shell/use_comparison.ts`, and
      `packages/viewer/src/shell/store_browser.ts`) by responsibility with no
      behavior change.
- [x] Split the additional files caught by the exact `origin/main` ratchet
      (`src/review/component_classification_sources.ts` and
      `src/server/http.ts`) by responsibility with no behavior change.
- [x] Add the TypeScript file-length ratchet, the protocol doc cap ratchet,
      and the unused internal export check with its shrinking baseline to the
      repository suite of `cargo xtask check` as documented, with tests;
      Rust changes follow the repository's Rust rules.
- [x] `cargo xtask check --suite repository` and the full unit suite pass;
      commit.

## Milestone 14: Shell review fixes

Tags: ui

- [x] Finding 3: the workspace reads the single comparison mode owned by
      `useComparison` instead of a copy; a browser test switches sibling
      variants in Side by side and asserts the Props return-to-Current
      message and disabled highlighting.
- [x] Finding 5: unknown frame-link ids show the missing view in
      uncontrolled and standalone shells and a later selection re-applies its
      route; a controlled Viewer emits only `onError` and keeps its display;
      unit and browser tests for both modes.
- [x] Finding 4: drop `InstanceRef.variantId` and frame matching by variant;
      `onScreenNavigate` carries `snapshotId` when historical content was
      committed; tests build references from the documented shape and check
      the live event payload.
- [x] Finding 6: component variant rows use the component-shaped variant icon
      from the Milestone 10 mockups; extend the mockup-versus-runtime row test
      to the Components section.
- [x] Component variant entry pages use the parent component's title as the
      heading, with the id chip, status, and Details describing the shown
      variant entry, matching the Milestone 10 mockups; test.
- [x] Finding 26: dark-scheme availability counts removed component variants;
      test.
- [x] Finding 27: a removed variant whose former parent is not an eligible
      parent shows the former parent's title as a plain-text crumb; test.
- [x] Build, lint, format, typecheck, full unit and browser suites, and an
      `npm run dev` smoke with screenshots; commit.

## Milestone 15: Follow-up verification, close-out, and review

- [x] Update key-code pointers in the touched READMEs and `plans/README.md`.
- [x] Run `cargo xtask check`; fix anything it reports until it passes.
- [x] Commit with a `BREAKING CHANGE:` footer naming the end of comparisons
      against baselines built by earlier Mokly versions, the removed
      `InstanceRef.variantId`, and the `ScreenNavigateEvent` fields; push.
- [x] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Milestone 16: Follow-up review contract

Update the protocol docs, guides, and READMEs for the user's decisions on the
follow-up review (2026-09-29) before any code changes. Finding numbers refer
to the [follow-up review](#follow-up-review-milestones-915).

- [x] Deleted resources (finding 1, option B): one owning paragraph in
      `mokly-changes.md` states the single rule both comparison paths share:
      a resource that is a regular file at the branch point, is deleted, and
      is still referenced by the current document is a verified deletion in
      committed and derived output modes and for every resource type,
      including embedded HTML documents; it marks its consumers as changed and
      never makes Changes unavailable. It lists the rejected cases (never
      present at the branch point, dangling or escaping symlinks, unsafe or
      source-root paths, newly missing files) and states that snapshot
      generation still requires current references to resolve.
- [x] Ratchets (findings 4, 6, 12, 13): `verification-ratchets.md`,
      `ci-verification.md`, and `xtask/README.md` state that every ratchet
      compares with `git merge-base HEAD origin/main`; the file-length and
      unused-export ratchets audit `.ts`, `.tsx`, `.mts`, `.cts`, `.js`,
      `.mjs`, and `.cjs` modules under the three roots; the unused-export
      baseline rejects any entry absent from the merge-base baseline, so it
      can only shrink; and the protocol doc cap ratchet scans
      `docs/protocol/**` recursively, excluding `fixtures/`.
- [x] Release notes (finding 5, option B): restore the unreleased
      navigation-path breaking-change note and add the
      `defineComponent().entry` to `.entries` change in `npm-release.md`,
      splitting the doc instead of raising its cap; state the release-note
      coverage rule: before a close-out commit, the note names every `feat!`
      commit in `origin/main..HEAD`.
- [x] Docs corrections (findings 14, 15, 17): update the delivery-status lines
      of the eight protocol docs that still describe delivered milestones as
      approved targets; `ScreenNavigateEvent.snapshotId` is present when the
      committed historical record has a published identity (`mokly-viewer.md`
      and `packages/viewer/README.md`); `mokly-catalogue.md` states that
      removed variants of a removed parent follow that parent in baseline
      authored order.
- [x] Artifact paths (finding 10): define the shared snapshot-side and
      snapshot-resource builders, their exact output and confinement rules, and
      the callers that must not compose or slice snapshot literals themselves.
- [x] `npm run format:check`, the protocol and guide doc tests, and a relative
      link check pass; review the diff; commit.

## Milestone 17: Follow-up fixes in review, registry, and paths

- [x] Finding 1 (option B): failure-first, one table of deletion cases
      (committed and derived output modes; stylesheet, image, and embedded
      HTML; present or absent at the branch point; unsafe paths) runs against
      both the unified classifier and the screen-level classifier; both use
      one shared deleted-resource decision, including the byte comparison and
      embedded-document reads.
- [x] Finding 7: a component parent that fails `validateComponentDefinition`
      stays available for relationship checks; tests for both failure paths
      show one root-cause error.
- [x] Finding 10: shared builders for the snapshot side and snapshot resource
      paths replace the hand-built `snapshots/` paths in `src/review/assets.ts`,
      `src/review/artifact_resources.ts`,
      `packages/viewer/src/previews/request.ts`,
      `packages/viewer/src/previews/presentation.ts`, and
      `src/server/public_review.ts`; a repository-wide scan test fails on
      `snapshots/` or `pages/…json` path literals outside the shared path
      module.
- [x] Finding 15: a unit test shows a removed record without a published
      identity announces navigation without `snapshotId`.
- [x] Finding 17: a projection test pins removed-entry order when a parent and
      its variants are all removed.
- [x] Finding 16 (mechanical, no behavior change): delete the unused
      `variantId` parameter of `useComparison`, the unreachable `TargetView`
      comparison branch and the `DiffScreen` wrapper, the stale comment in
      `src/review/base_manifest.ts`, the unreachable schema check in
      `src/components/manifest_validation.ts`, and the dead link in
      `docs/reviews/catalogue-inputs-and-aliases.md`; rename route-named
      functions and values that carry ids (`viewerCapabilityRoute`, the
      `route` value from `activeIdForView`, `containsRoute`).
- [x] Build, lint, format, typecheck, example build and check, full unit
      suite, affected browser specs, and `cargo xtask check --suite
repository`; commit.

## Milestone 18: Ratchet fixes

- [x] Finding 6: every ratchet compares with `git merge-base HEAD
origin/main`; a test where `origin/main` moved after the branch point
      passes.
- [x] Finding 4: the file-length and unused-export ratchets include
      JavaScript modules under the three roots; fix what they flag, including
      `scripts/package/consumer_cases.mjs` and the unused exports in the
      ratchet modules; tests.
- [x] Finding 12: the unused-export baseline rejects entries absent from the
      merge-base baseline; test.
- [x] Finding 13: the protocol cap ratchet and
      `tests/protocol_doc_sizes.test.ts` scan `docs/protocol/**` recursively,
      excluding `fixtures/`; test.
- [x] `cargo xtask check --suite repository` and the full unit suite pass;
      commit.

## Milestone 19: Second follow-up close-out and review

- [x] Update key-code pointers in the touched READMEs and `plans/README.md`.
- [x] Confirm the release note in `docs/protocol/npm-release.md` names every
      `feat!` commit in `origin/main..HEAD` (finding 5).
- [x] Run `cargo xtask check`; fix anything it reports until it passes.
- [x] Commit; push.
- [x] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Milestone 20: Second follow-up review contract

Update the protocol docs, guides, and READMEs for the user's decisions on the
second follow-up review (2026-09-30) before any code changes. Finding numbers
refer to the
[second follow-up review](#second-follow-up-review-milestones-1619).

- [x] Release notes (finding 1, option B): move the unreleased breaking-change
      coverage rule and release notes from `npm-release.md` into a new
      `npm-release-notes.md`, lowering the `npm-release.md` cap. Name each
      export removed since the last release with its replacement:
      `catalogueViewHref`, `publicPath`, `pagePreviewPath`,
      `componentFragmentRoute`, `ManifestV5`, `ReviewResultV3`, and
      `ScreenReviewV3` from `@mokly/viewer/data`; `defineCollection`,
      `collection`, `CollectionDefinition`, `CollectionInput`,
      `NestedCollectionInput`, and `RoutedEntryInput` from `@mokly/mokly`.
      Add notes for rejected Windows device-name ids and for `?variant=`
      links, stating the current behavior and what to use instead.
- [x] Public export check (finding 1, option B): `verification-ratchets.md`
      defines a repository ratchet that compares each published package's
      export map and entry-point exports with the newest release tag
      reachable from `HEAD` (`v[0-9]*` for `@mokly/mokly`, `viewer-v[0-9]*`
      for `@mokly/viewer`). It fails unless every removed export subpath and
      export name appears as an inline code span in `npm-release-notes.md`.
      Names added and removed between releases need no note; a package whose
      release manifest records a release but whose tag is missing fails
      closed with a fetch instruction; public entry points list their exports
      explicitly, without `export *`; and a note can be deleted only once
      history includes the release that published the removal.
      `ci-verification.md` and `xtask/README.md` list the ratchet and its tag
      requirement.
- [x] Registry (finding 2, option A): `mokly-variants.md` states that when a
      component parent fails its metadata or definition validation,
      preparation reports the parent's violations once and does not validate
      its variants' props, controls, or slots against it; the variants are
      validated once the parent is valid.
- [x] CommonJS use (finding 4, option A): `verification-ratchets.md` defines
      which exports the `require()`, `import x = require()`, default-import,
      and dynamic-import forms use: destructured names and direct property
      reads use those names; a binding of the whole module object uses every
      export; a default import uses every export of a CommonJS module and
      none of an ES module; a bare `require()` uses none.
- [x] Delivery history (finding 7, option B): remove every plan-milestone
      reference from `docs/protocol` outside `fixtures/`, keeping each
      sentence's contract content, and correct the delivery status in
      `verification-ratchets.md`. `docs/protocol/README.md` states that
      protocol docs never record which plan milestone delivered them, and
      that a test enforces this.
- [x] `npm run format:check`, the protocol and guide doc tests, and a relative
      link check pass; review the diff; commit.

## Milestone 21: Registry and test fixes

- [x] Finding 2 (option A): failure-first, a table in
      `tests/component_registry_validation.test.ts` covers a parent with a
      select control that has no options, a parent with an invalid prop
      schema, and a parent with a metadata problem and an invalid control.
      Each reports only the parent's violations, with no `TypeError` and no
      variant violation, and a valid parent still reports an invalid
      variant's props. Variant prop, control, and slot validation then runs
      only against a parent that passed definition validation.
- [x] Finding 6 (option A): make three tests able to fail, and show for each
      that a plausible regression makes it fail:
  - the identity-less navigation test drives the real route, selection, and
    announcement path, paired with a removed record that has a published
    identity;
  - the removed-order test uses variant ids whose baseline authored order
    differs from id order, plus a removed entry whose id sorts between the
    parent and its variants;
  - each rejected row of the deleted-resource table asserts its exact error
    code and message.
- [x] Build, lint, format, typecheck, example build and check, full unit
      suite, affected browser specs, and the repository suite of
      `cargo xtask check`; commit.

## Milestone 22: Release-note, CommonJS, and doc-history checks

- [x] Finding 1 (option B): the public export ratchet defined in
      `verification-ratchets.md`, with temporary-repository tests: an
      unnoted removed name or subpath fails, a noted one passes, a name added
      and removed after the last tag passes, a missing tag fails closed, an
      unresolved star target fails, recursive stars contribute their names,
      and deleting a note before its release fails; the repository itself
      passes.
- [x] Finding 4 (option A): the unused-export ratchet records `require()`,
      `import x = require()`, default imports of CommonJS modules, and
      whole dynamic-import bindings as the contract defines; a test covers
      each form, including a destructured `require()` that leaves another
      export unused.
- [x] Finding 7 (option B): a doc test fails when a protocol document outside
      `fixtures/` references a plan milestone.
- [x] Once these checks land, the delivery status in `verification-ratchets.md`
      and `ci-verification.md` says every ratchet is implemented.
- [x] The released `viewer-v0.3.0` root entry re-exports types with
      `export type * from`, so Milestone 20's rule that public entry points
      must not use `export *` could never pass. Star re-exports now expand
      recursively on both sides, and an unresolvable star target fails
      closed; `verification-ratchets.md` states the new rule. The expansion
      surfaced three released root types without notes, `CatalogueCollection`,
      `CatalogueRoutedEntry`, and `CatalogueVariant`, now in
      `npm-release-notes.md`.
- [x] The repository suite of `cargo xtask check` and the full unit suite
      pass; commit.

## Milestone 23: Third follow-up close-out and review

- [ ] Update key-code pointers in the touched READMEs and `plans/README.md`.
- [ ] Confirm `npm-release-notes.md` names every `feat!` commit in
      `origin/main..HEAD`.
- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit; push.
- [ ] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Review record

Milestones 2–8 (`a6fe0da`..`d227702e`) were reviewed with the [implementation
review prompt](../docs/implementation-review-prompt.md) after the full gate
and push, split by area across six read-only reviewers who each checked their
findings against the cited lines. The coordinator re-checked both High
findings and findings 3–8, 12, and 13 directly in the code; finding 9 still
needs a browser test to confirm, finding 10 is confirmed only for the
root-level base case, and the remaining findings rest on the reviewers' cited
evidence with coordinator spot checks. No finding was applied automatically;
all await the user's decision.

1. **High** — the review producer sorts affected consumers by a `:`-joined key
   while the v4 reader requires a `\u0000`-joined order, so two changed
   components such as `button` and `button-group` make a valid result invalid
   and Changes unavailable (`src/review/component_affected.ts`,
   `packages/viewer/src/review/result_validation.ts`).
2. **High** — export resolves `#…` references in a relocated v3–v6 snapshot
   document against a synthetic `<base dir>/index.html`, so CSS `url(#id)` in a
   `style` attribute or `<style>` block aborts export and publish with Changes
   during the upgrade window (`src/export/references.ts`).
3. **Medium** — switching sibling component variants while comparing leaves
   the workspace's copy of the comparison mode at Current, so Props stay
   editable and highlighting stays on during a comparison
   (`packages/viewer/src/shell/workspace.tsx`, `diffs.tsx`).
4. **Medium** — `InstanceRef` still carries and matches `variantId`, which the
   viewer and instance contracts removed, so documented references never match
   component-variant frames; the viewer docs and README also still promise
   `snapshotId` on navigation events.
5. **Medium** — an embedded frame link to an unknown id shows the missing view
   without changing the selection, leaving the viewer stuck and bypassing the
   controlled host (`packages/viewer/src/shell/store_host.ts`).
6. **Medium** — component-variant navigation rows shipped without updating the
   design mockups under `examples/basic/entries/design/`, and component
   variants use the screen-shaped variant icon the docs no longer describe.
7. **Medium** — the component-variant registry and manifest rules (parent
   existence and kind, nesting, `navPath`, inheritance, no-variant components,
   stored v7 `variants`) have no tests.
8. **Medium** — a review whose baseline and head reuse one id across kinds
   fails as a duplicate Changes entry, though the catalogue contract allows it.
9. **Medium** — relocation rewrites `<use href="#…">` to a full snapshot URL,
   which likely stops sprite icons rendering in `srcdoc` previous-version
   previews; needs a browser test to confirm.
10. **Medium** — full-catalogue capture can relocate one entry onto another
    entry's stored path, and rejects a root-level `<base href="./">`, aborting
    export with Changes on the upgrade PR.
11. **Medium** — `review.json` ordering is stated three different ways across
    `mokly-changes.md`, `mokly-component-review-validation.md`, and the code.
12. **Medium** — `mokly-rendering.md` types `RenderInput.entry` as
    `ComponentDefinition`; the code uses `ComponentVariantDefinition`.
13. **Medium** — the packed-consumer snapshot check reads `beforePath` and
    `afterPath`, which review v4 removed, so it never checks anything
    (`scripts/package/export.mjs`).
14. **Low** — the v3 reader accepts current and removed records sharing an id,
    while shell checks treat such a current entry as removed.
15. **Low** — the device-name id rule also rejects `ReviewIgnore` ids and
    historical ids such as `aux`.
16. **Low** — screen-only Serve swallows classifier errors and falls back to a
    second comparison implementation.
17. **Low** — snapshot and preview file names are still composed by hand in
    about nine places instead of the shared path module.
18. **Low** — `parseViewHref` accepts `constructor` and `__proto__` prefixes.
19. **Low** — dead code and route-era names remain (for example
    `withFragmentQuery`, `safeDecode`, `resolveCatalogueRecord`,
    `CatalogueVariant`, unused viewer routing modules, unread `route` fields).
20. **Low** — smaller doc and code mismatches across export delivery, server,
    variants, component manifest, controls, live evidence, previews, guides,
    example notes, page migration, and selected comparisons.
21. **Low** — extensionless `/view/` handling is still hand-written in the
    shell and preview scripts.
22. **Low** — historical v4–v6 manifest validation was loosened.
23. **Low** — expanded historical component variants inherit the parent
    `rationale`, which current variants do not.
24. **Low** — a component parent that fails validation reports misleading
    missing-parent errors for each variant.
25. **Low** — removed-entry order differs from the documented rule when a
    removed variant's parent survives.
26. **Low** — dark-scheme availability ignores removed component variants.
27. **Low** — a removed variant whose former parent became a variant loses the
    parent breadcrumb the mockup shows.
28. **Low** — the v3 reader keeps the removed-variant-on-a-surviving-component
    path the plan deleted.
29. **Low** — several source files grew past about 300 lines, and 15 protocol
    doc size caps were raised instead of splitting docs.
30. **Low** — the breaking-change notes omit the viewer host API changes
    (`ViewerSelection.variantId` rejected; `ScreenNavigateEvent` narrowed).

**User decisions (2026-09-28):** option A removes compatibility with baselines
built by earlier Mokly versions, resolving findings 2, 9, 10, 15, 22, and 23
and deleting the leftovers behind findings 4, 14, 19, and 28. Findings 1, 3,
5–8, 11–13, 16, 18, 21, 24–27, 29, and 30 are fixed as recommended, with
these refinements confirmed by the coordinator: finding 8 uses option C,
finding 5 keeps a controlled Viewer's display unchanged, finding 4 also
restores `snapshotId` on navigation events, finding 11 also enforces the order
in the reader, finding 15 also fixes `ReviewIgnore` ids, and finding 29 uses a
ratchet against `origin/main`. Findings 17 and 20, omitted from both earlier
lists, are included. Milestones 9–15 carry the work.

### Follow-up review (Milestones 9–15)

Milestones 9–15, the merge of `origin/main` (#121), and the close-out
(`6caeb457`..`c16926ba`) were reviewed with the implementation review prompt
after the full gate and push, by four read-only reviewers. The coordinator
re-checked findings 1–7 directly in the code; the rest rest on the reviewers'
cited evidence. Approved findings 1, 3–6, 8 (cross-kind case), 11, 13, 15, 16,
18, 20–23, 25–27, and 30's listed items are complete; 12, 14, 17, 24, 28, and
29 are incomplete as listed below. No finding was applied automatically.

1. **Medium** — deleted but still-linked resources still make Changes
   unavailable in derived output mode and for deleted embedded HTML, a
   regression for screen-only catalogues since the fallback was removed
   (`src/review/component_resource_changes.ts`, `resource_comparison.ts`).
2. **Medium** — moving a component variant to another component makes the
   review result invalid, so Changes is unavailable and export with Changes
   fails (`src/review/component_variant_classification.ts`).
3. **Medium** — component variant page mockups omit the parent breadcrumb the
   runtime and the navigation path contract show, and no test compares them.
4. **Medium** — the file-length and unused-export ratchets skip every `.mjs`
   file under `scripts/`; `scripts/package/consumer_cases.mjs` grew 320→328.
5. **Medium** — Milestone 9 deleted the unreleased navigation-path breaking
   release note, and the notes omit `defineComponent().entry` → `.entries`.
6. **Medium** — the ratchets compare with the tip of `origin/main`, not the
   merge-base, so branches behind main and re-verified release tags can fail.
7. **Low** — finding 24 is partial: a parent failing
   `validateComponentDefinition` is still dropped (`src/registry/prepare.ts`).
8. **Low** — finding 28 is partial: removed per-view comparison and removed
   Changes on other current records are still accepted by the v3 reader.
9. **Low** — the tests for findings 14 and 28 pass without their fixes.
10. **Low** — finding 17 is partial: five places still build `snapshots/`
    paths by hand, and the guard test cannot catch them.
11. **Low** — the finding-12 check type-checks the doc snippet but never
    compares it with the exported `RenderInput`.
12. **Low** — the unused-export baseline can grow despite "can only shrink".
13. **Low** — protocol docs in subdirectories escape the cap ratchet.
14. **Low** — eight protocol docs and `plans/README.md` still describe
    delivered milestones as approved targets or pending.
15. **Low** — `snapshotId` is documented as present exactly for historical
    content but is omitted when a removed record has no published identity.
16. **Low** — dead code and route-era names remain (unused `variantId`
    parameter in `useComparison`, an unreachable comparison branch and
    `DiffScreen`, route-named id functions, a stale comment, an unreachable
    schema check, and a dead link in `docs/reviews`).
17. **Low** — the removed-entry order doc is wrong when a parent and its
    variant are both removed.
18. **Low** — the incompatible-baseline CLI line is not tested through the
    CLI reporters, the preview builder, or watched Serve's print-once rule.

**User decisions (2026-09-29):** finding 1 uses option B, finding 4 option A,
finding 5 option B, finding 6 option A, and finding 14 option A; findings 7,
10, 12, 13, 15, 16, and 17 are fixed as recommended. Findings 2, 3, 8, 9, 11,
and 18 are not pursued. Milestones 16–19 carry the work.

### Second follow-up review (Milestones 16–19)

Milestones 16–19 (`aa07039e`..`bc4cbe55`) were reviewed with the
implementation review prompt after the full gate and push, by two read-only
reviewers. The coordinator re-checked findings 1 and 2 in the code. Approved
follow-up findings 6, 12, 13, and 16 are complete; 1, 4, 5, 7, 10, 14, 15, and
17 are complete in code or docs with the gaps below. No finding was applied
automatically.

1. **Medium** — the release notes omit removals from the released
   `@mokly/viewer@0.3.0` data entry (`catalogueViewHref`, `publicPath`,
   `pagePreviewPath`, `componentFragmentRoute`, and the `ScreenReviewV3`,
   `ReviewResultV3`, and `ManifestV5` types), the rejection of Windows
   device-name ids, and the end of `?variant=` links.
2. **Low** — the finding 7 fix validates variants against a parent that just
   failed validation, so invalid parent controls (for example a select with no
   options) crash registry preparation with a `TypeError`, and an invalid prop
   schema repeats its error once per variant (`src/registry/prepare.ts`).
3. **Low** — the release-note coverage rule greps only `feat!`, missing
   `feat(scope)!:`, `fix!:`, and `BREAKING CHANGE:` footers such as
   `ca3e8273`; it pins branch SHAs that squash merges remove, and nothing
   enforces it.
4. **Low** — the unused-export ratchet ignores `require()` and default imports
   of `.cjs` modules, so the first `.cjs` helper would fail the gate falsely.
5. **Low** — the artifact path scan misses segment-joined paths such as
   `path.posix.join("snapshots", side, route)`, the pattern finding 10 cited.
6. **Low** — the new tests for findings 15 and 17 and the deletion table's
   rejection rows pass whether or not the behavior they pin holds.
7. **Low** — status lines were stale at close-out: the plan and
   `plans/README.md` said the close-out commit and push remained (updated when
   this review was recorded), and `verification-ratchets.md` credits the
   current ratchet contract to Milestone 13 instead of Milestone 18.

**User decisions (2026-09-30):** finding 1 uses option B, finding 2 option A,
finding 4 option A, finding 6 option A, and finding 7 option B; findings 3 and
5 are not pursued. Milestones 20–23 carry the work.

## Post-merge follow-up (non-blocking)

- Update Mokly Cloud and any external documentation that links to
  `/id/<id>` URLs, reads `route` from the public read model, sends
  `ViewerSelection.variantId`, or stores `InstanceRef.variantId`.
- Re-run `npm run benchmark:large` after the release to confirm the single
  shell write speeds up export.
