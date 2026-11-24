# Storybook Support

Status: Active, paused by the user on 2026-11-24. On branch
`calummoore/mokly-storybook-integration`, with no pull request into `main`
yet. Tracks A, B, C, D, and J are merged into this branch. Tracks E to I
have not started. The section [Where the work stands](#where-the-work-stands)
gives what is done, what waits for the user, and how to continue. Each track
works on its own branch from this branch and opens a pull request into this
branch, as design calls 1 and 25 say. Pull requests from this branch into
`main` land at slice boundaries. Each earlier one keeps this plan, and the
last one deletes it, as the `plans` skill says.

Mokly reads each `*.stories.*` file that a root matches as one component
entry. It composes the stories with `composeStories` from `@storybook/react`,
applies the preview file at `.storybook/preview.*` in the source root,
compiles the modules with its own esbuild setup, and renders static HTML in
Node. On 2026-11-03, a test of 13 common Storybook 10.6.2 patterns in four
small projects found that many of them fail the build or render wrong:
CSF Factories, a meta without complete args, `fn()` callbacks under
`--strict`, CSS that the preview file imports, theme globals, a `.storybook`
folder inside a package, loaders, `sb.mock()`, portals, and imported images.
Milestone 38 lists that test matrix, so that a new set of small projects can
check each pattern again.

This plan makes Mokly read and render the Storybook files that projects write
today. It keeps one failing story from stopping a build. It compiles with the
project's own Vite setup when the configuration asks for it. It connects
story components to the screens that render them and to the published
Storybook. The brainstorm ran from 2026-11-03 to 2026-11-06. Its results are
the decisions and design calls below. The `.context/` paths that this plan
names were scratch files of the first workspaces, and this branch does not
hold them. This plan, the protocol docs, and the follow-up items under
`plans/follow-ups/` hold every fact that the remaining work needs. New
evidence goes under `.context/storybook-support/` in the workspace that makes
it.

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
- [JavaScript Asset Imports](../docs/protocol/mokly-imported-assets.md): the
  files that JavaScript imports as assets, their tokens, their URLs in
  documents, and their delivery.
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

## Where the work stands

The user paused the work on 2026-11-24, after tracks A, B, C, D, and J
merged into this branch. On 2026-11-25 the user answered most of the open
decisions and follow-up items. The same day the user asked to continue, and
this branch merged `main`, with the Canvas redesign of pull request #488.
Milestone 1a draws the Storybook mockups again on Canvas. This section tells the next agent what is
done, what waits for the user, and how to continue.

| Track                    | Pull request | Done                         | Open                                                                                  |
| ------------------------ | ------------ | ---------------------------- | ------------------------------------------------------------------------------------- |
| A. Mockups               | #339, merged | Milestone 1, except one TODO | Milestone 1a, which also does the last TODO of Milestone 1                            |
| B. Story reading         | #492, merged | Milestones 3 to 6            | The B4 TODO of Milestone 2, Milestone 7, and Milestone 8                              |
| C. Imported assets       | #453, merged | Milestones 9 to 12           | None                                                                                  |
| D. Vite adapter          | #493, merged | Milestones 13 and 16         | One TODO of Milestone 14, one TODO of Milestone 15, and Milestone 17                  |
| J. Spike for decision 18 | #349, merged | Milestone 37                 | None                                                                                  |
| E to I                   | None         | Nothing                      | Milestones 18 to 36. The [Tracks](#tracks) table gives the order in which they start. |
| All                      | None         | Nothing                      | Milestone 38, which ends with the pull request into `main`                            |

### Answers of 2026-11-25

The user answered these decisions. Each decision gives its answer in full.
Apply each answer in the milestone that waits for it.

- [Decision 18a](#18a-files-that-no-storybook-folder-owns): B.
- [Decision 18d](#18d-storybook-env-values-of-several-folders-in-one-process): D.
- [Decision 23](#23-a-new-story-has-no-published-storybook-page): B. It
  unblocks Milestones 26 to 28 together with decision 27.
- [Decision 26](#26-error-document-styles-in-dark-views): A. It unblocks
  Milestone 23.
- [Decision 27](#27-the-storybook-link-leaves-the-catalogue): B. It unblocks
  the last TODO of Milestone 1.
- [B4](#b4-malformed-mokly-parameter-values): B. It unblocks Milestone 7 and
  the last TODO of Milestone 2.
- [Track D decision 2](#track-d-decision-2-files-that-the-setup-reads-outside-the-graph):
  D, and
  [track D decision 3](#track-d-decision-3-untracked-env-files-on-the-base-side):
  C. They unblock one TODO of Milestone 15.
- [Track D decision 4](#track-d-decision-4-replaced-settings-stay-silent-under-vite):
  B. It unblocks one TODO of Milestone 14.

The user also answered these follow-up items. Each file records its answer.
A branch from this branch applies each answer and deletes the file.

- [imported-asset-base-url.md](follow-ups/imported-asset-base-url.md): A.
  Severity High.
- [storybook-story-cleanups-outlive-their-render.md](follow-ups/storybook-story-cleanups-outlive-their-render.md):
  D. Severity High.
- [asset-content-type-rule.md](follow-ups/asset-content-type-rule.md): E.
- [vite-setups-split-module-identity.md](follow-ups/vite-setups-split-module-identity.md):
  B. Milestone 32 applies it, because the code with several setups does not
  exist yet.
- [css-extensionless-asset.md](follow-ups/css-extensionless-asset.md): A.
- [css-import-type-attribute.md](follow-ups/css-import-type-attribute.md): A.
- [data-url-loader-hint.md](follow-ups/data-url-loader-hint.md): B.
- [asset-reference-positions.md](follow-ups/asset-reference-positions.md):
  F.
- [design-external-link-check.md](follow-ups/design-external-link-check.md):
  E.

### Decisions that wait for the user

Each decision is in full in this plan, with its options and a recommended
option. None has an answer yet, so no option applies.

- [Decision 18b](#18b-mocks-of-modules-that-another-setup-owns) and
  [decision 18c](#18c-a-root-whose-storybook-folder-lies-elsewhere): mocks of
  modules that another setup owns, and roots whose Storybook folder lies
  elsewhere. They block Milestones 30 and 32.

### Defects in merged code

The first review of track B found these defects in the code that pull
request #492 merged. Each one needs no decision, and a branch from this
branch fixes it as its file says. Fix them before the pull request into
`main`.

- [storybook-factory-helper-exports-become-stories.md](follow-ups/storybook-factory-helper-exports-become-stories.md):
  Severity High.
- [storybook-loaders-read-saved-args.md](follow-ups/storybook-loaders-read-saved-args.md):
  Severity High.
- [storybook-argtypes-mapping-skipped-in-render.md](follow-ups/storybook-argtypes-mapping-skipped-in-render.md):
  Severity Medium.
- [variant-props-docs-say-merged.md](follow-ups/variant-props-docs-say-merged.md):
  Severity Medium.
- [story-required-keys-derived-twice.md](follow-ups/story-required-keys-derived-twice.md):
  Severity Low.
- [describe-failure-names-every-file.md](follow-ups/describe-failure-names-every-file.md):
  Severity Low.

- [crate-topic-pages-skip-link-check.md](follow-ups/crate-topic-pages-skip-link-check.md):
  the Markdown link check does not read crate topic pages.

The user chose on 2026-11-24 not to pursue
[workspace-setup-misses-gate-tools.md](follow-ups/workspace-setup-misses-gate-tools.md)
for now. It records the tools and services that a fresh workspace needs
for the complete gate, so read it before a gate run on a new machine.

The other follow-up items that this plan added need no decision. A later
branch fixes each one as its file says.

### How to continue

1. Bring the decisions and the follow-up items above to the user, with their
   recommended options. Ask for all of them in one message.
2. Apply each answer in the milestone that waits for it, and record the
   answer in this plan with its date.
3. Fix the defects in merged code above. Then run the reviews that did not
   finish: the review TODO of Milestone 8 for track B, and the review TODO of
   Milestone 17 for track D. Run each against this branch with the
   `implementation-review` skill.
4. Merge `main` into this branch before a track starts. Only this branch
   merges `main`. Each track branch merges this branch.
5. Start tracks E to I in the order of the [Tracks](#tracks) table. Each
   track works on a branch from this branch and opens a pull request into
   this branch.
6. At a slice boundary, open the pull request from this branch into `main`,
   as design call 1 says. Ask the user before it merges, because a push to
   `main` deploys Mokly Cloud.

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
- **Answer:** B, chosen by the user on 2026-11-25. A file that no Storybook
  folder owns compiles with the setup of the first root, in configuration order,
  that names a Storybook folder.

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
- **Answer:** D, chosen by the user on 2026-11-25. Storybook's env plugin stays,
  a Mokly preset after the core presets replaces the core `STORYBOOK_*`
  values with the values that Vite loads from the folder's parent, and Mokly
  restores the process environment after the presets of each folder load.

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

The mockups of Milestone 1 raised decisions 23 to 27 on 2026-11-18. The
options check of the same day rewrote the root questions of decisions 24, 25,
and 27, added option F to decision 23, option E to decisions 24 and 25, and
options C and D to decision 27. It also showed that rules in force settle two
more questions, which became design calls 26 and 27. On 2026-11-23 the
orchestrator settled decisions 24 and 25 with design calls 29 and 30.
On 2026-11-25 the user answered decision 23 with option B, decision 26 with
option A, and decision 27 with option B.

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
- **Answer:** B, chosen by the user on 2026-11-25. The page of an added entry
  has no Storybook link. A changed story keeps its link. While Changes is not
  ready, and in a build without Changes, every story page shows its link.

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
- **Related:** B and E change the viewer. Milestone 24a holds that change.
- **Recommendation:** E. Each sentence then matches the frame, with no new
  copy.
- **Action:** ask the user, because the option changes which settled sentence
  the shell shows, a user-visible change that no decision covers.
- **Outcome:** E, settled by the orchestrator's design call 29 on
  2026-11-23, with no user answer.

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
- **Related:** Milestones 26 to 28 apply this outcome. D and E change the
  search rule in `docs/protocol/mokly-folders.md`.
- **Recommendation:** E. One field lets the reader both see and find the
  story. B is the smaller option if search may skip the name.
- **Action:** ask the user, because the option adds a Details row and changes
  the search rule, and no user decision covers either.
- **Outcome:** E, settled by the orchestrator's design call 30 on
  2026-11-23, with no user answer.

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
- **Answer:** A, chosen by the user on 2026-11-25. The error document carries
  only its own styles, with system colors that follow the view's scheme.

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
- **Answer:** B, chosen by the user on 2026-11-25. The Storybook link opens in a
  new tab, with `rel="noreferrer"`, and with an icon and a screen-reader
  label that say so.

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
    Changed on 2026-11-23 by design call 31: the Story row now sits between
    Source and the Storybook row.
29. Made on 2026-11-23 by the orchestrator, for decision 24: E. The Props
    tab shows the sentence that matches the preview that it shows. Until an
    edit renders, it uses the existing sentence "The preview shows the saved
    props." Reason: today's sentence is false for a failed story, and E needs
    no new copy.
30. Made on 2026-11-23 by the orchestrator, for decision 25: E. One field
    gives a Story row in Details, and it makes search match the name of the
    first story. Reason: the user's decision 14 keeps Storybook story names,
    and today the name of the first story shows nowhere.
31. Made on 2026-11-23 in track A. The mockups draw the Story row of design
    call 30 on every page of a stories entry, directly below Source and
    above the Storybook row. No mockup shows the search match, because search
    keeps its query field and its filtered tree. The "Render failed" controls
    mockup, which shows the saved preview, uses the saved-props sentence of
    design call 29. Reason: the three rows describe where the story comes
    from, and a mockup shows only what the reader sees.
32. Made on 2026-11-23 by the orchestrator. The controls mockups draw both
    sentences of design call 29. The "Invalid prop value" mockup uses a new
    sentence, "Check the highlighted values. The preview shows the saved
    props.", which both copy files of the controls hold. A second state of the
    "Render failed" mockup, "Later edit failed", shows a failure after an
    earlier edit rendered. Reason: each sentence of design call 29 then has a
    mockup whose preview matches it.

## Tracks

Each track runs in its own workspace, on its own branch from this branch, as
design calls 1 and 25 say. A track starts when each milestone on the
`Depends on:` lines of its first milestones has merged into this branch, and
when the open decisions that block it have answers. A merged track that still
has open TODOs continues on a new branch from this branch. The section
[Where the work stands](#where-the-work-stands) gives the state of each
track.

| Track                      | Milestones | Starts after                                    |
| -------------------------- | ---------- | ----------------------------------------------- |
| A. Mockups                 | 1 and 1a   | Nothing                                         |
| B. Story reading           | 2 to 8     | Nothing                                         |
| C. Imported assets         | 9 to 12    | Nothing                                         |
| D. Vite adapter            | 13 to 17   | Nothing                                         |
| E. Storybook folders       | 18 to 22   | Track B                                         |
| F. Failed stories          | 23 to 25   | Tracks A and B, and decision 26                 |
| G. Storybook links         | 26 to 29   | Tracks A and E, and decisions 23 and 27         |
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
- [x] Draw the Story row of design call 30, and the saved-props sentence of
      design call 29 in the "Render failed" controls mockup. Branch:
      `conductor/storybook-support-a-mockups`.
- [x] Draw the sentence of design call 29 in the "Invalid prop value" controls
      mockup. It needs a new sentence in the copy of the controls. Branch:
      `conductor/storybook-support-a-mockups`.
- [x] Add the "Later edit failed" state to the "Render failed" controls
      mockup, as design call 32 says, and add it to the frozen design lists
      and to the route table of `docs/protocol/mokly-component-controls-design.md`.
      Branch: `conductor/storybook-support-a-mockups`.
- [ ] Update the mockups for the answer to decision 27. Milestone 1a does
      this TODO on the Canvas design, and ticks it.
- [x] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.
      Branch: `conductor/storybook-support-a-mockups`.

Evidence: `.context/storybook-support/evidence/` holds the mockup check, the
Serve smoke test, the complete gate, and the screenshots.

## Milestone 1a: Storybook mockups on Canvas

Tags: mockup

Depends on: 1, and the merge of `main` of 2026-11-25

Track A. The merge of `main` on 2026-11-25 brought the Canvas redesign of
the viewer and the design mockups, pull request #488 into `main`. That
redesign deleted the old component design mockups under
`examples/basic/specs/design/components/`, on which Milestone 1 drew the
Storybook states. The merge dropped those states, as the orchestrator
decided on 2026-11-25, because the old screens no longer exist on `main`.
This milestone draws them again on the Canvas design, with the answers of
2026-11-25. The dropped pieces are listed in
`.context/storybook-support/merge-main-justifications.md` of the primary
workspace.

- [ ] Draw the state of a story that could not render on the Canvas
      component page, desktop and mobile, and in Changes: the error document
      in Current, and the last successful render in Before. The error
      document names the story, says that it could not render, gives the
      reason in a secondary place, and gives the `!mokly` tag. It carries
      only its own styles, with system colors that follow the view's scheme,
      as decision 26 says. Draw it in a dark view too.
- [ ] Draw the Story row of design call 30 and the Storybook link in the
      Details of a stories entry. The link opens in a new tab, with an icon
      and a screen-reader label, as decision 27 says. Draw it without an
      address, because a design link opens a design entry. The page of an
      added entry in Changes has no Storybook link, as decision 23 says.
- [ ] Draw the saved-props sentences of design call 29 in the "Render
      failed" and the "Invalid prop value" controls mockups, and the "Later
      edit failed" state of design call 32.
- [ ] Add each new state to the component and controls design inventories,
      the screen and browser inventories, and the design snapshots.
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

- [x] Move the Storybook section of `docs/protocol/mokly-sidecar.md` to a new
      page, `docs/protocol/mokly-storybook.md`, and link it from the sidecar
      page and `docs/protocol/README.md`.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Write there the rules for CSF 2, CSF 3, and CSF Factories files; the
      first story as the parent; args and their classification; names, tags,
      and the description; the `dev` and `!mokly` filters; `story.load()`
      and `beforeAll`; and the `mokly` parameter. Add the status line that
      `AGENTS.md` asks for.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Apply the answer to decision B3, option C, to the other protocol
      pages: replace each stale Storybook sentence with a link to
      `docs/protocol/mokly-storybook.md`, and keep only the exceptions that a
      page needs. The proposed edits are in
      `.context/storybook-support/b-out-of-scope-doc-edits.md`.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Link each missing behaviour in the status line of
      `docs/protocol/mokly-storybook.md` to the heading of the milestone
      that owns it, as the `documentation` skill now asks.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Apply the answer to decision B2 to the `beforeAll` rule of
      `docs/protocol/mokly-storybook.md`.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Apply the answer to decision B1 to `docs/protocol/mokly-storybook.md`,
      `docs/protocol/mokly-entry-props.md`, and `docs/protocol/mokly-variants.md`.
      Branch: `conductor/storybook-support-b-story-reading`.
- [ ] Apply the answer to decision B4 to the protocol pages.
      Branch: `conductor/storybook-support-b-story-reading`.

Track B raised four decisions on 2026-11-18, while it wrote these docs. The
orchestrator of this plan answered B3 on 2026-11-20 with option C, as a scope
call, B2 on 2026-11-20 with option D, and B1 on 2026-11-23 with option C. The
user answered B4 on 2026-11-25 with option B. That answer sets the rule for
malformed `mokly` parameter values in Milestone 7.

### B1. Stories inherit the first story's args

Answered on 2026-11-23: C. The orchestrator of this plan made this design
call, because the user's decisions 3 and 7 already require that each story
renders as in Storybook. A story variant's props are only its own data args,
and the core does not lay them over the parent's props. A key is required
only when every included story sets it. Each story renders with its own
non-data args and exactly the requested data props, and the sidecar sets each
data arg that the request leaves out to `undefined`.

- **Severity:** High. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-catalogue/src/prepare_parent.rs:31-36`,
  `crates/mokly-catalogue/src/prepare_entry.rs:113`,
  `packages/mokly/src/sidecar/render.ts:43-49`,
  `docs/protocol/mokly-entry-props.md:15-18` and `:105-110`.
- **Background:**
  - Decision 3 makes the first included story the parent page of a stories
    entry, and the other stories its variants.
  - Under the entry props contract, a variant's props replace only the keys
    that they name. Every other key comes from the parent's props.
  - The inferred schema marks each key of the parent's own props as
    required.
  - Today the parent's props are the meta's args. Every story's composed
    args already hold them, so the inheritance never shows.
  - A story render lays the requested props over the story's own args. A
    data arg that the request leaves out keeps the story's value.
- **Problem:** With the first story as the parent, each later story takes
  every arg that the first story sets and it does not. In Storybook's Button
  template, `Primary` sets `primary: true`, so `Secondary`, `Large`, and
  `Small` render as primary buttons. Also, "unset" of an optional prop in
  Serve does not change a story's render, because the story keeps its own
  value.
- **Impact if no action:** Most stories files show wrong variants after
  Milestone 6, with no warning, in Browse and in Changes.
- **Root question:** How do the props that Mokly shows, compares, and edits
  for each story stay exactly the args that the story renders with?
- **Options:**
  - **A.** A story variant's props are its own data args, whole. The core
    does not lay them over the parent's props. The schema marks a key as
    required only when every included story sets it. This changes two rules
    of the entry props contract, for stories files only. "Unset" still has
    no effect. Effort: Medium.
  - **B.** Keep inheritance. Give the parent only the args that every
    included story sets, with the first story's values. Each variant sets
    those keys itself, so nothing leaks, and the contract stays as it is.
    An arg that only the first story sets, such as `primary`, then has no
    control and is missing from the read model, while the parent's views
    still show it. Effort: Small.
  - **C.** Do A, and render each story with its own non-data args and
    exactly the requested data props. The sidecar sets each data arg that
    the request leaves out to `undefined`. "Unset" then works on every story
    page. The render rule of `docs/protocol/mokly-storybook.md` changes.
    Effort: Medium.
  - **D.** Give each story its own inferred schema and controls, from its
    own data args. Each story requires the args that it sets. A story then
    has no control for an arg that only other stories set, and the core,
    the variants contract, and the controls contract change. Effort: Large.
- **Left out:** No change: it renders wrong variants. A `null` for each
  inherited key: `null` is a value, so a default parameter of the component
  does not apply. A list of keys that the sidecar tells the core to drop: it
  gives the same result as A with one more transport field. One entry for
  each story, with no parent: it breaks decision 3. A render that ignores
  inherited keys: the read model and the controls would then show values
  that the render does not use.
- **Wider fix:** C. Each story's render then equals its shown props, for
  inherited keys and for unset keys.
- **Previous examples:** None found.
- **Related:** B3, work that waits for the answer: this answer changes the
  merge and required-key sentences of `mokly-entry-props.md` and
  `mokly-variants.md`.
- **Recommendation:** C. Each story then shows, edits, compares, and renders
  exactly its Storybook args. The first pass recommended A, which keeps the
  "unset" defect.
- **Action:** ask the user, because C changes the variant merge rule and the
  required-key rule of the entry props contract for stories files, and no
  recorded decision covers that change.

### B2. Old `beforeAll` setups stack in a sidecar

Answered on 2026-11-20: D. The orchestrator of this plan made this call,
because design call 10 is its own design call. D changes design call 10: each
sidecar process keeps at most one active `beforeAll` setup. Before a story of
another generation renders, the cleanup of the old setup runs, and then the
new generation's `beforeAll` runs. A hook that threw does not run again for
its generation. The release of a generation no longer runs a cleanup.

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `packages/mokly/src/sidecar/session.ts:176-192`,
  `docs/protocol/mokly-storybook.md`, section "Setup Before Render".
- **Background:**
  - Design call 10 runs the preview's `beforeAll` once for each bundle
    generation, and its cleanup when the sidecar releases the generation.
  - A setup changes state that the whole process shares, such as `fetch`,
    timers, and `Date`, because the bundle runs in the main realm.
  - A sidecar process serves one source root and handles one request at a
    time. In Serve, an old and a new generation of the same root can both
    stay loaded until the old one is disposed.
  - Only the request dispatcher in `session.ts` sees the `dispose` and
    `shutdown` requests. The track brief forbids changes to `session.ts`,
    because tracks C, D, and E change it.
- **Problem:** This track cannot run the cleanup at release without a change
  to `session.ts`. Even with that change, two loaded generations keep two
  setups active on the same globals.
- **Impact if no action:** In Serve, each rebuild runs `beforeAll` again
  while the old setup stays. A setup such as a mock server or a fake clock
  then stacks until the sidecar recycles.
- **Root question:** How does Mokly keep the `beforeAll` setup of an earlier
  generation from staying active in a long-lived sidecar process?
- **Options:**
  - **A.** Allow this track a small change to `session.ts`: `dispose`,
    `shutdown`, and the end of the input stream call a release function of
    the story reader. A track that also edits that file may get a small
    merge conflict. Two loaded generations still keep two setups.
    Effort: Small.
  - **B.** The story reader keeps each cleanup and exports the release
    function, and this track leaves `session.ts` alone. A follow-up item
    adds the calls on the primary branch after the tracks merge. Until then,
    no cleanup runs. Effort: Small.
  - **C.** Run no `beforeAll` cleanup, and change design call 10 to say so.
    Effort: Small.
  - **D.** Keep at most one active setup in each sidecar process. Before a
    story renders, if the active setup belongs to another generation, its
    cleanup runs, and then this generation's `beforeAll` runs. A hook that
    threw does not run again for its generation. Storybook's own preview
    does the same on a reload. Only the reader and the story path of
    `render.ts` change. Design calls 10 and B-b and the page's cleanup rule
    change. Renders that alternate between two generations run the hooks
    again at each switch, and the last setup gets no cleanup when the
    process exits. Effort: Small.
- **Left out:** A process exit hook: it misses `dispose`, so setups still
  stack in Serve. A garbage collection hook: it can run while another render
  waits for a loader. A setup and a cleanup around each story render: a hook
  that returns no cleanup would run again for each view, and its setup would
  stack. A worker or a separate realm for each generation: it needs a new
  evaluation design in `evaluate.ts`, which other tracks change.
- **Wider fix:** D. It needs no release call, and it also serves a
  generation with several preview files, which track E brings.
- **Previous examples:** None found.
- **Recommendation:** D. It never keeps two setups on the shared globals, it
  matches Storybook's own preview, and it needs no change outside this
  track. The first pass recommended A.
- **Action:** ask the user, because D changes design call 10, which the user
  approved for this track, and A needs a change to `session.ts`, which the
  track brief forbids.

### B3. Other protocol pages restate old Storybook rules

Answered on 2026-11-20: C. The orchestrator of this plan made this scope
call, because no other active track edits these eight pages.

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** 16 sentences in 8 pages: `docs/protocol/mokly-entry-props.md`,
  `mokly-variants.md`, `mokly-entry-modules.md`,
  `mokly-sidecar-definitions.md`, `mokly-paths.md`, `mokly-authoring.md`,
  `mokly-component-controls.md`, and `mokly-sidecar-render-records.md`. The
  list is in `.context/storybook-support/b-out-of-scope-doc-edits.md`.
- **Background:**
  - Milestone 2 moves the Storybook rules to the new page
    `docs/protocol/mokly-storybook.md`. Tracks E, F, and G add more rules to
    it later.
  - Some other protocol pages restate Storybook rules. For example, the
    entry props page says that the meta's args are the props, and that
    every story is a variant.
  - The track brief allows doc changes only on the sidecar page, the new
    page, and the protocol index. No other track edits these eight pages.
- **Problem:** After this track, those sentences contradict the new
  Storybook page.
- **Impact if no action:** Readers and agents find two requirements that
  disagree. A later change can bring back the old rule.
- **Root question:** Which page holds each Storybook rule, so that the other
  pages link to it and restate none of it?
- **Options:**
  - **A.** Allow this track to replace each stale sentence with a short
    statement of the new rule and a link. Six of the pages then state
    behaviour that is not implemented yet, so each needs a status line until
    Milestone 8. Effort: Small.
  - **B.** Leave those pages. A follow-up item fixes them on the primary
    branch after the tracks merge. The contradiction stays until then, and
    the answer to B1 still changes two of the pages in Milestone 6.
    Effort: Small.
  - **C.** Allow this track to replace each stale sentence with a pointer to
    the new page. Where a general rule does not apply to stories, the page
    gets only the exception and the link. These pages then say less on
    their own, and they need no status line. Effort: Small.
- **Left out:** A note on the Storybook page that it wins over the other
  pages: two texts that disagree still stay, against the rule that each fact
  lives in one place.
- **Wider fix:** C. It removes the restated rules, so a later Storybook rule
  change cannot leave another page stale.
- **Previous examples:** None found.
- **Related:** B1, work that waits for the answer: B1 changes the merge and
  required-key sentences of `mokly-entry-props.md` and `mokly-variants.md`,
  so answer the two together.
- **Recommendation:** C. Each Storybook rule then lives on one page, with no
  status lines on other pages. The first pass recommended A.
- **Action:** ask the user, because the track brief limits the doc files of
  this track, and only the user can widen that scope.

### B4. Malformed `mokly` parameter values

- **Severity:** Low. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-storybook.md`, section "Globals For
  Views".
- **Background:**
  - Decision 8 adds a `mokly` parameter with the fields `colorSchemes` and
    `viewports`. Each maps a Mokly view name to an object of Storybook
    globals.
  - Storybook parameters are open objects. Storybook ignores the keys that
    no addon reads.
  - Mokly's own authoring inputs reject unknown fields. For example, a
    variant with an unknown key fails with a diagnostic.
  - The always-on rules say: when input is recoverable, warn and continue.
    They also say that a new warning or error needs the user's approval.
- **Problem:** No rule says what Mokly does with a `mokly` parameter that is
  not an object, an unknown field such as `colourSchemes`, a mapped value
  that is not an object, or a view name such as `tablet`.
- **Impact if no action:** The code picks a behaviour that no review can
  check. A typo can show the wrong theme with no hint.
- **Root question:** How does Mokly treat a `mokly` parameter value that
  matches no rule?
- **Options:**
  - **A.** Ignore it without a warning. A typo then shows only as a wrong
    theme or layout in the views. Effort: Small.
  - **B.** Ignore it, and give a new build warning that names the story and
    the value. `--strict` then fails for such a file. The warning needs a
    new code in the build warnings contract, which the track brief does not
    include, and a new field in the `describe` result. Effort: Medium.
  - **C.** Fail the story render with `render-failed`. A typo then stops the
    build. After track F, the story shows an error document instead.
    Effort: Small.
  - **D.** Do A, and export a `MoklyParameter` type from `@mokly/mokly`.
    TypeScript then reports a typo where the author applies the type with
    `satisfies`. Storybook's own parameter type accepts any key, so other
    files get no help. Effort: Small.
  - **E.** Fail the stories file at describe time with the existing
    `invalid-field` diagnostic, as for an unknown variant field. One typo
    then makes the whole build invalid. Effort: Small.
- **Left out:** None.
- **Wider fix:** None, because this is one new input, and B covers every
  malformed shape of it.
- **Previous examples:** An unknown variant field fails with a diagnostic in
  `crates/mokly-catalogue/src/variants.rs:60-80`.
- **Recommendation:** B. The always-on rules ask for a warning when input is
  recoverable, and the parameter belongs to Mokly. D is a cheap addition to
  B. The first pass recommended A.
- **Action:** ask the user, because B adds a new build warning, which needs
  the user's approval.
- **Answer:** B, chosen by the user on 2026-11-25. Mokly ignores a malformed
  value and gives a new build warning that names the story and the value.

The options check of 2026-11-18 added options B1 C and D, B2 D, B3 C, and B4
D and E, and it changed the recommendations of all four items. Its report is
`.context/storybook-support/reports/b-options-check-full.md`.

Design calls of track B, made on 2026-11-18:

- B-a. When the preview's `beforeAll` hook throws, it does not run again for
  that generation, and each story render of that generation fails with its
  error. Reason: design call 10 runs the hook once, and a story without its
  setup would render wrong output.
- B-b. Each sidecar process runs `beforeAll` for each generation whose
  stories it renders, and again after another generation's setup replaced
  it. Reason: sidecar processes share no state, so one run cannot serve them
  all. Changed on 2026-11-20 by the answer to B2.
- B-c. The globals of the `mokly` parameter win over a story's own
  `globals`. Reason: design call 11 applies them over the composed globals,
  and a Chromatic mode's viewport also wins over a story's own viewport
  global.
- B-d. The meta's `includeStories` and `excludeStories` filters apply, as in
  Storybook. Reason: Storybook's composition applies them already.
- B-e. Made on 2026-11-20. A CSF Factories meta whose title is Storybook's
  placeholder `ComposedStory` counts as untitled. Reason: Storybook's
  `meta.story()` writes that placeholder into an untitled factory meta while
  the stories file evaluates, before the reader runs. Only an authored title
  of exactly `ComposedStory` loses, in favour of the fallback title.
- B-f. Made on 2026-11-23. When a requested data prop has the key of a
  non-data arg of the same story, the requested value renders. Reason: the
  answer to B1 renders exactly the requested data props, and Storybook lays
  extra args over a story's own args.

## Milestone 3: Story reader

Depends on: 2

One reader turns CSF 2, CSF 3, and CSF Factories files into one shape, as
design call 2 says. It fixes findings 2, 10, and 11.

- [x] Add the reader beside `packages/mokly/src/sidecar/stories.ts`. It
      composes from a copy of the meta, passes a module without a default
      export to `composeStories` unchanged, and takes a factory's meta and
      preview from its stories.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Move `describeStories` onto the reader. The title fallback then never
      reads "ComposedStory", which fixes finding 10.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Take each variant's control hints from its composed argTypes, which
      fixes finding 11.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Add a factories fixture, an untitled file, and a variant that does not
      set an arg with options to `tests/sidecar_storybook.test.ts`.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Update `docs/guides/authoring/storybook.md` for CSF Factories.
      Branch: `conductor/storybook-support-b-story-reading`.

## Milestone 4: Story args, names, tags, and descriptions

Depends on: 3

Stories keep Storybook's names, tags, and description, and the standard
Storybook files pass `--strict`. Decisions 7 and 14, and the `!mokly` tag of
decision 5.

- [x] Leave out of the props, without a warning, each arg that the composed
      argTypes type as a function, and each React element arg, as design
      call 4 says.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Name each story as design call 6 says.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Map tags as design call 5 says, and the description as design call 7
      says.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Include stories as design call 8 says.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] In the commit that builds story tags, add to
      `docs/protocol/mokly-entry-props.md` and `docs/protocol/mokly-variants.md`
      that a story variant takes its tags from its own story, with a link to
      `docs/protocol/mokly-storybook.md`.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Test that Storybook's Button template passes `--strict`, and test the
      names, the tags, the description, and the skipped stories.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Update `docs/guides/authoring/storybook.md`.
      Branch: `conductor/storybook-support-b-story-reading`.

## Milestone 5: Story setup before render

Depends on: 3

Loaders and `beforeEach` run before each story render, as decision 12 says.

- [x] Await `story.load()` before each story render, and run its cleanups as
      Storybook does.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Run `beforeAll` as the answer to decision B2 says.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Test that a loader story and a `beforeEach` story render their prepared
      data.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Update `docs/guides/authoring/storybook.md`.
      Branch: `conductor/storybook-support-b-story-reading`.

## Milestone 6: The first story as the parent page

Depends on: 4

The first included story becomes the parent page, as decision 3 says.

- [x] Render the first included story in source order as the parent page,
      with its composed args as the parent's props.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Make the other included stories the parent's variants.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Apply the answer to decision B1: a story variant's props are only its
      own data args, a key is required only when every included story sets
      it, and a story renders with exactly the requested data props, each
      left-out data arg `undefined`.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Test that the variants of Storybook's Button template keep exactly
      their own args, and that unset of an optional prop renders the story
      without it.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Give a file without an included story no entry, as design call 3 says.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Delete the meta-only composition and move each consumer that "Replaced
      ways" lists.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Test that a meta without args builds, and that no base state repeats.
      Branch: `conductor/storybook-support-b-story-reading`.
- [x] Update `docs/guides/authoring/storybook.md`.
      Branch: `conductor/storybook-support-b-story-reading`.

## Milestone 7: Globals from the `mokly` parameter

Depends on: 3, and the answer to decision B4 for malformed values

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
- [ ] Check the rows of the test matrix in Milestone 38 that Milestones 3 to
      7 build, in new small projects, and save the result under
      `.context/storybook-support/`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

Pull request #492 merged Milestones 2 to 6 into this branch on 2026-11-24,
before Milestone 7, at the user's request. Its description holds the
justifications of the track B merges of this branch. Its first review round
ran, and the user paused the work before the fix round. The review TODO
above runs the review again on the merged code.

## Milestone 9: Imported assets documentation

Depends on: none

Track C. The protocol states the asset rules of decision 6.

Track C design calls, made on 2026-11-18. They are mine. The orchestrator can
move them to "Design calls" at the merge.

1. The rules of imported assets get their own page,
   `docs/protocol/mokly-imported-assets.md`. Reason: the stylesheet asset page
   would come near its 250-line cap, and the status line then covers only the
   new rules.
2. JavaScript imports deliver Vite's known asset types by default, except
   `.txt`, which keeps its text loader. The match is case-sensitive, as for
   stylesheet assets. A consumer loader or an import attribute `type` wins
   over the default, and decision C2 settles which of the two wins. A
   consumer loader key matches the longest configured suffix, as in esbuild.
   Reason: current `.txt` imports keep their value, an explicit choice wins,
   and a key such as `.icon.png` fails today.
3. Stylesheet `url()` keeps its extension list. Reason: decision 6 covers
   JavaScript imports, and a wider stylesheet list would change a requirement
   in force.
4. An asset import gives a token string that depends only on the asset's
   logical path. Code can append a query or a fragment. Records that carry
   props keep the token. Reason: documents and records stay deterministic,
   and an edit to the bytes changes no prop.
5. The core replaces each token in the attribute values, the text, and the
   collected styles of a composed document. Only the reference positions of
   the comparison contract count as resource references. Reason: no output
   shows a token, and no new error is necessary. Changed on 2026-11-20: the
   replacement does not depend on the assets of the generation, and a
   reference to an undelivered path fails as a missing target. Reason: with
   the asset list in each document key, one new import rendered every view
   again, and the two sides of a comparison shared no cached view.
6. Each imported asset, the file of an import that gives a token, is
   delivered with its generation, also when no document references it. A
   stylesheet asset at the same path shares its route. Reason: this is the
   stylesheet asset rule, and a token in any position then resolves.
7. An asset path that is not portable fails the build, as a stylesheet asset
   path does, with a message that names the importing module. Reason: one
   route rule stays, and such an import fails today with "No loader is
   configured".
8. Imported assets follow the stylesheet asset rules for location, digest
   checks, Serve, `build`, publish, the base side, watch, and Changes
   evidence. Reason: decision 6 reuses that pipeline.
9. A token in an HTML comment stays. Reason: a browser loads no URL from a
   comment, and the replacement then cannot touch Mokly's marker comments.
10. A document that links the authored path of an imported asset fails with
    the existing protected-target reason. No new row names the importing
    module. Reason: the failure already exists, and a new message can come
    later. Changed on 2026-11-20: the failure uses the existing row of an
    imported stylesheet asset, which names the importing module. Reason: the
    implementation showed that this row applies with no new message, and it
    tells the author the fix.

### C1. A `file` loader on an asset import

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `packages/mokly/src/sidecar/plugins.ts:45-50`,
  `docs/protocol/mokly-imported-styles-errors.md:52`,
  `docs/protocol/mokly-imported-styles-modules.md:113-115`,
  `docs/protocol/mokly-configuration-imported-styles.md:54-55`,
  `docs/guides/authoring/config.md:80`.
- **Terms:**
  - **Loader:** the esbuild rule that turns an imported file into a
    JavaScript value. `moduleResolution.loaders` in `mokly.config.json` sets
    one for each extension.
- **Background:**
  - Today a consumer `file` loader fails the build. The message advises a
    `dataurl` or `binary` loader.
  - In esbuild, the `file` loader copies the file to the output and gives its
    URL. Decision 6 makes Mokly do the same for images, fonts, and media.
  - Design call 16 says that a consumer loader still wins over that default.
  - Many esbuild setups set `file` for images.
- **Problem:** No rule says what a `file` loader does when Mokly can deliver
  the file. The `dataurl` advice is wrong, because the document URL policy
  rejects `data:` URLs in `src`.
- **Impact if no action:** A project that sets `file` for `.png` fails, and
  the advice leads to a second failure.
- **Root question:** What does a configured `file` loader do, now that Mokly
  delivers imported files itself?
- **Options:**
  - **A.** Keep the failure for each `file` loader. Its advice tells the user
    to remove the loader, or to use `binary` or `text` for data. A project
    that sets `file` must delete the entry. Effort: Small.
  - **B.** A `file` loader on a type that Mokly delivers by default means
    that delivery. A `file` loader on another type keeps the failure, with
    new advice. Three docs outside the scope of track C change one sentence
    each: `mokly-imported-styles-modules.md`,
    `mokly-configuration-imported-styles.md`, and
    `docs/guides/authoring/config.md`. Effort: Small.
  - **C.** A `file` loader delivers a file of any type. A type outside the
    content type table gets `application/octet-stream`. The same three docs
    change. Mokly documents run no scripts, so such a file is useful only as
    a link target. A static host picks its own content types, so Serve and
    the static output can differ. Effort: Small.
  - **D.** B, with one key rule for every load. A loader key matches the
    longest configured suffix, as in esbuild. The bundle's own loader table
    drops `file` keys, as it drops `.css` and `.module.css`, so esbuild never
    writes a file. A `file` key can deliver each of Vite's types, also
    `.txt` as `text/plain`. Today a key such as `.icon.png` fails with
    "Bundled source bytes were not recorded". Effort: Small.
  - **E.** D, and an import attribute `type` wins over a `file` key, as in
    esbuild. Effort: Small.
- **Left out:**
  - Let esbuild emit its own output file for the `file` loader: esbuild gives
    one URL for the whole bundle, which is root-absolute or wrong for
    documents at other depths.
  - Reject each `file` key in the configuration check: it fails a
    configuration that builds today with correct output.
  - Give a type outside the set an empty value and a warning: the document
    then holds a missing URL, and a new warning code is necessary.
- **Wider fix:** D. A key rule for every load keeps `file` away from esbuild
  for each key shape.
- **Previous examples:** None found.
- **Related:** C2 decides whether an import attribute wins over each
  configured loader. E is its case for `file` keys.
- **Recommendation:** D, changed from B by the options check of 2026-11-18.
  The loader keeps its esbuild meaning for each key shape, and an unknown
  type still fails with clear advice.
- **Action:** ask the user, because D changes the requirement that a consumer
  `file` loader fails the build, and it changes three docs outside the scope
  of track C.
- **Answer:** E, an orchestrator design call of 2026-11-23. A `file` key
  gives Mokly's delivery for the default types and for `.txt`, one
  longest-suffix key rule covers every load, esbuild never gets a `file` key,
  and an import attribute wins over a `file` key, as C2 says. Reason: the
  user's decision 6 chose this delivery, and the change only removes a
  failure.

### C2. An import attribute against a configured loader

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small.
- **Source:** Design, found by the options check of C1.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/plugins.ts:51-56`.
- **Background:**
  - An import can carry an attribute, such as `with { type: "text" }`. The
    types are `json`, `text`, and `bytes`.
  - In esbuild, the attribute wins over the loader of the extension.
  - Mokly's sidecar tries the consumer loader and its own source loaders
    first. No protocol doc states this order.
- **Problem:** `import data from "./data.json" with { type: "text" }` gives
  parsed JSON in Mokly and text in esbuild.
- **Impact if no action:** Such an import gets a different value in Mokly
  than in the product's own build.
- **Root question:** When an import names its type, which decides its value
  in each esbuild compile of Mokly: that type, or a rule for its file
  extension? The options check of 2026-11-18 wrote this question, because
  the CSS route and the PostCSS module compile have the same gap.
- **Options:**
  - **A.** Keep the order of today: the consumer loader, then Mokly's source
    loaders, then the attribute. The asset page states it. Effort: Small.
  - **B.** The attribute wins over every loader, as in esbuild. The value of
    an existing import with an attribute and a loader changes. A `.css`
    import stays a stylesheet, and the page names it as the exception.
    Effort: Small.
  - **C.** The attribute wins over Mokly's own defaults: JavaScript,
    TypeScript, JSON, `.txt`, and the asset default. A consumer loader still
    wins over the attribute. Such an import can still get another value
    than in esbuild. Effort: Small.
  - **D.** B, and a `.css` or `.module.css` import with a `json`, `text`, or
    `bytes` attribute gets that value and no stylesheet, as in esbuild. It
    changes the rule that Mokly owns `.css` handling, a generated type, and
    Rust code outside track C. Effort: Medium.
  - **E.** D, and one owner for the attribute rule in each esbuild compile.
    The bundle hooks and the PostCSS module compile ask it before any rule
    by extension. The PostCSS files are outside track C. Effort: Large.
- **Left out:**
  - Warn when both apply: with A, the import keeps a value that esbuild does
    not give. With B, the warning only fails `--strict` for a correct import.
  - Let esbuild apply the attribute itself: esbuild ignores the attribute
    when a hook returns the contents, and a hook that returns nothing loses
    the digest of the compiled bytes.
  - A configuration switch to another order: B is better on every point, and
    it adds no configuration field.
  - Fail the bundle when an attribute meets a loader: esbuild accepts the
    import, and it is a new build error.
- **Wider fix:** E, changed from "None" by the options check. It decides the
  attribute before every rule by extension, in each esbuild compile.
- **Previous examples:** None found.
- **Related:** C1, option E, is the case of B for `file` keys.
- **Recommendation:** B. The import then gets the value that esbuild and the
  language standard give it. Vite reads only `json` today, so B does not
  match Vite for `text` and `bytes`. E protects the codebase best, but it is
  Large and outside track C.
- **Action:** ask the user, because B changes the value that existing imports
  get today.
- **Answer:** B, an orchestrator design call of 2026-11-23. The attribute
  wins over every loader, as in esbuild and the language standard. A `.css`
  import stays a stylesheet, and the asset page names that exception.
  Reason: today's order differs from esbuild by accident, and no page states
  it.

The options check reports of C1 and C2 are in
`.context/storybook-support/track-c/reports/`.

On 2026-11-20 the orchestrator answered the scope question of track C with
option A. Track C edits the sentences outside its file list that the asset
delivery makes stale: in `docs/protocol/mokly-configuration.md`,
`docs/protocol/mokly-artifact-paths.md`, and, after decision C1, the
sentences about the `file` loader. Only the stale sentences change, because
track D edits the same configuration pages.

- [x] Add the delivery of imported assets to
      `docs/protocol/mokly-imported-styles-assets.md`, or to a new linked
      page when that page would pass 250 lines. Add the status line.
      Branch: conductor/storybook-support-c-imported-assets
- [x] Update the `file` loader row of
      `docs/protocol/mokly-imported-styles-errors.md` with the answer to
      decision C1. Branch: conductor/storybook-support-c-imported-assets
- [x] State the answer to decision C2 in
      `docs/protocol/mokly-imported-assets.md`. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`. Branch:
      conductor/storybook-support-c-imported-assets

## Milestone 10: Imported assets in documents

Depends on: 9

Components that import images render them, as decision 6 says. The
delegate reports, the watch smoke test, and the gate logs are in
`.context/storybook-support/track-c/reports/`.

- [x] Load the asset types of design call 16 as delivered files. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Give each asset import a token. The core replaces it with a
      document-relative URL in each attribute value and in the text of a
      composed document, as track C design call 5 says. The core delivers
      the file under the generated assets route. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Add asset bytes to the watch inputs and the render keys. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Replace the `file` loader error and the `dataurl` advice, as "Replaced
      ways" says, with the answer to decision C1. Also update the `file`
      loader sentences of `docs/protocol/mokly-imported-styles-modules.md`,
      `docs/protocol/mokly-configuration-imported-styles.md`,
      `docs/guides/authoring/config.md`, and
      `docs/guides/authoring/styles.md`. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Name the asset delivery default in
      `docs/protocol/mokly-configuration.md`, and the imported assets under
      `static/mokly-generated/` in `docs/protocol/mokly-artifact-paths.md`.
      Branch:
      conductor/storybook-support-c-imported-assets
- [x] Apply the answer to decision C2 to the loader choice of the bundle.
      Branch: conductor/storybook-support-c-imported-assets
- [x] Test that a component that imports a PNG and an SVG renders them in
      Serve and `build`, and that Changes shows an edited image. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Update `docs/guides/authoring/styles.md`. Branch:
      conductor/storybook-support-c-imported-assets

## Milestone 11: Imported assets in collected styles

Depends on: 10

- [x] Rewrite asset tokens in the CSS-in-JS styles that the sidecar collects,
      such as Emotion and styled-components `url()` values. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Test an Emotion style with an imported background image. Branch:
      conductor/storybook-support-c-imported-assets

## Milestone 12: Imported assets verification, review, and pull request

Depends on: 9, 10, 11

The merge justifications of track C are in
`.context/storybook-support/track-c/merge-justifications.md`. The findings
file and the review reports are in
`.context/reviews/conductor/storybook-support-c-imported-assets/`.

- [x] Remove each status line whose page this track completes. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Run the targeted tests and `cargo xtask check`. Branch:
      conductor/storybook-support-c-imported-assets
- [x] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.
      Branch: conductor/storybook-support-c-imported-assets

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
  in a virtual module, or in a file outside the source root. Such a location
  counts as no location, so `{stylesheet}` is the logical path of the
  stylesheet. Reason: design call D16 keeps absolute paths and virtual modules
  out of every message, and a file outside the source root has no
  repository-relative path that a message can show.
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
- **Answer:** D, chosen by the user on 2026-11-25. The PostCSS config candidates
  that Vite looks up are inputs, present or absent. A `watch.rules` entry with
  the `rebuild` action makes any other file an input, and under the adapter a
  change to such a path reloads the setup.

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
- **Answer:** C, chosen by the user on 2026-11-25. The base side reads the
  tracked env files from the base commit and the untracked env files from the
  working tree.

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
- **Answer:** B, chosen by the user on 2026-11-25. Each replaced field that the
  configuration sets gives a configuration warning that names the field and
  the adapter.

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
- [x] Under the adapter, send every local stylesheet of a catalogue without
      JavaScript through the setup, as design call D12 says. A sidecar then
      starts, and the base side extracts its sources and selects an
      installation, as for the `postcss` module. Branch: `conductor/storybook-support-d-vite-adapter`.
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

Pull request #493 merged Milestones 13 to 16 into this branch on
2026-11-24, at the user's request, before the open TODOs of Milestones 14 and
15 and before the review. Its description holds the justifications of the
track D merges of this branch. No review has read Milestone 16 or the last
merges. The review TODO below reviews the merged code.

- [x] Remove each status line whose page this track completes. Branch: `conductor/storybook-support-d-vite-adapter`.
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
- [ ] Decide whether a story's stylesheet chain drops the stylesheets that
      its preview file already delivers, as an entry's chain drops the
      renderer's stylesheets. Track D raised this question on 2026-11-23.
- [ ] Update `docs/guides/authoring/storybook.md`.

## Milestone 22: Storybook folders verification, review, and pull request

Depends on: 18, 19, 20, 21

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 23: Failed stories documentation

Depends on: 1, 8, and the answer to decision 26

Track F. The protocol states the failure rules of decision 5.

- [ ] Add the render failure rules to `docs/protocol/mokly-storybook.md`.
- [ ] State there the reason rule of design call 26, the usage rule of
      design call 27, and the answer to decision 26.
- [ ] State the sentence rule of design call 29 in
      `docs/protocol/mokly-component-controls-design.md`: after a failed or
      invalid edit, the Props tab names the preview that it shows.
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

## Milestone 24a: The Props sentence after a failed edit

Tags: ui

Depends on: 1, 23

The Props tab says truthfully what the preview shows after a failed or
invalid edit, as design call 29 says.

- [ ] Choose the sentence of the failure alert and of the invalid notice
      from the preview that the frame shows. Until an edit renders, use "The
      preview shows the saved props."
- [ ] Keep the viewer's copy equal to the copy of the controls mockups, which
      `tests/viewer_controls_copy.test.ts` compares. The viewer's copy
      already holds the new sentence of design call 32.
- [ ] Test both sentences under `packages/viewer/tests`, for a preview that
      shows the saved props and for one that shows an edit.

## Milestone 25: Failed stories verification, review, and pull request

Depends on: 23, 24, 24a

- [ ] Remove each status line whose page this track completes.
- [ ] Run the targeted tests and `cargo xtask check`.
- [ ] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.

## Milestone 26: Storybook links documentation

Depends on: 1, 22, and the answers to decisions 23 and 27

Track G. The protocol states the link rules of decision 15.

- [ ] Add the Storybook link rule to `docs/protocol/mokly-storybook.md`.
- [ ] State there the answers to decisions 23 and 27, and the Story row of
      design call 30.
- [ ] Add the story name of design call 30 to the search rule in
      `docs/protocol/mokly-folders.md`.
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
- [ ] Add the name of the story that each page of a stories entry renders to
      the read model, with generated shared types, as design call 30 says.
- [ ] Test the ids of titled and untitled files, and the story names of a
      parent page and of a variant.

## Milestone 28: The Storybook link in the shell

Tags: ui

Depends on: 27

- [ ] Add the link to `@mokly/ui` as the mockup shows, and render it from
      the viewer container for entries with a Storybook URL.
- [ ] Render the Story row in Details, and match the story name in search,
      as design call 30 says and the mockups show.
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
- [ ] Decide whether the default `.storybook` folder in the source root turns
      on Storybook's setup under the Vite adapter, or only a root's
      `storybook` field does. Track D raised this question on 2026-11-23.
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
- [ ] Make the `.env` files that Storybook's setup reads inputs of a Vite
      compile, as the env files of the project's own Vite setup already are.
      Track D raised this on 2026-11-23.
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
- [ ] Check every row of the test matrix below in new small projects with
      Storybook 10.6.2, `@storybook/react` 10.6.2, and React 19, and save
      the result under `.context/storybook-support/`.
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

The test matrix of 2026-11-03 found each gap below in Mokly at `f08d02df`.
Each row gives a pattern of a small Storybook project, the result that this
plan gives, and the milestones that build it.

| Pattern                                                                        | Expected result                                                                      | Milestones          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------- |
| A CSF 3 `Button` stories file with `args: { onClick: fn() }`, under `--strict` | The build passes with no warning                                                     | 4                   |
| `import "../src/global.css"` in `.storybook/preview.tsx`                       | Each story document links `global.css`                                               | 21                  |
| A preview decorator that reads `globals.theme`                                 | A dark view gets the dark theme through the `mokly` parameter                        | 7                   |
| `argTypes.size.options` on the meta                                            | Every story shows a select for `size`                                                | 4                   |
| An export `LargeButton`, a story tagged `!dev`, and a docs description         | The title is "Large Button", the `!dev` story is left out, and the description shows | 4                   |
| A meta without args and a required `user` prop                                 | The first story is the parent page, and the build passes                             | 6                   |
| `loaders` whose result a story reads from `loaded`                             | The loader runs before the render                                                    | 5                   |
| `createPortal(..., document.body)` in a story                                  | A warning and an error document in place of the story, and the build goes on         | 23 to 25            |
| `excludeStories: /.*Data$/` and no title                                       | The exclusion works, and no title says "ComposedStory"                               | 3 and 4             |
| `import logo from "./logo.png"`                                                | Mokly delivers the image, and the document links it                                  | 9 to 12             |
| A CSF Factories file with `preview.meta` and `meta.story`                      | Every story and the parent page build                                                | 3                   |
| A monorepo with `packages/ui/.storybook/preview.tsx`                           | That root's preview applies, and the title is right                                  | 18 to 22            |
| `sb.mock(import("../src/lib/session.ts"))` with a `__mocks__` file             | The mock applies under the Vite adapter, and a warning names it without the adapter  | 32, and decision 12 |

## Post-merge follow-up (non-blocking)

- [ ] Run the released package against a new `react-vite` Storybook project
      with and without the Vite adapter.
- [x] Split `crates/mokly-graph/README.md`, which passes 300 lines, after
      tracks C and D both merge into the primary branch,
      `calummoore/mokly-storybook-integration`. Do not split it before.
      Reason: both tracks change that README.
      Branch: `conductor/storybook-support-d-vite-adapter`.
