# Mokly Shell Brand

## Delivery Status

Implemented in the shared `@mokly/viewer` shell and in Mokly's design
catalogue. Serve, static export, embedded viewers, and the mockups render the
same package-owned mark and wordmark without a cloud dependency or network
request.

## Identity Boundary

The top-bar brand is Mokly identity, not a consumer accent. The public
`--mokly-accent`, `--mokly-accent-contrast`, and `--mokly-accent-soft`
properties continue to tune selections, controls, and highlights, but never
recolor the logo. Brand selectors and internal `--chrome-*` roles are not a
consumer compatibility surface.

The brand link has the accessible name `Mokly`. Its SVG is decorative and
`aria-hidden`; the visible wordmark does not provide the link's accessible
name.

## Mark

The mark is a 22px SVG on a 32-unit viewBox, matching Mokly Cloud's product
header so a host-owned header and the viewer do not change its apparent size.
It contains two overlapping rounded screens:

- each screen is 20×21 units with four-unit corners;
- the back screen starts at `(3, 3)` and uses 30% opacity;
- the front screen starts at `(9, 8)`;
- both screens fill with `--chrome-brand`; and
- the front screen carries `M14 15h10` and `M14 20h7` as two-unit,
  round-capped strokes in `--chrome-surface`.

`--chrome-brand` is `#2f5945` in Light and `#a3cdb4` in Dark. The rules take
the active interface surface, so Dark uses the light-green mark with dark rules.
These values and their recorded non-text contrast are owned by the
[semantic palette](./mokly-viewer-palette.md).

## Wordmark And Layout

The mark is non-shrinking. The lowercase `mokly.` wordmark follows it after an
8px gap in its own `mbk-name` span. It uses
`--serif: Georgia, "Times New Roman", serif` at 20px, regular weight,
`-0.01em` tracking, and never wraps. Mokly packages no serif font file; this is
the only shell text that uses the system-serif stack.

The narrow top bar hides the wordmark so search retains space, while the mark
and accessible link name remain. The mark keeps the same size and colors in
standalone and embedded shells at every width.

## Verification

Unit tests pin the SVG bytes, Light and Dark roles, wordmark typography, and
shared runtime/mockup styles. Browser coverage verifies the mark in the
responsive shell and design catalogue. Palette tests keep the brand/surface
contrast pair recorded in both appearances.

## Related Docs

- [Shell design](./mokly-shell-design.md)
- [Viewer semantic palette](./mokly-viewer-palette.md)
- [Viewer appearance](./mokly-viewer-appearance.md)
