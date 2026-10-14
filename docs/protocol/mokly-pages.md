# Pages In The Catalogue

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Purpose And Boundary

A page is one complete authored HTML document that belongs to the same
catalogue as screens, components, documents, and use cases: a printable
statement, a reference page with several states, or any document whose markup
the author owns completely. Its path derives from its file under the
[path contract](./mokly-paths.md), so its folder is the directory that holds
it and its slug is the leaf. A page has no viewport or colour-scheme views, no
props, and no variants. A Markdown file is not a page; it is a
[document](./mokly-documents.md) that Mokly composes itself. Screens own the
viewport and colour-scheme views, and use-case steps reference screens only.
This contract adds no PDF parser, no browser scripting privilege, and no page
comparison engine beyond the tree comparison every entry receives.

## Authoring

A page has two forms. Each produces one entry of kind `page`.

An HTML page is a `.page.html` file matched by a root. It starts with the
front matter block of the
[HTML screens contract](./mokly-html-screens.md#front-matter): `title` is
required, and `description`, `tags`, `path`, `movedFrom`, `rationale`,
and `relatedDocs` are accepted; every other key is unknown for
a page. The body after the closing `---` is the complete document. It may use
component elements with literal attribute values, `to` link controls, `mock:`
links, and `mokly-ignore` markers like a screen body. A page has no props, so
a `$name`, `{{name}}`, or `mokly-if` reference fails with `html-props`.
The slug is the file name with `.page.html` removed. The core composes an
HTML page in Rust; no sidecar starts for it.

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
    <link rel="stylesheet" href="./statement.css" />
  </head>
  <body>
    <main>
      <h1 id="summary">Statement for October</h1>
      <a href="mock:account/billing">Back to billing</a>
    </main>
  </body>
</html>
```

A JavaScript page is a `definePage` export in an entry module. The root
package exports `definePage` and its input and definition types:

```ts
interface PageInput extends EntryInput {
  render: () => string;
}
```

`PageDefinition` adds `kind: "page"` and the module attribution of every
definition. Common metadata (`slug`, `path`, `movedFrom`, `title`,
`description`, `relatedDocs`, optional `rationale`) follows `EntryInput` of
the [authoring contract](./mokly-authoring.md). The slug defaults to the
module's file name under the
[entry module contract](./mokly-entry-modules.md#slugs). Tags follow the
unique kebab-case tag rule. The callback runs through the sidecar's
`renderPage` under the [render sidecar contract](./mokly-sidecar.md), named by
its definition handle, once per bundle generation.

```tsx
// specs/documents/account-statement.mockup.tsx
import { definePage } from "@mokly/mokly";
import { source } from "./statement.source.js";

export default definePage({
  title: "Account statement",
  description: "The printable account statement.",
  render: source,
  relatedDocs: [],
});
```

Under the default `specs` root this is the entry `documents/account-statement`.
A page named `index.page.html` or `index.mockup.tsx`, or declaring
`slug: "index"`, is its folder's own page under the
[folder row rules](./mokly-folders.md#rows-and-clicks). An undeclared input
key fails, including a key whose value is `undefined`, and untyped JavaScript
receives the same validation as typed authoring. A use-case `screenPath`
cannot name a page. Duplicate paths and grammar violations fail under the
[path diagnostics](./mokly-paths.md#diagnostics).

## Document Rules

The core applies these rules to every page, whichever form produced it:

- The document is complete. It starts with `<!doctype html>` and has one
  `html` element with `head` and `body`. An incomplete document fails
  `build-invalid` naming the page and, for an HTML page, the file and line.
- The page renders once, as one light document, whatever the catalogue's
  `colorSchemes`. It has no viewport, colour-scheme, or variant views.
- The configured renderer does not wrap it, and the configured stylesheets are
  not linked into it. The page links its own CSS and owns its styles,
  responsive markup, and render context.
- A `definePage` callback is synchronous and deterministic and returns the
  document as one string. A throw, a promise, or a non-string value fails as
  `render-failed`, presented as `build-invalid` naming the page. The callback
  writes no files; the core owns every write.
- `mock:` links and `to` link controls are rewritten and validated under the
  [navigation](./mokly-navigation.md) and
  [link control](./mokly-link-controls.md) contracts, and anchors are checked
  against the composed document under
  [link validation](./mokly-link-validation.md). A document with an
  activatable catalogue link rejects `<base href>`.
- Review-ignore markers become ignored regions of the composed tree under the
  [comparison contract](./mokly-comparison.md#markers).
- Referenced resources join the [public closure](./mokly-public-closure.md).
  A reference to a protected source or to a file outside the closure fails.
- Browse opens a page in a frame that runs no consumer script, so a page's
  scripts never execute in the shell.

## Rendering And Delivery

A page is composed into the render cache like every entry; nothing is written
into the repository. Its document route is
`static/mokly-generated/<path>/index.html` under the
[artifact path contract](./mokly-artifact-paths.md). Serve answers that route
from the cache, and `build` writes the file under `--out` beside the page's
shell stub and the resources of its closure, under the
[shell delivery contract](./mokly-shell-delivery.md). A page module and the
modules its bundle imports are watched: an edit re-renders the page, and an
edit that leaves the composed document, its resources, and its reviewable
metadata unchanged lists no change.

## Catalogue Model And Read Model

The catalogue model records a page with `kind: "page"`, its path, the common
metadata, and `tags`. It has no views, viewports, props, or callbacks, and no
record carries a file name; readers derive the document route from the path.
The [read model](./mokly-catalogue.md) emits `CataloguePage`. A page's
[entry detail](./mokly-shell-delivery.md#entry-detail) has empty `views` and
carries the page's `resourceEvidence`. Page leaves use `entry:<path>`
identity; folder identities follow the [folder contract](./mokly-folders.md).

## Browse And Navigation

A page appears once at its path with the page icon. The heading uses its
title; breadcrumbs use the resolved titles of its folders; the path chip, the
shared [search rule](./mokly-folders.md#titles), the tag picker, Details, and
the home counts include pages. Details show the authored description,
rationale, and related docs. Once Changes is ready, the heading shows the page
status and Details add the comparison details under the
[evidence contract](./mokly-css-evidence-presentation.md#status-lines).

The shell reuses the complete-document frame, the responsive shell, the
expansion control, and the script-free sandbox. It adds no device chrome
around chrome the document authors itself. It hides the controls that imply
viewport variants, colour-scheme variants, or page comparisons, and it
remembers the user's screen choices for the next screen. The mobile drawer and
the desktop navigation show the same path-derived folders.

`/view/<path>/` opens the page, and `/static/mokly-generated/<path>/index.html`
answers its document with the same GET and HEAD behaviour as every document.
`MockLink`, `mockLink`, a raw `mock:` value, and an HTML `to` attribute accept
its path. Their portable target is its one document with the validated
optional anchor; Browse opens the canonical page and reveals its ancestor
folders. A page-to-screen link resolves to the desktop light view, because a
page has no per-viewport render context. A screen-to-page link targets the
same document from every screen viewport and scheme. A use-case link resolves
through the use case's first screen.

Page anchors are validated against the composed document. The fragment
grammar, duplicate-query rejection, invalid-anchor behaviour, safe URL
handling, link-marker authentication, and the closure limit on authored HTML
are those of the navigation contract. Served and built pages handle direct
URLs, in-frame navigation, Back and Forward, and fragment restoration
identically.

## Changes, Watch, And Publishing

Pages participate in the All and Changes filters wherever review is
configured. The head document composes from the working tree and the base
document from the base commit's sources under the
[comparison contract](./mokly-comparison.md#sides). The two composed trees,
the referenced resources, and the reviewable metadata decide membership under
the [material rules](./mokly-changes.md), including paired ignore regions; a
source or dependency edit alone lists nothing. Moving a page to another folder
changes its path, so the [move contract](./mokly-moves.md) pairs it with the
base entry and marks it moved rather than removed and added; pages and
documents are the kinds it may pair by similarity. Renaming a folder title
changes no path and marks no page.

Screen comparison and use-case impact propagation keep their screen-only
boundary and never assume that every non-use-case entry has screen views.
Pages expose Current only and fabricate no comparison; the only historical
capture of a page is its [removed page preview](./mokly-removed-previews.md).
The [catalogue-change contract](./mokly-catalogue-changes.md) owns the
removed-page rows and the typed removal snapshot. Base folder titles stay in
Details even when every ancestor is deleted; no historical folder tree is
synthesized.

Watch re-renders a page when its sources or resources change and recomputes
its Changes before Serve publishes the next revision. The shell restores
disclosures by the keys of the
[disclosure persistence contract](./mokly-disclosure-persistence.md), and a
moved file updates navigation and breadcrumbs with that revision.

`build` writes each page's shell stub, document, and closure resources with
the catalogue index and its entry detail. The
[publication contract](./mokly-publication.md) decides whether a build carries
Changes and removed-page state; a build without them has no removed pages.
`publish` uploads a build unchanged.

## Related Docs

- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [Markdown documents](./mokly-documents.md)
- [Render sidecar](./mokly-sidecar.md)
- [Catalogue navigation](./mokly-navigation.md)
- [Styled catalogue link controls](./mokly-link-controls.md)
- [Final logical link validation](./mokly-link-validation.md)
- [Paths, roots, and identity](./mokly-paths.md)
