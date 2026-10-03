# Mokly Shell Design Contract

## Scope

This document records the approved design for the package-owned Browse shell
and the optional in-place screen comparisons. The visual source of truth is the
design catalogue in the basic example, whose entry names start with `design-`;
this contract fixes the tokens, dimensions, and responsive behavior that
implementation and tests must preserve. Runtime behavior stays in
[mokly-runtime.md](./mokly-runtime.md).

## Delivery Status

This document describes the implemented shell design, including active-row
ancestor disclosure, conditional filter clearing, nearest-row scrolling, the
`tag:` search term, the details inspector's tag chips, the search field's tag
control with its picker panel, the mark-only narrow brand, and the top bar's
stacking above the navigation drawer scrim. Every state recorded here is
implemented, including aligned comparison scrolling. The
[React Browse shell plan](../../plans/react-browse-shell.md)
changes how the shell is rendered and enhanced, not how it looks or behaves:
this design, its tokens, dimensions, responsive rules and the design catalogue
remain binding on the hydrated React implementation, and no mockup changes
are part of that plan. The separate
[component explorer designs](./mokly-component-design.md) are implemented
mockups whose runtime-backed states are identified in their own contract.

The path identity contract renames the Pages section to Specs, makes folder
rows browse-only, and adds the `Overview` first-child row, the path chip,
Markdown document pages, and `Moved` Changes rows. Those states are approved
below and designed in `design/browse/views/folder-overview`,
`design/browse/pages/document`, `design/changes/outcomes/moved`, and the updated Browse,
page, and component designs. The shell implements the Specs rows, breadcrumbs,
path chip, and Markdown document pages, and a paired move keeps one entry; the
[path identity plan](../../plans/path-identity.md) delivers its `Moved` label.

Auto/Light/Dark interface appearance is designed in the
`design/browse/appearance/**` mockups and specified by the
[semantic palette](./mokly-viewer-palette.md). The shell now carries that
palette in both appearances, selected on a viewer root, and an embedded host
chooses one with `theme`. A standalone document carries the delivered Appearance
control at every width and uses it for both the shell and the previews.

The page and publication designs are implemented in the example catalogue and
shared shell. Whole documents use a plain bordered pane and omit
device/comparison controls. Removed pages are flat Changes rows; baseline
breadcrumbs are text even after their parents are deleted. Ordinary
publications omit the Changes filter and comparison band while preserving the
same navigation, search, tags, and variants.

The comparison designs implement the [pane](./mokly-comparison-panes.md),
[scrolling](./mokly-comparison-scrolling.md), and
[Scroll together](./mokly-comparison-scroll-together.md) contracts, including
stacked component frames, paired app-shell panels, and the switched-off state.

The removed-document and removed-screen designs depict the shipped
[removed previews](./mokly-removed-previews.md) behavior: the previous version
under a quiet "Showing previous version" label, with loading, unavailable, and
long-content states in their own child pages. The shell renders those states at
runtime. The removed-screen family also designs a viewport with no captured
previous view; the shell renders the note fixed by the
[removed content previews plan](../../plans/removed-content-previews.md).

## Design Mockups

The approved screens are authored in `examples/basic/specs/design/`. The
[shell design inventory](./mokly-shell-design-inventory.md) lists every Browse
and Changes design screen with its folder and depicted state, describes the
fixture catalogue they browse, and owns the dual-scheme and owning-group rules;
the [component design inventory](./mokly-component-design.md#owning-catalogue)
lists the component explorer screens.

## Consumer-Tunable Custom Properties

Consumers may set exactly these CSS custom properties to tune the shell accent.
The shell reads them with the defaults below; every other shell style is
package-owned and not a compatibility surface.

| Property                  | Default                   | Used for                      |
| ------------------------- | ------------------------- | ----------------------------- |
| `--mokly-accent`          | `#4f7864`                 | Active pills and rows         |
| `--mokly-accent-contrast` | `#ffffff`                 | Text and glyphs on the accent |
| `--mokly-accent-soft`     | `rgba(79, 120, 100, 0.1)` | Hover and highlight surfaces  |

A consumer accent pair must keep at least WCAG AA contrast between
`--mokly-accent` and `--mokly-accent-contrast`; the shell does not
recompute contrast at runtime. The [Mokly shell brand](./mokly-shell-brand.md)
is package-owned identity and ignores these consumer accent overrides.

## Package-Owned Tokens

The shell chrome supports Light and Dark independently of the preview's color
scheme. Light retains its neutral/sage family; Dark uses Mokly Cloud's warm
Folio neutrals with sage accents. The complete mapping and both palettes live in
the [semantic palette](./mokly-viewer-palette.md). The Light values are:

| Token                    | Value                            | Role                     |
| ------------------------ | -------------------------------- | ------------------------ |
| `--chrome-bg`            | `#f4f4f1`                        | Application background   |
| `--chrome-surface`       | `#ffffff`                        | Cards, bars, panes       |
| `--chrome-ink`           | `#1a1d1c`                        | Primary text             |
| `--chrome-ink-2`         | `#4a4f4d`                        | Secondary text           |
| `--chrome-muted`         | `#676e6a`                        | Tertiary and labels      |
| `--chrome-border`        | `#e3e5e0`                        | Hairline borders         |
| `--chrome-border-strong` | `#c8ccc4`                        | Frame and strong borders |
| `--chrome-control-edge`  | `#868e88`                        | Interactive boundaries   |
| `--chrome-accent`        | `#2a4733`                        | Deep-accent prose links  |
| `--chrome-brand`         | `#2f5945`                        | Mokly brand mark         |
| `--chrome-shadow`        | `0 30px 90px rgba(20,28,22,.14)` | Overlay elevation        |

The shipped shell and appearance mockups share the two corrected Light values:
`--chrome-muted` is `#676e6a`, and control outlines, grips and field borders use
`--chrome-control-edge` `#868e88` so `--chrome-border-strong` remains limited to
device and pane frames. Both are recorded, with their contrast, in the
[semantic palette](./mokly-viewer-palette.md).

Typography is **Inter** (a variable font packaged with the shell and served at
`/__mokly/fonts/InterVariable.woff2` under its SIL OFL license) via
`--sans: "Inter", ui-sans-serif, system-ui, …` at a 13px shell base, with
`--mono: "SFMono-Regular", Consolas, …` for ids, addresses, and paths.
The [brand contract](./mokly-shell-brand.md) owns the system-serif wordmark
exception; no serif font file is packaged.
The nav indent guides use the faint `--mbk-guide: #dbded8` tint. The shell
ships no consumer product fonts beyond Inter, and no consumer-specific color,
name, or route family may appear in shell styles or copy.

## Layout

The shell fills the viewport (`100vh`, document scrolling disabled); every
scrollable region scrolls internally:

- **Top bar** — 48px, surface background, hairline bottom border: the
  [Mokly mark and wordmark](./mokly-shell-brand.md), then a centred search field
  (max-width 440px, led by a 15px stroked magnifier icon that holds its size while the field flexes)
  that flexes down to whatever room the bar leaves it. Below the breakpoint a menu button opens the
  catalogue drawer. Search uses
  `Search catalogue` as its accessible name and `Search catalogue…` as its
  placeholder in both viewport sizes, covering screens, pages, and flows.
  The bar carries no preview mode switch; the delivered Auto/Light/Dark
  Appearance control is the one setting that belongs here.
  A query splits into terms: every `tag:<tag>`
  term matches only rows whose entry declares that tag, and the remaining words
  rejoin into one phrase that must appear in a row's path segments, title, or
  tags. A row stays visible only when it matches every tag
  term and that phrase;
  tag terms hide the groups they empty and open the groups they keep, and they
  compose with the All/Changes filter.
- **Tag picker** — a tag-icon control at the trailing edge of the search
  field, muted like the leading search icon and filling to a soft rounded square
  on hover. It opens a panel anchored under the field and aligned to its width
  (max-width 440px): a `--chrome-surface` card with a hairline border, 10px
  radius, and `--chrome-shadow` elevation, holding an uppercase 11px muted
  `Tags` head above a wrapping row of the details inspector's tag chips. The
  panel lists every tag the catalogue declares, in alphabetical order, and
  scrolls internally once that set outgrows it. Selecting a chip enters
  `tag:<tag>` in the search field, replacing any tag term already entered, and
  closes the panel; selecting the chip whose tag is the entered term clears that
  term. The chip matching the entered query carries the accent active state with
  contrast text and glyph. A tag chip is a button on both surfaces: it reports
  whether its tag is entered through `aria-pressed`, fills with the soft accent
  on hover, and moves down 1px with an inset shadow while pressed. Opening the
  panel moves focus to the chip for the entered tag, or to the first chip when
  no tag is entered; the chip row then keeps a single tab stop that ArrowLeft
  and ArrowRight rove and wrap at both ends, Home and End send to its ends, and
  Enter or Space activates. That chip row is a labelled toolbar carrying the
  single tab stop, while the details inspector's chips stay independent tab
  stops. Escape closes the panel and returns focus to the control without
  changing the query, and a click outside closes it, returning focus to the
  control only when the closing panel still holds it. A catalogue that declares
  no tags renders neither the control nor the panel.
- **Navigation** — 248px initial column, `#fbfbfa` background, hairline right
  border. On desktop, an 8px-wide split separator with a centred 2×32px grip
  resizes the column from 192px to 480px without exceeding half the viewport.
  Dragging resizes continuously; Left/Right change it by 16px, Home/End choose
  its bounds, and double-click restores 248px. Served pages remember the last
  chosen width. The grip rests in the strong border color and turns
  accent-colored with a soft accent halo while hovered, keyboard-focused, or
  being dragged; the
  [workspace inspector divider](./mokly-component-workspace-design.md) reuses
  that affordance rotated. The separator is absent from the mobile drawer and
  without JavaScript. The head row is `CATALOGUE` (uppercase, 11px) with a text button
  labelled `Collapse all`; an All/Changes segmented filter (with a monospace
  changed count) is always present in live Serve, followed by the scrollable tree.
  While a comparison is being prepared or detection is pending, an 11px spinner
  replaces the count in its fixed four-character-wide slot. Selected Changes
  shows a spinner in place of rows with one of two messages: “Preparing
  comparison” above “This takes a moment. You can keep browsing All while it
  finishes.” before the comparison exists, then “Checking for changes…” while
  detection runs. Only the preparing state carries a secondary line; it is the
  one state whose message is a title plus detail, and the one whose spinner
  aligns to the first line instead of centring on the message. Each count-slot
  spinner is a status region named after the work it reports, so preparing and
  checking are distinguishable without opening the sidebar. A failed comparison, whether
  preparation or detection failed, shows the single unavailable message and a
  dash, and never names a command, path, or reason; a completed empty result
  shows `0` and “No changes found.” The filter and tree origin keep their
  positions throughout, and All stays selectable in every state.
  Reduced-motion settings disable rotation.
  The drawer below the breakpoint shows the same body. Static exports without
  Changes retain their filter-free layout. The catalogue-navigation component's
  `loading`, `preparing`, and `unavailable` variants are the mobile/desktop
  owning mockups for the three non-ready states.
  `design/changes/availability/preparing` and `design/changes/availability/unavailable` additionally own
  the preparing and failed states inside the complete shell, where Changes is
  selected and the chosen screen stays available. The preparing state exists only
  for derived baselines; see
  [derived baselines](./mokly-derived-baselines.md) for when it is published.
  - The tree begins with separate `Specs` and `Components` native disclosures,
    both open by default and both closed by `Collapse all`. Search and Changes
    hide sections when they hide every row in them. Both sections are views of
    the one [catalogue tree](./mokly-catalogue.md#tree) filtered by kind; the
    [folder contract](./mokly-folders.md#rows-and-clicks) owns rows.
  - Folder groups are native
    `<details>` whose summary row shows a closed/open folder SVG pair (swapped
    via the `[open]` state), a bold label, and a monospace child count. The
    summary only expands or collapses the folder and never navigates. A folder
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
    visible; the active row uses the accent with contrast text.
  - A screen or component with variants keeps its link row and adds a 16px
    chevron disclosure button at the row's trailing edge that toggles a list of
    its variant rows one indent step deeper, each with the variant icon — an
    outline of the parent's kind over a second, partially drawn outline, muted
    like the screen icon so only the flow icon takes the accent. The row and its button
    share one hover/selected pill, and the button rotates its chevron while
    open. The Changes filter shows only changed rows and marks the parent only
    when a variant changed, never for a changed folder member. The mark is a
    6px accent dot at the row's trailing edge, drawn in the contrast color on
    the active row; no edge, rail, or border marks a row. Beside the dot the
    row carries the visually hidden word `Changed`, which assistive technology
    reads and the search box ignores. A Removed or Moved row takes neither,
    because its label already ends in `· Removed` or `· Moved`; a moved entry,
    edited or not, keeps that one row at its new place. The
    [variant contract](./mokly-variants.md) owns the behavior; the
    `design/browse/variants/**` and `design/browse/index-entries/**` states own
    its mockups, the latter for a folder screen listing its members.
  - Catalogue-link navigation opens the active section and every folder on the active
    row's path and scrolls that row into view. Search and Changes filtering may
    stay selected only while the active row remains visible. Reapplying an
    active filter during navigation preserves collapsed groups outside the
    destination path, while editing the search or filter opens groups to reveal
    current matches. Clearing filtering restores earlier disclosures except
    for a destination path opened by navigation.
    Background loading/recovery retains a selected Changes filter while results
    are pending and when they arrive, even if the active preview is not in Changes.
- **Screen head** — surface band with the breadcrumb trail (11.5px, `›`
  separators; a folder crumb opens the folder's own page when one exists and
  otherwise expands that folder in the tree) and a title row: 19px heading plus
  a monospace path button showing the entry's path as written, with no `#`
  prefix. The button uses the
  standard pointer cursor, moves down 1px with an inset shadow while pressed,
  and copies the path without navigating.
  A selected screen places one right-aligned group of icon controls here:
  Mobile/Desktop/Both dropdown and component highlighting when applicable.
  Tooltips name each action. The head band carries no scheme control; the
  catalogue's one Appearance control lives in the top bar.
  A control whose axis hides a changed view carries a 6px accent dot in its
  top-right corner, ringed 1.5px in the surface colour: Appearance when a
  changed view uses another scheme and the viewport dropdown when another
  viewport changed. Both never marks the viewport dropdown. The control names
  a visually hidden `Other theme changed` or `Other viewport changed` through
  `aria-describedby`; the dot stays distinct from selection and draws no rail.
- **Stage** — dotted-grid background (22px radial dots), centred frames with
  40px gap that stack from the top below 760px, internal `overflow: auto`,
  `MOBILE` / `DESKTOP` uppercase frame labels, and no toolbar above the grid.
- **Details inspector** — the shared icon footer opens the chosen tab in place;
  closing it leaves no icon selected. Desktop uses a centered grip on the divider
  and mobile uses a full-workspace-width rounded bottom sheet with an iOS-style
  grabber. The footer owns that sheet's surface and shadow while its dock owns
  placement and height. Only panel content scrolls within the bounded workspace.
  Details contains a two-column
  body (`1.35fr / 1fr`) with description and
  `Why this screen —` rationale on the left and uppercase-labelled metadata
  rows (Source, Moved from, Schemes, Changed views, Tags, Related docs,
  Dependencies, Used by) on the right. Paths render as monospace chips; use
  cases render as pill chips with the flow icon; a related doc that is itself a
  catalogue document links to its entry; the Schemes row is plain text
  naming the schemes the screen renders in (`light, dark`). The Changed views
  row is plain text naming the views a ready classification marked changed
  (`Mobile · Dark, Desktop · Dark`), mobile before desktop and light before
  dark; it is hidden while no view is named. The Tags row lists the tags the entry
  declares as pill chips with the tag icon: selecting one enters `tag:<tag>` in
  the search field, so the filter stays visible and clearable there, and the
  chip whose tag is in the entered query carries the accent active state with
  contrast text and glyph. An entry that declares no tags omits the row.

Details has no Generated or Route row: every file derives from the entry's
path, and the address bar already shows the shell URL. A moved entry's Details
add a `Moved from` row holding its previous path, the `Moved` label its Changes
row carries, and its comparison details name that path as the earlier side. A
document's Details show its description, tags, and Markdown source file; a
component's Details add the shown entry's path above its source.

Shared home guidance asks visitors to choose an item from the navigation.
Unknown routes use `Item not found` and offer another catalogue item or the
catalogue home. Kind-specific wording is reserved for a known screen, page,
document, or flow; shared controls and missing-route messages cover the whole
catalogue.

## Device Chrome And Color Scheme

The phone and browser frames, the use-case flow layout, the document pane, and
the dark preview tokens with their containment and light-only rules are defined
by [shell device chrome and preview scheme](./mokly-shell-device-chrome.md).

## Responsive Behavior

The shell has one breakpoint at **56.25rem (900px)**:

- At or above it, the navigation column is persistent and the layout is the
  fixed two-column split above.
- Below it, the navigation becomes a scrimmed overlay drawer (82% width, max
  20rem) opened by the top-bar menu button throughout the catalogue. The
  drawer opens under the 48px bar and the bar stacks above the scrim, so the
  menu button that opened it, the brand and the query stay
  at full strength while only the shell below the bar dims. The tag picker
  stops anchoring to the narrow field and drops as a sheet spanning the shell,
  flush under the bar's bottom border with only its lower corners rounded. The
  phone frame scales via `aspect-ratio: 390 / 844` within available width, the
  browser frame drops to 560px height, flow connector lines hide, the details
  body stacks to one column inside its bottom sheet. The grouped view controls
  stay together in the screen head band and wrap beneath the title when needed.

`prefers-reduced-motion: reduce` disables shell transitions.

## In-place Comparisons

The catalogue remains the only shell. Eligible shown views place Current, Side
by side, Overlay, and Difference below the heading; Current starts selected.
Diffs load on demand in the same main region while navigation, details,
viewport, scheme, Refresh, and Retry stay available. The band appears for a
changed shown view, removed component variant, or verified affected consumer,
and is absent from Browse, Added, Unmodified, removed-screen, evidence-only,
and empty states. Static catalogues without comparison data omit it.

Both viewports reuse their device frames. Overlay and Difference keep both
script-disabled versions inside one opaque chrome; Side by side keeps one
captioned chrome per version. Missing component-variant panes remain explicit
and fall back to Side by side. Loading, failure, evidence, and ignored details
remain secondary and never invent pixel measurements. Exact presentation,
scrolling, switch geometry, responsive wrapping, app-shell dimensions, and
fixed-row depictions live in the linked comparison contracts above.

The canonical states are `design/changes/diff-controls/current`, `design/changes/diff-controls/overlay`,
`design/changes/diff-controls/overlay-long`, `design/changes/diff-controls/overlay-panel`, and
`design/changes/diff-controls/side-by-side-apart`, each with path-derived
`index.<viewport>.html` documents and mobile and desktop artboards. See
[Changes](./mokly-changes.md), [component designs](./mokly-component-design.md),
and [CSS evidence](./mokly-css-evidence-shell.md).

## Related Docs

- [Build and Browse runtime](./mokly-runtime.md)
- [Package and authoring contract](./mokly-package.md)
