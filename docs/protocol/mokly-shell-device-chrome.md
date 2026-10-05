# Shell Device Chrome And Preview Scheme

## Delivery Status

Implemented in the shared `@mokly/viewer` shell and depicted in Mokly's design
catalogue, as the [shell design contract](./mokly-shell-design.md) records.
This document owns the device frames, the whole-document pane, and the preview
color-scheme tokens and containment rules those frames use; the shell design
contract owns the surrounding layout, tokens, and responsive behavior, and the
[viewer appearance contract](./mokly-viewer-appearance.md) owns the interface
appearance around the frames. The document pane's Markdown document follows
the approved [document contract](./mokly-documents.md) and arrives with the
[path identity plan](../../plans/path-identity.md).

## Device Chrome

- **Phone frame** — 390×844, 12px bezel padding, `#171a18` body,
  46px radius, floating notch (108×30 at top 22px), a 36px-radius screen that
  is white unless the dark scheme is selected, and a bottom home pill (128×4).
  The screen is a column: a reserved status band followed by the embedded
  mobile fragment, which takes the remaining height and rounds only its bottom
  corners. The notch and home pill are decorative, hidden from accessibility
  semantics, and use `pointer-events: none` in both the design library and
  runtime shell. Preview links remain clickable where the home pill overlaps
  the embedded document; do not disable pointer events on the screen itself.
- **Phone status band** — the top 44px of the screen, padded `14px 28px 0` so
  its content clears the notch: a `9:41` clock on the left and cellular, Wi-Fi,
  and battery glyphs on the right. Text is 13.5px/600 in the screen ink
  (`--chrome-ink`, or `--mbk-dark-screen-ink` when the screen is dark) with
  tabular numerals; glyphs are 16×11 except the 22×11 battery, drawn with
  `currentColor` on their own viewBoxes. The band is device chrome, so it
  reserves space above the fragment rather than covering screen content.
- **Browser frame** — width 100%, max-width 1180px, height 760px, strong
  hairline border, 8px radius. Its 40px bar holds three traffic lights
  (`#d9655b`, `#dba43d`, `#50a86d`), a monospace address pill (copies the
  address on click, showing a `URL copied` toast), and the expand toggle.
- **Address pill** — the address truncates with an ellipsis and the pill ends
  with a 13px stroked copy icon that holds its size, muted until the pill is
  hovered and drawn in the accent then.
- **Expand toggle** — a 26px bordered button holding a 13px stroked
  outward-arrow icon, sized with the address pill's copy icon so neither
  control outweighs the other. Expanding fixes the frame to `inset: 2.5vh 2.5vw` at
  overlay z-index over a scrim (`rgba(20, 28, 22, 0.55)`), locks body scroll,
  and swaps the icon for its inward-arrow collapse counterpart; Escape or
  clicking outside collapses it. Only one frame expands at a time.
- **Use-case flow** — vertical numbered steps (32px accent number tiles)
  joined by a 2px connector line, each with title, description, a
  `This screen in the catalogue: <title> →` link, and one browser frame
  (height 640px) indented under the step head.
- **Document pane** — a bordered, 12px-radius iframe pane on the dotted stage
  holding a whole page or a Markdown document; a document has no viewport
  controls and follows the Appearance control between its light and dark
  renders.

## Color Scheme

A catalogue may render dark fragments beside its light ones. The preview scheme
changes what a device screen shows; the interface around the frames follows its
own appearance, described in
[mokly-viewer-appearance.md](./mokly-viewer-appearance.md). In a standalone
catalogue the two are one choice, made once in the top bar; an embedded root
keeps them apart, so a host can hold a light interface over a dark preview.

| Token                   | Value     | Role                             |
| ----------------------- | --------- | -------------------------------- |
| `--mbk-dark-screen-bg`  | `#121514` | Dark device-screen surface       |
| `--mbk-dark-screen-ink` | `#eef1ef` | Text and glyphs on a dark screen |

There is no third dark token: the secondary dark tones (status-band ink, home
pill, screen hairline, and the depicted screen content) are `color-mix` blends
of those two.

- **Containment** — dark paints the phone screen surface, including its
  status-band ink, its home pill, and the fragment it holds, and the browser
  viewport surface. The phone body and notch, the browser bar with its traffic
  lights and address pill, and every shell surface outside a device screen stay
  light.
- **Screen edge** — a dark screen inside the near-black phone body would lose
  its edge, so the phone screen carries a 1px inset `box-shadow` hairline mixed
  from the two dark tokens, painted on an overlay above the fragment so the
  embedded document cannot occlude it:
  `color-mix(in srgb, var(--mbk-dark-screen-ink) 12%, var(--mbk-dark-screen-bg))`.
  The browser viewport needs none; its light bar already draws that edge.
- **Control** — a standalone catalogue carries one Appearance selector in the
  top bar at every width, setting the interface and the previews together; see
  [mokly-viewer-appearance.md](./mokly-viewer-appearance.md). An embedded root
  instead carries a Dark preview toggle beside the viewport dropdown, and only
  when the catalogue has dark fragments. Authored design pairs navigate through
  their canonical scheme links. Component designs toggle their local preview;
  unavailable choices are disabled with an explanation.
- **Light-only screens** — a screen with no dark render keeps its light frames
  under a dark selection and states the fallback in its frame label, which
  gains an `mbk-frame-scheme-note` span so the caption reads
  `MOBILE — LIGHT ONLY` or `DESKTOP — LIGHT ONLY`. The note is the
  lighter-weight tail of the same uppercase label, not a separate badge.
  A use-case step frame carries the same fallback state but has no label, so it
  shows no scheme caption.
- **Diff views** — keep the normal viewport control in the screen heading and
  the Appearance control in the top bar. The compact diff band changes only how
  the selected screen is displayed. Light-only comparisons name their fallback;
  dark styling remains contained within device screens.

## Responsive Behavior

The shell has one breakpoint at **56.25rem (900px)**:

- At or above it, the navigation column is persistent and the layout is the
  fixed two-column split above.
- Below it, the navigation becomes a scrimmed overlay drawer (82% width, max
  20rem) opened by the top-bar menu button throughout the catalogue. The
  drawer opens under the 48px bar and the bar stacks above the scrim, so the
  menu button that opened it, the brand and the query stay
  at full strength while only the shell below the bar dims. The tag picker
  stops anchoring to the narrow field and drops as a sheet spanning the shell,
  flush under the bar's bottom border with only its lower corners rounded. The
  phone frame scales via `aspect-ratio: 390 / 844` within available width, the
  browser frame drops to 560px height, flow connector lines hide, the details
  body stacks to one column inside its bottom sheet. The grouped view controls
  stay together in the screen head band and wrap beneath the title when needed.

`prefers-reduced-motion: reduce` disables shell transitions.

## Related Docs

- [Shell design contract](./mokly-shell-design.md)
- [Viewer appearance](./mokly-viewer-appearance.md)
- [Viewer semantic palette](./mokly-viewer-palette.md)
