# Shared Controls

Status: The dark theme's Canvas fill with its white label, and the surfaces of the account menu and More, are not built yet. [Milestone 3](../../../plans/canvas-redesign.md#milestone-3-palette-source-fonts-and-brand) builds the dark fill, and [Milestone 13](../../../plans/canvas-redesign-milestones-viewer.md#milestone-13-cloud-viewer-chrome) builds the menus.

Common controls come from the public `@firna/ui` package. The catalogue
registers them as thin wrappers, and the product uses the same controls through
the same theme mapping. See [Design tokens](./design-tokens.md) and
[Mockups](./mockups.md).

## Dependencies

The repository installs one `@firna/ui` release, `4.0.0`, through the one npm
workspace lockfile. Every npm workspace that declares it, the Mokly example
catalogue included, pins that exact version. Decision: one `@firna/ui` version
for the repository, so that the catalogue resolves the one installed copy. A
second npm name for another major and a separate catalogue install were
rejected.

`apps/mockups/package.json` pins each package below exactly. `package.json`
repeats the React and React DOM pins `19.2.3`, so every npm workspace and peer
shares one hoisted runtime. Each package installs once, at the version that
the lockfile records. Do not use peer-resolution bypasses.

| Package                          | Boundary                                |
| -------------------------------- | --------------------------------------- |
| `@firna/ui`                      | Shared controls and theme               |
| `react`, `react-dom`             | Matching React 19 runtimes              |
| `react-native`                   | Peer types; web runtime resolves to RNW |
| `react-native-web`               | DOM rendering and atomic styles         |
| `react-native-reanimated`        | Library peer                            |
| `react-native-gesture-handler`   | Library peer                            |
| `react-native-svg`               | Icons and SVG primitives                |
| `lucide-react`                   | Library web icon peer                   |
| `lucide-react-native`            | Library icon peer                       |
| `@gorhom/bottom-sheet`           | Library sheet peer                      |
| `@types/react-native-web`        | Published web declarations              |
| `react-native-worklets`          | Reanimated's peer                       |
| `react-native-safe-area-context` | Overlay/sheet support                   |

Firna's web backend renders DOM primitives directly; react-native-web serves
the catalogue's own native primitives and atomic stylesheet, not Firna.
Transitive peers are resolved by npm and recorded in the lockfile.

## Imports And Ownership

Use public subpaths so a button does not load the entire library:
`/button`, `/input` (including textarea), `/badge`, `/avatar`, `/status-dot`,
`/dropdown`, `/segmented`, `/switch`, `/modal`, `/toast`, `/skeleton`,
`/list`, `/table`, `/typography`, and `/theme`, prefixed with `@firna/ui`.
Another published subpath may be used when an owning screen needs it;
document that use first. The viewer's account menu and its compact **More**
menu each open from a quiet Firna Button trigger: as a non-modal popover on a
pointer viewport, and **More** as the registered panel's bottom sheet on a
touch viewport, as
[Viewer chrome: account menu](./viewer-chrome-account.md#menus) defines. A
settings row gathers the actions that belong to it behind one icon-only
trigger instead, so a list of rows carries one control each rather than a
line of competing buttons: a quiet square Button drawing the lucide
`Ellipsis` glyph, named for its row, announcing a menu popup and whether it is
expanded. It opens a responsive menu.
On a wide surface that is `ResponsiveMenu` from `/popover`, whose web build is
a non-modal popover anchored 6px below the trigger and aligned to its end edge.
On a compact surface — the same breakpoint that selects the settings layer —
the row renders the same `DropdownList` rows in the settings modal frame
instead: `WebModalFrame` placed as a bottom sheet, titled with the row's name in
the registered panel's bar and dismissed by **Cancel**, exactly as a settings
confirmation is on that surface. Firna's own `Sheet` is not used there, because
its web build draws the frame's header with an icon close control rather than
the panel bar every other compact settings overlay shares. Choosing a row
closes the menu before anything that row opens appears. This is the one
documented use of `/popover`. Never import private implementation files or
patch the package.

Keep `page-frame`, `header`, `card`, the comment-thread composition and the
catalogue illustrations local. They arrange shared controls; they do not
reimplement them. Common UI text uses `/typography`. Marketing editorial
headings and prose, the wordmark, semantic links and developer code
blocks use semantic HTML: Firna's theme exposes sans and mono families, with
no display-serif or italic marketing type role. These are local content and
layout responsibilities under the registered screens and header, not a second
general-purpose control library.

Colors, fonts, radii and tone adaptation come from the shared control theme
that the tokens package derives from its token tables; the catalogue and the
application import the same theme. The library separates its solid fill
(`primary`) from its accent ink (`primaryDeep`), so the mapping feeds them
`accentSolid` and `accent` respectively: a `primary` tone Button is the one
accent fill on its screen. Firna owns the tone, hover and pressed algorithms
from those two; its ghost pressed wash is the `primaryBorder` role, which
therefore takes the soft accent tint rather than a heavier line color. The
registered `quiet` tone is the library's `plain`: neutral ink on no fill, for a
repeat or dismiss action that must not compete with the primary. Only
`Label color="primary"` reaches the accent ink, and only where the
[tokens contract](./design-tokens-color.md) names an exception. In the dark
theme the mapping feeds the library the same `accentSolid` fill and white
`onAccent` label as in light, in place of the dark preset's light accent with
a near-black `onSolid`, so a filled button reads the same in both schemes, as
[the accent family](./design-tokens-color.md#the-accent-family) defines
(decision 4, option A). Theme overrides are the only way to change
a control's geometry or colors: CSS selectors, inline style, label-style and
input-style props, and custom color props never restyle a Firna control.
Typography may select a semantic color role, including inverse text for arrows
on solid buttons; raw colors are forbidden. External layout containers may
provide spacing, alignment and width; they must not change a control's own
rendering. Use the public size and minimum-touch-target props for geometry. The
header pill is the package Button under a scoped theme whose medium radius is
the pill radius.

## Registered Wrapper Contract

[Shared control registrations](./shared-control-registrations.md) defines
wrapper props, saved variants, density, focus and accessible names.

## Static Rendering

[Shared control rendering](./shared-control-rendering.md) defines the generated
document: the published stylesheet boundary, the theme per scheme and palette,
how registered controls behave without hydration, how a catalogue link wraps a
control, and the one web module-resolution boundary.

## Static Product Overlays

[Shared control overlays](./shared-control-overlays.md) defines the registered
static-only modal/sheet exception, row menus, settings frames and published
viewer stage. Live app surfaces use the public Firna modal.

## Email

The delivered emails in [Email](./email.md) use no `@firna/ui` control, no
registered wrapper and no atomic stylesheet: mail clients render neither
React Native Web output nor linked CSS, so the email's one action is a link in
a table cell filled with `accentSolid` and labelled in `onAccent`, and its
copy is plain HTML with inline styles resolved from the token tables. This is
the only surface outside the illustration material that draws an action
without the registered Button, and it is confined to
`docs/mockups/src/emails/`, whose import boundary is closed to the rest of the
catalogue. The brand is the published logo — the mark and wordmark as one
`img` of the lockup under `apps/site/public/brand/` — rather than the inline SVG
mark and HTML wordmark the product draws, because mail clients strip inline
SVG and substitute a font of their own. The catalogue frame around an email
screen stays ordinary catalogue markup.

## Icons

Product chrome draws `lucide-react-native` glyphs, pinned above as a Firna
peer, through one shared icon vocabulary. The catalogue and the application
each carry that vocabulary, and the two agree, so a glyph can never mean one
thing in a mockup and another in the running application; a screen names a
glyph from the vocabulary and never imports lucide directly. Every glyph
renders at stroke width `1.5` in `currentColor` and is hidden from assistive
technology, because the adjacent text names the item. Sizes are fixed by role,
not by taste: 16px on a chrome row, 20px standing alone, 14px for a trailing
cue, 13px for a breadcrumb chevron. The icon wrapper is a local composition
like `page-frame` and `header`; it is not a registered Design component.
