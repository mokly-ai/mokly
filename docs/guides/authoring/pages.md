---
title: "Pages and documents"
description: "Register HTML pages or add Markdown documents beside your screens."
section: "authoring"
order: 7
---

## Add a complete HTML page

Use a `.page.html` file for a printable statement, reference page, or other
complete document whose markup you own.

```html
---
title: Account statement
description: The printable account statement.
tags: [account]
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Account statement</title>
  </head>
  <body>
    <main><h1 id="summary">Statement</h1></main>
    <a href="mock:account/billing">Back to billing</a>
  </body>
</html>
```

The page has one document. It has no props, variants, viewport views, or
color-scheme views. It links its own CSS and receives no configured screen
styles. It can use registered component elements, catalogue link controls,
and ignore regions. A page-to-screen link opens the desktop light document.

A JavaScript `definePage` callback returns the same complete-document form as
one synchronous string. Mokly applies the same page checks to both forms.

## Add a Markdown document

Save a `.md` file inside a root. `README.md` and `index.md` are the folder's
own document. Other file names supply a leaf path.

```markdown
---
title: "Billing guide"
description: "How billing works."
tags: ["billing"]
---

# Billing

Read the [invoice](mock:account/invoice#summary).
```

Front matter is optional. It accepts `title`, `description`, `tags`, `path`,
and `movedFrom`. A document's title otherwise comes from its first nonempty
heading, then its file name.

Mokly renders headings, lists, tables, task lists, links, code fences, and
strikethrough. Raw HTML is literal text. Headings receive stable ids for
fragment links. The document uses Mokly's typography and color palette.

## Link files and resources

A relative Markdown link to another discovered `.md` file becomes a
catalogue link. File destinations resolve from the source Markdown file,
even when its catalogue path is overridden. `mock:` destinations use the
entry's catalogue base.

Images and PDF attachments must be regular files inside the document's
source root. They use the checked public asset closure. Hidden paths,
private build directories, protected sources, and symlink aliases fail the
build. Links to private source files display their text without a file URL.

Read [Links](/docs/authoring/links/) for fragments and catalogue navigation.
Read the [page contract](/docs/reference/pages/) for the full page rules.

## JavaScript pages

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

The page is `documents/account-statement`, delivered at
`documents/account-statement/index.html` under `static/mokly-generated/` in the static build and opened at
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
document in the shell's typography at `<path>/index.html` under `static/mokly-generated/` in the static build, with a dark
rendering beside it when the catalogue enables dark. A document has no
viewport, no variants and no helper to call; the file is the definition.
Empty headings keep their place but have no anchor. Mokly checks the final body
against its supported Markdown elements, attributes and URL schemes. It rejects
scripts, event handlers and inline body styles.

A relative link to another Markdown file becomes a catalogue link to that
document, and `mock:<path>` names any entry. A relative link or image with a
`png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `avif` or `pdf` destination
publishes that file at its repository-relative path under `static/`. With the
configuration in the repository root and the default `specs` root,
`../shared/flow.png` in `specs/account/billing/README.md` is served at
`static/specs/account/shared/flow.png`.
The file must live inside the same root.
Linked resources cannot use hidden path segments or private directory names
such as `node_modules`, `dist` or `target`. Use an ordinary folder such as
`assets`.
File links resolve from the Markdown source directory. Logical `mock:./...`
links resolve from the catalogue folder, including a declared README path.
Serve reads a linked resource from your working tree, and a static build
copies it into its output.
A relative link to any other repository file renders as plain text, a link to
a file that does not exist fails the build, and `http:`, `https:` and
`mailto:` links are kept as they are.
Links to existing ordinary files inside a root render as plain text and
do not add those files to the public closure. Other rendered resource references
can make those files public.
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
`build` and `publish` report uncertain matches in the terminal. Use
`movedFrom` when the content cannot establish one unique pair.

## Exported types

| Type                          | Use                                 |
| ----------------------------- | ----------------------------------- |
| `PageInput`, `PageDefinition` | What `definePage` takes and returns |
