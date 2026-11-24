# Canvas redesign: viewer milestones

This file holds Milestones 10 to 13 of the
[Canvas redesign plan](./canvas-redesign.md). It is a part of that plan, and
the pull request that deletes the plan deletes it too. The plan holds the
status, the summary and the other milestones. The added Milestones 15 to 25
are in [the added milestones file](./canvas-redesign-milestones-added.md).

## Milestone 10: Frame probe box model

Depends on: 2

- [x] Report each instance's padding, border and content size from the frame
      probe, in the wire format of the frame probe docs. Branch:
      `calummoore/canvas-redesign-m10-frame-probe-box-q3gr`.
- [x] Expose the sizes to the viewer selection, with unit tests. Branch:
      `calummoore/canvas-redesign-m10-frame-probe-box-q3gr`.
- [x] Bump the frame wire version to 4 in `mokly-format-versions.md` and
      `cloud/mokly-artifact-compatibility.md`. Keep the probe script inside
      its size budget. Branch:
      `calummoore/canvas-redesign-m10-frame-probe-box-q3gr`.

## Milestone 11: Canvas stage in `@mokly/ui`

Tags: ui

Depends on: 15, 17. It starts before 18 and 22 merge, and takes them in as they land (Cal, 2026-11-22).

- [x] Restyle the catalogue, the compare toolbar and the search in Canvas.
      Milestone 22 does the top bar. Branch:
      `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- [x] Build the canvas stage: each screen as desktop and mobile frames in
      light and dark, with frame labels and size tags. A component opens as
      its variant set. Branch:
      `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- [x] Add pan, zoom, pinch, the zoom pill, Fit and their keys. Branch:
      `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- [x] Build the use case's section with its step frames, and the removed
      entry's section of historical views with its missing-view note
      (decisions 33 and 34). Branch:
      `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- [x] Float the catalogue and the right panel over the canvas. Branch:
      `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- [x] Build the compact layout: one frame with a frame picker, the dock with
      Catalogue, the current tab and Fit, and the panels as sheets. Branch:
      `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- [x] Restyle the standalone Appearance control. Add `⌘K` and `/` for
      search. Branch:
      `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- [x] Give every viewer focus ring the `@firna/ui` focus glow (decision 38).
      Branch: `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- [x] Remove the preview scheme switch from the top bar; the Frames filter
      chooses the scheme. Branch:
      `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.

## Milestone 12: Right panel and compare

Tags: ui

Depends on: 10, 11

- [x] Move the inspector to the right panel with Inspect and Changes. Show
      Changes only on changed entries, and let the tab set what a click does. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Build Inspect: description, path, source, variants, the frames filter,
      the selected instance's props and size, and the box model. Keep Usage
      and the component tree as sections. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Draw the selection with handles, name and size tags, and the padding
      redline. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Build Changes: counts, base and head, the compare modes, next and
      previous change, and a slot for the cloud's check. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Add the Swipe mode with one divider on every frame. Keep Overlay. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] List the Example tour as a change in the depicted branch, as
      `mokly-changes.md` requires: Changes counts 11, and the tour gets a
      Changed status and a Changes tab with the stepper and the comparison
      details but no compare modes. Milestone 24 draws the artboards. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Give `ComparisonEvidence` the changed-step lines of a listed use case
      ("Changed step: Welcome"), each a link to that screen on its Changes
      tab, as Milestone 24 draws them. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Milestone 24: add the own-example row to the other Canvas artboards that draw a
      variant set: the Toolbar's `component-set/toolbar*` variants and the
      Action's sets on `canvas/props/**`, `canvas/components/**` and
      `canvas/evidence/unchanged`. Branch:
      `calummoore/canvas-redesign-m24-mockups-for-708g`.
- [x] Milestone 24: draw each component frame of the Canvas variant sets at its measured
      document size, as the canvas frames contract says (Milestone 18,
      item 9): for example the Action's own example at 148 × 86 and the
      Toolbar at 401 × 155, in `canvas/parts/set_sketches.tsx`. Branch:
      `calummoore/canvas-redesign-m24-mockups-for-708g`.
- [x] Put comparison panes on the canvas input: `comparison_frame.tsx` gives
      each pane's `SnapshotFrame` the `canvasInput` prop, its listener calls
      `routeFrameInput(control, event, frame.current)` with `control` from
      `CanvasControlContext`, the pane's `focusVisible` follows `canvas-focus`
      and `canvas-blur`, and the panes render inside the canvas providers. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Update the guides that describe the old stage:
      `docs/guides/catalogue/browse.md` ("Look at a screen", the drawer,
      "Details"), `docs/guides/catalogue/changes.md:196-206`,
      `docs/guides/authoring/screens.md:189` and
      `docs/guides/authoring/storybook.md:67`. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Comparison panes measure each version with
      `measureContentBox(doc)` from `@mokly/frame/internal` (Milestone 23),
      for decision 23 below. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Size a component's frame during a compare at the larger width and
      height of its two versions, measured once when both load (decision 23,
      option A). Change the measurement rule for component frames in
      `mokly-shell-device-chrome.md`, `mokly-comparison-panes.md` and
      `mokly-comparison-scrolling.md`. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Delete the old inspector layout and the one-frame stage. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Fix the race that opens Props when a third nested disclosure of the
      Components tab opens (4 in 72 rounds under load on a Canvas screen),
      likely in `workspace_instance_selection.ts`. Then move the runtime test
      of `tests/browser/design_library_runtime_cases.ts` to a Canvas screen
      and delete `design/browse/views/screen/tag-picker`, the one older
      design screen that Milestone 18 kept for it, with the library parts
      that only it uses: the device frame, the screen header, the view
      controls and the inspector parts. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] When the device frame leaves `@mokly/ui`, remove the device artwork
      sentences and tokens from `mokly-viewer-appearance.md`,
      `mokly-viewer-palette.md` and `mokly-viewer-palette-preview.md`, and
      rewrite the use-case stage paragraph of `packages/viewer/src/shell/README.md`.
      Redraw the cloud viewer drawings that show their sample screen in a
      device frame: `cloud/viewer-chrome.md:208-209`,
      `cloud/product-mockups-viewer.md:47-48` and `:164-165`, and
      `cloud/mockups.md:152-154`. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] List an ignored-only entry's ignored ids in Current too, as
      `mokly-css-evidence-presentation.md` requires. Today
      `workspace_evidence.tsx` lists them only while a comparison is loaded.
      Add a unit test. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Give every fixed-size tag on a frame one rule at a small zoom: the
      Highlight components labels, which cover frame content at fit (Milestone
      11, item 10), and the selection's name and size tags. Write the rule in
      `mokly-viewer-selection-canvas.md`. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- [x] Draw the focus glow in the three mockup sheets that still draw an
      outline: `examples/basic/design-components.css`,
      `design-library/inspector/frames-filter.css` and
      `design-library/panels/compare-modes.css`. Branch:
      `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.

## Milestone 13: Cloud viewer chrome

Tags: ui

Depends on: 12, only for the check slot

- [x] Rebuild the bar: project switcher, publication pill, Search, History,
      Share and account. Remove the Settings button.
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
- [x] Build the account menu with Theme, Settings and Sign out. Store the
      theme choice on the device.
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
- [ ] Fill the Changes check slot with the Mokly check.
- [x] Restyle the panels, the switcher, Share, History and the settings
      dialog.
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
- [x] End the More menu with the same account rows on compact widths.
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
- [x] After Settings leaves the bar, measure the bar's label and SHA widths
      again, so History's label and the SHA show at 1180px, as the prototype
      shows them.
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
- [x] Give the registered Button an optional content node, so the pill draws
      its branch in mono and is one control (decision 39).
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
- [x] Add Docs and Changelog rows to the account menu and to More on phones
      (decision 22, option B). Milestone 24 changes the account menu mockup
      and the docs first.
      `@firna/ui` menu rows take no `href`, and that package lives in another
      repository, so the cloud draws its own link row (an anchor with the
      `menuitem` role) inside the same list chrome. Record a follow-up item to
      move the link row into `@firna/ui`.
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
- [x] Give `siteLinks` in `packages/app/src/config.ts` and the mockup fixture
      `docs/mockups/src/fixtures/site.ts` the site's trailing slash: `/docs/`
      and `/changelog/`.
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
- [x] Make `both` the cloud's viewport default, as in the package (Milestone
      11, item 9, option C), so a phone opens a screen on its Mobile frame and
      a wide canvas shows both columns. Change the address mapping, Share,
      their tests and `docs/protocol/cloud/viewer-address-state.md:62`.
      Branch: `calummoore/canvas-redesign-m13-cloud-viewer-chrome-4gms`.
