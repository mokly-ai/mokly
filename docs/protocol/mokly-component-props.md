# Component Prop Schema

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Normative Schema

`defineComponent` requires a `propSchema` describing every data prop, including
uncontrolled props. It is a declarative, serializable object schema. There is no
inference from saved values, render-function parameter annotations, or controls.
The following types define its complete shape; fields not listed are invalid.

```ts
type PropPrimitive = string | number | boolean | null;

type DataPropSchema =
  | { kind: "string"; minLength?: number; maxLength?: number }
  | { kind: "boolean" }
  | { kind: "number"; minimum?: number; maximum?: number; integer?: boolean }
  | { kind: "null" }
  | { kind: "enum"; values: readonly PropPrimitive[] }
  | {
      kind: "array";
      items: DataPropSchema;
      minItems?: number;
      maxItems?: number;
    }
  | ObjectPropSchema
  | { kind: "union"; anyOf: readonly DataPropSchema[] };

interface DataPropField {
  schema: DataPropSchema;
  optional?: boolean;
}

interface ObjectPropSchema {
  kind: "object";
  properties: Readonly<Record<string, DataPropField>>;
}
```

All object schemas are closed: undeclared keys fail rather than being stripped.
An omitted `optional` is false. Missing or explicitly undefined optional object
fields are omitted before rendering, encoding, and hashing; missing/undefined
required fields fail. There are no default values, coercions, transforms,
catch-all keys, or executable refinements. Null is a value and must be permitted
by a null/enum/union schema; it never means missing.

Numbers and numeric constraints are finite. Integer constraints use safe
integers. String lengths count UTF-16 code units; lengths/item counts are
nonnegative safe integers. Lower bounds cannot exceed upper bounds. Enum values
are nonempty and unique by primitive type and `Object.is`. Schema numeric
constraints and enum literals reject negative zero so their JSON representation
is lossless; ordinary number-valued props still preserve negative zero. A union
has at least two members; any matching member
accepts the unchanged value, so overlap does not pick a transform or coercion.

Arrays must be dense, with every element accepted by `items`; holes and
undefined elements fail. Objects must have `Object.prototype` or null as their
prototype and enumerable own string data properties only. Accessors, symbols,
cycles, functions, bigint, non-finite numbers, and class instances fail. Reject
`__proto__`, `constructor`, and `prototype` as field names at every object level.
Schema definitions themselves must be acyclic plain data with the listed types.

Schema/value validation is bounded to 64 nesting levels and 10,000 visited nodes
per schema or complete props value. Failure reports the component, variant/view
when known, and an exact property/index path; it does not truncate or skip data.
Limits apply equally to typed callers, JavaScript callers, and decoded artifacts.

## Authoring Types And Slots

TypeScript types are derived from the literal schema: primitives map to their
types, enums to literal unions, arrays to readonly arrays, objects to their
declared required/optional fields, and unions to unions of their members.
`render`, `variants[].props`, and the generated `Component` share that derived
type. A consumer annotation must be compatible with it and cannot replace it.
Runtime validation remains required even when TypeScript accepts a call.

The existing `slots` list separately names optional React-node props. Data keys
and slot names must be disjoint, and neither may use `moklyInstance`, `key`,
or `ref`. Slots add optional React-node fields to the derived authoring type.
Validate slot values as renderable nodes through the consumer React boundary;
never serialize them as data or infer a prop schema by evaluating a slot.
Slot ownership and rendered material follow the component attribution contract.

The adapter receives a validated, normalized copy of the data props plus the
ownership-wrapped slots. Its mutation of that copy cannot alter captured input
records, saved variants, the schema, or a later render. Adapters map schema-defined
enum/string preset values to consumer callbacks or icons inside their own code.

Validate the schema and controls when registering a definition, every saved
variant before Build starts writing, and every actual wrapper invocation before
running its adapter. Local controls validate the fully merged variant props
through this same validator. Manifest readers decode and validate recorded
props against the serialized schema before trusting material keys or usage.

## Canonical Data On Disk

Plain JSON numbers cannot preserve negative zero. Component artifacts therefore
store data values in the tagged representation below, compatible with the
existing `reviewMaterialKey` value encoding. The inspector decodes these values for
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

Number strings are exactly `String(value)`, except negative zero is `"-0"`.
Decoding must produce a finite value and re-encode to the identical string;
alternate spellings, NaN, and infinity fail. Array order is retained. Object
entries and top-level props keys are sorted by JavaScript's default string
ordering; duplicate tuple keys fail. Optional undefined object fields are absent.
Empty objects/arrays stay explicit. All user object keys remain data and are
subject to the closed schema and reserved-key rules.
Canonical object serialization must also order integer-looking keys lexically;
do not rely on JavaScript object insertion order for keys such as `"2"`/`"10"`.

`propsKey` is the lowercase 64-hex SHA-256 returned by
`reviewMaterialKey(normalizedDataProps)`, not a hash of arbitrary manifest JSON.
Readers recompute it from decoded, validated props and reject mismatches. Encoding
then decoding preserves every allowed value, including negative zero and nested
optional fields; no undefined array/null conversion is permitted. Schema changes
are component metadata changes even when the resulting props key is identical.

## Controls And Shared Validation

[Control declarations](./mokly-component-controls.md) select editable fields
from this schema; they do not supply an independent prop type or optional flag.
Text, boolean, and number controls require compatible non-null primitive schemas.
Select options must each pass the field schema and use primitive values. Optional
fields expose unset automatically; setting null still requires schema acceptance.
Control constraints may narrow accepted values but may not weaken the prop
schema, and every saved variant must satisfy both sets of constraints.

An optional declared prop may be missing from every saved variant because its
type comes from the schema. A control referencing an undeclared field or a slot
fails registration. Uneditable fields receive the same complete validation and
hashing as controlled ones. Local overrides are applied to a fresh variant copy,
then validated and encoded using this shared policy before rendering.

## Implementation Evidence

One implemented schema validator/codec serves authoring, manifest parsing,
material-key verification, and local controls. Accepted/rejected contract
fixtures cover required/optional fields,
all schema kinds, null/unions, nested arrays/objects, unknown/reserved keys,
negative zero, mutation isolation, cycles/accessors, and validation limits.
Codec round-trip, integer-looking key order, hash-agreement tests and negative
TypeScript cases cover wrappers, variants, adapters, and controls. These suites
run in the required verification gate.
