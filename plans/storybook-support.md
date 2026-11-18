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
  works with one root entry. Decision 20 below is open: it settles how the
  `stories` field reaches discovery, and it blocks Milestone 20.
- **12. Story setup: B.** Mokly awaits `story.load()`, runs `beforeAll` once,
  and warns about `sb.mock()` when the Vite adapter is off. Rejected: load
  only, A; a Mokly copy of `sb.mock()`, C. Reason: Storybook's own plugins
  give `sb.mock()` on the Vite adapter.
- **13. Usage of story components: C.** A screen's use of a stories meta's
  `component` records an instance of that stories entry. Rejected: no change,
  A; a `fromStories` helper, B. Reason: projects get usage evidence with no
  change to their screens. Decisions 19 and 21 below are open and block
  Milestone 34.
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
  below is open and blocks Milestone 14.
- **17. The Vite setup: E.** With a Storybook folder, Mokly loads
  Storybook's merged Vite setup for every JavaScript entry. An optional
  `mokly.vite.config.ts` can change that setup. Rejected: the app config only,
  A; a file that the project writes, B; two setups, C; D without the
  optional file. Reason: stories match Storybook, and each module loads once.
  Decision 18 below is open and blocks Milestone 30.

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

### 19. Ids of story component uses

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design, with options E and F from the options check.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-instances.md:28-41`,
  `docs/protocol/mokly-instances.md:69-86`.
- **Background:**
  - An instance id is the `moklyInstance` prop of a wrapper or the
    `mokly-instance` attribute of a component element. Without one, the id
    defaults to the last segment of the component's path.
  - Duplicate ids in one scope and placement are build errors.
  - Changes pairs the uses of two commits only by equal scoped ids.
  - Decision 13 records a use whenever a screen renders the component of a
    stories meta. That component is a plain product component, often used
    many times in one screen, and `moklyInstance` is not in its type.
- **Problem:** Repeated uses of a story component in one scope get the same
  default id, which the current rule rejects.
- **Impact if no action:** Decision 13 fails the build for most screens that
  render a story component twice.
- **Root question:** How does Mokly tell each use of a story component apart,
  in one view and across commits, with no edit to screens or product
  components?
- **Options:**
  - **A.** Keep the current rule, and let the JSX shim strip a
    `moklyInstance` prop from any matched component. Repeated uses without an
    id fail the build. Effort: Small.
  - **B.** Number repeated uses in render order within each scope, such as
    `button`, `button-2`, and `button-3`. A `moklyInstance` prop wins. A
    React `key` wins when it matches the id grammar, after the component's
    path segment, such as `button-save`. An automatic number skips an id
    that an explicit one takes. Inserting a use renumbers the later ones, so
    Changes shows them as moved. This changes the duplicate rule and the
    stability rule of `docs/protocol/mokly-instances.md`. Effort: Medium.
  - **C.** Derive the id from the source location of the use. One call site
    that renders several uses, such as a `.map()`, still needs B's numbers,
    and a `createElement` call has no location. An edit above a use changes
    its id. This puts source locations into keys, which the instance rules
    exclude today. Effort: Medium.
  - **D.** Record these uses without instance keys. Pages list the screens
    that use the component, but nobody can select or compare one use, and an
    edit of the component stays a direct change of each consuming screen.
    Effort: Medium.
  - **E.** Derive the default id from the content of the use: the path
    segment and a short digest of its data props and text children. Equal
    uses become placements of one logical instance. An insertion or a
    reorder keeps every other id. A props edit shows as one removed and one
    added use, and the ids are hard to read. Effort: Large.
  - **F.** Do B, and let the comparison pair the automatic ids of one
    component in one scope by aligning their props digests. An insertion
    then shows as one added use. This changes the record-only resolution and
    the pairing by scoped id. It can follow B after the merge. Effort: Large.
- **Left out:** Record only the uses that catalogue files write: a screen that
  renders a product page would record none of the uses inside that page.
- **Wider fix:** B. Every use gets an id without an edit, and an explicit id
  stays possible.
- **Previous examples:** React keys repeated children by position when no
  `key` is given.
- **Related:** Decisions 13 and 21. Milestone 34 waits for this answer.
- **Recommendation:** B. It is the smallest option that builds every screen
  with no edit and keeps a selection for each use. Record F as a follow-up
  item that removes B's wrong pairs. E is better if no wrong pair matters
  more than effort.
- **Action:** ask the user, because B changes the duplicate rule and the
  stability rule of `docs/protocol/mokly-instances.md`.

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
- **Related:** Decisions 13 and 19. Milestone 34 waits for this answer.
- **Recommendation:** A. Every content edit stays visible, and screens and
  stories need no change.
- **Action:** ask the user, because A adds a rule to the Changes contract.

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

The mockups of Milestone 1 raised decisions 23 to 27 on 2026-11-18. The
options check of the same day rewrote the root questions of decisions 24, 25,
and 27, added option F to decision 23, option E to decisions 24 and 25, and
options C and D to decision 27. It also showed that rules in force settle two
more questions, which became design calls 26 and 27.

### 23. A new story has no published Storybook page

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation, with option F from the options check.
- **Category:** Docs or spec.
- **Location:** `examples/basic/specs/design/components/parts/component_info.tsx`.
- **Background:**
  - Decision 15 gives each story page a link to the same story in the
    published Storybook.
  - Many teams publish Storybook from the main branch.
  - The mockups show the link on every story page, also in Changes.
- **Problem:** A story that the branch adds is not in the published Storybook
  yet, so its link opens Storybook's missing-story page. The link of a changed
  story opens the main branch's version.
- **Impact if no action:** Reviewers of a branch that adds stories meet dead
  links in Changes.
- **Root question:** Where does a story page link when the published
  Storybook does not hold the shown version of the story?
- **Options:**
  - **A.** Change nothing. The link of an added story opens a missing page.
    Effort: Small.
  - **B.** Leave the link out of the page of an added entry. A changed story
    keeps its link. While Changes is not ready, and in a build without
    Changes, every story page shows its link. Effort: Small.
  - **C.** Keep every link, and name its target, for example "Open published
    story". The link of an added story still fails. Effort: Small.
  - **D.** Let a build give the Storybook URL of the branch, for example
    through a command-line option for pull request previews. Each link then
    opens the branch's own Storybook. Effort: Medium.
  - **F.** The viewer reads the story index of the published Storybook once
    in each session, and shows the link only for a story that the index
    holds. The build stays offline. The Storybook host must allow
    cross-origin reads, and the shell contacts it on each visit. Effort:
    Medium.
- **Left out:** E, a check of the story index at build time, makes the read
  model depend on the network. Two builds of one commit could then give
  different deployment ids, which the delivery rules forbid.
- **Wider fix:** None, because the item is one design choice, not a class of
  defect.
- **Previous examples:** None found.
- **Related:** Milestones 26 to 28 wait for this answer.
- **Recommendation:** B. One condition removes the dead link where Changes
  knows that the entry is new. F is the only option that is also right
  without Changes, at Medium effort.
- **Action:** ask the user, because the option narrows decision 15, a
  decision in force, and no user decision covers that change.

### 24. Failed edits claim the last valid props

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation, with option E and the root question from the
  options check.
- **Category:** UX wording.
- **Location:** `examples/basic/specs/design/components/controls/parts/copy.ts:51`
  and `:54`.
- **Background:**
  - In Serve, the Props tab edits props and renders the preview again.
  - When an edit fails or is invalid, the shell keeps the shown preview and
    says "The preview shows the last valid props."
  - The mockups let the reader edit the props of the failed Expanded story.
- **Problem:** When no edit has rendered and the saved props failed, the
  preview shows the saved view, here the error document. "The last valid
  props" is then false. This holds for every entry whose saved render fails,
  not only for stories.
- **Impact if no action:** The shell gives a false sentence after a failed
  edit of a story that cannot render.
- **Root question:** How does the Props tab say truthfully what the preview
  shows after an edit fails or is invalid, also when the saved props never
  rendered?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Change both sentences to one that is true in every case, for
    example "Your edits are kept. Reset to go back to the saved props."
    Effort: Small.
  - **C.** A failed live render of a story returns its error document, as the
    build does, so the preview shows the reason of each failed edit. The live
    route then gives a reason, which its rules keep generic today. Effort:
    Medium.
  - **D.** Make the props of a failed story read-only. The reader then cannot
    try props that render, such as `open: false`. Effort: Medium.
  - **E.** Choose the sentence from the preview that the frame shows. Until an
    edit has rendered, it reads "Your edits are kept. The preview shows the
    saved props.", the settled sentence of an expired preview. After an edit
    has rendered, it keeps "the last valid props". Effort: Small.
- **Left out:** None.
- **Wider fix:** E. The copy follows the real state of the frame, so it stays
  true when the cause changes.
- **Previous examples:** None found.
- **Related:** B and E change the viewer, and track F has no UI milestone yet.
  The answer adds one.
- **Recommendation:** E. Each sentence then matches the frame, with no new
  copy.
- **Action:** ask the user, because the option changes which settled sentence
  the shell shows, a user-visible change that no decision covers.

### 25. The first story's name never shows

- **Severity:** Low. **Effort:** Medium.
- **Source:** Implementation, with option E and the root question from the
  options check.
- **Category:** Mockup.
- **Location:** `examples/basic/specs/design/components/parts/metadata.ts`.
- **Background:**
  - Decision 3 makes the first story the parent page, and decision 14 keeps
    Storybook's story names.
  - In the mockups, the Menu page renders the Collapsed story. Its title, its
    tree row, and its variant bar say "Menu".
  - The read model holds no story name today.
- **Problem:** No part of the catalogue names the Collapsed story. Its
  Storybook link opens a story called Collapsed, and a search for Collapsed
  finds nothing.
- **Impact if no action:** Readers cannot find the first story of a stories
  file by its Storybook name.
- **Root question:** How does a reader who knows a story's Storybook name
  recognize and find the page that renders it?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** The Details of a stories entry name the shown story in a Story
    row, for example "Collapsed". It needs a new read-model field. Effort:
    Medium.
  - **C.** The variant bar labels the parent's own option with the first
    story's name, so that it reads "Collapsed, Expanded". Effort: Medium.
  - **D.** Search also finds a parent page by its first story's name. Effort:
    Medium.
  - **E.** B and D on one read-model field: Details show the story's name, and
    search matches it. A common name, such as Default, then matches many
    parents, as in Storybook's own search. Effort: Medium.
- **Left out:** A first story that is a variant of its own reverses decision
  3, which stays.
- **Wider fix:** None, because the item is one design choice.
- **Previous examples:** None found.
- **Related:** Milestones 26 to 28 wait for this answer. D and E change the
  search rule in `docs/protocol/mokly-folders.md`.
- **Recommendation:** E. One field lets the reader both see and find the
  story. B is the smaller option if search may skip the name.
- **Action:** ask the user, because the option adds a Details row and changes
  the search rule, and no user decision covers either.

### 26. Error document styles in dark views

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `examples/basic/design-component-view.css`.
- **Background:**
  - Each view renders in a color scheme. The stylesheet rules of the
    configuration link the project's stylesheets into each view of a
    matching route.
  - The component design mockups are light only, so they show only the light
    error document.
- **Problem:** No rule says which styles the error document carries, or
  whether a dark view gets a dark error document. Project CSS, such as a
  reset, can change its layout.
- **Impact if no action:** A dark view can show a light error document,
  project CSS can break it, and an edit of project CSS can mark a failed view
  as changed.
- **Root question:** How does the error document look right in every project
  and in every scheme?
- **Options:**
  - **A.** The document carries only its own styles, with system colors that
    follow the view's scheme. Effort: Small.
  - **B.** The document carries only its own styles, and is always light.
    Effort: Small.
  - **C.** The document carries its own styles and the project stylesheets of
    the view. Effort: Small.
- **Left out:** None.
- **Wider fix:** None, because one rule covers every failed view.
- **Previous examples:** None found.
- **Related:** Milestone 23 waits for this answer.
- **Recommendation:** A. The document reads the same in every project,
  matches its frame, and stays out of Changes when project CSS changes.
- **Action:** ask the user, because the option makes the stylesheet rules
  skip a failed view, and no decision covers that.

### 27. The Storybook link leaves the catalogue

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation, with options C and D and the root question from
  the options check.
- **Category:** Docs or spec.
- **Location:** `examples/basic/specs/design/components/parts/component_info.tsx`.
- **Background:**
  - The shell's metadata link opens in the same tab. The mockups draw the
    Storybook link as a picture without an address, because a design link
    opens a design entry.
  - In Serve, leaving the page discards the reader's prop edits.
  - A React host that embeds the viewer also leaves its own page.
- **Problem:** No rule says where the published Storybook opens.
- **Impact if no action:** A reader who opens Storybook loses their place and
  their prop edits.
- **Root question:** How does a reader open the story in the published
  Storybook without losing their place or their prop edits?
- **Options:**
  - **A.** Open it in the same tab, as the shell's metadata link does.
    Effort: Small.
  - **B.** Open it in a new tab, with `rel="noreferrer"`, and with an icon and
    a screen-reader label that say so. Effort: Small.
  - **C.** Keep the same tab, and keep the edits in the tab's session storage,
    so that Back restores them. This changes the rule that edits are
    temporary. Effort: Medium.
  - **D.** Keep the same tab, and ask the browser to confirm a page exit while
    edits are unsaved. The dialog interrupts each exit. Effort: Small.
- **Left out:** A frame of the published story inside the shell replaces the
  link that decision 15 chose.
- **Wider fix:** None. If B is chosen, one package component for links that
  leave the catalogue keeps later links the same.
- **Previous examples:** None found.
- **Related:** Milestones 26 and 28 wait for this answer.
- **Recommendation:** B. It keeps the catalogue, the edits, and the host page,
  with the smallest change.
- **Action:** ask the user, because the option adds link behaviour that no
  requirement covers.

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
    watcher invalidates changed modules. Decision 18 settles several
    folders. Reason: a sidecar process serves one source root.
19. Mokly resolves `vite` from the project. Decision 22 settles a missing
    `vite`. Reason: Mokly ships no private runtime.
20. Under the adapter, Mokly removes Storybook's browser-only plugins, such
    as its entry, docgen, globals, and stats plugins, with the public
    `withoutVitePlugins` helper. Reason: a render does not need them.
21. Under the adapter, Mokly requests each local stylesheet through the Vite
    setup as an inline module. Reason: plugins such as Tailwind's then run.
22. The optional file exports `defineMoklyVite` from `@mokly/mokly/vite`. Its
    `app()` and `storybook()` loaders run only when called. For one
    Storybook folder it returns one setup. Decision 18 settles several
    folders. Reason: a project can avoid a broken Storybook release.
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
26. Made on 2026-11-18 in track A. The reason in an error document holds no
    absolute path. A path inside the repository or the base cache reads
    relative to the repository root, and the reason leaves out other
    absolute paths. Reason: identical inputs give identical bytes, and the
    checkout folder is not an input, so one failure gives one document on
    both sides and on every machine.
27. Made on 2026-11-18 in track A. A view whose story could not render has an
    explicit empty usage record with an empty root region, and the error
    document lies outside that region. Highlight components then reads "No
    registered components are used in this view.", as the mockups show, and
    every Used by and Affected list stays complete. Reason: a null render is
    already an empty region, and a view without usage would remove every
    workspace list of the catalogue while one story fails.
28. Made on 2026-11-18 in track A. The mockups of Milestone 1 settle the look
    of both states. The error document starts where the story would render.
    It names only the story, gives the `!mokly` tag as its one action, and
    gives the reason last, under "Reason". Changes shows a failed story as an
    ordinary changed variant. The Storybook link is a Details row,
    "Storybook", directly below Source, with the text "Open in Storybook".
    The mockups draw it as a picture without an address. Reason: the page
    around the document already names the component, the shell does not
    change for failed stories, and a design link opens a design entry.

## Tracks

Each track runs in its own workspace, as design calls 1 and 25 say. A track
starts when each milestone on the `Depends on:` lines of its first milestones
has merged into this branch, and when the open decisions that block it have
answers. The ledger of the workspaces is in
`.context/storybook-support/workspaces.md`.

| Track                      | Milestones | Starts after                                     |
| -------------------------- | ---------- | ------------------------------------------------ |
| A. Mockups                 | 1          | Nothing                                          |
| B. Story reading           | 2 to 8     | Nothing                                          |
| C. Imported assets         | 9 to 12    | Nothing                                          |
| D. Vite adapter            | 13 to 17   | Nothing. Milestone 14 also waits for decision 22 |
| E. Storybook folders       | 18 to 22   | Track B. Milestone 20 also waits for decision 20 |
| F. Failed stories          | 23 to 25   | Tracks A and B, and decisions 24 and 26          |
| G. Storybook links         | 26 to 29   | Tracks A and E, and decisions 23, 25, and 27     |
| H. Storybook setup on Vite | 30 to 33   | Tracks C, D, and E, and decision 18              |
| I. Story component usage   | 34 to 36   | Tracks B and D, and decisions 19 and 21          |

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

- [x] Add the state of a story that could not render to the component design
      pages under `examples/basic/specs/design/components/states`, desktop
      and mobile, as a child page when the states page would pass five
      mockups. The error document names the story, says that it could not
      render, gives the reason in a secondary place, and gives the `!mokly`
      tag as the way to leave the story out. Add its row to
      `docs/protocol/mokly-component-design-inventory.md`. Branch:
      `conductor/storybook-support-a-mockups`.
- [x] Add the Storybook link to the component page of a stories entry,
      desktop and mobile, beside the entry's source details. Add its row to
      the design inventory. Branch: `conductor/storybook-support-a-mockups`.
- [x] Follow the copy rules and the forbidden patterns of the `product-ui`
      skill. Branch: `conductor/storybook-support-a-mockups`.
- [x] Run the mockup check named in `AGENTS.md`. Smoke-test the changed
      pages through `npm run dev`. Branch:
      `conductor/storybook-support-a-mockups`.
- [x] Update the design and the TODOs of this plan for each problem that the
      mockups show. Branch: `conductor/storybook-support-a-mockups`.
- [ ] Update the mockups for the answers to decisions 25 and 27. Branch:
      `conductor/storybook-support-a-mockups`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.
      Branch: `conductor/storybook-support-a-mockups`.

Evidence: `.context/storybook-support/evidence/` holds the mockup check, the
Serve smoke test, and the screenshots.

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

- [ ] Add `docs/protocol/mokly-vite-adapter.md`: the `vite` field, the setup
      for a catalogue without a Storybook folder, the optional file, the
      duties of Mokly's plugin, one React runtime, the base side,
      invalidation in Serve, and stylesheet transforms. Link it from
      `docs/protocol/README.md` and from the bundling section of
      `docs/protocol/mokly-sidecar.md`. Add the status line.
- [ ] Update `docs/protocol/mokly-configuration.md` with the `vite` field.
- [ ] Update `docs/protocol/mokly-configuration-imported-styles.md`: under
      the Vite adapter, Vite transforms each local stylesheet in place of the
      PostCSS module.
- [ ] Update `docs/architecture/rust-core.md` and
      `docs/architecture/package-boundary.md` for the Vite adapter as a
      second compile path.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 14: Vite adapter core

Depends on: 13, and the answer to decision 22

The project's Vite setup compiles JavaScript, as decision 16 says.

- [ ] Add the `vite` field to the configuration and its schema, as design
      call 17 says.
- [ ] Resolve `vite` as design call 19 says, and apply the answer to
      decision 22.
- [ ] Run one Vite server for each sidecar process, as design call 18 says.
- [ ] Add the Mokly Vite plugin: the entry module, the authoring facade, the
      runtime module, CSS Modules maps, the JSX development shim, confinement
      and logical names, consumed bytes, and the module graph.
- [ ] Evaluate the entry through Vite's module runner with one React
      runtime. Keep Mokly's stylesheet pipeline in this milestone.
- [ ] Load the app's `vite.config.*` when no root names a Storybook folder,
      as decision 17 says.
- [ ] Test a Vite fixture with an alias, `import.meta.env`, a `?raw` import,
      and the SVGR plugin in `build`.
- [ ] Add `docs/guides/authoring/vite.md`, and update the
      `packages/mokly/README.md` key code.

## Milestone 15: Vite adapter on the base side and in Serve

Depends on: 14

- [ ] Compile the base side with the base commit's Vite setup in its
      extraction, with the selected installation.
- [ ] Invalidate changed modules from Mokly's watcher in Serve.
- [ ] Test Changes between two commits of a Vite fixture, and a Serve edit.

## Milestone 16: Stylesheets through Vite

Depends on: 14

- [ ] Transform each local stylesheet as design call 21 says, in place of
      the configured PostCSS module.
- [ ] Keep Mokly's order, bundling, delivery, and attribution on the result.
- [ ] Test Sass, CSS Modules class names, and Tailwind's Vite plugin.
- [ ] Update `docs/guides/authoring/vite.md` and
      `docs/guides/authoring/styles.md`.

## Milestone 17: Vite adapter verification, review, and pull request

Depends on: 13, 14, 15, 16

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 18: Storybook folders documentation

Depends on: 8

Track E. The protocol states the rules of decisions 4 and 9.

- [ ] Add the rules for Storybook folders and `main.*` to
      `docs/protocol/mokly-storybook.md`, without the rule that decision 20
      settles.
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

Depends on: 19, and the answer to decision 20

- [ ] Apply the answer to decision 20 on both sides of a comparison.
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

Depends on: 1, 8, and the answers to decisions 24 and 26

Track F. The protocol states the failure rules of decision 5.

- [ ] Add the render failure rules to `docs/protocol/mokly-storybook.md`.
- [ ] State there the reason rule of design call 26, the usage rule of
      design call 27, and the answers to decisions 24 and 26.
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
- [ ] Test that a reason with a path in the repository gives the same error
      document on both sides, and that a failed story keeps every Used by
      and Affected list, as design calls 26 and 27 say.
- [ ] Update `docs/guides/authoring/storybook.md`.

## Milestone 25: Failed stories verification, review, and pull request

Depends on: 23, 24

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 26: Storybook links documentation

Depends on: 1, 22, and the answers to decisions 23, 25, and 27

Track G. The protocol states the link rules of decision 15.

- [ ] Add the Storybook link rule to `docs/protocol/mokly-storybook.md`.
- [ ] State there the answers to decisions 23, 25, and 27.
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
      requires. Give it a form without an address there, as the mockups draw
      it, because a design link opens a design entry and the design library
      checks reject an external address.
- [ ] Add tests under `packages/ui/tests` and `packages/viewer/tests`, and a
      browser spec.

## Milestone 29: Storybook links verification, review, and pull request

Depends on: 26, 27, 28

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 30: Storybook setup on Vite documentation

Depends on: 12, 17, 22, and the answer to decision 18

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

Depends on: 8, 17, and the answers to decisions 19 and 21

Track I. The protocol states the usage rules of decision 13, with the
answers to decisions 19 and 21.

- [ ] Update `docs/protocol/mokly-instances.md` and
      `docs/protocol/mokly-component-changes.md` with those answers.
- [ ] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 35: Story component usage

Depends on: 34

Screens that render a story component record its use, as decision 13 says.

- [ ] Record an instance of a stories entry in the JSX development shim when
      a screen renders its meta's `component`, or a `memo` or `forwardRef`
      wrapper of it, on both compile paths.
- [ ] Give each such use the id that decision 19 chooses.
- [ ] Keep the content of each use in Changes as decision 21 chooses.
- [ ] Record option F of decision 19 as a follow-up item when the answer is
      B.
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

## Milestone 37: Verification, commit, review, and pull request

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
