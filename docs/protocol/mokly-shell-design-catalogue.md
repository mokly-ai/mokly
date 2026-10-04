# Depicted Design Catalogue

## Delivery Status

Implemented in the path-addressed design catalogue. The outer shell renders the
folder pages, entry rows, path chips, Markdown documents, and the first changed
member that a folder screen's Changes row opens, and `Moved` rows.

This document describes the fixture catalogue that the Browse and Changes
design screens browse, the branches they depict, and their transitions. The
[shell design inventory](./mokly-shell-design-inventory.md) lists the screens;
the [design mockup links contract](./mokly-design-links.md) owns link rules.

## Depicted Catalogue

The artboards browse one fixture catalogue in the path model, so the
navigation, breadcrumbs, path chips, and Details agree across screens:

- Specs lists `Example`, `Account`, and `Design`; the catalogue's order record
  names Example first. Example's README is the folder's own page and its first
  row, `Overview`, above `Screens` (Welcome with its variants, and Details),
  `Example tour`, and the `Getting started` page. `Account` holds
  `Billing & Payments`, titled by its folder record because its slug is
  `billing`, with the Invoice screen, its Overdue variant, and the Payment
  terms document.
- `Account` also holds `Profile`, a screen at `account/profile` that is its
  folder's own page because its module is `account/profile/index.mockup.tsx`.
  Its row follows `Billing & Payments`, because a folder row sorts before an
  entry row, and stands in for the folder: a link beside a disclosure named
  `Show contents of Profile`, whose list holds its `Unverified email` variant
  and then the folder's `Notifications` and `Security` screens. Canonical All
  states keep that list closed.
- Components lists the same `Example` folder above its `Components` library,
  so a folder holding both kinds appears in each section with only that
  section's children.
- Path chips show paths such as `example/screens/welcome`. Component Details
  add the shown entry's path, a document's Details name its Markdown source,
  and a moved entry's Details add a `Moved from` row with its previous path.

## Depicted Branches

- The canonical branch changed Welcome, added Details, moved `billing` under
  `account`, and removed five screens, so Changes counts ten entries. Invoice
  moved with edits; its Overdue variant and Payment terms moved unchanged.
  Each keeps one row labelled `· Moved` at its new place.
- The screen-variant Changes states each depict a branch on which one Welcome
  entry or variant changed or was removed, so their filter counts one entry.
- The `design/browse/index-entries/**` states depict a branch on which only
  Security changed, so their filter counts one entry. In Changes, Profile is
  unmodified and its only changed row is a folder member, so its row stays an
  undotted container above Security's dotted row. Security changed in its
  Light views on both viewports, so it opens on its first changed view,
  Mobile · Light, and its viewport control marks the desktop view that also
  changed.
- `design/browse/appearance/states/light-only-document` depicts a branch that
  removed Payment terms after the catalogue enabled Dark. Its previous version
  has only a light render, and Changes counts one entry,
  `Payment terms · Removed`. Under Dark its pane keeps the Light palette and
  its label reads `Showing previous version — Light only`; its All filter
  opens `design/browse/appearance/overview`.

## Transitions

These transitions follow the [design links contract](./mokly-design-links.md):

- From All, `Overview` and the `Example` crumb open
  `design/browse/views/folder-overview`, `Getting started` opens
  `design/browse/pages/view`, and `Payment terms` opens
  `design/browse/pages/document`.
- The README links Welcome, Details, Example tour, and Getting started to
  `design/browse/views/screen`, `design/browse/views/details-screen`,
  `design/browse/views/use-case`, and `design/browse/pages/view`.
- In Changes, `Invoice · Moved` opens `design/changes/outcomes/moved`, whose
  Related docs row opens `design/browse/pages/document`.

The index entry states form one family:

| Control/context                                 | Destination                                  |
| ----------------------------------------------- | -------------------------------------------- |
| All catalogue: Profile row                      | `design/browse/index-entries/screen`         |
| Folder screen: Security row                     | `design/browse/index-entries/member`         |
| Folder screen: Changes filter                   | `design/browse/index-entries/screen-changes` |
| Folder member: Profile crumb and Profile row    | `design/browse/index-entries/screen`         |
| Folder member: Changes filter                   | `design/browse/index-entries/member-changes` |
| Folder screen in Changes: All filter            | `design/browse/index-entries/screen`         |
| Folder screen in Changes: Profile, Security row | `design/browse/index-entries/member-changes` |
| First changed member: All filter                | `design/browse/index-entries/member`         |
| First changed member: Profile, Security row     | `design/browse/index-entries/member-changes` |

Switching the filter keeps the selection, so the folder screen stays selected in
Changes as an unmodified container. Activating its row opens its first changed
member on that member's first changed view, which is why both Changes rows lead
to the same state. The Profile row
of the first changed member opens that same state again, as an unmodified
variant parent's row does in `design/browse/variants/variant-changes`.

Invoice in All, `Overdue · Moved`, `Payment terms · Moved`, the moved screen's
All filter and comparison modes, the document's overdue-invoice link, the
`Unverified email` and `Notifications` rows, and the first changed member's
comparison modes have no depicted state, so they stay non-links. Folder crumbs
and a parent entry's crumb stay text in Changes states and on removed entries.

## Related Docs

- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Design mockup links](./mokly-design-links.md)
- [Folders](./mokly-folders.md)
- [Variant navigation and Changes](./mokly-variant-navigation.md)
- [Markdown documents](./mokly-documents.md)
- [Moves](./mokly-moves.md)
