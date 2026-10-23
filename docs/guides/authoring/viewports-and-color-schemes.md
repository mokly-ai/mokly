---
title: "Viewports and color schemes"
description: "Every screen is built for mobile and desktop, in the schemes your catalogue renders."
section: "authoring"
order: 4
---

## Render both viewports

A screen or component has mobile and desktop views. Its body is shared.
Use `mokly-viewport` to keep an element in one view.

```html
<nav mokly-viewport="mobile">Compact navigation</nav>
<nav mokly-viewport="desktop">Full navigation</nav>
```

Use CSS media queries for responsive layout inside each frame. A viewport
is a view axis. It does not create another catalogue entry.

## Enable dark views

Set the catalogue's color schemes in `mokly.config.json`.

```json
{ "colorSchemes": ["light", "dark"] }
```

An entry inherits that set. Set `colorSchemes: [light]` in a screen or
component's front matter to keep it light only. Every set includes light.

Mokly writes the effective `color-scheme` on the document's `html` element.
Use scheme-specific stylesheet rules or CSS that reads this value.

```css
html[style*="dark"] .surface {
  background: #202420;
  color: #f4f4ef;
}
```

A React renderer receives `viewport` and `colorScheme` with the render props.
It can select the product's providers from that context. It does not own the
outer document.

## Keep saved states separate

Use props-driven variants for empty, loading, error, or other saved states.
Each variant has its own path. Each of its enabled viewports and schemes
still uses the parent's render body.

Read [Props and variants](/docs/authoring/props-and-variants/) for inheritance.
Read [Styles](/docs/authoring/styles/) for shared and scheme-specific CSS.

## Pages and documents

A page renders one complete light document and supplies its own responsive
layout. A Markdown document has no viewport axis and has one document per
enabled color scheme. A light-only document keeps its light view under Dark.

## Wrap React content

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
