# Mokly Design Mockup Links

## Delivery Status

Implemented in the 59 Browse/Changes design screens and two real example
screens using `MockLink` and `MockLink asChild`. Verification and delivery are tracked by the
[implementation plan](../../plans/mokabook-design-mocklinks.md).

The [component design inventory](./mokly-component-design.md) extend the
catalogue with their own state contract and native component/control depictions.
Those 59 Browse/Changes designs retain the canonical links below, including the
removed previous-version family added by
[removed previews](./mokly-removed-previews.md).
They now share native icon inspector tabs and working viewport dropdowns with
the component designs; the legacy disclosure links and segmented view controls
are removed. Catalogue-wide link and inventory checks cover
both families; component keyboard-control checks live in the component suites.

The Shared impact state and its links were removed by Milestone 2 of
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md);
Milestone 5 removed legacy runtime comparison details. The links below match the
current example pages and inspector.

## Scope And Ownership

Make the catalogue under `examples/basic/entries/design/` a navigable prototype
using the existing [catalogue navigation](./mokly-navigation.md) and
[styled control](./mokly-link-controls.md) contracts. Include the basic
example's two prominent buttons as clear navigation examples. The package API,
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

Every design screen has mobile and desktop variants. They are light-only
generated documents, including artboards depicting a dark product screen, except
the appearance screens under `design/browse/appearance/`, the canonical
`design-browse-screen` and `design-browse-details-screen`, their two retained
Welcome appearance variants, and the Welcome comparison family. These render
in both schemes so the outer Appearance control switches the depicted
catalogue. Link targets use design entry ids independently of the example ids printed in the
depicted shell's metadata. Existing ids, routes, screens, and text links remain
available. `example-farewell` remains an intentionally absent product entry.
This depicted dark set is representative; the runtime's single Appearance
preference, rather than per-screen dark renders, keeps a whole session dark.

## Authoring And Shared Components

- Define typed destination constants and control mappings near the design
  components. Separate catalogue destination ids from labels, depicted product
  ids, and CSS classes; never derive destinations by matching visible text.
- Use ordinary `MockLink` for text links and `MockLink asChild` for styled
  buttons, chips, and rows. Provide one eligible root with no interactive
  descendants. Whole rows must not wrap disclosure buttons or child rows.
- Put styles, labels, ids, and accessibility attributes on an adapted child.
  Active navigation is a native anchor with normal Tab/Enter behavior and a
  visible focus outline. Do not carry button-only ARIA semantics onto links.
- Apply the existing marker/portable-link pipeline. Do not author `/view/`,
  `/id/`, raw generated-file destinations, reserved metadata, event-driven
  routing, or consumer scripts as substitutes for `MockLink`.
- A control without a destination has no `href`, no mock-link marker, and no
  misleading keyboard stop. Keep the selected state visibly identified.
  Inactive controls must remain non-interactive after static generation. Native
  inspector tabs and viewport selections operate in place without navigation.
  Links inside inspector bodies use ordinary `MockLink` anchors; `asChild`
  deliberately rejects interactive ancestors including `details`.
- Keep reusable mockup controls in `entries/design/parts/`. Share the existing
  miniature screens between their owning standalone design screens and the
  depicted use case. Keep new files near 200 lines and below 300 lines.
- Retain the approved geometry, typography, and light/dark colors. Review
  element-dependent selectors when a `span`, `div`, or button becomes an
  anchor, including full-row hit areas, inherited color, and focus visibility.

## Canonical Destination Inventory

Existing destinations and their stable id/route mappings are listed in the
[canonical design inventory](./mokly-shell-design.md#design-mockups),
including the Current and Overlay screens. They retain those ids and routes.

The five additions below now render independently in both viewport variants
and are included in the canonical inventory. Their owning components were
completed before link adoption.

| Added entry id                        | Route                                                        | Depicted state                                                    |
| ------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `design-browse-details-screen`        | `design/browse/views/details-screen.html`                    | Normal Details screen, light selected, inspector closed           |
| `design-browse-tag-picker`            | `design/browse/views/screen.variants/picker.html`            | Welcome, empty query, unfiltered catalogue, picker open           |
| `design-browse-tag-forms`             | `design/browse/views/screen.variants/forms.html`             | Welcome, `tag:forms`, Welcome and Details retained, picker closed |
| `design-browse-tag-onboarding`        | `design/browse/views/screen.variants/onboarding.html`        | Welcome, `tag:onboarding`, Welcome retained, picker closed        |
| `design-browse-tag-onboarding-picker` | `design/browse/views/screen.variants/onboarding-picker.html` | The same onboarding filter with the picker open                   |

`design-browse-details` continues to mean Welcome's expanded inspector and remains
reachable from its catalogue entry. Opening/closing the Details icon stays on
the current screen and retains its query. It does not substitute for the
normal Details view.
`design-browse-tag-filter` retains its existing route and depicts the forms
filter with the picker open. The four listed tag states plus
`design-browse-dark-scheme` and `design-browse-light-only` retain their ids but
move beneath `design-browse-screen` as variants, at
`design/browse/views/screen.variants/<slug>.html`. Those six entries leave all
collection `childIds`. The now-empty `design-browse-tags` collection retains its
stable id and points readers to Welcome; no unrelated route or membership moves.

## Navigation Controls

| Control/context                                 | Destination or behavior                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Brand, home breadcrumb, missing-route recovery  | `design-browse-home`                                                                                           |
| Home: Open the first screen                     | `design-browse-screen`                                                                                         |
| All catalogue: Welcome / Details / Example tour | `design-browse-screen` / `design-browse-details-screen` / `design-browse-use-case`                             |
| Changed catalogue: Welcome / Details / Farewell | `design-changes-current` / `design-review-added` / `design-review-removed`                                     |
| Changed catalogue: Survey / Invite / Archive    | `design-review-removed-long` / `design-review-removed-loading` / `design-review-removed-unavailable`           |
| Changed catalogue: Timeline                     | `design-review-removed-no-view`                                                                                |
| Removed documents: four Changes rows            | `design-page-removed` / `-long` / `-loading` / `-unavailable`, each returning to `design-browse-home` from All |
| MiniWelcome: Open the details screen            | `design-browse-details-screen`                                                                                 |
| MiniDetails: Return to welcome                  | `design-browse-screen`                                                                                         |
| Depicted use-case step reference                | Welcome: `design-browse-screen`; Details: `design-browse-details-screen`                                       |
| Welcome/Details inspector: Example tour         | `design-browse-use-case`                                                                                       |
| Home menu open / drawer close                   | `design-browse-navigation` / `design-browse-home`                                                              |
| Menu from another narrow design                 | Canonical `design-browse-navigation`; selecting a leaf opens that leaf's canonical destination                 |
| Welcome All / Changes filter                    | `design-browse-screen` / `design-changes-current`                                                              |
| Details All / Changes filter                    | `design-browse-details-screen` / `design-review-added`                                                         |
| Removed screen All filter                       | `design-browse-home`, because the depicted product screen has no current entry                                 |
| Empty Changes All filter                        | `design-browse-screen`                                                                                         |
| Removed consumer return, component explorer     | `design-component-removed`, from the desktop Action row and the narrow Changes shortcut, never from the stage  |

Collection headings and collection-only breadcrumbs are not catalogue-link
targets: the public API rejects collection ids. Leave grouping labels as text,
or use native disclosure markup for a group that actually contains children.
Any added home crumb has a distinct label and the home destination above.
Keep the design tree's existing groups and make screen leaves use explicit ids.

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
`design-page-view` and `design-page-details` pair the closed/open inspector;
`design-page-navigation` opens the document's drawer and closes back to its view.
Its page row targets `design-page-view`; Welcome and Example tour retain their
existing design destinations. The shared synthetic document takes an explicit
Welcome destination so its design variant stays inside the design catalogue,
while the real document continues to link to `example-welcome`. The removed-page
state keeps a flat row and returns to catalogue home without inventing parents.

`design-publication-catalogue` omits filter and comparison controls.
`design-publication-changes` offers the existing Welcome comparison destinations;
its Changes action opens `design-changes-current`. Unsupported combinations
remain depictions. These six states retain their own typed navigation records;
none borrows another subject's inspector or drawer identity.

## Screen Variants

The five variant states under `design/browse/variants/` depict a screen's
variants as ordinary catalogue entries grouped under their parent. The
disclosure beside a parent row is a depiction with no destination, because the
served shell toggles the list in place; the parent row itself keeps its own
destination. A variant row without an authored destination stays a depiction.

| Control/context                              | Destination                                                         |
| -------------------------------------------- | ------------------------------------------------------------------- |
| All catalogue: Welcome parent row            | `design-browse-screen`, the parent's own screen                     |
| All catalogue: `Empty workspace` variant row | `design-browse-variant-selected`                                    |
| Selected variant: Welcome breadcrumb         | `design-browse-screen`, because a variant keeps its parent's crumbs |
| Selected variant: Changes filter             | `design-browse-variant-changes`                                     |
| Changed variant: All filter                  | `design-browse-variant-selected`                                    |
| Changed variant: Welcome parent row          | `design-browse-variant-changes`, the parent's first changed variant |
| Removed variant: All filter                  | `design-browse-screen`, because the parent screen still exists      |
| Reparented removed variant: All filter       | `design-browse-home`, because its former parent is now a variant    |
| Changed views: All filter                    | `design-browse-screen`                                              |
| Changed views: Details view list             | `design-review-changed`, the canonical comparison with both schemes |

The changed-variant and removed-variant states keep their Welcome breadcrumb as
text, because no artboard depicts an unmodified parent inside Changes. On the
removed state the parent row is a depiction too: the deletion is a later state
of the same group, so it must not open the earlier changed-variant scenario.
The removed variant has no live product destination and no comparison modes;
its stage shows the variant's inert previous version.
In the reparented state, only the removed child's route is changed. The Changes
filter therefore hides the unmodified current parent and its variant (the
former parent), and shows the removed child as one flat screen row outside
their collection hierarchy. The historical breadcrumb remains visible on the
screen itself, but the Changes rail contains no parent or nested variant list.
The depicted All control links to the canonical catalogue home artboard; the
reparented hierarchy is the context for this Changes-state example.
The changed-views state shows no comparison band. Its marks on Appearance
and the viewport dropdown identify evidence about other views. The Details
view list opens the canonical comparison; the outer Appearance control chooses
its generated scheme. The depicted Appearance selector has no authored transition.

## Scheme, Comparison, And Tag States

The catalogue authors no scheme pairs and no artboard depicts a scheme control
in its screen header, which carries the viewport control alone. Standalone
Browse holds one Appearance setting, so every artboard that draws a top bar
draws the depicted Appearance selector in it, which has no authored
transitions. `design-browse-screen`, `design-browse-details-screen`, the Welcome comparison
family (`design-changes-current`, `design-changes-overlay`,
`design-review-changed`, `design-review-difference`) and the appearance entries
render in Light and in Dark instead, and the outer Appearance control moves
between those two generated files at the same route. A link out of a dark
fragment resolves to the target's dark fragment wherever one exists, and every
member of a comparison family publishes the same schemes, so no comparison
control strands a reader in a light document. The existing
`design-browse-dark-scheme` and `design-browse-light-only` ids remain Welcome
variants for stable catalogue links. Their artboards now render in both schemes
and follow the single Appearance selector in the top bar; they have no scheme
control in the header. The old `design-review-dark-scheme` depiction is removed
in favor of the dual-scheme `design-review-changed` entry. Appearance comparison controls map Side by side
to `design-appearance-side-by-side` and Difference to
`design-appearance-difference`, with Current returning to
`design-appearance-overview`; Overlay stays a depiction. Their All filter opens
`design-appearance-overview` and Changes opens
`design-appearance-side-by-side`.

The Welcome light comparison controls map Side by side to
`design-review-changed`, Overlay to `design-changes-overlay`, and Difference
to `design-review-difference`. These controls appear in the explicit changed
Welcome states; Browse and tag-picker states omit them. Each comparison destination depicts Changes selected;
its Current action returns to `design-changes-current`. Current is already
selected in `design-changes-current`, so it has no
transition there. Returning to All uses the navigation table above.

Added Details shows its Current preview without comparison modes. Removed
Farewell, Survey, Invite, Archive, and Timeline show their previous version,
its loading wait, its unavailable state with Retry, or the note naming the
viewport that still opens, without comparison modes and with
no live product destination; links inside a previous version do nothing.
Unsupported dark-comparison modes remain non-link depictions.
Ignored-only and empty Changes keep a Current preview without comparison
modes; factual evidence lives in Details. Their existing routes and All escape
remain available. A future interactive mode needs its own contract and owning
screen first.

The three stylesheet-evidence states keep the same preview and inspector
treatment and are entered through the existing filter controls:

| Control/context                   | Destination                                                      |
| --------------------------------- | ---------------------------------------------------------------- |
| Changed styles: Changes filter    | Matched stylesheet evidence, `design-review-style-matched`       |
| Ignored only: Changes filter      | Unresolved stylesheet evidence, `design-review-style-unresolved` |
| Matched evidence: All filter      | Excluded stylesheet evidence, `design-review-style-excluded`     |
| Unresolved evidence: All filter   | Canonical All Welcome, `design-browse-screen`                    |
| Excluded evidence: Changes filter | Empty Changes, `design-review-empty`                             |

Matched and unresolved depict Changes holding only the screen their evidence
keeps; excluded depicts All with no Changes. None of them offers comparison
modes or tag transitions.

Tag interactions are restricted to the canonical Welcome states:

| Action                               | Destination                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Open picker with no query            | `design-browse-tag-picker`                                                                                  |
| Open picker with forms selected      | Existing `design-browse-tag-filter`                                                                         |
| Open picker with onboarding selected | `design-browse-tag-onboarding-picker`                                                                       |
| Close picker                         | Matching closed state: `design-browse-screen`, `design-browse-tag-forms`, or `design-browse-tag-onboarding` |
| Select an inactive forms chip        | `design-browse-tag-forms`                                                                                   |
| Select an inactive onboarding chip   | `design-browse-tag-onboarding`                                                                              |
| Select the active chip again         | `design-browse-screen` with its empty query                                                                 |

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
The real outer shell continues to provide its implemented runtime controls.

## Basic Example And Portability

In `entries/catalogue.mockup.tsx`, convert the primary fixture button into
an explicitly named `View details` action using
`<MockLink asChild to="example-details" fragment="details">`. Convert the
secondary button into `Return to welcome` targeting `example-welcome`.
Retain the existing text links and renderer-required `onPress={noop}` props;
navigation comes from the generated anchor. These labels promise navigation,
not workspace creation or a synthetic business operation. Exercise both
viewports and light/dark generation without changing fixture ids or routes.

All design and example links must retain portable relative hrefs on disk and
authenticated markers in served/deployed Browse. Standalone activation opens
the matching generated viewport with the existing scheme fallback. Real
comparison snapshots retain their existing portable, frame-owned link behavior;
design artboards depicting comparisons are ordinary Browse screens and use
normal enhanced navigation. Do not equate these two contexts.

## Verification Contract

- Before wiring controls, record failing semantic assertions for missing home,
  navigation, miniature-screen, flow-reference, and example-button links.
- Verify expected control destinations against the built real example manifest
  in both viewports, plus every light/dark example-button output. Detect wrong
  subjects, self-links masquerading as transitions, collection/absent ids,
  duplicate/nested focus targets, and inactive controls becoming links.
- Check the canonical existing-design inventory against the complete manifest
  design-screen set, including exact id/route pairs. Keep unimplemented planned
  destinations separate from that inventory so omissions and drift are visible.
- Prove each new state is reachable from its owning screen/flow and has the
  specified return route. Test tag query/picker agreement and both-scheme
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
