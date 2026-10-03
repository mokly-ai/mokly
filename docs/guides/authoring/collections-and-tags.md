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
screens, pages, flows and components.

In the catalogue, a folder appears in the Pages section when it holds
screens, pages or flows, and in the Components section when it
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
the directory, of files Mokly should not read as entries.
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

A folder can have a page of its own: an entry module named
`index.mockup.tsx`, or an entry that declares `slug: "index"`. That entry takes
the folder's path and appears as its first child row, using its authored title.
For example, `specs/account/index.mockup.tsx` opens at `/view/account/`.
When a folder record sets no title, the index entry's title becomes the folder
title. Variants keep their existing row and disclosure control.

## Classify with tags

Screens, pages, flows and components may carry `tags`, a list of
lowercase kebab-case values in the order you wrote them.

```tsx
defineScreen({
  tags: ["forms", "empty-state"],
  // The rest of the screen is unchanged.
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
