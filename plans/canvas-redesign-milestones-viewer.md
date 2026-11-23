# Canvas redesign: viewer milestones

This file holds Milestones 10 to 13 and the added Milestones 15 to 23 of the
[Canvas redesign plan](./canvas-redesign.md). It is a part of that plan, and
the pull request that deletes the plan deletes it too. The plan holds the
status, the summary and the other milestones.

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

- [ ] Restyle the catalogue, the compare toolbar and the search in Canvas.
      Milestone 22 does the top bar.
- [ ] Build the canvas stage: each screen as desktop and mobile frames in
      light and dark, with frame labels and size tags. A component opens as
      its variant set.
- [ ] Add pan, zoom, pinch, the zoom pill, Fit and their keys.
- [ ] Build the use case's section with its step frames, and the removed
      entry's section of historical views with its missing-view note
      (decisions 33 and 34).
- [ ] Float the catalogue and the right panel over the canvas.
- [ ] Build the compact layout: one frame with a frame picker, the dock with
      Catalogue, the current tab and Fit, and the panels as sheets.
- [ ] Restyle the standalone Appearance control. Add `⌘K` and `/` for
      search.
- [ ] Give every viewer focus ring the `@firna/ui` focus glow (decision 38).
- [ ] Remove the preview scheme switch from the top bar; the Frames filter
      chooses the scheme.

## Milestone 12: Right panel and compare

Tags: ui

Depends on: 10, 11

- [ ] Move the inspector to the right panel with Inspect and Changes. Show
      Changes only on changed entries, and let the tab set what a click does.
- [ ] Build Inspect: description, path, source, variants, the frames filter,
      the selected instance's props and size, and the box model. Keep Usage
      and the component tree as sections.
- [ ] Draw the selection with handles, name and size tags, and the padding
      redline.
- [ ] Build Changes: counts, base and head, the compare modes, next and
      previous change, and a slot for the cloud's check.
- [ ] Add the Swipe mode with one divider on every frame. Keep Overlay.
- [ ] List the Example tour as a change in the depicted branch, as
      `mokly-changes.md` requires: Changes counts 11, and the tour gets a
      Changed status and a Changes tab with the stepper and the comparison
      details but no compare modes. Draw the artboards first.
- [ ] Add the own-example row to the other Canvas artboards that draw a
      variant set: the Toolbar's `component-set/toolbar*` variants and the
      Action's sets on `canvas/props/**`, `canvas/components/**` and
      `canvas/evidence/unchanged`.
- [ ] Draw each component frame of the Canvas variant sets at its measured
      document size, as the canvas frames contract says (Milestone 18,
      item 9): for example the Action's own example at 148 × 86 and the
      Toolbar at 401 × 155, in `canvas/parts/set_sketches.tsx`.
- [ ] Comparison panes measure each version with
      `measureContentBox(doc)` from `@mokly/frame/internal` (Milestone 23),
      for decision 23 below.
- [ ] Size a component's frame during a compare at the larger width and
      height of its two versions, measured once when both load (decision 23,
      option A). Change the measurement rule for component frames in
      `mokly-shell-device-chrome.md`, `mokly-comparison-panes.md` and
      `mokly-comparison-scrolling.md`.
- [ ] Delete the old inspector layout and the one-frame stage.
- [ ] Fix the race that opens Props when a third nested disclosure of the
      Components tab opens (4 in 72 rounds under load on a Canvas screen),
      likely in `workspace_instance_selection.ts`. Then move the runtime test
      of `tests/browser/design_library_runtime_cases.ts` to a Canvas screen
      and delete `design/browse/views/screen/tag-picker`, the one older
      design screen that Milestone 18 kept for it, with the library parts
      that only it uses: the device frame, the screen header, the view
      controls and the inspector parts.
- [ ] When the device frame leaves `@mokly/ui`, remove the device artwork
      sentences and tokens from `mokly-viewer-appearance.md`,
      `mokly-viewer-palette.md` and `mokly-viewer-palette-preview.md`, and
      rewrite the use-case stage paragraph of `packages/viewer/src/shell/README.md`.
      Redraw the cloud viewer drawings that show their sample screen in a
      device frame: `cloud/viewer-chrome.md:208-209`,
      `cloud/product-mockups-viewer.md:47-48` and `:164-165`, and
      `cloud/mockups.md:152-154`.
- [ ] List an ignored-only entry's ignored ids in Current too, as
      `mokly-css-evidence-presentation.md` requires. Today
      `workspace_evidence.tsx` lists them only while a comparison is loaded.
      Add a unit test.

## Milestone 13: Cloud viewer chrome

Tags: ui

Depends on: 12

- [ ] Rebuild the bar: project switcher, publication pill, Search, History,
      Share and account. Remove the Settings button.
- [ ] Build the account menu with Theme, Settings and Sign out. Store the
      theme choice on the device.
- [ ] Fill the Changes check slot with the Mokly check.
- [ ] Restyle the panels, the switcher, Share, History and the settings
      dialog.
- [ ] End the More menu with the same account rows on compact widths.
- [ ] After Settings leaves the bar, measure the bar's label and SHA widths
      again, so History's label and the SHA show at 1180px, as the prototype
      shows them.
- [ ] Give the registered Button an optional content node, so the pill draws
      its branch in mono and is one control (decision 39).
- [ ] Add Docs and Changelog rows to the account menu and to More on phones
      (decision 22, option B). Change the account menu mockup first, then
      `marketing-site.md` and the other docs that describe the menu.

## Milestone 15: Mockup fixes from the docs

Tags: mockup

Depends on: 2

Milestone 2 found three mismatches between the protocol docs and the merged
mockups. Decision 11 may add more work to this milestone.

- [x] Give the site scheme control's chosen segment a `borderStrong` ring, and
      raise the Browse sheet grabber to 3:1 (Milestone 2 item 24). Branch:
      `calummoore/canvas-redesign-m15-mockup-fixes-phap`.
- [x] Draw ordinary docs code panels with the language tab only, without a
      file tab (item 26). Branch:
      `calummoore/canvas-redesign-m15-mockup-fixes-phap`.
- [x] Draw the HTML sample band's Desktop view (item 28). Branch:
      `calummoore/canvas-redesign-m15-mockup-fixes-phap`.
- [x] Run the mockup checks of the changed catalogues. Branch:
      `calummoore/canvas-redesign-m15-mockup-fixes-phap`.

## Milestone 16: Protocol docs second pass

Depends on: 2

Milestone 2 found about 45 statements in protocol pages outside its scope that
the new pages make wrong (item 19). Guides and code READMEs still change with
their code.

- [x] Bring every other protocol page in line with the Canvas requirements:
      the inspector, compare modes, version registries, the viewer slots,
      Folio and Inter, the cloud controls and the app scheme. Leave the frame
      probe pages to Milestone 10 and the guide fence pages to Milestone 7.
      Branch: `calummoore/canvas-redesign-m16-protocol-docs-second-6n73`.
- [x] Run the Markdown checks. Branch:
      `calummoore/canvas-redesign-m16-protocol-docs-second-6n73`.

## Milestone 17: Canvas default in the open-source shell

Depends on: 3

Under decision 11, option D, Milestone 18 removes the older Browse design
screens, so this milestone does not re-theme them. It runs at the same time as
Milestone 18 and leaves `examples/basic/specs/design/` to it.

- [x] Generate the `@mokly/ui` theme stylesheet and the `mokly-html` Markdown
      style from the palette module, with Canvas as the default. Branch:
      `calummoore/canvas-redesign-m17-canvas-default-in-77ix`.
- [x] Add the drift check that compares the generated files with the module.
      Branch: `calummoore/canvas-redesign-m17-canvas-default-in-77ix`.
- [x] Replace Inter with Geist in `packages/viewer/src/shell/assets/fonts/`,
      `crates/mokly-server/src/assets.rs` and `examples/basic/design.css`.
      Branch: `calummoore/canvas-redesign-m17-canvas-default-in-77ix`.
- [x] Run `cargo xtask mokly-fixtures` and commit any changed fixtures.
      Branch: `calummoore/canvas-redesign-m17-canvas-default-in-77ix`.
- [x] Switch the shell mark's rules to `onSignal` and its front layer to
      `signal`, and remove `docs/mockups/styles/fonts/inter.css` and its Inter
      files. Branch: `calummoore/canvas-redesign-m17-canvas-default-in-77ix`.

## Milestone 18: One Canvas family of Browse designs

Tags: mockup

Depends on: 1, 3

Decision 11, option D. The design catalogue keeps one Canvas family of Browse
screens, which Milestones 11 and 12 build.

- [x] Map each older design screen under `examples/basic/specs/design/` to its
      Canvas successor, or name it obsolete. Branch:
      `calummoore/canvas-redesign-m18-one-canvas-family-of-379b`.
- [x] Draw one Canvas screen for each state kind that has none: the removed
      and moved outcomes, use-case flows, loading and recovery, tag search,
      and the component explorer pages. Branch:
      `calummoore/canvas-redesign-m18-one-canvas-family-of-379b`, then
      `calummoore/canvas-redesign-m18-finish-one-canvas-jd5q`.
- [x] Remove the older screens, their scaffolds and sheets, the seven
      library parts that only they use, and their fixtures. Move the specs and
      tests that name them to Canvas or example entries. Branch:
      `calummoore/canvas-redesign-m18-one-canvas-family-of-379b`, then
      `calummoore/canvas-redesign-m18-finish-one-canvas-jd5q`.
- [x] Link the Canvas sheets through a `design/canvas/**` route. Branch:
      `calummoore/canvas-redesign-m18-one-canvas-family-of-379b`.
- [x] Update the design inventory pages and the mockups README. Branch:
      `calummoore/canvas-redesign-m18-one-canvas-family-of-379b`.
- [x] Run the mockup check of the example catalogue. Branch:
      `calummoore/canvas-redesign-m18-one-canvas-family-of-379b`.

## Milestone 19: Geist in Markdown documents

Depends on: 17

Decision 36, option C. Each Markdown document loads the viewer's Geist and
Geist Mono files, so a reader without Geist installed sees the same faces as
the shell.

- [x] Give the document style `@font-face` rules that load the viewer's two
      Geist files from a document-relative address, in Serve, the static
      build and a publication. Branch:
      `calummoore/canvas-redesign-m19-geist-in-markdown-7brr`.
- [x] Let the referenced closure accept those two font files, and write the
      delivery rule in the protocol pages. Branch:
      `calummoore/canvas-redesign-m19-geist-in-markdown-7brr`.
- [x] Check the documents on the cloud catalogue origin under its CSP.
      Branch: `calummoore/canvas-redesign-m19-geist-in-markdown-7brr`.
- [x] Remove the status-line part of `mokly-viewer-palette.md`, delete
      `plans/follow-ups/markdown-documents-load-no-geist.md`, and run
      `cargo xtask mokly-fixtures`. Branch:
      `calummoore/canvas-redesign-m19-geist-in-markdown-7brr`.

## Milestone 20: Site decisions of 2026-11-22

Tags: ui, mockup

Depends on: 5, 6, 8, 9

Cal's answers to the site decisions. Each change starts in the site mockups,
then the site follows.

- [x] 24 A and 31 C: one 200% text pass over every page and the chrome at
      320px. The bar hides the wordmark when its three controls do not fit,
      footer links break long words, and no page scrolls sideways.
      Branch: `calummoore/canvas-redesign-m20-site-decisions-of-fqcp`.
- [x] 32: every site focus ring uses the `@firna/ui` focus design, a soft
      glow in place of an outline, and keeps 3:1 against its backdrop.
      Change `site-design.md`, the mockups and the style test.
      Branch: `calummoore/canvas-redesign-m20-site-decisions-of-fqcp`.
- [x] 26 C: the tint test accepts a mix whose every part is a role,
      `currentColor`, `transparent` or another such mix. Restore the six
      approved nested demo app mixes.
      Branch: `calummoore/canvas-redesign-m20-site-decisions-of-fqcp`.
- [x] 25 A: weaken the mockup reset to `:where(.site-root) p`, and keep 4px
      under the footer headings.
      Branch: `calummoore/canvas-redesign-m20-site-decisions-of-fqcp`.
- [x] 27 B: a press on the search scrim closes docs search. 28 B: remove the
      1100px allowance and its parity branches. 30 B: the sample tab's file
      name shrinks with an ellipsis.
      Branch: `calummoore/canvas-redesign-m20-site-decisions-of-fqcp`.
- [x] 21 C: one Privacy Policy edit for the site's scheme choice, the docs
      list position and the app's Theme, with all four legal dates.
      Branch: `calummoore/canvas-redesign-m20-site-decisions-of-fqcp`.
- [x] 20 A with D: keep the demo app and the people as fiction, mark each
      drawing of an unshipped feature in the site source, and add the marks
      to the go-live pass. 12 D: record the site-wide checks as one
      follow-up item.
      Branch: `calummoore/canvas-redesign-m20-site-decisions-of-fqcp`.

## Milestone 21: Previous-version addresses

Depends on: 19

Follow-up item 37, option B, which Cal chose on 2026-11-22.

- [x] Rewrite the relative addresses of a previous version when the viewer
      prepares it, so that it needs no `base` element, with a browser test
      that uses a relative image on the catalogue origin. Branch:
      `calummoore/canvas-redesign-m21-previous-version-9sa7`.
- [x] Delete `plans/follow-ups/catalogue-base-uri-blocks-previous-version.md`.
      Branch: `calummoore/canvas-redesign-m21-previous-version-9sa7`.

## Milestone 22: Viewer bar to the prototype

Tags: ui, mockup

Depends on: 17

Cal, 2026-11-22: the cloud header bar does not match the prototype. The
package top bar puts the cloud's start slot before the Mokly mark and a wide
search field in the middle. The prototype starts with the mark, then the
workspace and project, centres the publication pill, and ends with a compact
Search, History and Share with icons, and the account.

- [x] Lay out the `@mokly/ui` top bar as the prototype bar: the mark, the
      start slot, the centred publication, then a compact search before the
      end slot. Keep the `mokly serve` bar (mark, search, Appearance).
      Branch: `calummoore/canvas-redesign-m22-viewer-bar-to-the-19n5`.
- [x] Draw the cloud slot content as the prototype: `workspace / project`
      with the workspace muted, the publication pill, History with its icon,
      Share and the account. Leave out the presence avatars (decision 9).
      Branch: `calummoore/canvas-redesign-m22-viewer-bar-to-the-19n5`.
- [x] Show the mark in the compact embedded bar, as the prototype does at
      390px. The catalogue button stays until Milestone 11 builds the dock.
      Branch: `calummoore/canvas-redesign-m22-viewer-bar-to-the-19n5`.
- [x] Bring the cloud viewer mockups, `viewer-chrome.md` and
      `mokly-shell-design.md` in line, and check the bar at 390, 1024, 1180
      and 1440px against the prototype.
      Branch: `calummoore/canvas-redesign-m22-viewer-bar-to-the-19n5`.

## Milestone 23: Frame content size

Depends on: 10

A leaf component registers no instance, so the viewer cannot size its frame
to its content, as the canvas frames contract requires. Decision 23 = A also
needs the measured size of both versions in a compare.

- [x] Add an optional content-box measurement to the frame probe and the
      mounted frame, in frame wire version 4, which `main` has not released.
      Branch: `calummoore/canvas-redesign-m23-frame-content-size-nsqf`.
- [x] Give same-origin and cross-origin adapters the method, with unit tests,
      and keep the probe inside its size budget. Branch:
      `calummoore/canvas-redesign-m23-frame-content-size-nsqf`.
- [x] Bring the frame probe, wire and adapter pages in line, and run
      `cargo xtask mokly-fixtures`. Branch:
      `calummoore/canvas-redesign-m23-frame-content-size-nsqf`.
