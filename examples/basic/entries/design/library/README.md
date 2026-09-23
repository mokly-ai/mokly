# Shared Design Components

These sixteen registered components render both Mokly's design artboards and
the independent pages under **Components → Design → Shared components**. The
footer tabs panel is `inspector/inspector`. This is the consumer's mockup
library; the actual Mokly browser shell remains in the package source.

`chrome/appearance-selector` is the standalone catalogue's Auto/Light/Dark
setting, which changes the chrome and the screens it shows together. `chrome/top-bar`
always composes it, so every artboard with a top bar draws it; a screen does not
opt in. The value defaults to the scheme the file was rendered for and is
overridden only to depict a different setting, as the Auto artboard does. It is
the only scheme control the design catalogue draws. Its three pre-rendered faces
and `data-*` hooks mirror the shipped shell control, with a regression test
guarding that shared structural contract.

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
disclosure summary. Variant rows render one indent step deeper with the variant
icon — a screen outline over a second, partially drawn screen — on a
`mbk-nav-ico variant` wrapper, only while the list is open. The changed mark is
a trailing dot and never an edge or rail. Row rendering lives in
`catalogue-navigation-row.view.tsx`, which the component owns beside its main
view. Selected rows use the same appearance-aware contrast token for their
labels, variant disclosures and changed marks.

View controls saves **Changed views**, where a change confined to other views
marks the viewport dropdown; the owning screen also marks top-bar Appearance
when another scheme changed. The mark is evidence about
views other than the shown one, so the details inspector names them.

## Authoring

For each component, `{group}/{slug}.tsx` declares its typed schema, slots, saved
variants and supported controls. `{slug}.view.tsx` implements its markup.
`library.mockup.ts` registers the entries with four flat-authored gallery
folder paths.

Call the registered `.Component` from screen adapters. Never import a `.view`
module into a screen or create a second standalone implementation. Leave whole
screens, stage/workspace layouts and fixture selection as ordinary composition.

Pass actual screen data at the boundary: labels, destinations, query, selection,
status and counts. Slots hold caller-owned JSX, including previews, inspector
bodies and native inputs. Resolve scenario navigation in an adapter before
calling a component; missing destinations stay non-links. Top-bar Appearance owns scheme selection;
header view controls own the viewport. Use ordinary `MockLink` anchors for inspector-body
links and tag chips so they can live inside native `details` panels.
`parts/nav_data.ts` is the canonical catalogue-navigation fixture for both the
saved All example and in-screen artboards, so those two views stay aligned.

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

## Styles And Hosts

`metadata.ts` declares exact ownership of a component's `.view.tsx` module and
`generated/design-library/{group}/{slug}.css`. Keep registration, saved fixtures,
controls metadata, shared helpers and navigation tables out of those dependencies.
An example-only edit must not report implementation impact on every consumer.

Each view calls `useDesignStyle(slug)` when it renders visible owned markup.
`style_files.ts` supplies the ordered candidate pool to the example configuration.
The shared preview layout reserves intrinsic mobile widths so full-size phones
cannot overlap desktop frames when Both is selected.
The phone notch and home pill are decorative and ignore pointer events, so
they cannot intercept interactions with the caller-owned screen below them.
The configuration orders shared base styles first, requested component sheets
next, then context/layout overrides. Keep this explicit order: equal-specificity
mobile rules must not override bounded workspace scrolling.
`style_context.tsx` creates a fresh collector for each normal or transient render,
retains configured relative URLs and shared sheets, and emits only requested
exclusive sheets. Missing configuration fails explicitly. A hidden picker does
not link chip CSS merely because another variant uses chips.

Only exclusive selectors belong in an owned stylesheet. Tokens, resets, mixed
selectors and cross-component layout/state rules stay in the shared design CSS.
Keep shared host resets at zero specificity so owned component styles render
identically in standalone samples and in-screen compositions.
Keep configured watch paths in sync when introducing an owned sheet.

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
npm run example:build
npm run example:check
npm run typecheck
node --import tsx --test tests/design_library*.test.ts tests/design_library*.test.tsx tests/component_design_attribution.test.ts
npx playwright test tests/browser/design_library*.spec.ts
cargo xtask check
```

Open changed generated fragments directly from disk in both viewports. Check
saved variants and local edit/unset/reset behavior in Serve, plus read-only
inspection after export. Keep the generated HTML and manifest as ignored local
artifacts; commit their authored source instead.

The tests retain the original 56 screen ids/routes from before the shared
library existed, assert real consumers and
owner chains, guard migrated composition points, and edit actual source files in
isolated copies. They distinguish implementation changes, saved metadata changes,
screen inputs/slots/order, exclusive CSS and conservative global dependencies.
Serve and comparison share the same classification and bounded baseline reads.
Full-catalogue browser fixtures share a five-minute setup budget to build the
packages and example or the historical baseline, export every generated view
and verify input stability. The cold preview-preparation spec uses a dedicated
fixture so its build has that budget too. Browser interactions use the default
one-minute limit, and server readiness keeps its own deadline.

See the [adoption contract](../../../../../docs/protocol/mokly-design-components.md)
and [inventory](../../../../../docs/protocol/mokly-design-component-library.md).

Page artboards compose the shared inspector and metadata rows. An inspector tab
may name an authored destination when a static scenario has separate open and
closed artboards; ordinary tabs continue using native disclosure behavior.
