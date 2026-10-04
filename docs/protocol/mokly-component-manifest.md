# Component Manifest Schema

## Delivery Status

Removal of baseline compatibility is planned for
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Root output ranges and removal of CSS resource owners are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md). Manifest v8 changes in place.

manifest-v8 generation, validation, Serve, and static export use the public
`defineComponent` API. These are the normative interfaces
for the [component contract](./mokly-components.md). `ManifestEntryBase`,
`ManifestScreen`, `ManifestPage`, `ManifestUseCase`,
and `Viewport` retain the [package contract](./mokly-package.md) and the named
[registry interfaces](../../packages/viewer/src/registry/types.ts).
`ColorScheme` is `"light" | "dark"`. Prop/wire types come from the
[prop schema](./mokly-component-props.md); `ComponentControl` comes from the
[controls contract](./mokly-component-controls.md).

The optional instance `source` field is defined by the
[usage-record contract](./mokly-component-usage-records.md). Readers accept
instances with or without it. The current manifest version is 8, defined by the
[id-derived routes plan](../../plans/id-derived-routes.md). Version 8 carries
identity only: no entry stores a route, view path, or other value derivable
from its kind, id, and configuration.

## Entries And Variants

```ts
interface ManifestV8 {
  schemaVersion: 8;
  generatedBy: "mokly";
  entries: readonly ManifestEntryV7[];
  sourceFiles: readonly string[];
}

type ManifestEntryV7 =
  | ManifestUseCase
  | ManifestPage
  | ManifestScreen
  | ManifestComponent
  | ManifestComponentVariant;

interface ManifestEntryBase {
  id: string;
  kind: "screen" | "page" | "use-case" | "component";
  title: string;
  description: string;
  rationale?: string;
  navPath: readonly string[];
  relatedDocs: readonly string[];
  sourcePath: string;
  tags?: readonly string[];
}

interface ManifestScreen extends ManifestEntryBase {
  kind: "screen";
  address?: string;
  variantOf?: string;
  colorSchemes: readonly ColorScheme[];
  useCaseIds: readonly string[];
  componentViews: readonly ComponentViewRecord[];
}

interface ManifestComponent extends ManifestEntryBase {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
}

interface ManifestComponentVariant extends ManifestEntryBase {
  kind: "component";
  variantOf: string;
  colorSchemes: readonly ColorScheme[];
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  componentViews: readonly ComponentViewRecord[];
}
```

`ManifestPage` adds `kind: "page"`; `ManifestUseCase` adds `kind: "use-case"`
and `steps`. `variantOf` is present exactly on variant entries of either kind
under the [variant contract](./mokly-variants.md); a component parent and a
component variant share `kind: "component"` and are distinguished by that
field. A reader derives every path from the
[artifact path contract](./mokly-artifact-paths.md); the manifest stores none.

Common entry metadata keeps its meaning, including source attribution and
authored `navPath` (following the [path contract](./mokly-nav-paths.md)).
The removed fields `dependencies`, `declaredDependencies` and `ownedDependencies` are never written. Source locations provide attribution and protection, not comparison evidence. Ownership comes from document `styles` and non-CSS `resources` records. Declared stylesheet provenance remains in `insertedStylesheets`; no CSS resource owners are derived.
Current and accepted baseline manifests require the complete `sourceFiles`
inventory. Readers never infer it from older entry or page records.
`colorSchemes` is the effective, sorted,
light-first set: a component variant inherits its parent's set, while a screen
variant may replace its parent's set under the variant contract. Variant props
contain only validated data; supplied
slot names reference declared slots and contain no React values. Every
component parent has at least one variant entry, with unique global
kebab-case ids, following it in authored order. The first is the default; a
parent has no views of its own.

When components are registered, every screen's and component variant's
`componentViews` contains exactly one record for each light and optional dark
view, ordered mobile/light, mobile/dark, desktop/light, desktop/dark. It is
required even for a view with no component instances. Missing metadata is never
normalized to an empty record. The root component of its own variant is the
entry owner and is not listed as its own used instance.

## Usage And Rendered Ranges

The [component usage-record contract](./mokly-component-usage-records.md) owns
the complete types, key preimages, ownership graphs, ordering, range placement,
style/resource ownership, and validation. The
[instance identity contract](./mokly-instances.md) owns reference scope,
stability, source capture, and rendered sentinels.

## Validation And Serialization

Use one schema implementation for Build output, Browse, baseline parsing, and
publishing. Reject unknown fields, incorrect types, invalid keys/ids/hashes,
inconsistent props/schema, duplicate records, unsafe paths, and broken
cross-references. The hash must match decoded and validated props.

Ids, source paths, `navPath`/use-case/variant relationships,
tags, resource confinement, and global output collisions retain existing rules.
A current reader rejects any stored `route`, `fragments`, `darkFragments`,
`viewports`, `dependencies`, or component `variants` field as an unknown
field. The removed `declaredDependencies` and `ownedDependencies` fields are
also rejected by current and baseline v8 readers. No reader strips them.

Entries sort by kind name in UTF-16 order (`component`, `page`, `screen`,
`use-case`) and then id; lexical manifest ordering uses UTF-16 code units
rather than a locale-sensitive collator. The variants of one parent are the
exception: emit them in authored order directly after their parent and before
the next entry in kind-then-id order. That sibling order is the order
`variantsById`, the navigation list, the details `Variants` row, and the
public tree's entry-node `children` present. During pre-validation ordering,
a variant without one uniquely valid non-variant parent of its kind stays in
ordinary kind-then-id position so relationship validation can reject it
deterministically; invalid entries are never emitted. Use-case steps and tags
retain authored order. Supplied slots and the declared `slots` list sort uniquely. JSON object keys in new structures sort
lexically; arrays follow their stated order. Omit absent optional fields; emit
required empty arrays/objects. Serialize with two-space indentation and a
final LF.

Emit v8 for every catalogue, including one without components. Its sorted
private `sourceFiles` inventory, explicit page entries, component records, and
usage proof are required. Current and baseline readers validate the same v8
shape without normalization of earlier output. The
[baseline compatibility contract](./mokly-baseline-compatibility.md) owns the
clean unavailable outcome for earlier output. Registered pages retain material
Changes and baseline context without visual comparisons or controls. Contract
fixtures, schema round trips, deterministic output, and ownership/path
regressions cover these rules.
