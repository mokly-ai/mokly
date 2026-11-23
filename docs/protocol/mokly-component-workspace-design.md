# Component Workspace Design

Status: The right panel with its tabs, its Nested components section and its Frames filter, and the panel sheet of the compact layout are not built yet. [Milestone 11](../../plans/canvas-redesign-milestones-viewer.md#milestone-11-canvas-stage-in-moklyui) builds the floating panel and the panel sheet, and [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds the tabs, the sections and the Frames filter.

## View Controls

The [Frames filter](./mokly-shell-canvas-stage.md#frames-filter) in Inspect
replaces the viewport choice and holds the Highlight components switch. The
[preview scheme rules](./mokly-shell-device-chrome.md#color-scheme) give the
standalone Appearance selector, the Dark preview control of an embedded host,
and the scheme of each frame and its label. Highlighting has no separate
horizontal band. Icons have accessible names, hover tooltips, selected states,
and visible keyboard focus.

The menu icon sits centered in its box, independent of text baselines. Icon
boxes do not shrink; all glyphs are centered within their pointer targets.

The [canvas frames](./mokly-shell-device-chrome.md#canvas-frames) give each
frame's size, its scale and its scrolling. A change of the Frames filter keeps
the selected variant and edited fields.

These mockup controls work without scripts, including inside Browse's
sandboxed frames. Both preview contexts show the same fixture values. They do
not render newly entered prop values. Highlighting uses the fixture's overlay
geometry and never dims an ancestor of a highlighted component.

Disable highlighting when no registered components exist, inspection is
unavailable, a comparison is selected, or the screen was removed and has no
current preview. The tooltip and accessible description
state that specific reason; zero usage must not be confused with missing data.
Each artboard draws the toggle in the state that the shell shows for its view.
Decision: the shell's state, not a disabled toggle where an artboard gives no
state or a header without the toggle, because the mockups show what the shell
draws.
Highlight labels are separate rounded chips with a small gap above an intact
rounded outline. The chip must not overlap the outline's corner or obscure the
component; apply the same treatment to outer and nested regions.

## Fixed Shell, Divider And Panel Sheet

The artboard fills its viewport. The
[shell design](./mokly-shell-design.md#layout) fixes how the shell scrolls, and
the [inspector design](./mokly-component-inspector-design.md#right-panel) fixes
how the right panel scrolls.

The catalogue's divider keeps the grip of the
[navigation design](./mokly-shell-design-navigation.md#catalogue-panel). The
grip's center sits on the divider border, with no gap, and there is no
diagonal corner grip or thick colored border. The grip fades between its
resting and accent states. Keyboard focus also draws an accent bar along the
divider's outer edge instead of a ring around the hit area. While a drag is in
progress the pointer keeps the resize cursor everywhere and frames ignore
pointer input, so the gesture cannot be interrupted by the content underneath.

In the [compact layout](./mokly-shell-device-chrome.md#compact-layout), the
right panel opens as the panel sheet: a non-modal, full-width bottom sheet
with safe-area spacing and a centered grabber. Its tab strip and close control
stay fixed at the top of the sheet, and only its body scrolls.

The mockup grabber is a picture: each artboard draws its open sheet at the
height that its state gives. The runtime adds pan gestures and snap heights.

## Nested Components

A component can render other registered components. Its Inspect lists those
children in its Nested components section, excluding the component whose page
is open, under the
[inspector design](./mokly-component-inspector-design.md#inspect).
`design/canvas/stage/component-set/toolbar` demonstrates the Toolbar's two
nested Actions. Leaf components, including Action, have no such section.
Screen pages keep their Components section, including the explicit empty and
unavailable states.

## Comparison Availability

Across the complete design catalogue, the compare modes other than Current
require an explicit change state, or a screen that only changed components
affect. The tag search, ignored-only and empty designs show the current
version without compare modes.

All is a catalogue filter, not evidence that the selected example changed.
Known examples show Added, Changed, Removed, or Unmodified beside the title,
using the shown view's state. Resolve the selected screen or saved variant's
effective displayed scheme before reading that state: a light-only preview uses
Light status and marks while the catalogue's Dark preference stays selected.
One view maps review states to Added, Changed, Removed, or Unmodified; several
shown views use that priority order. Changed is eligible, as is Removed only
for a component variant. An entry that Changes does not list stays eligible
while it shows
Unmodified when its entry detail marks it comparison-eligible, because changed
components affect it. Missing or nonmatching evidence keeps status and
independently supplied eligibility; never derive one from the other. Axis,
entry, and evidence updates recompute the decision. Any other Unmodified entry
offers no compare modes and uses control marks plus `Changed views` for
changes elsewhere. Removed screens show their badge
without modes over their previous version under
[removed previews](./mokly-removed-previews.md). Temporary prop
edits never create committed changes or make comparison controls appear.

The component set and Props designs depict an unchanged saved example on the
canonical branch. Changed component and independent screen-change fixtures
keep their explicit Changes counts and before/current presentation. A Removed
component variant keeps before/current presentation; a Removed screen shows
its previous version.
Missing inspection metadata is distinct from comparison availability.

The runtime uses actual comparison eligibility for the selected saved example.
Missing, pending, or nonmatching per-view evidence uses the entry-level status
fallback without changing that eligibility and cannot trigger eager screenshot
work merely to decide whether to offer compare modes. The same rule gates
comparison deep links at the first shell render, controlled selection, and
later evidence updates.
Affected consumers may still expose comparisons while staying out of Changes.

Parent status and variant status are distinct. Removing Compact from Action
makes Compact its own Removed component variant entry, comparable with an
explicit missing current side, while Action's status describes the parent
only; Farewell is a Removed screen with no comparison controls.
`design/canvas/components/removed` keeps Compact on the Action's variant set
after the current variants, and `design/canvas/components/removed/changes`
compares it with its missing current side. Status must never be inferred from
usage counts.

## Comparison Details

Variant parents, workspace keys and paired inputs follow the
[branch-point lookup](./mokly-branch-point-lookup.md). Presentation stays the same
when a parent or variant moves or changes letter case.

Comparison evidence, when present, lives in the comparison details of the
[Changes tab](./mokly-changes-controls.md#changes-tab), and an entry without
Changes keeps it in Inspect, under
[Changes and evidence](./mokly-component-inspector-design.md#changes-and-evidence).
Do not add a comparison disclosure below the canvas or a separate explanatory
banner above it. Ordinary Unmodified mockups omit the comparison section unless
there is retained or excluded rendered-resource evidence.
`design/canvas/evidence/unchanged/action` depicts the unmodified Action with
excluded stylesheet evidence in Inspect and no Changes tab.
`design/canvas/components/usage` depicts the changed Action with Welcome and
Details under Affected screens. `design/canvas/components/affected` depicts
the unmodified Welcome, which only the changed Action affects, in Side by
side: its Changes tab offers the comparison, and its comparison details link
the Action and end with the shared-component sentence in place of the
no-changes line.

Use structured evidence: entry/variant state, one sentence per direct reason,
the component-level changed-file list and style outcomes, selected-variant
stylesheet exclusions, paired prop values, and links to changed components
actually used by the screen. The [CSS evidence contract](./mokly-css-evidence-presentation.md#details-copy)
owns the exact component and variant sentences.
Prop rows identify their component instance and show Before and Current values.
The mockup fixtures share these values with the compared frames and the
comparison details, as `design/canvas/components/affected/direct` draws them.
Do not invent explanations such as “corners and spacing changed”: the runtime
can populate factual rows from validated comparison/usage records and paired
inputs, but does not generate visual-analysis prose. Temporary control edits
stay separate from saved comparison evidence.

The comparison details read the routed entry's direct reasons from its
[entry detail](./mokly-shell-delivery.md#entry-detail), so they show them as
soon as the detail arrives: in Current before any comparison loads, in a loaded
comparison, and under either filter. Each reason is one sentence, shown once
whatever supplies it. As the designs show, the reason sentences follow the
branch-point sentence, where the comparison details show one, and a moved
entry's previous path, and come before the changed files, the paired prop
values, and the changed components used here. A
`dependency` reason reads only through the changed-files list of the
[CSS evidence contract](./mokly-css-evidence-presentation.md), and a pure move
has no reason sentence. A `screen` reason, which only a use case carries,
gives one `Changed step:` line for each step whose screen changed, with the
step's title as a link to that step's screen. Only a record that Changes lists
shows reasons.

| Reason           | Sentence                                                 |
| ---------------- | -------------------------------------------------------- |
| `added`          | “Added to this branch.”                                  |
| `removed`        | “Removed on this branch.”                                |
| `material`       | “Rendered content changed.”                              |
| `implementation` | “Rendered content changed where this component is used.” |
| `inputs`         | “Supplied props or slots changed.”                       |
| `structure`      | “Component instances changed.”                           |
| `metadata`       | “Page details or saved examples changed.”                |
| `screen`         | “Changed step: {step title}” for each changed step       |

The `implementation` sentence describes actual-instance impact. The
component's own view states and comparison headings stay unchanged.
