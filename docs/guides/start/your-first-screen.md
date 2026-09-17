---
title: "Your first screen"
description: "Author one screen with a mobile view and a desktop view."
section: "start"
order: 3
---

## Add an entry module

An entry module lives under `entriesDir`, ends in `.mockup.ts` or
`.mockup.tsx`, and exports `mockups`. Everything in that array becomes part of
the catalogue.

```tsx
import { defineCollection, defineScreen } from "@mokly/mokly";

export const mockups = [
  defineCollection({
    id: "account",
    title: "Account",
    description: "Account product screens.",
    childIds: ["account-home"],
    relatedDocs: ["docs/account.md"],
    dependencies: ["src/account"],
  }),
  defineScreen({
    id: "account-home",
    title: "Account home",
    description: "The account landing screen.",
    route: "account/home.html",
    mobile: <main>Account</main>,
    desktop: <main>Account</main>,
    relatedDocs: ["docs/account.md"],
    dependencies: ["src/account/home.tsx"],
    useCaseIds: [],
  }),
];
```

## Use your own components

`mobile` and `desktop` take any React node, so a screen composes the same
components your product ships. Each view is generated as its own standalone
page, so wrap the content in a landmark such as `main`.

The collection is also the navigation hierarchy. Because `account-home` is a
child of `account`, the catalogue shows it under Account and builds its
breadcrumb from that relationship.

## Give it a route

`route` is where the screen is written under `mockupsDir` and how the
catalogue addresses it. Ids are lowercase and kebab-case, and they are the
name you use when one screen links to another.

## Next

Build the catalogue and look at what was written.
