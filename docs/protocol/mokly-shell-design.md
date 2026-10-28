# Mokly Shell Design Contract

## Scope

This document records the design for the package-owned Browse shell
and the optional in-place screen comparisons. The visual source of truth is the
design catalogue in the basic example, whose entry paths start with `design/`;
this contract fixes the tokens, dimensions, and responsive behavior that
implementation and tests must preserve. Runtime behavior stays in
[mokly-runtime.md](./mokly-runtime.md).

## Design Mockups

The design screens are authored in `examples/basic/specs/design/`. The
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
scheme. Light uses the neutral/sage family; Dark uses Mokly Cloud's warm
Folio neutrals with sage accents. The
[semantic palette](./mokly-viewer-palette.md#swatches) holds the value of every
token in both appearances and their recorded contrast.

Typography is **Inter** (a variable font packaged with the shell and served at
`/mokly-viewer/fonts/InterVariable.woff2` under its SIL OFL license) via
`--sans: "Inter", ui-sans-serif, system-ui, …` at a 13px shell base, with
`--mono: "SFMono-Regular", Consolas, …` for ids, addresses, and paths.
The [brand contract](./mokly-shell-brand.md) owns the system-serif wordmark
exception; no serif font file is packaged.
The nav indent guides use the faint `--mbk-guide` tint. The shell
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
  The bar carries no preview mode switch; the Auto/Light/Dark Appearance
  control is the one setting that belongs here.
  Matching uses the single [search rule](./mokly-folders.md#titles).
  Filtering hides empty groups and opens retained groups, and composes with
  the All/Changes filter.
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
  Enter or Space activates. The row is a labelled toolbar with one tab stop.
  Details chips keep independent tab stops. Escape closes the panel and
  returns focus to the control without changing the query. An outside click
  closes it and returns focus only if the panel held focus. Selecting a Details
  tag closes an open picker and focuses its toggle. A catalogue that declares
  no tags renders neither the control nor the panel.
- **Navigation** — the catalogue column with its All/Changes filter and its
  tree, under the [navigation column design](./mokly-shell-design-navigation.md).
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
  safe centring (a row or frame wider than the stage starts at its left edge),
  `MOBILE` / `DESKTOP` uppercase frame labels, and no toolbar above the grid.
- **Details inspector** — the shared icon footer opens the chosen tab in place;
  closing it leaves no icon selected. Desktop uses a centered grip on the divider
  and mobile uses a full-workspace-width rounded bottom sheet with an iOS-style
  grabber. The footer owns that sheet's surface and shadow while its dock owns
  placement and height. Only panel content scrolls within the bounded workspace.
  Details contains a two-column body (`1.35fr / 1fr`) with description and
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

Details has no rendered-file or route row: every file derives from the entry's
path, and the address bar already shows the shell URL. A moved entry's Details
add a `Moved from` row holding its previous path, the `Moved` label its Changes
row carries, and its comparison details name that path as the earlier side. A
document's Details show its description, tags, and Markdown source file; a
component's Details add the shown entry's path above its source.

Shared home guidance asks visitors to choose an item from the navigation.
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

## Device Chrome And Color Scheme

The phone and browser frames, the use-case flow layout, the document pane, and
the dark preview tokens with their containment and light-only rules are defined
by [shell device chrome and preview scheme](./mokly-shell-device-chrome.md).

## Responsive Behavior

See [responsive shell behavior](./mokly-shell-device-chrome.md#responsive-behavior).

## In-place Comparisons

The catalogue is the only shell. Eligible shown views place Current, Side
by side, Overlay, and Difference below the heading; Current starts selected.
Diffs load on demand in the same main region while navigation, details,
viewport, scheme, Refresh, and Retry stay available. The band appears for a
changed shown view, removed component variant, or verified affected consumer,
and is absent from Browse, Added, Unmodified, removed-screen, evidence-only,
and empty states. Static catalogues without comparison data omit it.

Both viewports reuse their device frames. Overlay and Difference keep both
script-disabled versions inside one opaque chrome; Side by side keeps one
captioned chrome per version. Missing component-variant panes stay explicit
and fall back to Side by side. Loading, failure, evidence, and ignored details
stay secondary and never invent pixel measurements. Exact presentation,
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
