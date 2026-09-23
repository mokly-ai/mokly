---
title: "Viewports and color schemes"
description: "Every screen is built for mobile and desktop, in the schemes your catalogue renders."
section: "authoring"
order: 4
---

## Two viewports

Every screen owns one mobile node and one desktop node, and the build writes a
document for each. The catalogue's viewport control switches between them, and
a link keeps the viewport you are in.

## Turn on dark

Dark is off until you ask for it. Enable it once in the config, then select
your own theme from the color scheme in your renderer.

```ts
export default defineConfig({
  colorSchemes: ["light", "dark"],
  entries: ["src/**/*.mockup.{ts,tsx}"],
  mockupsDir: "docs/mockups",
  renderer: "docs/mockups/renderer.tsx",
});
```

This `entries` glob selects the recommended `.mockup.ts` and `.mockup.tsx`
names. The glob itself defines the entry shape, while `entriesDir` is shorthand
for the same suffixed pattern beneath one folder.

```tsx
export default function render(input: RenderInput): string {
  const theme = themes[input.colorScheme];
  return document(theme, input.node);
}
```

Mokly re-renders the same mobile and desktop nodes for dark output, so a
screen is never written twice. The catalogue shows a Light and Dark switch
once the catalogue has dark documents.

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

A nested `screen` marker takes the same field, and it is never inherited from
a collection or the root of a tree.

## Stylesheets per scheme

A stylesheet rule appends `lightStylesheets` or `darkStylesheets` after its
shared list, so one rule can add the sheet a scheme needs.

## Exported types

| Type          | Value                     |
| ------------- | ------------------------- |
| `ColorScheme` | `"dark"` or `"light"`     |
| `Viewport`    | `"desktop"` or `"mobile"` |
