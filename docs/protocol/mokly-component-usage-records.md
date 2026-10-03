# Component Usage Records

## Delivery Status

Implemented for manifest v8, including strict admission of normalized baseline usage
records. Root output ranges, non-CSS-only resource records and independent
stylesheet provenance are planned for [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the
[source-path removal plan](../../plans/remove-source-path-evidence.md), within v8.

This contract owns the per-view component instance, slot, range, style, and
resource records stored by [manifest v8](./mokly-component-manifest.md).
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
  | { kind: "instance"; instanceKey: string }
  | { kind: "slot"; slotKey: string }
  | { kind: "root" };

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
  insertedStylesheets?: readonly InsertedComponentStylesheet[];
}

interface InsertedComponentStylesheet {
  startOffset: number;
  endOffset: number;
  path: string;
  componentIds: readonly string[];
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

Range ids, physical parents, style offsets, and placement counts are inspection
coordinates, not input identity. Moving or duplicating unchanged slot material
does not by itself mark a caller changed. Logical id, order, props, and owner
changes remain material under the
[component attribution contract](./mokly-component-changes.md).

## Root Output Boundary

Every new component saved-view document has exactly one range whose target is
`{ kind: "root" }`. It uses the existing layout-neutral component start/end
comment grammar and `r-N` allocation. It has no `parentId`; its component id is
the variant entry's `variantOf`. The paired markers wrap only the root render
result, including empty or multiple-root output, before the renderer wraps
`input.node`. Nested ranges name it as their nearest physical parent where
applicable. Renderer wrappers and head content remain outside it.

The root is not an instance, slot, prop owner or Used by occurrence. Preserve
existing instance keys, caller ownership and inspection behavior. Strip its
markers as package markers for document comparison, so the new marker pair
alone is not material. Keep it when validating containment for CSS. Rebase
coordinates through compatibility, provenance removal and Review-ignore using
the same validated range policy as other boundaries; never infer its output
from a body element or a common selector.

The root pair is containment proof only. It does not change which manual
Review-ignore regions are allowed. A previously valid region around root output
with no instance or caller-slot boundaries stays valid. Normalized-away elements
supply no CSS matches, including when that region removes all root output.

Screens have no root range. New current component views require one; duplicates,
unpaired markers or a root on a screen fail normal component-range validation.
Historical component views may lack it. They retain ordinary material
comparison, but give no proof of root containment on that side. Current-only
proof can still establish a changed component. Unproven matches remain page
evidence. No migration may guess a root around the entire old document.

Catalogue v4 usage ranges carry this new target in place. Readers and inspection
accept it as a boundary without presenting it as a nested component or adding
an instance count. Public evidence carries no range offsets or DOM elements.

## Style And Resource Ownership

Style offsets are nonnegative safe integers delimiting a nonempty half-open
UTF-16 range within a parsed final style element. The builder rebases renderer
offsets through transformations and validates final ownership. Ranges do not
overlap and sort by start offset.

Resource paths are exact mockups-root-relative public files and sort lexically,
one record per path. Every owner list is nonempty, sorted, duplicate-free, and
names components that actually render in the view, including the component root
when applicable. These records own only non-stylesheet files. Renderer CSS
records are ignored with a warning; Mokly derives no CSS resource records.
Historical CSS owner records are dropped before comparison. Renderer `styles`
remain exact document ranges. CSS rule membership uses element containment,
not these assertions.

`insertedStylesheets` records final-document full-link UTF-16 spans, decoded
public paths and rendered declaring ids. It is private provenance, not file
ownership. It needs no corresponding `resources` record. The
[stylesheet provenance contract](./mokly-component-stylesheet-ownership.md)
defines final-link validation and the root-link comparison exception.

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
