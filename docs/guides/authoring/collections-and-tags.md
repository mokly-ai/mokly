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
screens, pages, Markdown documents, flows and components.

In the catalogue, a folder appears in the Specs section when it holds
screens, pages, documents or flows, and in the Components section when it holds
components, with each section showing only its own kind of children. A
folder row only expands or collapses; it never opens anything. Breadcrumbs
use folder titles in order: a folder with its own page opens that page, and
any other folder opens in the navigation tree.

## Give a folder a title and an order

By default a folder is titled after its last segment, with hyphens and
underscores shown as spaces and the first letter capitalised, so
`account-billing` reads as Account billing. Its children render folders first,
then entries, each group by title. A folder record changes both. Put a
`_folder.json` file in `specs/account/invoices/`, beside an
`invoice.mockup.tsx` entry:

```json
{
  "title": "Invoices & Payments",
  "order": ["invoice", "..."],
  "exclude": ["drafts/**"]
}
```

`order` lists child slugs in the order you want; `...` stands for every
child you did not name, and when you leave it out the unnamed children follow
the named ones. An order never hides a child, and naming something that is not
a child of the folder is a build error. `exclude` lists globs, relative to
the directory, of files Mokly should not read as entries.
`"hidden": true` removes the folder and everything below it from navigation
and search while leaving its addresses, links and Changes rows alone.

The same record can be declared in code from any entry module, which suits a
folder that has no directory because its entries declare their paths:

```ts
import { defineFolder } from "@mokly/mokly";

export const invoices = defineFolder({
  path: "account/invoices",
  title: "Invoices & Payments",
  order: ["invoice", "..."],
});
```

`defineFolder` takes `path`, `title`, `order` and `hidden`. A folder has at
most one record, from either form, and a record for a path with no entry
below it is a build error because it is almost always a typo. A `_folder.json`
directly inside a root without a path prefix describes the top level of the
catalogue and may only carry `order` and `exclude`.

## A folder's own page

A folder can have a page of its own: a Markdown `README.md` or `index.md`, an
entry module named `index.mockup.tsx`, or an entry that declares
`slug: "index"`. That entry takes the folder's path. A page, document or flow
appears as its first child row, labelled
Overview when its title is also the folder's title; a screen or component
uses its own entry row, which lists its variants and then the folder's other
members.
For example, `specs/account/index.mockup.tsx` opens at `/view/account/`.
A screen or component index always supplies its folder's title, including
breadcrumbs for descendants. A folder record cannot set `title` there; set the
entry's title instead. `order` and `hidden` remain valid. Other index entries
supply the folder title only when the record omits it. Screens and components
keep their entry row and variant disclosure control.

## Classify with tags

Screens, pages, documents, flows and components may carry `tags`, a list of
lowercase kebab-case values in the order you wrote them.

```tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Empty activity",
  description: "An account with no activity yet.",
  mobile: <main>No activity yet</main>,
  desktop: <main>No activity yet</main>,
  dependencies: [],
  relatedDocs: [],
  tags: ["forms", "empty-state"],
});
```

Tags are optional vocabulary, not a second
hierarchy: an untagged catalogue is perfectly valid. A list must not repeat a
tag, and folders have no tags or other entry metadata. In the catalogue,
search for `tag:forms` to narrow the tree, and the details of a screen list
its tags as chips you can search from.

## Exported types

| Type                              | Use                                         |
| --------------------------------- | ------------------------------------------- |
| `FolderInput`, `FolderDefinition` | What `defineFolder` takes and returns       |
| `EntryInput`                      | Common metadata including `slug` and `path` |
