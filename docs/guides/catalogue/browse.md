---
title: "Browse"
description: "The catalogue is one place to open every screen and page your repository describes."
section: "catalogue"
order: 1
---

## The shell

`mokly serve` opens the catalogue: a navigation column on the left, the entry
in the middle and its details beside it. The navigation column is resizable,
and Specs and Components are separate collapsible sections with icons for
folders and for each kind of entry. Specs holds screens, pages, Markdown documents and flows;
Components holds your registered components. A folder that contains both
kinds appears in both sections, each showing only its own children.

Navigation and local controls are available as soon as the server starts. Each
preview is rendered when you open it, and the complete build and the
comparison with your Git base finish in the background without interrupting
what you are reading.

## Find your way

Every entry has the address `/view/<path>/`, so the tree is the directory
tree of your specs. A folder row only expands or collapses; it never changes
what you are looking at. An entry row opens the entry. When a folder has a
page of its own, from a Markdown `README.md` or `index.md` or a module's index
entry, that page is the folder's first row,
labelled Overview when its title is the folder's title, and the folder's
address `/view/<folder>/` opens it. A screen or component that is a folder's
page takes the folder's place in the tree, with the folder's other members
listed under it after its variants.

Breadcrumbs above an entry are the titles of its folders, and the entry's
path sits beside its title as a chip you can copy, so the name to use in a
link is always in front of you. A breadcrumb folder opens the folder's page
when it has one; otherwise it opens the folder in the tree, bringing up the
navigation drawer on a narrow screen. A link inside a screen opens its
destination's canonical page, carries its fragment and reveals it in the tree.

## Variants

A screen or registered component that declares variants shows a chevron on its
row. Opening it lists each variant beneath the parent, and choosing one opens
that variant as its own page with the parent's name in the breadcrumbs, which
links back to it. Search finds a variant by its own title and keeps its parent
in view. The details of a parent list its variants, and the details of a
variant name the parent it belongs to. Whether a list is open is remembered as
you move between entries and reload, and Collapse all closes it with everything
else.

## Look at a screen

The header carries the viewport controls. The top bar's Appearance selector
chooses Auto, Light or Dark for both the interface and previews. An embedded
viewer keeps a separate Light/Dark preview control under its host's theme.
A screen is framed in realistic browser chrome
that expands to an overlay, and the mobile view is framed as a phone whose
screen reserves the usual status band above your document.

Use-case flows read the same way, one step after another. A page fills the
stage as one document. Markdown documents follow the selected scheme; pages
without a dark rendering keep their light document.

## Details

The details inspector starts collapsed and remembers that choice as you move
between entries and reload. It holds what the entry is made of, what it
depends on and the evidence behind a change.

## While you work

A watched server reloads the catalogue when your sources change and restores
your search, your filter, the folders you opened, the viewport, the drawer
and your scroll position. Back and Forward return to the position you left.
Moving a file in a root moves its entry in the tree and in the breadcrumbs
after the reload.
