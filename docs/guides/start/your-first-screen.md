---
title: "Your first screen"
description: "Author one screen with a mobile view and a desktop view."
section: "start"
order: 3
---

## Add one HTML file

Create `specs/welcome.screen.html`. Its file name gives it the catalogue
path `welcome`.

<!-- prettier-ignore -->
```html
---
title: Welcome
description: The first screen after sign-in.
props: {name: Ada, returning: true}
variants:
  - slug: first-visit
    title: First visit
    props: {returning: false}
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
