---
title: "Links"
description: "Link catalogue entries and adapt styled controls while keeping portable destinations."
section: "authoring"
order: 8
---

## Link by catalogue path

Write a logical destination in an anchor's `href`.

```html
<a href="mock:account/invoice#summary">Invoice summary</a>
<a href="mock:./history">Payment history</a>
```

The destination can be any entry, including a component parent, a variant,
a page, a document, or a use case. A component parent opens its own props.
A use case's standalone link opens its first screen.

A complete path has no leading slash. A relative path starts with `./` or
`../`. It resolves from the linking entry's parent. An index entry uses its
own folder path. A variant uses its parent's base. A declared path follows
the same rules.

A relative link in a component body uses the component's own base, even when
a screen uses that component. Supplied slot content keeps its supplier's
base. Formatting or moving the receiving placeholder does not change it.

## Link to a heading

A `#fragment` names a bare HTML id. It can contain Unicode letters, numbers,
combining marks, underscores, colons, dots, and hyphens. It must exist in
every destination view that the catalogue can show. For a use case, it must
exist in every view of the first screen.

Use the same heading id in mobile, desktop, light, and dark output. A
missing target or anchor fails the build with the referring route. A target
that moved names its new path when a `movedFrom` hint is available.

## Adapt a styled control

Put `to` and an optional separate `fragment` on `a`, `button`, `div`, or
`span`. A component element can use them when it renders one supported root.

```html
<button class="primary" to="account/invoice" fragment="summary">
  View invoice
</button>
<ui-button label="Continue" to="account/checkout"></ui-button>
```

Mokly changes an active control into a native anchor. It keeps its classes,
inline styles, labels, icons, and applicable attributes. It removes button
form behavior and supplies a visible keyboard focus outline. A disabled,
busy, or inert control keeps its element and stays inactive.

`to` contains only a destination. Do not include `mock:`, `#fragment`, or
percent-encoded syntax there. Put the fragment in its own attribute.

## Place one interaction

A control cannot contain another link, button, input, editable region, or
inline event handler. It also cannot sit inside a link or editable region.
Those structures fail the build.

A control inside a button, label, summary, or interactive role produces a
warning. Focusable or structural-role content inside it can also warn.
Warnings keep the same rendered control. `build --strict` makes them fail
the build before output is written.

## Record a destination without activation

`data-nav-href="mock:account/invoice"` records a destination on any element.
It supplies no click or keyboard behavior. A logical `href` belongs only on
an HTML anchor or area, or an SVG anchor. Two navigation attributes on one
element must agree. A document with an active logical link cannot have
`base href`.

## Keep documents portable

Mokly rewrites logical links to relative document URLs. Screen links use the
source viewport and scheme, with light fallback. The catalogue uses the
logical destination to open its canonical `/view/account/invoice/` page.
Standalone documents keep native relative links.

A Markdown link to another discovered `.md` file becomes a catalogue link.
Markdown file destinations resolve from the source file, even when its
catalogue path changes. Public images and attachments use confined relative
paths. Links to private source files show their label as plain text.

Read the [navigation contract](/docs/reference/navigation/) and
[link control contract](/docs/reference/link-controls/) for the full rules.
