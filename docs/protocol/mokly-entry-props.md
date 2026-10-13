# Entry Props And Variants

## Delivery Status

Approved target of the [Rust rebuild plan](../../plans/rust-rebuild.md); not
implemented. The frozen TypeScript backend has two variant models under the
[variants contract](./mokly-variants.md): a component variant is a saved props
set, and a screen variant is a second screen with its own React trees. This
page replaces both with one model for every kind. The metadata inheritance,
slug, path, navigation, and Changes rules of the variants contract stay.

## One Model

Every screen and component is a render over props:

- A render: an HTML body, a React function of props, or a Storybook
  component.
- `propSchema`: a JSON Schema object under the
  [profile](#prop-schema-profile) below. It is required for a component and
  optional for a screen or a stories file, where
  [inference](#schema-inference) supplies it.
- `props`: the entry's own prop values. They default to the empty map and
  must satisfy the schema, so a component whose schema requires a prop
  declares `props`.
- `variants`: optional. Each declares `slug`, `title`, and `props` that
  replace top-level keys of the entry's props and never deep merge, plus the
  metadata overrides of the variants contract.
- Controls: derived from the schema. A text control for `string` with
  `maxLength`; a toggle for `boolean`; a number control for `number` and
  `integer` with `minimum`, `maximum`, and `multipleOf` as its bounds and
  step; a select for `enum` and for `oneOf` of `const` members, labelled by
  their `title`; every other shape is shown but not editable. `title` and
  `description` label a control. `defineComponent` may declare `controls` to
  replace the derived ones.

The entry's own view renders `props`. Each variant is an entry of the
parent's kind at the parent's path plus its slug, with `variantOf`, its own
views, its own Changes row, and its own comparison, and it renders the
parent's render with the merged props. A component needs no variant, and a
component page shows the entry's own props first, then each variant. Light and
dark and the viewports stay view axes, never variants.

## Prop Schema Profile

A prop schema is a JSON Schema 2020-12 object schema restricted to this
profile. A keyword outside it, or a keyword used outside its rule, fails with
the kind's schema diagnostic: `html-front-matter` for an HTML file, the
component diagnostics of the [components contract](./mokly-components.md)
for a JavaScript definition.

| Keyword                                                      | Rule                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `type`                                                       | `string`, `number`, `integer`, `boolean`, `null`, `object`, `array`, or a list of them; the root is `object`          |
| `properties`, `required`                                     | the declared props; every object is closed, so `additionalProperties` may only be `false` and an undeclared key fails |
| `enum`, `const`, `oneOf`                                     | JSON primitives; `oneOf` holds `const` members only, each with an optional `title`                                    |
| `items`, `minItems`, `maxItems`                              | arrays are dense; an absent `items` accepts any JSON value                                                            |
| `minLength`, `maxLength`, `minimum`, `maximum`, `multipleOf` | the string and number bounds                                                                                          |
| `anyOf`                                                      | a union; any matching member accepts the value unchanged                                                              |
| `title`, `description`, `$schema`                            | annotations; `$schema` may only name draft 2020-12                                                                    |

`default`, `$ref`, `$defs`, `if`, `allOf`, `not`, `pattern`, `format`,
`patternProperties`, `dependentSchemas`, and every other keyword are rejected,
so a schema is self-contained, declares no default, and coerces nothing. Props
are plain JSON: a function, a React element, a class instance, a non-finite
number, or a cycle is not a prop. The Rust core validates schemas and props
with one validator on the `jsonschema` crate. The viewer validates control
input with a validator for this profile that generates no code, so an
exported site needs no `unsafe-eval`. `json-schema-to-ts` derives the
TypeScript props type of `render(props)` from an `as const` schema.

## Schema Inference

When an entry declares no `propSchema`, the schema is inferred from the
entry's own props and every variant's props together, in the profile. Each
key seen in any set is a property, and a key present in every set is
`required`. A value's `type` comes from the value: `string`, `number`,
`boolean`, `null`, `object` with inferred properties and the same `required`
rule inside it, or `array` whose `items` is inferred from every element across
the sets. Kinds that differ across sets or across elements form a `type`
list, and an array that is empty in every set has no `items`. A function, a
React element, or any other non-data value is not a prop: it is excluded from
the schema, from the props, and from the fragment key, with the
`props-not-data` warning naming the entry and the key. A declared `propSchema`
is the schema, and props it rejects fail.

## Kinds

| Kind                   | Render                                                                                                                                           | Props                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React screen           | `render(props)`, or `mobile(props)` and `desktop(props)`, in `defineScreen`                                                                      | `propSchema`, `props`, `variants`, and `controls` in the input                                                                                                                  |
| React component        | `render(props)` in `defineComponent`                                                                                                             | as today, plus optional `props` and optional `variants`                                                                                                                         |
| HTML screen            | the body, with `$name` attribute references, `{{name}}` substitution, and `mokly-if`, under the [HTML screens contract](./mokly-html-screens.md) | front matter `propSchema`, `props`, and `variants`                                                                                                                              |
| HTML component         | the body, with `{{name}}` substitution and slots, under the [HTML components contract](./mokly-html-components.md)                               | front matter `propSchema`, `props`, and `variants`                                                                                                                              |
| Storybook stories file | the meta's component, through the [render sidecar](./mokly-sidecar.md#storybook)                                                                 | the meta's `args` are the props, `argTypes` declare the part of the schema they cover, and each story is a variant whose slug is its export name and whose props are its `args` |

A `defineScreen` input with `mobile` and `desktop` React nodes is a render
that ignores its props, so a screen without `props` and without `variants`
changes nothing. A React screen variant has no `mobile` or `desktop` of its
own; a state such as empty, error, or loading is a conditional inside the
render. An HTML screen variant shares the body; it changes what the body shows
through `$name` references, `{{name}}` substitution, and `mokly-if`, and a
variant that needs another tree is a separate file.

## Titles And Defaults

A variant's `title` is its own. A story variant's title is its `name`
annotation or its export name. A stories file entry is titled from the last
segment of the meta `title`, else from the component's display name, else
from its derived slug. A variant's description, tags, related docs, colour schemes, and declared
slots default to the parent's; its supplied slots default to empty.

## Validation

- The entry's props and every variant's merged props must satisfy the
  schema; a variant's own map may omit keys the entry's props supply. For HTML
  kinds a rejected value fails with `html-attribute` naming the variant slug,
  when any, and the property path; for React kinds the component diagnostics of the
  [components contract](./mokly-components.md) apply; for a stories file the
  story is named.
- A slug outside the segment grammar, two variants with one slug, a nested
  `variants`, and an unknown key keep the diagnostics of the variants
  contract.
- In a screen body, a `mokly-if`, `$name`, or `{{name}}` reference to a prop
  that the schema does not declare fails with `html-props`, as does a
  `mokly-if` reference to a prop whose kind is not `boolean`; a component
  body keeps its own rules. An absent optional prop removes a
  `mokly-if` element and omits a `$name` attribute.

## Read Model

Read model v7 gives every screen and component the same prop fields in the
[public catalogue read model](./mokly-catalogue.md): `propSchema`, `props`,
which holds the entry's own props or a variant's merged props, and
`controls`. A component parent has its own `views`, rendered from its own
props, and an empty `suppliedSlots`; `variantOf` is present exactly on the
variants of either kind. The catalogue page's block is the one shape until
the generated TypeScript types of the model crate replace it.

## Related Docs

- [Variants](./mokly-variants.md)
- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [HTML components](./mokly-html-components.md)
- [Registered components](./mokly-components.md)
- [Component prop schema of the frozen backend](./mokly-component-props.md)
- [Render sidecar](./mokly-sidecar.md)
- [Public catalogue read model](./mokly-catalogue.md)
