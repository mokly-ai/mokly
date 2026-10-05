---
title: "Pages and documents"
description: "Register HTML pages or add Markdown documents beside your screens."
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
compare. Changes can pair a moved page even when its content changes: the
visible body text lines must be at least half alike and be each other's
unique best match. Set `movedFrom` to declare the complete previous path when
the content cannot identify the move.

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
`movedFrom`. One leading UTF-8 BOM is ignored. Without a `title`, the first nonempty heading is the title, and without a
heading the file name is. The description is empty unless you set it.

Mokly renders CommonMark with tables, strikethrough, task lists and automatic
links, gives every heading an id built from its text, keeps the language of a
code fence as a class, and shows raw HTML as literal text. The result is one
document in the shell's typography at `<path>/index.html` under `mockupsDir`, with a dark
rendering beside it when the catalogue enables dark. A document has no
viewport, no variants and no helper to call; the file is the definition.
Empty headings keep their place but have no anchor. Mokly checks the final body
against its supported Markdown elements, attributes and URL schemes, so a
transformer cannot introduce scripts, event handlers or inline body styles.

A relative link to another Markdown file becomes a catalogue link to that
document, and `mock:<path>` names any entry. A relative link or image with a
`png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `avif` or `pdf` destination copies
that file beside the document's folder. For a folder README at `account/billing`,
`../shared/flow.png` is served at `static/account/shared/flow.png`.
The file must live inside the same root.
Copied resources cannot use hidden path segments or private directory names such
as `node_modules`, `dist` or `target`; use an ordinary folder such as `assets`.
File links resolve from the Markdown source directory. Logical `mock:./...`
links resolve from the catalogue folder, including a declared README path.
Resource copies join generated output; ignore those paths too in derived mode.
A relative link to any other repository file renders as plain text, a link to
a file that does not exist fails the build, and `http:`, `https:` and
`mailto:` links are kept as they are.
Existing public files under `mockupsDir` stay public and render as plain text.
Links to Mokly-generated output or metadata fail; link to the source Markdown
file or use a lower-case `mock:` destination instead. Character references in
explicit link/image destinations and titles, such as `&amp;`, decode once.
Autolinks keep their URI text literal.

Documents join Changes like pages: the rendered document, its resources
and its metadata are compared with the branch point, a removed document shows
its previous version, and a moved document pairs with its earlier version by
content or its front-matter `movedFrom` declaration. A paired document produces
no removed entry. Similarity compares the Markdown body after front matter;
the shared document template cannot make unrelated notes look like a move.
Serve and export report uncertain matches in the terminal. Use `movedFrom`
when the content cannot establish one unique pair.

## Exported types

| Type                          | Use                                 |
| ----------------------------- | ----------------------------------- |
| `PageInput`, `PageDefinition` | What `definePage` takes and returns |
