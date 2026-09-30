# Component Usage Records

## Delivery Status

Implemented for manifest v7, including strict admission of baseline-v7 usage
records, with historical retirement of obsolete ownership arrays.

This contract owns the per-view component instance, slot, and range records stored by [manifest v7](./mokly-component-manifest.md).
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

interface ComponentViewRecord {
  viewport: Viewport;
  colorScheme: ColorScheme;
  instances: readonly ComponentInstanceRecord[];
  slots: readonly ComponentSlotRecord[];
  ranges: readonly ComponentRangeRecord[];
}
```

References are local to one view except `componentId`, which names a registered
component parent. An entry owner is the containing screen or component variant.
The component root rendered for its own variant is the entry owner and is not a
used instance.

Instance and slot keys are lowercase 64-hex SHA-256 digests of UTF-8 JSON,
without a final LF. Their preimages are
`["mokabook-instance-v1", owner.kind, owner.kind === "instance" ? owner.instanceKey : null, slotKey ?? null, id]`
and `["mokabook-slot-v1", instanceKey, name]`. Those domain strings are frozen
protocol identifiers. Readers recompute keys and reject mismatches or
conflicting duplicates. Keys are not paths, selectors, catalogue ids, or
routes.

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

Range ids, physical parents, and placement counts are inspection
coordinates, not input identity. Moving or duplicating unchanged slot material
does not by itself mark a caller changed. Logical id, order, props, and owner
changes remain material under the
[component attribution contract](./mokly-component-changes.md).

## Retired Ownership Records

The renderer returns a document string, never ownership assertions. Current
v7 usage records reject `styles` and `resources` as unknown keys; retirement
does not bump the manifest version. Inline ownership is inferred under the
[inline style contract](./mokly-inline-styles.md); linked-file ownership uses
`ownedDependencies`.

At the Git boundary and when loading a rebuilt baseline cache, every admitted
historical usage record may contain either retired key only as an array.
Readers discard those arrays before comparison without interpreting their
contents and reject non-arrays. All other v7 validation remains identical to
current validation, including prop schemas, declared slots, keys, references,
ordering and source locations.

Historical usage projected into the public catalogue is a separate mode: its
old prop values and slot names need not satisfy a component's current schema.
The reader still validates wire encoding, hashes, keys, ordering and ownership
references. This mode never applies to historical manifest admission, which
validates usage against that manifest's own component declarations.

## Validation

Every current screen and component variant has one `ComponentViewRecord` for
each effective view, ordered mobile/light, mobile/dark, desktop/light,
desktop/dark. A view with no instances still has an explicit empty record;
missing usage is never normalized to empty.

Readers reject unknown fields, invalid hashes, missing references, cycles,
incorrect ordering, duplicate records, invalid source locations, and owners
absent from the view. Optional
invocation source is secondary metadata and never enters keys, props hashes, or
Changes projections.

The public `@mokly/viewer/data` validators require an explicit options object:
`validateComponentViews(value, components, at, { dark, historical? })` checks
the complete axis-ordered view list; `dark` is required and `historical` defaults
to false. `validateComponentViewRecord(view, components, at, { historicalUsage? })`
checks one record; `historicalUsage` defaults to false, so pass `{}` for current
usage. Only `historical` admits the retired arrays above; `historicalUsage` is
the distinct public-catalogue mode, never a manifest-admission option.
Options must be plain objects with only the named boolean-valued fields.
Missing options, positional booleans/root ids, unknown keys, non-booleans and
extra arguments fail with `ComponentValidationError` before record mutation.
Historical retirement validates a plain view object before inspecting keys;
a null view fails with the same typed plain-object diagnostic as current usage.
