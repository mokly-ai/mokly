# Shell Canvas Frames, Preview Scheme And Compact Layout

Status: The Frames filter, the selection with its pill above the dock, the Changes tab that the dock names, and compare on every frame with the Side by side tags are not built yet. [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds them.

## Canvas Frames

Every view on the canvas stands in a frame. The
[canvas stage](./mokly-shell-canvas-stage.md#section) arranges the frames.
Decision: bare frames at fixed nominal sizes, not a phone bezel and a fluid
browser window, because the canvas compares the views at their real sizes,
side by side, at one zoom.

- **Frame** — a bare rectangle at its nominal size times the zoom, with a
  hairline ring and a soft shadow, and no bezel, notch or browser bar. A
  desktop frame is 1280 × 800 CSS pixels and a mobile frame 390 × 844. The
  frame holds its document at its nominal size and scales it with the zoom.
  The document scrolls inside the frame. A component's frame holds the
  document of its own example or of a saved variant at the document's own
  size.
- **Label** — above the frame's left edge, in the mono face: the glyph of the
  frame's kind and the frame's name. A screen's frame is named by its viewport
  and its scheme, such as `Desktop · Light`. A component's frame is named by
  its saved variant and its scheme, such as `Default · Light`. The frame of a
  component's own example is named by the component's title and its scheme,
  such as `Action · Light`. A reading frame
  is named by its source file, such as `payment-terms.md`. A step frame is
  named by its step, not by its viewport and scheme: the step's number in a
  dark tag, which reads as `Step 1`, and the step's title. Where one frame
  stands for the entry, as in the compact layout, the entry's slug leads the
  name: `welcome · Mobile · Light`. The label of the frame that holds the selection,
  a selected instance or the frame itself, reads in the signal colour.
- **Size tag** — above the frame's right edge: the nominal width and height in
  CSS pixels, such as `1280 × 800`. The size tag reads whole CSS pixels,
  rounded, so a component's document of 147.73 × 86 reads `148 × 86`. The
  size tag stays muted when the label takes the signal colour. A frame too
  narrow on the canvas for its label and its size tag keeps the label and
  drops the size tag.
- **Reading frame** — the one frame of a page or a Markdown document, current
  or removed. It shows a document in the shell's Markdown typography, and a
  page as its one document. Its document reflows to the frame's width, so it
  has no size tag. Decision: one reading frame, not device frames, because a
  page and a document have no viewport.
- **Step frame** — the frame of one use-case step: a desktop or a mobile frame,
  for the viewport that the Frames filter chooses. The step's title in the
  label is a link, with a chevron, that opens the step's screen. The link's
  accessible name names that screen. The step's description reads muted below
  the label, and a description too long for the frame ends in an ellipsis. No
  slug leads a step frame's name, also in the compact layout.
- **Comparison** — in a comparison, each frame of a
  [compared row](./mokly-selected-comparisons.md) holds both versions as its
  compare mode draws them, and a frame whose row does not compare keeps its
  current version. In Side by side, each of the compared frame's two versions
  stands in its own frame, whose label starts with a `Before` or a `Current`
  tag. The [comparison panes](./mokly-comparison-panes.md) fix each mode. A
  screen's frame keeps its nominal size. A component's frame takes the larger
  width and the larger height of its two versions' documents, each measured
  once when both documents load, and both versions share that size. Until
  then, the frame holds the desktop size, at which each document lays out for
  its measurement. Decision: the larger width and height of the two versions,
  not the desktop width with the larger height, which gives a narrow
  component a wide frame, and not each version at its own size, which makes
  Swipe's divider cross a size edge, because one frame then fits both
  versions with one measurement.

## Color Scheme

The interface appearance colours the chrome: the canvas, the panels, the
section, and each frame's label, size tag and ring. A canvas frame's document
shows the view of the frame's own scheme, whatever the interface appearance, so
a screen shows its light and dark views at once. In a standalone catalogue, a
document's reading frame shows the scheme of the interface appearance, and a
page's reading frame shows its one document. An embedded root keeps the
preview scheme apart from its interface appearance, as
[mokly-viewer-appearance.md](./mokly-viewer-appearance.md) describes.

- **Control** — a standalone catalogue carries one Appearance selector in the
  top bar at every width; see
  [mokly-viewer-appearance.md](./mokly-viewer-appearance.md). An embedded root
  takes its appearance from the host's `theme`, and keeps a Dark preview
  control for a view that shows one scheme, only when the catalogue has dark
  fragments. On the canvas, the
  [Frames filter](./mokly-shell-canvas-stage.md#frames-filter) turns the Light
  and Dark frames on and off. Design artboards depict the same top-bar
  Appearance control.
- **Frame surface** — a canvas frame paints the opaque preview surface of its
  own scheme behind its document, from the
  [preview tokens](./mokly-viewer-palette.md#preview-tokens). Its ring and
  shadow follow the interface appearance, so its edge stays visible on the
  canvas in both appearances.
- **Light-only views** — on the canvas, a screen with no dark view has its
  Light frames alone, and the Frames filter's Dark toggle reads `Light only`.
  A use-case step whose screen has no dark view keeps its Light view while
  Dark is chosen, and its label adds `Light only`. A Markdown document with no
  dark document keeps its light document in its reading frame under Dark. The
  reading frame's label then adds `Light only` after the file name, such as
  `payment-terms.md · Light only`.
- **Comparisons** — a comparison on a canvas frame compares the views of that
  frame's viewport and scheme.

## Responsive Behavior

The shell has one layout breakpoint at **56.25rem (900px)** and one panel step
at **73.75rem (1180px)**:

- At or above 900px, the catalogue and the right panel float over the canvas,
  under the [canvas stage](./mokly-shell-canvas-stage.md#canvas). Below
  1180px, the floating panels narrow.
- Below 900px, the shell uses the [compact layout](#compact-layout).

`prefers-reduced-motion: reduce` disables shell transitions.

### Compact Layout

Below the layout breakpoint, the shell draws the compact layout, with one
frame at a time:

- The floating panels close. The catalogue and the right panel each open as a
  bottom sheet over the canvas, one at a time, with a grabber and a close
  control named `Close catalogue` or `Close panel`. A sheet spans the shell's
  width and opens at its compact height. Its grabber expands it, and a strip of
  the canvas stays visible above the expanded sheet.
- An entry bar over the top of the canvas names the entry: its title tag, its
  `Component` kind tag, and its change status. A frame picker, a native select
  named `Frame`, stands at the bar's end and lists the entry's shown frames:
  for a screen, the frames of both viewports in the schemes that the Frames
  filter shows. A use case's picker lists its steps by number and title, such
  as `1 · Welcome`. The bar and its picker stay while the selected entry's
  preview loads or failed.
- The canvas shows the picked frame alone, large enough to read. The
  selection's viewport and scheme name a screen's picked frame, and a pick
  sets them. A screen opens on its frame of the selection's viewport, Mobile
  for Both, in the
  [preview scheme](./mokly-viewer-appearance.md#interface-appearance-and-frame-schemes),
  which standalone Browse takes from the effective appearance: with Both,
  Mobile · Light in a Light appearance and Mobile · Dark in a Dark appearance.
  While the Frames filter hides that scheme, the screen opens on that
  viewport's other frame, and while the screen has no frame of that viewport,
  on its first shown frame. A use case opens on its first step. A variant
  set shows the whole set until a selection picks a frame, and then shows that
  frame alone with the picker. A reading frame has no picker. It takes the
  canvas width and reflows its document instead of scaling it.
- The zoom pill is absent. A pinch zooms the canvas, and the dock's Fit
  refits the shown frame to the canvas.
- The dock floats at the bottom centre of the canvas: a group named
  `Canvas controls` with 44px targets. It holds Catalogue, which opens the
  catalogue sheet; the right panel's current tab, Inspect or Changes, which
  names what a tap on the frame does and opens the panel sheet; and Fit. Fit
  shows only while the canvas holds a section, as the
  [zoom pill](./mokly-shell-canvas-stage.md#canvas) does. So while the
  selected entry's preview loads or failed, the dock holds Catalogue and the
  current tab. With nothing selected, the dock holds Catalogue alone. The dock
  hides while a sheet is open.
- While an instance is selected, a pill above the dock names the selection and
  opens the panel sheet. The pill hides while a sheet is open.
- The top bar has no menu button: the dock's Catalogue opens the catalogue
  sheet, and a sheet's close control closes it.
- With Highlight components on, the frame draws its highlight also while the
  sheet that holds the switch is closed.
- The tag picker stops anchoring to the narrow field and drops as a sheet
  spanning the shell, flush under the bar's bottom border with only its lower
  corners rounded.

Decision: one frame with a picker, a dock and sheets, not the floating panels
over a fitted canvas, because a phone has room for one readable frame and its
controls need thumb-sized targets.

## Related Docs

- [Shell design contract](./mokly-shell-design.md)
- [Shell canvas stage](./mokly-shell-canvas-stage.md)
- [Viewer appearance](./mokly-viewer-appearance.md)
- [Viewer semantic palette](./mokly-viewer-palette.md)
