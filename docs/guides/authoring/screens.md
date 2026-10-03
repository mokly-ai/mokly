---
title: "Screens"
description: "A screen is one idea in your product, rendered for mobile and desktop."
section: "authoring"
order: 2
---

## Define a screen

`defineScreen` takes the screen's title and the two React nodes the catalogue
renders. The file's place inside a root gives the screen its path.

```tsx
// specs/account/billing/invoice.mockup.tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Invoice",
  description: "One paid invoice.",
  mobile: <main>Invoice</main>,
  desktop: <main>Invoice</main>,
  dependencies: ["src/account/billing/invoice.tsx"],
  relatedDocs: ["docs/billing.md"],
});
```

| Field                  | Meaning                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `title`, `description` | What the catalogue shows                                   |
| `mobile`, `desktop`    | The React node each viewport renders                       |
| `dependencies`         | Repository paths this screen is made from                  |
| `relatedDocs`          | Documents a reader should open beside it                   |
| `slug`                 | The last segment of the path; defaults to the file name    |
| `path`                 | A complete path that replaces the derived one              |
| `movedFrom`            | The complete path this screen had before it moved          |
| `useCasePaths`         | Flows this screen appears in                               |
| `tags`                 | Lowercase kebab-case classification, searched as `tag:`    |
| `colorSchemes`         | Opt one screen out of a scheme the catalogue renders       |
| `address`              | The address shown in the browser chrome around the screen  |
| `rationale`            | Why the screen is the way it is                            |
| `variants`             | States of this screen, each a full screen grouped under it |

Each view is generated as its own standalone page, so wrap the content in a
landmark such as `main`.

## The path

The screen above is `account/billing/invoice`: the directories between the
root and the file, then the file name up to its first dot. That path is the
screen's identity everywhere. Links name it, flows name it, its address in the
catalogue is `/view/account/billing/invoice/`, and its views are written as
`account/billing/invoice/index.mobile.html` and `index.desktop.html` under
`mockupsDir`, with `.dark` before `.html` for dark views. Serve exposes these
files below `/static/`, and export writes them below `static/`.

Set `slug` when the last segment should differ from the file name, and set
`path` when a file cannot sit where its path should be; a declared path is
always complete. Every segment uses letters, digits, hyphens and underscores,
case is kept as written, and two paths that differ only by case count as one.
A file name outside that grammar is a build error that names the file.

One module may export several screens as long as each derives its own path.
A module named `index.mockup.tsx` is the page of its folder, so its slug-less
screen takes the folder's path while the others declare slugs:

```tsx
// specs/account/billing/index.mockup.tsx
export const billing = defineScreen({
  title: "Billing",
  // ...this screen is account/billing, the folder's own page
});

export const history = defineScreen({
  slug: "history",
  title: "Payment history",
  // ...this screen is account/billing/history
});
```

Two slug-less screens in one module, or a file beside a directory of the same
name, derive one path and fail the build with both locations.

## Keep scrolling panels paired

Mokly normally pairs scrolling panels across Before and Current from their
position, words, element type, and accessible role. If an edit moves a panel
or rewrites most of it, give the panel the same stable `id` in both versions.
If adding a product `id` would be inappropriate, name the comparison pair
directly with `data-mokly-scroll` instead:

```tsx
<main data-mokly-scroll="account-activity" className="activity-panel">
  <Activity />
</main>
```

The name is lowercase kebab-case and must be unique among scrolling regions in
each generated document. Use `data-mokly-scroll="off"` when a panel should
scroll independently in comparisons. The hint changes only comparison
scrolling; it does not make an element scrollable, change its layout, or affect
the generated file outside the viewer.

## Variants of a screen

A variant is the same screen with one deliberate shift, such as an empty
state or an error. Declare it inside the screen it varies, and it becomes a
full screen of its own, grouped under the parent in the catalogue.

```tsx
export default defineScreen({
  title: "Invoice",
  description: "One paid invoice.",
  mobile: <main>Invoice</main>,
  desktop: <main>Invoice</main>,
  dependencies: ["src/account/billing/invoice.tsx"],
  relatedDocs: ["docs/billing.md"],
  variants: [
    {
      slug: "overdue",
      title: "Invoice, overdue",
      description: "An invoice past its due date.",
      mobile: <main>Overdue</main>,
      desktop: <main>Overdue</main>,
    },
  ],
});
```

A variant's path is the parent's path plus its `slug`, so this one is
`account/billing/invoice/overdue` and a link to that path opens it like any
screen. It inherits the parent's address, tags, color schemes, dependencies
and related docs unless it sets its own, and a list it sets replaces the
inherited one. Its `useCasePaths` defaults to an empty list and never
inherits; list a flow only when one of that flow's steps names the variant. A
variant cannot declare variants of its own, and two variants of one parent
cannot share a slug. The call returns a readonly array containing the parent
first and then the variants in authored order; a call without `variants`
returns one screen definition. Either result can be exported directly.

A directory named after a screen is a folder whose page is that screen, so
`invoice/index.mockup.tsx` with variants renders the same row as
`invoice.mockup.tsx` with the same variants; files beside it in that directory
are ordinary members of the folder, not variants.

## Exported types

| Type                              | Use                                       |
| --------------------------------- | ----------------------------------------- |
| `ScreenInput`, `ScreenDefinition` | What `defineScreen` takes and returns     |
| `ScreenVariantInput`              | One screen state nested under its parent  |
| `EntryInput`                      | The metadata every entry shares           |
| `RegistryDefinition`              | Any definition an entry module may export |

Every input extends `EntryInput`; the path derives from the file. Unknown
fields fail registry validation. Use `satisfies ScreenInput` to check extra
top-level keys statically: generic inference can accept extra keys while
preserving the precise return type through wrappers. Fresh variant literals
in direct `defineScreen` calls still receive excess-key checks.
