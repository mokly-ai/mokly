# Component Instance Identity

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Identity And Scope

An instance is one logical use of a registered component inside an entry's
render: a component element in an HTML screen, component, or page body, or a
`defineComponent` wrapper in a React render or a Storybook story. Its
`ComponentInstanceRecord` belongs to one view of one screen or component entry
under the [usage records contract](./mokly-component-usage-records.md). The
component root of its own entry's page is the entry owner, not a used
instance. Slot content that a component renders more than once places one
instance more than once.

The key algorithm is:

```ts
const preimage = [
  "mokly-instance-v1",
  owner.kind,
  owner.kind === "instance" ? owner.instanceKey : null,
  slotKey ?? null,
  id,
];
const key = sha256(JSON.stringify(preimage)); // lowercase hex
```

Hash UTF-8 bytes with no trailing newline, salt, whitespace, or path prefix.
The result is exactly 64 lowercase hexadecimal characters. The
`mokly-instance-v1` domain string is a fixed protocol identifier,
including its spelling. `id` is the validated local instance id: the
`mokly-instance` attribute of a component element, or the `moklyInstance`
prop of a wrapper, defaulting to the final segment of the registered
component's resolved path, including after index collapse or a declared path
override. Explicit values use lowercase kebab-case grammar; inferred defaults
follow the component path's segment grammar. `owner` is `{ kind: "entry" }`
or `{ kind: "instance", instanceKey }`. The receiving-slot key is the same
digest operation over `["mokly-slot-v1", instanceKey, name]`.

The containing entry path, viewport, colour scheme, `componentId`, props, and
source location are **not** in the instance preimage. In particular, moving an
entry-owned use to another screen can keep the same digest. Keys are unique
within a view, not globally across a catalogue. Public `InstanceRef` stores
the owning entry path in `screenPath` plus viewport, scheme, key, and optional
flow `stepIndex`; it has no `variantId`, because a component variant's path is
already the owning entry path. Moving entries changes the scoped reference
even when the digest is identical. Never search another entry for a missing
key.

`slotKey` denotes the original input slot scope. Forwarding a slot preserves
that scope; it does not replace it with each later receiving slot. The input
owner and the region that contains the output can differ.

## Stability Rule

A digest changes if and only if its serialized preimage changes, subject to the
usual SHA-256 collision assumption. Edits that change it are:

- Changing the effective instance id, including changing the final component
  path segment when it supplies the default.
- Changing input ownership between entry and instance, or moving the use to a
  parent with a different instance key.
- Changing the original receiving slot key, including entering or leaving a
  slot, renaming its declared slot, or changing its receiving instance's key.
- Changing an ancestor input key when that change propagates into this
  instance's owner key or slot key.

Edits that keep it, provided those inputs stay the same, are:

- Editing data props, slot content, component implementation, styles or assets.
- Reordering siblings, or inserting or removing other siblings with distinct
  ids.
- Changing source filename, invocation line or column, comments or formatting.
- Renaming an entry title or folder title, or moving the containing entry;
  moving between entry scopes can keep the digest but changes the scoped
  reference.
- Changing viewport or scheme, or rendering under a sibling variant entry;
  each context has its own record.
- Rendering unchanged slot content again, or changing physical wrappers,
  region ids, or placement count.
- Replacing the registered component while keeping an explicit local id;
  `componentId` is recorded separately and Changes can still be material.

Duplicate local ids in the same input scope and placement are build errors.
Repeated placement comes only from slot content that a component renders more
than once with the same logical inputs. Never repair collisions with
positional suffixes: that would break stability under reordering.

## Record-Only Resolution

The viewer package exports this pure function over validated usage record
types:

```ts
type InstanceResolution = "present" | "moved" | "missing";

function resolveInstance(
  previous: ComponentInstanceRecord,
  current: ComponentInstanceRecord | undefined,
): InstanceResolution {
  if (!current || previous.key !== current.key) return "missing";
  return previous.propsKey === current.propsKey &&
    previous.order === current.order &&
    (previous.slotKey ?? null) === (current.slotKey ?? null)
    ? "present"
    : "moved";
}
```

First find `current` by `previous.key` in the **same scoped view**. Absence,
including a supplied record with a different key, is `missing`. There is no
fallback match by component, local id, source line, text or DOM proximity.
Within valid equal-key records the owner, local id and slot are already
constrained by key validation; the explicit slot equality documents the input
placement rule. `order` is the recorded zero-based encounter order in that
input scope, not the index in the key-sorted `instances` array.

Only `key`, `propsKey`, `order`, and normalized `slotKey` are compared. Neither
raw `props`, `componentId`, `source`, nor any comparison result is consulted.
Props equality relies on the validated `propsKey`. `moved` means a kept key
whose recorded inputs or order changed; it is not a claim about pixels.
`present` does not assert identical rendering or identical component
definitions.

`ComponentInstanceRecord` contains no region placement fields. Comparing
region ids, region parents, boxes, or placement counts requires separate view
inputs and is deliberately outside this function. A physical move alone
therefore resolves `present`. Resolution never classifies Changes: the
[comparison contract](./mokly-comparison.md) and
[component attribution](./mokly-component-changes.md) are authoritative.
Callers validate records before resolution; a malformed hash is a validation
error, not a fourth resolution state.

## Optional Invocation Source

An instance record may carry its invocation site:

```ts
interface ComponentSourceLocation {
  path: string;
  line: number;
  column: number;
}
interface ComponentInstanceRecord {
  // The required instance fields keep their usage record definitions.
  source?: ComponentSourceLocation;
}
```

`path` is a nonempty repository-relative POSIX path to the invocation site,
not the component definition. `line` and `column` are positive safe integers,
both 1-based. No absolute path, drive prefix, URL, backslash, NUL, empty or
dot segment, or `..` escape is permitted. A location is confined to `repoRoot`
and serialized as the normalized relative path only; an escaping location
fails validation, and an unavailable location is omitted, never guessed from
definition attribution or stack traces.

The sidecar supplies the location for a `defineComponent` wrapper through the
JSX development shim of its [bundling rules](./mokly-sidecar.md#bundling). The
shim forwards to the consumer's `react/jsx-runtime`, preserves child semantics
and the single React runtime, and attaches the invocation `__source` only to wrappers that
`defineComponent` identified, through the reserved `__moklySource` prop. The
wrapper strips `__moklySource` before prop and slot validation, hashing, and
the consumer render, exactly as it strips `moklyInstance`. The name is
reserved from authored props and slots, and no development runtime or
attribute reaches the fragment. Programmatic `createElement` calls and
transformed modules without invocation information omit `source`.

`source` is excluded from instance and slot keys, `propsKey`, direct-input
comparison, and every Changes projection. Line shifts and source moves alone
are not material. The entry detail may carry the location as secondary
metadata; it does not authorize serving the source file.

## Ownership Regions

Every rendered instance is an ownership region of the composed tree under the
[comparison contract](./mokly-comparison.md#markers): a sequence of sibling
nodes with one parent, carrying the component path, the instance key, and the
props digest. The core attaches the region itself for a component element it
renders in Rust and for the root of a component page, which has id `r-0` and
no marker. For a sidecar render, the fragment carries each instance as a
`mokly-instance` comment pair and each supplied slot as a `mokly-slot` pair;
the core reads them into regions when it grafts the fragment and writes the
same pairs around every composed region, HTML components included. Served and
built documents keep those markers, so the inspector resolves each region in
the live page. Region ids `r-n` are allocated in
document order and recorded in the view's usage with each region's parent.

Every instance of a view has at least one region. Slot content that a
component renders more than once has one region per placement, each with its
own id and the same key. A null render has an empty region and no invented
box. An unrendered branch has no record, and an unrendered supplied slot has a
slot record without a region. Region ids, parents, and placement counts are
inspection coordinates, not identity.

The core fails the view as `build-invalid`, naming the entry, on an unknown,
forged, unmatched, duplicate, crossing, or reordered marker in a fragment and
on a region whose parent is wrong. Consumer output cannot author a marker: the
`mokly-` comment prefix is reserved, and a marker inside raw text is text
under the comparison contract. A comment with any other spelling is ordinary
content and creates no region.

## Inspection

The viewer addresses an instance only through `InstanceRef` and the view's
usage. The [frame adapter contract](./mokly-frame-adapter.md) owns geometry,
highlighting, and picking over the mounted document, and the
[viewer markers contract](./mokly-viewer-markers.md) positions host content on
an instance's boxes. Geometry is an inspection coordinate, never identity, and
a missing logical instance and unavailable geometry are separate states.

## Related Docs

- [Tree comparison and Changes](./mokly-comparison.md)
- [Component usage records](./mokly-component-usage-records.md)
- [Registered components](./mokly-components.md)
- [HTML components](./mokly-html-components.md)
- [Render sidecar](./mokly-sidecar.md)
- [Frame adapter](./mokly-frame-adapter.md)
