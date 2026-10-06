# Design Mockup Verification

## Scope

This contract covers Mokly's design catalogue, authored under
`examples/basic/specs/design/` and generated under
`examples/basic/generated/design/`. It gives each check one test layer.
The design and inventory contracts define the screens and their required facts.
This contract defines how to verify them.

## Test Layers

### Unit mockup tests

Generated-catalogue assertions in `tests/design_*.test.ts(x)`,
`tests/component_design_*.test.ts`, and `tests/brand_logo.test.tsx` read the
in-memory compilation from `tests/helpers/design_catalogue.ts`. Other unit
checks under these names inspect authored styles, isolated components, helpers,
or source boundaries. Unit tests check text, attributes, link targets, counts,
presence, absence, and stylesheet rules without a browser or a served shell.

Selected screen and component depictions have one inspector and one Preview
options toolbar. Whole-page and document depictions have one inspector and no
preview toolbar, including loading and unavailable previous documents. Home,
missing-route, catalogue-navigation, and flow depictions have neither.
Appearance depictions follow the same rule for the entry kind they show.

Catalogue-wide selections use `designEntries(predicate, label)`. The helper
returns matching manifest entries and fails with the supplied label if none
match. Baseline tests can supply the copied catalogue's entries as a third
argument to preserve the exact historical input. A path or kind change must
fail a selection instead of silently skipping its assertions. Readers for one
screen or component variant must also fail when the requested entry or output
does not exist.

`tests/design_links_inventory.test.ts` compares current screens with the
documented design inventories. It is the only guard against a removed design
screen returning. Tests must not look up removed ids to prove their absence.

### Browser mockup specs

`tests/browser/design/*.spec.ts` open raw generated artboards through
`designArtboardUrl(path, viewport, scheme?)` in
`tests/browser/design/artboards.ts`. The helper returns a `file://` URL for
the path's generated `index.<viewport>[.dark].html`; Light is the default.
It never returns a served shell route.

These specs check layout, computed styles, CSS-driven visibility, overflow,
scrolling, focus, hit-testing, and native control behavior. A visible canvas
count can establish layout. A count in authored copy belongs in a unit test.
Raw artboards contain no Mokly runtime script. Native disclosures, fields, and
authored state links can work without one.

### Runtime specs

Other `tests/browser/*.spec.ts` check Mokly's runtime: served shells,
sandboxed frames, exports, and preview hosts. New checks use non-design
fixtures, such as the Example screens or isolated `createFixture` catalogues.
They verify navigation, history, appearance changes, inspection, link
adaptation, and runtime script behavior. A design change must not break a
runtime test merely because its sample content changed.

Existing served-design fixtures in `browse_frames`, `browse_history`, `pages`,
`document_typography`, `standalone_appearance_loading`,
`react_shell_state_regressions`, and `react_shell_hydration_routes` are outside
this migration. They do not open raw artboards. New runtime checks do not extend
that exception.

## Rules for new tests

- Do not use design pages as content when a browser spec tests the served
  shell, an export, or a preview host. Put the check in a runtime spec with a
  non-design fixture. This separates runtime failures from mockup edits.
- Do not assert static mockup facts in browser specs. Put text, attribute,
  link-target, and authored-count checks in unit tests. A browser adds no
  evidence for those facts and repeats slower coverage.
- Do not look up removed design ids. The documented inventory guards removed
  screens. Old-id absence checks can pass even when they no longer address the
  current path-based catalogue.
- Do not bypass `designEntries` for catalogue-wide unit selections. Its empty
  selection failure prevents tests from passing without checking any entries.
- Use `tests/design_test_boundaries.test.ts` to reject the source forms listed
  below. Review new tests to enforce fixture choice, helper behavior, and the
  other rules. The scan cannot determine whether every assertion is static or
  every selection is catalogue-wide.

The boundary guard scans only `.ts` modules under `tests/browser/` with a pure
function. Inside `tests/browser/design/`, including `artboards.ts`, it rejects:

- Static imports whose paths contain `/export/` or `/server/`, or match
  `preview.*fixture`, `static_server`, or `runtime_fixture`.
- Calls named `exportCatalogue`, `buildPreview`, `servePreviewFixture`, or
  `startCatalogueServer`, or matching `start.*Server` or
  `create.*Preview.*Fixture`. Imported aliases of these names are also checked.
- Any `goto` argument that does not resolve to a call named `designArtboardUrl`
  or its imported alias, directly or through all assignments to a variable.
  String and template literal destinations are rejected, including relative
  paths that Playwright would resolve against its served base.

Outside that directory, the scan rejects named imports of `designArtboardUrl`
and imports from a path ending in `/design/artboards` with an optional module
extension. It rejects contiguous `generated/design` paths and `generated`
followed by `design` in joined, resolved, and template paths, including assigned
path pieces. It also rejects design paths passed to `pathToFileURL` and design
`file://` URLs. Served `/view/design/` routes, `data-route="design/…"` markers,
and `**/design/…` request patterns remain valid runtime content.

The scan does not follow other helper modules, wrapper imports, or dynamic
imports, and it does not scan `.tsx` files. Runtime work started through those
forms is left to review. Violating and accepted samples test the listed source
rules before all `.ts` modules in the browser tree are checked.

Move an assertion only after its replacement passes. Preserve the same fact,
including its viewport and scheme scope. Keep layout and native interaction
checks in the browser. Do not change mockups to make newly active tests pass
without first reporting a protocol failure.

## Running the layers

Build the package and generated example first:

```sh
npm run prepare:verification
```

Run unit mockup checks:

```sh
node --import tsx --test tests/design_*.test.ts tests/design_*.test.tsx tests/component_design_*.test.ts tests/brand_logo.test.tsx
```

Run all raw-artboard browser specs from their owning directory:

```sh
npx playwright test tests/browser/design --project chromium
```

Run selected runtime specs by file, or run the complete browser suite:

```sh
npx playwright test tests/browser/example_links.spec.ts --project chromium
npm run test:browser
```

Run `tests/browser_shard_balance.test.ts` after adding, removing, or moving a
spec. Every changed TypeScript file must stay at or below 300 lines.
Run `npm test` and `cargo xtask check` before the final commit and push.
After the push, use the
[implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. Report findings without changing the implementation.

## Delivery Status

The three test layers are delivered. Catalogue-wide unit selections reject
empty results. Static facts live in unit tests. Visibility, computed style, and
interaction checks remain on raw artboards. New runtime checks use non-design
fixtures. All raw-artboard specs use the shared helper in their owning directory.
The tested source scanner rejects the listed `.ts` forms. Review checks runtime
work started through other helper modules and the remaining test-layer rules.

The approved migration drops only two checks: the served shell's tab order
from its brand to a design link, and inspection three levels deep on a real
screen. Unit tests retain native link semantics. Runtime specs retain
two-level inspection. All other moved checks retain their assertions.
