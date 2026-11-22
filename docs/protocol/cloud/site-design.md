# Site Design

The public site uses Canvas, the one design language of Mokly. The site reads
as a live design file: a dot-grid canvas, labelled frames, green selections
with handles and size tags, Geist type and one signal green. The cloud app
and the open-source Browse shell use the same look, so moving from the site
to the product feels like one product. This contract fixes the roles, type,
layout and brand that the site implements, and the mockups that are its
visual source of truth.

- [Site design components](./site-design-components.md): the Canvas parts,
  the buttons, the header, the menu, the footer, the document pages and the
  code panel.
- [Site design pages](./site-design-pages.md): the home, the changelog and
  the pricing page.
- [Site docs layout](./site-docs-layout.md): the documentation layout.

Routes, the contents of the header and the footer, and the scheme choice are
in [Site](./site.md). The home copy is in [Site home copy](./site-copy.md).

## Ownership

The `canvas` palette of `@mokly/ui/palette` is the one source of the colour
values and the font stacks. The private `@mokly-cloud/tokens` npm workspace
imports them, makes Canvas its default surface family and emits the `--mk-*`
properties. `apps/site` depends on that workspace exactly as `packages/app` and
`apps/mockups` do; npm links one local npm workspace copy, and no package is
separately published or downloaded. [Design tokens](./design-tokens.md),
[Design token colors](./design-tokens-color.md) and the
[viewer palette](../mokly-viewer-palette.md) own the values and the role
mapping. This page names the roles and does not repeat their values.

The site emits the package's responsive token CSS for system light and dark
and explicit `data-color-scheme` selectors. The output for one scheme stays
beneath its own selector, so light, dark and explicit-scheme output coexist
in one static document without leaking into another scope. Site and mockup
styles consume only the resulting `--mk-*` properties. They declare no token,
copied palette, `--site-*` compatibility alias or literal colour. A tint
mixes two parts in any colour space, and each part is a role, `currentColor`,
`transparent` or another tint. This is decision 26, option C: nested tints
keep the approved colours of the drawn demo app, and single mixes of two
roles were rejected, because four of its colours moved visibly. A stylesheet
that contains a literal colour fails the checks.

The site ships light and dark. Colours follow `prefers-color-scheme`, and the
document root's `data-color-scheme="light" | "dark"` attribute overrides that
preference. The scheme choice and `?scheme=` of [Site](./site.md) set the
attribute.

## Roles

| Site role     | Canvas role     | Use                                                   |
| ------------- | --------------- | ----------------------------------------------------- |
| canvas        | `background`    | The page behind every frame; quiet fills of rows      |
| grid          | `dot`           | The dots of the canvas grid                           |
| frame         | `surface`       | Frames, panels, cards and the header band             |
| raised        | `surfaceRaised` | The chosen segment of a segmented control             |
| muted surface | `surfaceMuted`  | Group rows of a table; the code panel in dark         |
| ink           | `text`          | Headings, body and dark tags; the code panel in light |
| secondary ink | `textSecondary` | Leads, module copy and navigation links               |
| muted ink     | `textMuted`     | Labels, kickers, frame labels and meta text           |
| hairline      | `border`        | Decorative hairlines and the rings of frames          |
| boundary      | `borderStrong`  | Control boundaries                                    |
| signal        | `signal`        | Selections, handles, size tags, redlines and wires    |
| on signal     | `onSignal`      | Text on a signal tag                                  |
| signal tint   | `signalSoft`    | Selected rows and signal chips                        |
| signal ink    | `signalDeep`    | Green text and icons: links, indexes, current markers |
| button fill   | `signalFill`    | Filled buttons and the checked option of a filter     |
| on button     | `onSignalFill`  | The label of a filled button                          |
| people        | `people`        | Cursors, selections and tags of the depicted people   |

Status text and fills use the shared `success`, `warning`, `danger` and
`info` roles with their soft fills: the changed and removed chips, the
breaking callout and the depicted diff. The focus ring takes `signalDeep`,
and `signal` inside the code panel.

Reading text in green uses `signalDeep`. `signal` marks selections, handles,
tags, rules, wires and the brand. Each depicted person or agent keeps one
`people` colour on every page: `fill` for the cursor, the selection and the
tags, and `ink` for text on the fill. Underline links in body text.

Never use `border` as the sole boundary of a control: buttons, the search
control, Edit on GitHub, the On this page disclosure, the previous and next
frames and the chosen option of a segmented control take `borderStrong` or a
fill that meets 3:1. Never convey state by colour alone.

Normal text needs 4.5:1 contrast against its fill. Large text, meaningful
boundaries and focus rings need 3:1, measured from the token values in both
schemes. The filled button pair, `onSignalFill` on `signalFill`, needs 3:1.
This is decision 4, option A: the design's green with a white label stays in
both schemes, and a darker fill that reaches 4.5:1 was rejected, because it
loses the chosen green.

## Type

- `sans`: the self-hosted Geist variable face, then the palette's system
  stack. It sets headings, body text, controls and the wordmark.
- `mono`: the self-hosted Geist Mono variable face, then the palette's system
  stack. It sets labels, kickers, frame labels, size tags, paths, versions
  and code.
- Instrument Serif 400, self-hosted, sets only the titles and the prices of
  the drawn demo app on the home.
- All three faces use the SIL Open Font License. No page loads a font, or any
  other resource, from a third-party host.
- Sizes are rem against a 16px base; respect browser text scaling and avoid
  fixed-height text containers. The pixel sizes below assume the 16px base.

| Text                 | Desktop | Mobile | Tracking   |
| -------------------- | ------- | ------ | ---------- |
| Home hero heading    | 162     | 82     | `-0.058em` |
| Changelog title      | 96      | 48     | `-0.052em` |
| Pricing title        | 76      | 42     | `-0.054em` |
| Home section heading | 66      | 38     | `-0.048em` |
| Docs title           | 62      | 40     | `-0.052em` |
| Legal title          | 56      | 40     | `-0.052em` |
| Home module heading  | 42      | 28     | `-0.036em` |
| Document `h2`        | 27      | 24     | `-0.034em` |
| Home lead            | 23.75   | 19     | `-0.012em` |
| Changelog lead       | 21      | 18     | `-0.012em` |
| Docs lead            | 20.5    | 18     | `-0.014em` |
| Legal introduction   | 19      | 17     | `-0.012em` |
| Pricing lead         | 18      | 17.5   | `-0.012em` |
| Document body        | 17      | 16     | `-0.006em` |

- Headings are semibold. A heading of two lines sets its second line in
  `textMuted` where the copy splits it. The hero heading is one line on
  desktop and two lines on mobile.
- On desktop widths below 1440px, the home, changelog, pricing and docs
  headings and leads scale down with the window, in the steps that their
  mockups draw. No text passes its desktop size.
- Body text sits on a 1.7 line height, 1.68 on mobile, and stays within
  `65ch`. Leads use `textSecondary`.
- Labels, kickers, rubrics, frame labels, size tags, versions and paths use
  `mono` at 11px to 12.5px. Kickers, rubrics and the location trail are
  uppercase with open tracking. Size tags, versions and amounts use tabular
  figures.
- Reader-facing text is at least 11px. Only depictions set smaller text.

## Space And Layout

- Spacing follows the token scale in pixels: 0, 4, 8, 12, 16, 20, 24, 32,
  40, 48, 64, 80, 96. A Canvas part may set an exact offset, such as a frame
  label 10px above its frame.
- Below `768px` the site uses the mobile composition. The desktop
  composition steps between that breakpoint and its 1440px design width; each
  page names its steps. Above 1440px the canvas grows, and each page keeps its
  own measure.
- The canvas gutter is 78px at 1440px and 5.4% of the window below it,
  between 20px and 80px. The mobile gutter is 20px. A page frame on mobile
  keeps a 10px canvas margin.
- `sitePolicy` is 840px for policy documents, and `proseMax` is `65ch`.
- Interactive targets are at least `44px`. A control drawn smaller, such as a
  36px navigation link, reaches 44px through a transparent band above and
  below it.
- Layouts remain usable at 320px width and 200% text zoom, and no page
  scrolls sideways. A published path or URL wraps rather than widening its
  column. Inspection viewports are 390px mobile and 1440px desktop.

## Radius, Elevation, Focus And Motion

| Radius  | Pixels  | Use                                                |
| ------- | ------- | -------------------------------------------------- |
| frame   | 0 to 3  | Page, release, plan and step frames                |
| tag     | 3 to 6  | Size tags, name tags, dark tags and redline values |
| control | 7 to 10 | Buttons, fields, rows and segmented controls       |
| code    | 12      | Code panels, filter bars and disclosures           |
| panel   | 14      | Floating panels, depicted windows and threads      |
| pill    | 999     | Chips, avatars and dots                            |

A frame on the canvas takes a `border` ring and `shadow.small`. A floating
panel takes a `border` ring and `shadow.medium`. The menu, the tree sheet and
the depicted windows take `shadow.large`. Transitions use `motion.fast` or
`motion.standard` with the shared easing. Every transition and animation
honours reduced motion: nothing moves, and each part shows its finished
state.

Keyboard focus shows the focus ring of the `@firna/ui` controls: a glow, a
4px halo with no blur, in place of an outline. The glow is `signalDeep` at
75% on every page surface and `signal` at 75% inside the code panel, so that
each keeps 3:1 against the surface it draws on in both schemes; `signal` on
a light surface stays below 3:1 at any share. A control draws the glow
outside its box and keeps its own shadow under the glow. A row of a list and
a part of the code panel draw it inside their box, so that a panel that
scrolls or clips keeps it whole. The segment of a segmented control draws
the glow of its hidden radio. Every focusable control shows the glow, and
nothing removes it. Forced-colors mode drops shadows, so there focus takes a
2px system outline. This is decision 32: the site takes the focus design of
the `@firna/ui` controls, so that focus looks the same on the site and in the
cloud app, and the 2px `focus` outline with a 3px offset was rejected.

## Brand

The mark is an ink outline frame behind a green front layer that carries two
short rules: the selected layer of a design file. The outline frame is
`text`. The front layer is `signal` with a `surface` halo, and its two rules
are `onSignal` with round caps. The wordmark is lowercase `mokly` in `sans`
at 22px, weight 640 and `-0.055em` tracking, with its period in `signal`. The
mark and the wordmark together link Home with a 44px target, and the brand is
the same on every page.

Decision 5, option B, puts this mark and wordmark on every Mokly surface: the
brand files, the favicon, the social cards, the Browse shell, the app, the
emails and the desktop icon. A brand for the site only was rejected, because a
design-tool brand needs one mark everywhere. This page owns the site brand,
and [Shell brand](../mokly-shell-brand.md) owns the mark of the shell.

The site's favicon redraws the same mark as an SVG whose colours follow the
color scheme and equal the token values.

External consumers use the transparent full lockup at 192×64 SVG or 768×256
PNG, and the mark-only icon at 64×64 SVG or 512×512 PNG. Each has `-light`
and `-dark` variants for placement on light and dark surfaces. They fix the
corresponding scheme's colours of the mark and the wordmark, because external
images cannot inherit site tokens. The lockup outlines its wordmark so it
never depends on fonts installed by the consumer. Unsuffixed lockup and icon
paths are stable aliases of the light variants. The adaptive favicon remains
separate from these external assets.

## Mockups

[Site mockups](./site-mockups.md) defines the site screens, the tour, the
shared source components, the depicted release facts and the parity checks.
