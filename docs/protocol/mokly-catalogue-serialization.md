# Catalogue Serialization, Identity And Versions

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Canonical Bytes

The catalogue index, every entry detail, and every detail inside a comparison
generation are canonical JSON. Sort object keys recursively by UTF-16 code
units; preserve authored `steps` and `tags` order. Entry arrays sort by kind
and path in UTF-16 order, which yields `component`, `document`, `page`,
`screen`, `use-case`; a parent's variants instead follow it in authored order
before the next entry. Navigation, the details `Variants` row, and the entry
children of the public tree use that same sibling order.

Build `removedEntries` from the current entries and the entries of the base
commit. A removed parent appears at its kind and path position, immediately
followed by its removed variants in the authored order of the base commit;
removed variants of a surviving parent occupy that current parent's position
in the same order. Only a variant without an eligible current or removed
parent falls back to kind-then-path order. Instances and slots sort by key,
and regions by tree order. Tree siblings follow the
[folder order rule](./mokly-folders.md#order); entry-node variant children
keep authored order. Emit required empties, omit absent optionals, use
two-space indentation and a final LF. Identical inputs produce identical
bytes regardless of enumeration order, time, or output location, so a
detail's bytes change exactly when its content changes.

## Snapshot Identity

`snapshotId` is the lowercase SHA-256 of the UTF-8 JSON, without LF, of
`["mokly-historical-snapshot-v3", catalogueIdentity, sourceKind,
sourceIdentity, entryKind, entryPath]`. `mokly-historical-snapshot-v3` is a
permanent hash namespace, not a format version. `sourceKind` is the literal
`base`; the comparison's base commit is the `sourceIdentity`, and every
comparison input of the state must agree on it. That identity takes
precedence over a generation, so a Changes completion does not invalidate a
selection. Without a base commit the projection omits the field instead of
deriving it from `revision`, `deploymentId`, metadata, time, or randomness.

Readers validate supplied snapshot ids and require uniqueness. They never
derive a missing id. A removed record with a non-null `comparisonUrl` must
supply `snapshotId`; its absence is invalid. Without a comparison URL the
field may be absent. Path-only selection of a removed record normalizes to its
identity when one exists. A different base commit or generation produces
different ids, so an unknown, stale, or cross-catalogue selection fails
closed rather than retargeting content. A removed entry's detail inside a
generation carries the same `snapshotId`, and the shell accepts it only when
it equals the index's record, under the
[shell delivery fences](./mokly-shell-delivery.md#fetch-and-fences).

## Deployment Identity And Revision

`deploymentId` is a 64-hex identity and `revision` one integer. The
[shell delivery contract](./mokly-shell-delivery.md#identity) owns both: how
`build` hashes the output with the id fields zeroed, how Serve chooses one id
for the life of the process, and that a build writes `revision: 0`. Every
other byte of the index and the details participates in the deployment hash
unchanged, under the
[deployment identity algorithm](./mokly-export-browser.md#deployment-identity).

## Versions

The index reader requires `schemaVersion: 7` and the detail reader
`schemaVersion: 1`; each rejects an earlier or unknown number before it reads
any other field, under the
[format inventory](./mokly-format-versions.md#rejection-before-interpretation).
Writers are allowlisted. Optional fields are additive; a removal, a required
addition, a changed meaning, a new union discriminant, or an incompatible
path requires a new number. The index and the detail are additive inventory
entries: ownership v3 and upload v2 are unchanged, and the review result
follows the [comparison contract](./mokly-comparison.md). The generated
TypeScript types of the model crate are the normative shapes, and a reader
validates a document against them before use.

## Tree Validation

The index reader requires `tree`; `[]` is valid when the catalogue has no
current entry. A nonempty tree follows the [path contract](./mokly-paths.md):
every entry node names a current entry exactly once, every folder node's
`path` is a proper prefix of each child's path, an `index` names a current
entry that is the folder's first child, no folder node is empty, and no
removed entry occurs. Entry-node `children` hold exactly the variants and
members the [tree rule](./mokly-catalogue-tree.md#shape) allows.
