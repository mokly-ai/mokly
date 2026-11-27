# Viewer Chrome

This is the slot and publication-chrome sub-contract of [Viewer](./viewer.md).
The slots are those of the workspace `@mokly/viewer` of
[Viewer host](./viewer-host.md). The account trigger, the account menu and its
Theme choice are in
[Viewer chrome: account menu](./viewer-chrome-account.md), and the check in the
Changes tab in [Viewer chrome: check slot](./viewer-chrome-check.md).

## Slot Inventory

The package exposes `topBarStart`, `topBarCenter`, `topBarEnd`, `railStart`,
`railEnd`, `changesStart`, `sidePanel`, `stageOverlay` and `emptyState`.
`changesStart` is the one host slot of its Changes tab, which holds a check.
Cloud composes its five actions into the three top-bar slots: the workspace and
project switcher, the publication, History, Share and the account. The package
bar draws its mark, then `topBarStart`; `topBarCenter` in the middle of the bar,
or right after the mark while `topBarStart` is empty; then its search, its end
control and `topBarEnd`. When the bar's own width fits all five beside the
package's own controls, the project fills `topBarStart`, the publication pill
fills `topBarCenter` with its Changes badge, its pull request on GitHub and View
latest beside it when each applies, and history, share and account fill
`topBarEnd`. The bar has no Settings action and no theme toggle: Settings and
Theme are rows of the [account menu](./viewer-chrome-account.md#account-menu).
Decision: Settings and Theme sit in the account menu rather than in the bar, so
that the bar holds only the navigation, the publication and the actions on it.
Cloud-owned wrappers constrain variable workspace, project and reference labels
to one line with truncation when needed, while preserving their complete
accessible names and tooltips. Fixed actions and the package's own controls
remain readable and never overlap at supported widths. Workspace display names
remain separate from route slugs; a reader without workspace metadata can use
the project response's real workspace slug as its label. One switch width in rem
chooses the layout: the narrowest bar that keeps every control of the full
layout whole beside the package's own, also with the Mac window's buttons at one
side. It does not count the preview scheme switch that the package draws for a
catalogue with dark previews, so just above it that catalogue's search can cut
its placeholder; the switch leaves the bar later. As the full bar narrows, it
drops the pill's short SHA, then History's label, which keeps its glyph,
accessible name and tooltip, then the pill's state phrase, whose dot stays. When
the bar's own width is too narrow for all five, as on mobile, the publication
stays in `topBarCenter`, right after the mark, `topBarStart` stays empty, and a
Firna **More** menu in `topBarEnd` carries the project, history and share, then
the [account rows](./viewer-chrome-account.md#more). This keeps the package's
48px top bar intact instead of adding a second row. The choice between the two
layouts follows the bar's own width rather than the window width or a higher
compact breakpoint, because that breakpoint also moves settings and touch
targets across the product. Choosing the project, history or share closes the
menu and opens the same cloud overlay as its desktop control. Dismissing an
overlay returns focus to the current trigger of the cloud action that opened
it: **More** while the compact bar groups that action, or the action's own
trigger while the bar shows it, in whichever slot holds it. That focus
obligation belongs to the logical action across the cloud fallback, the
package loader, the ready package shell and a change between the two layouts.
Restoration is bounded: it ends when the reader focuses another control,
interacts again, opens another overlay or leaves the route. The package keeps
its own top bar and catalogue. Cloud also fills the
Changes tab's [check slot](./viewer-chrome-check.md) and, for a private
comparison, `stageOverlay`, as the [private artifact
limit](./viewer.md#private-artifact-limit) defines. It leaves `railStart`,
`railEnd`, `sidePanel` and `emptyState` empty. Each panel trigger opens one
cloud overlay, the account trigger and **More** open a menu, and only one
overlay is open at a time.

In the Mac desktop app, the cloud gives the package bar its window insets, so
the package's mark starts after the window buttons that [Desktop bundle and
origin](./desktop-bundle.md#mac-window) places at the start of the bar, and the
cloud's slots follow it. The cloud fallback bar keeps its own padding clear of
the buttons. The cloud's slot content is the part of the bar that moves the
window, and it reaches over the space between the project and the pill, and
between the compact pill and the search. The package's own part does not.

A press that begins on a cloud fallback control also finishes on that logical
slot. If access becomes ready while the primary pointer or Space/Enter
activation is held, the original control still delivers its activation, and an
open **More** menu survives the handoff. Releasing off the logical slot,
pointer cancellation, window blur or another deliberate interaction cancels
the held activation without opening anything. This is host lifecycle around
the documented React slots, not a package event or a replacement for its
loader. A settled package control remains package-owned for its complete
native pointer or keyboard activation and never causes the host to render the
fallback again.

| Slot          | Trigger                                                    | Opens                                                                                                           |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `project`     | Workspace and project                                      | The workspaces the user can access, their projects, Create project, and Workspace settings for administrators   |
| `publication` | The publication pill: the branch or pull request and state | Branches with the default first, then pull requests, each row showing its publication state, time and short SHA |
| `history`     | History                                                    | This branch's publications and, for members, its builds, newest first, each an immutable link                   |
| `share`       | Share                                                      | The canonical publication link with the API-supported screen/view projection and Copy link                      |
| `account`     | The reader's avatar                                        | The account menu: who is signed in, Theme, Settings, Docs, Changelog and Sign out                               |

The project trigger uses the workspace display name when its authorized
read succeeds and the readable slug while that optional read is pending or
unavailable.

Every panel trigger says what it opens and whether it is open with
`aria-haspopup="dialog"` and `aria-expanded`. The account trigger and, on
compact widths, **More** use `aria-haspopup="menu"` and report the menu itself
as expanded; More's rows open the same dialogs as the desktop triggers. One
cloud overlay is open at a time. While an overlay is open the whole chrome
beneath it is `aria-hidden`, which is what makes the overlay the only thing on
the page: the expanded value is recorded rather than announced, and what the
reader hears is the dialog's own name. The cloud stage's stable `div` gives up
its landmark and heading while the overlay owns the document. The stage and its
trigger controls stay mounted. The published package's main and skip-link
limit is recorded in [Web product shell](./web-product-shell.md#viewer).

Every panel is total over the states the route can be in: a panel that needs a
publication the address does not have says so in its own body — share offers
Set up publishing, history offers the switcher — rather than opening over an
empty one, and `panel=share` on a reference with nothing published is an
invalid optional value the route corrects away. A panel whose read fails
replaces the body of that read with the failed operation and one Try again,
which is what a settings pane already does; the panel and the chrome stay where
they are. A panel that makes more than one read answers for each separately and
keeps the sections that succeeded: share reads the link and, for a publication
with a comparison, its screens, so a failed link leaves the screen choice
standing and a failed screen list leaves the link.

Share waits while the route resolves the address. When the address names a
screen of a publication with a comparison, Share also waits for the screen
list. That wait ends when the list has loaded, failed or
[stopped at its cap](./viewer.md#address-and-history). While Share waits, it
requests no link, shows **Preparing the publication link** and offers no link
to copy. When the screen list fails, Share offers the publication-level link.
Decision: Share waits rather than showing the publication-level link first,
because a reader who copies at once would share the publication instead of the
screen.

### Workspace Role

A project with no publication shows the stage's **Set up publishing** card:
administrators get Set up publishing, and everyone else is told an
administrator publishes this project and offered the publication switcher,
which the catalogue draws as `product/viewer/standalone/reader`. A private project uses
the project response's `publishingAllowed` capability, which is always true for
a public project and applies the plan only to a private project. A direct
project administrator on Team is offered Set up publishing without gaining
access to the workspace or its billing.

The empty stage's plan card and a build card's plan refusal use one
workspace-role read rule. While the read is pending, offer no card action
or owner-specific copy. `not-found` means this reader is not an owner. Any
other failure replaces the plan card with **This workspace couldn’t load**, its request
reference and Try again, which repeats the workspace read. A failed read
never tells an owner to ask an owner.
`product/viewer/standalone/workspace-unreadable` draws this read failure.
Once the role resolves, the card is
**Publishing to private projects is on Team**: an owner is offered Open billing
beside the switcher, and everyone else the one sentence asking an owner, which
the catalogue draws as `product/viewer/standalone/plan` and
`product/viewer/standalone/plan-reader`. The copy is in [Billing](./billing.md).
The [reference stage order](./viewer-builds.md#references-without-a-ready-publication)
selects the build, publication or plan card before Set up publishing. It also
defines the Team card for a plan-refused pull request.
`product/viewer/pull-request/plan` and its `reader` variant draw that card.
The chrome stays mounted in every state, so the user is never outside the viewer.

The cloud read operations, ordering and share validation are defined in
[Viewer read model](./viewer-read-model.md).

## Chrome And Publication Identity

Standalone entry chooses the project's default branch; pull request entry
resolves the exact publication in the check URL and preselects Changes. A pull
request shows its number, title, author and a link to GitHub, read from the
publication's own `pullRequest` rather than from the address: the check link and
every resolved alias name a publication and no reference, so only the
publication can say which review produced it. An alias with nothing published
has no publication to read, and keeps the name its own reference list supplied.
An observation with no retained author login draws no author. The publication's
head SHA and publication time stay secondary to the branch or pull request that
produced them. Switching a branch or pull request resolves its newest ready
publication. A branch's publication state — ready, publishing, failed or none —
shows in the switcher rows and in history; there is no list page. History lists
newest first with Ready and Failed labels and immutable links, and a failed row
offers its details rather than loading an absent catalogue. For readers with
member access, switcher rows and history also carry
[cloud builds](./viewer-build-navigation.md#history-and-switcher) as Publishing or
Failed, and history reads `listHistory`, which joins the reference's builds to
its publications.

The package's catalogue is not cloud navigation. The switchers, history, share
and the account sit in the package's three top-bar slots around its own mark and
search above its stage, which takes the full remaining width. The switcher,
history and share overlays open from that bar as the shared modal's centered
frame on desktop and a bottom sheet on mobile. Back or Close dismisses an
overlay without changing the publication. The live app makes the screen behind
an overlay inert, traps focus and returns it to the trigger. Static mockups use
the registered overlay layout described in [Shared
controls](./shared-controls.md), because the package modal requires a browser
portal. The exact geometry is the viewer top bar and panel compositions in
[Viewer compositions](./folio-viewer.md).

## Mockup Representation

The ready canvas is a static depiction composed of the workspace `@mokly/ui`
parts that the viewer renders its shell from, drawn with `interactive={false}`:
the cloud controls sit in the embedded layout's host slots, and a sample screen
fills each frame on the canvas. A desktop drawing shows the current screen's
frames with the zoom pill and the right panel, and a phone drawing the compact
layout's one frame with the entry bar and the dock. The package top bar draws
no theme toggle, and its search field ends with the `⌘K` hint. Non-ready cloud states stay
cloud-owned. The six entries adopt `product/viewer/standalone`,
`product/viewer/pull-request`, `product/viewer/projects`,
`product/viewer/switcher`, `product/viewer/history` and `product/viewer/share`.
Each renders the cloud chrome in the three top-bar slots around that depiction,
in both viewports and schemes, with canonical, empty, loading and error entries.
The open account menu, the check and the settings dialog over the viewer have
their own drawings, which the [viewer
inventory](./product-mockups-viewer.md#viewer) lists. A desktop drawing chooses
the full or the compact bar from its own width and switches at the same width as
the application's bar, so a narrow catalogue frame draws **More** instead of
clipping controls. Phone drawings keep the compact bar. Decision: one switch
width serves the application and the drawings, rather than a copy in the
drawings or a minimum drawing width, because a copy can drift and a minimum
width makes readers scroll sideways to reach the controls. Every other state
renders one card inside the canvas — Set up publishing, a named pending
operation, or the unavailable publication with the switcher as recovery. The
three access pages show the answers of the publication's own host in place of a
catalogue: the exchange in flight, the refusal a retry can still fix, and the
browser that can open no access route, whose final message of
[Catalogue isolation](./viewer.md#catalogue-isolation) offers no action. Their
parent entry is `product/viewer/standalone/catalogue`.
The build card of [Viewer builds](./viewer-builds.md) fills the same canvas in
the catalogue's build drawings, which the [viewer
inventory](./product-mockups-viewer.md#builds) lists.

The four overlay screens render the viewer beneath the open panel and the panel
as the document's `main` landmark and `h1`, exactly as the settings dialog does;
the viewer beneath is `aria-hidden` and `inert`, keeps no landmark of its own,
and none of its controls, including the package skip link, takes focus. They
carry no skip link: everything before the panel is the inert backdrop, so there
is nothing between the start of the document and the main landmark for a reader
to skip. The standalone and pull request screens carry the document heading in
the chrome, where the switcher triggers already name the project and its
publication. Missing-publication pages retain branch and pull request context
without a publication SHA or published date. Mobile previews remain legible at
390px, usable at 320px, and work with 200% text sizing.
