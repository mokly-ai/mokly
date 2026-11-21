# Mokly Shell Brand

Status: The shell does not draw the new mark and the Geist wordmark yet. [Milestone 3](../../plans/canvas-redesign.md#milestone-3-palette-source-fonts-and-brand) draws them.

## Identity Boundary

The top-bar brand is Mokly identity, not a consumer accent. The public
`--mokly-accent`, `--mokly-accent-contrast`, and `--mokly-accent-soft`
properties continue to tune selections, controls, and highlights, but never
recolor the logo. Brand selectors and internal `--chrome-*` roles are not a
consumer compatibility surface.

The mark and the wordmark have one design on every Mokly surface: the shell,
the site, the cloud app, the emails, the brand files, the favicon, the social
cards, and the desktop icon. Decision: the new mark and the Geist wordmark on
every copy (decision 5, option B), not a brand for the site alone, because a
design-tool brand needs one mark everywhere.

The brand link has the accessible name `Mokly`. Its SVG is decorative and
`aria-hidden`; the visible wordmark does not provide the link's accessible
name.

## Mark

The mark is a 22px SVG on a 32-unit viewBox, matching Mokly Cloud's product
header so a host-owned header and the viewer do not change its apparent size.
It draws the selected layer of a design file: an outline frame behind a
filled front layer that carries two short rules.

- The back frame is an 18.8×19.8-unit rectangle at `(3.6, 3.6)` with
  4.6-unit corners. It is a 1.8-unit outline in `text`, with no fill.
- The front layer is a 20×21-unit rectangle at `(9, 8)` with 4.8-unit
  corners, filled with `signal`.
- A 1.6-unit `surface` stroke, painted under the fill, rings the front layer,
  so a gap separates it from the back frame.
- The front layer carries `M14 15h10` and `M14 20h7` as 2.1-unit,
  round-capped strokes in `onSignal`.

The roles are the [Canvas palette](./mokly-viewer-palette.md#canvas-palette)
roles of the interface appearance, so Dark draws a light outline, the dark
scheme's signal green, and the same dark rules. The `text` outline keeps the
mark visible at 3:1 or more on every surface. The `signal` front layer is
identity and has no contrast minimum. The palette records the values of these
roles and the contrast of the outline.

## Wordmark And Layout

The mark is non-shrinking. The lowercase `mokly.` wordmark follows it after an
8px gap. It sets `mokly` in `text` and the period in `signal`, in the
palette's `sans` stack, Geist, at 20px, weight 640, and `-0.055em` tracking,
and it never wraps.

The narrow top bar hides the wordmark so search retains space, while the mark
and accessible link name remain. The mark keeps the same size and colors in
standalone and embedded shells at every width.

## Related Docs

- [Shell design](./mokly-shell-design.md)
- [Viewer semantic palette](./mokly-viewer-palette.md)
- [Viewer appearance](./mokly-viewer-appearance.md)
