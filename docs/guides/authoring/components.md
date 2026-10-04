---
title: "Components"
description: "Give a shared component its own page, typed props and variants."
section: "authoring"
order: 3
---

## Register a component

`defineComponent` returns the component to render and the parent-plus-variant
entries to export.
Data belongs in `propSchema`; React content belongs in declared `slots`.

```tsx
import { defineComponent } from "@mokly/mokly";

export const action = defineComponent({
  id: "action",
  title: "Action",
  description: "A shared action.",
  stylesheets: ["components/action.css"],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  controls: { label: { kind: "text", label: "Label", maxLength: 80 } },
  render: (props) => <button>{props.label}</button>,
  variants: [
    { id: "action-default", title: "Default", props: { label: "Continue" } },
  ],
});

export const mockups = [...action.entries];
```

Render it in a screen with `action.Component`, and give repeated siblings
distinct `moklyInstance` values so their identity survives an edit.

## Keep the registration beside the component

A registration can live next to the component it describes. With an
`entries` glob such as `src/**/*.mockup.{ts,tsx}`, a `src/components/button`
folder holds the product component, its registration, and the entry module
that exports it, and Mokly records the registration file as the component's
source. That example glob selects the recommended `.mockup.tsx` convention;
the configured glob itself, not a built-in suffix rule, decides which files
are entry modules.

```tsx
// src/components/button/button.mokly.tsx
import { defineComponent } from "@mokly/mokly";

import { Button } from "./button.js";

export const button = defineComponent({
  id: "button",
  title: "Button",
  description: "The product button.",
  stylesheets: ["components/button.css"],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  render: (props) => <Button>{props.label}</Button>,
  variants: [
    { id: "button-default", title: "Default", props: { label: "Save" } },
  ],
});
```

```tsx
// src/components/button/button.mockup.tsx
import { button } from "./button.mokly.js";

export const mockups = [...button.entries];
```

Screens anywhere in the repository import `button` from the registration and
render `button.Component`. A source edit that changes rendered output is
attributed through the actual render; a source-only edit that leaves output
unchanged is not evidence. See the Changes guide for how stylesheet changes
affect components and screens.

## Variants

Variants are explicit named examples, never inferred. Each variant is its own
catalogue entry with a global kebab-case id such as `action-disabled`: it is
grouped beneath the component in navigation, has its own page at
`components/<id>.html`, its own Changes row, and can be the target of a link.
Every variant is built for both viewports and every configured scheme. A link
to the component id opens its first variant; a link to a variant id opens that
variant.

## Controls

`controls` declares what can be edited while serving locally: `text`,
`boolean`, `number` and primitive `select` presets. Complex props stay
inspectable but are not edited. Reset restores the variant's declared props,
and a published catalogue keeps the variants and inspection with controls read
only.

## Prop schemas

A schema is declarative and validates the actual values, and TypeScript infers
the props from it. The kinds are `string`, `number`, `boolean`, `null`,
`enum`, `array`, `object` and `union`, each with the bounds it supports.

```ts
propSchema: {
  kind: "object",
  properties: {
    label: { schema: { kind: "string", maxLength: 80 } },
    tone: { schema: { kind: "enum", values: ["neutral", "danger"] } },
    count: { schema: { kind: "number", integer: true }, optional: true },
  },
}
```

## Ownership

`stylesheets` names existing public CSS files relative to `mockupsDir`, in
authored order. Mokly links them only where the component actually renders,
including an empty render, and records the links it inserts. HTTP(S),
missing or non-public CSS paths fail validation. A repeated file or alias is
linked once with a warning. Two components may share a file. Changed rules
are checked against component output on the component's own saved pages.
A component keeps only matches outside a different nested component that has
its own-page matches for the same rule. Self-nesting does not remove matches.
Imports follow the same rule. Screen-only styles inside a component invocation
change the screen, not every use of that component. A renderer may return
exact document style ranges or non-CSS resource ownership. A resource owner
record for any stylesheet is ignored with a warning. Put
`componentStylesheets` in a configured rule's shared list to choose where
declared CSS is linked.

## Resolve a saved instance

Use `resolveInstance` to compare one validated instance record with the record
that has the same key in another version of the same view.

```ts
import { resolveInstance } from "@mokly/mokly";
import type { ComponentInstanceRecord, InstanceResolution } from "@mokly/mokly";

const result: InstanceResolution = resolveInstance(previous, current);
```

The result is `present` when the saved inputs and order still match, `moved`
when the key remains but those recorded inputs changed, and `missing` when no
equal-key record exists. The helper compares records only; it does not load a
catalogue, inspect rendered markup or classify a visual change.

## Exported types

| Type                                                                                              | Use                                     |
| ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `ComponentInput`, `ComponentDefinition`, `ComponentVariantDefinition`, `ComponentEntryDefinition` | What `defineComponent` takes and stores |
| `RegisteredComponent`                                                                             | The returned `Component` and `entries`  |
| `ComponentProps`, `ComponentRenderContext`                                                        | What `render` receives                  |
| `ComponentVariant`                                                                                | One variant declaration                 |
| `ComponentControl`, `ComponentControlLabel`, `ControlFor`                                         | The editable controls                   |
| `ObjectPropSchema`, `DataPropSchema`, `DataPropField`                                             | The schema of a component's data        |
| `InferProp`, `ComponentPropsData`, `PropValue`, `PropPrimitive`                                   | The values a schema allows              |
| `ComponentStyleOwnership`, `ComponentResourceOwnership`                                           | Exact ownership a renderer may report   |
| `ComponentInstanceRecord`, `ComponentSourceLocation`                                              | Saved instance identity and source      |
| `InstanceResolution`                                                                              | The result of `resolveInstance`         |
