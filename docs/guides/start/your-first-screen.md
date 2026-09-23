---
title: "Your first screen"
description: "Author one screen with a mobile view and a desktop view."
section: "start"
order: 3
---

## Add an entry module

An entry module is any regular file matched by one of your `entries` globs and
exports `mockups` or a default registry value. Everything in that registry
becomes part of the catalogue. Mokly applies no separate suffix rule. With the
recommended `src/**/*.mockup.{ts,tsx}` convention, the natural place for this
file is beside the account screen it describes, for example
`src/account/home.mockup.tsx`. `entriesDir` selects the same convention by
expanding to `<folder>/**/*.mockup.{ts,tsx}`.

```tsx
import { defineScreen } from "@mokly/mokly";

export const mockups = [
  defineScreen({
    id: "account-home",
    title: "Account home",
    description: "The account landing screen.",
    navPath: ["Account"],
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

The `navPath` creates an Account folder and its breadcrumb; `route` stays
`account/home.html` even if you rename the folder. Without a `navPath`, the
screen appears at the top of Pages.

## Give it a route

`route` is where the screen is written under `mockupsDir` and how the
catalogue addresses it. Ids are lowercase and kebab-case, and they are the
name you use when one screen links to another.

## Next

Build the catalogue and look at what was written.
