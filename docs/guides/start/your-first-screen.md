---
title: "Your first screen"
description: "Export a screen that renders from props at mobile and desktop sizes."
section: "start"
order: 3
---

## Add an entry module

Put a `.mockup.tsx` file inside a configured root. With the default `specs`
root, use `specs/account/account-home.mockup.tsx`:

```tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Account home",
  description: "The account landing screen.",
  relatedDocs: [],
  props: { name: "Sam" },
  render: (props) => <main>Hello, {props.name}</main>,
});
```

Export one definition per export. A named export and a default export both
register. Arrays are not definitions. Helper functions and ordinary React
components can share the module.

## Use your product components

The render returns React content. It receives `props` and a context with
`viewport` and `colorScheme`. Import your product's components and use them in
that render. Put product providers in your configured renderer.

## Find the screen

The screen has path `account/account-home` and catalogue URL
`/view/account/account-home/`. Directories below the root supply its folders.
The file name up to its first dot supplies its last segment.
Set `slug` to replace that segment. Set `path` to declare a complete path.
A file named `index.mockup.tsx` supplies its folder's own page.

## Browse and build

Serve reads authored sources and keeps rendered documents in memory.
A static build writes the catalogue into its output directory.

```sh
npx mokly serve
npx mokly build --out mokly-static
```

Keep that output directory ignored by Git. Commit your authored sources.
See [screens](/docs/authoring/screens/) for schemas and saved states.
