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

| Field                  | Meaning                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `id`                   | Lowercase kebab-case identity, stable across renames       |
| `title`, `description` | What the catalogue shows                                   |
| `navPath`              | Folder labels above this screen (defaults to `[]`)         |
| `route`                | Where the documents are written under `mockupsDir`         |
| `mobile`, `desktop`    | The React node each viewport renders                       |
| `dependencies`         | Repository paths this screen is made from                  |
| `relatedDocs`          | Documents a reader should open beside it                   |
| `useCaseIds`           | Flows this screen appears in                               |
| `tags`                 | Lowercase kebab-case classification, searched as `tag:`    |
| `colorSchemes`         | Opt one screen out of a scheme the catalogue renders       |
| `rationale`            | Why the screen is the way it is                            |
| `variants`             | States of this screen, each a full screen grouped under it |

Each view is generated as its own standalone page, so wrap the content in a
landmark such as `main`.

## Variants of a screen

A variant is the same screen with one deliberate shift, such as an empty
state or an error. Declare it inside the screen it varies, and it becomes a
full screen of its own, grouped under the parent in the catalogue.

```tsx
export const accountHomeStates = defineScreen({
  id: "account-home",
  title: "Account home",
  description: "The account landing screen.",
  route: "account/home.html",
  mobile: <main>Account</main>,
  desktop: <main>Account</main>,
  dependencies: ["src/account/home.tsx"],
  relatedDocs: ["docs/account.md"],
  useCaseIds: [],
  variants: [
    {
      id: "account-home-empty",
      slug: "empty",
      title: "Account home, empty",
      description: "The landing screen before any account exists.",
      mobile: <main>No accounts yet</main>,
      desktop: <main>No accounts yet</main>,
    },
  ],
});
```

The variant's route is derived from the parent's, so this one is written to
`account/home.variants/empty.html`. It inherits the parent's address, tags,
color schemes, dependencies and related docs unless it sets its own, and it
keeps its own global id, so a link to `account-home-empty` opens it like any
screen. Its `useCaseIds` defaults to an empty list and never inherits; list a
flow only when one of that flow's steps names the variant. A variant cannot
declare variants of its own or an independent `navPath`; it copies the
parent's path and appears beneath the parent row. The call returns a
readonly array containing the parent first and then the variants in authored
order; `mockups` exports may include that result directly. A call without
`variants` continues to return one screen definition. Nested `screen` markers
accept the same `variants` field and flatten in the same order.

## Nest a tree of screens

`defineRoot` flattens a nested tree into ordinary definitions, so a folder of
related screens is described once. Children are markers made by `screen` and
`folder`, and their routes come from the root path, the folder
segments and each slug.

```tsx
import { defineRoot, folder, screen } from "@mokly/mokly";

export const mockups = defineRoot({
  path: "account",
  navPath: ["Account"],
  children: [
    folder({
      segment: "billing",
      title: "Billing",
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
folder segment and the slug, with the extension added for you. The screen's
`navPath` is `["Account", "Billing"]`; changing those titles does not change
its route. A nested child inherits `dependencies` and `relatedDocs` from its
ancestors; tags are never inherited. An empty `folder()` is an authoring error.

## Exported types

| Type                              | Use                                       |
| --------------------------------- | ----------------------------------------- |
| `ScreenInput`, `ScreenDefinition` | What `defineScreen` takes and returns     |
| `ScreenVariantInput`              | One screen state nested under its parent  |
| `NestedScreenInput`               | What `screen` takes inside a tree         |
| `RootInput`                       | What `defineRoot` takes                   |
| `EntryInput`, `RoutedEntryInput`  | The metadata every entry and route shares |
| `RegistryDefinition`              | Any definition an entry module may export |
