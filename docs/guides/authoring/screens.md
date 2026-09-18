---
title: "Screens"
description: "A screen is one idea in your product, rendered for mobile and desktop."
section: "authoring"
order: 2
---

## Define a screen

`defineScreen` takes the screen's identity, its route and the two React nodes
the catalogue renders.

```tsx
import { defineScreen } from "@mokly/mokly";

export const accountHome = defineScreen({
  id: "account-home",
  title: "Account home",
  description: "The account landing screen.",
  route: "account/home.html",
  mobile: <main>Account</main>,
  desktop: <main>Account</main>,
  dependencies: ["src/account/home.tsx"],
  relatedDocs: ["docs/account.md"],
  useCaseIds: [],
});
```

| Field                  | Meaning                                                 |
| ---------------------- | ------------------------------------------------------- |
| `id`                   | Lowercase kebab-case identity, stable across renames    |
| `title`, `description` | What the catalogue shows                                |
| `route`                | Where the documents are written under `mockupsDir`      |
| `mobile`, `desktop`    | The React node each viewport renders                    |
| `dependencies`         | Repository paths this screen is made from               |
| `relatedDocs`          | Documents a reader should open beside it                |
| `useCaseIds`           | Flows this screen appears in                            |
| `tags`                 | Lowercase kebab-case classification, searched as `tag:` |
| `colorSchemes`         | Opt one screen out of a scheme the catalogue renders    |
| `rationale`            | Why the screen is the way it is                         |

Each view is generated as its own standalone page, so wrap the content in a
landmark such as `main`.

## Nest a tree of screens

`defineRoot` flattens a nested tree into ordinary definitions, so a folder of
related screens is described once. Children are markers made by `screen` and
`collection`, and their routes come from the root path, the collection
segments and each slug.

```tsx
import { collection, defineRoot, screen } from "@mokly/mokly";

export const mockups = defineRoot({
  path: "account",
  collection: {
    id: "account",
    title: "Account",
    description: "Account product screens.",
  },
  children: [
    collection({
      id: "account-billing",
      segment: "billing",
      title: "Billing",
      description: "Billing screens.",
      children: [
        screen({
          id: "account-invoice",
          slug: "invoice",
          title: "Invoice",
          description: "One invoice.",
          mobile: <main>Invoice</main>,
          desktop: <main>Invoice</main>,
        }),
      ],
    }),
  ],
});
```

The route of that screen is `account/billing/invoice.html`: the root path, the
collection segment and the slug, with the extension added for you. A nested
child inherits `dependencies` and `relatedDocs` from its ancestors; tags are
never inherited.

## Exported types

| Type                              | Use                                       |
| --------------------------------- | ----------------------------------------- |
| `ScreenInput`, `ScreenDefinition` | What `defineScreen` takes and returns     |
| `NestedScreenInput`               | What `screen` takes inside a tree         |
| `RootInput`                       | What `defineRoot` takes                   |
| `EntryInput`, `RoutedEntryInput`  | The metadata every entry and route shares |
| `RegistryDefinition`              | Any definition an entry module may export |
