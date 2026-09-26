# Component Manifest Schema

## Delivery Status

Manifest-v6 generation, validation, Serve, and static export are implemented
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
Manifest v6 and component stylesheet ownership are defined by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
implemented in Milestone 6 and delivered in Milestone 3 respectively.
Historical parsing of v3–v5 is retained for Git baselines.
The optional inserted-link provenance record below is planned by the same
plan's Milestone 13 and is not implemented yet. It extends private v6 view
metadata without changing the manifest version or public read model.
Ignoring renderer records for declared CSS with a warning is planned by
Milestone 14.

## Entries And Variants

```ts
interface ManifestV6 {
  schemaVersion: 6;
  generatedBy: "mokly";
  entries: readonly ManifestEntryV6[];
  sourceFiles: readonly string[];
}

type ManifestEntryV6 =
  | ManifestCollection
  | ManifestUseCase
  | ManifestPage
  | ManifestScreen
  | ManifestComponent;

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

`ManifestScreen` additionally has an optional `variantOf` parent-screen id
under the implemented [screen variants contract](./mokly-screen-variants.md);
the field is part of the v6 shape without changing variant semantics.

Common entry metadata keeps its meaning, including source attribution and
hierarchy-derived `navPath`. Current v6 entries do not contain `dependencies`,
`declaredDependencies` or `ownedDependencies`; validators reject these keys as
unknown even when empty. Historical v3–v5 Git manifests remain readable but
normalize by removing all three fields from every entry before comparison,
including historical component ownership and nested variant data where present.
Do not synthesize removed fields from `sourcePath` or treat old path declarations
as Changes or comparison evidence. Variant props contain only validated data; supplied
slot names reference declared slots and contain no React values. Every component
has at least one variant, with unique kebab-case ids in authored order. The first
is the default; all variants use the component's same effective scheme set.

`ManifestCollection.childIds` is a required string array and may be empty. An
empty collection remains in manifest v6 with its authored identity and metadata;
relationship validation has no child edge to add and otherwise keeps the same
duplicate, target, ownership, and cycle rules.

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

interface InsertedComponentStylesheet {
  startOffset: number;
  endOffset: number;
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
  insertedStylesheets?: readonly InsertedComponentStylesheet[];
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

`insertedStylesheets` is private provenance, not an additional resource
reference. Each span covers one complete Mokly-inserted `<link>` in the final
generated HTML, including the generated header in its UTF-16 coordinate
space. The decoded public `path` matches that link; the corresponding derived
`resources` record may use a configured alias of the same real file.
`componentIds` are the sorted rendered declarers.
Spans are ordered, non-overlapping, in bounds and validated against final
links. The current writer emits the field for every component view, including
an empty array when nothing was inserted. An absent field on an earlier v6
baseline means no link can be proven Mokly-inserted; comparison retains those
links as page content. The
[stylesheet contract](./mokly-component-stylesheets.md#provenance-and-comparison-material)
defines the transient transform token and projection rules.

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
an explicit renderer assertion or the builder's derived record for a linked
[component stylesheet](./mokly-component-stylesheets.md), not CSS-selector inference.

Use one schema implementation for Build output, Browse, historical manifest
parsing, and publishing. Reject unknown fields in current v6 structures, incorrect
types, invalid keys/ids/hashes, inconsistent props/schema, duplicate records,
unsafe paths, and broken cross-references. Preserve current validation of the
inherited v3 entry forms. The hash must match decoded/validated props.

Ids, routes, source paths, collection/use-case relationships,
tags, resource confinement, and global output collisions retain existing rules.
Variant fragment paths must exactly match the component route and suffix rule
in the authoring contract, including every optional dark path. Derived
stylesheet `resources` must match the actual render's declaring component ids;
renderer records for any declared file are ignored with a
[build warning](./mokly-build-warnings.md#exact-messages), not merged. Derive
owners only when the final post-transform document still links the file.

Entries otherwise sort by route (empty for collections), then id; lexical
ordering in v6 uses UTF-16 code units rather than a locale-sensitive collator.
The variant screens of one parent are the exception: emit them in authored
order directly after their parent and before the next entry in route order.
That sibling order is the order `variantsById`, the navigation list, the
details `Variants` row, and the public tree's entry-node `children` present.
During pre-validation ordering, a variant without one uniquely valid root
screen parent stays in ordinary route-then-id position so relationship
validation can reject it deterministically; invalid entries are never emitted.
Component saved variants, collection children, use-case steps, and tags retain
authored order. Legacy pages sort by route.
Supplied slots and the declared `slots` list sort uniquely. JSON object keys
in new structures sort lexically;
arrays follow their stated order. Omit absent optional fields; emit required
empty arrays/objects. Serialize with two-space indentation and a final LF.

Emit v6 for every current catalogue, including those without components. Its
sorted private `sourceFiles` inventory and explicit page entries replace legacy
discovery; component records retain their complete usage and derived ownership.
Historical Git readers retain v3, v5, opt-in v2, and both earlier v4 shapes: main's
component format has `legacyPages`, while the page migration format has
`sourceFiles`. These v4 shapes are disjoint; mixed top-level fields are invalid.
Current primary-file loading rejects every earlier version with a rebuild
diagnostic; baseline parsing alone accepts them, strips removed fields and
normalizes to the v6 comparison shape. The process-local live index also uses
the v6 entry shape, not a second serialized manifest.
Do not invent component usage for historical screen/page-only entries or revive
legacy configuration. Registered document pages retain their material Changes
and baseline context without screen/component visual comparisons or controls.
Reject unknown versions.
Shared positive/negative contract fixtures, schema round trips,
deterministic-output checks, and ownership/path regressions cover this
contract.
