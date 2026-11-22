# Mokly Shell Design Contract

Status: The canvas stage with its floating panels and its compact layout, the search keys, and the right panel with compare on every frame are not built yet. [Milestone 11](../../plans/canvas-redesign-milestones-viewer.md#milestone-11-canvas-stage-in-moklyui) builds the stage, the panels, the compact layout and the search keys, and [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds the right panel and compare.

## Scope

This document records the design of the package-owned Browse shell and its
in-place comparisons. The shell draws the Canvas design language: a dot-grid
canvas, labelled frames, panels that float over the canvas, Geist type and one
signal green. The visual source of truth is the design catalogue in the basic
example, whose entry paths start with `design/`. This contract fixes the
palette, the type, the dimensions and the responsive behaviour that the
implementation and the tests must keep. Runtime behaviour stays in
[mokly-runtime.md](./mokly-runtime.md).

## Design Mockups

The design screens are authored in `examples/basic/specs/design/`. Decision:
one Canvas family of Browse designs (decision 11, option D), not a second
family that draws the one-frame stage with the inspector below it, because the
canvas stage and the right panel replace that layout.

The [Canvas design inventory](./mokly-shell-canvas-inventory.md), with the
pages that it links, lists the `design/canvas` screens, and it owns their
family rules. They depict the canvas stage, the floating panels, Inspect,
Changes and the compact layout. They also depict a use case, loading and
recovery, the tag search, the added and moved outcomes, a removed entry's
previous version, the comparison evidence, the component explorer pages and
the Props states. The
[component design inventory](./mokly-component-design-inventory.md) lists the
component explorer and Props screens. The
[shell design inventory](./mokly-shell-design-inventory.md) lists the Browse
and Changes screens outside the Canvas family and owns the dual-scheme and
owning-group rules. The
[depicted design catalogue](./mokly-shell-design-catalogue.md) describes the
fixture catalogue that the design screens browse.

## Consumer-Tunable Custom Properties

Consumers may set exactly these CSS custom properties to tune the shell accent.
Every other shell style is package-owned and not a compatibility surface.

| Property                  | Used for                                       |
| ------------------------- | ---------------------------------------------- |
| `--mokly-accent`          | Selected marks, pressed pills, links and focus |
| `--mokly-accent-contrast` | Text and glyphs on the accent                  |
| `--mokly-accent-soft`     | Selected rows, hover and highlight surfaces    |

An unset property takes its default from the Canvas palette in the current
appearance. The [viewer palette](./mokly-viewer-palette.md) gives each
default. A consumer accent pair must keep at least WCAG AA contrast between
`--mokly-accent` and `--mokly-accent-contrast`; the shell does not
recompute contrast at runtime. The [Mokly shell brand](./mokly-shell-brand.md)
is package-owned identity and ignores these consumer accent overrides.

## Package-Owned Tokens

The shell draws the `canvas` palette of `@mokly/ui` in Light and Dark. The
interface appearance chooses the scheme of the chrome. Each frame on the canvas
keeps its own scheme, as the
[preview scheme rules](./mokly-shell-device-chrome.md#color-scheme) say. The
palette module is the one source of the shell's theme stylesheet. The
[viewer palette](./mokly-viewer-palette.md) holds the roles, their values in
both schemes and their recorded contrast. Decision: one Canvas look serves
Serve, the static build and every React host, the cloud included, not a second
palette that a host selects, because the site shows the open-source shell in
this look and one palette source cannot drift.

Typography is **Geist** for the interface at a 13px shell base, and **Geist
Mono** for ids, addresses, paths, frame labels and size tags. The shell
packages both faces under the SIL Open Font License and serves them under
`/mokly-viewer/fonts/`. The shell loads no font from another host and ships no
other face. The [brand contract](./mokly-shell-brand.md) owns the mark and the
Geist wordmark. The catalogue's indent guides use the faint guide tint of the
palette. No consumer-specific color, name, or route family may appear in shell
styles or copy.

## Layout

The shell fills the viewport (`100vh`, document scrolling disabled); every
scrollable region scrolls internally. Below the top bar, a full-bleed dot-grid
canvas fills the window, and the panels float over it. The
[canvas stage](./mokly-shell-canvas-stage.md) fixes the canvas, the floating
panels, the selected entry's section, pan, zoom and Fit. The
[canvas frames contract](./mokly-shell-device-chrome.md) fixes each frame, the
preview scheme and the compact layout.

- **Top bar** — 48px, surface background, hairline bottom border: the
  [Mokly mark and wordmark](./mokly-shell-brand.md), then a centred search
  field (max-width 440px, led by a 15px stroked magnifier icon that holds its
  size while the field flexes) that flexes down to whatever room the bar
  leaves it. Below the breakpoint a menu button opens the catalogue sheet, and
  closes an open sheet. Search uses `Search catalogue` as its accessible name
  and `Search catalogue…` as its placeholder in both viewport sizes, covering
  screens, pages, and flows. `⌘K` and Ctrl+K move focus to the search field
  from anywhere in the shell. `/` does the same while focus is not in a text
  field. The bar carries no preview mode switch; the Auto/Light/Dark
  Appearance control is the one setting that belongs here. Decision: the
  standalone shell keeps Appearance in its top bar, not in an account menu,
  because it has no account menu. Matching uses the single
  [search rule](./mokly-folders.md#titles). Filtering hides empty groups and
  opens retained groups, and composes with the All/Changes filter.
- **Tag picker** — a tag-icon control at the trailing edge of the search
  field, muted like the leading search icon and filling to a soft rounded square
  on hover. It opens a panel anchored under the field and aligned to its width
  (max-width 440px): a `--chrome-surface` card with a hairline border, 10px
  radius, and `--chrome-shadow` elevation, holding an uppercase 11px muted
  `Tags` head above a wrapping row of the Details Tags row's chips. The
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
  Enter or Space activates. The row is a labelled toolbar with one tab stop.
  Details chips keep independent tab stops. Escape closes the panel and
  returns focus to the control without changing the query. An outside click
  closes it and returns focus only if the panel held focus. Selecting a Details
  tag closes an open picker and focuses its toggle. A catalogue that declares
  no tags renders neither the control nor the panel.
- **Catalogue** — the floating catalogue panel with its All/Changes filter and
  its tree, under the
  [navigation design](./mokly-shell-design-navigation.md).
- **Canvas** — the selected entry's section and its frames on the dot grid,
  with the zoom pill at the bottom centre, under the
  [canvas stage](./mokly-shell-canvas-stage.md).
- **Right panel** — while an entry is selected, a panel floats at the right
  edge of the canvas, with the Inspect tab and, where the entry has a
  comparison, the Changes tab. The
  [component inspector design](./mokly-component-inspector-design.md) fixes
  the panel, its tabs and its sections.
- **Breadcrumbs** — the breadcrumb trail names the selected entry's folders,
  with `›` separators. A folder crumb opens the folder's own page when one
  exists, and otherwise expands that folder in the catalogue.

Inspect's head names the entry, its kind and its change status, and shows its
description and its Details rows: Path, Source, Moved from, Schemes, Changed
views, Tags, Related docs, Dependencies and Used by, in that order. A section
named for the entry's kind, such as `Why this screen`, holds its rationale.
Paths render as monospace chips that may wrap after each `/`; use cases
render as pill chips with the flow icon; a related doc that is itself a
catalogue document links to its entry; the Schemes row is plain text naming
the schemes the screen renders in (`light, dark`). The Changed views row is
plain text naming the views a ready classification marked changed
(`Mobile · Dark, Desktop · Dark`), mobile before desktop and light before
dark; it is hidden while no view is named. The Tags row lists the tags the
entry declares as pill chips with the tag icon: selecting one enters
`tag:<tag>` in the search field, so the filter stays visible and clearable
there, and the chip whose tag is in the entered query carries the accent active
state with contrast text and glyph. An entry that declares no tags omits the
row.

Details have no rendered-file or route row: every file derives from the entry's
path, and the address bar already shows the shell URL. A moved entry's Details
add a `Moved from` row holding its previous path, the `Moved` label its Changes
row carries, and its comparison details name that path as the earlier side. A
removed entry's Details add a `Location` row before Tags. It names the
folders that held the entry at the branch point, as text with `›` separators.
A document's Details show its description, path, tags, and Markdown source
file.

Shared home guidance asks visitors to choose an item from the navigation.
With nothing selected, the canvas holds the guidance and no right panel shows.
Its summary counts current catalogue records of every entry kind, including
screen and component variant records, independent of the active tree filters.
The summary lists the kinds in this order: screens, components, user flows,
catalogue pages, documents. It uses singular for one and plural otherwise,
omits zero-count kinds, and joins the rest with `" · "`. A
zero-entry input omits the summary. Removed records do not enter these counts.
Unknown routes use `Item not found` and offer another catalogue item or the
catalogue home. Kind-specific wording is reserved for a known screen, page,
document, or flow; shared controls and missing-route messages cover the whole
catalogue.

## Canvas Frames And Color Scheme

[Shell canvas frames, preview scheme and compact layout](./mokly-shell-device-chrome.md)
defines the canvas frames, a use case's step frames included, and the preview
scheme with its light-only rules.

## Responsive Behavior

See [responsive shell behavior](./mokly-shell-device-chrome.md#responsive-behavior).

## In-place Comparisons

The catalogue is the only shell. The right panel's Changes tab holds the
compare modes, which apply to every frame on the canvas: Current, Side by side,
Overlay, Difference and Swipe, with the keys 1 to 5. Current starts selected.
Overlay and Difference hold both versions in each frame, Swipe splits each
frame at one divider, and Side by side shows one frame's two versions next to
each other. Diffs load on demand on the same canvas while navigation, Inspect,
Refresh, and Retry stay available. Static catalogues without comparison data
have no Changes tab. Decision: compare on every frame, not on one chosen view,
because the canvas shows every viewport and scheme at once.

Loading, failure, evidence, and ignored details stay secondary and never report
a count or a percentage of changed pixels. The
[comparison panes](./mokly-comparison-panes.md) and the
[Changes controls](./mokly-changes-controls.md) fix each mode's presentation,
scrolling and controls, and the
[Changes tab](./mokly-changes-controls.md#changes-tab) section of the Changes
controls fixes the tab.

The canonical Canvas states are `design/canvas/changes/current`,
`design/canvas/changes/side-by-side`, `design/canvas/changes/overlay`,
`design/canvas/changes/difference` and `design/canvas/changes/swipe`, each with
path-derived `index.<viewport>.html` documents and mobile and desktop
artboards. `design/canvas/outcomes/added/changes` depicts an added entry, which
offers Current alone. `design/canvas/outcomes/moved` depicts a moved entry,
which compares with the version at its previous path. The
`design/canvas/components` screens depict a component's comparison on its
variant set, and the `design/canvas/evidence` screens the comparison evidence.
`design/canvas/outcomes/removed`, `design/canvas/outcomes/removed-document`
and `design/canvas/outcomes/removed-variant` depict the previous versions of a
removed screen, document and screen variant. None of them offers a compare
mode. See [Changes](./mokly-changes.md),
[component designs](./mokly-component-design.md), and
[CSS evidence](./mokly-css-evidence-shell.md).

## Related Docs

- [Build and Browse runtime](./mokly-runtime.md)
- [Package and authoring contract](./mokly-package.md)
- [Shell canvas stage](./mokly-shell-canvas-stage.md)
- [Shell canvas frames, preview scheme and compact layout](./mokly-shell-device-chrome.md)
- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
