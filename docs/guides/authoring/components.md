---
title: "Components"
description: "Give a shared component its own page, typed props and variants."
section: "authoring"
order: 3
---

## Register a component

`defineComponent` returns the component to render and the parent-plus-variant
entries that join the catalogue when the object is exported.
Data belongs in `propSchema`; React content belongs in declared `slots`.

```tsx
import { defineComponent } from "@mokly/mokly";

export const action = defineComponent({
  title: "Action",
  description: "A shared action.",
  dependencies: [],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  controls: { label: { kind: "text", label: "Label", maxLength: 80 } },
  render: (props) => <button>{props.label}</button>,
  variants: [
    { slug: "default", title: "Default", props: { label: "Continue" } },
  ],
});
```

Render it in a screen with `action.Component`, and give repeated siblings
distinct `moklyInstance` values so their identity survives an edit; the
default value is the last segment of the component's path. The
`button/index.mockup.tsx` example therefore defaults to `button`.

## Keep the registration beside the component

A root over your component library puts every registration beside the code it
describes. With `roots: [{ dir: "packages/ui/src", path: "components" }]`,
a `packages/ui/src/button` directory holds the product component, its
registration, and the entry module that exports it, and Mokly records the
registration file as the component's source.

```tsx
// packages/ui/src/button/button.mokly.tsx
import { defineComponent } from "@mokly/mokly";

import { Button } from "./button.js";

export const button = defineComponent({
  title: "Button",
  description: "The product button.",
  dependencies: ["packages/ui/src/button/button.tsx"],
  ownedDependencies: ["packages/ui/src/button/button.tsx"],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  render: (props) => <Button>{props.label}</Button>,
  variants: [{ slug: "default", title: "Default", props: { label: "Save" } }],
});
```

```tsx
// packages/ui/src/button/index.mockup.tsx
export { button } from "./button.mokly.js";
```

The entry module is named `index.mockup.tsx`, so the component takes its
directory's path: `components/button`, with the variant at
`components/button/default`. Screens anywhere in the repository import
`button` from the registration and render `button.Component`; an edit to
`button.tsx` is then attributed to the component, with those screens listed as
affected. A component's path derives like every other entry's, so the
`components` prefix is a convention set by the root, not a rule, and a
component and a screen can never share one path.

## Variants

Variants are explicit named examples, never inferred. Each variant declares a
`slug` and is its own catalogue entry at the parent's path plus that slug: it
is grouped beneath the component in navigation, has its own page at
`/view/components/button/default/`, its own Changes row, and can be the
target of a link. Every variant is built for both viewports and every
configured scheme. A link to the component's path opens its first variant; a
link to a variant's path opens that variant. A variant inherits the parent's
color schemes, dependencies, related docs and tags, and copies the parent's
description unless it declares its own.

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
import type { ObjectPropSchema } from "@mokly/mokly";

export const propSchema = {
  kind: "object",
  properties: {
    label: { schema: { kind: "string", maxLength: 80 } },
    tone: { schema: { kind: "enum", values: ["neutral", "danger"] } },
    count: { schema: { kind: "number", integer: true }, optional: true },
  },
} satisfies ObjectPropSchema;
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

export function resolveSavedInstance(
  previous: ComponentInstanceRecord,
  current: ComponentInstanceRecord | undefined,
): InstanceResolution {
  return resolveInstance(previous, current);
}
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
