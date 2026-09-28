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
well-formed id fails later when the catalogue is built.

## Style your own control

To use a styled control as a link, opt into `asChild` with exactly one
element:

```tsx
<MockLink asChild to="account-detail">
  <button className="primary-action">View account</button>
</MockLink>
```

Mokly turns that one control into a native link during the build, keeping its
classes, inline styles, label and icons. Put attributes on the child, which
must have no interactive descendants. A disabled or busy control stays
inactive, and an adapted link keeps a visible keyboard focus outline.

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
