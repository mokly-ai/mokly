# Manifest Schema

## Delivery Status

Builds emit manifest v9 with paths, folder records, and rendered Markdown
documents. Copied document resources also remain private watched source inputs.

These are the normative interfaces for the generated `mokly-manifest.json`.
`Viewport` retains the [package contract](./mokly-package.md) and the named
[registry interfaces](../../packages/viewer/src/registry/types.ts).
`ColorScheme` is `"light" | "dark"`. Prop and wire types come from the
[prop schema](./mokly-component-props.md); `ComponentControl` comes from the
[controls contract](./mokly-component-controls.md). The optional instance
`source` field is defined by the
[usage-record contract](./mokly-component-usage-records.md).

Version 9 carries paths and authored data only: no entry stores a route, view
path, or other value derivable from its path, kind, and configuration.

The [retired ownership-record rules](./mokly-component-usage-records.md#retired-ownership-records)
own current rejection and historical handling of `styles` and `resources`.

## Entries, Folders, And Variants

```ts
interface ManifestV9 {
  schemaVersion: 9;
  generatedBy: "mokly";
  entries: readonly ManifestEntry[];
  folders: readonly ManifestFolder[];
  sourceFiles: readonly string[];
  assetClosure: readonly string[];
  generatedFiles: readonly { path: string; blobHash: string }[];
  blobHashAlgorithm: "sha1" | "sha256";
}

type ManifestEntry =
  | ManifestUseCase
  | ManifestPage
  | ManifestDocument
  | ManifestScreen
  | ManifestComponent
  | ManifestComponentVariant;

interface ManifestEntryBase {
  path: string;
  kind: "screen" | "page" | "document" | "use-case" | "component";
  title: string;
  description: string;
  rationale?: string;
  movedFrom?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  declaredDependencies: readonly string[];
  tags?: readonly string[];
}

interface ManifestScreen extends ManifestEntryBase {
  kind: "screen";
  address?: string;
  variantOf?: string;
  colorSchemes: readonly ColorScheme[];
  useCasePaths: readonly string[];
  componentViews?: readonly ComponentViewRecord[];
}

interface ManifestUseCase extends ManifestEntryBase {
  kind: "use-case";
  steps: readonly {
    screenPath: string;
    title?: string;
    description?: string;
  }[];
}

interface ManifestPage extends ManifestEntryBase {
  kind: "page";
}

interface ManifestDocument extends ManifestEntryBase {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
  resources: readonly string[];
}

interface ManifestComponent extends ManifestEntryBase {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  ownedDependencies: readonly string[];
}

interface ManifestComponentVariant extends ManifestEntryBase {
  kind: "component";
  variantOf: string;
  colorSchemes: readonly ColorScheme[];
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  componentViews: readonly ComponentViewRecord[];
}

interface ManifestFolder {
  path: string;
  title?: string;
  order?: readonly string[];
  hidden?: boolean;
  exclude?: readonly string[];
  sourcePath: string;
}
```

`path` is the entry's identity under the [path contract](./mokly-paths.md).
`variantOf` is present exactly on variant entries of either kind and holds the
parent's path; it is derived from the declaration under the
[variant contract](./mokly-variants.md), and a variant's path is its parent's
path plus its slug. A component parent and a component variant share
`kind: "component"` and are distinguished by that field. `movedFrom` is the
authored previous path under the [move contract](./mokly-moves.md). A reader
derives every file name from the [artifact path contract](./mokly-artifact-paths.md).

`folders` holds every [folder record](./mokly-folders.md), from either
carrier, with its validated fields and the repository-relative source of the
record: the `_folder.json` file or the entry module that exported
`defineFolder`. A `_folder.json` at the top level of an unprefixed root is
recorded with `path: ""`. Resolved titles are not stored; readers apply the
title rule. The sorted `sourceFiles` inventory includes every folder record's
`sourcePath`. Directory-only fields are rejected for code carriers, identified
by a source path whose final segment is not `_folder.json`.

Every entry requires `declaredDependencies`, the sorted unique paths
explicitly authored in its definition; a document's list is empty and its
`resources` holds the repository-relative files it references. The entry's
complete dependency set is the union of `sourcePath`, `declaredDependencies`,
and `resources`; readers derive it, and the manifest does not store it.
`ownedDependencies` is a subset of the declared list. `colorSchemes` is the
effective, sorted, light-first set: a component variant inherits its parent's
set, a document uses the catalogue set, and a screen variant may replace its
parent's set under the variant contract. Variant props contain only validated
data; supplied slot names reference declared slots and contain no React
values. Every component parent has at least one variant entry following it in
authored order. The first is the default; a parent has no views of its own.

When components are registered, every screen's and component variant's
`componentViews` contains exactly one record for each light and optional dark
view, ordered mobile/light, mobile/dark, desktop/light, desktop/dark. It is
required even for a view with no component instances. Missing metadata is never
normalized to an empty record. The root component of its own variant is the
entry owner and is not listed as its own used instance.

## Usage And Rendered Ranges

The [component usage-record contract](./mokly-component-usage-records.md) owns
the complete types, key preimages, ownership graphs, ordering, range placement,
retired `styles`/`resources` handling, and validation. The
[instance identity contract](./mokly-instances.md) owns reference scope,
stability, source capture, and rendered sentinels.

## Validation And Serialization

Use one schema implementation for Build output, Browse, baseline parsing, and
publishing. Reject unknown fields, incorrect types, invalid paths, keys, or
hashes, inconsistent props and schema, duplicate records, unsafe repository
paths, and broken cross-references. The hash must match decoded and validated
props. A current reader rejects any stored `id`, `navPath`, `route`,
`fragments`, `darkFragments`, `viewports`, `dependencies`, `useCaseIds`,
`screenId`, or component `variants` field as an unknown field.

Paths follow the [segment grammar](./mokly-paths.md#segment-grammar) and are
unique case-insensitively across all entries. A `variantOf` names a current
entry of the same kind without `variantOf`, and the variant's path is that
parent's path plus exactly one segment, with no override.
The manifest stores no override flag, so readers validate the parent relationship
and path uniqueness without reconstructing derivation. `useCasePaths` and
`screenPath` reciprocate.
A `folders[].path` is below at least one entry path or is the top level, and
folder paths are unique. Dependency roots, source paths, tags, resource
confinement, and global output collisions retain their existing rules.

Entries sort by kind name in UTF-16 order (`component`, `document`, `page`,
`screen`, `use-case`) and then by path in UTF-16 code units; lexical manifest
ordering never uses a locale-sensitive collator. The variants of one parent are
the exception: emit them in authored order directly after their parent and
before the next entry. That sibling order is the order the navigation list,
the details `Variants` row, and the public tree's entry-node `children`
present. During pre-validation ordering, a variant without one uniquely valid
parent stays in ordinary kind-then-path position so relationship validation
can reject it deterministically; invalid entries are never emitted. Folders
sort by path. Use-case steps and tags retain authored order. Dependency,
resource, owned-path, supplied-slot, and declared-slot arrays sort uniquely.
JSON object keys sort lexically; arrays follow their stated order. Omit absent
optional fields; emit required empty arrays and objects. Serialize with
two-space indentation and a final LF.

Emit v9 for every catalogue, including one without components or documents.
Its sorted private `sourceFiles` inventory, explicit page and document
entries, folder records, component records, and usage proof are required.
Current and baseline readers accept only v9; the
[baseline compatibility contract](./mokly-baseline-compatibility.md) owns the
clean unavailable outcome for earlier output. Contract fixtures, schema round
trips, deterministic output, and ownership and path regressions cover these
rules.
