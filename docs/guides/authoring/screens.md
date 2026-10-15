---
title: "Screens"
description: "Render a product screen from props for each viewport and color scheme."
section: "authoring"
order: 2
---

## Define a screen

Export one `defineScreen` result from an entry module. Use `render(props,
context)` to return the React content of a view.

```tsx
// specs/account/invoice.mockup.tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Invoice",
  description: "One paid invoice.",
  relatedDocs: [],
  props: { state: "paid", lines: 3 },
  render: (props, context) => (
    <main data-viewport={context.viewport}>
      <h1>Invoice</h1>
      <p>
        {props.state}: {props.lines} lines
      </p>
    </main>
  ),
  variants: [
    { slug: "overdue", title: "Overdue", props: { state: "overdue" } },
  ],
});
```

Mokly calls this render for `mobile` and `desktop`, in each enabled color
scheme. The context contains `viewport` and `colorScheme`. A render can ignore
it. Providers and themes belong in your
[renderer](/docs/authoring/viewports-and-color-schemes/).

## Screen paths

With the default `specs` root, this screen has path `account/invoice`.
Its catalogue URL is `/view/account/invoice/`. The root, directories, and file
name determine the path. The file name ends at its first dot.
Set `slug` to replace the last segment. Set `path` to declare a complete path.
Set `movedFrom` to declare the complete path the entry had before a move.

A file named `index.mockup.tsx`, or a definition with `slug: "index"`, supplies
its folder's own page. Several definitions can share one module when their
slugs or declared paths differ. Each export contains one definition.
An array export is an error. Helper functions and ordinary React components
can share the module.

Mokly keeps rendered documents in memory. `build --out` writes the static
catalogue. Authored modules stay in your source tree.

## Props and schemas

Without `propSchema`, TypeScript derives the render's prop type from `props`.
A variant takes a `Partial` of that type. Mokly infers the runtime schema from
the own props and each variant's merged props. It excludes non-data values
with a `props-not-data` warning.

Declare `propSchema` when a prop needs a fixed type or a restricted set of
values. Write it `as const` so TypeScript derives the render type from it.

```tsx
import { defineScreen } from "@mokly/mokly";

export const invoice = defineScreen({
  title: "Invoice",
  description: "An invoice state.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["paid", "overdue"] } },
  } as const,
  props: { state: "paid" },
  render: (props) => <main>{props.state}</main>,
});
```

Props are plain data. A declared schema rejects unknown keys and invalid
values. Every object schema includes `additionalProperties: false`.
See [components](/docs/authoring/components/) for schemas, slots, and controls.

## Saved states

A variant declares `slug`, `title`, and `props`. Its props replace top-level
keys of the parent's props. Nested objects do not merge.
The example's overdue state has path `account/invoice/overdue` and keeps
`lines: 3`. It is a full screen entry with its own views and links.

A screen variant can override `description`, `tags`, `colorSchemes`,
`address`, `rationale`, `relatedDocs`, `useCasePaths`, and `movedFrom`.
An omitted list inherits from the parent, except `useCasePaths`, which defaults
to an empty list. A variant has no `path`, no render, and no nested variants.
The helper returns one definition that carries the saved states.

## Metadata

| Field                                 | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `title`, `description`, `relatedDocs` | Explain the screen.                                 |
| `tags`                                | Classify it with unique lowercase kebab-case names. |
| `address`                             | Set the address-bar label in the preview.           |
| `rationale`                           | Explain a design choice.                            |
| `useCasePaths`                        | Name flows that include this screen.                |
| `colorSchemes`                        | Restrict the enabled schemes; include `light`.      |
| `controls`                            | Replace the controls derived from the schema.       |

Use `ScreenInput` or `satisfies ScreenInput` to check extra top-level fields
in your own wrappers. Fresh variant literals receive excess-key checks.
Runtime validation applies to JavaScript callers too.

## Stable scrolling regions

Give an inner scrolling region a stable `id` when an edit moves it or changes
its text. Use `data-mokly-scroll="account-activity"` when a product id does
not fit. Use the same unique lowercase kebab-case value in both versions.
Use `data-mokly-scroll="off"` to keep a region independent.
