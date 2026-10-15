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
