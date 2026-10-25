---
title: "Your first screen"
description: "Author one screen with a mobile view and a desktop view."
section: "start"
order: 3
---

## Add one HTML file

Create `specs/welcome.screen.html`. Its file name gives it the catalogue
path `welcome`.

```html
---
title: Welcome
description: The first screen after sign-in.
props: { name: Ada, returning: true }
variants:
  - slug: first-visit
    title: First visit
    props: { returning: false }
---

<main>
  <h1>Welcome, {{name}}</h1>
  <p mokly-if="$returning">Your workspace is ready.</p>
  <p mokly-viewport="mobile">Compact navigation</p>
  <p mokly-viewport="desktop">Full navigation</p>
</main>
```

The YAML block supplies the title, data, and one saved state. The HTML body
renders at mobile and desktop. Substituted values are escaped. The variant
uses the same body with its own prop overrides.

## Validate the catalogue

```bash
npx mokly build --strict --no-changes
```

The build renders every view and checks links and resources. Strict mode
also fails on warnings. It writes the static catalogue to `mokly-static` by
default. Keep that directory ignored by Git.

## Open the catalogue

```bash
npx mokly serve
```

Open the listening URL printed in the terminal. Select Welcome in the tree.
Switch between its viewports and its First visit variant. Save an edit to
the HTML file to refresh the visible view.

Read [Screens](/docs/authoring/screens/) for metadata and body rules.
Read [Components](/docs/authoring/components/) to reuse shared markup.

## Start with a React screen

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
