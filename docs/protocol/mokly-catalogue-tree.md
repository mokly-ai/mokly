# Catalogue Tree

## Delivery Status

Implemented in read model v6. The viewer derives the Specs and Components
sections from this tree and orders each section by the rows it shows.

## Shape

`tree` is one tree for the whole catalogue. The viewer derives its two sections
from it: Components shows the nodes whose subtree contains an entry of kind
`component`, pruned to those entries; Specs shows the nodes whose subtree
contains an entry of any other kind, pruned likewise. A folder holding both
kinds therefore appears in both sections with different children.

A folder node carries its resolved [title](./mokly-folders.md#titles). Its
`index` is the path of its own page when that page is a document, page, or use
case; that entry is also the folder's first child node, so the viewer renders
it as the `Overview` row under the [row rules](./mokly-folders.md#rows-and-clicks).
A folder whose own page is a screen or component is not emitted as a folder
node: the projection emits that entry's node with `children` holding its
variants in authored order followed by the folder's other members. An entry
node's entry title is also the folder title used by every descendant breadcrumb;
its folder record cannot supply a second title. An entry
node otherwise has `children` exactly when it is a screen or component with
variants, holding those variants in authored order. Hidden folder nodes,
including screen/component index entry nodes, retain `hidden: true` and normal
children. Every current entry appears once in the tree. All/search hides these
subtrees and prunes empty ancestors; Changes retains hidden ancestry and
changed rows. Each non-variant child names its immediate parent folder; deep
root paths are invalid. Removed records cannot carry `previousPath`.

## Order

Children of a folder node follow the [order rule](./mokly-folders.md#order),
with a screen or component that is its folder's own page placed as the entry
row it renders as in its own section. A folder node, and an entry node that is
its folder's own page, carries `order` exactly when the folder record has one;
the read model's `treeOrder` carries the top-level record's `order`.

A screen or component that is its folder's own page renders as an entry row in
its own section and as a folder row in the other, so the two sections can need
different orders for the same children. The viewer therefore orders the
children each section shows again: the children that `order` names come first
in its sequence, with the others, at `...` when present, ordered by the rows
they render as in that section. A folder's own page stays its first child, and
variants keep their authored order. Serve and every reader of the read model
derive the same sections, so server-rendered and hydrated rows agree.

Readers reject an `order` or `treeOrder` that is not an array of nonempty
strings, names one child twice, or holds a path rather than a slug.

## Related Docs

- [Public catalogue read model](./mokly-catalogue.md)
- [Folders](./mokly-folders.md)
- [Catalogue serialization](./mokly-catalogue-serialization.md)
- [Variant navigation and Changes](./mokly-variant-navigation.md)
