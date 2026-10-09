# Development Hydration Coverage

Continuation of [CI Verification](./ci-verification.md). This page owns the
route sample of the development hydration suite and the generated resource
audit that replaces the frame loads the smaller sample no longer makes.

## What The Suite Checks

Serve and export send the Browse shell as complete server HTML. The standalone
entry then hydrates that tree in place, as
[viewer SSR and hydration](./mokly-viewer-ssr.md) defines. Hydration specs
replace `/mokly-viewer/client/react-shell.js` with a development React build of
`packages/viewer/src/browser.tsx`. Development React reports each difference
between the server HTML and the first client render as a console error.

A hydration test passes when the document gains `data-mokly-hydrated`, two
animation frames pass, and the page has reported no console error or uncaught
exception. The only accepted console messages are the sandbox notices that the
parent contract lists.

The route only selects which catalogue entry the shell shows. Every route runs
the same shell modules, and the entry's manifest data chooses the branches
inside them. On 2026-10-05 the 210 example entries ran 889 shell functions
during hydration, and every entry ran the same 411 of them. The suite therefore
hydrates one representative route per entry shape, not every route.

## Entry Shapes

`tests/helpers/hydration_shapes.ts` reads the entries of
`examples/basic/mokly-generated/mokly-manifest.json` in manifest order. The shape key
of an entry `e` is the `JSON.stringify` text of an object with exactly these
properties, in this order:

1. `kind`: `e.kind`.
2. `fields`: the sorted names of the own properties of `e` whose values are
   present and non-empty.
3. `colorSchemes`: the sorted distinct values of `e.colorSchemes`, or `[]` when
   the entry has none.
4. `controls`: the sorted distinct texts `<kind>(<keys>)`, one for each value
   of `e.controls`, or `[]`. `<keys>` joins with commas the sorted names of the
   control's present, non-empty properties other than `kind` and `label`, for
   example `number(maximum,minimum)` or `select(options)`.
5. `propSchema`: the sorted distinct `schema.kind` values of
   `e.propSchema.properties`, each with a `?` suffix when `optional` is `true`,
   or `[]`.
6. `values`: the sorted distinct wire tags of every value in `e.props` and in
   the `props` of every instance in `e.componentViews[].instances`, or `[]`. A
   wire tag is the first element of a wire value: `null`, `boolean`, `number`,
   `string`, `array` or `object`.
7. `instances`: `true` when any `e.componentViews[].instances` array is
   non-empty.
8. `slotted`: `true` when any of those instances has a `slotKey`.

A value is present and non-empty unless it is `undefined`, `null`, an empty
string, an empty array or an object with no own properties. Numbers and
booleans always count. A new manifest field therefore creates new shapes
without a change to the rule.

The representative of a shape is its first entry in manifest order, and its
route is `entryRoute(e.path)`, for example
`example/screens/welcome/index.html`. `hydrationShapeSample(entries)` returns
`{ entryPath, route, shape }` for each representative, in manifest order. On
2026-10-05 the 210 example entries formed 51 shapes.

Two shell tests stay beside the sample: the catalogue home `/` and the missing
route `/view/not-in-catalogue.html`. The missing-route test first confirms that
Serve answers 404. It then serves that response with status 200, so Chrome does
not report the document's own 404 as a console error.

## Test Registration

`tests/browser/react_shell_hydration_routes.spec.ts` computes the sample at
Playwright discovery time. It registers one test per representative with the
title `development React hydrates fixture route <route>`. Each test keeps the
normal Playwright deadline and the shared error assertions, so catalogue growth
cannot exhaust a shared loop deadline. The spec runs these tests in Playwright
parallel mode and builds the development bundle once per worker, as
[Test Concurrency](./ci-suite-evidence.md#test-concurrency) defines.

Each test opens `/view/<route>` with every path segment percent-encoded and
requires status 200. It passes `<route> (<shape>)` as the failure context, so a
failure names the shape it represents. Discovery fails when the manifest has 80
or fewer entries or when the sample is empty.

The sample hydrates the default state: a fresh browser context, Playwright's
default viewport, no stored preferences and the Auto appearance.

## Inventory

`tests/hydration_inventory.test.ts` lists the Playwright inventory for
`react_shell_hydration` with the JSON reporter. The fixture-route titles must
equal the sample routes, each exactly once. Every manifest entry's shape key
must have a representative in the sample.

`tests/hydration_shapes.test.ts` proves each shape property with synthetic
entries: text-only changes keep a shape, each property above changes it, empty
values count as absent, and the same input always gives the same keys in the
same order.

## Changing The Shape Key

A change to the shape key must keep the measured code coverage of the full
route list: the home route, the missing route and every unique entry route.
Measure the full list and the new sample against the same build:

1. Serve the example as the `hydration` project does. Install the development
   bundle on a new page for each route.
2. Start V8 precise coverage with call counts and block detail before the
   navigation. Take the coverage after `data-mokly-hydrated` and two animation
   frames, and again after `load` and two more frames.
3. Keep only the `react-shell.js` script. Keep the offsets of modules whose
   esbuild `// <path>` comment names a file under `packages/viewer/src/`.
4. A function counts when its first range has a count above zero. A
   non-whitespace character counts when the innermost range that contains it
   has a count above zero.
5. The new sample passes only when its union equals the union of the full list
   for both the functions and the characters.

## Generated Resource Audit

The full route list loaded the mockup frames of every entry, and a failed frame
resource load reached the page console. The sample loads only its own frames.
`tests/example_resource_references.test.ts` therefore audits every `.html` and
`.css` file under `examples/basic/mokly-generated/` and in the v10 manifest
`assetClosure` with `tests/helpers/generated_resource_references.ts`. The audit
receives those inputs relative to `examples/basic/`, the catalogue root. It
does not scan authored source or local cache directories. References can cross
from the generated tree to the authored closure within that root.

The audit checks these HTML references:

- `link[href]` when `rel` contains `stylesheet`, `icon`, `preload` or
  `modulepreload`;
- `src` on `img`, `source`, `video`, `audio`, `track`, `iframe`, `embed` and
  `input[type=image]`;
- `srcset` on `img` and `source`, read as HTML reads candidates: each URL is a
  run of non-whitespace characters, and its descriptors end at the next comma;
- `poster` on `video` and `data` on `object`;
- `href` and `xlink:href` on SVG `image` and `use`; and
- `@import` targets and declaration `url()` values in `<style>` elements, and
  `url()` values in `style` attributes.

In each `.css` file, it checks every `@import` target and every `url()` value
in a declaration.

The audit ignores empty values, fragment-only values, values with a URL scheme
such as `data:` or `https:`, and protocol-relative values. These values fail:

- a root-absolute value, because Serve and export deliver generated files under
  `/static/` and a file opened from disk has no site root;
- a relative value that resolves outside the catalogue root `examples/basic/`; and
- a relative value that does not name an existing regular file after the audit
  removes its query and fragment and percent-decodes it.

Each failure names the file, the attribute or rule, the value and the reason,
and the audit sorts the failures. The test requires no failures. It also
requires that the audit read more than zero HTML files and stylesheet links.
Anchor links stay with the build's link validation and the design link tests.

## Boundary

The sample owns default-state hydration of catalogue routes. Other hydration
specs keep their fixed cases: restored appearance, stored preferences, mobile
width and live controls; early user input; state serialization; finalized
static exports; moved and removed entries; hidden folders; navigation handoff;
changed-view evidence; and the embedded viewer.
