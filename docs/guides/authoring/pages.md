---
title: "Pages"
description: "Register a complete HTML document beside your screens."
section: "authoring"
order: 7
---

## When to use a page

Use a page for a document that already exists as one complete HTML file, such
as a handbook or a generated report, where mobile and desktop variants would
be invented rather than real.

## Define a page

`definePage` takes a synchronous `render` callback that runs once and returns
one complete document at the exact route.

```tsx
import { definePage } from "@mokly/mokly";
import { source } from "../pages/handbook.source.js";

export const mockups = [
  definePage({
    id: "handbook",
    title: "Handbook",
    description: "Product reference notes.",
    route: "handbook.html",
    navPath: ["Documents"],
    dependencies: ["docs/mockups/src/pages/handbook.source.tsx"],
    relatedDocs: [],
    tags: ["documents"],
    render: source,
  }),
];
```

Use `navPath: []` (or omit it) to show the page at the top of Pages.

## Pages inside a tree

The nested `page` marker derives its route from the root path, ancestor folder
segments and its own slug. The root's `navPath` and ancestor folder titles derive
the leaf's `navPath`; do not author `navPath` on the nested marker.

## What a page shares with a screen

Ids, `navPath`, links, tags, Changes, the source guards and the safe
output transaction are the same. A title or folder label never rewrites an
explicit route. Pages take part in Changes but have no visual comparison,
because there is no second view to compare.

## Exported types

| Type                          | Use                                 |
| ----------------------------- | ----------------------------------- |
| `PageInput`, `PageDefinition` | What `definePage` takes and returns |
| `NestedPageInput`             | What `page` takes inside a tree     |
