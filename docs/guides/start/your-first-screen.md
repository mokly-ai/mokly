---
title: "Your first screen"
description: "Author one screen with a mobile view and a desktop view."
section: "start"
order: 3
---

## Add an entry module

An entry module is a `.mockup.ts` or `.mockup.tsx` file inside a root, and
every definition it exports becomes part of the catalogue. Put the file in the
folder the screen belongs to. With the default `specs` root, the account
landing screen lives at `specs/account/account-home.mockup.tsx`:

```tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Account home",
  description: "The account landing screen.",
  mobile: <main>Account</main>,
  desktop: <main>Account</main>,
  relatedDocs: ["docs/account.md"],
  dependencies: ["src/account/home.tsx"],
});
```

Export the definition however you like: as the default export, as a named
export, or inside an exported array. Helper functions and React components in
the same file are left alone.

## Use your own components

`mobile` and `desktop` take any React node, so a screen composes the same
components your product ships. Each view is generated as its own standalone
page, so wrap the content in a landmark such as `main`.

## Where it lives

The screen's path is `account/account-home`: the directories below the root,
then the file name up to its first dot. The path is the screen's identity,
the name you use when another entry links to it, and its address in the
catalogue, `/view/account/account-home/`. The `account` directory is a folder
in the navigation tree, titled Account until you give it a title of its own.

Mokly never renames a file for you. Each segment of a path uses letters,
digits, hyphens and underscores, so `Account Home.mockup.tsx` is reported as
an error rather than quietly rewritten. Set `slug` when the last segment
should differ from the file name, and name a file `index.mockup.tsx` when the
screen is the page of its folder.

## Where it is written

Each screen owns one directory under `mockupsDir/mokly-generated/` named by its path. This one
is written as `account/account-home/index.mobile.html` and
`account/account-home/index.desktop.html` under `mockupsDir/mokly-generated/`, with `.dark` before `.html`
once the catalogue renders a dark scheme. Moving the file to another folder
moves the screen, its files and its address together. Changes pairs a moved
screen with its earlier version when it finds one unique match. Declare
`movedFrom` with the complete previous path when the match needs help.

## Next

Build the catalogue and look at what was written.
