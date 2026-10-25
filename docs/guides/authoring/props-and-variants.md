---
title: "Props and variants"
description: "Validate entry data and save named states without a second render body."
section: "authoring"
order: 11
---

## Give an entry data

Screens and components render over `props`. Their own view uses the saved
props. Each variant uses those props with its top-level overrides.

```yaml
props:
  status: paid
  customer: { name: Ada, plan: pro }
variants:
  - slug: overdue
    title: Overdue invoice
    props:
      status: overdue
      customer: { name: Ada, plan: free }
```

An object override replaces the whole object. It does not merge nested keys.
The variant shares the parent's render body. Use a separate file for a state
that needs a different tree. A variant cannot declare variants of its own.

## Declare a closed schema

Components require `propSchema`. Screens can declare it or let Mokly infer
it from their own props and every variant's merged props.

```yaml
propSchema:
  type: object
  additionalProperties: false
  required: [label, status]
  properties:
    label: { type: string, minLength: 1, maxLength: 80 }
    status: { enum: [paid, overdue] }
    count: { type: integer, minimum: 0 }
    visible: { type: boolean }
```

Every object schema has `additionalProperties: false`. `required` names its
required keys. Other declared keys are optional. There are no defaults.
Unknown keys fail validation. Null is a value; it does not mean absent.

The schema uses a restricted JSON Schema 2020-12 form. It accepts primitive
types, closed objects, arrays, primitive choices with `enum`, `const`, or
`oneOf` constant members, and unions with `type` lists or `anyOf`. String,
number, and array bounds can narrow those values. References, executable
checks, and `default` are outside this form.

## Substitute values

`{{label}}` inserts an escaped scalar. `{{customer.name}}` reads a nested
scalar. An absent optional value inserts empty text. In an attribute whose
whole value is one reference, absence removes the attribute. A boolean true
keeps such an attribute; false removes it.

`mokly-if="$visible"` requires a declared prop whose type is exactly
`boolean`. An absent or false value removes that element. A reference to an
undeclared prop, or substitution of an entire object or array, is an error.
An unclosed `{{` stays ordinary text.

## Pass component attributes

Literal attributes are coerced through the receiving component's schema.
A value exactly equal to `$name` passes the original typed value. An absent
optional reference omits that prop. Write `$$name` for a literal `$name`.
A `type` list or `anyOf` tries its members in declaration order.

## Name saved states

A variant declares `slug`, `title`, and `props`. Its path is the parent's
path plus its slug. It has its own views and comparison. Its description,
tags, related docs, and color schemes inherit from its parent where those
fields apply. A declared list replaces the inherited list.

A screen variant's `useCasePaths` starts empty. List each flow that names
that variant. A component variant can supply HTML fragments for declared
slots. The component's own page supplies no saved slot content.

Viewport and color scheme remain view axes. They do not create variants.
