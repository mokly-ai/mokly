# Folio Chrome

Status: The avatar trigger and the deep shadow of the viewer's panels and dialog are not built yet. [Milestone 13](../../../plans/canvas-redesign-milestones-viewer.md#milestone-13-cloud-viewer-chrome) builds the avatar trigger and the Canvas panels and dialog.

The composition rules for Mokly Cloud's product surfaces. Every value here comes
from [Design tokens](./design-tokens.md); this document says how those values
are arranged. Controls inside these compositions follow
[Shared controls](./shared-controls.md), and the settings frames follow
[Settings dialog](./settings-dialog.md). The catalogue that must satisfy these
rules is listed in [Product mockups](./product-mockups.md).

These rules keep the cloud's product screens in step with the open-source
Mokly Browse shell: one Canvas palette, the same Geist face, the same 13px
chrome density, the same hairline discipline and the same restraint with
color. No screen adds a layout rule of its own; a screen that needs a new
arrangement adds it here first.

The viewer is the application, so the only chrome the cloud owns sits in the
hosted package's slots, which the host contract in
[Viewer host](./viewer-host.md) defines. The stage, the viewer top bar, the
publication pill, the account menu, the panel, the publication row, the build
card, the check card, the settings dialog and its mobile layer are in
[Viewer compositions](./folio-viewer.md). The one account
panel every account screen shares is in
[Folio chrome: account entry](./folio-chrome-account.md). The compositions
below are the vocabulary those pages and every product screen are built from.

## Compositions

**Section**. A 15px semibold title, an optional 12px muted description beneath
it, and an optional compact action on the same top edge. Sections are separated
by a hairline with 32px above and 16px to their content; the first section in a
stack is flush. Stacked sections are 32px apart, 24px on mobile. The settings
dialog sets its sections tighter, as its **Dialog** composition in
[Viewer compositions](./folio-viewer.md#compositions) defines.

**Record row**. Rows live in a `surface` panel with a 10px radius, a hairline
and `shadow.small`; the package draws the hairline between rows and never after
the last. A row is a status dot, a 13px title over a 12px muted state line, and
right-aligned monospace metadata. A destination link sits at the right of the
same row and wraps beneath it when enlarged text needs the width.

**Form**. One 460px column, 20px between fields. Labels, placeholders and
helper text come from the control. A placeholder shows the shape of an answer
the reader has not given yet — their own name, `owner/repository` — and never
repeats the label or replaces it; a field the product gives a default value
carries none. Read-only facts use a 136px label column with the value
aligned across every section, collapsing to stacked pairs on mobile.
Destructive forms sit in a card whose border is mixed from `danger`.

**State**. Empty, loading and error bodies share one shape in a `surface` card
with a 10px radius and a hairline: a 40px rounded glyph tile, a 15px semibold
title, an optional 40ch muted line, then one action. Error tiles take
`dangerSoft` behind a `danger` glyph and the section announces itself as an
alert. The alert always contains non-empty state copy a screen reader reads: a
visible title, a visible muted line or, only when neither is shown, a hidden
announcement; the three forms are mutually exclusive, as
[Web application](./web-app.md#accessibility) specifies. The glyph, action and
**Details** disclosure do not count as state copy. A loading body is this card
in its placeholder form, which **Wait** below defines. An
error body closes with the reference Mokly answered the request with: a
collapsed `Details` disclosure under the action, holding one 12px muted line
whose identifier is in mono. It is the one place a reader is shown something
only a report needs, so the title and the action never carry it. A failure
raised in the browser rather than answered by Mokly draws no disclosure,
because a reference that correlates with nothing is worse than no reference,
and keeps its own control's label, because there is no request to send again.
The application and the catalogue draw the disclosure from the one shared
stylesheet, so its 44px target and its marker are declared once for both
surfaces.

**Accessible name**. A control's accessible name contains the words it shows.
A label shortened to fit — the compact bar's publication pill, which shows a
pull request's number or the last segment of a branch that the row cannot
hold whole — takes the whole value as its accessible name, which contains what
is on screen; a label that is already whole takes no other name, so the name a
reader says is the name the control answers to. The property holds wherever a
label is shortened: the visible text finds the control by role. A control that
shows a picture in place of its label, as the account trigger shows the
reader's avatar, takes the whole value as its accessible name and its tooltip.
A control that draws parts inside itself, as the publication pill draws its
reference beside the publication's state and short SHA, takes the words of
every part that it can show, in the order shown, as its accessible name and
its tooltip, so a part that a narrower bar drops stays in the name.

**Wait**. What a region draws while a read that it needs runs: the layout that
it waits for, in the shape that the answer fills. A screen draws this wait for
every read that it waits for, the session read and its route's reads included.
Known text renders as text, such as the title, labels, section headings, the
progress strip and links whose targets are known. A part whose content the
answer supplies draws its placeholder form at its own size: the part's own
frame, with a bar in place of each text that the answer supplies. A field draws
its label and its own frame, read-only, holding a bar or the operation's name.
Any other control whose label is known draws itself, disabled. A control whose
label or presence the answer decides draws a placeholder over its own frame.
While a read runs, every control in its region draws its placeholder form, also
a control that does not need the answer, so a failed read removes nothing the
reader typed. A layout that depends on the answer draws its most common form. A
list is the one exception: it draws one placeholder row in the row's own frame,
also a list that can be empty, and text that only a non-empty list shows draws
as a bar. The wait names its operation once, in a text place of the loaded
layout whose text the answer decides, or for screen readers only where the
layout has no such place. Known text keeps its place, a visible name never
repeats the heading, and a wait never adds a line that the loaded layout does
not have. In the **State** card's placeholder form its glyph tile, its line and
its action draw as placeholders, and its title names the operation, or draws a
bar where the heading already names it. The waiting region keeps its landmark
and sets `aria-busy`. Decision: a wait reuses the loaded layout's own parts, not
a generic block. Shape presets of one block and a hand-drawn skeleton for each
wait were rejected, because only shared parts keep both shapes equal as screens
change.

**Write in progress**. What a control and its form draw while the control's
write runs. The form keeps its layout and inserts nothing. The control that
was pressed keeps its place and shows its working word with the registered
button's busy spinner. It refuses a second press until the write is done, and
a screen reader hears the operation. A write that leaves the page, for GitHub
or Stripe, is done when the page leaves, so its control stays busy until then.
It leaves only while its screen is still shown: a reader who followed Back or
another link while it ran stays where they went. A control that cannot show a
working word, such as a switch, shows it in its own row, beside its label, and
is disabled until the write is done, as the Automatic builds switch shows
`Saving…`. Decision: the pressed control carries the wait, not an
inserted block or a status line under every control, because the control
already names the operation and a status line leaves every form an empty line
at rest.

**Write failure**. What a control says when its own write is refused, drawn once
by the registered `write-failure` fragment: the cause as one 13px line
immediately above the control, announced as an alert; the control itself as
the way back, its label reading `Try again`; and the same `Details` disclosure
beneath it. The label changes only where the same request could succeed: a
refusal the reader can answer only by editing what they typed, or by following
a link the message offers, leaves the control's own label alone, as does a
failure raised in the browser. The operation is named by the control and the
cause by the message, so a failure never stands beside a control that would do
something else, and a cause the reader's own text produced sits on that field
instead, where the registered input already draws it. A screen with more than
one write keeps one failure per control: each refusal is reported beside the
control that made it and never through another, so a control that sent nothing
keeps its resting label, its own field unmarked and no disclosure beneath it.
Every write control in the account and settings families references the
fragment rather than wording a failure of its own, and is inside that rule
without being listed here. Only the exceptions are named. A control whose
refusal changes what the reader does next draws it as the screen's own state
body instead — today Install on GitHub, whose answer decides whether the
reader tries again or resumes the App on GitHub first. A cause
whose way on is a link the message offers is announced beside the control
rather than through the fragment, because the same request cannot be made to
succeed and the fragment's control is a way back — today the repository that
already has a project, whose way on is that project. The viewer's panels draw
it the same way: the share panel's Copy link reports a clipboard the browser
refused and keeps its own label, like the token reveal's Copy. A message a
surface says about a control that is not a refusal of it — an operation that
is not open yet — takes the flush notice line instead, announced politely and
placed where that control's causes are placed, because it offers no way back
and has no reference to disclose. A destructive control names the person or
project it acts on, unless the only name they have is an address, which no
control label can hold at 320px — the heading and the confirmation above it
already carry that address.

**Named exception: Build Cancel.** The
[build card's Cancel rule](./viewer-builds.md#build-card) keeps the operation
label after a refusal or failure, including one that another request could
overcome. The fragment still places the cause above the control and Details
below it.
`product/viewer/standalone/build/refused/cancel` draws this exception.

**Control with guide** (`.fo-control-guide`). One shared fragment holds a
write control and its optional secondary guide in a wrapping row with a
12px gap; without a guide the fragment is the control alone. Both the
publishing card and build card use it. A refusal places the complete fragment
in the write-failure fragment's control slot, below the cause and above
Details; at rest it stands alone. Inside a State card the row, and a refusal
around it, are centered like the card. The guide stays beside the control or
wraps immediately beneath it, within the card at 320px with 200% text.
The [viewer guide rule](./viewer-build-navigation.md#request-a-build)
decides when Publish from CI appears; the fragment never adds a guide because
a refusal occurred.

**Selection**. A list the user chooses from is the registered options list in
its ring highlight: the chosen row takes `accentSoft`, an `accentSolid`
hairline and a trailing check. It is never a solid fill, which would read as a
second primary action on the screen.

## Density And Discipline

Chrome text is 13px with 12px muted detail; page titles are the display sizes
in [Design tokens](./design-tokens.md), and the titles of the viewer's panels,
the settings dialog and its layer take the 15px `uiTitle` size, as
[Viewer compositions](./folio-viewer.md#compositions) defines. Icons are 16px
in rows, 13px inline and 20px in a state tile, all on the same stroke.
Boundaries are one hairline in `border`; `shadow.small` lifts a panel and
`shadow.medium` the account panel, and the dialog and the viewer's panels take
the deep shadow of Viewer compositions. Hover fills use the accent ink at 9% or
the ink at 5%; nothing else tints a surface. At most one `accentSolid` fill per
screen marks the primary action when one exists, and nothing else on the screen
takes the accent as a fill. Every interactive row
clears the 44px touch target on mobile, and layout CSS never overrides a
control's font, radius or colors — that mapping belongs to
[Shared controls](./shared-controls.md).
