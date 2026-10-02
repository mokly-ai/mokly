---
title: "Links"
description: "Link one catalogue entry to another and keep the link portable."
section: "authoring"
order: 8
---

## Link by path

Use `MockLink` for a destination inside the catalogue. `to` names the entry,
and the separate `fragment` prop carries a bare HTML id.

```tsx
import { MockLink } from "@mokly/mokly";

<MockLink fragment="summary" to="account/billing/invoice">
  Invoice
</MockLink>;
```

`to` accepts three forms:

- the complete path, such as `account/billing/invoice`;
- a path relative to the linking entry's folder, starting with `./` or
  `../`, such as `./invoice` from any entry under `account/billing`;
- the imported definition of another entry module's export, which Mokly
  resolves to that entry's path when it builds.

```tsx
import { MockLink, mockLink } from "@mokly/mokly";
import invoice from "./invoice.mockup.js";

<MockLink to={invoice}>Invoice</MockLink>;

const detailsHref = mockLink("../billing/invoice", "summary");
// "mock:../billing/invoice#summary"
```

The string helper is `mockLink(to, fragment?)`, and both produce
`mock:<path>[#fragment]`, which you may also write by hand in an `href` or
`data-nav-href`. Neither helper accepts `path#fragment`, percent-encoded
syntax or a `mock:` value in `to`. A link may name any entry, including a
screen or component variant, a page or a Markdown document; a link to a
component opens its first variant. Inside a Markdown document, a relative link
to another `.md` file is a catalogue link too, and `mock:<path>` works there
as well.

## Style your own control

To use a styled control as a link, opt into `asChild` with exactly one
element:

```tsx
<MockLink asChild to="./invoice">
  <button className="primary-action">View invoice</button>
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

A link to a path that names no entry fails the build with the linking entry
and the path. When that path belonged to an entry that has since moved, the
message names the new path; links never follow a move on their own, so update
the link to the path you meant.

## In the catalogue

An eligible link opens its destination's canonical page at
`/view/<path>/`, carries the fragment and reveals the destination in the
navigation tree.
