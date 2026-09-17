# Component Controls Design

## Delivery Status

Approved mockup scope for Milestone 7 of the
[component explorer plan](../../plans/component-explorer.md), delivered together
with the [inspector revision](./mokly-component-inspector-design.md) for one
sign-off. These authored design states are implemented by the component registration API,
local rendering service, and editable runtime controls.

## Controls Panel

Reuse the component page, saved-variant strip, canvas, comparison band, and
shared icon inspector. Controls occupies the Props/Controls tab; Details and Usage
remain independently available. The leaf Action component has no Nested
components tab. The [workspace design](./mokly-component-workspace-design.md)
groups view controls, shows both selected preview contexts, and gives the
inspector a resizable pane beneath the desktop preview and a rounded bottom sheet
over the mobile preview. Its centered desktop divider and iOS-style mobile
grabber follow the workspace design.

The Action fixture demonstrates text (label), boolean (disabled), numeric
(corner radius), select (emphasis), and optional text (hint). Its typed saved
variants and state fixtures supply both control values and preview props. Default
and Disabled each declare their complete values. These extended design props
are illustrative consumer metadata, not a new package API.

Each field has a visible label, associated input, and concise help where needed.
Optional props have a supplied/unset choice; unset differs from an empty string.
Numeric controls show their supported range. Invalid fields retain the entered
value and show a nearby error; the preview retains the last valid values.
Controls fit one column on mobile and a compact grid on desktop. Focus indicators
and error text remain legible, and controls do not rely on color alone.

The Edit props link from a saved component example keeps its selected variant
when opening Controls.

An edited-state indicator and Reset action accompany temporary overrides. Reset
restores the full saved variant. Selecting a different variant replaces temporary
edits with that variant's complete values. Controls do not create a saved variant
or change source files. Viewport and theme selection keep edits in the target
runtime; changing routes or entering a comparison discards them.

Pending state keeps the last valid preview visible and shows Updating preview.
Rendering failure also retains that preview, with Try again and Reset actions.
Retry leads back through the pending design state. Comparison shows the saved
variant and read-only values, with a short secondary explanation. Published
saved-variant designs keep values readable and variant links usable; their
secondary guidance is Open this catalogue locally to edit props. Switching
between the published Default and Disabled examples keeps both views read-only.
Do not add environment badges or implementation details to the rendered UI.

Mockup inputs retain native semantics. Authored links connect edited, reset,
variant, pending, failure, comparison, and read-only examples. Those links and
native input editing demonstrate the design; they do not implement live server
rendering or make a static preview reactive.

## Owning Catalogue

The Controls page is the canonical parent representation. Editing, States, and Published
are bounded child galleries with four, four, and two owning screens respectively.
Every screen has distinct mobile and desktop components. The catalogue provides
state navigation without adding a footer to the rendered product artboard.

| Entry id                                     | Route                                               | State                                           |
| -------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `design-component-controls`                  | `design/components/controls/overview.html`          | Default saved variant with all control types    |
| `design-component-controls-edited`           | `design/components/controls/editing/edited.html`    | Edited values and matching preview              |
| `design-component-controls-unset`            | `design/components/controls/editing/unset.html`     | Optional hint unset                             |
| `design-component-controls-variant`          | `design/components/controls/editing/variant.html`   | Disabled saved variant selected                 |
| `design-component-controls-reset`            | `design/components/controls/editing/reset.html`     | Reset to saved values                           |
| `design-component-controls-pending`          | `design/components/controls/states/pending.html`    | Last valid preview while an update is pending   |
| `design-component-controls-invalid`          | `design/components/controls/states/invalid.html`    | Field validation with last valid preview        |
| `design-component-controls-error`            | `design/components/controls/states/error.html`      | Render failure, retry, and reset                |
| `design-component-controls-comparison`       | `design/components/controls/states/comparison.html` | Saved variant comparison and read-only controls |
| `design-component-controls-readonly`         | `design/components/controls/published/default.html` | Read-only values and available saved variants   |
| `design-component-controls-readonly-variant` | `design/components/controls/published/variant.html` | Disabled saved variant with read-only values    |

## Verification

Use the real generator and build/check every matching generated artboard. In the
default derived mode, keep generated HTML and the manifest ignored and commit the
authored changes; in explicit committed mode, commit the matching generated
artifacts. Test all input labels/types, current variant identity, full reset
values, optional/unset states, pending/error preservation, validation errors,
disabled comparison inputs, read-only guidance, and links between owning states.
Open every artboard from disk and visually inspect both viewport variants. Test
inspector open/switch/close and keyboard behavior in standalone and served frames.
Run the complete local gate before commit/push and the required post-push review
before handoff.
