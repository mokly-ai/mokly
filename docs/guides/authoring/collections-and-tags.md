---
title: "Folders and tags"
description: "Directories group entries into folders, folder records name and order them, and tags are the vocabulary you search by."
section: "authoring"
order: 5
---

## Folders come from directories

A folder is every path segment before an entry's last one. The file
`specs/account/billing/invoice.mockup.tsx` creates the folders `account` and
`account/billing` by being inside them; nothing declares a folder, and a
folder with no entry below it does not exist. The same directory can hold
screens, pages, flows, components and Markdown documents.

In the catalogue, a folder appears in the Specs section when it holds
screens, pages, flows or documents, and in the Components section when it
holds components, with each section showing only its own kind of children. A
folder row only expands or collapses; it never opens anything. Breadcrumbs
use folder titles in order.

## Give a folder a title and an order

By default a folder is titled after its last segment, with hyphens and
underscores shown as spaces and the first letter capitalised, so
`account-billing` reads as Account billing. Its children render folders first,
then entries, each group by title. A folder record changes both. Put a
`_folder.json` file in the directory:

```json
{
  "title": "Billing & Payments",
  "order": ["invoice", "..."],
  "exclude": ["drafts/**"]
}
```

`order` lists child slugs in the order you want; `...` stands for every
child you did not name, and when you leave it out the unnamed children follow
the named ones. An order never hides a child, and naming something that is not
a child of the folder is a build error. `exclude` lists globs, relative to
the directory, of files Mokly should not read as entries or documents.
`"hidden": true` removes the folder and everything below it from navigation
and search while leaving its addresses, links and Changes rows alone.

The same record can be declared in code from any entry module, which suits a
folder that has no directory because its entries declare their paths:

```ts
import { defineFolder } from "@mokly/mokly";

export const billing = defineFolder({
  path: "account/billing",
  title: "Billing & Payments",
  order: ["invoice", "..."],
});
```

`defineFolder` takes `path`, `title`, `order` and `hidden`. A folder has at
most one record, from either form, and a record for a path with no entry
below it is a build error because it is almost always a typo. A `_folder.json`
directly inside a root without a path prefix describes the top level of the
catalogue and may only carry `order` and `exclude`.

## A folder's own page

A folder can have a page of its own: a `README.md` or `index.md` in the
directory, an entry module named `index.mockup.tsx`, or an entry that
declares `slug: "index"`. That page takes the folder's path, so
`specs/account/README.md` is the entry `account` and opens at
`/view/account/`. When the folder's record sets no title, the page's title
becomes the folder's title.

A document, page or flow that is the folder's page is the folder's first row,
labelled with its title, or Overview when its title and the folder's are the
same. A screen or component that is the folder's page replaces the folder row
with that entry's row: a link beside a disclosure button, with the entry's
variants first and the folder's other members after them. In the breadcrumbs,
a folder with a page opens that page; a folder without one expands in the
tree.

## Classify with tags

Screens, pages, flows, components and documents may carry `tags`, a list of
lowercase kebab-case values in the order you wrote them.

```tsx
defineScreen({
  tags: ["forms", "empty-state"],
  // The rest of the screen is unchanged.
});
```

A Markdown document declares them in its front matter as
`tags: ["forms", "empty-state"]`. Tags are optional vocabulary, not a second
hierarchy: an untagged catalogue is perfectly valid. A list must not repeat a
tag, and folders have no tags or other entry metadata. In the catalogue,
search for `tag:forms` to narrow the tree, and the details of a screen list
its tags as chips you can search from.

## Moving from earlier releases

Earlier releases placed an entry with `navPath` labels and nested trees built
from `defineRoot` with `folder`, `screen` and `page` markers, typed by
`RootInput`, `NestedFolderInput`, `NestedFolderMarker`, `NestedScreenInput`
and `NestedPageInput`. Directories replace all of them: move each file into
the directory that should be its folder, or declare `path` on the entry, and
keep the labels you want in folder records.

## Exported types

| Type                              | Use                                         |
| --------------------------------- | ------------------------------------------- |
| `FolderInput`, `FolderDefinition` | What `defineFolder` takes and returns       |
| `EntryInput`                      | Common metadata including `slug` and `path` |
