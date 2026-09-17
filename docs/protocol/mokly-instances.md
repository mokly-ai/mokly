# Component Instance Identity

## Delivery Status

Implemented through [viewer library Milestone 2](../../plans/mokly-viewer-library.md),
including resolution and source capture. The key derivation and rendered boundaries
retain their existing format. No new UI,
changed key format, or visible local behavior is approved by this document.

## Identity And Scope

An instance is one logical invocation of a `defineComponent` wrapper. Its
`ComponentInstanceRecord` belongs to one screen or component variant's
`ComponentViewRecord`; see the [manifest schema](./mokly-component-manifest.md).
The component root of its own saved variant is the entry owner, not a used
instance. Replaying captured slot content can place one instance more than once.

The exact algorithm in [`keys.ts`](../../packages/viewer/src/components/keys.ts) is:

```ts
const preimage = [
  "mokabook-instance-v1",
  owner.kind,
  owner.kind === "instance" ? owner.instanceKey : null,
  slotKey ?? null,
  id,
];
const key = createHash("sha256").update(JSON.stringify(preimage)).digest("hex");
```

Hash UTF-8 bytes with no trailing newline, salt, whitespace, or path prefix.
The result is exactly 64 lowercase hexadecimal characters. The historical
`mokabook-instance-v1` domain string is frozen, including its spelling.
`id` is the validated local `moklyInstance` value, defaulting to the registered
component id when omitted. `owner` is `{ kind: "entry" }` or
`{ kind: "instance", instanceKey }`. The separate receiving-slot key is the
same digest operation over `["mokabook-slot-v1", instanceKey, name]`.

The containing entry id, variant id, viewport, color scheme, `componentId`,
props, and source location are **not** in the instance preimage. In particular,
moving an entry-owned invocation to another screen can retain the same digest.
Keys are unique within a view, not globally across a catalogue. A stored
reference must include its catalogue identity, entry id, optional variant id,
viewport, color scheme, and key. Moving to another entry changes that reference
even if the digest is identical. Do not search other entries for a missing key.

`slotKey` denotes the original input slot scope. Forwarding a slot preserves
that scope; it does not replace it with each later physical receiving slot.
The input owner and physical range parent can differ.

## Stability Rule

A digest changes if and only if its serialized preimage changes, subject to the
usual SHA-256 collision assumption. Edits that change it are:

- Changing the effective `moklyInstance` id, including changing the component
  id when the invocation uses that id as its default.
- Changing input ownership between entry and instance, or moving the invocation
  to a parent with a different instance key.
- Changing the original receiving slot key, including entering/leaving a slot,
  renaming its declared slot, or changing its receiving instance's key.
- Changing an ancestor input key when that change propagates into this
  instance's owner key or slot key.

Edits that keep it, provided those inputs stay the same, are:

- Editing data props, slot content, component implementation, styles or assets.
- Reordering siblings, or inserting/removing other siblings with distinct ids.
- Changing source filename, invocation line/column, comments or formatting.
- Renaming an entry title, route, collection, or containing entry id; moving
  between entry scopes can retain the digest but changes the scoped reference.
- Changing viewport/scheme or variant context; each context has its own record.
- Moving, forwarding, or replaying an unchanged captured slot in the rendered
  DOM, or changing physical wrappers, range ids, or placement count.
- Replacing the registered component while retaining an explicit local id;
  `componentId` remains recorded separately and Changes can still be material.

Duplicate local ids in the same input scope and placement are build errors.
Repeated placement is allowed only for deterministic captured-slot replay;
it must retain the same logical inputs. Never repair collisions with positional
suffixes: that would break stability under reordering.

## Record-Only Resolution

The viewer exports this pure function using validated manifest record types:

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
raw `props`, `componentId`, `source`, nor any external baseline is consulted.
Props equality relies on the manifest's validated `propsKey`. `moved` means a
retained key whose recorded inputs/order changed; it is not a claim about pixels.
`present` does not assert identical rendering or identical component definitions.

`ComponentInstanceRecord` contains no range placement fields. Comparing
`ComponentRangeRecord.id`, `parentId`, DOM offsets, boxes, or placement counts
requires separate view/DOM inputs and is deliberately outside this function.
A physical move alone therefore resolves `present`. Resolution never classifies
Changes: [component attribution](./mokly-component-changes.md) remains authoritative.
Callers validate records before resolution; malformed hashes are validation
errors, not a fourth resolution state.

## Optional Invocation Source

Manifest v5 includes this optional instance field:

```ts
interface ComponentSourceLocation {
  path: string;
  line: number;
  column: number;
}
interface ComponentInstanceRecord {
  // Existing required instance fields retain their manifest definitions.
  source?: ComponentSourceLocation;
}
```

`path` is a nonempty repository-relative POSIX path to the invocation site,
not the component definition. `line` and `column` are positive safe integers,
both 1-based. No absolute path, drive prefix, URL, backslash, NUL, empty/dot
segment, or `..` escape is permitted. Resolve bundler paths against its working
directory, confine to `repoRoot`, and serialize only the normalized relative
path. Invalid or escaping supplied locations fail validation; unavailable
locations are omitted, never guessed from definition attribution or stack traces.

The approved build proposal sets esbuild `jsxDev: true` beside
`jsx: "automatic"` in [`load_graph.ts`](../../src/build/load_graph.ts).
Its consumer React plugin, implemented in `consumer_resolution.ts`, resolves
`react/jsx-dev-runtime` to a Mokly-owned shim within the same consumer graph.
The shim exports `Fragment` and `jsxDEV`; it forwards to that consumer's
`react/jsx-runtime` (`jsx`/`jsxs` with the supplied React key), preserving child
semantics and a single React runtime. It uses esbuild's invocation `__source`
argument only for wrappers identified by `defineComponent`, attaching normalized
metadata via a reserved `__moklySource` prop. Ordinary components and intrinsic
elements receive no added source prop; no development runtime enters HTML.

The wrapper strips `__moklySource` before prop/slot validation, hashing and
calling the consumer render function, just as it strips `moklyInstance`.
The name is reserved from authored data props and slots. Capture it in the
collector only; do not emit DOM attributes, source maps, or debug markup.
Programmatic `createElement` calls and already-transformed modules without
invocation information may omit `source`. Replayed slots retain the original
invocation location. Existing v5 records without `source` remain valid; updated
readers accept both forms without a schema-version bump.

`source` is excluded from instance/slot keys, `propsKey`, direct-input comparison,
and every Changes projection. Line shifts and source moves alone are not material.
The public catalogue may retain this validated location as secondary metadata;
it does not authorize serving the source file. No new source display is added
to the local shell by this work.

## Rendered Boundaries

The Mokly wrapper authors these exact inert React sentinels:

```html
<template data-mokly-component-start="b-0"></template>
<!-- rendered component or slot content -->
<template data-mokly-component-end="b-0"></template>
```

`b-n` is allocated per collector boundary, starting at zero. Both attributes
are package-reserved; consumers and transformers cannot author or forge them.
[`ranges.ts`](../../src/components/ranges.ts) authenticates each token against
the collector, requires the exact empty template shape with one attribute,
and serializes it as:

```html
<!--mokly-component:start:r-0-->
<!-- rendered component or slot content -->
<!--mokly-component:end:r-0-->
```

`r-n` is allocated in DOM start-marker order, starting at zero. Range records
map it to an instance key or slot key; the comment does not contain that key.
`parentId` is the nearest enclosing registered range, including a slot range.

Every instance in a rendered view's manifest has at least one instance-targeted
range, and **exactly one matched start/end pair per recorded range in that same
rendered view**. A replayed instance can have multiple ranges and therefore
multiple pairs, each with its own `r-n`. Multi-root or text output has one pair
per placement; a null-rendering invocation has an empty pair and no invented
box. Uninvoked branches have no instance record; an unrendered supplied slot
can have a slot record without a range.

Reject unknown, forged, missing, duplicate, crossing, reordered, or mismatched
markers and incorrect range parentage. No template sentinel survives final
serialization. Review-ignore regions cannot enclose component or caller-slot
boundaries. Compatibility transforms must preserve validated pairs; adapters
inspect current views using these comments without adding layout wrappers.
Snapshot bytes and historical marker compatibility retain their existing rules.

## Acceptance

Milestone 2 needs key-stability fixtures, record-resolution truth-table tests,
source normalization/stripping and source-only Changes regressions, and marker
conformance for every view, including null, nested, multi-root and replayed
instances. Later viewer/adapter tests must preserve scoped lookup and treat
unavailable geometry separately from a missing logical instance.
