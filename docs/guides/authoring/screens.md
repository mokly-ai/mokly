---
title: "Screens"
description: "Render a product screen from props for each viewport and color scheme."
section: "authoring"
order: 2
---

## Define a screen

Export one `defineScreen` result from an entry module. Use `render(props,
context)` to return the React content of a view.

```tsx
// specs/account/invoice.mockup.tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Invoice",
  description: "One paid invoice.",
  relatedDocs: [],
  props: { state: "paid", lines: 3 },
  render: (props, context) => (
    <main data-viewport={context.viewport}>
      <h1>Invoice</h1>
      <p>
        {props.state}: {props.lines} lines
      </p>
    </main>
  ),
  variants: [
    { slug: "overdue", title: "Overdue", props: { state: "overdue" } },
  ],
});
```

Mokly calls this render for `mobile` and `desktop`, in each enabled color
scheme. The context contains `viewport` and `colorScheme`. A render can ignore
it. Providers and themes belong in your
[renderer](/docs/authoring/viewports-and-color-schemes/).

## Screen paths

With the default `specs` root, this screen has path `account/invoice`.
Its catalogue URL is `/view/account/invoice/`. The root, directories, and file
name determine the path. The file name ends at its first dot.
Set `slug` to replace the last segment. Set `path` to declare a complete path.
Set `movedFrom` to declare the complete path the entry had before a move.

A file named `index.mockup.tsx`, or a definition with `slug: "index"`, supplies
its folder's own page. Several definitions can share one module when their
slugs or declared paths differ. Each export contains one definition.
An array export is an error. Helper functions and ordinary React components
can share the module.

Mokly keeps rendered documents in memory. `build --out` writes the static
catalogue. Authored modules stay in your source tree.

## Props and schemas

Without `propSchema`, TypeScript derives the render's prop type from `props`.
A variant takes a `Partial` of that type. Mokly infers the runtime schema from
the own props and each variant's merged props. It excludes non-data values
with a `props-not-data` warning.

Declare `propSchema` when a prop needs a fixed type or a restricted set of
values. Write it `as const` so TypeScript derives the render type from it.

```tsx
import { defineScreen } from "@mokly/mokly";

export const invoice = defineScreen({
  title: "Invoice",
  description: "An invoice state.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["paid", "overdue"] } },
  } as const,
  props: { state: "paid" },
  render: (props) => <main>{props.state}</main>,
});
```

Props are plain data. A declared schema rejects unknown keys and invalid
values. Every object schema includes `additionalProperties: false`.
See [components](/docs/authoring/components/) for schemas, slots, and controls.

## Saved states

A variant declares `slug`, `title`, and `props`. Its props replace top-level
keys of the parent's props. Nested objects do not merge.
The example's overdue state has path `account/invoice/overdue` and keeps
`lines: 3`. It is a full screen entry with its own views and links.

A screen variant can override `description`, `tags`, `colorSchemes`,
`address`, `rationale`, `relatedDocs`, `useCasePaths`, and `movedFrom`.
An omitted list inherits from the parent, except `useCasePaths`, which defaults
to an empty list. A variant has no `path`, no render, and no nested variants.
The helper returns one definition that carries the saved states.

## Metadata

| Field                                 | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `title`, `description`, `relatedDocs` | Explain the screen.                                 |
| `tags`                                | Classify it with unique lowercase kebab-case names. |
| `address`                             | Set the address-bar label in the preview.           |
| `rationale`                           | Explain a design choice.                            |
| `useCasePaths`                        | Name flows that include this screen.                |
| `colorSchemes`                        | Restrict the enabled schemes; include `light`.      |
| `controls`                            | Replace the controls derived from the schema.       |

Use `ScreenInput` or `satisfies ScreenInput` to check extra top-level fields
in your own wrappers. Fresh variant literals receive excess-key checks.
Runtime validation applies to JavaScript callers too.

## Stable scrolling regions

Give an inner scrolling region a stable `id` when an edit moves it or changes
its text. Use `data-mokly-scroll="account-activity"` when a product id does
not fit. Use the same unique lowercase kebab-case value in both versions.
Use `data-mokly-scroll="off"` to keep a region independent.

## Write an HTML screen

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
