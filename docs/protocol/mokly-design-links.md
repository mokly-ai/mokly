# Mokly Design Mockup Links

## Delivery Status

Implemented in the 73 Browse/Changes design screens and two example screens with `MockLink`/`MockLink asChild`.
Those 73 Browse/Changes designs retain canonical links; [components](./mokly-component-design.md) and [removed previews](./mokly-removed-previews.md) extend the contract. The [source-path removal plan](../../plans/remove-source-path-evidence.md) records delivery; [M27](../../plans/remove-source-path-evidence.md#milestone-27-depict-the-excluded-only-stylesheet-state) adds the excluded-only state, splits the stylesheet gallery into child pages and gives the paired Excluded and Matched designs one Details card.
Links use complete paths under the [path contract](./mokly-paths.md).

## Scope And Ownership

The catalogue under `examples/basic/specs/design/` is a navigable prototype
under the [navigation](./mokly-navigation.md) and
[control](./mokly-link-controls.md) contracts. Existing contracts govern the API,
server, trusted frame adapter, sandbox and shell; no runtime capability changes.

Design links open catalogue entries that depict the requested destination.
They do not operate the depicted shell as a second running application. The
outer Browse shell preserves its viewport selection and handles history and
active-row visibility normally. The destination artboard depicts its own
canonical state; prior inspector, query, drawer, and depicted viewport state
are not transported implicitly. Only the explicitly paired states below
promise to retain their named subject or comparison mode. The actual Appearance
setting stays with the outer viewer.

Every design screen has mobile and desktop views. They are light-only
generated documents, including artboards depicting a dark product screen, except
the appearance screens (the `design/browse/appearance/**` entries), the canonical
`design/browse/views/screen` and `design/browse/views/details-screen`, their two retained
Welcome appearance variants, and the Welcome comparison family. These render
in both schemes so the outer Appearance control switches the depicted
catalogue. Link targets name design entry paths, not the example paths printed in
the depicted shell's metadata. Existing entries, screens, and text links remain
available. `example/screens/farewell` remains an intentionally absent product entry.
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
- Apply the existing marker/portable-link pipeline. Do not author `/view/`
  URLs, raw generated-file destinations, reserved metadata, event-driven
  routing, or consumer scripts as substitutes for `MockLink`.
- A control without a destination has no `href`, no mock-link marker, and no
  misleading keyboard stop. Keep the selected state visibly identified.
  Inactive controls must remain non-interactive after static generation. Native
  inspector tabs and viewport selections operate in place without navigation.
  Links inside inspector bodies use ordinary `MockLink` anchors. `asChild`
  inside `details` content builds silently, while a `summary`, button, or tab
  ancestor produces a build warning; keep design mockups warning-free.
- Keep reusable mockup controls in `specs/design/parts/`. Share the existing
  miniature screens between their owning standalone design screens and the
  depicted use case. Keep new files near 200 lines and below 300 lines.
- Retain the approved geometry, typography, and light/dark colors. Review
  element-dependent selectors when a `span`, `div`, or button becomes an
  anchor, including full-row hit areas, inherited color, and focus visibility.

## Canonical Destination Inventory

Existing destinations and their stable names are listed in the
[canonical design inventory](./mokly-shell-design-inventory.md) with the
[depicted catalogue's](./mokly-shell-design-catalogue.md#transitions) folder-page,
document, Moved, and index entry transitions. They keep those names; file names
derive from paths ([artifact paths](./mokly-artifact-paths.md)).

The five additions below render in both viewport variants and belong to the
canonical inventory; their owning components preceded link adoption.

| Added entry                                        | Depicted state                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `design/browse/views/details-screen`               | Normal Details screen, light selected, inspector closed           |
| `design/browse/views/screen/tag-picker`            | Welcome, empty query, unfiltered catalogue, picker open           |
| `design/browse/views/screen/tag-forms`             | Welcome, `tag:forms`, Welcome and Details retained, picker closed |
| `design/browse/views/screen/tag-onboarding`        | Welcome, `tag:onboarding`, Welcome retained, picker closed        |
| `design/browse/views/screen/tag-onboarding-picker` | The same onboarding filter with the picker open                   |

`design/browse/states/details` continues to mean Welcome's expanded inspector and remains
reachable from its catalogue entry. Opening/closing the Details icon stays on
the current screen and retains its query. It does not substitute for the
normal Details view.
`design/browse/states/tag-filter` retains its existing name and depicts the forms
filter with the picker open. The four listed tag states plus
`design/browse/views/screen/dark-scheme` and `design/browse/views/screen/light-only` retain their names
and are variants of `design/browse/views/screen`, each at its own path below the
parent's like any variant. Those six entries leave their former folder; the
`design-browse-tags` (Tag states) folder has no descendants and is absent from
navigation, while the variants remain under Welcome. No unrelated entry moves.

## Navigation Controls

| Control/context                                 | Destination or behavior                                                                                                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand, home breadcrumb, missing-route recovery  | `design/browse/views/home`                                                                                                                                                                                                               |
| Home: Open the first screen                     | `design/browse/views/screen`                                                                                                                                                                                                             |
| All catalogue: Welcome / Details / Example tour | `design/browse/views/screen` / `design/browse/views/details-screen` / `design/browse/views/use-case`                                                                                                                                     |
| Changed catalogue: Welcome / Details / Farewell | `design/changes/diff-controls/current` / `design/changes/outcomes/added` / `design/changes/outcomes/removed`                                                                                                                             |
| Changed catalogue: Survey / Invite / Archive    | `design/changes/outcomes/previous-version/long` / `design/changes/outcomes/previous-version/loading` / `design/changes/outcomes/previous-version/unavailable`                                                                            |
| Changed catalogue: Timeline                     | `design/changes/outcomes/previous-version/no-view`                                                                                                                                                                                       |
| Removed documents: four Changes rows            | `design/browse/pages/removed` / `design/browse/pages/previous-version/long` / `design/browse/pages/previous-version/loading` / `design/browse/pages/previous-version/unavailable`, each returning to `design/browse/views/home` from All |
| MiniWelcome: Open the details screen            | `design/browse/views/details-screen`                                                                                                                                                                                                     |
| MiniDetails: Return to welcome                  | `design/browse/views/screen`                                                                                                                                                                                                             |
| Depicted use-case step reference                | Welcome: `design/browse/views/screen`; Details: `design/browse/views/details-screen`                                                                                                                                                     |
| Welcome/Details inspector: Example tour         | `design/browse/views/use-case`                                                                                                                                                                                                           |
| Home menu open / drawer close                   | `design/browse/states/navigation` / `design/browse/views/home`                                                                                                                                                                           |
| Menu from another narrow design                 | Canonical `design/browse/states/navigation`; selecting a leaf opens that leaf's canonical destination                                                                                                                                    |
| Welcome All / Changes filter                    | `design/browse/views/screen` / `design/changes/diff-controls/current`                                                                                                                                                                    |
| Details All / Changes filter                    | `design/browse/views/details-screen` / `design/changes/outcomes/added`                                                                                                                                                                   |
| Removed screen All filter                       | `design/browse/views/home`, because the depicted product screen has no current entry                                                                                                                                                     |
| Empty Changes All filter                        | `design/changes/impact/ignored-only`                                                                                                                                                                                                     |
| Removed consumer return, component explorer     | `design/components/states/removed`, from the desktop Action row and the narrow Changes shortcut, never from the stage                                                                                                                    |

Folder rows and folder-only crumbs are not link targets: a folder row only
expands or collapses, and a folder crumb opens the folder's own page only when
one exists ([folder rules](./mokly-folders.md#rows-and-clicks)). Keep the design
tree's existing groups as text or native disclosure markup, give leaves explicit
paths, and give any added home crumb a distinct label and the home destination.

The home drawer depicts the canonical home state; closing it returns home.
The separately authored document drawer retains its document as described below.
An icon-only close control needs an accessible label. Do not imply a preserved
origin screen or simulate closing a drawer by linking back to the open state.

Inspector data and links must describe the depicted subject. Share typed
Welcome/Details metadata rather than rendering Welcome's generated path, tags,
and description under every screen. Removed screens have no live product
target or live-use-case link; their inspector records the previous version's
provenance. Related-doc labels without a portable public
document remain plain text; this change adds no document publishing pipeline.

The page designs extend this contract with explicit document destinations.
`design/browse/pages/view` and `design/browse/pages/details` pair the closed/open inspector;
`design/browse/pages/navigation` opens the document's drawer and closes back to its view.
Its page row targets `design/browse/pages/view`; Welcome and Example tour retain their
existing design destinations. The shared synthetic document takes an explicit
Welcome destination so its design variant stays inside the design catalogue,
while the real document continues to link to `example/screens/welcome`. The removed-page
state keeps a flat row and returns to catalogue home without inventing parents.

`design/browse/publication/catalogue` omits filter and comparison controls.
`design/browse/publication/changes` offers the existing Welcome comparison destinations;
its Changes action opens `design/changes/diff-controls/current`. Unsupported combinations
remain depictions. These six states retain their own typed navigation records;
none borrows another subject's inspector or drawer identity.

## Screen Variants

See [Screen Variants](./mokly-design-link-states.md#screen-variants) for the complete rules.

## Scheme, Comparison, And Tag States

See [Scheme, Comparison, And Tag States](./mokly-design-link-states.md#scheme-comparison-and-tag-states) for the complete rules.

## Local Runtime Controls

Viewport selection, browser expansion, ID copying, refresh/recompute, resize
grips, and collapse-all are not catalogue destinations in this change. Keep
their existing visual depictions and document their non-interactive status
outside the rendered artboard; do not add fake hrefs, clipboard-success copy,
or scripts. Existing native `details` disclosures may keep working locally.
The Scroll together checkbox toggles in place and opens no destination.
The real outer shell continues to provide its implemented runtime controls.

## Basic Example And Portability

In `examples/basic/specs/catalogue.tsx`, the `View details` action targets
`example/screens/details` with fragment `details`; `Return to welcome` targets
`example/screens/welcome`. The registered Action wrapper in
`examples/basic/src/components/action/action.mokly.tsx` uses `MockLink asChild` for these props.
Text links and renderer-required `onPress={noop}` remain; navigation comes from
the generated anchor. These labels promise navigation,
not workspace creation or a synthetic business operation. Exercise both
viewports and light/dark generation without changing fixture paths.

All design and example links must retain portable relative hrefs on disk and
authenticated markers in served/deployed Browse. Standalone activation opens
the matching generated viewport with the existing scheme fallback. Real
comparison snapshots keep portable links that the pane guard cancels;
design artboards depicting comparisons are ordinary Browse screens and use
normal enhanced navigation. Do not equate these two contexts.

## Verification Contract

- Before wiring controls, record failing semantic assertions for missing home,
  navigation, miniature-screen, flow-reference, and example-button links.
- Verify expected control destinations against the built real example manifest
  in both viewports, plus every light/dark example-button output. Detect wrong
  subjects, self-links masquerading as transitions, folder/absent destinations,
  duplicate/nested focus targets, and inactive controls becoming links.
- Check the canonical existing-design inventory against the complete manifest
  design-screen set, including exact paths. Keep unimplemented planned
  destinations separate from that inventory so omissions and drift are visible.
- Prove each new state is reachable from its owning screen/flow and has the
  specified return destination. Test tag query/picker agreement and both-scheme
  renders of the dual-scheme screens.
- In Browse, exercise pointer and Tab/Enter activation from mobile and desktop
  design frames, history Back/Forward, canonical outer URLs, active catalogue
  rows, and preserved outer viewport selection. Keep consumer scripts denied.
- Open every changed generated design page directly from disk and inspect both
  variants for visual regressions; test representative portable link round trips.
- Build the static preview and exercise the same journeys through its existing
  preview test helper. Cover actual Review snapshot link fallback separately.
- Use a small semantic expectation set per control family plus catalogue-wide
  target validation. A positive total-link count alone does not prove adoption.
- Run the relevant suites and complete `cargo xtask check`, then commit all
  authored source and documentation changes and push. Keep generated output ignored. After the push, use the
  [implementation review prompt](../implementation-review-prompt.md) against
  `origin/main`; report findings without automatically fixing them.
