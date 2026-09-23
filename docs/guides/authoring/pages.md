---
title: "Pages"
description: "Register a complete HTML document beside your screens."
section: "authoring"
order: 7
---

> Entry path declarations are removed in Milestone 6 of
> [remove-source-path-evidence](../../../plans/remove-source-path-evidence.md);
> the current package still accepts them.

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
    relatedDocs: [],
    tags: ["documents"],
    render: source,
  }),
];
```

Add the page id to the `childIds` of the collection that owns it, exactly as
you would a screen.

## Pages inside a tree

The nested `page` marker derives its route from the root path, the collection
segments and its own slug, and otherwise takes the same fields.

## What a page shares with a screen

Ids, collection ancestry, links, tags, Changes, the source guards and the safe
output transaction are the same. A title or a collection never rewrites an
explicit route. Pages take part in Changes but have no visual comparison,
because there is no second view to compare.

## Exported types

| Type                          | Use                                 |
| ----------------------------- | ----------------------------------- |
| `PageInput`, `PageDefinition` | What `definePage` takes and returns |
| `NestedPageInput`             | What `page` takes inside a tree     |
