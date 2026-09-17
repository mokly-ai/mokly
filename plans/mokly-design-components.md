# Reuse Registered Components In Mokly's Design Catalogue

## Outcome And Status

Status: completed and verified; review follow-ups are recorded for the user's decision.
Give Mokly's own design screens real shared component pages, saved
variants, local controls, generated usage and reliable change attribution.

Contracts:

- [Adoption and ownership](../docs/protocol/mokly-design-components.md)
- [Component inventory, inputs and variants](../docs/protocol/mokly-design-component-library.md)
- Existing [design navigation](../docs/protocol/mokly-design-links.md),
  [shell design](../docs/protocol/mokly-shell-design.md),
  [component authoring](../docs/protocol/mokly-components.md) and
  [change attribution](../docs/protocol/mokly-component-changes.md)

## Baseline And Boundaries

- The current manifest has 56 design screens (14 Browse, 10 Changes/review,
  32 component explorer/inspection/controls), 112 light-only design fragments,
  and zero registered component instances in those artboards. The separate
  Example Action and Toolbar already prove the public component API.
- Existing `parts/` and `components/parts/` already share React markup. Adopt
  those implementations and consolidate duplicate framing instead of writing
  standalone component lookalikes. All existing screen ids/routes remain.
- Add 15 components under `Design → Shared components`, grouped into Chrome,
  Controls, Inspector and Preview. Use flat public registration; the nested
  authoring marker currently cannot contain a component entry.
- Keep whole-screen scaffolds, scenario composition, miniature subject screens
  and fixture content separate. Explicit data and slots preserve screen-owned
  changes and useful highlighting. Initial adoption preserved both presentations;
  milestone 9 supersedes that baseline with the requested icon-only cleanup.
- This is consumer/mockup work under `examples/basic`, not a rewrite of the
  actual package shell. No new dependencies or package API are required by the
  inspected design. UI/mockup milestones below contain no backend work.
- If implementation reveals a missing runtime capability, add a new backend
  milestone immediately after the active tagged milestone, then a new tagged
  mockup milestone immediately after it. Move blocked TODOs to that new mockup
  milestone without checking them off; do not insert backend tasks into an
  existing mockup milestone or reopen a completed milestone.
- Preserve mainline features. Before integrating main, fetch and capture the
  source tip, audit main's additions from its merge base, resolve conflicts
  individually, and inspect deletions before and after the integration commit.

## Milestone 1: Define the adoption contract — completed

Outcome: a concrete library inventory and migration contract ready for review.

- [x] Read the relevant READMEs, authoring/usage/ownership contracts, actual
      design composition and stylesheet configuration.
- [x] Inspect the committed manifest and existing navigation, geometry,
      component attribution and controls tests.
- [x] Define source/route ownership, component boundaries, explicit input/slot
      adapters, standalone hosts, saved variants, styles and acceptance behavior.
- [x] Create this plan after completing the protocol documents, index it under
      Active, and link the planned work from the protocol/example documentation.

## Milestone 2: Add the shared component pages — completed

Tags: mockup

Outcome: each proposed component can be reviewed independently in both viewports,
using the same implementation that existing design screens will adopt.

- [x] Capture the existing screen id/route set and mobile/desktop visual baseline.
      Add failing inventory/variant assertions before registering the new entries.
- [x] Create `entries/design/library/library.mockup.ts` with the four flat gallery
      collections and 15 inventory component entries. Add `design-library` to
      `design-root.childIds`; preserve all existing navigation groups and ids.
- [x] Extract actual implementations into small modules under the corresponding
      `library/{group}/{slug}.view.tsx` paths, separate from registration/variant
      metadata. Retain current screen adapters while migration is incomplete;
      component pages must already use the extracted implementation.
- [x] Define typed data schemas and declared slots from the inventory. Remove
      callback/render-prop and nested React-node data at registered boundaries;
      make navigation/state inputs explicit and preserve absent destinations.
- [x] Preserve explicitly narrow navigation artboards through recorded layout
      props. Keep independent footer tab groups isolated when repeated.
- [x] Preserve intrinsic badge sizing in standalone hosts and decouple flow-step
      identities from destinations so repeated destinations remain valid.
- [x] Author every specified saved variant with complete fixture props and
      concrete slots. Add the supported local controls, including unset/reset
      behavior, without new complex-data editors or hidden fixture lookup props.
- [x] Provide minimal standalone hosts using the existing renderer/providers,
      correct design tokens and sufficient space for panels, popovers and frames.
      Use light-only component entries and real mobile/desktop contexts.
- [x] Register nested library composition where applicable, including Top bar →
      Tag picker → Tag chip. Keep unique semantic identities for repeated children.
- [x] Keep component samples connected through their real catalogue collection,
      with metadata outside the rendered sample. Show one selected variant;
      preserve page hierarchy and gallery limits without extra artboard footers.
- [x] Build/check generated output, run focused rendering/authoring tests and
      type checks, and open every new variant fragment directly from disk.
      Review desktop/mobile samples and local prop editing before bulk adoption.

## Milestone 3: Establish exclusive component style ownership — completed

Tags: mockup

Outcome: style ownership is verified with registered consumers; unmigrated
artboards retain conservative change detection until they adopt the wrappers.

- [x] Add regressions distinguishing an exclusive component stylesheet edit,
      a global token edit and a screen-layout edit in isolated registered-consumer
      fixtures using the real library implementations.
- [x] Extract only exclusively owned selectors into
      `generated/design-library/{group}/{slug}.css`. Keep mixed selectors,
      global tokens, layout rules and shared icons conservatively attributed.
      Preserve cascade order, focus rings and all original selector behavior.
- [x] Declare exact component implementation/CSS ownership and matching
      dependencies. Keep registration, variants and controls metadata out of
      implementation-impact dependencies; their imports remain watched. Keep
      scenario data, navigation tables and shared helpers outside exclusive
      ownership. Assert this distinction in manifest/dependency tests.
- [x] Remove redundant exact component-file declarations from screen/ancestor
      dependencies when migrating those rules; retain genuine layout/global
      dependencies. Never claim a whole mixed sheet or directory for convenience.
- [x] Create the typed ordered candidate stylesheet map for library routes and
      owning screen routes, including reachable variants, prop edits and slots.
      Wire specific rules ahead of the existing first-match design fallback;
      avoid shipping every library sheet to every artboard.
- [x] Add the example renderer's per-render style collector and register sheets
      at actual component rendering sites. Retain required shared sheets and
      configured ordering/validated hrefs; reject unconfigured requests. Test
      absent/populated nested components and concurrent/transient renders so
      unused child CSS and leaked collection state cannot invent direct changes.
- [x] Observe extracted public CSS through the existing watch/resource setup.
      Confirm styles load from disk, Serve and an export with confined paths.
- [x] Verify `:has()` state, inherited tokens, icon/caret alignment, mobile
      sheets and inspector grips in both standalone and existing screen contexts.
      Rebuild/check outputs and inspect every changed fragment before proceeding.

## Milestone 4: Migrate Browse, Changes and use-case designs — completed

Tags: mockup

Outcome: the 24 existing Browse/Changes designs consume the shared library while
retaining their approved states, links and separate owning screen components.

- [x] Add failing per-screen usage expectations for headers, navigation, tags,
      comparison controls, frames, metadata, empty states and flow steps.
- [x] Adapt `Shell`, `TopBar`, `NavTree/NavDrawer`, `ScreenHead`, tag helpers,
      `DetailsPanel`, comparison helpers and frames to registered components.
      Retain lightweight scenario adapters and unregistered screen/layout roots.
- [x] Pass actual query, title, active rows, destinations, status, counters,
      addresses and content through data/slots. Preserve the existing explicit
      navigation tables and deliberately inactive controls, including removed
      screens and unsupported comparison/scheme/tag combinations.
- [x] Keep device selection independent of artboard viewport. Reuse the existing
      owning miniature screens inside frame/flow slots and retain reference links.
- [x] Preserve comparison eligibility, opaque bands, dark-selection/light-only
      depictions, drawer behavior, scroll containment and all incoming/return links.
- [x] Assert generated usage identities and meaningful Components/Usage panels
      for both viewports; verify Top bar nested usage through the tag-picker state.
- [x] Build/check outputs and run existing Browse, design-link, portable-link,
      comparison eligibility and navigation suites. Open all changed fragments
      directly from disk and smoke-test the real outer shell on both viewports.

## Milestone 5: Migrate component explorer, inspection and controls designs — completed

Tags: mockup

Outcome: all 56 owning design screens use the same registered library; the real
outer inspector shows usage across the full design catalogue.

- [x] Add failing usage expectations for all 32 component design states and
      for shared components consumed across both old and new screen families.
- [x] Adopt the same navigation/header/status/view-controls and frame/comparison
      components in `ExplorerShell`, `ComponentLayout` and screen layouts.
      Preserve ordinary preview/workspace composition and the depicted subject
      fixtures; do not replace entire artboards with opaque component variants.
- [x] Convert `InspectorPanel.content` arrays to a plain ordered tab description
      plus named body slots. Reuse the inspector and metadata rows in every
      details/props/usage/closed/selected state, retaining each screen's initial tab.
- [x] Reuse prop-field framing across control states. Keep typed fixture values,
      validation messages, read-only/loading/error/reset outcomes and actual input
      elements in explicit caller data/slots. Verify unique label/input/error ids.
- [x] Use stable semantic instance ids for fields, tabs, tags and repeated panes.
      Ensure nested children and caller-owned slot children retain correct owners.
- [x] Remove duplicate migrated markup/style implementations while preserving
      source entry points and supported scenarios. All migrated adapters must
      delegate to registered wrappers; small decorative helpers may stay ordinary.
- [x] Keep pictured component usage/highlight demonstrations distinct from real
      outer usage. Validate the latter solely against generated instance records.
- [x] Build/check output; run component design, inspector, controls, resizing,
      geometry, selection and navigation tests. Inspect every changed fragment
      on disk and smoke-test the complete connected design catalogue.

## Milestone 6: Prove reuse and attribution end to end — completed

Tags: mockup

Outcome: actual component edits, screen edits, usage and published inspection
behave consistently across the completed design catalogue.

- [x] Assert preservation of the original id/route set, both viewports and every
      specified library variant. Each component must have real direct or nested
      screen consumers, and all owning artboards must record expected usage.
- [x] Add a focused adoption guard against bypassing registered renderers at
      migrated composition points; pair it with generated usage assertions so
      testing does not rely on import spelling or raw marker counts alone.
- [x] Exercise isolated, fully registered baseline/current snapshots: component
      markup/CSS edits, nested chip edits, changed screen inputs/destinations,
      changed slots, repeated-instance reorder/removal and saved-variant edits.
- [x] Change actual variant/controls metadata source files and assert component
      Changes without invented affected consumers. Test hidden-child CSS and
      populated-child CSS separately across the parent's saved variants.
- [x] Verify direct Changes and affected consumers against the contract across
      Browse/watch, generated comparison results and static export. Preserve
      conservative global/style-layout changes and unrelated Example behavior.
- [x] Update legacy stylesheet assertions to component-aware expectations while
      retaining meaningful mixed/global resource coverage. Treat initial adoption
      differences as real structural changes rather than adding blanket ignores.
- [x] Browser-smoke a design screen → Components → shared component → Usage →
      consuming screen journey, including nested selection and actual highlighting.
      Verify dimming geometry, Escape, Back/Forward and both viewport contexts.
- [x] Test local prop edit/reset/variant changes and unchanged source/output/
      comparison state. Test saved variants and read-only inspection after export.
- [x] Measure plain `npm run dev` with the expanded catalogue and a registered
      Git baseline. Retain bounded baseline-read command counts and existing
      readiness deadlines; investigate any new bottleneck through the milestone
      separation rule instead of masking it with larger timeouts.

## Milestone 7: Preserve layout overrides after style extraction — completed

Tags: mockup

Outcome: bounded inspector panels retain scrolling regardless of which exclusive
component sheets are requested. The full gate exposed a mobile overflow override
loading after the workspace rule; the original screen did not have this failure.

- [x] Split configuration into ordered base, component and layout blocks, keeping
      layout overrides after requested exclusive component sheets.
- [x] Assert scrollable open panels across all 32 component artboards and the
      standalone variants; rerun mobile close/reopen and resize regressions.
- [x] Rebuild output, repeat the direct-file visual audit and document the order.

## Milestone 8: Verify portable gallery layout — completed

Tags: mockup

Outcome: standalone mobile controls fit with wider system fonts, and integration
checks distinguish catalogue build time from individual browser interactions.

- [x] Reproduce native comparison-button overflow with a wider fallback font;
      apply the same mobile sizing to button, link and static label controls.
- [x] Give full real-consumer export setups their own bounded build allowance,
      retaining the existing browser interaction and server readiness deadlines.
- [x] Wait for the selected preview to be unique after linked navigation before
      asserting its state; preserve the existing hidden-viewport expectations.
- [x] Run focused browser checks and inspect changed samples directly from disk.
- [x] Repeat the complete local gate after the portability fixes.
- [x] Verify both supported Node CI jobs after the push.

## Milestone 9: Normalize all footers and view controls — completed

Tags: mockup

Outcome: every selected-screen design uses the shared icon footer and grouped
view controls.
The user explicitly authorized removal of the legacy disclosure footer, its
saved variant, and the old segmented viewport/theme controls on 10 September.

- [x] Update contracts and add failing catalogue/browser regressions for the
      removed props, variants and markup before changing the implementation.
- [x] Delete the legacy footer render paths, schema fields, saved variant and
      obsolete chrome styles; preserve its details and comparison content.
- [x] Share the bounded preview/inspector layout with all Browse/Changes
      designs, including desktop resizing and mobile sheets. Keep flows and
      empty pages scrollable without adding irrelevant panels.
- [x] Remove segmented viewport/theme presentations and top-bar theme controls;
      use the shared icon group once per selected screen. Preserve real theme
      navigation, unavailable states and working viewport selection.
- [x] Preserve all owning screen ids/routes and incoming navigation; opening
      or closing Details becomes native icon-panel behavior. Keep the canonical
      open-details artboard reachable through the catalogue.
- [x] Reproduce and prevent full-size phone overlap in Both using intrinsic
      minimum widths in the shared layout, plus a browser geometry regression.
- [x] Keep inspector-body navigation and tag chips as native `MockLink` anchors,
      preserving valid interactive content inside the shared native panels.
- [x] Rebuild and check generated output, inspect every changed viewport and
      saved sample directly from disk, test resizing/navigation and update docs.
- [x] Run the complete gate, commit and push all source/generated changes, then
      run the required review and report findings without automatic fixes.

## Milestone 10: Validate and deliver — completed

Outcome: documented, reproducible implementation ready for review.

- [x] Update protocol delivery status, the example README and relevant source
      guidance with the implemented library, ownership rules and contribution
      workflow. Reconcile this plan's scope with the completed implementation.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      focused tests and type checks. Commit matching generated HTML/manifest
      output; do not hand-edit generated HTML as the source of truth.
- [x] Finish the full direct-file visual audit and Serve/export smoke checks;
      retain an inventory and evidence in `.context` for every changed page.
- [x] Run `cargo xtask check`; require all relevant tests and every gate to pass.
- [x] Review the diff/deletions against `origin/main`, run `git add -A`, commit
      all completed source/docs/generated files with Conventional Commits and
      push the branch. Newly created files must be included.
- [x] After the push, run `cargo xtask review` on the complete diff against
      `origin/main`. Report every finding with severity, context, impact,
      lettered solution options and a recommended scope; do not automatically
      fix review findings.
- [x] Tick completed tasks and move this plan's index link to Completed once
      implementation and verification are delivered. Keep review follow-ups
      explicitly recorded for the user's decision.

## Milestone 11: Preserve native same-document history — completed

Tags: ui

Outcome: skip links and fragment Back/Forward retain the existing screen and
keyboard focus. Node 22 CI exposed an existing race: a fragment history event
refetches the current catalogue page and can steal focus before Enter activates
a screen link. This is a runtime behavior correction; no visual design changes
or backend work are required.

- [x] Capture the failure with a native skip-link/history browser regression.
- [x] Distinguish document route/query changes from same-document history;
      preserve native fragment behavior and invalidate superseded requests.
- [x] Cover URL identity and cancellation, retain route/query history coverage,
      and update navigation guidance without increasing interaction timeouts.

## Milestone 12: Verify and deliver the CI correction — completed

- [x] Run focused navigation/browser tests and the full `cargo xtask check` gate.
- [x] Audit the diff, run `git add -A`, commit all completed work using
      Conventional Commits and push before running `cargo xtask review` again.
- [x] Report review findings without automatic fixes; verify CI and published
      navigation, then complete the delivery record and plan index.

## Verification Evidence

The [review and verification record](../docs/reviews/mokly-design-components.md)
retains startup, source attribution, direct-file audit, complete gate and CI
results. The normalization adds regression coverage for icon-only schemas,
all-screen viewport selection, native panel opening/resizing and non-overlapping
full-size phone/desktop previews. Its [final delivery review](../docs/reviews/mokly-design-controls.md)
records the published smoke results and all six post-push findings with assessed
recommendations; none was automatically fixed.
