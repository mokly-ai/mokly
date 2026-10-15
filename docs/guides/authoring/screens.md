---
title: "Screens"
description: "Write one HTML body for a screen, then show its states at both viewports."
section: "authoring"
order: 2
---

## Create an HTML screen

Save a `.screen.html` file inside a configured root. Start with YAML front
matter. Put the screen's HTML after the closing delimiter.

```html
---
title: Invoice
description: One paid invoice.
tags: [billing]
props: { status: paid, overdue: false }
variants:
  - slug: overdue
    title: Invoice, overdue
    props: { status: overdue, overdue: true }
---

<main>
  <h1 id="summary">Invoice: {{status}}</h1>
  <p mokly-if="$overdue">Payment is overdue.</p>
  <p mokly-viewport="mobile">Compact detail</p>
  <p mokly-viewport="desktop">Full detail</p>
  <a href="mock:account/billing">Back to billing</a>
</main>
```

With the default `specs` root, `specs/account/invoice.screen.html` has the
path `account/invoice`. Its variant has the path `account/invoice/overdue`.
The catalogue renders both entries at mobile and desktop. Each entry also
renders in the color schemes it enables.

## Name the screen

`title` is required. `description` defaults to an empty string. The front
matter can also contain these fields:

| Field                             | Use                                                     |
| --------------------------------- | ------------------------------------------------------- |
| `tags`                            | Unique lowercase kebab-case tags                        |
| `path`                            | A complete path that replaces the file-derived path     |
| `movedFrom`                       | The complete path before a move                         |
| `rationale`                       | The reason for the design                               |
| `relatedDocs`                     | Related document paths or labels                        |
| `address`                         | The address shown in the device frame                   |
| `useCasePaths`                    | Flows whose steps use this screen                       |
| `colorSchemes`                    | A subset of the catalogue schemes that includes `light` |
| `props`, `propSchema`, `variants` | Data, validation, and saved states                      |

A path segment uses letters, digits, hyphens, and underscores. Paths keep
their case. Two paths that differ only by case conflict. A file named
`index.screen.html` is its folder's own screen. Use a `path` override when
catalogue placement must differ from the source directory.

## Use one body for every view

`{{name}}` substitutes a scalar prop in text or an attribute. A dotted name,
such as `{{user.name}}`, reads an object property. Mokly escapes substituted
text. There is no raw substitution form. Spaces around the name inside the
braces are allowed, as in `{{ name }}`.

`mokly-if="$name"` keeps an element only when the named boolean prop is
true. `mokly-viewport="mobile"` or `"desktop"` keeps it in that viewport.
The other attributes remain ordinary HTML. The screen body is a fragment;
it does not contain `html`, `head`, `body`, `base`, or `script`.

Read [Props and variants](/docs/authoring/props-and-variants/) for schemas,
optional values, and saved state inheritance.

## Use shared components

A registered custom element renders its component. Attributes supply data.
Children supply declared slots.

```html
<ui-button label="Save" mokly-instance="save" to="account/saved">
  <strong>Save changes</strong>
</ui-button>
```

Use a `$name` attribute value to pass an object or array prop unchanged.
Use `$$` to escape a literal leading dollar. Read
[Components](/docs/authoring/components/) for registration and named slots.

## Build and browse

```bash
npx mokly build --strict
npx mokly serve
```

A build validates every view. It fails on errors. Strict mode also fails on
warnings. Screen documents use
`static/mokly-generated/account/invoice/index.mobile.html` and
`index.desktop.html`; dark views add `.dark` before `.html`.

[Styles](/docs/authoring/styles/) explains stylesheet rules.
[Links](/docs/authoring/links/) explains portable catalogue destinations.
