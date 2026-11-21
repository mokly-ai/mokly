# Canvas redesign: viewer milestones

This file holds Milestones 10 to 13 and the added Milestones 15 and 16 of the
[Canvas redesign plan](./canvas-redesign.md). It is a part of that plan, and
the pull request that deletes the plan deletes it too. The plan holds the
status, the summary and the other milestones.

## Milestone 10: Frame probe box model

Depends on: 2

- [ ] Report each instance's padding, border and content size from the frame
      probe, in the wire format of the frame probe docs.
- [ ] Expose the sizes to the viewer selection, with unit tests.
- [ ] Bump the frame wire version to 4 in `mokly-format-versions.md` and
      `cloud/mokly-artifact-compatibility.md`. Keep the probe script inside
      its size budget.

## Milestone 11: Canvas stage in `@mokly/ui`

Tags: ui

Depends on: 3, 15

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

- [ ] Give the site scheme control's chosen segment a `borderStrong` ring, and
      raise the Browse sheet grabber to 3:1 (Milestone 2 item 24).
- [ ] Draw ordinary docs code panels with the language tab only, without a
      file tab (item 26).
- [ ] Draw the HTML sample band's Desktop view (item 28).
- [ ] Run the mockup checks of the changed catalogues.

## Milestone 16: Protocol docs second pass

Depends on: 2

Milestone 2 found about 45 statements in protocol pages outside its scope that
the new pages make wrong (item 19). Guides and code READMEs still change with
their code.

- [ ] Bring every other protocol page in line with the Canvas requirements:
      the inspector, compare modes, version registries, the viewer slots,
      Folio and Inter, the cloud controls and the app scheme. Leave the frame
      probe pages to Milestone 10 and the guide fence pages to Milestone 7.
- [ ] Run the Markdown checks.
