# Site Design

The public site uses Folio, the design selected for the Mokly product and
marketing, so moving from the site to the app feels like one product;
[Design tokens](./design-tokens.md) owns that selection and the canonical
values. This contract fixes the tokens, type, layout and brand the site must
implement, and the mockups that are its visual source of truth. Routes and
copy are in [Site](./site.md).

## Ownership

`packages/tokens` is the only token source. `apps/site` depends on the private
`@mokly-cloud/tokens` npm workspace exactly as `apps/app` and `apps/mockups` do; npm
links one local npm workspace copy, and no package is separately published or
downloaded. The site emits the package's responsive token CSS for system
light/dark and explicit `data-color-scheme` selectors. Site and mockup styles
consume only the resulting `--mk-*` properties. They declare no token, copied
palette, `--site-*` compatibility alias or literal color.

The token output for one scheme stays beneath its own selector, so light, dark
and explicit-scheme output coexist in one static document without leaking into
another scope.

Every site stylesheet references token properties only; a stylesheet that
contains a literal color fails the checks. The site ships light and dark.
Colors follow `prefers-color-scheme`, and the document root's
`data-color-scheme="light" | "dark"` attribute overrides that preference for
deterministic screenshots.

## Surfaces

| Site role           | `--mk-*` owner        | Use                                |
| ------------------- | --------------------- | ---------------------------------- |
| page canvas         | `color-background`    | Page canvas                        |
| quiet surface       | `color-surface-muted` | Docs sidebar and quiet sections    |
| raised surface      | `color-surface`       | Stage, code panels, inset surfaces |
| primary ink         | `color-text`          | Headings and body                  |
| secondary ink       | `color-text-muted`    | Secondary copy                     |
| decorative line     | `color-border`        | Decorative hairlines               |
| meaningful boundary | `color-border-strong` | Control boundaries                 |

The site document carries `folio-scope`, so these semantic roles resolve to
the authoritative Folio palette in [Design tokens](./design-tokens.md).

## Accent, Status And Focus

| Site role             | `--mk-*` owner                                                 |
| --------------------- | -------------------------------------------------------------- |
| link/accent ink       | `color-accent`                                                 |
| ink hover and pressed | `color-accent-hover`, `color-accent-active`                    |
| filled primary        | `color-accent-solid`                                           |
| on-primary content    | `color-on-accent`                                              |
| selected tint         | `color-accent-soft`                                            |
| keyboard focus        | `color-focus`                                                  |
| status ink            | `color-success`, `color-warning`, `color-danger`, `color-info` |
| status fill           | the matching `color-*-soft` role                               |

Pair each status color with its soft background. Filled actions start with
`accentSolid`, use the shared hover/pressed roles for interaction and keep
`onAccent` for their content. Accent ink and solid fill are not
interchangeable. Underline links in body text. Never use `border` as the sole
boundary of a control: the search control, quiet button, search field, section
disclosure, version chip and previous/next cards all take `borderStrong`.
Never convey state by
color alone. Normal text needs 4.5:1 contrast; large text, meaningful
boundaries and focus rings need 3:1, measured from the token values in both
schemes.

## Type

- `font.sans`: the self-hosted Inter variable face followed by the system stack
- `font.mono`: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
- `font.display`: `Georgia, "Times New Roman", serif`, used only for the
  wordmark.
- Weights 400, 500, 600, 700. Sizes are rem against a 16px base; respect
  browser text scaling and avoid fixed-height text containers.

| Role       | Mobile size / line | Desktop size / line | Weight |
| ---------- | ------------------ | ------------------- | ------ |
| `nano`     | 10 / 14            | 10 / 14             | 500    |
| `uiLabel`  | 11 / 16            | 11 / 16             | 600    |
| `caption`  | 12 / 18            | 12 / 18             | 500    |
| `small`    | 14 / 20            | 14 / 20             | 400    |
| `body`     | 16 / 24            | 16 / 24             | 400    |
| `lead`     | 20 / 30            | 20 / 30             | 400    |
| `heading3` | 24 / 32            | 24 / 32             | 600    |
| `heading2` | 28 / 36            | 32 / 40             | 600    |
| `heading1` | 36 / 44            | 48 / 56             | 600    |
| `hero`     | 44 / 48            | 64 / 68             | 600    |

The `uiLabel` and `nano` roles exist for depicted product chrome; `nano` never
sets reader-facing text. Navigation the reader acts on —
the section rubrics, the version label, the on-this-page heading, the previous
and next labels and the changelog's release rubric — uses `caption`.

Headings use `-0.02em` letter spacing; page headings on document pages use
`-0.045em` and weight 700. The home hero heading is one line in the `hero`
token with `-0.05em` letter spacing. Section headings on the home use
`heading2` with the second line in `accent`. Eyebrows use `small` in
`textMuted`; the hero eyebrow is a `pill` badge on `surface` with a `border`
edge. Feature numbers and closing step markers use `font.mono` in `accent`.
Prose stays within `65ch`.

## Space And Layout

- Spacing scale in pixels: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96.
- Breakpoint `768px`; below it use the mobile composition.
- `siteWide` is `1360px` for the header, home, docs and changelog;
  `contentMax` is `1120px` for changelog entries; `proseMax` is `65ch`.
- Gutters `20px` mobile, `40px` desktop. Section spacing `48px` mobile,
  `80px` desktop.
- Interactive targets at least `44px`. Controls use a 6px radius; panels, the
  catalogue frame and the feature modules use 10px.
- Docs layout: a `siteSidebar` 272px section-tree column on the page canvas
  separated by a vertical hairline, a `siteDocument` 768px document column,
  and a `siteOnPage` 240px rail hung from its own hairline. The rail drops
  below `siteRailBreakpoint` 1100px; below the breakpoint the tree
  becomes a disclosure above the document and the on-this-page list moves under
  the title. A published path or URL wraps rather than widening the column.
- Layouts remain usable at 320px width and 200% text zoom. Inspection
  viewports are 390px mobile and 1440px desktop.
- The catalogue frame uses `siteStageMobile` 520px and `siteStageDesktop`
  624px. Policy documents use `sitePolicy` 840px.

## Radius, Elevation, Focus And Motion

| Radius   | Pixels | Use                          |
| -------- | ------ | ---------------------------- |
| `small`  | 6      | Controls, badges, code panel |
| `medium` | 10     | Stage and panels             |
| `pill`   | 999    | Status and eyebrow badges    |

The hero stage uses `shadow.medium` from the token package. Focus is a
2px solid `focus` outline with 3px offset, never removed; forced-colors mode
keeps a system outline. Transitions use 120ms or 180ms with
`cubic-bezier(0.2, 0, 0, 1)` and honor reduced motion.

## Brand

The mark is the two overlapping rounded rectangles with two short rules, drawn
in `accent` with the rules in `surface`. The wordmark is lowercase
`mokly` in `font.display` at 1.75rem desktop and 1.5rem mobile with the period
in `accent`. The mark and wordmark together link Home. The site's favicon
redraws the same mark as an SVG whose accent and surface follow the color
scheme and equal the token values.

External consumers use the transparent full lockup at 192×64 SVG or 768×256
PNG, and the mark-only icon at 64×64 SVG or 512×512 PNG. Each has `-light` and
`-dark` variants for placement on light and dark surfaces. They fix the
corresponding scheme's `accent`, `text` and `surface` colors because external
images cannot inherit site tokens. The lockup outlines its wordmark so it
never depends on fonts installed by the consumer. Unsuffixed lockup and icon
paths are stable aliases of the light variants. The adaptive favicon remains
separate from these external assets.

## Components

- Header: one row inside a band on the page canvas with no fill, aligned to
  the wide measure; below the breakpoint the documentation search adds a
  second row. Documentation, changelog and legal documents rule the band
  off with a `border` bottom hairline; the home has no rule so the hero
  follows the header directly. There is no utility bar. **GitHub** links to
  the public `https://github.com/mokly-ai/mokly` repository at every width,
  from the row on desktop and from the menu on mobile. Row links
  are `small` in `textMuted`, 44px tall and underlined on hover; the current
  route is `text`. The documentation search control sits in that
  header beside the navigation and appears on no other route. The desktop
  **Get started →** is a small rounded secondary button with a
  `borderStrong` boundary; the hero and closing **Get started →** use
  `accentSolid` with `onAccent` text; **View on GitHub** is a quiet button
  with no fill. Every link and control has a hover state that changes more
  than color alone.
- Mobile header and menu: below the breakpoint the row holds the brand and
  the menu control, a 44px square with a `borderStrong` boundary and the
  three-rule line glyph; the documentation search takes the full row
  beneath. The menu is a `surface` panel `min(20rem, 100% - 48px)` wide with
  `shadow.large` and no border, full height at the right edge, over a
  backdrop of `text` at 40% opacity, the search dialog's backdrop. The panel
  slides in and the backdrop fades over 180ms, and both reverse on close.
  The close control repeats the menu control's geometry in its place. Below
  it, the destinations are 44px rows at `body` size in `text` with a
  `surfaceMuted` hover; the current page takes `accentSoft` with `accent`
  text, as in the documentation tree. A hairline separates **Get started →**,
  a full-width primary button. Forced-colors mode gives the panel a
  system-color border.
- Footer: a `surface` band that pairs the brand and the line stating the
  Mokly CLI is open source under the MIT license with two link columns —
  Product (Home, Docs, Changelog) and Legal (Terms, Privacy, Complaints,
  Security).
- Catalogue frame: the home's principal image, a `surface` panel with a
  `border` edge, `medium` radius and shadow. The head row holds the plain-text
  `Mokly Cloud · sydney-v1` label (`small`) and the **Ready for review** badge (success text on
  `successSoft`, pill, with a decorative dot); the foot row names the screen.
  Inside it the Mokly shell is redrawn from the tokens: the top bar with the
  mark and the catalogue search field, the catalogue navigation with its Specs
  and Components sections and depth-ruled rows, the
  screen header with crumbs, title and path chip, and the dotted stage holding
  the example screen. The shell is 624px tall on desktop and 520px on mobile,
  where the navigation column is dropped. In the site the stage holds the real
  project-created document from the dogfood catalogue in a sandboxed frame, drawn a
  quarter smaller than life so the whole screen fits. The navigation rows, the
  crumbs, the title and the path chip come from the build's catalogue index.
  The site's navigation includes a static All/Changes filter
  with All selected. The mockup stage has no filter. The document identity is
  `product/account/project-created`.
- Feature modules: three columns on desktop, one on mobile. Each module is a
  `surface` card with a `medium` radius whose head is a dotted panel
  framing one detail of the shell — the Changes filter, a comment pinned to a
  screen, the agent rail beside a screen — above the mono number, the label, a
  `lead`-sized title and muted body.
- Closing: `surfaceMuted` panel with `medium` radius, two columns on desktop,
  copy and actions left, the ordered steps right with accent mono markers.
- Documentation: the section tree sits on the page canvas rather than in a
  filled panel, separated from the document by one vertical hairline. On
  desktop the tree is pinned to the viewport and scrolls on its own, with the
  version label fixed at its top and the Changelog link fixed at its foot. The
  published Mokly CLI version heads it as a quiet chip linking the changelog,
  every section is listed expanded under a mono rubric head, rows are 44px
  targets with a `surfaceMuted` hover fill, and the current page takes
  `accentSoft` with `accent` text. The document is ruled: the location trail
  eyebrow, the page heading and an accent-ruled pull-quote lead close with a
  hairline, body sections are separated by hairlines, and previous and next
  are cards that take a `borderStrong` edge on hover. The on-this-page rail
  hangs from its own hairline at the outer edge.
- Plan cards: two abreast on desktop, one on mobile, at the content measure.
  Each is a `surface` card with a `border` edge and `medium` radius holding
  the plan name at `lead`, the audience in `textMuted`, the amounts at
  `heading2` with their unit in `small` `textMuted`, and an `accent`-bulleted
  list of what the plan publishes, ruled off from the amounts by a hairline.
  A hairline above the foot separates the two actions and the tax note.
- Changelog: a sticky release index of version and date beside the entries,
  each row pairing the **Mokly CLI** version badge, the date and the release
  link with the grouped notes of that release.
- Legal documents (terms, privacy, complaints, security): the same chrome and
  document column at the 840px measure, with the Legal eyebrow, page heading,
  effective date, ruled Markdown body and navigation to the other documents.
- Code panel: `surface` with a `border` edge, `small` radius, mono
  text, and a copy control in the top-right corner with a visible label on
  focus and a confirmation after copying.
- Status badges, buttons, the search control and the version chip keep the
  shared control geometry; no site stylesheet overrides a control's font,
  radius or colors.

## Mockups

[Site mockups](./site-mockups.md) defines the seven site screens, tour,
shared source components, depicted release facts and parity checks.
