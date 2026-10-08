# Basic Mokly Consumer

This is a synthetic external-consumer fixture. It contains two distinct mobile
and desktop product-style screens built with `@firna/ui` controls, file-derived
folders, one use case, path-addressed links, a Firna renderer adapter, local
stylesheets, light and dark product fragments, and a safe Review-ignore region.
The Welcome screen also includes a small `WorkspaceNote` built from a CSS
Module, an authored PNG-backed stylesheet, and Tailwind v4 utilities, including
a small `note-title` utility. Its
PostCSS module pins Tailwind's base and optimization, scans only `src/` with
`source(none)` plus `@source`, and uses `.browserslistrc` Safari 14 targets
for autoprefixer only. Mokly does not target or re-print CSS Modules.
In `src/components/workspace-note/utilities.css`, `@source "../..";` scans
only this example's `src/` tree, and `@utility note-title` applies to the
Welcome component. The example sets `BROWSERSLIST_IGNORE_OLD_DATA=1` in its
PostCSS module to avoid an aging `caniuse-lite` warning in reproducible demo
builds; application owners should update Browserslist data instead.
`shims.d.ts` declares CSS Module class maps and side-effect CSS imports for
the example's TypeScript check.
The Components → Example → Components folder contains real registered Action and Toolbar
components. Both product screens use Action repeatedly, directly and inside the
Toolbar, with caller-owned slots. Action has Default, Disabled and Secondary
variants plus text, boolean, number, optional hint and emphasis controls; Toolbar
has an editable title and nested Action instances. Open Props in local Serve to
edit them. Published exports provide the same saved examples read-only.
`example-components.css` declares exact shared ownership, separate from global
styles and the design mockups. Action and Toolbar are co-located with their
product-style implementations under `src/components/`: each directory holds
the plain React component (`action.tsx`), its catalogue registration
(`action.mokly.tsx`), and the entry module that exports it
(`action.mockup.tsx`). The configuration discovers those entry modules through a second root over
`src/components`, prefixed with `example/components`, beside the `specs/`
catalogue. The Action and Toolbar registrations use `slug: "index"`; variants
use local slugs such as `default` and `disabled`.
It contains no consumer product screens.

Authoring imports use the public package `@mokly/mokly`. The local executable
and configuration filename remain `mokly` and `mokly.config.ts`.

For a much larger synthetic catalogue, first prepare it with `npm run fixture:large`,
then use `npm run dev:large -- --debug-timings` or `npm run benchmark:large`.
The [large fixture](../../tests/fixtures/large/README.md)
uses the same Firna/React Native Web rendering stack with configurable volume,
without expanding this example or slowing ordinary development startup.

Mokly's 111 design screens now use 16 registered shared components, including
the footer tabs panel and the appearance selector. Open **Components → Design → Shared components** for Chrome, Controls,
Inspector and Preview galleries with 69 component variants, real mobile/desktop
previews and editable local props. The outer Components and Usage tabs show actual
recorded relationships; pictured example data inside an artboard stays separate.
See the [library authoring guide](./specs/design/library/README.md),
[adoption contract](../../docs/protocol/mokly-design-components.md),
[library inventory](../../docs/protocol/mokly-design-component-library.md)
and [implementation plans](../../plans/).

The example uses the recommended dedicated spec tree: discovered modules under
`specs/example`, `specs/design/browse`, `specs/design/changes`,
`specs/design/components`, and `specs/design/library`. Module locations and
slugs supply complete paths; `_folder.json` records supply readable folder titles.
Helpers remain ordinary TypeScript modules. The exporting entry module determines
identity while the defining helper remains the source attribution.

The design screens depict the final navigation and move presentation. The
outer runtime renders the same Specs tree, and Changes labels a moved entry
`Moved`.
`specs/example/README.md` is the Example folder page. Its workspace guide links
to that README, headings and screens and copies `workspace.svg` as a resource.
Both documents follow the selected Light or Dark appearance. The shared library
README is also a discovered document. Their source files remain private.
The design screens' shell shows the Specs and Components sections of one
tree, browse-only folder rows, the Example folder's README as its first
`Overview` row, path chips such as `example/screens/welcome`, and an Account
area holding Billing & Payments and the Profile screen, its folder's own page.
`design/browse/views/folder-overview` opens that README,
`design/browse/pages/document` shows the Payment terms Markdown document in the
shell's own typography, and `design/changes/outcomes/moved` shows `billing` moved under
`account`: one Changes row per entry labelled `Moved`, the previous path in
Details, and the Overlay comparison. The `design/browse/index-entries/**`
states list Profile's variant and members under its row, keep the unmodified
row as an undotted Changes container, and open its first changed member. The
[depicted catalogue](../../docs/protocol/mokly-shell-design-catalogue.md)
lists its folders, paths, and transitions.

The tree is shared by the Specs and Components sections, each pruned by kind.
Folder labels may change without changing entry identity. Shell URLs are
`/view/<path>/`; generated documents use `<path>/index.html` and viewport
files use `<path>/index.<viewport>[.dark].html`.

The Welcome screen uses
`<MockLink to="example/screens/details" fragment="details">` to prove that generated
HTML keeps a portable relative artifact link while served and deployed Browse
navigate to the canonical Details page, retain its anchor through Light/Dark
swaps, and select the Details row in the catalogue tree. The reciprocal Details
link uses the complete path without a fragment.

The prominent `View details` and `Return to welcome` Firna buttons use
`MockLink asChild`, alongside the three original text links. Both viewport
variants and both schemes retain native pointer and keyboard navigation; the
Details action includes its `details` anchor. The no-op handlers let Firna render
enabled controls; generated anchors handle the navigation without scripts.

The design screens use the same API for their brand, screen rows, miniature
content, flow references, and supported scheme, comparison, and tag
transitions. These links open canonical design states. Every selected screen uses the icon
footer, native viewport dropdown, desktop inspector resizing and mobile sheet.
The catalogue-wide Appearance selector sits in the top bar while the header
keeps its viewport control; component designs also show the local highlight
control. Details shows authored metadata without Generated or Route rows,
matching the derived-route shell contract. Copy, refresh, collapse-all and
unsupported combinations remain visual depictions.
The actual outer shell provides its normal runtime controls. See the
[design mockup links contract](../../docs/protocol/mokly-design-links.md)
and the [complete design inventory](../../docs/protocol/mokly-shell-design-inventory.md).
Shared destinations live in [destinations.ts](./specs/design/parts/destinations.ts);
[navigation_states.ts](./specs/design/parts/navigation_states.ts) explicitly
selects which transitions each artboard supports. Add an owning screen and its
contract before enabling a new transition.

Six established Welcome design states remain real variants of
`design/browse/views/screen`: two appearance examples and four tag picker/filter
states. Both appearance variants render in Light and Dark using the single
catalogue-wide Appearance selector; the Details example keeps its light device
preview under Dark. Their paths append `dark-scheme`, `light-only`, and the
four `tag-*` variant slugs to the parent path. The separate
`design/browse/states/tag-filter` screen remains in Shell states.
The reparented removed-variant design state depicts the Changes filter when
only the historical child was removed: its rail shows a single flat Removed
row, even though its former parent remains in the current catalogue as another
screen's variant. This matches the served rail's Changes filter.

`tests/helpers/replaced_copy.ts` lists the shell sentences the protocols
replaced, and `tests/design_replaced_copy.test.ts` fails when any generated
design document renders one of them again. Add the retired sentence to that
list whenever a protocol replaces visible copy, so a mockup family outside the
change's named scope cannot quietly keep the old wording.

## Firna renderer adapter

`renderer.tsx` is the reference consumer adapter for react-native-web
component libraries: it wraps every screen in `SharedUiThemeProvider` (themed
by `theme.ts`), selects the light or dark theme from `input.colorScheme`,
renders one React tree with `react-dom/server`, collects react-native-web's
atomic styles through `AppRegistry`, and injects them into the document head.
The adapter also stamps the document's `data-color-scheme`/`color-scheme`
hooks and, for dark fragments, emits dark-safe body text and link colors for
plain HTML outside Firna components.
`mokly.config.ts` enables both schemes and pairs the renderer with the
`moduleResolution` settings such a stack needs — the `react-native` →
`react-native-web` alias, `react-native`-first conditions and main fields,
`.web.*`-first resolve extensions, and the `.js` → `jsx` loader. Consumers that
render plain React DOM need none of this and can keep a plain
`renderToStaticMarkup` adapter.

The `Design` navigation group is the owning design catalogue for Mokly's
Browse and Changes views. Its seventy-two Browse, page, publication, appearance and Changes
screens cover navigation, Details, tags, color schemes, comparison outcomes,
scrolling, stylesheet evidence, the preparing and unavailable comparison states,
and the previous-version states of removed documents and screens, including
light-only current and removed documents under Dark. Thirty-nine
component explorer screens add component pages, saved variants, stacked
comparisons, affected screens,
repeated/nested inspection, highlighting, and empty or removed states. The shared icon inspector and complete controls
mockups include edited/reset, optional, loading, validation, retry, comparison,
and published variant states. Every
screen has distinct mobile and desktop components. The component designs are
static mockups; the outer package workspace implements the live component explorer. Native
fields can be edited, and authored state links show the designed outcomes.
Desktop variants depict the
shared resize grip on the catalogue navigation in Current and comparison views; narrow variants
keep the drawer fixed. The recorded tokens and responsive rules live in
[`docs/protocol/mokly-shell-design.md`](../../docs/protocol/mokly-shell-design.md).

The shared `design.css` is authored source for the design screens.
Its Dark interface uses the same warm Folio neutrals as Mokly Cloud and the
packaged viewer; the [palette contract](../../docs/protocol/mokly-viewer-palette.md)
records the source mapping and contrast checks. Preview content owns its colors
independently of that interface palette.

The header toolbar selects Mobile/Desktop/Both previews and offers highlighting
where relevant; the top-bar Appearance selector changes the standalone scheme.
Retained Welcome appearance variants publish both schemes under their stable
paths, and embedded component previews follow their host's controls. Leaf components omit Nested components;
Toolbar demonstrates composition. Unchanged fixtures show Unmodified and omit
comparison modes. The fixed desktop shell contains separate preview and inspector
panes; drag the centered grip on the divider line to resize the inspector. Mobile uses a
rounded bottom sheet over the preview, with an iOS-style grabber that toggles
compact/expanded heights by touch, click, or Space. The runtime also supports pan gestures. In both layouts, the icon strip stays visible while the
active content scrolls; closing and reopening retains edits. Viewport carets,
the mobile menu, and the Usage icon use centered SVGs. Known entries show
Added, Changed, Removed, or Unmodified; removing a variant lists it as its own
Removed entry beneath its surviving component, whose row carries an aggregate
mark. The States → Additions gallery demonstrates a newly added Badge.
States → Shared impact shows an Unmodified Action opened from All with changed
shared files in Details and no comparison band.
The Pages → Stacked comparisons gallery holds Action's Overlay and Difference in
one bordered frame, reached from its comparison mode control, and a Checklist
taller than that frame, drawn part-way down it.
States → Loading and recovery shows Usage loading, inspection waiting, and a
failed Usage read with its Try again action.
Removed screens show their status and previous version without comparison
controls; the removed component variant retains its baseline comparison.
Comparison facts live in Details, using shared fixture values for prop differences
and linked component changes. These rows do not generate descriptions of visual
changes. Disabled highlighting explains its specific reason, and outline labels
use separate rounded chips with a gap above the highlighted region.

Open `/view/design/components/overview/` in Browse, or open
[`mokly-generated/design/components/overview/index.desktop.html`](./mokly-generated/design/components/overview/index.desktop.html)
and [`mokly-generated/design/components/overview/index.mobile.html`](./mokly-generated/design/components/overview/index.mobile.html)
directly from disk after `npm run build && npm run example:build`.
The catalogue hierarchy links all owning design pages;
there is no navigation footer inside an artboard. Product links connect
component pages, variants, and consuming screens. The Controls folder
provides the canonical controls example plus Editing, States, and Published
galleries; `inspector` shows both closed-panel layouts.
Each child gallery lists at most five owning screens; inspection also links
two selected-instance screens in a nested gallery.

Eighty-five design screens use `colorSchemes: ["light"]` and draw only the light
Mokly shell. Twenty-six screens instead inherit the catalogue's light/dark
settings: fifteen Appearance screens, seven Changes designs, two product
screens, and two retained Welcome appearance variants. `mokly build` writes a
Light and a Dark file for each viewport, and the outer Appearance control moves
between them.
Design headers use the published Mokly logo: the 22px mark of two overlapping
rounded screens in the brand green (lighter in Dark), followed on desktop by
the serif `mokly.` wordmark. Desktop keeps the navigation resize grip; mobile
keeps its fixed drawer. The component designs reuse the existing shell, frames, controls,
and a shared icon inspector, with synthetic usage fixtures under
`specs/design/components/parts`. The real examples use the public `defineComponent` API.

Exclusive component styles live under `design-library/`. Each component
owns only its view module and stylesheet. A per-render collector emits exclusive
sheets only when the component actually renders, including transient prop edits.
Registration/variant/control metadata stays outside implementation dependencies.
A shared implementation edit appears on its component page and lists consuming
screens as affected; independent screen inputs, slots or instance changes still
appear in Changes. This is tested against fully registered baseline snapshots.

The shared inspector/workspace sheets cover all 111 design screens and standalone
library hosts. Other mixed component-design sheets remain scoped to the 39
component-design routes and hosts; the controls sheet additionally remains
scoped to its eleven owning screen routes. `review.sharedImpact` is fallback
impact evidence for files the rendered resource graph cannot see, such as source
or token modules. A glob match or a changed file inside a declared dependency
directory alone leaves the entry out of Changes; owned component paths and
exact declared files keep their direct reasons. A renderer or token edit that
changes a document or referenced resource still appears. The
[component path rule](../../docs/protocol/mokly-component-changes.md#dependencies-and-styles)
defines membership and the [result schema](../../docs/protocol/mokly-component-review.md#reasons-and-secondary-evidence)
preserves every entry's shared-impact evidence. Linked stylesheets, including
imported sheets, are attributed by rule: a changed rule must potentially match
a view or be unresolved to keep that dependency. A broad stylesheet glob cannot restore
an excluded stylesheet or add an unreferenced public file to Changes. Actual
rendered references, generated usage and component ownership determine the
scope; regression tests cover each exclusive sheet and the mixed/global sheets.

The recorded tokens and responsive rules live in the
[shell design contract](../../docs/protocol/mokly-shell-design.md); component
routes, fixture relationships, mask geometry, and delivery status live in the
[component design contract](../../docs/protocol/mokly-component-design.md),
[inspector design](../../docs/protocol/mokly-component-inspector-design.md),
[controls design](../../docs/protocol/mokly-component-controls-design.md), and
[workspace design](../../docs/protocol/mokly-component-workspace-design.md).

All unchanged Browse designs, including the tag picker, omit comparison controls.
Changed screens and changed or removed component variants retain an opaque
comparison band; in Side by side, Overlay and Difference it draws the Scroll
together switch after the modes. The Diff controls group adds Overlay on an
app-shell screen, whose panel scrolls as one while its top bar and navigation
stay in place, and Side by side with the switch off, each version left at its
own place. Their rows keep fixed heights, so the drawn positions never depend
on text wrapping. Added designs show their current preview and status without
comparison controls; removed screens and documents show their status and their
previous version, labelled “Showing previous version”, without them. Their
nested Previous document versions and Previous screen versions groups add the
long, loading, and unavailable-with-retry states, each reached from its own
row in the same flat Changes list. A removed screen also has a viewport with no
captured previous view, whose stage names the viewport that still opens instead
of standing empty.
The Added outcome still shows its factual branch evidence in
Details; evidence availability, comparison eligibility, and initial inspector
disclosure are independent. The
shared-impact and ignored-only examples open from All with zero Changes and one
Current preview. Retained dependency and shared-impact evidence remains in
Details; unchanged output and paired ignored-only edits do not fill the review list.
The nested Stylesheet evidence group under Impact states adds the rule-aware
stylesheet states: a changed stylesheet whose changed styles apply to the
screen, one whose change can apply anywhere, and one examined and excluded so
the screen stays out of Changes. Their contract is
[CSS change attribution](../../docs/protocol/mokly-css-attribution.md).

From the repository root:

```bash
npm run dev
```

This builds the local CLI, compiles the catalogue in memory, and watches entries, the
renderer, and configured stylesheets. Open the printed URL; the browser reloads
after watched edits. Forward Serve options with `npm run dev -- --port 0`.
Imported consumer helpers, including this example's `theme.ts`, are tracked
and trigger rebuilds automatically. Restart the command after changing
Mokly's own `src/` files.

For one-off generation, verification, or publishing an artifact:

```bash
npm ci
npm run build
npm run example:build
npm run example:check
npm run preview:build
```

This example uses `mockupsDir: "."`; its schema-v9 manifest and HTML under
`mokly-generated/` are ignored local artifacts, absent in a fresh clone.
`example:build` replaces the entire disposable `mokly-generated/` tree as one
transaction; unexpected files inside it are removed without touching authored CSS.
`example:check` validates the current compilation and ignores the untracked local
tree, which can be absent or stale. Do not commit anything under `mokly-generated/`;
commit authored files, including specs, configuration and CSS, normally.
Tracked output checks and historical manifest compatibility use isolated fixtures.
Both `npm test` and `npm run test:browser` build the example before tests read its
generated files. When the saved snapshot is not fresh, `npm test` also saves one
in-memory compilation of the example to
`.context/verification/example-compilation.json`; when the snapshot is still
fresh, it keeps that file. Unit tests that read compiled output load it instead
of compiling the example again, as the
[snapshot contract](../../docs/protocol/ci-example-snapshot.md)
defines. Under the
[test assertion contract](../../docs/protocol/ci-test-assertions.md), tests use
checked catalogue selections. A moved or renamed spec makes a test fail.
It cannot leave the test empty. Baseline fixtures copy authored inputs and use
the normal cached
rebuild through the historical commit's own package source and lockfile. The
hand-authored stylesheets (`styles.css`, `design.css`, `design-stage.css`,
`design-documents.css`, `design-review.css`, `design-review-scroll.css`, and the component design stylesheets) stay under the catalogue root and remain tracked. Imported styles live under
`src/components/workspace-note/` and are never public files. Its imported
image lives at `examples/imported-assets/workspace-note-signal.png`, outside
this catalogue root, preserving imported-asset privacy. The config's
`review.baselineBuild` runs
`npm ci`, `npm run build`, then `npm run example:build` in the historical commit's
extraction. The package build step ensures comparisons use that commit's own
Mokly code. The resulting baseline is cached under `.mokly-cache/`.
`preview:build` exports this catalogue through the shared
package engine into `.context/mokly-preview` for Cloudflare Pages; it is the same
current catalogue used by the main preview workflow. It preserves search, tags,
navigation, Light/Dark choices, client assets, and light/dark fragment files.
Generated HTML copies pass through the same manifest-bound link adapter as served
Browse; direct preview URLs apply one validated `fragment` query progressively
in the parent shell. PR previews explicitly include Changes and immutable screen and component variant
comparisons with `--include-changes --base origin/main`. Publishing then prepares
isolated before/after resources and removed-entry states. Changed-screen
snapshots load only after a comparison option is selected; selecting a removed
page, document or screen loads its packaged previous version. Links inside the design
frames navigate between authored artboards; their pictured comparison controls
do not request actual comparison snapshots. There is no separate Review section
or comparison CLI command.

The Browse shell › Appearance folder records the delivered Auto/Light/Dark
interface appearance for standalone Browse. `design/browse/appearance/overview` is its
canonical screen; Appearance states owns four more, and Panels and comparisons
and Status and recovery own five each. Every one of them is an ordinary
dual-scheme entry, so `mokly build` writes a Light and a
Dark file per viewport and Browse's Appearance control switches the mockup you
are looking at, at the same route. The renderer passes
`input.colorScheme` to the shared artboard scope, which stamps
`data-mbk-appearance`; there is no second theme mechanism, no extra control and
no script inside a mockup.

Standalone Browse holds one Appearance setting, so the depicted top bar
component owns it: every artboard with a top bar draws exactly one scheme
control, the Appearance selector, and the depicted screen header carries the
viewport control alone. The selector names the scheme its file was rendered for,
except on the Auto artboard. The chrome and the
screens it shows change together: Welcome, every comparison mode and the flow's
first step are dark in the Dark render and light in the Light one, while the
light-only Details screen keeps its light frames in both and names that fallback
in its own caption. A comparison family publishes the same schemes for every
member, so changing mode inside a dark catalogue never opens a light document. Device-screen tokens stay independent of the interface
palette, and a comparison in Difference mode still blends on a base taken from
the compared screens. The approved swatches and their contrast are the
[semantic palette](../../docs/protocol/mokly-viewer-palette.md); the behavior
is the [appearance contract](../../docs/protocol/mokly-viewer-appearance.md).
The shipped standalone viewer uses the depicted one-control model, while the
embedded viewer keeps its host-supplied theme alongside its own preview
controls.

The shell designs now include the Document pages folder (document, details,
removal, Markdown document, and the nested Previous document versions states)
and the Published catalogue folder (current catalogue and Changes).
Each state has its own mobile and desktop component and reuses the shell,
navigation, and stage primitives. The synthetic handbook in `specs/document.tsx`
is shared by these designs and the first-class page example; its read-only copy
keeps the document's own appearance while its link, like every link in a
previous version, does nothing.

The `example/getting-started` page imports the shared example document and belongs to
the Example folder alongside Screens and Example tour. Its derived
`example/getting-started/index.html` route, `next-steps` anchor, and incoming Welcome
link exercise the public page API. The design catalogue has eight responsive
document and page states and two publication states.

Every design uses the shared `Search catalogue…` wording. Home guidance and the
`Item not found` state cover screens, documents, and flows; the runtime shell
uses the same catalogue-wide language at both viewport sizes.

`npm run preview:build` exports current content without Git or review controls.
Add `-- --include-changes --base origin/main` to package Changes and immutable
screen comparisons. Both options omit development update connections.

For an ordinary static host, use the consumer command instead of the Pages adapter:

```bash
node dist/cli/bin.js export --config examples/basic/mokly.config.ts --out ../../.context/mokly-site
```

Output is config-relative. This command builds the example itself, with one
`view/<path>/index.html` shell page per entry and canonical `/view/<path>/` links.
The consumer export command requires the configured Git history and rebuilds its
baseline with the recipe above. The default repository preview exports current
content without a baseline; preview Changes uses the same cached rebuild.
See the [consumer publishing recipe](../../README.md#review-and-share).
