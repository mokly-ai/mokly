# Viewer Appearance Mockups

This continues the [viewer appearance contract](./mokly-viewer-appearance.md).

## Mockup Contract

The owning catalogue is `examples/basic/specs/design`; use its registered
shared components and existing screen compositions. Appearance screens and
their affected shared component samples render Light and Dark views for both
viewports through Mokly's authoring: the entries inherit the configured
`colorSchemes`, every view renders once per scheme, and Browse's Appearance
control swaps between them at the same entry. A shared render context carries
the renderer's `input.colorScheme` to the artboard roots as a pass-through,
not a second theme setting, and each artboard's `data-mbk-appearance` reflects
that requested scheme. Rendered pages must not read the building or viewing
machine's system theme; the Auto example uses the requested scheme as its
deterministic system-theme fixture.

Each artboard draws exactly one scheme control: the registered
`chrome/appearance-selector` composed into the top bar. It depicts the
standalone control and has no authored transitions. The depicted top bar
component owns it, so every artboard drawing a top bar shows it rather than
opting in. The depicted screen header carries the viewport control only, with
no preview theme icon, and depicted component toolbars carry no scheme switch.
The Auto artboard's selector reads Auto in both renders; every other
artboard's selector reads the name of the scheme it was rendered for.

Previews follow the artboard. Subjects with a dark render, such as Welcome, the
comparison panes and the flow's first step, use the dark device-screen
treatment in the Dark render and the light one in the Light render. The
light-only Details subject keeps its light frames in both renders and shows the
fallback caption in the Dark render, because that is a fact about the screen.
Device-screen tokens stay independent of the interface palette.

A linked Appearance section sits under Browse, with matching source directories
under `examples/basic/specs/design/browse/appearance/`. Each design page
names a canonical screen; other screens can share its folder. The folder
itself has no page of its own. Folders below are the resolved folder titles
under `Design › Browse shell`.

| Folder                              | Owning screens                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Appearance                          | `design/browse/appearance/overview`: the canonical interface around a selected screen, all light or all dark |
| Appearance › Appearance states      | Auto selector, light-only screen, current document, and removed document fallbacks                           |
| Appearance › Panels and comparisons | Props validation, selected-instance inspector, navigation drawer, Side by side, Difference                   |
| Appearance › Status and recovery    | Home/empty, catalogue loading, error/retry, Changes unavailable, use-case flow                               |

The catalogue groups the overview and its three nested families; artboards
carry no navigation footer. Each screen has its own mobile and desktop
component and reuses the registered shared components, without duplicate
screen markup, and no page has more than five owning screen definitions. The
exact entries are listed in the
[shell design inventory](./mokly-shell-design-inventory.md).
`design/browse/views/screen/dark-scheme` and
`design/browse/views/screen/light-only` are Welcome variants with Light and
Dark artboards; they, `design/browse/views/screen` and
`design/browse/views/details-screen` follow the one Appearance selector. No
design entry depicts a separate preview-scheme control,
`controls/view-controls` carries no scheme control, and the design catalogue
authors no scheme link pairs. Keep notes outside the screens.

## Related Docs

- [Viewer appearance](./mokly-viewer-appearance.md)
- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Viewer semantic palette](./mokly-viewer-palette.md)
