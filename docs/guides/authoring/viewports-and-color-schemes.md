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
and a link keeps the viewport you are in. Pages have no
viewport: each is one document.

## Turn on dark

Dark is off until you ask for it. Enable it once in the config, then select
your own theme from the color scheme in your renderer.

```ts
export default defineConfig({
  colorSchemes: ["light", "dark"],
  mockupsDir: "specs/generated",
  renderer: "specs/renderer.tsx",
});
```

```tsx
export default function render(input: RenderInput): string {
  const theme = themes[input.colorScheme];
  return document(theme, input.node);
}
```

Mokly re-renders the same mobile and desktop nodes for dark output, so a
screen is never written twice, and the dark views sit beside the light ones as
`index.mobile.dark.html` and `index.desktop.dark.html`. Markdown inputs do
not render yet; pages from `definePage` have one complete HTML document.
The catalogue shows a Light and Dark switch once the catalogue has dark
documents.

## One screen that stays light

A screen that is deliberately light-only says so. The list must contain
`"light"`, must not repeat a scheme and must be a subset of the catalogue's
own set.

```tsx
defineScreen({
  colorSchemes: ["light"],
  // The rest of the screen is unchanged.
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
