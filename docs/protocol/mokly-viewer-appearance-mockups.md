# Viewer Appearance Mockups

This continues the [viewer appearance contract](./mokly-viewer-appearance.md).

## Mockup Contract

The owning catalogue is `examples/basic/specs/design`; use its registered
shared components and existing screen compositions. Every Canvas screen, the
two kept appearance screens, and the appearance selector and top bar samples
of the design library render Light and Dark views for both viewports through
Mokly's authoring: the entries inherit the configured `colorSchemes`, and
every view renders once per scheme. Browse shows both renders of an entry
under the [frame scheme
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
renders. The depicted screen header of a kept older screen carries the
viewport control only, with no preview theme icon, and depicted component
toolbars carry no scheme switch.

## Kept Appearance Screens

The `Appearance` folder under `Design › Browse shell` keeps two older screens,
with matching source directories under
`examples/basic/specs/design/browse/appearance/`. The folder itself has no
page of its own. The
[shell design inventory](./mokly-shell-design-inventory.md) lists their
entries.

| Folder                           | Owning screen                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Appearance › Appearance states   | `design/browse/appearance/states/light-only-document`: a removed document with no dark render keeping its light page |
| Appearance › Status and recovery | `design/browse/appearance/status/flow`: a use case's ordered steps around light screens                              |

Their previews follow the artboard. Welcome, the flow's first step, has a dark
render, so it uses the dark device-screen treatment in the Dark render and the
light one in the Light render. The light-only Details step keeps its light
frame in both renders. The removed document's previous version has only a
light render, so its pane keeps the Light palette in the Dark render, and its
label reads `Showing previous version — Light only`. Device-screen tokens stay
independent of the interface palette.

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
renders. Only a Markdown document's reading frame takes the rendered scheme.
Inspect's Frames filter draws the Light and Dark toggles, which choose frames
and are not an appearance control. A light-only screen, such as Profile, holds
its Light frames and draws the filter's Dark toggle disabled with Light only.

## Related Docs

- [Viewer appearance](./mokly-viewer-appearance.md)
- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
- [Viewer semantic palette](./mokly-viewer-palette.md)
