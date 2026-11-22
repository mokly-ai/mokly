# Viewer Preview Palette

This continues the [viewer semantic palette](./mokly-viewer-palette.md): the
colours of what a frame shows, which never follow the interface appearance.

## Preview Tokens

Preview tokens describe what a device screen shows and never change with the
interface appearance, so a light phone inside a dark catalogue keeps light
surfaces, ink and status indicators.

| Role                       | Light preview | Dark preview                        |
| -------------------------- | ------------- | ----------------------------------- |
| `--mbk-screen-bg`          | `#ffffff`     | `--mbk-dark-screen-bg` `#121514`    |
| `--mbk-screen-ink`         | `#1a1d1c`     | `--mbk-dark-screen-ink` `#eef1ef`   |
| `--mbk-screen-ink-2`       | `#4a4f4d`     | 78% ink mixed into the dark surface |
| `--mbk-screen-muted`       | `#7d8480`     | 62% ink mixed into the dark surface |
| `--mbk-screen-border`      | `#e3e5e0`     | 12% ink mixed into the dark surface |
| `--mbk-screen-link`        | `#4f7864`     | `#7fae95`                           |
| `--mbk-screen-link-strong` | `#2f5945`     | `#a4c9b3`                           |
| `--mbk-screen-danger-bg`   | `#fdf1ef`     | `#fdf1ef`                           |
| `--mbk-screen-danger-edge` | `#e7c3bb`     | `#e7c3bb`                           |
| `--mbk-screen-danger-ink`  | `#8a3423`     | `#8a3423`                           |

These values are the authored fragment's own colors, not the viewer interface.
Each device screen also sets its own CSS `color-scheme`, so native controls and
scrollbars inside a preview follow the preview rather than the interface. Fixed
phone hardware and the browser traffic lights keep their intended colors in both
appearances, and are named so no stylesheet repeats them:

| Role                          | Both appearances        |
| ----------------------------- | ----------------------- |
| `--mbk-device-body`           | `#171a18`               |
| `--mbk-device-notch`          | `#0b0d0c`               |
| `--mbk-device-home`           | `rgba(20, 24, 20, 0.4)` |
| `--mbk-device-light-close`    | `#d9655b`               |
| `--mbk-device-light-minimise` | `#dba43d`               |
| `--mbk-device-light-expand`   | `#50a86d`               |

The highlight mask over a preview dims the preview around the highlighted
component instances and outlines each instance. It marks the preview, not the
interface, so its two roles keep their values in both appearances:

| Role                    | Both appearances            |
| ----------------------- | --------------------------- |
| `--mbk-highlight-scrim` | `rgba(244, 246, 244, 0.72)` |
| `--mbk-highlight-edge`  | `#336249`                   |

A comparison in Difference mode paints an opaque base behind the compared
frames, taken from the compared preview scheme, so the blended result is
identical in both appearances.

## Component Explorer Preview Tokens

The component explorer draws a depicted component on its own sample surface,
inside the catalogue chrome. Those sample colours describe the depicted
content rather than the interface, so they stay Light in both appearances,
exactly as the preview tokens above do. A stylesheet that needs one of these
reads the token rather than repeating its value.

| Role             | Both appearances |
| ---------------- | ---------------- |
| `--ce-surface`   | `white`          |
| `--ce-text`      | `#252e28`        |
| `--ce-secondary` | `#647068`        |
| `--ce-soft`      | `#f3f6f3`        |
| `--ce-edge`      | `#dce5de`        |

The explorer's own artboards render in Light only, so these roles have no Dark
counterpart; a dark sample surface would need this table extended before those
artboards could publish a dark render. The explorer highlights a depicted
component with the shell's highlight mask, in the two highlight roles of the
preview tokens.

## Related Docs

- [Viewer semantic palette](./mokly-viewer-palette.md)
- [Viewer appearance](./mokly-viewer-appearance.md)
- [Shell canvas frames, preview scheme and compact layout](./mokly-shell-device-chrome.md)
