---
title: "Viewports and color schemes"
description: "Every screen is built for mobile and desktop, in the schemes your catalogue renders."
section: "authoring"
order: 4
---

## Two viewports

Every screen owns one mobile node and one desktop node, and the build writes a
document for each, `index.mobile.html` and `index.desktop.html` inside the
screen's directory. The catalogue's viewport control switches between them,
and a link keeps the viewport you are in. Pages and Markdown documents have no
viewport: each is one document.

## Turn on dark

Dark is off until you ask for it. Enable it once in the config, then select
your own theme from the color scheme in your renderer.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  mockupsDir: "specs/generated",
  renderer: "specs/renderer.tsx",
});
```

```tsx
import type { RenderInput } from "@mokly/mokly";
import { renderToStaticMarkup } from "react-dom/server";

export default function render(input: RenderInput): string {
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <title>{input.entry.title}</title>
          {input.stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
        </head>
        <body data-theme={input.colorScheme}>{input.node}</body>
      </html>,
    )
  );
}
```

Mokly re-renders the same mobile and desktop nodes for dark output, so a
screen is never written twice, and the dark views sit beside the light ones as
`index.mobile.dark.html` and `index.desktop.dark.html`. Markdown documents also have `index.dark.html`, rendered with Mokly's
dark palette. Pages from `definePage` have one complete light document.
Serve and export offer one Auto/Light/Dark Appearance selector for the interface
and previews. An embedded viewer has a separate Light/Dark preview control;
its host chooses the interface theme. Select your product palette from
`input.colorScheme`, for example with CSS selectors on `data-theme` above.

## One screen that stays light

A screen that is deliberately light-only says so. The list must contain
`"light"`, must not repeat a scheme and must be a subset of the catalogue's
own set.

```tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Printed receipt",
  description: "A receipt that keeps its paper appearance.",
  mobile: <main>Receipt</main>,
  desktop: <main>Receipt</main>,

  relatedDocs: [],
  colorSchemes: ["light"],
});
```

A variant inherits the parent's list unless it declares its own, which then
replaces it.

## Stylesheets per scheme

A stylesheet rule appends `lightStylesheets` or `darkStylesheets` after its
shared list, so one rule can add the sheet a scheme needs.

## Exported types

| Type          | Value                     |
| ------------- | ------------------------- |
| `ColorScheme` | `"dark"` or `"light"`     |
| `Viewport`    | `"desktop"` or `"mobile"` |
