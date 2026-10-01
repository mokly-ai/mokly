---
title: "Docs"
description: "Describe the product in Markdown or MDX beside the screens it covers."
section: "authoring"
order: 8
---

## When to use a doc

Use a doc for prose that belongs with your screens: a product specification,
a feature brief, or notes on how a flow should behave. Mokly shows each doc as
a catalogue entry at reading width, in both colour schemes, in the same
folders as the screens it describes.

## Point Mokly at your docs

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  entriesDir: "docs/mockups/entries",
  mockupsDir: "docs/mockups/generated",
  docsDir: "docs/product",
});
```

`docsDir` finds every `.md` and `.mdx` file under one folder. Use `docs` with
your own globs instead when the files live beside product code. Install the
compiler once in the repository that holds the docs:

```bash
npm install --save-dev @mdx-js/mdx remark-gfm
```

## Write a doc

```md
---
title: "Checkout"
description: "How the checkout flow behaves."
navPath: ["Checkout"]
tags: ["spec"]
---

# Checkout

The customer reviews the basket, then pays.

See the [basket screen](mock:checkout-basket).
```

The frontmatter is optional. Without it the title is the first level-one
heading, the description is the first paragraph, and the doc sits at the top
of Pages. The id comes from the file path, so `docs/product/checkout/flow.md`
becomes `checkout-flow`; set `id` in the frontmatter to keep links stable when
a file moves. `navPath` places the doc in the same folders as your screens,
and `dependencies` and `relatedDocs` take repository paths like any entry.

## Use components in MDX

A file ending in `.mdx` can import components. `MockLink` and `ReviewIgnore`
behave as they do in a screen, and product components render through your
renderer.

```mdx
import { MockLink } from "@mokly/mokly";

# Checkout

<MockLink to="checkout-basket">Open the basket</MockLink>
```

A plain `.md` file never runs code: braces, angle brackets, and the word
`import` are ordinary text. Raw HTML tags are dropped in both file types.

## What a doc shares with a screen

Ids, `navPath`, tags, links, Changes, both colour schemes, the source guards,
and the safe output transaction are the same. A doc has one desktop view, so
there is no viewport switch and no visual comparison. Every heading gets an
anchor, so a screen can link to `mock:checkout#payment`.

## Exported types

| Type            | Use                                   |
| --------------- | ------------------------------------- |
| `DocDefinition` | The entry Mokly creates for each file |
