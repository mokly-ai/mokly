---
title: "Pages and documents"
description: "Register a complete HTML document beside your screens, or drop a Markdown file into the tree."
section: "authoring"
order: 7
---

## When to use a page

Use a page for a document that already exists as one complete HTML file, such
as a handbook or a generated report, where mobile and desktop variants would
be invented rather than real. Use a Markdown document when the content is
written rather than rendered: Mokly turns the file into a page itself.

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
`static/documents/account-statement/index.html` and opened at
`/view/documents/account-statement/`. Name the file `index.mockup.tsx`, or
declare `slug: "index"`, to make the page the folder's own page. Pages are one
light document regardless of the catalogue's color schemes.

## What a page shares with a screen

Paths, `slug`, `path` and `movedFrom`, links, tags, Changes, the source guards
and the safe output transaction are the same. A title or folder title never
changes a path; only the file's place or a declared path does. Pages take part
in Changes but have no visual comparison, because there is no second view to
compare. When a page moves and its content changes at the same time, Changes
still pairs it with its earlier version when the two documents are at least
half alike, so that you see one moved page rather than a removal and an
addition.

## Markdown documents

Every `.md` file a root matches is a document. Its path derives from its file
like any entry, the leaf being the file name up to its first dot, so
`specs/account/billing/refunds.md` is `account/billing/refunds`. A file named
`README.md` or `index.md` is the page of its folder. File names follow the
same grammar as every path segment, so Mokly reports `Getting Started.md`
rather than renaming it.

A document may begin with a front matter block of `key: value` lines between
two `---` lines:

```markdown
---
title: "Refund policy"
description: "How refunds reach the original payment method."
tags: ["billing", "policy"]
---

# Refund policy

Refunds return to the original payment method within five business days.
```

The recognised keys are `title`, `description`, `tags`, `path` and
`movedFrom`. Without a `title`, the first heading is the title, and without a
heading the file name is. The description is empty unless you set it.

Mokly renders CommonMark with tables, strikethrough, task lists and automatic
links, gives every heading an id built from its text, keeps the language of a
code fence as a class, and shows raw HTML as literal text. The result is one
document in the shell's typography at `static/<path>/index.html`, with a dark
rendering beside it when the catalogue enables dark. A document has no
viewport, no variants and no helper to call; the file is the definition.

A relative link to another Markdown file becomes a catalogue link to that
document, and `mock:<path>` names any entry. An image with a `png`, `jpg`,
`jpeg`, `gif`, `svg`, `webp`, `avif` or `pdf` extension is copied beside the
document's folder, so `../shared/flow.png` from `account/billing` is served
at `static/account/shared/flow.png`; the file must live inside the same root.
A relative link to any other repository file renders as plain text, a link to
a file that does not exist fails the build, and `http:`, `https:` and
`mailto:` links are kept as they are.

Documents join Changes like pages: the rendered document, the images it uses
and its metadata are compared with the branch point, a removed document shows
its previous version, and a moved document pairs with its earlier version by
content.

## Exported types

| Type                          | Use                                 |
| ----------------------------- | ----------------------------------- |
| `PageInput`, `PageDefinition` | What `definePage` takes and returns |
