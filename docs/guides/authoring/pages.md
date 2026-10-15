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
