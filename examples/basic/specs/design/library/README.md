# Shared Design Components

Status: In progress under the [shell views plan](../../../../../plans/ui-package-shell-views.md).

## Scope

These sixteen components render both Mokly's design artboards and
the independent pages under **Components → Design → Shared components**. The
footer tabs panel is `inspector/inspector`. This is the consumer's mockup
library. Each component renders the `@mokly/ui` component that the shipped
shell uses: each view imports its component, and each component sheet imports
the package stylesheets of the component and of each package component that
it renders, each by its repository path under `packages/ui/src`, so each side
of a comparison renders its own package files. The Mokly browser shell itself
remains in the package source.

The artboards follow the same rule for every other part that a package
component provides, such as the shell and workspace scaffolds of
`../parts/shell.tsx` and `../components/parts/workspace.tsx`, the panels and
lists of the inspector, and the highlight mask of
`../components/parts/highlight.tsx`. Each such part renders the package
component, its sheet imports the package stylesheets by repository path, and
no artboard keeps a copy of that markup or CSS.

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
`view-controls` draws no Dark preview toggle, so every depicted screen header
carries the viewport select and Highlight components alone. `metadata.ts` owns that
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
kind, and a folder row has none. `tests/browser/design_reasons.spec.ts` reads
it to skip pages, documents and use cases.

The top bar, the catalogue navigation and the screen header are the shipped
`@mokly/ui` components. A static artboard runs no script, so their links open
the artboards that show each state, and each control without a destination is
a picture of itself: the menu, Collapse all, a filter, the separator and the
path chip. Their stylesheets follow the shell's breakpoint. A frame around the
top bar carries a compact flag that draws the narrow bar of a mobile render at
every width, and a frame around the navigation carries a drawer flag that
draws the open drawer of the drawer presentation and of every mobile render.

The tag picker, the tag chip, the view controls and the change status are the
shipped `@mokly/ui` components too. The search field ends with the tag picker:
its button links to the artboard that shows the picker opened or closed, a
closed picker draws only its button, and each chip of an open picker is the
registered tag chip, so Top bar → Tag picker → Tag chip records every chip. A
chip with a destination links to the artboard that shows its filter, and a
chip without one is a picture of itself.

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
views other than the shown one, so the details inspector names them. A static
artboard runs no script, so the viewport select and the Highlight components
switch are native controls: scoped `:has()` rules in the design stylesheets
read the select's option and the switch's check, so the previews and the
highlight change in place, even in Browse's sandboxed frames. Every header
draws the switch in the state that the shell shows for the depicted view, so
the highlight state is a required prop. `ViewSwitch` in `../parts/shell.tsx`
takes it from each screen, and the component page layout derives it from the
comparison mode, the depicted component and its details. The switch is
enabled where the shell can highlight the view. A comparison, a removed
screen, a preview that loads or failed, or a view without registered
components disables it, with the shell's own sentence for that reason.

The inspector, the metadata row and the prop field are the shipped `@mokly/ui`
components too. A static artboard runs no script, so each inspector tab is a
native disclosure of one group: a tab opens its panel and closes it again,
opening a tab closes the others, and the open tab's Close is part of the tab.
The divider grip is a picture over the workspace's native sizer, and the
sheet's grabber is a native switch that the dock reads for the expanded
height. The prop field frames the native control of its slot, and draws an
optional field's Set check box and Not set line; a scoped rule in its sheet
reads the check box, so the field's control and Not set swap in place. The
panels of the artboards render the shipped components as well: the Details
body, the supplied props and the selected instance's props panel, the Usage
lists and their loading states, the controls' form with its alerts, and the
edit status over the preview. The Browse and Changes designs draw the shipped
comparison evidence inside the approved bordered card. The panels' actions
link to the artboards that show the outcome. Their stylesheets follow the
shell's breakpoint, and a mobile render draws the narrow sheet, details body,
field column and status pill at every width.

The device frame, the comparison pane, the empty state and the flow step are
the shipped `@mokly/ui` components too. The device frame renders
`PreviewFrame` around `PhoneFrame` or `BrowserFrame`, in the scheme of the
depicted screen. On a stage it names its viewport above the chrome, as the
shell's frames do. In a flow step or a comparison it stands where the shared
`FrameSettingScope` context of `preview/frame_placement.tsx` places it,
without a caption. A static artboard runs no script, so the window's bar is a
picture of itself: the address copies nothing, and the expand toggle expands
nothing. The compact flag draws a small phone, and the light-only flag shows
the caption's Light-only note, as a Dark shell shows it. The comparison pane
names its side, Before or Current, and the empty state's action links to the
artboard of its outcome. The artboards render the rest of the preview slice
in the same way: the stages and the document stage, the use-case flows, a
removed entry's previous version with its states, the comparison stage with
its sections, panes, viewports and layers, and the component pages' variant
bar. The previous version and the comparison stage stand in the preview pane,
as the shell nests them. A static comparison draws each version's document
on the shipped opaque surface, at a drawn scroll position, with a drawn
scrollbar where the document is taller than the viewport.

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
header view controls own the viewport. Inspector-body links and tag chips are
ordinary anchors, so they can live inside native `details` panels.
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
stylesheets by their repository paths, plus mockup-only rules such as the
compact and drawer flags. CSS Changes uses own-page matches
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
the rule has no marker. A closed picker draws no chip, so it does not link chip
CSS merely because another variant uses chips.

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
pairs, and that the palette declares every token that an imported `@mokly/ui`
stylesheet reads. `tests/design_boundaries.test.ts` checks that marked
boundaries and control edges stay visible, and that only palette sources name
colours.
`tests/design_catalogue.test.ts` serves the example and checks that every
sample keeps its page and saved variants, has a real screen consumer in each
viewport, and links only the styles of the components it renders, and that
each design screen records the shared components of its family. It also checks
that one artboard of each scaffold and highlight state draws the Highlight
components switch in the state that the shell shows.
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
