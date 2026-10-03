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
one complete document.

```tsx
// specs/documents/account-statement.mockup.tsx
import { definePage } from "@mokly/mokly";
import { source } from "./statement.source.js";

export default definePage({
  title: "Account statement",
  description: "The printable account statement.",
  dependencies: ["specs/documents/statement.source.tsx"],
  relatedDocs: [],
  tags: ["documents"],
  render: source,
});
```

The page is `documents/account-statement`, written at
`documents/account-statement/index.html` under `mockupsDir` and opened at
`/view/documents/account-statement/`. Name the file `index.mockup.tsx`, or
declare `slug: "index"`, to make the page the folder's own page. Pages are one
light document regardless of the catalogue's color schemes.

## What a page shares with a screen

Paths, `slug`, `path` and `movedFrom`, links, tags, Changes, the source guards
and the safe output transaction are the same. A title or folder title never
changes a path; only the file's place or a declared path does. Pages take part
in Changes but have no visual comparison, because there is no second view to
compare. A changed path currently appears as a removal and an addition.
`movedFrom` records the authored previous path; move pairing is not available yet.

## Markdown files

Matched `.md` files remain protected, watched source inputs and are omitted
from catalogue output. Markdown rendering is not available yet; a catalogue
must contain at least one renderable definition.

## Exported types

| Type                          | Use                                 |
| ----------------------------- | ----------------------------------- |
| `PageInput`, `PageDefinition` | What `definePage` takes and returns |
