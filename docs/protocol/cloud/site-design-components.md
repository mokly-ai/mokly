# Site Design Components

Status: The tags of a selection, the size tag, the redline, the section box, the floating panel, the cursor, the docs and changelog document frames and the dark code panel are not built yet. [Milestone 5](../../../plans/canvas-redesign.md#milestone-5-site-home) builds the tags, redlines, section boxes and cursors that the home draws, [Milestone 6](../../../plans/canvas-redesign.md#milestone-6-site-docs) builds the floating panels, the docs frame and the code panel, and [Milestone 8](../../../plans/canvas-redesign.md#milestone-8-site-docs-sample-and-changelog) builds the changelog frames.

This is the components sub-contract of [Site design](./site-design.md), which
owns the roles, the type, the layout and the brand. [Site](./site.md) owns the
contents and the order of the header, the menu and the footer.

## Canvas Parts

- Canvas: the page background is `background` with a 24px grid of 1px `dot`
  dots. Frames and panels sit on it.
- Frame: a `surface` sheet with a `border` ring and `shadow.small`. Its label
  sits 10px above its top-left corner: an icon and the name in `mono` 12px
  `textMuted`. A path's folder stays muted, and its file name takes
  `textSecondary`. A size may close the label at its right end. A selected
  frame's label takes `signalDeep`.
- Selection: a 1.5px `signal` outline over the selected part, with 9px square
  handles at the corners, or at the corners and the edge midpoints. A
  selection may carry a name tag over its top-left corner in `mono`
  `signalDeep`, a type badge over its top-right corner, and a size tag
  centred 9px below it. A soft selection tints its outline, for a frame that
  holds text. A person's selection takes that person's colour.
- Size tag: `mono` 11px tabular figures, 20px tall, on `signal` with
  `onSignal` text, or on a person's colour. A size tag that measures a part of
  the page shows the rendered size of that part in CSS pixels and follows
  resizing.
- Redline: a 1px `signal` rule with end ticks and a `mono` value tag that
  shows the measured gap.
- Chip: a pill at least 22px tall in 12px type, for a version, a status or a
  branch. A signal chip is `signalDeep` on `signalSoft`.
- Kicker: an uppercase `mono` 12px label in `textMuted` above a heading, with
  its index in `signalDeep`, such as `01 Browse`.
- Section box: a wash of `surface` with a faint ring, headed by a dark tag
  (`text` fill, `surface` label) and a `mono` meta line. It groups frames.
- Floating panel: a `surface` panel with a 14px radius, a `border` ring and
  `shadow.medium`. It has a 44px head with its title and a `mono` meta, a
  body of 44px rows and an optional foot. A row is `textSecondary` with its
  icon in `textMuted`, and hover fills it with `background`. The current row
  takes `signalSoft` with `text` at semibold, and its icon takes `signalDeep`.
- Cursor: the pointer of a depicted person or agent, with a name tag in that
  person's `people` colour.

Frame labels, selections, size tags, redlines and cursors are depictions:
they are hidden from assistive technology and take no focus.

## Buttons

A button is 48px tall, with a 10px radius and 15.5px type at weight 560. The
header's Get started is smaller, as the header says. On hover a button lifts
by 1px and its shadow deepens.

- Filled: `signalFill` with an `onSignalFill` label in both schemes. The
  filled kind marks a page's primary actions: Get started, in the header and
  in the home's action pairs, and the trial action on pricing.
- Secondary: `surface` with a `borderStrong` ring and `shadow.small`.
- Quiet: no fill, with a `borderStrong` ring.
- On hover, the ring of a secondary or quiet button takes `text`.
- An arrow after a label, as in **Get started →**, moves 3px on hover and is
  hidden from assistive technology.

## Header

The header is the design file's tool bar: a sticky `surface` band on every
page, with a `border` hairline and `shadow.small` at its foot. It is 56px
tall on desktop and 60px on mobile.

- Desktop: the brand at the start, the file title centred on the page, and at
  the end the depicted people, the navigation and **Get started →**. The file
  title, with its `mono` branch chip, and the people are depictions.
- Navigation links are 14.5px, medium weight, in `textSecondary`. Each is
  drawn 36px tall with a 44px target. Hover fills a link with `background`
  and turns it `text`. The current page's link is `text`, with a 2px `signal`
  rule on the band's foot.
- **Get started →** is a filled button, 36px tall with a 44px target.
- Steps: below 1400px the file title centres between the brand and the end
  group. Below 960px the people leave, and below 830px the file title leaves.
  The navigation and Get started stay in the row down to the mobile
  composition.
- Mobile: the brand, **Get started →** at 44px and the menu control, a 44px
  square with the menu glyph.

## Menu

Below 768px the menu control opens the menu: a full-width `surface` sheet
that drops in below the 60px tool bar, with a `border` hairline and
`shadow.large`, over a scrim. The scrim is `text` at 32% in light and
`background` at 70% in dark. The sheet fades in and settles 8px over
`motion.standard`, and both reverse on close. The close control takes the
menu control's place in the bar's top-right corner. The destinations are 48px
rows at 17px, medium weight, in `text`, with a `background` hover. The
current page is semibold with a 7px `signal` dot. A hairline separates
**Get started →**, a full-width filled button. Forced-colors mode gives the
sheet a system-color border.

## Footer

The footer is the last frame on the canvas, labelled `Footer`: a `surface`
frame at most 1240px wide, 120px below the page content and inside the page
gutter. It pairs the brand column with the two link groups. The brand column
holds the brand, the open-source line in 15px `textSecondary` and the scheme
control. Group headings are uppercase `mono` 12px in `textMuted`. Links are
15px `text` with 44px targets. Hover turns a link `signalDeep` with an
underline, and the current page's link is `signalDeep`. On mobile the frame
stacks the brand column above the two groups, 96px below the content.

The design file's status bar runs on the canvas under the frame: the file
title, the people in the file and a zoom pill. It is a depiction.

The scheme control is a segmented control of two native radios, Light with a
sun and Dark with a moon. Its track is `background` with a `border` ring. The
chosen segment sits raised on `surfaceRaised` with `shadow.small` and a
`borderStrong` ring. The radio itself is visually hidden, and its segment
draws the focus ring. Segments are drawn 34px tall with 44px targets on
desktop, and they are 44px tall on mobile.

## Document Pages

The legal documents, the 404 page, the docs and the changelog share the
document type of [Site design](./site-design.md#type). A `mono` trail or
kicker sits above the title, and hairlines that cross the whole sheet rule
the body into sections. Body links are `signalDeep` at medium weight,
underlined in a 45% tint that turns solid on hover. Inline code sits on
`background` with a `border` ring and a 6px radius. List bullets are small
`surface` squares with a `signal` edge.

- Legal documents (Terms, Privacy, Complaints and Security): a page frame on
  the canvas at the `sitePolicy` measure, labelled with its source file, such
  as `legal/terms.md`, and selected with corner handles. The sheet holds the
  `Legal` kicker, the title, the effective date in `textMuted`, the
  introduction, the ruled sections and the links to the other legal
  documents under a `mono` label. Its padding is 60px 88px on desktop and
  36px 20px on mobile.
- The 404 page uses the legal document layout and holds only its heading.

## Code Panel

The code panel is the one dark surface of the site, in both schemes: `text`
fills it in light and `surfaceMuted` in dark, with a 12px radius. Code panels
stay dark in both schemes, as the Canvas design draws them. Highlighting that
follows the scheme was rejected, so that code reads as one surface on every
page.

- The 44px tab bar holds the open tab, which names the file or the language
  in `mono` 12px with a `signal` icon, an optional path, the language, and
  **Copy**: a 44px control with an icon and a visible label.
- The code is `mono` 13.5px, 12.5px on mobile, on a 1.78 line height. A long
  line wraps with a hanging indent, so the page never scrolls sideways.
- The panel draws line numbers and the `$` prompt of a shell line itself, so
  that the code's text stays exactly what Copy copies.
- A lit line takes a `signal` tint. A dimmed line takes the panel's muted
  text at full opacity.
- Every text colour of the panel keeps 4.5:1 against its fill in both
  schemes: the code, the syntax colours, the line numbers, the tabs and the
  dimmed lines.
