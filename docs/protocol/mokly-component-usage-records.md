# Component Usage Records

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Implemented for manifest v10. Root output ranges, non-CSS-only resource records and independent
stylesheet provenance are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the
[source-path removal plan](../../plans/remove-source-path-evidence.md), within v10.

The rule for comments with the former spelling is implemented in
[M23](../../plans/remove-source-path-evidence.md#milestone-23-remove-the-historical-marker-rename).
Implemented for manifest v10, including strict admission of baseline usage
records. `componentId` names a component parent by its path.

This contract owns the per-view component instance, slot, range, non-CSS resource and inserted-link
records stored by [manifest v10](./mokly-component-manifest.md).
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
  resources: readonly ComponentResourceOwnership[];
  insertedStylesheets: readonly InsertedComponentStylesheet[];
}

interface InsertedComponentStylesheet {
  startOffset: number;
  endOffset: number;
  path: string;
  componentPaths: readonly string[];
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

On both baseline and current sides, a comment with the former `mokabook-`
spelling is ordinary page content. Mokly never reads it as a marker or removes
it as one. The comment alone is not a validation error. It creates no component
range, Review-ignore region or material marker. Required baseline ranges that
its document cannot prove follow
[Invalid Or Missing Data](./mokly-baseline-compatibility.md#invalid-or-missing-data).
Historical marker translation is not supported. The frozen instance and slot
key domain strings above are unchanged.

Range ids, physical parents and placement counts are inspection
coordinates, not input identity. Moving or duplicating unchanged slot material
does not by itself mark a caller changed. Logical id, order, props, and owner
changes remain material under the
[component attribution contract](./mokly-component-changes.md).

## Root Output Boundary

Every accepted component saved-view document has exactly one range whose target is
`{ kind: "root" }`. It uses the existing layout-neutral component start/end
comment grammar and `r-N` allocation. It has no `parentId`; its component id is
the variant entry's `variantOf`. The paired markers wrap only the root render
result, including empty or multiple-root output, before the renderer wraps
`input.node`. Nested ranges name it as their nearest physical parent where
applicable. Renderer wrappers and head content remain outside it.

The root is not an instance, slot, prop owner or Used by occurrence. Preserve
existing instance keys, caller ownership and inspection behavior. Strip its
markers as package markers for document comparison, so the new marker pair
alone is not material. Keep it when validating containment for CSS. Use original final-document
coordinates for comparison membership. Link removal and paired ignores are
material edits; they do not move the ranges used by the matching tree. Never
infer root output from a body element or a common selector.

The root pair is containment proof only. It does not change which manual
Review-ignore regions are allowed. A previously valid region around root output
with no instance or caller-slot boundaries stays valid. Subjects inside paired ignores supply no CSS matches, including when a region
hides all root output. The original tree remains structural selector context,
as [page matching](./mokly-page-analysis.md#original-page-matching) defines.

Screens have no root range. Current and baseline component views require one; duplicates,
unpaired markers or a root on a screen fail normal component-range validation.
Missing required root bounds are invalid data. They do not become page evidence
or trigger a guessed root around the document. An absent view on one side of an
added or removed entry is still valid and supplies no document or matches.

Catalogue v6 usage ranges carry this target. Readers and inspection
accept it as a boundary without presenting it as a nested component or adding
an instance count. Public evidence carries no range offsets or DOM elements.

## Resource Ownership And Inserted Links

A renderer returns a document string or an object with `html` and optional
`resources`. Usage records contain no `styles` array. A returned renderer
`styles` field is ignored with a warning; eligible inline rules use
[inferred ownership](./mokly-inline-styles.md).

Resource paths are exact mockups-root-relative public files and sort lexically,
one record per path. Every owner list is nonempty, sorted, duplicate-free and
names components that render in the view, including the root when applicable.
These records own only non-CSS files. CSS resource assertions are checked,
warned and retained as private closure seeds; persisted usage rejects CSS owners.
Only non-CSS references follow inferred inline owners. CSS file membership uses
original element containment and own-page matches, not ownership assertions.

`insertedStylesheets` records final-document full-link UTF-16 spans, decoded
public paths and rendered declaring paths. It is private provenance, not file
ownership. Each persisted v10 usage record must contain this array, even when
empty. A missing array is invalid data; readers never guess provenance or
normalize its absence to an empty array. Public inspection still omits this
private field. It needs no corresponding `resources` record. The
[stylesheet provenance contract](./mokly-component-stylesheet-ownership.md)
defines final-link validation and the root-link comparison exception.

## Validation

When components are registered, every current screen and component variant has one `ComponentViewRecord` for
each effective view, ordered mobile/light, mobile/dark, desktop/light,
desktop/dark. A view with no instances still has an explicit empty record;
missing usage is never normalized to empty.

Readers reject unknown fields, invalid hashes, missing references, cycles,
incorrect ordering, duplicate records, invalid source locations, unsafe
resource paths, overlapping inserted links, and owners absent from the view. Optional
invocation source is secondary metadata and never enters keys, props hashes, or
Changes projections.

The public validators require an explicit options object.
`validateComponentViews(value, components, at, { dark, rootId?, historical? })`
checks the complete axis-ordered list; `dark` is required.
`validateComponentViewRecord(view, components, at, { rootId?, historicalUsage? })`
checks one render. Pass `{}` for a current screen. `rootId` names the component
parent for a saved view, including its root's non-CSS resource ownership.

`historicalUsage` defaults to false. It keeps already-admitted historical
inspection props and slots when current schemas change. It does not admit an
earlier manifest shape. Current and historical manifest usage have the same
v10 fields, with no `styles` array. The `historical` list option is retained
for callers, but it does not remove fields or translate input. Options are
plain objects with only the named fields. `rootId` is a string; the other fields
are booleans. Missing options, positional arguments, unknown keys, invalid
option types and extra arguments fail with `ComponentValidationError`.
