# Mokly Design Mockup Links

Status: The outer viewer's canvas, which shows the Light and Dark frames of a design screen at once, is not built yet. [Milestone 11](../../plans/canvas-redesign-milestones-viewer.md#milestone-11-canvas-stage-in-moklyui) builds it.

Two linked pages hold the destination tables: the [navigation
links](./mokly-design-links-navigation.md) cover the navigation controls and the
screen variants, and the [scheme, comparison, and tag
links](./mokly-design-links-comparisons.md) cover the scheme, comparison,
stylesheet evidence, and tag states.

## Scope And Ownership

The catalogue under `examples/basic/specs/design/` is a navigable prototype
under the [navigation](./mokly-navigation.md) and
[control](./mokly-link-controls.md) contracts. The package API, server, trusted
frame adapter, sandbox, and actual shell behavior follow their own contracts.
Design links need no runtime capability of their own.

Design links open catalogue entries that depict the requested destination. They
do not operate the depicted shell as a second running application. The outer
Browse shell preserves its viewport selection and handles history and active-row
visibility normally. The destination artboard depicts its own canonical state;
prior panel tab, query, sheet, zoom, and depicted frame state are not
transported implicitly. Only the explicitly paired states that the [navigation
links](./mokly-design-links-navigation.md) and the [scheme, comparison, and tag
links](./mokly-design-links-comparisons.md) define promise to retain their named
subject or comparison mode. The actual Appearance setting stays with the outer
viewer.

Every design screen has mobile and desktop views. The Canvas screens
(`design/canvas/**`) and the appearance screens (`design/browse/appearance/**`)
render in both schemes. Every other design screen renders light-only
documents, also where it depicts a dark product screen. The outer viewer's
canvas shows the Light and Dark frames of each dual-scheme screen at once. It
shows every other design screen as its Light frames alone, under the
[preview scheme rules](./mokly-shell-device-chrome.md#color-scheme). The outer
Appearance control colours the outer viewer's chrome, not the frames of a
screen. The shell's one Appearance preference, not a dark render of each
screen, sets the appearance of its chrome for a whole session. Link targets
name design entry paths, not the example paths printed in the depicted shell's
metadata. `example/screens/farewell` is an intentionally absent product entry.

## Link Behavior

Design links are link controls under the
[control contract](./mokly-link-controls.md). Every design link opens an
existing design entry in the same viewport. From a dark view, it opens the
target's dark document wherever one exists. A design link to its own entry marks
itself as the current page with `aria-current`, except the top bar's brand
link. No design link sits inside another focus stop or holds one. A depicted
control without a destination has no `href`, no mock-link marker, and no
misleading keyboard stop. An inactive control never becomes a link. The
selected state stays visibly identified. Native inspector tabs and viewport
selections operate in place without navigation. Each depicted state is
reachable from its owning screen or flow, or from catalogue navigation when no
depicted control opens it, such as a state that only a runtime transition
reaches or the one state of a branch of its own. Design documents carry no consumer
scripts. The design mockups build without warnings.

## Canonical Destination Inventory

The [Canvas design inventory](./mokly-shell-canvas-inventory.md), the
[loading, search and evidence inventory](./mokly-shell-canvas-inventory-states.md),
the [component design inventory](./mokly-component-design-inventory.md) and
the [shell design inventory](./mokly-shell-design-inventory.md) list every
destination under its stable name, with the [depicted
catalogue's](./mokly-shell-design-catalogue.md#transitions) transitions. File
names derive from paths ([artifact paths](./mokly-artifact-paths.md)). A saved
variant, such as each tag filter of `design/canvas/search/tags`, is a
destination at its own path below its parent's, not a folder member.

Only runtime transitions reach some design states. Catalogue navigation
reaches each of them, and an artboard links into one only as a failure
state's retry. The
[loading state retries](./mokly-shell-design-inventory.md#loading-state-retries)
list these states and their retries.

## Local Runtime Controls

Viewport selection, browser expansion, path and ID copying, refresh/recompute,
resize grips, and collapse-all are not catalogue destinations. Their
depictions stay visual only, with no fake hrefs, clipboard-success copy, or
scripts. Their non-interactive status is documented outside the rendered
artboard. Native `details` disclosures may work locally. The frame picker, the
Frames filter toggles, the Highlight components switch, and the Scroll
together switch work in place and open no destination. The real outer shell
provides the runtime controls.

## Basic Example And Portability

In the basic example, the `View details` action targets
`example/screens/details` with fragment `details`, and `Return to welcome`
targets `example/screens/welcome`. The registered Action component uses
`MockLink asChild` for these props. The screens keep their text links, and
the Action keeps its renderer-required `onPress={noop}`. Navigation comes from
the rendered anchor. These labels promise navigation, not workspace creation
or a synthetic business operation.

All design and example links must keep portable relative hrefs on disk and
authenticated markers in served/deployed Browse. Standalone activation opens the
matching rendered viewport with the scheme fallback. Real comparison
snapshots keep portable links that the pane guard cancels; design artboards
depicting comparisons are ordinary Browse screens and use normal enhanced
navigation. Do not equate these two contexts.

## Related Docs

- [Design mockup navigation links](./mokly-design-links-navigation.md)
- [Design mockup comparison and tag links](./mokly-design-links-comparisons.md)
- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Depicted design catalogue](./mokly-shell-design-catalogue.md)
