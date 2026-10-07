# Mokly Shell Design Contract

## Scope

This document records the approved design for the package-owned Browse shell
and the optional in-place screen comparisons. The visual source of truth is the
design catalogue in the basic example, whose entry paths start with `design/`;
this contract fixes the tokens, dimensions, and responsive behavior that
implementation and tests must preserve. Runtime behavior stays in
[mokly-runtime.md](./mokly-runtime.md).

The shared [React shell](./mokly-viewer.md#shell-tree-and-state) preserves these
tokens, dimensions and interactions in Serve, export and embedded hosts.
The [component explorer designs](./mokly-component-design.md) own component
states. Specs, browse-only folders, Overview rows, path chips, documents and
Moved rows use the designs listed in the [inventory](./mokly-shell-design-inventory.md).

Auto/Light/Dark interface appearance is designed in the
`design/browse/appearance/**` mockups and specified by the
[semantic palette](./mokly-viewer-palette.md). The shell now carries that
palette in both appearances, selected on a viewer root, and an embedded host
chooses one with `theme`. A standalone document carries the delivered Appearance
control at every width and uses it for both the shell and the previews.

The page and publication designs are implemented in the example catalogue and
shared shell. Whole documents use a plain bordered pane and omit
device/comparison controls. Removed pages are flat Changes rows; baseline
breadcrumbs are text even after their parents are deleted. Ordinary
publications omit the Changes filter and comparison band while preserving the
same navigation, search, tags, and variants.

The comparison designs implement the [pane](./mokly-comparison-panes.md),
[scrolling](./mokly-comparison-scrolling.md), and
[Scroll together](./mokly-comparison-scroll-together.md) contracts, including
stacked component frames, paired app-shell panels, and the switched-off state.

The removed-document and removed-screen designs depict the shipped
[removed previews](./mokly-removed-previews.md) behavior: the previous version
under a quiet "Showing previous version" label, with loading, unavailable, and
long-content states in their own child pages. The shell renders those states at
runtime. The removed-screen family also designs a viewport with no captured
previous view; the shell renders the note fixed by the
[removed content previews plan](../../plans/removed-content-previews.md).

## Design Mockups

The approved screens are authored in `examples/basic/specs/design/`. The
[shell design inventory](./mokly-shell-design-inventory.md) lists every Browse
and Changes design screen with its folder and depicted state, describes the
fixture catalogue they browse, and owns the dual-scheme and owning-group rules;
the [component design inventory](./mokly-component-design.md#owning-catalogue)
lists the component explorer screens.

## Consumer-Tunable Custom Properties

Consumers may set exactly these CSS custom properties to tune the shell accent.
The shell reads them with the defaults below; every other shell style is
package-owned and not a compatibility surface.

| Property                  | Default                   | Used for                      |
| ------------------------- | ------------------------- | ----------------------------- |
| `--mokly-accent`          | `#4f7864`                 | Active pills and rows         |
| `--mokly-accent-contrast` | `#ffffff`                 | Text and glyphs on the accent |
| `--mokly-accent-soft`     | `rgba(79, 120, 100, 0.1)` | Hover and highlight surfaces  |

A consumer accent pair must keep at least WCAG AA contrast between
`--mokly-accent` and `--mokly-accent-contrast`; the shell does not
recompute contrast at runtime. The [Mokly shell brand](./mokly-shell-brand.md)
is package-owned identity and ignores these consumer accent overrides.

## Package-Owned Tokens

The shell chrome supports Light and Dark independently of the preview's color
scheme. Light retains its neutral/sage family; Dark uses Mokly Cloud's warm
Folio neutrals with sage accents. The complete mapping and both palettes live in
the [semantic palette](./mokly-viewer-palette.md). The Light values are:

| Token                    | Value                            | Role                     |
| ------------------------ | -------------------------------- | ------------------------ |
| `--chrome-bg`            | `#f4f4f1`                        | Application background   |
| `--chrome-surface`       | `#ffffff`                        | Cards, bars, panes       |
| `--chrome-ink`           | `#1a1d1c`                        | Primary text             |
| `--chrome-ink-2`         | `#4a4f4d`                        | Secondary text           |
| `--chrome-muted`         | `#676e6a`                        | Tertiary and labels      |
| `--chrome-border`        | `#e3e5e0`                        | Hairline borders         |
| `--chrome-border-strong` | `#c8ccc4`                        | Frame and strong borders |
| `--chrome-control-edge`  | `#868e88`                        | Interactive boundaries   |
| `--chrome-accent`        | `#2a4733`                        | Deep-accent prose links  |
| `--chrome-brand`         | `#2f5945`                        | Mokly brand mark         |
| `--chrome-shadow`        | `0 30px 90px rgba(20,28,22,.14)` | Overlay elevation        |

The shipped shell and appearance mockups share the two corrected Light values:
`--chrome-muted` is `#676e6a`, and control outlines, grips and field borders use
`--chrome-control-edge` `#868e88` so `--chrome-border-strong` remains limited to
device and pane frames. Both are recorded, with their contrast, in the
[semantic palette](./mokly-viewer-palette.md).

Typography is **Inter** (a variable font packaged with the shell and served at
`/mokly-viewer/fonts/InterVariable.woff2` under its SIL OFL license) via
`--sans: "Inter", ui-sans-serif, system-ui, …` at a 13px shell base, with
`--mono: "SFMono-Regular", Consolas, …` for ids, addresses, and paths.
The [brand contract](./mokly-shell-brand.md) owns the system-serif wordmark
exception; no serif font file is packaged.
The nav indent guides use the faint `--mbk-guide: #dbded8` tint. The shell
ships no consumer product fonts beyond Inter, and no consumer-specific color,
name, or route family may appear in shell styles or copy.

## Layout

See [Layout](./mokly-shell-layout.md#layout) for the complete rules.

## Device Chrome And Color Scheme

The phone and browser frames, the use-case flow layout, the document pane, and
the dark preview tokens with their containment and light-only rules are defined
by [shell device chrome and preview scheme](./mokly-shell-device-chrome.md).

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

## In-place Comparisons

The catalogue remains the only shell. Eligible shown views place Current, Side
by side, Overlay, and Difference below the heading; Current starts selected.
Diffs load on demand in the same main region while navigation, details,
viewport, scheme, Refresh, and Retry stay available. The band appears for a
changed shown view, removed component variant, or verified affected consumer,
and is absent from Browse, Added, Unmodified, removed-screen, evidence-only,
and empty states. Static catalogues without comparison data omit it.

Both viewports reuse their device frames. Overlay and Difference keep both
script-disabled versions inside one opaque chrome; Side by side keeps one
captioned chrome per version. Missing component-variant panes remain explicit
and fall back to Side by side. Loading, failure, evidence, and ignored details
remain secondary and never invent pixel measurements. Exact presentation,
scrolling, switch geometry, responsive wrapping, app-shell dimensions, and
fixed-row depictions live in the linked comparison contracts above.

The canonical states are `design/changes/diff-controls/current`, `design/changes/diff-controls/overlay`,
`design/changes/diff-controls/overlay-long`, `design/changes/diff-controls/overlay-panel`, and
`design/changes/diff-controls/side-by-side-apart`, each with path-derived
`index.<viewport>.html` documents and mobile and desktop artboards. See
[Changes](./mokly-changes.md), [component designs](./mokly-component-design.md),
and [CSS evidence](./mokly-css-evidence-shell.md).

## Related Docs

- [Build and Browse runtime](./mokly-runtime.md)
- [Package and authoring contract](./mokly-package.md)
