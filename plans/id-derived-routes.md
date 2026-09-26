# Id-Derived Routes

Status: Planned; not started. Created 2026-09-26 with the user's consent after
discussing route redundancy on the navigation-path branch. Implement in a new
PR after [PR #118](https://github.com/mokly-ai/mokly/pull/118) merges, because
it rewrites the same authoring, registry, and export surfaces.

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

**Decision (agreed with the user):** a route is a pure function of kind and
id. Authors never write `route`, `slug`, `segment`, or `path`; `navPath` is
the only hierarchy input, and nothing but the id moves a route. Ids stay flat
kebab-case. Hierarchy does not move into ids because ids are references
(`screenId`, `variantOf`, `useCaseIds`, `mock:<id>`): a folder move must stay
one changed entry, not a removal plus an addition, and folder labels must
stay free text rather than slugs.

| Kind                       | Route                  | Generated views                                               |
| -------------------------- | ---------------------- | ------------------------------------------------------------- |
| Screen, including variants | `screens/<id>.html`    | `screens/<id>.<viewport>[.dark].html`                         |
| Page                       | `pages/<id>.html`      | The route is the document                                     |
| Use case                   | `user-flows/<id>.html` | None; the route is logical                                    |
| Component                  | `components/<id>.html` | `components/<id>.variants/<variantId>.<viewport>[.dark].html` |

Ids contain no `.`, so `<id>.<suffix>.html` never collides with another id's
document. A screen variant has its own global id, so the `.variants/<slug>`
scheme and the variant `slug` disappear; component saved variants keep their
local ids beneath the component route. The four prefixes are reserved output
directories under `mockupsDir` and enter the existing collision inventory.

**Further decisions:**

- `route` stays on the wire (private manifest, public read model v2, review
  results, changed-route sets) as a derived, validated field, so the viewer
  keeps its route-keyed indexes and its search, details, and sort behavior.
  Collapsing viewer keys to ids is a later plan, not this one.
- The private manifest moves from schema 6 to 7 with an identical shape: v7
  asserts derived routes and fragments, and v3–v6 stay historical-only with
  authored routes validated as safe routes. Stale v6 output fails a strict
  read with a message that says to run `mokly build`.
- Static delivery moves from schema 2 to 3 and drops `idRoutes`. The export
  writes each shell once at `view/<route>`; `id/<id>/index.html`, the
  development `/id/` redirect, the preview `_redirects`, and
  `resolveDeliveryHref` are removed. `/view/<kind>/<id>.html` is the stable
  share URL because nothing but the id can move it.
- Every resolver that turns an id into a route has the catalogue read model
  (the shell, the builder, the server), so frame-link activation resolves ids
  through `byId` rather than through a delivery table. Unknown ids stay
  unavailable.
- Removed entries key by id: a baseline entry is removed when no current
  entry has its id, for every kind. A removed record keeps its baseline
  `route` and fragment paths as opaque history, the "a current route excludes
  historical content at that route" rule stays, and the "reused id at a
  distinct route" case can no longer occur.
- Migration guard: an authored `route` or `slug` key on any definition,
  nested leaf, or variant is one registry violation, `authored-route`, with
  the text `entry <id> cannot author <field>; routes derive from ids`.
  `segment` and `path` are TypeScript errors and are ignored at runtime.
- Windows device names such as `con`, `nul`, `prn`, `aux`, `com1`, and `lpt1`
  are valid kebab-case ids, so `invalid-id` now rejects them; the shared tag
  and link grammar is unchanged.
- One-time churn is accepted: the first build after upgrading marks every
  entry changed against its Git baseline and moves every generated file, and
  pending-orphan cleanup removes the old paths.
- Pure contract modules exported from `@mokly/viewer/data` are shared
  backend and viewer code; only shell, client, and store code counts as UI
  for milestone tagging.
- No mockup milestone: this repository has no `docs/mockups`, and the viewer
  has no visual change.

## Milestone 1: Documentation and protocol contract

Rewrite the protocol docs and guides so they define derived routes, the
removed authoring fields, id-keyed removal, delivery v3, and the URL surface
before any code changes.

- [ ] [`mokly-nav-paths.md`](../docs/protocol/mokly-nav-paths.md): remove
      root `path`, folder `segment`, and leaf `slug` route derivation; state
      that nothing but the id moves a route; keep label, conflict, order, and
      key rules unchanged.
- [ ] [`mokly-authoring.md`](../docs/protocol/mokly-authoring.md): drop
      `RoutedEntryInput` and every `route`, `slug`, `segment`, and `path`
      field from the interfaces; add the derived-route table and the reserved
      prefixes; add the device-name id rule and the `authored-route`
      violation; define the new `defineRoot` errors exactly:
      `root navPath must be an array`, `root <labels> has no children`, and
      `folder <labels> has no children`, where `<labels>` joins the root
      `navPath` plus ancestor and current folder titles with `›` using
      `String(title)`; remove the authored-route grammar sentences while
      keeping the static asset segment rule.
- [ ] [`mokly-screen-variants.md`](../docs/protocol/mokly-screen-variants.md):
      remove `slug`; the variant route is `screens/<variant id>.html`; the
      forbidden variant fields are `variants` and `navPath`; delete the
      duplicate-slug rule because `duplicate-id` covers it.
- [ ] [`mokly-pages.md`](../docs/protocol/mokly-pages.md) and
      [`mokly-page-migration.md`](../docs/protocol/mokly-page-migration.md):
      `PageInput` without `route`, nested pages without `slug`, output at
      `mockupsDir/pages/<id>.html`, no `/id/` URL.
- [ ] [`mokly-components.md`](../docs/protocol/mokly-components.md) and
      [`mokly-component-manifest.md`](../docs/protocol/mokly-component-manifest.md):
      `components/<id>.html`, manifest v7 with derived route and fragment
      validation, v6 demoted to historical.
- [ ] [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md),
      [`mokly-changes.md`](../docs/protocol/mokly-changes.md),
      [`mokly-catalogue-changes.md`](../docs/protocol/mokly-catalogue-changes.md),
      and [`mokly-removed-previews.md`](../docs/protocol/mokly-removed-previews.md):
      removal keyed by id, the reused-id precedence text deleted, current-route
      precedence kept, sort order unchanged, routes described as derived.
- [ ] [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md):
      delete the `id/<id>/index.html` row and the static alias paragraphs;
      delivery v3 without `idRoutes`; extensionless `/view/` normalization
      resolves against the read model's route index.
- [ ] [`mokly-navigation.md`](../docs/protocol/mokly-navigation.md): frame
      activation derives a `/view/<route>` destination from the marker id
      through the read model; delete the `/id/` redirect and the
      `/id/<id>?snapshot=` rejection rule.
- [ ] Sweep `mokly-runtime.md`, `mokly-design-links.md`,
      `mokly-configuration.md`, `mokly-instances.md`, `mokly-rendering.md`,
      `mokly-shell-design.md`, `mokly-upload.md`, `mokly-viewer.md`,
      `mokly-design-components.md`, `mokly-design-component-library.md`, and
      `mokly-guides.md` for `route:`, `slug`, `segment`, `/id/`, and
      `idRoutes`; leave only historical-manifest mentions.
- [ ] Update the authoring guides under `docs/guides/authoring/`, the start
      guide, the root `README.md` Authoring section, `examples/basic/README.md`,
      `src/catalogue/README.md`, `src/components/README.md`,
      `src/export/README.md`, and `packages/viewer/README.md`.
- [ ] Confirm the docs agree with each other with one grep for the removed
      terms; run `npm run format:check` on the changed Markdown; review the
      diff; commit.

## Milestone 2: Authoring, registry, and manifest

Derive routes in `src`, delete the authored route surface, write manifest v7,
and convert the example catalogue. The viewer is untouched and the export
still writes aliases from the derived routes, so the product works end to end.

- [ ] Add `entryRoute(kind, id)` beside `componentFragmentRoute` in a shared
      routes module exported from `@mokly/viewer/data`, move `fragmentRoute`
      there from `src/registry/manifest.ts`, and delete the `src` copy.
- [ ] Types in `src/authoring/types.ts` and `src/components/types.ts`: remove
      `RoutedEntryInput`; drop `route` from every input, `slug` from
      `ScreenVariantInput`, `NestedScreenInput`, and `NestedPageInput`,
      `segment` from `NestedFolderInput`, and `path` from `RootInput`;
      definitions keep a derived `route`.
- [ ] `defineScreen`, `definePage`, `defineUseCase`, and `defineComponent`
      set `route` from `entryRoute`, and a variant derives its own
      `screens/<variant-id>.html`; `defineRoot` and `flattenChild` stop
      threading a directory and use the new error texts.
- [ ] Failure-first tests: derived routes per kind, nested trees, variants,
      the `authored-route` guard for `route` and `slug`, the device-name id
      rule, and the new `defineRoot` errors.
- [ ] Registry: delete `validateRoute` in `entry_metadata.ts`,
      `duplicateViolations(…, "route")`, the variant route match,
      `duplicate-variant-slug`, `screenVariantRoute`, `isScreenVariantRoute`,
      `isScreenVariantSlug`, and the `route` and `slug` entries of the
      forbidden variant fields; keep `invalid-nested-nav-path` and the
      `navPath` equality check.
- [ ] Manifest: write `schemaVersion: 7`; strict validation requires
      `route === entryRoute(kind, id)` and derived fragments and drops the
      duplicate-route check; the historical boundary accepts 3–7 with v7
      validated like v6; rename `ManifestV6` types to `ManifestV7` and update
      `docs/protocol/fixtures/catalogue-v2.json` and manifest fixtures.
- [ ] Key `removedManifestEntries` by id for every kind; sort unchanged.
- [ ] Build and export inputs: `logical_routes.ts`, ownership, and page output
      use derived routes; delete `validateCatalogueRoute` (no callers) and
      keep `manifest_values.validateRoute` for historical reads only.
- [ ] Convert `examples/basic` (7 `route:`, 95 `slug:`, 30 `segment:`, and 1
      `path:` across 42 files) and the `scripts/large` fixture generator.
- [ ] `npm run build`, `npm run example:build`, `npm run example:check`, and
      `npm run dev`: the navigation tree is unchanged, `/view/screens/example-welcome.html`
      renders, and `/id/example-welcome` still redirects.
- [ ] First-build smoke: build once on the old layout, then on the new; old
      files disappear as pending orphans and Changes lists every entry once.
- [ ] `npm run test:prepared` and the affected browser tests pass; commit.

## Milestone 3: Viewer navigation without the id alias

Tags: ui

No visual change. The shell resolves ids through the read model and builds
`/view/` URLs directly, so it stops depending on `idRoutes` and `/id/`. The
delivery v2 shape is still parsed, with `idRoutes` unused, until Milestone 4.

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
      `snapshot` query; smoke-test through `npm run dev`.
- [ ] Commit.

## Milestone 4: Export, server, and delivery v3

Stop writing the alias, move static delivery to v3, and remove the
development redirect and preview redirects.

- [ ] `parseStaticDelivery` accepts only `schemaVersion: 3` without
      `idRoutes`; delete `resolveDeliveryHref`; remove `idRoutes` from
      `ExportRoutes`, `site.ts`, and `run.ts`; `site.ts` writes each shell
      once.
- [ ] Delete `redirectId` and the `/id/` branch in `http_routes.ts`; `/id/`
      now returns the not-found view.
- [ ] `scripts/preview/artifact.mjs` drops `idRoutes` and the `/id/`
      `_redirects` lines.
- [ ] Regenerate `docs/protocol/fixtures/export-ownership-v1.json` and the
      export inventory tests so no `id/` path remains.
- [ ] Failure-first tests: delivery v2 is rejected, export inventory has no
      `id/` files, the server answers `/id/…` with 404, package smoke passes.
- [ ] Static export smoke: run `mokly export` on the example, serve the
      directory with a plain static file server, and check
      `/view/screens/example-welcome.html`, frame links, `?fragment=`,
      Back/Forward, and a removed entry with `?snapshot=`.
- [ ] Commit.

## Milestone 5: Verification, close-out, and review

- [ ] Update key-code pointers in the touched READMEs and confirm
      `plans/README.md` describes the completed state.
- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit as a `feat!:` change with a `BREAKING CHANGE:` footer naming the
      removed authoring fields, the new route layout, manifest v7, delivery
      v3, and the removed `/id/` URLs; push.
- [ ] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Post-merge follow-up (non-blocking)

- Update Mokly Cloud and any external documentation that links to
  `/id/<id>` URLs.
- A later plan may drop `route` from the wire formats and key the viewer by
  id and kind.
- Re-run `npm run benchmark:large` after the release to confirm the single
  shell write speeds up export.
