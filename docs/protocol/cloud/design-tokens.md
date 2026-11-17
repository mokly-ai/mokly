# Design Tokens

Folio is the product and marketing system: warm neutral surfaces, Inter as the
UI face, an application-chrome type ramp, a three-level surface system that is
designed rather than inverted in dark, and a single restrained accent. The
public site consumes the same private token npm workspace; see
[Marketing site](./marketing-site.md) and [Site design](./site-design.md).
Folio was chosen over the earlier Fieldnotes marketing selection and the other
candidate themes for its document-like working surface: generous sans typography,
unboxed records and a wide catalogue stage. See
[Folio chrome](./folio-chrome.md) and
[Shared controls](./shared-controls.md). The color tables, the accent family
and the surface families are in
[Design token colors](./design-tokens-color.md).

## Ownership And Application

The `@mokly-cloud/tokens` npm workspace package owns the typed light and dark
colors, fonts, type, space, radii, shadows, layout and motion, the surface
families, the emitted custom properties and the control theme. The catalogue,
the application and the site import it; none keeps a copy. The package is
private to the npm workspace: npm links one source directory rather than
publishing or downloading another dependency. The renderer and the site build
emit `--mk-*` custom properties; a stylesheet never duplicates a value and
never declares a token. `data-color-scheme` on the document root overrides the
OS preference. A token change updates this contract, the generated pages and
the application together.

A generated document bakes one viewport's type ramp. A running surface carries
the desktop ramp with the mobile ramp under the shared breakpoint, because a
window resizes and a generated document does not. The static site scopes the
properties under a selector, to compose system light/dark with explicit scheme
overrides; the application keeps them on the document root. Everything else
in the two outputs is identical.

The Folio stylesheets that arrange these values have one source. Each
catalogue build bundles that source and links the bundled copy.
The application copies the source before every start, build and test, as
[Web application](./web-app.md#document-and-styling) describes.

## Type

`font.sans` is `"Inter", ui-sans-serif, system-ui, -apple-system,
BlinkMacSystemFont, "Segoe UI", sans-serif`, the Browse shell's own face, so the
cloud chrome stays in the Mokly family. Inter is self-hosted as one variable
face with `font-display: swap`, taken with its SIL Open Font License from the
pinned `@mokly/mokly` shell assets; the system stack stays in the token as the
fallback. `font.mono` is `ui-monospace, SFMono-Regular, Menlo, Consolas,
monospace`; `font.display` is `Georgia, "Times New Roman", serif`; weights are
`400`, `500`, `600`, `700`.

Sizes and line heights are pixels expressed as rem against a 16px base, every
line height on the 4px grid. Respect browser text scaling; avoid fixed-height
text containers. The application-chrome ramp is the Folio product scale, denser
than the editorial ramp because product screens are read at arm's length:

| Role        | Mobile | Desktop | Weight | Use                                                  |
| ----------- | ------ | ------- | ------ | ---------------------------------------------------- |
| `nano`      | 10/14  | 10/14   | 500    | Depicted product chrome only                         |
| `uiLabel`   | 11/16  | 11/16   | 600    | Group eyebrows, tab labels; `0.08em`, uppercase      |
| `uiSmall`   | 12/18  | 12/18   | 400    | Secondary row copy, metadata, helper text            |
| `ui`        | 13/20  | 13/20   | 400    | Chrome body: nav, breadcrumb, values, facts          |
| `uiTitle`   | 15/22  | 15/22   | 600    | Section and empty-state titles; `-0.006em`           |
| `paneTitle` | 18/24  | 20/28   | 600    | Dialog/layer headings, publication title; `-0.018em` |
| `pageTitle` | 20/28  | 24/32   | 600    | The one page heading; `-0.022em`                     |

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
account panel holds a single question and its title is the page. Viewer titles
use `pageTitle`. Home uses `hero` with `-0.05em` letter spacing and `heading2`
section headings. The serif is for the wordmark and the illustration material
only. Keep prose within `65ch`; helper text follows
[Product copy](./product-copy.md).

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
  `siteOnPage` `240px`, `siteRailBreakpoint` `1100px`, `siteStageMobile`
  `520px` and `siteStageDesktop` `624px`.
- `screenMobileWidth` `390px`; desktop inspection width `1440px`. Minimum
  inspection heights are `844px` mobile and `900px` desktop.

Layouts remain usable at 320px width and 200% text zoom. Stack hero columns,
form actions and footer groups on mobile with 20px gutters. The Folio
compositions every product surface is built from are in
[Folio chrome](./folio-chrome.md).

## Radius, Elevation, And Focus

| Key under `radius` | Pixels | Default use                              |
| ------------------ | ------ | ---------------------------------------- |
| `tight`            | 4      | Compact inset details                    |
| `small`            | 6      | Badges, marks, breadcrumb crumbs         |
| `chrome`           | 8      | Buttons, inputs, nav pills, close target |
| `medium`           | 10     | Panels, cards, dialogs, glyph tiles      |
| `large`            | 16     | Editorial and showcase cards             |
| `xlarge`           | 24     | Large showcase panels                    |
| `pill`             | 999    | Deliberate pill badges and role chips    |

Radius is assigned by component class, not by size: a control is 8px, a surface
10px. Folio's control theme follows the same rule.

| Key under `shadow` | Light                                                           | Dark                                                       |
| ------------------ | --------------------------------------------------------------- | ---------------------------------------------------------- |
| `none`             | `none`                                                          | `none`                                                     |
| `small`            | `0 1px 2px rgb(35 33 30 / 6%)`                                  | `0 1px 2px rgb(0 0 0 / 40%)`                               |
| `medium`           | `0 1px 2px rgb(35 33 30 / 5%), 0 8px 20px rgb(35 33 30 / 8%)`   | `0 1px 2px rgb(0 0 0 / 34%), 0 8px 20px rgb(0 0 0 / 46%)`  |
| `large`            | `0 1px 3px rgb(35 33 30 / 6%), 0 28px 72px rgb(35 33 30 / 18%)` | `0 1px 3px rgb(0 0 0 / 40%), 0 28px 72px rgb(0 0 0 / 62%)` |

Four elevation roles, each paired with a hairline. **Page** — the canvas and
the rail, with no fill, border or shadow of their own. **Raised** — panels,
cards and the selected navigation pill: `surface`, a hairline and
`shadow.small`. **Lifted** — the account panel, the one surface a page is built
around rather than one it contains: `surface`, a hairline, a 10px radius and
`shadow.medium`. **Overlay** — the settings dialog: `surface`, a hairline, a
10px radius and `shadow.large` over a backdrop of the ink at 34% with a 3px
blur, whose element owns its stacking context so no chrome beneath paints
through it.

Focus is a 2px solid `focus` outline with a 3px offset, never removed; local
links round it with `radius.tight`. Forced-colors mode retains a system outline.

One rule in the shared `docs/mockups/styles/base.css`, also loaded by the
application, applies this outline on `:focus-visible` to every element that
takes focus through `tabindex` and is not a registered control: the build
card's title after Cancel and its output region among them. Registered
controls are the elements Firna renders, which keep their theme mapping. The
published viewer's own interface keeps its own focus treatment, and the content
the cloud places in its slots takes the shared rule. The viewer drawings
follow the same split: their `@mokly/ui` parts keep the package's focus
treatment, and the content the cloud places in their host slots takes the
shared rule. Like a local link, the
rule rounds the outline with `radius.tight`; it has no specificity of its own,
so an element with its own radius keeps it, as the output region keeps
`radius.medium`. Forced-colors mode draws it in `Highlight`.
The [catalogue focus policy](./mockup-verification.md#disk-and-http-smoke)
checks the shared rule. Application browser tests check the title and the
output region in the running product.

## Email

The two delivered emails cannot read custom properties, linked stylesheets or
the atomic control styles, so they resolve token values to literals at
generation time. They use the roles that [Email](./email.md#document) lists
and no others, bound through the Folio surface family exactly as the account
panel binds them, and they have no palette of their own: dark values come
from the dark table.

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
emitted CSS and in the browser's computed foregrounds.
