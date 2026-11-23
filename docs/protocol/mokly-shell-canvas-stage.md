# Shell Canvas Stage

Status: The Frames filter in Inspect is not built yet. [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds it.

This continues the [shell design contract](./mokly-shell-design.md#layout). It
fixes the canvas below the top bar: the panels that float over it, the selected
entry's section with its frames, a use case's section, the Frames filter, and
pan, zoom and Fit. The
[canvas frames contract](./mokly-shell-device-chrome.md) fixes each frame,
the preview scheme, and the compact layout below the layout breakpoint.

## Canvas

- The canvas fills the window below the top bar, full bleed, under the floating
  panels. It draws a grid of small dots at a 24px pitch, in the palette's dot
  colour on its background colour. The grid moves with the canvas when it pans.
- The catalogue floats at the left edge and the right panel at the right edge,
  each 8px from the canvas's top, bottom and outer edges, with a 12px radius, a
  hairline and a soft shadow. The catalogue is 252px wide and the right panel
  312px. While the shell is narrower than 73.75rem (1180px), they are 224px and
  284px wide. The [navigation design](./mokly-shell-design-navigation.md) lets
  the reader resize the catalogue.
- The right panel shows only while an entry is selected. With nothing selected,
  the canvas holds the home guidance of the
  [shell design](./mokly-shell-design.md#layout) and no section.
- The stage is the part of the canvas between the floating panels and above
  the zoom pill. Fit and centring use the stage. Panning can move a frame under
  a panel.
- While the canvas holds a section, the zoom pill floats at the bottom centre
  of the stage, 12px above the canvas's bottom edge. It is a group named
  `Zoom` that holds Zoom out, the zoom as a whole percentage, Zoom in, and
  Fit. While the canvas holds no section, such as with nothing selected or
  while the selected entry's preview loads or failed, it has no zoom pill.
  Decision: the zoom controls show only while the canvas holds a section, not
  whenever an entry is selected and not as a disabled pill, because they act
  only on a section, and a control that does nothing adds noise.
- The panels, the zoom pill, the section head, and the frames' labels and size
  tags keep their size at every zoom.

Decision: the full canvas with pan and zoom, not a restyled one-frame stage or
a fitted view without zoom, because a reader compares every viewport and scheme
of a screen at once, as frames in a design file.

## Section

The selected entry stands on the canvas as one section.

- A component's section is a dashed outline with no fill. Every other section
  is a box with a 16px radius, a faint fill and a hairline ring.
- The section's head, at its top left, names the entry: its title in a dark
  tag, a `Component` kind tag for a component, a monospace path chip with the
  entry's path as written and no `#` prefix, and its change status. The path
  chip copies the path without navigating. It uses the standard pointer cursor
  and moves down 1px with an inset shadow while pressed.
- A screen opens as its frames at one zoom: Desktop beside Mobile, and the
  Light row above the Dark row. A screen without a dark view has the Light row
  alone. The [canvas frames](./mokly-shell-device-chrome.md#canvas-frames) give
  each frame's size and label.
- A component opens as its variant set. The set starts with a row for the
  component's own example, which shows the component with its own props. One
  row for each saved variant follows, in the variants' order. Each row has its
  Light frame beside its Dark frame. A component without saved variants has
  its own example's row alone.
- A page or a Markdown document opens as one reading frame.
- A use case opens as one row of step frames, as [Use Case](#use-case) gives.
- A removed screen, page or document opens as the section of its previous
  version, under the
  [removed previews](./mokly-removed-previews.md#behavior) contract.
- While the selected entry's preview loads, or after it failed, the canvas
  holds that state in place of the section.

## Frames Filter

The Frames filter in [Inspect](./mokly-component-inspector-design.md) turns the
frames of each viewport and each scheme on and off. It replaces the viewport
choice. Decision: one filter of the shown frames, not a viewport dropdown with
a scheme control, because the canvas shows every frame at once and the reader
hides only the frames that they do not compare.

- A frame that the filter turns off leaves the canvas, and the stage refits
  around the frames that stay.
- A screen's section keeps one row for each shown scheme, Light above Dark.
  With one viewport turned off, the frames of the other viewport form one
  column.
- A variant set has no viewport toggles, because its frames have no viewport.
- A use case's filter chooses one viewport and one scheme, as
  [Use Case](#use-case) gives.
- A screen without a dark view disables the Dark toggle, which reads
  `Light only`.
- The filter holds the Highlight components switch. With the switch on, every
  shown frame draws the highlight of its view's registered instances.
- A toggle that hides a changed view carries the change dot: a 6px accent dot
  in its top-right corner, ringed 1.5px in the surface colour. The toggle names
  a visually hidden `Other viewport changed` or `Other theme changed` through
  `aria-describedby`. The dot stays distinct from selection and draws no rail.

## Pan, Zoom And Fit

- An entry opens fitted. Fit chooses the largest zoom, up to 100%, at which
  every shown frame and its label fit the stage, and it centres the section.
- A drag on the canvas around the frames pans it. The wheel and a two-finger
  trackpad scroll over the canvas pan it too. On a touch screen, one finger
  pans.
- The wheel and a swipe over a frame scroll that frame's document. They do not
  pan the canvas, also at either end of the document.
- ⌘ or Ctrl with the wheel, a trackpad pinch, and a two-finger pinch on a touch
  screen zoom the canvas about the pointer or the pinch.
- The pill's Zoom in and Zoom out, and the keys `+` (or `=`) and `-`, step the
  zoom about the stage's centre. Shift+0 shows 100%. Shift+1 and the pill's
  Fit refit the stage. These keys act while focus is not in a text field, and
  not while ⌘, Ctrl or Alt is held.
- Opening another entry fits it. Changing the Frames filter refits the stage.
  While the stage stays fitted, it refits when the stage changes size. After
  the reader pans or zooms, the stage keeps its zoom and its position until the
  next Fit.
- The zoom scales each frame with its document. A frame's document lays out at
  the frame's nominal size at every zoom.

## Use Case

A use case opens as one section of its steps. The section pans, zooms and fits
as a screen's section does.

- The section holds one canvas frame for each step, in step order, in one row
  from left to right, at one zoom. Each
  [step frame](./mokly-shell-device-chrome.md#canvas-frames) shows its step
  screen's view of the viewport and the scheme that the Frames filter chooses.
- The Frames filter of a use case holds two choices: Mobile or Desktop, and
  Light or Dark. Choosing one turns the other off, so each step shows one
  frame.
- A use case always opens on Desktop and Light at or above the layout
  breakpoint, and on Mobile and Light in the compact layout. A choice in its
  Frames filter applies to that use case alone. A screen keeps its own Frames
  filter, which a use case neither reads nor changes. Decision: a use case
  opens on these fixed choices and keeps its own choice, not on the
  selection's saved viewport and scheme and not with a filter that it shares
  with the screens, because it then always opens the same way and leaves the
  reader's screen filter as they set it.
- When no step's screen has a dark view, the Dark toggle is disabled and reads
  `Light only`. A step whose screen has no dark view follows the
  [light-only rule](./mokly-shell-device-chrome.md#color-scheme).
- Below the layout breakpoint, the
  [compact layout](./mokly-shell-device-chrome.md#compact-layout) shows one
  step at a time.
- A use case offers no compare mode. The comparison of each step stays on the
  step's screen.

Decision: a use case opens as one row of step frames that pans, zooms and fits
like a screen, not as a column of steps in device frames or in canvas frames
at a fixed zoom, because one frame model then serves every entry kind. Each
step shows one frame, not one for each viewport and scheme, because five steps
would then show twenty frames.

## Related Docs

- [Shell design contract](./mokly-shell-design.md)
- [Shell canvas frames, preview scheme and compact layout](./mokly-shell-device-chrome.md)
- [Shell navigation design](./mokly-shell-design-navigation.md)
- [Component inspector design](./mokly-component-inspector-design.md)
- [Comparison panes](./mokly-comparison-panes.md)
- [Removed content previews](./mokly-removed-previews.md)
- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
