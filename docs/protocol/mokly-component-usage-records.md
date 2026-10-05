# Component Usage Records

## Delivery Status

Implemented for manifest v9, including strict admission of baseline usage
records. `componentId` names a component parent by its path.

This contract owns the per-view component instance, slot, range, style, and
resource records stored by [manifest v9](./mokly-component-manifest.md).
Stable instance-key behavior is defined separately by
[Component Instance Identity](./mokly-instances.md).

## Record Shapes

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

References are local to one view except `componentId`, which names a registered
component parent by its path. An entry owner is the containing screen or component variant.
The component root rendered for its own variant is the entry owner and is not a
used instance.

Instance and slot keys are lowercase 64-hex SHA-256 digests of UTF-8 JSON,
without a final LF. Their preimages are
`["mokabook-instance-v1", owner.kind, owner.kind === "instance" ? owner.instanceKey : null, slotKey ?? null, id]`
and `["mokabook-slot-v1", instanceKey, name]`. Those domain strings are frozen
protocol identifiers. Readers recompute keys and reject mismatches or
conflicting duplicates. Keys are not entry paths, selectors, or file
names.

## Ownership And Ordering

`owner` identifies whose inputs are compared. `slotKey` identifies the original
receiving slot. A forwarded slot names its previous record in `sourceSlotKey`
and preserves the original owner; that chain must terminate. Owner,
slot-source, and range-parent graphs are acyclic and complete.

Instances sort by key. `order` separately records contiguous zero-based
encounter order within each `(owner, slotKey)` scope. Local ids are unique in a
scope. Replaying a captured slot may place one logical instance several times,
but every placement agrees on props and owner. Slots sort by key and remain
recorded when supplied but not rendered.

Ranges sort in DOM start-marker order and receive ids `r-0`, `r-1`, and so on.
Each has one matched boundary pair; `parentId` is its nearest enclosing
registered range. Multi-root or text output has one enclosing range. A null
component has an empty range. Repeated placements use separate range ids
without creating extra logical instance keys.

Range ids, physical parents, style offsets, and placement counts are inspection
coordinates, not input identity. Moving or duplicating unchanged slot material
does not by itself mark a caller changed. Logical id, order, props, and owner
changes remain material under the
[component attribution contract](./mokly-component-changes.md).

## Style And Resource Ownership

Style offsets are nonnegative safe integers delimiting a nonempty half-open
UTF-16 range within a parsed final style element. The builder rebases renderer
offsets through transformations and validates final ownership. Ranges do not
overlap and sort by start offset.

Resource paths are exact mockups-root-relative public files and sort lexically,
one record per path. Every owner list is nonempty, sorted, duplicate-free, and
names components that actually render in the view, including the component root
when applicable. Ownership is an explicit renderer or author assertion, never
CSS-selector inference.

## Validation

Every current screen and component variant has one `ComponentViewRecord` for
each effective view, ordered mobile/light, mobile/dark, desktop/light,
desktop/dark. A view with no instances still has an explicit empty record;
missing usage is never normalized to empty.

Readers reject unknown fields, invalid hashes, missing references, cycles,
incorrect ordering, duplicate records, invalid source locations, unsafe
resource paths, overlapping styles, and owners absent from the view. Optional
invocation source is secondary metadata and never enters keys, props hashes, or
Changes projections.
