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

A fragment starts with an ASCII letter, followed by letters, digits, `_`, `:`,
`.` or `-`. Any entry except a collection can be a destination. A link to a
use-case flow opens the flow, and its fragment applies to the flow's first
screen.

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
must have no interactive descendants. An adapted link keeps a visible keyboard
focus outline.

The child renders exactly one root element: an HTML `a`, `button`, `div` or
`span` with no role, `role="button"` or `role="link"`, and no inline event
handlers. An `href` or `data-nav-href` it already carries must name the same
destination. A component that needs a handler such as `onPress` to render
enabled still needs one, although the handler never runs in the catalogue.

Once adapted, the control is an `a` element, so styles that select its
original tag stop matching and button form attributes are dropped. It keeps
its original display: a `div` stays a block, and a `button` stays
`inline-block` and fits its content unless you give it a width, including when
a flex or grid parent would otherwise stretch it. Native button chrome and
hover or pressed effects that rely on JavaScript are not reproduced, so style
the control with your own CSS.

A control stays inactive when it is `disabled`, `inert`, `aria-disabled="true"`
or `aria-busy="true"`, or when it sits inside an element marked `inert`,
`aria-disabled="true"` or `aria-busy="true"` or inside a disabled `fieldset`.
It keeps its appearance without becoming a link, and the build still checks its
destination.

## Metadata without an interaction

`data-nav-href` records a logical destination on any element without inventing
a click or a keyboard behaviour. A logical `href` belongs only on an HTML `a`
or `area` or an SVG `a`; anywhere else it fails the build rather than becoming
an accidental resource request.

## What the build checks

Generated files keep portable relative links, so standalone documents and
comparison snapshots still navigate. The build validates every destination and
every fragment, and a fragment must exist in each generated view the catalogue
may show for that destination. A document that contains an activatable logical
link must not contain a `base href`. Root-absolute links and links into your
source tree are rejected as non-portable; use a relative URL for a real static
asset or a complete document.

## In the catalogue

An eligible link opens its destination's canonical page, carries the fragment
and reveals the destination in the navigation tree. With a modifier key, the
middle mouse button, `target="_blank"` or a named target, it opens that page in
a new tab instead. External, download, same-page and other relative links
stay inside the screen's frame. Scripts in your screens do not run in the
catalogue, so show each state as its own screen or variant.
