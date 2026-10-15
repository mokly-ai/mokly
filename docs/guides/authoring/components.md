---
title: "Components"
description: "Register a product component with typed data props, slots, and saved states."
section: "authoring"
order: 3
---

## Register a component

`defineComponent` returns one definition with a typed `Component` wrapper.
Export that definition from an entry module to register it.

```tsx
// specs/components/action.mockup.tsx
import { defineComponent } from "@mokly/mokly";

export const action = defineComponent({
  element: "app-action",
  title: "Action",
  description: "The primary action.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: {
      label: { type: "string", maxLength: 80 },
      disabled: { type: "boolean" },
    },
  } as const,
  props: { label: "Continue" },
  slots: ["children"],
  render: (props, context) => (
    <button disabled={props.disabled} data-viewport={context.viewport}>
      {props.label}
      {props.children}
    </button>
  ),
  variants: [
    { slug: "disabled", title: "Disabled", props: { disabled: true } },
  ],
});
```

The parent page renders `props`. The saved state renders those props with
`disabled: true`. Under the default root, their paths are `components/action`
and `components/action/disabled`. A link to the parent opens its own props.

## Use the wrapper

Import the definition into a React screen and render its `Component`.

```tsx
import { action } from "./components/action.mockup.js";

<action.Component label="Save" moklyInstance="save-action">
  <span>Save your changes</span>
</action.Component>;
```

`moklyInstance` names this use. It defaults to the last segment of the
component's resolved path. Give repeated siblings distinct lowercase kebab-case
names. The wrapper removes this prop before it calls your adapter.
Imports alone do not record usage. Only a rendered wrapper records an instance.

The optional `element` enables the same adapter in HTML bodies, such as
`<app-action label="Save"></app-action>`. It must be a unique lowercase custom
element name with a hyphen. Names that start with `mokly-` are reserved.

## Keep data separate from slots

A component requires `propSchema`. TypeScript uses `json-schema-to-ts` to
derive the types of `render`, `props`, variants, and the wrapper from the
literal schema. `required` selects required fields. Arrays reach the adapter
as readonly arrays. The context is `{ viewport, colorScheme }`.

The schema supports JSON types, closed objects, arrays, primitive `enum` and
`const` values, `oneOf` of constants, `anyOf`, and the documented bounds.
Every object includes `additionalProperties: false`.
It has no defaults, coercion, executable rules, or external references.

Props contain plain JSON data. Functions, React elements, class instances,
cycles, array holes, and non-finite numbers are invalid data props.
Expose callbacks and icons as string preset keys. Resolve those keys in the
adapter. Every supplied data prop contributes to comparison, including props
without a visible control.

`slots` declares optional React-node props. Declare `children` to accept
children. Slot names and schema data keys must be disjoint. Neither can use
`key`, `ref`, `moklyInstance`, or `__moklySource`.
A slot keeps the ownership of the code that supplied it, including when a
component forwards it. It is never serialized as a data prop.

The adapter receives a fresh copy. Its edits cannot change saved props or a
later render.

## Saved states and controls

Each variant declares `slug`, `title`, and a partial `props` map.
Keys replace the parent's top-level keys. Optional fields are `description`,
`tags`, `movedFrom`, and `slots`. The slots map supplies React content for that
state's page. A variant cannot declare a path or another variant.

Mokly derives text, boolean, number, and select controls from the schema.
Use `controls` to replace that set. Each control names a declared data prop.
The schema remains the validator. A published catalogue keeps saved states and
inspection; live editing belongs to Serve.

## Put registrations beside product code

A root such as `{ "dir": "packages/ui/src", "path": "components" }` gives
co-located registrations a `components` prefix. An `index.mockup.tsx` file can
re-export a definition from a helper beside the component. The exporting entry
module determines its catalogue path. The helper's module remains its source
attribution.

A definition exported twice in one module registers once. A definition exported
from two entry modules is an error. A spread copy cannot copy its identity.

## Component styles

Import CSS from the component or declare `stylesheets` for public CSS.
The core adds the relevant links. A renderer supplies product providers and
can declare non-CSS resources. Rendered output, matching CSS rules, and used
resources determine comparison changes.
See [styles](/docs/authoring/styles/).

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
