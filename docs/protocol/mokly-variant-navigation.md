# Variant Navigation And Changes

## Delivery Status

Variant entry navigation, component-shaped icons, sibling comparison
continuity, removed-variant Dark availability, fallback breadcrumbs, the Specs
section, entry rows for a folder's own screen or component, and the Changes
activation of a container row whose changed rows are only folder members
(`design/browse/index-entries/**`), and the `Moved` label are implemented with
path-keyed rows and the `variants:<path>` disclosure key.

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
  instead of `variants`. Toggling never navigates.
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
visible while one of its variants or listed folder members matches. If a constraint retains only a
variant, its list opens. Hiding a parent hides its complete leaf container and
disclosure button. Tag terms, Changes, and free text compose as for every other
entry.

The component page's variant bar navigates to sibling variant entries. There is
no variant query parameter. If a comparison mode is selected, navigation to a
sibling retains that mode and applies it to the sibling's eligible views. The
workspace reads this single comparison-mode state: Props stay read-only and
highlighting stays unavailable until the mode returns to Current. Late results
from the previous sibling cannot replace the selected entry.

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

A removed variant retains its baseline `variantOf`, parent title, and folder
titles. When that path names a current non-variant parent of the same kind,
directly or as the previous path of a parent the move contract paired, attach
the removed row after current variants; removed siblings retain baseline
authored order, and their public records occupy the parent's ordering position.
The parent's variant bar lists the removed variant in the same place, and the
removed variant's own page opens with that parent's workspace from the first
paint in Serve, export, and the embedded viewer.
A parent with no current variants still discloses the list. Removing both
parent and variant yields one removed entry for each.

If the former parent is absent, has another kind, or is now a variant, keep the
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
