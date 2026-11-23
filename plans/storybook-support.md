# Storybook Support

Status: Active. On branch `calummoore/mokly-storybook-integration`, no pull
request yet. Each track runs in its own Conductor workspace in the "mokly
storybook" section and opens a pull request into this branch, as design
calls 1 and 25 say. Pull requests from this branch into `main` land at slice
boundaries. Each earlier one keeps this plan, and the last one deletes it, as
the `plans` skill says.

Mokly reads each `*.stories.*` file that a root matches as one component
entry. It composes the stories with `composeStories` from `@storybook/react`,
applies the preview file at `.storybook/preview.*` in the source root,
compiles the modules with its own esbuild setup, and renders static HTML in
Node. On 2026-11-03, a test of 13 common Storybook 10.6.2 patterns in four
small projects found that many of them fail the build or render wrong:
CSF Factories, a meta without complete args, `fn()` callbacks under
`--strict`, CSS that the preview file imports, theme globals, a `.storybook`
folder inside a package, loaders, `sb.mock()`, portals, and imported images.
The test matrix and a rerun script are in `.context/storybook/`.

This plan makes Mokly read and render the Storybook files that projects write
today. It keeps one failing story from stopping a build. It compiles with the
project's own Vite setup when the configuration asks for it. It connects
story components to the screens that render them and to the published
Storybook. The brainstorm ran from 2026-11-03 to 2026-11-06 in this
workspace, and its notes are in `.context/storybook/` and
`.context/bundler/`. Evidence goes under `.context/storybook-support/`, which
also holds the report of the options check.

Out of scope, from the decisions below: browser capture of stories,
decision 1; Storybook `staticDirs`, decision 6; composition with a framework
package and its preview annotations, decision 9; a Mokly copy of `sb.mock()`
for esbuild, decision 12; catalogue paths from Storybook titles, decision 14;
and webpack or Rspack adapters, decision 16.

Contract owners:

- [Mokly Sidecar](../docs/protocol/mokly-sidecar.md): bundling, errors, and
  the link to the Storybook rules.
- [Mokly Rendering](../docs/protocol/mokly-rendering.md): the stylesheet list
  of a story document.
- [Mokly Configuration](../docs/protocol/mokly-configuration.md) and
  [Root Discovery](../docs/protocol/mokly-root-discovery.md): the root
  `storybook` field, the `vite` field, and roots from `main.*`.
- [Imported CSS Configuration](../docs/protocol/mokly-configuration-imported-styles.md)
  and [Imported Stylesheet Assets](../docs/protocol/mokly-imported-styles-assets.md):
  stylesheet transforms and asset delivery.
- [Mokly Build Warnings](../docs/protocol/mokly-build-warnings.md): the new
  warnings.
- [Component Instance Identity](../docs/protocol/mokly-instances.md) and
  [Component Changes](../docs/protocol/mokly-component-changes.md): uses of
  story components.
- [Component Pages Design](../docs/protocol/mokly-component-design.md): the
  Storybook link and the failed story state.
- The [`@mokly/mokly` README](../packages/mokly/README.md) and the
  [architecture docs](../docs/architecture/rust-core.md).

Replaced ways:

- The fixed list of preview paths, `.storybook/preview.*` in the source
  root → the preview file in the Storybook folder of each root. The default
  folder stays `.storybook` in the source root. Consumers:
  `packages/mokly/src/sidecar/bundle-entry.ts`,
  `packages/mokly/src/sidecar/bundle-recipe.ts`,
  `crates/mokly-graph/src/render_inputs.rs`,
  `crates/mokly-render/src/render_environment.rs`, their tests, and
  `plans/follow-ups/fallback-keys-checkout-folder.md`. Moved in Milestone 19.
  Deleted in Milestone 19.
- The meta page, which renders the meta's args alone → the first story as
  the parent page. Consumers: `packages/mokly/src/sidecar/stories.ts`,
  `crates/mokly-sidecar/src/definitions.rs`, `tests/sidecar_methods.test.ts`,
  `tests/sidecar_storybook.test.ts`, and `docs/guides/authoring/storybook.md`.
  Moved in Milestone 6. Deleted in Milestone 6.
- The `dataurl` advice for assets that JavaScript imports → asset files that
  Mokly delivers. Consumers: `docs/guides/authoring/styles.md`, the `file`
  loader error in `packages/mokly/src/sidecar/plugins.ts`, and its row in
  `docs/protocol/mokly-imported-styles-errors.md`. Moved in Milestone 10.
  Deleted in Milestone 10.

## Decisions

The numbers are the item numbers of the brainstorm. The user answered each of
these decisions on 2026-11-06, with the recommended option. Findings 2, 10,
and 11 needed no decision, and Milestone 3 fixes them.

- **1. Story HTML: A.** Keep the server render and close the common gaps.
  Rejected: a DOM emulator, B; browser capture of failed stories, C; browser
  capture of every story, D. Reason: small, separate fixes remove most
  failures, and Mokly keeps its usage and CSS evidence.
- **3. The page of a stories file: B.** The first story in source order is
  the parent page, and the other stories are its variants. Rejected: a meta
  page with a fallback, A; a summary page, C. Reason: it removes the crash
  and the repeated base state, and it matches Storybook's docs page.
- **4. Preview CSS: B.** Story documents link the preview file's bundled
  CSS. Rejected: docs only, A; also `preview-head.html`, C. Reason: the
  preview file is the stories' version of the renderer.
- **5. A story that cannot render: C.** A `!mokly` tag skips a story, and a
  render failure becomes a warning with an error document in place of the
  story. `--strict` still fails. Rejected: tag only, A; leave the views out,
  B. Reason: reviewers see each failed story in place.
- **6. Imported images: B.** Mokly delivers imported assets as files and
  rewrites their URLs for each document. Rejected: `data:` URLs, A; also
  `staticDirs`, C. Reason: it reuses the asset pipeline of stylesheets.
- **7. Story args: B.** Mokly follows the composed story's argTypes, and it
  leaves React element args out without a warning. Rejected: functions only,
  A; slots, C. Reason: the Storybook template then passes `--strict`.
- **8. Theme globals: D.** A `mokly` parameter maps each color scheme and
  viewport to Storybook globals. Rejected: docs only, A; `addon-themes`
  detection, B; a map in `mokly.config.json`, C. Reason: Storybook merges
  parameters per story, as Chromatic's modes do.
- **9. The Storybook setup: C.** A root names its Storybook folder, and
  Mokly reads `main.*` there for its `stories` field and its framework.
  Rejected: `mokly init --storybook`, A; the folder field alone, B;
  composition with the framework package, D. Reason: an existing Storybook
  works with one root entry. Decision 20 below chose how the `stories` field
  reaches discovery.
- **12. Story setup: B.** Mokly awaits `story.load()`, runs `beforeAll` once,
  and warns about `sb.mock()` when the Vite adapter is off. Rejected: load
  only, A; a Mokly copy of `sb.mock()`, C. Reason: Storybook's own plugins
  give `sb.mock()` on the Vite adapter.
- **13. Usage of story components: C.** A screen's use of a stories meta's
  `component` records an instance of that stories entry. Rejected: no change,
  A; a `fromStories` helper, B. Reason: projects get usage evidence with no
  change to their screens. Decision 19 below chose how uses get names, and
  decision 21 below chose how Changes keeps their content.
- **14. The catalogue and the Storybook sidebar: A.** Storybook story names,
  custom tags, the docs description, and the `dev` tag filter. Paths stay
  file-derived. Rejected: title paths, B; auto titles, C. Reason: no path
  changes.
- **15. Links to Storybook: A.** An optional Storybook URL gives each story
  page a link to its story. Rejected: an "Open in Mokly" addon, B; Changes in
  Storybook's sidebar, C. Reason: small and useful for every team.
- **16. The compiler: C.** An optional Vite adapter compiles JavaScript and
  transforms stylesheets through the project's Vite setup. esbuild stays the
  default. Rejected: esbuild plugins, A; JavaScript only, B; Vite for every
  project, D; webpack and Rspack too, E. Reason: Vite is Storybook's default
  builder, and C removes both the JavaScript and the CSS copies. Decision 22
  below settles a missing Vite.
- **17. The Vite setup: E.** With a Storybook folder, Mokly loads
  Storybook's merged Vite setup for every JavaScript entry. An optional
  `mokly.vite.config.ts` can change that setup. Rejected: the app config only,
  A; a file that the project writes, B; two setups, C; D without the
  optional file. Reason: stories match Storybook, and each module loads once.
  Decision 18 below settles several Storybook folders.

The options check of 2026-11-06 rewrote the root questions of decisions 18
and 19, added options E and F to each, and raised decisions 20, 21, and 22.

### 18. Several Storybook folders share one Vite setup

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design, with options E and F from the options check.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:**
  - Decision 9 lets each root name its own Storybook folder.
  - Decision 17 loads one Vite setup for the whole catalogue, so that each
    module loads once.
  - Storybook roots its Vite setup at the parent of its folder. Two folders
    therefore differ in root, `vite.config.*`, aliases, plugins, and mocks.
  - The core sends one `bundle` request for each side, with the files of
    every root.
- **Problem:** When roots name different Storybook folders and the Vite
  adapter is on, no rule says which setup compiles which file.
- **Impact if no action:** The adapter cannot compile such a catalogue, or it
  compiles one folder's stories with another folder's setup by accident.
- **Root question:** How does the Vite adapter compile a catalogue whose roots
  name different Storybook folders, so that each folder's stories compile as
  in their own Storybook, and a module that two folders use keeps one
  identity?
- **Options:**
  - **A.** Allow one Storybook folder in each configuration file when the
    Vite adapter is on. A second folder fails the configuration check, so a
    monorepo with two Storybooks uses two Mokly configurations. Effort:
    Small.
  - **B.** Load the setup of the folder that a `vite.storybook` field names.
    Without that field, load the folder of the first root that names one,
    and warn about each other folder. The warning names `vite.storybook` and
    the optional file. The optional file wins over the field. Stories of the
    other folders compile with a setup that is not their own, and a
    per-package alias can then fail the whole bundle. Effort: Small.
  - **C.** Load one setup for each Storybook folder. A root without a folder
    uses the first folder's setup. A module that two folders' roots import
    loads once in each setup, so it has two identities, and a registered
    component from another folder's root fails as unexported. Effort: Large.
  - **D.** Merge the setups of all folders into one. Plugins with the same
    name load once, and aliases and conditions merge. A conflicting setting
    gives a warning. One alias key keeps one target, so per-package aliases
    still fail. Effort: Medium.
  - **E.** Compile each file with the setup of the Storybook folder whose
    parent directory holds it, the deepest one when two do. One module runner
    runs every file once, through a transport that asks the owning Vite
    server. Each package keeps its own aliases, plugins, and mocks, and each
    module keeps one identity. Vite documents no runner that several servers
    feed, so this needs a spike. Effort: Large.
  - **F.** Require the optional `mokly.vite.config.ts` when the adapter is on
    and roots name two or more folders. The file picks or merges the setups
    with `storybook(folder)`. Without the file, the configuration check
    fails and names the file. Effort: Small.
- **Left out:** Fall back to esbuild for the whole catalogue with a warning:
  B is better on every point, because it keeps one folder's setup.
- **Wider fix:** E. It serves any number of folders, each with its own setup,
  in one module graph.
- **Previous examples:** None found.
- **Related:** Decision 17 sets one setup for each catalogue. Design calls 18
  and 22 cover a catalogue with one Storybook folder. Milestone 30 waits for
  this answer.
- **Recommendation:** B. A project can name the setup, the default needs no
  extra configuration, and the warning names the two ways to fix a mismatch.
  E best serves monorepos with several Storybooks, at a Large cost and a
  spike.
- **Action:** ask the user, because A and F add a configuration error, B adds
  a warning that fails `--strict`, and E needs a spike.
- **Answer:** E, chosen by the user on 2026-11-19, with a spike first in its
  own workspace. Milestone 37 runs the spike. When the spike shows that E
  cannot work, this decision goes back to the user with the evidence.

### 19. Ids of story component uses

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design, with options E and F from the options check, and G to
  M from the user's messages of 2026-11-19.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-instances.md:28-41`,
  `docs/protocol/mokly-instances.md:66-86`.
- **Background:**
  - Two instances with the same id in one place of a page fail the build.
    Without an explicit name, the id is the last part of the component's path.
  - The instance rules keep an id when uses move, when props change, and when
    source lines move. They also record a decision: never repair a collision
    with a positional suffix, because that breaks stability under reordering.
  - Changes pairs each use in the base commit with the use that has the same
    id in the branch, and then compares the props of the two uses.
  - Decision 13 records a use whenever a story component, such as `Button`,
    renders under a Mokly page: in stories files, in Mokly screens, and in
    product components.
  - React reserves `key` and never passes it on. `moklyInstance` is an
    ordinary prop outside Mokly's own wrappers, so on a product component it
    fails TypeScript and can reach the product's markup.
  - On 2026-11-19 the user said that authors, most often AI agents, should
    normally add the names themselves.
- **Problem:** Repeated uses of a story component get the same default id,
  which the build rejects, unless an author names each one.
- **Impact if no action:** Decision 13 fails the build for most screens that
  render a story component twice.
- **Root question:** How does each use of a story component get a stable
  name, when authors, often AI agents, name most uses themselves? The first
  version asked for no edit to screens or product components. The user's
  message of 2026-11-19 dropped that.
- **Options:**
  - **A.** Require a name. Repeated uses without one fail the build. Effort:
    Small.
  - **B.** Number repeated uses in render order, such as `button-2`. A
    `moklyInstance` prop or a `key` wins. An insertion shifts the numbers, so
    Changes can pair the wrong uses. Effort: Medium.
  - **C.** Derive the name from the source line. A loop still needs numbers,
    and an edit above a use changes its name. Effort: Medium.
  - **D.** Record the uses without names. The "Used by" list works, but
    nobody can compare one use. Effort: Medium.
  - **E.** Derive the name from all props and text. Every props edit then
    looks like a removed use and an added use. Effort: Large.
  - **F.** Do B, and let Changes match numbered uses by their props. Effort:
    Large.
  - **G.** Do B, and warn about every numbered use. Effort: Medium.
  - **H.** Do B, and show a caution in Changes where a wrong pair is possible.
    Effort: Large.
  - **I.** Do B, and add a notice that `--strict` does not count. Effort:
    Medium.
  - **J.** Do B, and warn only about numbered uses in catalogue files. Effort:
    Medium.
  - **K.** Take the name from the first naming prop, in the order `key`, `id`,
    `name`, `data-testid`, `aria-label`, and let a configuration field change
    that list. The id is the component's path segment plus the value, such as
    `button-save`. Fall back to the numbers of B and the warning of J.
    Effort: Medium.
  - **L.** Do K, with an explicit name as the expected path. The warning
    covers every numbered use, also in product components, and tells the
    author which prop to add: a `key` on a product component, or
    `moklyInstance` on a Mokly wrapper. The guide states this rule, so an
    agent can follow it. Mokly's strict CI then fails when a product change
    adds a repeated use without a name, until someone adds the key. Effort:
    Medium.
  - **M.** Do L, but use `moklyInstance` everywhere, with a TypeScript
    declaration that lets every JSX element take it. The prop still reaches
    product components in the product's own builds. Effort: Medium.
- **Left out:** Record only the uses that catalogue files write: a screen that
  renders a product page would record none of the uses inside that page.
- **Wider fix:** L. Every use ends up with a stable name, and the warning keeps
  it that way.
- **Previous examples:** Testing Library finds elements by `data-testid` and
  accessible names, because those names stay stable when the layout changes.
  React keys repeated children by position when no `key` is given, and the
  instance rules reject that for Mokly.
- **Related:** Decisions 13 and 21. With L, decision 21 needs option A, so
  that content passed into a component stays visible in Changes.
- **Recommendation:** L. It makes an explicit name the normal path, the
  warning tells the author or the agent exactly what to add, and a `key` never
  reaches the product's markup.
- **Action:** ask the user, because every option except A and D changes the
  instance rules, and L lets Mokly's CI fail on product code.
- **Answer:** L, chosen by the user on 2026-11-19. It reverses the recorded
  decision against positional suffixes for the fallback only, and it changes
  the stability rule for naming props. Milestone 34 states both changes.

### 20. Roots from the `stories` field of `main.*`

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Review, from the options check.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-configuration.md:12-13`,
  `docs/protocol/mokly-root-discovery.md:70-71`.
- **Background:**
  - Decision 9 turns the `stories` entries of `main.*` into roots.
  - The core reads the configuration without Node, and it classifies every
    file before JavaScript reaches the sidecar.
  - The base side discovers its files from the Git tree of the base commit.
  - `main.*` is a TypeScript or JavaScript module, and its `stories` field
    can be a computed value.
  - The Rust core already parses JavaScript with `oxc_parser` in
    `crates/mokly-static`.
- **Problem:** Running `main.*` to read `stories` needs Node before
  discovery, on both sides, which the requirements in force rule out.
- **Impact if no action:** The roots of decision 9 cannot come from `main.*`.
- **Root question:** How does Mokly learn which files a Storybook folder's
  `stories` field selects, on both sides of a comparison?
- **Options:**
  - **A.** Keep `dir` required. `main.*` supplies only the framework and auto
    titles, and users keep the globs in two places. Effort: Small.
  - **B.** Parse `main.*` without running it, in the core. Literal `stories`
    entries, strings and `{ directory, files }` objects, become roots. A
    computed value fails the configuration check with a message to set `dir`
    and `files`. The base side parses its own `main.*` from Git. Effort:
    Medium.
  - **C.** Run `main.*` in a sidecar before discovery, on each side, with
    Storybook's loader. The base side must extract and install before
    discovery, and the configuration is no longer Node-free. Effort: Large.
  - **D.** Do A, and add `mokly init --storybook`, which writes the roots of
    `main.*` into `mokly.config.json` once. Effort: Medium.
- **Left out:** Read `stories` at bundle time and add its files after
  discovery: those files would skip classification and source protection.
- **Wider fix:** C. It reads every form of `stories`.
- **Previous examples:** None found.
- **Related:** Decision 9. Milestone 20 waits for this answer.
- **Recommendation:** B. Most `main.*` files list literal entries, and B
  keeps configuration and discovery free of Node on both sides. C also reads
  computed entries, at the cost of Node and a base install before discovery.
- **Action:** ask the user, because B adds a configuration error, and C
  changes the requirement that the core reads the configuration without Node.
- **Answer:** C, chosen by the user on 2026-11-20, for roots that opt in. The
  Node step runs only for a root that names a Storybook folder and has no
  `dir`. A root with an explicit `dir` and every catalogue without such a
  root keep configuration and discovery without Node. Reason: the user wants
  full Storybook support, and the cost then falls only on projects that ask
  for it. A Storybook project already needs Node and a base install to render
  its stories, so C adds about one Node start for each side and moves the
  base install before discovery.

### 21. Content inside a story component use

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Review, from the options check.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-component-changes.md:101-118`.
- **Background:** Changes compares a use of a registered component by its id,
  its path, and its props digest, not by its rendered content. The caller's
  content stays in the caller's comparison only through declared slots. A
  story component is a plain product component: its `children` and other
  React node props are not declared slots, and its props often hold
  functions.
- **Problem:** Under decision 13, the content that a screen passes into a
  story component has no slot, so an edit of it can drop out of the screen's
  comparison.
- **Impact if no action:** A screen edit inside a story component's children
  can be missing from Changes.
- **Root question:** How does Changes keep the content that a screen passes
  into a story component?
- **Options:**
  - **A.** Treat `children` and each prop whose value is a React node as an
    implicit slot of the use. Leave function props out of the use's props
    digest. Effort: Medium.
  - **B.** Use story component uses for usage lists only. The component page
    lists the screens, and Changes keeps each consuming screen as a direct
    change, as today. Effort: Small.
  - **C.** Give a use an instance region only when it has no React node
    content. A use with content stays in the screen's own comparison.
    Effort: Medium.
- **Left out:** Declare slots for each story component in its meta: Storybook
  files then need edits that only Mokly reads, and A covers the same content.
- **Wider fix:** A. Every input that a screen gives stays visible.
- **Previous examples:** None found.
- **Related:** Decisions 13 and 19. Decision 19 chose L, so each use has a
  region of its own, and its content needs option A to stay visible.
  Milestone 34 waits for this answer.
- **Recommendation:** A, changed from B on 2026-11-19, because decision 19
  chose L. Each use then has its own region, so without A a text edit inside
  a story component would drop out of Changes.
- **Action:** ask the user, because A adds a rule to the Changes contract.
- **Answer:** A, chosen by the user on 2026-11-19.

### 22. The Vite adapter without Vite

- **Severity:** Low. **Effort:** Small.
- **Source:** Review, from the options check.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:** Decision 16 adds an opt-in Vite adapter that uses the
  project's own Vite. Today a project with stories but no `@storybook/react`
  fails `bundle` with `bundle-failed`.
- **Problem:** No rule says what happens when the configuration turns on the
  adapter and the project cannot load Vite.
- **Impact if no action:** A common setup mistake has no defined result.
- **Root question:** What happens when the configuration turns on the Vite
  adapter and the project cannot load Vite?
- **Options:**
  - **A.** Fail `bundle` with `bundle-failed` that names `vite`, as for a
    missing `@storybook/react`. Effort: Small.
  - **B.** Warn, and compile with esbuild. The output can then differ from
    the project's build. Effort: Small.
- **Left out:** Ship Vite with Mokly as a fallback: decision 16 chose the
  project's own Vite over Vite for every project. Only two approaches are
  real, because the adapter either runs or does not.
- **Wider fix:** None, because this is one missing input.
- **Previous examples:** The missing `@storybook/react` rule in
  `docs/protocol/mokly-sidecar.md`.
- **Recommendation:** A. The project asked for its own build setup, so
  esbuild output without a clear failure would mislead.
- **Action:** ask the user, because A adds a new case of a build error.
- **Answer:** A, chosen by the user on 2026-11-19.

## Design calls

These calls are mine, made on 2026-11-06 unless a call gives another date.

1. Changed on 2026-11-18. The work runs as nine tracks, each in its own
   Conductor workspace, and each track opens a pull request into this branch.
   After its review, the orchestrator merges it and runs the complete gate.
   A pull request from this branch into `main` lands at each slice boundary:
   after tracks A to D, after tracks E to G, and after tracks H and I.
   Reason: each track works alone, reviews stay small, and value reaches
   `main` early. The first version, five stacked pull requests into `main`,
   gave no parallel work.
2. One story reader reads Storybook's composed result: args, argTypes,
   parameters, and tags. It composes from a copy of the meta. Reason:
   Storybook changes the annotation objects that it receives.
3. A stories file with no included story gives no entry. Reason: Storybook
   shows none either, and a warning would fail `--strict`.
4. An arg whose value is a React element, or an array of them, stays out of
   the props without a warning. Reason: Storybook renders such args but
   cannot edit them.
5. A custom Storybook tag becomes a Mokly tag when it matches Mokly's tag
   grammar. Storybook's built-in tags and negated tags do not. Reason:
   Storybook tags have no grammar, and a warning would fail `--strict` for
   normal files.
6. A story without a `name` gets Storybook's `storyNameFromExport` name.
   Reason: the catalogue then shows the sidebar's names.
7. `parameters.docs.description.component` becomes the entry description.
   Story descriptions are not shown. Reason: variants have no description.
8. A story is included when its combined tags keep `dev` and Mokly's own
   default tag, `mokly`. `!dev` or `!mokly` removes it. Reason: this is
   Storybook's own tag rule.
9. A failed story view gives the `story-render-failed` warning with the
   story, the view, the reason, and the `!mokly` hint. Reason: one code
   covers every failed view.
10. The preview file's `beforeAll` runs once for each bundle generation, and
    its cleanup runs when the generation is released. Reason: this matches
    Storybook's test runners.
11. The `mokly` parameter has the fields `colorSchemes` and `viewports`. Each
    maps a name to globals. Viewport globals apply first, then scheme
    globals, and `moklyColorScheme` and `moklyViewport` stay. Reason: one
    view combines one viewport and one scheme.
12. The root `storybook` field is a folder path, or an object with `config`,
    the folder, and `url`, the published Storybook. A root without the field
    uses `.storybook` in the source root, as today. Decision 20 settles a
    root without `dir`. Reason: current catalogues keep their preview file.
13. Mokly loads `main.*` and Storybook's presets in the sidecar with
    Storybook's loaders from `storybook/internal/common`, and its CI tests a
    supported Storybook range. It adds no version check. A loader failure
    gives the existing `bundle-failed` with the installed version and the
    tested range in its message. Reason: Storybook's own loaders read every
    form of `main.*`, and a version check would add a new error.
14. `@storybook/react` resolves from the configuration directory first, then
    through the framework package that `main.*` names. Reason: projects
    install only the framework package.
15. A story document links the preview file's bundled CSS directly after the
    renderer's CSS. Reason: stories already get the renderer's CSS, and
    removing it would change existing catalogues.
16. Mokly delivers the asset types that Vite knows, such as images, fonts,
    and media, as files by default. `moduleResolution.loaders` still wins.
    Reason: these are the imports that Vite and Storybook turn into URLs.
17. A top-level `vite` field turns the adapter on. Its optional `config`
    names the optional `mokly.vite.config.ts`. Reason: the adapter is opt-in,
    and current catalogues keep esbuild.
18. For a catalogue with one Storybook folder, each sidecar process runs one
    Vite server for its source root, with Vite's own watcher off. Mokly's
    watcher invalidates changed modules. With several folders, decision 18
    chose E: one Vite server for each folder, which feed one module runner.
    Reason: a sidecar process serves one source root.
19. Mokly resolves `vite` from the project. A missing `vite` fails `bundle`
    with `bundle-failed`, as decision 22 chose. Reason: Mokly ships no
    private runtime.
20. Under the adapter, Mokly removes Storybook's browser-only plugins, such
    as its entry, docgen, globals, and stats plugins, with the public
    `withoutVitePlugins` helper. Reason: a render does not need them.
21. Under the adapter, Mokly requests each local stylesheet through the Vite
    setup as an inline module. Reason: plugins such as Tailwind's then run.
22. The optional file exports `defineMoklyVite` from `@mokly/mokly/vite`. Its
    `app()` and `storybook()` loaders run only when called. For one
    Storybook folder it returns one setup. With several folders, the spike
    of decision 18 settles its shape. Reason: a project can avoid a broken
    Storybook release.
23. A static scan of the preview file finds `sb.mock()` calls for the
    `storybook-mock-without-vite` warning. Reason: the preview file does not
    run before the bundle.
24. Under the adapter, Mokly installs a Node version of the mocker global that
    Storybook's automocks and spies call, from `@vitest/mocker`. Reason:
    only Storybook's browser runtime sets it, and Mokly renders in Node. If
    this fails, `__mocks__` redirects still work, and the limit becomes a
    decision.
25. Made on 2026-11-18. Each track starts with its own documentation
    milestone, so that each workspace states its requirements before its
    code. The user reviews the docs, the decisions, and the review findings
    of a track in its workspace. The mockup milestone stays Milestone 1 and
    blocks only the tracks with UI work, F and G. Reason: on 2026-11-18 the
    user asked for a separate workspace for each part that can run in
    isolation, and said that they review each finding there. One
    documentation milestone for every track would let only the mockups
    start.

## Tracks

Each track runs in its own workspace, as design calls 1 and 25 say. A track
starts when each milestone on the `Depends on:` lines of its first milestones
has merged into this branch, and when the open decisions that block it have
answers. The ledger of the workspaces is in
`.context/storybook-support/workspaces.md`.

| Track                      | Milestones | Starts after          |
| -------------------------- | ---------- | --------------------- |
| A. Mockups                 | 1          | Nothing               |
| B. Story reading           | 2 to 8     | Nothing               |
| C. Imported assets         | 9 to 12    | Nothing               |
| D. Vite adapter            | 13 to 17   | Nothing               |
| E. Storybook folders       | 18 to 22   | Track B               |
| F. Failed stories          | 23 to 25   | Tracks A and B        |
| G. Storybook links         | 26 to 29   | Tracks A and E        |
| H. Storybook setup on Vite | 30 to 33   | Tracks C, D, E, and J |
| I. Story component usage   | 34 to 36   | Tracks B and D        |
| J. Spike for decision 18   | 37         | Nothing               |

The last milestone of each track runs the targeted tests and the complete
gate, commits, pushes, and runs the `implementation-review` skill against
this branch. The track's workspace gives the findings and the decisions to
the user in its own session, applies the fix rule, and opens a pull request
into this branch. The orchestrator merges it.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Track A. Two product areas change. A story that cannot render shows an error
document in its preview, on its component page and in Changes. The
component page of a stories entry links to the same story in a published
Storybook.

- [ ] Add the state of a story that could not render to the component design
      pages under `examples/basic/specs/design/components/states`, desktop
      and mobile, as a child page when the states page would pass five
      mockups. The error document names the story, says that it could not
      render, gives the reason in a secondary place, and gives the `!mokly`
      tag as the way to leave the story out. Add its row to
      `docs/protocol/mokly-component-design-inventory.md`.
- [ ] Add the Storybook link to the component page of a stories entry,
      desktop and mobile, beside the entry's source details. Add its row to
      the design inventory.
- [ ] Follow the copy rules and the forbidden patterns of the `product-ui`
      skill.
- [ ] Run the mockup check named in `AGENTS.md`. Smoke-test the changed
      pages through `npm run dev`.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 2: Story reading documentation

Depends on: none

Track B. The protocol states the reading rules of decisions 3, 7, 8, 12, and
14, and of findings 2, 10, and 11.

- [ ] Move the Storybook section of `docs/protocol/mokly-sidecar.md` to a new
      page, `docs/protocol/mokly-storybook.md`, and link it from the sidecar
      page and `docs/protocol/README.md`.
- [ ] Write there the rules for CSF 2, CSF 3, and CSF Factories files; the
      first story as the parent; args and their classification; names, tags,
      and the description; the `dev` and `!mokly` filters; `story.load()`
      and `beforeAll`; and the `mokly` parameter. Add the status line that
      `AGENTS.md` asks for.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 3: Story reader

Depends on: 2

One reader turns CSF 2, CSF 3, and CSF Factories files into one shape, as
design call 2 says. It fixes findings 2, 10, and 11.

- [ ] Add the reader beside `packages/mokly/src/sidecar/stories.ts`. It
      composes from a copy of the meta, passes a module without a default
      export to `composeStories` unchanged, and takes a factory's meta and
      preview from its stories.
- [ ] Move `describeStories` onto the reader. The title fallback then never
      reads "ComposedStory", which fixes finding 10.
- [ ] Take each variant's control hints from its composed argTypes, which
      fixes finding 11.
- [ ] Add a factories fixture, an untitled file, and a variant that does not
      set an arg with options to `tests/sidecar_storybook.test.ts`.
- [ ] Update `docs/guides/authoring/storybook.md` for CSF Factories.

## Milestone 4: Story args, names, tags, and descriptions

Depends on: 3

Stories keep Storybook's names, tags, and description, and the standard
Storybook files pass `--strict`. Decisions 7 and 14, and the `!mokly` tag of
decision 5.

- [ ] Leave out of the props, without a warning, each arg that the composed
      argTypes type as a function, and each React element arg, as design
      call 4 says.
- [ ] Name each story as design call 6 says.
- [ ] Map tags as design call 5 says, and the description as design call 7
      says.
- [ ] Include stories as design call 8 says.
- [ ] Test that Storybook's Button template passes `--strict`, and test the
      names, the tags, the description, and the skipped stories.
- [ ] Update `docs/guides/authoring/storybook.md`.

## Milestone 5: Story setup before render

Depends on: 3

Loaders and `beforeEach` run before each story render, as decision 12 says.

- [ ] Await `story.load()` before each story render, and run its cleanups as
      Storybook does.
- [ ] Run `beforeAll` as design call 10 says.
- [ ] Test that a loader story and a `beforeEach` story render their prepared
      data.
- [ ] Update `docs/guides/authoring/storybook.md`.

## Milestone 6: The first story as the parent page

Depends on: 4

The first included story becomes the parent page, as decision 3 says.

- [ ] Render the first included story in source order as the parent page,
      with its composed args as the parent's props.
- [ ] Make the other included stories the parent's variants.
- [ ] Give a file without an included story no entry, as design call 3 says.
- [ ] Delete the meta-only composition and move each consumer that "Replaced
      ways" lists.
- [ ] Test that a meta without args builds, and that no base state repeats.
- [ ] Update `docs/guides/authoring/storybook.md`.

## Milestone 7: Globals from the `mokly` parameter

Depends on: 3

Existing theme decorators follow Mokly's views, as decision 8 says.

- [ ] Set the globals of the `mokly` parameter for each view before render,
      as design call 11 says.
- [ ] Test that a theme decorator that reads a `theme` global renders the
      dark theme in dark views when the parameter maps it.
- [ ] Update `docs/guides/authoring/storybook.md`.

## Milestone 8: Story reading verification, review, and pull request

Depends on: 2, 3, 4, 5, 6, 7

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Rerun `.context/storybook/reproduce.sh` from the primary workspace and
      save the result under `.context/storybook-support/`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 9: Imported assets documentation

Depends on: none

Track C. The protocol states the asset rules of decision 6.

- [ ] Add the delivery of imported assets to
      `docs/protocol/mokly-imported-styles-assets.md`, or to a new linked
      page when that page would pass 250 lines. Add the status line.
- [ ] Update the `file` loader row of
      `docs/protocol/mokly-imported-styles-errors.md`.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 10: Imported assets in documents

Depends on: 9

Components that import images render them, as decision 6 says.

- [ ] Load the asset types of design call 16 as delivered files.
- [ ] Give each asset import a token. The core rewrites it to a
      document-relative URL in `src`, `srcset`, `href`, `poster`, and `style`
      attributes, and it delivers the file under the generated assets route.
- [ ] Add asset bytes to the watch inputs and the render keys.
- [ ] Replace the `file` loader error and the `dataurl` advice, as "Replaced
      ways" says.
- [ ] Test that a component that imports a PNG and an SVG renders them in
      Serve and `build`, and that Changes shows an edited image.
- [ ] Update `docs/guides/authoring/styles.md`.

## Milestone 11: Imported assets in collected styles

Depends on: 10

- [ ] Rewrite asset tokens in the CSS-in-JS styles that the sidecar collects,
      such as Emotion and styled-components `url()` values.
- [ ] Test an Emotion style with an imported background image.

## Milestone 12: Imported assets verification, review, and pull request

Depends on: 9, 10, 11

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 13: Vite adapter documentation

Depends on: none

Track D. The protocol states the compiler rules of decisions 16 and 17 for a
catalogue with one Storybook folder or none.

Design calls of track D. These calls are the track D orchestrator's, made on
2026-11-18. They stay in this milestone so that the track changes only its
own lines of this plan.

- D1. `vite` is `true`, `false`, or an object. `true` or an object turns the
  adapter on. The object's optional `config` names the optional file, and
  without it Mokly uses no optional file. Reason: one switch for the common
  case, and explicit paths as for `renderer` and `postcss`.
- D2. Without a Storybook folder, Mokly loads the first Vite config file that
  Vite's own lookup finds in the configuration directory, or Vite's defaults
  without one. It loads it with the command `serve` and the mode
  `development` on every command and on both sides. Reason: one render
  behaviour everywhere, and the development JSX runtime gives invocation
  source.
- D3. Vite runs with no HTTP server, no hot module replacement, no watcher,
  and no dependency pre-bundling, and Mokly's use of Vite writes no file.
  Reason: the sidecar performs no file writes, and design call 18.
- D4. Each module that Vite transforms is a module of the graph. A query
  variant counts as its file. A plugin's virtual module is not a module, and
  its file imports count for its importer. An externalized dependency is a
  module with the digest of its resolved file and no imports. Reason: the
  render key rules stay without a second compiler. Refined on 2026-11-19: a
  module lists its static imports in source order, then its dynamic imports
  in source order. Reason: a module evaluates every static import first, as
  in the project's own Vite build.
- D5. A Vite compile records no reuse evidence, so the bundle cache never
  stores it, and only a `serveEdit` request reuses it. The toolchain
  identity adds the Vite version and its real path. Reason: Vite's resolver
  and plugins do not report the candidates that they probe.
- D6. The Vite config file, its imports, and the env files that Vite reads,
  present or absent, are compilation inputs. A change reloads the setup and
  moves every render key. Reason: they change every transform.
- D7. CI tests a Vite range that the optional peer dependency names. Mokly
  adds no version check. A Vite failure gives `bundle-failed` with the
  installed version and the tested range. Reason: as design call 13 for
  Storybook.
- D8. A Vite compile emits the operation event `vite`. Reason: the core keeps
  exact compile counts on both paths.
- D9. Under the adapter, the Vite setup takes the place of `postcss` and of
  the `moduleResolution` aliases, conditions, main fields, extensions, and
  loaders. The setup alone resolves imports, so Mokly's tsconfig `paths`
  rule does not apply. The package roots still apply. The `"empty"`
  opt-outs still apply and cover every stylesheet language: `.css` skips
  every plain and module stylesheet, and `.module.css` skips every module
  stylesheet. Reason: decision 16 removes Mokly's copies of the project's
  setup.
- D10. Under the adapter, Mokly scopes each `.module.` stylesheet with its
  own names, and the setup's `css.modules` options do not apply. Reason:
  both sides and both compile paths then give equal names.
- D11. Under the adapter, Vite's stylesheet languages are stylesheets:
  `.css`, `.scss`, `.sass`, `.less`, `.styl`, `.stylus`, `.pcss`,
  `.postcss`, and `.sss`. Reason: decision 16 sends stylesheets through the
  project's setup.
- D12. Under the adapter, every local stylesheet goes through the setup, also
  in a catalogue without JavaScript. A sidecar then starts, and the base side
  extracts its sources and selects an installation, as for the `postcss`
  module. Reason: decision 16 puts the setup in place of the `postcss`
  module, and the CSS must not change when the first JavaScript file comes.
- D13. Under the adapter, a configured or declared stylesheet whose path does
  not end in `.css` delivers at its route plus `.css`, as a module root does.
  Reason: a static host chooses the MIME type from the file extension.
- D14. A stylesheet that the setup cannot transform fails with its own
  catalogued message, which names the plugin, the stylesheet, and the detail.
  Reason: the PostCSS message would name the wrong step.
- D15. A file that a plugin of the setup writes is a watched change like any
  other edit. Reason: the setup's plugins keep the consumer build's trust,
  as PostCSS plugins do.
- D16. Made on 2026-11-20. Every Vite message follows the module sources rule
  for diagnostics: a failure names the logical module, a setup load failure
  names the Vite config file or the config import that failed, and no Vite
  diagnostic or `diagnostic` event shows an absolute path or a virtual
  module. Reason: the module sources contract already keeps other checkouts
  and implementation paths out of every diagnostic.
- D17. Made on 2026-11-23. Under the adapter, the renderer stylesheets that
  answer A of track D decision 1 removes are the files of the renderer's
  closure. That closure holds the renderer's top-level stylesheets and each
  file that their transform reports as a dependency. Reason: the options of
  track D decision 1 call each file of the renderer's closure a renderer
  stylesheet, such as the shared Sass partial of option B, and answer A
  changes only where Mokly removes them.
- D18. Made on 2026-11-23. `transformViteCss` has the 60-second deadline of
  `processCss`. Reason: the setup's transform takes the place of the
  `processCss` step, and it runs the same kind of work: preprocessors and
  PostCSS.
- D19. Made on 2026-11-23. A `transformViteCss` call on the head root prefers
  the idle head worker that compiled last, as a head `bundle` does. Reason:
  that worker already holds the Vite server of the side, which the transform
  reuses.
- D20. Made on 2026-11-23 by the orchestrator. Under the adapter, a local
  stylesheet alone selects base extraction and an installation, as the
  `postcss` module does. So the base side of a catalogue without JavaScript
  transforms its stylesheets through the base commit's setup. Reason: design
  call D12 requires it, and the orchestrator allowed the change in the CLI
  behind the `vite` field.
- D21. Made on 2026-11-23 by the orchestrator. The plugin that fails a
  stylesheet transform can report a location. Then `{stylesheet}` of the Vite
  setup row, which D14 adds, names the authored file of that location. It is
  a repository-relative path with the one-based line and column of the
  location, as in the PostCSS `CssSyntaxError` rule. That file can be a
  partial that the stylesheet imports. Without a location, `{stylesheet}` is
  the logical path of the stylesheet. Reason: it keeps the help that the
  esbuild path gives.
- D22. Made on 2026-11-23 by the orchestrator. Each file that the setup
  reports for a stylesheet joins the source inventory as a protected input,
  as without the adapter. A document that references such a file as a public
  file fails with the protected-target diagnostic. Its reason is
  `protected target {reference}: the Vite setup reported it as a dependency of {stylesheet}; exclude it from the plugin's sources (Tailwind: @source not "{relative-file}")`.
  The PostCSS rows for a missing explicit dependency and for a malformed
  dependency message do not apply under the adapter. Reason: both compile
  paths then publish the same files.
- D23. Made on 2026-11-23 by the orchestrator. Under the adapter, only
  lowercase stylesheet suffixes count, as in the project's own Vite build. A
  configured or declared stylesheet whose suffix is not lowercase, such as
  `Action.CSS`, fails with the Vite setup row. The esbuild path keeps its
  case-insensitive `.css` rule. Reason: the user's decision 16 follows the
  project's Vite build.
- D24. Made on 2026-11-23. Under the adapter, a file that only a `composes`
  of a CSS Module reads is also a protected input. Reason: the source policy
  keeps stylesheet sources private, and such a file is a stylesheet source.
- D25. Made on 2026-11-23. The location that a failing plugin reports can be
  in a virtual module, or in a file outside the source root and the selected
  dependency roots. Such a location counts as no location, so `{stylesheet}`
  is the logical path of the stylesheet. Reason: design call D16 keeps
  absolute paths and virtual modules out of every message.
- D26. Made on 2026-11-23. When no plugin reports a failure, `{plugin}` of the
  Vite setup row is `vite`. Reason: the code already uses this fallback, and
  the row then has one rule for each failure.
- D27. Made on 2026-11-23. When a document references a file that only a
  `composes` reads, the protected-target reason is the existing imported
  stylesheet reason,
  `protected target {reference}: imported by {stylesheet}; reference the delivered route under static/mokly-generated/ or keep a separate public copy`.
  Its `{stylesheet}` is the CSS Module that composes from that file. Reason:
  a `composes ... from` is an import of that file by the CSS Module, and its
  CSS is delivered inside the module's stylesheet, so no new message is
  needed.

Decisions of track D. Decisions 1 and 5 have answers. Decisions 2, 3, and 4
wait for the user.

#### Track D decision 1: Renderer CSS inside nested imports under Vite

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-imported-styles.md:80-93`,
  `docs/protocol/mokly-imported-styles-postcss.md:64-72`,
  `docs/protocol/mokly-vite-adapter-styles.md:8-30`.
- **Background:**
  - Today the core walks the local `@import` chain of each stylesheet with
    Mokly's own resolver. It removes every stylesheet of the renderer's
    closure from an entry stylesheet at every depth. So renderer CSS, such
    as design tokens, does not come back after a theme overrides it.
  - Then the core runs PostCSS on each file of the chain.
  - Under the adapter, the setup transforms each stylesheet in place of
    PostCSS. Vite inlines the `@import`s of a stylesheet with the setup's
    own resolver, which knows Vite aliases. Sass, Less, and Stylus resolve
    their own imports.
- **Problem:** Mokly's own walk cannot resolve an `@import` that only the
  setup knows, such as one through a Vite alias. It cannot see the imports of
  Sass, Less, or Stylus either. So the pruning rule and the Vite transform do
  not fit together.
- **Impact if no action:** Milestone 16 has no rule for the imports inside a
  stylesheet.
- **Root question:** Under the Vite adapter, what does an entry's stylesheet
  deliver when its import chain reaches CSS that the renderer already
  delivers?
- **Options:**
  - **A.** The setup resolves and inlines every import inside a stylesheet.
    Mokly removes renderer stylesheets only from the stylesheets that
    JavaScript imports. A renderer stylesheet that an entry stylesheet
    imports comes back after the renderer's CSS, as in the project's own
    Vite build. The nested-import diagnostic does not apply under the
    adapter. This drops the assumption, from the esbuild path, that a
    renderer file in an entry's chain repeats CSS: a shared Sass partial
    that holds only variables and mixins emits no CSS. Effort: Medium.
  - **B.** The setup resolves and inlines every import, as in A. When the
    inlined chain of an entry stylesheet holds a renderer stylesheet, the
    build fails with the nested-import diagnostic, at every depth. Vite
    reports a shared Sass partial as a dependency, so a project whose
    renderer and components share a partial fails. Effort: Medium.
  - **C.** Mokly keeps its own walk of `.css` imports and removes renderer
    files at every depth, as today. Then the setup transforms each file. An
    `@import` that only the setup can resolve fails the build. Imports inside
    Sass, Less, and Stylus files get no pruning. Effort: Medium.
  - **D.** Mokly walks each `@import` with the setup's own resolver through
    the sidecar, and removes renderer files at every depth, as today. Imports
    inside Sass, Less, and Stylus files get no pruning. Effort: Large.
  - **E.** Mokly removes renderer files from the `@import`s of each
    stylesheet that it requests, and resolves them with the setup's
    stylesheet resolver. A deeper renderer `.css` file that the setup inlines
    fails with the nested-import diagnostic. Vite inlines every nested
    `@import` from disk, so every deeper renderer file fails. Effort: Medium.
  - **F.** Mokly's plugin adds a first alias with a custom resolver. When a
    plain CSS file imports a renderer file, the resolver gives an empty
    stylesheet. This removes renderer files at every depth with the setup's
    own resolver, and Vite still inlines. Sass partials must stay out, and
    Tailwind's own import handling must pass the alias. It needs a spike.
    Effort: Large.
- **Left out:**
  - Keep Mokly's walk and leave the imports that it cannot resolve to Vite:
    two resolvers can choose different files, so the pruning can remove the
    wrong file.
  - Remove the renderer's rules from the entry's output by matching text: a
    transform of the whole chain rewrites the copy, so a match fails without
    notice.
  - Transform the renderer's and the entry's stylesheets as one stylesheet:
    a document links the two bundles separately.
  - B with a warning in place of the failure: a detail of B.
- **Wider fix:** A. The first pass named D. D must know each import syntax,
  and it must stop Vite's own inlining, which breaks transforms of a whole
  chain such as Tailwind's.
- **Previous examples:** The PostCSS rule: a plugin that inlines nested
  imports bypasses the pruning, and the build fails when it inlines a
  renderer file at depth two or more.
- **Recommendation:** A. It matches Storybook and the project's own Vite
  build, which decisions 16 and 17 chose, and it gives no false failure on a
  shared Sass partial. D and F keep today's pruning, at Large effort.
- **Action:** ask the user, because A changes the renderer pruning
  requirement under the adapter, and no user decision covers that.
- **Answer:** A, an orchestrator design call on 2026-11-23. The user's
  decision 16 settles it: the setup transforms stylesheets, and Mokly keeps
  no copy of Vite's CSS rules.

#### Track D decision 2: Files that the setup reads outside the graph

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-vite-adapter-inputs.md`, "Inputs And
  Serve", `crates/mokly-render/src/postcss_read_inventory.rs:182-193`.
- **Background:** The inputs of a Vite compile are the Vite config file, the
  optional file, the files that they import, the env files, the modules of
  the graph, and the files that a transform reports as dependencies. Vite and
  its plugins can read other files: the PostCSS config that Vite looks up,
  or a browserslist or Babel config. On the esbuild path, the same limit
  exists: a PostCSS plugin's read is an input only when the plugin reports it
  or when it loads a module, and no page states that limit. Mokly keeps one
  Vite server and invalidates only changed modules, so a cached transform
  stays until the setup reloads or Serve restarts.
- **Problem:** No rule says whether those other reads are inputs, or how a
  project makes one an input.
- **Impact if no action:** An edit to such a file does not rebuild in Serve
  and moves no render key, so the output stays stale until Serve restarts.
- **Root question:** How does Serve pick up an edit to a file that changes a
  Vite compile, when the setup reads that file without a report?
- **Options:**
  - **A.** Make the PostCSS config candidates that Vite looks up into inputs,
    present or absent. State a limit for every other file that a plugin reads
    without a report: an edit to it takes effect when the setup reloads or
    Serve restarts. Effort: Small.
  - **B.** State the limit only. Effort: Small.
  - **C.** Record every file read of the setup and its plugins as read
    evidence, as the PostCSS context records its reads. Vite 8 reads some
    files in native code, so this still misses some reads. Effort: Large.
  - **D.** Do A, and give the limit a route: a `watch.rules` entry with the
    `rebuild` action makes any other file an input, and under the adapter a
    change to such a path reloads the setup. The project names each such
    file. Effort: Small.
- **Left out:**
  - Make every file of the configuration directory an input: every edit
    there would then rebuild everything, which breaks the watch rule that a
    change recomputes only the outputs whose inputs changed.
  - Reload the setup at every rebuild: an edit to the unreported file still
    starts no rebuild.
- **Wider fix:** C.
- **Previous examples:** The PostCSS read inventory, which keeps only
  reported dependencies and loaded modules.
- **Recommendation:** D. The first pass recommended A. D keeps A's automatic
  cover of the PostCSS config, and it gives every other unreported file a
  route that the project controls, at the same effort.
- **Action:** ask the user, because every option states a limit or an input
  rule at the watch boundary, and no page states one today.

#### Track D decision 3: Untracked env files on the base side

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-vite-adapter-inputs.md`, "The Base Side".
- **Background:** Vite reads env files, such as `.env` and `.env.local`, into
  `import.meta.env`. Design call D6 makes them inputs. The base side reads
  its env files from the base commit. Projects often keep `.env.local` and
  the other `.local` env files out of Git, so only the head side reads them.
  Process variables, such as `VITE_*`, are equal on both sides, because both
  sides inherit one process environment.
- **Problem:** A value that an untracked env file sets exists on the head side
  only.
- **Impact if no action:** Changes reports a change in every view that reads
  such a value, although the branch did not change it.
- **Root question:** Where does each side get the env values that the setup
  exposes, so that Changes shows each change of the branch and nothing else?
- **Options:**
  - **A.** Keep the rule, and state the difference in the guide. Effort:
    Small.
  - **B.** Both sides read only the env files that Git tracks. Serve then
    ignores values that `vite dev` uses. Effort: Small.
  - **C.** The base side reads the tracked env files from the base commit and
    the untracked env files from the working tree. Effort: Medium.
  - **D.** The base side reads from the working tree every input that neither
    the base commit nor the working-tree index tracks: env files, files that
    plugins read, and generated modules that Git ignores. This changes base
    preparation on both compile paths, and a generated file then comes from
    the head side, also when the branch changed its source. Effort: Large.
- **Left out:**
  - Both sides read every env file from the working tree: a branch edit of a
    tracked env file would then not show.
  - Read no env files on either side: stories that read env values would
    then differ from Storybook and from `vite dev`.
  - Warn when the head side reads an untracked env file: the false changes
    stay.
  - Skip only the `.local` env files on both sides: a project that keeps
    `.env` itself out of Git keeps the false changes.
- **Wider fix:** D. The first pass named C. D covers every input that Git
  does not hold, and it fits a follow-up item, because it reaches base
  preparation outside the adapter.
- **Previous examples:** The HTML dependency policy and the package tiers
  read working-tree packages on the base side.
- **Recommendation:** C. It removes the false changes and keeps each branch
  edit of a tracked env file visible.
- **Action:** ask the user, because C reads working-tree files on the base
  side, which no rule covers.

#### Track D decision 4: Replaced settings stay silent under Vite

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-vite-adapter.md:205-219`.
- **Background:** On the esbuild path, Mokly compiles with the `postcss`
  module and the `moduleResolution` fields `aliases`, `conditions`,
  `mainFields`, `resolveExtensions`, and `loaders`. These copy the project's
  build setup. Under the adapter, the Vite setup replaces them, and Mokly's
  tsconfig `paths` rule stops too, as design call D9 says. A configuration
  can still set them.
- **Problem:** No rule says whether Mokly tells the user that a set field has
  no effect.
- **Impact if no action:** A user keeps an alias or a PostCSS module that
  Mokly ignores, and an import fails or a style differs with no explanation.
- **Root question:** What does a Mokly setting that copies the project's
  build setup do under the Vite adapter, so that it never misleads the user?
- **Options:**
  - **A.** Docs only: the adapter page and the guide name the replaced
    fields. Effort: Small.
  - **B.** A configuration warning for each replaced field that the
    configuration sets. It names the field and the adapter. `--strict` then
    fails until the user removes the field. It adds a row to
    `docs/protocol/mokly-build-warnings.md`. Effort: Small.
  - **C.** Reject such a configuration with `config-invalid`. Effort: Small.
  - **D.** Apply `moduleResolution.aliases` under the adapter, after the
    setup's own aliases, so that the setup wins on a conflict. The other
    replaced fields get B's warning. This drops the assumption of design call
    D9 that the replaced settings have no effect. Two alias sources then
    exist. Effort: Medium.
  - **E.** Name the replaced setting in the failure: when the setup cannot
    resolve an import that a configured alias or Mokly's tsconfig `paths`
    rule would resolve, the diagnostic names that setting. A `postcss` module
    or a condition that changes the output without a failure stays silent.
    Effort: Small.
- **Left out:**
  - Apply `postcss`, `conditions`, `mainFields`, `resolveExtensions`, or
    loaders other than `"empty"` on top of the setup: PostCSS would run
    twice, or the project's own imports would resolve differently.
  - Move these fields under an object for esbuild only: C gives the same
    result without a breaking change to every configuration.
  - Report the field without failing `--strict`: the warnings contract
    counts an ignored input as a warning.
- **Wider fix:** None, because one rule covers every field.
- **Previous examples:** The `stylesheet-extglob` configuration warning for a
  matcher syntax that Mokly does not support.
- **Recommendation:** B. The warning names each ignored field at once, it
  matches the warnings contract's case of an ignored input, and the user
  fixes it with a one-line change.
- **Action:** ask the user, because B adds a warning that fails `--strict`.

#### Track D decision 5: Vite CSS Modules options under the adapter

- **Severity:** High. **Effort:** Large.
- **Source:** Review, from the options check of track D decisions 1 to 4.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-vite-adapter-styles.md:17-26`,
  `docs/protocol/mokly-imported-styles-modules.md:89-102`.
- **Background:**
  - Design call D10 makes Mokly scope each `.module.` stylesheet under the
    adapter with Mokly's own names. The CSS Modules settings of the setup
    do not apply: `css.modules`, or `css.lightningcss.cssModules` when the
    setup uses the lightningcss transformer.
  - Mokly's class map gives each authored class name as a key. Vite's
    `css.modules.localsConvention` can also give converted keys, such as
    `buttonPrimary` for `.button-primary`.
  - Mokly's scoper fails a `composes` from another file, an `@value`, and an
    ICSS `:export`. Vite's default transformer supports all three.
  - Vite's default scoped names come from a hash of the stylesheet text and
    a line number, so an edit renames every class of the file. Mokly's names
    come from the stylesheet path.
- **Problem:** A project that reads converted keys gets `undefined` for each
  such class under the adapter, with no error. A project that composes from
  another file, or uses `@value` or `:export`, fails the build.
- **Impact if no action:** Components of such projects render without their
  classes and look wrong, or the build fails, although the project's own
  Vite build works.
- **Root question:** Under the Vite adapter, how does each CSS Module that
  the project's Vite build accepts get the same keys and scoping, with stable
  scoped names?
- **Options:**
  - **A.** Keep D10. State in the guide that `localsConvention` does not
    apply, and that a `composes` from another file, `@value`, and `:export`
    fail. Effort: Small.
  - **B.** Keep Mokly's scoper and names, and add the keys that the setup's
    `localsConvention` gives to the class map. A `composes` from another
    file, `@value`, and `:export` still fail, and `exportGlobals`,
    `scopeBehaviour`, and `globalModulePaths` stay silently ignored. Effort:
    Medium.
  - **C.** Do A, and warn when the setup sets a CSS Modules option that
    Mokly does not apply. `--strict` then fails until the project changes its
    setup or uses the esbuild path. The warning also fires for harmless
    options, such as `generateScopedName`, and it misses the lightningcss
    defaults. Effort: Small.
  - **D.** Give Mokly's naming rule to the setup as its scoped name function,
    and take the class map and the scoped stylesheet from Vite's own CSS
    Modules. Names stay Mokly's names. Every feature of Vite's CSS Modules
    works on its default transformer. Mokly's scoper and its checks do not
    run under the adapter. Effort: Large.
  - **F.** Do D on both of Vite's CSS transformers. On the default
    transformer, Mokly's naming rule is the name function. On the
    lightningcss transformer, Mokly sets the name pattern
    `mokly_[hash]_[local]`, whose hash is lightningcss's own path hash, so
    those names differ from the esbuild path's names unless Mokly renames
    them after the transform. Each file that a `composes` reads becomes an
    input of its importer, because Vite reads it without a report. This drops
    the assumption of D10 that the setup keeps its CSS Modules settings in
    `css.modules`. Effort: Large.
- **Left out:**
  - Use the setup's own naming: Vite's default names hash the stylesheet
    text, and a project's own pattern can hash the working directory, so an
    edit or a second checkout renames classes. F gives the same features
    with names that Mokly controls.
  - A class map that warns when code reads a missing key: valid code reads
    missing keys, such as `styles[variant]`, so `--strict` would fail.
  - Converted forms of every key on both compile paths, without the setup:
    this adds keys that the project's build does not have.
  - Keep the setup's names and map them to stable names inside Changes:
    every comparison and attribution step would need the maps.
- **Wider fix:** F. The first pass named D, which prevents the class only on
  the default transformer.
- **Previous examples:** None found.
- **Recommendation:** F. The first pass recommended B. F gives each CSS
  Module that the project's Vite build accepts the same keys and scoping on
  both transformers, with names that Mokly controls. B is the best smaller
  first step, but it fixes `localsConvention` only and adds a copy of Vite's
  key conversion, which decision 16 removes.
- **Action:** ask the user, because every option either leaves wrong output
  or adds a rule at the CSS Modules boundary, and F changes design call D10.
- **Answer:** F, an orchestrator design call on 2026-11-23. The user's
  decision 16 settles it: the setup transforms stylesheets, and Mokly keeps
  no copy of Vite's CSS rules. It replaces design call D10.

- [x] Add `docs/protocol/mokly-vite-adapter.md`: the `vite` field, the setup
      for a catalogue without a Storybook folder, the optional file, the
      duties of Mokly's plugin, one React runtime, the base side,
      invalidation in Serve, and stylesheet transforms. Link it from
      `docs/protocol/README.md` and from the bundling section of
      `docs/protocol/mokly-sidecar.md`. Add the status line. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Update `docs/protocol/mokly-configuration.md` with the `vite` field.
      Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Update `docs/protocol/mokly-configuration-imported-styles.md`: under
      the Vite adapter, Vite transforms each local stylesheet in place of the
      PostCSS module. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Update `docs/architecture/rust-core.md` and
      `docs/architecture/package-boundary.md` for the Vite adapter as a
      second compile path. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`. Branch: `conductor/storybook-support-d-vite-adapter`.

## Milestone 14: Vite adapter core

Depends on: 13, and the answer to decision 22

The project's Vite setup compiles JavaScript, as decision 16 says.

- [x] Add the `vite` field to the configuration and its schema, as design
      call 17 says. The optional `config` field waits for track H. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Resolve `vite` as design call 19 says, and apply the answer to
      decision 22. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Run one Vite server for each sidecar process, as design call 18 says.
      Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Add the Mokly Vite plugin: the entry module, the authoring facade, the
      runtime module, CSS Modules maps, the JSX development shim, confinement
      and logical names, consumed bytes, and the module graph. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Evaluate the entry through Vite's module runner with one React
      runtime. Keep Mokly's stylesheet pipeline in this milestone. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Load the app's `vite.config.*` when no root names a Storybook folder,
      as decision 17 says. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Test a Vite fixture with an alias, `import.meta.env`, a `?raw` import,
      and the SVGR plugin in `build`. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Add `docs/guides/authoring/vite.md`, and update the
      `packages/mokly/README.md` key code. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Move the virtual module helpers that both compile paths need out of
      `plugins.ts`, as a separate commit, with no behaviour change. The
      primary orchestrator approved this on 2026-11-18. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Add the optional `vite` peer dependency, and update its check in
      `scripts/release/manifest.mjs`, `docs/protocol/mokly-package.md`, and
      `docs/protocol/npm-release.md`. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Add the rule of the answer to decision 22 to
      `docs/protocol/mokly-vite-adapter.md`. Branch:
      `conductor/storybook-support-d-vite-adapter`.
- [ ] Apply the answer to track D decision 4 to the configuration check and
      to `docs/protocol/mokly-vite-adapter.md`.
- [x] Name the `vite` setting in the `bundle` row of
      `docs/protocol/mokly-sidecar.md`, which is at its 250-line cap, and
      scope the esbuild "metafile" sentence of
      `docs/protocol/mokly-sidecar-modules.md` to the esbuild path. Branch: `conductor/storybook-support-d-vite-adapter`.

## Milestone 15: Vite adapter on the base side and in Serve

Depends on: 14

- [x] Compile the base side with the base commit's Vite setup in its
      extraction, with the selected installation. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Invalidate changed modules from Mokly's watcher in Serve. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Test Changes between two commits of a Vite fixture, and a Serve edit.
      Branch: `conductor/storybook-support-d-vite-adapter`.
- [ ] Apply the answers to track D decisions 2 and 3.
- [x] Add the Vite inputs to the table of `docs/protocol/mokly-watch.md`. The
      early extraction lease of `docs/protocol/mokly-base-preparation.md`
      needs no change: it covers only a renderer or a PostCSS module, and a
      catalogue with JavaScript entries alone does not trigger it either.
      Branch: `conductor/storybook-support-d-vite-adapter`.

## Milestone 16: Stylesheets through Vite

Depends on: 14

- [x] Transform each local stylesheet as design call 21 says, in place of
      the configured PostCSS module. Branch: `conductor/storybook-support-d-vite-adapter`.
- [ ] Under the adapter, send every local stylesheet of a catalogue without
      JavaScript through the setup, as design call D12 says. A sidecar then
      starts, and the base side extracts its sources and selects an
      installation, as for the `postcss` module.
- [x] Keep Mokly's order, bundling, delivery, and attribution on the result. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Test Sass, CSS Modules class names, and Tailwind's Vite plugin. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Update `docs/guides/authoring/vite.md` and
      `docs/guides/authoring/styles.md`. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Apply the answers to track D decisions 1 and 5. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Route Vite's stylesheet resolver through the Vite path's one lookup, so
      that stylesheet imports also get the selected installation and the
      package roots. Vite's stylesheet resolver does not call Mokly's plugin. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Keep each authored relative `url()` of a transformed stylesheet, so
      that Mokly delivers its asset as on the esbuild path. Vite rewrites
      such URLs, and Mokly rejects a root-absolute CSS URL. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Update the pages that name the PostCSS step or `.module.css` only:
      `docs/protocol/mokly-imported-styles.md`,
      `docs/protocol/mokly-imported-styles-modules.md`, and the position and
      `processCss` rules of `docs/protocol/mokly-imported-styles-errors.md`.
      Make the fix text of the "two roots at one route" error fit a `.scss`
      and a `.scss.css` file at one route. Branch: `conductor/storybook-support-d-vite-adapter`.
- [x] Name the Rust crates and files that this milestone changes in the
      report. Keep each change behind the `vite` field, and do not refactor
      track C's asset URL rewriting or generated file delivery. Branch: `conductor/storybook-support-d-vite-adapter`.

## Milestone 17: Vite adapter verification, review, and pull request

Depends on: 13, 14, 15, 16

Merge justifications of the merge of the primary branch with `main`, on
2026-11-20: `.context/storybook-support/merge-justifications.md`. The pull
request description copies them.

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 18: Storybook folders documentation

Depends on: 8

Track E. The protocol states the rules of decisions 4 and 9.

- [ ] Add the rules for Storybook folders and `main.*` to
      `docs/protocol/mokly-storybook.md`, with the answer to decision 20.
- [ ] Update `docs/protocol/mokly-configuration.md` with the root `storybook`
      field.
- [ ] Update `docs/protocol/mokly-rendering.md`: a story document links the
      preview file's bundled stylesheet directly after the renderer's.
- [ ] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 19: A Storybook folder for each root

Depends on: 18

Monorepos keep the preview file of their own Storybook, as decision 9 says.

- [ ] Add the root `storybook` field to the configuration and to
      `config.schema.json`, as design call 12 says.
- [ ] Apply each root's preview file to the stories of that root in the
      sidecar and in the render keys of `crates/mokly-graph`. Delete the
      fixed list of preview paths, as "Replaced ways" says.
- [ ] Load `main.*` in the sidecar as design call 13 says, and resolve
      `@storybook/react` as design call 14 says.
- [ ] Test a monorepo with `packages/ui/.storybook`, a project that installs
      only a framework package, and a catalogue with the default folder.
- [ ] Update `plans/follow-ups/fallback-keys-checkout-folder.md` for the new
      preview inputs.
- [ ] Update `docs/guides/authoring/storybook.md` and
      `docs/guides/authoring/config.md`.

## Milestone 20: Roots from the `stories` field of `main.*`

Depends on: 19

- [ ] For a root that names a Storybook folder and has no `dir`, run its
      `main.*` in the sidecar before discovery with Storybook's loader, as
      decision 20 chose. Turn each `stories` entry into a root, and convert
      Storybook's pattern syntax, such as `*.@(ts|tsx)`, to Mokly's globs.
- [ ] On the base side, run the base commit's `main.*` after its extraction
      and its install.
- [ ] Watch `main.*` and its imports as configuration inputs, so that an edit
      runs discovery again in Serve.
- [ ] When `main.*` fails, fail discovery with a configuration error that
      names the file.
- [ ] Keep configuration and discovery free of Node for every other root and
      catalogue.
- [ ] Update `docs/protocol/mokly-storybook.md`,
      `docs/protocol/mokly-configuration.md`, and
      `docs/protocol/mokly-root-discovery.md` with that answer.
- [ ] Test a root with `storybook` and without `dir`, on the head and the
      base side.
- [ ] Update `docs/guides/authoring/config.md`.

## Milestone 21: Preview CSS in story documents

Depends on: 19

The CSS that a preview file imports reaches its stories, as decision 4 says.

- [ ] Give each preview file a bundled stylesheet route, as the renderer has,
      and link it as design call 15 says.
- [ ] Watch the preview's stylesheets and add them to the render keys, as for
      the renderer.
- [ ] Test that a preview that imports global CSS styles its stories, and
      that Changes shows an edit of that CSS.
- [ ] Update `docs/guides/authoring/storybook.md`.

## Milestone 22: Storybook folders verification, review, and pull request

Depends on: 18, 19, 20, 21

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 23: Failed stories documentation

Depends on: 1, 8

Track F. The protocol states the failure rules of decision 5.

- [ ] Add the render failure rules to `docs/protocol/mokly-storybook.md`.
- [ ] Update `docs/protocol/mokly-build-warnings.md` with
      `story-render-failed`. In `docs/protocol/mokly-sidecar.md`, update the
      `render-failed` row and the rule that there is no fallback render, for
      stories.
- [ ] Update `docs/protocol/mokly-component-design.md` with the failed story
      state of Milestone 1.
- [ ] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 24: Story render failures

Depends on: 23

A story that cannot render no longer stops the build, as decision 5 says.

- [ ] Turn a story render failure into the warning of design call 9. Keep
      `--strict` failing on it.
- [ ] Write the error document of Milestone 1 in place of each failed view,
      so that the catalogue shows the story and the reason.
- [ ] Test that a portal story gives the warning and the error document, that
      the other stories render, and that `--strict` fails.
- [ ] Update `docs/guides/authoring/storybook.md`.

## Milestone 25: Failed stories verification, review, and pull request

Depends on: 23, 24

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 26: Storybook links documentation

Depends on: 1, 22

Track G. The protocol states the link rules of decision 15.

- [ ] Add the Storybook link rule to `docs/protocol/mokly-storybook.md`.
- [ ] Update `docs/protocol/mokly-component-design.md` with the Storybook
      link of Milestone 1.
- [ ] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 27: Storybook story links

Depends on: 26

Each story page knows its story in the published Storybook, as decision 15
says.

- [ ] Derive each story's Storybook id from its meta title, or from the auto
      title of its `main.*` entry, with Storybook's own helpers.
- [ ] Add the story URL to the catalogue read model when the root's
      `storybook.url` is set, with generated shared types.
- [ ] Test the ids of titled and untitled files.

## Milestone 28: The Storybook link in the shell

Tags: ui

Depends on: 27

- [ ] Add the link to `@mokly/ui` as the mockup shows, and render it from
      the viewer container for entries with a Storybook URL.
- [ ] Render the package component in the design library, as `AGENTS.md`
      requires.
- [ ] Add tests under `packages/ui/tests` and `packages/viewer/tests`, and a
      browser spec.

## Milestone 29: Storybook links verification, review, and pull request

Depends on: 26, 27, 28

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 30: Storybook setup on Vite documentation

Depends on: 12, 17, 22, 37

Track H. The protocol states the Storybook setup rules of decision 17, with
the answer to decision 18, and the `sb.mock()` warning of decision 12.

- [ ] Add the Storybook setup rules to `docs/protocol/mokly-vite-adapter.md`,
      with the answer to decision 18.
- [ ] Update `docs/protocol/mokly-configuration.md` for the answer to
      decision 18.
- [ ] Update `docs/protocol/mokly-build-warnings.md` with
      `storybook-mock-without-vite`.
- [ ] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 31: Imported assets on the Vite adapter

Depends on: 12, 17

- [ ] Turn Vite's asset URLs into Mokly asset tokens, so that the delivery
      of Milestone 10 applies.
- [ ] Test an imported image under the adapter.

## Milestone 32: Storybook's setup on the Vite adapter

Depends on: 30

- [ ] Load Storybook's merged setup with its preset loader, with
      `viteCorePlugins` and `viteFinal`, for every JavaScript entry when a
      root names a Storybook folder, as decision 17 says.
- [ ] Load the base commit's Storybook setup for the base side, so that both
      sides compile with their own setup.
- [ ] Remove Storybook's browser-only plugins, as design call 20 says.
- [ ] Add the optional file and `@mokly/mokly/vite`, as design call 22 says.
- [ ] Install the mocker global of design call 24.
- [ ] Apply the answer to decision 18, and update `config.schema.json` with
      it.
- [ ] Add the `storybook-mock-without-vite` warning, as design call 23 says.
- [ ] Test the supported Storybook range in CI with a `react-vite` fixture
      and a `nextjs-vite` fixture. Add the development packages under the
      dependency rules.
- [ ] Test that `__mocks__` redirects, automocks, and spies of `sb.mock()`
      render, that a `viteFinal` plugin applies to stories and mockups, that
      the optional file removes a plugin, and that Changes compiles both
      sides with their own Storybook setup.
- [ ] Update `docs/guides/authoring/vite.md` and
      `docs/guides/authoring/storybook.md`.

## Milestone 33: Storybook setup on Vite verification, review, and pull request

Depends on: 30, 31, 32

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 34: Story component usage documentation

Depends on: 8, 17

Track I. The protocol states the usage rules of decision 13, with the
answers to decisions 19 and 21.

- [ ] Update `docs/protocol/mokly-instances.md` and
      `docs/protocol/mokly-component-changes.md` with those answers. Under
      decision 19, option L: names from `moklyInstance`, `key`, and the
      naming props, numbers as the fallback, and the changed stability rule.
- [ ] Add the warning for numbered uses to
      `docs/protocol/mokly-build-warnings.md`, and the naming props field to
      `docs/protocol/mokly-configuration.md`.
- [ ] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 35: Story component usage

Depends on: 34

Screens that render a story component record its use, as decision 13 says.

- [ ] Record an instance of a stories entry in the JSX development shim when
      a screen renders its meta's `component`, or a `memo` or `forwardRef`
      wrapper of it, on both compile paths.
- [ ] Give each such use the id that decision 19 chose: an explicit
      `moklyInstance` or `key`, then the first naming prop, then a number.
- [ ] Warn about each numbered use, with the prop to add: a `key` on a
      product component, or `moklyInstance` on a Mokly wrapper.
- [ ] Add the configuration field that changes the list of naming props.
- [ ] Keep the content of each use in Changes, as decision 21 chose:
      `children` and each prop that holds React content become implicit
      slots, and function props stay out of the props digest.
- [ ] Test repeated uses, a wrapped component, an edit of a use's children,
      and a changed component that affects a screen, on esbuild and on the
      Vite adapter.
- [ ] Update `docs/guides/authoring/storybook.md` and
      `docs/guides/authoring/components.md`.

## Milestone 36: Story component usage verification, review, and pull request

Depends on: 34, 35

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 37: Spike for several Storybook folders

Depends on: none

Track J. Decision 18 chose E, with a spike first. The spike tests whether one
module runner can run every file once while each file compiles with the
Vite setup of the Storybook folder that owns it.

- [ ] Build a scratch monorepo with two Storybook folders whose setups differ
      in an alias, a plugin, and an `sb.mock()` call, and a module that both
      packages import.
- [ ] Prove or refute, with a prototype under `.context/`: each file compiles
      with its owner's setup, the shared module loads once, virtual modules
      and ids reach the right server, the module graph and the consumed bytes
      stay complete, and the base side and Serve invalidation can work the
      same way.
- [ ] Measure the cost against one setup.
- [ ] Record the result in decision 18, and update the TODOs of milestones 30
      and 32 and design calls 18 and 22. When the spike refutes E, give
      decision 18 back to the user with the evidence.
- [ ] Commit, push, and open a pull request into this branch. The prototype
      stays under `.context/`.

## Milestone 38: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Remove the last status lines that this plan owns.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Run the released package against a new `react-vite` Storybook project
      with and without the Vite adapter.
- [ ] Split `crates/mokly-graph/README.md`, which passes 300 lines, after
      tracks C and D both merge into the primary branch,
      `calummoore/mokly-storybook-integration`. Do not split it before.
      Reason: both tracks change that README.
