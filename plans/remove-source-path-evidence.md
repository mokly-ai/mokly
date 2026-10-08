# Remove Source-Path Evidence

Status: Active. Milestones 1 to 33 are implemented, verified and pushed.
Milestone 34 merges main `4bd0e78e`. The open review findings of Milestones 32
and 33 wait for the user.

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
    compare the files. The public-file policy rejects a symlink in any path
    component. Repeating one accepted regular file links it once at its first
    occurrence and warns.
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
    record identifies those links after link rewriting and through Review-ignore;
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
- The combined current formats are main's unreleased manifest v9, catalogue
  read model v5 and review result v6, with no extra version. Manifest v9 omits
  `dependencies`, `declaredDependencies` or `ownedDependencies`, and retains
  declared-stylesheet provenance, `assetClosure`, `generatedFiles` and
  `blobHashAlgorithm`. Baselines require canonical, valid v9 output with the
  same validation as current output. A lower integer canonical version is
  incompatible earlier output. Missing canonical generated metadata selects
  main's absence and own-recipe rebuild behavior. Former manifest names are
  ordinary files and never supply metadata or prove incompatibility. No schema,
  removed-field, variant or stored-layout conversion remains. Catalogue read model v5
  omits `details.dependencies`. Unified comparison result v6 omits result
  `sharedImpact` or entry `dependencies` and
  `sharedImpact`. All catalogues use that one classifier and format. Public
  readers reject catalogue v1 to v4 and comparison v5 and earlier; regenerate
  older exports. The process-local live index adopts the v9 entry shape.
  The unreleased versions retain this branch's CSS fields: v9 has an explicit root
  output range and no CSS resource owners; v6 has rule identity,
  changed component paths and page evidence; v5 carries the same public evidence
  on views and whole-document pages. Every accepted component saved view has its
  root range. Every persisted usage record has an `insertedStylesheets` array,
  including an empty array. V9 records with CSS owners, missing roots or missing
  provenance are invalid, including earlier output from this branch. Keep main's
  fixed pane paths and unchanged snapshot bytes. Incompatible earlier output
  makes Changes unavailable with the existing message while Build, Serve, export
  and publish succeed, and is never cached. Invalid v9 follows the existing
  invalid-baseline path.
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
- Upgrade `@mokly/viewer` in mokly-cloud to catalogue v5 and comparison v6,
  then re-export and re-publish stored catalogues.
- Migrate consumer catalogues such as Accounting: delete the three inputs,
  declare component CSS with `stylesheets` instead of `ownedDependencies` and
  route rules, and rebuild committed output once for manifest v9.

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

Evidence: `.context/remove-source-path-evidence/milestone-1.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-2.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-3.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-4.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-5.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-6.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-7.md`.

## Milestone 8: Verify, deliver and review

- [x] Search the repository, excluding historical plans, `docs/reviews/**` and
      `CHANGELOG.md`, for `ownedDependencies`, `declaredDependencies`,
      `sharedImpact`, entry `dependencies`, `useDesignStyle` and "impact
      evidence". Each remaining hit must describe the removal or be unrelated.
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

Evidence: `.context/remove-source-path-evidence/milestone-8.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-9.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-10.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-11.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-12.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-13.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-14.md`.

## Milestone 15: Verify, deliver and review the fixes

- [x] Merge `origin/main` at `3699c566` (#119, mokly-cloud logo). The merge had
      no conflicts and keeps all of #119's files.
- [x] Run `cargo xtask check` and require a 100% pass rate.
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

Evidence: `.context/remove-source-path-evidence/milestone-15.md`.

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
      `ReviewResultV4` and `ScreenReviewV4` exports to the new types. Keep `CHANGELOG.md` unchanged.
- [x] Run changed-file Prettier, the four requested docs suites, and the
      complete unit suite at 100%. For non-Markdown changes, also run build,
      typecheck, lint and every `cargo xtask check` step after the unit suite.
- [x] Record the dependency-audit blocker.
      This branch does not change dependencies or the audit. The reviewer
      accepted every other `cargo xtask check` step at 100% for the amend;
      remediation belongs to a separate change.
- [x] Amend the local merge with the restorations and audit. Confirm exactly
      two parents and review every amended remerge-diff path. Keep Milestone
      17 and second-review findings 2 to 11 unchanged.
- [x] Push the merge after the reviewer checks it.

The user chose main's pane contract for older layouts.

Four deletions and one fixture rename against main are approved:

- `docs/protocol/fixtures/catalogue-v3.json` → `catalogue-v4.json`: retain one current fixture.
- `examples/basic/entries/design/library/style_context.tsx`: replace the style collector with declarations.
- `src/components/dependency_validation.ts`: retire declared path validation.
- `src/registry/dependency_paths.ts`: retire source-path matching.
- `tests/design_library_style_collector.test.tsx`: retain its unique checks in the declaration tests.

Evidence: `.context/remove-source-path-evidence/milestone-16.md`.
Preservation audit: `.context/remove-source-path-evidence/m16-preservation-audit/`.

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

Evidence: `.context/remove-source-path-evidence/milestone-17.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-18.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-19.md`.

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
- [x] The reviewer pushes the branch after checking the local merge.

Evidence: `.context/remove-source-path-evidence/milestone-19a.md`.

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
- The per-file list, copy and spacing match the M18 cards and the two
  component stories. Two older differences remain outside M20: the explorer
  mockup's Change, Saved variant and Saved props rows and its "Changed
  components used here" heading, where the shell shows "Changed component:"
  links. Both predate M18 (#48).

Evidence: `.context/remove-source-path-evidence/milestone-20.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-20a.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-20b.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-21.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-22.md`.

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
- The frozen key domains, generated-header recognition, legacy manifest names
  and historical manifest normalization stay unchanged.

Milestone 23 is implemented and verified under the approved timing-flake retry
rule. Delivery is one local commit; the reviewer owns the push. Milestone 24
has not started.

Evidence: `.context/remove-source-path-evidence/milestone-23.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-23a.md`.

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

Main's baseline compatibility tests are restored with v8 as current and v9 as
newer. The generated-header recognizers, frozen key domains and removed-field
authoring warnings are unchanged. M23's marker regressions remain in place.
The code and README status notes now mark M23B implemented. M24 stays pending.

Milestone 23A is delivered as local commit `26473dc1`. Milestone 23B is
implemented and verified under the approved timing retry rule, with one local
code commit. The warning-test cleanup repair above is the only added task.
No push or implementation review is performed. Milestone 24 has not started.

Evidence: `.context/remove-source-path-evidence/milestone-23b.md`.

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
- The
  standalone document's `data-mokly-base` attribute is not displayed text, and
  only served and exported documents carry it. The `ShellContext.base` doc
  comment now says that an empty name means unknown.
- Serve and export render the routed screen and saved view from a private
  workspace with the shell's name, so they keep the sentence. A workspace that
  a served or exported shell builds from public data has no name. In a
  standalone export, client navigation shows that public fallback until the
  destination's inert workspace loads. Before this change
  the fallback showed “Compared with the branch point on .”; `main` has the
  same fallback. This milestone leaves the fallback unchanged and reports it.
- No mockup shows an embedded catalogue's Details, so no mockup changes.

Evidence: `.context/remove-source-path-evidence/milestone-24.md`.

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
`.context/review2/`.

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

Evidence: `.context/remove-source-path-evidence/milestone-25.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-26.md`.

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
- Shell navigation sorts folders before leaves, so the outer catalogue lists
  the two child folders before Document page styles. The Appearance and
  Component explorer groups follow the same documented rule.

Evidence: `.context/remove-source-path-evidence/milestone-27.md`.

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
      adding public output fields.

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
- One-sided normalization moves to `component_projection_resources.ts`.
  The non-CSS root resource check moves to `component_resource_attribution.ts`.
  Both keep their behavior. The unused one-sided `page` value remains for
  Milestone 29. Every changed TypeScript file stays below 300 lines.

Evidence: `.context/remove-source-path-evidence/milestone-28.md`.

## Milestone 28A: Integrate `main` #131 and #133

Merge `main` at `60d48370` before the remaining work, as the user decided later
on 2026-10-05.

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
- [x] The reviewer pushes the branch after checking the local commit. The review of the complete
      diff against `origin/main` runs once, in Milestone 32.

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
They are not former entry identities.

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
  added here, although M30 also names that guard.
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
88 are light-only and 26 have both schemes.
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
specs.

### Open review items

1. Low: the comparison example inherits a required variant description from
   its manifest `Pick`, but the public comparison type makes that description
   optional. Main already has this mismatch.
2. Medium: a cold document can arrive after the existing five-second frame
   adapter deadline.

The user decides the scope of these review items. They do not claim a completed
post-push implementation review; the reviewer still owns that step.

Evidence: `.context/remove-source-path-evidence/milestone-28a.md`.

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

M29 is implemented and verified under the approved audit fallback and timing
retry rules. Delivery is one local commit. The branch is not pushed.

Evidence: `.context/remove-source-path-evidence/milestone-29.md`.

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

Evidence: `.context/remove-source-path-evidence/milestone-30.md`.

Later on 2026-10-06 the user directed the agent to continue after the system
shutdown. Commit the resolved `f52303cb` merge after the focused tests, then
merge `24c97311` separately. Accept #146's in-range dependency updates and
#147's review-fix rule and deletion of the 33 review records. Apply #137 to
this plan: move its evidence to `.context/remove-source-path-evidence/` and
keep its decisions, contracts, TODOs and short review summaries. Update the
Milestone 32 review TODO to #147. Run the complete unit suite, the full gate
and the original smoke checks on the final tree. Do not push or start
Milestone 31. The new review rule supersedes the earlier instruction to report
all findings without fixing them.

Later on 2026-10-06 the user authorized the two gate repairs as a separate
local commit and a third two-parent merge of the latest `main`, now
`6bf62517` (#148, #149 and #150). Keep main's local test concurrency and
shared example-server setup, and port branch tests where needed. Then run
build, typecheck, lint and focused warning, Serve, export and #148 checks.
Stop after those checks. Do not run the complete unit suite or full gate
until the user answers the unwatched Serve fixture question. Do not apply,
change or remove that fixture test while the answer is pending. Do not push.

## Milestone 30A: Integrate `main` #124, #140 and #141

Merge `main` at `80ceb445` before Milestones 31 and 32.

On 2026-10-06 the user approved option A: the first test in `tests/build_warning_serve.test.ts` gets its own Git repository through `createExportFixture`, with all assertions and time limits unchanged.

- [x] Use the approved Git fixture, repeat the test alone and with concurrency three, audit similar fixtures without changing them, and complete the final checks and smoke tests.
- [x] Audit main's additions from the source tip, merge `origin/main` with
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
- [x] Run `cargo xtask check` at 100%, including the dependency audit. Inspect
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
- [x] Commit the checked merge locally with exactly two parents. The reviewer
      owns the push and the later review. Do not start Milestone 31.
- [x] Merge `origin/main` at `24c97311` as a second two-parent merge. Preserve
      #146's dependency updates and #147's approved review-record deletions.
      Review every remerge path and every main-added line since `f52303cb`.
- [x] Move this plan's evidence to `.context/remove-source-path-evidence/`,
      one file per milestone or merge. Keep every TODO, contract, dated
      decision, user approval and short review summary. Validate the Markdown
      and commit this work separately with `docs(plans)`.
- [x] Update Milestone 32's review TODO to the new review-fix rule in `AGENTS.md`.
- [x] Keep `src/export/run.ts` within 300 lines by moving baseline preparation
      into the existing export inputs module. Preserve cancellation and
      incompatible-baseline behavior, then run the export checks.
- [x] Keep the reporter's existing `ServeShortcuts` export in use after the
      shutdown-helper extraction, then run the repository checks.
- [x] Merge the latest `origin/main` as a third two-parent merge. Preserve
      #148's test concurrency and example servers, #149's design snapshot
      deletion and #150's dependency policy cleanup. Review every remerge
      path and every main-added line since `24c97311`.
- [x] Remove only the docs exceptions for #149's deleted snapshot. Prove the
      stale exceptions fail the existing guard, then run it again.
- [x] Run build, typecheck, lint and focused export and #148 checks on the
      third merge, including the parallel route hydration tests.
- [x] Complete the focused warning and Serve checks after the user's fixture
      decision, then run the complete suite and gate with the approved fixture.
- [x] Push the branch after the reviewer checks the local merge. The reviewer
      checked the merges and the fixture change and pushed `b9d49f13`.

### Integration decisions

As in M28A, this merge
preserves the fetched additions: #137 keeps new evidence logs outside plans,
#142 covers hydration by route shape, and #143 removes the Juno consumer smoke.
The two extra
fixture conflicts accept main's Juno deletion.

The third merge keeps main's #148 test concurrency and one example server per
Playwright worker. The branch's owned preview build child stays. Main's #149
deletion replaces the branch's retained dated design snapshot; only that
snapshot's three docs exceptions leave the allow list. Main's #150 removes
one-time dependency update notes and keeps the active security choices.

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
  records can report after readiness.
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

Evidence: `.context/remove-source-path-evidence/milestone-30a.md`; `.context/remove-source-path-evidence/third-merge-evidence.md`; `.context/remove-source-path-evidence/fixture-approved-evidence.md`.

## Milestone 30B: Integrate `main` #145, #151, #152 and #134

`main` moved to `dc56e3d4` after Milestone 30A. #145 makes `.mokly-cache`
ignore itself, #151 pins npm 11.21.0, #152 replaces wall-clock test limits with
deterministic checks, and #134 makes a browser test wait for panel scrolls to
rest. A trial merge gives two conflicts. Merge it before Milestone 31, so that
the remaining work uses main's deterministic tests.

- [x] Audit main's additions from the source tip, merge `origin/main` with
      exactly two parents, resolve conflicts path by path and review every
      remerge-diff path.
- [x] Compare every line that main added since `6bf62517` with the merged tree.
      Classify each absent line as an intended migration, a move or a loss,
      and restore every loss before the push.
- [x] Port this branch's tests that use wall-clock limits to #152's
      deterministic checks where #152 replaced the same kind of limit.
- [x] Keep the merged protocol index within 250 lines. Move its format table
      to the catalogue contract and keep the same version assertions there.
- [x] Run `cargo xtask check` at 100%. Inspect the diff and the deletions
      against `origin/main` and record the result.
- [x] Push the branch after the reviewer checks the local merge. The reviewer
      checked the merge and pushed `1c808080`.

The merge keeps the existing preview-test split and main's changes to those
tests. The protocol index links to the unchanged format table in the catalogue
contract. Other short waits remain unchanged for a separate user decision.
The evidence file lists those waits and the recommended follow-up.

Evidence: `.context/remove-source-path-evidence/milestone-30b.md`.

## Milestone 31: Keep the branch name in exported navigation

Tags: ui

- [x] Failure-first viewer and browser tests: in an exported catalogue, the
      temporary view during navigation shows "Compared with the branch point
      on <name>." when the export knows the name. An embedded catalogue
      without a name still shows no sentence. Pass the known name to the
      public-data fallback.
- [x] Check that the viewer's excluded-only screen state matches the Milestone
      27 mockup at both widths, and fix any difference in the viewer.
- [x] Run the viewer and browser tests, and smoke-test at both widths.
- [x] Hold the destination's data read in the browser test, and record the
      first Details paragraph after every DOM change. The sentence must not
      leave and return when the data arrives.
- [x] Check a nameless embedded catalogue after navigation too, through the
      existing embedded viewer harness at both widths.
- [x] Update the READMEs near the changed code, the Details guide and both
      Delivery Status notes.
- [x] Run build, typecheck, lint, changed-file Prettier, the docs tests, the
      complete unit suite and the complete `cargo xtask check`. Inspect the
      diff and deletions against `origin/main`. Make one local commit; the
      reviewer owns the push.

Implementation notes:

- `workspaceData` passes the shell context's `base` to `publicWorkspace`,
  which no longer writes an empty name. After client navigation in an export,
  the temporary view names the export's branch point. Serve's temporary view
  keeps its name in the same way. `viewerContext` gives the embedded viewer an
  empty name, so embedded Details still omit the sentence.
- Before the fix, the new viewer test failed for the exported screen, the saved
  view and the fallback name. The page case passed, because a page reads the
  shell context directly. The new browser test failed at both widths: while the
  held read was pending, Details started with "No changes to this screen.". A
  copy without the held-state check failed on the paragraph record, which saw
  the sentence leave and return.
- The viewer's excluded-only state matched the M27 mockup at both widths. It is
  not in Changes, shows Unmodified, has no comparison toolbar or stage heading,
  and shows the mockup's Details card with its final line. The viewer needed no
  change. A browser test now checks the card text in order and the hidden
  comparison controls.
- The temporary view still omits "Changed component" lines until the
  destination's data loads, because the public catalogue has no affected
  consumers. This is outside M31 and is reported for the review.

Evidence: `.context/remove-source-path-evidence/milestone-31.md`.

## Milestone 32: Verify, deliver and review

- [x] Run `cargo xtask check` at 100%, inspect the diff and deletions against
      `origin/main`, and record the evidence. The original gate passed on the
      final code tree in Milestone 31; the initial Milestone 32 delivery
      changed only this plan.
- [x] Run `git add -A`, commit with a Conventional Commit, and push the branch.
- [x] Fix M32 finding 1 with option A. First capture moved screen and component
      failures with root and co-located CSS, same-depth and deeper routes,
      complete and fast comparison, Serve and export. Check every inserted-link
      resource caller and use each side's own document route.
- [x] Fix M32 finding 3 with option A. First capture missing-image and transform
      failures in Build, Check and background compilation. Forward adapter
      diagnostics through the existing callback. Keep sorted successful results
      and one warning per identity at the sink.
- [x] Align the relevant READMEs and protocols with these fixes. Run build,
      typecheck, lint, focused tests, the exact complete unit command and
      `cargo xtask check` at 100%. Fetch main without merging. Inspect the diff
      and confirm only the four approved files are deleted.
- [x] Run `git add -A` and make a local Conventional Commit that names both
      fixed findings. Do not push in this fix round; the reviewer checks and
      pushes the commit before the next review.
- [x] Capture re-review finding 1 before the fix: moved components with removed
      and added Dark views, moved screens with removed Dark views, the same
      edits without moves, and moves without scheme changes. Cover both
      comparison paths, Serve and export, with and without declared CSS.
- [x] Apply re-review option A: group each compared view with the matching
      side of its variant pair. Keep the complete view union and each side's
      original document route. Clarify the README and protocol if needed.
- [x] Resolve the downstream catalogue projection blocker found by the
      required controls: a current variant with removed Dark views receives
      a `removed` comparison state. Apply the approved projection fix and audit
      every other current-entry projection. Keep raw aggregate precedence and
      per-view states unchanged. Keep the reader and every failing control.
- [x] Run build, typecheck, lint, focused tests, the exact complete unit
      command and the complete `cargo xtask check` at 100%. Fetch main without
      merging. Inspect the diff and the four approved deletions. Record evidence.
- [x] Run `git add -A` and make one local Conventional Commit that names
      re-review finding 1 (M32). Do not push. This is the last fix round;
      stop after its report and do not run a third review.
- [x] After the push, use `docs/implementation-review-prompt.md` to review the
      complete diff against `origin/main` and report findings. Keep the review
      read-only. Then apply the General review-fix rule in `AGENTS.md`: fix
      `Auto-fix: yes` findings, run checks, commit, push and re-review once.
      Fix new `Auto-fix: yes` findings once more, then stop and report the rest.
      Ask the user for findings tagged `Auto-fix: no`. Add each open finding
      as one line under this TODO. Keep reports and evidence under `.context/`.
      Both reviews are complete. The final fix stays local as instructed;
      no third review follows it.
  - [ ] M32 finding 2 (Medium): foreign-namespace links can suppress required CSS. Recommend B: use one namespace-aware rule, after the user decides the provenance boundary.
  - [ ] M32 finding 4 (Low): control characters in config filenames can make ignored-field warnings fail. Recommend B: retain the path as data and encode controls for display.
  - [ ] M32 finding 5 (Low): the watch contract restores the retired `entries` input. Recommend B: correct the text and extend the existing docs guard with the exact obsolete claim.
  - [ ] Earlier timing item: `tests/browser/css_evidence_page.ts` uses a 1-second inner visibility wait within a 15-second retry. Keep it pending; recommend explicit events or an approved I/O allowance change.
  - [ ] Earlier timing item: `tests/current_baseline_commands.test.ts` uses 200 polls with 25 ms pauses for unavailable Changes. Keep it pending; recommend explicit events or an approved I/O allowance change.
  - [ ] Earlier timing item: `tests/current_baseline_invalid.test.ts` uses 200 polls with 25 ms pauses for invalid baselines. Keep it pending; recommend explicit events or an approved I/O allowance change.
  - [ ] Earlier timing item: `tests/former_marker_baseline.test.ts` uses 200 polls with 25 ms pauses for invalid ranges. Keep it pending; recommend explicit events or an approved I/O allowance change.
  - [ ] Earlier timing item: `tests/watch_stylesheet_order.test.ts` uses 500 polls with 10 ms pauses for watcher startup. Keep it pending; recommend explicit events or an approved I/O allowance change.
  - [ ] Earlier timing item: `tests/helpers/warning_generations.ts` uses a 5-second renderer subprocess timeout. Keep it pending; recommend explicit events or an approved I/O allowance change.
  - [ ] Earlier cold-preview item (Medium, also on main): inspection can expire before a cold document arrives. Recommend separate preparation and adapter-readiness budgets with delayed-response tests.
  - [ ] Earlier schema example item (Low, also on main): variant description is required in the example but optional in the comparison type. Recommend correcting the example and extending its compiler-backed check.
  - [ ] Earlier exported-view item: temporary navigation omits "Changed component" lines until destination data loads. Recommend a separate decision on public affected-consumer evidence.
  - [ ] Earlier mockup item: mockups show a "Catalogue home" crumb that the viewer omits. Recommend a product decision on the shared navigation contract before changing either side.
  - [x] Main advanced to `f8ab241f` with #160, #156 and #144 during the final fetch. Milestone 33 integrates it, as the user asked on 2026-10-07.

Evidence: `.context/remove-source-path-evidence/milestone-32.md`.
Fix-round evidence: `.context/remove-source-path-evidence/milestone-32-fixes.md`.
Final fix-round evidence: `.context/remove-source-path-evidence/milestone-32-final-fix.md`.

On 2026-10-07 the reviewer approved the current-entry projection correction as
part of re-review finding 1, because the catalogue delivery contract settles it. Raw aggregates retain their existing precedence. A
current entry's aggregate `removed` comparison projects as `changed`; its
per-view states stay unchanged. The projection defect also exists on main.
Keep all controls, complete the full checks, and make one local commit. Do not
push or run a third review.

On 2026-10-07 the user asked to merge the latest `main` after Milestone 32 and
to delegate the merge to Codex Sol 6.1 at maximum effort. `main` moved to
`f8ab241f` with #160 (the complete gate on Blacksmith Testboxes), #156
(simplified generated output and delivery) and #144 (CSS Modules ignore source
maps). #156 is a breaking change: generated files live in
`<mockupsDir>/mokly-generated/`, only Build, `build --watch` and `serve --build`
write them, the `generatedOutput`, `publicExclude` and `compatibility` options
and the output ownership headers are removed, and the unreleased formats are
manifest v9, catalogue read model v5 and review result v6. As the user decided
on 2026-10-05 for the same situation, the merged branch keeps main's unreleased
format numbers and adds no version: they carry main's records and this branch's
records together.

On 2026-10-07 the reviewer resolved two conflicts of meaning in the Milestone
33 merge under the user's instruction to merge the latest `main`. Both follow
#156. First, declared component stylesheets follow main's public-file policy:
a public path with a symlink in any component is refused, so symlinked
stylesheet aliases and renderer alias links are no longer accepted. Second,
baseline preparation follows main's canonical-only rule: former manifest
names are not sentinels; a base without the canonical manifest follows main's
absence and rebuild behavior. The 2026-10-04 decision returned the branch to
main's baseline rule; main has since changed that rule, and the branch
follows the new one. The user may still choose otherwise.

## Milestone 33: Integrate `main` #160, #156 and #144

Merge `main` at `f8ab241f` (or the latest `main` at merge time).
The user directed implementation to continue with main's rules for both
conflicts. No push or post-push review is part of this task.

The required later fetch advanced main to `6bb64219`, adding #159 (in-range
lockfile updates), #154 (installed renderer-contract type checking) and #157
(baseline-relative audits and daily dependency update requests). The single
merge includes that audited descendant. Its original source tip and
merge base stay unchanged. The final second parent is latest main.

The next required fetch advanced main to `2013d289`. It also adds #139
(attribution test consolidation), #155 (targeted developer tests), #162
(the review rule for flaky tests in the diff) and #161 (plan history and plan
link validation). Their changes stay in the same two-parent merge. Main's
targeted development commands apply. This task's explicit separate complete
unit command still runs before the complete gate.

After the system shutdown, the user directed a separate second merge of latest
main, now `acac1c73`. It adds #164 (remote verification fixes), #165 (the
deterministic real SIGINT test), #167 (the Node 24 shared example copy fix) and
#168 (clean-checkout Publish). The first merge's package fixture fixes are
amended with its two parents unchanged. The second merge keeps main's fixes
and removes the duplicate copy cleanup where both sides cover the same input.
Development now follows the current targeted-test commands and early repository
suite. The complete gate supplies final unit and browser verification; no extra
standalone complete unit run is required. A final fetch reports any later main
movement without another merge. The branch stays local.

- [x] Amend the first merge with the three pending package/plan changes.
      Confirm its two captured parents and review the changed remerge paths.
- [x] Audit and merge latest main after `2013d289` as a second two-parent
      merge. Resolve every path, preserve #164/#165/#167/#168, review all remerge
      paths, and classify every main-added nonblank line. Remove the duplicate
      Node 24 copy cleanup while retaining main's fix and all controls.
- [x] Preserve #168 on clean committed inputs. Migrate Publish fixtures while
      pinning their earlier comparison refs; keep warning, CSS, move, baseline,
      strict and cancellation assertions and all test allowances.
- [x] Add one exact docs-guard exception for Publish’s Git porcelain v1 argv.
      Keep the incoming statement and the fail-closed scanner unchanged.
- [x] Align clean-Publish docs and release notes. Keep ordinary archive preview
      capture, plain memory Serve/export and the combined 9/5/6 records.
- [x] Run the early repository suite and targeted changed-area tests at 100%.
      Then run the complete gate once on the final tree; rerun only failed
      files or suites before a new complete gate. Report unrelated flaky tests.
- [x] Fetch main for the final diff check without another merge. Record any
      later movement and verify the four approved deletions.

- [x] Preserve the added #139, #155, #162 and #161 changes. Keep grouped
      attribution checks and their single-change control, with this branch's
      own-page CSS rule and saved-view evidence. Preserve source-edit and
      committed-baseline checks at their new owners. Keep the new test commands
      and plan-link checks. Resolve every incoming path separately.
- [x] Restore optional CSS traversal only after a verified deletion, and the
      controls README's ordinary link rewriting description. Keep all deleted,
      missing-baseline and unsafe-resource assertions.
- [x] Remove `src/html_links.ts`'s unused `stylesheetLink` export. Its only
      callers validated transformer tokens. Keep the shared active link finder
      and rel-token recognition. Repeat the export ratchet and link controls.
- [x] Migrate the packed component smoke's generated document path and CSS
      href depth in `scripts/package/components.mjs`. Keep all installed API,
      provenance, root, source-coordinate, Props and export assertions. Repeat
      the package suite and complete gate after the captured failure.
- [x] Migrate `scripts/package/consumer_cases/themed.mjs`'s review version
      assertion to v6. Keep independent upload, ownership, Plan and catalogue
      versions, all exact change/evidence assertions and all five consumer cases.
- [x] Migrate the remaining CSS-owner alias fixture, newer-schema mutation,
      shell generated URLs, unconditional document-read expectation and Watch
      writer setup. Keep refusal controls, assertions and test allowances.
- [x] Move this branch's six Milestone 16 audit records from
      `plans/remove-source-path-evidence-audit/` to the Git-ignored
      `.context/remove-source-path-evidence/m16-preservation-audit/` with
      identical bytes, under the user's 2026-10-07 decision. Main #137 and #147
      require audit evidence outside the repository. Keep main's full link
      check and add the new location beside Milestone 16's evidence line.

- [x] Preserve the added #159, #154 and #157 changes. Resolve their one index
      conflict at the existing protocol owner. Keep the new dependency and
      renderer checks. Refresh installed packages from the incoming lockfile
      and repeat all required checks on the final tree.
- [x] Preserve renderer CSS resource declarations as private public-closure
      seeds while ignoring CSS ownership and attribution. Repeat main's full,
      requested, Serve, Watch and public-file safety controls. Add no CSS owner
      or inserted-link record for an unlinked renderer assertion.
- [x] Fix the deterministic Node24 shared example copy failure. Remove only
      the newly owned empty destination before copying. Keep no-overwrite flags,
      isolated copies, warm-cache validation and every test allowance.

- [x] Apply main's public-file rule to declared CSS and renderer links. Keep
      all five alias tests and assert the exact symlink refusal. Remove alias
      acceptance from the stylesheet, link and provenance contracts. Record
      each changed test and doc below.
- [x] Apply main's canonical-only baseline preparation. Migrate former-name
      sentinel controls to absence and rebuild cases. Keep main's former-name
      rejection tests and strict current-shape validation. Record each changed
      test and doc below.
- [x] Fix accepted-compilation reuse. Exclude derived
      `componentStylesheetPaths` from `configKey`, as for `sourceFiles`.
      Audit every other derived config field that registry preparation adds.
      Keep the captured failing regression and verify it passes after the fix.
- [x] Finish fixture migrations, the fail-closed docs allowlist, exact protocol
      size caps and Markdown checks. Preserve assertions and test allowances.
- [x] Keep inserted-link resource membership out of raw CSS material/state
      fallback. Retain unconditional reads and the existing byte-only fallback
      for CSS linked on both actual sides when Git evidence is absent. Keep
      rule evidence, projection-only CSS filtering, root/authored links and
      non-CSS behavior. Repeat the import, declaration-only and full/fast controls.

- [x] Audit main's additions from the source tip, merge `origin/main` with
      exactly two parents, resolve conflicts path by path and review every
      remerge-diff path.
- [x] Combine the formats: main's unreleased manifest v9, catalogue read model
      v5 and review result v6 carry this branch's records (component
      stylesheet declarations, inserted-stylesheet provenance, root output
      ranges, per-rule CSS evidence and page resource evidence). Record each
      renamed field or message and every conflict of meaning here.
- [x] Port this branch's behavior to #156: generated output, in-memory Serve
      and export, the asset closure and the removed compatibility transformer
      and ownership headers. Remove this branch's code, tests and docs that
      exist only for the removed transformer or headers, and record each
      removal here as an intended migration.
- [x] Compare every line that main added since `dc56e3d4` with the merged tree.
      Classify each absent line as an intended migration, a move or a loss,
      and restore every loss before the push.
- [x] Run build, typecheck, lint, example build/check, docs tests, main's new
      tests and the branch's focused tests. The earlier exact complete unit
      command passed; under the shutdown continuation, the complete gate
      supplies final unit/browser verification. Keep assertions and allowances.
- [x] Smoke-test `npm run dev` and the CLI at 390 and 1440 px. Cover Build,
      Check, component-only and screen CSS rules, a moved component, exported
      Details, a removed-field warning and `build --strict`. Save Chrome
      screenshots under `.context/`. Restore every temporary edit.
- [x] Run `cargo xtask check` at 100%. Inspect the diff and the deletions
      against `origin/main` and record the result.
- [x] Run `git add -A` and make the checked local merge commit. Confirm both
      captured parents. Review every remerge path with `GIT_NO_LAZY_FETCH=1`.
      Amend any restoration, keep both parents and review again.
- [x] Push the branch after the reviewer checks the local commits. The
      reviewer checked both merges, the loss audit, the gate reports and the
      smoke screenshots, and pushed `d1414026`.
- [x] Merge the docs-only main changes #169 (`fa8be322`) and #163
      (`4727cecc`). Neither merge has a conflict. Each merge has exactly two
      parents and an empty remerge diff, and no main line is lost. Evidence:
      `.context/remove-source-path-evidence/m33-main-docs-merges.md`.
- [x] After the push, use `docs/implementation-review-prompt.md` to review the
      complete diff against `origin/main` and report findings. Keep the review
      read-only. Then apply the review-fix rule in `AGENTS.md`: fix
      `Auto-fix: yes` findings, run checks, commit, push and re-review once.
      Fix new `Auto-fix: yes` findings once more, then stop and report the
      rest. Ask the user for findings tagged `Auto-fix: no`. Add each open
      finding as one line under this TODO. Keep reports and evidence under
      `.context/`. Both reviews are complete. The re-review has no
      `Auto-fix: yes` finding, so no third review follows.
  - [ ] M33 finding 1 (Medium, performance): renderer resource checks build a new public-file policy per view, so the work grows with views times sources. Recommend A: reuse the compilation's policy.
  - [x] Fix M33 findings 2 and 3 with approved option A. Capture the placement-warning failure, preserve sorted successful diagnostics and one callback delivery, correct the live closing status, run targeted checks and the complete gate, and make local commits. The reviewer owns push and one re-review.
  - [ ] M33 re-review finding 1 (Low, product bug, large): failed on-demand and temporary-props previews in Serve drop their stylesheet-placement warnings. Recommend B: stream foreground worker warnings through the generation-tagged warning record, as background workers do.

### Approved migrations

Both conflicts follow the new dated decision above. Main rejects public
symlinks and prepares baselines only from canonical metadata. No unresolved
conflict of meaning remains from those two cases.

Alias refusal tests remain in these five files. Regular-file controls remain.
Each file asserts the main error where the symlink enters the public boundary:

- `tests/component_stylesheet_edges.test.ts`: shared declarations and renderer links.
- `tests/component_stylesheet_link_scope.test.ts`: authored body-link order and reuse.
- `tests/component_stylesheet_provenance_part2.test.ts`: authored link material and inserted-link separation.
- `tests/component_stylesheet_validation.test.ts`: declaration deduplication, live preparation, configured links and ignored renderer records.
- `tests/component_stylesheet_graceful.test.ts`: valid repeated files and refused symlink duplicates.

Alias contracts change in `docs/protocol/mokly-component-stylesheets.md`,
`mokly-stylesheet-links.md`, `mokly-component-stylesheet-ownership.md` and
`mokly-source-protection-acceptance.md`. The same boundary is in
`docs/guides/authoring/components.md`, `src/components/README.md` and
`src/build/README.md`. Query/fragment reuse,
active body links, marker placement, root retention and Review-ignore spans
keep their meaning for accepted regular files.

Former-name controls change in `tests/current_baseline_contract.test.ts`,
`tests/current_baseline_commands.test.ts`,
`tests/helpers/current_baseline_fixture.ts` and `tests/private_metadata.test.ts`.
Missing canonical metadata selects a real current-format rebuild. Former files
supply no metadata and their contents are never read. Main's former-name
rejection tests remain. The matching current rules are in
`docs/protocol/mokly-baseline-compatibility.md`, `mokly-generated-manifest.md`,
`mokly-derived-baselines.md`, `mokly-baseline-storage.md`,
`mokly-baseline-addressing.md` and `src/baseline/README.md`.
`docs/protocol/npm-release-notes.md` names both approved breaking migrations.

Transformer/header removals are intended migrations. Remove the branch-only
`src/build/transformed_view.ts` and `tests/component_stylesheet_tokens.test.ts`.
Remove transformer-only cases from `component_stylesheet_provenance.test.ts`,
`component_stylesheet_link_scope.test.ts`, `component_stylesheet_link_validation.test.ts`,
`build_warning_background.test.ts` and `build_warning_failures.test.ts`.
Main's transformer/header modules and tests stay removed. Token handling,
transform diagnostics and owner pruning after transforms have no remaining
runtime. Final spans, root links, ignored-link discovery, early missing-resource
diagnostics and non-CSS ownership remain tested.
The standalone `stylesheetLink` predicate also leaves `src/html_links.ts`:
only the removed transformer-token checks used it. The active shared finder
retains stylesheet rel-token parsing.

The combined types are `ManifestV9`, `ScreenReviewV6` and `ReviewResultV6`.
The public catalogue stays v5. Existing stylesheet declarations, inserted spans,
root ranges, rule keys, changed component paths, page selectors/evidence and
page resource evidence retain their names. Main's closure, file inventory and
blob algorithm join those records. No extra version or converter is added.
The format table stays at its M30B owner with the current 9/6 numbers.
Renderer CSS resource declarations retain private closure seeds even when their
ownership is ignored. They add no owner, inserted span or source-path evidence.
The early renderer-resource refusal keeps main's component-resource message,
path and symlink cause. The new unlinked-owner test uses that exact message.
Docs splits preserve content and lower exact caps. The fail-closed guard updates
its exact exceptions without a whole-file bypass.

Further fixture migrations are in `tests/component_css_owner_filter.test.ts`
(regular duplicate control and exact alias refusal), `component_manifest.test.ts`
(current v9 and rejected v10), `shell_views.test.ts` (generated URLs),
`server_changed_resource_validation.test.ts` (main's four document reads),
`watch_config.test.ts` and `watch_stylesheet_order.test.ts` (explicit writers).
The controls README again names ordinary link rewriting. Verified deleted CSS
remains eligible for Changes without weakening missing or unsafe resource checks.

The incoming grouped attribution checks live in
`tests/component_design_attribution.test.ts` and `design_library_attribution.test.ts`.
Their helpers, pure projection fixture and source-edit fixture use the combined
CSS records and rendered-resource reasons. All 69 saved variants remain checked;
Tag picker Empty and Metadata row Code have no match for their rule and remain
unchanged. Direct entry reasons use kept root matches. View reasons retain the
full rendered document, including nested changed components. The source edits
and committed baseline batch checks move to main's separate files. Independent
branch CSS controls remain. The design protocol and example library README name
these grouped checks and the component stylesheet declarations.

Main's developer-test, flake and history policies remain. The protocol index
keeps its new test links. The documentation policy's exact milestone definition
has one reviewed docs-guard exception. No cap increases or whole-file bypasses
are added. The live scope and non-blocking consumer follow-ups now name the
combined 9/5/6 formats and adopted baseline/public-file rules. Earlier dated
paragraphs and completed milestone text remain unchanged.

The user resolved the history-link question by moving the six branch-only
Milestone 16 audit records to `.context/remove-source-path-evidence/m16-preservation-audit/`.
They are evidence logs under main #137 and #147, not the other historical plans
that the task protects. Their bytes remain unchanged. No permalink patch is
applied. The old directory is removed with `git rm`; it is absent from main,
so this adds no main-relative deletion. Milestone 16 names the new location.

The second merge keeps #168’s clean-checkout and committed-generation rules.
The warning and baseline fixture migrations prepare committed current inputs
while keeping the earlier comparison ref fixed. Their assertions remain.
Clean-Publish wording applies to the CLI; ordinary repository preview capture
keeps its no-Git rule. The old “Only Check” index claims now include Publish.
One exact docs-guard exception admits Git’s porcelain v1 status argv. Main’s
#167 copy cleanup appears once. No unresolved conflict of meaning remains.

All authorized local work is complete. The two separate merges retain their
captured two-parent history. The latest integrated main is `acac1c73`; the final
fetch found no later commit. Preservation checks retain every required main
addition or classify its approved migration or move. Only the four approved
files are deleted against main. No unresolved merge meaning conflict remains.
The reviewer pushed `d1414026` and then the review fixes. Later docs-only merges
integrate main #169 and #163. The re-review is complete; its open finding waits
for the user.

Evidence: `.context/remove-source-path-evidence/milestone-33.md`.

Review-fix evidence: `.context/remove-source-path-evidence/milestone-33-fixes.md`.

## Milestone 34: Integrate `main` #171, #172 and #176 to #178

On 2026-10-08 the user asked to merge the latest `main` into the branch,
resolve the conflicts, commit and push. Main `4bd0e78e` adds #171 (the agent
rules split into `docs/dev`), #172 (Serve keeps the checked closure on reload),
#178 (the Rust 1.95.0 pin), #177 (Testbox SSH closes before cleanup) and #176
(in-range dependency updates).

- [x] Capture the source tip `7b08f824`, the merge base `4727cecc` and main
      `4bd0e78e`. Audit main's 80 changed files.
- [x] Merge main as one commit with exactly two parents. Resolve
      `src/server/http.ts`, `README.md` and `docs/protocol/README.md` path by
      path, and review the remerge diff of every path.
- [x] Run the line-level loss check. Every main-added line is present, except
      one line moved to `docs/protocol/verification-protocol-index.md` and one
      line reformatted inside the branch's call.
- [x] Keep the branch's rules for main's new text: add exact docs-guard entries
      for the `docs/dev` rule statements, and move main's plan link in
      `xtask/README.md` into a Delivery Status section. Keep
      `src/server/http.ts` under the 300-line limit with one shared factory.
- [x] Run build, typecheck, lint, the targeted tests,
      `cargo xtask check --suite repository` and the complete
      `cargo xtask check` at 100%.
- [x] Inspect the diff and the deletions against `origin/main`; only the four
      approved files may be deleted. Commit, push, and add the merge decisions
      to the PR description.
- [ ] After the push, use `docs/implementation-review-prompt.md` to review the
      complete diff against `origin/main` and report findings. Keep the review
      read-only. Then apply the review-fix rule in `docs/dev/review.md`: fix
      `Auto-fix: yes` findings, re-review once, and report the rest. Add each
      open finding as one line under this TODO.

Evidence: `.context/remove-source-path-evidence/milestone-34.md`.
