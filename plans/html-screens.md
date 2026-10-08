# HTML Screens With YAML Front Matter

Status: Active. Created 2026-10-08 with the user's consent after the design
discussion in this workspace. No milestone is complete.

**Goal:** Let a screen be one `.mockup.html` file. The file starts with a YAML
front matter block that holds the screen's metadata, a `data` map, and
`variants`, followed by an HTML fragment that composes registered components as
custom elements. TSX screens stay unchanged. Both kinds share one catalogue,
one component registry, one renderer, Changes, links, and flows. Today every
screen needs a TypeScript module with imports, handler stubs, and one React
node per viewport, so a designer or an agent cannot add a state without the
build toolchain.

**Architecture:** An HTML screen is parsed in the CLI process without React
and converted to React elements inside the consumer bundle, so the bundled
React instance and the registered component facades are the ones every TSX
screen already uses. The steps are:

- Discovery adds `**/*.mockup.html` to the default root `files` globs. HTML
  files leave the bundled `entryModules` list and join a new `htmlScreenFiles`
  list, the protected source set, and the private source inventory, so source
  protection, the watch rebuild rules, and Changes evidence apply unchanged.
- `src/html_screens/` parses each file into a serializable `HtmlScreenSource`:
  the front matter through the `yaml` package with the YAML 1.2 core schema,
  and the body through parse5 `parseFragment` with source locations.
- The virtual consumer entry exports `createHtmlScreens(sources)` beside
  `definitions`. After the bundle is evaluated, the graph loader calls it with
  the parsed sources. Inside the bundle it maps element names to the
  registered facades found in the collected module exports, converts the tree
  to React elements, resolves `$name` data references, coerces scalar
  attributes through each component's prop schema, wraps `to` and `fragment`
  attributes in `MockLink asChild`, maps `mokly-ignore` to `ReviewIgnore`,
  drops elements by `mokly-viewport`, calls `defineScreen` with the metadata
  and variants, attributes the result to the HTML file, and collects it through
  `collectModuleExports` with a synthetic one-export namespace. Identity, slug,
  index, variants, moves, and diagnostics therefore follow the existing entry
  module rules.
- Everything after `defineScreen` is unchanged: registry preparation, render,
  `mock:` link rewrite, link-control tiers, usage records, manifest v9,
  Changes, export, and publish.
- Bundle bytes never depend on HTML content. Milestone 5 uses this to replay
  the retained bundle when only an HTML screen changed.

**Decisions locked by the design discussion (raise before implementing if the
user should reconsider):**

- HTML plus YAML front matter, not pure YAML. HTML carries prose, inline links,
  and nesting well; the front matter carries metadata and the data that
  attributes cannot. TSX remains for screens that need providers, hooks, or
  unregistered components, and both kinds live side by side in one root.
- A component opts into HTML use with an `element` field on `defineComponent`,
  for example `element: "ui-button"`. The name follows the custom element name
  grammar: lowercase, starts with a letter, contains a hyphen, no reserved
  names. It must be unique across the catalogue. There is no config prefix and
  no derived default; a component without `element` cannot be used from HTML.
- The front matter is YAML 1.2 core schema, parsed by the `yaml` package with
  duplicate keys rejected, no custom tags, and aliases allowed. The Markdown
  document front matter keeps its separate flat grammar in this plan.
- Front matter keys are the `ScreenInput` fields without `mobile`, `desktop`,
  and React values: `title`, `description`, `tags`, `path`, `movedFrom`,
  `rationale`, `relatedDocs`, `dependencies`, `address`, `useCasePaths`,
  `colorSchemes`, plus `data` and `variants`. `title` is required.
  `description` defaults to the empty string; `dependencies` and `relatedDocs`
  default to empty lists. An unknown key fails with the existing
  `unknown field <field>` text.
- On a component element, an attribute name is kebab-case and maps to the
  camelCase prop key. A scalar value is coerced through the prop schema:
  `string` takes the text; `boolean` accepts an empty value, `true`, or
  `false`; `number` accepts a JSON number; `null` accepts `null`; `enum`
  accepts the text equal to the string form of exactly one value; `union`
  takes the first member that accepts. A value that is exactly `$name`
  substitutes the `data` entry unchanged for any prop type, and `$$` escapes a
  literal leading dollar. Array and object props require a reference. A
  missing reference fails; an unused `data` entry is a build warning. Normal
  schema validation runs after substitution, so failures report the component
  and property path as today.
- `to`, `fragment`, `slot`, `mokly-instance`, and `mokly-viewport` are
  reserved attribute names on component elements. Registering an `element`
  fails when the schema declares `to`, `fragment`, `slot`, or `moklyViewport`;
  `moklyInstance` is already reserved by the component contract.
- Element children fill the `children` slot. A child with `slot="name"` fills
  that named slot. Content for a slot the component does not declare fails,
  because the output would silently drop it.
- One body renders both viewports. `mokly-viewport="mobile"` or `"desktop"`
  keeps an element in that viewport only. Adapters keep receiving the viewport
  through the existing render context.
- A front matter variant declares `slug` and `title` and may declare
  `description`, `tags`, `colorSchemes`, `address`, `rationale`,
  `relatedDocs`, `dependencies`, `useCasePaths`, `movedFrom`, and `data`. A
  variant `data` map replaces matching top-level keys and never deep merges.
  Inheritance follows the variant contract. The body is shared; a variant that
  needs another tree is a separate file.
- Links reuse the existing forms. `href="mock:<path>[#fragment]"` on an anchor
  is rewritten after render as today. `to` with an optional `fragment` on a
  component element, or on a raw `a`, `button`, `div`, or `span`, becomes a
  `MockLink asChild` wrapper, so the existing root, tier, and fragment rules
  apply unchanged.
- `<mokly-ignore id="…" material-key="…">` maps to `ReviewIgnore` and
  `<mokly-ignore-scope enabled="true|false">` maps to `ReviewIgnoreScope`.
- `script`, `html`, `head`, `body`, and `base` elements fail. A hyphenated
  element that matches no registered `element` fails, because rendering it as
  a plain element would silently lose the component. The user confirms this
  new build error before Milestone 3 starts; the alternative is a warning and
  a plain element.
- A raw HTML element becomes a React element. `class` maps to `className`,
  `for` to `htmlFor`, a `style` string to a style object through a tokenizer
  that respects quotes and parentheses, SVG and `xlink:` names through a fixed
  table, and boolean attributes to `true`. `value` and `checked` on form
  controls map to `defaultValue` and `defaultChecked`. No attribute ever
  becomes `dangerouslySetInnerHTML`.
- The HTML fragment algorithm moves a component element that sits directly
  inside a raw `table`, `thead`, `tbody`, `tfoot`, or `tr` out of the table.
  Mokly reports the `html-foster-parented` build warning when a component
  element's source range lies inside a table whose subtree does not contain
  it. Component elements belong inside `td`, `th`, or `caption`, or the table
  itself is a registered component.
- Errors are `build-invalid` failures with the codes `html-front-matter`,
  `html-element`, `html-attribute`, `html-data`, and `html-slot`, each with
  the repository-relative file, line, and column. Warnings use the build
  warning record with the new codes `html-unused-data` and
  `html-foster-parented`.
- `mokly-instance` maps to `moklyInstance` with the existing kebab-case rule
  and the slug default. The parse5 location of a component element feeds the
  existing `ComponentSourceLocation` on its instance record.
- Manifest v9, the comparison result, and the public read model do not change.
  `element` is not stored in the manifest. The viewer UI does not change, so
  this plan has no mockup milestone. HTML screens produce the existing screen
  route shapes, so hydration coverage needs no new shape.
- An HTML screen has no TypeScript types. The runtime prop schema validation
  is the type check.

**Non-goals:** a pure YAML screen format; HTML pages for `definePage`; loops,
conditionals, or expressions in the body; JSON inside attributes; migrating
the Markdown document front matter to YAML; viewer write-back of prop edits;
semantic Changes; converting existing TSX screens in the example or design
catalogue; a config-level element prefix.

**Spec:** `docs/protocol/mokly-html-screens.md`, created by Milestone 1, plus
the targeted updates listed there. The link becomes a Markdown link once the
file exists.

**Tech stack:** TypeScript ESM (Node 22 test runner via `tsx --test`, tests
import from `../dist`), React 19 static rendering, parse5 (already a
dependency) for the body, the `yaml` package (new dependency) for the front
matter, Playwright Chromium against `examples/basic`, Rust `xtask` gate.

## Global Constraints

- Run `cargo xtask check --suite repository` early and the complete
  `cargo xtask check` before declaring any implementation milestone complete.
- After checks pass at each milestone end: `git add -A`, commit with a
  Conventional Commits title of at most 50 characters, and push the branch.
  The final review milestone uses
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
  against `origin/main` after the push, then applies the review-fix rule in
  [`docs/dev/review.md`](../docs/dev/review.md).
- Protocol docs are updated in the same milestone as the behavior they
  describe. Documentation-only milestones validate Markdown with
  `npx prettier --check` on the changed files, the Markdown link and protocol
  history tests, and the protocol page length cap.
- Keep new modules near 200 lines and below 300. `load_graph.ts`,
  `consumer_entry.ts`, and `entry_discovery.ts` are near the cap; extract
  before extending them.
- Tests must not assert elapsed time. Watch and replay tests count operations
  and captured inputs.
- Unit tests use synthetic fixtures under `.context/` or the shared example
  compilation snapshot. Browser tests run against `examples/basic`.
- Add the failing test before fixing any regression discovered on the way.
- Do not delete or override anything on `origin/main` without explicit
  approval. This plan adds files and fields and removes nothing.
- Keep evidence under `.context/html-screens/` and name each evidence file
  under its milestone.

## Milestones

---

### Milestone 1: Protocol contract for HTML screens

Documentation only. At completion the contract defines the file format, the
front matter keys, the attribute and data rules, element registration, links,
markers, viewports, variants, diagnostics, discovery, watch classification,
and the guides, with no guesswork left for the later milestones.

#### Task 1.1: New HTML screen contract

**Files:**

- Create: `docs/protocol/mokly-html-screens.md` (at most 250 lines)
- Modify: `docs/protocol/README.md` (index entry beside Entry modules and
  Markdown documents)

**Steps:**

- [ ] Write Delivery Status, Purpose And Boundary, File Format (front matter
      block, body fragment, BOM and line endings), Front Matter (every key,
      defaults, `data` key grammar `^[A-Za-z][A-Za-z0-9_-]*$`, `variants`),
      Body (raw elements, attribute mapping table, style tokenizer rules,
      forbidden elements, table foster parenting), Component Elements
      (`element` grammar, name resolution, kebab-case to camelCase, scalar
      coercion per schema kind, `$name` and `$$`, reserved attributes, slots,
      `mokly-instance`, source locations), Links And Markers (`mock:` hrefs,
      `to` and `fragment`, `mokly-ignore`, `mokly-ignore-scope`), Viewports
      (`mokly-viewport`), Variants (fields, `data` replacement, inheritance),
      Rendering Pipeline (CLI parse, bundle conversion, `defineScreen`,
      synthetic export collection, unchanged downstream contracts), and
      Diagnostics (exact error and warning texts with file, line, column).
- [ ] Include one complete worked example file and the React tree it produces.
- [ ] Record that manifest v9, review v6, and the public read model are
      unchanged and that `element` is not stored.
- [ ] Run `npx prettier --check docs/protocol/mokly-html-screens.md docs/protocol/README.md`.

#### Task 1.2: Targeted updates to existing contracts

**Files:**

- Modify: `docs/protocol/mokly-authoring.md` (Entry Kinds: a screen may be an
  HTML file; `defineComponent` gains `element`)
- Modify: `docs/protocol/mokly-entry-modules.md` (an HTML screen file counts
  as a module with one default export; the slug rule reads its file name)
- Modify: `docs/protocol/mokly-configuration.md` and
  `docs/protocol/mokly-paths.md` (default `files` globs include
  `**/*.mockup.html`)
- Modify: `docs/protocol/mokly-root-discovery.md` and
  `docs/protocol/mokly-source-protection.md` (HTML screen files are protected
  authored sources and inventoried sources, never bundler inputs)
- Modify: `docs/protocol/mokly-components.md` (`element` field, grammar,
  uniqueness, reserved prop names, the registry diagnostic texts)
- Modify: `docs/protocol/mokly-variants.md` (front matter variants flatten
  through the same rule; `data` replacement)
- Modify: `docs/protocol/mokly-build-warnings.md` (`html-unused-data` and
  `html-foster-parented` in `BuildDiagnosticCode`, producers, exact lines)
- Modify: `docs/protocol/mokly-watch.md` (an HTML screen file is an
  inventoried source: create, change, rename, and delete rebuild; Milestone 5
  adds bundle replay)
- Modify: `docs/protocol/mokly-link-controls.md` (`to` and `fragment`
  attributes map to child mode)
- Modify: `docs/protocol/mokly-documents.md` (one sentence: the document
  front matter grammar is separate from HTML screen front matter)
- Modify: `docs/protocol/mokly-format-versions.md` (no version changes; state
  it)

**Steps:**

- [ ] Apply each update above and search `docs/protocol` for every statement
      of the default `files` globs and of "TypeScript or JavaScript file" that
      must now include HTML screen files.
- [ ] Check whether `docs/protocol/npm-release-notes.md` needs an entry. The
      `element` field and the new file kind are additive; record the decision
      in the commit body.
- [ ] Run `npx prettier --check` on every changed file.

#### Task 1.3: Guides and READMEs

**Files:**

- Create: `docs/guides/authoring/html-screens.md` with `section: "authoring"`
  and an unused `order` placed after `screens.md`; renumber later guides only
  if the contract requires contiguous order
- Modify: `docs/guides/authoring/screens.md` (link to the HTML form)
- Modify: `docs/guides/authoring/components.md` (`element`)
- Modify: `README.md` (Authoring section: the HTML form and its scope)
- Modify: `src/config/README.md` (default globs)

**Steps:**

- [ ] Write the guide from the worked example: metadata, data, a component
      element, a link, a variant, and the error a missing `element` produces.
- [ ] Apply the README changes.
- [ ] Run `npx prettier --check` on every changed file and
      `npm test -- tests/markdown_links.test.ts tests/protocol_doc_history.test.ts tests/guides*.test.ts`.
- [ ] Run `cargo xtask check --suite repository` for the protocol length cap.
- [ ] Commit (`docs: specify HTML screens with front matter`) and push.

---

### Milestone 2: Source parsing without React

Pure parsing modules with unit tests. Nothing is wired into discovery or the
build yet, so the product behaves exactly as before. At completion a
`.mockup.html` string becomes an `HtmlScreenSource` or an exact diagnostic.

#### Task 2.1: Dependency and module skeleton

**Files:**

- Modify: `package.json`, `package-lock.json` (`npm install yaml`)
- Create: `src/html_screens/README.md`, `src/html_screens/types.ts`

**Steps:**

- [ ] Add `yaml` as a runtime dependency and run
      `npm run dependencies:check` plus `cargo xtask check --suite repository`
      to confirm the audit baseline accepts it.
- [ ] Define `HtmlScreenSource`, `HtmlNode` (element, text, with
      `line`/`column`/`startOffset`/`endOffset`), `HtmlScreenMetadata`,
      `HtmlScreenVariant`, and the diagnostic record types.
- [ ] Write the README: purpose, module map, and the test command.

#### Task 2.2: Front matter

**Files:**

- Create: `src/html_screens/front_matter.ts`, `src/html_screens/metadata.ts`
- Create: `tests/html_screen_front_matter.test.ts`

**Steps:**

- [ ] Split the block with the same delimiter rule as documents, parse it with
      the YAML 1.2 core schema, reject duplicate keys and custom tags, and map
      a YAML error to `html-front-matter` with line and column.
- [ ] Validate keys and value shapes into `HtmlScreenMetadata`, `data`, and
      `variants` with the exact texts from the contract. Test every key,
      every default, the unknown-key text, `no` staying a string, aliases,
      and a missing `title`.

#### Task 2.3: Body fragment

**Files:**

- Create: `src/html_screens/fragment.ts`, `src/html_screens/attributes.ts`,
  `src/html_screens/style_attribute.ts`
- Create: `tests/html_screen_fragment.test.ts`,
  `tests/html_screen_attributes.test.ts`,
  `tests/html_screen_style_attribute.test.ts`

**Steps:**

- [ ] Parse the body with parse5 `parseFragment` and `sourceCodeLocationInfo`,
      convert to `HtmlNode` trees, decode entities once, and keep text
      verbatim.
- [ ] Fail `script`, `html`, `head`, `body`, and `base` with `html-element`.
- [ ] Implement the raw attribute mapping table and the boolean, `value`, and
      `checked` rules; keep the table as data and test it structurally
      against a fixture file under `tests/fixtures/`.
- [ ] Implement the style tokenizer: declarations split on `;` outside quotes
      and parentheses, property names to camelCase except custom properties,
      malformed declarations fail with `html-attribute` and the location.
- [ ] Detect foster-parented component elements by comparing source offsets
      with the enclosing table's subtree and emit the warning record.
- [ ] Test entities, nested tables, SVG attributes, `xlink:href`, malformed
      styles, and the forbidden elements.

#### Task 2.4: Checks, commit, push

**Steps:**

- [ ] Run `npm test -- tests/html_screen_*.test.ts`, then
      `cargo xtask check --suite repository`.
- [ ] Commit (`feat: parse HTML screen sources`) and push.

---

### Milestone 3: Element registration and bundle-side screens

HTML screens become real catalogue entries. At completion an HTML screen
builds, serves, exports, publishes, joins Changes, links to and from TSX
screens, and appears in use cases.

#### Task 3.1: `element` on `defineComponent`

**Files:**

- Modify: `src/components/types.ts`, `src/components/definition.ts`,
  `src/components/inputs.ts`, `src/authoring/fields.ts`
- Modify: `src/registry/prepare.ts` (uniqueness across the catalogue)
- Create: `tests/component_element.test.tsx`

**Steps:**

- [ ] Accept `element` in the input type and validation with the grammar
      from the contract, reject reserved prop names when `element` is set,
      and keep `element` off the manifest.
- [ ] Add the registry violation for two components with one `element`.
- [ ] Test the grammar, the reserved names, uniqueness, and that TSX usage
      is unchanged.

#### Task 3.2: Tree to React inside the bundle

**Files:**

- Create: `src/html_screens/react.tsx`, `src/html_screens/coercion.ts`,
  `src/html_screens/references.ts`, `src/html_screens/screens.ts`
- Modify: `src/build/consumer_entry.ts` (export `createHtmlScreens`)
- Create: `tests/html_screen_react.test.tsx`,
  `tests/html_screen_coercion.test.ts`

**Steps:**

- [ ] Build the element map from the collected module exports: each
      `COMPONENT_REGISTRATION` object whose first entry declares `element`.
- [ ] Convert nodes: raw elements to `createElement` with the mapped
      attributes, component elements to the registered facade with coerced
      props, `$name` substitution, `mokly-instance`, and `__moklySource` from
      the parse5 location; children and `slot` children to slots; `to` and
      `fragment` to `MockLink asChild`; `mokly-ignore` and
      `mokly-ignore-scope` to the markers; `mokly-viewport` filtering per
      viewport.
- [ ] Call `defineScreen` with the metadata, the two viewport trees, and the
      variants with replaced `data`; attribute the result to the HTML file and
      collect it through `collectModuleExports` with `{ default }`.
- [ ] Produce `html-data`, `html-slot`, `html-element`, and `html-attribute`
      failures and the `html-unused-data` warning with exact texts.
- [ ] Test every coercion kind, union order, the `$$` escape, unused and
      missing data, named and default slots, an undeclared slot, an unknown
      hyphenated element, both viewports, and instance ids.

#### Task 3.3: Discovery, graph, and watch wiring

**Files:**

- Modify: `src/config/roots.ts` (default globs),
  `src/config/entry_discovery.ts` (`htmlScreenFiles`, exclude from
  `entryModules`), `src/build/source_inventory.ts`,
  `src/build/load_graph.ts`, `src/build/consumer_bundle.ts`
- Modify: `src/build/README.md`, `src/config/README.md`,
  `src/registry/README.md`
- Create: `tests/html_screen_build.test.ts`,
  `tests/html_screen_changes.test.ts`, `tests/html_screen_watch.test.ts`

**Steps:**

- [ ] Parse HTML sources in the graph loader after discovery, call
      `createHtmlScreens` after `evaluateBundle`, and append the collected
      definitions before `prepareRegistry`.
- [ ] Add HTML screen files to the protected set and the source inventory so
      the existing watch classification rebuilds on create, change, rename,
      and delete; test the classification with captured events.
- [ ] Build a synthetic fixture under `.context/` with one registered
      component, one HTML screen with a variant, one TSX screen linking to it,
      and one use case stepping through both; prove build, check, serve
      bootstrap, export, Changes after an HTML edit, and a move with
      `movedFrom` in the front matter.
- [ ] Prove the duplicate-path diagnostic for a TSX and an HTML file that
      derive one path, and `index.mockup.html` as a folder page.
- [ ] Update the READMEs for the new module and the changed boundaries.

#### Task 3.4: Checks, commit, push

**Steps:**

- [ ] Run the new tests, then `cargo xtask check`.
- [ ] Commit (`feat: render HTML screens from the catalogue`) and push.

---

### Milestone 4: Example catalogue and packed consumer fixture

Prove the feature on consumer-shaped content. At completion the example
catalogue has one HTML screen built from its registered Action and Toolbar
components, and the packed-consumer smoke proves the published package renders
an HTML screen.

#### Task 4.1: Example catalogue

**Files:**

- Modify: `examples/basic/src/components/action/action.mokly.tsx`
  (`element: "example-action"`) and
  `examples/basic/src/components/toolbar/toolbar.mokly.tsx`
  (`element: "example-toolbar"`)
- Create: `examples/basic/specs/example/screens/inbox.mockup.html`
- Modify: `examples/basic/README.md`

**Steps:**

- [ ] Author the screen with front matter metadata, a `data` list consumed by
      a component, an `empty` variant that replaces that list, a
      `mock:` link back to Welcome, a `to` attribute on an Action, a
      `mokly-ignore` navigation region, and one `mokly-viewport` difference.
- [ ] Run `npm run build`, `npm run example:build`, and
      `npm run example:check`.
- [ ] Smoke-test through `npm run dev`: the screen, its variant, both
      viewports, both schemes, link navigation, and the component usage in
      the inspector. Save screenshots under `.context/html-screens/` and name
      them here.
- [ ] Update the example README.

#### Task 4.2: Browser coverage

**Files:**

- Create: `tests/browser/html_screen.spec.ts`

**Steps:**

- [ ] Assert the rendered route, the variant route, link navigation to and
      from the HTML screen, and the usage record in the inspector.
- [ ] Confirm the hydration coverage audit passes without a new shape.

#### Task 4.3: Packed consumer fixture

**Files:**

- Modify: `tests/fixtures/consumers/components/component.mockup.tsx`
  (`element: "packed-action"` on the registered component)
- Create: `tests/fixtures/consumers/components/statement.mockup.html`
- Modify: `scripts/package/components.mjs` (copy the HTML screen beside the
  entry file and check its route and usage record),
  `tests/fixtures/consumers/README.md`

**Steps:**

- [ ] Add the fixture screen and extend the `components` scenario checks to
      the new route, its variant, and its usage record in the `esm` and
      `themed` projects.
- [ ] Run `npm run package:smoke`.

#### Task 4.4: Checks, commit, push

**Steps:**

- [ ] Run `cargo xtask check`.
- [ ] Commit (`feat(example): add an HTML inbox screen`) and push.

---

### Milestone 5: Replay the retained bundle on HTML-only changes

The faster watch loop. At completion a change to an HTML screen file, with no
change to any bundled module, re-parses the HTML sources, replays the
retained bundle through `evaluateBundle`, and recompiles without esbuild.

#### Task 5.1: Replay path

**Files:**

- Modify: `src/build/load_graph.ts`, `src/build/consumer_bundle.ts`, the
  watch runtime modules that choose between bundle and replay
- Modify: `docs/protocol/mokly-watch.md`, `docs/protocol/mokly-watch-runtime.md`
- Create: `tests/html_screen_replay.test.ts`

**Steps:**

- [ ] Record how the watch runtime decides to re-bundle today and whether an
      existing replay path can be reused; save the notes under
      `.context/html-screens/replay-notes.md`.
- [ ] Classify an HTML-only change as a replay: reparse, replay, recompile,
      and publish the update version as a rebuild does.
- [ ] Test with a fake watcher and operation counts: one HTML edit produces
      zero bundle operations and one replay; one TSX edit still bundles.
- [ ] If the replay needs changes larger than this milestone, record the
      finding here, keep the Milestone 3 rebuild path, and ask the user before
      moving the work to a follow-up plan.

#### Task 5.2: Checks, commit, push

**Steps:**

- [ ] Run `cargo xtask check`.
- [ ] Commit (`perf(watch): replay the bundle for HTML edits`) and push.

---

### Milestone 6: Final verification and review

**Steps:**

- [ ] Re-read every changed protocol doc, guide, and README against the
      implementation and fix drift.
- [ ] Run the complete `cargo xtask check` and record the result under
      `.context/html-screens/final-check.md`.
- [ ] `git add -A`, commit, and push.
- [ ] After the push, review the complete local diff against `origin/main`
      with [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md),
      report the numbered findings, then apply the review-fix rule in
      [`docs/dev/review.md`](../docs/dev/review.md): fix the `Auto-fix: yes`
      findings, re-review once, and report the rest here as one line each.

## Post-merge follow-up (non-blocking)

- [ ] Decide whether the Markdown document front matter moves to the same YAML
      parser, in its own plan.
- [ ] Viewer write-back: save a local control edit into the HTML screen's
      attributes or `data`.
- [ ] Semantic Changes for HTML screens: report changed attributes and `data`
      keys beside the rendered comparison.
- [ ] Decide whether a pure `.mockup.yaml` form is still wanted once HTML
      screens are in use.
- [ ] Convert selected `examples/basic` design screens to HTML where every
      component they use is registered, with route-preservation approval.
