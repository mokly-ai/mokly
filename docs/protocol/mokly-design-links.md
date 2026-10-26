# Mokly Design Mockup Links

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
prior inspector, query, drawer, and depicted viewport state are not transported
implicitly. Only the explicitly paired states that the [navigation
links](./mokly-design-links-navigation.md) and the [scheme, comparison, and tag
links](./mokly-design-links-comparisons.md) define promise to retain their named
subject or comparison mode. The actual Appearance setting stays with the outer
viewer.

Every design screen has mobile and desktop views. They are light-only rendered
documents, including artboards depicting a dark product screen, except the
appearance screens (the `design/browse/appearance/**` entries), the loading and
recovery screens (`design/browse/loading/**`), the canonical
`design/browse/views/screen` and `design/browse/views/details-screen`, their two
Welcome appearance variants, and the Welcome comparison family. These
render in both schemes so the outer Appearance control switches the depicted
catalogue. Link targets name design entry paths, not the example paths printed
in the depicted shell's metadata. `example/screens/farewell` is an
intentionally absent product entry.
This depicted dark set is representative; the runtime's single Appearance
preference, rather than per-screen dark renders, keeps a whole session dark.

## Link Behavior

Design links are link controls under the
[control contract](./mokly-link-controls.md). Every design link opens an
existing design entry in the same viewport. From a dark view, it opens the
target's dark document wherever one exists. A design link to its own entry marks
itself as the current page with `aria-current`, except the top bar's brand
link. No design link sits inside another focus stop or holds one. A depicted
control without a destination has no `href`, no mock-link marker, and no
keyboard stop. An inactive control never becomes a link. The selected state
stays visibly identified. Native inspector tabs and viewport selections
operate in place without navigation. Each depicted state is reachable from
its owning screen or flow, or from catalogue navigation when only a runtime
transition reaches it. Design documents carry no scripts. The design mockups
build without warnings.

## Canonical Destination Inventory

The [canonical design inventory](./mokly-shell-design-inventory.md) lists
every destination under its stable name, with the [depicted
catalogue's](./mokly-shell-design-catalogue.md#transitions) folder-page,
document, Moved, and index entry transitions. File names derive from paths
([artifact paths](./mokly-artifact-paths.md)).

The five entries below render in both viewports and belong to the canonical
inventory.

| Entry                                              | Depicted state                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `design/browse/views/details-screen`               | Normal Details screen, light selected, inspector closed           |
| `design/browse/views/screen/tag-picker`            | Welcome, empty query, unfiltered catalogue, picker open           |
| `design/browse/views/screen/tag-forms`             | Welcome, `tag:forms`, Welcome and Details retained, picker closed |
| `design/browse/views/screen/tag-onboarding`        | Welcome, `tag:onboarding`, Welcome retained, picker closed        |
| `design/browse/views/screen/tag-onboarding-picker` | The same onboarding filter with the picker open                   |

`design/browse/states/details` means Welcome's expanded inspector and is
reachable from its catalogue entry. Opening/closing the Details icon stays on
the current screen and retains its query. It does not substitute for the normal
Details view. `design/browse/states/tag-filter` depicts the forms filter with
the picker open. The four listed tag states plus
`design/browse/views/screen/dark-scheme` and
`design/browse/views/screen/light-only` are variants of
`design/browse/views/screen`, each at its own path below the parent's like any
variant. Those six entries are not folder members, and navigation lists them
under Welcome.

Runtime transitions reach the loading and recovery screens, the editing
preparation states, the Screen props state, and the Read-only and recovery
gallery; catalogue navigation reaches each, and only a [failure state's
retry](./mokly-shell-design-inventory.md#loading-state-retries) links into one.

## Local Runtime Controls

Viewport selection, browser expansion, ID copying, refresh/recompute, resize
grips, and collapse-all are not catalogue destinations. Their depictions stay
visual only, with no fake hrefs, clipboard-success copy, or scripts. Their
non-interactive status is documented outside the rendered artboard. Native
`details` disclosures may work locally. The Scroll together checkbox toggles
in place and opens no destination. The real outer shell provides the runtime
controls.

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
- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Depicted design catalogue](./mokly-shell-design-catalogue.md)
