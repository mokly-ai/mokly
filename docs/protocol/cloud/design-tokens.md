# Design Tokens

Status: The token package does not import its Canvas values from the `@mokly/ui` palette module yet, Canvas is not its default family, the Folio values and Inter remain, the wordmark still sets in the serif, and no token holds the Canvas depth of the viewer's cards, panels and settings dialog. [Milestone 3](../../../plans/canvas-redesign.md#milestone-3-palette-source-fonts-and-brand) builds the palette, the fonts and the wordmark, and [Milestone 13](../../../plans/canvas-redesign.md#milestone-13-cloud-viewer-chrome) restyles the viewer's cards, panels and dialog in that depth.

Canvas is the product and marketing system: the look of a design file, with a
dot-grid canvas, white frames and panels with hairlines, near-black ink, one
signal green, Geist and Geist Mono, an application-chrome type ramp, and
neutral graphite in dark. One Canvas look serves the public site, the cloud
app and the open-source Mokly Browse shell that the app hosts. Decision: one
look on every surface, from one open-source palette source (decision 1,
option D), not Canvas on the site and the cloud chrome alone, because the
site sells the open-source viewer and one source cannot drift. The public site
consumes the same private token npm workspace; see
[Marketing site](./marketing-site.md) and [Site design](./site-design.md).
The [product chrome compositions](./folio-chrome.md) and
[Shared controls](./shared-controls.md) build on these values. The color
tables, the accent family and the surface families are in
[Design token colors](./design-tokens-color.md).

## Ownership And Application

The `@mokly-cloud/tokens` npm workspace package owns the typed light and dark
colors, fonts, type, space, radii, shadows, layout and motion, the surface
families, the emitted custom properties and the control theme. It imports its
shared values, the Canvas colors and font stacks, from the
[Canvas palette](../mokly-viewer-palette.md#canvas-palette) of the
open-source `@mokly/ui` package, and keeps no copy of them. The catalogue,
the application and the site import the token package; none keeps a copy. The
package is private to the npm workspace: npm links one source directory
rather than publishing or downloading another dependency. The renderer and the
site build emit `--mk-*` custom properties; a stylesheet never duplicates a
value and never declares a token. `data-color-scheme` on the document root
overrides the OS preference. A token change updates this contract, the
generated pages and the application together.

A generated document bakes one viewport's type ramp. A running surface carries
the desktop ramp with the mobile ramp under the shared breakpoint, because a
window resizes and a generated document does not. The static site scopes the
properties under a selector, to compose system light/dark with explicit scheme
overrides; the application keeps them on the document root. Everything else
in the two outputs is identical.

The stylesheets that arrange these values for the product chrome have one
source. Each catalogue build bundles that source and links the bundled copy.
The application copies the source before every start, build and test, as
[Web application](./web-app.md#document-and-styling) describes.

## Type

`font.sans` is the Canvas `sans` stack, Geist followed by the system stack,
and `font.mono` is the Canvas `mono` stack, Geist Mono followed by the system
monospace stack. They are the Browse shell's own faces, so the cloud chrome
stays in the Mokly family. Geist and Geist Mono are self-hosted as variable
faces with `font-display: swap`, under the SIL Open Font License, and no page
loads a font from a third-party host. `font.display` is `Georgia, "Times New
Roman", serif`; weights are `400`, `500`, `600`, `700`.

Sizes and line heights are pixels expressed as rem against a 16px base, every
line height on the 4px grid. Respect browser text scaling; avoid fixed-height
text containers. The application-chrome ramp is the product scale, denser
than the editorial ramp because product screens are read at arm's length:

| Role        | Mobile | Desktop | Weight | Use                                                                                    |
| ----------- | ------ | ------- | ------ | -------------------------------------------------------------------------------------- |
| `nano`      | 10/14  | 10/14   | 500    | Depicted product chrome only                                                           |
| `uiLabel`   | 11/16  | 11/16   | 600    | Group eyebrows, tab labels; `0.08em`, uppercase                                        |
| `uiSmall`   | 12/18  | 12/18   | 400    | Secondary row copy, metadata, helper text                                              |
| `ui`        | 13/20  | 13/20   | 400    | Chrome body: nav, breadcrumb, values, facts                                            |
| `uiTitle`   | 15/22  | 15/22   | 600    | Section and empty-state titles, `-0.006em`; panel, dialog and layer titles, `-0.015em` |
| `paneTitle` | 18/24  | 20/28   | 600    | Unused in Canvas: panel, dialog and layer titles take `uiTitle`; `-0.018em`            |
| `pageTitle` | 20/28  | 24/32   | 600    | The one page heading; `-0.022em`                                                       |

The product chrome sets `ui` as its document default and turns on tabular
numerals; numeric and monospace values carry tabular numerals outside the
product chrome too. The editorial ramp below is for the Design pages and the
illustration material:

| Role        | Mobile | Desktop | Weight |
| ----------- | ------ | ------- | ------ |
| `caption`   | 12/18  | 12/18   | 500    |
| `small`     | 14/20  | 14/20   | 400    |
| `body`      | 16/24  | 16/24   | 400    |
| `lead`      | 20/30  | 20/30   | 400    |
| `heading3`  | 24/32  | 24/32   | 600    |
| `heading2`  | 28/36  | 32/40   | 600    |
| `heading1`  | 36/44  | 48/56   | 600    |
| `display`   | 40/46  | 64/72   | 600    |
| `hero`      | 44/48  | 64/68   | 600    |
| `editorial` | 52/54  | 82/84   | 400    |

Shared headings use `-0.02em`. Account entry and onboarding titles use
`heading3`, the one editorial role the product chrome borrows, because the
account panel holds a single question and its title is the page. The titles
of the viewer's panels, the settings dialog and its layer use `uiTitle`, as
[Viewer compositions](./folio-viewer.md#compositions) draws them. The serif is
for the illustration material only; the wordmark sets in `font.sans`, as the
[shell brand](../mokly-shell-brand.md) defines it. Keep prose within `65ch`;
helper text follows [Product copy](./product-copy.md).

## Control Theme

The `@firna/ui` control theme takes every color from the token tables of its
scheme and surface family, its fonts from the font tokens and its radii from
the radius tokens, and nothing from anywhere else. A dark theme derives from
the library's dark preset, never from the light preset with only the scheme
changed, so the package-owned dark roles stay the package's. Which roles feed
the library's fill and ink, and that theme overrides are the only way to
change a control's geometry or colors, is in
[Shared controls](./shared-controls.md#imports-and-ownership).

## Space And Layout

Spacing is a 4px scale, expressed in rem:

| Key under `space` | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 8   | 10  | 12  | 16  | 20  | 24  |
| ----------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pixels            | 0   | 4   | 8   | 12  | 16  | 20  | 24  | 32  | 40  | 48  | 64  | 80  | 96  |

- `breakpoint` `768px`; below it use the mobile composition.
- `contentMax` `1120px`; `proseMax` `65ch`; `documentMax` `912px`;
  `dialogMax` `960px`; `formMax` `440px`.
- `entryMax` `440px`, the one account panel, shared by entry and onboarding.
- `gutterMobile` `20px`; `gutterDesktop` `40px`.
- `controlMin` `44px`, the touch target floor; `rowMin` `44px`, the minimum
  height of an inline link target.
- `sectionMobile` `48px`; `sectionDesktop` `80px`; `topbar` `48px`;
  `rail` `212px`.
- The site's own geometry is in the same table: `siteWide` `1360px`,
  `siteDocument` `768px`, `sitePolicy` `840px`, `siteSidebar` `272px`,
  `siteOnPage` `240px` and `siteRailBreakpoint` `1100px`.
- `screenMobileWidth` `390px`; desktop inspection width `1440px`. Minimum
  inspection heights are `844px` mobile and `900px` desktop.

Layouts remain usable at 320px width and 200% text zoom. Stack hero columns,
form actions and footer groups on mobile with 20px gutters. The compositions
that every product surface is built from are in the
[product chrome compositions](./folio-chrome.md).

## Radius, Elevation, And Focus

| Key under `radius` | Pixels | Default use                               |
| ------------------ | ------ | ----------------------------------------- |
| `tight`            | 4      | Compact inset details                     |
| `small`            | 6      | Badges, marks, breadcrumb crumbs          |
| `chrome`           | 8      | Buttons, inputs, nav pills, close target  |
| `medium`           | 10     | Panels, cards and glyph tiles on a page   |
| `float`            | 12     | Cards, panels and dialogs over the canvas |
| `large`            | 16     | Editorial and showcase cards              |
| `xlarge`           | 24     | Large showcase panels                     |
| `pill`             | 999    | Deliberate pill badges and role chips     |

Radius is assigned by component class, not by size: a control is 8px, a surface
on a page 10px, and a surface that floats over the canvas 12px. The control
theme follows the same rule.

| Key under `shadow` | Light                                                                   | Dark                                                       |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `none`             | `none`                                                                  | `none`                                                     |
| `small`            | `0 1px 2px rgb(35 33 30 / 6%)`                                          | `0 1px 2px rgb(0 0 0 / 40%)`                               |
| `medium`           | `0 1px 2px rgb(35 33 30 / 5%), 0 8px 20px rgb(35 33 30 / 8%)`           | `0 1px 2px rgb(0 0 0 / 34%), 0 8px 20px rgb(0 0 0 / 46%)`  |
| `large`            | `0 1px 3px rgb(35 33 30 / 6%), 0 28px 72px rgb(35 33 30 / 18%)`         | `0 1px 3px rgb(0 0 0 / 40%), 0 28px 72px rgb(0 0 0 / 62%)` |
| `float`            | `0 1px 1px` at 4%, `0 4px 10px -2px` at 6%, `0 18px 36px -14px` at 14%  | `0 6px 14px -4px` at 50%, `0 22px 44px -16px` at 60%       |
| `deep`             | `0 1px 1px` at 5%, `0 10px 20px -6px` at 8%, `0 40px 80px -28px` at 26% | `0 14px 28px -8px` at 55%, `0 48px 96px -32px` at 70%      |

Each layer of `float` and `deep` mixes the shade with `color-mix()` toward
transparent at the given share. The shade is `text` in light and
`background` in dark, because a light ink would glow around a dark card.
`deep` has the layers of the shell's `--chrome-shadow` in the
[viewer palette](../mokly-viewer-palette.md#swatches); in dark the shell
also draws a 1px `text` ring.

Five elevation roles, each paired with a hairline. **Page** — the canvas and
the rail, with no fill, border or shadow of their own. **Raised** — panels,
cards and the selected navigation pill: `surface`, a hairline and
`shadow.small`. **Lifted** — the account panel, the one surface a page is built
around rather than one it contains: `surface`, a hairline, a 10px radius and
`shadow.medium`. **Floating** — a card that floats on the viewer's canvas,
such as its State card and build card: `surface`, a hairline, `radius.float`
and `shadow.float`. **Overlay** — the settings dialog and the panels that the
viewer's switchers, History and Share open: `surface`, a hairline,
`radius.float` and `shadow.deep` over a scrim, whose element owns its stacking
context so no chrome beneath paints through it. The scrim is the shade at 24%
in light and at 60% in dark, with no blur, so the canvas still reads beneath
it. [Viewer compositions](./folio-viewer.md#compositions) gives the mobile
forms of the panel, the dialog and its layer.

Focus is a 2px solid `focus` outline with a 3px offset, never removed; local
links round it with `radius.tight`. Forced-colors mode retains a system outline.

One shared rule, which the catalogue and the application both load, applies
this outline on `:focus-visible` to every element that takes focus through
`tabindex` and is not a registered control: the build card's title after
Cancel and its output region among them. Registered controls are the elements
Firna renders, which keep their theme mapping. The published viewer's own
interface keeps its own focus treatment, and the content the cloud places in
its slots takes the shared rule. The viewer drawings follow the same split:
their `@mokly/ui` parts keep the package's focus treatment, and the content
the cloud places in their host slots takes the shared rule. Like a local link,
the rule rounds the outline with `radius.tight`; it has no specificity of its
own, so an element with its own radius keeps it, as the output region keeps
`radius.medium`. Forced-colors mode draws it in `Highlight`.
The [catalogue focus policy](./mockup-verification.md#disk-and-http-smoke)
checks the shared rule. Application browser tests check the title and the
output region in the running product.

## Email

The two delivered emails cannot read custom properties, linked stylesheets or
the atomic control styles, so they resolve token values to literals at
generation time. They use the roles that [Email](./email.md#document) lists
and no others, with their Canvas values, exactly as the account panel binds
them: `background`, `surface`, `text`, `textMuted` and `border` take the
Canvas roles of the same names, and `accent`, `accentSolid` and `onAccent`
take `signalDeep`, `signalFill` and `onSignalFill`. They have no palette of
their own: dark values come from the dark table.

## Motion, States And Validation

`motion.fast` is `120ms`, `standard` is `180ms`, `easing` is
`cubic-bezier(0.2, 0, 0, 1)`. Chrome transitions use `fast`; nothing in the
product chrome animates position or size. Honor reduced motion.

Icon sizes, stroke and ownership are specified once, under Icons in
[Shared controls](./shared-controls.md); illustrative controls use
`opacity: 0.45`. Loading reserves space without fake data and names its
operation; errors associate concise recovery copy with their field.

Normal text requires 4.5:1 contrast; large text, meaningful boundaries and focus
need 3:1, in both schemes, for every status pair and button state, in the
emitted CSS and in the browser's computed foregrounds. One pair is the
exception: the label of a filled button, `onAccent` on `accentSolid`, is
white on the Canvas `signalFill` in both schemes and needs 3:1. The
[Canvas palette](../mokly-viewer-palette.md#canvas-palette) records that
decision.
