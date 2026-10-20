# Theming

Status: In progress under the [Rust rebuild plan](../../../../plans/rust-rebuild.md).

This page belongs to the [`@mokly/viewer` README](../../README.md). It explains the interface appearance, the accent properties, and the preferences that the standalone shell stores.

`theme` accepts `"auto"`, `"light"`, or `"dark"`. Auto is the default and
follows the system preference. It is independent of `selection.colorScheme`, so
a host can pair either interface appearance with either preview scheme. A theme
change preserves frame sessions, selection, temporary props, picking,
highlights, and markers, and it changes neither the host document nor sibling
viewers.

The standalone shell of `mokly serve` and `mokly build` instead renders one
Appearance selector for the interface and the previews together. See the
[appearance contract](../../../../docs/protocol/mokly-viewer-appearance.md) and the
[semantic palette](../../../../docs/protocol/mokly-viewer-palette.md).

Dark uses Mokly Cloud's warm Folio neutrals for backgrounds, panels, text, and
borders, with sage accents. The palette and the fonts are packaged locally, and
the colours authored inside each preview are preserved.

Import the packaged stylesheet once, then override the supported custom
properties on a containing element:

```css
.catalogue-page {
  --mokly-accent: #315c4a;
  --mokly-accent-contrast: #ffffff;
  --mokly-accent-soft: rgb(49 92 74 / 12%);
}
```

Keep readable contrast between `--mokly-accent` and `--mokly-accent-contrast` in
both appearances. Unset overrides use the current palette defaults. These
properties tune the accent only; the Mokly logo in the top bar keeps its brand
colours in each appearance. Viewer styles are scoped away from the surrounding
application and host slot content. Internal selectors, DOM structure, geometry,
and other custom properties are not extension APIs.

At a container width of 560px or less, the viewer switches to its compact
search control. This follows the viewer container, not the browser viewport.

## Standalone reader preferences

The standalone shell keeps these origin-local preferences in `localStorage` and
reads them before its first render:

| Key                                | Choice                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| `mokly:theme`                      | Explicit Light or Dark appearance; Auto removes the key |
| `mokly:nav-disclosure:v4`          | Open navigation groups                                  |
| `mokly:comparison-scroll-together` | `on` or `off`; missing means on                         |

The Details disclosure and the navigation split width also persist per origin.
Scroll together appears after the comparison modes in Side by side, Overlay,
and Difference, and it updates the open comparison without reloading panes. An
embedded `MoklyViewer` reads no browser storage; it keeps these choices for the
lifetime of the mounted viewer.
