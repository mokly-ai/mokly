# Component Controls Design

Status: Before an edit has rendered, the viewer's alerts still name the last valid props, not the saved props. The [Props sentence milestone](../../plans/storybook-support.md#milestone-24a-the-props-sentence-after-a-failed-edit) changes them.

## Controls Panel

The Props and controls artboards, except the one of a screen without props,
show the Action's variant set on the canvas with a saved variant chosen: its
Light frame is selected, and Inspect's Props section holds the controls of
that variant, while Inspect's details and Usage stay available. The leaf
Action component has no component tree. A desktop
render draws the right panel beside the canvas, and a mobile render opens the
panel sheet at Props over the chosen frame. The controls fill Inspect's Props
section under the
[inspector design](./mokly-component-inspector-design.md#inspect), and the
[workspace design](./mokly-component-workspace-design.md#frames-filter-and-highlighting)
gives the Frames filter and highlighting.

The Action fixture demonstrates text (label), boolean (disabled), numeric
(corner radius), select (emphasis), and optional text (hint). Its typed saved
variants and state fixtures supply both control values and preview props. Default
and Disabled each declare their complete values. Action's own entry holds the
keys that every saved variant sets, with Default's values; Secondary sets no
hint, so the parent's hint is unset. These extended design props are
illustrative consumer metadata, not a new package API.

Each field has a visible label, associated input, and concise help where needed.
Optional props have a supplied/unset choice; unset differs from an empty string.
Numeric controls show their supported range. Invalid fields retain the entered
value and show a nearby error; the preview retains the last valid values.
Each control is a row: its name in a label column, 112px wide in the right
panel and in its bottom sheet, with Optional beneath an optional name, then its
value, help, and error. Focus indicators and error text remain legible, and controls do not
rely on color alone.

A component page edits props in place: Props shows the controls of the entry
that it edits, which on a variant set is the variant of the selected frame.
Decision: no separate Edit props link, because Props already holds the
controls. `design/canvas/props/editing` depicts Default chosen on the Action's
variant set, and Inspect's Variants list opens Default and Disabled.

An edited-state indicator and Reset action accompany temporary overrides. Reset
restores the saved props of the entry that Props edits: a component's own
props, or the full saved variant. Navigating to a different variant entry
replaces temporary edits with that entry's complete values. Controls do not
create a saved variant or change source files. Viewport and theme selection
keep edits in the target runtime; navigating to another entry or entering a
comparison discards them.

Pending state keeps the last valid preview visible and shows Updating preview.
In the compact layout that status is a pill at the top of the shown frame,
above the open panel sheet.
Rendering failure also retains that preview, with Try again and Reset actions.
The alert of a failed render or an invalid value names the props that the
preview shows. Until an edit has rendered, it names the saved props, and after
that, the last valid props. `design/canvas/props/states/error` depicts a
failed first render. `design/canvas/props/states/later-edit` depicts a later
edit that failed after an earlier edit rendered. Its fields keep the later
edit, and its frames keep the earlier one.
Retry leads back through the pending design state. A comparison shows the
saved variant, and Props edits the current frames that Inspect shows. Published
saved-variant designs keep values readable and variant links usable; their
secondary guidance is Open this catalogue locally to edit props. Switching
between the published Default and Disabled examples keeps both views read-only.
While no live descriptor is installed, the fields are read-only under
`Preparing to edit props…`; a refetch keeps the installed capability, so the
fields stay editable. When editing cannot start, `Editing could not start.`
offers Try again, which fetches the live descriptor again. Until all route
details arrive, Props shows `Loading props…` and no fields. A current
component variant waits for its own detail and its parent's detail. A failed
load shows `Props couldn’t be loaded.` with Try again after all route details
settle. A removed entry, a
component without declared controls, and an entry without props show read-only
text, not fields. Merged props that fail as a whole highlight no field; the
alert names the failure, and the heading's Reset is the one action. An expired
temporary preview keeps the edits, shows the saved props, and offers Update
preview. An optional field shows Optional, a Set check box, and Not set while
unset; an optional toggle's value check box carries the field's name. A
number field's help and error name its bounds and its step. After
Reset, the Try again of a failed render, or Update preview, focus moves to the
Props heading; after a start retry, to the status
that replaces the button, and to the heading when that status leaves; after
the Try again of a failed load, to `Loading props…` and then to the panel
heading, as the [viewer's recovery focus rule](./mokly-viewer.md#package-and-props)
says. The rendered UI shows no
environment badge and no implementation detail.

Mockup inputs keep native semantics. Authored links connect edited, reset,
variant, pending, failure, preparation, comparison, read-only, and recovery
examples. Those links and
native input editing demonstrate the design; they do not render edited props
through Serve or make a static preview reactive.

## Owning Catalogue

The `Props and controls` folder of the Canvas family, `design/canvas/props`,
owns the states of Inspect's Props section. The
[component design inventory](./mokly-component-design-inventory.md#owning-catalogue)
lists its five screens and twelve saved variants. Each screen holds one kind
of state: `editing` the edits of Default and their reset, `states` a render in
flight and its failures, `preparing` the start of editing, `read-only` the
static build and an entry without props, and `loading` the route's details.
Every entry renders in both viewports and both schemes, and its files derive
from its path under the [artifact path contract](./mokly-artifact-paths.md).
The catalogue provides state navigation without adding a footer to the
rendered artboard.

Other Canvas artboards show the same Props section in their own context:

| Entry                                                 | Props state                                               |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `design/canvas/inspect/props`                         | A screen's own props, with no instance selected           |
| `design/canvas/stage/component-set/disabled`          | The Disabled saved variant chosen                         |
| `design/canvas/components/compare/props`              | Editable props on the current frames during Overlay       |
| `design/canvas/components/removed`                    | A removed saved variant's saved props, read-only          |
| `design/canvas/components/usage/loading` and `failed` | Props waiting for the parent's detail, or failing with it |
| `design/canvas/loading/entry` and `failed`            | Props waiting for the entry's detail, or failing with it  |
| `design/canvas/stories/failed`                        | Editable props of a story that could not render           |

No artboard draws a component without declared controls, because every
component of the example declares controls.
