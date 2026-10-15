---
title: "Components"
description: "Give an HTML component a page, validated props, slots, and saved states."
section: "authoring"
order: 3
---

## Register an HTML component

Save a `.component.html` file inside a configured root. Declare its custom
element name and a closed prop schema in the front matter.

```html
---
element: ui-button
title: Button
propSchema:
  type: object
  additionalProperties: false
  required: [label]
  properties:
    label: { type: string, minLength: 1 }
    disabled: { type: boolean }
props: { label: Save, disabled: false }
slots: [children, trailing]
variants:
  - slug: disabled
    title: Disabled
    props: { disabled: true }
    slots: { trailing: "<small>Wait</small>" }
---

<button class="action" disabled="{{disabled}}">
  <span>{{label}}</span>
  <slot></slot>
  <slot name="trailing"><small>Ready</small></slot>
</button>
```

`element` is unique across HTML and JavaScript components. It starts with a
lowercase ASCII letter and contains a hyphen. The `mokly-` prefix belongs to
Mokly. A component's path comes from its file and root, as for a screen.
The component page shows its own props first, then its saved variants.

## Supply props

Use kebab-case attribute names. Mokly maps them to camelCase prop keys and
coerces each literal through its schema. A boolean accepts an empty value,
`true`, or `false`. A number accepts JSON number text. An enum accepts the
string form of one choice.

```html
<ui-button label="Continue" disabled="false"></ui-button>
<ui-button label="$actionLabel" mokly-instance="confirm"></ui-button>
```

A `$name` value passes a prop without changing its type. Objects and arrays
use this form. Missing optional props stay absent. Required props must be
supplied at each invocation; saved page props are examples, not defaults.

The component body reads only its own props. It uses the same substitutions,
`mokly-if`, and `mokly-viewport` rules as a screen. Read
[Props and variants](/docs/authoring/props-and-variants/) for the schema rules.

## Fill named slots

Declare `children` to accept ordinary child content. A direct child with
`slot="name"` supplies that named slot.

```html
<ui-button label="Save">
  <strong>Save changes</strong>
  <span slot="trailing">Ctrl S</span>
</ui-button>
```

A placeholder's children are its fallback content. Supplied content replaces
the placeholder. It keeps the supplier's props and ownership. A component
can render a supplied slot more than once. An undeclared slot is an error.

## Keep instance names stable

`mokly-instance` names one logical use. Its default is the last segment of
the component's path. Give repeated siblings different lowercase kebab-case
names. Keep those names when you reorder or restyle them. Duplicate local
names in one input scope fail the build.

Rendered instances establish usage. A supplied slot that a component never
renders does not create usage for components inside it. Empty component
output still records the component instance.

## Compose components

A component can use another registered element. A cycle is an error. Put
component elements inside `td`, `th`, or `caption` when you use raw tables.
A component directly inside a table can move under HTML parsing and produce
a warning.

`to` and `fragment` make a component's one supported root a catalogue link
control. They are reserved attributes and never become data props.
Read [Links](/docs/authoring/links/) for its placement rules.
