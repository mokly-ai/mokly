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
- **Spike result:** E works with Vite 8.3.8, as far as the spike of
  Milestone 37 tested it on 2026-11-19, with an emulation of Storybook's
  setup. One Vite server for each Storybook folder and one module runner
  compiled each module once, in the server that owns it, with that setup's
  aliases, plugins, Vite env values, and mocks. Each module kept one
  identity and one place in one module graph, also on the base side, in a
  replay, and after an edit. So a story that renders a module of another
  folder sees that module as the other folder's setup compiles it. Identity
  holds for each resolved file: two setups that resolve one import to
  different files give two modules. One server with an environment for
  each folder failed, because Vite shares the root, the env files, and the
  aliases across the environments of one server. Two extra servers added
  about 40 ms of startup and four added about 70 ms, with 3 to 9 MiB more
  peak memory and compile times within noise, without Storybook's presets.
  The spike loaded no real Storybook preset, so two risks stay for
  Milestone 32: the presets of two folders must load in one process, and
  Storybook's env preset is process-wide. Design call 18 gives the rules,
  and decisions 18a to 18d settle the open questions.

### 18a. Files that no Storybook folder owns

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation, from the spike of Milestone 37.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:**
  - Option E of decision 18 compiles each file with the setup of the
    Storybook folder whose parent directory holds it.
  - Some files have no such folder: mockups outside every Storybook
    package, shared packages without a Storybook folder, installed packages
    in the root `node_modules` that a setup compiles, and Mokly's virtual
    entry.
  - With one Storybook folder, decision 17 compiles every JavaScript entry
    with that folder's setup.
  - A root without the `storybook` field uses the `.storybook` folder of the
    source root, as design call 12 says. When that folder exists, its parent
    holds every file, so this decision applies only without it.
  - The spike compiled these files once, with a fallback setup. It tried the
    app setup of the configuration directory and the setup of the first
    folder, and both kept one identity for each module.
- **Problem:** When roots name several Storybook folders, no rule says which
  setup compiles a file that no folder owns.
- **Impact if no action:** Milestone 30 cannot state the setup of a shared
  file, and two implementations can compile it differently.
- **Root question:** Which setup compiles a file that no Storybook folder
  owns, so that the file compiles once, with a setup that its importers can
  use?
- **Options:**
  - **A.** The app setup of the configuration directory, as for a catalogue
    without a Storybook folder. This adds one Vite server. A shared file
    that needs a plugin that only the Storybook setups have, such as SVGR,
    fails. The app setup lacks Storybook's resolve conditions, so a shared
    file can resolve a package to another file than the stories do, and the
    package then loads twice. Effort: Small.
  - **B.** The setup of the first root, in configuration order, that names a
    Storybook folder. This adds no server, and a catalogue with one folder
    keeps the setup of decision 17 when it adds a second folder. A change of
    root order changes the setup of these files. Effort: Small.
  - **C.** The optional file must name the setup of these files when roots
    name several folders. Without it, the configuration check fails and
    names the file. Effort: Small.
  - **D.** B, and an optional field of the `vite` object maps directory globs
    to Storybook folders. A file that a glob matches compiles with that
    folder's setup. The field wins over B and over the rules of decisions
    18b and 18c. It adds a field, its validation, and its docs. Effort:
    Medium.
  - **E.** These files compile with one setup merged from the setups of
    every folder, as option D of decision 18 proposed for the whole
    catalogue. Plugins with the same name load once, and one alias key
    keeps one target. A plugin can run at a root that is not its own. This
    adds one Vite server. Effort: Medium.
- **Left out:** The setup of the first importer: an unrelated edit could
  then change the setup, and with it the output, of a shared file. A failure
  for each file that no folder owns: shared packages without a Storybook
  folder are common, and C gives the same explicit choice once. A copy of
  each such file for the setup of each importer: it breaks the one identity
  that option E of decision 18 requires.
- **Wider fix:** None, because this is one missing rule.
- **Previous examples:** Option B of decision 18 used the first root that
  names a folder as its default.
- **Related:** Decision 18c can give the files of a root to the folder that
  the root names, so fewer files need this setup. Decision 18b can move a
  mocked file away from this setup. Design call 22 runs the optional file
  once for each setup.
- **Recommendation:** B. Shared files then compile with a Storybook setup
  and its resolve conditions, as decision 17 does for one folder, and no
  extra server starts. D can follow later without a breaking change.
- **Action:** ask the user, because option E does not settle these files,
  A and B trade a fixed app setup against continuity with decision 17, and
  C adds a configuration error.

### 18b. Mocks of modules that another setup owns

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation, from the spike of Milestone 37.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:**
  - Storybook applies `sb.mock()` in the plugin hooks of the Vite server
    that loads the mocked module. The mock calls come from that server's
    preview file.
  - Under option E of decision 18, the server of the folder that owns a
    module loads it. So a preview's mock reaches only the modules of its own
    folder.
  - In its own Storybook, a preview's mock of a shared file or an installed
    package reaches every import of that module.
  - npm and pnpm workspaces usually install packages in the root
    `node_modules`, which no folder owns.
  - The spike showed both sides. The app preview's mock of a shared file did
    not apply. An override that gave the file to the app setup made the mock
    apply for every importer.
- **Problem:** A preview's mock of a module that another setup owns has no
  effect, because one module has one identity for all its importers.
- **Impact if no action:** Stories that rely on such a mock render the real
  module, which can differ from their Storybook or fail.
- **Root question:** Which stories see a preview's `sb.mock()` of a module
  that another setup compiles, when the module has one version for all its
  importers? The options check of 2026-11-19 wrote this question, because
  A and D answer that the mock does not reach the module.
- **Options:**
  - **A.** Keep the location rule. A preview's mock applies only to the
    modules of its folder, and the guide states the limit. Mocks of shared
    files and of packages in the root `node_modules` then never apply.
    Effort: Small.
  - **B.** A module that a preview mocks belongs to the setup of that
    preview, and it compiles with that whole setup. The mock then applies
    for every importer, also in the stories of other folders, which their
    own Storybook renders with the real module. When two previews mock one
    module, the first root in configuration order wins. Effort: Medium.
  - **C.** B, and a warning when two previews mock one module. The warning
    fails `--strict`. Effort: Medium.
  - **D.** A, and a warning when a preview mocks a module outside its
    folder. The warning fails `--strict`. Effort: Small.
  - **E.** B only for a module that no folder owns, such as a shared file or
    a package in the root `node_modules`. A module that a folder owns stays
    with that folder, so the mock of another folder has no effect on it, and
    the owner's own mock applies. When two previews mock a module that no
    folder owns, the first root in configuration order wins. Effort: Medium.
- **Left out:** A mocked and a real copy of the module for each folder: each
  module that imports it would need a copy too, so components would lose
  one identity. A module graph for each folder: that is option C of
  decision 18, which the user did not choose. The mocks of every preview in
  the server that owns the module, without a move: the mocked code would
  compile with a setup that no Storybook uses for that mock. A move only
  while every importer is in the mocking folder: an unrelated import could
  then move the module and change its output.
- **Wider fix:** B, because one rule covers every mock target, also
  installed packages.
- **Previous examples:** None found.
- **Related:** Decision 18a: B and E move a mocked file away from the setup
  of 18a. Design call J2 in Milestone 37: an installed package must compile
  in Vite before any mock reaches it. Design call 18: the redirect file of a
  moved module can belong to another server, so every server gets each
  change.
- **Recommendation:** E, changed from B by the options check of
  2026-11-19. Mocks let stories render without real services, and E keeps
  that for shared files and installed packages, which A loses in every
  monorepo that installs packages at the root. Unlike B, E never compiles a
  folder's own module with another folder's setup, and root order never
  replaces a folder's own mock. B reaches the most mock targets.
- **Action:** ask the user, because B and E change the stories of a folder
  that did not ask for the mock, and C and D add a warning that fails
  `--strict`.

### 18c. A root whose Storybook folder lies elsewhere

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Review, from the independent check of the spike.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:**
  - Decision 9 lets each root name its Storybook folder, and Mokly reads
    `main.*` there.
  - Some monorepos keep one central Storybook folder, such as
    `apps/storybook/.storybook`, whose `main.*` lists the stories of other
    packages.
  - Option E of decision 18 chooses the setup by location: the deepest
    Storybook folder whose parent directory holds the file.
  - So when roots name several folders, the stories of a root whose
    folder's parent does not hold them get another setup: the setup of
    another folder, or of decision 18a.
  - With one folder, decision 17 gives its setup to every file, so the
    problem needs several folders.
- **Problem:** The files of a root can compile with another setup than the
  setup of the folder that the root names.
- **Impact if no action:** In a monorepo with a central Storybook and a
  second folder, the central Storybook's stories compile without its
  aliases, plugins, and mocks, and nothing warns.
- **Root question:** How do the stories of a root, and the files beside
  them, get the setup of the folder that the root names, when the parent of
  that folder does not hold them? The options check of 2026-11-19 wrote
  this question, because the usual layout, a root `packages/ui/src` with
  the folder `packages/ui/.storybook`, has no problem.
- **Options:**
  - **A.** Keep the location rule of option E. Such files get the setup of
    the folder that holds them, or of decision 18a, and the guide states the
    limit. Effort: Small.
  - **B.** A file inside the directory of a root that names a folder belongs
    to that folder. When two such roots hold a file, the deepest root
    decides. The location rule decides only for the other files. Effort:
    Medium.
  - **C.** Fail the configuration check when roots name several folders and
    the directory of a root lies outside its folder's parent. This adds a
    configuration error. Effort: Small.
  - **D.** B, but a file that the globs of a root match takes the folder of
    that root when the root names one. Root discovery already records the
    root of each matched file. The deepest root decides only for the other
    files in root directories. A story then compiles with the folder whose
    preview it gets under decision 9. Effort: Medium.
- **Left out:** The setup of the first story that imports a file: an
  unrelated edit could then change the setup of a shared file.
- **Wider fix:** D, because the field that the root sets then decides for
  every layout, also for matched files inside a deeper root's directory.
- **Previous examples:** None found.
- **Related:** Decision 18a gives the setup of the files that no rule
  assigns. Decision 20 settles roots without `dir`, which take their files
  from `main.*`.
- **Recommendation:** D, changed from B by the options check of
  2026-11-19. Stories then compile with the folder that their root names,
  as decision 9 intends, and with the same folder whose preview they get.
  B can compile a story with one folder's setup and render it with another
  folder's preview. With a folder in each package, D gives the same setup
  as the location rule.
- **Action:** ask the user, because B and D change the ownership rule of
  option E, which the user chose, and C adds a configuration error.

### 18d. Storybook env values of several folders in one process

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Review, from the independent check of the spike.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:**
  - Storybook's setup defines its `import.meta.env.STORYBOOK_*` values from
    its `env` preset. These values win over the values that Vite loads.
  - The preset reads the `.env` files of one app root. It takes the root
    from the working directory when its module first loads, and it writes
    the values into the process environment.
  - A sidecar process keeps the source root as its working directory. Under
    option E of decision 18, one process loads the presets of every folder.
  - The spike emulated Storybook without this preset, so its env check
    passed. The check read the preset's source in Storybook 10.6.2.
- **Problem:** In one process, every Storybook folder gets the
  `STORYBOOK_*` values of the source root. A folder's own Storybook, run
  from its package, reads the `.env` files of the package.
- **Impact if no action:** A story that reads a `STORYBOOK_*` value can
  render with another value than in its own Storybook. This also holds for
  one folder whose parent is not the source root.
- **Root question:** How do the stories of each folder get the `env`
  preset values of their own Storybook, when the working directory of the
  sidecar is not the folder's parent? The options check of 2026-11-19 wrote
  this question, because the values also come from the shell and from
  `main.*`, and one folder has the same problem.
- **Options:**
  - **A.** One set for the whole process, from the source root, as
    Storybook's preset gives it. The guide states it. The preset also
    writes the source root's `.env` values into the process environment,
    and Vite prefers those, so they replace each folder's `VITE_*` values
    too. Effort: Small.
  - **B.** Each folder's values come from the `.env` files of its parent, as
    Vite loads them for its server. Mokly removes Storybook's env plugin, as
    design call 20 removes other plugins, and it keeps the process
    environment as it was before the presets loaded. Mokly sets Storybook's
    fixed variables, such as `STORYBOOK`, itself. Values that a `main.*`
    file adds through its `env` preset are lost. Effort: Medium.
  - **C.** Run the setup and the Vite server of each folder in a child
    process, with the folder's parent as its working directory. The module
    runner reaches them across processes. Effort: Large.
  - **D.** Keep Storybook's env plugin. A Mokly preset after Storybook's core
    presets replaces the core `STORYBOOK_*` values with the values that Vite
    loads from the folder's parent. An `env` preset from `main.*` or an
    addon still adds its values. Mokly restores the process environment
    after the presets of each folder load. This depends on the preset order
    of Storybook's loader: core presets first, then `main.*`. Effort:
    Medium.
- **Left out:** A new app root for each folder before its presets load: the
  preset fixes its `.env` path when its module first loads, so a later
  folder cannot change it. A fresh copy of Storybook's env module for each
  folder: that module is a private chunk whose name changes with each
  release, so it fails in the tested range of design call 13. A temporary
  working directory for each folder: a sidecar keeps one working directory
  for its whole lifetime, as `docs/protocol/mokly-sidecar-modules.md` says.
- **Wider fix:** C, because it isolates every process-wide Storybook state.
- **Previous examples:** None found.
- **Related:** Design call 20 removes Storybook's browser-only plugins.
  Milestone 32 first loads the presets of two folders in one process.
- **Recommendation:** D, changed from B by the options check of
  2026-11-19. Each folder then gets the values that its own Storybook reads
  when it runs from its package, and the `env` presets of `main.*` and of
  addons keep their values, which B removes. C isolates the most state, at
  a Large cost.
- **Action:** ask the user, because A, B, and D trade Storybook's own env
  preset against each folder's own values, and C is Large.

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
18. Changed on 2026-11-19, after the spike of Milestone 37. Each sidecar
    process runs one Vite server for each setup of its source root, from
    the side's own installation, with no HTTP server, watcher, hot module
    replacement, or pre-transform requests. A catalogue with one Storybook
    folder or none has one setup. When roots name several folders, each
    folder gets a server rooted at its parent. A root without the
    `storybook` field names the `.storybook` folder of the source root when
    that folder exists, as design call 12 says. A file belongs to the
    deepest folder whose parent directory holds its real path, as option E
    says, unless decision 18c or 18a gives it another setup. A file inside a
    selected dependency root takes its owner from that root's path relative
    to the source root, so both sides give it one owner. An id with a query
    belongs to its file. An id that is not a file is a virtual module of the
    server that resolved it. The setup that owns a package decides, for
    every importer, whether Vite compiles it or Node loads it. One module
    runner from the same installation evaluates every module once. An
    import resolves in the server that compiled its importer, and the module
    compiles in the server that owns it. Before the runner caches an
    import, Mokly turns its specifier into a URL that no other module
    shares. Mokly's watcher sends each changed file to every server, which
    invalidates it and passes the change to its plugins. Reason: a sidecar
    process serves one source root, and the spike kept each package's setup
    and each module's identity this way. A transport that only routed
    requests let the URLs of two servers collide in the runner's cache.
    Invalidation in the owner alone missed a file that a plugin of another
    server read. The first version named one server for each folder without
    these rules.
19. Mokly resolves `vite` from the project. A missing `vite` fails `bundle`
    with `bundle-failed`, as decision 22 chose. Reason: Mokly ships no
    private runtime.
20. Under the adapter, Mokly removes Storybook's browser-only plugins, such
    as its entry, docgen, globals, and stats plugins, with the public
    `withoutVitePlugins` helper. Reason: a render does not need them.
21. Under the adapter, Mokly requests each local stylesheet through the Vite
    setup as an inline module. Reason: plugins such as Tailwind's then run.
22. Changed on 2026-11-19, after the spike of Milestone 37. The optional
    file exports `defineMoklyVite` from `@mokly/mokly/vite`. Mokly calls its
    default export once for each setup of design call 18, with the setup's
    Storybook folder, or with none. The `app()` loader loads the Vite config
    of the folder's parent, or of the configuration directory without a
    folder. The `storybook()` loader loads the folder's merged Storybook
    setup. Each loader runs only when called, and each call returns one
    setup. Reason: a project can avoid a broken Storybook release in each
    folder, and a catalogue with one folder keeps one call. The first
    version left the shape for several folders to the spike.
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

| Track                      | Milestones | Starts after                                    |
| -------------------------- | ---------- | ----------------------------------------------- |
| A. Mockups                 | 1          | Nothing                                         |
| B. Story reading           | 2 to 8     | Nothing                                         |
| C. Imported assets         | 9 to 12    | Nothing                                         |
| D. Vite adapter            | 13 to 17   | Nothing                                         |
| E. Storybook folders       | 18 to 22   | Track B                                         |
| F. Failed stories          | 23 to 25   | Tracks A and B                                  |
| G. Storybook links         | 26 to 29   | Tracks A and E                                  |
| H. Storybook setup on Vite | 30 to 33   | Tracks C, D, E, and J, and decisions 18a to 18d |
| I. Story component usage   | 34 to 36   | Tracks B and D                                  |
| J. Spike for decision 18   | 37         | Nothing                                         |

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

Depends on: 12, 17, 22, 37, and the answers to decisions 18a to 18d

Track H. The protocol states the Storybook setup rules of decision 17, with
the answer to decision 18, and the `sb.mock()` warning of decision 12.

- [ ] Add the Storybook setup rules to `docs/protocol/mokly-vite-adapter.md`,
      or to a new linked page when that page would pass 250 lines. For
      several Storybook folders, state option E of decision 18 as design
      call 18 found it: each file compiles once, with the setup that owns it
      under the answers to decisions 18a and 18c. Each module keeps one
      identity and one place in the module graph, with the aliases,
      plugins, env values, and mocks of the setup that owns it, also when a
      story of another folder imports it. Identity holds for each resolved
      file. Add the answers to decisions 18b and 18d and the rules of design
      calls J1 and J2. State the requirements, not the servers or the
      transport.
- [ ] Update `docs/protocol/mokly-configuration.md` for option E of
      decision 18, the answers to decisions 18a and 18c, and the optional
      file of design call 22.
- [ ] Update `docs/protocol/mokly-build-warnings.md` with
      `storybook-mock-without-vite`, and with the warning of decision 18b
      when its answer adds one.
- [ ] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 31: Imported assets on the Vite adapter

Depends on: 12, 17

- [ ] Turn Vite's asset URLs into Mokly asset tokens, so that the delivery
      of Milestone 10 applies.
- [ ] Test an imported image under the adapter.

## Milestone 32: Storybook's setup on the Vite adapter

Depends on: 30

- [ ] Before the other TODOs of this milestone, load the presets of two
      Storybook folders in one process with Storybook's preset loader, and
      check that each folder gets its own merged setup. When it fails, give
      decision 18 back to the user with the evidence, because option E then
      needs a process for each folder.
- [ ] Load Storybook's merged setup with its preset loader, with
      `viteCorePlugins` and `viteFinal`, for each Storybook folder, as
      decision 17 says. With one folder, that setup compiles every
      JavaScript entry.
- [ ] Load the base commit's Storybook setups for the base side, so that
      both sides compile with their own setups.
- [ ] Remove Storybook's browser-only plugins, as design call 20 says.
- [ ] Add the optional file and `@mokly/mokly/vite`, as design call 22 says.
- [ ] Install the mocker global of design call 24.
- [ ] Apply option E of decision 18, as design call 18 says: one Vite server
      for each Storybook folder, the owners of decisions 18a and 18c, and one
      module runner whose evaluator gives each import a URL that is unique
      across servers. Keep pre-transform requests off in every server. Send
      every `react` and `react-dom` import of every server, also inside
      externalized packages, to the one React runtime of Milestone 14. Send
      each watched change to every server. No configuration field changes.
- [ ] Read the module graph across servers: each module's imports in order
      from its transformed code, after every plugin of its setup; its
      consumed bytes from the code that its load step returns; and the files
      that plugins register for it as inputs. Store every transport answer
      in the compiled recipe at bundle time, also the list of Node built-in
      modules.
- [ ] Give the server environment the resolve conditions of design call J1.
- [ ] Compile in Vite each installed package that a preview mocks, as design
      call J2 says. Apply the answer to decision 18b to the mocks of modules
      that another setup owns.
- [ ] Give each folder the `STORYBOOK_*` values that the answer to decision
      18d chooses.
- [ ] Add the `storybook-mock-without-vite` warning, as design call 23 says.
- [ ] Test the supported Storybook range in CI with a `react-vite` fixture
      and a `nextjs-vite` fixture. Add the development packages under the
      dependency rules.
- [ ] Test that `__mocks__` redirects, automocks, and spies of `sb.mock()`
      render, also for a package whose Node entry differs from its browser
      entry, that a `viteFinal` plugin applies to stories and mockups, that
      the optional file removes a plugin, and that Changes compiles both
      sides with their own Storybook setup. Storybook resolves the target
      of a package mock with browser conditions, so record that limit when
      the mock misses the Node entry.
- [ ] Test a catalogue with two Storybook folders whose setups differ in an
      alias, a plugin, an env value, and a mock, with a module that both
      import, a folder inside another folder's parent, and a root whose
      folder lies elsewhere. Each file compiles with the setup that owns it,
      the shared module evaluates once, and files and virtual modules whose
      URLs collide across servers reach the right module. The module graph
      lists the imports that plugins add. A Serve edit of a file that a
      plugin of another server reads, a replay, and Changes work, also with
      a base side that reads the working installation.
- [ ] Record the startup time and the memory of two Storybook folders
      against one, with Storybook's preset loader, under
      `.context/storybook-support/`.
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

Design calls of track J. These calls are the track J orchestrator's, made on
2026-11-19 from the spike. They stay in this milestone so that the track
changes only its own lines of this plan.

- J1. Under the adapter, Vite's server environment also gets the resolve
  conditions that Storybook's setup adds: `storybook`, `stories`, and
  `test`. Reason: Storybook's setup gives them to the browser environment
  only, so a package's `storybook` export would resolve differently from
  Storybook, which decision 17 rules out.
- J2. Under the adapter, Mokly compiles in Vite each installed package that
  a preview's `sb.mock()` names, in place of Node's own loader. With several
  folders, decision 18b settles which setup compiles it, because a package
  in the root `node_modules` belongs to no folder. Reason: Vite hands an
  externalized package to Node without its plugins, so the `sb.mock()` of
  decision 12 would not reach an installed package.

Evidence: `.context/storybook-support/spike-18/NOTES.md`, and the
independent check in `.context/storybook-support/spike-18-check/REPORT.md`.

- [x] Build a scratch monorepo with two Storybook folders whose setups differ
      in an alias, a plugin, and an `sb.mock()` call, and a module that both
      packages import.
      Branch: `conductor/storybook-support-j-spike-for-decision-18`.
- [x] Prove or refute, with a prototype under `.context/`: each file compiles
      with its owner's setup, the shared module loads once, virtual modules
      and ids reach the right server, the module graph and the consumed bytes
      stay complete, and the base side and Serve invalidation can work the
      same way. Branch: `conductor/storybook-support-j-spike-for-decision-18`.
- [x] Measure the cost against one setup.
      Branch: `conductor/storybook-support-j-spike-for-decision-18`.
- [x] Record the result in decision 18, and update the TODOs of milestones 30
      and 32 and design calls 18 and 22. When the spike refutes E, give
      decision 18 back to the user with the evidence.
      Branch: `conductor/storybook-support-j-spike-for-decision-18`.
- [x] Commit, push, and open a pull request into this branch. The prototype
      stays under `.context/`.
      Branch: `conductor/storybook-support-j-spike-for-decision-18`.

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
