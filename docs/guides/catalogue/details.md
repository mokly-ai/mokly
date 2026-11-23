---
title: "Details"
description: "The evidence behind a screen, beside the screen."
section: "catalogue"
order: 4
---

## Open the right panel

While an entry is selected, the right panel floats at the right edge of the
canvas. On a narrow screen, the dock opens it as a sheet. Its Inspect tab
describes the entry. Its Changes tab compares the entry with your base, as
[Changes](/docs/catalogue/changes/) describes, and shows when Changes lists
the entry or the entry can be compared. A full page load opens Inspect, and
the tab you choose stays as you move to another entry that has it.

## What Inspect holds

Inspect lists these parts from the top, each when the entry has it:

- The entry's title, its kind, its change status and its description, then
  its details: its path and source file, the address that a screen declares,
  the previous path when Changes paired a moved entry, its schemes, the views
  that changed, its tags as chips you can search from, its related documents
  and the flows that use it.
- The rationale, under a heading such as Why this screen.
- Variants: the entry and its saved variants. Choose one to open it.
- Frames: the toggles of the frames that the canvas shows, and the Highlight
  components switch.
- Selection: the element or the frame that you selected on the canvas.
- Props, Usage and Components, folded until you open them. Usage lists where
  a component is used and the screens that its change affects. Components
  lists the component instances of a frame; a composed component names it
  Nested components.

A Markdown document's Inspect holds its head alone. Catalogue-wide usage is
explicitly unavailable until the background check has finished; it is never
shown as zero consumers.

## Select on a frame

While Inspect is the selected tab, click an element on a frame to select the
innermost component under the pointer. The canvas outlines it with handles
and tags for its component and its size. Selection then lists the props and
slots that it received, its size and box model, and its component's source
file, and its component chip opens the component's page. Selecting an
instance under Components does the same. Click the empty canvas, or press
Escape, to clear the selection. A click that follows a link selects nothing,
and so does a click while Changes is the selected tab.

## Stylesheet evidence

The comparison details hold the evidence behind a change. They follow the
compare modes in the Changes tab, and an entry without a Changes tab keeps
them in Inspect, after its head. There they start with the branch point that
Changes compares with, when the catalogue knows its name. The sentence stays
while the next entry's details load. A catalogue embedded in another product
has no name, so its evidence leaves that sentence out and keeps the rest.

When a stylesheet you link has changed, the comparison details name the
changed styles that apply to this screen outside the components changed by
those styles, or say the change can apply anywhere on it.
A stylesheet whose changed styles reach nothing on the screen is listed as
examined and excluded instead, and never produces a Changes row. Selector text
stays inside that secondary list, and a screen kept only by a stylesheet edit
reads "Styles this screen uses changed" in a loaded comparison.

The comparison details show this evidence in Current, before you choose
another compare mode, for screens and component pages alike. Another mode
keeps those details and adds the evidence it retained. Each stylesheet is
listed once, with its own sentences and selector lists beneath it. For
outside matches, the text says “These changed styles also apply outside the
changed components on this screen:”. If no component changed through those
rules, it says “Changed styles that apply to this screen:”. A rule inside an
unchanged component invocation can appear in that list. Uncertain changes
have a separate explanation beside it.

A component-only style change can leave a screen under Affected screens with
no Changes row of its own. That screen keeps the changed styles it uses, links
each changed component, and ends its comparison details with “Changed
components that this screen uses affect its preview.” A component in that
position ends with “Changed components that this variant uses affect its
preview.” A saved variant links the changed components that its own views
use, and its parent links only those that the parent's own views use. On the
component's own page the comparison details say “Changed styles that apply to
this component:”. A component page with only a wrapper change has its own
Changes row, says “Changed styles that apply to this variant:”, and that rule
gives it no Affected screens. The comparison details name the stylesheet
actually loaded, including a generated stylesheet when CSS comes from
JavaScript. Private source files do not supply comparison evidence.

A document page has no compare mode, but its comparison details carry the same
evidence once Changes is ready, with “page” in each sentence, for example
“Changed styles that apply to this page:”. Its status sits beside its title. An
unchanged document that links an examined stylesheet ends with “No changes to
this page.”

## Component props

A component opens as its variant set, and its Props section edits one saved
variant: the variant of the selected frame, or of the frame that holds the
selected element. Choose a variant under Variants, or click a frame's label,
to select its frame; while nothing is selected, Props asks you to choose a
variant. While serving locally you can edit text, boolean, number and preset
controls and see the result immediately; Reset restores the variant's declared
props. A published catalogue keeps the variants and the inspection with the
controls read only.

Serve and exported shells can also show changed saved inputs as Before and
Current props. Embedded viewers show current props only: their public catalogue
has no branch-point usage data from which to show input changes, moved or not.
