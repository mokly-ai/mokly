# Canvas redesign: viewer milestones

This file holds Milestones 10 to 13 and the added Milestones 15 to 19 of the
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

Depends on: 15, 17, 18

- [ ] Restyle the catalogue, the top bar, the compare toolbar and the search
      in Canvas.
- [ ] Build the canvas stage: each screen as desktop and mobile frames in
      light and dark, with frame labels and size tags. A component opens as
      its variant set.
- [ ] Add pan, zoom, pinch, the zoom pill, Fit and their keys.
- [ ] Float the catalogue and the right panel over the canvas.
- [ ] Build the compact layout: one frame with a frame picker, the dock with
      Catalogue, the current tab and Fit, and the panels as sheets.
- [ ] Restyle the standalone Appearance control. Add `⌘K` and `/` for
      search.

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
- [ ] Delete the old inspector layout and the one-frame stage.
- [ ] Fix the race that opens Props when a third nested disclosure of the
      Components tab opens (4 in 72 rounds under load on a Canvas screen),
      likely in `workspace_instance_selection.ts`. Then move the runtime test
      of `tests/browser/design_library_runtime_cases.ts` to a Canvas screen
      and delete `design/browse/views/screen/tag-picker`, the one older
      design screen that Milestone 18 kept for it.
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

- [ ] Map each older design screen under `examples/basic/specs/design/` to its
      Canvas successor, or name it obsolete.
- [ ] Draw one Canvas screen for each state kind that has none: the removed
      and moved outcomes, use-case flows, loading and recovery, tag search,
      and the component explorer pages.
- [ ] Remove the older screens, their scaffolds and sheets, the seven
      library parts that only they use, and their fixtures. Move the specs and
      tests that name them to Canvas or example entries.
- [ ] Link the Canvas sheets through a `design/canvas/**` route.
- [ ] Update the design inventory pages and the mockups README.
- [ ] Run the mockup check of the example catalogue.

## Milestone 19: Geist in Markdown documents

Depends on: 17

Decision 36, option C. Each Markdown document loads the viewer's Geist and
Geist Mono files, so a reader without Geist installed sees the same faces as
the shell.

- [ ] Give the document style `@font-face` rules that load the viewer's two
      Geist files from a document-relative address, in Serve, the static
      build and a publication.
- [ ] Let the referenced closure accept those two font files, and write the
      delivery rule in the protocol pages.
- [ ] Check the documents on the cloud catalogue origin under its CSP.
- [ ] Remove the status-line part of `mokly-viewer-palette.md`, delete
      `plans/follow-ups/markdown-documents-load-no-geist.md`, and run
      `cargo xtask mokly-fixtures`.
