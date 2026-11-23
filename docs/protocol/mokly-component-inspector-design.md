# Component Inspector Design

Status: The Inspect tab of the right panel, with its sections and its box model, is not built yet. The [right panel and compare milestone](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds it.

## Right Panel

Every entry shares one inspector: the right panel, which floats over the
canvas while an entry is selected. The
[canvas stage](./mokly-shell-canvas-stage.md#canvas) owns its placement and
its size, and the [compact layout](./mokly-shell-device-chrome.md#compact-layout)
owns its bottom sheet. Its head is a strip of text tabs: Inspect, and Changes.
Changes shows when the Changes filter lists the entry, or when the canvas
offers the compare modes under the
[Changes screen controls](./mokly-changes-controls.md#screen-controls), as a
variant set does while any shown row compares. Decision: an entry whose canvas
offers the compare modes but that the Changes filter does not list, such as a
screen that only a changed component affects or an unmodified parent whose
saved variant changed, also has Changes, because its comparison lives in that
tab.

The selected tab is ink at weight 600 over a 2px signal rule on the head's
hairline. Every label keeps the width of its bold form, so a change of tab
moves nothing. The strip is a tab list: ArrowLeft and ArrowRight move between
the tabs and wrap, and Home and End move to the first and the last tab. The
selected tab also sets what a click on the canvas does, under the
[canvas selection](./mokly-viewer-selection-canvas.md#clicks-by-tab) contract.
A full page load selects Inspect, or Changes when it honours a comparison
intent of the
[Changes screen controls](./mokly-changes-controls.md#screen-controls).
In-shell navigation selects Changes when the destination honours a comparison
intent, and otherwise keeps the selected tab when the destination has it and
selects Inspect when it has not. Decision: an honoured comparison intent
selects Changes, not Inspect or the kept tab, because the link exists to show
the comparison, and only Changes shows it.

The panel's body scrolls inside the panel while the tab strip stays in place.
A new selection scrolls Inspect to its Selection section. In the compact
layout the panel is a bottom sheet with the same tabs, and the dock's control
for the current tab opens it. The panel stays available on a removed screen,
which has no compare modes.

## Inspect

Inspect holds these sections in this order, each when the entry has it:

1. The head: the entry's title, a Component tag on a component, its change
   status, its description, and the Details rows that the
   [shell design](./mokly-shell-design.md#layout) lists, with its path and its
   source first.
2. The rationale, in a section named for the entry's kind, such as
   `Why this screen`.
3. Variants: a radio list that names the entry itself first and then its saved
   variants, with their count.
4. Frames: the count of the shown frames, and the
   [Frames filter](./mokly-shell-canvas-stage.md#frames-filter).
5. Selection: the selected instance or frame, as [Selection](#selection)
   describes it.
6. Props: the entry's own props, with their field count; on an editable entry
   they are the [controls](./mokly-component-controls-design.md).
7. Usage: Used by and, when relevant, Affected screens, with independent
   screen Changes membership preserved.
8. Components: the instance tree of the
   [explorer contract](./mokly-component-explorer.md#components-in-the-screen-inspector),
   with its explicit empty and unavailable states. A composed component names
   this section Nested components, and a leaf component has none.

Props, Usage and Components are folded sections: native disclosures whose head
names the section and its count where one is known. Never combine the entire
tree, all props, and all usage lists into one section. A document's Inspect
holds its head alone.

On a screen, the list checks the shown variant, and choosing a variant opens
that variant. A component opens as its variant set: choosing a variant selects
the variant's Light frame, and the list checks the variant of the selected
frame. Its Props edits one saved variant:
the variant of the selected frame, or of the frame that holds the selected
instance. While nothing is selected, Props asks the reader to choose a
variant. Decision: Props on a variant set edits one frame's variant, not the
whole set, because each frame renders its own saved props.

## Selection

While nothing is selected, the Selection section reads
`Click an element on a frame to see its props.` With an instance selected, the
section's head holds a chip with the instance's component, which opens the
component's page, and the label of the frame where the reader selected it. The
section then lists the props and slots that the instance's owner supplies,
each value as code, as the
[explorer contract](./mokly-component-explorer.md#components-in-the-screen-inspector)
states. The instance's size, its box model and its component's source file
follow. The box model draws the padding of each side around the content size,
as one image whose accessible name gives the same numbers in words. An
instance without a box model shows its size alone. The
[canvas selection](./mokly-viewer-selection-canvas.md#sizes) contract defines
the sizes.

With a frame of a variant set selected, the section's head holds a Frame chip
with the frame's size, and its rows name the variant and the scheme that the
frame shows.

## Changes And Evidence

The [Changes tab](./mokly-changes-controls.md#changes-tab) holds the change
stepper, the host slot, the compared versions, the compare modes and the
comparison details. An entry without Changes keeps its comparison evidence in
Inspect, after the head. Decision: that evidence stays in Inspect, not in a
Changes tab of its own, because the entry has no change and no comparison to
show there. Evidence availability, comparison-mode eligibility, and the tab
and the section that a state opens are independent authored states.

## Navigation And Metadata

Artboards contain no navigation footer for browsing mockup states. The Design
catalogue hierarchy links every owning page and its child galleries.
Saved-variant, usage, component, and instance links stay inside the depicted
product where they belong. Canvas links stay inside the Canvas family: a
control opens the Canvas artboard that shows its outcome, and a control without
one is a picture of itself. Every `aria-current="page"` link must point to the
rendered artboard's path, even when multiple states share a component/screen
title. Selection within a component or tree can use non-page current-item
semantics.

Display labels never identify the current destination or synthesize a
filename. Each depicted component shows the same display name, id, source
path, and description in Inspect's head and in its source references. The
mockups' tabs, folded sections, toggles and sheets need no script, so they
work in sandboxed Browse frames and directly from disk. Each artboard declares
its tab, its unfolded sections and the section that the panel opens scrolled
to.

## Design Mockups

The `design/canvas/**` family depicts the right panel in both viewports. Each
entry's files derive from its path under the
[artifact path contract](./mokly-artifact-paths.md):

| Entry                               | State                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `design/canvas/inspect/unchanged`   | An unmodified, light-only screen, with Inspect alone                                    |
| `design/canvas/inspect/selection`   | An instance selected on Mobile · Light; saved states select the Toolbar and its Actions |
| `design/canvas/inspect/sections`    | Usage and Components unfolded below the selection                                       |
| `design/canvas/inspect/props`       | Props unfolded                                                                          |
| `design/canvas/inspect/frames`      | The Frames filter with Dark off and Highlight components on                             |
| `design/canvas/stage/component-set` | A variant set; saved states choose a variant and select the Toolbar's Actions           |
| `design/canvas/outcomes/added`      | An added screen with both tabs; saved states show Changes and select its instances      |

The [comparison pane designs](./mokly-comparison-pane-designs.md) list the
artboards of the Changes tab.
