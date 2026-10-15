# Sidecar Render Records

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page defines resolved bindings, render inputs, and usage drafts for the
[sidecar contract](./mokly-sidecar.md). The generated modules under
`packages/mokly/src/generated/sidecar/` define the exact wire shapes.

## Results

A fragment result is `{ html, styles, resources, instances, slots, warnings }`.
Styles keep first-appearance order. Resources are the non-CSS public seeds the
consumer renderer declares. Instance and slot drafts describe actual usage.
Warnings belong only to that render.

`renderPage` runs a synchronous `definePage` callback. It returns
`{ html, resources, warnings }`, with a complete document and no styles.
The core applies the [page rules](./mokly-pages.md) to the document.

## Resolved Bindings

After `describe`, the core resolves the catalogue paths and titles. It sends
`bindings` with the generation and `entries`, a complete map from each
described definition handle to `{ path, title }`. This includes the parent
of each stories file. A variant has no handle and is not in this table.
A render without the table fails closed with `bundle-failed`.

The table supplies component paths and default instance ids, definition link
targets, and parent identity. The core can replace the complete table when
catalogue paths or titles change. The pool replays the latest table after
class maps and `describe`, before a render on a replacement process.

`renderScreen` and `renderComponent` also carry `entry: { path, title }`.
These are the effective path and title of the rendered entry, including a
variant. The consumer renderer receives this entry, rather than the parent's
metadata. The fragment key includes the binding table fingerprint and the
effective entry fingerprint, in addition to the other render inputs.

## Instance Drafts

A fragment result includes `instances` and `slots` beside its HTML, styles,
resources, and render warnings. The core validates drafts, reconciles them
with the markers, and builds the
[usage records](./mokly-component-usage-records.md). Drafts do not authorize
registration of a definition or bypass core schema validation.

Each instance placement has these fields:

- `regionId`: its fragment-local instance marker id.
- `key`, `id`, `componentPath`, `owner`, optional `slotKey`, `order`,
  `props`, and `propsKey`: the logical inputs under the
  [instance contract](./mokly-instances.md). `componentPath` is the resolved
  parent component path. Props use the canonical tagged
  [wire form](./mokly-component-props.md#canonical-wire-props).
- Optional `source`: the JSX invocation's repository-relative path and
  one-based line and column. It never enters identity or prop digests.

Repeated placement of one input instance returns one draft per region. Each
placement agrees on the logical inputs. Encounter order is zero-based within
each input owner and original receiving slot. The component root of its own
entry is not a used instance and has no instance draft.

## Slot Drafts And Inputs

A supplied React slot has `key`, `instanceKey`, `name`, `owner`, optional
`sourceSlotKey`, `instanceRegionId`, and `regionIds`. The first five fields
follow the usage record rules. `instanceRegionId` names its receiver's
placement. `regionIds` lists every rendered placement of the slot and is
empty for an unused supplied slot. Forwarding preserves the original input
owner and records the earlier receiving slot in `sourceSlotKey`.

Each slot placement has its own region id. Its marker is
`<!--mokly-slot:start id="r-4" instance="r-3" name="children"-->`, closed by
`<!--mokly-slot:end id="r-4"-->`. The receiving instance is `r-3`.
The core remaps fragment-local region ids into document order when it
composes the document. Physical placement never changes a logical key.

`renderComponent.slots` is a map of slot names to tagged inputs:

- `{ kind: "placeholder", token }` supplies HTML content owned by the core.
  The sidecar returns the placeholder and its effective ignore scope.
- `{ kind: "saved", handle }` selects a React value saved during `describe`.
  The handle must exist in this generation, even when the saved value is null.

A placeholder token never selects a saved React value. Slots remain separate
from data props, their encoding, and their material digest.
