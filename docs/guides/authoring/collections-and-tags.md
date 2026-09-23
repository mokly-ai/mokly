---
title: "Folders and tags"
description: "Navigation paths group entries into folders; tags are the vocabulary you search by."
section: "authoring"
order: 5
---

## Group entries with a path

A `navPath` lists the folders above a screen, page, flow, or component. An
omitted path is `[]`, placing the entry at the top of its section. Paths
create folders in Pages and Components independently.

```tsx
import { defineScreen } from "@mokly/mokly";

export const accountHome = defineScreen({
  id: "account-home",
  title: "Account home",
  description: "The account landing screen.",
  route: "account/home.html",
  navPath: ["Account", "Screens"],
  mobile: <main>Account</main>,
  desktop: <main>Account</main>,
  dependencies: ["src/account/home.tsx"],
  relatedDocs: ["docs/account.md"],
  useCaseIds: [],
});
```

Matching path segments merge into one folder within a section even across
files. A label must be nonempty, lack leading/trailing whitespace, and cannot
contain `/`. Labels differing only by Unicode case or whitespace under one
parent conflict; so does a folder whose name matches a sibling entry title.
Different entries can have the same title, however.

Breadcrumbs use the path labels in order. Moving a path changes navigation
and breadcrumbs without changing the entry's route. Variants copy their
parent's path and appear beneath its row.

Inside a `defineRoot` tree, optional root `title` and ancestor `folder()`
titles derive each leaf's path; `segment` builds routes and never moves a
folder in navigation. Nested leaves must not author their own `navPath`.

## Classify with tags

Screens, pages and use-case flows may carry `tags`, a list of lowercase
kebab-case values in the order you wrote them.

```tsx
defineScreen({
  tags: ["forms", "empty-state"],
  // The rest of the screen is unchanged.
});
```

Tags are optional vocabulary, not a second hierarchy: an untagged catalogue is
perfectly valid. A list must not repeat a tag, and folders have no tags or
other entry metadata. In the catalogue, search for `tag:forms` to narrow the tree,
and the details of a screen list its tags as chips you can search from.

## Exported types

| Type                 | Use                                 |
| -------------------- | ----------------------------------- |
| `NestedFolderInput`  | What `folder` takes inside a tree   |
| `NestedFolderMarker` | What `folder` returns in a tree     |
| `RootInput`          | What `defineRoot` takes for a tree  |
| `EntryInput`         | Common metadata including `navPath` |
