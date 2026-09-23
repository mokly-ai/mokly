# Basic Mokly Consumer

This is a synthetic external-consumer fixture. It contains two distinct mobile
and desktop product-style screens built with `@firna/ui` controls, nested
collections, one use case, id-addressed links, a Firna renderer adapter, local
stylesheets, light and dark product fragments, and a safe Review-ignore region.
The Components → Example → Components collection contains real registered Action and Toolbar
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
(`action.mockup.tsx`). The configuration discovers those entry modules with a
second `entries` glob beside the `entries/` catalogue, so the shared
components need no mirror files under `entries/`.
It contains no consumer product screens.

Authoring imports use the public package `@mokly/mokly`. The local executable
and configuration filename remain `mokly` and `mokly.config.ts`.

For a much larger synthetic catalogue, first prepare it with `npm run fixture:large`,
then use `npm run dev:large -- --debug-timings` or `npm run benchmark:large`.
The [large fixture](../../tests/fixtures/large/README.md)
uses the same Firna/React Native Web rendering stack with configurable volume,
without expanding this example or slowing ordinary development startup.

Mokly's 89 design screens now use 16 registered shared components, including
the footer tabs panel and the appearance selector. Open **Components → Design → Shared components** for Chrome, Controls,
Inspector and Preview galleries with 66 saved variants, real mobile/desktop
previews and editable local props. The outer Components and Usage tabs show actual
recorded relationships; pictured example data inside an artboard stays separate.
See the [library authoring guide](./entries/design/library/README.md),
[adoption contract](../../docs/protocol/mokly-design-components.md),
[library inventory](../../docs/protocol/mokly-design-component-library.md)
and [plans index](../../plans/README.md).

The entry definitions use collection membership as their only navigation
hierarchy. The real `Example` collection owns `Screens`, the example tour, and
Getting started; the real `Design` collection owns the `Mokly design` tree. Those parent
collections preserve the intended visible groups and automatically produce
the same breadcrumb ancestry. Consumer code does not provide `navPath`; when
migrating an older catalogue, keep a former synthetic group only by adding an
equivalent parent collection.

The Welcome screen uses
`<MockLink to="example-details" fragment="details">` to prove that generated
HTML keeps a portable relative artifact link while served and deployed Browse
navigate to the canonical Details page, retain its anchor through Light/Dark
swaps, and select the Details row in the catalogue tree. The reciprocal Details
link exercises the id-only form.

The prominent `View details` and `Return to welcome` Firna buttons use
`MockLink asChild`, alongside the three original text links. Both viewport
variants and both schemes retain native pointer and keyboard navigation; the
Details action includes its `details` anchor. The no-op handlers let Firna render
enabled controls; generated anchors handle the navigation without scripts.

The design screens use the same API for their brand, screen rows, miniature
content, flow references, and supported scheme, comparison, and tag
transitions. These links open canonical design states. Every selected screen uses the icon
footer, native viewport dropdown, desktop inspector resizing and mobile sheet.
Theme pairs use the icon in the same header group; component designs also
support native local theme/highlight toggles. Copy, refresh, collapse-all and
unsupported combinations remain visual depictions.
The actual outer shell provides its normal runtime controls. See the
[design mockup links contract](../../docs/protocol/mokly-design-links.md)
and the [complete design inventory](../../docs/protocol/mokly-shell-design.md#design-mockups).
Shared destinations live in [destinations.ts](./entries/design/parts/destinations.ts);
[navigation_states.ts](./entries/design/parts/navigation_states.ts) explicitly
selects which transitions each artboard supports. Add an owning screen and its
contract before enabling a new transition.

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
Browse and Changes views. Its fifty-seven Browse, page, publication, appearance and Changes
screens cover navigation, Details, tags, color schemes, comparison outcomes,
stylesheet evidence, the preparing and unavailable comparison states, and the
previous-version states of removed documents and screens. Thirty-two component
explorer screens add component pages, saved variants, affected screens,
repeated/nested inspection, highlighting, and empty or removed states. The shared icon inspector and complete controls
mockups include edited/reset, optional, loading, validation, retry, comparison,
and published saved-variant states. Every
screen has distinct mobile and desktop components. The component designs are
static mockups; the outer package workspace implements the live component explorer. Native
fields can be edited, and authored state links show the designed outcomes.
Desktop variants depict the
shared resize grip on the catalogue navigation in Current and comparison views; narrow variants
keep the drawer fixed. The recorded tokens and responsive rules live in
[`docs/protocol/mokly-shell-design.md`](../../docs/protocol/mokly-shell-design.md).

The shared `generated/design.css` is authored source for the design screens.
Its Dark interface uses the same warm Folio neutrals as Mokly Cloud and the
packaged viewer; the [palette contract](../../docs/protocol/mokly-viewer-palette.md)
records the source mapping and contrast checks. Preview content owns its colors
independently of that interface palette.

A grouped icon toolbar switches Mobile/Desktop/Both previews, light/dark, and
screen highlighting. The original Browse/Changes theme pairs retain their
canonical links; component previews change locally. Leaf components omit Nested components;
Toolbar demonstrates composition. Unchanged fixtures show Unmodified and omit
comparison modes. The fixed desktop shell contains separate preview and inspector
panes; drag the centered grip on the divider line to resize the inspector. Mobile uses a
rounded bottom sheet over the preview, with an iOS-style grabber that toggles
compact/expanded heights by touch, click, or Space. The runtime also supports pan gestures. In both layouts, the icon strip stays visible while the
active content scrolls; closing and reopening retains edits. Viewport carets,
the mobile menu, and the Usage icon use centered SVGs. Known entries show
Added, Changed, Removed, or Unmodified; removing a variant marks its surviving
component Changed. The States → Additions gallery demonstrates a newly added Badge.
Removed screens show their status and previous version without comparison
controls; the removed component variant retains its baseline comparison.
Comparison facts live in Details, using shared fixture values for prop differences
and linked component changes. These rows do not generate descriptions of visual
changes. Disabled highlighting explains its specific reason, and outline labels
use separate rounded chips with a gap above the highlighted region.

Open `design/components/overview.html` in Browse, or open
[`generated/design/components/overview.desktop.html`](./generated/design/components/overview.desktop.html)
and [`overview.mobile.html`](./generated/design/components/overview.mobile.html)
directly from disk after `npm run build && npm run example:build`.
The catalogue hierarchy links all owning design pages;
there is no navigation footer inside an artboard. Product links connect
component pages, variants, and consuming screens. The `controls` collection
provides the canonical controls example plus Editing, States, and Published
galleries; `inspector` shows both closed-panel layouts.
Each child gallery lists at most five owning screens; inspection also links
two selected-instance screens in a nested gallery.

Seventy design screens use `colorSchemes: ["light"]` and draw only the light
Mokly shell. Nineteen screens instead inherit the catalogue's light/dark
settings: the thirteen Appearance screens, four Changes designs, and two
product screens. `mokly build` writes a Light and a Dark file for each of their
viewports, and the outer Appearance control moves between them.
Design headers use the published Mokly logo: the 24px mark of two overlapping
rounded screens in the brand green (lighter in Dark), followed on desktop by
the serif `mokly.` wordmark. Desktop keeps the navigation resize grip; mobile
keeps its fixed drawer. The component designs reuse the existing shell, frames, controls,
and a shared icon inspector, with synthetic usage fixtures under
`entries/design/components/parts`. The real examples use the public `defineComponent` API.

Exclusive component styles live under `generated/design-library/`. Each component
owns only its view module and stylesheet. A per-render collector emits exclusive
sheets only when the component actually renders, including transient prop edits.
Registration/variant/control metadata stays outside implementation dependencies.
A shared implementation edit appears on its component page and lists consuming
screens as affected; independent screen inputs, slots or instance changes still
appear in Changes. This is tested against fully registered baseline snapshots.

The shared inspector/workspace sheets cover all 89 design screens and standalone
library hosts. Other mixed component-design sheets remain scoped to the 32
component-design routes and hosts; the controls sheet additionally remains
scoped to its eleven owning screen routes. `review.sharedImpact` is fallback
impact evidence for files the rendered resource graph cannot see, such as source
or token modules. Linked stylesheets, including imported sheets, are attributed
by rule: a changed rule must potentially match a view or be unresolved to keep
that dependency. A broad stylesheet glob cannot restore an excluded stylesheet
or add an unreferenced public file to Changes. Actual rendered references,
generated usage and component ownership determine the scope; regression tests
cover each exclusive sheet and the mixed/global sheets.

The recorded tokens and responsive rules live in the
[shell design contract](../../docs/protocol/mokly-shell-design.md); component
routes, fixture relationships, mask geometry, and delivery status live in the
[component design contract](../../docs/protocol/mokly-component-design.md),
[inspector design](../../docs/protocol/mokly-component-inspector-design.md),
[controls design](../../docs/protocol/mokly-component-controls-design.md), and
[workspace design](../../docs/protocol/mokly-component-workspace-design.md).

All unchanged Browse designs, including the tag picker, omit comparison controls.
Changed screens and changed or removed component variants retain an opaque
comparison band. Added designs show their current preview and status without
comparison controls; removed screens and documents show their status and their
previous version, labelled “Showing previous version”, without them. Their
nested `design/browse/pages/previous-version/` and
`design/review/outcomes/previous-version/` groups add the long, loading, and
unavailable-with-retry states, each reached from its own row in the same flat
Changes list. A removed screen also has a viewport with no captured previous
view, whose stage names the viewport that still opens instead of standing
empty.
The Added outcome still shows its factual branch evidence in
Details; evidence availability, comparison eligibility, and initial inspector
disclosure are independent. The
shared-impact and ignored-only examples open from All with zero Changes and one
Current preview. Dependency evidence remains available in Details, while
unchanged output and paired ignored-only edits do not fill the review list.
The nested `design/review/impact/stylesheets/` group adds the rule-aware
stylesheet states: a changed stylesheet whose changed styles apply to the
screen, one whose change can apply anywhere, and one examined and excluded so
the screen stays out of Changes. Their contract is
[CSS change attribution](../../docs/protocol/mokly-css-attribution.md).

From the repository root:

```bash
npm run dev
```

This builds the local CLI, generates the catalogue, and watches entries, the
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

This example uses the default `generatedOutput: "derived"`. Generated HTML and
the schema-v5 manifest under `generated/` are ignored local artifacts, absent in a fresh clone.
`example:build` writes them transactionally; `example:check` validates the current
compilation and rejects tracked generated output without requiring files on disk.
Committed-mode stale and deterministic-output tests use isolated consumer fixtures.
Both `npm test` and `npm run test:browser` build the example before tests read its
generated files. Baseline fixtures copy authored inputs and use the normal cached
rebuild through the historical commit's own package source and lockfile. The
hand-authored stylesheets (`styles.css`, `design.css`, `design-stage.css`,
`design-review.css`, and the component design stylesheets) also live under `generated/` because it doubles as the
public static root and remain tracked. The config's `review.baselineBuild` runs
`npm ci`, `npm run build`, then `npm run example:build` in the historical commit's
extraction. The package build step ensures comparisons use that commit's own
Mokly code. The resulting baseline is cached under `.mokly-cache/`.
`preview:build` exports this catalogue through the shared
package engine into `.context/mokly-preview` for Cloudflare Pages; it is the same
current catalogue used by the main preview workflow. It preserves search, tags,
navigation, Light/Dark choices, client assets, and light/dark fragment files.
Public HTML copies pass through the same ownership-aware link adapter as served
Browse; direct preview URLs apply one validated `fragment` query progressively
in the parent shell. PR previews explicitly include Changes and immutable screen and saved component
comparisons with `--include-changes --base origin/main`. Publishing then prepares
isolated before/after resources and removed-entry states. Changed-screen
snapshots load only after a comparison option is selected; selecting a removed
page or screen loads its packaged previous version. Links inside the design
frames navigate between authored artboards; their pictured comparison controls
do not request actual comparison snapshots. There is no separate Review section
or comparison CLI command.

`design/browse/appearance/` records the delivered Auto/Light/Dark interface
appearance for standalone Browse. `overview.html` is its canonical screen;
`states/` owns two more and `workspaces/` and `status/` own five each. Every one
of them is an ordinary dual-scheme entry, so `mokly build` writes a Light and a
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

The shell designs now include `design/browse/pages/` (document, details,
removal, and the nested `previous-version/` states) and
`design/browse/publication/` (current catalogue and Changes).
Each state has its own mobile and desktop component and reuses the shell,
navigation, and stage primitives. The synthetic handbook in `entries/document.tsx`
is shared by these designs and the first-class page example; its read-only copy
keeps the document's own appearance while its link, like every link in a
previous version, does nothing.

The `example-handbook` page imports the shared example document and belongs to
the existing Example collection alongside Screens and Example tour. Its exact
`handbook.html` route, `next-steps` anchor, and incoming Welcome link exercise
the public page API. The design catalogue has seven responsive page states and
two publication states.

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

Output is config-relative. This command builds the example itself, retains exact
`.html` URLs and real `/id/<id>/index.html` aliases, and needs no provider rewrites.
The consumer export command requires the configured Git history and rebuilds its
baseline with the recipe above. The default repository preview exports current
content without a baseline; preview Changes uses the same cached rebuild.
See the [consumer publishing recipe](../../README.md#export-and-publish-a-consumer-build).
