# Product Mockups: Viewer

This inventory is part of [Product mockups](./product-mockups.md).
Its paths match the current source and generated catalogue.

## Viewer

Six screens on the [package host](./viewer-host.md#package-host): two
entries into the stage, and the four panels its slots open. Screen modules live
under `src/screens/product/viewer/`; each screen's entry is
`src/entries/product/viewer/<screen>.mockup.tsx`, with the screens of
Standalone and Pull request in `standalone/` and `pull-request/` directories
matching their folders. Every one
renders the same chrome, so the family reads as one application. Every viewer
drawing draws the cloud's own chrome, panels and cards in the Canvas palette
with Geist, and its `@mokly/ui` parts with the package's own stylesheet.

| Path                          | Canonical content and action                                                   | Empty / missing data                           | Error recovery                                 |
| ----------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------- |
| `product/viewer/standalone`   | A branch's ready publication on the stage                                      | No publication; Set up publishing              | Publication unavailable; choose another branch |
| `product/viewer/pull-request` | A pull request entry with Changes preselected                                  | Pull request not published yet; switcher       | Publication unavailable; choose another branch |
| `product/viewer/projects`     | Workspaces, their projects, Create project, Workspace settings                 | No projects in this workspace; create          | Projects couldn't load; retry                  |
| `product/viewer/switcher`     | Branches then pull requests, each with its newest publication or build state   | No ref matches the search; clear it            | Branches couldn't load; retry                  |
| `product/viewer/history`      | This branch's publications and builds, newest first, with each one's state     | No earlier publications; Choose another branch | History couldn't load; retry                   |
| `product/viewer/share`        | The canonical link, its access sentence, the screen it points at and Copy link | Nothing published to share; set it up          | Link couldn't load; retry                      |

`product/viewer/standalone` and `product/viewer/pull-request` carry the chrome and the stage,
and their document heading is visually hidden in the top bar, which already
names the project and its publication. The four panel screens render the
viewer beneath the open panel and give the panel the document's `main` and
`h1`, exactly as the settings dialog does. The next paragraph defines the
drawing of the ready state. Empty, loading and error each hold one centered
cloud card. Administrators see Set up publishing on the empty stage; members
are told an administrator publishes this project and are offered the switcher,
which `product/viewer/standalone/reader` draws as a screen beside
`product/viewer/standalone`,
because the same branch is read by both and only the card inside the stage
differs.

The ready drawing is a static depiction composed of workspace `@mokly/ui`
parts. Its embedded layout holds the cloud chrome in the
`topBarStart` and `topBarEnd` host slots around the package top bar, which
takes no end control, because the cloud's bar has no theme toggle, and whose
search field ends with the `⌘K` hint.
The layout also holds the catalogue navigation and the
workspace layout, with its screen header and view controls.
The stage holds the phone and browser frames, and a sample screen is the
children of each frame. The navigation rows and the sample
screen come from cloud fixtures, never from a fixture file of an installed
package.

The parts draw their controls through the package's static props, so the
drawing runs no script, and the layout states the drawing's color scheme as
its appearance, never Auto. Decision: compose the package parts,
not a server render of the viewer or a stage slot on `MoklyViewer`, because
the packages have neither. The parts are the elements that
the viewer itself draws, so the drawing follows the package.

A project Mokly has not observed a repository for has no branches and no pull
requests, which is where every reader starts and is not the empty search beside
it: only one of the two has a search to clear.
`product/viewer/switcher/no-branches` draws it as a variant of `product/viewer/switcher`, with
the administrator-only Set up publishing.

Set up publishing carries the external glyph on the stage, the switcher and the
share panel, because it leaves the app for the site's CI setup guide.

Every account is created by an email address, so a reader who has not set a
display name is called by theirs. `product/viewer/standalone/account` draws that bar as
a screen beside `product/viewer/standalone`, pairing a long workspace display
name with a reader named by a long address. The full bar keeps every action on
one row: the project switcher truncates the long name while its complete
accessible name and tooltip remain, and the avatar shows the address's
initials, with the whole address as its accessible name and tooltip.

The account menu has its own screen beside `product/viewer/standalone`:
`product/viewer/standalone/account-menu` draws it open under the avatar, with
who is signed in, Theme with Light and Dark, Settings and Sign out. A desktop
drawing whose bar is too narrow for the full composition opens **More** under
its trigger instead, with the project, History and Share above the same
account rows. Both are non-modal popovers, so the viewer beneath keeps its
heading and landmark. The phone opens More as the panel's bottom sheet, titled
More, whose rows are 44px targets, and the sheet takes the document's `main`
and `h1`, as a panel does. Catalogue-only links below the artboard lead to the
settings index, the sign-in screen and the settings drawing.
`product/viewer/standalone/settings`, another screen beside
`product/viewer/standalone`, draws the settings dialog over the viewer in
Canvas, on the Members pane that its rail opens, because the menu's Settings
opens the index, which shows no pane. The phone shows the same pane in the
settings layer.

The desktop drawing of `product/viewer/pull-request` fills the embedded
layout's `sidePanel` slot with the cloud's Mokly check: a floating panel
headed Changes around the check card, which says the check succeeded, gives
the changed, added and removed counts of the drawing's catalogue, and links the
pull request's checks on GitHub. The panel shows only where the full bar
shows, and the phone drawing and every branch drawing have none.
[Viewer chrome](./viewer-chrome.md#check-slot) places the check in the
package's Changes tab, whose check slot the drawn package parts lack.

A read that never produced the publication is not the same as one that is gone:
`product/viewer/standalone/unreadable` draws the address that named a publication the
stage could not load, where asking again is the one thing on offer. The
workspace ownership lookup that decides whether the reader can open Billing
is a second read, and it fails on its own:
`product/viewer/standalone/workspace-unreadable` draws the branch whose project
capability resolved and whose workspace did not, so the card names the
workspace rather than the project and offers that read again.

Four waits are screens beside `product/viewer/standalone`. Each draws the
stage's waiting card, titled with its read, except where the page heading
already names the read. `product/viewer/standalone/project-loading` is the
route's project read: its heading names the read for screen readers, its
card's title is a bar, and its bar draws its controls in their waiting forms.
`product/viewer/standalone/publication-loading` is the read of a
publication's address, which every alias and the project's own address open
once they resolve: the address names no reference, so the reference trigger
is a placeholder in its own frame beside Loading, and the heading names the
project alone. The `loading` variant of `product/viewer/standalone` is a
branch alias's own read, which names its branch.
`product/viewer/standalone/plan-loading` is the workspace read that decides
the Team card. `product/viewer/standalone/uploading` is a publication that CI
still uploads.

A failed attempt opens as its own details rather than an absent catalogue: the
branch that could not be published and the one sentence of recovery its kept
classification chose. `product/viewer/standalone/failed` draws it as a screen beside
`product/viewer/standalone`. The history panel's failed publication row opens
it, and so does a switcher row with nothing ready whose newest attempt is a
failed publication; a failed attempt over an earlier ready publication opens
that publication instead, because a catalogue the reader can read beats an old
failure.

When a newer publication arrives on the reference the reader is inside, the
chrome offers View latest beside the publication it is already showing and
moves nobody; `product/viewer/standalone/latest` draws that offer as a screen beside
`product/viewer/standalone`.

A ready publication is still behind its own host's credential, so the stage has
three more cards before a catalogue mounts: the exchange in flight, the refusal
another press can fix, and the blocked third-party cookie, whose card is a
final message with no action.
`product/viewer/standalone/catalogue` draws all three, as a screen beside
`product/viewer/standalone` that draws the blocked cookie, with the exchange in
flight and the refusal as its variants, because the chrome and the branch are
the same in each and only the card inside the stage differs.

The `product/viewer/standalone/catalogue/comparison` variant draws the overlay
that a failed private comparison read shows in the embedded layout's
`stageOverlay` slot, over the shown preview, with no action. The
package parts stay visible around it, and the drawing does not imply private
comparison support. Neither this overlay nor the blocked-cookie card offers
the catalogue in a new tab, under the
[private artifact limit](./viewer.md#private-artifact-limit) of Viewer.
The drawing shows that overlay over the shown preview in all four
viewport/scheme documents, and a browser test requires each to match the
preview rectangle. The real app browser smoke owns runtime
geometry.

The disk browser smoke opens each viewer drawing from the build output, and it
fails on every browser error and on every request outside that output. The
one exception is Mokly's frame probe script: Mokly links it from the site root,
so the smoke serves that file from the output.
Both device frames must hold the sample screen, and the selected
viewport must be visible.

Share offers the screen the link points at, beneath the link itself: the whole
catalogue or one of the publication's own current screens, narrowed to the ones
it draws at the selected single viewport and scheme. For Both, a current screen
with either viewport in that scheme remains selectable; Share omits the
unsupported API viewport and the host appends `viewport=both` to the canonical
URL it receives. Under the dark scheme, Share still offers a current screen
with no dark view at the selected viewport, or in either viewport for Both. The
viewer shows that screen through its
[light fallback](./viewer-address-state.md#sharing), so its link carries
`scheme=light`. A current-only publication has no released API screen
inventory, so the choice is not offered, the package selection stays intact
and the link points at the whole catalogue; `product/viewer/share/catalogue` draws that
as a variant of `product/viewer/share`.

The version failure has its own sibling at
`product/viewer/standalone/version`, with source entry
`src/entries/product/viewer/standalone/version.mockup.tsx`. It composes the
shared failure card with both viewports and schemes, uses the exact copy
from [Viewer host](./viewer-host.md#version-failure), places `ViewerError.details` in a
closed Details disclosure and offers one Reload action. One shared
error-details component owns this markup and combines optional diagnostics
and a request reference into one disclosure. The
`product/viewer/standalone/error` screen links to it with a catalogue-only
`MockLink` below its artboard.
Its cloud chrome surrounds the cloud stage card; the package is not mounted
for that failed source.
The drawing and the app use the same version-failure card.

## Builds

The build drawings and the stage cards around them are in
[Product mockups: viewer builds](./product-mockups-viewer-builds.md).
