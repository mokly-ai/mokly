---
title: "Collections and tags"
description: "Collections are the navigation hierarchy; tags are the vocabulary you search by."
section: "authoring"
order: 5
---

## Group entries with a collection

A collection is structural: it owns child ids and no route.

```tsx
import { defineCollection } from "@mokly/mokly";

export const account = defineCollection({
  id: "account",
  title: "Account",
  description: "Account product screens.",
  childIds: ["account-home", "account-invoice"],
  dependencies: ["src/account"],
  relatedDocs: ["docs/account.md"],
});
```

`childIds` are the only navigation hierarchy in the catalogue. Each child has
at most one collection parent, a collection cannot repeat a child, name itself,
take part in a cycle or name an unknown id, and an entry no collection claims
is a catalogue root.

Breadcrumbs come from that hierarchy: the titles of the ancestors from the
root down to the parent. You never write a breadcrumb path yourself.

Inside a nested tree the `collection` marker does the same work and adds a
`segment` that becomes part of its children's routes.

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
perfectly valid. A list must not repeat a tag, and collections reject the
field altogether. In the catalogue, search for `tag:forms` to narrow the tree,
and the details of a screen list its tags as chips you can search from.

## Exported types

| Type                                      | Use                                       |
| ----------------------------------------- | ----------------------------------------- |
| `CollectionInput`, `CollectionDefinition` | What `defineCollection` takes and returns |
| `NestedCollectionInput`                   | What `collection` takes inside a tree     |
