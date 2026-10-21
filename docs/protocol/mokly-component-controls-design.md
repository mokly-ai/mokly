# Component Controls Design

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Controls Panel

Reuse the component page, saved-variant strip, canvas, comparison band, and
shared icon inspector. Controls occupy the Props tab; Details and Usage
stay independently available. The leaf Action component has no Nested
components tab. The [workspace design](./mokly-component-workspace-design.md)
groups view controls, shows both selected preview contexts, and gives the
inspector a resizable pane beneath the desktop preview and a rounded bottom sheet
over the mobile preview. Its centered desktop divider and iOS-style mobile
grabber follow the workspace design.

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
Each control is a row: its name in a label column, 120px wide on desktop and
100px on mobile, with Optional beneath an optional name, then its value, help,
and error. Focus indicators and error text remain legible, and controls do not
rely on color alone.

The Edit props link opens the controls of the entry it is on: the parent's own
entry from the component page, or a saved variant from that variant's page.
The canonical Controls page depicts the parent's own entry, and its variant bar
opens Default and Disabled.

An edited-state indicator and Reset action accompany temporary overrides. Reset
restores the shown entry's saved props: the parent's own props on the parent,
or the full saved variant on a variant. Navigating to a different variant entry
replaces temporary edits with that entry's complete values. Controls do not
create a saved variant or change source files. Viewport and theme selection
keep edits in the target runtime; navigating to another entry or entering a
comparison discards them.

Pending state keeps the last valid preview visible and shows Updating preview.
On mobile that status is a pill at the top of the preview, above the open
inspector sheet.
Rendering failure also retains that preview, with Try again and Reset actions.
Retry leads back through the pending design state. Comparison shows the saved
variant and read-only values, with a short secondary explanation. Published
saved-variant designs keep values readable and variant links usable; their
secondary guidance is Open this catalogue locally to edit props. Switching
between the published Default and Disabled examples keeps both views read-only.
While no live descriptor is installed, the fields are read-only under
`Preparing to edit props…`; a refetch keeps the installed capability, so the
fields stay editable. When editing cannot start, `Editing could not start.`
offers Try again, which fetches the live descriptor again. Until the entry's
detail arrives, the tab shows `Loading props…` and no fields; a failed load
shows `Props couldn’t be loaded.` with Try again. A removed entry, a
component without declared controls, and an entry without props show read-only
text, not fields. Merged props that fail as a whole highlight no field; the
alert names the failure, and the heading's Reset is the one action. An expired
temporary preview keeps the edits, shows the saved props, and offers Update
preview. An optional field shows Optional, a Set check box, and Not set while
unset; an optional toggle's value check box carries the field's name. A
number field's help and error name its bounds and its step. After
Reset, Try again, or Update preview, focus moves to the panel heading; after
Switch to Current, to the first field; after a start retry, to the status
that replaces the button, and to the heading when that status leaves; after
a catalogue retry, to the loading status. The settled strings are in
`examples/basic/specs/design/components/controls/parts/copy.ts`.
Do not add environment badges or implementation details to the rendered UI.

Mockup inputs keep native semantics. Authored links connect edited, reset,
variant, pending, failure, preparation, comparison, read-only, and recovery
examples. Those links and
native input editing demonstrate the design; they do not render edited props
through Serve or make a static preview reactive.

## Owning Catalogue

The Controls page is the canonical parent representation, and Default's saved
state is its variant. Editing, States, Published, and Read-only and recovery are
bounded child galleries with five, five, two, and five owning screens.
Every screen has distinct mobile and desktop components. The catalogue provides
state navigation without adding a footer to the rendered product artboard.
Each entry's files derive from its path under the
[artifact path contract](./mokly-artifact-paths.md); its folder owns gallery
membership. Component pages such as `design/components/states/removed` show a
props summary in their Props tab, and this controls catalogue owns the states of
the Props panel.

| Entry                                                   | State                                                 |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `design/components/controls/controls`                   | Action's own entry with all control types             |
| `design/components/controls/controls/default`           | Default saved variant, a variant of the Controls page |
| `design/components/controls/editing/edited`             | Edited values and matching preview                    |
| `design/components/controls/editing/unset`              | Optional hint unset                                   |
| `design/components/controls/editing/variant`            | Disabled saved variant selected                       |
| `design/components/controls/editing/reset`              | Reset to saved values                                 |
| `design/components/controls/editing/screen`             | A screen's own props with no instance selected        |
| `design/components/controls/states/pending`             | Last valid preview while an update is pending         |
| `design/components/controls/states/preparing`           | Read-only fields while Serve prepares editing         |
| `design/components/controls/states/preparing/failed`    | Editing could not start, with Try again               |
| `design/components/controls/states/invalid`             | Field validation with last valid preview              |
| `design/components/controls/states/error`               | Render failure, retry, and reset                      |
| `design/components/controls/states/comparison`          | Saved variant comparison and read-only controls       |
| `design/components/controls/published/readonly`         | Read-only values and available saved variants         |
| `design/components/controls/published/readonly-variant` | Disabled saved variant with read-only values          |
| `design/components/controls/limits/removed`             | Removed saved variant with its saved props            |
| `design/components/controls/limits/read-only`           | Component without declared controls                   |
| `design/components/controls/limits/no-props`            | Screen without props or registered components         |
| `design/components/controls/limits/invalid-together`    | Values not valid together, with Reset                 |
| `design/components/controls/limits/expired`             | Expired temporary preview, with Update preview        |

## Verification

Serve the example with `mokly serve` so that Mokly renders every matching
artboard, and commit only the authored changes. Test all input labels/types, current variant identity, full reset
values, optional/unset states, pending/error preservation, validation errors,
read-only comparison values, read-only guidance, and links between owning states.
Open every artboard in the served Browse frames and visually inspect both
viewport variants. Test inspector open/switch/close and keyboard behavior in
served frames and in the `mokly build` output.
Run the complete local gate, commit/push, and required post-push review.
