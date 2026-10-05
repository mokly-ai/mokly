# Hydration Route Shapes

Status: Active. Created 2026-10-05. On 2026-10-05 the user approved option C:
hydrate one route per entry shape instead of every example route, and add an
audit of generated resource references. No milestone has started.

## Outcome

The development hydration suite checks that React's first browser render of
the Browse shell matches the HTML that the server sent. Today
`tests/browser/react_shell_hydration_routes.spec.ts` hydrates every route of
the example catalogue: 210 entry routes, the home route and the missing route.
Each route runs the same shell code with different entry data, so most of
these tests repeat each other.

After this change, the spec hydrates one representative route for each entry
shape. An entry shape is the set of manifest properties that select different
shell rendering paths. A new mockup adds a test only when it adds a new shape.
The smaller sample no longer loads every mockup frame, so a new unit test checks
every local stylesheet, image and media reference in the generated example
output.

This is test, verification and documentation work. It does not change product
code, UI, mockups, the CI workflow or the other hydration specs.

Contract owners:

- [CI verification](../docs/protocol/ci-verification.md).
- [Development hydration coverage](../docs/protocol/ci-verification-hydration.md),
  which Milestone 1 creates.
- [Viewer SSR acceptance](../docs/protocol/mokly-viewer.md#ssr-hydration-and-host-independence).
- [CI suite evidence](../docs/protocol/ci-suite-evidence.md).
- [Local verification](../xtask/README.md).

## Evidence

These values were measured at `c4138a0`. `main` at `781da7a` changes no viewer
or example code.

- **CI time:** the route spec takes about 350 s per run. This is the sum of the
  per-test medians over five Node 22.14 runs. On `main` run
  [37305081457](https://github.com/mokly-ai/mokly/actions/runs/37305081457),
  the hydration job took 519 s and was the longest job. The next job was unit
  shard 1 at 485 s.
- **Code coverage:** one local run recorded Chrome block coverage of the
  development shell bundle for all 212 routes. The appendix gives the method.
  Together, the routes run 889 shell functions and 253,698 non-whitespace code
  characters. Every route runs 411 of these functions. A 32-route sample ran
  100% of both. That sample took one route for each combination of kind, base
  or variant, colour schemes, control kinds, slots, component instances,
  slotted instances, tags and related docs, plus the home and missing routes.
- **This rule:** the [shape rule](#shape-rule) refines the 32-route rule. It
  gives 51 shapes, so the spec registers 53 tests, which take an estimated 77 s
  in CI. Its sample contains every route of the 32-route sample, so it keeps
  100% of the measured code. The extra dimensions make new data features create
  new shapes. The 32-route rule ran the `rationale` text and the number-prop
  formatting code only because a selected entry happened to have that data.
- **Suite size:** the hydration suite drops from 263 to 104 tests: the 53 route
  tests plus the 51 tests in the other hydration specs.
- **Frames:** a probe confirmed that a failed resource load inside a
  `sandbox="allow-same-origin"` frame reaches the page console. Today's sweep
  therefore also fails on a missing mockup asset. The generated example output
  has 465 HTML files and 35 stylesheets. They contain 6,056 local stylesheet
  links, 2 image sources and 4 stylesheet `url()` references. None is missing.

## Shape Rule

Milestone 1 writes this rule into the new protocol doc, which then owns it.

For each entry `e` of `examples/basic/generated/mokly-manifest.json`, the shape
key is the JSON text of an object with these properties, in this order:

1. `kind`: `e.kind`.
2. `fields`: the sorted names of the own properties of `e` whose values are
   present and non-empty. A value is present and non-empty unless it is
   `undefined`, `null`, an empty string, an empty array or an object with no
   own properties. Numbers and booleans always count.
3. `colorSchemes`: the sorted distinct values of `e.colorSchemes`, or `[]`.
4. `controls`: the sorted distinct texts `<kind>(<keys>)`, one for each value
   of `e.controls`. `<keys>` is the comma-joined, sorted names of the control's
   present, non-empty properties other than `kind` and `label`.
5. `propSchema`: the sorted distinct `schema.kind` values of
   `e.propSchema.properties`, each with a `?` suffix when `optional` is true, or
   `[]`.
6. `values`: the sorted distinct wire tags of every value in `e.props` and in
   the `props` of every instance in `e.componentViews[].instances`, or `[]`. A
   wire tag is the first element of a wire value, such as `string` or `number`.
7. `instances`: whether any `e.componentViews[].instances` array is non-empty.
8. `slotted`: whether any of those instances has a `slotKey`.

The representative of a shape is its first entry in manifest order. Its route
is `entryRoute(e.path)`. The spec keeps its two shell tests: `/` and
`/view/not-in-catalogue.html`. The second test serves the 404 response as 200,
so that Chrome does not log an error for the document.

A change to this rule must keep the measured code coverage of the full route
list. Use the [appendix method](#appendix-coverage-comparison-method).

## Resource Reference Audit

Milestone 1 writes this audit into the new protocol doc.

- **Scope:** every `.html` and `.css` file under `examples/basic/generated/`.
- **HTML references:**
  - `link[href]` when `rel` contains `stylesheet`, `icon`, `preload` or
    `modulepreload`;
  - `src` on `img`, `source`, `video`, `audio`, `track`, `iframe`, `embed` and
    `input[type=image]`;
  - `srcset` on `img` and `source`, split at commas, using the first token of
    each candidate;
  - `poster` on `video` and `data` on `object`;
  - `href` and `xlink:href` on SVG `image` and `use`; and
  - `url()` and `@import` in `<style>` elements and `style` attributes.
- **Stylesheet references:** every `url()` and `@import` target.
- **Ignored values:** empty values, fragment-only values, values with a URL
  scheme such as `data:` or `https:`, and protocol-relative values.
- **Failures:**
  - a root-absolute value, because Serve and export deliver generated files
    under `/static/` and a file opened from disk has no site root;
  - a relative value that resolves outside `examples/basic/generated/`; and
  - a relative value that does not name an existing regular file after the
    audit removes its query and fragment and percent-decodes it.
- **Report:** each failure names the file, the attribute or rule, the value
  and the reason. The audit sorts the failures.

Anchor links are out of scope. The build and the design link tests already
check them.

## Approved Removals

The user approved these removals with option C on 2026-10-05. List them in the
pull request description.

- The route tests for entries that are not shape representatives: 159 of 210
  at `c4138a0`. Milestone 4 records the current number.
- The rule "one browser test per unique generated catalogue route" in
  `docs/protocol/ci-verification.md`, and the acceptance wording "every fixture
  route" in `docs/protocol/mokly-viewer.md`.
- The "every catalogue route" assertion in `tests/hydration_inventory.test.ts`.

**Residual risk:** a mismatch that only one entry's data causes is no longer
tested for entries outside the sample. An example is a title character that the
server and the browser handle differently. Block coverage cannot find this
kind of difference.

## Milestone 1: Define the contracts

Write the shape sample and the resource audit into the protocol docs, and
replace the per-route rule. Do not change tests in this milestone.

- [ ] Create `docs/protocol/ci-verification-hydration.md`, at most 250 lines,
      with the title `# Development Hydration Coverage`. Start its body with
      "Continuation of [CI Verification](./ci-verification.md).", as the other
      continuation pages do. It must define:
  - [ ] what development hydration checks, and why route data selects shell
        rendering paths;
  - [ ] the shape key, the representatives, their routes and the two shell
        tests, as the [shape rule](#shape-rule) gives them;
  - [ ] test registration: one test for each representative at discovery
        time, the title `development React hydrates fixture route <route>`, the
        normal deadline and error assertions, and a failure message that names
        the route and its shape key;
  - [ ] the inventory rule that Milestone 4 enforces;
  - [ ] the rule that a change to the shape key must keep the measured code
        coverage, with a short form of the appendix method;
  - [ ] the [resource reference audit](#resource-reference-audit); and
  - [ ] the boundary: hidden folders, moved and removed entries, static
        exports, the embedded viewer and early user input stay in their own
        hydration specs, which this change does not touch.
- [ ] In `docs/protocol/ci-verification.md`, replace the paragraph that starts
      "Development hydration registers one browser test per unique generated
      catalogue route" with a short paragraph that links the new doc. Keep the
      sentence about accepted console notices. Keep the file at or below 250
      lines.
- [ ] In `docs/protocol/mokly-viewer.md`, replace "hydration without
      mismatches on every fixture route" with wording for one fixture route per
      entry shape, and link the new doc. Keep the file at 453 lines, or set its
      exact new cap in `tests/protocol_doc_sizes.test.ts`.
- [ ] List the new doc under CI verification in `docs/protocol/README.md`.
- [ ] In `docs/protocol/ci-suite-evidence.md`, state that the shape contract
      defines development hydration route coverage. The rule that coverage is
      never relaxed then applies to the measured code coverage that the shape
      rule keeps.
- [ ] In `xtask/README.md`, replace "a separate browser test for every example
      route" with the per-shape rule.
- [ ] Run `npx prettier --check` on the changed Markdown, and run
      `node --import tsx --test tests/protocol_doc_sizes.test.ts tests/protocol_structure.test.ts`.
      The structure test requires the parent page to link the new page, a
      unique title, and no shared sentences between pages. Review the diff.

## Milestone 2: Add the shape helper

Add the pure shape functions and their tests. The route spec does not use them
yet.

- [ ] Add `tests/helpers/hydration_shapes.ts` with two pure functions.
      `hydrationShapeKey(entry)` returns the shape key text.
      `hydrationShapeSample(entries)` returns `{ entryPath, route, shape }` for
      each representative, in manifest order. Import the manifest entry type
      from `@mokly/viewer/data` as a type-only import, and import `entryRoute`
      from `packages/viewer/dist/data.js`, as the route spec does. Do no file or
      network access.
- [ ] Add `tests/hydration_shapes.test.ts`. Use synthetic entries to prove:
  - [ ] entries with the same shape share one representative, which is the
        first of them in manifest order;
  - [ ] changes to the `title`, `description`, `path` or `sourcePath` text do
        not change the shape;
  - [ ] each dimension changes the shape: the kind; a field that becomes
        non-empty, such as `rationale`; the colour schemes; a control kind; a
        control option name; a prop schema kind; the optional flag; a wire tag
        in `props`; a wire tag in an instance's `props`; instance presence; and
        a slotted instance;
  - [ ] an empty string, array or object counts as absent;
  - [ ] a variant (`variantOf`) and its base entry have different shapes; and
  - [ ] the same input always gives the same keys in the same order.
- [ ] Use Node 24.21.0 from `.node-version`, and run
      `npm run prepare:verification` once, because the helper imports built
      `dist` output. Then run
      `node --import tsx --test tests/hydration_shapes.test.ts`, ESLint on the
      changed files and `npm run typecheck`.

## Milestone 3: Audit generated resource references

Add the replacement check for mockup assets before the sweep gets smaller, so
that this protection never stops.

- [ ] Add `tests/helpers/generated_resource_references.ts`. It scans one
      directory and returns the sorted failures that the
      [audit](#resource-reference-audit) defines. Parse HTML with `parse5` and
      the helpers in `tests/helpers/html.ts`. Parse CSS with `postcss` and
      `postcss-value-parser`.
- [ ] Add `tests/generated_resource_references.test.ts`. Use temporary
      directories to prove each rule:
  - [ ] a missing stylesheet link, `srcset` candidate, `url()` target or
        `@import` target fails;
  - [ ] a root-absolute value fails, and a value that resolves outside the root
        fails;
  - [ ] an existing percent-encoded path, such as one with `%40scope`, passes;
  - [ ] a query or fragment does not change how a value resolves;
  - [ ] `data:`, `https:`, protocol-relative and fragment-only values are
        ignored; and
  - [ ] the audit checks `url()` in `<style>` elements and `style` attributes.
- [ ] Add `tests/example_resource_references.test.ts`. It scans
      `examples/basic/generated/` and expects no failures. It also requires that
      the scan read more than zero HTML files and stylesheet links.
- [ ] Prove that the check finds a real break. Delete one generated stylesheet
      that a mockup links, run the test, and confirm that the failure names the
      file. Then run `npm run example:build` to restore the output.
- [ ] Run the new tests, ESLint on the changed files and `npm run typecheck`.

## Milestone 4: Hydrate one route per shape

Change the route spec and its inventory test to use the shape sample.

- [ ] In `tests/browser/react_shell_hydration_routes.spec.ts`:
  - [ ] register one test for each item of
        `hydrationShapeSample(manifest.entries)`, and keep the title format;
  - [ ] pass `<route> (<shape>)` to `expectCleanHydration` as the failure
        context;
  - [ ] keep the home and missing-route tests unchanged; and
  - [ ] keep the guard that the manifest has more than 80 entries, and add a
        guard that the sample is not empty.
- [ ] In `tests/hydration_inventory.test.ts`, rename the test to "every
      hydration shape has exactly one independently timed test". Assert that
      the discovered fixture-route titles are the sample routes, each exactly
      once, and that each manifest entry's shape key has a representative in
      the sample.
- [ ] Run `node --import tsx --test tests/hydration_inventory.test.ts` and
      `npx playwright test --project=hydration tests/browser/react_shell_hydration_routes.spec.ts`.
- [ ] Prove that the sample still finds a mismatch:
  - [ ] in `packages/viewer/src`, add a temporary attribute to an element that
        only some shapes render, such as the saved-variants bar, and do not
        rebuild `dist`, so that only the client development bundle renders the
        attribute;
  - [ ] run the route spec, and confirm that each representative that renders
        the element fails with a hydration error that names its shape, and that
        the other tests pass; and
  - [ ] revert the change, and confirm that the diff does not contain it.
- [ ] Do the [coverage comparison](#appendix-coverage-comparison-method) again
      on the current catalogue. Record the route counts and the function and
      character totals in this plan. If the sample misses a function or a
      character, stop. Extend the shape key in the protocol doc first, then the
      helper and its tests, and measure again.
- [ ] Run `cargo xtask check --suite hydration`. Record the test count and the
      duration in this plan.

## Milestone 5: Verify and deliver

Run the complete gate, deliver the branch, and review it. Do not apply review
findings.

- [ ] Run `cargo xtask check` and require a 100% pass rate.
- [ ] Before the commit, inspect the diff and the deletions against
      `origin/main` with `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`. Confirm that the only
      removals are the [approved removals](#approved-removals).
- [ ] Run `git add -A` and commit the work with a Conventional Commit. Inspect
      `git diff --name-status origin/main..HEAD` again. Push the branch with
      every new file tracked. List the approved removals in the pull request
      description.
- [ ] After the push, use `docs/implementation-review-prompt.md` to review the
      complete diff against `origin/main`. Report numbered findings with a
      severity, the impact, lettered options and a recommendation. Do not
      change the implementation.

## Post-merge follow-up (non-blocking)

- Record the hydration job duration of the first `main` CI run after the merge.
  Compare it with the 519 s baseline.

## Appendix: Coverage Comparison Method

Write the measurement script outside the repository, for example under
`.context/`. Do not commit it.

1. Build the development bundle as `buildDevelopmentBundle()` does, and keep
   its text.
2. Start the shared Serve and wait for its first comparison, as
   `playwright.config.ts` and `tests/browser/setup.ts` do. Use Node 24.21.0
   from `.node-version`.
3. Use a new page for each route of the full list: the home route, the missing
   route and every unique `entryRoute`.
   1. Install the development bundle and open a CDP session.
   2. Call `Profiler.enable` and
      `Profiler.startPreciseCoverage({ callCount: true, detailed: true })`.
   3. Open the route with `waitUntil: "commit"`. Wait for
      `html[data-mokly-hydrated]` and two animation frames, then call
      `Profiler.takePreciseCoverage`.
   4. Wait for `load` and two more animation frames, then take the coverage
      again.
4. Keep only the script whose URL ends with `/__mokly/client/react-shell.js`.
   Use the `// <path>` comment that esbuild writes before each module to map
   offsets to modules. Keep the modules under `packages/viewer/src/`.
5. Count a function when its first range has a count above zero. Sort all
   ranges by start, longest first, and paint them in that order. Count a
   non-whitespace character when its painted count is above zero.
6. The sample passes when its union equals the union of the full list for both
   the functions and the characters.
