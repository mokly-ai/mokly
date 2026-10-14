# Component Usage Records

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Record Shapes

Usage records derive from the ownership regions of the composed trees under
the [comparison contract](./mokly-comparison.md#tree-model). A view's usage travels as the `usage` of that view in the
[entry detail](./mokly-shell-delivery.md#entry-detail) and feeds the
[comparison records](./mokly-component-comparison-records.md).

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
  | { kind: "instance"; instanceKey: string }
  | { kind: "slot"; slotKey: string }
  | { kind: "root" };

interface ComponentRangeRecord {
  id: string;
  target: ComponentRangeTarget;
  parentId?: string;
}

interface ComponentViewUsage {
  instances: readonly ComponentInstanceRecord[];
  slots: readonly ComponentSlotRecord[];
  ranges: readonly ComponentRangeRecord[];
}
```

References are local to one view except `componentId`, which names a
registered component parent by its path. The entry owner is the screen or
component entry whose view is recorded. The root component of a component
entry's own view is the entry owner and is not a used instance.

Instance and slot keys are lowercase 64-hex SHA-256 digests of UTF-8 JSON,
without a final LF. Their preimages are
`["mokly-instance-v1", owner.kind, owner.kind === "instance" ? owner.instanceKey : null, slotKey ?? null, id]`
and `["mokly-slot-v1", instanceKey, name]`. Those domain strings are permanent
protocol identifiers. Readers recompute keys and reject mismatches or
conflicting duplicates. Keys are not entry paths, selectors, or file names.

`id` is the instance id of the [instance contract](./mokly-instances.md),
which an HTML screen declares with `mokly-instance` and a React render with
`moklyInstance`. `props` holds the instance's data props and `propsKey` their
canonical digest. `source` is the optional invocation location: the component
element's file, line, and column for an HTML screen, or the location the
sidecar reports for a React render. It is secondary metadata and never enters
keys, props digests, or Changes.

## Ownership And Ordering

`owner` identifies whose inputs are compared: the entry for an instance that
the entry's own body renders, the enclosing instance for an instance that a
component renders. `slotKey` identifies the receiving slot. A forwarded slot
names its earlier record in `sourceSlotKey` and keeps the original owner; that
chain must end. Owner, slot-source, and range-parent graphs are acyclic and
complete.

Instances sort by key. `order` separately records contiguous zero-based
encounter order within each `(owner, slotKey)` scope. Local ids are unique in
a scope. Replaying a slot may place one logical instance several times, but
every placement agrees on props and owner. Slots sort by key and stay recorded
when supplied but not rendered.

Ranges are the regions of the composed tree: an instance region, a slot
region, or the root region. They sort in tree start order and take the ids
`r-0`, `r-1`, and so on. `parentId` is the nearest enclosing region.
Multi-root or text output is one region. A null render is an empty region.
Repeated placements use separate range ids without extra logical instance
keys.

Range ids, physical parents, and placement counts are inspection coordinates,
not input identity. Moving or duplicating unchanged slot material does not by
itself mark a caller changed. Logical id, order, props, and owner changes are
material under the
[component attribution contract](./mokly-component-changes.md).

## Root Output Boundary

Every view of a component entry has exactly one range whose target is
`{ kind: "root" }`. It is the region `r-0` that the core attaches to the root
component itself when it composes the page, with no marker. It has no
`parentId`; its component id is the entry's component path: the entry's own
path for a parent, `variantOf` for a variant. It wraps only the root render
result, including empty or multi-root output; the renderer's wrappers and head
content lie outside it, and nested regions name it as their parent.

The root is not an instance, slot, prop owner, or Used by occurrence. It is
containment proof for the [CSS rule contract](./mokly-css-attribution-rules.md)
and nothing else: it does not change which Review-ignore regions are allowed,
and an ignore region around the root output that encloses no instance or slot
region stays valid. Screens have no root range. A root range on a screen, or a
component view without one, is invalid data; the core never guesses a root
around the document. An absent view on one side of an added or removed entry
is valid and supplies no tree.

Readers accept the root target as a boundary without presenting it as a
nested component or adding an instance count. Public usage carries no DOM
elements.

## Style And Resource Ownership

Usage records carry no style ranges, no resource tables, and no stylesheet
provenance. Styles a [sidecar](./mokly-sidecar.md) render returned belong to
the rendered component by construction, and every other rule is attributed
through the [style ownership](./mokly-comparison.md#style-ownership) rule. A
resource reference takes the owner of the referencing element under the
[resources](./mokly-comparison.md#resources) rule, and resource owners exclude
CSS. The public form of a view's resource evidence is the `resourceEvidence`
of the entry detail.

## Validation

Every screen and component entry has one usage record per view, in the order
mobile/light, mobile/dark, desktop/light, desktop/dark. A view with no
instances has an explicit empty record. In the entry detail a view's `usage`
is `ready`, `pending`, or `unavailable` and never omitted.

Readers reject unknown fields, invalid hashes, missing references, cycles,
incorrect ordering, duplicate records, invalid source locations, and owners
absent from the view.
