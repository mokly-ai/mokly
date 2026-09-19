---
title: "Components"
description: "Give a shared component its own page, typed props and saved variants."
section: "authoring"
order: 3
---

## Register a component

`defineComponent` returns the component to render and the entry to export.
Data belongs in `propSchema`; React content belongs in declared `slots`.

```tsx
import { defineComponent } from "@mokly/mokly";

export const action = defineComponent({
  id: "action",
  title: "Action",
  description: "A shared action.",
  route: "components/action.html",
  dependencies: [],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  controls: { label: { kind: "text", label: "Label", maxLength: 80 } },
  render: (props) => <button>{props.label}</button>,
  variants: [{ id: "default", title: "Default", props: { label: "Continue" } }],
});

export const mockups = [action.entry];
```

Render it in a screen with `action.Component`, and give repeated siblings
distinct `moklyInstance` values so their identity survives an edit.

## Keep the registration beside the component

A registration can live next to the component it describes. With an
`entries` glob such as `src/**/*.mockup.{ts,tsx}`, a `src/components/button`
folder holds the product component, its registration, and the entry module
that exports it, and Mokly records the registration file as the component's
source.

```tsx
// src/components/button/button.mokly.tsx
import { defineComponent } from "@mokly/mokly";

import { Button } from "./button.js";

export const button = defineComponent({
  id: "button",
  title: "Button",
  description: "The product button.",
  route: "components/button.html",
  dependencies: ["src/components/button/button.tsx"],
  ownedDependencies: ["src/components/button/button.tsx"],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  render: (props) => <Button>{props.label}</Button>,
  variants: [{ id: "default", title: "Default", props: { label: "Save" } }],
});
```

```tsx
// src/components/button/button.mockup.tsx
import { button } from "./button.mokly.js";

export const mockups = [button.entry];
```

Screens anywhere in the repository import `button` from the registration and
render `button.Component`; an edit to `button.tsx` is then attributed to the
component, with those screens listed as affected.

## Saved variants

Variants are explicit named examples, never inferred. Every variant is built
for both viewports and every configured scheme. A link to the component id
opens its default variant; a canonical page URL selects one with
`?variant=default`.

## Controls

`controls` declares what can be edited while serving locally: `text`,
`boolean`, `number` and primitive `select` presets. Complex props stay
inspectable but are not edited. Reset restores the saved variant, and a
published catalogue keeps the variants and inspection with controls read only.

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

`ownedDependencies` names material outside the component's own body that
belongs to it. A renderer may also return exact style and resource ownership,
so a change to a component's implementation is attributed to the component and
its consumers are listed as affected.

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

| Type                                                            | Use                                     |
| --------------------------------------------------------------- | --------------------------------------- |
| `ComponentInput`, `ComponentDefinition`                         | What `defineComponent` takes and stores |
| `RegisteredComponent`                                           | The returned `Component` and `entry`    |
| `ComponentProps`, `ComponentRenderContext`                      | What `render` receives                  |
| `ComponentVariant`                                              | One saved example                       |
| `ComponentControl`, `ComponentControlLabel`, `ControlFor`       | The editable controls                   |
| `ObjectPropSchema`, `DataPropSchema`, `DataPropField`           | The schema of a component's data        |
| `InferProp`, `ComponentPropsData`, `PropValue`, `PropPrimitive` | The values a schema allows              |
| `ComponentStyleOwnership`, `ComponentResourceOwnership`         | Exact ownership a renderer may report   |
| `ComponentInstanceRecord`, `ComponentSourceLocation`            | Saved instance identity and source      |
| `InstanceResolution`                                            | The result of `resolveInstance`         |
