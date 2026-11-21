# Shared Control Overlays

This is the static overlay and viewer-stage sub-contract of
[Shared controls](./shared-controls.md).

## Static Product Overlays

The content-list registration is `design/content-list`. Its rows support four
optional fields: `status`, one of the four semantic tones, rendered as a
decorative Firna `StatusDot` in the row's leading slot; `meta`, right-aligned
metadata in the trailing slot; `mono`, which sets the shared monospace
treatment on that metadata; and `choose`, which draws the row's action as a
quiet Firna button rather than a destination link, for a row the reader picks
from a set instead of navigating to. A row already chosen carries `meta`
instead of an action, because there is nowhere for it to go. The status stays
decorative because the row's own description states the state in words, so
the meaning is never carried by color alone. The destination link is a sibling
of `ListItem` in a wrapping row: it sits at the right edge and wraps beneath
the row only when enlarged text needs the width, which keeps ordinary rows
compact while still fitting 320px at 200% text. Its waiting row is the row's
own frame with bars in place of its text, not the `loading` rows of Firna's
`List`, because their heights differ from the rows they would stand for.

The product controls are thin wrappers over the public `/input`, `/segmented`,
`/switch`, `/dropdown`, `/skeleton` and `/list` exports, registered with saved
variants as `design/textarea`, `design/segmented`, `design/switch`,
`design/options-list`, `design/skeleton` and `design/content-list`.
DropdownList is the open options surface; `design/selector` is the closed
select whose trigger opens it, registered because the closed trigger renders
from the package without a document. ListItem and its catalogue link are siblings in a local responsive row that wraps under
pressure, as described above. A link is never nested in a clickable row, and
the package's trailing slot is never restyled. Textarea uses the same no-op
change and accessibility contract as Input. Switch takes a
waiting form, drawn as a placeholder over its own frame, and a working form,
disabled with the value the reader asked for and `Saving…` beside its label.
`design/skeleton` draws the
placeholder forms of the [Wait](./folio-chrome.md#compositions) composition as
its saved variants, not a generic block of bars; the waiting region that holds
them sets `aria-busy` and names the operation. Button carries the public
danger tone, with a saved variant for destructive confirmations, and takes
`busy` for a [write in progress](./folio-chrome.md#compositions), as
[Shared control registrations](./shared-control-registrations.md) defines.
Badge takes an optional `dot` boolean beside its other props and variants. A
comment thread uses that built-in decorative dot inside its one status pill
and stretches to the width of its owning layout.

Firna's `WebModalFrame` requires a browser document and a portal and renders
nothing during static rendering; it has no public inline SSR mode. A static
mockup that needs a dialog therefore registers a local overlay layout with
dialog semantics and Firna typography and buttons, depicting desktop modals and
mobile bottom sheets without injecting a browser shim, patching the package or
hydrating exported HTML. This is a mockup-only composition exception; the live
app uses `WebModalFrame` for focus trapping, portals and dismissal. The live
settings dialog takes the frame's portal, focus trap, inert page, Escape and
backdrop, keeps its title as the dialog's accessible name, and shows the
registered composition inside it: the section rail at full height beside a
pane whose bar carries the pane's `h1` and a text Close. The running dialog and
the registered frame draw the same thing; see
[Web product shell](./web-product-shell.md#settings). Prefer an inline surface
the package renders — an open `DropdownList`, a panel or a rail — and do not
extend this exception to controls that render from the package.

A confirmation or reveal modal a settings pane opens is drawn with the
registered `design/panel` under this same exception, so a mockup shows it as a
centered desktop modal and a mobile bottom sheet; the live pane takes
`WebModalFrame` for its portal, focus trap and dismissal, as the settings
surface and the viewer panel do. A row menu's compact sheet is the same
registered panel, drawn in a layer fixed over the whole surface because the
live sheet portals to the document root. No overlay opens a layer of its own.

Three layouts are registered under this exception:
`design/settings-dialog` (the desktop rail-and-pane frame with
`role="dialog"` and `aria-modal`), `design/settings-layer` (the mobile
full-screen frame) and `design/panel` (the viewer's overlay, a centered modal
on desktop and a bottom sheet on mobile, selected from `context.viewport`).
Each takes its content as a slot, so the content never knows which frame hosts
it, and none owns a `main` landmark or an `h1`; the screen supplies those. Each
also takes a `header` slot, which is where that screen's `h1` and the frame's
close control land, so the frame can give the heading a fixed bar above a
scrolling body without ever owning a heading of its own. See
[Settings dialog](./settings-dialog.md) and [Viewer](./viewer.md).

## The Published Viewer Stage

The workspace `@mokly/viewer` owns the ready stage, the catalogue and package
controls. `packages/app` uses its root React entry and stylesheet behind the
[package host contract](./viewer-host.md#package-host). The mockups depict the
ready stage statically with the parts of the workspace `@mokly/ui`, which
the viewer renders its shell from, drawn with `interactive={false}`.
Cloud controls are Firna controls themed through the shared
token mapping and composed into `topBarStart` and `topBarEnd`. A mockup places
them in the same host slots of the `@mokly/ui` embedded layout.
Non-ready publication and access cards are cloud components outside the
package. Package internal selectors and controls are not restyled or
reproduced here.
