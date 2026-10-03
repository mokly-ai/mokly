# Mokly Design Mockup Links

## Delivery Status

Implemented in the 70 Browse/Changes design screens and two example screens with
`MockLink`/`MockLink asChild`. Those 70 Browse/Changes designs retain canonical
links; [components](./mokly-component-design.md) and
[removed previews](./mokly-removed-previews.md) extend the contract. Links use complete paths under the [path contract](./mokly-paths.md).

## Scope And Ownership

The catalogue under `examples/basic/specs/design/` is a navigable prototype
under the [navigation](./mokly-navigation.md) and
[control](./mokly-link-controls.md) contracts. The package API,
server, trusted frame adapter, sandbox, and actual shell behavior stay governed
by their existing contracts; this adoption requires no new runtime capability.

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
  Links inside inspector bodies use ordinary `MockLink` anchors; `asChild`
  deliberately rejects interactive ancestors including `details`.
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
| Empty Changes All filter                        | `design/browse/views/screen`                                                                                                                                                                                                             |
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

The five variant states, `design/browse/variants/variant-selected`, `-changes`,
`-removed`, `-reparented`, and `design/browse/variants/changed-views`, depict a screen's
variants as ordinary catalogue entries grouped under their parent. The
disclosure beside a parent row is a depiction with no destination, because the
served shell toggles the list in place; the parent row itself keeps its own
destination. A variant row without an authored destination stays a depiction.

| Control/context                              | Destination                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| All catalogue: Welcome parent row            | `design/browse/views/screen`, the parent's own screen                         |
| All catalogue: `Empty workspace` variant row | `design/browse/variants/variant-selected`                                     |
| Selected variant: Welcome breadcrumb         | `design/browse/views/screen`, because a variant keeps its parent's crumbs     |
| Selected variant: Changes filter             | `design/browse/variants/variant-changes`                                      |
| Changed variant: All filter                  | `design/browse/variants/variant-selected`                                     |
| Changed variant: Welcome parent row          | `design/browse/variants/variant-changes`, the parent's first changed variant  |
| Removed variant: All filter                  | `design/browse/views/screen`, because the parent screen still exists          |
| Reparented removed variant: All filter       | `design/browse/views/home`, because its former parent is now a variant        |
| Changed views: All filter                    | `design/browse/views/screen`                                                  |
| Changed views: Details view list             | `design/changes/outcomes/changed`, the canonical comparison with both schemes |

The changed-variant and removed-variant states keep their Welcome breadcrumb as
text, because no artboard depicts an unmodified parent inside Changes. On the
removed state the parent row is a depiction too: the deletion is a later state
of the same group, so it must not open the earlier changed-variant scenario.
The removed variant has no live product destination and no comparison modes;
its stage shows the variant's inert previous version.
In the reparented state, only the removed child is a Changes row: it is a
removed entry whose former parent now names a variant. The Changes
filter therefore hides the unmodified current parent and its variant (the
former parent), and shows the removed child as one flat screen row outside
their former folder hierarchy. The historical breadcrumb remains visible on the
screen itself with the former parent's title as plain text, but the Changes rail
contains no parent or nested variant list.
The depicted All control links to the canonical catalogue home artboard; the
reparented hierarchy is the context for this Changes-state example.
The changed-views state shows no comparison band. Its marks on Appearance
and the viewport dropdown identify evidence about other views. The Details
view list opens the canonical comparison; the outer Appearance control chooses
its generated scheme. The depicted Appearance selector has no authored transition.

## Scheme, Comparison, And Tag States

No screen header depicts a scheme control; standalone Browse owns one
Appearance selector in the top bar. `design/browse/views/screen`,
`design/browse/views/details-screen`, the Welcome comparison
family (`design/changes/diff-controls/**`, `design/changes/outcomes/changed`, and
`design/changes/outcomes/difference`) and the appearance entries
render in Light and in Dark instead, and the outer Appearance control moves
between those two generated views of the same entry. A link out of a dark
fragment resolves to the target's dark fragment wherever one exists, and every
member of a comparison family publishes the same schemes, so no comparison
control strands a reader in a light document. The existing
`design/browse/views/screen/dark-scheme` and `design/browse/views/screen/light-only` entries remain Welcome
variants for stable catalogue links. Their artboards now render in both schemes
and follow the single Appearance selector in the top bar; they have no scheme
control in the header. The old `design-review-dark-scheme` depiction is removed
in favor of the dual-scheme `design/changes/outcomes/changed` entry. Appearance comparison controls map Side by side
to `design/browse/appearance/workspaces/side-by-side` and Difference to
`design/browse/appearance/workspaces/difference`, with Current returning to
`design/browse/appearance/overview`; Overlay stays a depiction. Their All filter opens
`design/browse/appearance/overview` and Changes opens
`design/browse/appearance/workspaces/side-by-side`.

The Welcome light comparison controls map Side by side to
`design/changes/outcomes/changed`, Overlay to `design/changes/diff-controls/overlay`, and Difference
to `design/changes/outcomes/difference`. These controls appear in the explicit changed
Welcome states; Browse and tag-picker states omit them. Each comparison destination depicts Changes selected;
its Current action returns to `design/changes/diff-controls/current`. Current is already
selected in `design/changes/diff-controls/current`, so it has no
transition there. Returning to All uses the navigation table above.
The scrolling `design/changes/diff-controls/**` examples keep those destinations; their
controls navigate nowhere and pane links are inert.

Added Details shows its Current preview without comparison modes. Removed
Farewell, Survey, Invite, Archive, and Timeline show their previous version,
its loading wait, its unavailable state with Retry, or the note naming the
viewport that still opens, without comparison modes and with
no live product destination; links inside a previous version do nothing.
Unsupported dark-comparison modes remain non-link depictions.
Shared-impact/ignored-only and empty Changes keep a Current preview
without comparison modes; factual evidence lives in Details. Their existing
entries and All escape remain available. A future interactive mode needs its
own contract and owning screen first.

The three stylesheet-evidence states keep the same preview and inspector
treatment and are entered through the existing filter controls:

| Control/context                   | Destination                                                               |
| --------------------------------- | ------------------------------------------------------------------------- |
| Shared impact: Changes filter     | Matched stylesheet evidence, `design/changes/impact/styles/matched`       |
| Ignored only: Changes filter      | Unresolved stylesheet evidence, `design/changes/impact/styles/unresolved` |
| Matched evidence: All filter      | Excluded stylesheet evidence, `design/changes/impact/styles/excluded`     |
| Unresolved evidence: All filter   | Canonical All Welcome, `design/browse/views/screen`                       |
| Excluded evidence: Changes filter | Empty Changes, `design/changes/impact/empty`                              |

Matched and unresolved depict Changes holding only the screen their evidence
keeps; excluded depicts All with no Changes. None of them offers comparison
modes or tag transitions.

Tag interactions are restricted to the canonical Welcome states:

| Action                               | Destination                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Open picker with no query            | `design/browse/views/screen/tag-picker`                                                                                                     |
| Open picker with forms selected      | Existing `design/browse/states/tag-filter`                                                                                                  |
| Open picker with onboarding selected | `design/browse/views/screen/tag-onboarding-picker`                                                                                          |
| Close picker                         | Matching closed state: `design/browse/views/screen`, `design/browse/views/screen/tag-forms`, or `design/browse/views/screen/tag-onboarding` |
| Select an inactive forms chip        | `design/browse/views/screen/tag-forms`                                                                                                      |
| Select an inactive onboarding chip   | `design/browse/views/screen/tag-onboarding`                                                                                                 |
| Select the active chip again         | `design/browse/views/screen` with its empty query                                                                                           |

The query, chips, filtered rows, and picker visibility must agree. Selection
closes the picker; opening it must not invent a query. Use the same mapping
for inspector chips in the supported Welcome states. Other subjects, dark
states, and comparison scenarios keep non-link tag depictions until matching
states are designed. Search typing remains a depicted input, not a form that
submits or a link that pretends to implement search.

## Local Runtime Controls

Viewport selection, browser expansion, ID copying, refresh/recompute, resize
grips, and collapse-all are not catalogue destinations in this change. Keep
their existing visual depictions and document their non-interactive status
outside the rendered artboard; do not add fake hrefs, clipboard-success copy,
or scripts. Existing native `details` disclosures may keep working locally.
The Scroll together checkbox toggles in place and opens no destination.
The real outer shell continues to provide its implemented runtime controls.

## Basic Example And Portability

In `entries/catalogue.mockup.tsx`, convert the primary fixture button into
an explicitly named `View details` action using
`<MockLink asChild to="example/screens/details" fragment="details">`. Convert the
secondary button into `Return to welcome` targeting `example/screens/welcome`.
Retain the existing text links and renderer-required `onPress={noop}` props;
navigation comes from the generated anchor. These labels promise navigation,
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
  source/generated/docs changes and push. After the push, use the
  [implementation review prompt](../implementation-review-prompt.md) against
  `origin/main`. Report findings for the user's decision without automatically
  fixing them.
