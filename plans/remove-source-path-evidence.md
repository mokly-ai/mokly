# Remove Source-Path Evidence

## Status And Outcome

Status: in progress; Milestones 1–7 are complete and Milestone 8 verification
passed. The local milestone commit awaits reviewer push and post-push review.
The binding Decisions And Scope remove all three inputs and adopt
component-declared stylesheets in place of the stylesheet role of
`ownedDependencies`. The user approved both the removals and the component
stylesheet design on 2026-09-23 (UTC). The pull request merge is the
completion boundary; keep this plan active until then.

Remove the three author-maintained inputs that link mockups to repository paths:

- `dependencies` on every entry: `defineScreen`, `definePage`, `defineUseCase`,
  `defineCollection`, `defineComponent`, nested `screen`/`page`/`collection`
  markers, `defineRoot` collection metadata, and screen variants.
- `ownedDependencies` on `defineComponent`.
- `review.sharedImpact` in the configuration.

Add one input: `stylesheets` on `defineComponent`. Mokly links a declared
stylesheet into every document that renders the component and records that
component as the stylesheet's owner.

Afterwards Changes and comparison evidence come only from generated output, the
rendered resources a view references, reviewable metadata, collection ancestry
and component usage attribution, in every catalogue.

Today the removed inputs follow two rules. In a catalogue without registered
components they are comparison evidence only. In a catalogue with registered
components a match adds screens, flows and components to Changes. Most docs
describe only the first rule. Pull request #47 removed path-only matches from
Changes (292 to 141 entries on the Accounting catalogue); #48 brought them back
for catalogues with registered components.

This is a breaking change to authoring, configuration, the private manifest and
the public catalogue and comparison formats. The project is not in production,
so no compatibility shims are kept.

Contract owners:

- [Authoring](../docs/protocol/mokly-authoring.md),
  [components](../docs/protocol/mokly-components.md) and
  [configuration](../docs/protocol/mokly-configuration.md).
- [Rendering](../docs/protocol/mokly-rendering.md) and
  [watch](../docs/protocol/mokly-watch.md).
- [Changes](../docs/protocol/mokly-changes.md),
  [component attribution](../docs/protocol/mokly-component-changes.md) and
  [CSS attribution](../docs/protocol/mokly-css-attribution.md).
- [Component manifest](../docs/protocol/mokly-component-manifest.md) and the
  [catalogue read model](../docs/protocol/mokly-catalogue.md).

## Decisions And Scope

Raise any objection before Milestone 1 starts; these decisions shape every
milestone.

- One Changes rule for all catalogues. A source path never adds an entry to
  Changes and never appears as comparison evidence. Rendered-resource evidence,
  CSS rule analysis, Review-ignore, metadata, ancestry, flow propagation and
  component usage attribution stay unchanged.
- Component stylesheets replace the stylesheet role of `ownedDependencies`:
  - `defineComponent` accepts `stylesheets`: unique `mockupsDir`-relative
    public CSS files in authored order. HTTP(S) URLs are rejected, because
    Mokly must compare the files.
  - When a screen or component document renders at least one instance of a
    component, even an instance with no markup, Mokly links each of that
    component's stylesheets once. Links follow the order in which components
    first render and use the same href encoding as configured links. Pages are
    unchanged.
  - A configured stylesheet list may contain the `componentStylesheets`
    marker, exported by `@mokly/mokly`, once in its shared list. Component
    stylesheets go at the marker. Without the marker they go after the shared
    list and before the scheme-specific list.
  - Mokly inserts the links next to the neighbouring configured `<link>`
    elements that the renderer emitted, or at the end of `<head>` when the
    route has no configured stylesheets. A missing neighbouring link fails the
    build. `RenderInput` does not change.
  - Mokly records a `resources` ownership record for each linked declared
    stylesheet, owned by the rendered components that declare it. A file
    cannot be both configured and declared, and a renderer cannot report
    `resources` for a declared file. Files that a declared stylesheet imports
    stay unowned.
  - Serve reloads declared stylesheets like configured ones. Exports and
    publication handle them as public resources.
  - This replaces the documented rule "Separate stylesheet loading from review
    dependency declaration" and the example's per-render style collector.
    Renderer `styles` and `resources` records remain for all other material.
- Removed inputs fail loudly. `dependencies` on an entry, nested marker or
  variant, and `ownedDependencies` on a component, produce the registry
  violation `removed-field`. `review.sharedImpact` fails configuration loading
  with `config-invalid`. Each message names the field and says to delete it.
- Versions: private manifest v5 becomes v6. The public catalogue read model v1
  becomes v2 without `details.dependencies`. Comparison results v2 (catalogues
  without registered components) become v4, and v3 (with registered
  components) become v5, without result `sharedImpact` or entry `dependencies`
  and `sharedImpact`. Build and Review keep parsing historical v3 to v5
  manifests and strip the removed fields before comparison. The viewer reads
  only catalogue v2 and comparison v4/v5, so older exports must be regenerated.
  The live index stays process-local and adopts the v6 entry shape.
- Rendered-resource reasons keep the wire kind `dependency`, because they name
  resources a view depends on. Renaming them is out of scope.
- The Shared impact design screen is deleted because the state no longer
  exists. Comparison details keep rendered-resource, ignored-region,
  excluded-stylesheet and component evidence.
- Nested trees and screen variants keep inheriting `address` and `relatedDocs`.
- Out of scope: a future "code changed but the mockup did not" feature. Leave
  historical plans, `docs/reviews/**` and `CHANGELOG.md` unchanged.

## Current Implementation Boundaries

Verified on 2026-09-23 (UTC) with temporary fixtures:

- Without registered components, a changed file under a screen dependency or a
  `sharedImpact` glob adds nothing to Changes and is recorded as comparison
  evidence (`tests/server_changed.test.ts`, `tests/review.test.ts`).
- With registered components, the same change adds every matching screen, flow
  and component to Changes, unless a component's `ownedDependencies` covers the
  file (`ComponentDependencyPolicy` in `src/review/component_metadata.ts`,
  `tests/component_asset_changes.test.ts`).
- `ownedDependencies` also suppresses consumer resource evidence for owned
  rendered stylesheets (`suppressResource`) and routes CSS evidence to owners
  (`ownedCssReasons` in `src/review/component_resource_attribution.ts`). The
  same code already accepts renderer `resources` records, so ownership records
  that Mokly derives from declared stylesheets need no new classification path.

Where the work lands:

- Authoring: `src/authoring/{types,definitions,variants}.ts` and
  `src/components/{types,definition,manifest_build,manifest_validation,dependency_validation}.ts`.
- Rendering: `stylesheetsFor` in `src/build/render.ts` resolves configured
  links; `renderWithComponents` in `src/components/render.tsx` knows the
  rendered instances and ownership records after the renderer returns;
  `src/components/output_validation.ts` validates resource ownership;
  `src/config/rules.ts` validates stylesheet rules; `src/server/watch_paths.ts`
  lists the stylesheets Serve reloads.
- Registry and manifest:
  `src/registry/{entry_validation,entry_metadata,manifest,manifest_entries,manifest_validation,catalogue_index,dependency_paths}.ts`,
  plus the viewer data types in `packages/viewer/src/registry/types.ts` and
  `packages/viewer/src/components/manifest_types.ts`.
- Configuration: `src/config/{types,validate}.ts`.
- Classification: `src/review/{compare,screen_compare,selected,artifact,materiality}.ts`
  and
  `src/review/{component_classification,component_metadata,component_resource_attribution,component_view,component_projection_resources}.ts`.
- Public formats: `src/catalogue/{projection,serialization}.ts`,
  `packages/viewer/src/catalogue/{types,entry_reader,privacy}.ts`,
  `packages/viewer/src/viewer/projection.ts` and
  `packages/viewer/src/review/{types,component_types,result_records,result_validation}.ts`.
  About 40 source files branch on manifest v5 or comparison v2/v3.
- Viewer UI: the Dependencies row in `packages/viewer/src/shell/details.tsx`
  and legacy shared-impact paths in
  `packages/viewer/src/shell/workspace_evidence{,_data}.ts(x)`.
- Example: `examples/basic/mokly.config.ts`, `renderer.tsx`,
  `entries/design/library/{metadata.ts,style_files.ts,style_context.tsx}` (the
  per-render style collector), `src/components/*/*.mokly.tsx` and every
  entry's `dependencies`. Design mockups:
  `entries/design/review_impact_screens.tsx`,
  `entries/design/parts/{review.tsx,destinations.ts,navigation_states.ts}`,
  `entries/design/design.mockup.tsx` and
  `entries/design/components/parts/{component_info.tsx,metadata.ts}`.
- Tests and scripts: about 130 files, mostly fixture metadata, plus
  `scripts/package/{catalogue,consumer_cases}.mjs`, consumer fixtures under
  `tests/fixtures/consumers/` and `tests/fixtures/large/generate.ts`.

## Execution Rules

- Tests import `dist`; run `npm run build` before focused tests.
- Add each behavior test before the change it covers. Preservation tests pass
  before and after their change.
- Never hand-edit generated example output; regenerate it with
  `npm run example:build`.
- Keep every milestone green with its focused tests, `npm run typecheck` and
  `npm run lint`. Milestone 8 runs `cargo xtask check`.
- Before every subsequent milestone commit, run the complete unit suite with
  `npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"`.
  Require 100% passing tests and report the pass/fail counts.
- Update each protocol doc's Delivery Status when its milestone lands.
- Report review findings; do not fix them automatically.

## Post-merge follow-up (non-blocking)

- Upgrade `@mokly/viewer` in mokly-cloud to catalogue v2 and comparison v4/v5,
  then re-export and re-publish stored catalogues.
- Migrate consumer catalogues such as Accounting: delete the three inputs,
  declare component CSS with `stylesheets` instead of `ownedDependencies` and
  route rules, and rebuild committed output once for manifest v6.

## Milestone 1: Define the contract

Document the complete target before any code changes.

- [x] Component stylesheets: define the `stylesheets` input, the
      `componentStylesheets` marker, link order and placement, the anchor
      failure, derived ownership records, the conflicts, watch reloads and
      public-resource handling. Replace the style-collector guidance
      (`mokly-components`, `mokly-rendering`, `mokly-configuration`,
      `mokly-component-manifest`, `mokly-component-changes`, `mokly-watch`,
      `mokly-source-protection`, `mokly-design-components`,
      `mokly-design-component-library`, and the root export list in
      `mokly-authoring`).
- [x] Authoring: remove `dependencies` from entry, root-collection, nested and
      variant inputs and from inheritance, and define the `removed-field`
      violation (`mokly-authoring`, `mokly-screen-variants`, `mokly-pages`,
      `mokly-page-migration`).
- [x] Ownership: remove `ownedDependencies` and `declaredDependencies`;
      ownership comes from declared stylesheets and renderer `styles` and
      `resources` (`mokly-component-review`, `mokly-component-design`,
      `mokly-component-workspace-design`, `mokly-component-explorer`,
      `mokly-component-inspector-design`).
- [x] Changes: state the single membership rule and remove shared-impact and
      declared-dependency evidence, the exact-screen-dependency CSS rule, the
      Shared impact state, and the impact counts and "Shared-impact paths" in
      `summary.md` (`mokly-changes`, `mokly-catalogue-changes`,
      `mokly-css-attribution`, `mokly-css-evidence-shell`,
      `mokly-shell-design`, `mokly-runtime`, `mokly-timings`, `mokly-export`,
      `mokly-export-delivery`, `mokly-baseline-storage`,
      `mokly-derived-baselines`).
- [x] Configuration: remove `review.sharedImpact` and define its
      `config-invalid` error (`mokly-configuration`).
- [x] Formats: specify manifest v6 with historical v3 to v5 normalization,
      catalogue read model v2 with its fixture, comparison v4/v5 schemas, and
      reader rejection of older versions (`mokly-component-manifest`,
      `mokly-catalogue`, `mokly-changes`, `mokly-upload`, `mokly-export`,
      `docs/protocol/README.md`).
- [x] Guides and READMEs: `docs/guides/authoring/{screens,pages,collections-and-tags,components,config,use-case-flows}.md`,
      `docs/guides/catalogue/{changes,details}.md`,
      `docs/guides/start/{configure,your-first-screen}.md`, `README.md`,
      `examples/basic/{README,notes}.md`,
      `examples/basic/entries/design/library/README.md`,
      `src/components/README.md`, `src/review/README.md`,
      `docs/architecture/build-pipeline.md` and
      `tests/fixtures/consumers/esm/notes.md`.
- [x] Align other current contracts and developer notes that describe old
      format, fixture, style loading or evidence behavior (`mokly-publication`,
      `mokly-on-demand`, `mokly-package`, `mokly-selected-comparisons`,
      `mokly-viewer`, `mokly-design-links`, `mokly-removed-previews`,
      `npm-release`, `docs/architecture/package-boundary.md` and
      `src/catalogue/README.md`).
- [x] Mark each contract change as planned in its doc's Delivery Status.
- [x] Validate the changed Markdown with `npx prettier --check`, review the
      diff, and confirm no current doc describes the removed inputs except as
      removed.

## Milestone 2: Remove the depictions from the design mockups

Tags: mockup

Delete the design states that show source-path evidence. Keep the depictions of
rendered-resource evidence.

- [x] Delete the Shared impact design screen (`design-review-shared-impact`),
      its destination, navigation state and `SharedImpactCard`, and the
      "shared impact" wording in `design.mockup.tsx`. Confirm every remaining
      review design screen stays reachable.
- [x] Remove the Dependencies row and its data from the component inspector
      mockup (`component_info.tsx`, `components/parts/metadata.ts`).
- [x] Search the design entries for any other depiction of declared
      dependencies or shared-impact evidence and remove it.
- [x] Update the design inventory and link tests:
      `tests/fixtures/design-library/screens.json`,
      `tests/design_screens.test.tsx`, `tests/design_link_states.test.ts` and
      `tests/browser/comparison_design.spec.ts`.
- [x] Update the shared-library inventory test's pinned screen count for this
      approved deletion (`tests/design_library_inventory.test.ts`) and run it.
- [x] Update the remaining design link, usage and CSS attribution tests' pinned
      screen counts (`tests/design_links.test.ts`,
      `tests/design_library_usage.test.ts`,
      `tests/component_design_attribution.test.ts`) and run them.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`
      and the design tests. Smoke-test the review impact and component
      inspector pages at mobile and desktop widths through `npm run dev`.

## Milestone 3: Let components declare their stylesheets

Add the `stylesheets` input and move the example's component CSS to it. The
migrated example pages must render exactly as before; this milestone changes
how CSS loads, not the design.

- [x] Failure-first tests on a fixture catalogue with registered components:
      a declared stylesheet is linked only in documents that render the
      component, at the marker and at the default position; its ownership
      record names the rendered declaring components; an edit to it adds only
      the component to Changes and lists consumers under Affected screens
      without `ownedDependencies`; and each invalid case fails (missing file,
      HTTP URL, duplicate, a file both configured and declared, renderer
      `resources` for a declared file, a second or scheme-specific marker, a
      missing neighbouring link).
- [x] Authoring and configuration: add `stylesheets` to the component input,
      definition and validation; export the `componentStylesheets` marker and
      accept it in configured stylesheet lists.
- [x] Rendering: `stylesheetsFor` reports the marker position;
      `renderWithComponents` inserts the links after the renderer returns,
      derives the ownership records and rebases style-ownership offsets through
      the insertion. Serve's on-demand and transient renders use the same path.
- [x] Serve and resources: reload declared stylesheets in Serve and confirm
      resource validation, export and publication include them.
- [x] Migrate the example: each design library component declares its sheet
      through `libraryMetadata`; `example-action` and `example-toolbar`
      declare `example-components.css`, which leaves the `**/*.html` rule;
      configured design lists use the marker instead of the candidate pool;
      the renderer emits `input.stylesheets` directly. Delete the style
      collector (`style_context.tsx`, the `useDesignStyle` calls,
      `libraryStyleCandidates` and `withLibraryStyles`).
- [x] Update the design library tests (`tests/design_library_styles.test.ts`,
      `tests/component_design_attribution.test.ts`) and add a declared mode to
      the ownership tests (`tests/component_asset_changes.test.ts`,
      `tests/changes_css_ownership.test.ts`).
- [x] Prove the marker survives separate config bundling and packed consumer
      installation with the same `unique symbol` identity.
- [x] Run `npm run build`, `npm run example:build` and
      `npm run example:check`. Smoke-test design library pages and example
      component screens at both widths through `npm run dev`, and confirm the
      styles match the previous build.
- [x] Run the focused rendering, component, CSS, design and Serve tests,
      `npm run typecheck` and `npm run lint`.

## Milestone 4: Base Changes and evidence only on rendered output

Remove source-path evidence and `ownedDependencies` ownership from
classification, and remove `review.sharedImpact`.

- [x] Preservation test first on the example: an edit to one exclusive design
      library stylesheet and an edit to `example-components.css` each list
      only their owning components in Changes, with consumers under Affected
      screens. It passes after Milestone 3 and must keep passing.
- [x] Classification: delete declared-path reasons, shared-glob reasons, the
      exact-screen CSS rule and `ownedDependencies` ownership, so ownership
      comes only from view usage `styles` and `resources` records
      (`component_metadata.ts`, `component_resource_attribution.ts`,
      `component_classification.ts`, `component_view.ts`,
      `component_projection_resources.ts`). Remove dependency and shared-glob
      matching from `screen_compare.ts` and `compare.ts`, and delete
      `src/registry/dependency_paths.ts`.
- [x] Failure-first tests: with and without registered components, a changed
      repository file that no view renders adds nothing to Changes or
      comparison evidence, even when an entry still declares it.
- [x] Configuration: remove `review.sharedImpact` from types and validation,
      reject the key with `config-invalid`, and delete it from the example,
      consumer fixture configs and test helpers.
- [x] Remove the impact counts and "Shared-impact paths" from `summary.md`
      (`artifact.ts`, `materiality.ts`).
- [x] Update or delete the tests that asserted source-path behavior,
      including `tests/{review,server_changed,component_asset_changes,changes_css_ownership,server_changed_assets,export_cases,review_artifact_ui}.test.ts`
      and `scripts/package/consumer_cases.mjs`.
- [x] Align the component stylesheet contract and anchor test names with
      validation of every configured link, not only its neighbours; define the
      bundled marker's global key once and reuse it in the inline module.
- [x] Preserve non-CSS renderer-resource ownership even when the only edited
      resource is used at an actual invocation outside saved variants; add a
      failure-first test for component Changes and affected consumers.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      focused review, Changes, CSS, component, design, export and Serve tests,
      `npm run typecheck`, `npm run lint`, the complete unit suite, and
      `cargo xtask check`.

Until Milestone 6, `dependencies` and `ownedDependencies` are accepted but have
no effect on Changes or evidence. Until Milestone 7, comparison `sharedImpact`
holds only rendered-resource paths.

## Milestone 5: Remove the dependency displays from the viewer

Tags: ui

- [x] Remove the Dependencies row from the details inspector
      (`packages/viewer/src/shell/details.tsx`) for every entry kind.
- [x] Remove legacy shared-impact paths from comparison details
      (`workspace_evidence_data.ts`, `workspace_evidence.tsx`), so the list
      shows only rendered-resource reasons.
- [x] Update the viewer, client and browser tests, for example
      `tests/client_workspace_evidence.test.ts` and
      `tests/browser/evidence_workspace.spec.ts`.
- [x] Update the viewer shell README and protocol Delivery Status sections that
      still describe this inspector migration as pending.
- [x] Match the Milestone 2 mockups. Smoke-test the details and comparison
      details of a changed and an unchanged screen at both widths through
      `npm run dev`.
- [x] Run the focused viewer and browser tests, `npm run typecheck` and
      `npm run lint`.
- [x] Run the complete unit suite and `cargo xtask check` with a 100% pass
      rate before committing; confirm changed-file formatting and the diff.

## Milestone 6: Remove the authoring fields and move the manifest to v6

- [x] Failure-first `removed-field` tests: `dependencies` on each define
      helper, nested marker, root collection and variant, and
      `ownedDependencies` on a component.
- [x] Remove both fields and their inheritance from the authoring types and
      helpers, component definitions and registry validation.
- [x] Manifest v6: stop writing `dependencies`, `declaredDependencies` and
      `ownedDependencies`, make the current validator reject them, delete
      `validateDependencyDeclarations`, rename `ManifestV5` to `ManifestV6` in
      `@mokly/viewer/data` and its callers, and move the live index to the v6
      entry shape.
- [x] Update `README.md` from "current output requires manifest v5" to v6
      and update the assertion in `tests/component_protocol_docs.test.ts`
      together when manifest v6 ships.
- [x] Historical parsing accepts v3 to v5 and strips the removed fields before
      comparison. Failure-first test: a v5 baseline that carries all three
      fields, compared with the same catalogue built as v6, adds nothing to
      Changes in committed and derived modes.
- [x] Accept manifest-v6 completion markers for derived baselines and reuse
      the cached output; keep the original versions on historical markers.
- [x] Until Milestone 7, the public writers emit an empty
      `details.dependencies` and empty comparison entry `dependencies`.
- [x] Migrate the example (every entry, the design library metadata, the
      component registrations and now-unused helpers such as
      `componentStyleDependencies` and `DESIGN_DEPENDENCIES`), the test helpers
      and fixtures, the large-fixture generator and README code samples, then
      regenerate the example.
- [x] Migrate browser fixture entries and v5 assertions to manifest v6; run
      the affected Playwright specs against the migrated fixtures.
- [x] Smoke test: a consumer entry that still declares `dependencies` fails
      `mokly build` with the documented message.
- [x] Run the focused authoring, manifest, baseline, build and example tests,
      `npm run typecheck` and `npm run lint`.

## Milestone 7: Version the public catalogue and comparison formats

- [x] Catalogue read model v2 without `details.dependencies`: projection,
      serialization, viewer reader, types, display projection and privacy
      guards. Replace `docs/protocol/fixtures/catalogue-v1.json` with
      `catalogue-v2.json` and update its references in the viewer tests,
      `scripts/package/{archive,viewer,catalogue}.mjs`, `.prettierignore` and
      `src/catalogue/README.md`. The reader rejects v1 through the existing
      unsupported-version path.
- [x] Comparison results v4 and v5 without result `sharedImpact` or entry
      `dependencies` and `sharedImpact`: update the writers, `summary.md`,
      viewer types, validation and records, and every server, export,
      publication and reporter branch on versions 2 and 3. Readers reject v2
      and v3.
- [x] Failure-first tests for the new schemas and the rejected old versions;
      update the projection, export, publication and package-smoke
      expectations.
- [x] Align public-format Delivery Status notes and current server, review,
      export and viewer READMEs with shipped v2/v4/v5; update versioned CSS
      test names and remove obsolete impact assertions.
- [x] Migrate the browser's cross-origin catalogue and selected screen-only
      comparison version assertions to v2 and v4.
- [x] Run the focused catalogue, export, publication, viewer and package
      tests, `npm run typecheck` and `npm run lint`.

## Milestone 8: Verify, deliver and review

- [x] Search the repository, excluding historical plans, `docs/reviews/**` and
      `CHANGELOG.md`, for `ownedDependencies`, `declaredDependencies`,
      `sharedImpact`, entry `dependencies`, `useDesignStyle` and "impact
      evidence". Each remaining hit must describe the removal or be unrelated.
      Remaining hits are removal contracts and tests, historical manifest
      normalization, privacy guards, and unrelated package/runtime dependencies
      or implementation-impact evidence. The dated `docs/superpowers/specs/`
      design snapshot retains historical v2 `sharedImpact` shapes; it is not a
      current contract and is left unchanged.
- [x] Mark every changed protocol doc's Delivery Status as implemented and
      update this plan's status.
- [x] Remove plan-milestone references from normative protocol text; keep
      them only in Delivery Status sections.
- [x] Smoke test through `npm run dev`: design library pages and example
      component screens load their declared stylesheets; an edit to an
      exclusive component stylesheet lists only its component in Changes with
      consumers under Affected screens; an edit to an unreferenced source file
      adds nothing. Run `npm run example:check`.
- [x] Run `cargo xtask check` and require a 100% pass rate.
- [x] Inspect `git diff --name-status origin/main` and its deletions, and
      record every approved removal in the commit body.
- [x] Run `git add -A`, commit with a breaking-change Conventional Commit
      (`feat!:` with a `BREAKING CHANGE:` footer that lists the migrations),
      and push the branch.
- [ ] Merge `origin/main` (#115, screen variants and history) into the
      branch. Audit main's additions first, resolve each conflict path by
      path, migrate main's new fixtures, tests and docs to this plan's
      contracts without dropping main's features, rerun `cargo xtask check`,
      and push.
- [ ] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report numbered findings with
      severity, impact, lettered options and a recommendation, without
      changing the implementation.
