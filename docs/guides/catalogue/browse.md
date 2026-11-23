---
title: "Browse"
description: "The catalogue is one place to open every screen and page your repository describes."
section: "catalogue"
order: 1
---

## The shell

`mokly serve` opens the catalogue on a canvas: the selected entry stands in
the middle as one section of frames on a dot grid, the catalogue floats at the
left, and the right panel floats at the right while an entry is selected. The
catalogue is resizable, and Specs and Components are separate collapsible
sections with icons for folders and for each kind of entry. Specs holds
screens, pages, Markdown documents and flows; Components holds your registered
components. A folder that contains both kinds appears in both sections, each
showing only its own children.

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

The head of the entry's section names it and carries its path as a chip you
can copy, so the name to use in a link is always in front of you. In Inspect,
each folder in the entry's path is a breadcrumb. A breadcrumb folder opens the
folder's page when it has one; otherwise it opens the folder in the tree,
bringing up the catalogue sheet on a narrow screen. A link inside a screen
opens its destination's canonical page, carries its fragment and reveals it in
the tree.

## Variants

A screen or registered component that declares variants shows a chevron on its
row. Opening it lists each variant beneath the parent. A screen variant opens
as its own page, and a component variant opens the component's variant set
with that variant's Light frame selected.
[Search](/docs/catalogue/search-and-filters/) can find a variant and keeps its
parent in view. Inspect's Variants list names the entry first and then its
saved variants, so you can move between them there too. Whether a list is open
is remembered as you move between entries and reload, and Collapse all closes
it with everything else.

## Look at a screen

A screen opens as its frames: Desktop beside Mobile, and the Light row above
the Dark row. A screen without a dark view has its Light row alone. Each frame
lays out its view at a real device size, 1280 × 800 for desktop and 390 × 844
for mobile, and scales it with the zoom. The document scrolls inside its
frame. A label above the frame names it, such as Desktop · Light, and a tag
gives its size.

Each frame shows its own scheme, whatever the interface looks like. The top
bar's Appearance selector chooses Auto, Light or Dark for the interface. An
embedded viewer takes its appearance from its host, and keeps a Dark preview
control for a Markdown document when the catalogue has dark views.

In Inspect, Frames turns the Mobile, Desktop, Light and Dark frames on and
off, and the canvas refits around the frames that stay. A screen without a
dark view reads Light only on its Dark toggle, and a toggle that hides a
changed view carries a dot. The Highlight components switch beside the toggles
marks the registered components on every shown frame. Your choice stays as
you move between screens, and a full page load shows every frame again.

## Pan and zoom

An entry opens fitted: the largest zoom, up to 100%, at which every shown
frame fits. Drag the canvas around the frames, or scroll it with the wheel or
two fingers, to pan; on a touch screen, one finger pans. Over a frame, the
wheel scrolls that frame's document. Hold ⌘ or Ctrl while you scroll, or
pinch, to zoom about the pointer.

The zoom pill at the bottom of the canvas holds Zoom out, the zoom, Zoom in
and Fit. Outside a text field, `+` and `-` step the zoom, Shift+0 shows 100%
and Shift+1 fits again. After you pan or zoom, the canvas stays where you put
it until you fit it again, change the frames or open another entry.

## Components, flows and documents

A component opens as its variant set: a row for its own example, then one row
for each saved variant, each with its Light frame beside its Dark frame. Each
frame takes the size of the component's own document, and Frames has the
Light and Dark toggles alone.

A flow opens as one row of step frames, in step order. Under Frames, choose
Mobile or Desktop and Light or Dark for every step. A flow opens on Desktop
and Light, or on Mobile and Light on a narrow screen, and keeps its own choice
apart from the screens. The title in each step's label opens that step's
screen.

A page or a Markdown document opens as one reading frame. A Markdown document
follows the interface appearance, and one without a dark rendering keeps its
light document, labelled Light only. A page keeps its one light document.

## On a narrow screen

Below 900px wide, the canvas shows one frame at a time. The bar at the top
names the entry, and its Frame picker chooses the frame. A screen opens on its
Mobile · Light frame, and a pinch zooms. The dock at the bottom holds
Catalogue, the right panel's current tab, Inspect or Changes, and Fit.
Catalogue and the tab each open their panel as a sheet from the bottom of the
screen, and the sheet's grabber expands it. While you have an element
selected, a pill above the dock names it and opens the panel.

## Inspect and Changes

The right panel holds the Inspect tab and, when Changes lists the entry or the
entry can be compared, the Changes tab. Inspect describes the entry and the
element you select on a frame, as [Details](/docs/catalogue/details/)
explains. Changes holds the entry's comparison with your base, as
[Changes](/docs/catalogue/changes/) explains. The selected tab also sets what
a click on a frame does: Inspect selects, and Changes only compares.

## While you work

A watched server reloads the catalogue when your sources change and restores
your search, your filter, the folders you opened, the frames you chose and
your scroll position. Back and Forward return to the position you left.
Moving a file in a root moves its entry in the tree and in the breadcrumbs
after the reload.
