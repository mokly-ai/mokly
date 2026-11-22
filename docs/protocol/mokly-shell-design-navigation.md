# Shell Navigation Design

Status: The floating catalogue panel, its head and foot, its Canvas rows and its sheet are not built yet. [Milestone 11](../../plans/canvas-redesign-milestones-viewer.md#milestone-11-canvas-stage-in-moklyui) builds them.

This continues the [shell design contract](./mokly-shell-design.md#layout). It
fixes the design of the Browse catalogue: the panel that floats over the
canvas, and its tree.

## Catalogue Panel

The catalogue is a panel that floats over the left edge of the canvas, where
the [canvas stage](./mokly-shell-canvas-stage.md#canvas) places it. It starts
252px wide, or 224px while the shell is narrower than 73.75rem (1180px). On the
wide layout, an 8px-wide split separator with a centred 2×32px grip on the
panel's right edge resizes the panel from 192px to 480px without exceeding half
the viewport. Dragging resizes continuously; Left/Right change it by 16px,
Home/End choose its bounds, and double-click restores the starting width.
Served pages remember the last chosen width, which replaces the starting width.
The grip turns accent-colored with a soft accent halo while hovered,
keyboard-focused, or being dragged, and its resting color follows the
[palette contract](./mokly-viewer-palette.md#recorded-contrast). The
separator is absent from the catalogue sheet and without JavaScript. Decision:
the floating panel keeps the resize, its keys and the remembered width, which
the mockups do not draw, because the resize is shipped behaviour and a deep
tree needs the width.

The panel's 44px head holds the `Catalogue` title, at 13px in the interface
type, and a text button labelled `Collapse all`. An All/Changes segmented
filter that spans the panel's width, with a monospace changed count, is always
present in live Serve, followed by the scrollable tree. In Changes, the
panel's foot names the comparison base: `Compared with` and the `base` ref of
the catalogue index in the mono face, such as `origin/main`. An index without
a known `base` shows no foot.

While a comparison is being prepared or detection is pending, an 11px spinner
replaces the count in its fixed four-character-wide slot. Selected Changes
shows a spinner in place of rows with one of two messages: “Preparing
comparison” above “This takes a moment. You can keep browsing All while it
finishes.” before the comparison exists, then “Checking for changes…” while
detection runs. Only the preparing state carries a secondary line; it is the
one state whose message is a title plus detail, and the one whose spinner
aligns to the first line instead of centring on the message. Each count-slot
spinner is a status region named after the work it reports, so preparing and
checking are distinguishable without opening the catalogue. A failed comparison, whether
preparation or detection failed, shows the single unavailable message and a
dash, and never names a command, path, or reason; a completed empty result
shows `0` and “No changes found.” The filter and tree origin keep their
positions throughout, and All stays selectable in every state.
Reduced-motion settings disable rotation.
Below the
[layout breakpoint](./mokly-shell-device-chrome.md#responsive-behavior), the
catalogue opens as a bottom sheet with the same head, filter, tree and foot. A
static build without Changes keeps the filter-free layout.
The catalogue-navigation component's `loading`, `preparing`, and
`unavailable` variants are the mobile/desktop owning mockups for the three
non-ready states. `design/canvas/loading/changes`,
`design/canvas/loading/changes/preparing` and
`design/canvas/loading/changes/unavailable` additionally own the checking,
preparing and failed states inside the complete shell, where Changes is
selected and the chosen screen stays on the canvas.
`design/canvas/loading/changes/empty` owns the empty result, and
`design/canvas/loading/changes/without-changes` the filter-free layout of a
static build without Changes. The preparing state exists only
while the base side renders from the base commit's sources; the
[catalogue read model](./mokly-catalogue.md) carries it as `changesStatus`.

## Tree

- The tree begins with separate `Specs` and `Components` native disclosures,
  labelled in the mono face, both open by default and both closed by
  `Collapse all`. Search and Changes
  hide sections when they hide every row in them. Both sections are views of
  the one [catalogue tree](./mokly-catalogue.md#tree) filtered by kind; the
  [folder contract](./mokly-folders.md#rows-and-clicks) owns rows.
- Folder groups are native
  `<details>` whose summary row shows a closed/open folder SVG pair (swapped
  via the `[open]` state), a bold label, and a monospace child count.
  The count is the number of immediate child rows that the active All,
  Changes and search/tag filters retain in this section. Count a retained
  child folder or variant parent once, not its descendants, and count a
  retained Overview row once. Collapsing a group does not change its count.
  Rows and counts must use the same visibility rule; do not count hidden,
  removed or nonmatching rows when that active filter excludes them.
  The summary only expands or collapses the folder and never navigates. A folder
  whose own page is a document, page, or flow lists that page as its first
  child row with that page's own icon, labelled with the page title or
  `Overview` when that equals the folder title; a folder whose own page is a
  screen or component renders as that entry's row with the disclosure
  described below. Leaves show a screen, variant, page, document, flow, or
  component SVG; the document SVG adds two lines of text to the page outline,
  and flow icons read in the accent.
- Rows indent 16px per depth from an 8px root inset and paint one faint
  1px vertical guide per ancestor depth. The hover/active highlight is an
  inset pill starting at the row's indent (`--mbk-indent`), so guides stay
  visible; the active row reads in ink on the soft accent, with its icon in
  the accent.
- A screen or component with variants keeps its link row and adds a 16px
  chevron disclosure button at the row's trailing edge that toggles a list of
  its variant rows one indent step deeper, each with the variant icon — an
  outline of the parent's kind over a second, partially drawn outline, muted
  like the screen icon so only the flow icon takes the accent. The row and its button
  share one hover/selected pill, and the button rotates its chevron while
  open. The Changes filter shows only changed rows and marks the parent only
  when a variant changed, never for a changed folder member. The mark is a
  6px accent dot at the row's trailing edge, on the active row too; no edge,
  rail, or border marks a row. Beside the dot the
  row carries the visually hidden word `Changed`, which assistive technology
  reads and the search box ignores. A Removed or Moved row takes neither,
  because its label already ends in `· Removed` or `· Moved`; a moved entry,
  edited or not, keeps that one row at its new place. The
  [variant contract](./mokly-variants.md) owns the behavior. The
  catalogue-navigation component's `variants`, `changed-variants`,
  `folder-screen` and `changed-member` variants are its owning mockups, the
  last two for a folder screen listing its members, and
  `design/browse/variants/variant-removed` depicts a removed variant under its
  surviving parent.
- Catalogue-link navigation opens the active section and every folder on the active
  row's path and scrolls that row into view. Search and Changes filtering may
  stay selected only while the active row stays visible. Reapplying an
  active filter during navigation preserves collapsed groups outside the
  destination path, while editing the search or filter opens groups to reveal
  current matches. Clearing filtering restores earlier disclosures except
  for a destination path opened by navigation.
  Background loading/recovery retains a selected Changes filter while results
  are pending and when they arrive, even if the active preview is not in Changes.

## Related Docs

- [Shell design contract](./mokly-shell-design.md)
- [Catalogue navigation](./mokly-navigation.md)
- [Folders](./mokly-folders.md)
- [Variant navigation](./mokly-variant-navigation.md)
