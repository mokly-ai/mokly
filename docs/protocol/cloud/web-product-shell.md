# Web Product Shell

Status: The five-action bar, the account menu and the More sheet of a touch viewport are not built yet. [Milestone 13](../../../plans/canvas-redesign-milestones-viewer.md#milestone-13-cloud-viewer-chrome) builds them.

The signed-in web application composes the settings surfaces and the published
viewer into one browser-history contract. Read [Web application](./web-app.md)
for routes, sessions and API access, [Settings dialog](./settings-dialog.md) for
the pane contract, and [Viewer](./viewer.md) for the package host contract.

## Settings

One registry owns the panes and their sections, and also which roles read each
one: `billing` is shown to owners and admins alone, and a pane a member asks
for by address opens the first one they may read instead. Desktop renders the
panes as a dialog over whatever product page the reader is on, addressed by
`?settings=<pane>`; the compact width renders the same panes as the
full-screen routes. What each surface costs in history entries is specified
once, in the history table below;
[the settings dialog](./settings-dialog.md) owns everything else about the
panes.

Close names the page beneath and undoes the entry the trigger pushed when there
is one, so it closes in one press — even when the reader reached the pane
through a settings address, because a pane switch replaces and the entry
beneath is therefore that page. The history table below is the one home of that
rule, and a control inside a pane that leaves settings asks the same question
first — except a destructive action the reader has already confirmed by name,
which leaves without asking again and forgets what was unsaved on the way.
Unsaved text belongs to settings rather than to either presentation of it, so
switching panes and crossing the breakpoint keep it; whether it would be lost
is a comparison against the saved value, so a save settles the field without
the pane resetting anything.

A pane has four ways out and no other: back to the page settings was opened
over — the page beneath on the dialog, `/dashboard` on the full-screen layer;
to another address in the product; by an act that leaves settings without
naming a destination, which is how signing out works; and after an act the
reader has already confirmed by name and cannot undo, which is the only one
that does not ask. All four forget what was unsaved once the reader has
answered. A pane reaches or lists other panes by pane, never by address, and a
pane switch follows the surface's own rule about whether it is a step the
reader can take back.

The router owns paths and the application owns the query. A change that alters
only the query of the current path — the viewer's selection and panel, and the
settings dialog's open, pane switch and close — is written to the address, not
routed, and a later traversal still resolves against the navigation state the
router built. Each surface edits only the keys it owns, so a corrected viewer
value keeps the `settings` the same address asked for. How deep the stack goes
is the application's own contract — one entry per overlay, undone rather than
written over, which is what makes one press of Back leave the publication —
and the router has no equivalent of it. The address the reader is at is the
value every surface reads, however it came to be the address: a component
never guesses which effect ran first.

A router navigation is a move to another address, and it starts from the query
the reader is on rather than from nothing: resolving a reference alias hands
the alias's whole query to the publication it resolved to, minus the keys
naming the reference the address has stopped describing. A reader who opens a
shared link with the account dialog named gets the dialog.

The catalogue screen key is `catalogueScreen` — the name the API mints, the
check run links and the application writes back. The key `screen` was
rejected because React Navigation reserves it for navigating into a nested
navigator, and a key the router claims is not a key this contract can own. The
application neither reads nor writes `screen`, and the one navigation that
carries a reader's own query into the router drops it, so the property is the
application's own rather than a borrowed one.

What each surface costs the history stack:

| Action                                                                  | Operation                  |
| ----------------------------------------------------------------------- | -------------------------- |
| Open a viewer panel, or open the settings dialog                        | push one entry             |
| Close an overlay the application opened                                 | undo that entry (`back()`) |
| Switch pane, correct a value, change the selection, move between panels | replace                    |
| Clear the Checkout return parameter from the billing pane's address     | replace                    |
| Resolve a reference alias, open another publication or project          | router navigation          |

Closing an overlay undoes the entry rather than writing another over it, so
the stack stays exactly as deep as the reader's own steps made it and one press
of Back leaves the publication. Panels and the settings dialog obey the same
rule, because one overlay is one entry: reaching a second panel from an open
one replaces, so there is never more than one to undo. A traversal the reader
makes themselves forgets which entries were the application's, so a close
after one replaces instead — which is safe, never leaving the application.

A draft is defended against two kinds of exit. The ones that stay inside the
running document — the back and forward gestures over entries the application
itself created — are stopped before the router acts on them: the reader is
returned to where the gesture started and asked, and choosing to discard
completes the gesture rather than navigating somewhere of the surface's own
choosing. The ones that leave the document — back to a page loaded before it,
a reload, a typed address, a closed tab — cannot be stopped by the page at all,
so the browser's own prompt covers them, in place for exactly as long as a
draft exists. A surface opened from a bookmark or a shared link is the first
document in its own history, so every way out of it is of the second kind.

The dialog is the package's `WebModalFrame`, which supplies the portal, the
focus trap, the inert page beneath, Escape and backdrop dismissal, and whose
`title` is the dialog's accessible name. Its own header is hidden from view and
from assistive technology, because the composition inside it is the
catalogue's registered one: the section rail at full height beside a pane whose
bar carries the pane's single `h1` and a text Close. The surface is at least
700px tall and at most 90dvh, so a short pane is not mostly empty and most pane
switches leave the frame exactly where it was; only a pane taller than the
floor grows, and never past the cap. A pane taller than the cap scrolls inside
the pane body, which is the dialog's only scroll region: the rail and the
pane's bar stay where they are while its content moves. Focus lands on the rail
row for the pane the reader asked for, and the page beneath keeps no landmark,
heading or document title while the dialog owns them.

Project panes appear only when a project is in scope; an empty `settings` value
shows the index and an unknown one opens the first available pane. The settings
index names no project, so it resolves the reader's last opened or first
accessible one, which is how the compact index reaches the project panes.

One link works on every surface in both directions: on a wide surface the
durable account, workspace and project settings routes redirect onto the page the reader would be on
with the dialog open, and below the breakpoint `?settings=<pane>` redirects to
that pane's durable route, where the compact surface draws it.

A pane holding an unsaved draft is not closed by Escape, the backdrop, Close,
the compact surface's Back, or the browser's own back gesture. Every one of
those ways out shows the discard confirmation inside the pane instead; Cancel
keeps both the draft and the surface. The Escape that lands in the same frame
as the keystroke before it still protects the draft. The confirmation is never
a second dialog.

## Viewer

The package host of [Viewer host](./viewer-host.md#package-host) mounts the
workspace `@mokly/viewer` only for a ready, unexpired publication the reader has
already been let into, with the app chrome's scheme as its interface `theme`.
Non-ready states retain one cloud-owned card. The viewer route owns the
complete controlled selection, its cloud `main` landmark and visually hidden
`h1`. The published package's landmark limit is recorded below.

The route resolves one address to one publication or build, draws and follows
a [cloud build](./viewer-builds.md), and maps the URL keys to the package
selection and back without losing a variant entry, a previous version's
snapshot, Both, search or tags. It constrains only the screen the narrower
Share API can represent and never validates package route state. It exchanges
the catalogue grant with readiness scoped to the exact publication attempt,
polls for a newer publication on this reference, and returns focus to the
current trigger of the action that opened an overlay. Every value shown comes
from the API's session, workspace, project, reference, publication, history,
build, build-log, screen, share-link and catalogue-grant reads, and the stage's
build controls write through the API's build request and cancel operations.

The route keeps the stage ancestor as one element when a panel, settings or
the **More** sheet of a touch viewport opens. It has `id="main"` and
`role="main"` only while none of them is open; its heading and cloud skip link
follow that same condition. Opening one changes the stage's geometry and
`aria-hidden` state without remounting the package, so its frames are
preserved. The hidden ancestor gives up its accessible landmark and heading
while the panel, the dialog or the **More** sheet owns the document.

Query-only Back can reconstruct an Expo route. The browser document keeps one
active origin/credential source and its version error across that
reconstruction; a new origin or credential policy replaces the source and
clears the error. The source keeps the catalogue index it read, so a
reconstruction does not read it again. A reload creates a new
document scope and starts fresh.

The adapter composes the five cloud actions of
[Viewer chrome](./viewer-chrome.md#slot-inventory) into package `topBarStart`
and `topBarEnd`; the package keeps its own catalogue and stage. Each panel
trigger opens exactly one overlay, and the account trigger and **More** open a
[menu](./viewer-chrome-account.md#menus) instead. The settings dialog and the
four panels are the same overlay position: the address decides which, and the
viewer gives up its landmark and heading the moment the address says so rather
than a frame later. Focus returns to the current trigger of the logical action
that the press came from. Opening an overlay keeps that chrome mounted; a
fallback/package handoff, a route reconstruction or a change between the full
and compact bar can replace its controls. Opening a panel pushes one history
entry; closing undoes it.

The viewer also draws its own `main` and skip link. Its public React
API provides no host control for those elements. The ready state therefore has
two nested main landmarks and two skip links. Under an overlay the cloud body
gives up its role, but the hidden package `main` stays beside the overlay's
`main`. Complete DOM parity needs a published viewer API for landmark ownership.
Cloud must not rewrite the package's DOM or replace its shell to work around
this limit.

The package selection mapping uses `screenPath`.
The host does not subscribe to `onScreenNavigate`; `onSelectionChange` is the
only package proposal that writes the URL. The public navigation event also
uses `screenPath`, but its package type adds no host URL writer.
`catalogueScreen` carries that path with the grammar and existing 2048-byte limit in
[Viewer address state](./viewer-address-state.md). The stable source reads
`mokly-viewer/index.json` and the entry details, which the package validates
as index 9 and detail 4. Typed version failures use the
existing stage failure surface, the upstream headline and a secondary Details
disclosure per [Viewer host](./viewer-host.md#version-failure).

The desktop shell of [Desktop application](./desktop-app.md) serves this web
route from its bundled export at the desktop origin, which the API and the
catalogue hosts admit, so the catalogue frames and the access-grant cookie
work as in a browser. Managed screen frames remain subject to the
[current viewer limit](./desktop-app.md#current-viewer-limit). iOS and Android host
the web viewer route in a web view with native chrome around it, and receive
the catalogue access-grant cookie rather than the app session. No mobile build
ships in this scope; the web route is what a native header drives.

## Outbound Links

The public site — Home, Docs, Pricing, Changelog, Terms, Privacy, Complaints,
Security and the CI setup guide — lives in this repository's static `apps/site`
npm workspace on the app's public origin. The app reads the API origin from
`EXPO_PUBLIC_MKC_API_ORIGIN`, with a local default. The addresses the product
shows use the public app origin from `EXPO_PUBLIC_MKC_APP_ORIGIN`, else the
tab's origin, else `http://localhost:8081`; the desktop shell and runtimes
without a browser use that local fallback when the origin is unconfigured.
There is no site-origin build argument. In a browser tab, site links use the
tab's own origin, even when the configured public app origin differs; native
surfaces and the desktop shell use the public app origin. The app recognizes
the desktop shell by the page's `mokly-app:` protocol. The boundary is
[Marketing site](./marketing-site.md).

An action follows its `href`. An application route goes to the router. An
address that leaves the application, such as the site's CI setup guide, opens
in the same tab from the page itself, and an address whose scheme runs in the
page, such as `javascript:`, is never followed. The package Button renders no
anchor and takes no wrapper, so such an action stays one control. An action
that opens a known address in this tab names it through `href`, never in a
press handler of its own: **Publish from CI** on the project created page, and
**Set up publishing** on the stage, the switcher and the share panel. Both open
the site's CI setup guide. The viewer's panel host gives the panels that
address only for a reader who administers the project. An address that the flow
builds from what the API returns after a press, such as GitHub's authorization
page, a Stripe page or the `mokly://` address of the desktop connect page's
**Open Mokly**, is assigned by the flow that requested it. In the desktop
shell, the GitHub actions open their web pages as popups instead, as
[Desktop application](./desktop-app.md#web-setup) defines.
