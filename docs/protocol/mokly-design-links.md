# Mokly Design Mockup Links

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Two linked pages hold the destination tables: the [navigation
links](./mokly-design-links-navigation.md) cover the navigation controls and the
screen variants, and the [scheme, comparison, and tag
links](./mokly-design-links-comparisons.md) cover the scheme, comparison,
stylesheet evidence, and tag states.

## Scope And Ownership

The catalogue under `examples/basic/specs/design/` is a navigable prototype
under the [navigation](./mokly-navigation.md) and
[control](./mokly-link-controls.md) contracts. The package API, server, trusted
frame adapter, sandbox, and actual shell behavior stay governed by their
existing contracts; the design links need no new runtime capability.

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
retained Welcome appearance variants, and the Welcome comparison family. These
render in both schemes so the outer Appearance control switches the depicted
catalogue. Link targets name design entry paths, not the example paths printed
in the depicted shell's metadata. Existing entries, screens, and text links stay
available. `example/screens/farewell` is an intentionally absent product entry.
This depicted dark set is representative; the runtime's single Appearance
preference, rather than per-screen dark renders, keeps a whole session dark.

## Authoring And Shared Components

- Define typed destination constants and control mappings near the design
  components. Separate catalogue destinations from labels, depicted product
  paths, and CSS classes; never derive destinations by matching visible text.
- Use ordinary `MockLink` for text links and `MockLink asChild` for styled
  buttons, chips, and rows. Provide one eligible root with no interactive
  descendants. Whole rows must not wrap disclosure buttons or child rows.
- Put styles, labels, ids, and accessibility attributes on an adapted child.
  Active navigation is a native anchor with normal Tab/Enter behavior and a
  visible focus outline. Do not carry button-only ARIA semantics onto links.
- Apply the existing marker/portable-link pipeline. Do not author `/view/` URLs,
  raw document-file destinations, reserved metadata, event-driven routing, or
  consumer scripts as substitutes for `MockLink`.
- A control without a destination has no `href`, no mock-link marker, and no
  misleading keyboard stop. Keep the selected state visibly identified. Inactive
  controls must stay non-interactive in the static build. Native inspector tabs
  and viewport selections operate in place without navigation. Links inside
  inspector bodies use ordinary `MockLink` anchors. `asChild` inside `details`
  content builds silently, while a `summary`, button, or tab ancestor produces a
  build warning; keep design mockups warning-free.
- Keep reusable mockup controls in `specs/design/parts/`. Share the existing
  miniature screens between their owning standalone design screens and the
  depicted use case. Keep new files near 200 lines and below 300 lines.
- Keep the design's geometry, typography, and light/dark colors. Review
  element-dependent selectors when a `span`, `div`, or button becomes an anchor,
  including full-row hit areas, inherited color, and focus visibility.

## Canonical Destination Inventory

Existing destinations and their stable names are listed in the [canonical design
inventory](./mokly-shell-design-inventory.md) with the [depicted
catalogue's](./mokly-shell-design-catalogue.md#transitions) folder-page,
document, Moved, and index entry transitions. They keep those names; file names
derive from paths ([artifact paths](./mokly-artifact-paths.md)).

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
Details view. `design/browse/states/tag-filter` keeps its name and depicts the
forms filter with the picker open. The four listed tag states plus
`design/browse/views/screen/dark-scheme` and
`design/browse/views/screen/light-only` keep their names and are variants of
`design/browse/views/screen`, each at its own path below the parent's like any
variant. Those six entries are not folder members; the `design-browse-tags` (Tag
states) folder has no descendants and is absent from navigation, while the
variants stay under Welcome.

Runtime transitions reach the loading and recovery screens, the editing
preparation states, the Screen props state, and the Read-only and recovery
gallery; catalogue navigation reaches each, and only a [failure state's
retry](./mokly-shell-design-inventory.md#loading-state-retries) links into one.

## Local Runtime Controls

Viewport selection, browser expansion, ID copying, refresh/recompute, resize
grips, and collapse-all are not catalogue destinations. Keep their existing
visual depictions and document their non-interactive status outside the rendered
artboard; do not add fake hrefs, clipboard-success copy, or scripts. Existing
native `details` disclosures may keep working locally. The Scroll together
checkbox toggles in place and opens no destination. The real outer shell
provides the runtime controls.

## Basic Example And Portability

In `examples/basic/specs/catalogue.tsx`, the `View details` action targets
`example/screens/details` with fragment `details`; `Return to welcome` targets
`example/screens/welcome`. The registered Action component uses
`MockLink asChild` for these props. Text links and renderer-required
`onPress={noop}` stay; navigation comes from the rendered anchor. These labels
promise navigation, not workspace creation or a synthetic business operation.
Exercise both viewports and light/dark renders without changing fixture paths.

All design and example links must keep portable relative hrefs on disk and
authenticated markers in served/deployed Browse. Standalone activation opens the
matching rendered viewport with the existing scheme fallback. Real comparison
snapshots keep portable links that the pane guard cancels; design artboards
depicting comparisons are ordinary Browse screens and use normal enhanced
navigation. Do not equate these two contexts.

## Verification Contract

- Before wiring controls, record failing semantic assertions for missing home,
  navigation, miniature-screen, flow-reference, and example-button links.
- Verify expected control destinations against the catalogue index of a strict
  static build of the example in both viewports, plus every light/dark
  example-button output. Detect wrong subjects, self-links masquerading as
  transitions, folder/absent destinations, duplicate/nested focus targets, and
  inactive controls becoming links. The check reads a static build, not Serve:
  both render the same catalogue, and the browser suite covers Serve.
- Check the canonical existing-design inventory against the catalogue index's
  complete design-screen set, including exact paths. Keep destinations without
  an owning screen separate from that inventory so omissions and drift are
  visible.
- Prove each new state is reachable from its owning screen/flow, or from
  catalogue navigation when only a runtime transition reaches it, and has the
  specified return destination. Test tag query/picker agreement and both-scheme
  renders of the dual-scheme screens.
- In Browse, exercise pointer and Tab/Enter activation from mobile and desktop
  design frames, history Back/Forward, canonical outer URLs, active catalogue
  rows, and preserved outer viewport selection. Keep consumer scripts denied.
- Open every changed design page in the served Browse frames and inspect both
  variants for visual regressions; test representative portable link round
  trips.
- Run `mokly build` and exercise the same journeys in the static output. Cover
  actual Review snapshot link fallback separately.
- Use a small semantic expectation set per control family plus catalogue-wide
  target validation. A positive total-link count alone does not prove adoption.
- Run the relevant suites and complete `cargo xtask check`, then commit all
  authored source and documentation changes and push. Keep the build output
  ignored. After the push, use the `implementation-review` skill against
  `origin/main`; report findings without automatically fixing them.

## Related Docs

- [Design mockup navigation links](./mokly-design-links-navigation.md)
- [Design mockup comparison and tag links](./mokly-design-links-comparisons.md)
- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Depicted design catalogue](./mokly-shell-design-catalogue.md)
