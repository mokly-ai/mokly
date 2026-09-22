# Screen Variants Follow-up

Status: in progress. Created 2026-09-22 at the user's request to close
[Screen Variants](./screen-variants.md) for
[PR #101](https://github.com/mokly-ai/mokly/pull/101). All work here belongs in a
separate PR. The design route retirement still requires explicit approval
before that conversion starts.

## Scope And Contracts

Carry forward Task 9.1, the two second-review findings resolved on this branch,
the two still-open latest variant-related findings, and both later product
ideas. The original plan retains its completed milestones and historical
review record.

Contract owners:

- [Screen variants](../docs/protocol/mokly-screen-variants.md) and
  [authoring](../docs/protocol/mokly-authoring.md).
- [Viewer](../docs/protocol/mokly-viewer.md),
  [navigation](../docs/protocol/mokly-navigation.md), and
  [Changes](../docs/protocol/mokly-changes.md).
- [Shell design](../docs/protocol/mokly-shell-design.md),
  [design links](../docs/protocol/mokly-design-links.md), and
  [component workspace](../docs/protocol/mokly-component-workspace-design.md).

The remaining recommendations below define proposed scope and do not authorize
retiring the six existing design routes.

## Resolved Before This Follow-up

The original second-review finding that embedded links ignored explicit view
axes is already resolved. `store_host_routes.ts` parses links through the
shared `routeFromUrl` path, and `store_host.ts` applies each valid explicit
viewport or scheme while retaining the other selection axis. It is no longer
counted or carried by this plan.

## Carried Review Findings

1. **P2 — A light-only preview uses Dark for its status and marks.** Original
   second review, item 2. In a mixed catalogue, the workspace passed the
   selected Dark scheme to status and mark decisions even when the screen or
   saved component variant displayed its Light fallback. Users could see a
   misleading Changed badge or a mark for a theme that had no render.
   **A (recommended):** resolve the effective view once and share it across
   status, marks, and comparison presentation, with mixed-catalogue tests in
   Serve and the Viewer. **B:** add local fallback checks at each consumer.
   A protects future consumers from presenting inconsistent view evidence.
   **Resolved 2026-09-22:** `resolveWorkspaceView` now supplies the effective
   scheme, status, eligibility, and evidence provenance to SSR and hydrated
   consumers, with mixed-catalogue Serve and Viewer coverage.
2. **P2 — Fallback status grants unavailable comparisons.** Original second
   review, item 3. With missing or pending per-view evidence, the workspace
   used route-level Changed status even when the selected saved component
   variant was ineligible. Users could select unavailable comparisons,
   including through `?comparison=side`.
   **A (recommended):** return status, eligibility, and evidence provenance
   together; derive eligibility from shown status only for matching evidence,
   retaining existing entry/variant eligibility otherwise. Reuse the resolver
   in server rendering and every client path. **B:** guard only comparison
   controls. A also closes deep-link and background-update paths.
   **Resolved 2026-09-22:** the shared resolver treats per-view evidence as
   authoritative only when it covers every shown view and otherwise preserves
   selection-level status and eligibility independently. SSR, Viewer, partial
   evidence, and deep-link regressions cover the decision.
3. **P2 — Broadly typed screen inputs promise the wrong return shape.** Latest
   post-CI review, item 1; `src/authoring/definitions.ts:24`.
   `defineScreen(input)` for an `input: ScreenInput` is typed as one
   `ScreenDefinition`, but returns an array when `variants` is present, even
   when it is empty. Validly typed consumers can read undefined properties.
   **A (recommended):** expose a union when variants are optional while keeping
   precise literal inference; cover typed inputs and generic helper wrappers
   in packed-consumer type tests and runtime tests. **B:** always return an
   array, requiring a broader breaking API migration. A fixes the public
   contract and adds boundary coverage without changing established behavior.
4. **P2 — Historical variants disappear when their parent becomes a variant.**
   Latest post-CI review, item 2; `packages/viewer/src/shell/nav_tree.ts:124`.
   A former parent can retain its id while becoming another screen's variant.
   Removed children are then adopted and excluded from flat fallback, but
   `attachRemovedVariants` never attaches them through variant leaves. Users
   lose navigation to those removed routes and their previous versions.
   **A (recommended):** adopt only beneath current non-variant parent screens;
   otherwise retain flat fallback. Add an invariant that every removed route
   remains represented. **B:** design nested historical variant groups across
   navigation and the contracts. A preserves the existing one-level model
   while the invariant protects other hierarchy transitions.

## Milestones

### Milestone 1: Define the follow-up contracts

Documentation first: make the intended behavior explicit before changing
authoring or navigation.

- [ ] Specify return types for literal, optional, empty, and generic `variants`
      inputs, including the compatibility decision for finding 3.
- [x] Define effective view fallback and evidence-backed comparison
      eligibility for findings 1 and 2, including server render, deep links,
      controlled selection, and background evidence updates.
- [ ] Clarify that removed-variant adoption requires a non-variant current
      parent; preserve every removed route exactly once for finding 4.
- [ ] Record the user's decision on Task 9.1's six design route retirements
      before conversion. Specify the old/new route mapping, stable ids and
      collection changes in the design inventories. Planning permission alone
      is not approval to retire those routes.
- [ ] Validate changed Markdown and links; review the documentation diff.

### Milestone 2: Design catalogue conversion and regression states

Tags: mockup

Complete the deferred Task 9.1 only after its route changes are approved, and
establish the mockups needed for the later UI fixes. Reuse the existing design
library and standalone mobile/desktop screen components.

- [ ] Move `design-browse-dark-scheme`, `design-browse-light-only`, and the four
      tag-state screens into `design-browse-screen` (Welcome) as variants.
      Preserve all six ids and derive the six routes below
      `design/browse/views/screen.variants/`.
- [ ] Update `examples/basic/entries/design/browse_screens.tsx`,
      `browse_scheme_screens.tsx`, `browse_tag_screens.tsx`,
      `browse/states/tags/*.tsx`, and `design.mockup.tsx`; reuse screen
      components and remove only the approved old collection memberships.
- [ ] Update the shell-design and design-links inventories,
      `examples/basic/notes.md`, the example README, and the root README's
      relevant feature paragraph. Keep their delivered-status claims accurate.
- [ ] Extend the owning design pages for mixed-scheme fallback, ineligible
      comparisons, and removed variants whose old parent becomes a variant.
      Reuse existing screens where possible; keep mobile and desktop variants,
      reachable design links, and no more than five mockups per screen-spec
      page. User flows must link back to those owning screen components.
- [ ] Add regression assertions before the conversion, then verify the
      manifest retains every design id, moves exactly six routes, and adds
      `variantOf` to those six entries. Run the design screen/link suites,
      including `tests/design_screens.test.tsx`, `tests/design_links.test.ts`,
      `tests/browser/design_links.spec.ts`, and
      `tests/browser/preview_design_links.spec.ts`.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      and `npm run preview:build`. Smoke through `npm run dev` and the static
      preview: expand Welcome, open every variant, and follow a mini-screen
      design link into a variant at mobile and desktop sizes.
- [ ] Keep generated HTML and the manifest ignored; commit only authored
      source and CSS. Record every approved retired route in the conversion
      commit message.

### Milestone 3: Correct the public authoring types

Resolve finding 3 at the package boundary while keeping the running product
and existing authoring use cases functional.

- [ ] Add failing NodeNext packed-consumer checks for annotated `ScreenInput`,
      generic wrappers, omitted/undefined variants, empty arrays, and populated
      arrays; assert that unsafe single-definition assignment is rejected.
- [ ] Correct `DefineScreenResult` and add matching runtime assertions without
      losing precise inference for known single-screen and array calls.
- [ ] Run authoring tests, `npm run build`, `npm run typecheck`,
      `npm run package:check`, and `npm run package:smoke`.

### Milestone 4: Correct Viewer selection and historical navigation

Tags: ui

Resolve findings 1, 2, and 4 through shared decisions that keep standalone,
embedded, and published navigation consistent.

- [x] Add failing tests for effective fallback and evidence provenance before
      implementation. Cover light-only screens and saved variants in mixed
      catalogues, missing/pending evidence, and comparison deep links.
- [x] Share effective-view/evidence resolution among the server-rendered shell,
      client updates and Viewer selection paths.
- [ ] Add failing tests for historical variant adoption before implementation.
- [ ] Restrict removed-variant adoption and test former-parent reparenting,
      deletion and kind changes. Assert that every removed route appears
      exactly once, either under an eligible parent or in flat fallback.
- [x] Run the view-status, view-marks, workspace and Viewer unit suites plus the
      affected Serve, Viewer and static browser suites for findings 1 and 2.
- [ ] Run the historical navigation suites for finding 4.
- [ ] Smoke the affected navigation and comparison states through Serve and
      static preview at mobile and desktop widths; check keyboard navigation
      and controlled-host proposals as well as pointer input.

### Milestone 5: Verify, deliver, and review the separate PR

Complete the follow-up independently of PR #101. No task requires this PR
already to be merged.

- [ ] Reconcile every carried item with test or decision evidence, update
      delivery documentation, and move this plan to Completed when its own PR
      merges. Keep any genuinely later work in the non-blocking section below.
- [ ] Run all relevant tests and `cargo xtask check` with a 100% pass rate;
      inspect the complete diff and mainline preservation before committing.
- [ ] After checks pass, run `git add -A`, commit with Conventional Commits
      and a title of at most 50 characters, and push the branch. Include all
      authored new files and record approved route retirements.
- [ ] Only after the push, review the complete local diff against `origin/main`
      using [the implementation review prompt](../docs/implementation-review-prompt.md).
      Report every finding with severity, context, impact, lettered options
      and a recommendation; do not automatically fix review findings.

## Post-merge follow-up (non-blocking)

These are the original plan's later product ideas, carried forward without
claiming approval or making adoption-dependent work a merge requirement.

- [ ] Evaluate grouping a component's Affected screens by parent once variants
      make that list long. Record the decision; if useful, define the contract
      and mobile/desktop mockups in a separate change before implementation.
- [ ] After the user has seen variants in use, consider a variants count on
      Home beside screens and components. Record the decision and scope any
      resulting UI work separately with real catalogue-derived counts.
