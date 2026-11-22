# Viewer Appearance Mockups

This continues the [viewer appearance contract](./mokly-viewer-appearance.md).

## Mockup Contract

The owning catalogue is `examples/basic/specs/design`; use its registered
shared components and existing screen compositions. Every Canvas screen, and
the appearance selector and top bar samples of the design library, render
Light and Dark views for both viewports through Mokly's authoring: the
entries inherit the configured `colorSchemes`, and every view renders once
per scheme. Browse shows both renders of an entry under the [frame scheme
rules](./mokly-viewer-appearance.md#interface-appearance-and-frame-schemes). A
shared render context carries the renderer's `input.colorScheme` to the
artboard roots as a pass-through, not a second theme setting, and each
artboard's `data-mbk-appearance` reflects that requested scheme. Rendered
pages must not read the building or viewing machine's system theme; the top
bar's `auto-appearance` sample uses the requested scheme as its deterministic
system-theme fixture.

Each artboard that draws a top bar draws exactly one appearance control: the
registered `chrome/appearance-selector` composed into the top bar. It depicts
the standalone control and has no authored transitions. The depicted top bar
component owns it, so every artboard drawing a top bar shows it rather than
opting in. Every artboard's selector reads the name of the scheme it was
rendered for. Only the top bar's `auto-appearance` sample reads Auto in both
renders. The depicted screen header of the kept tag picker screen carries the
viewport control only, with no preview theme icon.

Each screen has its own mobile and desktop component and reuses the
registered shared components, without duplicate screen markup. Apart from the
Frames filter of the Canvas family below, no design entry depicts a separate
preview-scheme control, `controls/view-controls` carries no scheme control,
and the design catalogue authors no scheme link pairs. Keep notes outside the
screens.

## Canvas Family

The Canvas viewer designs under `design/canvas` follow the same render rules:
every screen and variant renders once per scheme, its interface takes the
rendered scheme, and each artboard with a top bar draws the same Appearance
selector. The startup states of `design/canvas/loading/catalogue` draw no top
bar, so their one status line takes the reader's appearance alone. The frames
do not follow the artboard. Each frame draws its own scheme, so a screen's
Light and Dark frames and a variant set's Light and Dark variants show in both
renders. Only a Markdown document's reading frame takes the rendered scheme,
except a light-only document below. Inspect's Frames filter draws the Light
and Dark toggles, which choose frames and are not an appearance control. A
light-only screen, such as Profile, holds its Light frames and draws the
filter's Dark toggle disabled with Light only.

A use case's step frames show the scheme that its Frames filter chooses, not
the rendered scheme. Both steps of the Example tour have a dark view, so
`design/canvas/flows/tour/dark` shows each step's Dark frame. A current
document without a dark render keeps its light reading frame in the Dark
render, and the frame's label adds `Light only` after the file name, as
`design/canvas/stage/document/light-only` shows. A removed document's
previous version without a dark render keeps its light reading frame in the
Dark render, and its section head reads
`Showing previous version — Light only`, as
`design/canvas/outcomes/removed-document/light-only` shows under the
[removed previews](./mokly-removed-previews.md#behavior) rules.

## Related Docs

- [Viewer appearance](./mokly-viewer-appearance.md)
- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
- [Viewer semantic palette](./mokly-viewer-palette.md)
