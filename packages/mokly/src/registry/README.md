# Path registry

The registry turns collected definitions into one validated catalogue. Entries
have globally unique paths; folder records supply presentation without changing
identity. This module has no Markdown renderer or move-pairing engine.

`export_collection.ts` records module/export locations. `resolve_definitions.ts`
derives identity from the exporting module and retains the defining module as
`sourcePath`. `path_derivation.ts` and `path_collisions.ts` are pure: prefixes,
transparent directories, leaves, index collapse, declared paths, grammar and
case-folded collisions need no filesystem access. The first segment
`mokly-generated` is reserved case-insensitively for generated styles and assets;
entry diagnostics retain the exporting source location.

`folder_records.ts` validates both folder carriers. `folder_validation.ts` checks
record uniqueness, use and child order. The viewer-owned hierarchy builds one
path tree, applies titles/order/hidden state (symbol-only slugs retain their
original spelling as the default title), and derives the two kind-filtered
sections. Variants retain authored order and their derived parent relationship.

`prepare.ts` validates metadata and reciprocal flow references before rendering.
Component parents validate before their children's data; invalid parents do not
produce misleading child relationship errors. `move_hints.ts` checks current
`movedFrom` authoring facts only; baseline validation and pairing remain separate.

`changed_paths.ts` consumes accepted review pairs for metadata membership.
It compares flow, variant-parent and discovered-document references through
the same identities. `changes.ts` suppresses paired removals in every producer.
It captures each removed variant's baseline `parentTitle` before path reuse
can discard the former parent. Non-variants carry no parent title.

`manifest.ts` emits schema v8 with paths, authored move hints, folder records and
source inventory. `manifest_validation.ts` is the shared strict current/baseline
reader. It validates document resources, derives artifact names, and rejects unknown
fields. An earlier comparison base produces the established unavailable outcome.
The live catalogue index describes available views without claiming rendered usage.

```sh
node --import tsx --test tests/path_*.test.ts tests/entry_exports.test.ts
node --import tsx --test tests/manifest*.test.ts tests/variant_validation.test.ts
```

See [paths](../../../../docs/protocol/mokly-paths.md),
[folders](../../../../docs/protocol/mokly-folders.md),
[variants](../../../../docs/protocol/mokly-variants.md), and
[manifest v8](../../../../docs/protocol/mokly-component-manifest.md).
