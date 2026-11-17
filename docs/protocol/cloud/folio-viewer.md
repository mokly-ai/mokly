# Folio Viewer Compositions

The compositions of the viewer and of the surfaces layered over it, from
[Folio chrome](./folio-chrome.md): the stage, the viewer top bar, the panel,
the publication row, the build card, the settings dialog and its mobile layer.
They use the density and discipline rules of Folio chrome, every value comes
from [Design tokens](./design-tokens.md), and their controls follow
[Shared controls](./shared-controls.md). Shared forms, states and
write-failure fragments remain in Folio chrome. The host contract is in
[Viewer host](./viewer-host.md), the cloud controls in the package's slots in
[Viewer chrome](./viewer-chrome.md), and the panes the dialog and the layer
host in [Settings dialog](./settings-dialog.md).

## Compositions

**Stage**. The published viewer fills the available height and owns its top
bar, Browse rail and stage. Cloud composes the lead and middle groups into
`topBarStart` and the trailing actions into `topBarEnd`, with 16px between
cloud groups. The package's interface takes the app chrome's scheme, the
`theme` the [package host contract](./viewer-host.md#package-host) passes it,
so in Dark its own warm neutrals and the cloud slots it holds read as one
surface; the preview documents keep the reader's `scheme`. Non-ready
publication and access states replace the package with one centered cloud
card. An overlay or settings dialog makes the viewer beneath inert and keeps
the document's single `main` and `h1` above it.

**Viewer top bar**. The application header, and the only cloud navigation the
product has. When the bar's own width fits the six cloud targets beside the
package controls, they fill the package's 48px row: `topBarStart` takes the
workspace/project trigger and the branch or pull request trigger with its
publication state beside it; the package keeps its own mark, Browse menu and
search; `topBarEnd` takes History, Share, Settings and the account, right
aligned. A narrower bar, as on mobile, cannot fit those six cloud targets,
so `topBarStart` keeps only the publication trigger and `topBarEnd` carries one
quiet **More** trigger. Its Firna dropdown rows are the current project,
History, Share, Settings and the account; they open the same overlays as the
desktop controls, and dismissal returns focus to the action's current trigger,
as [Viewer chrome](./viewer-chrome.md#slot-inventory) defines. At a viewer
width of 560px or less the package's search field is its own 30px search
button, which opens a full-width search over the same row with both slots
still mounted; Close or Escape returns to the button. That width is the
viewer's container rather than the window, so between it and the product's
compact breakpoint the compact row still carries the whole search field.
Non-ready cloud-owned stages use the same one-row grouping around the Mokly
mark rather than inventing package navigation. Switcher triggers are
`secondary` registered Buttons and repeat actions are `quiet` ones, each
switcher carrying a trailing chevron, so no group spends the accent and the
whole bar reads as one control strip. The publication state sits outside its
trigger as a decorative status dot, a 12px muted phrase and the short SHA in
mono, so the trigger's label stays the ref the user recognizes. The bar stays in one row.
A narrower bar uses the compact composition described above. The compact row keeps the
current publication, the package's menu and search and **More** visible, while
the Firna menu gives every grouped action a 44px target. The document's `h1`
is the project and its selected publication, carried by the chrome and
visually hidden, because the triggers already name both and a second visible
title would repeat them.

**Panel**. The registered `panel` frame, which the switchers, history and share
open over the stage. Desktop is a centered modal at most 480px wide and 76vh
tall on a `surface` card with a 10px radius, a hairline and `shadow.large`,
over a backdrop of the ink at 34% with a 3px blur. Mobile is a bottom sheet:
full width, flush to the bottom edge, 16px radius on its top corners only, at
most 84vh. Both take a sticky bar padded 16px above, 20px at the sides and
12px below, hairline-bottomed, holding the panel's `h1` on the left and a
compact quiet Close on the right, over a body that scrolls with 20px gutters.
The frame owns no landmark; the screen supplies the `main` and the heading,
and the viewer beneath is `aria-hidden` with no landmark of its own. A panel
never nests a second panel or a dialog.

**Publication row**. The rows a switcher, projects or history panel lists, built
from the record row's vocabulary at panel density: a decorative status dot, the
ref or the publication time as a 13px title, a 12px muted state line beneath,
and the short SHA right aligned in mono. A switcher's rows are grouped under the
uppercase group label — the default branch first, then the remaining branches,
then pull requests — and a group named after something the user wrote, such as
a workspace, takes a sentence-case label instead, because uppercasing a
name the user chose changes it. A row that cannot be opened offers its details
instead of a destination, and the row the reader is already on carries
`Current` in place of one.

**Build card** (`.fo-build`). One [cloud build](./viewer-builds.md) in the
stage, drawn in place of the State card and at most 760px wide: a `surface`
card with a 10px radius and a hairline, in three hairline-separated bands. The
head holds the 15px semibold title, the reference line — the branch or pull
request glyph, the reference in medium ink and its short SHA in mono — and an
optional 13px muted line, with the card's one action on the head's trailing
edge, wrapping beneath the text when the width runs out. The title and the line
form the head's message (`.fo-build-message`), which a failed build announces as
its [alert](./viewer-builds.md#build-card). The reference follows the message in
reading order, and the summary's grid sets it between the title and the line on
screen, one 4px step from each, so neither the reference nor the action is part
of the alert. The action column shrinks with the head: a refusal's line wraps
inside it. Its control uses the shared
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

**Dialog**. The registered `settings-dialog` frame: a 212px section rail in
`surfaceMuted` beside one pane, at most 960px wide, on a `surface` card with a
10px radius, a hairline and `shadow.large`. The frame is at least
`min(700px, 90dvh)` tall and at most 90dvh, in the catalogue and in the running
dialog alike: a frame that took its height from each pane in turn would move
the pointer's target on every switch, and the minimum yields to the cap on a
short window. Below the breakpoint, where the mobile layer is the
presentation, the frame keeps neither bound. The bar above the pane is padded
20px above, 24px at the sides and 16px below, hairline-bottomed, and holds the
pane's `h1` on the left with a compact quiet Close on the right. The pane body
scrolls with 24px gutters and 32px between sections. Rail rows reuse the
section, group label and 32px navigation row of the record vocabulary; the
current row takes `surface`, a hairline, `shadow.small` and a semibold ink
label; it carries no accent, because the lift already marks it. Below the
breakpoint the rail stacks above the pane. The discard confirmation renders
inside the pane. A question about one row or field is a modal over the frame
instead, drawn with the registered panel, and nothing opens a third layer. The
dialog sits centered over the stage behind a 34% ink scrim with a 3px blur.

**Layer**. The mobile presentation of the same pane: a full-height
`background` column under a sticky 20px-gutter bar with a hairline. The bar's
leading control returns to the settings index from a pane, or closes settings
from the index, with the wordmark trailing. The body stacks the pane's `h1` and
content with 20px gutters and 24px between sections.
