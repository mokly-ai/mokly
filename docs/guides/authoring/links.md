---
title: "Links"
description: "Link one catalogue entry to another and keep the link portable."
section: "authoring"
order: 8
---

## Link by id

Use `MockLink` for a destination inside the catalogue. `to` carries the entry
id, and the separate `fragment` prop carries a bare HTML id.

```tsx
import { MockLink } from "@mokly/mokly";

<MockLink fragment="summary" to="account-detail">
  Details
</MockLink>;
```

The string helper is `mockLink(id, fragment?)`, and both produce
`mock:<id>[#fragment]`.

```tsx
import { mockLink } from "@mokly/mokly";

const detailsHref = mockLink("account-detail", "summary");
// "mock:account-detail#summary"
```

The id is lowercase kebab-case. Neither helper accepts `id#fragment`,
percent-encoded syntax or a `mock:` value in the id, and an unknown but
well-formed id fails later when the catalogue is built. A link may name any
entry, including a screen or component variant.

## Style your own control

To use a styled control as a link, opt into `asChild` with exactly one
element:

```tsx
<MockLink asChild to="account-detail">
  <button className="primary-action">View account</button>
</MockLink>
```

Mokly turns that one control into a native link during the build, keeping its
classes, inline styles, label and icons. Put attributes on the child. A
disabled or busy control stays inactive, and an adapted link keeps a visible
keyboard focus outline.

## Where a styled control can go

The control becomes the link, so nothing inside it may be a control of its
own. A link, button, form field, summary or editable element inside the child
fails the build, and so does an inline event handler. Focusable content inside
the child, such as an element with `tabindex`, builds with a warning because
it adds a second keyboard stop to one link. A grouping role such as `menu`,
`tablist` or `tree` inside the child also warns because that role does not
belong inside a link.

Placement around the control matters too. Inside another link or inside
editable content the build fails, because the browser cannot give both
elements the same click. Inside a button, a label, a summary or an element
with a control role such as `menuitem` or `tab`, the build succeeds with a
warning that one click has two targets. A focus target such as
`<main tabIndex={-1}>`, the body of a `<details>` element and grouping roles
such as `menubar` or `tablist` need no change and produce no warning.

A warning names the route and the element on standard error and leaves the
exit status at `0`. Pass `--strict` to `build`, `check`, `export` or `publish`
when a warning should fail the command instead.

## Metadata without an interaction

`data-nav-href` records a logical destination on any element without inventing
a click or a keyboard behaviour. A logical `href` belongs only on an HTML `a`
or `area` or an SVG `a`; anywhere else it fails the build rather than becoming
an accidental resource request.

## What the build checks

Generated files keep portable relative links, so standalone documents still
navigate and comparison snapshots stay portable on disk, even though links
inside a comparison pane do nothing. The build validates every destination and
every fragment, and a fragment must exist in each generated view the catalogue
may show for that destination. A document that contains an activatable logical
link must not contain a `base href`. Root-absolute links and links into your
source tree are rejected as non-portable; use a relative URL for a real static
asset or a complete document.

## In the catalogue

An eligible link opens its destination's canonical page, carries the fragment
and reveals the destination in the navigation tree.
