# Id-Derived Routes And Unified Variants

Status: Planned; not started. Created 2026-09-26 with the user's consent after
discussing route redundancy on the navigation-path branch; the variant
unification was folded in the same day. Implement in a new PR after
[PR #118](https://github.com/mokly-ai/mokly/pull/118) merges, because it
rewrites the same authoring, registry, and export surfaces. Mokly is not live,
so this plan adds no backwards compatibility: readers it rewrites accept only
the new versions, and there are no migration guards or transitional shapes.

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

**Decision (agreed with the user):** a route is a pure function of kind and
id, and every variant of either kind is a routed entry with a global id and
`variantOf`. Authors never write `route`, `slug`, `segment`, or `path`;
`navPath` is the only hierarchy input, and nothing but the id moves a route.
Ids stay flat kebab-case. Hierarchy does not move into ids because ids are
references (`screenId`, `variantOf`, `useCaseIds`, `mock:<id>`): a folder
move must stay one changed entry, not a removal plus an addition, and folder
labels must stay free text rather than slugs.

| Kind      | Route                  | Generated views                          |
| --------- | ---------------------- | ---------------------------------------- |
| Screen    | `screens/<id>.html`    | `screens/<id>.<viewport>[.dark].html`    |
| Page      | `pages/<id>.html`      | The route is the document                |
| Use case  | `user-flows/<id>.html` | None; the route is logical               |
| Component | `components/<id>.html` | `components/<id>.<viewport>[.dark].html` |

A variant of either kind is a routed entry of its parent's kind, so the table
covers it. Ids contain no `.`, so `<id>.<suffix>.html` never collides with
another id's document. The `.variants/` directory scheme disappears for both
kinds, and one `fragmentRoute(route, viewport, scheme)` serves every view. The
four prefixes are reserved output directories under `mockupsDir` and enter
the existing collision inventory.

**Further decisions:**

- A component parent entry owns the prop schema, slots, controls, and color
  schemes and has no views of its own; its page shows its first variant in
  authored order, as it does today. A component variant entry carries `props`,
  the supplied slots, its views, and `variantOf`, copies the parent `navPath`,
  and is a nav child, a search result, a Changes row, and a `mock:` link
  target exactly like a screen variant. Selecting a variant is navigation to a
  sibling route; the `?variant=` query and `variantValues` are deleted.
- `route` stays on the wire (private manifest, public read model, review
  results, changed-route sets) as a derived, validated field. Every viewer
  index, comparison, and sort keyed by route stays correct because strict
  validation guarantees `route === entryRoute(kind, id)`. Removing `route`
  from the wire formats and keying the viewer by id and kind is a mechanical
  follow-on plan with no design decisions left; it is not part of this one.
- The private manifest moves from schema 6 to 7 and the public read model from
  2 to 3. The strict readers accept only the new versions. The historical
  manifest boundary keeps accepting v6 without new work because derived
  baselines rebuild the merge-base commit with that commit's own Mokly
  version, so the upgrade PR's baseline arrives as v6 with authored routes.
  Removing the historical v3–v5 and legacy-page readers is a separate cleanup.
- The review result moves from schema 3 to 4: component variant addresses,
  `variantId` contexts, and instance records name the variant entry id. The
  reader accepts only schema 4.
- Static delivery moves from schema 2 to 3 and drops `idRoutes`. The export
  writes each shell once at `view/<route>`; `id/<id>/index.html`, the
  development `/id/` redirect, the preview `_redirects`, and
  `resolveDeliveryHref` are removed. `/view/<kind>/<id>.html` is the stable
  share URL because nothing but the id can move it. The parser and the writer
  change in the same milestone.
- Every resolver that turns an id into a route has the catalogue read model
  (the shell, the builder, the server), so frame-link activation resolves ids
  through `byId` rather than through a delivery table. Unknown ids stay
  unavailable.
- Removed entries key by id: a baseline entry is removed when no current
  entry has its id, for every kind, including variants. A removed record
  keeps its baseline `route` and view paths as opaque history, the "a current
  route excludes historical content at that route" rule stays, and the
  "reused id at a distinct route" case can no longer occur. A removed variant
  whose parent survives is an ordinary removed entry with `variantOf`.
- No runtime migration guard: the TypeScript input types are the contract, and
  an unknown key is ignored at runtime as it is today. `defineComponent` keeps
  rejecting unknown variant fields.
- Windows device names such as `con`, `nul`, `prn`, `aux`, `com1`, and `lpt1`
  are valid kebab-case ids, so `invalid-id` now rejects them; the shared tag
  and link grammar is unchanged.
- One-time churn is accepted: the first Changes comparison after upgrading
  lists every entry once because every route moved, and a committed-output
  catalogue's pending-orphan cleanup removes the old files.
- Backend milestones may change `packages/viewer` registry, catalogue,
  review, and other data-layer modules and make compile-only shell
  adaptations with no behavior change, following the navigation-path and
  screen-variant plans; shell behavior changes live in `ui` milestones.
- No mockup milestone: this repository has no `docs/mockups`, and the shell
  reuses the existing screen-variant rows, breadcrumbs, and details for
  component variants.

## Milestone 1: Documentation and protocol contract

Rewrite the protocol docs and guides so they define derived routes, the
removed authoring fields, unified variants, id-keyed removal, the new schema
versions, and the URL surface before any code changes.

- [ ] [`mokly-nav-paths.md`](../docs/protocol/mokly-nav-paths.md): remove
      root `path`, folder `segment`, and leaf `slug` route derivation; state
      that nothing but the id moves a route; variants of both kinds copy the
      parent path; keep label, conflict, order, and key rules unchanged.
- [ ] [`mokly-authoring.md`](../docs/protocol/mokly-authoring.md): drop
      `RoutedEntryInput` and every `route`, `slug`, `segment`, and `path`
      field from the interfaces; add the derived-route table and the reserved
      prefixes; add the device-name id rule; define the new `defineRoot`
      errors exactly: `root navPath must be an array`,
      `root <labels> has no children`, and `folder <labels> has no children`,
      where `<labels>` joins the root `navPath` plus ancestor and current
      folder titles with `›` using `String(title)`; remove the
      authored-route grammar sentences while keeping the static asset segment
      rule.
- [ ] Generalize [`mokly-screen-variants.md`](../docs/protocol/mokly-screen-variants.md)
      into the variant contract for screens and components, renamed to
      `mokly-variants.md` with every link updated: global ids, `variantOf`,
      copied `navPath`, derived routes, inheritance per kind, forbidden fields
      `variants` and `navPath`, public grouping, and removal.
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
      `variants`; manifest v7 with derived routes and views; the explorer's
      variant selection as sibling-route navigation without `?variant=`;
      review result v4 and instance records addressing variant entry ids;
      `MockLink` targeting a variant.
- [ ] [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md),
      [`mokly-changes.md`](../docs/protocol/mokly-changes.md),
      [`mokly-catalogue-changes.md`](../docs/protocol/mokly-catalogue-changes.md),
      [`mokly-removed-previews.md`](../docs/protocol/mokly-removed-previews.md),
      and [`mokly-export.md`](../docs/protocol/mokly-export.md): read model
      v3 with `variantsById` covering both kinds, removal keyed by id, the
      reused-id precedence text deleted, current-route precedence kept, sort
      order unchanged, component variant rows in Changes, routes described as
      derived.
- [ ] [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md):
      delete the `id/<id>/index.html` row and the static alias paragraphs;
      delivery v3 without `idRoutes`; extensionless `/view/` normalization
      resolves against the read model's route index.
- [ ] [`mokly-navigation.md`](../docs/protocol/mokly-navigation.md): frame
      activation derives a `/view/<route>` destination from the marker id
      through the read model; delete the `/id/` redirect and the
      `/id/<id>?snapshot=` rejection rule.
- [ ] Sweep `mokly-runtime.md`, `mokly-design-links.md`,
      `mokly-configuration.md`, `mokly-rendering.md`, `mokly-shell-design.md`,
      `mokly-upload.md`, `mokly-viewer.md`, and `mokly-guides.md` for
      `route:`, `slug`, `segment`, `/id/`, `idRoutes`, `?variant=`, and
      `variantValues`; leave only historical-manifest mentions.
- [ ] Update the authoring guides under `docs/guides/authoring/`, the start
      guide, the root `README.md` Authoring section, `examples/basic/README.md`,
      `src/catalogue/README.md`, `src/components/README.md`,
      `src/export/README.md`, and `packages/viewer/README.md`.
- [ ] Confirm the docs agree with each other with one grep for the removed
      terms; run `npm run format:check` on the changed Markdown; review the
      diff; commit.

## Milestone 2: Authoring, registry, and manifest routes

Derive routes in `src`, delete the authored route surface, write manifest v7,
and convert the example catalogue. Component variants stay local in this
milestone and keep their views beneath `components/<id>.variants/`. The shell
is untouched and the export still writes aliases from the derived routes, so
the product works end to end.

- [ ] Add `entryRoute(kind, id)` beside `componentFragmentRoute` in a shared
      routes module exported from `@mokly/viewer/data`, move `fragmentRoute`
      there from `src/registry/manifest.ts`, and delete the `src` copy.
- [ ] Types in `src/authoring/types.ts` and `src/components/types.ts`: remove
      `RoutedEntryInput`; drop `route` from every input, `slug` from
      `ScreenVariantInput`, `NestedScreenInput`, and `NestedPageInput`,
      `segment` from `NestedFolderInput`, and `path` from `RootInput`;
      definitions keep a derived `route`.
- [ ] `defineScreen`, `definePage`, `defineUseCase`, and `defineComponent`
      set `route` from `entryRoute`, and a screen variant derives its own
      `screens/<variant-id>.html`; `defineRoot` and `flattenChild` stop
      threading a directory and use the new error texts.
- [ ] Failure-first tests: derived routes per kind, nested trees, screen
      variants, the device-name id rule, and the new `defineRoot` errors.
- [ ] Registry: delete `validateRoute` in `entry_metadata.ts`,
      `duplicateViolations(…, "route")`, the variant route match,
      `duplicate-variant-slug`, `screenVariantRoute`, `isScreenVariantRoute`,
      `isScreenVariantSlug`, and the `route` and `slug` entries of the
      forbidden variant fields; keep `invalid-nested-nav-path` and the
      `navPath` equality check.
- [ ] Manifest: write `schemaVersion: 7`; strict validation accepts only 7,
      requires `route === entryRoute(kind, id)` and derived views, and drops
      the duplicate-route check; the historical boundary accepts 3–7 with v7
      validated like v6; rename `ManifestV6` types to `ManifestV7` and update
      the manifest fixtures.
- [ ] Key `removedManifestEntries` by id for every kind; sort unchanged.
- [ ] Build and export inputs: `logical_routes.ts`, ownership, and page output
      use derived routes; delete `validateCatalogueRoute` (no callers) and
      keep `manifest_values.validateRoute` for historical reads only.
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

Flatten component variants into routed entries with global ids, mirroring
`defineScreen`, and carry them through the manifest, read model v3, review
result v4, instances, and removal. Shell changes are compile-only: the
explorer keeps its `?variant=` selection by reading the parent's variants
through `variantsById`, so behavior is unchanged until Milestone 4.

- [ ] `defineComponent` validates variant ids with the global id grammar,
      returns the parent entry followed by one entry per variant in authored
      order (`kind: "component"`, `variantOf`, `props`, supplied slots,
      copied `navPath`, inherited color schemes, derived route), and the
      module-bound loader flattens the array; the parent has no `variants`.
- [ ] Manifest v7 component shapes: the parent without `variants` or views;
      variant entries with `views` for every viewport and color scheme at
      `components/<variant-id>.<viewport>[.dark].html`; `componentViews` per
      variant entry; delete `componentFragmentRoute` and the `.variants/`
      directory.
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
      entry with `variantOf`; `changedManifestRoutes` treats variant entries
      like screens; delete the surviving-component removed-variant paths in
      `src` and the viewer data layer.
- [ ] Review result v4 in `src/review/*` and `packages/viewer/src/review/*`:
      variant addresses, `variantId` contexts, and instance records name the
      variant entry id; the reader accepts only v4; `artifactRouteForEntry`
      picks the parent's first variant entry.
- [ ] Compile-only shell adaptation: `workspace_data.ts` builds
      `WorkspaceVariant` rows from `variantsById` so the variant bar,
      controls, and comparison keep working with `?variant=`; no behavior
      change.
- [ ] Convert the 18 example component definitions to global variant ids and
      update the design catalogue entries that reference them.
- [ ] Failure-first tests for flattening, validation, manifest, read model,
      removal, and review addressing; `npm run example:check`; `npm run dev`
      smoke: component pages and variant selection behave as before; commit.

## Milestone 4: Explorer navigation by variant route

Tags: ui

Component variants become nav rows, breadcrumbs, details, and Changes rows
through the existing screen-variant presentation, and selecting a variant
navigates to its route.

- [ ] Nav tree, breadcrumbs, head, details, and Changes rows treat component
      variants like screen variants; the parent row discloses them.
- [ ] The variant bar links to sibling variant routes; controls state,
      comparison, and preview expiration key on the current entry; delete
      `?variant=` parsing, `variantValues`, and the unknown- or
      duplicate-variant selection error.
- [ ] Removed component variants render as removed rows with the parent
      title, using the existing removed-variant presentation.
- [ ] Failure-first viewer unit and browser tests: selecting a variant changes
      the URL, Back/Forward restore it, a removed variant opens with its
      `snapshot` query, and a `mock:` link to a variant lands on it;
      smoke-test through `npm run dev`; commit.

## Milestone 5: Viewer navigation without the id alias

Tags: ui

No visual change. The shell resolves ids through the read model and builds
`/view/` URLs directly, so it stops depending on `idRoutes` and `/id/`. The
export still writes delivery v2 until Milestone 6; the shell ignores
`idRoutes`.

- [ ] `same_origin_navigation.ts` returns the logical destination (id,
      fragment, target) and the shell resolves it through `catalogue.byId` and
      `routeHref`; `frame_event_router.tsx` stops building `/id/` hrefs; an
      unknown id yields the missing view.
- [ ] Remove `/id/` handling from `store_browser.ts`, `store_host_routes.ts`,
      and `store_browser_routes.ts`; remove the alias branch and
      `collidingLegacy` from `routeFromUrl`; extensionless `/view/`
      normalization checks the read model's route index instead of
      `idRoutes`.
- [ ] Delete the reused-id precedence paths in `entry_selection.ts`,
      `capability_adoption.ts`, and `catalogue.ts` while keeping current-route
      precedence over historical content.
- [ ] Failure-first viewer unit and browser tests: frame click, modifier
      click, and named-target navigation land on `/view/` URLs; Back/Forward
      and reload keep route identity; a removed entry still opens with its
      `snapshot` query; smoke-test through `npm run dev`; commit.

## Milestone 6: Export, server, and delivery v3

Stop writing the alias, move static delivery to v3 in the parser and the
writer together, and remove the development redirect and preview redirects.

- [ ] `parseStaticDelivery` accepts only `schemaVersion: 3` without
      `idRoutes`; delete `resolveDeliveryHref`; remove `idRoutes` from
      `ExportRoutes`, `site.ts`, and `run.ts`; `site.ts` writes each shell
      once.
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
      `/view/screens/example-welcome.html`, a component variant route, frame
      links, `?fragment=`, Back/Forward, and a removed entry with
      `?snapshot=`.
- [ ] Commit.

## Milestone 7: Verification, close-out, and review

- [ ] Update key-code pointers in the touched READMEs and confirm
      `plans/README.md` describes the completed state.
- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit as a `feat!:` change with a `BREAKING CHANGE:` footer naming the
      removed authoring fields, global component variant ids, the new route
      layout, manifest v7, read model v3, review result v4, delivery v3, and
      the removed `/id/` URLs; push.
- [ ] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Post-merge follow-up (non-blocking)

- Next plan: remove `route`, `fragments`, `darkFragments`, and `views` paths
  from the wire formats and key the viewer's indexes, URLs, and comparisons
  by id and kind. After this plan every stored route is derived, so that
  change is mechanical.
- Separate cleanup: delete the historical v3–v5 manifest readers and the
  legacy v2 page migration once no derived baseline can still produce them.
- Update Mokly Cloud and any external documentation that links to
  `/id/<id>` URLs.
- Re-run `npm run benchmark:large` after the release to confirm the single
  shell write speeds up export.
