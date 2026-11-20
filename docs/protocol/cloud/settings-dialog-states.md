# Settings Dialog States

This is the pane state sub-contract of [Settings dialog](./settings-dialog.md):
what a pane draws while it loads and while it writes, how it reports a failure,
and how it edits a name or an address.

## Loading, Writes And Failures

Each pane has default, empty, loading and error states as defined by the
mockup inventory. Loading keeps the rail and pane landmarks, and each pane
draws its own [wait](./folio-chrome.md#compositions). While the settings scope
loads, the rail draws the sections that the address's scope gives an owner,
and the pane draws the requested pane's wait.
A pane that fails to load says so where the pane would be, with one retry.
A write that fails says why beside the control that made it, and that control
becomes the way to try again, so the operation is named by the control and the
cause by the message; a failure never appears beside a control that would do
something else. A refusal the unchanged request cannot overcome — a plan gate,
an active subscription, unavailable builds, an ineligible pull request, a
permission, a duplicate, a last owner, an existing member or an expired
invitation — keeps the control's resting label rather than relabelling it Try
again. Its cause and reference still draw in the same place. Both kinds draw
the [write failure](./folio-chrome.md#compositions) composition: one shared
fragment, the cause above the control and the reference Mokly answered with in
a collapsed `Details` disclosure beneath it. A failure raised in the browser —
a clipboard that refused the revealed token — carries no reference, so it draws
none. Pending forms name the operation on the control that sent it while it
runs — "Saving…", "Revoking…", "Making public…" — and refuse a second press
until it is done, as [write in progress](./folio-chrome.md#compositions)
defines; two writes in one pane each keep their own control, so the visibility
confirmation stays on screen and pressable while a name is being saved. A
pane that fails to load never closes the dialog.

When the free plan refuses **Make private** with `plan-required`, the
write-failure composition stays inside the visibility modal. An owner gets
**Open billing**, which replaces the Project pane with Billing and therefore
leaves the modal; every other project administrator gets “Ask an owner to
upgrade to Team.” The modal keeps the separate name draft beneath it unchanged.

## Names And Addresses

Name and slug use separate controls, but each sends the full required update
body with the resource's current version. Owners and admins may change a
workspace slug; effective project admins may change a project slug. Each
pane shows the current address and the API's suggested recovery for a taken or
reserved value. A successful rename replaces the route with the current slug,
while old links keep resolving. `settingsProject` remains a project UUID so an
onboarding or settings draft keeps stable scope across a rename.

Address editing is a nested view of its owning pane. Its title replaces the
surface heading and dialog accessible name with “Workspace address” or
“Project address”; it adds no second pane heading. A successful address save
replaces the route with the current slug, refreshes the settings scope and
settles the saved draft, preserving the working page's viewer query and
settings state. Only a working route that names the edited resource changes
its slug segments. Settings over a static onboarding route retain that route
and its UUID scope parameters after a rename.
