# Remove Source-Path Evidence

Status: Active. Milestones 1 to 30 are implemented, verified and pushed.
Milestone 30A integrates `main` #124, #140 and #141 and combines the two build
warning systems, as the user decided on 2026-10-06. Milestones 31 and 32
remain. Main's #140 removes the `source-map-js` audit blocker.

## Status And Outcome

Status: Milestones 1 to 25, including 19A, 20A, 20B, 23A and 23B, are
implemented, verified and pushed. The branch was reviewed four times after the
earlier deliveries. Milestones 9 to 11 fixed the review findings that the user
chose on 2026-09-25, and Milestones 12 to 15 implemented the user's 2026-09-26
decisions. Milestones 16 to 21 merge main 0.13.0 and apply the 2026-10-03 CSS
change rule, which replaces second-review finding 1. Milestones 22 to 25, with
23A and 23B, apply the user's 2026-10-04 decisions on the third review and on
baseline compatibility. Milestones 26 to 32 apply the user's 2026-10-05
decisions on the fourth-review finding and on second-review findings 2 to 11.
Milestones 26 to 30, with 28A, are implemented, verified and pushed. Milestone
28A integrated `main` #131, #133 and #132. Milestone 30A integrates `main` #124,
#140 and #141 before Milestones 31 and 32.
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
Milestone 21 was pushed and reviewed. Its third-review decisions are implemented
in Milestones 22 to 24. The plan stays active until the pull request merges.
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
  Without `--strict`, warnings do not affect exit codes. Strict commands count
  every producer. Plain and rich CLI reporting follows the
  [warning contract](../docs/protocol/mokly-build-warnings.md).
- Versions after the 0.13.0 integration: manifest v8 is main's v7 without
  `dependencies`, `declaredDependencies` or `ownedDependencies`, and retains
  declared-stylesheet provenance. Baselines require canonical, valid v8 output
  with the same validation as current output. Lower integer versions and former
  manifest names without the canonical file are incompatible earlier output;
  former names are sentinels only and their contents are never read. No schema,
  removed-field, variant or stored-layout conversion remains. Catalogue read model v4
  is main's v3 without `details.dependencies`. Unified comparison result v5 is
  main's v4 without result `sharedImpact` or entry `dependencies` and
  `sharedImpact`. All catalogues use that one classifier and format. Public
  readers reject catalogue v1 to v3 and comparison v4 and earlier; regenerate
  older exports. The process-local live index adopts the v8 entry shape.
  The unreleased versions change in place for CSS: v8 adds an explicit root
  output range and stops writing CSS resource owners; v5 adds rule identity,
  changed component ids and page evidence; v4 carries the same public evidence
  on views and whole-document pages. Every accepted component saved view has its
  root range. Every persisted usage record has an `insertedStylesheets` array,
  including an empty array. V8 records with CSS owners, missing roots or missing
  provenance are invalid, including earlier output from this branch. Keep main's
  fixed pane paths and unchanged snapshot bytes. Incompatible earlier output
  makes Changes unavailable with the existing message while Build, Serve, export
  and publish succeed. Invalid v8 follows the existing invalid-baseline path.
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

Later on 2026-10-04 the user also decided to remove the branch's baseline
backward compatibility and return to `main`'s rule. A comparison base is
compatible only when it contains the canonical `mokly-manifest.json` with a
valid current manifest (v8). An integer version below 8 is incompatible
earlier output, and `mokabook-manifest.json` or `mockbook-manifest.json`
without a canonical manifest is a sentinel for earlier output, not an input.
Incompatible output keeps `main`'s graceful outcome: Changes is unavailable,
and Build, Serve, export and publish still succeed. Mokly no longer
normalizes v3 to v7 metadata, strips removed fields from baselines, flattens
earlier variants, guards older stored layouts, or keeps compatibility rules for
earlier v8 output from this branch. A comparison of this branch with `main`
shows Changes as unavailable until `main` writes manifest v8. The user did not
ask to remove `main`'s recognition of former "Generated by mokabook" output
headers or the frozen `mokabook-instance-v1` and `mokabook-slot-v1` key
domains; they stay. The removed-field build warnings for authoring input stay
(2026-09-26 decision); they are not baseline compatibility.

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

## Milestone 23A: Document the removal of baseline compatibility

Docs only.

- [x] Restore `main`'s compatible, incompatible and invalid baseline rules in
      `docs/protocol/mokly-baseline-compatibility.md`, with manifest v8 in
      place of v7. Remove the historical normalization and older-layout guard.
- [x] Remove every statement about historical v3 to v7 metadata, former
      manifest file names as inputs, older stored layouts, and compatibility
      rules for earlier v8 output (for example missing root output ranges,
      historical CSS owner records, old provenance) from the protocols,
      guides, READMEs and this plan's Decisions And Scope. Data that does not
      match the current v8 shape follows the invalid-baseline path.
- [x] Mark the code work as planned for Milestone 23B. Validate the changed
      Markdown and run the docs tests.

Contract notes:

- Only canonical, valid v8 data is compatible. Lower integer versions and
  former-name sentinels retain main's graceful unavailable outcome. Invalid
  v8 data has no compatibility repair or fallback.
- Every persisted v8 usage record requires an `insertedStylesheets` array,
  including an empty array. Current writers already emit it. Public inspection
  continues to omit this private field. Every available component saved view
  requires its root range; added/removed views and paired Review-ignore keep
  their existing rules.
- Keep normal historical comparison of valid v8 snapshots, including baseline
  props and slots checked against the baseline's own definitions. Main's public
  inspection rules for a past snapshot against newer definitions are not schema
  compatibility and remain intact.
- Main's cache can retain recognized incompatible output to avoid rebuilding
  it for every request. Remove the branch's normalization-aware version
  retention and old-layout admission. Cache reuse never makes old data compatible.

Verification: changed-file Prettier and all 26 requested docs tests pass. Every
changed protocol stays within its cap; no split or fixture change is needed.
The baseline contract restores main's outcome table and message with v8 as the
current version. This milestone changes only Markdown and deletes no files.
The audit found no guide that claimed support for older baseline schemas.
The code work remains planned for M23B. Logs are under `.context/m23ab/logs/`.

## Milestone 23B: Remove baseline compatibility

- [x] Failure-first: a v7 baseline (main's current output), a v3 to v6
      baseline and a base with only a former manifest name each give the
      incompatible outcome in Serve, export and publish, with no crash; a
      valid v8 baseline compares normally; an earlier v8 shape follows the
      invalid-baseline path.
- [x] Remove historical metadata normalization
      (`src/registry/historical_manifest.ts` and its callers), the former
      manifest names as inputs, the older-layout guard, the derived-cache
      retention of original versions, and the earlier-v8 compatibility rules
      in classification, CSS containment and the viewer readers. Keep `main`'s
      sentinel recognition, the "Generated by mokabook" header recognition and
      the frozen key domains.
- [x] Remove or rewrite the tests that only cover the removed compatibility.
      Restore `main`'s baseline compatibility tests with v8 in place of v7.
- [x] Update the READMEs near the changed code. Run the focused tests and the
      complete unit suite, with the approved isolated PostCSS timing retry.
- [x] Require complete private v8 provenance and root proof at admission.
      Preserve public inspection's privacy boundary and main's handling of
      valid past v8 definitions. List each removed compatibility path below.
- [x] Use the existing fixture `beforeRemove` hook for spawned warning-test
      Serve processes and the new baseline Serve cases. A watched warning test
      stalled after its fixture was removed before its process closed. Keep
      production warning behavior and assertions unchanged; verify cleanup
      before repeating the complete checks.
- [x] Run the requested build, type, lint, formatting, docs, unit and full
      repository checks. Smoke-test `npm run dev -- --base origin/main` with
      main's v7 output. Inspect the diff and deletions, record every removal,
      and make one local code commit. Do not push.

Removed compatibility paths:

- `registry/historical_manifest.ts`: remove v3 to v7 conversion, generated-by
  renaming, removed-field stripping, collection removal, variant flattening,
  route removal and source-inventory synthesis. Only current v8 is accepted.
- The same converter's CSS-owner filter: remove repair of earlier v8 records;
  current and baseline readers reject stored stylesheet owners.
- `registry/historical_layout.ts`: remove older-layout admission and its
  caller. Every lower integer version is incompatible before shape checks.
- `review/base_manifest.ts`: restore main's former-name sentinels. Their
  contents are never read, and invalid canonical data never falls back.
- `baseline/manifest.ts`: restore main's adoption gate with v8 as current.
  Remove normalization-aware original-version retention. Main's cache still
  retains recognized incompatible output to avoid repeated builds; a cache
  entry does not make that output compatible. Former names use main's fixed
  sentinel value. `cache.ts` matches main and `cache_layout.ts` differs only
  by the current version ceiling.
- Private component validation: remove the historical flag that bypassed
  current props, slots and root rules. Both manifest readers apply one v8
  validator using each manifest's own component definitions.
- Viewer root validation and CSS containment: remove missing-root admission
  for earlier saved views. Each available original saved view must prove one
  root range. Added/removed sides and paired Review-ignore keep their rules.
- `components/comparison_stylesheets.ts`: remove the missing-provenance empty
  fallback. Every persisted usage record requires `insertedStylesheets`, even
  when empty. Public inspection still omits this private field.
- Historical manifest types and reader comments now mean exactly v8. Main's
  public inspection of valid past snapshots against newer props/slots stays;
  it does not admit an earlier manifest shape.

Eight branch-added files are deleted. None exists on `origin/main`:

- `src/registry/historical_manifest.ts`: the removed metadata converter.
- `src/registry/historical_layout.ts`: the removed older-layout guard.
- `tests/historical_layout.test.ts`: replaced by strict version-gate tests.
- `tests/historical_layout_commands.test.ts`: replaced by the v3 to v7 and
  former-name command matrix, including watched Serve with v7.
- `tests/historical_removed_formats.test.ts`: removed conversion-only tests;
  strict current/baseline admission tests replace them.
- `tests/manifest_v6_history.test.ts`: removed v7-to-v8 normalization tests;
  current v8 comparisons and incompatible v7 are tested directly.
- `tests/helpers/historical_layout_fixture.ts`: removed the unused old-format
  serializer. The M23 marker fixture now uses current v8 metadata.
- `tests/helpers/nested_baseline_fixture.ts`: removed the unused old-layout
  fixture. Command tests use explicit incompatible or invalid baselines.

Main's baseline compatibility tests are restored with v8 as current and v9 as
newer. The generated-header recognizers, frozen key domains and removed-field
authoring warnings are unchanged. M23's marker regressions remain in place.
The code and README status notes now mark M23B implemented. M24 stays pending.

Failure-first evidence: the initial admission/command/cache run has 44 tests,
with 37 expected failures and seven passes. The invalid-v8 command run fails
all 12 tests. The provenance/root guard run has 22 tests, with 13 expected
failures and nine passes. The CSS root run has eight tests, with one expected
failure and seven passes. These runs overlap; their counts are not added.
After removal, the initial focused run passes all 74 tests. Logs and commands
are retained under `.context/m23ab/`.

Verification:

- `npm run clean` and `npm run build` pass. The clean rebuild removes stale
  compiled copies of the deleted registry modules. `npm run typecheck` passes.
  The first `npm run lint` finds one import-order error in a new test; the
  corrected run passes. Changed-file `npx prettier --check` passes.
- The final focused run passes all 125 tests. It covers strict admission,
  command outcomes, caching, roots, provenance, former marker text and valid
  past-snapshot inspection:

  ```sh
  npx tsx --test --test-concurrency=2 tests/current_baseline_contract.test.ts tests/current_baseline_commands.test.ts tests/current_baseline_invalid.test.ts tests/baseline_compatibility.test.ts tests/baseline_cache.test.ts tests/component_root_output.test.ts tests/component_css_owner_filter.test.ts tests/css_root_membership.test.ts tests/id_keyed_wire_formats.test.ts tests/former_marker_baseline.test.ts tests/former_marker_classification.test.ts tests/former_marker_content.test.ts tests/component_manifest.test.ts tests/component_stylesheet_provenance.test.ts tests/component_stylesheet_provenance_part2.test.ts tests/catalogue_reader.test.ts tests/historical_snapshot_identity.test.ts packages/viewer/tests/historical_baseline.test.tsx
  ```

- All 26 requested docs tests pass:

  ```sh
  npx tsx --test tests/current_docs_contract.test.ts tests/component_protocol_docs.test.ts tests/guides_structure.test.ts tests/protocol_doc_sizes.test.ts tests/protocol_split_links.test.ts tests/mainline_preservation_docs.test.ts
  ```

- `npm run dev -- --base origin/main --port 0` and
  `node .context/m23ab/smoke.mjs` pass the real example smoke check. The rebuilt
  `800fe9f8` base has manifest v7. Serve prints the exact earlier-version
  message once, exposes 107 current screens, sets Changes unavailable and
  advertises no comparison or removed entries. Desktop (1440 x 1000) and
  mobile (390 x 844) both render Welcome and keep All navigation usable. No
  browser page error occurs. Screenshots and JSON evidence are in
  `.context/m23ab/`. The smoke server is stopped before unit verification.
- The exact complete unit command finishes with 3,961 of 3,962 tests passing:

  ```sh
  npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"
  ```

  Only the existing PostCSS timing case fails, at 2,954.3 ms against its
  unchanged 2,500 ms limit. After confirming no other test or server process
  runs, `npx tsx --test tests/postcss_dependency_review.test.ts` fails once at
  2,851.6 ms, then passes all three tests at 2,380.5 ms. This is the existing
  machine-dependent flake; the test and timed code match main. No code or
  limit is changed. There are no skipped, cancelled or TODO tests.

- The first `cargo xtask check` passes repository and package checks, including
  all six packaged-consumer scenarios. Its unit step stalls in
  `tests/build_warning_serve.test.ts`: the fixture is already removed while
  its watched process remains alive for more than four minutes. The gate is
  stopped (exit 143), and its process tree is drained; this attempt is not
  counted as a passing check. The existing `beforeRemove` fixture hook now
  closes that process before deletion. The new baseline Serve tests use the
  same hook. Production warning code and all warning assertions stay unchanged.
  This test cleanup repair is the only added implementation task.
- After the cleanup repair, all 37 affected tests pass:

  ```sh
  npx tsx --test --test-concurrency=2 tests/build_warning_serve.test.ts tests/current_baseline_commands.test.ts tests/current_baseline_invalid.test.ts
  ```

- The restarted `cargo xtask check` passes the audit with main's existing
  Braces exception, formatting, lint, file limits, repository checks, all 15
  Rust tests, type checks, the 440-file example check and all six packaged
  consumer scenarios. All three repaired Serve warning tests pass in its
  complete unit step. That step runs all 698 test files and all 3,962 tests:
  3,961 pass, and only the existing PostCSS timing case fails at 3,109.3 ms.
  The complete gate exits 1 at that step. Dependencies and audit rules are
  unchanged.
- With no other test or server process running,
  `npx tsx --test tests/postcss_dependency_review.test.ts` fails twice, at
  2,553.7 and 2,536.8 ms, then passes all three tests at 2,185.3 ms. The approved
  isolated retry is the only remaining verification exception.
- The remaining complete gate sections then run in order:
  `cargo xtask check --suite browser` passes all 772 tests;
  `cargo xtask check --suite hydration` passes all 225 tests. Both exit 0.
  Neither run has skipped, cancelled or TODO tests. Reports and logs are
  retained under `.context/m23ab/`.
- Final changed-file formatting uses the recorded list of changed and new
  files. It passes, and the six docs suites above pass all 26 tests again:

  ```sh
  xargs -d '\n' npx prettier --check < .context/m23ab/23b-changed-files.txt
  ```

- The final audit uses fetched `origin/main` at `800fe9f8` and
  `git diff --name-status origin/main`,
  `git diff --diff-filter=D --name-status origin/main` and `git diff --check`.
  The eight local deletions above remove only branch-added files. Main's
  deletion list still contains only the four earlier approved removals:
  `examples/basic/entries/design/library/style_context.tsx`,
  `src/components/dependency_validation.ts`,
  `src/registry/dependency_paths.ts` and
  `tests/design_library_style_collector.test.tsx`. The approved catalogue
  fixture rename from v3 to v4 remains. There is no new main-owned deletion.
  Protected headers, key domains, dependencies, audit rules and timing-test
  code remain unchanged. Generated example output is not hand-edited.

Milestone 23A is delivered as local commit `26473dc1`. Milestone 23B is
implemented and verified under the approved timing retry rule, with one local
code commit. The warning-test cleanup repair above is the only added task.
No push or implementation review is performed. Milestone 24 has not started.

## Milestone 24: Hide the branch-point sentence when the name is unknown

Tags: ui

- [x] Failure-first viewer tests with a real embedded catalogue (the
      `@mokly/viewer` public catalogue with no branch name) for a screen, a
      saved component view and a document page: Details show no branch-point
      sentence and keep the rest of the evidence. A served catalogue with a
      name still shows the sentence.
- [x] Make the change once, in the shared comparison heading.
- [x] Run the viewer and browser tests. Smoke-test an embedded and a served
      catalogue at mobile and desktop widths.
- [x] Add a failure-first browser check through the existing embedded viewer
      harness for a screen and a saved view at both widths. Pin the served
      sentence for a screen and a saved view in the served outside-evidence
      spec; the served page spec already pins it.
- [x] Mark M24 implemented in both Delivery Status notes, and state in the
      presentation contract that an empty or blank name is unknown. Update
      the shell README, the viewer package README and the Details guide.
- [x] Run build, typecheck, lint, changed-file Prettier, the six docs suites,
      the exact complete unit command and the complete `cargo xtask check`.
      Inspect the diff and deletions against `origin/main`. Make one local
      milestone commit; the reviewer owns the push.

Implementation notes:

- `ComparisonHeading` in `packages/viewer/src/shell/evidence_details.tsx`
  renders “Compared with the branch point on \<name\>.” only for a name that
  is not empty or blank. Screens, saved views and document pages share it, so
  the rule is in one place. No placeholder text is shown.
- The embedded viewer gets an empty name from `viewerContext` and
  `publicWorkspace`. Its Details keep the “Comparison details” heading and the
  files, selectors, exclusions and status lines.
- The viewer search found no other text that prints the base name. The
  standalone document's `data-mokly-base` attribute is not displayed text, and
  only served and exported documents carry it. The `ShellContext.base` doc
  comment now says that an empty name means unknown.
- Serve and export render the routed screen and saved view from a private
  workspace with the shell's name, so they keep the sentence. A workspace that
  a served or exported shell builds from public data has no name. In a
  standalone export, client navigation shows that public fallback until the
  destination's inert workspace loads. A probe held that load for four
  seconds: the fallback showed no branch-point sentence and no “Changed
  component” line, then the loaded workspace showed both. Before this change
  the fallback showed “Compared with the branch point on .”; `main` has the
  same fallback. This milestone leaves the fallback unchanged and reports it.
- No mockup shows an embedded catalogue's Details, so no mockup changes.
- This milestone deletes no files. The four earlier approved deletions and the
  v3-to-v4 catalogue fixture rename against `origin/main` remain unchanged.

Verification:

- The 8 new viewer tests in `packages/viewer/tests/comparison_heading.test.tsx`
  render the published fixture through `renderViewer` for the embedded case
  and through `renderHydratedShellPage` with a private catalogue for the served
  case. Before the change, 5 failed (the embedded screen, saved view, page and
  changed page, and the heading test), each on “Compared with the branch point
  on .”; the 3 served preservation tests passed. All 8 pass after the change.
- The 4 new browser tests in `tests/browser/viewer_details.spec.ts` mount
  `@mokly/viewer` through the existing embedded harness with ready Changes.
  Against the old viewer build all 4 failed, only on the empty sentence; all 4
  pass with the change. The related evidence, page, outside-evidence, viewer
  lifecycle and layout specs pass 80 tests; the changed specs pass 23 again
  after the final edits.
- `npm run build`, `npm run typecheck` and `npm run lint` pass. Changed-file
  Prettier, the six requested docs suites (26 tests) and the protocol history
  guard pass. The focused viewer and Details run passes 331 tests.
- The smoke exported the example with `--base HEAD` and served it with
  `npm run dev -- --base HEAD`, with two temporary rules
  (`.example-head h1` and `.example-action`). At 390 × 844 and 1440 × 1000,
  served Details for Welcome, Action › Default and Getting started start with
  “Compared with the branch point on HEAD.”. The same entries embedded through
  `@mokly/viewer` over the export show no such sentence and the same files and
  selectors. No page error occurred. Both rules were restored and the example
  Git status is clean. Screenshots are under `.context/screenshots/m24/`;
  results and logs are under `.context/m24/`.
- The exact complete unit command passes 3,969 of 3,970 tests. Its only
  failure is the existing PostCSS timing case, at 2,698.6 ms against its
  unchanged 2,500 ms limit. The first isolated
  `npx tsx --test tests/postcss_dependency_review.test.ts` retry passes all
  three tests. No test is skipped, cancelled or marked TODO.
- `cargo xtask check` passes the audit with main's accepted Braces exception,
  formatting, lint, file limits, repository checks, Rust formatting and
  clippy, 15 Rust tests, typecheck, the 440-file example check and all six
  packaged-consumer scenarios. Its unit step runs all 699 test files and all
  3,970 tests: 3,969 pass, and only the existing PostCSS timing case fails,
  at 3,094.4 ms. The command exits 1 at that step. The first isolated retry
  passes all three tests. Then `cargo xtask check --suite browser` passes all
  776 tests and `cargo xtask check --suite hydration` passes all 225. Both
  exit 0, with no skipped or cancelled tests.
- The PostCSS timing test is the existing machine-dependent flake; its code,
  test and limit match main and remain unchanged. The approved isolated retry
  is the only verification exception. Dependencies and audit rules are
  unchanged.
- After `git fetch origin main`, main is still `800fe9f8` and
  `git log HEAD..origin/main` is empty. The deletion list against
  `origin/main` holds only the four earlier approved deletions, and the
  catalogue fixture rename remains. This milestone changes nine files, adds
  two test files and deletes none. `git diff --check` passes. Logs and gate
  reports are under `.context/m24/logs/`.

Milestone 24 is implemented and verified under the approved timing retry
rule. Delivery is one local commit; the reviewer owns the push and the review.

## Milestone 25: Verify, deliver and review

- [x] Run `cargo xtask check` at 100%, inspect the diff and deletions against
      `origin/main`, and record the evidence.
- [x] Run `git add -A`, commit with a Conventional Commit, and push the branch.
- [x] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report numbered findings with
      severity, impact, lettered options and a recommendation, without
      changing the implementation.

Fourth review outcome (2026-10-05, `0f1967a2` against `origin/main` at
`800fe9f8`): 1 verified finding, reported to the user and not fixed. Medium:
`src/components/render.tsx` passes the complete `RenderInput.stylesheets` list,
which includes generated CSS from JavaScript imports, as the configured
placement anchors for declared component stylesheets. With no configured link,
declared CSS goes before the generated entry CSS instead of at the end of the
head, so the CSS cascade can differ from the placement contract. Probes are in
`.context/review2/`. The other 48 probe groups pass.

Verification evidence (2026-10-04, part 1):

- `git fetch origin main` succeeds. Main remains
  `800fe9f88a0173429b25baa1bcf41ed9e59b2256`; the verified source and pushed
  branch tip are `de139ccbf9e296fe7c872069929f0eed839a3da5`.
  `git log --oneline HEAD..origin/main` is empty, and
  `git merge-base --is-ancestor origin/main HEAD` exits 0. No merge was needed.
- The complete `cargo xtask check` passes the audit with main's existing
  exception, formatting, lint, file limits, repository ratchets, Rust format
  and clippy, all 15 Rust tests, build, type checks, the 440-file example check
  and all six packed-consumer scenarios. Its unit step covers all 699 files
  and 3,970 tests. It passes 3,969 tests and exits 1 only for the existing
  PostCSS timing case: 2,564.5 ms against the unchanged 2,500 ms limit.
- With no other test, server or browser process active,
  `npx tsx --test tests/postcss_dependency_review.test.ts` passes all three
  tests on the first isolated retry. The timed function takes 2,221.7 ms.
  The remaining gate sections then run separately:
  `cargo xtask check --suite browser` passes all 776 tests, and
  `cargo xtask check --suite hydration` passes all 225 tests. Both exit 0.
  Neither suite skips or cancels a test.
- After all smoke work stops and all temporary edits are restored, the exact
  separate unit command runs:

  ```sh
  npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"
  ```

  It passes 3,969 of 3,970 tests and exits 1 only for the same timing case,
  at 2,564.6 ms. With no other test, server or browser process active,
  `npx tsx --test tests/postcss_dependency_review.test.ts` passes all three
  tests on the first isolated retry, at 2,222.6 ms. Neither complete unit run
  skips, cancels or marks a test TODO. The timing test and its code match
  `origin/main`. The approved isolated retry is the only verification exception.

- CSS smoke uses a temporary copy of the full example. Its four delivery
  links exist before a committed v8 baseline, so link setup adds no unrelated
  Changes rows. `npm run example:build -- --config .context/m25/example/examples/basic/mokly.config.ts`
  and the matching `npm run example:check -- --config .context/m25/example/examples/basic/mokly.config.ts`
  pass with 442 outputs. The root command
  `npm run dev -- --config .context/m25/example/examples/basic/mokly.config.ts --base HEAD --port 0`
  serves the fixture. The smoke scripts record the absolute config paths in
  `.context/m25/commands.jsonl`.
- `node --import tsx .context/m25/smoke.mjs` passes all 12 CSS cases at
  390 × 844 and 1440 × 1000. Configured CSS, declared `stylesheets`, CSS
  imported by a declared stylesheet and CSS imported from JavaScript each
  pass these three cases:
  - `.example-action { opacity: 0.97; }` lists Action and its three saved
    variants in Changes. Welcome, Welcome empty, Details and Toolbar Default
    appear under Affected screens and components.
  - `.example-head h1 { letter-spacing: 0.75px; }` lists Welcome, Welcome
    empty, Details and Example tour. Action stays unchanged and has no
    affected consumers.
  - `.example-screen .example-action { opacity: 0.96; }` gives the same
    screen and flow rows. The rule styles Action on screens but has no
    own-page match, so Action stays unchanged.
- The browser checks Changes membership, Affected screens, computed styles
  and exact Details text at both widths. Current and loaded Side by side
  keep the same files and selectors once. The selected API agrees with the
  catalogue. Configured, declared and imported CSS name their actual files;
  JavaScript delivery names the emitted bundle and never its private CSS
  source. No browser page error occurs.
- `node --import tsx .context/m25/marker.mjs` passes at both widths. The
  handbook script contains the former component, Review-ignore and material
  marker spellings. Its generated page bytes remain equal to the baseline,
  the script text stays intact, Changes stays empty, and Details show
  “No changes to this page.”
- `npm run dev -- --base origin/main --port 0` and
  `node --import tsx .context/m25/v7.mjs` pass at both widths. The cached
  `800fe9f8` base has manifest v7. Serve prints the exact earlier-version
  message once. The catalogue sets Changes unavailable, advertises no
  comparison or removed entries, and keeps all 107 current screens usable.
  The All filter lets the user open Details from Welcome. The first mobile capture ran
  before the selected frame painted. A second passing run waits for that
  frame's ready state and visible heading; the final screenshots show its
  loaded preview.
- `node --import tsx .context/m25/embedded.mjs` passes for Welcome, Action
  Default and Getting started, served and embedded, at both widths. The
  public `@mokly/viewer` renders the real exported fixture catalogue. Its
  Details omit the branch-point sentence and keep the same files and selectors
  as the served catalogue. Served Details keep the HEAD sentence. The first
  setup used an export folder outside the fixture root and was rejected.
  The corrected setup uses the fixture's `.context/site` and passes all
  12 served/embedded checks. This changes only the temporary smoke harness.
- Every temporary edit is restored. The fixture is rebuilt, checked and
  confirmed clean with Git, then removed with its export. The normal example
  has no tracked edits. The final `npm run example:check` passes with 440
  valid, untracked outputs. No smoke server or browser remains before the
  separate unit run.
- `git diff --name-status origin/main` contains 713 inspected paths.
  `git diff --diff-filter=D --name-status origin/main` contains only the four
  approved earlier removals:
  `examples/basic/entries/design/library/style_context.tsx`,
  `src/components/dependency_validation.ts`,
  `src/registry/dependency_paths.ts`, and
  `tests/design_library_style_collector.test.tsx`. The approved v3-to-v4
  catalogue fixture rename remains. This task adds no deletion and changes
  only this plan and its entry in `plans/README.md`.
- Exact commands, logs, gate reports, smoke results and the verification report
  are under `.context/m25/`. The 114 screenshots are under
  `.context/screenshots/m25/`. The Braces audit exception remains valid through
  2026-11-03 UTC. Dependencies, overrides and audit rules are unchanged.
  Earlier unselected review findings remain open.

The reviewer pushed the verification commit and ran the review. Its outcome
is recorded above. The plan remains active until the pull request merges.

On 2026-10-05 the user decided the fourth-review finding and second-review
findings 2 to 11. The numbers below are the ones the user saw on 2026-10-05:

1. Generated CSS as placement anchors (fourth review): option A. Only
   configured hrefs choose where Mokly inserts declared component stylesheet
   links. The renderer still receives the complete `RenderInput.stylesheets`
   list.
2. Repeated warnings in watched Serve: option A. Each warning carries the build
   generation that produced it. Watched Serve prints the warnings of the
   current attempt once. A warning from an older generation never prints after
   a newer attempt starts. This covers background compilation, its completion
   and preview-process renders.
3. The Excluded styles mockup: option A. Add a screen mockup for the
   excluded-only state: the screen stays out of Changes, and its Details end
   with "No changes to this screen." Split the Stylesheet evidence mockup page
   into linked child pages, because it already has five screens. Give the
   linked Excluded and Matched mockups one shared Details card that matches the
   viewer. Remove the sentence that the product never shows, and fix the docs.
4. Tests that do not protect their rules: option B. Fix each weak test and
   show that each one fails when its rule is broken. Record each failing run in
   this plan.
5. The docs guard test: option B. Former version names, removed field names
   and plan or milestone references are allowed only in Delivery Status
   sections or on a short reviewed allow list. The test fails closed and reads
   statements across line breaks.
6. Stale docs: option B. Fix the remaining stale lines, and move every plan or
   milestone reference in docs and READMEs into Delivery Status sections.
7. TypeScript claims: option A. Add `sharedImpact?: never` to the review
   configuration type, with a type test. State that an explicit `undefined` is
   rejected only with `exactOptionalPropertyTypes`; otherwise the build
   warning covers it.
8. Review-ignore around inserted links: option A. Mokly finds the links that it
   inserted from their recorded spans, also inside Review-ignore regions. The
   author's own ignored content stays ignored.
9. Link scans: option A. One shared link finder serves every step, and the
   contract states which part of the document each step uses. A renderer link
   to a declared stylesheet that resource discovery finds, including one in
   `<body>`, is reused, so Mokly inserts no second link.
10. Watchers after a failed Serve start: option A. Create the process
    supervisor inside the cleanup block, with a test.
11. Unused code: option A. Delete `ComponentRuntime.warnings` and the unused
    one-sided page material.
12. The branch name in exported catalogues: option B. The temporary view
    during navigation uses the known branch name.

The user gave no decision about the Unmodified badge on document pages, so it
keeps the screen rule.

Later on 2026-10-05 the user decided to integrate `main` before Milestones 29
to 32, and to combine the two format changes. `main` moved to `60d48370` with
#131 (file-path identity and Markdown documents) and #133 (plan status
paragraphs). #131 replaces `id` and `navPath` with one file-derived path per
entry, adds Markdown documents and move detection, renames Pages to Specs, and
moves the example catalogue to `examples/basic/specs/`. It also defines its own
unreleased manifest v8, catalogue read model v4 and review result v5. The
merged branch keeps one unreleased manifest v8, catalogue read model v4 and
review result v5. They carry main's path identity and this branch's records;
no version is added. Every record, field and message of this branch that names
an entry uses main's path identity. The branch adopts #133: there is no plans
index, and each plan states its status in its first paragraph.

## Milestone 26: Document the 2026-10-05 review decisions

Docs only. Define the contract for Milestones 27 to 31.

- [x] Placement (1): state in `mokly-component-stylesheets.md` that only
      configured hrefs are placement anchors. Generated renderer and entry
      stylesheet links are not anchors, although `RenderInput.stylesheets`
      contains them. With no configured link present, insert at the end of
      logical head content, after the generated links.
- [x] Warnings (2): define generation-scoped warnings in the build warning,
      Serve and watch contracts. Cover background compilation, its
      completion, preview-process renders, failed and successful rebuilds, and
      reconfiguration.
- [x] Links (8, 9): define one link finder and the document scope of each step
      (placement, reuse, provenance and resource discovery). Reuse every
      renderer link that resource discovery finds, including links in
      `<body>`. Find Mokly-inserted links from their recorded spans, also
      inside Review-ignore regions, while author content stays ignored.
      Remove the stale "resource owner record" wording.
- [x] Types (7): correct the TypeScript statements in the build warning,
      configuration and authoring contracts.
- [x] Exported navigation (12): define in the CSS evidence presentation and
      shell contracts that the temporary view uses the known branch name.
- [x] Docs rule (5, 6): add the rule to `docs/protocol/README.md` that former
      version names, removed field names and plan or milestone references
      appear only in Delivery Status sections or on the reviewed allow list.
      Fix the remaining stale lines: the design-links row for the Unnamed
      styles All filter, the example README review-fix and watch wording, the
      design library README neighbour wording, and the protocol index rule
      that names the current plan. Move every plan or milestone reference in
      docs and READMEs into Delivery Status sections.
- [x] Mark each code change as planned for its milestone. Validate the changed
      Markdown and run the docs tests.
- [x] Preserve the design-count test's two documented count sentences while
      adding the Unnamed link row. Run its focused test and repeat the complete
      unit suite after the wording correction.

Contract notes:

- Only configured head links anchor insertion. The renderer keeps its complete
  stylesheet list. With no configured anchor, declared links follow generated
  links at the end of logical head content.
- The new `mokly-stylesheet-links.md` owns the shared finder and the scope of
  placement, reuse, provenance and discovery. Body links are reused. Template
  content stays inert. Reserved-token validation includes template attributes,
  but only active links get recorded spans. Both comparison paths recover
  inserted links inside Review-ignore without restoring ignored author content.
- Warning scopes advance before each watched attempt starts. Late background
  and child warnings retain their producing generation and cannot enter a newer
  scope. Failed attempts leave old output serving without reviving its warnings.
  Completion does not add `compilation.warnings` again. Unwatched Serve and
  one-shot scopes are unchanged.
- Removed-field values are rejected by `?: never`; explicit `undefined` needs
  `exactOptionalPropertyTypes`. Runtime warnings cover the other case. M30 owns
  the missing review configuration guard and its type tests.
- Exported navigation keeps its known branch name in the temporary public-data
  workspace. Nameless embedded catalogues still omit the sentence. M31 owns
  the implementation; M27 owns the excluded-only and paired Details mockups.
- The protocol index defines the fail-closed docs rule and the permitted exact
  allow-list scopes for M30. Delivery references moved into Delivery Status
  sections. Upload Plan terminology and SVG path commands remain domain terms.
  The dated design snapshot changed only to place its existing status under
  that heading. Historical plans, review records and `CHANGELOG.md` are unchanged.
- Stale design navigation, example watch/copy and library-neighbour statements
  now describe the current output or explicitly named pending contract. Each
  code or mockup change remains planned for its assigned later milestone.

Verification evidence:

- `npm run build` passes twice. Changed-file formatting passes with
  `xargs -d '\n' npx prettier --check < .context/m26/changed-files.txt`.
- The seven requested docs suites pass all 28 tests:

  ```sh
  npx tsx --test tests/current_docs_contract.test.ts tests/component_protocol_docs.test.ts tests/guides_structure.test.ts tests/protocol_doc_sizes.test.ts tests/protocol_split_links.test.ts tests/mainline_preservation_docs.test.ts tests/protocol_doc_history.test.ts
  ```

  The first run passed 27 of 28. The existing guard rejected the new config
  status sentence because it did not call the named field removed. Correcting
  that sentence made the check pass. The tests remain unchanged. Later focused
  runs and the final complete suite pass all 28.

- The exact complete unit command ran twice:

  ```sh
  npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"
  ```

  The first run passed 3,969 of 3,970. Only the design-screen count test failed:
  it reads two exact count sentences that the design-links edit had rephrased.
  Restoring those sentences retained the new Unnamed filter row and the
  327-line cap. `npx tsx --test tests/design_screen_counts.test.ts` then passed
  its one test. The repeated complete suite passes all 3,970 tests with no
  failures, skips, cancellations or TODOs. The PostCSS timing case passes in
  both runs; no timing retry or test change is needed.

- `git fetch origin main` succeeds; main remains `800fe9f8`, with no new commit
  in `git log --oneline HEAD..origin/main`. Local Markdown links resolve and
  the delivery-reference scan leaves only the documentation policy itself and
  SVG path commands outside status sections. Protocol sizes pass without a cap
  or fixture change. The link scope is in its own indexed protocol document.
- `git diff --check` and `git diff --check origin/main` pass. The path/deletion
  audit against main retains only the four earlier approved removals and the
  catalogue fixture rename. This milestone changes only Markdown and deletes
  no file. It leaves code, tests, mockups, dependencies, generated output,
  historical plans, review records and `CHANGELOG.md` unchanged.
- Logs and the changed-file manifest are under `.context/m26/`.
  `cargo xtask check` and browser checks are not required for this docs-only
  milestone. Delivery is one local commit. The reviewer owns the push and the
  later review. Milestone 27 has not started.

## Milestone 27: Depict the excluded-only stylesheet state

Tags: mockup

- [x] Add a screen mockup, mobile and desktop, for a screen whose only
      stylesheet change is examined and excluded. The screen is not in
      Changes, opens from All, offers no comparison, and its Details end with
      "No changes to this screen." Make it reachable from the stylesheet
      evidence mockups.
- [x] Split the Stylesheet evidence mockup page into linked child pages with
      at most five screens each. The parent shows one canonical screen and
      links to its children. Mirror the hierarchy in the source and generated
      directories.
- [x] Give the linked Excluded and Matched mockups one shared Details card that
      matches the viewer. Remove "Other changed styles keep Welcome in
      Changes." and its test assertion. Add a test that the paired Details are
      identical.
- [x] Update the design inventory, link, count and reachability tests and the
      design docs, including the example README. Build and check the example,
      run the design tests and smoke-test the changed screens at both widths.
- [x] Guard against the same drift elsewhere: a catalogue-wide test keeps
      every design folder at five or fewer of its own screens, a test accepts
      only the viewer's Details sentences in the stylesheet evidence cards,
      and the replaced-copy list rejects the removed sentence in every design.
- [x] Add browser checks for the Details-row journey into the new screen and
      for the shared card's spacing at both widths.
- [x] Run build, typecheck, lint, changed-file Prettier, the seven docs
      suites, the exact complete unit command, then the complete
      `cargo xtask check`. Inspect the diff and deletions against
      `origin/main`, and make one local milestone commit.

Implementation notes:

- `design-review-style-excluded-only` (“Excluded styles only”) shows the
  Details screen from All in the Excluded styles branch. Details links only
  `generated/excluded.css`, whose changed styles apply nowhere on it. It shows
  Unmodified, has no comparison toolbar or stage heading, and its Details end
  with “No changes to this screen.” Both All artboards use one row set,
  `EXCLUDED_STYLE_ROWS`: Welcome keeps its changed mark and opens Excluded
  styles, and Details opens Excluded styles only. The new screen's Changes
  filter stays a depiction, because no design shows Details beside the
  Changes list.
- The subject is Details, not Welcome, so the state belongs to the same branch
  as the pair and the Excluded styles artboard links it. A separate
  zero-change Welcome would have no inbound design link, and its Changes
  filter would reuse the empty state that Ignored only owns.
- The Stylesheet evidence page keeps one canonical screen, Document page
  styles, because its Details show every per-file outcome. Each child page has
  its own directory under `entries/design/review/impact/stylesheets/`:
  Matched and excluded (`matched-excluded/`, three screens) and Unresolved and
  unnamed (`unresolved-unnamed/`, two screens). The parent stays in
  `review_style_screens.tsx`, as the Comparison outcomes and Document pages
  parents stay in their modules, so no file that `origin/main` has is deleted.
  The manifest records the hierarchy in `navPath` and the directories in
  `sourcePath`; routes still derive from ids.
- `MatchedAndExcludedStyleCard` replaces `MatchedStyleCard` and
  `ExcludedStyleCard`. Both pair screens render it, so their Details sections
  are byte-identical at both widths. `ExcludedStylesheetList` draws the
  excluded outcome in the viewer's order. `StyleComparison` moved to
  `parts/style_comparison.tsx`, because both child pages use it. Unresolved,
  Unnamed and Document page styles keep their markup, copy and links.
- The design catalogue now has 105 screens: 64 Browse/Changes and 41
  component designs. 81 are light-only. The example builds 442 files.
- Shell navigation sorts folders before leaves, so the outer catalogue lists
  the two child folders before Document page styles. The Appearance and
  Component explorer groups follow the same documented rule.
- The M16 path audit row for `review_style_screens.tsx` still records that
  merge's instruction not to restore the excluded-only state. It is
  historical evidence and stays unchanged.

Verification:

- Failure-first: before the mockup change, 15 of the 38 tests in the eight
  new and changed design test files failed. The new screen was missing, the
  Excluded card still rendered “Other changed styles keep Welcome in
  Changes.”, the paired cards differed, the counts were 104 and 63, and the
  gallery had one page. The five-screen folder guard passed before and after
  the change, as a preservation test. The three new browser tests also failed
  first: the Details row had no link, and the Excluded card had a fourth
  element after its files list. Logs: `.context/m27/failing-first.log` and
  `.context/m27/browser-failing-first.log`.
- After the change, the same 38 tests pass. `npm run build`,
  `npm run typecheck` and `npm run lint` pass. `npm run example:build` and
  `npm run example:check` pass with 442 files. Changed-file Prettier passes.
  The seven docs suites pass all 28 tests, and every changed protocol stays
  within its cap. The design suite passes all 203 tests:

  ```sh
  npx tsx --test tests/design_*.test.ts tests/design_*.test.tsx tests/component_design_*.test.ts
  ```

- Seven browser specs pass all 40 tests: comparison design, comparison
  eligibility, portability, stylesheet evidence, page evidence, Scroll
  together and design links.
- `npm run dev -- --base HEAD --port 0` served the example for the smoke
  scripts `.context/m27/smoke.mjs` and `.context/m27/card_ends.mjs`. All six
  stylesheet evidence screens open at 1440 × 1000 and 390 × 844 with no page
  error. Excluded styles only shows Unmodified, no comparison toolbar or stage
  heading, and Details that end with “No changes to this screen.” Excluded and
  Matched end their Details with the same excluded file. The desktop journey
  Excluded → Details row → Excluded styles only → Welcome row → Excluded →
  Changes → Matched → All → Excluded follows every link. The outer catalogue
  lists both child pages. The 33 screenshots are under
  `.context/screenshots/m27/`; results are in `.context/m27/smoke-results.json`.
- The exact complete unit command passes 3,976 of 3,977 tests. Its only
  failure is the existing PostCSS timing case, at 2,692.9 ms against the
  unchanged 2,500 ms limit. With no other test or server process running,
  `npx tsx --test tests/postcss_dependency_review.test.ts` fails twice, at
  2,680.4 and 2,682.7 ms, then passes all three tests at 1,872.8 ms. The test
  file is identical to `origin/main`. No test is skipped, cancelled or marked
  TODO.
- The complete `cargo xtask check` exits 0 in 75 minutes. It passes the audit
  with main's accepted Braces exception, formatting, lint, the 729-file length
  audit, repository ratchets, Rust formatting and clippy, all 15 Rust tests,
  typecheck, the 442-file example check, all six packed-consumer scenarios,
  all 3,977 unit tests, all 779 browser tests and all 226 hydration tests.
  No test fails, is skipped or is cancelled. Logs are under `.context/m27/`.
- `git diff --diff-filter=D --name-status origin/main` still lists only the
  four earlier approved deletions, and the v3-to-v4 catalogue fixture rename
  remains. This milestone deletes no file. Historical plans,
  `docs/reviews/**`, `CHANGELOG.md`, dependencies and generated output are
  unchanged. Delivery is one local commit; the reviewer owns the push.

## Milestone 28: Fix component stylesheet links

- [x] Failure-first (1): with declared CSS, generated CSS from JavaScript
      imports and no configured link, Build and on-demand Serve put the
      component link at the end of head content, after the generated links.
      With configured links, placement is unchanged. Pass only configured
      hrefs as anchors.
- [x] Failure-first (8): with configured links inside a Review-ignore region,
      an edit to a declared stylesheet changes the component and its
      consumers on the complete and fast comparison paths and in the CSS rule
      scope. The author's ignored content stays ignored. Find inserted links
      from their `insertedStylesheets` spans.
- [x] Failure-first (9): a renderer link to a declared stylesheet in `<body>`
      is reused, and Mokly inserts no second link. Content in `<template>`
      behaves as the contract defines. Replace the separate link scans with
      one shared finder.
- [x] Update the READMEs near the changed code. Run the focused tests and the
      complete unit suite at 100%.

- [x] Run build, typecheck, lint, changed-file Prettier, the seven docs suites,
      the exact complete unit command and the complete `cargo xtask check`.
      Repeat the three probes. Inspect the diff and deletions against fetched
      `origin/main`. Record the results and every new deletion. Make one local
      Conventional Commit. The reviewer owns the push and later review.
- [x] Keep comparison files below 300 lines by moving one-sided normalization
      to the projection module. Retain its current `page` result; unused-code
      removal stays in Milestone 29.

- [x] Preserve inserted-link proof through complete and selected artifact
      capture. Validate publication resources against the same spans without
      adding public output fields. The delivery test failed first because
      publication discarded this proof before checking resource reachability.

Implementation notes:

- `html_links.ts` supplies one active link finder with decoded attributes,
  logical head/body scope and original UTF-16 locations. Placement uses only
  configured head hrefs. The renderer keeps its complete list. Body links and
  aliases keep their authored positions and prevent a second insertion.
  Template content supplies no active links. Reserved attributes inside it
  still undergo token validation and removal. A valid token moved into a
  template gets no provenance span; an active body token keeps its span.
- `stylesheet_spans.ts` validates recorded spans against active full links in
  the original final HTML. `component_stylesheet_resources.ts` checks their
  public paths and supplies resource starting points before Review-ignore.
  Complete comparison, the fast path and the CSS rule scope use those paths,
  including imports. Resource-cache identity includes the extra paths.
  Selector matching still uses ignored-normalized markup. The author's ignored
  links, inline styles and content stay ignored.
- Complete and selected captures retain a private snapshot-path-to-span map
  until artifact resource validation finishes. This keeps publication aligned
  with comparison and export without adding public JSON or snapshot fields.
  The delivery test found this required extra path after the initial fix.
- One-sided normalization moves to `component_projection_resources.ts`.
  The non-CSS root resource check moves to `component_resource_attribution.ts`.
  Both keep their behavior. The unused one-sided `page` value remains for
  Milestone 29. Every changed TypeScript file stays below 300 lines.

Verification:

- Failure-first: the initial 19 tests have 11 failures and eight passes.
  Build and on-demand Serve put declared CSS before generated imports. Ignored
  inserted links produce no component change or excluded-rule evidence. Body
  links are duplicated, and a token moved into a template still gets a span.
  The head-link case also checks body reuse directly and fails there. With the
  fixes, all 19 pass. Configured placement and ignored author-link controls
  pass before and after. Logs: `.context/m28/failure-first.log` and
  `.context/m28/focused-new.log`.
- The expanded tests cover raw and component Review-ignore, transitive CSS,
  ignored selector matches, changed author markup and inline styles, body
  aliases, template token validation, invalid recorded spans, and all delivery
  paths. The publication test fails first with `resource evidence is not
reachable: mockups/action.css`; retaining private span proof fixes it.
  The final focused run passes all 230 tests. This milestone adds 35 tests.
  The earlier delivery attempts also found test-fixture setup errors, which
  are corrected. All commands and intermediate counts are in
  `.context/m28/report.md`.
- `npm run build`, `npm run typecheck`, `npm run lint` and changed-file
  Prettier pass. The first code build needed one parse5 type correction; the
  first lint run needed six import-order corrections. The seven requested docs
  suites pass all 28 tests. The source-file-length audit passes for 743 files.
- The exact complete unit command passes all 4,012 tests, with no failures,
  skips, cancellations or TODOs:

  ```sh
  npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"
  ```

  Its unchanged PostCSS timing case passes at 2,372.2 ms.

- The complete `cargo xtask check` passes the audit with main's existing
  Braces exception, formatting, lint, source limits, all repository ratchets,
  Rust formatting and clippy, all 15 Rust tests, build, typecheck, the
  442-file example check and all six packed-consumer scenarios. Its unit
  stage passes 4,011 of 4,012 tests. The only failure is the existing PostCSS
  timing case, at 2,600.6 ms against the unchanged 2,500 ms limit. The command
  exits 1 at that stage. No test is skipped, cancelled or marked TODO.
- With no other tests or servers running,
  `npx tsx --test tests/postcss_dependency_review.test.ts` fails six times at
  2,781.4, 2,883.3, 2,670.1, 2,670.6, 2,803.5 and 2,811.8 ms. The seventh
  attempt passes all three tests at 2,496.5 ms. The test and timed code are
  unchanged. This is the user's approved timing-flake exception.
  The remaining gate stages then run separately:
  `cargo xtask check --suite browser` passes all 779 tests, and
  `cargo xtask check --suite hydration` passes all 226 tests. Both exit 0,
  with no failed, skipped or cancelled tests.
- The three supplied probes are repeated unchanged. The generated-anchor
  probe now fails its old bug assertion because the declared link follows
  generated CSS. The raw and component ignore probes both report the same
  changed Action entries and affected consumers as their controls. The body
  probe reports one Action link, no inserted span, and matching reuse and
  resource results. Its template-only result has no Action resource or span.
  `node .context/m28/cascade-smoke.mjs` checks all 16 built views and runs
  on-demand Serve in Chrome at 390 × 844 and 1440 × 1000. Both widths load
  generated blue CSS first and compute the declared red color. No page error
  occurs. The smoke server and browser close before full unit verification.
- The first `git fetch origin main` finds `c4138a0b` (#131). The final fetch
  finds `60d48370` (#133), which updates plan records and removes main's plan
  index. Both are after this branch's merged main `800fe9f8`. This task does
  not integrate either the identity/document changes or the plan changes. M28 deletes no file and adds no feature removal. The
  current two-tree main diff lists three earlier approved removals and 419
  upstream additions that were already absent at source tip `aa6b1214`.
  Each path and reason is recorded in `.context/m28/deletion-audit.json`.
  Main now also removes `src/registry/dependency_paths.ts`, so that fourth
  earlier approved removal no longer appears in the current deletion list.
  Against merged main `800fe9f8`, the four earlier approved removals and the
  v3-to-v4 catalogue fixture rename remain. `git diff --check` and
  `git diff --check origin/main` pass.
- Dependencies, overrides, audit rules, the PostCSS timing test, example
  sources, historical plans, review records and `CHANGELOG.md` are unchanged
  by this milestone. Generated example output is not hand-edited or tracked.
  Logs, exact commands and gate reports are under `.context/m28/`.
  Delivery is one local Conventional Commit. The reviewer owns the push and
  the later review. Milestone 29 has not started.

## Milestone 28A: Integrate `main` #131 and #133

Merge `main` at `60d48370` before the remaining work, as the user decided later
on 2026-10-05. A trial merge gives 315 conflicts.

- [x] Audit main's additions from the source tip, merge `origin/main` with
      exactly two parents, resolve conflicts path by path and review every
      remerge-diff path.
- [x] Combine the formats: manifest v8, catalogue read model v4 and review
      result v5 carry main's path identity and this branch's records
      (component stylesheet declarations, inserted-stylesheet provenance, root
      output ranges, per-rule CSS evidence and page resource evidence). Every
      record, field and message of this branch that names an entry uses the
      entry path. Record each renamed field, warning text or message here.
- [x] Port this branch's authoring, configuration, warning, classification,
      viewer and design changes to main's structure, including the design
      screens that moved to `examples/basic/specs/`. Keep this branch's
      binding decisions and main's behavior. Record every conflict of meaning
      here for the user.
- [x] Adopt #133: start this plan with a `Status: Active` paragraph directly
      below its title, and replace links to `plans/README.md` in docs and
      READMEs with links to the `plans/` directory. Update this branch's docs
      rule to match.
- [x] Compare every line that main added since `800fe9f8` with the merged tree.
      Classify each absent line as an intended migration, a move or a loss,
      and restore every loss before the push.
- [x] Compile the stylesheet authoring example and check the comparison
      contract's path fields against public types. Record failure-first results.
- [x] Clear the internal-export gate after helper extraction. Retain local
      helpers privately and remove only unused dependency-display/config helpers
      and the duplicate generated-route helper.
- [x] Port packed-consumer and browser assertions to path fields and routes.
      Reuse main's selected-comparison fixture instead of the obsolete duplicate.
- [x] Port the remaining document and component browser checks without
      restoring the removed Dependencies row. Keep real image loading checks.
- [x] Keep the ordinary preview build outside Playwright's diagnostic stack
      instrumentation, using the existing owned-process boundary and setup budget.
- [x] Run `cargo xtask check` and the user-authorized serial fallback when
      its live audit is blocked. Require 100% on all other steps. Inspect the
      diff and deletions against `origin/main`, record the result, and make
      the local merge commit.
- [x] The reviewer pushes the branch after checking the local commit. The
      reviewer checked the merge parents, the deletions, the conflict record
      and the screenshots, and pushed `12202f14`. The review of the complete
      diff against `origin/main` runs once, in Milestone 32.

### Integration record

The required fetch advanced `origin/main` from the requested `60d48370` to
`781da7ae3261e6694a5ef5608a91f3e34061f6d0`. The merge therefore also keeps #132,
which retains lock directories on release. No dependency, override or audit
change was made. The source tip is
`e05bfd0f17f31f2478c44875b82f92f646e6bebc`; the merge base is
`800fe9f88a0173429b25baa1bcf41ed9e59b2256`. The initial additions audit contains
1,663 paths. `git merge --no-commit --no-ff origin/main` ran once. Each of the
315 conflicts was resolved by path. Local evidence is in `.context/m28a/`.

The merge keeps one manifest v8, catalogue v4 and comparison v5. Strict readers
combine main's path, folder, document and move records with stylesheet
provenance, root ranges, rule evidence and page resource evidence. No format
version or earlier-output reader was added. Main's former-header rejection,
source protection, Specs shell, folder rows and move behavior remain.

### Identity changes

| Branch name or message                                        | Integrated name or meaning                                                                                                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CssRuleAttribution.changedComponentIds`                      | `changedComponentPaths`; strict readers reject the former key.                                                                                                         |
| `InsertedComponentStylesheet.componentIds`                    | `componentPaths`; move normalization maps the declarers and preserves spans.                                                                                           |
| `LinkedComponentStylesheet.componentIds`                      | `componentPaths`; internal declaration sets also use `paths`.                                                                                                          |
| `PageResourceEvidence.id`                                     | `path`; page projection and Details lookup use that path.                                                                                                              |
| `DocumentPair.pageId` and `view.id`                           | `pagePath` and `view.path`.                                                                                                                                            |
| Branch entry, variant and step lookup keys                    | Main's `path`, `variantPath`, `screenPath`, `byPath`, `changedEntries` and `computeChangedPaths`.                                                                      |
| Removed-entry dependency warning                              | Its context and quoted subject use the complete entry or variant path.                                                                                                 |
| Removed component ownership warning                           | Its context and quoted component use the complete component or variant path.                                                                                           |
| Duplicate component stylesheet warning                        | Its component context and quoted subject use the resolved component path.                                                                                              |
| Former nested/root dependency warning                         | `defineFolder` emits `folder:<path>` context and `dependencies has been removed; ignoring it on folder "<path>". Delete the field.` No warning inherits into children. |
| Missing configured-link and ignored stylesheet-owner warnings | Their route context and text use the generated route derived from the entry path. File paths still identify resources.                                                 |
| Validation labels and fixture diagnostics                     | Entry subjects use resolved paths; IDs of tags, ignore regions and component instances keep their independent meanings.                                                |

Main intentionally keeps `ComponentInstanceRecord.componentId`, non-CSS and
inline-style `componentIds`, `AffectedConsumer.changedComponentId` and
`UsageLink.entryId`. Their values are entry paths, as main's contracts require.
They are not former entry identities. The canonical public fixture is 12,582
bytes, SHA-256 `421eccdf926ecef4dcdfdf4ba11b26df83457d5aa1527b98e70525a0c7326eb4`.

### Conflicts of meaning

- Main rejects former configuration fields as unknown. The branch warns and
  ignores exactly `dependencies`, `ownedDependencies` and `review.sharedImpact`.
  Both rules remain. The graceful-handling text now states this narrow scope.
  Folder JSON and document front matter stay strict. `defineFolder` alone
  keeps the former folder dependency warning through its new path API.
- Main's source-declaration ownership cannot decide Changes under the branch's
  binding CSS rule. Declarations were removed. Rendered resources, non-CSS
  owners, output changes, moves and metadata retain their independent effects.
  Source-only move tests now stay unmodified; a separate rendered edit still
  changes the moved component.
- Main's unreleased formats and the branch's unreleased formats had the same
  numbers but different records. Their combined shape is the only current
  shape. An earlier v8 without the required roots or provenance is invalid;
  the merge adds no compatibility conversion.
- The task explicitly requires `?: never` on all three removed inputs. The
  `ReviewConfig.sharedImpact` guard and four consumer type cases were therefore
  added here, although M30 also names that guard. The failure-first type run
  reported three unused `@ts-expect-error` directives; the fixed run passes.
  The resolved runtime type selects only supported fields. The wider M30
  test work remains pending. M29 was not started.
- Main's control browser test accepts either saved status because it compares
  repository history. This branch uses an isolated current-format baseline.
  Its known saved status is Unmodified; the same temporary-edit, reset and
  return-to-saved-variant checks remain.

### Design and documentation migration

All retained designs live under `examples/basic/specs/`. The combined catalogue
has 114 screens: main's 111, minus the removed Shared impact screen, plus four
branch screens. It has 41 component designs and 73 Browse/Changes designs;
88 are light-only and 26 have both schemes. The build writes 478 files.
Main's paths, Specs heading and folder rows remain in each shell. Stylesheet
states keep separate mobile and desktop components and reachable links.
The styles parent is a real folder. Its canonical Document page styles screen
uses `styles/page`; nested Matched and excluded and Unresolved and unnamed
pages keep the five-screen limit. Main's light-only removed document stays reachable through the Specs tree.
The reachability test records why it has no incoming in-screen link.

The plan has a first-paragraph status and no index link. Current docs link to
`plans/`. The documentation policy states that plans have no index. Protocol
splits preserve their rules without raising a size cap. The new owners are
`documentation-policy.md`, `mokly-changes-controls.md`,
`mokly-component-design-inventory.md` and
`mokly-source-protection-acceptance.md`. Existing delivery, root-discovery,
review-validation, comparison-record and device-chrome docs own moved sections.
The release note combines path identity with both branch breaking commits,
`fcae6390` and `e5407723`. `CHANGELOG.md` and review records match main.

### Approved deletions and migration cleanup

The diff against main deletes exactly these four files:

| Deleted path                                            | Reason and retained meaning                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `examples/basic/specs/design/library/style_context.tsx` | Approved collector removal, at main's renamed path. Components now declare public stylesheets.                                             |
| `src/components/dependency_validation.ts`               | Approved removed-field validator deletion. Main only changed its manifest/path names. Current readers reject removed fields directly.      |
| `src/registry/dependency_paths.ts`                      | Approved removal of source-path evidence and matching.                                                                                     |
| `tests/design_library_style_collector.test.tsx`         | Approved collector test removal. Main only changed import paths. Declaration/link and real-consumer CSS tests cover the retained behavior. |

Main's deletions of the plans index, old navigation/nested-authoring specs,
`changed_ids.ts`, `entry_globs.ts` and moved design files remain. Applicable
branch rules live in the path/folder/entry docs, root discovery and moved
specs. Branch-only obsolete helpers also disappear:
`src/authoring/warnings.ts`, `tests/variant_validation_fixture.ts`,
`tests/server_removed_preview_lifecycle_fixture.ts`,
`tests/client_removed_preview_requests_fixture.ts`, `tests/shell_fixture.ts`
and `packages/viewer/tests/component_workspace_fixture.tsx`. Their consumers
use resolved definition warnings or main's path-aware test helpers.

### Preservation evidence

The line audit uses `git diff --find-renames --unified=0 800fe9f8 origin/main`.
It checks all 54,751 nonblank additions across 1,592 paths with added text,
including moved files at their new paths. The name audit also retains paths
with no added text. The full local ledger lists every absent line, its original
line number, classification and reason in
`.context/m28a/main-lines-classified.json`. The path summary follows below.
Class (a) is an intended migration. Class (b) is equivalent moved, reworded or
formatted content. No class (c) loss remains in this audit.

The audit restored main's null-prototype comparison-state dictionaries and the
constructor order for component move targets and warning callbacks. It also
restored tag option IDs, the Action CSS class and the document source label
that broad migration edits had changed. Main move links now map branch
stylesheet provenance. A pure moved page stays Unmodified. The classifier
compares each component variant once through its parent. Focused regressions
cover those integration boundaries.

| Path with absent additions                                                 | Class | Reason                                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                                | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/architecture/build-pipeline.md`                                      | b     | Retain current-only v8 validation; clarify the shared baseline contract.                                                                                                                                    |
| `docs/guides/authoring/collections-and-tags.md`                            | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/authoring/components.md`                                      | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/authoring/config.md`                                          | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/authoring/pages.md`                                           | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/authoring/screens.md`                                         | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/authoring/use-case-flows.md`                                  | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/authoring/viewports-and-color-schemes.md`                     | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/catalogue/browse.md`                                          | b     | Replace a link with its reference name, as required for shipped guides.                                                                                                                                     |
| `docs/guides/catalogue/changes.md`                                         | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/catalogue/details.md`                                         | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/guides/catalogue/search-and-filters.md`                              | b     | Replace a link with its reference name, as required for shipped guides.                                                                                                                                     |
| `docs/guides/start/your-first-screen.md`                                   | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/README.md`                                                  | a, b  | Move index policy to documentation-policy.md; keep catalogue links and the combined-format overview. Remove or replace the obsolete declaration while retaining the surrounding path contract.              |
| `docs/protocol/fixtures/catalogue-v4.json`                                 | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-authoring.md`                                         | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-catalogue-changes.md`                                 | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-catalogue.md`                                         | a, b  | Move projection, privacy, removed-entry and usage rules to mokly-catalogue-delivery.md. Remove or replace the obsolete declaration while retaining the surrounding path contract.                           |
| `docs/protocol/mokly-changes-serving.md`                                   | a     | Combine path-addressed v5 with branch CSS and page-resource evidence, without source declarations.                                                                                                          |
| `docs/protocol/mokly-changes.md`                                           | b     | Keep the Changes scope; move controls to mokly-changes-controls.md.                                                                                                                                         |
| `docs/protocol/mokly-component-changes.md`                                 | b     | Move baseline validation and move/title rules to mokly-component-review-validation.md.                                                                                                                      |
| `docs/protocol/mokly-component-design.md`                                  | a, b  | Move the design inventory to mokly-component-design-inventory.md; retain canonical path links. Remove or replace the obsolete declaration while retaining the surrounding path contract.                    |
| `docs/protocol/mokly-component-manifest.md`                                | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-component-review-validation.md`                       | b     | Consolidate unchanged path-keyed v5 identity rules and baseline validation.                                                                                                                                 |
| `docs/protocol/mokly-component-review.md`                                  | a, b  | Consolidate path identity, moves, usage and snapshot rules in mokly-component-comparison-records.md. Remove or replace the obsolete declaration while retaining the surrounding path contract.              |
| `docs/protocol/mokly-component-workspace-design.md`                        | a     | Replace Shared impact with the approved Stylesheet evidence state.                                                                                                                                          |
| `docs/protocol/mokly-components.md`                                        | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-configuration.md`                                     | a, b  | Move root constraints to mokly-root-discovery.md; retain unknown-field errors and the explicit warning exception. Remove or replace the obsolete declaration while retaining the surrounding path contract. |
| `docs/protocol/mokly-css-attribution.md`                                   | b     | Keep the same rule identity and matching behavior with path-named CSS evidence.                                                                                                                             |
| `docs/protocol/mokly-css-evidence-presentation.md`                         | b     | Keep the same rule identity and matching behavior with path-named CSS evidence.                                                                                                                             |
| `docs/protocol/mokly-css-evidence-shell.md`                                | b     | Keep the same rule identity and matching behavior with path-named CSS evidence.                                                                                                                             |
| `docs/protocol/mokly-derived-baselines.md`                                 | b     | Retain current-only v8 validation; clarify the shared baseline contract.                                                                                                                                    |
| `docs/protocol/mokly-design-components.md`                                 | b     | Use main's Specs heading for the same Design folder.                                                                                                                                                        |
| `docs/protocol/mokly-design-links.md`                                      | a, b  | Use the approved nested stylesheet designs and links, preserving the five-screen limit.                                                                                                                     |
| `docs/protocol/mokly-documents.md`                                         | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-entry-modules.md`                                     | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-export.md`                                            | b     | Keep the main export identity rule with line wrapping.                                                                                                                                                      |
| `docs/protocol/mokly-folders.md`                                           | a     | Keep strict folder JSON; add only the approved defineFolder dependencies warning exception.                                                                                                                 |
| `docs/protocol/mokly-imported-styles-assets.md`                            | b     | Correct the generated-route example to main path layout.                                                                                                                                                    |
| `docs/protocol/mokly-pages.md`                                             | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-rendering-generated.md`                               | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-rendering.md`                                         | b     | Keep route-matching semantics and document the combined configured/imported stylesheet input.                                                                                                               |
| `docs/protocol/mokly-runtime.md`                                           | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-shell-design-inventory.md`                            | a, b  | Retain main screens and paths; remove Shared impact and add branch stylesheet states.                                                                                                                       |
| `docs/protocol/mokly-source-protection.md`                                 | b     | Move unchanged source-protection acceptance rules to mokly-source-protection-acceptance.md.                                                                                                                 |
| `docs/protocol/mokly-variants.md`                                          | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `docs/protocol/mokly-watch.md`                                             | b     | Keep watch ordering, port retry, restart and cleanup rules in the same document.                                                                                                                            |
| `docs/protocol/npm-release-notes.md`                                       | a     | Combine both feat! commits into the path release note; scope the three warning exceptions.                                                                                                                  |
| `examples/basic/README.md`                                                 | a     | Report the combined design inventory: 114 screens, including branch evidence states.                                                                                                                        |
| `examples/basic/mokly.config.ts`                                           | a, b  | Use declared stylesheets instead of the removed per-render style collector; retain library host detection.                                                                                                  |
| `examples/basic/renderer.tsx`                                              | a, b  | Use declared stylesheets instead of the removed per-render style collector; retain library host detection.                                                                                                  |
| `examples/basic/specs/design/components/parts/controls.tsx`                | b     | Whitespace-only formatting; the same text remains.                                                                                                                                                          |
| `examples/basic/specs/design/components/parts/navigation.tsx`              | b     | Keep main path destinations while supporting branch stylesheet scenarios.                                                                                                                                   |
| `examples/basic/specs/design/components/parts/navigation_tree.ts`          | b     | Keep main path destinations while supporting branch stylesheet scenarios.                                                                                                                                   |
| `examples/basic/specs/design/components/parts/screen_page.tsx`             | b     | Whitespace-only formatting; the same text remains.                                                                                                                                                          |
| `examples/basic/specs/design/components/states/shared-impact/_folder.json` | a     | Depict excluded stylesheet evidence instead of removed shared source evidence.                                                                                                                              |
| `examples/basic/specs/design/components/states/shared-impact/screens.tsx`  | a     | Depict excluded stylesheet evidence instead of removed shared source evidence.                                                                                                                              |
| `examples/basic/specs/design/library/metadata.ts`                          | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `examples/basic/specs/design/metadata.ts`                                  | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `examples/basic/specs/design/page_screens.tsx`                             | b     | Move the complete document page markup to parts/document_page.tsx; retain main source label.                                                                                                                |
| `examples/basic/specs/design/parts/destinations.ts`                        | a     | Keep approved branch evidence screens at their new nested paths; remove Shared impact.                                                                                                                      |
| `examples/basic/specs/design/review_impact_screens.tsx`                    | a     | Keep approved branch evidence screens at their new nested paths; remove Shared impact.                                                                                                                      |
| `examples/basic/specs/design/review_style_screens.tsx`                     | a     | Keep approved branch evidence screens at their new nested paths; remove Shared impact.                                                                                                                      |
| `packages/viewer/src/review/result_records.ts`                             | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `packages/viewer/src/shell/details.tsx`                                    | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `packages/viewer/src/shell/workspace_evidence_data.ts`                     | b     | Keep variant path selection while grouping stylesheet evidence once per file.                                                                                                                               |
| `packages/viewer/src/viewer/projection.ts`                                 | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `packages/viewer/src/viewer/public_workspace.ts`                           | b     | Move view helpers to public_workspace_views.ts; retain null-prototype state dictionaries.                                                                                                                   |
| `packages/viewer/tests/component_workspace.test.tsx`                       | b     | Use the combined canonical Details fixture path and preserve instance/scheme navigation.                                                                                                                    |
| `packages/viewer/tests/document_details.test.tsx`                          | a, b  | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `packages/viewer/tests/document_light_only.test.tsx`                       | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `packages/viewer/tests/index_container_activation.test.ts`                 | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `packages/viewer/tests/moved_catalogue.test.ts`                            | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `packages/viewer/tests/moved_rows.test.tsx`                                | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `packages/viewer/tests/row_search.test.ts`                                 | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `packages/viewer/tests/scoped_bootstrap.test.ts`                           | a     | Update the canonical v4 fixture size/hash for removed declarations and added resource evidence.                                                                                                             |
| `packages/viewer/tests/server.test.tsx`                                    | b     | Move the SSR fixture load to server_fixture.tsx.                                                                                                                                                            |
| `scripts/package/components.mjs`                                           | b     | Fetch the same component page through its canonical path URL.                                                                                                                                               |
| `src/authoring/fields.ts`                                                  | a     | Keep strict main field validation with the three approved removed-input exceptions.                                                                                                                         |
| `src/baseline/README.md`                                                   | b     | Retain current-only v8 validation; clarify the shared baseline contract.                                                                                                                                    |
| `src/build/README.md`                                                      | b     | Keep compile and graph entrypoints and document stylesheet placement helpers.                                                                                                                               |
| `src/build/compile.ts`                                                     | b     | Retain compile/registry lifecycle; carry warning callbacks and path routes through it.                                                                                                                      |
| `src/build/compile_runtime.ts`                                             | b     | Retain compile/registry lifecycle; carry warning callbacks and path routes through it.                                                                                                                      |
| `src/build/live_runtime.ts`                                                | b     | Retain compile/registry lifecycle; carry warning callbacks and path routes through it.                                                                                                                      |
| `src/catalogue/README.md`                                                  | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/catalogue/projection.ts`                                              | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/components/README.md`                                                 | b     | Retain current-only v8 validation; clarify the shared baseline contract.                                                                                                                                    |
| `src/components/dependency_validation.ts`                                  | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/components/render.tsx`                                                | b     | Whitespace-only formatting; the same text remains.                                                                                                                                                          |
| `src/documents/load.ts`                                                    | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/export/run.ts`                                                        | b     | Retain compile/registry lifecycle; carry warning callbacks and path routes through it.                                                                                                                      |
| `src/export/site.ts`                                                       | b     | Use screenResultEvidence from screen_view_changes.ts for both Serve and export.                                                                                                                             |
| `src/registry/manifest.ts`                                                 | b     | Retain current-only v8 validation; clarify the shared baseline contract.                                                                                                                                    |
| `src/registry/manifest_entries.ts`                                         | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/registry/prepare.ts`                                                  | b     | Retain compile/registry lifecycle; carry warning callbacks and path routes through it.                                                                                                                      |
| `src/review/README.md`                                                     | b     | Retain current-only v8 validation; clarify the shared baseline contract.                                                                                                                                    |
| `src/review/component_classification_context.ts`                           | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/review/component_classification_finish.ts`                            | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/review/component_classification_sources.ts`                           | a, b  | Collect own-page rule matches before classifying pages; preserve move pairing in component_classification_comparisons.ts.                                                                                   |
| `src/review/component_metadata.ts`                                         | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/review/component_projection_resources.ts`                             | b     | Pass move link normalization directly; retain non-CSS ownership and separate inserted-link comparison material.                                                                                             |
| `src/review/component_result_sources.ts`                                   | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/review/component_variant_classification.ts`                           | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/review/component_view.ts`                                             | b     | Move types to component_view_types.ts; retain original resource bytes and move normalization beside inserted-link provenance.                                                                               |
| `src/review/component_view_fast_path.ts`                                   | b     | Separate comparison-only link removal from original resource discovery in the fast path.                                                                                                                    |
| `src/review/entry_changes.ts`                                              | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `src/review/moves/source_moves.ts`                                         | b     | Retain the source-move alias helper privately; its byte-identity behavior is unchanged.                                                                                                                     |
| `src/server/README.md`                                                     | b     | Retain current-only v8 validation; clarify the shared baseline contract.                                                                                                                                    |
| `src/server/changed_document_pairs.ts`                                     | b     | Rename view.id to view.path under the common document-pair contract.                                                                                                                                        |
| `src/server/component_changes.ts`                                          | a, b  | Combine material path Changes with CSS/page evidence; preserve pure moves and document comparison.                                                                                                          |
| `src/server/http.ts`                                                       | b     | Use shared liveDocumentService and retain ComponentRenderService move-target and warning callback order.                                                                                                    |
| `tests/authoring.test.tsx`                                                 | b     | Move main validation tests and fixtures to authoring_part2.test.tsx and authoring_fixture.tsx.                                                                                                              |
| `tests/authoring_variant_types.ts`                                         | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/baseline_integration.test.ts`                                       | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/browser/changes_continuity.spec.ts`                                 | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/browser/design_comparison_eligibility.spec.ts`                      | a     | Use the approved nested stylesheet design paths and shared Details states.                                                                                                                                  |
| `tests/browser/design_library_runtime.spec.ts`                             | b     | Use an isolated current-format baseline; preserve temporary-edit/reset status checks with known Unmodified status.                                                                                          |
| `tests/browser/design_scroll_together.spec.ts`                             | a     | Use the approved nested stylesheet design paths and shared Details states.                                                                                                                                  |
| `tests/browser/document_changes_fixture.ts`                                | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/browser/document_pages.spec.ts`                                     | a     | Remove the retired Dependencies-row assertion; preserve source metadata and verify the rendered document image in both schemes.                                                                             |
| `tests/browser/imported_css_comparison.spec.ts`                            | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/browser/review_failure_reload.spec.ts`                              | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/browser/shared_impact_details.spec.ts`                              | a     | Replace the removed shared-impact fixture with rendered-resource evidence.                                                                                                                                  |
| `tests/browser/static_fixture.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/build_attribution.test.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/build_imported_styles_links.test.ts`                                | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/build_links.test.ts`                                                | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/build_navigation_links.test.ts`                                     | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/build_resolution.test.ts`                                           | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/catalogue_parent_title.test.ts`                                     | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/changes.test.ts`                                                    | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `tests/changes_asset_aliases.test.ts`                                      | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/changes_css_ownership.test.ts`                                      | a, b  | Test rendered rule matches and non-CSS renderer ownership instead of removed source ownership.                                                                                                              |
| `tests/client_removed_preview_requests.test.ts`                            | b     | Move preview generation/entry validation cases to client_removed_preview_requests_part2.test.ts.                                                                                                            |
| `tests/combined_changes.test.ts`                                           | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/compatibility_navigation.test.ts`                                   | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/component_asset_changes.test.ts`                                    | a     | Test rendered rule matches and non-CSS renderer ownership instead of removed source ownership.                                                                                                              |
| `tests/component_classification_performance.test.ts`                       | a     | Remove the source-ownership indexing test with its removed policy; retain metadata and comparison performance tests.                                                                                        |
| `tests/component_design_attribution.test.ts`                               | a     | Report the combined design inventory: 114 screens, including branch evidence states.                                                                                                                        |
| `tests/component_fast_path_equivalence.test.ts`                            | a     | Test rendered rule matches and non-CSS renderer ownership instead of removed source ownership.                                                                                                              |
| `tests/component_fast_path_projected_resources.test.ts`                    | b     | Whitespace-only formatting; the same text remains.                                                                                                                                                          |
| `tests/component_fast_path_review_equivalence.test.ts`                     | a     | Test rendered rule matches and non-CSS renderer ownership instead of removed source ownership.                                                                                                              |
| `tests/component_manifest.test.ts`                                         | b     | Test the next unsupported schema version, and add removed-field rejection cases.                                                                                                                            |
| `tests/component_material_projection.test.ts`                              | a     | Test rendered rule matches and non-CSS renderer ownership instead of removed source ownership.                                                                                                              |
| `tests/component_path_evidence.test.ts`                                    | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `tests/component_review_css_source_validation.test.ts`                     | a     | Test rendered rule matches and non-CSS renderer ownership instead of removed source ownership.                                                                                                              |
| `tests/component_shared_impact_invariant.test.ts`                          | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `tests/component_variant_entries.test.tsx`                                 | a, b  | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `tests/component_watch_changes.test.ts`                                    | a     | Test rendered rule matches and non-CSS renderer ownership instead of removed source ownership.                                                                                                              |
| `tests/config.test.ts`                                                     | b     | Move main traversal, root-overlap and symlink cases to config_part2.test.ts.                                                                                                                                |
| `tests/derived_resources.test.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/design_comparison_scrolling.test.ts`                                | a     | Use the approved nested stylesheet design paths and shared Details states.                                                                                                                                  |
| `tests/design_comparison_stacks.test.ts`                                   | a     | Use the approved nested stylesheet design paths and shared Details states.                                                                                                                                  |
| `tests/design_library_attribution.test.ts`                                 | a     | Move exclusive-sheet coverage to design_library_css_attribution.test.ts under uniform CSS matching; preserve real consumers and nested usage.                                                               |
| `tests/design_library_style_collector.test.tsx`                            | a     | Use declared stylesheets instead of the removed per-render style collector; retain library host detection.                                                                                                  |
| `tests/design_library_styles.test.ts`                                      | b     | Use path segments and declarations to check the same library sheets and render scopes.                                                                                                                      |
| `tests/design_library_usage.test.ts`                                       | a     | Report the combined design inventory: 114 screens, including branch evidence states.                                                                                                                        |
| `tests/design_link_states.test.ts`                                         | a     | Use the approved nested stylesheet design paths and shared Details states.                                                                                                                                  |
| `tests/design_links.test.ts`                                               | a     | Report the combined design inventory: 114 screens, including branch evidence states.                                                                                                                        |
| `tests/design_modern_controls.test.ts`                                     | b     | Use the main design/ prefix so the same control tests reach path-addressed designs.                                                                                                                         |
| `tests/design_screens.test.tsx`                                            | b     | Move tag/appearance cases to design_screens_part2.test.tsx; retain path-addressed views.                                                                                                                    |
| `tests/design_stylesheet_screens.test.tsx`                                 | a     | Use the approved nested stylesheet design paths and shared Details states.                                                                                                                                  |
| `tests/documents_build.test.ts`                                            | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/documents_resource_references.test.ts`                              | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/entry_attribution.test.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/entry_attribution_strict.test.ts`                                   | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/entry_discovery.test.ts`                                            | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/entry_exports.test.ts`                                              | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/export_pages.test.ts`                                               | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/export_source_inventory.test.ts`                                    | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/fixtures/consumers/esm/entries/guides/getting-started.mockup.ts`    | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/fixtures/consumers/esm/mokly.config.ts`                             | a     | Exercise the stylesheet marker through the existing consumer configuration.                                                                                                                                 |
| `tests/fixtures/design-library/screens.json`                               | a     | Remove the approved Shared impact design fixture; all other main designs remain.                                                                                                                            |
| `tests/fixtures/large/area.tsx`                                            | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/fixtures/large/components.tsx`                                      | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/branch_point_lookup.ts`                                     | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/comparison_alignment_source.ts`                             | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/comparison_regions_source.ts`                               | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/fixture.ts`                                                 | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/generated_output_fixture.ts`                                | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/move_catalogue.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/move_catalogue_sources.ts`                                  | a     | Remove the deprecated declaration from the shared fixture metadata.                                                                                                                                         |
| `tests/helpers/moved_component_evidence.ts`                                | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/nav_tree_fixture.ts`                                        | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/path_fixture.ts`                                            | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/publish_run_fixture.ts`                                     | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/removed_preview_lifecycle.ts`                               | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/removed_preview_requests.ts`                                | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/shell_fixture.ts`                                           | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/helpers/variant_validation.ts`                                      | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/id_keyed_wire_formats.test.ts`                                      | b     | Extend main current-only baseline test to every former integer version.                                                                                                                                     |
| `tests/manifest_combined.test.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/manifest_files.test.ts`                                             | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/manifest_variants.test.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/move_authored_similarity.test.ts`                                   | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/move_component_fingerprint.test.ts`                                 | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/move_content.test.ts`                                               | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/move_fixed_point.test.ts`                                           | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/move_link_resources.test.ts`                                        | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `tests/move_normalization.test.ts`                                         | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/move_owned_sources.test.ts`                                         | a, b  | Keep moves free of source evidence; test no edit, source-only edit and real rendered edit.                                                                                                                  |
| `tests/nav_tree_tags.test.ts`                                              | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/package.test.ts`                                                    | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/page_material_changes.test.ts`                                      | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/pages.test.ts`                                                      | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/path_manifest.test.ts`                                              | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/path_review_pairing.test.ts`                                        | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/path_variant_identity.test.ts`                                      | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/preview_legacy_routes.test.ts`                                      | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/protocol_doc_sizes.test.ts`                                         | b     | Lower exact caps after document splits; no cap is raised.                                                                                                                                                   |
| `tests/public_exclusions.test.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/publication_snapshot.test.ts`                                       | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/react_shell_historical_routes.test.ts`                              | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/review_safety.test.ts`                                              | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/serve_snapshot.test.ts`                                             | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/server_changed_assets.test.ts`                                      | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `tests/server_changed_noise.test.ts`                                       | a     | Remove source declarations and preserve rendered-resource evidence under the approved branch contract.                                                                                                      |
| `tests/server_navigation.test.ts`                                          | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/server_reporting.test.ts`                                           | b     | Use the retained unified Manifest alias for the same ready-report callback.                                                                                                                                 |
| `tests/source_inventory.test.ts`                                           | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |
| `tests/variant_validation.test.ts`                                         | a     | Remove the deprecated field from the current-format fixture; keep its other path behavior.                                                                                                                  |

### Verification before the merge commit

- `npm run build`, `npm run typecheck`, `npm run lint`,
  `npm run example:build`, `npm run example:check` and
  `npm run format:check` pass. The nine focused documentation suites pass
  31/31. The source-file length audit passes for 701 changed files.
- The exact complete unit command passes 4,603/4,603, with no skipped,
  cancelled or TODO tests. The first integration run passed 4,483/4,562;
  the failing fixtures and integration boundaries were fixed. The unchanged
  PostCSS timing case passes at 2,205.4 ms (first run: 2,388.7 ms).
- Focused path, move, lock and stylesheet tests passed 308/309 initially.
  One watched-server child disconnected while the smoke build also ran.
  The same file passed 2/2 alone, and the complete unit run passed without
  concurrent builds or browser tests. No runtime change was made for this event.
- Chrome smoke passes at 390 and 1440 px through `npm run dev`. It checks
  Specs, a Markdown document, component-only CSS, direct screen CSS, Changes,
  Affected screens and Details. All temporary edits are restored. The isolated
  example checkout is clean. Thirty screenshots are listed in
  `.context/m28a/screenshots.md`; eighteen design captures were refreshed with
  their Details panels scrolled to the stylesheet evidence. No page error occurred.
- The line ledger contains 936 absent additions: 485 intended migrations and
  451 equivalent moves, rewordings or format changes. The other 71 name-audit
  records contain no added text; moved files remain at their new paths, except
  the approved style collector deletion. Main also removed
  `packages/viewer/src/registry/hierarchy_conflicts.ts` and
  `tests/baseline_directory_walk.test.ts`; their retired hierarchy and earlier
  baseline behavior is not restored.
- The gate's browser server uses `HEAD` as its baseline. The old branch tip
  lacks the combined current shape. The initial merge commit therefore comes
  before the full gate, as the requested merge procedure permits. A final
  amendment will record the complete gate and preservation checks.

### Gate and remerge follow-up

The first merge commit is `f4b520cf`, with exactly two parents: `e05bfd0f`
and `781da7ae`. Its remerge diff lists 518 paths. The partial clone tried to
fetch temporary remerge objects that are not remote objects. Inspection uses
`GIT_NO_LAZY_FETCH=1 git show --remerge-diff` and captures each path separately.
Git reports only the expected lazy-fetch-disabled warning. No repository
configuration was changed.

The first full gate passed the dependency audit, formatting, lint and file
limits, then found seven unused internal exports. The four live local helpers
(`movedSourcePaths`, `loadLiveCatalogueSnapshot`, `loadServedCatalogueSnapshot`
and `catalogueSnapshotForConfig`) are now private. `PathChips` and
`validateStringArray` served the removed dependency display/config field and
had no remaining callers. Their definitions were removed. The unused branch
copy `expectedGeneratedRoutes` was removed; main's `initialGeneratedStatic`
still owns the same inventory logic. The export gate now passes.

The remerge check also found two stale documentation contracts. The stylesheet
example now exports a component registration with `path` and variant `slug`.
The registration still supports main's `Component` and `entries` properties. `EntryChangeReason.id` is `screenPath`;
`AffectedConsumer.consumer.id` is `path`. Ignore-region and instance IDs keep
their own meanings. Two compiler-backed tests fail against the old examples
and pass after these corrections. This is a focused path-contract check, not
the broader documentation-guard work in M30.

Package smoke found branch-only `id` lookups after the package build passed.
The component smoke now reads `path` and `componentPaths`, uses current
`viewRoute` arguments and checks the deeper variant stylesheet href. The themed
consumer reads review paths. Both packed packages then passed all six scenarios.

The comparison browser test also retained old snapshot URLs and variant-edit
needles. Its duplicate fixture lacked main's selected-comparison provider.
`tests/browser/component_explorer_comparison.spec.ts` now reuses
`component_explorer_runtime_fixture.ts`; the obsolete branch-only
`component_explorer_fixture.ts` is removed. The evidence workspace opens current
example paths. The focused browser group passes 6/6. The root-range and deleted
Shared impact assertions also use their current entry paths; their group passes
14/14. No production comparison route was weakened.

The remerge inspection covers all 518 paths in the initial merge, with the
full per-path diffs in `.context/m28a/remerge/f4b520cf5c87-complete/`.
The reasons below supplement the line-loss table for paths without absent main
additions. The final amendment will be checked again with the same two parents.

| Additional remerge path                                                                  | Resolution reason                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/package-boundary.md`                                                  | Retain main roots/documents boundary and current-v8 baseline contract.                                                              |
| `docs/guides/start/configure.md`                                                         | Keep main routes/roots protection and branch stylesheet marker guidance.                                                            |
| `docs/protocol/documentation-policy.md`                                                  | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-artifact-paths.md`                                                  | Keep main nested artifact and previews contract.                                                                                    |
| `docs/protocol/mokly-baseline-compatibility.md`                                          | Require current combined v8 shape and retain graceful earlier-version outcome.                                                      |
| `docs/protocol/mokly-baseline-storage.md`                                                | Keep main no-directory-removal lock behavior and branch resource exclusion.                                                         |
| `docs/protocol/mokly-build-warnings.md`                                                  | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-catalogue-delivery.md`                                              | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-changes-controls.md`                                                | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-comparison-panes.md`                                                | Keep main path and previousPath snapshot derivation.                                                                                |
| `docs/protocol/mokly-component-comparison-records.md`                                    | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-component-design-inventory.md`                                      | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-component-explorer.md`                                              | Keep main Specs paths/documents/moves and branch delivery record.                                                                   |
| `docs/protocol/mokly-component-review-fast-path.md`                                      | Keep root range in fast-path ownership proof with strict path v8 admission.                                                         |
| `docs/protocol/mokly-component-stylesheet-ownership.md`                                  | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-component-stylesheets.md`                                           | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-component-usage-records.md`                                         | Keep current admission/root/provenance status and main component path meaning.                                                      |
| `docs/protocol/mokly-configuration-discovery.md`                                         | Main root and folder discovery replaces obsolete entries/entriesDir model.                                                          |
| `docs/protocol/mokly-css-attribution-membership.md`                                      | Keep rule identity/page attribution and optional view evidence contract.                                                            |
| `docs/protocol/mokly-design-component-library.md`                                        | Keep declaration provenance and main document/folder/path design inventory.                                                         |
| `docs/protocol/mokly-design-components.md`                                               | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-export-public-files.md`                                             | Retain main documents and exact generated export inventory coverage.                                                                |
| `docs/protocol/mokly-instances.md`                                                       | Retain v8 optional instance attribution.                                                                                            |
| `docs/protocol/mokly-nav-paths.md`                                                       | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-nested-authoring.md`                                                | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-package.md`                                                         | Keep current package boundary and path/document setup.                                                                              |
| `docs/protocol/mokly-removed-previews.md`                                                | Keep main path descriptors, Markdown previews, Light-only notes and paired-move suppression.                                        |
| `docs/protocol/mokly-root-discovery.md`                                                  | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-shell-design.md`                                                    | Main split owns inventory; port branch stylesheet states there, retain path shell design.                                           |
| `docs/protocol/mokly-shell-device-chrome.md`                                             | Align the branch contract with main's paths, documents and current formats.                                                         |
| `docs/protocol/mokly-source-protection-acceptance.md`                                    | Align the branch contract with main's paths, documents and current formats.                                                         |
| `examples/basic/entries/design/components/controls/index.tsx`                            | Accept the removed old location; retain its applicable screen or helper under specs/.                                               |
| `examples/basic/entries/design/components/index.tsx`                                     | Accept the removed old location; retain its applicable screen or helper under specs/.                                               |
| `examples/basic/entries/design/components/parts/destinations.ts`                         | Accept the removed old location; retain its applicable screen or helper under specs/.                                               |
| `examples/basic/entries/design/components/states/shared-impact/screens.tsx`              | Accept the removed old location; retain its applicable screen or helper under specs/.                                               |
| `examples/basic/entries/design/design.mockup.tsx`                                        | Accept the removed old location; retain its applicable screen or helper under specs/.                                               |
| `examples/basic/entries/design/parts/destinations.ts`                                    | Accept the removed old location; retain its applicable screen or helper under specs/.                                               |
| `examples/basic/entries/design/parts/screen_heads.tsx`                                   | Accept the removed old location; retain its applicable screen or helper under specs/.                                               |
| `examples/basic/entries/design/review/impact/stylesheets/unresolved-unnamed/screens.tsx` | Accept the removed old location; retain its applicable screen or helper under specs/.                                               |
| `examples/basic/specs/design/changes/impact/styles/matched-excluded/_folder.json`        | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/changes/impact/styles/matched-excluded/index.mockup.ts`     | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/changes/impact/styles/matched-excluded/screens.tsx`         | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/changes/impact/styles/unresolved-unnamed/_folder.json`      | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/changes/impact/styles/unresolved-unnamed/index.mockup.ts`   | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/changes/impact/styles/unresolved-unnamed/screens.tsx`       | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/components/parts/comparison_fixtures.ts`                    | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/components/parts/destinations.ts`                           | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/library/README.md`                                          | Keep path-based library inventory with rendered-only global evidence.                                                               |
| `examples/basic/specs/design/library/style_context.tsx`                                  | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/parts/document_page.tsx`                                    | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/parts/screen_heads.tsx`                                     | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/specs/design/parts/style_comparison.tsx`                                 | Keep branch evidence screens and helpers in main's path-based design tree.                                                          |
| `examples/basic/src/components/action/action.mokly.tsx`                                  | Declare shared public stylesheet and keep path-derived component variants.                                                          |
| `examples/basic/src/components/toolbar/toolbar.mokly.tsx`                                | Declare shared public stylesheet and keep path-derived component variants.                                                          |
| `packages/viewer/README.md`                                                              | Align the branch contract with main's paths, documents and current formats.                                                         |
| `packages/viewer/src/catalogue/references.ts`                                            | Keep resource evidence readiness and direct-parent path validation.                                                                 |
| `packages/viewer/src/client/README.md`                                                   | Adopt main plans directory link.                                                                                                    |
| `packages/viewer/src/components/manifest_types.ts`                                       | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `packages/viewer/src/components/view_validation.ts`                                      | Validate path component identity, instance ids, root ranges and non-CSS ownership.                                                  |
| `packages/viewer/src/registry/types.ts`                                                  | Use shared current v8 path/folders/document manifest; retain strict current baseline types.                                         |
| `packages/viewer/src/review/component_types.ts`                                          | Keep moved path records in v5 without removed shared-impact result field.                                                           |
| `packages/viewer/src/review/css/evidence.ts`                                             | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `packages/viewer/src/review/result_css.ts`                                               | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `packages/viewer/src/review/result_validation.ts`                                        | Main extracted reference validator preserves branch invariants and adds side-aware move mapping.                                    |
| `packages/viewer/src/review/types.ts`                                                    | Screen review uses path, no retired dependencies/sharedImpact.                                                                      |
| `packages/viewer/src/shell/README.md`                                                    | Keep main branch-point lookup consumers and branch pending known-name navigation contract.                                          |
| `packages/viewer/src/shell/css_views_layout.ts`                                          | Keep responsive Details title wrapping and path chip style.                                                                         |
| `packages/viewer/src/shell/details_rows.tsx`                                             | Preserve main linked document references and source chips.                                                                          |
| `packages/viewer/src/shell/metadata.ts`                                                  | Keep path folders, removed parent titles, move membership and page evidence.                                                        |
| `packages/viewer/src/shell/page_evidence_data.ts`                                        | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `packages/viewer/src/shell/views.tsx`                                                    | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `packages/viewer/src/shell/workspace_evidence.tsx`                                       | Keep known-name heading and main previous-path sentence.                                                                            |
| `packages/viewer/src/shell/workspace_stylesheet_evidence.ts`                             | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `packages/viewer/src/shell/workspace_views_data.ts`                                      | Migrate variant evidence selection to variantPath.                                                                                  |
| `packages/viewer/src/viewer/public_workspace_views.ts`                                   | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `packages/viewer/tests/appearance_changed_views.test.tsx`                                | Keep path-based public fixture and exact reader checks without removed evidence fields.                                             |
| `packages/viewer/tests/comparison_documents.test.ts`                                     | Keep path-based public fixture and exact reader checks without removed evidence fields.                                             |
| `packages/viewer/tests/comparison_heading.test.tsx`                                      | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/component_workspace_fixture.tsx`                                  | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/component_workspace_part2.test.tsx`                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/details_contract.test.tsx`                                        | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/historical_baseline.test.tsx`                                     | Keep path-based public fixture and exact reader checks without removed evidence fields.                                             |
| `packages/viewer/tests/page_evidence.test.tsx`                                           | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/page_evidence_adoption.test.tsx`                                  | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/page_evidence_fixture.tsx`                                        | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/path_evidence_lookup.test.ts`                                     | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/public_workspace_evidence.test.tsx`                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/server_part2.test.tsx`                                            | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/shell_state.test.ts`                                              | Keep branch exact history navigation test and main path URL helper.                                                                 |
| `packages/viewer/tests/shell_state_part2.test.ts`                                        | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `packages/viewer/tests/shell_state_part3.test.ts`                                        | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `plans/README.md`                                                                        | Accept main's index deletion; each plan now carries its status.                                                                     |
| `plans/remove-source-path-evidence.md`                                                   | Preserve binding decisions and record this integration, checks and line audit.                                                      |
| `scripts/package/catalogue.mjs`                                                          | Retain branch privacy assertion and main path-derived shell.                                                                        |
| `scripts/package/components.mjs`                                                         | Keep path-based packed/large fixtures without retired inputs.                                                                       |
| `scripts/package/viewer.mjs`                                                             | Keep path-based packed/large fixtures without retired inputs.                                                                       |
| `src/authoring/definitions.ts`                                                           | Replace retired nested authoring with branded path definitions.                                                                     |
| `src/authoring/types.ts`                                                                 | Keep main path authoring; retain removed dependencies type guard on entries and variants.                                           |
| `src/authoring/warnings.ts`                                                              | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/build/component_runtime.ts`                                                         | Keep snapshot and warning records; leave warning cleanup to M29.                                                                    |
| `src/build/document_compiler.ts`                                                         | Preserve on-demand snapshots and final stylesheet spans with path-keyed registry.                                                   |
| `src/build/render.ts`                                                                    | Use path routes with configured-only placement anchors and generated styles.                                                        |
| `src/build/warnings.ts`                                                                  | Use resolved entry and folder paths in warning identity and messages.                                                               |
| `src/catalogue/views.ts`                                                                 | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/cli/run.ts`                                                                         | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/components/comparison_stylesheets.ts`                                               | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/components/definition.ts`                                                           | Combine main definition branding and path attribution with stylesheet validation and variant warning inputs.                        |
| `src/components/manifest_entry_validation.ts`                                            | Keep strict parent path validation without retired source ownership.                                                                |
| `src/components/stylesheet_provenance.ts`                                                | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/components/stylesheet_validation.ts`                                                | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/components/types.ts`                                                                | Use main slug/movedFrom variants and branch removed-field guards and stylesheet declarations.                                       |
| `src/components/wrapper.tsx`                                                             | Keep root-aware boundary extraction and main path/slug identity.                                                                    |
| `src/config/README.md`                                                                   | Align the branch contract with main's paths, documents and current formats.                                                         |
| `src/config/types.ts`                                                                    | Keep root folders, build warnings and stylesheet marker types.                                                                      |
| `src/config/validate.ts`                                                                 | Keep general unknown config errors; only review.sharedImpact warns and is ignored.                                                  |
| `src/export/README.md`                                                                   | Keep shared CSS page proof, main export inventory and plans directory.                                                              |
| `src/export/types.ts`                                                                    | Keep build warnings, remove main-retired preview ownership adapter.                                                                 |
| `src/html_references.ts`                                                                 | Use shared active HTML link finder and main shared CSS tokenizer.                                                                   |
| `src/publish/README.md`                                                                  | Adopt main plans directory link.                                                                                                    |
| `src/registry/catalogue_index.ts`                                                        | Retain folders in process-local manifest index.                                                                                     |
| `src/registry/changed_ids.ts`                                                            | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/registry/manifest_validation.ts`                                                    | Keep strict v8 baseline admission and main path/folder collisions.                                                                  |
| `src/registry/prepared_types.ts`                                                         | Prepared registry has main path keys and branch warnings.                                                                           |
| `src/registry/resolve_definitions.ts`                                                    | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/review/artifact.ts`                                                                 | Retain move summary diagnostics; remove source/shared impact lists.                                                                 |
| `src/review/compare.ts`                                                                  | Pass shared CSS attribution and main Markdown/source move inputs.                                                                   |
| `src/review/component_classification_comparisons.ts`                                     | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/review/component_classification_entries.ts`                                         | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/review/component_compare.ts`                                                        | Combine move preparation and private inserted-link proof for complete capture.                                                      |
| `src/review/component_comparison_counts.ts`                                              | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/review/component_view_types.ts`                                                     | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/review/css/attribution.ts`                                                          | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/review/moves/identity.ts`                                                           | Map branch stylesheet declarer paths with main's move mapping; keep original spans.                                                 |
| `src/review/selection_result.ts`                                                         | Use main selected entry path.                                                                                                       |
| `src/server/catalogue_snapshot.ts`                                                       | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/server/changed_content.ts`                                                          | Combine moved documents/resources with shared CSS attribution and page evidence.                                                    |
| `src/server/classified_css.ts`                                                           | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/server/content_resource_evidence.ts`                                                | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/server/controls/service.ts`                                                         | Keep transient warning reporting and accepted move-target provider.                                                                 |
| `src/server/controls/transient.ts`                                                       | Retain resource capture warnings and move-target hints for every transient render.                                                  |
| `src/server/demand/service.ts`                                                           | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `src/server/screen_view_changes.ts`                                                      | Keep strict current manifests and main moved/case-folded screen pairing.                                                            |
| `src/server/update_messages.ts`                                                          | Keep path validation and structured warning messages.                                                                               |
| `src/server/watch_preparation.ts`                                                        | Carry branch rendered-resource evidence through main's path-based runtime boundary.                                                 |
| `tests/authoring_fixture.tsx`                                                            | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/authoring_part2.test.tsx`                                                         | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/authoring_variants.test.tsx`                                                      | Use main variant inheritance; remove nested API coverage retired by main.                                                           |
| `tests/baseline_platform.test.ts`                                                        | Keep main paths, folders and derived variants in existing fixtures; omit retired dependency records.                                |
| `tests/browse_document_adapter.test.ts`                                                  | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/browser/comparison_design.spec.ts`                                                | Use main path routes and selected-comparison fixtures; preserve current schema and branch evidence assertions.                      |
| `tests/browser/component_controls_runtime.spec.ts`                                       | Use main path routes and selected-comparison fixtures; preserve current schema and branch evidence assertions.                      |
| `tests/browser/component_explorer_comparison.spec.ts`                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/browser/component_explorer_fixture.ts`                                            | Port the branch fixture to path APIs; final cleanup reuses main's selected-comparison fixture.                                      |
| `tests/browser/component_explorer_inspection.spec.ts`                                    | Use main path routes and selected-comparison fixtures; preserve current schema and branch evidence assertions.                      |
| `tests/browser/component_explorer_runtime.spec.ts`                                       | Use main path routes and selected-comparison fixtures; preserve current schema and branch evidence assertions.                      |
| `tests/browser/css_component_rows.spec.ts`                                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/browser/css_outside_evidence.spec.ts`                                             | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/browser/css_outside_fixture.ts`                                                   | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/browser/css_page_evidence.spec.ts`                                                | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/browser/css_page_fixture.ts`                                                      | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/browser/design_stylesheet_evidence.spec.ts`                                       | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/browser/evidence_workspace.spec.ts`                                               | Use main path routes and selected-comparison fixtures; preserve current schema and branch evidence assertions.                      |
| `tests/browser/navigation_fixture.ts`                                                    | Use main path routes and selected-comparison fixtures; preserve current schema and branch evidence assertions.                      |
| `tests/browser/removed_comparison_eligibility.spec.ts`                                   | Use main path routes and selected-comparison fixtures; preserve current schema and branch evidence assertions.                      |
| `tests/browser/viewer_details.spec.ts`                                                   | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/build_warning_authoring.test.ts`                                                  | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/build_warning_background.test.ts`                                                 | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/build_warning_commands.test.ts`                                                   | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/build_warning_serve.test.ts`                                                      | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/build_warning_transient.test.ts`                                                  | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/catalogue_css_evidence.test.ts`                                                   | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/catalogue_history_conflicts.test.ts`                                              | Keep path-based public fixture and exact reader checks without removed evidence fields.                                             |
| `tests/catalogue_nav_paths_reader.test.ts`                                               | Keep path-based public fixture and exact reader checks without removed evidence fields.                                             |
| `tests/changes_activation.test.ts`                                                       | Use path route and current manifest fixture without retired fields.                                                                 |
| `tests/changes_css_delivery.test.ts`                                                     | Assert actual rendered-resource reasons, not removed sharedImpact.                                                                  |
| `tests/changes_css_equivalence.test.ts`                                                  | Use main changedEntries field for fast/complete equality.                                                                           |
| `tests/changes_css_scope.test.ts`                                                        | Retired sharedImpact result stays absent.                                                                                           |
| `tests/changes_imported_styles.test.ts`                                                  | Keep rendered-only imported CSS and absence of source sharedImpact in path results.                                                 |
| `tests/changes_resource_ownership.test.ts`                                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/client_page_evidence.test.ts`                                                     | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/client_removed_preview_requests_fixture.ts`                                       | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/client_removed_preview_requests_part2.test.ts`                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/client_stylesheet_evidence.test.ts`                                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/client_stylesheet_evidence_markup.test.ts`                                        | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/client_workspace_comparison.test.ts`                                              | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/client_workspace_evidence.test.ts`                                                | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/component_authoring_types.tsx`                                                    | Neither retired authored routes nor dependencies belongs to component inputs.                                                       |
| `tests/component_build.test.ts`                                                          | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/component_css_owner_filter.test.ts`                                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_historical_ranges.test.ts`                                              | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_history_changes.test.ts`                                                | Use main path identities in historical comparisons.                                                                                 |
| `tests/component_protocol_docs.test.ts`                                                  | Combined manifest/review path identity and current README format statement.                                                         |
| `tests/component_registry_validation.test.ts`                                            | Main ignores unbranded module exports; remaining component diagnostics stay.                                                        |
| `tests/component_root_output.test.ts`                                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_runtime_ipc.test.ts`                                                    | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/component_stylesheet_edges.test.ts`                                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_generated_anchors.test.ts`                                   | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_graceful.test.ts`                                            | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_ignored_links.test.ts`                                       | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_link_delivery.test.ts`                                       | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_link_scope.test.ts`                                          | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_placement.test.ts`                                           | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_provenance.test.ts`                                          | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_provenance_part2.test.ts`                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_span_resources.test.ts`                                      | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheet_validation.test.ts`                                          | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_stylesheets.test.ts`                                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/component_workspace_dedup.test.ts`                                                | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/config_generated_routes.test.ts`                                                  | Keep main reserved path and root prefix tests.                                                                                      |
| `tests/config_part2.test.ts`                                                             | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/css_membership_generation.test.ts`                                                | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/css_membership_source_proof.test.ts`                                              | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/css_nested_membership.test.ts`                                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/css_page_delivery.test.ts`                                                        | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/css_root_membership.test.ts`                                                      | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/css_rule_copies.test.ts`                                                          | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/css_rule_evidence_schema.test.ts`                                                 | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/css_rule_membership.test.ts`                                                      | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/current_baseline_commands.test.ts`                                                | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/current_baseline_contract.test.ts`                                                | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/current_baseline_invalid.test.ts`                                                 | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/demand_props.test.ts`                                                             | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/design_appearance_variants.test.ts`                                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_component_stylesheet_states.test.ts`                                       | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_excluded_only.test.ts`                                                     | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_library_css_attribution.test.ts`                                           | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_links_inventory.test.ts`                                                   | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_page_styles.test.ts`                                                       | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_reachability.test.ts`                                                      | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_screen_counts.test.ts`                                                     | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_screens_fixture.tsx`                                                       | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_screens_part2.test.tsx`                                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/design_stylesheet_pages.test.ts`                                                  | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/fixtures/consumers/esm/src/components/card/card.mockup.tsx`                       | Keep path-based packed/large fixtures without retired inputs.                                                                       |
| `tests/fixtures/consumers/nodenext/api.tsx`                                              | Migrate authored test fixtures to main paths/roots/slugs without removed dependency inputs; retain attribution and link assertions. |
| `tests/fixtures/consumers/nodenext/removed_fields.tsx`                                   | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/former_marker_baseline.test.ts`                                                   | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/former_marker_classification.test.ts`                                             | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/former_marker_content.test.ts`                                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/baseline_fixture.ts`                                                      | Keep main path-based fixture shape and assertions, omit removed source-evidence fields.                                             |
| `tests/helpers/changed_view_fixture.ts`                                                  | Keep main path-based fixture shape and assertions, omit removed source-evidence fields.                                             |
| `tests/helpers/component_link_fixture.ts`                                                | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/component_stylesheet_fixture.ts`                                          | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/css_evidence.ts`                                                          | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/css_membership_fixture.ts`                                                | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/current_baseline_fixture.ts`                                              | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/derived_fixture.ts`                                                       | Keep main path-based fixture shape and assertions, omit removed source-evidence fields.                                             |
| `tests/helpers/design_library_css.ts`                                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/design_rows.ts`                                                           | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/example_baseline.ts`                                                      | Keep main extracted path-based ordinary-preview catalogue; preserve branch current-format baseline fixture.                         |
| `tests/helpers/example_sources.ts`                                                       | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/former_marker_fixture.ts`                                                 | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/imported_changes_fixture.ts`                                              | Keep main path-based fixture shape and assertions, omit removed source-evidence fields.                                             |
| `tests/helpers/preview_comparison_fixture.ts`                                            | Keep main path-based fixture shape and assertions, omit removed source-evidence fields.                                             |
| `tests/helpers/removed_field_registry.ts`                                                | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/helpers/removed_page_preview_fixture.ts`                                          | Keep main path-based fixture shape and assertions, omit removed source-evidence fields.                                             |
| `tests/helpers/review_css_schema.ts`                                                     | Use combined v5 path and CSS evidence schema.                                                                                       |
| `tests/helpers/workspace_views_data_fixture.ts`                                          | Keep main path-based fixture shape and assertions, omit removed source-evidence fields.                                             |
| `tests/hierarchy.test.ts`                                                                | Main path collision tests replace retired navPath label/manifest checks.                                                            |
| `tests/historical_snapshot_identity.test.ts`                                             | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/mainline_preservation_docs.test.ts`                                               | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/nav_path_authoring.test.ts`                                                       | Main path authoring replaces retired nested navPath tests; keep reciprocal variant flow test.                                       |
| `tests/nav_path_build.test.ts`                                                           | Main path/slug collision and attribution tests replace removed navPath diagnostics.                                                 |
| `tests/nav_sections.test.ts`                                                             | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/nav_tree.test.ts`                                                                 | Use main extracted path fixture and tag suite; preserve folder/variant navigation checks.                                           |
| `tests/nav_tree_removed_variants.test.ts`                                                | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/navigation_removed_fields.test.ts`                                                | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/page_model.test.ts`                                                               | Main folder records replace removed nested authoring fixture.                                                                       |
| `tests/path_stylesheet_integration.test.ts`                                              | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/public_review_retention.test.ts`                                                  | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/public_workspace_views.test.ts`                                                   | Keep path-based public fixture and exact reader checks without removed evidence fields.                                             |
| `tests/publication_documents.test.ts`                                                    | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/publication_removed_previews.test.ts`                                             | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/publish_run.test.ts`                                                              | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/removed_authoring_fields.test.ts`                                                 | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/removed_page_previews.test.ts`                                                    | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/removed_preview_shell.test.ts`                                                    | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/removed_screen_previews.test.ts`                                                  | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/resource_denials.test.ts`                                                         | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/review.test.ts`                                                                   | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/review_artifact_ui.test.ts`                                                       | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/review_performance.test.ts`                                                       | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/review_public_exclusions.test.ts`                                                 | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/review_regressions.test.ts`                                                       | Use main path formats and folders; retain rendered-resource tests without removed dependency fields.                                |
| `tests/serve_on_demand.test.ts`                                                          | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/server_changed_hierarchy.test.ts`                                                 | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/server_removed_preview_lifecycle.test.ts`                                         | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/server_removed_preview_lifecycle_fixture.ts`                                      | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/server_removed_preview_limits.test.ts`                                            | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/server_selected_review_lifecycle.test.ts`                                         | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |
| `tests/shell.test.ts`                                                                    | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/shell_appearance.test.ts`                                                         | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/shell_chrome.test.ts`                                                             | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/shell_fixture.ts`                                                                 | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/shell_styles.test.ts`                                                             | Keep main path navigation and extracted test groups; omit retired dependency fields.                                                |
| `tests/shell_views.test.ts`                                                              | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/source_path_evidence.test.ts`                                                     | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/variant_validation_fixture.ts`                                                    | Port branch fixtures and assertions to paths and current formats; retain their checked behavior.                                    |
| `tests/viewer_catalogue_variants.test.ts`                                                | Keep path-based public fixture and exact reader checks without removed evidence fields.                                             |
| `tests/watch_classification.test.ts`                                                     | Keep path-based delivery and lifecycle fixtures; omit retired fields; preserve main extracted test helpers.                         |

The third complete gate passed repository, Rust, package and consumer checks.
Its unit stage passed 4,604/4,605, with no skipped or cancelled tests. The only
failure was the unchanged PostCSS timing case at 2,839.4 ms. The first isolated
retry failed at 2,856.2 ms. The second isolated retry passed all three tests at
2,030.7 ms. The timing test, dependency inputs and audit are unchanged. The
complete gate is being rerun to obtain a successful complete result.

The final line audit now lists 939 absent nonblank additions across 221 paths:
485 intended migrations and 454 equivalent moves, rewordings or format changes.
The two additional paths use the Specs heading and a canonical live component
URL. The full ledger has no unclassified line and no remaining loss.

The fourth complete gate passed all 4,605 unit tests with no skips or
cancellations. The PostCSS timing case passed at 1,949.1 ms. Its browser stage
passed 877 checks, failed four, timed out one fixture setup and skipped the four
checks that needed that setup. It did not reach hydration.

The browser failures exposed integration work in tests. A stale second
`afterAll` called an undefined `close`; its removal restores main's cleanup
exactly. The new document tests still expected Dependencies. They now require
that row to be absent and prove that the copied document image loads in both
schemes, while retaining Source, tags, title, path and appearance assertions.

A cold navigation probe reached the correct Dark preview URLs and ready state
around 10.6 seconds after starting. The navigation test now waits for the two
successful preview responses before using the unchanged assertion deadlines
for every original scheme URL check. It still switches scheme and navigates without
waiting for the previous screen's previews.

The ordinary publication fixture timed out inside Playwright's five-minute
setup budget, but completed in about 70 seconds in a normal Node process.
CPU profiling found most worker samples in React development JSX stack
capture; Playwright sets the diagnostic stack limit to 200. The fixture now
runs its unchanged real build/export in an owned Node child through
`scripts/verification/process.mjs`, with typed declarations for that existing
process boundary. Its build deadline reserves cleanup time inside the existing
budget. No timeout, retry, worker count, catalogue content or production runtime
rule was weakened. The same fifteen affected browser checks then passed; the
fixture build took about 80 seconds. The final response-based navigation wait
passes all three cases separately. The adapter timeout remains unchanged; the
open review item below records the cold-load inspection risk.

### Open review items

1. Low: the comparison example inherits a required variant description from
   its manifest `Pick`, but the public comparison type makes that description
   optional. Main already has this mismatch. A consumer built from the example
   can reject valid output. Option A: make the field optional and extend the
   compiler-backed check to the full comparison result. Option B: correct only
   the example. Option C: leave the conflicting guidance. Recommend A because
   it also detects future schema drift. No change was made for this item.
2. Medium: a cold document can arrive after the existing five-second frame
   adapter deadline. The probe received valid Dark documents, but a separate
   cold run had already disposed its inspection session. The document can
   appear while inspection stays unavailable until a new mount. Option A:
   define separate preparation and adapter-readiness budgets, with delayed
   response tests. Option B: pre-render likely views, at a startup cost and
   without covering every catalogue. Option C: retain the current limit and
   require another selection or reload after a slow load. Recommend A as a
   protocol decision. This milestone preserves main's timeout and adds no
   automatic retry.

The user decides the scope of these review items. They do not claim a completed
post-push implementation review; the reviewer still owns that step.

The focused hydration suite passed 266/266 with no skipped tests. The final
cold-navigation test passed 3/3 with successful response waits and all original
scheme URL assertions. The fifteen affected browser tests, 33 documentation
tests, root and script type checks, lint, formatting and repository ratchets
pass after the fixture fixes. The complete gate is being run once more against
these fixed inputs.

The fifth `cargo xtask check` stopped at the live dependency audit. It newly
reports High advisory `GHSA-68fv-2mgg-jv7q` for the unchanged `source-map-js`
installation. The [advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
describes event-loop denial of service from indexed source-map section offsets;
its patched release is 1.2.2. The root dependency files and audit policy still
match main. The task forbids changing them and explicitly permits this fallback:
run each remaining gate step, one at a time, require passing results, and report
the audit failure. That serial fallback is in progress. No successful full-gate
exit is claimed while the advisory remains uncovered.

### Final verification outcome

On the 2026-10-06 verification run, all nineteen non-audit gate steps passed
serially. Unit tests passed 4,605/4,605; browser tests passed 886/886; hydration
passed 266/266. None was skipped or cancelled. The final PostCSS timing case
passed at 1,629.5 ms. Rust tests passed 15/15. Build, typecheck, lint, formatting,
file limits, export ratchets, example validation and all six packed-consumer
scenarios for both packages passed. The example contains 478 generated files.
The source-file length audit passed for 706 files. No cap was raised.

The full `cargo xtask check` command remains blocked at the unchanged live
audit by `GHSA-68fv-2mgg-jv7q`. The prescribed fallback does not waive or hide
that failure. A separate authorized dependency update to a patched release is
the recommended next action; leaving the dependency unchanged keeps the audit
blocked. No dependency, override, audit rule or exception was changed here.

The final mainline ledger checks 54,751 added nonblank lines. It lists all 941
absent lines across 222 paths: 487 intended migrations and 454 equivalent
moves, rewordings or formatting changes. There is no unclassified line or
remaining loss. The four main-relative file deletions remain the approved
ones. The branch-only duplicate browser fixture is additional migration
cleanup, as recorded above.

Exact command logs and the serial results are in `.context/m28a/`. The
reviewer report is `.context/m28a/report.md`; the thirty screenshots are listed
in `.context/m28a/screenshots.md`. Every temporary smoke edit is restored.
The final local amendment retains the original source and fetched main as its
two parents. Its remerge diff is checked again before handoff. The branch is
not pushed. The post-push implementation review remains with the reviewer.
Milestone 29 was not started.

### Final remerge inspection

The code-bearing amendment has 529 remerge paths. All were captured again
with `GIT_NO_LAZY_FETCH=1 git show --remerge-diff`. Of these, 502 diffs exactly
match the first reviewed capture. The other 27 changed or new diffs were read
again, including this plan. No mainline content loss was found. The final
amendment below changes only these documentation records; its parent count and
remerge content are checked again before handoff.

| Additional final remerge path                        | Reason                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `docs/protocol/ci-suite-evidence.md`                 | Document owned fixture builds and response waits without changing assertion, retry or worker policies. |
| `scripts/package/consumer_cases/themed.mjs`          | Read current review paths in the existing packed-consumer checks.                                      |
| `scripts/verification/process.d.mts`                 | Type the existing owned-process API for its new fixture caller.                                        |
| `src/config/rules.ts`                                | Remove the unused validator for the removed shared-impact input.                                       |
| `src/review/moves/source_moves.ts`                   | Keep the same source-move helper private beside its remaining caller.                                  |
| `src/server/generated_static.ts`                     | Remove the unused branch helper copy; main's initial inventory function remains.                       |
| `tests/browser/browse_appearance_navigation.spec.ts` | Wait for the real document responses and retain all original scheme URL assertions.                    |
| `tests/browser/document_pages.spec.ts`               | Remove the dependency-row expectation and verify real image loading in both schemes.                   |
| `tests/browser/ordinary_preview_build.ts`            | Build the unchanged ordinary catalogue in an owned normal Node process.                                |
| `tests/browser/ordinary_preview_fixture.ts`          | Use that owned build while retaining output freshness, cleanup and the existing setup budget.          |
| `tests/path_protocol_examples.test.ts`               | Compile the authoring example and check documented path identities against public types.               |

## Milestone 29: Fix Serve warnings and startup cleanup

- [x] Failure-first (2): no older-generation warning prints after a failed
      rebuild during background compilation, after a successful rebuild that
      fixes the cause, or from a preview-process render after a rebuild
      starts. Tag warnings with their generation in the background worker and
      child messages, and remove the second add of `compilation.warnings`.
- [x] Failure-first (10): a process-supervisor factory that throws during
      watched startup leaves no watcher open. Create the supervisor inside the
      cleanup block.
- [x] (11) Delete `ComponentRuntime.warnings` and its writers, and the unused
      one-sided `page` material in `src/review/component_view.ts`.
- [x] Update the READMEs near the changed code. Run the focused tests and the
      complete unit suite at 100%.

- [x] Cover reconfiguration, queued warnings, runtime transfer, transient
      renders and resource reloads. Keep preview cache identity separate from
      the warning attempt, so a reload cannot restore a failed attempt's old
      warnings. Move the existing restart helper into `serve_lifecycle.ts`
      to keep `serve_watched.ts` below 300 lines.
- [x] Preserve config-warning IPC for the full-manifest child startup path.
      Its generation is captured before config loading, and it never writes a
      terminal copy. Add a direct child regression test before the correction.
- [x] Run the required build, type, lint, formatting, docs, complete unit and
      full repository checks. Repeat the ported probes and smoke-test watched
      Serve with warning and entry repairs. Inspect the diff and deletions
      against `origin/main`. Record every result and new removal.
- [x] Make one local Conventional Commit. The reviewer owns the push and
      later review.

Implementation notes:

- Each warning sink allocates a 32-character build attempt before config or
  consumer preparation. Rebuilds and reconfiguration retire the old attempt
  immediately. Bound preparation callbacks and validated worker/child messages
  keep their producer's generation. The terminal sink accepts only the current
  attempt and keeps its seen identities after adoption or failure.
- Accepted runtimes carry `warningGeneration`. A resource reload can change
  the existing preview/cache `generation` without starting a warning attempt.
  Both identifiers cross runtime IPC. Ordinary documents and transient Props
  renders capture their warning identity from those accepted inputs.
- Background compilation streams warnings once. Neither watched nor unwatched
  completion adds `compilation.warnings` again. The child forwards tagged
  warnings to the parent directly and does not replay parent-collected config
  warnings. Unwatched Serve and one-shot commands retain their existing scopes.
- Supervisor construction now runs inside startup cleanup. If its factory
  throws, every created source watcher closes before startup rejects.
- The unread runtime warning list and both writers are removed. One-sided
  comparisons no longer create the unused page material. Original range and
  stylesheet-span validation, resource discovery and CSS matching remain.
- M29 changes no public UI, dependency, override or audit rule. M30 is not
  started. Per the task instruction, the commit stays local for the reviewer.

Failure-first evidence:

- The five controlled background tests all fail before the fix. Failed and
  successful rebuilds and both reconfiguration outcomes print three warnings
  instead of one. Completion adds four records for two streamed warnings.
- Both real-child tests fail before the fix. A preview started before the
  attempt prints an old warning during successful preparation or after a
  failed rebuild. The throwing-factory test leaves the final watcher open.
  The two updated IPC tests fail because generation is discarded. Together
  these valid runs have ten expected failures and five preservation passes.
- Tests use explicit render gates, controlled watcher notifications, config
  gates and the writer lock. They do not use long sleeps to order a race.
  An initial harness used an async renderer, which the synchronous renderer
  contract rejects. That run was stopped. The corrected gate uses a bounded
  synchronous helper process. An extra reload test first targeted an unaccepted
  config object; placing its stylesheet in startup config fixed the fixture.
- A later direct-child test exposes an additional startup path affected by
  the CLI change: a full-manifest child prints its config warning on stderr
  instead of sending IPC. It fails with zero forwarded messages instead of
  one. Capturing its startup generation before config loading restores tagged
  forwarding. The first complete unit run was stopped to make this correction;
  it is not counted as a completed verification run. Its log is retained as
  `.context/m29/unit-stopped-for-child-startup.log`.
- Logs: `.context/m29/failure-first-background.log` and
  `.context/m29/failure-first-child.log`. The final focused run passes all
  240 tests. The seven required docs suites pass all 28 tests. Build, typecheck
  and lint pass. The first lint run needed two import-order corrections.

Verification and delivery evidence:

- `npm run build`, `npm run typecheck` and `npm run lint` pass. The changed-file
  formatting command passes:

  ```sh
  xargs -d '\n' npx prettier --check < .context/m29/changed-files.txt
  ```

- The final broad focused run passes 240 tests. The additional child startup
  preservation run passes 13 tests. The final startup, child-generation and
  sink run passes seven tests. The broad command is:

  ```sh
  npx tsx --test --test-concurrency=2 tests/build_warning*.test.ts tests/css_owner_warning_delivery.test.ts tests/component_runtime*.test.ts tests/demand_service.test.ts tests/demand_props.test.ts tests/background_generation.test.ts tests/background_git_cancellation.test.ts tests/derived_generation.test.ts tests/watch*.test.ts tests/serve_on_demand.test.ts tests/serve_startup_cleanup.test.ts tests/server_reporting.test.ts tests/component_fast_path*.test.ts tests/component_stylesheet_span_resources.test.ts tests/component_stylesheet_link_delivery.test.ts tests/component_material_projection.test.ts
  ```

- All 28 requested documentation tests pass, including after the CLI and
  controls README updates:

  ```sh
  npx tsx --test tests/current_docs_contract.test.ts tests/component_protocol_docs.test.ts tests/guides_structure.test.ts tests/protocol_doc_sizes.test.ts tests/protocol_split_links.test.ts tests/mainline_preservation_docs.test.ts tests/protocol_doc_history.test.ts
  ```

- The exact complete unit command passes all 4,620 tests, with no failures,
  skips, cancellations or TODOs. The unchanged PostCSS timing case takes
  1,541.8 ms against its 2,500 ms limit:

  ```sh
  npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"
  ```

- `cargo xtask check` exits 1 at `npm run dependencies:check`. The existing
  Braces exception is accepted through 2026-11-03 UTC. The unchanged installed
  `source-map-js` has the uncovered high-severity advisory
  `GHSA-68fv-2mgg-jv7q`. No dependency, override, audit rule or exception changed.
  This task uses the user's explicit fallback instead of claiming a passing
  complete gate.
- Every remaining gate step runs separately and in sequence. The commands are:

  ```sh
  npm run format:check
  npm run lint
  node scripts/verification/source-file-length.mjs
  node scripts/verification/repository-ratchets.mjs
  cargo fmt --all -- --check
  cargo clippy --workspace --all-targets -- -D warnings
  cargo test --workspace
  cargo xtask rust-file-length-lint
  npm run prepare:verification
  npm run typecheck:prepared
  npm run example:check
  npm run package:artifacts -- --out .context/verification/package-artifacts
  npm run package:check:prepared -- --artifacts .context/verification/package-artifacts
  npm run package:smoke:prepared -- --artifacts .context/verification/package-artifacts
  npm run prepare:verification
  npm run test:prepared
  npm run prepare:verification
  npm run test:browser:prepared
  npm run prepare:verification
  npm run test:hydration:prepared
  ```

- The gate's unit step passes 4,619 of 4,620. Its only failure is the existing
  PostCSS timing case at 2,870.8 ms. With no other suite or server running,
  `npx tsx --test tests/postcss_dependency_review.test.ts` passes all three
  tests on its first isolated retry, at 1,609.3 ms. The test matches
  `origin/main` exactly. The approved isolated retry is the only non-audit
  verification exception. The gate's failed unit report is retained.
- All other non-audit steps exit 0. Rust passes 15 tests. Both packed packages
  pass all six consumer scenarios. Browser passes 886 tests and hydration
  passes 266 tests. Neither suite fails, skips or cancels a test. The normal
  `npm run example:build` and `npm run example:check` pass with 478 files.
- The supplied probes use current roots, entry paths and generated routes.
  These repeated commands pass their intended warning checks:

  ```sh
  node --import tsx .context/review3/a_probe.ts broken-entry
  node --import tsx .context/review3/a_probe.ts fixed-renderer
  node --import tsx .context/review3/a_child_probe.ts
  ```

  Both background probes print 25 distinct warnings before the new attempt,
  zero afterwards and zero replays. The child probe returns HTTP 200 for both
  requests and prints no warning after the new-attempt boundary.

- `node --import tsx .context/m29/smoke.mjs` runs the real example through
  `npm run dev -- --base HEAD --port 0 --debug-timings`. It introduces an
  ignored-owner warning, fixes the renderer during a blocked background
  render, then breaks and repairs an entry during another blocked render.
  No old warning prints after either boundary or after repair. Chrome loads
  the repaired Welcome at 1440 px and 390 px with no page errors. Screenshots
  are `.context/m29/smoke-desktop.png` and `smoke-mobile.png`. All temporary
  edits are restored. The example diff is empty.
- The diff and deletion audit uses fetched `origin/main` at `781da7ae`.
  `git diff --check`, `git diff --check origin/main`,
  `git diff --name-status origin/main` and
  `git diff --diff-filter=D --name-status origin/main` pass inspection.
  M29 adds no file deletion. The only deletions against main remain the four
  approved earlier removals: the style collector at its `specs/` path,
  `src/components/dependency_validation.ts`,
  `src/registry/dependency_paths.ts`, and the old style-collector test.
  The new code removals are exactly the unread runtime warning field/writers
  and the unused one-sided page computation. The existing restart logic moves
  to the lifecycle module to keep every changed TypeScript file below 300 lines.
- The full command and result record is `.context/m29/report.md`; raw command
  records are in `checks.jsonl` and each named log. No historical plan, review
  record, changelog, dependency file or generated example HTML is changed.
  Delivery is one local commit. The reviewer owns the push and later review.
  M30 is unchanged.

M29 is implemented and verified under the approved audit fallback and timing
retry rules. Delivery is one local commit. The branch is not pushed.

## Milestone 30: Strengthen tests, the docs guard and removed-field types

- [x] (4) Strengthen each weak test from the 2026-10-05 review, and record in
      this plan a run where it fails against the broken rule:
  - [x] component-page link removal: a root link that a child also declares,
        child-only links and reordered root links;
  - [x] `rel` tokens, with an element after the anchor and an asserted warning
        list;
  - [x] the nearest-link distance with anchors that are not adjacent, and a
        fallback test that checks the exact position;
  - [x] removed-field types: spread objects and the cases that depend on
        `?: never`;
  - [x] Serve child warning forwarding with a warning that only the child
        makes, and the warning sink's complete output;
  - [x] warnings on failing commands and on watched failed actions;
  - [x] the two checks that cannot fail, and tests whose names promise more
        than they check;
  - [x] provenance tokens that a transformer strips, replaces or duplicates.
- [x] (5) Rewrite `tests/current_docs_contract.test.ts` to fail closed under the
      2026-10-05 docs rule. Scan protocol docs, guides, READMEs and notes, and
      read statements across line breaks. Show that it fails on the real
      stale lines from the reviews.
- [x] (7) Verify the `sharedImpact?: never` guard added by M28A and its four
      NodeNext consumer cases. Retain assigned and spread objects, other review
      keys, and explicit `undefined` with `exactOptionalPropertyTypes`. Add
      direct generic `defineConfig` value, undefined and spread cases. Update
      Delivery Status notes.
- [x] Run the focused tests and the complete unit suite at 100%.

- [x] Use an isolated Git fixture for document-discovery tests so their stale
      notes cannot affect a concurrent repository scan.
- [x] Run build, typecheck, lint, changed-file Prettier, all docs tests and
      the complete `cargo xtask check`. Use the approved audit fallback only
      if the live audit fails. Inspect the diff and deletions against
      `origin/main`. Record every command and result.
- [x] Make one local Conventional Commit. The reviewer owns the push and
      the post-push review. Keep M31 and M32 unchanged.

Implementation notes:

- The path-based input types already contain the removed-field guards. The
  consumer fixture now covers spread values for every current entry, folder
  and variant input. Its separate review fixture retains M28A's four cases
  and adds generic `defineConfig` calls with supported review keys.
- Placement tests assert full link order and head/body scope. Root comparison
  tests keep shared root links, remove child-only links and check reordered
  root links through complete and fast comparison. Token tests cover stripping,
  unknown tokens, reassignment and duplicates.
- M29 already covers direct child startup and late child generations. The
  older Serve test now emits its warning only in the child. The sink checks
  every emitted warning. Plain and rich command failures check warning order
  and exit code 1. Watched failures check the real terminal report. Transient
  rendering checks HTTP JSON and preview HTML, including actual rendered props.
- Removed declarations name real files. Their presence leaves output unchanged
  against a clean control with equal source coordinates. Editing the unrendered
  file gives no evidence on either comparison path. A rendered non-CSS file
  cannot grant ownership through a removed component declaration.
- The docs guard scans Git's tracked and non-ignored authored Markdown in the
  documented locations. It reads wrapped statements and fenced examples. Both
  Markdown heading forms bound Delivery Status. Guides cannot use status to
  exempt a statement. Exact exceptions name one file, statement and reason;
  changed, missing and empty-reason exceptions fail. Current independent
  protocols do not waive other retired names in the same statement.
- The reviewed allow list has 50 exact entries. The guard fixes the remaining
  shared-impact claims and delivery references. Explicit format names keep
  current catalogue and review versions distinct. The regression fixture
  records verbatim historical statements and their source revisions. A separate
  assertion retains the Unnamed All-filter row that M26 added.
- No production runtime, dependency, audit rule, mockup or generated example
  output changes. All mutations run only in the detached Git worktree at
  `.context/m30/mutation`. The main worktree never contains a broken rule.

Mutation evidence (2026-10-06):

Every mutation runs in `.context/m30/mutation`, a detached Git worktree at
`b937bbca`. Its copies of the new tests match this branch. Source mutations
first run `npx tsc --project tsconfig.build.json`; every counted mutation
compiles. The test commands below then exit 1. Consumer compiler checks exit 2
with unused `@ts-expect-error` diagnostics. The unmodified consumer check passes.
Each rule is restored before the next mutation. Raw edits, commands and output
are in `.context/m30/mutations/`.

The runtime command for each row is
`npx tsx --test --test-name-pattern='<pattern>' tests/<file>.test.ts`.
A dash in the pattern column means run that file without a name filter.
The failure column counts failing tests, not successful mutation builds.

| Mutation             | Test file and pattern                                      | Broken rule and observed failure                                                                                                                |
| -------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| root-shared          | `component_stylesheet_root_material`, `shared declaration` | Retain a root link only when it has one declarer. The shared root link disappears: 1 failure.                                                   |
| child-retained       | `component_stylesheet_root_material`, `shared declaration` | Keep child-only links on component pages. The exact link list has an extra child link: 1 failure.                                               |
| root-reorder         | `component_stylesheet_root_material`, `reordering`         | Remove every root link from comparison material. The reordered root no longer changes: 1 failure.                                               |
| rel-exact            | `component_stylesheet_edges`, `configured alternate`       | Require the complete rel value to equal stylesheet. Insertion moves after the trailing meta element: 1 failure.                                 |
| rel-false-warning    | `component_stylesheet_edges`, `configured alternate`       | Warn for a present alternate-stylesheet anchor. The asserted empty warning list differs: 1 failure.                                             |
| distance             | `component_stylesheet_graceful`, `unequal distances`       | Change both following distances from index-position+1 to index-position. The separated, reordered anchors select the wrong side: 1 failure.     |
| fallback             | `component_stylesheet_graceful`, `fallback`                | Insert at the start of head content. The exact document differs: 1 failure.                                                                     |
| placement-end        | `component_stylesheet_placement`, `end of the head`        | Use that same start-of-head fallback. Links precede the final meta element: 1 failure.                                                          |
| placement-duplicates | `component_stylesheet_placement`, `keeps duplicate`        | Remove a repeated configured link. The complete ordered link list loses one record: 1 failure.                                                  |
| placement-order      | `component_stylesheet_placement`, `out of order`           | Swap the two authored configured links. Exact order differs: 1 failure.                                                                         |
| placement-body       | `component_stylesheet_placement`, `outside head`           | Move an authored body link into head. Its recorded scope differs: 1 failure. The final fixture uses valid head/body markup.                     |
| child-muted          | `build_warning_serve`, `made only by the child`            | Disable the child's warning IPC send. Both preview requests succeed, then the warning wait fails: 1 failure. The parent renderer emits no copy. |
| sink-forget          | `build_warning_sink`, `across phases`                      | Clear seen identities after flush. The complete output contains a duplicate: 1 failure.                                                         |
| command-no-flush     | `build_warning_failures`, `exits 1`                        | Skip the one-shot catch flush. All four commands in plain and rich modes lose warnings before the deliberate render error: 8 failures.          |
| watch-no-flush       | `build_warning_failures`, `watched failure`                | Skip the watched-action final flush. Both terminal modes report failure before their warning: 2 failures.                                       |
| config-no-callback   | `config`, `sharedImpact warns`                             | Retain collected config warnings but suppress the callback. The callback list is empty: 1 failure.                                              |
| transient-leak       | `build_warning_transient`, `-`                             | Copy private warnings into the stored render's public response. HTTP JSON exposes diagnostics: 1 failure.                                       |
| ownership            | `build_warning_authoring`, `without granting ownership`    | Grant every rendered component the non-CSS resource reason. Action incorrectly joins Home in Changes: 1 failure.                                |
| removed-metadata     | `source_path_evidence`, `-`                                | Let a removed dependency declaration change the entry title. Both clean-control output comparisons fail: 2 failures.                            |
| watcher-retained     | `watch_config`, `attaches every declared`                  | Skip closing the previously accepted watcher after adoption. The actual accepted watcher remains open: 1 failure.                               |
| token-stripped       | `component_stylesheet_tokens`, `stripped`                  | Reconstruct stripped token proof from the pre-transform document. Final spans or unchanged link material differ: 1 failure.                     |
| token-unknown        | `component_stylesheet_tokens`, `replaced`                  | Accept an unissued numeric token. The expected typed rejection is missing: 1 failure.                                                           |
| token-reassigned     | `component_stylesheet_tokens`, `reassigned`                | Check token existence but not its original file. The expected ambiguous-token error is missing: 1 failure.                                      |
| token-duplicate      | `component_stylesheet_tokens`, `duplicated`                | Remove the duplicate-token check. The expected ambiguous-token error is missing: 1 failure.                                                     |

The type mutation command is
`npx tsc --project tests/fixtures/consumers/nodenext/tsconfig.json`.
Widening the authoring `dependencies?: never` declarations to `unknown` makes
13 directives unused. Removing the component variant and ownership guards
makes three new spread directives unused. Removing the review guard makes six
directives unused, including the three generic config cases. Each mutation
has a successful source build before its expected consumer failure.

The first unknown-token mutation survived because the test replaced every
token with the same value. The duplicate-token check still rejected it. The
corrected test replaces one token, passes normally and fails when unknown
tokens are accepted. The first authoring mutation deleted the type fields but
could not compile the legacy folder extraction. That build is not counted as
test evidence. The valid widening mutation above reaches the consumer check. A second valid
mutation removes all authoring guards and changes only the scratch folder's
legacy-field extraction to the equivalent Reflect deletion. Its source build
passes; eight consumer directives become unused, including every added
spread case for entries, screen variants and folders. The fresh non-generic
literal cases still reject unknown keys, which proves why the spread checks
are needed. The original logs remain beside the corrected runs.

Each of the 14 verbatim statements in
`tests/fixtures/current-docs-stale.json` was appended outside Delivery Status
in its named file in the scratch worktree. Each run of
`npx tsx --test --test-name-pattern='current docs allow restricted' tests/current_docs_contract.test.ts`
fails on that file. This covers the eight original review excerpts, the old
README manifest requirement, the pre-M26 policy, review-fix, neighbour and
watch descriptions, and a component README delivery reference. Original
Delivery Status history remains allowed by the current policy.

Five additional guard mutations each fail one focused test: exempt statements
with removed/older/never; scan individual lines; omit notes; ignore unused
exceptions; or leave Delivery Status open after its next peer heading.
Removing the Unnamed All-filter row also fails its focused documentation test.
Their exact commands and failing output are in `guard-results.jsonl` and the
matching logs. No weakened guard or stale statement remains in this branch.

Verification and delivery evidence (2026-10-06):

- `npm run build`, `npm run typecheck`, `npm run lint` and changed-file
  Prettier pass. The focused command passes all 158 tests:

  ```sh
  npx tsx --test --test-concurrency=2 tests/component_stylesheet*.test.ts tests/build_warning*.test.ts tests/source_path_evidence.test.ts tests/config.test.ts tests/watch_config.test.ts tests/current_docs_contract.test.ts
  ```

- The seven documentation suites pass all 33 tests:

  ```sh
  npx tsx --test tests/current_docs_contract.test.ts tests/component_protocol_docs.test.ts tests/guides_structure.test.ts tests/protocol_doc_sizes.test.ts tests/protocol_split_links.test.ts tests/mainline_preservation_docs.test.ts tests/protocol_doc_history.test.ts
  ```

- The consumer compiler passes both locally and from the packed package:
  `npx tsc --project tests/fixtures/consumers/nodenext/tsconfig.json`.
  The first formatted attempt required moving four expect-error comments
  beside the properties that TypeScript diagnoses. The initial lint run
  required three import-order corrections. Both corrected checks pass.
- The exact full unit command passes all 4,644 tests, with no failures,
  skips, cancellations or TODOs. Its PostCSS collection takes 1,408.4 ms.

  ```sh
  npx tsx --test --test-concurrency=2 "tests/**/*.test.ts" "tests/**/*.test.tsx" "packages/viewer/tests/*.test.ts" "packages/viewer/tests/*.test.tsx"
  ```

- The strict unit gate also passes all 4,644 tests, with none skipped or
  cancelled. Its PostCSS collection takes 1,377.7 ms. The strict report's
  833 files equal the exact requested globs:

  ```sh
  MOKLY_VERIFICATION_REPORT=.context/m30/unit-final-report.json npm run test:prepared
  node .context/m30/unit-file-set.mjs
  ```

- The first complete unit attempt passed 4,638 of 4,644. Five assertions
  failed and one test timed out. The existing SIGINT startup, controls watch,
  two watcher-scale checks, child startup and PostCSS timing check exceeded
  their limits. Most still failed alone at first. The first strict repeat
  reproduced startup failures and an existing CLI timing wait; it was stopped
  and is not counted as complete or passing. Later, all affected files passed
  alone without changes, then both full runs above passed. No time limit,
  assertion, worker count or runtime implementation changed. No extra timing
  waiver is used for the final result. All earlier logs are retained.
- The first browser setup reached its existing limit while the new `HEAD`
  baseline was still preparing. Normal Serve completed the configured baseline
  commands and reached Changes ready. The next complete browser run passed
  876 of 886; ten existing five-second waits or sixty-second test budgets
  failed. The final run passes all 886, with no skipped or cancelled test:

  ```sh
  node dist/cli/bin.js serve --config examples/basic/mokly.config.ts --base HEAD --port 0 --no-watch --debug-timings
  MOKLY_VERIFICATION_REPORT=.context/m30/browser-final-report.json npm run test:browser:prepared
  ```

  The diagnostic server closed before browser testing. The baseline was built
  through its normal commands; no generated output was edited by hand.

- Hydration passes all 266 tests, with no skipped or cancelled test:
  `npm run test:hydration:prepared`.
- `cargo xtask check` stops at the unchanged High `source-map-js` advisory
  `GHSA-68fv-2mgg-jv7q`. The existing Braces exception is accepted through
  2026-11-03. No dependency, override or audit rule changed. The task's approved
  serial fallback runs every other gate step. Every final non-audit step
  passes; no successful full-gate exit is claimed.
- The serial fallback commands are:

  ```sh
  npm run format:check
  npm run lint
  node scripts/verification/source-file-length.mjs
  node scripts/verification/repository-ratchets.mjs
  cargo fmt --all -- --check
  cargo clippy --workspace --all-targets -- -D warnings
  cargo test --workspace
  cargo xtask rust-file-length-lint
  npm run prepare:verification
  npm run typecheck:prepared
  npm run example:check
  npm run package:artifacts -- --out .context/verification/package-artifacts
  npm run package:check:prepared -- --artifacts .context/verification/package-artifacts
  npm run package:smoke:prepared -- --artifacts .context/verification/package-artifacts
  npm run prepare:verification
  npm run test:prepared
  npm run prepare:verification
  npm run test:browser:prepared
  npm run prepare:verification
  npm run test:hydration:prepared
  ```

- Rust passes 15 tests. Both packed packages pass all six consumer scenarios.
  The example validates 478 files. The source-file audit passes for 730 files;
  no cap is raised. Final reports and every command/result are under
  `.context/m30/`, including `report.md` and `checks.jsonl`.
- The diff audit uses fetched `origin/main` at `80ceb445`. Main advanced during
  the task with #124 (link-control tiers and warnings), #140 (the dependency
  patch) and #141 (the Node version-file rename). This task does not integrate
  them. Every apparent deletion in the two-tree main diff was already absent
  at source tip `b937bbca`. M30 introduces no deletion or feature reduction.
  The existing `.nvmrc` to `.node-version` reverse rename in that diff is also
  an upstream change that this task does not integrate.
- The four earlier approved removals remain the style collector at
  `examples/basic/specs/design/library/style_context.tsx`,
  `src/components/dependency_validation.ts`,
  `src/registry/dependency_paths.ts`, and
  `tests/design_library_style_collector.test.tsx`. The additional main-only
  paths below stay outside this task. They must be preserved in a separate
  main integration; they are not deletions authored by M30.

  - `plans/styled-link-control-ancestor-rule.md`
  - `src/build/build_warnings.ts`
  - `src/build/link_control_tiers.ts`
  - `src/diagnostics/terminal_text.ts`
  - `tests/build_link_control_tiers.test.ts`
  - `tests/build_warning_compatibility.test.ts`
  - `tests/build_warning_protocol.test.ts`
  - `tests/build_warnings.test.ts`
  - `tests/ci_required_guard.test.ts`
  - `tests/cli_build_warnings.test.ts`
  - `tests/export_build_warnings.test.ts`
  - `tests/helpers/link_control_warning_fixture.ts`
  - `tests/link_control_ancestor_tiers.test.ts`
  - `tests/link_control_cli.test.ts`
  - `tests/link_control_descendant_tiers.test.ts`
  - `tests/link_control_serve_warnings.test.ts`
  - `tests/server_build_warnings.test.ts`

- `git diff --check`, `git diff --check origin/main`, and the complete name
  and deletion audits pass. Historical plans, review records, changelogs and
  dependency files remain unchanged by M30. The review includes every new
  test and fixture. Delivery is one local Conventional Commit; the reviewer
  owns the push and the later review. M31 and M32 remain unchanged.

M30 is implemented and verified under the approved audit fallback. All final
unit, browser, hydration, package and repository checks pass. The live audit
remains the only failed gate step. The plan stays active until its PR merges.

On 2026-10-06 the user decided to merge the latest `main` after Milestone 30,
and to combine the two build warning systems as option A. `main` moved to
`80ceb445` with #124 (link-control placement tiers and a build warning channel
with `--strict`), #140 (the patched `source-map-js`, which removes the audit
blocker) and #141 (`.node-version` renamed to `.nvmrc`). One warning system
remains, based on main's #124 channel. Main's record, reporters, exact output
lines and `--strict` stay. This branch's warnings become producers in that
channel: the three removed fields, duplicate component stylesheets, missing
configured links, ignored renderer stylesheet owners and former folder
dependencies. A warning that is not about one generated page names its subject
instead of a route: the entry or component path, or the configuration file.
The user approved this change to main's warning record. `--strict` counts every
warning, so a removed field fails a strict build. Watched Serve keeps the
Milestone 29 rule that ties each warning to its build attempt, inside main's
once-per-generation reporting.

## Milestone 30A: Integrate `main` #124, #140 and #141

Merge `main` at `80ceb445` before Milestones 31 and 32. A trial merge gives 19
conflicts, most of them between the two build warning systems.

- [ ] Audit main's additions from the source tip, merge `origin/main` with
      exactly two parents, resolve conflicts path by path and review every
      remerge-diff path.
- [x] Combine the two warning systems under the 2026-10-06 decision: main's
      record, reporters, exact lines and `--strict`; this branch's warnings as
      producers, with a non-page subject where needed; Milestone 29 build
      fencing in Serve. Update the build warning, terminal output, CLI, Serve
      and watch contracts and the guides. Record here every renamed code,
      field, type or message and every conflict of meaning.
- [x] Failure-first tests: `--strict` fails on each of this branch's warnings;
      warnings with a non-page subject print in the plain and rich reporters;
      Serve prints each attempt's warnings once and no older-generation warning
      after a rebuild; main's link-control warnings keep their exact lines.
- [x] Follow #141: use `.nvmrc` wherever the branch names `.node-version`.
- [x] Compare every line that main added since `781da7ae` with the merged tree.
      Classify each absent line as an intended migration, a move or a loss, and
      restore every loss before the push.
- [ ] Run `cargo xtask check` at 100%, including the dependency audit. Inspect
      the diff and the deletions against `origin/main`, and record the result.
- [x] Keep document compilation and CLI composition within 300 lines by moving
      transformed-view validation and Serve shutdown to named helper modules.
- [x] Preserve the newer fetched main additions (#137, #142 and #143), and
      migrate their fixtures and current docs to this branch's removed inputs.
- [x] Keep main's requested-document link-control diagnostic scope when
      referenced documents render for validation. Preserve the branch's
      ignored-input coverage for those renders and test both boundaries.
- [x] Fence failure flushes as well as successful completion. An older worker
      failure must not flush a newer attempt's pending diagnostics. Add the
      regression before the fix and repeat the complete unit command.
- [ ] Commit the checked merge locally with exactly two parents. The reviewer
      owns the push and the later review. Do not start Milestone 31.
- [ ] Push the branch after the reviewer checks the local merge.

### Integration decisions

The required fetch advanced main from `80ceb445` to `f52303cb`. The source tip
is `60d7e831`; the captured merge base is `781da7ae`. As in M28A, this merge
preserves the fetched additions: #137 keeps new evidence logs outside plans,
#142 covers hydration by route shape, and #143 removes the Juno consumer smoke.
The main merge ran once and gave 21 conflicts, resolved by path. The two extra
fixture conflicts accept main's Juno deletion. No historical plan or review
record is edited beyond main's inherited changes.

### Warning names and messages

No producer code is renamed. Main's two link-control codes and exact messages
stay. The branch's six codes join the same table. Former folder dependencies
still use `removed-dependencies` with a folder subject.

| Former branch name                                                                                                   | Integrated name or meaning                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `BuildWarning` and its inline code union                                                                             | `BuildDiagnostic` and main's `BuildDiagnosticCode` in `build_warnings.ts`                                    |
| `context`                                                                                                            | `route` for page warnings; `subject: { kind, path }` for entry, component, folder and configuration warnings |
| `warnings` on compilation, configuration, prepared registry, renderer output, compiled document and transient render | `diagnostics`; one record type and result channel                                                            |
| `isBuildWarning`                                                                                                     | `isBuildDiagnostic`, using the shared validation and bounded IPC admission                                   |
| `buildWarning(warning)`                                                                                              | Main's `buildWarnings(diagnostics)` on both CLI and Serve reporters                                          |
| Physical-file producer arguments                                                                                     | Producer-local alias filtering; diagnostic identity is main's normalized record                              |

`BuildWarningSink`, `GenerationWarning`, `warningGeneration`, callback names and
the `warning` IPC envelope stay as internal collection and attempt boundaries.
They carry only `BuildDiagnostic`. There is no second diagnostic record or
reporter. Main's compilation result remains the successful completion transport.

| Producer                           | New exact message, without the printed subject                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Removed entry or folder dependency | `dependencies has been removed; ignoring it. Delete the field.`                                           |
| Removed component ownership        | `ownedDependencies has been removed; ignoring it. Delete the field.`                                      |
| Removed configuration setting      | `review.sharedImpact has been removed; ignoring it. Delete the field.` (unchanged)                        |
| Duplicate stylesheet               | `duplicate component stylesheet <path> is ignored; it is linked once.`                                    |
| Missing configured anchor          | `configured stylesheet link <href> is absent; component stylesheets use another anchor.`                  |
| Ignored stylesheet owner           | `Stylesheet ownership for <path> is ignored. Changes follow the elements that each changed rule matches.` |

`<path>` and `<href>` keep JSON quoting. The former entry/component/folder or
route text leaves each message. The reporter supplies it once. Page lines keep
main's format. Other lines replace the route with `<kind> <JSON-quoted-path>`.
Configuration paths are repository-relative, with a basename fallback before
that root is usable. Main's lexical location/message/code order remains; a
final kind tie-break prevents two different locations with equal printed text
from merging. No absolute checkout path decides the order.

### Conflicts of meaning

- Main reports the primary compilation only. The branch also covers configuration,
  registry, failed compilation, child-only rendering and transient Props. These
  producers use the same diagnostic type and sink. Secondary Changes, freshness,
  Review and historical-baseline diagnostics keep main's discard policy.
- Main reports successful Serve diagnostics at Catalogue ready. The old branch
  reported configuration warnings at HTTP readiness and streamed render warnings
  to the terminal during compilation. The unified sink collects until Catalogue
  ready, or failure, then reports sorted records once. Ordinary on-demand link
  warnings still wait for exhaustive compilation. Unseen child-only and transient
  records can report after readiness. Tests observe collection before a gated
  rebuild and still prove that retired records never print.
- The captured attempt fences both streamed records and completed compilations.
  A newer attempt can start before the older worker finishes. Its old result
  cannot bypass the sink's generation check. Failed attempts never revive the
  previously accepted runtime's warning scope. An older worker failure also
  cannot flush a newer candidate's pending records before its own outcome.
- Main deduplicates the full diagnostic, including its message. The branch used
  code plus private context. Alias filtering stays at each stylesheet producer;
  normalization and invocation deduplication now use the full record. If a
  transient render changes the first alias named for one file, its changed
  message is a distinct diagnostic. This follows the approved main channel.
- Main's #142 browser test waits for the selected Dark previews before navigation.
  That replaces the branch's response wait after navigation. Its route and scheme
  assertions remain. The hydration fixture omits retired ownership fields, and
  the new packed-fixture README describes rendered-resource changes instead of
  removed shared-impact globs. Main's five retained package scenarios stay.
- Main's #137 evidence policy applies to new logs. The user's specific request
  keeps this short migration and path classification record in M30A; full
  command output and line ledgers remain under `.context/m30a/`.

Evidence and exact commands: `.context/m30a/report.md`. The preservation ledger
and merge inspections are retained in the same directory.

### Main-added line classification

Class (a) is an approved migration. Class (b) is moved or reworded content.
Every other main-added non-blank line remains in its path. The full line ledger
is `.context/m30a/main-lines-classified.json`. The omitted main build-warning
README section is restored; no loss remains. The only main-relative deletions
remain the four approved files listed in M28A.

| Path with absent main additions          | Class | Reason                                                                                                                                                                                                    |
| ---------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/protocol/mokly-build-warnings.md`  | a, b  | Extend the record with typed subjects and the branch producers. Retain main route output, strict behavior and secondary-compilation discard rules. Add the approved attempt fence and transient coverage. |
| `docs/protocol/mokly-terminal-output.md` | b     | The no-repeat and singular-count sentences remain, rewrapped beside the subject reference.                                                                                                                |
| `src/build/README.md`                    | a     | Add the approved non-page subject to the diagnostic record description. The omitted main Build Warnings section was restored in full.                                                                     |
| `src/build/build_warnings.ts`            | a     | Add producer codes and the exclusive route/subject union. Format and sort the location with a final kind tie-break; main route-only messages and order remain.                                            |
| `src/build/compile.ts`                   | a     | Normalize the combined configuration, registry, stylesheet and link-control diagnostics on main Compilation.diagnostics.                                                                                  |
| `src/build/document_compiler.ts`         | a, b  | Keep the main requested-document diagnostic list and add branch ignored-input records from renders needed for validation. The diagnostics type field moved to document_types.ts.                          |
| `src/cli/publish.ts`                     | a     | Report through the unified invocation sink before the unchanged strict boundary; prevent callback/result replay.                                                                                          |
| `src/cli/run.ts`                         | a     | Report through the unified invocation sink before the unchanged strict boundary; count and redact every producer.                                                                                         |
| `src/export/run.ts`                      | a     | Keep the injected compiler seam and signal, adding the branch callback to retain warnings on failed compilation.                                                                                          |
| `src/server/README.md`                   | a     | Keep once-before-Catalogue-ready reporting and main ordinary-preview suppression; document the approved failure, subject and transient coverage.                                                          |
| `src/server/reporter.ts`                 | a     | Keep the main reporter call with an optional unified sink and captured-attempt fence before catalogue readiness.                                                                                          |
| `tests/fixtures/consumers/README.md`     | a     | Migrate the removed shared-impact prose to the retained rendered-resource checks; keep main five-scenario inventory.                                                                                      |
| `tests/hydration_shapes.test.ts`         | a     | Remove retired declaredDependencies and ownedDependencies from main current-v8 fixture; all route-shape assertions remain.                                                                                |
| `tests/server_reporting.test.ts`         | b     | The BuildDiagnostic import, ServeReporter types and buildWarnings method live in server_reporting_fixture.ts, alongside the pre-existing extracted reporter.                                              |

## Milestone 31: Keep the branch name in exported navigation

Tags: ui

- [ ] Failure-first viewer and browser tests: in an exported catalogue, the
      temporary view during navigation shows "Compared with the branch point
      on <name>." when the export knows the name. An embedded catalogue
      without a name still shows no sentence. Pass the known name to the
      public-data fallback.
- [ ] Check that the viewer's excluded-only screen state matches the Milestone
      27 mockup at both widths, and fix any difference in the viewer.
- [ ] Run the viewer and browser tests, and smoke-test at both widths.

## Milestone 32: Verify, deliver and review

- [ ] Run `cargo xtask check` at 100%, inspect the diff and deletions against
      `origin/main`, and record the evidence.
- [ ] Run `git add -A`, commit with a Conventional Commit, and push the branch.
- [ ] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report numbered findings with
      severity, impact, lettered options and a recommendation, without
      changing the implementation.
