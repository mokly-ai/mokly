# Design Link States

Continuation of [mokly-design-links](./mokly-design-links.md).

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

Five style-evidence states share previews, inspectors and filter controls:

| Control/context                        | Destination                                                               |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Shared impact: Changes filter          | Matched stylesheet evidence, `design/changes/impact/styles/matched`       |
| Ignored only: Changes filter           | Unresolved stylesheet evidence, `design/changes/impact/styles/unresolved` |
| Matched evidence: All filter           | Excluded stylesheet evidence, `design/changes/impact/styles/excluded`     |
| Unresolved evidence: All filter        | Canonical All Welcome, `design/browse/views/screen`                       |
| Excluded evidence: Changes filter      | Empty Changes, `design/changes/impact/empty`                              |
| Unnamed evidence: All filter           | Canonical All Welcome, `design/browse/views/screen`                       |
| Page-excluded evidence: Changes filter | Empty Changes, `design/changes/impact/empty`                              |

Matched, unresolved and unnamed show only their retained screen in Changes,
with Side by side selected and non-link comparison controls. Both excluded
states show All with no Changes or comparison modes. None has tag transitions.

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
