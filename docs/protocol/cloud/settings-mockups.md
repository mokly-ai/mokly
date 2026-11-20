# Settings Mockups

This is the mockup sub-contract of [Settings dialog](./settings-dialog.md).

## Mockup Representation

The static catalogue renders the dialog with the registered `settings-dialog`
frame over a blank cloud stage placeholder in both schemes. The mobile view
renders the same pane component inside the registered `settings-layer` frame.
The placeholder has blank slots, no controls and no landmark. The dialog is
the subject of these entries. Each pane's screen entry draws its canonical state, with its empty,
loading and error states as variants. The screen root keeps the
document's single `main` landmark and `h1`, and the page beneath is
`aria-hidden` with no landmark of its own. Pane paths are `product/settings/<pane>`, and the index is
`product/settings/sections`.

A situation none of the four states describes has its own component and its
own entry, so no state is asked to mean two things. It is a variant of its pane
while the pane stays within four variants, and otherwise a screen beside the
pane in the pane's folder: `product/settings/project/visibility` is the visibility
confirmation in flight over the pane, a write apart from the name's,
`product/settings/members/identity` manages someone whose only name is their email
address, and `product/settings/workspace/suspended` and
`product/settings/workspace/absent` are the GitHub accounts fact's own two
situations. The GitHub accounts pane, `product/settings/github`, has three such
situations: `product/settings/github/suspended` draws a suspended account with
its Resume on GitHub link, `product/settings/github/member` draws the rows that
a member reads, and `product/settings/github/menu` draws a row menu open. With
the pane's three states they do not fit four variants, so each is a screen
beside the pane. A
modal a pane opens is drawn the same way, as a screen whose further drawings
are its variants. `product/settings/project/visibility` carries the free-plan refusal
read by an owner (`product/settings/project/visibility/plan`) and by an admin
(`product/settings/project/visibility/plan-admin`); `product/settings/tokens/create` carries the reveal
and copy drawings; `product/settings/tokens/revoke` carries the row menu; and
`product/settings/members/remove` and `product/settings/github/remove` carry
their working states. `product/settings/workspace/plan` draws a downgraded
workspace whose private project takes no new publication, and
`product/settings/workspace/plan-member` gives the same consequence to someone who
asks an owner. `product/settings/workspace/slug` and `product/settings/project/slug` own the
two address edits. The Billing pane's situations, including delayed
confirmation, are listed in [Product mockups](./product-mockups-settings.md#settings).
The project pane draws the Automatic builds switch beneath the project's facts,
and its variant `product/settings/project/no-builds` draws a project that
cannot build, where one sentence replaces the switch.
Every pane is registered once, desktop and mobile views share the component,
the page beneath stays inert, a pane opens one overlay at a time — its row
menu or one confirmation modal — and no overlay opens a layer of its own, and
each declared situation is registered where it says it is. Policy tests
enforce these rules. The screen inventory is in
[Product mockups](./product-mockups.md).
