# Variant Navigation And Changes

## Delivery Status

Variant entry navigation, component-shaped icons, sibling comparison
continuity, removed-variant Dark availability, and fallback breadcrumbs are
implemented.

This contract owns the shell presentation of screen and component variants.
Variant authoring, inheritance, manifest relationships, and generated views are
defined by [Variants](./mokly-variants.md).

## Navigation Rows

The catalogue groups variants under their parent's row in Pages or Components,
including the responsive drawer:

- A parent without variants renders as an ordinary entry.
- A parent with variants renders its ordinary link beside a separate disclosure
  button with `aria-expanded`, `aria-controls`, and an accessible name derived
  from the parent title. Toggling never navigates.
- The disclosed list contains one leaf per variant in authored order, one indent
  deeper. Screen variants use the overlapping-screen outline; component
  variants use the equivalent overlapping-component outline. Both remain muted,
  and neither relies on indent alone to communicate the relationship.
- The disclosure key is `variants:<section>:<parent id>`, where section is
  `pages` or `components`. It participates in saved disclosure state,
  `Collapse all`, and watched-reload restoration.
- Opening a variant marks its row `aria-current="page"` and opens its variant
  list, ancestor folders, and section.

Search matches a variant's id, title, and tags. A parent remains visible while
one of its variants matches. If a constraint retains only a variant, its list
opens. Hiding a parent hides its complete leaf container and disclosure button.
Tag terms, Changes, and free text compose as for every other entry.

The component page's variant bar navigates to sibling variant entries. There is
no variant query parameter. If a comparison mode is selected, navigation to a
sibling retains that mode and applies it to the sibling's eligible views. The
workspace reads this single comparison-mode state: Props stay read-only and
highlighting stays unavailable until the mode returns to Current. Late results
from the previous sibling cannot replace the selected entry.

## Changes Rows

A variant is independently added, changed, unmodified, or removed. Material,
resource, metadata, ancestry, and `variantOf` changes mark the variant rather
than its parent. A flow propagates only from the exact changed screen id.

Changes shows a changed variant inside its expanded parent group. If the parent
is not itself changed, its row remains as an aggregate container with the shared
trailing change dot; it does not add a Changes row or count. Activating that
aggregate row opens its first visible changed variant. If the parent itself is
changed, activation keeps the parent as the destination. Hidden variants are
never chosen.

A removed variant retains its baseline `variantOf`, parent title, and `navPath`.
When that id names a current non-variant parent of the same kind, attach the
removed row after current variants; removed siblings retain baseline authored
order, and their public records occupy the parent's ordering position. A parent
with no current variants still discloses the list. Removing both parent and
variant yields one removed entry for each.

If the former parent is absent, has another kind, or is now a variant, keep the
removed variant as one flat fallback row. Its breadcrumbs still show baseline
folder labels and the former parent's title; the former-parent crumb is plain
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
commits it; variant navigation proposes the variant's ordinary entry id.

## Verification

Unit and browser coverage must compare runtime rows with the owning mobile and
desktop mockups. Cover both parent kinds, authored order, disclosure persistence,
search and tags, active rows, aggregate navigation, sibling comparison-mode
retention, removed attachment and fallback, plain former-parent breadcrumbs,
dark availability, Back/Forward, and controlled selection.
