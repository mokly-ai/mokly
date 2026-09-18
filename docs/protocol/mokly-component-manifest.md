# Component Manifest Schema

## Delivery Status

Manifest-v5 generation, validation, Serve, and static export are implemented
through the public `defineComponent` API. These are the normative interfaces
for the [component contract](./mokly-components.md). `ManifestEntryBase`,
`ManifestScreen`, `ManifestPage`, `ManifestCollection`, `ManifestUseCase`,
and `Viewport` retain the [package contract](./mokly-package.md) and the named
[registry interfaces](../../packages/viewer/src/registry/types.ts).
`ColorScheme` is `"light" | "dark"`. Prop/wire types come from the
[prop schema](./mokly-component-props.md); `ComponentControl` comes from the
[controls contract](./mokly-component-controls.md).

The optional instance `source` field below is implemented in
[viewer library Milestone 2](../../plans/mokly-viewer-library.md).
All existing v5 fields retain their contracts. Updated readers accept
instances with or without `source`; the manifest version remains 5.

## Entries And Variants

```ts
interface ManifestV5 {
  schemaVersion: 5;
  generatedBy: "mokly";
  entries: readonly ManifestEntryV5[];
  sourceFiles: readonly string[];
}

type ManifestEntryV5 = (
  | ManifestCollection
  | ManifestUseCase
  | ManifestPage
  | ManifestScreen
  | ManifestComponent
) & { declaredDependencies: readonly string[] };

interface ComponentAwareScreen extends ManifestScreen {
  componentViews: readonly ComponentViewRecord[];
}

interface ManifestComponent extends Omit<ManifestEntryBase, "kind"> {
  kind: "component";
  route: string;
  viewports: readonly ["mobile", "desktop"];
  tags?: readonly string[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  ownedDependencies: readonly string[];
  variants: readonly ManifestComponentVariant[];
}

interface ManifestComponentVariant {
  id: string;
  title: string;
  description?: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  fragments: Record<Viewport, string>;
  darkFragments?: Record<Viewport, string>;
  componentViews: readonly ComponentViewRecord[];
}
```

Common entry metadata keeps its meaning, including source attribution and
hierarchy-derived `navPath`. Every v5 entry requires `declaredDependencies`,
the sorted unique paths explicitly authored in its definition. `dependencies`
remains exactly their union with `sourcePath`. Keeping both prevents automatically
added source attribution from masquerading as an exact direct-screen dependency;
an explicit declaration of that same source path is still represented. Both
lists use normal path validation; `ownedDependencies` is a subset of the declared
list. Historical v3 data has no inferred declaration provenance. Variant props contain only validated data; supplied
slot names reference declared slots and contain no React values. Every component
has at least one variant, with unique kebab-case ids in authored order. The first
is the default; all variants use the component's same effective scheme set.

When components are registered, every screen's `componentViews` contains exactly one record for each light and optional dark
fragment, ordered mobile/light, mobile/dark, desktop/light, desktop/dark. It is
required even for a view with no component instances. Missing metadata is never
normalized to an empty record. The root component of its own variant is the
entry owner and is not listed as its own used instance.

## Usage And Rendered Ranges

```ts
type ComponentInputOwner =
  { kind: "entry" } | { kind: "instance"; instanceKey: string };

interface ComponentInstanceRecord {
  key: string;
  id: string;
  componentId: string;
  owner: ComponentInputOwner;
  slotKey?: string;
  order: number;
  props: ComponentWireProps;
  propsKey: string;
  source?: ComponentSourceLocation;
}

interface ComponentSourceLocation {
  path: string;
  line: number;
  column: number;
}

interface ComponentSlotRecord {
  key: string;
  instanceKey: string;
  name: string;
  owner: ComponentInputOwner;
  sourceSlotKey?: string;
}

type ComponentRangeTarget =
  { kind: "instance"; instanceKey: string } | { kind: "slot"; slotKey: string };

interface ComponentRangeRecord {
  id: string;
  target: ComponentRangeTarget;
  parentId?: string;
}

interface ComponentStyleOwnership {
  startOffset: number;
  endOffset: number;
  componentIds: readonly string[];
}

interface ComponentResourceOwnership {
  path: string;
  componentIds: readonly string[];
}

interface ComponentViewRecord {
  viewport: Viewport;
  colorScheme: ColorScheme;
  instances: readonly ComponentInstanceRecord[];
  slots: readonly ComponentSlotRecord[];
  ranges: readonly ComponentRangeRecord[];
  styles: readonly ComponentStyleOwnership[];
  resources: readonly ComponentResourceOwnership[];
}
```

All references in one view are local to that document except component ids,
which reference registered entries. `id` is the local `moklyInstance` value
or its component-id default. Instance and slot keys are lowercase 64-hex SHA-256
digests of UTF-8 JSON preimages, without a trailing newline. For an instance,
the preimage is the array
`["mokabook-instance-v1", owner.kind, owner.kind === "instance" ? owner.instanceKey : null, slotKey ?? null, id]`.
For a slot it is `["mokabook-slot-v1", instanceKey, name]`, using its receiving
instance and declared slot name. Those two historical domain strings are
frozen protocol identifiers so a product rename cannot invalidate stored
component identity; they are not accepted package, executable, configuration,
or markup names. Serialize the arrays with `JSON.stringify`.
An entry owner means the containing screen or component variant. Parent/slot
references are their fixed-size digests, never recursively embedded JSON keys.
Readers recompute keys from the record fields and reject mismatches or conflicting
duplicate keys. Neither key is a filesystem path, selector, catalogue id, or
route segment. This bounds key length independently of nesting depth.

The [instance contract](./mokly-instances.md) owns the complete stability list,
record-only resolution and sentinel/comment format. The containing entry id is
not in the digest: references must retain entry/variant/view scope even when
equal keys occur in different views. Optional `source` identifies the invocation
with a repository-relative POSIX path and positive 1-based line/column. Absolute
or escaping paths are invalid. Its build capture/stripping is specified there;
source metadata never enters `propsKey`, input identity or Changes projections.

`owner` identifies the caller whose inputs are compared. `slotKey`, when present,
identifies the original slot scope in which the instance was supplied. The slot
owner equals that instance's input owner. A forwarded slot names its prior
record in `sourceSlotKey` and preserves the original owner; following this chain
must terminate. Its contents retain the original slot scope. Owner, slot-source,
and range-parent graphs must be acyclic, with no missing references.

Instances sort by key; `order` separately records the zero-based encounter order
within each `(owner, slotKey)` scope and must be contiguous and unique. Keys and
local ids within a scope are unique. Multiple placements of the same captured
slot may yield several ranges for one logical instance; they must agree on its
props and owner. Conflicting duplicate invocations fail. Slot records sort by
key and exist for supplied slots even when the adapter never renders them.

Ranges record physical placement independently of input ownership. They sort
in DOM start-marker order and have ids `r-0`, `r-1`, and so on. Each has exactly
one matched boundary pair; `parentId` identifies its nearest enclosing registered
range, including slots. Multi-root/text output occupies one enclosing range.
An invoked null component has an empty range with no visible bounds. Unrendered
slots have no range; repeated placements have different range ids.
Every recorded instance has a matched comment pair for each of its rendered
ranges in that view, including an empty pair for null output. A replayed
instance can have multiple ranges; this does not create additional logical keys.

Range ids, physical parentage, style offsets, and repeated placement counts are
inspection coordinates, not direct input identity. A component implementation
moving or duplicating an unchanged slot must not itself mark the caller changed.
Comparison projects each original slot's material once under its input owner,
then applies the [attribution rules](./mokly-component-changes.md). Caller
changes to logical instance ids/order/props still remain material.

## Styles, Validation, And Serialization

Style offsets are nonnegative safe integers delimiting a nonempty half-open
UTF-16 range in the final generated HTML, within a parsed style element's text.
The builder rebases renderer offsets through its own transformations and
validates ownership after compatibility output; it never trusts stale offsets.
Ranges must not overlap and sort by start offset. Resource paths are exact
mockups-root-relative public files and sort lexically, with one record per path.
Owner lists are nonempty, sorted, duplicate-free component ids that actually
render in the view, including its component root when applicable. Ownership is
an explicit renderer/author assertion, not CSS-selector inference.

Use one schema implementation for Build output, Browse, historical manifest
parsing, and publishing. Reject unknown fields in current v5 structures, incorrect
types, invalid keys/ids/hashes, inconsistent props/schema, duplicate records,
unsafe paths, and broken cross-references. Preserve current validation of the
inherited v3 entry forms. The hash must match decoded/validated props.

Ids, routes, dependency roots, source paths, collection/use-case relationships,
tags, resource confinement, and global output collisions retain existing rules.
Variant fragment paths must exactly match the component route and suffix rule
in the authoring contract, including every optional dark path. `ownedDependencies`
is a subset of `dependencies`; validate and retain direct-screen overlap evidence.

Entries sort by route (empty for collections), then id; lexical ordering in v5
uses UTF-16 code units rather than a locale-sensitive collator. Variants,
collection children, use-case steps, and tags retain authored order. Legacy pages sort by route.
Dependency arrays sort uniquely, as do owned paths, supplied slots, and the
declared `slots` list. JSON object keys in new structures sort lexically;
arrays follow their stated order. Omit absent optional fields; emit required
empty arrays/objects. Serialize with two-space indentation and a final LF.

Emit v5 for every current catalogue, including those without components. Its
sorted private `sourceFiles` inventory and explicit page entries replace legacy
discovery; component records retain their complete usage and declaration proof.
Historical Git readers retain v3, opt-in v2, and both earlier v4 shapes: main's
component format has `legacyPages`, while the page migration format has
`sourceFiles`. These v4 shapes are disjoint; mixed top-level fields are invalid.
Current loading rejects every earlier version with a rebuild diagnostic.
Do not invent component usage for historical screen/page-only entries or revive
legacy configuration. Registered document pages retain their material Changes
and baseline context without screen/component visual comparisons or controls.
Reject unknown versions.
Implement shared positive/negative contract fixtures, schema round trips,
deterministic-output checks, and ownership/path regressions in Milestone 2.
