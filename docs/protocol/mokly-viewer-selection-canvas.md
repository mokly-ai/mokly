# Canvas Selection

Status: The canvas and the selection on it are not built yet. The [Canvas stage milestone](../../plans/canvas-redesign-milestones-viewer.md#milestone-11-canvas-stage-in-moklyui) builds the canvas, and the [right panel and compare milestone](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds the selection.

This continues the [selection contract](./mokly-viewer-selection.md). The
[canvas stage](./mokly-shell-canvas-stage.md) defines the canvas and its zoom,
and the [canvas frames](./mokly-shell-device-chrome.md#canvas-frames) define
its frames. The [inspector design](./mokly-component-inspector-design.md)
defines the right panel, whose Selection section shows what the reader selects
on the canvas.

## Clicks By Tab

The selected tab of the right panel sets what a click on the canvas does. In
the [compact layout](./mokly-shell-device-chrome.md#compact-layout), the dock
names that tab.

In Inspect, a click on an element of a frame selects the innermost component
instance under the pointer, under the
[hover rule](./mokly-viewer-selection.md#selection-events-and-imperative-use).
A click that follows a link under the
[navigation contract](./mokly-navigation.md#enhanced-navigation-and-safe-degradation)
selects nothing. On a variant set, a click on a frame's label selects that
frame, and choosing a variant in Inspect selects the variant's Light frame.
Selecting an instance in the component tree selects it as a click does, on the
frame whose instances the tree lists. A click on the empty canvas, or Escape,
clears the selection. At most one instance or one frame is selected at a time.

In Changes, a click on a frame selects nothing, and the canvas draws no
selection. The frames keep the compare mode, and a drag on the Swipe divider
moves it under the [pane contract](./mokly-comparison-panes.md#layout).
Decision: a click in Changes selects nothing, not an instance as in Inspect,
because the selected tab sets what a click does and Changes compares. Its
comparison documents have no inspection either.

While a host pick is active, a click answers the pick under the
[selection contract](./mokly-viewer-selection.md#selection-events-and-imperative-use)
in either tab, and the canvas selection stays as it is.

## Selected Instance

A selected instance belongs to the frame where the reader selected it. Its box
is the instance's border box from the
[box model](./mokly-frame-adapter.md#box-model). An instance without a box
model uses the smallest rectangle that holds its boxes in that frame. The
canvas draws a signal outline around that box, with eight square handles at
its corners and at the middle of its sides. A tag above the top-left corner
names the instance's component, and a tag below the middle gives the box's
size. When the instance has a box model and a left padding, a redline measures
that padding from the inside of the border to the content, with the value in a
tag outside the box. The redline hides while the padding is too narrow on
screen to read. The handles and the tags keep their size at every zoom, and
the redline's length follows the frame's scale.

The outline follows the instance's geometry as a highlight does, and the
viewer measures the box model again after each `geometry` event. A frame
replacement clears the selection, as the
[selection contract](./mokly-viewer-selection.md#selection-events-and-imperative-use)
says for inspection. A selected instance that leaves its frame's ready usage is
cleared too.

A Used by link that names an instance opens its screen with that instance
selected, on the frame of the link's recorded viewport and scheme, under the
[explorer contract](./mokly-component-explorer.md#components-in-the-screen-inspector).

## Selected Frame

A selected frame draws a signal outline around the frame, with a handle at
each corner and the frame's size in a tag below its middle. The frame's
[label](./mokly-shell-device-chrome.md#canvas-frames) names it, so the
selection has no name tag and no redline. The variant set's Props then edits
the variant of that frame, under the
[inspector design](./mokly-component-inspector-design.md#inspect).

## Sizes

The selection and Inspect show each length in CSS pixels, rounded to a whole
pixel: the size of the selection's box, the padding of each side, and the
content size that the [box model rules](./mokly-frame-adapter.md#box-model)
derive. The viewer reads the box model through the frame adapter's `boxModel`,
so a custom adapter without that method shows the size alone. The box model
stays inside the viewer: no public selection field or event carries it.
Decision: the sizes are not a field of the public instance events, because the
package draws Inspect and the selection itself.

## Compact Layout

The pill above the dock of the
[compact layout](./mokly-shell-device-chrome.md#compact-layout) names the
selected instance: its component, its first prop, and its left padding when it
has a box model. The one frame draws the selection as the wide layout does.

## Related Docs

- [Viewer selection, events and shell state](./mokly-viewer-selection.md)
- [Component inspector design](./mokly-component-inspector-design.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md)
