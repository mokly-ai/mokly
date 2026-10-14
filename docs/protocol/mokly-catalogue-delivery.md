# Catalogue Projection And Delivery

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of the [public catalogue contract](./mokly-catalogue.md).

## Projection And Privacy

The catalogue model lives in process memory. Serve and `build` project it
into two public forms through one explicit allowlist: the catalogue index v7
and one entry detail v1 per entry. The
[shell delivery contract](./mokly-shell-delivery.md) owns their fields and
routes, and the [catalogue contract](./mokly-catalogue.md) owns the record
types. The projection reads the validated catalogue model, the validated
folder records, and, when Changes is ready, the review result v8 and the
change snapshot v4 of the [comparison contract](./mokly-comparison.md). It
never spreads a model record, an entry, or an internal evidence object into
public JSON.

The index carries every current entry record, the tree, the removed records,
`changesStatus`, and `comparisonUrl`, and no per-view usage or resource
evidence. The detail carries one entry's per-view `documentKey`, usage,
resource evidence, and workspace lists. Serve projects both from one model
state in one publication, and `build` writes both for every entry.

- Screens and components emit one view per effective viewport and colour
  scheme, sorted mobile/light, mobile/dark, desktop/light, desktop/dark; the
  light-only fallback stays in the viewer. A component parent's views render
  its own props, and a variant's views render the merged props of the
  [entry props contract](./mokly-entry-props.md). Documents copy the
  catalogue's `colorSchemes` and have no views. Pages and use cases have no
  views and no usage; a page's resource evidence is in its detail.
- A current entry's comparison state is never `removed`; that state is valid
  only inside `removedEntries`. A current entry whose aggregate state is
  `removed` because some of its views were removed projects as `changed`; its
  per-view states are unchanged.
- Use cases keep ordered steps by screen path; a reused frame adds no screen
  use and no duplicate instance record.
- Component parents carry `propSchema`, their own `props`, their `controls`,
  and their declared slot names. A component needs no variant. A current
  variant requires a current parent; a removed parent is kept even when every
  variant of it moved, without inventing variants. Variants follow their
  parent in authored order.
- Ready usage copies only the instance, slot, and root regions that the
  composed trees carry, with validated props and supplied slot names, and no
  text offsets. A ready empty list means proven empty usage, never a failed
  or incomplete render; a view whose render is not complete is `pending`.
- Ready `resourceEvidence` on a view or a page copies only public evidence:
  rendered-resource paths, selectors, rule keys, changed component paths, and
  owners. No match node, source path, declaration, or offset enters it. A
  root boundary creates no instance.
- `details` keeps the authored display metadata the inspector shows.
  `sourcePath` and the related-document paths are repository-relative
  metadata and never become source-serving URLs. Matched `relatedDocs` use
  validated `mock:<path>` references to current documents under the
  [document contract](./mokly-documents.md).

Never emit source file lists, declared or owned dependencies, `movedFrom`,
folder `exclude` globs, resolved dependency evidence, changed-path
inventories, source graphs, Git commands, render cache keys or contents,
content digests of source inputs, style offsets, style or resource ownership
tables, absolute filesystem paths, credentials, or render-capability tokens.
No source bytes, HTML, runtime React values, or source maps belong in this
JSON. The rule applies recursively, including removed entries and extension
fields. `snapshotId` is a one-way digest, never a public commit or generation
inventory. Reject private filesystem paths in path fields; display strings
and props are data.

## Changes In The Projection

Per-entry Changes comes from the entry attribution of the comparison
contract, not from a count of visual comparisons. `included` is membership in
Changes: an affected consumer can have eligible comparisons while `included`
is false, and a paired moved entry is included even when it is unmodified.
Folder visibility aggregates descendants without extra counts. The
`preparing`, `pending`, `unavailable`, and `disabled` states never imply
unmodified or a zero count. The
[removal rule](./mokly-catalogue-changes.md#removal-selection-and-precedence)
owns selection and path reuse.

A removed record carries `folderTitles`, the titles its folders had at the
base commit from the top level down, as breadcrumb text, and a `snapshotId`
under the [serialization contract](./mokly-catalogue-serialization.md). A
removed variant carries `variantOf` and requires `parentTitle`, the nonempty
title of its parent at the base commit; readers reject a missing, empty, or
non-string `parentTitle` on a variant and its presence on a non-variant.
Parent resolution follows the
[branch-point lookup](./mokly-branch-point-lookup.md). The optional
`preview` field is the descriptor of
[removed previews](./mokly-removed-previews.md); readers tolerate its
absence. A removed entry's detail is projected into the comparison generation
from the base render; a removed view whose base usage is not available is
`unavailable`, never an empty ready list.

`comparisonUrl` is `null` or
`mokly-viewer/diffs/generations/<generation>/review.json`, pinned to the
generation that produced this state's evidence. Snapshots resolve against
that response URL. `null` forbids a fallback request to
`/mokly-viewer/diffs/review.json`. Comparison files load only on selection.

## Serialization, Identity And Versions

Canonical bytes, snapshot identities, and reader versions follow the
[serialization contract](./mokly-catalogue-serialization.md). `deploymentId`
and `revision` follow the
[shell delivery identity rules](./mokly-shell-delivery.md#identity). Tree
validation follows the [catalogue tree](./mokly-catalogue-tree.md).

## Serve And Fetch Rules

Headers, caching, public paths, and the fetch rules of the shell follow the
[fetch contract](./mokly-catalogue-fetch.md); publication follows the
[shell delivery updates](./mokly-shell-delivery.md#updates-in-serve).
