# Shared Design Components

## Scope

These twenty components render both Mokly's design artboards and the independent
pages under **Components → Design → Shared components**. This is the consumer's
mockup library. Nine render the `@mokly/ui` component that the shipped shell
uses: each view imports its component, and each component sheet imports the
package stylesheets of the component and of each package component that it
renders, each by its repository path under `packages/ui/src`, so each side of a
comparison renders its own package files. The eleven parts of the Canvas viewer,
which `@mokly/ui` does not provide yet, implement their own markup; [Canvas
viewer parts](#canvas-viewer-parts) describes them. The Mokly browser shell
itself remains in the package source.

The artboards follow the same rule for every other part that a package component
provides, such as the Canvas scaffolds of `../canvas/parts/`, the panels and
lists of Inspect, and the highlight mask of `../components/parts/highlight.tsx`.
Each such part renders the package component, its sheet imports the package
stylesheets by repository path, and no artboard keeps a copy of that markup or
CSS. A Canvas startup page draws its one state directly in the Canvas root,
which takes the place of the viewer root. Each artboard's root and each sample's
root carries the theme's root class `mbk` in the rendered appearance, so the
package components draw in the shipped palette and with the reset class; the
design catalogue's own palette in `design.css` stays for the artboards' own
parts.

`chrome/appearance-selector` is the standalone catalogue's Auto/Light/Dark
setting, which changes the chrome and the screens it shows together. `chrome/top-bar`
always composes it, so every artboard with a top bar draws it; a screen does not
opt in. The value defaults to the scheme the file was rendered for and is
overridden only to depict a different setting, as the top bar's
`auto-appearance` sample does. It is
the only scheme control the design catalogue draws. It is the shipped shell
control itself, rendered from the `@mokly/ui` appearance selector. The
compact flag draws its narrow face at every width; below the shell's
breakpoint the control draws that face on its own, as the shell does.

Those two samples — the appearance selector and the top bar that composes it —
are the only ones that render in both schemes, because their own subject is the
catalogue's appearance; `metadata.ts` exports that set as `DUAL_SCHEME_SAMPLES`.
A dual-scheme sample reads the props whose own subject is the scheme from its
render context instead of pinning them in a fixture, so the top bar's samples
name the scheme they rendered for and only `auto-appearance` sets the value
explicitly. Every other sample stays light. `metadata.ts` owns that list,
`LibraryHost` stamps the requested scheme on the sample root, and Browse's
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
order. The Canvas artboards reuse those identities. Variant rows render one
indent step deeper on a
`mbk-nav-ico variant` wrapper. Screen variants use overlapping screen outlines;
component variants use equivalent overlapping component outlines. Both stay
muted. The changed mark is a trailing dot and never an edge or rail. The
shipped `@mokly/ui` catalogue tree draws every row:
`chrome/catalogue-navigation-sections.ts` maps the fixture rows to its
section, folder and row records, and a closed list keeps its rows hidden, as
the shell does. Selected rows use the same appearance-aware contrast token for
their labels, variant disclosures and changed marks. The navigation splits one
tree into **Specs** and **Components** by kind, so a folder holding both
appears in each. A folder row is a native disclosure that only browses; a
folder's README is its first row, a `document` row with the document icon. A
row without a destination is a picture of the row that opens nothing. A
`moved` row appends `· Moved` to its label and, like a Removed row, takes no
changed mark. Each entry row names its kind in `data-entry-kind`, as the
product's row does: a flow row is `use-case`, a variant row takes its parent's
kind, and a folder row has none.

The top bar and the catalogue navigation are the shipped `@mokly/ui` components.
A static artboard runs no script, so their links open the artboards that show
each state, and each control without a destination is a picture of itself:
Collapse all, a filter and the separator. The top bar draws no menu, as the
shell's bar does. Their stylesheets follow the shell's breakpoint. A frame
around the top bar carries a compact flag that draws the narrow bar of a mobile
render at every width, and a frame around the navigation carries a drawer flag
that draws the open drawer of the drawer presentation and of every mobile
render.

The tag picker, the tag chip and the change status are the shipped `@mokly/ui`
components too. The search field ends with the tag picker: its button links to
the artboard that shows the picker opened or closed, a closed picker draws only
its button, and each chip of an open picker is the registered tag chip, so Top
bar → Tag picker → Tag chip records every chip. A chip with a destination links
to the artboard that shows its filter, and a chip without one is a picture of
itself.

The Frames filter draws the Highlight components switch in the state that the
shell shows for the depicted view. One record per depicted view, `DepictedView`
of `../parts/depicted_view.tsx`, holds that state and the regions that its
preview highlights in each viewport, and the Canvas stage gives it to the
highlight over each frame. The previews depict the Action and the Toolbar that
the real Welcome and Details screens render, and `../parts/mini_views.tsx` holds
their records. The switch is enabled where the shell can highlight the view. A
comparison, a removed screen, a preview that loads or failed, or a view without
registered components disables it, with the shell's own sentence for that
reason. A checked switch reveals the shipped mask and labels over the regions; a
label opens the artboard of its instance's selection, and a label without one is
a picture of the shell's label.

The metadata row and the prop field are the shipped `@mokly/ui` components too.
The prop field frames the native control of its slot, and draws an optional
field's Set check box, its control, and its Not set line. The package's rule for
a static field reads the check box, so the control and Not set swap in place.
The panels of the artboards render the shipped components as well: the
comparison evidence, the instance tree of the Components section, the supplied
props and the selected instance's props panel, the Usage lists and their loading
states, the controls' form with its alerts, and the edit status over the
preview. The panels' actions and the tree's instances link to the artboards that
show the outcome. Their stylesheets follow the shell's breakpoint, and a mobile
render draws the narrow field column and status pill at every width.

The empty state is the shipped `@mokly/ui` component too. Its action links to
the artboard of its outcome. On a Canvas startup page, the empty state stands
alone in the Canvas root, which takes the place of the viewer root. A static
comparison on a Canvas frame draws each version's document on the shipped opaque
surface.

## Canvas viewer parts

The `canvas` group, the `panels` group, and the inspector's Frames filter
and box model draw the Canvas viewer that the `design/canvas/**` family
depicts: `canvas/canvas-frame`, a bare frame with its mono label and its
size tag in whole CSS pixels that holds a screen at its nominal size scaled
by the zoom, in the frame's own scheme, and an unclipped overlay, such as a
selection, that its caller places at the frame's scale; a component's frame
takes its document's measured size, names its saved variant, or the
component's title for its own example, such as `Action · Light`, and keeps
its whole label also where the frame is narrower; the frame that holds the
selection lights its label; in a comparison the frame
holds both versions in the shipped stacked layers, or names its version in a
tag in Side by side; a use case's step frame leads its label with the step
number, links its title to the step's screen, and reads its description below
the label; a frame that keeps its light view under Dark adds `Light only`
after its name; `canvas/zoom-pill`, zoom out, the zoom level, zoom in
and Fit, whose Fit-only form the dock holds; `canvas/selection`, the
selected instance's outline with eight handles, its name and size tags, and
the redline of its padding from inside its border to its content, or a
selected frame's outline with a handle at
each corner and its size, whose marks keep their size at every zoom;
`canvas/swipe-divider`,
Swipe's divider over a frame, with its grip and the Before and Current tags;
`panels/floating-panel`, the floating catalogue and right panel, and their
bottom sheets with a grabber and a close control; `panels/panel-tabs`, the
right panel's text tabs, Inspect and, on an entry that the branch changed or
that a changed component affects, Changes;
`panels/phone-dock`, the phone's dock with Catalogue, the current tab, and
Fit while the canvas holds a section; `panels/change-stepper`, the entry's
place among the branch's changes
with Previous change and Next change; `panels/compare-modes`, the compare
modes as tiles with their keys, the compared frame's chips in Side by side,
which name a screen's four frames or a variant set's frames as their labels
do, and Scroll together and Refresh; `inspector/frames-filter`, the
viewport and scheme toggles of Inspect with the Highlight components switch,
which a use case draws as two pairs of radio buttons, one viewport and one
scheme; and
`inspector/box-model`, the selected instance's padding on each side around
its content size inside the border and the padding. The
`CANVAS_SAMPLES` set of `metadata.ts` names them, and `LibraryHost` gives
their sample root the Canvas palette scope that a Canvas artboard's root
carries. A static artboard runs no script, so each control links to the
Canvas artboard that shows its outcome, a control without one is a picture
of itself, and the toggles, the switch, and the compact frame picker are
native controls that the Canvas stylesheets read in place.

Inspect's sections render the shipped parts of today's inspector tabs: the
Selection section draws the selected instance's props in metadata rows and
its box model, or the selected frame's size, variant, and scheme; Props
holds the entry's edit form with its prop fields; Usage draws the shipped
usage list; and Components draws the shipped instance tree. A component
opens as its variant set, so its Props edits the saved variant of the
selected frame, or of the frame that holds the selected instance, and says
to choose a variant while nothing is selected; choosing a variant selects
its Light frame. A leaf component, such as the Action, has no component
tree, and a composed one, such as the Toolbar, lists its Nested components.
The shipped tree draws an instance without an address as a button, so every
instance of a depicted tree links to the artboard that shows it selected:
the saved states of `selection` select Welcome's four instances, those of
`outcomes/added` Details' four, and those of `stage/component-set` the
Toolbar's two Actions. `../canvas/parts/instance_records.ts` holds each
entry's instance records, with each instance's frame, outer box, border,
and padding, from which the box model and the samples of
`inspector/box-model` and `canvas/selection` derive their sizes. A
static artboard opens the panel scrolled to the section that its state is
about, the selection or an unfolded section. The Canvas family shows each
component as the example defines it: `../canvas/parts/component_identity.ts`
reads the title, the description, and the tags from the definitions under
`examples/basic/src/components`, and every head, selection, chip, source
line, usage row, and tree row reads that record.

The Changes tab draws the stepper, then Compared, the version before and
the current version on a rail, then the compare modes, and the shipped
comparison evidence of today's inspector, whose base sentence the rail
replaces. The compare modes apply to the frames: Overlay and Difference
stack both versions in each frame in the shipped layers, Swipe splits each
frame at one divider, and Side by side shows the compared frame's two
versions next to each other, while the stage holds every frame's pair, so
the compact frame picker picks another pair in place. A comparison cannot
be highlighted. An entry that the branch added has Current alone, and its
rail holds the current version alone.

The palette scope is `canvasScope` of `../parts/canvas_palette.ts`, the one
module that maps the Canvas palette of `@mokly/ui`, imported by repository
path, to custom properties: the Canvas roles as `--cv-*`, and the shell tokens
that the package components read, each mapped from a Canvas role, so the
package's top bar, catalogue, chips, and metadata rows draw in Canvas. The
scope declares them in the root's inline style. A role that the palette lacks,
such as the hover fill, the frame ring, and the shadows, mixes Canvas roles in
`design-canvas.css`; the change and removal statuses keep the theme's values.

The Canvas scaffolds live in `../canvas/parts/`: `CanvasShell` draws the top
bar, the floating panels over the dot-grid canvas, the zoom pill while the
canvas holds a section, and the dock, and turns compact below the shell's
breakpoint and in every mobile
render, where only the sheet that a state opens is drawn, at its expanded
height where the state asks, and where the pill above the dock names a
selection; `CanvasStage` draws the selected entry's section with its frames,
panned onto a frame where the state asks, with what lies over each frame,
such as the selection, and the compact entry bar with the frame picker,
which a variant set shows only once a selection picks a frame, and then that
frame alone. Each frame stands in a slot that draws no box. The Frames
filter hides the slot, so a frame that it turns off stays hidden whatever
rule shows the frame, and each frame takes its grid cell by its viewport
and scheme, so the filter keeps one row per scheme when it hides a
viewport. They take the destination, the viewport, the catalogue's
filter and row, the entry's title, path, and status, a render of each
frame's sketch by viewport and scheme, and the Inspect body.
`ScreenSelection` composes them for a screen with an instance selected, and
`VariantSetArtboard` for a variant set with or without a selection. The
catalogue's selected row, which the shipped tree marks as the current page,
opens the artboard that renders it. A depicted view that the shell
highlights
shows its highlight in the compact form also while the panel sheet, which
holds the switch, is closed. Canvas links stay inside the Canvas family:
`../canvas/parts/destinations.ts` names its artboards, and the `canvas`
transitions of each artboard's navigation state name the artboards that its
tabs, zoom controls, Fit, dock, selection pill, and sheet close open.

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
status and counts. Slots hold caller-owned JSX, including previews, Inspect
bodies and native inputs. Resolve scenario navigation in an adapter before
calling a component; missing destinations stay non-links. Top-bar Appearance
owns scheme selection. Inspect links and tag chips are ordinary anchors, so they
can live inside native `details` panels. `../parts/nav_data.ts` is the canonical
catalogue-navigation fixture for both the saved All example and the artboards,
so those views stay aligned; the Canvas artboards retarget its rows to Canvas
artboards in `../canvas/parts/nav_rows.ts`. `../parts/account_nav_data.ts` adds
its Account area, the Profile folder's own screen with its `contents` list of
variant and members, the moved Changes rows, and Profile's Changes rows, and
`../parts/variant_nav_data.ts` holds Welcome's Changes-filtered variant rows and
the removed variant's rows. `../parts/entry_paths.ts` owns the depicted paths
that path chips show. `../parts/component_nav_data.ts` owns component parent and
variant identities; the shared fixture and the Canvas artboards compose its rows
instead of copying titles or authored order.

Use explicit semantic `moklyInstance` names for repeated siblings. The
`DesignInstances` context supplies a stable prefix for simultaneous viewport
regions. Flow-step names must be independent of destinations or ordering.
Input ids, label associations and the control's description and invalid state
belong to the form caller; the prop-field component supplies the framing, the
help and error nodes, whose ids are the input id followed by `-help` and
`-error`, and the surface, border and invalid state of whatever native control
the caller puts in its slot, so a prop panel reads the same in every host.

Components may compose registered children. Top bar → Tag picker → Tag chip
records the full nested ownership chain. Components supplied in a caller's slot
retain that caller's ownership.

A design link to the artboard that renders it names the current page with
`aria-current="page"`. Catalogue rows, the selected highlight region, and an
action already in effect get the mark from `useCurrentPage` in
`../parts/design_navigation.tsx`, which compares a destination with the
nearest `DesignNavigation` artboard. Only the top bar's brand link on the home
screen opens its own artboard without the mark.

No screen draws its own frame caption. The Canvas frame names its viewport, as
the shell's frames do.

## Styles And Hosts

The [stylesheet rules](../../../design-library/README.md) say how a
component's sheet imports the `@mokly/ui` stylesheets and how each document
links the sheets in order.

`host.tsx` supplies standalone layout and semantic parents without fixture data.
Inline samples retain intrinsic width. Every variant has actual mobile and
desktop render contexts; every sample is light-only except the two named above.

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
pairs, that the Canvas palette scope maps its roles to pairs that meet theirs,
and that the palette declares every token that an imported `@mokly/ui`
stylesheet reads. `tests/design_boundaries.test.ts` checks that marked
boundaries and control edges stay visible, and that only palette sources name
colours. It audits a Canvas sheet's rules against the Canvas palette, which it
reads from the built `@mokly/ui` palette module through the palette scope, and
a `@mokly/ui` sheet's rules against both palettes.
`tests/design_catalogue.test.ts` serves the example and checks that every
sample keeps its page and saved variants, has a real screen consumer in each
viewport, and links only the styles of the components it renders, and that
each design screen records the shared components of its family. It also checks
that one artboard of each scaffold and highlight state draws the Highlight
components switch in the state that the shell shows.
`tests/browser/design_library_cases.ts` compares samples with the shipped
viewer at `/view/example/screens/welcome/`: the catalogue's section heads keep
the viewer's typography, and the top bar's logo keeps the viewer's colours. It
also checks that the mobile compare modes sample fits a 390px phone with a
wider fallback font.
Open the changed pages through `npm run dev` in both viewports. Check
saved variants and local edit, unset and reset in Serve, plus read-only
inspection in the static build. Keep the output directory as an ignored local
artifact; commit the authored source instead.

See the [adoption contract](../../../../../docs/protocol/mokly-design-components.md)
and [inventory](../../../../../docs/protocol/mokly-design-component-library.md).
