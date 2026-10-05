# Variant Navigation And Changes

## Delivery Status

Variant entry navigation, component-shaped icons, sibling comparison
continuity, removed-variant Dark availability, fallback breadcrumbs, the Specs
section, entry rows for a folder's own screen or component, and the Changes
activation of a container row whose changed rows are only folder members
(`design/browse/index-entries/**`), and the `Moved` label are implemented with
path-keyed rows and the `variants:<path>` disclosure key. The
[list state](#list-state) and [comparison mode lifetime](#comparison-mode-lifetime)
rules are the approved contract that the
[path identity follow-up plan](../../plans/path-identity-follow-up.md) delivers.

This contract owns the shell presentation of screen and component variants.
Variant authoring, inheritance, manifest relationships, and generated views are
defined by [Variants](./mokly-variants.md).

## Navigation Rows

The catalogue groups variants under their parent's row in Specs or Components,
including the responsive drawer:

- A parent without variants renders as an ordinary entry.
- A parent with variants renders its ordinary link beside a separate disclosure
  button with `aria-expanded`, `aria-controls`, and the accessible name
  `Show variants of <title>` or `Hide variants of <title>`, using the parent's
  own title; when the list also holds folder members it names `contents`
  instead of `variants`. Toggling never navigates. The
  [list state](#list-state) decides whether the button exists and is expanded.
- The disclosed list contains one leaf per variant in authored order, one indent
  deeper. Screen variants use the overlapping-screen outline; component
  variants use the equivalent overlapping-component outline. Both remain muted,
  and neither relies on indent alone to communicate the relationship.
- The disclosure key is `variants:<path>`, the parent's path; an entry belongs
  to one section, so the key names none. It participates in saved disclosure
  state, `Collapse all`, and watched-reload restoration under the
  [disclosure persistence contract](./mokly-disclosure-persistence.md#keys).
- A folder whose own page is a screen or component renders as that entry's
  row: the same link and disclosure button, whose list holds the variants in
  authored order and then the folder's other members, under the
  [folder row rules](./mokly-folders.md#rows-and-clicks).
- Opening a variant marks its row `aria-current="page"` and opens its variant
  list, ancestor folders, and section.

Variants follow the shared [search rule](./mokly-folders.md#titles). A parent remains
visible while one of its variants or listed folder members matches. If a filter
edit retains only a variant, its list opens. Hiding a parent hides its complete
leaf container and disclosure button. Tag terms, Changes, and free text compose
as for every other entry.

The component page's variant bar navigates to sibling variant entries. There is
no variant query parameter. The selected comparison mode carries across
siblings under the [comparison mode lifetime](#comparison-mode-lifetime).

## List State

A list is what a parent row discloses: its variants and, for a folder's own
screen or component, the folder's other members. In every filter state a list
follows the same rule as a folder row. It shows its value in the current
disclosure map, and a toggle or `Collapse all` changes that value, with or
without search or Changes. A list is open only when that value is open and the
list holds a row that the active All/Changes filter, search, and tag terms
show, by the visibility rule of every row. A list that holds no such row has
no disclosure button, in All as under a filter; its parent row then shows only
when the parent itself matches. Each filter edit sets every list's value to
open, so every list that holds a visible row opens. A list the user then closes
stays closed while the same constraints apply, except on a navigated
destination's path, under
[active catalogue visibility](./mokly-navigation.md#active-catalogue-visibility).
The [persistence contract](./mokly-disclosure-persistence.md) owns the stored
values, defaults, and fallbacks.

## Comparison Mode Lifetime

Each screen or component workspace keeps one selected comparison mode for its
mode owner. A component page and every variant entry whose parent the
[branch-point lookup](./mokly-branch-point-lookup.md#variant-parents) resolves
to that component share the component as their owner. Every other entry owns
its own mode, including each screen variant and a component variant without an
eligible parent. Only these events set the selected mode:

1. A fresh document load selects the initial mode.
2. Navigation to an entry with another mode owner selects the destination's
   initial mode.
3. The user selects a mode.
4. Adopting a newer update version without a page reload selects Current.
   Serve advances the update version for each watched update; an update that
   reloads the page is a fresh document load.

The initial mode is Current. The Serve and export shell instead selects Side
by side when its URL carries `comparison=side` and the destination confirms
that the shown view is eligible, under the
[deep-link rule](./mokly-changes.md#screen-controls). An application-owned
viewer reads no such query, so it starts in Current, also after it replaces its
source.

No other event changes the selected mode. Adopting a newer evidence revision,
including the one that Serve raises when it first renders a view, keeps the
mode and renews only the loaded comparison under the
[renewal rule](./mokly-selected-comparisons.md#requests-and-evidence); renewal
never changes the mode. Navigation between entries that share the owner,
through the variant bar or Back and Forward, keeps it too. The selected mode
applies only while the shown view is eligible for comparison. A sibling without
changes, or a viewport or scheme without changes, shows Current and keeps the
selected mode; the next eligible view applies it again. The workspace reads
this effective mode: Props stay read-only and highlighting stays unavailable
while it is not Current. Late results from a previous sibling cannot replace
the selected entry.

## Changes Rows

A variant is independently added, changed, unmodified, or removed. Material,
resource, metadata, ancestry, and `variantOf` changes mark the variant rather
than its parent. A flow propagates only from the exact changed screen path.

Changes shows a changed variant inside its expanded parent group. If the parent
is not itself changed, its row remains as an aggregate container with the shared
trailing change dot; it does not add a Changes row or count. Activating that
aggregate row opens its first visible changed variant. If the parent itself is
changed, activation keeps the parent as the destination. Hidden variants are
never chosen.

A folder's own screen or component lists the folder's members after its
variants. A changed member is not a variant, so it never marks that row, just
as it never marks a folder row. An unmodified row whose only changed rows are
members therefore stays visible as a container with no change dot and adds no
Changes row or count. Activating any unmodified container row opens the first
visible changed entry its list holds, in list order: its variants, then its
members, descending into member folders and member lists. Only a nav-row
activation redirects; a breadcrumb or the filter switch keeps its ordinary
destination, so the unmodified row may stay selected after switching to
Changes.

A variant the [move contract](./mokly-moves.md) pairs with a baseline variant,
directly or through its moved parent, is labelled `Moved` in its Changes row
and shows its previous path in details, like every paired entry; a pure move
keeps the row even though the variant is unmodified. Under All, a paired row
of any kind carries the changed mark, and counts toward its parent's aggregate
mark, only when its entry changed beyond the move, so a pure move shows no
mark. The variant bar reads the same decision: a paired variant whose only
edit is its metadata reads Changed, and a pure move reads Unmodified.

A removed variant retains its baseline `variantOf`, `parentTitle`, and folder
titles. Resolve its parent with the
[branch-point lookup](./mokly-branch-point-lookup.md#variant-parents).
When the result is a current parent, attach
the removed row after current variants; removed siblings retain baseline
authored order, and their public records occupy the parent's ordering position.
The parent's variant bar lists the removed variant in the same place, and the
removed variant's own page opens with that parent's workspace from the first
paint in Serve, export, and the embedded viewer.
A parent with no current variants still discloses the list wherever its
removed variants show, as in Changes. Removing both parent and variant yields
one removed entry for each.

If the lookup has no eligible parent, keep the
removed variant as one flat fallback row. Its breadcrumbs still show baseline
folder titles and the former parent's title; the former-parent crumb is plain
text because it has no eligible destination. Hierarchy construction removes a
row from flat fallback only after successful attachment, so every removed entry
appears exactly once.

Removed screen variants show their read-only previous version without
comparison controls. Removed component variants remain eligible for comparison
with an explicit missing current side.

## View And Scheme Availability

Catalogue-wide Dark availability is true when any current screen or component
variant, removed screen, or removed component variant has a dark view. Component
parents have no views and do not affect this result. A removed variant therefore
keeps Dark available even if no current entry uses it. Per-entry fallback still
uses the selected entry's own effective views.

## Public Viewer

The public tree carries variants as entry-node children in authored order. The
Viewer reconstructs the same grouping, aggregate marks, fallback rows,
breadcrumbs, icon by parent kind, and dark availability from current entries and
`removedEntries`. A controlled selection remains a proposal until the host
commits it; variant navigation proposes the variant's ordinary entry path.

## Verification

Unit and browser coverage must compare runtime rows with the owning mobile and
desktop mockups. Cover both parent kinds, authored order, disclosure persistence,
search and tags, active rows, aggregate navigation, sibling comparison-mode
retention, moved rows, removed attachment and fallback, plain former-parent
breadcrumbs, dark availability, Back/Forward, and controlled selection.

Cover the list state under search and Changes: Hide, Show, `Collapse all`, a
reload that keeps a closed list closed, and no button for a list without a
visible row. Cover every mode lifetime event, and prove that evidence adoption,
a sibling without changes, and renewal keep the selected mode, including Serve
navigation to an entry whose views it has not rendered yet.
