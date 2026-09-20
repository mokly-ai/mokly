---
title: "Browse"
description: "The catalogue is one place to open every screen your repository describes."
section: "catalogue"
order: 1
---

## The shell

`mokly serve` opens the catalogue: a navigation column on the left, the screen
in the middle and its details beside it. The navigation column is resizable,
and Pages and Components are separate collapsible sections with icons for
folders and for each kind of entry.

Navigation and local controls are available as soon as the server starts. Each
preview is rendered when you open it, and the complete build and the
comparison with your Git base finish in the background without interrupting
what you are reading.

## Find your way

Breadcrumbs above a screen come from the collection hierarchy and end in a
copyable id chip, so the name to use in a link is always in front of you. A
link inside a screen opens its destination's canonical page, carries its
fragment and reveals it in the tree.

## Variants

A screen that declares variants shows a chevron on its row. Opening it lists
each variant beneath the screen, and choosing one opens that variant as its
own page with the parent's name in the breadcrumbs, which links back to it.
Search finds a variant by its own title and keeps the screen above it in view.
The details of a screen list its variants, and the details of a variant name
the screen it belongs to. Whether a list is open is remembered as you move
between screens and reload, and Collapse all closes it with everything else.

## Look at a screen

The header carries the viewport controls, and a Light and Dark switch once the
catalogue has dark documents. A screen is framed in realistic browser chrome
that expands to an overlay, and the mobile view is framed as a phone whose
screen reserves the usual status band above your document.

Use-case flows read the same way, one step after another.

## Details

The details inspector starts collapsed and remembers that choice as you move
between screens and reload. It holds what the screen is made of, what it
depends on and the evidence behind a change.

## While you work

A watched server reloads the catalogue when your sources change and restores
your search, your filter, the collections you opened, the viewport, the drawer
and your scroll position. Back and Forward return to the position you left.
