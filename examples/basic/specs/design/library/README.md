# Shared Design Components

## Scope

These sixteen components render both Mokly's design artboards and
the independent pages under **Components → Design → Shared components**. The
footer tabs panel is `inspector/inspector`. This is the consumer's mockup
library. `chrome/appearance-selector` and `controls/comparison-toolbar`
render the `@mokly/ui` components that the shipped shell uses: each view
imports its component, and each component sheet the package stylesheet, by
its repository path under `packages/ui/src`, so each side of a comparison
renders its own package files. The other components keep their own markup
and styles here until the package provides them. The Mokly browser shell
itself remains in the package source.

`chrome/appearance-selector` is the standalone catalogue's Auto/Light/Dark
setting, which changes the chrome and the screens it shows together. `chrome/top-bar`
always composes it, so every artboard with a top bar draws it; a screen does not
opt in. The value defaults to the scheme the file was rendered for and is
overridden only to depict a different setting, as the Auto artboard does. It is
the only scheme control the design catalogue draws. It is the shipped shell
control itself, rendered from the `@mokly/ui` appearance selector. The
compact flag draws its narrow face at every width; below the shell's
breakpoint the control draws that face on its own, as the shell does.

Those two samples — the appearance selector and the top bar that composes it —
are the only ones that render in both schemes, because their own subject is the
catalogue's appearance; `metadata.ts` exports that set as
`DUAL_SCHEME_SAMPLES`. A dual-scheme sample reads the props whose own subject is
the scheme from its render context instead of pinning them in a fixture, so the
top bar's samples name the scheme they rendered for and only `auto-appearance`
sets the value explicitly. Every other sample stays light.
`view-controls` has no scheme control at all, so every depicted screen header
carries the viewport dropdown alone. `metadata.ts` owns that
list, `LibraryHost` stamps the requested scheme on the sample root, and Browse's
Appearance control switches between the two generated files.

Catalogue navigation saves each Changes availability state: **Checking for
changes**, **Preparing comparison** and **Changes unavailable**, in both
viewports. All and Changes retain their positions while the count shows a spinner
or a dash; the selected Changes sidebar shows the matching message. Preparing is
the only message with a secondary line, because it is the only state that asks
the reader to wait. Toggle **Changes only** to inspect All in any state, or use
the **Changes availability** control in Props to move between them. The counter
reserves its width in every state.

Catalogue navigation also saves the two screen-variant states: **Screen
variants** shows `Welcome` with its variant list disclosed and one variant
selected, and **Changed variant** shows the Changes filter holding one changed
variant under a parent whose own render is unmodified. A screen row that owns
variants renders a `mbk-nav-leaf` container holding the unchanged row link plus
a trailing chevron disclosure button; the row cannot be both a link and a
disclosure summary. The All and drawer fixtures also disclose Action's Default,
Disabled and Secondary rows and Toolbar's Default row in their real authored
order. Component explorer and Changes artboards reuse those identities, while
their synthetic Help hint and Badge examples each disclose their depicted
Default state. Variant rows render one indent step deeper on a
`mbk-nav-ico variant` wrapper. Screen variants use overlapping screen outlines;
component variants use equivalent overlapping component outlines. Both stay
muted. The changed mark is a trailing dot and never an edge or rail. Row rendering lives in
`chrome/catalogue-navigation-row.view.tsx`, which the component owns beside its main
view. Selected rows use the same appearance-aware contrast token for their
labels, variant disclosures and changed marks. The navigation splits one tree
into **Specs** and **Components** by kind, so a folder holding both appears in
each. A folder row is a span that only browses; a folder's README is its first
row, a `document` row with the document icon. A `moved` row appends `· Moved`
to its label and, like a Removed row, takes no changed mark. Each entry row
names its kind in `data-entry-kind`, as the product's row does: a flow row is
`use-case`, a variant row takes its parent's kind, and a folder row has none.
`tests/browser/design_reasons.spec.ts` reads it to skip pages, documents and
use cases.

Comparison toolbar draws the **Scroll together** switch in every diff mode,
between the mode group and Refresh: a native checkbox with switch semantics
inside a label whose text is its name, over a drawn track and knob. Every mode
sample saves it on and **side-by-side-apart** saves it off; Current draws
neither the switch nor Refresh. The screen header forwards the same state.
A mode with a destination links to the artboard that shows it. The other
modes are the shipped toggle buttons in an accessible band, as the component
explorer depicts them, and inert text elsewhere, where Refresh is a picture
too; the shown mode never links.

View controls saves **Changed views**, where a change confined to other views
marks the viewport dropdown; the owning screen also marks top-bar Appearance
when another scheme changed. The mark is evidence about
views other than the shown one, so the details inspector names them.

## Authoring

For each component, `{group}/{slug}.tsx` calls `defineComponent` with a
literal JSON prop schema, its own props, its slots, its saved variants and its
supported controls; `schemas.ts` holds the shared schema fragments. A variant
sets props and fills slots with React content. Its props replace the own
props key by key, so the own props hold only the keys that every variant
sets, with the first variant's values. The parent's own example renders
without slot content; only its variants and the composing screens fill slots.
`{slug}.view.tsx` implements its markup, or renders the `@mokly/ui` component
that provides it. Each `{slug}.mockup.ts` re-exports the
definition from its group directory, deriving
`design/library/{group}/{slug}`. Variant slugs append one segment. Folder
records title the shared library and any named groups.

Call the definition's `.Component` from screen adapters. Never import a `.view`
module into a screen or create a second standalone implementation. Leave whole
screens, stage/workspace layouts and fixture selection as ordinary composition.

Pass actual screen data at the boundary: labels, destinations, query, selection,
status and counts. Slots hold caller-owned JSX, including previews, inspector
bodies and native inputs. Resolve scenario navigation in an adapter before
calling a component; missing destinations stay non-links. Top-bar Appearance owns scheme selection;
header view controls own the viewport. Use ordinary `MockLink` anchors for inspector-body
links and tag chips so they can live inside native `details` panels.
`../parts/nav_data.ts` is the canonical catalogue-navigation fixture for both the
saved All example and in-screen artboards, so those two views stay aligned;
`../parts/account_nav_data.ts` adds its Account area, the Profile folder's own
screen with its `contents` list of variant and members, the moved Changes rows,
and Profile's Changes rows, and `../parts/variant_nav_data.ts` holds Welcome's
Changes-filtered variant rows.
`../parts/entry_paths.ts` owns the depicted paths that path chips show.
`../parts/component_nav_data.ts` owns component parent and variant identities;
the shared fixture and component-explorer scenarios compose its rows instead of
copying titles or authored order.

Use explicit semantic `moklyInstance` names for repeated siblings. The
`DesignInstances` context supplies a stable prefix for simultaneous viewport
regions. Flow-step names must be independent of destinations or ordering.
Input ids, label associations and description/error ids belong to the form caller;
the prop-field component supplies framing and matching description/error nodes,
including the surface, border and invalid state of whatever native control the
caller puts in its slot, so a prop panel reads the same in every host.

Components may compose registered children. Top bar → Tag picker → Tag chip
records the full nested ownership chain. Components supplied in a caller's slot
retain that caller's ownership.

A design link to the artboard that renders it names the current page with
`aria-current="page"`. Catalogue rows, the selected highlight region, and an
action already in effect get the mark from `useCurrentPage` in
`../parts/design_navigation.tsx`, which compares a destination with the
nearest `DesignNavigation` artboard. The component explorer's narrow shortcuts
compare with the artboard that their shell renders. Only the top bar's brand
link on the home screen opens its own artboard without the mark.

The device frame's `scheme` flag adds the rendered scheme to its caption, as
the component explorer previews show it, so no screen draws its own frame
caption.

## Styles And Hosts

`style_files.ts` names each component's public stylesheet,
`design-library/{group}/{slug}.css`, relative to the configuration file, and
`metadata.ts` declares it through `stylesheets`. For a component that
`@mokly/ui` provides, that sheet only imports the package's source
stylesheets by their repository paths, plus a mockup-only rule such as the
appearance selector's compact flag. CSS Changes uses own-page matches
kept after nested-component filtering, not file ownership or source paths.
Shared helpers and saved fixtures are metadata or rendered-output inputs, not
independent comparison evidence.

Rendered components link their declared files in first-render order.
The shared preview layout reserves intrinsic mobile widths so full-size phones
cannot overlap desktop frames when Both is selected.
The phone notch and home pill are decorative and ignore pointer events, so
they cannot intercept interactions with the caller-owned screen below them.
The configuration orders shared base styles first, the `$componentStylesheets`
marker next, then context/layout overrides. Keep this explicit order: equal-specificity
mobile rules must not override bounded workspace scrolling.
The Rust core writes each document head. It links the declared files at the
marker of the first matching rule, or after that rule's shared entries when
the rule has no marker. A hidden picker does not link chip CSS merely because another
variant uses chips.

Keep component selectors in its declared stylesheet. Tokens, resets, mixed
selectors and cross-component layout/state rules stay in the shared design CSS.
Keep shared host resets at zero specificity so component styles render
identically in standalone samples and in-screen compositions.
Declared sheets reload automatically in Serve, including after an edit.

`host.tsx` supplies standalone layout and semantic parents without fixture data.
Every inspector uses the ordinary preview workspace for its resizer and mobile
sheet. The workspace dock owns placement and sizing, while the inspector owns
the sheet border, rounded surface and shadow. Open mobile sheets span the
workspace width without a dock inset. Only icon tabs are supported; the legacy
disclosure and saved variant have been removed. Inline samples retain
intrinsic width. Compact phone samples fit both viewports; full-size controls
use the scrollable frame host. Every variant has actual mobile and desktop
render contexts; every sample is light-only except the two named above.
Mobile comparison controls share compact sizing across buttons, links and
static labels, so standalone samples also fit with wider system fonts.

## Verification

From the repository root:

```sh
npm run build
npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example
npm run typecheck
npm test -- tests/design_boundaries.test.ts tests/design_appearance.test.ts tests/design_catalogue.test.ts
cargo xtask check
```

`build --strict` renders every library sample and every design screen, and
fails on any error or warning. `tests/design_appearance.test.ts` checks that
the light and dark palettes theme the same roles and meet their contrast
pairs, and `tests/design_boundaries.test.ts` checks that marked boundaries
and control edges stay visible, that only palette sources name colours, and
that the palette declares every token that an imported `@mokly/ui`
stylesheet reads.
`tests/design_catalogue.test.ts` serves the example and checks that every
sample keeps its page and saved variants, has a real screen consumer in each
viewport, and links only the styles of the components it renders, and that
each design screen records the shared components of its family.
Open the changed pages through `npm run dev` in both viewports. Check
saved variants and local edit, unset and reset in Serve, plus read-only
inspection in the static build. Keep the output directory as an ignored local
artifact; commit the authored source instead.

See the [adoption contract](../../../../../docs/protocol/mokly-design-components.md)
and [inventory](../../../../../docs/protocol/mokly-design-component-library.md).

Page artboards compose the shared inspector and metadata rows. An inspector tab
may name an authored destination when a static scenario has separate open and
closed artboards; that tab's link is its one keyboard stop, so its summary
leaves the tab order. Ordinary tabs continue using native disclosure behavior.
