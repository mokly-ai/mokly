# Remove Source-Path Evidence

## Status And Outcome

Status: Milestones 1 to 20B, including 19A, are implemented, verified and
pushed. The branch
was reviewed twice after the earlier deliveries. Milestones 9 to 11 fixed the review findings that the user
chose on 2026-09-25, and Milestones 12 to 15 implemented the user's 2026-09-26
decisions. Milestones 16 to 21 merge main 0.13.0 and apply the 2026-10-03 CSS
change rule, which replaces the finding 1 rule; findings 2 to 11 await the
user's decision. Milestones 22 to 25 apply the user's 2026-10-04 decisions on
the third review.
Milestone 16 is implemented, verified and pushed as merge `77773e56`. The merge
includes main through `b2c82c15`,
including imported CSS (#125), route-scoped bootstraps (#120), and the STE
instructions (#128), in addition to the five originally listed commits.
Milestone 17 is complete and verified. It documents the uniform CSS change rule. Milestone 18 depicts the
outside-component evidence in the design mockups. Milestone 19 is implemented
and verified. Milestone 19A is implemented and verified.
It integrates main's output/frame race fixes (#129) and expiring audit exception
(#130) through `800fe9f8`. The complete gate passes, including the audit.
The two-parent merge and line-level preservation checks pass; the reviewer
pushed it as `1bd54f7e`. Milestone 20 is implemented, verified and pushed as
`d91e1443` for screens and component saved views. It found that no approved
design shows evidence in a whole-document page's Details, so Milestones 20A
(mockup) and 20B (ui) now hold that display. Milestone 20A is implemented,
verified and pushed as `0f43cf0a`. Milestone 20B is implemented, verified and
pushed as `710e2d5d`. Milestone 21 verification is complete. The complete gate,
the separate required unit command and the browser smoke checks pass at 100%.
Part 1 records this evidence in a local commit only. The reviewer owns the
push and the review after the push. Both remain open, and the plan stays active
until the pull request merges.
The contract changes
unreleased manifest v8, catalogue v4 and comparison v5 in place. CSS resource
owners no longer route stylesheet changes; declared links and their provenance
remain. The review refinement uses kept own-page matches for component
membership. Nesting alone does not change enclosing components. Page rows
retain inclusive containment. Milestone 19 implements that contract.
The binding Decisions And Scope remove all three inputs and adopt
component-declared stylesheets in place of the stylesheet role of
`ownedDependencies`. The user approved both the removals and the component
stylesheet design on 2026-09-23 (UTC). The pull request merge is the
completion boundary; keep this plan active until then.

Remove the three author-maintained inputs that link mockups to repository paths:

- `dependencies` on every entry: `defineScreen`, `definePage`, `defineUseCase`,
  `defineComponent`, nested `screen`/`page`/`folder` markers, `defineRoot`
  path metadata, and screen and component variants.
- `ownedDependencies` on `defineComponent`.
- `review.sharedImpact` in the configuration.

Add one input: `stylesheets` on `defineComponent`. Mokly links a declared
stylesheet into every document that renders the component. It records only
inserted-link provenance for comparison exclusion. No derived CSS resource
owner record remains. Changed rules identify changed components through
kept matches on their own saved pages after the nested-component test;
outside matches and unresolved rules give
the page its own Changes row.

Afterwards Changes and comparison evidence come only from generated output, the
rendered resources a view references, reviewable metadata, navigation paths
and component usage attribution, in every catalogue.

Before this plan, the removed inputs followed two rules. In a catalogue without registered
components they were comparison evidence only. In a catalogue with registered
components a match added screens, flows and components to Changes. The former docs
described only the first rule. Pull request #47 removed path-only matches from
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
  Review-ignore, metadata, ancestry, flow propagation, document-style ownership
  and non-CSS resource attribution stay unchanged. CSS follows the binding
  2026-10-03 rule for configured, declared, CSS-imported and JavaScript-bundled
  stylesheets:
  - Match every changed rule against both available documents after paired
    Review-ignore. Keep matched elements and their side-specific output ranges.
  - First collect every component's unfiltered own-page matches for the rule,
    in any variant, viewport, scheme or before/after side. X changes only if it
    keeps a match in its root output on an own page. A different nested Y takes
    that match from X when Y has any own-page match for the same rule, before
    filtering Y's nested output. Y need not be changed. A nested X never takes
    its own match; the test needs no ordering and supports mutual nesting.
    Only kept matches give X's saved variants component reasons. Renderer
    wrappers outside the root are page elements. Consumer invocation matches
    alone never establish a component's own-page matches.
  - A page gets a direct row for any match outside components changed by that
    same rule, or for unresolved rules. This page test includes all nested
    output inside a changed component's occurrence. Otherwise consumers remain under those
    components' Affected screens. A page-only component saved-view reason gives
    that entry a row, but no affected consumers for that rule.
  - Equal normalized before/after selectors and declarations identify the same
    changed rule across stylesheets, including generated copies. Missing sides
    distinguish additions, removals and edits. Paths and owner records are not
    part of that identity.
  - The result retains each rule's changed component ids and page selectors.
    Comparison details group outside matches and unresolved evidence under the
    actual stylesheet path. The protocols define exact product copy.
- Component stylesheets replace the stylesheet role of `ownedDependencies`:
  - `defineComponent` accepts `stylesheets`: `mockupsDir`-relative public CSS
    files in authored order. HTTP(S) URLs are rejected, because Mokly must
    compare the files. Repeating one real file, including through an alias,
    links it once at its first occurrence and warns.
  - When a screen or component document renders at least one instance of a
    component, even an instance with no markup, Mokly links each of that
    component's stylesheets once. Links follow the order in which components
    first render and use the same href encoding as configured links. Pages are
    unchanged.
  - A configured stylesheet list may contain the `componentStylesheets`
    marker, exported by `@mokly/mokly`, once in its shared list. Component
    stylesheets go at the marker. Without the marker they go after the shared
    list and before the scheme-specific list.
  - Mokly inserts links next to the nearest present configured `<link>` in
    configured order, taking the first occurrence of a repeated renderer link.
    If none is present, insert at the end of head content. Missing, repeated
    or reordered configured links do not fail placement. `RenderInput.stylesheets`
    contains configured and generated imported links; declared component links
    are added internally, and `input.entry` omits `stylesheets`.
  - Mokly stops deriving CSS `resources` records. The use audit is in the
    stylesheet ownership contract. Temporary linking data supplies declarer ids
    directly to `insertedStylesheets`; no remaining use needs derived owners.
    Reuse a configured link without duplicating it. Renderer `resources`
    records for every stylesheet are ignored after safety checks, with one
    `ignored-stylesheet-resource-owner` warning per route/file identity. This
    replaces the declared-only warning. Non-CSS `resources` and document
    `styles` retain their current meaning.
  - Page comparison omits Mokly-inserted declared-stylesheet links except a
    component page's root-owned links. A private final-document provenance
    record identifies those links through compatibility and Review-ignore;
    renderer-authored links remain page content. Resource and CSS evidence
    remains based on the actual linked files.
  - Serve reloads declared stylesheets like configured ones. Exports and
    publication handle them as public resources.
  - This replaces the documented rule "Separate stylesheet loading from review
    dependency declaration" and the example's per-render style collector.
    Renderer `styles` records remain for document material; `resources` records
    remain only for files that are not stylesheets.
- Removed inputs are ignored with a warning: `dependencies` on an entry,
  nested marker, root path metadata or variant, `ownedDependencies` on a
  component or saved component variant, and
  `review.sharedImpact` in configuration. They add no evidence or ownership;
  TypeScript input types still reject the authoring fields.
- [Graceful handling](../docs/protocol/README.md#graceful-handling) governs
  redundant or conflicting inputs when output stays correct and safe. Build,
  Check, export, publish and Serve collect and deduplicate structured warnings
  across configuration, registry and render stages, including Serve children.
  Warnings do not affect exit codes; plain and rich CLI reporting follows the
  [warning contract](../docs/protocol/mokly-build-warnings.md).
- Versions after the 0.13.0 integration: manifest v8 is main's v7 without
  `dependencies`, `declaredDependencies` or `ownedDependencies`, and retains
  declared-stylesheet provenance. Historical readers accept manifest v3 to v7,
  drop collection records, flatten earlier component variants, and strip the
  removed fields before v8 validation and comparison. Catalogue read model v4
  is main's v3 without `details.dependencies`. Unified comparison result v5 is
  main's v4 without result `sharedImpact` or entry `dependencies` and
  `sharedImpact`. All catalogues use that one classifier and format. Public
  readers reject catalogue v1 to v3 and comparison v4 and earlier; regenerate
  older exports. The process-local live index adopts the v8 entry shape.
  The unreleased versions change in place for CSS: v8 adds an explicit root
  output range and stops writing CSS resource owners; v5 adds rule identity,
  changed component ids and page evidence; v4 carries the same public evidence
  on views and whole-document pages. Historical CSS owner records are ignored.
  Keep main's fixed pane paths and unchanged snapshot bytes. Historical v3–v6
  metadata with an older entry or view layout makes Changes unavailable, with
  the existing earlier-baseline message; do not add historical-origin handling.
- Rendered-resource reasons keep the wire kind `dependency`, because they name
  resources a view depends on. Renaming them is out of scope.
- The Shared impact design screen is deleted because the state no longer
  exists. Comparison details keep rendered-resource, ignored-region,
  excluded-stylesheet and component evidence.
- Collections and collection APIs no longer exist. Entries use `navPath`,
  nested trees use `folder()`, and `defineRoot` holds root path metadata.
  Nested trees and screen variants retain the inheritance defined by main's
  authoring contract, including `address` and `relatedDocs`, but never the
  removed fields.
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

- Consider an opt-in check that warns when a changed or existing component
  stylesheet rule matches elements outside its component.
- Upgrade `@mokly/viewer` in mokly-cloud to catalogue v4 and comparison v5,
  then re-export and re-publish stored catalogues.
- Migrate consumer catalogues such as Accounting: delete the three inputs,
  declare component CSS with `stylesheets` instead of `ownedDependencies` and
  route rules, and rebuild committed output once for manifest v8.

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
- [x] Merge `origin/main` (#115, screen variants and history) into the
      branch. Audit main's additions first, resolve each conflict path by
      path, migrate main's new fixtures, tests and docs to this plan's
      contracts without dropping main's features, and rerun `cargo xtask check`.
      The reviewer pushed this merge (`b801d0c8`) after checking it.
- [x] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report numbered findings with
      severity, impact, lettered options and a recommendation, without
      changing the implementation.

Review outcome (2026-09-24, against `origin/main` at `2ec4d837`): 13 findings,
each verified against the code, were reported to the user for a decision and
were not fixed. After a follow-up test on 2026-09-25, finding 2 (renderer
ownership records for declared stylesheets on pages without the declaring
component) is Low, because the CSS rule check limits its effect. That leaves
3 Medium and 10 Low findings. The Medium findings are consumer Changes rows
caused by Mokly-inserted component stylesheet links (1), missing tests for the
marker at the start or middle of a list (3), and docs that still describe older
formats or behavior as current (4).

On 2026-09-25 the user chose to fix findings 1, 4, 5, 6, 7, 8, 9, 10, 12 and
13, and asked for a protocol rule that prefers graceful handling to build
failures where Mokly can still produce correct output. Findings 2, 3 and 11
are not scheduled. Milestones 9 to 12 hold this work. The fixes for findings
1 and 7, and the scope of the graceful-handling rule, await the user's
confirmation and will get their own milestones before Milestone 12.

On 2026-09-26 the user decided the open items:

- Finding 1: option B. When Mokly compares a page, it leaves out every link
  that it inserted for a declared stylesheet, except the links of the page's
  own root component.
- Finding 7: option B. After a compatibility transform, Mokly keeps owner
  records only for the declared stylesheets that the page still links.
- Graceful-handling rule: add it to the protocol and apply it to four cases
  that stop the build today: a component that lists one file twice; a
  configured link that the renderer leaves out, repeats or reorders; a file
  that is both configured and declared; and a renderer owner record for a
  declared stylesheet, which Mokly ignores (this also fixes finding 2).
- Removed fields: option C. Add build warnings, then ignore `dependencies`,
  `ownedDependencies` and `review.sharedImpact` with a warning instead of
  stopping the build. Mokly also warns when it ignores a renderer owner record.
- Finding 3: option B. Add marker placement tests and one test for each
  placement rule.

These replace the matching bullets in Decisions And Scope. Milestones 12 to 14
hold this work; the final verification, delivery and review move to
Milestone 15. Finding 11 stays unscheduled.

## Milestone 9: Document the confirmed review fixes

Update the contracts before code changes. This milestone changes docs only.

- [x] Finding 4: correct every current doc that describes older formats or
      removed behavior as current. Known lines: `docs/protocol/README.md:37,60`,
      `mokly-runtime.md:74`, `mokly-selected-comparisons.md:54,59`,
      `mokly-page-migration.md:74,76,119`, `mokly-catalogue-changes.md:53,62`,
      `mokly-instances.md:127,166`, `mokly-pages.md:150`, `mokly-export.md:292`,
      `mokly-removed-previews.md:145`, `mokly-changes.md:242-244,424`,
      `docs/architecture/build-pipeline.md:5-8,317-318`,
      `docs/architecture/package-boundary.md:5-8,24`, `examples/basic/README.md:3-6`,
      `tests/fixtures/consumers/esm/notes.md:3-6`, the design library screen
      count in `examples/basic/entries/design/library/README.md:151` and the
      code comment in `src/server/changed_content.ts:73`. Search for others.
- [x] Finding 4: document that retained evidence for non-CSS resources goes to
      the components that own the resource at the actual invocation
      (`mokly-component-changes.md`, `mokly-component-review.md`,
      `mokly-css-attribution.md`), and remove the wrong "not yet implemented"
      status line from `mokly-timings.md`.
- [x] Finding 5: state in the authoring contract that the public input types
      reject `dependencies` and component `ownedDependencies`.
- [x] Finding 6: state in the watch and stylesheet contracts that watched Serve
      watches every declared stylesheet from startup and after reconfiguration.
- [x] Finding 8: two declared paths that resolve to one real file are linked
      once per page, with one ownership record that lists every rendered
      component that declares the file.
- [x] Finding 9: a configured link is any `<link>` whose `rel` includes the
      `stylesheet` token. Mokly needs the end of `<head>` only when it adds
      links there, and it never fails because the renderer omitted optional
      tags such as `</head>`.
- [x] Finding 10: the renderer's `input.entry` has no `stylesheets` field. When
      a renderer links a declared stylesheet itself, Mokly adds no second link
      and still records the rendered declaring components as owners.
- [x] Align the rendering/component contracts and module READMEs with the
      renderer-facing entry projection, and correct the remaining stale
      component README status.
- [x] Validate the changed Markdown with `npx prettier --check` and review the
      diff.

## Milestone 10: Link to the Matched styles design screen

Tags: mockup

Finding 13: no design screen links to "Matched styles"
(`design-review-style-matched`) since the Shared impact screen was deleted.

- [x] Choose the related review screen whose "Changes" filter should open
      "Matched styles", so that the depicted catalogue, counts and story stay
      consistent. Keep every other design screen reachable from another design
      screen.
- [x] Update the navigation states and design-links spec row
      (`docs/protocol/mokly-design-links.md:255`); verify the inventory is
      unchanged because no screen id, route or count changed.
- [x] Restore a test that enters "Matched styles" from that screen.
- [x] Assert every design screen has another design screen linking to it or
      appears in an explicit, minimal catalogue-tree-only list.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`
      and the design tests, and smoke-test the changed screens at mobile and
      desktop widths through `npm run dev`.
- [x] Run the complete unit suite with a 100% pass rate before committing.

## Milestone 11: Implement the confirmed review fixes

- [x] Finding 5: add `dependencies?: never` to every authoring input type and
      `ownedDependencies?: never` to the component input type. Add
      `@ts-expect-error` cases to the packed consumer type check
      (`tests/fixtures/consumers/nodenext/api.tsx`) and remove the leftover
      `dependencies` in `tests/component_authoring_types.tsx`.
- [x] Finding 6: watched Serve watches declared stylesheets from startup and
      after reconfiguration. Test the real startup order.
- [x] Finding 8: link each real file once per page and merge the owners into
      one record. Test with a symlink alias and a CSS edit.
- [x] Finding 9: accept any `rel` that includes `stylesheet`, and insert at the
      end of the head content without failing when `</head>` is omitted.
- [x] Finding 10: remove `stylesheets` from the entry that the renderer gets,
      at runtime and in the `RenderInput` type. When the renderer already
      links a declared file, add no second link and keep the ownership record.
- [x] Finding 12: make `tests/review.test.ts` "unrendered source" and
      `scripts/package/consumer_cases.mjs` assert an unchanged screen with no
      evidence; make the variant and root non-inheritance tests declare the
      field on the parent and expect exactly one violation; make
      `packages/viewer/tests/details_contract.test.tsx` inject the old fields;
      remove removed fields from v6 test data; rename stale test names; move
      the unique checks of `tests/design_library_style_collector.test.tsx`
      into `tests/design_library_styles.test.ts` and delete the file; delete
      `stylesheetsFor` after moving its test caller to
      `stylesheetPlacementFor`.
- [x] Finding 4: add a docs test that fails when a current doc describes an
      older format, a removed field or shared impact as current. Use the stale
      lines from Milestone 9 as regression cases.
- [x] Remove the discovered `declaredDependencies` field from the v6 page
      fixture in `tests/server_removed_preview_lifecycle.test.ts` too.
- [x] Preserve valid dot-prefixed public alias filenames when recognizing a
      renderer-authored link to a declared real file; add a regression test.
- [x] Reuse renderer-authored local stylesheet links with query/fragment
      suffixes when they resolve to a declared real file; add a regression test.
- [x] Run `npm run build`, `npm run typecheck`, `npm run lint`,
      `npm run example:build`, `npm run example:check`, the focused tests and
      the complete unit suite, and require 100%.

## Milestone 12: Document the remaining review decisions

Update the contracts for the 2026-09-26 decisions. Docs only.

- [x] Add the graceful-handling rule to `docs/protocol/README.md`: Mokly stops
      a build only when it cannot make correct, safe output, or when an input
      has two possible meanings. When an input is not necessary, or disagrees
      with a more specific input, Mokly uses the more specific input and
      continues. When Mokly ignores an input that the author wrote, it shows a
      warning. Link to the rule from the contracts that apply it.
- [x] Finding 1: the page comparison leaves out every link that Mokly inserted
      for a declared stylesheet, except the root component's own links on a
      component page. Define how the comparison identifies inserted links.
      The mechanism must survive the compatibility transform and Review-ignore
      normalization, and must not change what the page renders. Rendered
      resource evidence, CSS rule analysis and owner attribution for the file
      contents stay unchanged. Add the case to the attribution table.
- [x] Finding 7: after the compatibility transform, keep owner records only
      for the declared stylesheets that the final page still links.
- [x] Rule cases: a component that lists one file twice gets one link; missing,
      repeated or reordered configured links place component links next to the
      configured links that are present (first occurrence, then the nearest
      present neighbour, then the end of the head content); a file that is
      both configured and declared keeps its configured link and gets the
      rendered declaring components as owners; renderer owner records for any
      declared stylesheet are ignored on every page with a warning.
- [x] Removed fields: `dependencies`, `ownedDependencies` and
      `review.sharedImpact` produce a warning and have no effect. Define the
      exact warning text.
- [x] Build warnings: define how build, check, export, publish and Serve
      collect warnings and how the CLI shows them in plain and rich output.
      Warnings do not change the exit code, and each distinct warning shows
      once per run.
- [x] Update the matching Decisions And Scope bullets in this plan.
- [x] Validate the changed Markdown and run the docs tests.

## Milestone 13: Implement the stylesheet comparison and graceful handling

- [x] Finding 1: failure-first tests. A parent that starts to show a child
      with declared stylesheets puts only the parent in Changes, with its
      consumers affected. A component that adds a stylesheet puts only the
      component in Changes. A component page keeps its own links in the
      comparison. The complete and fast comparison paths agree.
- [x] Finding 7: a test with a transformer that removes an inserted link.
- [x] Rule cases 1 to 4, each with a failure-first test. The case 4 test uses a
      renderer record for a declared stylesheet on a page without the
      declaring component, and proves that Changes names the right entries.
- [x] Finding 3: marker placement tests with the marker first, in the middle
      and missing, and one table test for each placement rule, including the
      new cases.
- [x] Keep public-file protection when ignoring a renderer owner record;
      cover an excluded symlink alias and retain structured ignored-record
      warnings in exhaustive and requested-document results.
- [x] Split the component stylesheet protocol into linked declaration and
      ownership/comparison documents and update referring contracts and READMEs.
- [x] Run the focused tests, `npm run typecheck`, `npm run lint`,
      `npm run example:build`, `npm run example:check` and the complete unit
      suite at 100%.

## Milestone 14: Add build warnings and ignore removed fields

- [x] Add the build warning channel from Milestone 12 to build, check, export,
      publish and Serve, with plain and rich CLI output.
- [x] Removed fields produce the documented warning instead of the
      `removed-field` violation or `config-invalid`, and have no effect. The
      TypeScript types still reject them.
- [x] Ignored renderer owner records produce a warning.
- [x] Propagate warnings from failed background builds and transient Serve
      renders without exposing them in client responses.
- [x] Tests for each command, for deduplication and for the exit code.
- [x] Run the focused tests, `npm run typecheck`, `npm run lint`,
      `npm run package:smoke` and the complete unit suite at 100%.

## Milestone 15: Verify, deliver and review the fixes

- [x] Merge `origin/main` at `3699c566` (#119, mokly-cloud logo). The merge had
      no conflicts and keeps all of #119's files.
- [x] Run `cargo xtask check` and require a 100% pass rate. On the merged
      branch it passed 2,507 unit tests, 783 browser tests and 10 Rust tests.
- [x] Inspect `git diff --name-status origin/main` and its deletions. The four
      deletions are plan-approved: the example style collector, the old
      dependency validator and path matcher, and the old style-collector test.
- [x] Run `git add -A`, commit with a Conventional Commit, and push the branch.
- [x] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report numbered findings with
      severity, impact, lettered options and a recommendation, without
      changing the implementation.

Second review outcome (2026-09-26, against `origin/main` at `3699c566`): 11
findings, each checked in the code, were reported to the user and not fixed:
1 High, 4 Medium and 6 Low. The High finding is that an edit to a file
imported by a declared component stylesheet can leave Changes empty. The
Medium findings are repeated warnings after a watched rebuild, the lost
excluded-only stylesheet mockup, tests that do not protect several fixes, and
a docs guard test that misses stale lines.

On 2026-10-02 the user chose option B for second-review finding 1 and agreed to
merge `origin/main` first. `main` had moved by five commits, released as
0.13.0: #123 replaced collections with `navPath` and `folder()` and moved the
formats to manifest v7, catalogue read model v3 and one comparison result v4;
#122 made `mokly publish` upload content deltas; #121 aligned comparison pane
scrolling. Second-review findings 2 to 11 still await the user's decision.

Finding 1, option B: for every CSS file that reaches a page through a
component, either declared in `stylesheets` or imported by a declared file,
Mokly checks which elements a changed rule matches:

- Only elements inside the owning component's output: the component gets the
  Changes row, and the screen is under Affected screens.
- Any element outside the owning component: the screen gets its own row.
- Mokly cannot decide (custom properties, global selectors, unreadable
  selectors): the screen gets its own row.

Files that no component brings in keep today's screen-row behavior. The
screen's comparison details name the component file and the selectors that
matched outside the component.

On 2026-10-03 the user decided that imported CSS must be handled the same way
as other CSS. This replaces the 2026-10-02 finding 1 rule above, including its
exception for files that no component brings in, such as CSS that JavaScript
imports (#125).
One rule applies to every changed CSS rule, whatever way its stylesheet
reaches a page: configured, declared in `stylesheets`, imported by another
stylesheet, or bundled from JavaScript imports.

- Mokly finds the elements that the changed rule matches on each page that
  links the stylesheet, before or after the change.
- A component is changed by the rule when it keeps a match in its own output
  on one of its own pages, under the nested-component test refined below.
  That component gets a Changes row.
- A page gets its own row when the rule matches an element that is not in the
  output of a component that the rule changes, or when Mokly cannot decide
  (custom properties, global selectors, unreadable selectors). Otherwise the
  page is under the Affected screens of those components.
- Two changed rules in different stylesheets are the same rule when their
  selectors and their declarations before and after the change are equal.
  Generated stylesheets copy the same source rules into each entry root, so
  this identity finds the rule on a component's own page.
- The page's comparison details name the stylesheet and the selectors that
  matched outside the changed components.

Thus screen CSS that styles the inside of a component, but does not reach the
component's own page, gives the screen its own row and leaves the component
unchanged. Ownership records no longer decide where a stylesheet change goes.
Declared stylesheets keep their links, provenance and comparison exclusion.
Ownership records remain for resources that are not CSS, and renderer `styles`
records keep their current meaning. Review-ignore regions and the existing
CSS rule analysis limits still apply.

The Milestone 17 review refines the component test above. A different nested Y
with any unfiltered own-page match for the rule takes covered matches from X
on X's own pages, even if Y later keeps no match and is not changed. A nested X
never takes its own match. Only kept matches change a component or give its
saved variants component reasons. Page rows still subtract all output of
components that the rule changes, including their nested output. If Y loses
all its own-page matches to Z, an X-page match inside Y but outside changed Z
can therefore leave X unchanged as a component and give X's saved view a page
row. The change stays visible without an order-dependent component test.

## Milestone 16: Integrate `main` 0.13.0

- [x] Record source tip `b2928191`, merge base `3699c566`, and fetched main
      tip `b2c82c15` before merging. Store the main additions and the 317
      conflict paths under `.context/m16-*.txt`. Main also includes #125,
      #120 and #128; retain those additions with the originally listed work.
- [x] Merge `origin/main` into the branch. Audit main's additions first and
      resolve each conflict path by path, keeping every #121, #122 and #123
      feature.
- [x] Move the formats above main's released versions: manifest v8 (main's v7
      without `dependencies`, `declaredDependencies` and `ownedDependencies`),
      catalogue read model v4 (main's v3 without `details.dependencies`) and
      one comparison result v5 (main's v4 without result `sharedImpact` and
      entry `dependencies` and `sharedImpact`). Historical readers accept
      manifest v3 to v7 and strip the removed fields; readers reject older
      public formats.
- [x] Apply this plan's rules to main's authoring surface: removed-field
      warnings on `folder()` markers and root path metadata as well as on
      entries, and the TypeScript `never` fields on main's input types.
- [x] Port rendered-only evidence, component stylesheet provenance, graceful
      handling and build warnings onto main's single comparison classifier.
- [x] Merge the design mockup changes from both sides, and keep the design
      reachability test passing.
- [x] Update the protocol docs, guides, fixtures and READMEs to the merged
      contract and versions.
- [x] Resolve the historical-layout contract: earlier manifests can retain
      nested artifact paths, while main's panes require identity-derived paths
      and unchanged snapshot bytes. The user chose to keep main's pane contract
      and make Changes unavailable for older layouts. Add failure-first tests,
      apply the typed availability guard, and preserve derived cache reuse.
- [x] Migrate additional imported-CSS and route-scoped-bootstrap fixtures and
      packed consumer checks to v8/v4/v5 and rendered-only evidence.
- [x] Preserve dropped collection-only source modules in inferred historical
      inventories, and retain required inventories for historical v5 to v7.
      Add failure-first tests for both normalization boundaries.
- [x] Keep changed TypeScript files within 300 lines. Split long integration
      suites without losing their cases, and lower protocol size caps to match
      the shortened contracts.
- [x] Smoke-test the merged designs through `npm run dev` at 390 px and
      1440 px, and store screenshots under `.context/screenshots/m16/`.
- [x] Fix the publish compilation cancellation test proxy, as the user
      requested. Clear its binary override before starting the real compiler,
      so npm's JavaScript launcher cannot start the proxy recursively. Keep
      the cancellation, output preservation and diagnostic stack assertions.
- [x] Isolate the design-library runtime browser tests from branch history
      with a current-format committed example fixture. Keep their Unmodified
      status, temporary props, styling and source-preservation assertions.
- [x] Run all required checks, including the complete unit suite and
      `cargo xtask check`, at 100%.
- [x] Inspect and record approved deletions against `origin/main`, commit the
      merge, confirm its two parents, and inspect every remerge-diff path.
- [x] Audit all 335 files in `.context/m16-main-lines-absent.txt`. Classify
      intended migrations, equivalent moves or wording, and lost content.
      Record each path and its reason in the supporting preservation audit.
- [x] Add failure-first checks for the lost contracts. Restore them with the
      branch's approved rules. Split any protocol that exceeds its size limit;
      do not remove contract content or raise a cap.
- [x] Complete the release-note migration from main's released `ManifestV7`,
      `ReviewResultV4` and `ScreenReviewV4` exports to the new types. The first
      complete unit run exposed the missing names after the merge made
      `viewer-v0.4.0` reachable. Keep `CHANGELOG.md` unchanged.
- [x] Run changed-file Prettier, the four requested docs suites, and the
      complete unit suite at 100%. For non-Markdown changes, also run build,
      typecheck, lint and every `cargo xtask check` step after the unit suite.
- [x] Record the dependency-audit blocker. `npm audit` reports
      GHSA-vfj7-8cjw-p6xm for `braces` through the development-only path
      `@firna/ui`, `react-native`, `metro`, `micromatch`. No patched `braces`
      release exists, and `main` fails the same way with the same lockfile.
      This branch does not change dependencies or the audit. The reviewer
      accepted every other `cargo xtask check` step at 100% for the amend;
      remediation belongs to a separate change.
- [x] Amend the local merge with the restorations and audit. Confirm exactly
      two parents and review every amended remerge-diff path. Keep Milestone
      17 and second-review findings 2 to 11 unchanged.
- [x] Push the merge after the reviewer checks it.

Integration evidence:

- Preservation verification: the complete unit command passes 3,689 tests
  with no failures, skips or cancellations. Build, typecheck, lint,
  formatting, documentation checks, size limits, repository ratchets, 15 Rust
  tests and all six packed-consumer scenarios also pass. The reviewer ran
  `cargo xtask check --suite browser` (742 pass) and `--suite hydration`
  (222 pass). `cargo xtask check` stops only at the dependency audit: 13
  high-severity findings through `braces` for `GHSA-vfj7-8cjw-p6xm`, with no
  patched release. `main` fails the same way; `package.json` and
  `package-lock.json` are unchanged. Logs are under
  `.context/m16-preservation/`.
- Preservation correction: the [complete path audit](./remove-source-path-evidence-audit/README.md)
  classifies the 335 supplied files as 307 intended migrations/removals,
  16 equivalent moves or wording changes, and 12 losses now restored. It also
  checks 134 other changed mainline paths and maps all 970 main-added test
  declarations. The earlier remerge audit did not detect these document losses;
  its no-loss claim below is superseded by this correction.
- Intended reductions follow the binding decisions. The audit tables name
  every affected path and reason, including these groups:
  - Formats: `packages/viewer/src/registry/types.ts`, catalogue/review readers,
    `src/registry/manifest*.ts`, public fixtures and their tests move to
    v8/v4/v5. Fixture hashes and package checks move with them.
  - Path evidence: `src/review/component_*.ts`, authoring/registry inputs,
    viewer Details/evidence, guides and fixtures lose only the retired fields,
    their matching logic and their obsolete assertions. Rendered-resource
    and actual-invocation checks remain.
  - CSS declarations: `examples/basic/mokly.config.ts`, design library
    metadata/views and their tests use `stylesheets` instead of the collector
    and source ownership. Mixed/global configured CSS remains.
  - Design states: `examples/basic/entries/design/review_impact_screens.tsx`,
    component `parts/comparison_*` and `states/shared-impact/screens.tsx`,
    their inventory/tests and design docs remove the approved Shared impact
    state or replace its component evidence with Excluded styles. Counts
    become 101 total and 62 Browse/Changes screens. Deferred findings stay open.
  - History: `src/baseline/manifest.ts`, `src/review/base_manifest.ts`,
    manifest normalization and compatibility tests accept supported older
    metadata but keep older stored layouts unavailable, as the user decided.
    Range tests retain original document offsets and snapshot bytes.
  - Splits: source/test helpers keep the same operations and assertions at
    the destinations named in the audit. The catalogue protocol now splits
    into `mokly-catalogue.md` and `mokly-catalogue-delivery.md`; all content and
    former anchors remain available. Its old size exception is removed.
- Restored contracts cover watch invalidation and precedence, generated-byte
  Review evidence, source metadata privacy, identity-based export and component
  rules, actual-invocation variant evidence, and design authority boundaries.
  All 14 targeted preservation checks failed before restoration and now pass.
- All 317 conflict paths are resolved. The local merge has exactly two parents:
  source tip `b2928191` and fetched main `b2c82c15`. Its 492 remerge-diff paths
  were inspected individually, including one-sided migrations and test splits.
  The user chose main's pane contract for older layouts. Every conflict path
  and its resolution is listed in the merge commit body. The path audit is
  saved under `.context/m16-remerge-by-path/`. The preservation correction
  above replaces its earlier conclusion about document completeness.
- The older-layout guard passes 26 focused tests. Coverage includes all entry
  kinds, both viewports and schemes, component variants, unsafe data, no resource
  reads before rejection, derived cache reuse, both Serve modes, export and
  delta publication. Recognized older layouts keep All and current-only output
  usable and print the existing availability message once.
- The publish cancellation proxy now clears its binary override when it
  starts the real compiler. This fixes recursion through npm's JavaScript
  launcher on both this branch and unchanged main. The existing assertions
  pass without changing product cancellation behavior or test timeouts.
- Browser fixtures use the merged v8/v4/v5 formats, identity-derived example
  routes and main's readiness container. Design runtime checks use an isolated
  current-format baseline, so temporary edits retain their Unmodified status
  assertion without depending on the checkout's earlier layout.
- The packed smoke test passes all six consumer scenarios. Visual smoke saves
  15 screenshots under `.context/screenshots/m16/`, with no browser page errors.
- `cargo xtask check` passes: 3,675 unit, 742 browser, 222 hydration and 15
  Rust tests, with zero failures, skips or cancellations. Its 661 unit files
  exactly match the requested complete-suite globs. The initial parallel run
  exceeded one scale-test wall-clock bound; the unchanged bound passes in the
  final sequential gate. Build, typecheck, lint, formatting, both example
  commands and package smoke also pass. Logs: `/tmp/m16-final-*.log` and
  `.context/verification-reports/`.
- Four deletions and one fixture rename against main are approved:
  - `docs/protocol/fixtures/catalogue-v3.json` → `catalogue-v4.json`: retain one current fixture.
  - `examples/basic/entries/design/library/style_context.tsx`: replace the style collector with declarations.
  - `src/components/dependency_validation.ts`: retire declared path validation.
  - `src/registry/dependency_paths.ts`: retire source-path matching.
  - `tests/design_library_style_collector.test.tsx`: retain its unique checks in the declaration tests.

## Milestone 17: Document the CSS change rule

Docs only. Define the contract for the later mockup, classification and details
milestones. Keep implementation and runtime tests unchanged.

- [x] Define the 2026-10-03 CSS change rule in the CSS attribution, component
      changes, component stylesheet ownership and imported styles contracts:
      matched elements, components changed by a rule, page rows, rule
      identity across stylesheets, the evidence text, and the interaction with
      ownership records, provenance, Review-ignore and unresolved rules.
- [x] Update the attribution tables with one row for each way CSS reaches a
      page: configured, declared, imported by a stylesheet and bundled from a
      JavaScript import.
- [x] Update the Decisions And Scope bullets that the 2026-10-03 rule replaces.
- [x] Audit every use of derived CSS resource owners. Specify their removal,
      independent inserted-link provenance, the all-stylesheet warning and
      unchanged non-CSS/document-style ownership.
- [x] Define explicit own-root output boundaries and the per-rule/page evidence
      fields in unreleased v8/v4/v5. Update affected contracts, guides and READMEs.
- [x] Apply the review's nested-component test, self-nesting exception and
      order-independent own-page proof. Document the four requested cases and
      preserve inclusive page containment.
- [x] Add the required classification, schema, warning and details work to
      Milestones 19 and 20. Keep delivery notes in protocol Delivery Status
      sections, linked as M19/M20 so they do not record delivered history.
- [x] Validate changed Markdown, run the six requested docs suites and the
      complete unit suite at 100% after `npm run build`.
- [x] Inspect the diff and approved deletions against `origin/main`. This
      milestone adds no file deletions. The four earlier approved removals
      remain unchanged.

Verification: `npm run build` passes. Changed-file Prettier and all 26 tests in
the six requested docs suites pass. The complete unit command passes twice,
with 3,689 tests and zero failures, skips or cancellations on each run. Logs are
under `.context/m17-*.log`. The commit changes only Markdown; code, tests and
fixtures stay unchanged. No generated example output was hand-edited or added
to the commit. Protocol files stay within their caps.
`cargo xtask check` is not required for this docs-only milestone.
The nested-component review refinement also passes the build, changed-file
Prettier, all 26 focused docs tests and the complete 3,689-test unit suite,
with zero failures, skips or cancellations. Its logs are under
`.context/m17-review-*.log`.

## Milestone 18: Depict the outside-component evidence

Tags: mockup

- [x] Add the outside-component stylesheet evidence to the stylesheet evidence
      design screens, at mobile and desktop widths.
  - [x] Component explorer › Empty and change states › Stylesheet evidence
        gains `design-component-style-changed`: Action and its three saved
        variants are in Changes because a changed rule styles only Action's
        output, and Welcome and Details appear only under Affected screens.
  - [x] It also gains `design-component-style-outside`: the rule that changes
        Action also styles Welcome's own link outside Action, so Welcome has
        its own row. Details show the stylesheet and, under it, the exact
        outside-component sentence and selector, and link Action.
  - [x] Add failure-first unit and browser tests for both screens.
- [x] Build and check the example, run the design tests and smoke-test the
      changed screens.
- [x] Align `design-component-shared-impact` (Component with excluded styles)
      with the new rule and its own description: open it from All, with no
      Changes entry. It depicted Action as changed in Changes, which the new
      rule forbids when no changed rule matches Action's own pages. A
      failure-first test captures this.
- [x] Show the per-stylesheet grouping that the M17 contract adopted: each
      changed file is one list item, with its sentences and selector lists
      nested under it. Apply it to the Matched, Unresolved, Unnamed and
      Excluded style cards with unchanged copy, and to the component inspector.
      Share one evidence part and the exact contract copy between both.
- [x] Update the design inventory, link, count, attribution and reachability
      tests, the design contracts and the example README. Correct two stale
      shell-design statements: the impact group has two screens, and Excluded
      styles shows a changed Welcome with Current controls.
- [x] Run the complete unit suite and every available `cargo xtask check` step
      at 100%.

Verification: build, `npm run example:build` and `npm run example:check` pass
with 438 files. The 190 design tests and the 26 tests of the six docs suites
pass. The new unit tests failed first with nine failures, and the spacing
browser spec failed without its CSS rule. Typecheck, lint and changed-file
Prettier pass. `cargo xtask check --suite unit` passes 3,698 tests,
`--suite browser` 746 and `--suite hydration` 224, with zero failures, skips
or cancellations; `--suite package` passes all six consumer scenarios. Every
repository step passes except `npm run dependencies:check`, which still
reports GHSA-vfj7-8cjw-p6xm for `braces` with no patched release. Smoke
screenshots of the seven changed screens at 390 px and 1440 px are under
`.context/screenshots/m18/`, and logs are under `.context/m18/`. In the first
complete unit run, the watched Serve warning test waited 936 seconds in its
cleanup until a second SIGTERM stopped its Serve child. The clean xtask unit
run did not repeat this.

## Milestone 19: Classify CSS by where its rules match

- [x] Failure-first tests for each way CSS reaches a page (configured, declared,
      imported by a declared stylesheet, bundled from a JavaScript import):
  - [x] A changed rule that styles only a component's output puts that
        component in Changes, with its consumers under Affected screens.
  - [x] A changed rule that styles an element outside the component output
        puts the page in Changes.
  - [x] Screen CSS that styles the inside of a component, but does not reach
        the component's own page, puts the screen in Changes and leaves the
        component unchanged.
  - [x] An unresolved rule puts the page in Changes.
- [x] Record which elements each changed rule matches, decide inside or
      outside with the component output markers, identify the same rule across
      stylesheets, and attribute each change by the 2026-10-03 rule. Remove
      CSS attribution through ownership records. Keep the complete and fast
      comparison paths equal.
- [x] Add failure-first coverage for these four nested-output cases:
  - [x] `.action` changes Action only; Toolbar's own-page matches are inside
        Action, so Toolbar is under Action's Affected screens.
  - [x] `.toolbar .action` has no match on Action's own pages. Toolbar keeps
        its matches and changes; its consumers are affected and Action is unchanged.
  - [x] With Icon inside Action inside Toolbar, `.icon` changes Icon only.
  - [x] Y's own-page matches all lie inside changed Z, so Y is not changed.
        Y still takes an X-own-page match inside Y but outside Z. X keeps no
        match and is not changed as a component; X's saved view gets a page
        row, with no affected consumers from that page reason.
- [x] Test that self-nested X never takes a match from X, that mutually nested
      components need no evaluation order, and that a variant gets a component
      reason only for a match its parent keeps on that variant's own page.
      Preserve inclusive nested containment for page-row subtraction.
- [x] Cover all saved variants/viewports/schemes, wrappers outside roots, empty
      output, paired Review-ignore and missing historical root bounds. Preserve
      previously valid Review-ignore around root-only output.
- [x] Add one explicit root output range per new component saved view in v8.
      Keep it separate from instances and caller inputs. Update range readers,
      compatibility validation, marker stripping and v4 inspection without
      adding a phantom Used by occurrence or a marker-only material change.
- [x] Add the normalized before/after rule key, duplicate aggregation and
      catalogue-wide unfiltered and kept own-page match collection. Evaluate
      nested filtering only against unfiltered own-page sets, never against
      the changed-component set. Test equal generated copies,
      different declarations, conditions, added/removed rules and stylesheets,
      added/removed views, embedded documents and parser-inserted elements.
- [x] Stop deriving CSS `resources`. Feed inserted-link provenance directly
      from linking data. Preserve placement, aliases, final-token checks,
      compatibility removal, root-link retention and comparison exclusion.
- [x] Remove CSS owner suppression, root-owner material reasons and invocation
      promotion. Drop historical CSS owner records, including earlier v8
      output. Keep non-CSS owners and document `styles` behavior unchanged.
      Test a declaration-only edit that reuses an unchanged configured link.
- [x] Replace `ignored-declared-resource-owner` with
      `ignored-stylesheet-resource-owner` and the exact documented message.
      Ignore every renderer CSS owner record after public-file checks. Cover
      unlinked/generated/imported CSS, no registered components or rendered
      declarer, duplicate aliases, pending generated routes, unsafe paths and ignored invalid owner ids.
      Test stable generated identities and one warning per route/file identity
      in Build, Check, export, publish and Serve, including on-demand/transient rendering and IPC.
- [x] Extend comparison v5 with per-rule changed component ids, page selectors
      and unresolved page evidence. Extend catalogue v4 view/page evidence;
      keep whole-document pages outside visual comparison records. Update
      strict readers, public allowlists, fixtures, canonical output and source
      proof without a version increment or private match-coordinate exposure.
      Validate component reasons against kept matches and preserve the raw
      own-page sets needed to prove nested filtering.
- [x] Test independent component/page rules in one file, a selector matching
      both inside and outside, partial unresolved evidence, component wrapper
      page rows without affected consumers, parent versus saved-variant rows,
      and unchanged non-CSS actual-invocation attribution.
- [x] Preserve complete/fast/Browse/watch/selected/export/publication agreement.
      Carry the complete rule-to-component facts through accepted generations,
      cache invalidation and selected projection. Test selection before/after
      a component's own-page evidence changes, without rerunning consumer code.
- [x] Keep CSS that only appears after component projection out of both rule
      reasons and derived byte-material reasons. Keep non-CSS projection behavior.
- [x] Reuse complete screen CSS evidence in lightweight content checks. Preserve
      the existing non-CSS alias policy without repeating rule analysis.
- [x] Run the focused tests and the complete unit suite at 100%.

Implementation notes:

- The rule classifier retains all matched elements and their validated output
  ranges. It freezes unfiltered own-page sets before nested filtering. Entry
  reasons retain only eligible rules. Public evidence contains no coordinates.
- CSS assertions no longer create resource owners. Inserted-link provenance
  uses temporary linking data. Non-CSS ownership and document styles remain.
- The lightweight screen pass reuses complete CSS evidence. It retains its
  existing non-CSS alias handling. Whole-document pages use the same classifier.
- Smoke used an isolated, current-format copy of the real example with watched
  `mokly serve`. All 12 cases passed: configured, declared, CSS-imported and
  JavaScript-imported delivery, each with a component rule, a screen heading
  rule and a screen-only rule inside Action. Component cases listed Action and
  its three saved variants. Other cases listed Welcome, Welcome empty, Details
  and their flow. Selected API evidence matched catalogue evidence. Browser
  computed styles matched each edit. All temporary edits were restored; the
  fixture Git status is clean. Logs and screenshots are in `.context/m19/`.
- This milestone adds no file deletions relative to `70ccbdef`. The four earlier
  plan-approved deletions and the v3-to-v4 fixture rename remain.
- The required fetch found `origin/main` at `800fe9f8`, with two commits after
  this branch's `b2c82c15` base: output/frame race fixes (#129) and an audit
  exception (#130). This task does not merge them or change the audit. The
  reviewer must preserve those commits when integrating main. The following
  apparent deletions in the two-tree `origin/main` diff are main-only additions,
  not removals authored by this milestone:

  - `packages/viewer/src/shell/frame_session_usage.ts`
  - `packages/viewer/tests/frame_hook_fakes.ts`
  - `scripts/verification/dependency-audit-evaluation.d.mts`
  - `scripts/verification/dependency-audit-evaluation.mjs`
  - `scripts/verification/dependency-audit-exceptions.d.mts`
  - `scripts/verification/dependency-audit-exceptions.json`
  - `scripts/verification/dependency-audit-exceptions.mjs`
  - `scripts/verification/dependency-audit-lockfile.d.mts`
  - `scripts/verification/dependency-audit-lockfile.mjs`
  - `scripts/verification/dependency-audit.d.mts`
  - `scripts/verification/dependency-audit.mjs`
  - `src/build/output_lock.ts`
  - `src/build/output_lock_file.ts`
  - `tests/baseline_directory_walk.test.ts`
  - `tests/browser/frame_hook_usage_race.spec.ts`
  - `tests/ci_native_output_lock.test.ts`
  - `tests/fixtures/dependency-audit/README.md`
  - `tests/fixtures/dependency-audit/lockfile.json`
  - `tests/fixtures/dependency-audit/report.json`
  - `tests/generated_output_concurrency.test.ts`
  - `tests/generated_output_lock.test.ts`
  - `tests/generated_output_lock_waits.test.ts`
  - `tests/helpers/dependency_audit.ts`
  - `tests/helpers/generated_output_fixture.ts`
  - `tests/verification_dependency_audit.test.ts`
  - `tests/verification_dependency_audit_runner.test.ts`
  - `tests/verification_dependency_audit_validation.test.ts`
  - `tests/watched_resource_wait_open_stream.test.ts`

Verification: the exact complete unit command and `cargo xtask check --suite
unit` each pass 3,779 tests. The browser suite passes 746 tests. Hydration passes
224 tests. These suites have no failures, skips or cancellations. All 15 Rust
tests and all six packed-consumer scenarios pass. The focused run passes 782
tests, the example library run passes 51 tests, and the six requested docs
suites pass 26 tests. Build, typecheck, lint, formatting, file limits,
repository checks and both example commands pass. `cargo xtask check` stops
only at the unchanged `braces` audit (GHSA-vfj7-8cjw-p6xm, 13 high findings,
no fix). Every other requested check step passes separately. Exact commands,
first-failure names and smoke results are in `.context/m19/report.md` and
`.context/m19/checks.jsonl`. The task requires a local commit without a push;
the reviewer owns the later push and review. No M20 presentation or copy work
is included.

## Milestone 19A: Integrate `main` #129 and #130

`main` moved to `800fe9f8` after Milestone 16. #129 prevents output-write and
frame-usage races. #130 adds an expiring audit exception for the `braces`
advisory GHSA-vfj7-8cjw-p6xm. Merge it before the UI work, so that Milestone 20
builds on main's viewer fixes and the complete gate can pass again.

- [x] Audit main's additions from the source tip, merge `origin/main` with
      exactly two parents, resolve conflicts path by path and review every
      remerge-diff path.
- [x] Compare every line that main added since `b2c82c15` with the merged
      tree. Classify each absent line as an intended migration, a move or a
      loss, and restore every loss before the push.
- [x] Run build, typecheck, lint, the six docs suites, main's new and changed
      tests, and the exact complete unit command at 100% before committing.
- [x] Run the complete `cargo xtask check`, including the dependency audit,
      and require 100%. Remove the audit workaround from Milestone 21.
- [x] Inspect `git diff --name-status origin/main` and its deletions, record
      the result in this milestone, and commit the merge locally.
- [x] The reviewer pushes the branch after checking the local merge. The
      reviewer pushed `1bd54f7e`.

Integration evidence:

- Captured before merging: source tip `eda6cf840969e34860b7d8d8425d63da80bfa01a`,
  merge base `b2c82c1591c91f2550a66c464833b1f864bdab07`, and fetched main
  `800fe9f88a0173429b25baa1bcf41ed9e59b2256`. Main changes 67 paths.
  The saved refs and path list are under `.context/m19a/`.
- The merge has exactly two parents: that source tip and fetched main.
  Reviewed every path from `git show --remerge-diff --stat`:
  `docs/protocol/mokly-baseline-storage.md` combines the two contracts;
  `tests/helpers/generated_output_fixture.ts` drops the retired input;
  `plans/remove-source-path-evidence.md` records the integration and removes
  Milestone 21's audit workaround. No other path needs a manual resolution.
- `docs/protocol/mokly-baseline-storage.md` is the only conflict. The merged
  paragraph keeps main's writer-lock location, empty-cache removal and five
  ancestor-walk attempts. It keeps this branch's exclusion from rendered-resource
  classification in place of the retired shared-impact globs.
- The output lock covers writes, export capture and export input rechecks.
  Serve passes its generation cancellation signal to the write. The frame hook
  keeps main's final usage check and ready transition in the same task.
  The audit exception and its validation remain as main defines them.
- Post-commit line audit: all 3,581 non-blank main-added lines across all 67 paths
  are present except the following one. Every added doc, README, source and
  test line is included in `.context/m19a/main-lines.json`.
  - `tests/helpers/generated_output_fixture.ts:9` — (a), intended migration.
    The generated `defineScreen` line drops only `dependencies: []`, which
    this branch retired. Its ids, navigation, metadata and both rendered views
    remain. Main's concurrency and lock tests keep all their assertions.
    The absent main line is:

    ```text
      defineScreen({ id: \`screen-\${index}\`, title: \`Screen \${index}\`, description: "Generated screen", navPath: ["Fixture"], dependencies: [], relatedDocs: [], desktop: <main>${label} {index}</main>, mobile: <main>${label} {index}</main> }),
    ```

  All other 66 paths retain every main-added non-blank line. No (b) moves or
  (c) losses were found. Main's docs, READMEs, source and tests all retain their
  added meaning. The eight output-lock, transaction/store, export-input,
  baseline-confinement and frame-lifecycle source files match main byte for byte.

- The 677-path main diff retains only the four approved deletions:
  `examples/basic/entries/design/library/style_context.tsx`,
  `src/components/dependency_validation.ts`,
  `src/registry/dependency_paths.ts`, and
  `tests/design_library_style_collector.test.tsx`. The catalogue fixture remains
  a v3-to-v4 rename. Historical plans, review records and `CHANGELOG.md` match
  main; no new edits were made to them.

Verification: `npm run build`, `npm run typecheck` and `npm run lint` pass.
The six requested docs suites pass all 26 tests. Main's 15 new or changed unit
files pass all 127 tests. The frame lifecycle and new usage-race browser specs
pass all 15 tests. The exact complete unit command passes all 3,883 tests.
The complete `cargo xtask check` passes without a workaround: the live audit,
formatting, lint, file limits, repository checks, 15 Rust tests, package checks,
all six packed-consumer scenarios, 3,883 unit tests, 747 browser tests and
224 hydration tests pass. There are no failed, skipped or cancelled tests.
The example build and check pass with 438 files. The audit uses main's reviewed
exception through 2026-11-03 UTC; package versions, the lockfile and overrides
are unchanged. An initial plan-format check needed one indentation correction;
the repeated check passes. Exact commands and results are in
`.context/m19a/checks.jsonl` and `.context/m19a/report.md`.
The reviewer owns the push and the later implementation review. Milestone 20
has not started.

## Milestone 20: Show the outside-component evidence

Tags: ui

- [x] Show the evidence from Milestone 19 in the comparison details, as the
      Milestone 18 mockups depict it.
- [x] Render exact product copy for screens and saved component views.
      Group page selectors by actual stylesheet path. Keep component-only
      selectors separate and preserve an unresolved paragraph beside proven
      outside matches. Never expose rule keys or private source paths. The
      whole-document page part of this item moved to Milestone 20B, still
      open: no approved design shows evidence in a page's Details, so
      Milestone 20A depicts it first.
  - [x] Screens: page, outside-component, unresolved and affected-only
        sentences under each stylesheet path.
  - [x] Component saved views: the component's own sentence, the saved-view
        page and outside sentences, and the saved-view unresolved paragraph.
  - [x] Keep component-only selectors out of a file's page list, keep the
        unresolved paragraph beside proven outside matches, and never show rule
        keys, changed component ids or private source paths.
- [x] Merge live classification and loaded comparison evidence by path/rule
      without duplicate paragraphs. Retain evidence in Current and All, keep
      viewport-independent Details, clear stale generations and preserve
      comparison eligibility and affected-consumer behavior.
- [x] Add viewer/browser coverage for all evidence states, generated bundle
      paths, mixed component/page matches and component wrapper rows with no
      affected consumers. Match the Milestone 18 mobile/desktop mockups.
- [x] Run the viewer and browser tests and smoke-test both widths.
- [x] Define the per-file outcome order, the component's own sentences and the
      two status lines in the presentation contract. Mark M20 delivery in the
      protocol Delivery Status notes, the Details guide and the READMEs.
- [x] Show the selected saved view's live evidence on component routes in
      Current. Project the selected views' catalogue v4 `resourceEvidence` in a
      workspace built from the published catalogue.
- [x] Base the terminal line on the routed entry and the selected saved view.
      Show the affected-preview sentence only for an entry that consumes a
      changed component, so wrapper-only saved views never claim it.
- [x] Move the published workspace's per-view helpers into
      `public_workspace_views.ts`, so changed TypeScript files stay within
      300 lines.

Implementation notes:

- Details name each changed file once, in one files list. Each item holds its
  outcome sentences and selector lists, with the M18 card's markup and
  spacing. `workspace_stylesheet_evidence.ts` merges a file's records by rule
  key and orders the outcomes: the component's own rules, proven page
  selectors, other unresolved rules, else the full matched styles.
- Current shows the selected saved view's live evidence on component routes.
  A workspace built from the published catalogue projects catalogue v4 view
  evidence for the selected screen or saved view. Loaded comparisons merge by
  path and rule key without duplicate files or paragraphs.
- The terminal line needs an unmodified routed entry and saved view. The
  affected-preview sentence needs a consumed changed component.
- Smoke used `npm run dev -- --base HEAD` on the real example. Ten temporary
  CSS cases covered configured, declared and JavaScript-imported CSS:
  outside, component-only, outside with unresolved, matched, unresolved,
  unnamed, excluded only, excluded beside matched, wrapper and generated
  bundle. Every edit was restored and the example Git status is clean.
  Screenshots at 1440 px and 390 px are under `.context/screenshots/m20/`;
  results are in `.context/m20/smoke-results*.json`.
- The per-file list, copy and spacing match the M18 cards and the two
  component stories. Two older differences remain outside M20: the explorer
  mockup's Change, Saved variant and Saved props rows and its "Changed
  components used here" heading, where the shell shows "Changed component:"
  links. Both predate M18 (#48).
- This milestone deletes no files. The four earlier plan-approved deletions
  and the v3-to-v4 fixture rename against `origin/main` remain unchanged.

Verification: `npm run build`, `npm run typecheck` and `npm run lint` pass.
Changed-file Prettier and the six requested docs suites (26 tests) pass. The
new grouping, Details markup and published-workspace tests failed first: the
module was missing, all seven markup tests failed, and two of three published
tests failed. The focused client and viewer run passes 448 tests. Against the
old viewer code the four CSS evidence browser specs failed 23 of 40 tests;
with the change all 40 pass. The related evidence, design and export specs pass
67 tests, and hydration passes 224. The exact complete unit command passes
3,908 tests. The complete `cargo xtask check` passes in 45 minutes: the audit
with main's accepted exception, formatting, lint, file limits, repository
ratchets, 15 Rust tests, typecheck, the example check with 438 files, all six
packed-consumer scenarios, 3,908 unit tests, 762 browser tests and 224
hydration tests. No test failed, was skipped or was cancelled. Logs are under
`.context/m20/logs/`.

## Milestone 20A: Depict whole-document page evidence

Tags: mockup

The presentation contract defines whole-document page copy, but no approved
design shows comparison evidence in a page's Details. Milestone 20 found this
mockup gap, so the page display waits for this milestone.

- [x] Depict a whole-document page whose Details hold the per-file stylesheet
      evidence with the page copy: “Changed styles that apply to this page:”,
      the outside-component page sentence and the page unresolved paragraph.
      Show it at mobile and desktop widths, reachable from the page designs,
      without comparison controls.
- [x] Update the design inventory, link, count and reachability tests and the
      design contracts. Run the example build and check and the design tests,
      and smoke-test the changed screens.
- [x] Define the page files lead, both page excluded sentences and the page
      terminal line in the presentation contract. The depiction needs the
      lead, and M20B must render the others without guessing. State that a
      page consumes no components, so its Details link none.
- [x] Make the page designs' Changes filter open the new state, and give them
      its count of five, so that both sides of the link agree.

Implementation notes:

- `design-review-style-page` (“Document page styles”) is the fifth screen of
  Changes › Impact states › Stylesheet evidence, beside the screen evidence
  designs. Its route links `design-review.css`, which holds the approved card
  spacing, so the example configuration stays unchanged.
- It shows Getting started from Changes: the plain document pane, a Changed
  status, no comparison toolbar and no stage heading. Changes holds the page,
  Action and Action's three saved variants. Action's row opens
  `design-component-style-changed`; the variant rows stay depictions.
- Details name `styles/actions.css` with the outside sentence and `.action`,
  then `styles/handbook.css` with “Changed styles that apply to this page:”
  and `article h2`, then the page unresolved paragraph and `:root`. The
  `.action` rule also changes Action, so its page match reads as outside the
  changed components. A page records no component output and consumes no
  components, so Details have no “Changed component:” line.
- The page designs share one document part (`parts/document_page.tsx`). The
  Details panel now adds the comparison section after authored metadata as
  well as after screen metadata; existing output is unchanged.
- All three page designs open the new state from their Changes filter, and
  its All filter returns to `design-page-view`. Their depicted Changes count
  changes from one to five, so the two sides agree. The canonical page view
  keeps no change marks, like the canonical Welcome.
- This milestone deletes no files. The four earlier plan-approved deletions
  and the v3-to-v4 fixture rename against `origin/main` remain unchanged.

Verification: `npm run build`, `npm run example:build` (440 files) and
`npm run example:check` pass. The six new unit tests failed first: the screen
was missing and the page designs had no Changes link. The 196 design tests,
the 26 tests of the six docs suites, typecheck, lint and changed-file Prettier
pass. The stylesheet evidence and comparison eligibility specs pass 8 tests;
the page, preview-link, comparison, scroll-together, design-link and
portability specs pass 32. The exact complete unit command passes 3,914 tests.
The complete `cargo xtask check` passes in 47 minutes: the audit with main's
accepted exception, formatting, lint, file limits, repository ratchets, 15 Rust
tests, typecheck, the example check, all six packed-consumer scenarios, 3,914
unit tests, 764 browser tests and 225 hydration tests. No test failed, was
skipped or was cancelled. The `npm run dev` smoke opened the four changed
screens at 1440 px and 390 px without page errors. It followed the Changes
filter to the new state at both widths, and its All filter back on desktop.
Screenshots are under `.context/screenshots/m20a/`; logs are under
`.context/m20a/`.

## Milestone 20B: Show whole-document page evidence

Tags: ui

- [x] Render exact product copy for whole-document pages in their Details,
      from live `pageEvidence` and catalogue v4 page `resourceEvidence`, with
      the same per-file grouping as screens. Moved from Milestone 20.
- [x] Add failure-first viewer and browser tests at both widths, match the
      Milestone 20A mockups, run the viewer and browser tests, and smoke-test.
- [x] Show the page's status beside its title, as the Milestone 20A mockup
      does: Added, Changed or Unmodified once Changes is ready. A removed page
      keeps its Removed badge. Define the rule in the presentation contract.
- [x] Render screens, saved views and pages through one Details block: move
      the comparison heading and the files and exclusions markup into
      `evidence_details.tsx`, used by `workspace_evidence.tsx` and the page.
- [x] Keep long page evidence reachable. Cap the open Details panel at 60% of
      the main region, scroll its body and keep its bar in view. On narrow
      screens, wrap every title row's chips below the title, as the screen
      head already did, so the page title stays on one line.

Implementation notes:

- `page_evidence_data.ts` reads a current page's status and its one evidence
  record from the public page record. Serve, exports and hosts all render from
  that record. A shell rendered from private live data reads live
  `pageEvidence` and derives the status like a workspace. Removed pages and
  Changes that are not ready give no status and no evidence.
- `page_evidence.tsx` renders the comparison heading, the shared files and
  exclusions block with the page wording, and "No changes to this page." for
  an unmodified page. `DetailsPanel` places it after the authored metadata.
  `views.tsx` shows the page status beside the title.
- The page wording joins `entry_wording.ts`; the grouping subject gains the
  page kind. Rule keys, changed component ids and private source paths never
  reach the copy. A page consumes no components, so its Details link none.
- Published pages expose only resource evidence, so page Details add no
  material or metadata reason lines.
- A newer live evidence revision on a page route needs no workspace. The shell
  adopts it and replaces the page's status and Details in place; a unit test
  covers this path, because a content edit reloads the tab first.
- The evidence matches the Milestone 20A mockups: copy, per-file nesting,
  spacing, the Changed status and no comparison controls. Two older
  differences remain outside this milestone. The shell's page Details are the
  existing disclosure bar below the document, where the page designs depict
  the icon inspector. The shell puts the status before the ID chip, for
  screens as well.
- The narrow title-row rule moves from the workspace stylesheet to the shared
  head stylesheet, so screens and components keep the same layout.
- Smoke used `npm run dev -- --base HEAD` on the real example. The handbook
  links no stylesheet at `HEAD`, so every case also linked `styles.css` and
  `example-components.css` from the handbook and added one `.example-action`
  element. This also gives the page a material change; it does not alter its
  evidence. Four cases passed at 1440 px and 390 px: an outside match
  (`.example-action`, which also changes Action), a match with no changed
  component (`article h2`), an unresolved rule (`:root`), and all three
  together, as the mockup shows. A last step kept the page open and removed
  the `:root` rule; the example's watch rule reloaded the tab, and its Details
  then showed only `article h2`. Every edit was restored, and the example Git
  status is clean. Screenshots are under `.context/screenshots/m20b/`; results
  are in `.context/m20b/smoke-results.json`.
- This milestone deletes no files. The four earlier plan-approved deletions
  and the v3-to-v4 fixture rename against `origin/main` remain unchanged.

Verification: `npm run build`, `npm run typecheck` and `npm run lint` pass.
Changed-file Prettier and the six requested docs suites (26 tests) pass. The
new unit tests failed first: 8 of 10 before the change, with the 2
preservation tests passing; against the old viewer source the page and
adoption tests failed 6 of 8. All 8 new browser tests failed against the old
viewer. With the display alone, the 2 layout tests still failed: a two-line
mobile title and a 36 px document. All 8 pass with the layout rules. The
focused client and viewer run passes 489 tests, the related evidence, page,
removed-preview, layout and design specs pass 141, and hydration passes 225.
The exact complete unit command passes 3,925 tests. The complete
`cargo xtask check` passes in 45 minutes: the audit with main's accepted
exception, formatting, lint, file limits, repository ratchets, 15 Rust tests,
typecheck, the example check with 440 files, all six packed-consumer
scenarios, 3,925 unit tests, 772 browser tests and 225 hydration tests. No
test failed, was skipped or was cancelled. Logs are under `.context/m20b/logs/`.

## Milestone 21: Verify, deliver and review

- [x] Run `cargo xtask check` and the separate required unit command at 100%.
      Smoke-test all four CSS delivery paths and all three removed fields at
      mobile and desktop widths. Restore all temporary edits. Inspect the
      diff and deletions against `origin/main`, record the evidence and update
      the active plan index.
- [x] Run `git add -A`, commit with a Conventional Commit, and push the branch.
- [x] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report numbered findings with
      severity, impact, lettered options and a recommendation, without
      changing the implementation.

Third review outcome (2026-10-04, `72c915bf` against `origin/main` at
`800fe9f8`): 4 verified findings, reported to the user and not fixed. Medium:
the historical marker rename in `src/review/ignore.ts` rewrites the old prefix
everywhere in a document, including script and text, so valid content can
give false Changes rows or stop classification. Low: embedded page Details
print an empty branch-point name; three docs say renderer input holds only
configured stylesheet links; the component authoring guide still says a
declared stylesheet belongs to its component. Probes are in
`.context/review/`. Second-review findings 2 to 11 still await the user's
decision.

Verification evidence (2026-10-04):

- `git fetch origin main` succeeds. Main is
  `800fe9f88a0173429b25baa1bcf41ed9e59b2256`; the verified source is
  `710e2d5df342af859bf51efd92eb73e648926306`.
  `git log --oneline HEAD..origin/main` is empty, and
  `git merge-base --is-ancestor origin/main HEAD` exits 0. No merge was needed.
- The complete `cargo xtask check` exits 0. It passes the audit, formatting,
  lint, file limits, repository checks, typecheck, 15 Rust tests, all six
  packed-consumer scenarios, 3,925 unit tests, 772 browser tests and 225
  hydration tests. No test failed, was skipped or was cancelled. The normal
  example build and check pass with 440 files.
- The exact separate command
  `npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"`
  passes all 3,925 tests, with no failures, skips, cancellations or TODOs.
  It ran after all browser work stopped and all smoke edits were restored.
- Smoke used a temporary copy of the full example with every entry and the
  renderer retained. It added four delivery links before a fixed committed
  baseline, so link setup did not add unrelated Changes rows. The fixture
  build and check pass with 442 files. The repository's `npm run dev` served
  this copy with `--config .context/m21/example/examples/basic/mokly.config.ts`
  and `--base HEAD --port 0`. The complete gate separately covers the normal
  derived example.
- All 16 CSS cases pass at 390 × 844 and 1440 × 1000. Each of configured CSS,
  declared `stylesheets`, CSS imported by a declared stylesheet, and CSS
  imported from JavaScript was tested with these rules:

  - `.example-action { opacity: 0.97; }`: only Action and its three saved
    variants enter Changes. Welcome, Welcome empty, Details and Toolbar Default
    appear under Affected screens and components.
  - `.example-head h1 { letter-spacing: 0.75px; }`: Welcome, Welcome empty,
    Details and Example tour get their own rows. Action stays unchanged and
    has no affected consumers.
  - `.example-screen .example-action { opacity: 0.96; }`: the same four
    screen/flow rows appear. The screen-scoped rule matches inside Action on
    screens but has no own-page match. Action stays unchanged.
  - `.example-action, .example-head h1 { opacity: 0.95; }`: the four component
    entries and four screen/flow entries get rows. Screen Details show only
    `.example-head h1` under the exact outside-component sentence.

- The browser checks Changes rows, Affected screens, computed styles and
  exact Details text at both widths. Current and loaded Side by side show
  the same file and selectors once. The selected comparison API agrees with
  catalogue evidence. JavaScript delivery names the emitted bundle, with no
  private imported source path. No browser page error occurred.
- Each removed field was tested alone with an edit to its named, unrendered
  `examples/basic/notes.md` file. Each build succeeds and prints its exact
  warning once: `dependencies` on Welcome, `ownedDependencies` on Action,
  and `review.sharedImpact` in configuration. All generated bytes, including
  the manifest, remain equal to the fixture baseline. At both widths,
  Changes stays empty and Details and Usage show no resource evidence or
  affected consumers. Every temporary edit was restored. The fixture was
  rebuilt, checked, confirmed clean with Git, and removed. The real example
  has no tracked edits.
- `git diff --name-status origin/main` has 709 inspected paths. The repeated
  scan matches the first scan. The deletion command
  `git diff --diff-filter=D --name-status origin/main` contains only the four
  earlier approved deletions:
  `examples/basic/entries/design/library/style_context.tsx`,
  `src/components/dependency_validation.ts`,
  `src/registry/dependency_paths.ts`, and
  `tests/design_library_style_collector.test.tsx`. The approved v3-to-v4
  catalogue fixture rename remains. This task adds no deletion and changes
  only this plan and `plans/README.md`.
- Logs, exact commands, the smoke matrix and results are under `.context/m21/`.
  Screenshots are under `.context/screenshots/m21/`. The audit still uses
  main's reviewed Braces exception through 2026-11-03 UTC. Dependencies,
  overrides and the audit are unchanged. Earlier unselected review findings
  remain open. This task does not run the implementation review or push.

On 2026-10-04 the user decided the third-review findings:

1. Remove the historical marker rename and its tests. The project keeps no
   backward-compatibility code for the former `mokabook-` marker spelling.
   A comment with that spelling is ordinary page content. This matches the
   existing rule in `docs/protocol/mokly-instances.md`: historical marker
   translation is not supported.
2. Option A: show "Compared with the branch point on <name>." only when the
   name is known. Change the shared heading once for screens, saved views and
   pages.
3. Option B: one protocol owns the complete `RenderInput.stylesheets` list,
   and the other docs refer to it.
4. Option B: remove the stale stylesheet-ownership sentence from the component
   guide and refer readers to the Changes guide by name.

Second-review findings 2 to 11 still await the user's decision.

## Milestone 22: Document the third-review decisions

Docs only. Define the contract for Milestones 23 and 24, and fix the two stale
docs (findings 3 and 4).

- [x] Remove every statement that describes translation of the former
      `mokabook-` marker spelling, including in `src/components/README.md`.
      State in the component usage and instance contracts that a comment with
      the former spelling is ordinary page content on both sides: Mokly never
      reads it as a marker, never removes it and never fails on it. Keep the
      rule that historical marker translation is not supported.
- [x] Define the branch-point sentence rule in the CSS evidence presentation
      and shell contracts: show "Compared with the branch point on <name>."
      only when the name is known, for screens, saved views and pages. An
      embedded catalogue without a name shows no sentence and keeps the rest
      of its Details. No mockup change: the mockups show only catalogues with a
      known name.
- [x] Make `docs/protocol/mokly-rendering.md`, which defines `RenderInput`, the
      single owner of the complete `RenderInput.stylesheets` list and its order:
      configured shared and scheme links, and the generated links for imported
      CSS. Move the definition from `mokly-imported-styles-assets.md` without
      a change in meaning. Replace the copies in
      `mokly-imported-styles-assets.md`, `mokly-component-stylesheets.md` and
      `src/build/README.md` with a reference. Keep each doc within its cap.
- [x] Remove the stylesheet-ownership sentence from
      `docs/guides/authoring/components.md` and refer readers to the Changes
      guide by name. Guides contain no links.
- [x] Replace the other renderer-list summaries in the root README, the
      generated-rendering and imported-configuration contracts, and the Config
      and Styles guides with references to the rendering contract. Check the
      complete list and its order against `src/build/render.ts`, main's
      definition and a runtime probe.
- [x] Validate the changed Markdown and run the docs tests.
- [x] Use the protocol history guard's linked `M24` label for the planned
      heading rule in both Delivery Status sections. Run that guard after the
      first full unit run.
- [x] Run `npm run build` and the exact complete unit command before the
      local milestone commit. Apply the user's approved isolated retry if the
      existing PostCSS timing test is the only full-suite failure. Record both
      results. The reviewer owns the later push and review.

Documentation and verification are complete. Delivery is one local commit;
the reviewer owns the push. Milestones 23 and 24 have not started.

Implementation notes:

- The usage and instance contracts treat former-spelling comments as ordinary
  content on both sides. Their Delivery Status sections mark the rule as
  planned for M23. Frozen instance and slot key domain strings stay unchanged.
- The evidence presentation and shell contracts share the known-name rule for
  screens, saved views and document pages. An embedded public catalogue keeps
  its Details without the branch-point sentence. Delivery Status marks M24;
  the known-name mockups need no change.
- The rendering contract now owns the complete renderer stylesheet list.
  Main's order, optional generated links, missing configured rule, relative
  href encoding and example, dark/component/saved views, renderer link emission,
  page callbacks and pending resource targets retain their meaning. The other
  contracts, READMEs and guides refer to that owner. Guides use names without
  links. The component guide refers to the Changes guide for attribution.
- The docs and README search found no other current translation or declared
  stylesheet-ownership claim. This milestone changes only Markdown and adds
  no file deletion. The four earlier approved deletions and the v3-to-v4
  catalogue fixture rename against `origin/main` remain unchanged.

Verification evidence:

- `npm run build` passes before the tests. The six requested docs suites pass
  all 26 tests. Changed-file Prettier passes. Each changed protocol stays below
  250 lines; no size cap or fixture changed.
- Before editing, `node .context/review/docs-probes.mjs` passes both supplied
  reproductions. `node .context/m22/renderer-stylesheet-probe.mjs` passes 13
  list/order cases: screens and saved component views, both viewports and
  schemes, URL encoding, first-rule selection, no configured rule, each
  optional generated link and no generated links.
- No other test or Mokly server process was running before the final suite.
  `npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"`
  passes 3,924 of 3,925 tests. Its only failure is the 20,000-file PostCSS
  timing case in `tests/postcss_dependency_review.test.ts`: 3,037.4 ms against
  its 2,500 ms limit. All other tests pass, including the docs history guard.
  No tests are skipped, cancelled or marked TODO.
- After confirming that no test or Mokly server process remained,
  `npx tsx --test tests/postcss_dependency_review.test.ts` passes all three
  tests on the first isolated retry, with no skips, cancellations or TODOs.
  The timed function takes 2,299.2 ms. The results are in
  `.context/m22/logs/unit-final.log` and
  `.context/m22/logs/performance-final-1.log`.
- The PostCSS timing test is an existing flake on this machine; its runtime
  code and test match `origin/main`. The user's follow-up permits this isolated
  retry when it is the only full-suite failure. Its code and limit are unchanged.
- `git diff --check` and `git diff --check origin/main` pass. The mainline
  path and deletion audit introduces no new removal. Historical plans,
  `docs/reviews/**` and changelogs remain unchanged.
- Logs and the renderer probe are under `.context/m22/`. `cargo xtask check`
  is not required for this docs-only milestone.

## Milestone 23: Remove the historical marker rename

- [x] Cover a former-spelling baseline whose recorded component ranges are
      missing. Follow the existing Invalid Or Missing Data contract: keep
      current builds and Browse usable, report Changes unavailable in Serve,
      and retain safe transactional failures for explicit export and publish
      captures. Clarify that the comment alone is not a validation error.
- [x] Failure-first: an unchanged page whose script contains each former
      marker spelling stays unchanged, and classification succeeds, in the
      complete comparison, the fast path and CSS containment. A real comment
      with the former spelling is ordinary content and creates no range.
- [x] Remove `FORMER_MARKERS` and `normalizeHistoricalDocument` from
      `src/review/ignore.ts`, `stripHistoricalMarkers`, the comment rename in
      `src/components/ranges.ts`, the former spelling in
      `src/review/css/normalized_ranges.ts`, and every call site. Remove the
      `historical` range dialect if nothing else needs it.
- [x] Remove or rewrite the tests that only cover the translation. Keep
      `main`'s tests.
- [x] Update the READMEs near the changed code. Run the focused tests and the
      complete unit suite with the approved timing-flake retry.
- [x] Run build, typecheck, lint, changed-file Prettier, the six docs suites,
      the exact complete unit command, then the complete `cargo xtask check`.
      Apply the approved isolated retry only for the existing PostCSS timing
      flake. Inspect the diff and deletions against `origin/main` and record
      the results and each new deletion. Make one local milestone commit;
      the reviewer owns the push.

Implementation notes:

- Both comparison sides now use the current marker functions. Range validation
  has no dialect argument, and CSS containment never renames document text or
  reads the former Review-ignore spelling.
- The 23 new regression tests cover each former spelling in script text on
  complete, fast and CSS paths; unchanged real catalogues and flows; ordinary
  comments without ranges, ignore regions or material markers; and invalid
  baseline range records. Before removal, 22 tests failed and one preservation
  test passed. All 23 pass after removal.
- A valid v5 metadata fixture with former-spelling component comments now
  follows the existing invalid-data path. Current Build succeeds. Watched and
  unwatched Serve keep Browse usable and show Changes unavailable. Export
  rejects the capture safely and retains the previous site. Publish rejects it
  before an upload. The existing handlers already do this, so no new fallback
  or command error path was added.
- The instance and usage contracts distinguish an ordinary comment from a
  missing required range. Their Delivery Status and the component README mark
  M23 implemented. The review README describes the shared grammar and command
  behavior.
- The audit found no active test that only covers translation. The test named
  "historical component markers remain unchanged" already compares unchanged
  current-spelling fixtures on main. Every existing test file stays unchanged;
  the new cases live in three test files and two helpers.
- The frozen key domains, generated-header recognition, legacy manifest names
  and historical manifest normalization stay unchanged. This milestone adds
  no file deletion. The four earlier approved deletions and the v3-to-v4
  catalogue fixture rename against `origin/main` remain unchanged.

Verification:

- `npm run build`, `npm run typecheck`, `npm run lint`, changed-file Prettier,
  all 26 requested docs tests and all 137 focused tests pass. Changed source
  and protocol files stay within their caps. The reviewer probe now reports
  unchanged results and no Changes rows.
- The exact complete unit command
  `npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"`
  passes 3,947 of 3,948 tests. Only the existing PostCSS timing case fails, at
  3,114.8 ms against its unchanged 2,500 ms limit. The first isolated
  `npx tsx --test tests/postcss_dependency_review.test.ts` retry passes all
  three tests, with the timed function at 2,276.6 ms.
- `cargo xtask check` passes the audit with main's existing exception,
  formatting, lint, file limits, repository checks, 15 Rust tests, typecheck,
  the 440-file example check and all six packaged-consumer scenarios. Its unit
  step runs all 3,948 tests: 3,947 pass, with the same timing case as its only
  failure at 3,217.0 ms. The command exits 1 at that step. Four isolated file
  retries exceed the limit at 2,661.7, 2,521.3, 2,650.6 and 2,654.5 ms; the fifth
  passes all three tests at 2,451.7 ms. No other test or server process runs
  beside these retries.
- The remaining gate steps run separately after that approved retry:
  `cargo xtask check --suite browser` passes all 772 tests, and
  `cargo xtask check --suite hydration` passes all 225 tests. No test is
  skipped, cancelled or marked TODO in these runs or either complete unit run.
- The PostCSS timing test is the existing machine-dependent flake; its code,
  test and limit match main and remain unchanged. The approved isolated retry
  is the only verification exception. Dependencies and audit rules are unchanged.
- The diff and deletion checks against fetched `origin/main` retain only the
  four earlier approved deletions and the catalogue fixture rename. This
  milestone deletes no files. Every existing test file is unchanged by M23.
  Logs, reports and exact commands are under `.context/m23/`.

Milestone 23 is implemented and verified under the approved timing-flake retry
rule. Delivery is one local commit; the reviewer owns the push. Milestone 24
has not started.

## Milestone 24: Hide the branch-point sentence when the name is unknown

Tags: ui

- [ ] Failure-first viewer tests with a real embedded catalogue (the
      `@mokly/viewer` public catalogue with no branch name) for a screen, a
      saved component view and a document page: Details show no branch-point
      sentence and keep the rest of the evidence. A served catalogue with a
      name still shows the sentence.
- [ ] Make the change once, in the shared comparison heading.
- [ ] Run the viewer and browser tests. Smoke-test an embedded and a served
      catalogue at mobile and desktop widths.

## Milestone 25: Verify, deliver and review

- [ ] Run `cargo xtask check` at 100%, inspect the diff and deletions against
      `origin/main`, and record the evidence.
- [ ] Run `git add -A`, commit with a Conventional Commit, and push the branch.
- [ ] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report numbered findings with
      severity, impact, lettered options and a recommendation, without
      changing the implementation.
