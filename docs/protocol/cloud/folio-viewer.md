# Viewer Compositions

Status: The application's panels and settings dialog lay the package modal's backdrop instead of the Overlay scrim. The [modal backdrop item](../../../plans/follow-ups/modal-backdrop-misses-canvas-scrim.md) brings the scrim.

The compositions of the viewer and of the surfaces layered over it, from
[Folio chrome](./folio-chrome.md): the stage, the viewer top bar, the
publication pill, the account menu, the panel, the publication row, the build
card, the check card, the settings dialog and its mobile layer. They use the
density and discipline rules of Folio chrome, take their colours and type from
the Canvas roles of [Design tokens](./design-tokens.md), and their controls
follow [Shared controls](./shared-controls.md). Shared forms, states and
write-failure fragments remain in Folio chrome. The host contract is in
[Viewer host](./viewer-host.md), the cloud controls in the package's slots in
[Viewer chrome](./viewer-chrome.md), the menus in
[Viewer chrome: account menu](./viewer-chrome-account.md), and the panes the
dialog and the layer host in [Settings dialog](./settings-dialog.md).

## Compositions

**Depth**. A surface that floats over the canvas takes a hairline and the
12px `radius.float`. A card on the canvas takes the float shadow,
`shadow.float`, and a panel or the dialog over it takes the deep shadow,
`shadow.deep`, over the Overlay scrim, with no blur, so the canvas still reads
beneath it. The Floating and Overlay roles of
[Design tokens](./design-tokens.md#radius-elevation-and-focus) give the
values.

**Stage**. The published viewer fills the available height and owns its top bar,
catalogue and stage. Cloud composes the project into `topBarStart`, the
publication into `topBarCenter` and the trailing actions into `topBarEnd`. The
package bar draws the surface, the hairline and the padding around the cloud
slots, so the bar reads as one surface in both schemes. The package's interface
takes the app's scheme, the `theme` the [package host
contract](./viewer-host.md#package-host) passes it, so its own neutrals and the
cloud slots it holds read as one surface; the preview documents keep their own
schemes. Non-ready publication and access states replace the package with one
centered cloud card on the cloud's own canvas: the `background` with a `dot`
grid on a 24px pitch. A State card, its waiting form and a build card float on
it with the float shadow. An overlay or settings dialog makes the viewer beneath
inert and keeps the document's single `main` and `h1` above it.

**Viewer top bar**. The application header, and the only cloud navigation the
product has. When the bar's own width fits the five cloud targets beside the
package controls, they fill the package's 48px row in three columns: the
package's mark, then `topBarStart` with the workspace/project switcher;
`topBarCenter` with the publication pill in the middle of the bar, and the
publication's Changes badge, its pull request's GitHub link and View latest
beside it when each applies; then the package's compact search, whose field
draws the shortcut hint before its tag picker, as `⌘K`, or as `Ctrl K` off Apple
platforms, its end control, and `topBarEnd` with History, Share and the
account's avatar. The two outer columns are equal, so the pill stays in the
middle. The project switcher gives up its width first; inside the centre's room the
state's phrase gives way, then the reference, down to the pill's floor, and the
controls keep their width. With the widest centre, a pull request's publication in
Changes beside GitHub and View latest, the pill keeps only its glyph and the start
of its reference from 1022px to about 1069px with the Mac window's buttons. As the
full bar narrows, the pill drops its short SHA, then History becomes a square quiet
Button that draws its clock alone and keeps its accessible name and tooltip, then
the pill drops its phrase and divider and keeps its dot. A narrower bar, as on
mobile, cannot fit those five cloud targets, so `topBarStart` stays empty,
`topBarCenter` keeps only the pill, which starts right after the mark and takes the
free room, and `topBarEnd` carries one quiet **More** trigger with a chevron. Its
rows are the current project, History and Share, which open the same overlays as the
desktop controls, then the account rows; dismissal returns focus to the action's
current trigger, as [Viewer chrome](./viewer-chrome.md#slot-inventory) defines. At a
viewer width of 560px or less the package's search field is its own 30px search
button, which opens a full-width search over the same row with both slots still
mounted; Close or Escape returns to the button. That width is the viewer's container
rather than the window, so between it and the product's compact breakpoint the
compact row still carries the whole search field. Non-ready cloud-owned stages use
the same order around the cloud's Mokly mark in three groups, without a search,
because no catalogue is mounted, rather than inventing package navigation: the mark
and the project, the centred pill, then the actions, or the mark, the pill and
**More** in the compact form. The project switcher, the publication pill, History
and **More** are `quiet` registered Buttons, so the bar reads as one control strip.
The project switcher is one Button labelled with the project, with the workspace as
its muted `lead` before a slash, and the switcher's up-down chevron, on one line, so
a press anywhere on `workspace / project` opens the projects. The workspace gives up
its width before the project does, and the whole `workspace / project` is the
Button's accessible name and tooltip. History carries the history glyph, a clock
with a back arrow, as its Button's icon, and **More** carries the switcher's
chevron. Share is the screen's one filled action on the ready viewer: the `primary`
tone, which Canvas paints `signalFill` with `onSignalFill` text. Under a panel, a
sheet or the dialog, and over a non-ready stage, Share keeps the `secondary` tone,
because the layer or the stage card owns the screen's filled action. The bar stays
in one row. A narrower bar uses the compact composition described above. The compact
row keeps the current publication, the package's own controls and **More** visible,
while the menu gives every grouped action a 44px target. The document's `h1` is the
project and its selected publication, carried by the chrome and visually hidden,
because the triggers already name both and a second visible title would repeat them.

**Publication pill**. The branch or pull request and what the stage shows of
it, as one quiet registered Button that draws them as its content, so a press
anywhere on the pill, its hairline included, opens the switcher and never
moves the Mac window. The pill is a rounded frame on `surfaceMuted` with a
hairline and the 8px chrome radius, 32px tall and 40px on a phone, where the
Button keeps its 44px target; the Button has no frame of its own. A hovering
pointer darkens the pill's fill to the ink at 5% over `surfaceMuted`, or 7%
while pressed, and its hairline to the stronger line of its divider. The full
pill draws the reference's glyph, branch or pull request, the reference, a
short divider, the decorative status dot, the state's phrase in secondary ink
at the 13px `ui` size, such as `Ready · 15 Sep`, the short SHA in muted mono
and a trailing chevron in muted ink; a pull request's phrase starts with its
author. The compact pill draws the status dot, the glyph, the reference's
compact name, a pull request's number or the last segment of a branch, and
the chevron. A branch reads in regular mono at the `ui` size, as a reference
does; a pull request keeps its number in semibold before its title in sans.
The Button's accessible name and the pill's tooltip are the whole reference,
the state's phrase and the short SHA, separated by commas, in both
compositions, so the name holds every word that the pill shows. While a read
decides the reference, the pill holds no control: a placeholder in the
reference's own frame beside the state, and the pill takes the bar's surface.
A name that stands in for a reference that no read has reached, such as This
build, draws no glyph and reads in sans. Decision: the whole pill is one
Button (decision 39, option B), so it has no dead area and can draw the branch
in mono; a second control for the branch was rejected, because one action
would then have two tab stops.

**Account menu**. The account trigger is a quiet registered Button named by
the reader, 34px wide, with the avatar laid over its middle as a decorative
picture: a 28px circle in the `pink` people colour, its `fill` behind its `ink`
initials in 11px semibold. A disabled trigger fades its avatar. The account
menu and **More** open as a 260px popover in the shared menu chrome,
end-aligned 6px below the trigger. The account rows lead with who is signed
in, a 32px avatar beside the name in 13px semibold ink over the address in
12px muted ink, cut with an ellipsis, then, under a hairline, Theme's 13px
label with the registered Light and Dark segmented control at its own width.
Settings, Docs, Changelog, Sign out and More's own rows each lead with a muted
16px glyph in a column of one width, so every label starts at one edge. Docs
and Changelog draw the external glyph there and take no hairline of their own,
because the glyph already sets them apart from Settings and Sign out. A
hairline separates More's own rows from the account rows. On a phone, **More**
is the registered panel's bottom sheet, and each of its rows is a 44px touch
target.

**Panel**. The registered `panel` frame, which the switchers, history and share
open over the stage. Desktop is a centered modal at most 480px wide and 76vh
tall on a `surface` card with the 12px radius, a hairline and the deep
shadow, over the scrim. Mobile is a bottom sheet: full width, flush to the
bottom edge, 16px radius on its top corners only, at most 84vh, with a 36 by
4px grab handle centered above its bar. Both take a sticky bar at least 52px
tall, padded 8px above and below, 20px at the start and 12px at the end,
hairline-bottomed, holding the panel's `h1` in the 15px `uiTitle` size on the
left, with History's branch beside it in mono, and a compact quiet Close on the
right. The switcher draws its search field in the bar in place of the visible
title, up to Close, and the title stays the document's heading for assistive
technology; the field is disabled, and fades, until there is something to
search. The body scrolls, padded 16px above and 20px at the sides and below,
or 32px below on a phone, with 20px between its groups. A group's label is
uppercase mono in muted ink. A state inside a panel sits in a well on
`surfaceMuted` with the 12px radius and no border, because the panel is
already its frame. Share sets its link and Copy link in one row, level with
each other, and a phone sets Copy link at the panel's width under the link.
The frame owns no landmark; the screen supplies the `main` and the heading,
and the viewer beneath is `aria-hidden` with no landmark of its own. A panel
never nests a second panel or a dialog.

**Publication row**. The rows a switcher, projects, history or share panel
lists, built from the shared list rows at panel density with no hairline
between them: a decorative status dot, the ref or the publication time as a
13px medium title, 14px on a phone, a 12px muted state line beneath, and the
short SHA in mono before the row's end. A branch reads in mono, as a reference
does, at 13px also on a phone; a pull request keeps its number in semibold and
its title in sans. A row that leads somewhere is one link over its whole
frame, as the Record row is, with no trailing label. The row's end, its choice
or its mark, sits in a column of one width, empty on a link row, so the SHAs
line up. A switcher's rows are grouped under the uppercase group label — the
default branch first, then the remaining branches, then pull requests — and a
group named after something the user wrote, such as a workspace, takes a
sentence-case label instead, because uppercasing a name the user chose changes
it. A row that cannot be opened links to its details instead. The row the
reader is already on is no link. It takes `signalSoft` with the 8px chrome
radius, and at its end it carries its mark in semibold `signalDeep`: `Current`
in the switcher and the projects panel, and `Selected` on Share's chosen screen. History's current
publication carries no mark, because its state line already says Current
publication.

**Build card**. One [cloud build](./viewer-builds.md) in the stage, drawn in
place of the State card and at most 760px wide: a `surface` card that floats on
the canvas with the 12px radius, a hairline and the float shadow, in three
hairline-separated bands. The head holds the 15px semibold title, the
reference line — the branch or pull request glyph, the reference in medium ink
and its short SHA in mono — and an optional 13px muted line, with the card's
one action on the head's trailing edge, wrapping beneath the text when the
width runs out. The title and the line form the head's message, which a failed
build announces as its [alert](./viewer-builds.md#build-card). The reference
follows the message in reading order, and the summary's grid sets it between
the title and the line on screen, one 4px step from each, so neither the
reference nor the action is part of the alert. The action column shrinks with
the head: a refusal's line wraps inside it. Its control uses the shared
[**Control with guide** fragment](./folio-chrome.md#compositions);
refusal guide choices belong to [Viewer builds](./viewer-builds.md#build-card).
Nothing in the head passes the card's edge at 320px with 200% text. The title
takes focus after Cancel, as a focus target out of the tab order
(`tabindex="-1"`), and draws the token outline of the
[shared focus rule](./design-tokens.md#radius-elevation-and-focus). It keeps
`radius.tight` around its own text; focus after a pointer press draws no
outline.
The steps band sets Check out, Install and Publish in three equal
columns, each a decorative status dot and the step's 13px name over its 12px
muted state, and the current step's name is semibold.
The output band's group label sits over the log: 12px mono text on
`surfaceMuted` in a 10px-radius box at most 22rem tall (18rem on mobile), whose
reversed column opens on the newest line and scrolls back from it. Command and result lines are muted, other output takes the ink, long lines
wrap, and the elision line is muted sans italic. A build with no output draws
no output band. The output box is a region labelled by Output, with
`tabindex="0"` so keyboard readers can focus and scroll it, in the drawings as
in the application. Its outline follows the shared focus rule above and keeps
the box's own `radius.medium`.

**Check card**. The Mokly check in the Changes tab's check slot: one card with
a hairline and the 10px medium radius. Its result row, padded 12px, sets the
success glyph, a tick in a circle filled with `signalFill` and the tick in
`onSignalFill`, level with the check's name, Mokly, in 13px semibold ink, with
the summary's count lines beneath it in 12px secondary ink. Its foot, under a
hairline, is the link to the pull request's checks on GitHub: a 44px row on
`surfaceMuted` holding the pull request glyph, the number and title on one line
cut with an ellipsis, and the external glyph, in 12px secondary ink that turns
to ink on hover.

**Dialog**. The registered `settings-dialog` frame: a 212px section rail in
`surfaceMuted` beside one pane, at most 960px wide, on a `surface` card with
the 12px radius, a hairline and the deep shadow. The frame is at least
`min(700px, 90dvh)` tall and at most 90dvh, in the catalogue and in the running
dialog alike: a frame that took its height from each pane in turn would move
the pointer's target on every switch, and the minimum yields to the cap on a
short window. Below the breakpoint, where the mobile layer is the
presentation, the frame keeps neither bound. The bar above the pane is at least
52px tall, padded 8px above and below, 24px at the start and 12px at the end,
hairline-bottomed, and holds the pane's `h1` in the 15px `uiTitle` size on
the left with a compact quiet Close on the right. The pane body scrolls,
padded 20px above, 24px at the sides and 32px below, with 24px between
sections; a section's title takes the 13px `ui` size, and a role chip takes
the 6px radius. The rail is padded 16px by 12px, with 16px between its sections, and
its group labels are uppercase mono. Rail rows reuse the section, group label
and 32px navigation row of the record vocabulary, in secondary ink. The
current row takes `signalSoft`, with its label in semibold `signalDeep` and its
glyph in `signalDeep`, and no hairline or shadow, as the current rows of the
panels and the catalogue do, so one mark shows the reader's place across the
viewer. Below the breakpoint the rail stacks above the pane. The discard
confirmation renders inside the pane. A question about one row or field is a
modal over the frame instead, drawn with the registered panel, and nothing
opens a third layer. The dialog sits centered over the stage behind the scrim.

**Layer**. The mobile presentation of the same pane: a full-height `surface`
column under a sticky 20px-gutter bar on the same surface with a hairline. The
bar's leading control returns to the settings index from a pane, or closes
settings from the index, with the wordmark trailing. The body stacks the
pane's `h1` in the 15px `uiTitle` size and its content with 20px gutters and
24px between sections.
