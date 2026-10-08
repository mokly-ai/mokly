# Catalogue Serialization, Identity And Versions

Sort object keys recursively by UTF-16 code units; preserve authored steps and
tags. Entry arrays sort by kind and path in UTF-16 order, yielding `component`,
`document`, `page`, `screen`, `use-case`; a parent's variants instead follow it
in authored order before the next entry. Navigation, the details `Variants`
row, and public-tree entry children use that same sibling order. Build
`removedEntries` from current and baseline entries. A removed parent appears at
its kind/path position, immediately followed by its removed variants in
baseline authored order; variants of a surviving parent occupy that current
parent's position in the same order. Only a variant without an eligible current
or removed parent falls back to kind-then-path order. Instances/slots sort by
key and ranges by DOM start order. Tree siblings follow the
[folder order rule](./mokly-folders.md#order); entry-node variant children
retain authored order. Emit required empties, omit absent optionals, use
two-space indentation and a final LF. Identical inputs produce identical bytes
regardless of enumeration, time or output location.

`snapshotId` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-historical-snapshot-v3", catalogueIdentity, sourceKind,
sourceIdentity, entryKind, entryPath]`. `sourceKind` is `baseline` when
accepted evidence names one unambiguous baseline commit; that commit is the
`sourceIdentity`. Projection requires every available evidence/comparison
baseline commit to agree. This baseline identity takes precedence even after a
live immutable comparison becomes available, so an evidence-only refresh does
not invalidate selection. When no baseline identity exists, an exact 64-hex
generation from `comparisonUrl` may supply `sourceKind: "generation"`. With
neither real source, projection omits the field instead of deriving it from
revisions, `deploymentId`, metadata, time, or randomness.

Readers validate supplied snapshot ids and require uniqueness. They never derive missing ids. A removed record with non-null `comparisonUrl`
must supply `snapshotId`; absence is invalid. Without a comparison URL or
immutable identity, the field can remain absent. Path-only selection of a removed record
normalizes to its safe identity when present. A baseline or generation change
produces different ids, so an unknown, stale, or cross-catalogue selection
fails closed rather than retargeting content.

`deploymentId` is the artifact's 64-hex identity. The
[delivery hashing rule](./mokly-export-browser.md#deployment-identity) additionally
normalizes this owned JSON's top-level `deploymentId` to 64 zeroes before hashing
and stamps it afterward, alongside shell descriptors. Other catalogue bytes
participate unchanged. Export revisions are `{ content: 0, evidence: 0 }`.

Readers require `schemaVersion: 6` and reject older and unknown versions;
writers remain allowlisted. Version 5 keys every record by path, adds
documents, folder titles, `previousPath`, and one tree, and removes `id`,
`navPath`, `useCaseIds`, `screenId`, and the per-section trees. Removed variants
require `parentTitle`. Readers accept only catalogue v6 and
do not translate earlier output. Optional
fields are additive; removals, required additions, changed meaning, new union
discriminants or incompatible paths require a new version. This file and the
inspector asset are additive inventory entries: ownership v3 and upload v2
remain unchanged; the review result and delivery descriptor follow the
[Changes](./mokly-changes.md) and [static delivery](./mokly-export-delivery.md)
contracts.

The [public v6 fixture](./fixtures/catalogue-v6.json) ships in the npm package
and is checked by the reader/projection conformance tests.

The reader requires `tree`; `[]` is valid when the catalogue has no current entries. A nonempty tree must follow the [path contract](./mokly-paths.md):
every entry node names a current entry exactly once, every folder node's
`path` is a proper prefix of each child's path, an `index` names a current
entry that is the folder's first child, no folder node is empty, and no
removed entry occurs. Entry-node `children` hold exactly the variants and
members the [tree rule](./mokly-catalogue-tree.md#shape) allows. Unknown fields follow the existing
reader policy for public JSON.
