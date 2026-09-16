# Site Design

The public site uses Folio, the design selected for the Mokly product and
marketing on 2026-09-15, so moving from the site to the app feels like one
product. Its composition is Product, chosen by the user on 2026-09-15 from a
five-direction exploration whose other four directions were retired when
Product was promoted to the baseline mockups. This contract fixes the tokens,
type, layout and brand the site must implement, and the mockups that are its
visual source of truth. Routes and copy are in [Site](./site.md).

## Ownership

Tokens are defined once as CSS custom properties on the document root in
`design/folio/tokens.css` at the repository root, as `--site-*` properties.
That file is the single source both consumers read: `site/src/styles/tokens.css`
is an `@import` of it, which the site build inlines into the published
stylesheet, and the package build copies it to
`examples/basic/generated/site-tokens.css`, which the generated mockups link by
relative path. The copy is generated, not edited, and a test fails when it no
longer matches its source byte for byte.

The site's other sheets are `base.css` (reset, type roles, focus, targets,
forced colors and reduced motion), `chrome.css` (skip link, header band, brand,
navigation and search), `layout.css` (page and document columns) and
`footer.css`, each loaded once by the page layout. Every one of them references
those properties; a test fails the build when any other stylesheet contains a
literal color. The site ships light and dark. Colors follow
`prefers-color-scheme`, and the document root's
`data-color-scheme="light" | "dark"` attribute overrides that preference for
deterministic screenshots. The two repositories share Folio by copying these
tables; a published tokens package is not planned.

## Surfaces

| Token             | Light     | Dark      | Use                                |
| ----------------- | --------- | --------- | ---------------------------------- |
| `folio`           | `#fbfaf7` | `#1c1b19` | Page canvas                        |
| `folioMuted`      | `#f0eeea` | `#252420` | Docs sidebar and quiet sections    |
| `folioSurface`    | `#ffffff` | `#211f1b` | Stage, code panels, inset surfaces |
| `folioInk`        | `#2d2b27` | `#efece5` | Headings and body                  |
| `folioInkMuted`   | `#67615a` | `#b9b3a9` | Secondary copy                     |
| `folioLine`       | `#e3dfd8` | `#3c3933` | Decorative hairlines               |
| `folioLineStrong` | `#858077` | `#898276` | Meaningful control boundaries      |

## Accent, Status And Focus

| Token          | Light     | Dark      | Use                              |
| -------------- | --------- | --------- | -------------------------------- |
| `accent`       | `#176b46` | `#91dab0` | Primary actions, links, emphasis |
| `accentHover`  | `#105a39` | `#aeebc7` | Hovered primary actions          |
| `accentActive` | `#0d492f` | `#bdf4d2` | Pressed primary actions          |
| `onAccent`     | `#ffffff` | `#102218` | Text on accent fills             |
| `accentSoft`   | `#e2f2e9` | `#183d29` | Selected or quiet accent areas   |
| `focus`        | `#0b6bcb` | `#83baff` | Keyboard focus indicator         |
| `success`      | `#176b46` | `#91dab0` | Success text                     |
| `successSoft`  | `#e2f2e9` | `#183d29` | Success background               |
| `warning`      | `#80570c` | `#f4cd75` | Warning text                     |
| `warningSoft`  | `#fff2ce` | `#3b3015` | Warning background               |
| `danger`       | `#b42332` | `#ffafb7` | Error text                       |
| `dangerSoft`   | `#ffe9ea` | `#441e28` | Error background                 |
| `info`         | `#175cd3` | `#9fc3ff` | Info text                        |
| `infoSoft`     | `#e8f0ff` | `#182f4f` | Info background                  |

Pair each status color with its soft background. Use `onAccent` on solid
accent fills in every state, including the pressed state, which fills with
`accentActive`. Underline links in body text. Never use a decorative
`folioLine` as the sole boundary of a control: the search control, the quiet
button, the search field, the section disclosure, the version chip and the
previous and next cards all take `folioLineStrong`. Never convey state by
color alone. Normal text needs 4.5:1 contrast; large text, meaningful
boundaries and focus rings need 3:1, checked in both schemes. A unit test
measures each documented pair from the token file itself.

## Type

- `font.sans`: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- `font.mono`: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
- `font.display`: `Georgia, "Times New Roman", serif`, used only for the
  wordmark.
- Weights 400, 500, 600, 700. Sizes are rem against a 16px base; respect
  browser text scaling and avoid fixed-height text containers.

| Role       | Mobile size / line | Desktop size / line | Weight |
| ---------- | ------------------ | ------------------- | ------ |
| `caption`  | 12 / 18            | 12 / 18             | 500    |
| `small`    | 14 / 20            | 14 / 20             | 400    |
| `body`     | 16 / 24            | 16 / 24             | 400    |
| `lead`     | 20 / 30            | 20 / 30             | 400    |
| `heading3` | 24 / 32            | 24 / 32             | 600    |
| `heading2` | 28 / 36            | 32 / 40             | 600    |
| `heading1` | 36 / 44            | 48 / 56             | 600    |

Two smaller roles exist only for the depicted product chrome the home frame
draws: `micro` at 11px and `nano` at 10px, both in `font.mono` or uppercase
sans. They never set reader-facing text. Navigation the reader acts on —
the section rubrics, the version label, the on-this-page heading, the previous
and next labels and the changelog's release rubric — uses `caption`.

Headings use `-0.02em` letter spacing; page headings on document pages use
`-0.045em` and weight 700. The home hero is a semibold sans heading at 64px
desktop and 44px mobile, line height 1.05, letter spacing `-0.05em`, with its
second line in `accent`. Section headings on the home use `heading2` with the
same accent second line. Eyebrows use `small` in `folioInkMuted`. Feature
numbers and closing step markers use `font.mono` in `accent`. Prose stays
within `65ch`.

## Space And Layout

- Spacing scale in pixels: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96.
- Breakpoint `768px`; below it use the mobile composition.
- Wide measure `1360px` centered for the header band, the home, the
  documentation and the changelog. `contentMax` `1120px` centers the
  changelog's index and entries. Prose measure `65ch`. Form width `440px`.
- Gutters `20px` mobile, `40px` desktop. Section spacing `48px` mobile,
  `80px` desktop.
- Interactive targets at least `44px`. Controls use a 6px radius; panels, the
  catalogue frame and the feature modules use 10px.
- Docs layout: a 272px section-tree column (`sidebarWidth`) on the page canvas
  separated by a vertical hairline, a document column at most `768px`
  (`docMax`), and a 240px on-this-page rail (`onpageWidth`) hung from its own
  hairline. The rail drops below `1100px`; below the breakpoint the tree
  becomes a disclosure above the document and the on-this-page list moves under
  the title. A published path or URL wraps rather than widening the column.
- Layouts remain usable at 320px width and 200% text zoom. Inspection
  viewports are 390px mobile and 1440px desktop.

## Radius, Elevation, Focus And Motion

| Radius   | Pixels | Use                          |
| -------- | ------ | ---------------------------- |
| `small`  | 6      | Controls, badges, code panel |
| `medium` | 10     | Stage and panels             |
| `pill`   | 999    | Status badges                |

Shadows: `medium` is `0 8px 24px rgb(22 33 27 / 10%)` light and
`0 8px 24px rgb(0 0 0 / 32%)` dark, used only on the hero stage. Focus is a
2px solid `focus` outline with 3px offset, never removed; forced-colors mode
keeps a system outline. Transitions use 120ms or 180ms with
`cubic-bezier(0.2, 0, 0, 1)` and honor reduced motion.

## Brand

The mark is the two overlapping rounded rectangles with two short rules, drawn
in `accent` with the rules in `folioSurface`. The wordmark is lowercase
`mokly` in `font.display` at 1.75rem desktop and 1.5rem mobile with the period
in `accent`. The mark and wordmark together link Home. The site's favicon
redraws the same mark as an SVG whose accent and surface follow the color
scheme; a test keeps its values equal to the tokens.

## Components

- Header: one row inside a band on the page canvas with no fill, aligned to
  the wide measure. Documentation, changelog, terms and privacy rule the band
  off with a `folioLine` bottom hairline; the home has no rule so the hero
  follows the header directly. There is no utility bar. Links
  are `small` in `folioInkMuted`, 44px tall and underlined on hover; the
  current route is `folioInk`. The documentation search control sits in that
  header beside the navigation and appears on no other route. The desktop
  **Get started →** is a small rounded secondary button with a
  `folioLineStrong` boundary; the hero and closing **Get started →** are solid
  `accent` buttons with `onAccent` text; **Read the docs** is a quiet button
  with no fill. Every link and control has a hover state that changes more
  than color alone.
- Footer: a `folioSurface` band that pairs the brand and the line stating the
  Mokly CLI is open source under the MIT license with three link columns —
  Product (Home, Docs, Changelog), Account (Sign in, Get started) and Legal
  (Terms, Privacy). Columns become two on mobile.
- Catalogue frame: the home's principal image, a `folioSurface` panel with a
  `folioLine` border, `medium` radius and shadow. The head row holds the pull
  request label (`small`) and the **Ready for review** badge (success text on
  `successSoft`, pill, with a decorative dot); the foot row names the screen.
  Inside it the Mokly shell is redrawn from the tokens: the top bar with the
  mark and the catalogue search field, the catalogue navigation with its Pages
  and Components sections, the All or Changes filter and depth-ruled rows, the
  screen header with crumbs, title and id chip, and the dotted stage holding
  the example screen. The shell is 624px tall on desktop and 520px on mobile,
  where the navigation column is dropped. In the site the stage holds the real
  screen document from the example catalogue in a sandboxed frame, drawn a
  quarter smaller than life so the whole screen fits; the navigation rows, the
  crumbs, the title and the id chip come from the example build manifest, and
  the mockup's filter count and browser-chrome bar are not reproduced because
  no real value backs them.
- Feature modules: three columns on desktop, one on mobile. Each module is a
  `folioSurface` card with a `medium` radius whose head is a dotted panel
  framing one detail of the shell — the Changes filter, a comment pinned to a
  screen, the agent rail beside a screen — above the mono number, the label, a
  `lead`-sized title and muted body.
- Closing: `folioMuted` panel with `medium` radius, two columns on desktop,
  copy and actions left, the ordered steps right with accent mono markers.
- Documentation: the section tree sits on the page canvas rather than in a
  filled panel, separated from the document by one vertical hairline. On
  desktop the tree is pinned to the viewport and scrolls on its own, with the
  version label fixed at its top and the Changelog link fixed at its foot. The
  published Mokly CLI version heads it as a quiet chip linking the changelog,
  every section is listed expanded under a mono rubric head, rows are 44px
  targets with a `folioMuted` hover fill, and the current page takes
  `accentSoft` with `accent` text. The document is ruled: the location trail
  eyebrow, the page heading and an accent-ruled pull-quote lead close with a
  hairline, body sections are separated by hairlines, and previous and next
  are cards that take a `folioLineStrong` edge on hover. The on-this-page rail
  hangs from its own hairline at the outer edge.
- Changelog: a sticky release index of version and date beside the entries,
  each row pairing the **Mokly CLI** version badge, the date and the release
  link with the grouped notes of that release.
- Policy documents (terms, privacy): the same chrome and document column at
  the 840px measure, with the location eyebrow, the page heading, the
  placeholder heading and the cross-policy link.
- Code panel: `folioSurface` with a `folioLine` border, `small` radius, mono
  text, and a copy control in the top-right corner with a visible label on
  focus and a confirmation after copying.
- Status badges, buttons, the search control and the version chip keep the
  shared control geometry; no site stylesheet overrides a control's font,
  radius or colors.

## Mockups

The five site screens live in this repository's example design catalogue
under `examples/basic/entries/design/site/` and are generated under
`examples/basic/generated/design/site/`. They are the visual source of truth
for Milestone 4 onward; refinements happen here first, then in the site.

| Entry id                | Route                              | Screen                                               |
| ----------------------- | ---------------------------------- | ---------------------------------------------------- |
| `design-site-home`      | `design/site/home.html`            | Home with hero, catalogue frame, modules and closing |
| `design-site-docs`      | `design/site/docs.html`            | A docs page with the section tree, rail and search   |
| `design-site-changelog` | `design/site/changelog.html`       | Changelog with the release index and three entries   |
| `design-site-terms`     | `design/site/terms.html`           | Terms placeholder document                           |
| `design-site-privacy`   | `design/site/privacy.html`         | Privacy placeholder document                         |
| `design-site-tour`      | `user-flows/design/site-tour.html` | Home → Docs → Changelog → Terms → Privacy            |

The collection is registered from `examples/basic/entries/design/site/index.ts`
under the example catalogue's `Design` root, and it owns the tour. Each screen
is one component rendering mobile and desktop variants in light and dark.
Screens compose shared parts under
`examples/basic/entries/design/site/parts/`: `links.ts` (catalogue ids,
application links and current-route marking), `metadata.ts` (the shared
dependencies and related documents), `brand.tsx` (mark and wordmark),
`chrome.tsx` (skip link, header band, header, search, location trail,
version chip and grouped footer), `actions.tsx`, `glyphs.tsx`, `shell.tsx`
(the framed catalogue), `modules.tsx` (the feature modules and the closing),
`docs_data.ts` (the documentation architecture), `docs_navigation.tsx` (the
section tree, on-this-page rail and pager), `code_panel.tsx`, `releases.ts`
(the depicted releases) and `version.ts` (the depicted package version).

Controls are plain semantic elements — anchors, buttons, badges and the code
panel's copy control — styled from the site tokens. The site ships no
component library, so the mockups depict the markup the site implements rather
than borrowing the example's `@firna/ui` controls, whose own theme cannot
express Folio. The mockups link `examples/basic/generated/site-tokens.css`,
which the package build copies from `design/folio/tokens.css`; the layout
styles in `examples/basic/generated/site.css` reference only those properties
and hold no token definition of their own. Until the two layout sheets are
unified, a test compares them rule by rule at both compositions: every
selector both sides declare must declare the same values, and the differences
that are structural rather than drift are listed with their reason in
`tests/design_site_parity.test.ts`.

A fragment selects its composition from `data-site-viewport` on the root
element rather than a viewport width, so a mobile fragment depicts the mobile
composition at any preview width; the site implements the same rule as the
768px breakpoint, and the shared token file carries both mechanisms. Sign in and Get started are absolute links to the default
application origin. Destinations without an owning mockup — the other
documentation pages, previous and next — render as plain text, the rule the
rest of the design catalogue already follows.

Mockup copy comes from the approved home copy in
[Site](./site.md#home-copy); mockup release facts come from the real
`CHANGELOG.md` at the time of authoring and are labelled as fixtures in the
entry description, not in the screen. The stage shows the example's Welcome
screen inside the framed panel. Screens contain no implementation notes.
