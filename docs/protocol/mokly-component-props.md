# Component Prop Schema

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Schema

`defineComponent` requires a `propSchema` that describes every data prop,
including props without a control. It is a JSON Schema 2020-12 object schema
under the [prop schema profile](./mokly-entry-props.md#prop-schema-profile)
of the entry props contract, which owns the accepted keywords and their
rules. A component's schema is never inferred from saved values,
render-function parameter annotations, or controls; a `defineComponent`
input without `propSchema` fails `component-schema` under the
[component diagnostics](./mokly-components.md#diagnostics).

```ts
const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "tone"],
  properties: {
    label: { type: "string", minLength: 1 },
    tone: {
      oneOf: [
        { const: "primary", title: "Primary" },
        { const: "secondary", title: "Secondary" },
      ],
    },
    count: { type: "integer", minimum: 0 },
    badge: {
      type: "object",
      additionalProperties: false,
      required: ["count"],
      properties: { count: { type: "integer" } },
    },
  },
} as const;
```

Every object schema is closed: undeclared keys fail rather than being
stripped. A prop absent from `required` is optional. A missing optional
property is omitted before rendering, encoding, and hashing; a missing
required property fails. There are no default values, coercions, transforms,
catch-all keys, or executable refinements. Null is a value that a `null`
type, a `const`, an `enum`, or an `anyOf` member must permit; it never means
missing. Any member of an `anyOf` that matches accepts the value unchanged,
so overlap never selects a transform.

Validation of a schema or of a complete props value is bounded to 64 nesting
levels and 10,000 visited nodes. A failure reports the component, the variant
slug when known, and an exact property or index path; it does not truncate or
skip data. The limits apply equally to typed callers, JavaScript callers, and
decoded read-model data.

## Plain Data

Props are plain JSON: strings, booleans, finite numbers, null, dense arrays,
and plain objects. An object has `Object.prototype` or null as its prototype
and enumerable own string data properties only. Accessors, symbols, cycles,
functions, bigint, non-finite numbers, class instances, React elements, array
holes, and undefined elements fail `component-props`. `__proto__`,
`constructor`, and `prototype` are rejected as property names at every
object level. Negative zero is preserved in prop values. All supplied data
props participate in material comparison, including props without a control
or without visible output; nothing is silently omitted.

## Authoring Types And Slots

TypeScript types are derived from the literal schema with `json-schema-to-ts`,
so the schema is written `as const`: `string`, `number`, `integer`,
`boolean`, and `null` map to their types, `enum`, `const`, and `oneOf` to
literal unions, `array` to readonly arrays, `object` to its declared required
and optional properties, and `anyOf` to a union of its members. `render`,
`props`, the `Component` wrapper, and `variants[].props` as a `Partial` share
that derived type. A consumer annotation must be compatible with it and
cannot replace it. Runtime validation applies even when TypeScript accepts a
call.

The separate `slots` list names optional React-node props. Data keys and slot
names must be disjoint, and neither may use `moklyInstance`, `key`, or `ref`.
Slots add optional React-node fields to the derived authoring type. Slot
values are validated as renderable nodes through the consumer React boundary;
they are never serialized as data, and no schema is inferred by evaluating a
slot. Slot ownership and rendered material follow the
[component contract](./mokly-components.md).

The adapter receives a validated, normalized copy of the data props plus the
ownership-wrapped slots. Its mutation of that copy cannot alter the recorded
props, saved variants, the schema, or a later render. Adapters map
schema-defined `enum`, `const`, or `string` preset values to consumer
callbacks or icons inside their own code.

Validation runs when the registry accepts a definition, on every saved
variant before any render starts, on every wrapper invocation before its
adapter runs, and on the fully merged props of a live control edit. Index and
detail readers decode and validate recorded props against the serialized
schema before trusting a props key or a usage record.

## Canonical Wire Props

Plain JSON numbers cannot preserve negative zero. The read model, the entry
detail, the comparison records, and the instance markers therefore carry
data values in the tagged representation below, compatible with the
`reviewMaterialKey` value encoding. The inspector decodes these values for
display rather than exposing tuple tags to users.

```ts
type ComponentWirePrimitive =
  | readonly ["null"]
  | readonly ["boolean", boolean]
  | readonly ["number", string]
  | readonly ["string", string];

type ComponentWireValue =
  | ComponentWirePrimitive
  | readonly ["array", readonly ComponentWireValue[]]
  | readonly ["object", readonly (readonly [string, ComponentWireValue])[]];

type ComponentWireProps = Readonly<Record<string, ComponentWireValue>>;
```

Number strings are exactly the shortest round-trip decimal form, as
JavaScript's `String(value)` produces, except negative zero is `"-0"`.
Decoding must produce a finite value and re-encode to the identical string;
alternate spellings, NaN, and infinity fail. Array order is retained. Object
entries and top-level props keys are sorted by UTF-16 code unit order, so
integer-looking keys such as `"2"` and `"10"` sort lexically; duplicate tuple
keys fail. Missing optional properties are absent. Empty objects and arrays
stay explicit. All user object keys are data and are subject to the closed
schema and reserved-key rules.

`propsKey` is the lowercase 64-hex SHA-256 returned by
`reviewMaterialKey(normalizedDataProps)`; it is the `props` digest of the
instance marker in the [comparison contract](./mokly-comparison.md#markers)
and one part of the fragment cache key. Readers recompute it from decoded,
validated props and reject mismatches. Encoding then decoding preserves every
allowed value, including negative zero and nested optional properties. A
schema change is a component metadata change even when the resulting props
key is identical.

## Controls And Shared Validation

Controls derive from the schema under the
[entry props contract](./mokly-entry-props.md); a declared `controls` map
replaces the derived ones and selects the editable props. The
[controls contract](./mokly-component-controls.md) owns the control shapes.
A control supplies no independent prop type and no optional flag: text,
boolean, and number controls need a compatible non-null primitive schema, and
each select option must pass the property schema and hold a primitive value.
Optional properties expose their unset state automatically; setting null
still requires schema acceptance. Control constraints may narrow accepted
values but may not weaken the schema, and every saved variant must satisfy
both sets of constraints.

An optional declared prop may be missing from every saved props set because
its type comes from the schema. A control that names an undeclared prop or a
slot fails `component-controls`. Uneditable props receive the same complete
validation and hashing as controlled ones. A live edit is applied to a fresh
copy of the shown entry's props, then validated and encoded under this one
policy before the sidecar renders it. One validator serves the registry, the
saved variants, the live controls, and the readers.
