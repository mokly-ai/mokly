---
title: "Viewports and color schemes"
description: "Render the same screen at mobile and desktop sizes with your product theme."
section: "authoring"
order: 4
---

## Two viewports

A screen or component has one render function. Mokly calls it with
`context.viewport` set to `mobile` or `desktop`. It writes separate documents
for these views in a static build. A page and a Markdown document have no
viewport axis.

## Enable dark views

Enable dark in `mokly.config.json`. The default set contains only `light`.

```json
{
  "colorSchemes": ["light", "dark"],
  "renderer": "specs/renderer.tsx"
}
```

Use a consumer renderer to choose the product's theme. Return React content,
or `{ node, resources }`. Mokly renders that content and assembles the document.

```tsx
// specs/renderer.tsx
import type { RenderInput, RenderResult } from "@mokly/mokly";

export default function render(input: RenderInput): RenderResult {
  return {
    node: <div data-theme={input.colorScheme}>{input.node}</div>,
    resources: ["assets/product.woff2"],
  };
}
```

The renderer receives `entry`, `props`, `viewport`, `colorScheme`, and `node`.
It wraps React screens and component renders. Storybook uses its own decorators.
Pages own their complete documents. The core owns the document head and
stylesheet links.

React and React DOM resolve from your repository. Mokly supplies no private
React runtime and no product theme. Use your application's providers around
`input.node` when it needs them.

## Keep one screen light

A screen or component can declare `colorSchemes: ["light"]`. A declaration
must contain `light`, contain no duplicates, and be a subset of the catalogue's
set. Screen variants inherit this list unless they declare a replacement.
Component variants inherit the component's list.

Dark screen documents have `.dark` before `.html`, such as
`index.mobile.dark.html`. A `definePage` callback produces one light document.
A Markdown document can have light and dark documents in the shell's typography.

## Styles for each scheme

A stylesheet rule adds `lightStylesheets` or `darkStylesheets` after its shared
list. Your renderer can also select a theme from `input.colorScheme`.
See [styles](/docs/authoring/styles/).
