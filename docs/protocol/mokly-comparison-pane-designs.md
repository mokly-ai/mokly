# Comparison Pane Design References

## Delivery Status

Implemented and depicted in the design catalogue under
`examples/basic/specs/design`, as the
[comparison pane scroll alignment plan](../../plans/comparison-pane-scroll-alignment.md)
records. This document inventories the depictions of the
[comparison pane presentation contract](./mokly-comparison-panes.md); the
[shell design](./mokly-shell-design.md) and
[component design](./mokly-component-design.md) contracts own the complete
design tables and the behavior of every depicted control.

## Depicted States

The implemented design mockups depict the pane contract in both viewports, the
screen comparisons in both schemes and component comparisons in Light.
`design/changes/diff-controls/overlay` depicts a short Overlay and
`design/changes/diff-controls/overlay-long` a long screen part-way down its shared chrome, with
both layers at one offset, unchanged sections aligned, one reworded section
showing both versions, and the viewport's scrollbar drawn part-way down.
`design/changes/outcomes/difference` and `design/browse/appearance/workspaces/difference` depict Difference
with the same single-chrome stack over an opaque Before layer, and
`design/changes/outcomes/changed` and `design/browse/appearance/workspaces/side-by-side` depict Side by
side with one chrome per version. For component comparisons,
`design/components/pages/stacked/overlay` and `design/components/pages/stacked/difference` depict a saved
variant's two versions in one bordered component frame, and
`design/components/pages/stacked/overlay-tall` depicts a component taller than that frame
scrolled part-way inside it, with both versions at one scroll position and the
frame's scrollbar drawn to match; `design/components/pages/comparison` keeps one frame
per version in Side by side. Links inside every depicted pane are inert.

`design/changes/diff-controls/overlay-panel` depicts an app-shell screen in Overlay whose top bar and navigation stay in
place while both versions' main panels sit part-way down at one position, with
the panel's own scrollbar drawn and no page scrollbar on the chrome's viewport.
`design/changes/diff-controls/side-by-side-apart` depicts Side by side with
Scroll together off, each version at its own place with its own scrollbar.
Every diff-mode screen design draws the Scroll together switch after its mode
group, on everywhere but that one, as the runtime does.
See [the shell design](./mokly-shell-design.md) and
[the component design](./mokly-component-design.md) for the complete tables.

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
