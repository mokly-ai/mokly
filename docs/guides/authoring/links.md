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
screen or component variant, a page or a Markdown document; a link to a component
opens its first variant. In Markdown, a relative link to another discovered
`.md` file becomes a catalogue link. `mock:<path>` works there too.

Relative links share the same base as flow references: an ordinary entry uses
its parent path, an index uses its own folder path, and a variant uses its
parent entry's base. Declared paths follow those same rules.

## Style your own control

To use a styled control as a link, opt into `asChild` with exactly one
element:

```tsx
import { MockLink } from "@mokly/mokly";

<MockLink asChild to="./invoice">
  <button className="primary-action">View invoice</button>
</MockLink>;
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

A link to a path that names no entry fails the build with the linking entry
and the path. When a current entry declares that old path in `movedFrom`, the
error names the new path. Later preview renders can also use move pairs accepted
for the same comparison generation. Initial builds use authored hints only.
Links never follow a move automatically; update the destination.

## In the catalogue

An eligible link opens its destination's canonical page at
`/view/<path>/`, carries the fragment and reveals the destination in the
navigation tree.
