# Design Mockup Test Boundaries

Status: Active. Milestones 1 through 5 and Change requests 1 through 4 are
delivered. Milestone 6 delivery work is done. The final implementation review
is assigned to the orchestrator. No PR is open.

Give each check on Mokly's own design catalogue one home. Unit tests check the
generated mockup HTML and CSS. Browser mockup specs open the raw generated
artboards and check only what needs a browser. Runtime specs test Mokly's own
code with non-design fixtures. Delete the browser design specs that repeat
runtime coverage after their unique checks move, and repair the unit tests that
stopped checking anything when entry ids became paths. The new
[design verification protocol](../docs/protocol/mokly-design-verification.md)
owns the contract.

## Background

Mokly's design catalogue is authored in `examples/basic/specs/design/` and
compiled under `examples/basic/generated/design/`.

Some browser specs use design artboards as fixtures for Mokly runtime behavior.
Others repeat static assertions that belong in unit tests. Empty selections
from the earlier id format can also leave unit assertions untested. This plan
separates those responsibilities and guards each boundary.

## Decisions

### Test layers

| Layer                | Files                                                                                        | Opens                                                        | Asserts                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Unit mockup tests    | `tests/design_*.test.ts(x)`, `tests/component_design_*.test.ts`, `tests/brand_logo.test.tsx` | The in-memory compile in `tests/helpers/design_catalogue.ts` | Generated HTML and CSS facts: text, attributes, link targets, counts, presence and absence, stylesheet rules       |
| Browser mockup specs | `tests/browser/design/*.spec.ts`                                                             | Raw generated artboards, only through `designArtboardUrl`    | Layout, computed style, CSS-driven visibility, overflow, scrolling, focus, hit-testing and native control behavior |
| Runtime specs        | Other `tests/browser/*.spec.ts`                                                              | The served shell, exports and preview hosts                  | Mokly's own code; checks that this plan adds use non-design fixtures                                               |

- A browser mockup spec never opens `/view/`, an export, a preview host or a
  server. No spec outside `tests/browser/design/` opens a raw design artboard.
  `tests/design_test_boundaries.test.ts` enforces both rules. Runtime specs may
  still open served design routes (see Out of scope).
- Catalogue-wide unit selections use `designEntries`, which fails when nothing
  matches.
- The documented inventory test (`tests/design_links_inventory.test.ts:24`)
  is the only guard against a removed design screen returning. Tests do not
  look up removed ids.
- A check leaves a spec only after its replacement passes in the same
  milestone.

### Removals

The user approved these removals on 2026-10-06. Milestones 2 to 4 name every
deleted test beside its replacement, and the PR description lists them all.

- Runtime duplicates, deleted in Milestone 4: `design_links.spec.ts`,
  `design_appearance_toggle.spec.ts`, `design_library_runtime.spec.ts`,
  `design_library_export.spec.ts` and `component_design_navigation.spec.ts`.
- Static checks only, deleted in Milestone 3:
  `component_design_selection.spec.ts`.
- Renamed in Milestone 4: `preview_design_links.spec.ts` becomes
  `preview_host_navigation.spec.ts`.

- Related cleanup in Milestone 4: `tests/browser/design_test_helpers.ts` moves
  its generic focus function to `tests/browser/link_focus.ts`. The removed
  `design-library` profile and its embedded fixture source have no remaining
  caller after `design_library_export.spec.ts` is removed.

- Raw-artboard moves in Milestone 5 preserve every assertion. These files
  move under `tests/browser/design/`, dropping only a leading `design_`:
  `design_comparison_stacks.spec.ts`, `design_component_stacks.spec.ts`,
  `design_comparison_scrolling.spec.ts`, `design_scroll_together.spec.ts`,
  `design_comparison_eligibility.spec.ts`, `comparison_design.spec.ts`,
  `design_modern_controls.spec.ts`, `design_top_bar.spec.ts`,
  `design_library.spec.ts`, `design_portable.spec.ts`,
  `design_index_entries.spec.ts`, `design_appearance.spec.ts`,
  `component_design.spec.ts`, `component_design_inspection.spec.ts`,
  `component_workspace.spec.ts`, `component_surfaces.spec.ts`,
  `component_controls.spec.ts`, `component_evidence.spec.ts`,
  `component_inspector.spec.ts`, and `phone_chrome.spec.ts`. Remove
  `component_design_fixture.ts` after moving its route list and raw URL reader
  into `tests/browser/design/artboards.ts`.

### Accepted coverage losses

- Tab order from the brand mark to a design link in the served shell. Unit
  tests prove that every design link is a native `<a href>`.
- Inspection three levels deep on a real screen. Two-level nesting stays
  covered by `component_explorer_inspection.spec.ts:27-30` and
  `component_explorer_comparisons.spec.ts:121-131`.

## Milestone 1: Test layer contract

Completed. Define the three layers, their rules and the delivery status before
any test moves.

- [x] Add `docs/protocol/mokly-design-verification.md` at or below 250 lines.
      It owns the scope, the three layers, what each layer may open and
      assert, `designArtboardUrl`, `designEntries`, the inventory rule for
      removed screens, the boundary guard, where runtime checks belong, how to
      run each layer, and a Delivery Status section.
- [x] Give the protocol a "Rules for new tests" section that forbids adding
      back the removed patterns, with the reason for each rule:
  - [x] No browser spec tests Mokly's runtime (the served shell, exports or
        preview hosts) with design pages as content. Such checks go to a
        runtime spec with a non-design fixture.
  - [x] No browser spec asserts a static mockup fact, such as text, an
        attribute, a link target or a count. Such checks go to a unit test.
  - [x] No test looks up a removed design id; the inventory test guards
        removed screens.
  - [x] No catalogue-wide unit selection bypasses `designEntries`.
  - [x] Name `tests/design_test_boundaries.test.ts` as the guard for the
        first rule, and the review of new tests as the guard for the others.
- [x] List it with the design catalogue contracts in `docs/protocol/README.md`.
- [x] Replace the spec list and Playwright command in
      `docs/protocol/mokly-component-design.md:236-250` with a link to the new
      protocol. Keep the checks that the page owns and its `design/…`
      inventory tables, which `tests/design_links_inventory.test.ts` reads.
      Stay at or below 250 lines.
- [x] Link the new protocol from the Design Mockups section of
      `docs/protocol/mokly-shell-design.md` without growing the file. If the
      file shrinks, lower its cap in `tests/protocol_doc_sizes.test.ts`.
- [x] Describe the three layers in the test notes of `examples/basic/README.md`
      and link the protocol.
- [x] Run `npx prettier --check` on the changed Markdown. Run
      `npm run prepare:verification`, then
      `node --import tsx --test tests/protocol_doc_sizes.test.ts tests/design_links_inventory.test.ts`.
- [x] Run the milestone lint, formatting, and prepared type checks. Audit the
      mainline diff and deletions. Commit with a Conventional Commit and push.

Evidence: `.context/design-mockup-test-boundaries/milestone-1.md`.

## Milestone 2: Unit tests check what they claim

Completed. Make every empty selection fail, then point it at current paths.

- [x] Add `designEntries(predicate, label)` to
      `tests/helpers/design_catalogue.ts`. It returns the matching manifest
      entries and fails with `label` when none match.
- [x] Route these selections through it, and confirm that each test fails:
  - [x] `tests/design_modern_controls.test.ts:80` (filter `design-`).
  - [x] `tests/component_design_review.test.ts:14` and `:37`
        (`design-component-`).
  - [x] `tests/design_appearance_variants.test.ts:204` (`previewScreens` at
        `:24-34`).
  - [x] `tests/design_library_styles.test.ts:57` (`design-ui-`).
- [x] Point them at current paths, and confirm that they pass:
  - [x] Screens and component variants under `design/`.
  - [x] Screens under `design/components/`.
  - [x] `overview`, `states/auto`, `workspaces/props`, `workspaces/instance`,
        `status/loading`, `status/unavailable`, `workspaces/side-by-side`,
        `workspaces/difference` and `status/flow` under
        `design/browse/appearance/`.
  - [x] Non-variant components under `design/library/`, with the slug taken
        from the last path segment.
- [x] Delete the absence checks that look up old ids: the test at
      `tests/design_appearance_variants.test.ts:231`, and the asserts at
      `tests/design_appearance_controls.test.ts:69-74`,
      `tests/design_library_inventory.test.ts:94-97` and
      `tests/design_screens.test.tsx:61-64`.
- [x] Route every other catalogue-wide selection in the design unit tests
      through `designEntries`. Find them with
      `rg -n "manifest\.entries" tests/design_* tests/component_design_* tests/brand_logo.test.tsx`.
- [x] Run
      `node --import tsx --test tests/design_*.test.ts tests/design_*.test.tsx tests/component_design_*.test.ts tests/brand_logo.test.tsx`.
- [x] Update the Delivery Status in the design verification protocol.
- [x] Test empty current and copied-baseline selections. Preserve the supplied
      baseline entries. The helper's optional third argument avoids changing
      the historical input of attribution checks.
- [x] Guard the current light-only appearance subject before filtering fragments,
      so removing that subject cannot leave its assertions untested.
- [x] Run the milestone lint, formatting, and prepared type checks. Audit the
      mainline diff and deletions. Commit with a Conventional Commit and push.

Evidence: `.context/design-mockup-test-boundaries/milestone-2.md`.

## Milestone 3: Static checks move to unit tests

Completed. Give every static assertion in a browser mockup spec a unit test. The specs
keep only the checks that need a browser. Each changed unit file stays at or
below 300 lines.

- [x] `component_design_selection.spec.ts`: move both tests to a new
      `tests/design_component_inspection.test.ts`. They cover usage links that
      select a container or a hidden instance (`inspection/selection/*`
      targets and "Selected instance" details), and the removed consumer's
      Changes membership (count 2, the Farewell row, the `removed-consumer`
      page and one changed mark). Delete the spec.
- [x] `component_design.spec.ts`: add these checks to a new
      `tests/design_component_pages.test.ts`, and keep the visible canvas
      count, the open-panel `overflow-y: auto` and the horizontal-overflow
      checks in the spec:
  - [x] The `.ce-design .mbk-shell--<viewport>` wrapper and a heading on all
        39 owning artboards.
  - [x] "Saved variants › Disabled" targets `pages/variants`, which shows the
        disabled Continue button and "Supplied props: true".
  - [x] "Used by › Welcome" targets `inspection-details`, with the "Welcome"
        heading and "Footer action".
  - [x] The viewport select's value equals the viewport.
  - [x] Count 1 on `affected`. Count 2, two "Affected screens" links, two
        changed marks, and the Welcome, Action and Default rows on
        `direct-change`.
- [x] `component_design_inspection.spec.ts:84`: add to a new
      `tests/design_component_states.test.ts` the empty, unavailable, unused
      and removed panel copy; the "No visible region" text; the Farewell link
      to `removed-consumer`, with that page's previous-version label, copy,
      before-state action, frame type and `data-viewport`; and the link to
      `states/removed`. Keep only the visibility of "No visible region" after
      its `<details>` opens.
- [x] `component_workspace.spec.ts`:
  - [x] Move the tab checks of `:14` and the Controls tab, "Expanded
        inspector" switch and hint field of `:150` to a new
        `tests/design_component_inspector.test.ts`.
  - [x] Move the "Preview options" toolbar, its "Preview viewport" select, the
        Light `.ce-scheme` labels and the absent top-bar view controls of `:47`
        to `tests/component_design_navigation.test.ts`.
  - [x] Move the "Inspect Action, Continue" link and the "Selected instance"
        name of `:87`, and the unique mask ids of `:215`, to
        `tests/design_component_inspection.test.ts`.
  - [x] Delete `:14`, and delete `:120`, which
        `tests/component_design_navigation.test.ts:61-69` and `:109` cover.
  - [x] Keep the label edit across viewport switches (`:47`), the highlight
        that reaches the device bottom and its click (`:87`), and the unique
        layout checks of `:150`. Remove the checks in `:150` that repeat
        `component_surfaces.spec.ts`.
- [x] `component_controls.spec.ts`: move `:23` and the static part of `:132`
      to a new `tests/design_component_controls.test.ts`: link targets, field
      values, the edited and reset states, the invalid field and its error,
      the invalid preview's inline 8px radius, the alert copy, the pending
      status, the comparison and published notices, and the disabled previews.
      Delete `:23`. Keep `:6` and the hint visibility in `:132`.
- [x] `component_evidence.spec.ts`: move `:14`, `:63` and the badge, count
      and rows of `:164` to `tests/design_component_comparison_states.test.ts`.
      Move the "Changed" and "Removed" statuses of `:164` to
      `tests/design_component_headers.test.ts`, and the highlight reasons of
      `:88` to `tests/design_component_inspection.test.ts`. Delete those four
      tests, and keep `:127`.
- [x] `component_inspector.spec.ts`: move the open panel at load, the summary
      labels that match their regions and the shared `details` name of `:6`,
      and the "Used by" region of `:50`, to
      `tests/design_component_inspector.test.ts`. In `:6`, keep only focus and
      Space opening each tab in turn.
- [x] `phone_chrome.spec.ts:35`: add a component-variant reader to
      `tests/helpers/design_catalogue.ts`, and check `aria-hidden` on the home
      bar and notch in a new `tests/design_library_device_frame.test.ts`. Keep
      the visibility and `pointer-events` checks.
- [x] `review.spec.ts:224`: move the "Comparison mode" group's role, name and
      Current state, and the absent "Mokly modes" navigation, to
      `tests/design_link_states.test.ts`. Delete the browser test.
- [x] `tests/design_appearance_controls.test.ts`: ban a "Dark preview" switch
      by accessible name as well as by class.
- [x] `comparison_design.spec.ts`: move `:18`, `:134` and the static part of
      `:30` to a new `tests/design_comparison_context.test.ts`. Keep the
      Details toggle, the desktop-only resize handles and `:100` in the spec.
- [x] `design_comparison_eligibility.spec.ts:89`: add a unit test that no
      unchanged design shows a comparison band or a stage heading in either
      scheme, in a new `tests/design_comparison_eligibility.test.ts`. Keep
      the opaque-band style check in the spec.
- [x] `design_modern_controls.spec.ts:37`: add one inspector, one "Preview
      options" toolbar and no top-bar view controls on every screen artboard
      to `tests/design_modern_controls.test.ts`. Keep the viewport-select and
      overflow checks in the spec.
- [x] `design_library.spec.ts:144`: add to `tests/design_library_usage.test.ts`
      that the last `.flow-step` is the last element child and that the
      `.flow-step:last-child::before` rule hides its connector. Delete the
      browser test.
- [x] `design_library.spec.ts:28`: add to `tests/design_links.test.ts` that no
      link in a library sample (components under `design/library/`) uses an
      absolute or external URL. The test at `:135` covers screens only, and
      the build already rejects missing link and stylesheet targets. Then
      remove the link and stylesheet checks from the spec.
- [x] `tests/design_index_entries.test.ts`: assert the folder screen's menu
      target and the mobile drawer's "Show contents of Profile" toggle on the
      member pages.
- [x] `tests/design_comparison_scrolling.test.ts`: assert that Current draws
      no Scroll together anywhere on the page. Then delete
      `design_scroll_together.spec.ts:160`.
- [x] Delete `design_portable.spec.ts:19`, which
      `tests/design_links.test.ts:150-168` covers, and
      `design_component_stacks.spec.ts:229`, which
      `tests/component_design_navigation.test.ts:71-94` and
      `tests/design_link_states.test.ts:80-95` cover.
- [x] Run the design unit tests and every changed browser spec.
- [x] Update the Delivery Status in the design verification protocol.
- [x] Add and test shared accessible-name, field-value, region, and description
      readers so moved assertions keep native names and field semantics.
- [x] Move the initially checked highlight, nested disclosure, and selected
      instance facts from the geometry test to the inspection unit test.
- [x] Preserve the native label edit and visible canvas checks in the surviving
      controls spec. Keep the closed inspector height and pane resize checks
      in the surviving surface spec at both viewport sizes.
- [x] Clarify the selected-screen, whole-document, and home/flow/navigation
      control scopes. Update stale neighboring verification guidance to link
      the three-layer contract.
- [x] Open and capture only comparison-band artboards in the eligibility
      browser test. Read other HTML without a browser to select those views.
      Preserve every style and bounds check and the existing test timeout.
      Unchanged structure remains checked in the eligibility unit test.
- [x] Retry focused browser verification after the unit workers and HEAD baseline
      preparation finish. Preserve the normal global setup and test assertions.
- [x] Run the milestone lint, formatting, and prepared type checks. Audit the
      mainline diff and deletions. Commit with a Conventional Commit and push.

Evidence: `.context/design-mockup-test-boundaries/milestone-3.md`.

## Milestone 4: Runtime checks move to runtime specs

Completed. Move each check that only a runtime design spec makes into a runtime spec with
a non-design fixture. Then delete the design spec or test.

- [x] `tests/browser/example_links.spec.ts`: add that desktop keeps its
      viewport after a frame link, that Back restores the frame source of a
      history entry that a frame link created, and a frame-link navigation
      whose stylesheet is held back. Delete `design_links.spec.ts` and
      `component_design_navigation.spec.ts`.
- [x] `tests/browser/browse_frames.spec.ts`: add that the current navigation
      row stays selected after a scheme toggle. Add a raw-artboard check that
      the artboard shell paints `rgb(244, 244, 241)` in Light and
      `rgb(22, 21, 18)` in Dark, in a new
      `tests/browser/design_appearance.spec.ts`. Delete
      `design_appearance_toggle.spec.ts`.
- [x] `tests/browser/component_explorer_inspection.spec.ts`: add that
      expanding each nested-instance summary keeps the Components tab
      selected, and that choosing an instance from the Components list
      (`.mbk-instance-select`) shows its props. Delete
      `design_library_runtime.spec.ts`.
- [x] `tests/browser/component_static_runtime.spec.ts`: in the export, add
      that a "Saved variants" link opens its variant, and that the revised
      Action marks its own row but not the Home row. The default
      `componentEntrySource()` already nests Action inside Pane on Home.
      Delete `design_library_export.spec.ts`, then remove the `design-library`
      profile and `designLibraryFixtureSource` from
      `tests/helpers/example_baseline.ts`.
- [x] Add `tests/browser/frame_native_controls.spec.ts`. Build a fixture
      screen with `createFixture` that holds a native select, a checkbox and a
      `details` element, and serve it with `startCatalogueServer`. Assert that
      each control works inside the served, sandboxed frame, and that the frame
      holds exactly one script, the inspector. Move the two highlight-layer
      checks of `component_workspace.spec.ts:215` to
      `component_design_inspection.spec.ts` on the raw artboard. Then delete
      `component_workspace.spec.ts:215` and `component_inspector.spec.ts:50`.
- [x] Move `phone_chrome.spec.ts:11`, which opens a served example screen, to
      `tests/browser/browse_chrome.spec.ts`.
- [x] `tests/browser/link_controls.spec.ts`: add a span-tier adapted link
      (`a[data-mokly-link-control="span"]`) that keeps the height of its
      non-link sibling, and extend `link_controls_fixture.ts` with one. Remove
      that check and the unit-covered removed-route check from
      `design_portable.spec.ts:64`.
- [x] Rename `preview_design_links.spec.ts` to
      `preview_host_navigation.spec.ts`. Keep `:38` and `:161`. Rewrite `:62`
      against example screens: on the Pages host, navigation while Dark lands
      on the `.dark` page, and Enter activates a link control. Drop its
      design link-target checks.
- [x] Delete `design_index_entries.spec.ts:12` and `:52`, which
      `browse_navigation.spec.ts:43-107`, `browse_variants.spec.ts:93-97` and
      the Milestone 3 unit checks cover.
- [x] Delete test helpers that no file imports anymore, such as
      `tests/browser/design_test_helpers.ts`.
- [x] Run each changed runtime spec and
      `node --import tsx --test tests/browser_shard_balance.test.ts`. Split a
      spec if a shard exceeds its limit.
- [x] Update the Delivery Status in the design verification protocol.
- [x] Move shared native-link focus into `tests/browser/link_focus.ts`. Keep the
      Example and Pages keyboard checks after the design helper is removed.
- [x] Use the existing non-design `static-example` publication profile for the
      Pages navigation worker. Keep the ordinary preview profile for its other
      callers. Preserve the scheme-swap and comparison-pane assertions.
- [x] Warm the commit's real baseline before the browser run. Keep the normal
      Playwright setup and assertions unchanged.
- [x] Wait for the complete Details frame before clicking its return button in
      the existing Example navigation test. Keep every URL and source assertion.
      The moved history test already waits for this readiness state.
- [x] Run the milestone lint, formatting, and prepared type checks. Audit the
      mainline diff and deletions. Commit with a Conventional Commit and push.

Evidence: `.context/design-mockup-test-boundaries/evidence-history.md`.

## Milestone 4A: Moved assertion equivalence

Completed. Change request 1 restores each missing assertion before the browser directory
move. Keep the original fact, its scope, and its viewport coverage.

- [x] Restore hidden-instance selection visibility in the browser. Assert that
      selection artboards open their Selected instance panel in unit tests.
- [x] Restore number and checkbox input types at each original controls scope.
- [x] Require relative local stylesheet URLs in library samples. Give the
      browser sample test a title that describes its remaining checks.
- [x] Check desktop pane resize while closed. Check the closed 49px mobile
      inspector after expanding the sheet.
- [x] Restore every removed computed-style and visibility assertion in raw
      browser specs. Keep the corresponding unit checks and unique heading count.
- [x] Match absent controls by role and accessible name. Check the actual named
      comparison group and wrapping-label name of Scroll together.
- [x] Restore exact head-status, empty-screen, and selected-props scopes.
- [x] Check onboarding, the Tags group, and Close tag picker names in the owning
      tag-picker unit checks.
- [x] Guard every moved preview loop with its count. Require masks in each
      preview and keep all mask ids unique.
- [x] Verify neighboring protocol claims after the runtime move. Keep the moved
      assertion guarantee aligned with the restored checks.
- [x] Use typed designEntries predicates. Rewrap only the new verification
      protocol. Keep the shell protocol at its exact 351-line cap.
- [x] Run changed unit tests and browser specs. Run lint, changed-file Prettier,
      and prepared type checks. Check shard balance after spec changes.
- [x] Audit the complete mainline diff and deletions. Commit with Conventional
      Commits and push before starting Milestone 5.

Evidence: `.context/design-mockup-test-boundaries/evidence-history.md`.

## Milestone 5: Mockup spec directory and boundary guard

Completed. Put every browser mockup spec in one directory, and make the layer rules
mechanical.

- [x] Add `tests/browser/design/artboards.ts` with
      `designArtboardUrl(path, viewport, scheme?)`. Replace
      `componentDesignUrl` and the ad hoc `pathToFileURL` artboard paths with
      it, then delete `tests/browser/component_design_fixture.ts`.
- [x] Move these specs to `tests/browser/design/`, drop a leading `design_`
      from each file name, and fix their relative imports:
      `design_comparison_stacks`, `design_component_stacks`,
      `design_comparison_scrolling`, `design_scroll_together`,
      `design_comparison_eligibility`, `comparison_design`,
      `design_modern_controls`, `design_top_bar`, `design_library`,
      `design_portable`, `design_index_entries`, `design_appearance`,
      `component_design`, `component_design_inspection`, `component_workspace`,
      `component_surfaces`, `component_controls`, `component_evidence`,
      `component_inspector` and `phone_chrome`.
- [x] Add `tests/design_test_boundaries.test.ts`. Write the scan as a pure
      function, and prove it with one violating sample per rule: a spec under
      `tests/browser/design/` that navigates the served shell or starts an
      export, preview or server; and a spec elsewhere that imports
      `designArtboardUrl` or names `generated/design`. Then assert that the
      real tree passes.
- [x] Update the Playwright commands in the design verification protocol,
      and mark the contract delivered.
- [x] Run `npx playwright test tests/browser/design` and
      `node --import tsx --test tests/browser_shard_balance.test.ts`.
- [x] Test the shared URL helper's viewport, scheme, screen, and component
      sample behavior. Reject unknown entries, runtime content, and missing schemes.
- [x] Run the milestone lint, formatting, and prepared type checks. Audit the
      mainline diff and deletions. Commit with a Conventional Commit and push.

Evidence: `.context/design-mockup-test-boundaries/evidence-history.md`.

## Milestone 5A: Harden the boundary guard

Completed. Change request 2 closes three scanner gaps before final verification resumes.
Milestone 6 verification was deferred until the user approved it.

- [x] Reject literal navigation and unverified URL variables in raw-artboard
      modules. Accept direct helper calls and variables assigned from them.
- [x] Detect raw design paths assembled with join, resolve, templates, file
      URLs, and assigned path pieces. Keep served design routes and markers valid.
- [x] Scan every TypeScript browser module, including helpers and artboards.ts.
- [x] Prove the old gaps with regression failures before fixing the scanner.
      Add accepted examples for helper URL variables and served route forms.
- [x] Update the verification protocol for complete module scanning and URL rules.
- [x] Run boundary tests, lint, changed-file Prettier, and prepared type checks.
      Keep both scanner files at or below 300 lines.
- [x] Audit the mainline diff and deletions. Commit with Conventional Commits
      and push. Stop before any more Milestone 6 full checks.

Evidence: `.context/design-mockup-test-boundaries/evidence-history.md`.

## Milestone 5B: Complete assertion equivalence

Completed. Change request 3 closes the remaining moved-assertion gaps. The user
accepted the fixes before Milestone 6 verification resumed.

- [x] Restore comparison-group visibility and unit presence on the controls
      comparison artboard at both viewports.
- [x] Replace the remaining raw legacy-group text match with parsed named roles.
- [x] Support case-insensitive substring names, fieldset legends, and fallback
      titles. Test each case. Preserve non-exact Playwright absence semantics.
- [x] Narrow the remaining link/attribution selections with type guards.
      Rewrap the verification protocol's long line.
- [x] Restore the Set hint checkbox type on the canonical controls screen.
- [x] Run changed unit tests and raw specs, boundary tests, lint, changed-file
      Prettier, and prepared types. Keep changed TypeScript below 300 lines.
- [x] Audit mainline paths and deletions. Commit with Conventional Commits and
      push in a separate commit. Stop before more Milestone 6 full checks.

Evidence: `.context/design-mockup-test-boundaries/milestone-5b.md`.

## Milestone 6: Verification and review

Prove the whole change, record every removal, and hand it to review. The user
approved Change request 4 and the dependency maintenance that it requires.

- [x] Merge `origin/main` with the source tip captured before integration.
      Audit incoming paths, check exactly two merge parents, inspect the
      remerge diff for each path, and push the merge.
- [x] Integrate the later mainline hydration sample and generated-resource
      audit. Repeat the source-tip audit, exact merge parent check, path
      preservation inspection, and merge push before final verification.
- [x] Apply the plan evidence rule from AGENTS.md. Move every execution record
      and removal justification to `.context/design-mockup-test-boundaries/`.
      Name each evidence file under its related milestone. Keep the verification
      protocol free of evidence logs.
- [x] Retain mainline's source-map-js fix. Patch shell-quote through an installed
      tree as a lockfile-only update. Patch sharp through the existing scoped
      Miniflare override. Update the dependency protocol. Add no exception.
      Commit the dependency maintenance separately and push.
  - [x] Add a bounded shell-quote regression before the patch. Keep ordinary
        quoting behavior. Smoke-test safe SVG rendering with the patched sharp.
- [x] Re-run `npm test` and `npm run test:browser`; every test passes.
- [x] Run `cargo xtask check`.
- [x] Run `git diff --diff-filter=D --name-status origin/main`, and confirm
      that the Removals section names every deleted file.
- [x] Write `.context/pr-description.md`: each removed spec and test with its
      replacement, each moved check with its new home, and the accepted
      coverage losses. Give the dependency commit its own section. Explain
      that its advisories also affect main and that context files stay out of
      the PR. Save removal justifications in the evidence directory.
- [x] Run `git add -A`, commit the completed work using Conventional Commits,
      and push the branch.
- [ ] After the push, use `docs/implementation-review-prompt.md` to review the
      complete local diff against `origin/main`. Report findings without
      changing the implementation. The orchestrator owns this review.

Evidence: `.context/design-mockup-test-boundaries/milestone-6.md`.
Mainline evidence: `.context/design-mockup-test-boundaries/main-integration.md`.
Later mainline evidence: `.context/design-mockup-test-boundaries/late-main-integration.md`.
Dependency evidence: `.context/design-mockup-test-boundaries/dependency-maintenance.md`.
Removal justifications: `.context/design-mockup-test-boundaries/removals.md`.
Deletion evidence: `.context/design-mockup-test-boundaries/deletion-audit.md`.
Test inventory: `.context/design-mockup-test-boundaries/original-test-titles.json`.

## Post-merge follow-up (non-blocking)

- Watch the first `main` CI runs for flaky moved browser checks.

## Out of scope

- Runtime specs that open served design routes as fixtures:
  `browse_history.spec.ts`, `pages.spec.ts`, `document_typography.spec.ts`,
  `standalone_appearance_loading.spec.ts` and
  `react_shell_state_regressions.spec.ts`. They test Mokly's code, but a
  mockup change can break them.
- Pixel comparison against approved mockup images.
- Failing the example build on warnings (`--strict` for `example:build` and
  `example:check`). The example builds without warnings today.
- A check against left-edge accent rails in the mockups.
