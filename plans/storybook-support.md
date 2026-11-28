# Storybook Support

Status: Active. On branch `calummoore/mokly-storybook-integration`, with no
pull request into `main` yet. Tracks A, B, C, and J are complete and merged
into this branch. Track D is merged, and its last milestones run on a track
branch. Tracks E to I have not started. The section [Where the work stands](#where-the-work-stands)
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
Milestone 1a draws the Storybook mockups again on Canvas. Pull request #506
merged Milestone 1a, pull request #508 finished track B, pull request #509
applied the asset follow-up answers, pull request #511 finished track D, and
pull request #524 finished track F. On 2026-11-27 pull request #596, the
source package override, merged into `main`, and this branch merged `main`
again. Pull request #597 applied answer B of track D decision 6. Tracks E
and I run on their own branches. This section
tells the next agent what is done, what waits for the user, and how to
continue.

| Track                    | Pull request                 | Done                | Open                                                                                  |
| ------------------------ | ---------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| A. Mockups               | #339 and #506, merged        | Milestones 1 and 1a | None                                                                                  |
| B. Story reading         | #492 and #508, merged        | Milestones 2 to 8   | None                                                                                  |
| C. Imported assets       | #453, merged                 | Milestones 9 to 12  | None                                                                                  |
| D. Vite adapter          | #493, #511, and #597, merged | Milestones 13 to 17 | Two follow-up items of #597 that wait for the user                                    |
| J. Spike for decision 18 | #349, merged                 | Milestone 37        | None                                                                                  |
| E. Storybook folders     | Not yet                      | In progress         | Milestones 18 to 22                                                                   |
| F. Failed stories        | #524, merged                 | Milestones 23 to 25 | Two follow-up items that wait for the user                                            |
| I. Story component usage | Not yet                      | In progress         | Milestones 34 to 36                                                                   |
| G and H                  | None                         | Nothing             | Milestones 26 to 33. The [Tracks](#tracks) table gives the order in which they start. |
| All                      | None                         | Nothing             | Milestone 38, which ends with the pull request into `main`                            |

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

- [vite-setups-split-module-identity.md](follow-ups/vite-setups-split-module-identity.md):
  B. Milestone 32 applies it, because the code with several setups does not
  exist yet.
- `imported-asset-base-url.md` A, `asset-content-type-rule.md` E,
  `css-extensionless-asset.md` A, `css-import-type-attribute.md` A,
  `data-url-loader-hint.md` B, and `asset-reference-positions.md` F: pull
  request #509 applied them and deleted the files.
- `design-external-link-check.md`: E. Milestone 1a applied it and deleted
  the file.

### Decisions that wait for the user

No decision waits for the user. On 2026-11-28 the user answered track E
decision 1 with F, and track I decision 3 with a spike of its option J, with
option I as the fallback. Track I decisions 4 to 9 closed with that answer,
because it no longer takes option H. Each track records its answers in the
plan of its branch. On
2026-11-27 the user chose B of
[decision 18e](#18e-several-folders-one-graph-for-each-folder), a folder
graph for each Storybook folder, with E of 18e-1, D of 18e-2, D of 18e-3, A of
18e-4, and B of 18e-5. Decision 18b closed with that answer. Track H applies
"What B changes" of 18e when it starts.

### Follow-up items that wait for the user

The user answered track E decision 1 with option F on 2026-11-28, for now,
and asked for a high-priority re-review of the route strategy, because it is
hard to change later. The file holds the full item and its options.

- [route-naming-strategy-review.md](follow-ups/route-naming-strategy-review.md):
  how Mokly names delivered stylesheets and assets in the long term.

The review of track B found these problems outside its scope. Each file
holds the full item and its recommended option. They block no milestone.

- [sidecar-transport-rejects-lone-surrogates.md](follow-ups/sidecar-transport-rejects-lone-surrogates.md):
  a lone surrogate in authored text stops the whole build.
- [screen-renders-skip-story-setup.md](follow-ups/screen-renders-skip-story-setup.md):
  a screen render depends on an earlier story render.

The review of track D found these problems in the Vite adapter. Each file
holds the full item and its recommended option. They block no milestone.

- [vite-env-link-target-watch.md](follow-ups/vite-env-link-target-watch.md)
- [vite-replay-computed-imports.md](follow-ups/vite-replay-computed-imports.md)
- [vite-sass-outside-root-reads.md](follow-ups/vite-sass-outside-root-reads.md)
- [vite-renderer-pruning-css-modules.md](follow-ups/vite-renderer-pruning-css-modules.md)
- [vite-composed-stylesheet-assets.md](follow-ups/vite-composed-stylesheet-assets.md)
- [vite-tailwind-scan-scopes.md](follow-ups/vite-tailwind-scan-scopes.md)
- [vite-css-url-resolution.md](follow-ups/vite-css-url-resolution.md)
- [vite-static-build-input-evidence.md](follow-ups/vite-static-build-input-evidence.md)
- [vite-outside-env-directory.md](follow-ups/vite-outside-env-directory.md)
- [base-extraction-committed-links.md](follow-ups/base-extraction-committed-links.md)
- [vite-lazy-css-order.md](follow-ups/vite-lazy-css-order.md)

The review of pull request #597, answer B of track D decision 6, found these
problems. Each file holds the full item and its recommended option. They block
no milestone.

- [vite-base-workspace-export.md](follow-ups/vite-base-workspace-export.md):
  a base that shares the working installation can compile the source of the
  head's workspace export.
- [vite-config-request-kind.md](follow-ups/vite-config-request-kind.md): the
  request that loads the Vite setup decides the values of the Vite config.

The review of track F found these problems. Each file holds the full item
and its recommended option. They block no milestone.

- [links-to-failed-stories-fail-builds.md](follow-ups/links-to-failed-stories-fail-builds.md):
  an incoming fragment link makes a failed story stop the build.
- [story-errors-hide-fatal-cleanup-errors.md](follow-ups/story-errors-hide-fatal-cleanup-errors.md):
  a story error can hide a fatal cleanup error.

### Defects in merged code

The first review of track B found defects in the code that pull request
#492 merged. Pull request #508 fixed them. This item remains. It needs no
decision, and a branch from this branch fixes it as its file says. Fix it
before the pull request into `main`.

- [crate-topic-pages-skip-link-check.md](follow-ups/crate-topic-pages-skip-link-check.md):
  the Markdown link check does not read crate topic pages.

The user chose on 2026-11-24 not to pursue
[workspace-setup-misses-gate-tools.md](follow-ups/workspace-setup-misses-gate-tools.md)
for now. It records the tools and services that a fresh workspace needs
for the complete gate, so read it before a gate run on a new machine.

The other follow-up items that this plan added need no decision, such as
[vite-entry-list-stale-imports.md](follow-ups/vite-entry-list-stale-imports.md)
from #597. A later
branch fixes each one as its file says.

### How to continue

1. Bring the decisions and the follow-up items above to the user, with their
   recommended options. Ask for all of them in one message.
2. Apply each answer in the milestone that waits for it, and record the
   answer in this plan with its date.
3. Fix the defect in merged code above. Finish track D: Milestones 14, 15,
   and 17 run on its track branch, with the review of Milestone 17 against
   this branch.
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
- **Answer:** closed with no option on 2026-11-27, because the user chose B
  of decision 18e. Each preview's mocks then reach the modules of its own
  stories only.

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
- **Answer:** D, chosen by the user on 2026-11-26. A file that the globs of
  a root match takes the Storybook folder of that root, when the root names
  one. For the other files inside root directories, the deepest root
  decides. Every other file keeps the location rule of option E.

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

### 18e. Several folders: one graph for each folder

- **Severity:** High, changed from Medium by the options check of
  2026-11-27, because the problem is wrong output and it blocks track H.
  **Effort:** Large.
- **Source:** Review: the re-check of decision 18 that the user asked for on
  2026-11-26. The spike of 2026-11-27 tested option B.
- **Category:** Docs or spec.
- **Location:** [Decision 18](#18-several-storybook-folders-share-one-vite-setup)
  and [decision 18b](#18b-mocks-of-modules-that-another-setup-owns).
- **Terms:**
  - **Folder graph:** one Vite server and one module runner for each
    Storybook folder. A file that two folders load compiles once in each.
  - **Registries:** the sidecar's maps that tie a value to a catalogue entry:
    definitions, link targets, and story components. A wrapper lookup that
    misses stops the build with "unexported component", at
    `packages/mokly/src/authoring/components.ts:26-29`.
  - **Bridge:** a registry key made of the resolved file and the export name,
    in place of the module object. The two copies of one export, in two
    folder graphs, then match one entry.
  - **Declaring module:** the module whose own code binds an export. A barrel
    file that re-exports the value is not its declaring module.
  - **Catalogue renderer:** the one module that the `renderer` configuration
    field names. It wraps every React screen and component render.
- **Background:**
  - Decision 18 had two goals: each folder's stories compile as in their own
    Storybook, and a module that two folders use keeps one identity.
  - Option E compiles each file once, with its owner's setup. So a story sees
    a shared module as the other folder compiles it, with that folder's
    aliases, plugins, env values, and mocks. 18b is the mock case of this.
  - E does not keep one identity either. Two setups can resolve one import to
    two files, and in the spike a component then read the wrong React
    context. Item 32, answered B, warns about that split.
  - Option C of decision 18, a graph for each folder, said that a registered
    component from another folder's root then fails as unexported. Item 32
    says that C gives a module two identities. The bridge removes the first
    failure, and the second is the cost of B below.
  - Track D's evaluator already sees the id of each module that it runs, at
    `packages/mokly/src/sidecar/vite-evaluate.ts:103-117`. So it can record
    each module's exports for a bridge.
  - No code for several folders exists yet. Track H waits for this answer.
- **Problem:** E gives each module one version for all importers. So no rule
  can match two Storybooks that treat one shared module differently, and E's
  one identity still splits.
- **Impact if no action:** Under E, each answer to 18b drops a mock, or gives
  some stories a mock that their own Storybook does not use. A later move to
  folder graphs would mean rewriting track H's Vite code.
- **Root question:** How does each story compile as its own Storybook compiles
  it, and each screen with a setup that all its imports can use, while each
  use, link, and wrapper keeps one catalogue entry? The options check of
  2026-11-27 wrote this question, because screens and components also
  evaluate in the folder graphs.
- **Options:** rewritten on 2026-11-27 from the spike result below.
  - **A.** Keep option E, and answer 18b with its option E. A mock of a
    module that no folder owns reaches every folder's stories. A mock never
    reaches a module that another folder owns. Answers 18a, 18c, and 18d, and
    track H's scope, stay. The E prototype compiled a shared tree of 200
    modules once. Effort: Large, as track H plans it.
  - **B.** One folder graph for each Storybook folder, plus the bridge. Each
    story, screen, and the catalogue renderer evaluate in folder graphs:
    - A story or a screen evaluates in the graph of the folder that its root
      names. Each graph compiles every module that its entries import with
      its own setup, so each preview's mocks reach every module of its own
      stories and no stories of another folder.
    - The catalogue renderer evaluates once in each graph that renders React.
      A renderer in one graph gave the screens of the other graph the
      default context value.
    - Every graph uses one `react` and `react-dom`. A folder alias of `react`
      failed to load, and a second React copy in one package broke hooks.
    - The bridge key names the declaring module, which Vite's server-side
      export getters give. A key from the first module that exports a value
      split in an import cycle. The spike read the getters from the text of
      Vite's output. Mokly's own export parser, in `export-name-cache.ts`, is
      a more stable source. Every registry lookup uses the key: the
      wrapper, the deferred links, the use references in
      `describe-records.ts`, the render-time links in `render-session.ts`,
      and story components with their `memo` and `forwardRef` inner types.
    - A value that two graphs load matches one entry, and each render uses
      its own graph's copy, as each Storybook does.
    - The bridge cannot match a value that is not a module export, or two
      files that one import resolves to in two graphs. A wrapper then keeps
      its "unexported component" error, and a story use is lost. Decisions
      18e-2 and 18e-3 settle these cases.
    - Costs: each module that several graphs import compiles and runs once
      in each, at every build, because the bundle cache stores no Vite
      compile. A module's process-wide side effects run once for each graph.
      A shared file that needs an alias that only another folder's setup has
      fails in this graph, as it fails in this folder's own Storybook. The
      source of a workspace package can differ, because that Storybook can
      load the package's build file. Decision 18e-5 settles it.
    - The compiled recipe holds one copy of a shared module's code for each
      graph that loads it. A recipe above the 64 MiB frame limit fails with
      `bundle-failed`. The spike did not measure recipe bytes.
    - It changes earlier answers. The list under the spike result gives each
      change. Effort: Large.
  - **C.** Keep E, and fork each mocked module, and each module on its import
    chain, for each folder that mocks it. The bridge ties the copies to their
    entries. Mocks then match, but E's other limits stay, and the fork rules
    add complexity. The spike did not test it. Effort: Large, more than B.
  - **D.** Do B, and run each folder graph in its own sidecar process, with
    the folder's parent as its working directory. The spike showed that
    presets, env values, and `beforeAll` hooks do not need it. It isolates
    only other process-wide state: a shared module's global side effects and
    Storybook's spy registry. The spike tested its render boundary, not its
    protocol between processes or its cost. Effort: Large, the most.
  - **E.** Do B, and evaluate a module once for all graphs when its compiled
    code, its resolved imports, and its run-time values are equal in each
    graph that loads it. Only the modules that differ, such as a mocked
    module and its importers, get one copy for each graph. Equal shared code
    keeps one identity and runs its global effects once. The compile cost
    stays as in B, the runner needs option A's unique URLs again, and equal
    modules share state across folders, which no Storybook does. The spike
    did not test it. Effort: Large, more than B. Added by the options check
    of 2026-11-27.
  - **F.** Do B, and add a `vite` field that names modules that evaluate once
    for every graph. A named module compiles with the setup of the first
    root that names a folder, keeps one identity, and loses the other
    folders' aliases, plugins, and mocks. A built package can already do
    this through `ssr.external` in the optional file. Effort: Large, B and a
    Medium field. Added by the options check of 2026-11-27.
  - **G.** Do B for stories only. Screens and components compile as option A
    says: each module once, with its owner's setup. The story graphs then
    need no copy of the catalogue renderer, but Mokly builds both module
    models and the bridge between them, and 18b needs an answer again for
    screens. Effort: Large, about A and B together. Added by the options
    check of 2026-11-27.
- **Left out:** Option C of decision 18 without a bridge, because a wrapper
  or a link from another folder stops the build. A bridge for wrappers only,
  because story component uses would then match only inside one folder. One
  setup for the whole catalogue, because a per-package alias fails the whole
  bundle. One Storybook folder for each configuration, because the catalogue
  is no longer one. A fork of the mocked module alone, because each importer
  still loads the real module. B with the catalogue renderer in one graph,
  because the screens of the other graphs lose its providers. A renderer for
  each Storybook folder in a new field, because a copy of the one renderer in
  each graph gives every screen the same providers with no field. A and B
  behind a configuration switch, because with A a folder's stories do not
  render as in their own Storybook, and with B it is B and a second module
  model.
- **Wider fix:** B, because one rule gives every folder its own setup and
  mocks for all its modules. D also isolates process-wide state.
- **Previous examples:** 18b, the mock case. Item 32, the split. Option D of
  decision 18, where one alias key keeps one target.
- **Related:**
  - 18b waits for this item. A answers it with 18b's option E, and B, C, and
    D close it.
  - Decision 17 keeps its rule for one folder.
  - Milestone 32's first TODO, the presets of two folders in one process,
    passed in the spike for every option.
  - Decisions 18e-1 to 18e-5 below. 18e-1 applies to every option. 18e-2 to
    18e-5 apply only when this decision takes a folder graph: B, D, E, F, or
    G.
  - Track H, Milestones 30 to 33, waits for this answer.
- **Recommendation:** B. It is the cheapest option that compiles every module
  of a folder's stories with that folder's setup and mocks, and the spike
  tested it end to end at a bounded cost. D also isolates process-wide state,
  at the highest cost. Mocks reach every shape of installed package only with
  the answer to 18e-1.
- **Action:** ask the user, because B replaces option E, which the user chose
  on 2026-11-19, and it narrows the answers to 18a, 18c, and item 32.
- **Answer:** B, chosen by the user on 2026-11-27. It replaces option E of
  decision 18. Decision 18b closes. "What B changes" below applies when
  track H starts, together with the answers to 18e-4 and 18e-5.
- **Spike result:** B works for the tested cases, with Storybook 10.6.9,
  Vite 8.3.8, and React 19.2.3, on Node 22.15.0 and 24.22.1. The spike used
  Storybook's real preset loader, `viteFinal` chains, env preset, mock
  plugin, mocker, and story composition. Mokly's registries, the JSX shim,
  the recipe capture, and the Serve edit were prototypes. An independent
  check reran every probe on both Node versions with the same results, and
  six more probes found the renderer, key, React, mock, cost, and folder
  limits below. The results:
  - The presets of two folders loaded in one process, in both orders, and
    each folder got its own merged setup. Answer D of 18d gave each folder
    its own `STORYBOOK_*` values. So no option needs a process for each
    folder for its presets.
  - Each graph compiled its stories and every module that they import with
    its own alias, plugin, and env values. A shared file compiled once in
    each graph.
  - App's preview mocks reached app's stories and a module inside
    `packages/ui`. Ui's stories got the real modules. A mock reached an
    installed package only when Storybook's target and the file that the
    server loads were one file. Decision 18e-1 covers the other shapes.
  - One render used one copy of each module, with one React. Contexts and
    hooks worked.
  - The bridge matched a wrapper, a link, and story component uses across
    graphs. It also matched barrel re-exports, default exports, symbolic
    links, and `memo` and `forwardRef` wrappers.
  - Each graph worked on the base side, in a replay of its recorded module
    fetches with no Vite server, and after an edit. An edit of a shared file
    invalidated both graphs.
  - The cost, against an option E prototype with a shared tree of 200
    modules, gives the median of five runs on Node 22.15.0 and 24.22.1:

    | Folders | Cold compile, B over E | Cold start, B over E | Cold start, added | Serve edit, added | Peak memory, B over E |
    | ------- | ---------------------- | -------------------- | ----------------- | ----------------- | --------------------- |
    | 2       | 1.8 to 2.0             | 1.16 to 1.26         | 0.24 to 0.41 s    | Less than 4 ms    | 1.02 to 1.05          |
    | 5       | 3.0 to 4.2             | 1.51 to 1.76         | 0.95 to 1.33 s    | 54 to 72 ms       | 1.09 to 1.35          |

    The cold start includes preset loading, server creation, compile,
    evaluation, and render. A replay compiles nothing and took 1.4 to 2.4
    times E's evaluation time. In this fixture almost every module is
    shared, which is the worst case for B. With 200 local modules in each of
    five folders, B's cold compile was 1.36 to 1.47 times E's.

  - The env preset, the `beforeAll` hooks, Storybook's mocker global, and its
    spy registry clash in the same way under E. Only a shared module's global
    side effect is new under B: it ran once in each graph.
- **What B changes:** the user has not chosen B, so none of these changes
  applies yet.
  - 18a B no longer chooses the setup of shared files. Decision 18e-4 settles
    which graph runs the entries of a root that names no Storybook folder.
  - 18b closes with no option, because each preview's mocks reach every
    module of its own stories, as in Storybook.
  - 18c D keeps its first rule: a file that a root's globs match runs in
    that root's folder graph. Its other rules no longer choose a JavaScript
    setup. The spike did not test whether they still choose the setup of a
    configured stylesheet that no graph imports.
  - 18d D stays, and its values reach every module of a folder's stories.
  - Item 32: two files that one import resolves to keep two bridge keys.
    The approved warning would fire on normal per-folder aliases, so
    decision 18e-3 replaces its trigger.
  - Milestone 30: the first TODO states folder graphs, the bridge, the
    renderer rule, and the limits, in place of one identity and one place in
    one module graph. The answer to 18b leaves.
  - Milestone 32: the TODO of option E becomes one Vite server and one module
    runner for each folder graph, with no transport between servers and no
    URLs that are unique across servers. One React serves every graph. The
    bridge covers every registry lookup and the style adapters of each
    graph. Each graph records its own module fetches. The TODO of 18b leaves.
    The tests of two folders check that a shared module runs once in each
    graph and that a mock never reaches another folder's stories.
  - Design call 18: one server and one runner for each folder graph. Each
    import resolves and compiles in its own graph, and each module has one
    identity in each graph. Each changed file still goes to every server.
  - Design call 22: Mokly still calls the optional file once for each setup.
    The setup that a call returns compiles every module of its folder's
    entries.
  - Also: Milestone 35's `StoryComponents` uses the bridge key, and
    Milestone 14's one React covers every graph.
- **Evidence:** `.context/storybook-support/spike-57/REPORT.md`, and the
  independent check in `.context/storybook-support/spike-57-check/REPORT.md`.

Design calls of the spike. These calls are the orchestrator's, made on
2026-11-27 from the spike. Milestone 32 applies them under every option of
this decision. They stay in this section until the user answers it, so that
the milestones do not change before the answer.

- S1. Under the adapter, Mokly keeps the named `STORYBOOK_*` defines of
  Storybook's env plugin and removes its define of the whole
  `import.meta.env` object for the server environment. Vite then builds that
  object. Reason: in the spike the whole-object define hid each folder's
  `VITE_*` values and `MODE`, and it added quotes around the values that an
  object read returned. Decision 17 requires stories to match Storybook,
  where Vite supplies these values.
- S2. In Serve, an edit of a loaded Storybook setup file, such as `main.*`
  or a preset module, starts a new sidecar process. Edits of other files keep
  the current Vite servers. Reason: Storybook's preset loader caches each
  preset module at its first URL, so a new load in the same process returned
  the old setup.
- S3. Design call 24 stays: one mocker for each sidecar process, one story
  render at a time, and one spy registry for the process. The guide states
  that `clearAllMocks()` clears the spies of every folder. Reason: the one
  mocker gave the right automock and spy values for two folders, and a
  scoped registry needs a change to Storybook's test library. Under D of
  this decision, each process has its own registry, and the guide sentence
  changes.
- S4. With several Storybook folders, the one active `beforeAll` setup of
  answer D of B2 also switches when the next story has another preview: the
  cleanup of the old setup runs, and then the new preview's `beforeAll`
  runs. Reason: in the spike, two open `beforeAll` scopes in one process gave
  both folders the second preview's global, and serial hooks with cleanup
  gave each folder its own. B2 is the orchestrator's own call, and this
  applies under every option.

#### 18e-1. Mocks of installed packages whose files differ

- **Severity:** High. **Effort:** Medium.
- **Source:** Review, from the independent check of the spike.
- **Category:** Docs or spec.
- **Location:** None. Milestone 32 is not built.
- **Background:**
  - Storybook's mock plugin picks the file of a mocked installed package with
    the browser resolve conditions `browser`, `import`, `module`, and
    `default`.
  - Mokly's server environment resolves the same import with Node's
    conditions and the conditions of design call J1.
  - Design call J2 compiles a mocked installed package in Vite, so that the
    mock can reach it.
  - Milestone 32 already records the limit when a mock misses the Node entry.
  - In `storybook dev`, Vite pre-bundles each mocked installed package, and
    the mock plugin also matches the pre-bundled file by the package name.
    Mokly pre-bundles nothing, so only the match by file can apply.
  - J2 runs a mocked package inside Vite's module runner, which cannot run a
    CommonJS file. So an automock or a spy of a CommonJS package fails
    under every option. A `__mocks__` redirect replaces the file, so it still
    works.
- **Problem:** The mock reached an installed package only when both
  resolutions gave one file. With J1 and J2, it missed for three of four
  package shapes: `node` before `storybook`, separate `node` and `browser`
  builds, and a `storybook` build that differs from the `browser` build.
  Nothing reported the miss.
- **Impact if no action:** A story renders the real package where its
  Storybook renders the mock, with no warning.
- **Root question:** How does a preview's `sb.mock()` of an installed package
  reach each import of that package in Mokly's render, as it does in the
  folder's own Storybook? The options check of 2026-11-27 wrote this
  question, because Storybook's dev server matches the package by its name,
  not only by its file.
- **Options:**
  - **A.** Apply J1 and J2, and the guide states that both resolutions must
    give one file. Effort: Small.
  - **B.** A, and warn when a mocked package resolves to another file than
    Storybook's target. The warning names the folder and both files, and it
    fails `--strict`. Effort: Medium.
  - **C.** Resolve each mocked installed package, for the server, to the file
    that Storybook's mock plugin picks. The mock then always reaches it, but
    a browser build can fail in Node. Effort: Medium.
  - **D.** A project can choose, for each package, to mock the file that the
    server resolves. Mokly and the browser can then mock different files.
    Effort: Large.
  - **E.** Mokly applies each mock of an installed package to the file that
    the server resolves for the mocked name, with `extractMockCalls`,
    `findMockRedirect`, and `getAutomockCode` from
    `storybook/internal/mocking-utils`. This is what `storybook dev` does for
    the pre-bundled package. The server keeps its Node build. An automock
    wraps the Node build, whose exports can differ from the browser build in
    rare packages. It uses Storybook internals, as design call 13 does. The
    spike did not test it. Effort: Medium. Added by the options check of
    2026-11-27.
- **Left out:** A package that Node loads outside Vite: no Vite plugin, and
  so no mock, reaches it. A pre-bundle of each mocked package, as
  `storybook dev` does: it breaks the adapter rule of no pre-bundle and no
  written file. A Node loader hook that mocks the package: Node keeps one
  copy for the process, so the mock reaches every folder's stories. Browser
  conditions for the whole server environment: C is better on every point.
- **Wider fix:** E, changed from C by the options check of 2026-11-27,
  because E holds for any file that a package's exports give the server, and
  C must know Storybook's browser target.
- **Previous examples:** Design calls J1 and J2.
- **Related:** It applies to every option of 18e. Milestone 32 waits for it.
- **Recommendation:** E, changed from B by the options check of 2026-11-27.
  It should reach every tested package shape with no warning, and it keeps
  the file that Node can run. B's warning asks for a fix that a project often
  cannot make in an installed package.
- **Action:** ask the user, because E applies a mock to another file than
  Storybook's browser target, and B adds a warning that fails `--strict`.
- **Answer:** E, chosen by the user on 2026-11-27.

#### 18e-2. Values that have no bridge key

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation, from the spike.
- **Category:** Docs or spec.
- **Location:** None. Folder graphs are not built.
- **Background:**
  - Under B, the bridge matches a value of one graph with its copy in
    another graph through its declaring module and export name.
  - A definition that no entry module exports fails today in one graph too,
    because the registration walk reads only the exports of entry modules.
  - The case that is new under B is a value that one module makes and that
    two graphs reach by a path that is not a direct export. Examples are a
    member of an exported object, such as `Icons.Close`, or the `component`
    of a stories meta.
  - Inside one graph, the object still matches itself.
- **Problem:** Across graphs, such a value has no key. A wrapper then fails
  with "unexported component", a link fails as an unknown definition, and a
  story component use is lost without a message.
- **Impact if no action:** A screen of one folder that renders such a
  component from another folder shows no use of it in Changes.
- **Root question:** How does a value that a module makes, but does not
  export directly, keep its tie to its catalogue entry when another folder's
  graph renders it? The options check of 2026-11-27 wrote this question, so
  that the options can prevent the miss.
- **Options:**
  - **A.** Keep the match by object inside one graph and the current wrapper
    and link errors. The guide states that a value must be a module export
    to match across folders. Effort: Small.
  - **B.** A, and warn when a stories meta's component has no bridge key and
    another graph evaluates the same file. The warning names the export to
    add, and it fails `--strict`. Effort: Medium.
  - **C.** An authoring field gives such a value an explicit identity.
    Mokly then needs rules for collisions. Effort: Large.
  - **D.** The bridge key adds a member path: the declaring module, the
    export, and the own data properties that lead to the value, as B already
    keys the inner function of a `forwardRef`. Mokly reads only own data
    properties, to a fixed depth, so no getter runs. When a value has two
    paths, the first path in sorted order wins. A value from a cache or from
    a call at render time still has no key. Effort: Medium. Added by the
    options check of 2026-11-27.
- **Left out:** A match by title, because two values can share a title. A
  match by the first module that exports a value, because an import cycle
  gave two keys in the spike. A key from the call that makes the value,
  because one factory gives every value the same call site.
- **Wider fix:** C, because every value can then have a key.
- **Previous examples:** None found.
- **Related:** It applies only when 18e takes a folder graph. 18e-3 covers a
  miss from two resolved files.
- **Recommendation:** D, changed from B by the options check of 2026-11-27.
  It ties the likely cases with no change to the project, as decision 13
  intends for story component uses. B can tie its warning only to the
  stories file, and without D it cannot name the module that must export
  the value.
- **Action:** ask the user, because D changes which values match an entry,
  B adds a warning that fails `--strict`, and C adds an authoring field.
- **Answer:** D, chosen by the user on 2026-11-27.

#### 18e-3. Item 32's warning under folder graphs

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Review, from the independent check of the spike.
- **Category:** Docs or spec.
- **Location:** `plans/follow-ups/vite-setups-split-module-identity.md`.
- **Background:**
  - On 2026-11-25 the user chose option B of item 32: Mokly warns when two
    setups resolve one import specifier to different files, and the warning
    fails `--strict`.
  - Under B of 18e, each graph compiles a shared file with its own setup.
  - In the spike, `#setup` in `packages/shared/setup.tsx` resolved to a
    different file in each graph, by design.
- **Problem:** The approved warning fires on that normal per-folder alias.
- **Impact if no action:** A monorepo with per-folder aliases fails
  `--strict` under folder graphs, also when every render is right.
- **Root question:** Under folder graphs, how does the user learn that a
  per-folder resolution made a render or a catalogue tie wrong? The options
  check of 2026-11-27 wrote this question, because under B each render uses
  one graph, so a split no longer splits module state inside a render, and
  two resolved files are two components.
- **Options:**
  - **A.** Report no split. The guide states that each graph resolves with
    its own setup. Effort: Small.
  - **B.** Report a split only when it makes a bridge lookup miss: a wrapper,
    a link, or a story component use. The warning fails `--strict`.
    Effort: Medium.
  - **C.** Keep item 32's answer B for every split. Effort: Medium.
  - **D.** Add no warning. When a wrapper fails as unexported or a link fails
    as an unknown definition, and the same specifier resolves in another
    graph to the file that holds the registered definition, the existing
    error names both files and both folders. Story uses stay silent, because
    two files are two components. Nothing new fails `--strict`. Effort:
    Medium. Added by the options check of 2026-11-27.
  - **E.** Report each split as a warning that `--strict` does not count, as
    `base-dependencies` is. A build with per-folder aliases still passes,
    but each build of such a monorepo prints these warnings. Effort: Medium.
    Added by the options check of 2026-11-27.
- **Left out:** Item 32's option C, one resolution of a workspace package
  name for every graph, because a folder's stories then lose their own
  aliases.
- **Wider fix:** D, changed from B by the options check of 2026-11-27,
  because each render already uses one graph, and D explains every split
  that stops the build, whatever setting causes it.
- **Previous examples:** Item 32.
- **Related:** It applies only when 18e takes a folder graph. 18e-2 covers a
  miss from a value without an export.
- **Recommendation:** D, changed from B by the options check of 2026-11-27.
  It explains the two errors that a split can cause, and it stays silent
  where two files are two components. B also fires for the spike's own
  `#selection` alias, which works as designed.
- **Action:** ask the user, because every option except C changes the user's
  answer to item 32.
- **Answer:** D, chosen by the user on 2026-11-27. It replaces the answer B
  to item 32 under folder graphs.

#### 18e-4. Entries of roots that name no Storybook folder

- **Severity:** Medium. **Effort:** Small.
- **Source:** Review, from the options check of 2026-11-27.
- **Category:** Docs or spec.
- **Location:** None. Folder graphs are not built.
- **Background:**
  - The user chose answer B of 18a on 2026-11-25, for option E of decision 18. A file that no Storybook folder owns compiles with the setup of the
    first root, in configuration order, that names a folder.
  - Under option E, that rule covers shared files. Under a folder graph, each
    graph compiles its own imports, so the rule covers only entries: screens
    and components of a root that names no folder, when no `.storybook`
    folder exists in the source root.
  - Such an entry evaluates in one graph, and that graph compiles its whole
    import tree.
  - In the spike, such a screen with the first folder's setup rendered with
    that folder's alias and its preview's mocks. With a plain Vite setup, its
    import of a folder alias failed with `Cannot find module '#setup'`.
- **Problem:** Under a folder graph, answer B of 18a gives the whole import
  tree of these entries the first folder's aliases and mocks. The user chose
  the rule for shared files only.
- **Impact if no action:** Milestone 30 cannot state the graph of these
  entries, and a change of root order can change their render.
- **Root question:** Under folder graphs, which setup compiles a screen or a
  component whose root names no Storybook folder, with every module that it
  imports?
- **Options:**
  - **A.** Keep answer B of 18a: the graph of the first root that names a
    folder, with that folder's preview mocks. A catalogue with one folder
    already compiles every entry with that folder's setup, as decision 17
    says. Effort: Small.
  - **B.** A, but in an extra graph with that folder's setup and without its
    preview mocks. This adds one Vite server. Effort: Medium.
  - **C.** A plain Vite setup of the configuration directory, as a catalogue
    without a Storybook folder uses. This adds one Vite server, and an import
    that needs a folder's alias fails, as in the spike. Effort: Medium.
  - **D.** When roots name several folders, the configuration must name the
    setup of each root that names no folder. Without it, the configuration
    check fails. Effort: Medium.
- **Left out:** Each module with the setup of the folder that owns it: that
  is option G of 18e.
- **Wider fix:** D, because the project then chooses each setup.
- **Previous examples:** Decision 18a, options A to E.
- **Related:** It applies only when 18e takes a folder graph. Decision 18a
  answered it for option E.
- **Recommendation:** A. It keeps the user's answer to 18a and decision 17's
  rule for one folder, and it adds no server and no configuration error. D
  gives the project the most control.
- **Action:** ask the user, because under a folder graph answer B of 18a
  decides the whole import tree of these entries, and the user chose it for
  shared files only.
- **Answer:** A, chosen by the user on 2026-11-27. Such an entry runs in the
  graph of the first root, in configuration order, that names a Storybook
  folder, with that folder's preview mocks. Option E, A with a guide sentence
  on the root `storybook` field, was offered the same day and not chosen.

#### 18e-5. Workspace package sources under folder graphs

- **Severity:** Medium. **Effort:** Small.
- **Source:** Review, from the options check of 2026-11-27.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-comparison-packages.md`, "Workspace
  Package Sources".
- **Terms:**
  - **Source step:** Mokly's rule that loads a workspace package's source in
    place of its build file. It applies under Vite since answer B of track D
    decision 6.
- **Background:**
  - A folder's own Storybook loads another workspace package as its build
    file when that package's exports name the build.
  - Under a folder graph, the source step gives the importing graph the
    package's source, which then compiles with the importing folder's setup.
  - Under option E, the source compiles with the setup of the folder that
    owns the package.
  - The optional file of design call 22 can add an alias to each setup.
  - The spike did not test this case.
- **Problem:** A package source that needs its own folder's alias or plugin
  fails in the importing graph, while the importing folder's own Storybook
  loads the build and works.
- **Impact if no action:** A build fails, or a source compiles without its own
  plugin, for a layout that works in both Storybooks.
- **Root question:** Under folder graphs, which setup compiles the source of a
  workspace package that the importing folder's Storybook loads as a build?
- **Options:**
  - **A.** The importing graph's setup. The guide states that a package's
    source must compile with each importing folder's setup, and that the
    optional file can add a missing alias. Effort: Small.
  - **B.** The importing graph adds the `resolve.alias` entries of the folder
    that owns the package, only for files inside that package. The owner's
    plugins stay out. Effort: Medium.
  - **C.** For a package whose directory another Storybook folder owns, skip
    the source step and load the build file, as that Storybook does. Changes
    then shows an edit of the package only after a new build of it. Effort:
    Medium.
  - **D.** Inside the importing graph, compile the files of such a package in
    a server with the setup of the folder that owns it. The importing
    preview's mocks then do not reach them. Effort: Large.
- **Left out:** The owner's whole setup merged into each graph, because
  plugins can conflict, as option D of decision 18 found.
- **Wider fix:** B, because a package then resolves its own imports in every
  graph.
- **Previous examples:** Answer B of track D decision 6.
- **Related:** It applies only when 18e takes a folder graph. The cost line
  of option B of 18e names it.
- **Recommendation:** A. In many monorepos the importing Storybook also loads
  the source, and A then matches it exactly, while the optional file fixes
  the other layouts. B serves more layouts with no project change.
- **Action:** ask the user, because the spike did not test this layout, so
  no option is clearly best, and C changes the user's answer to track D
  decision 6.
- **Answer:** B, chosen by the user on 2026-11-27. For an importer inside a
  workspace package, the importing graph first applies the `resolve.alias`
  entries of the Storybook folder that owns the package. The importing
  folder's aliases stay for its own files. The owner's plugins stay out.
  Reason: a package's source that shares an alias key, such as `@/`, with the
  importing folder must not resolve to the importing folder's file.

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
    mockup whose preview matches it. Changed on 2026-11-25 by design call 33:
    only `SAVED_PREVIEW_COPY` of the design copy holds the new sentence, until
    Milestone 24a moves it into both `CONTROLS_COPY` objects.
33. Made on 2026-11-25 in Milestone 1a. The Storybook mockups live in their
    own Canvas folder, `design/canvas/stories`, "Storybook stories", because
    the Component explorer folder already holds five screens. One branch
    depicts every state: the Menu stories file, whose first story,
    Collapsed, renders the parent page, whose Expanded story no longer
    renders, and whose Disabled story the branch adds. The panel of a story
    opens at its head, so the Story and Storybook rows show. The two
    saved-props sentences of design calls 29 and 32 stay in
    `SAVED_PREVIEW_COPY` of the controls copy, outside `CONTROLS_COPY`,
    until Milestone 24a moves them into `CONTROLS_COPY` and the viewer's
    copy together. Reason: the merge of `main` on 2026-11-25 dropped the
    sentence of design call 32 from the viewer's copy, so the second TODO of
    Milestone 24a no longer holds, and `tests/viewer_controls_copy.test.ts`
    requires both copies to hold the same keys.

### Track F design calls

These calls are mine, made on 2026-11-25 in track F, on the branch
`calummoore/storybook-track-f-failed-stories-omid`.

- F1. A failed story view comes only from the story's own work: its
  composition, the preview's `beforeAll` hook, its loaders and `beforeEach`
  hooks, their cleanups, and the render. `render-timeout`, `sidecar-crashed`,
  and the bundle and protocol failures keep their codes and stop the build.
  Reason: decision 5 names a render failure, and a timeout or a crash
  replaces the sidecar process. A hung story would also cost the deadline
  twice for each view.
- F2. Only a saved view whose root is the story gets the error document: in
  `build`, `publish`, Serve, and both sides of Changes. A live props render of
  a story keeps the generic `render-failed` preview failure, and the Props tab
  shows its alert. Reason: decision 24 chose E, not C, which would have given
  the live route the error document.
- F3. The sidecar returns a failed story render as a result with the story's
  name and its reason, not as an error. The core then writes the document and
  the warning. Reason: the sidecar holds the story names and the source and
  dependency roots that give logical paths, and the core owns documents,
  usage, and warnings.
- F4. The reason is the message of the thrown error, or the string of a
  thrown value that is not an error, with no stack. A path inside the side's
  source root reads relative to it. A path inside a selected dependency root
  reads as its logical name, such as `node_modules/pkg/index.js`. Each other
  absolute path or `file:` URL becomes `…`. Reason: design call 26.
  Changed on 2026-11-25 by review fix round 1: a path under the home or
  temp folder also becomes `…`. When the value, its message, or its name
  cannot become text, the reason is `Unknown error`. Each lone surrogate
  becomes U+FFFD. Changed on 2026-11-25 by review fix round 2: a known root
  starts a path only after a character that is not a letter, a digit, `_`,
  `.`, `-`, `/`, or `\`, or right after the `@fs` route or the empty
  authority of a URL. Mokly changes each path once. Reason: delimiters
  vary, relative paths and web links must keep their text, and one
  unreadable value must not stop the build.
- F5. The warning message gives the JSON-quoted story id, then "could not
  render; add the "!mokly" tag to leave it out:", then the reason, with the
  line breaks of the reason joined by spaces. The failure page gives the
  exact form. Reason: design call 9 names these parts, the route
  names the view, and the reason comes last because its length varies.
- F6. The error document keeps the head of a story document without any
  stylesheet: no configured, component, renderer, entry-module, collected, or
  preview CSS. It carries its own style element and the colour scheme of its
  view. Its body holds the empty root region, then the error text. Reason:
  decision 26 and design call 27.
- F7. The failure rules get their own page,
  `docs/protocol/mokly-storybook-failures.md`, which the Storybook stories
  page links. Reason: the stories page, the setup page, and the sidecar page
  are near the 250-line cap, and track E edits the stories page in parallel.
- F8. The Props tab names the last valid props when at least one shown frame
  of the edited entry shows an accepted edit, and the saved props otherwise.
  The rule lives in `docs/protocol/mokly-component-controls-design.md`.
  So when the Frames filter shows another frame beside a frame with an
  accepted edit, and its render fails, the alert names the last valid
  props. When the compact layout shows only a frame that no accepted render
  covers, the alert names the saved props. Reason: the alert names what is
  on screen. Changed on 2026-11-25 by review fix round 1, which corrected
  the compact-layout example.
- F9. Made in review fix round 1, and widened in review fix round 2. Every
  error of Mokly's own components and helpers while a story renders stops
  the build. An error with a Mokly code, such as `component-props`, keeps
  that code. Every other error of Mokly's own code, such as a duplicate
  instance id, fails with `render-failed`, and so do Mokly's own checks of
  the rendered output. Reason: these errors ask for a fix in the catalogue
  or protect Mokly's records, so the `!mokly` hint of an error document
  would point at the wrong fix. Round 2 replaced my earlier call to keep
  plain errors of Mokly's helpers as failed views, because that call broke
  the duplicate-id and props rules inside stories.

- F10. Made in review fix round 2. A failed story view is not a successful
  render for the warm-up of Serve. It is not recorded, it does not move the
  warm head, it does not prove that a process is warm, and its replay does
  not end the warm-up. A render store hit of a failed view records nothing.
  Reason: the warm-up gains most from replayed renders that succeed, and a
  failed view leaves the process in use. Recording every reply was rejected,
  because failures would push out the successful requests.
- F11. Made in review fix round 2. A URL in a reason keeps its text, except
  the path after an `@fs` route or an empty URL authority. Reason: links
  such as the links of React's minified errors carry the message.
  Replacing each URL with `…` was rejected for that reason.

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
| H. Storybook setup on Vite | 30 to 33   | Tracks C, D, E, and J, and decisions 18a to 18e |
| I. Story component usage   | 34 to 36   | Tracks B and D                                  |
| J. Spike for decision 18   | 37         | Nothing                                         |

The last milestone of each track runs the targeted tests and the complete
gate, commits, pushes, and runs the `implementation-review` skill against
this branch. The track's workspace gives the findings and the decisions to
the user in its own session, applies the fix rule, and opens a pull request
into this branch. The orchestrator merges it.

Design call 34, made on 2026-11-25: the orchestrator updates
[Where the work stands](#where-the-work-stands) at each merge of a track
branch, and a track branch lists those changes in its pull request
description. Reason: a track branch edits only its own TODO lines, so the
status section goes stale when each track edits it.

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
- [x] Update the mockups for the answer to decision 27. Milestone 1a does
      this TODO on the Canvas design, and ticks it. Branch:
      `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.
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

- [x] Draw the state of a story that could not render on the Canvas
      component page, desktop and mobile, and in Changes: the error document
      in Current, and the last successful render in Before. The error
      document names the story, says that it could not render, gives the
      reason in a secondary place, and gives the `!mokly` tag. It carries
      only its own styles, with system colors that follow the view's scheme,
      as decision 26 says. Draw it in a dark view too. Branch:
      `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.
- [x] Draw the Story row of design call 30 and the Storybook link in the
      Details of a stories entry. The link opens in a new tab, with an icon
      and a screen-reader label, as decision 27 says. Draw it without an
      address, because a design link opens a design entry. The page of an
      added entry in Changes has no Storybook link, as decision 23 says.
      Branch: `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.
- [x] Draw the saved-props sentences of design call 29 in the "Render
      failed" and the "Invalid prop value" controls mockups, and the "Later
      edit failed" state of design call 32. Branch:
      `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.
- [x] Add each new state to the component and controls design inventories,
      the screen and browser inventories, and the design snapshots. Branch:
      `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.
- [x] Follow the copy rules and the forbidden patterns of the `product-ui`
      skill. Branch:
      `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.
- [x] Run the mockup check named in `AGENTS.md`. Smoke-test the changed
      pages through `npm run dev`. Branch:
      `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.
- [x] Update the design and the TODOs of this plan for each problem that the
      mockups show. Branch:
      `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.
- [x] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.
      Branch: `calummoore/storybook-milestone-1a-canvas-mockups-omnr`.

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
- [x] Apply the answer to decision B4 to the protocol pages.
      Branch: `calummoore/storybook-track-b-finish-ekj1`.

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
- B-g. Made on 2026-11-25 by the orchestrator of the track B finish, for the
  answer to B4. The warning code is `storybook-parameter-ignored`. Its
  subject is the entry of the story's page, and its message is
  `parameter {path} is ignored: {reason}`, with the JSON-quoted path of the
  malformed value, such as `"mokly.viewports.tablet"`. Reason: the subject
  already names the story's page, the record rule forbids a message that
  repeats it, and JSON quotes escape the control characters of an authored
  name, as the `prop` messages do.
- B-h. Made on 2026-11-25 by the same orchestrator. The `describe` result
  carries the malformed values in an optional `ignoredParameters` list on
  each definition and variant, as `excludedProps` carries the keys of
  `props-not-data`. A value that the preview sets gives a warning on each
  story page that composes it. Reason: the core derives the final entry
  path, and each story page composes its own parameters.

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

- [x] Set the globals of the `mokly` parameter for each view before render,
      as design call 11 says.
      Branch: `calummoore/storybook-track-b-finish-ekj1`.
- [x] Test that a theme decorator that reads a `theme` global renders the
      dark theme in dark views when the parameter maps it.
      Branch: `calummoore/storybook-track-b-finish-ekj1`.
- [x] Update `docs/guides/authoring/storybook.md`.
      Branch: `calummoore/storybook-track-b-finish-ekj1`.

## Milestone 8: Story reading verification, review, and pull request

Depends on: 2, 3, 4, 5, 6, 7

- [x] Remove each status line whose page this track completes.
      Branch: `calummoore/storybook-track-b-finish-ekj1`.
- [x] Run the targeted tests and `cargo xtask check`.
      Branch: `calummoore/storybook-track-b-finish-ekj1`.
- [x] Check the rows of the test matrix in Milestone 38 that Milestones 3 to
      7 build, in new small projects, and save the result under
      `.context/storybook-support/`.
      Branch: `calummoore/storybook-track-b-finish-ekj1`.
- [x] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.
      Branch: `calummoore/storybook-track-b-finish-ekj1`.

Evidence: `.context/storybook-support/track-b-matrix.md` in the workspace of
`calummoore/storybook-track-b-finish-ekj1` holds the matrix check of
2026-11-25.

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
  setup. Changed on 2026-11-27 by answer B to
  [track D decision 6](#track-d-decision-6-workspace-package-sources-under-vite):
  the setup still selects each file, and the
  [workspace package source rule](../docs/protocol/mokly-comparison-packages.md#workspace-package-sources)
  then applies to a bundled build target that the setup or its config
  loader selects for a bare package specifier, as on the esbuild path. A
  build target that Vite's own package lookup cannot select, such as one
  missing from the working tree, still fails.
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
- D28. Made on 2026-11-25 by the orchestrator of
  `calummoore/storybook-track-d-finish-nkpi`. For the answer B to track D
  decision 4, a `moduleResolution.loaders` key `.css` or `.module.css` is not
  a replaced setting. Every other `loaders` key is a replaced setting. Reason:
  those two keys accept only `"empty"`, and design call D9 keeps the
  `"empty"` opt-outs under the adapter, so they still have an effect.
- D29. Made on 2026-11-25 by the same orchestrator. A replaced field counts
  as set when the configuration holds it, also when its list or map is
  empty. `loaders` is the exception: D28 judges it key by key. Reason: the
  warning reports the field that the author wrote, not what a compiler does
  with its value. The warnings contract reports each ignored input so that
  the author can decide. An empty field that the author wrote is such an
  input, and one rule then covers every field.
- D30. Made on 2026-11-25 by the same orchestrator. For the answer C to track
  D decision 3, an env file is tracked when the working tree's Git index
  holds it. A candidate that the base commit holds comes from the base
  commit. A candidate that the base commit lacks and the index holds stays
  absent on the base side. Every other candidate comes from the working tree,
  also through a symbolic link, as Vite reads it on the head side. Reason: a
  branch addition or removal of a tracked env file then still shows, and a
  local file gives no false change.
- D31. Made on 2026-11-25 by the same orchestrator. A working-tree env file
  that only the base side reads adds no watch input. An edit to it shows in
  Changes after the next classification. Reason: the head side normally reads
  the same file and watches it, and a separate watch registration for the
  base side adds a watcher for a rare case.
- D32. Made on 2026-11-25 by the same orchestrator. For the answer D to track
  D decision 2, a PostCSS config candidate outside the source root and the
  selected dependency roots is not an input, and Vite does not load it.
  Reason: the confinement rules of the adapter already deny such files.
- D33. Made on 2026-11-25 by the same orchestrator. Under the adapter, the
  files that a `rebuild` rule matches are setup inputs, except the files that
  Mokly already classifies as sources, modules, or stylesheet inputs. Reason:
  the watch rule that package-owned classifications take precedence over
  rules then holds on both compile paths.
- D34. Made on 2026-11-27 by the orchestrator of
  `calummoore/storybook-d6-b-vite-workspace-sources-isfc`, for answer B to
  track D decision 6. The Vite rows of `tests/fixtures/workspace-sources.json`
  are a new top-level `compilePaths` section. A test compiles each row with
  the esbuild path and with the Vite adapter, on the head and the base side.
  Reason: the `cases` rows test the source step alone, which the Rust CSS
  resolver also reads, and only a compile shows that both paths reach it.
- D35. Made on 2026-11-27 by the same orchestrator. Each Vite call of the
  source step passes the specifier after the setup's aliases. An alias of
  the setup that gives a path keeps its target, as a relative import does.
  Reason: `ViteLookup` applies the setup's aliases before the setup's hooks
  select a file, and the probe of decision 6 shows a setup alias as a route
  that the author chooses. Mokly's first ordered hook resolves every import,
  after finding 3 of this branch's review, so a setup hook with
  `order: "pre"` cannot skip the source step.
- D36. Made on 2026-11-27 by the same orchestrator. A file that Node loads
  under the adapter keeps the Node rule of the
  [workspace package source rule](../docs/protocol/mokly-comparison-packages.md#workspace-package-sources):
  the run-time loader of the Vite config and the React peers keep an
  existing build file and use the source only when the side lacks it. Reason: the esbuild path uses
  the same rule for requires that Node loads, and Node 22.15.0 cannot load a
  TypeScript source. Mokly never externalizes a repository file, so a
  workspace package that the setup's external list names compiles through
  the setup and gets its source as any other import does.
- D37. Made on 2026-11-27 by the same orchestrator. When a Vite call of the
  source step fails for a bare import, the `sourcePackages` hint takes its
  package from the mapped build target, because the Vite calls pass no
  declared package target. The esbuild messages keep the hint rule of #596.
  Reason: the Vite failure then tells the author how to fix it, and the
  esbuild path does not change.

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

#### Track D decision 6: Workspace package sources under Vite

Raised on 2026-11-25 by the second merge of `main`, which brought pull
request #501. Track D owns it. The options check of 2026-11-25 rebuilt the
probe, rewrote the root question, and added options D, E, and F.

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation, from the audit of the second `origin/main`
  merge.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-comparison-packages.md`, section
  "Workspace Package Sources", `docs/protocol/mokly-sidecar-modules.md`,
  section "Source And Dependency Files", and
  `docs/protocol/mokly-vite-adapter.md`, section "Replaced Settings".
- **Terms:**
  - **Workspace package:** a named package whose source lives in the same
    repository as the catalogue.
  - **Workspace source recovery:** the rule of #501 that loads the matching
    source file, such as `src/value.ts`, when a package export points to a
    build file, such as `dist/value.js`.
- **Background:**
  - #501 added workspace source recovery. The comparison packages page, the
    sidecar modules page, and the configuration guide state it for every
    compile path.
  - Under the Vite adapter, the project's Vite setup alone resolves imports,
    as design call D9 says. The Vite code does not apply the recovery.
  - A probe used a package that exports `dist/value.js`. Both sides had
    `src/value.ts`, and only the working tree had `dist/value.js`. Esbuild
    used `src/value.ts` on both sides.
  - Vite used `dist/value.js` on the head side. On the base side, a catalogue
    import, an import in `vite.config.mjs`, a JavaScript import of a package
    CSS file, and a stylesheet `@import` of it all failed with
    `module packages/local/dist/value.js has no source in this side`.
  - Without `dist` in the working tree, Vite failed on both sides with
    `Failed to resolve entry for package`, before any Mokly step.
  - A `development` export condition, or an alias in the Vite setup, made
    both sides compile `src/*` in every case of the probe.
- **Problem:** The pages state workspace source recovery for every compile
  path, but the adapter does not apply it. A Vite comparison can lose its
  base render, and the two sides can compile different files for one
  import.
- **Impact if no action:** A Vite comparison of a repository whose workspace
  packages export Git-ignored build files has no base render, and its
  failure does not say how to fix it.
- **Root question:** Under the Vite adapter, how does each side compile the
  same kind of file for a workspace package whose build file is not in Git?
- **Options:**
  - **A.** Keep Vite resolution. Document that #501's recovery covers the
    esbuild path, default CSS, and Mokly's PostCSS step only. Projects can
    expose source exports, or add aliases to the Vite setup. Effort: Small.
  - **B.** Recover after target selection. Use the matching source when Vite
    or its setup loader selects a physical workspace build target. This
    covers the probe case, but not a working tree without the build. It
    changes design call D9. Effort: Medium.
  - **C.** Add full recovery. Also recover when lookup selects no physical
    target. Honor Vite's export conditions and extension order, and track
    the source candidates as inputs. It copies Vite's export rules, against
    decision 16. Effort: Large.
  - **D.** Do A, and make the failure say what to do. When a side lacks a
    mapped workspace build file that has a source, the `bundle-failed`
    detail and the stylesheet failure name the package and the two routes:
    an export condition such as `development`, or an alias in the Vite
    setup. `module-paths.ts` has 298 lines, so it likely needs a split
    first. Effort: Medium.
  - **E.** Use the matching source only when the side lacks the build file
    that the setup selected, as #501 does for requires that Node loads. The
    head keeps its build file, and the base renders. The two sides then
    compile different kinds of files, so a stale head build shows as a
    change. It changes design call D9 on the base side. Effort: Medium.
  - **F.** Do A, and give the base its own build output through the base
    prepare command, which the plan on branch
    `calummoore/mokly-base-prepare-command-7jlm` proposes. It works for any
    package layout and for generated output. That plan has nine open
    decisions. Effort: Large.
- **Left out:**
  - Read the head's build file on the base side when the base lacks it: it
    fails the goal, because Changes then hides each branch change to the
    package.
  - Setup aliases that Mokly makes from the package exports: the same walk
    of the exports as C, in another place.
  - An export condition that Mokly adds to the setup: it changes every
    package that declares the condition, against design call D9.
- **Wider fix:** F. C must know the build-to-source layout and copy Vite's
  export rules, so it is a direct fix.
- **Previous examples:** #501 added workspace source recovery to the default
  compiler.
  [workspace-bundle-export-conditions.md](follow-ups/workspace-bundle-export-conditions.md)
  records limits in that recovery.
- **Recommendation:** D. The first recommendation was A. The probe shows that
  both routes work on both sides, also where B fails, and D tells the user
  about them in the failure itself.
- **Action:** ask the user, because A and D narrow a rule that three pages
  state, and B, C, and E change design call D9. No user decision covers
  either change.
- **Answer:** B, chosen by the user on 2026-11-27. Reason: the Vite path and
  the esbuild path stay as similar as possible. The Vite calls of the source
  step pass the import name, as the esbuild call does, so both sides load the
  matching source. This changes design call D9. A working tree with no build
  still fails under Vite, because the user did not choose C. The base build
  stays in the base prepare command plan.
- **Order:** chosen by the user on 2026-11-27. The
  `moduleResolution.sourcePackages` change on branch
  `calummoore/mokly-source-package-override-jkum` rewrites the same source
  step, so it merges into `main` first. A branch from this branch then merges
  `main` and applies B on top of it. That branch adds Vite rows for
  `sourcePackages` to `tests/fixtures/workspace-sources.json`, so that one
  source rule covers both compile paths. Reason: one source step, tested once
  for both paths, with no second pass over the same code.

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
- [x] Apply the answer to track D decision 4 to the configuration check and
      to `docs/protocol/mokly-vite-adapter.md`. Branch:
      `calummoore/storybook-track-d-finish-nkpi`.
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
- [x] Apply the answers to track D decisions 2 and 3. Branch:
      `calummoore/storybook-track-d-finish-nkpi`.
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
- [x] Run the targeted tests and `cargo xtask check`. Branch:
      `calummoore/storybook-track-d-finish-nkpi`.
- [x] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.
      Branch: `calummoore/storybook-track-d-finish-nkpi`. The open findings
      of the review are follow-up items under `plans/follow-ups/`.
- [x] Apply answer B to track D decision 6: the Vite calls of the workspace
      source step pass the import name, as the esbuild call does. Add the
      Vite rows for `sourcePackages` to
      `tests/fixtures/workspace-sources.json`, test the head and the base
      probe, update design call D9 and the pages that the decision names,
      run the targeted tests on Node 22.15.0 and 24.21.0 and the complete
      gate, review against this branch, and open a pull request into this
      branch. Branch: `calummoore/storybook-d6-b-vite-workspace-sources-isfc`.

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

- [x] Add the render failure rules to a new page,
      `docs/protocol/mokly-storybook-failures.md`, which
      `docs/protocol/mokly-storybook.md` links, as track F design call F7
      says.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] State there the reason rule of design call 26, the usage rule of
      design call 27, and the answer to decision 26.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] State the sentence rule of design call 29 in
      `docs/protocol/mokly-component-controls-design.md`: after a failed or
      invalid edit, the Props tab names the preview that it shows.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Update `docs/protocol/mokly-build-warnings.md` with
      `story-render-failed`. In `docs/protocol/mokly-sidecar.md`, update the
      `render-failed` row and the rule that there is no fallback render, for
      stories.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Update `docs/protocol/mokly-component-design.md` with the failed story
      state of Milestone 1.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.

## Milestone 24: Story render failures

Depends on: 23

A story that cannot render no longer stops the build, as decision 5 says.

- [x] Turn a story render failure into the warning of design call 9. Keep
      `--strict` failing on it.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Write the error document of Milestone 1 in place of each failed view,
      so that the catalogue shows the story and the reason.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Test that a portal story gives the warning and the error document, that
      the other stories render, and that `--strict` fails.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Test that a reason with a path in the repository gives the same error
      document on both sides, and that a failed story keeps every Used by
      and Affected list, as design calls 26 and 27 say.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Update `docs/guides/authoring/storybook.md`.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.

## Milestone 24a: The Props sentence after a failed edit

Tags: ui

Depends on: 1, 23

The Props tab says truthfully what the preview shows after a failed or
invalid edit, as design call 29 says.

- [x] Choose the sentence of the failure alert and of the invalid notice
      from the preview that the frame shows. Until an edit renders, use "The
      preview shows the saved props."
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Add both saved-preview sentences of `SAVED_PREVIEW_COPY` in
      `examples/basic/specs/design/components/controls/parts/copy.ts` to
      `CONTROLS_COPY` there and in
      `packages/viewer/src/shell/component_controls_copy.ts`, and remove
      `SAVED_PREVIEW_COPY`. Keep the viewer's copy equal to the copy of the
      controls mockups, which `tests/viewer_controls_copy.test.ts` compares.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Test both sentences under `packages/viewer/tests`, for a preview that
      shows the saved props and for one that shows an edit.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.

## Milestone 25: Failed stories verification, review, and pull request

Depends on: 23, 24, 24a

- [x] Remove each status line whose page this track completes.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Run the targeted tests and `cargo xtask check`.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.
- [x] Commit, push, review against this branch, give the findings to the
      user, apply the fix rule, and open a pull request into this branch.
      Branch: `calummoore/storybook-track-f-failed-stories-omid`.

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
      Branch: `calummoore/storybook-track-i-story-component-usage-mpng`.
- [x] Add the warning for numbered uses to
      `docs/protocol/mokly-build-warnings.md`, and the naming props field to
      `docs/protocol/mokly-configuration.md`.
      Branch: `calummoore/storybook-track-i-story-component-usage-mpng`.
- [x] Add the status lines, and run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.
      Branch: `calummoore/storybook-track-i-story-component-usage-mpng`.

Design calls of track I. These calls are the track I orchestrator's, made on
2026-11-25. They stay in this milestone so that the track changes only its
own lines of this plan.

- I1. A story component is the `component` of the meta of a stories entry,
  in CSF 2, CSF 3, and CSF Factories. A JSX element records a use when its
  type is that component, or when one side is a `memo` or `forwardRef` object
  whose inner component is the other side. When several stories entries name
  one component, the use records the entry whose path sorts first. A
  `defineComponent` wrapper keeps its own rule, also when a meta names it.
  Reason: both sides of a comparison choose the same entry, and a wrapper
  already records its own instance.
- I2. Only JSX that Mokly compiles records a use: the JSX development shim
  sees each `jsxDEV` call of the modules that Mokly compiles, with esbuild and
  under the Vite adapter. `createElement` calls and the compiled JSX of
  installed packages record none. esbuild and Babel compile an element whose
  `key` follows a spread, such as `<Card {...item} key={item.id} />`, to
  `createElement`, so such a use records none. The guide asks authors to put
  `key` before the spread. Reason: the shim is the one place that sees JSX on
  both compile paths. A Mokly facade for `react` that also sees
  `createElement` is a larger change, and
  [story-uses-after-spread-keys.md](follow-ups/story-uses-after-spread-keys.md)
  records it.
- I3. On the pages of a stories entry, a use of its own component records no
  instance. Uses of other story components there record instances as in a
  screen. Reason: such a page compares the component itself, and an instance
  region would hide the component's own render edits from Changes.
- I4. The id of a story component use comes from `key`, then from the first
  naming prop with a value: the final segment of the entry's resolved path, a
  hyphen, and the value in lowercase kebab-case, such as `button-save`. A
  string or a finite number gives a value. Letters lose their accents first,
  so `Café` gives `cafe`. Then each run of characters other than `a` to `z`
  and `0` to `9` becomes one hyphen, and the ends lose their hyphens. An
  empty result goes on to the next prop. Without a value, the id is the
  segment alone. Changed on 2026-11-26 by the answer E to track I decision
  1: a story component use takes no `moklyInstance`. A wrapper takes its id
  from `moklyInstance`, then from `key` with the same form, then from the
  segment alone. An HTML component element takes `mokly-instance`, then the
  segment. Reason: the segment keeps uses of two
  components with one key apart, every value becomes a valid id, and
  translated labels keep their letters.
- I5. An id that its input scope already holds gets the first free number
  from 2, such as `button-2`. Changed on 2026-11-26 by the answer E to track
  I decision 1: this holds for story component uses, wrappers, and HTML
  component elements alike. The first use keeps the id without a number.
  Each numbered use raises the warning of I6. A later named use whose id
  equals an earlier number also gets a number. Reason: keys repeat across two
  lists of one screen, and a warning keeps the build going where an error
  would stop it.
- I6. The warning has the code `instance-numbered` and the subject of the
  rendered entry, so that the views of one entry give one warning for each
  use. Its message names the id, the component path, the invocation site
  when the record has one, and asks for a `key` that is unique in the input
  scope. Changed on 2026-11-26 by the answer E to track I decision 1: on a
  wrapper it asks for `moklyInstance`, and on an HTML component element for
  `mokly-instance`. `--strict` counts it. An unnamed repeat inside a product component
  gives one warning in each entry that renders that component. Reason:
  decision 19 lets strict CI fail on a repeated use without a name, and the
  `props-unsafe-integer` invocation warning already uses the rendered entry.
- I7. The top-level configuration field `instanceNameProps` lists the
  naming props, by default `id`, `name`, `data-testid`, and `aria-label`. An
  empty list leaves `key` and the numbers. `key` always comes first, and a
  `key` item in the list changes nothing. Reason: the naming props are
  product-wide, the warning always asks for `key`, and a harmless item needs
  no new configuration error.
- I8. The props digest of a use holds each prop whose value is data under
  the entry props contract. Function props stay out of it, as decision 21
  says. Changed on 2026-11-26 by the answer E to track I decision 2: every
  other value records without a failure, in the forms that the answer
  gives.
  Track I decision 3 settles how the content of a use stays in Changes. The
  stories entry's prop schema does not validate a use. Reason: the schema
  describes the stories' args, not every prop of the component, and a product
  use cannot change its props for Mokly.
- I9. One field of the public component record marks a stories entry. It
  makes usage validation accept a slot of a use that the entry does not
  declare, when track I decision 3 keeps slots, and it turns off the prop
  schema check of I8 in both validators. Every other component keeps both
  checks. Track G adds story fields to the same record in Milestone 27, so
  the merge of the two tracks keeps one sign of a stories entry. Reason: a
  forged record keeps failing validation, and one field carries both rules.
- I11. Made on 2026-11-26 for the answer E to track I decision 2. A `Map`
  or a `Set` puts its entries into its canonical form. An object with a
  reserved key, such as `__proto__`, a value that contains itself, a value
  past the plain data limits of 64 levels or 10,000 nodes, and an invalid
  `Date` record as a digest text. The core reads prop data at those limits,
  so its JSON readers allow the extra nesting of tagged values. Reason: two
  different Maps must not give one digest, and the core rejects those values
  when it reads a record, so a use would otherwise still fail.
- I12. Made on 2026-11-26 for the answer E to track I decision 1. The shim
  passes a wrapper's `key` through the reserved prop `__moklyKey`, which the
  wrapper strips as it strips `__moklySource`. Reason: React never passes
  `key` to a component.
- I13. Made on 2026-11-28 for the outcome J of track I decision 3. The
  transform instruments the components of each repository-owned module that
  Mokly compiles, on both compile paths, workspace package sources included.
  It does not change installed packages, also when esbuild bundles them.
  Reason: both compile paths then mark the same components, and installed
  code runs as the package ships it.
- I14. Made on 2026-11-28. A story component that Mokly does not compile
  keeps a Mokly element of its own type around each use, as today. Reason:
  only an instrumented body can write the markers of its own output.
- I15. Made on 2026-11-28. Each element that a screen supplies to a story
  component use, in `children` or in another prop, is its own implicit slot,
  named by its prop and its key, or else its position. A supplied element of
  a compiled component keeps its type and carries its slot in the hidden
  prop. A supplied HTML element or element of an installed component gets a
  Mokly mirror. Text joins the use's props digest in its order. Reason: the
  answer J keeps E's rules for content that the transform cannot mark.
- I16. Made on 2026-11-28. The switch of option I is the boolean
  `contentSlots` of the `mokly` parameter, read from the meta over the
  preview. It is `true` by default. With `false`, the uses of that component
  get no implicit slots and no mirrors. Each use keeps its instance region
  with its markers, and the comparison compares that region's whole output
  in the screen's view. A story's own value does not apply to uses. Reason:
  every instance keeps a region, as the instances page requires, and a use
  names its component, not one story.
- I10. Track I decision 3 settles how a use renders its content. Changed on
  2026-11-28: its answer is a spike of J, with I as the fallback. The spike
  and its check live under `.context/storybook-support/track-i/spike-j/` in
  the track I workspace. Their result is in decision 3. The build of J or I
  waits for the option that the user names after that result, and for track
  I decisions 10 and 11.

The options check of 2026-11-25 for these calls and for track I decision 1
added options D and E to decision 1, changed I2, I4, I5, I6, I7, and I9, and
raised track I decisions 2 and 3. Its second run added options D and E to
decision 2 and options E to H to decision 3. The reports are under
`.context/storybook-support/track-i/` in the track I workspace.

#### Track I decision 1: Numbered ids for `defineComponent` wrappers

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design, with options D and E from the options check.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-instances.md:83-86`,
  `packages/mokly/src/authoring/components.ts:41`,
  `crates/mokly-html/src/components.rs:130-135`.
- **Background:**
  - Today two `defineComponent` wrappers with one id in one input scope fail
    the render with "duplicate instance". The id is `moklyInstance`, or else
    the final segment of the component's path. HTML component elements fail
    the same way with "duplicate component instance id".
  - Decision 19 chose L for story component uses: `key`, naming props, and
    numbers as the fallback, with a warning. L says that the warning names "a
    `key` on a product component, or `moklyInstance` on a Mokly wrapper".
  - Decision 19 and its problem statement name only story component uses.
  - The instance key holds no component path. So a wrapper and a story
    component use with one id in one scope collide too.
  - React never passes `key` to a component, but the JSX shim receives it.
  - `examples/basic/specs/design/library/composition.tsx` adds a prefix to
    `moklyInstance` names, so that repeated frames avoid the duplicate error.
- **Problem:** A wrapper use gets a number only when wrappers also take the
  fallback, and that removes a build error that `origin/main` has.
- **Impact if no action:** The `moklyInstance` hint of the warning never
  shows, two repeated wrappers keep failing the build, and a wrapper next to a
  story component use with one id fails or warns by render order.
- **Root question:** When a wrapper or an HTML component element repeats an
  id in one input scope, who gives the use a distinct id: the author before
  the build goes on, or Mokly with a number and the warning?
- **Options:**
  - **A.** Only story component uses get numbers. A repeated wrapper id still
    fails the build. The warning always asks for `key`. Effort: Small.
  - **B.** Wrappers also get numbers. A repeated wrapper id gets the first
    free number and the warning, which asks for `moklyInstance`. Effort:
    Small.
  - **C.** Do A. A story component use in a catalogue file also takes
    `moklyInstance`, which the shim removes, and the warning asks for it
    there. TypeScript rejects the prop on a product component's props.
    Effort: Medium.
  - **D.** Do B. A wrapper also takes its name from `key`, after
    `moklyInstance` and before the numbers, such as `card-intro`. The shim
    passes the key to the wrapper, which removes it. A current wrapper use
    with a `key` and no `moklyInstance` gets a new id. Effort: Small.
  - **E.** Do D. HTML component elements get the same fallback, and the
    warning asks for `mokly-instance`. It changes the core HTML renderer and
    its replay check, for a small gain, because an HTML body cannot loop.
    Effort: Medium.
- **Left out:** Naming props for wrappers: an edit of a wrapper's data props
  must keep its id, and decision 19 changed that rule only for story
  component uses.
- **Wider fix:** E. One fallback rule covers every instance.
- **Previous examples:** The `DesignInstances` helper in
  `examples/basic/specs/design/library/composition.tsx`.
- **Related:** Decision 19, whose text names the `moklyInstance` hint.
  Design call I4 waits for this answer on `moklyInstance`.
- **Recommendation:** D, changed from B by the options check. It keeps one
  fallback for both kinds of React use, and the `key` that a list of wrappers
  already has names each wrapper without a warning.
- **Action:** ask the user, because B, D, and E remove the duplicate-id
  build error of wrappers on `origin/main`, and decision 19 names only story
  component uses.
- **Answer:** E, chosen by the user on 2026-11-26. Wrappers and HTML
  component elements also get the numbered fallback with the
  `instance-numbered` warning, and a wrapper also takes its name from `key`,
  after `moklyInstance`. The user approved the removal of the duplicate-id
  build error of wrappers and HTML component elements on `origin/main`.

#### Track I decision 2: Values that are neither data nor functions

- **Severity:** High. **Effort:** Medium.
- **Source:** Design, from the options check, with options D and E from its
  second run.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-component-changes.md:127-132`,
  `packages/mokly/src/authoring/data.ts`.
- **Background:**
  - Changes compares a use in a screen by its id, its component path, and its
    props digest, not by its rendered content.
  - Decision 21 keeps function props out of that digest.
  - Mokly's copy of data props rejects `undefined`, `NaN`, a `Date`, a cycle,
    data past 10,000 nodes or a depth of 64, and an array of objects that
    hold a function, such as `items={[{ label: "Save", onClick }]}`. A check
    on 2026-11-25 confirmed each case.
  - Product props hold these values often, and a product use cannot change
    its props for Mokly.
  - The Changes contract says that missing input evidence never means
    unchanged inputs.
  - The core computes the props digest again from the recorded props, so a
    recorded value must be data.
- **Problem:** No rule says what such a value gives to the record. Without
  one, the render of a screen that works today fails when Mokly records its
  use, or an edit of the value drops out of Changes.
- **Impact if no action:** Milestone 35 has no rule, and screens that render
  today fail.
- **Root question:** How does a use record a prop value that is not data, so
  that no render fails and an edit of the value stays in Changes?
- **Options:**
  - **A.** Leave each such value out of the record, as functions. An edit of
    a `Date` or of `label` inside `items` drops out of Changes. Effort:
    Small.
  - **B.** Keep the data parts. A function or an element inside an object or
    an array becomes a fixed placeholder, and a `Date` becomes its ISO text.
    An edit of `label` inside `items` stays in Changes. An edit of an icon
    element inside `items` does not. Effort: Medium.
  - **C.** Record no projected region for a use with such a value. The use
    stays in the usage lists, and its rendered output stays in the screen's
    own comparison. Effort: Medium.
  - **D.** Do B. An element anywhere inside a value follows track I decision
    3, as a top-level element prop does. Effort: Medium.
  - **E.** Do D, and record every other value without a failure. `undefined`
    is a missing key in an object and `null` in an array. `NaN`, the
    infinities, and `BigInt` give tagged text. A `Date` gives its ISO text. A
    `Map`, a `Set`, another class instance, a cycle, or data past the bounds
    gives a text that holds the digest of its canonical form: the constructor
    name and the own enumerable fields. A value that changes on each run,
    such as `new Date()`, then shows a change in each comparison. Effort:
    Medium.
- **Left out:**
  - Fail the build on such a value: a product use cannot change its props for
    Mokly, and it adds a new error.
  - A warning for each such value: `--strict` would fail on ordinary props
    such as `items` with an `onClick`.
  - A digest of the source text of each prop expression: it misses values
    from a variable or an import.
- **Wider fix:** C. Only a comparison of the output also shows edits of
  functions.
- **Previous examples:** Design call 4 and decision 7 for story args.
- **Related:** Track I decision 3. Option D here uses its answer. Option C
  here matches its option D.
- **Recommendation:** E, changed from B by the second options check. No prop
  value can then fail the render, and only function edits, which decision 21
  accepts, drop out of Changes.
- **Action:** ask the user, because decision 21 names only function props,
  and A, B, D, and E weaken the rule that missing input evidence never means
  unchanged inputs.
- **Answer:** E, chosen by the user on 2026-11-26. Every prop value records
  without a failure. An element inside a value follows the answer to track I
  decision 3.

#### Track I decision 3: The content of a use and faithful rendering

- **Severity:** High. **Effort:** Medium.
- **Source:** Design, from the options check, with options E to H from its
  second run.
- **Category:** Docs or spec.
- **Location:** `packages/mokly/src/authoring/components.ts:178-205`,
  `docs/protocol/mokly-component-changes.md:99-122`,
  `crates/mokly-compare/src/material_nodes.rs:70-94`.
- **Background:**
  - Decision 21 chose A: `children` and each prop that holds React content
    become implicit slots of the use.
  - A slot keeps its supplier's ownership through `mokly-slot` markers around
    the content. Inside a paired instance region, the comparison keeps only
    the slot regions.
  - `defineComponent` wrappers place these markers with one Mokly slot
    element in place of the whole content.
  - Product components often read their children. On 2026-11-25 a test with
    React 19.2.3 showed that one slot element for the whole content breaks
    Radix `asChild`, merges `Children.toArray` items, and breaks a
    `typeof children === "string"` check. A Mokly "mirror" element for each
    supplied element, with the same key and props, rendered all three as
    without Mokly.
  - To place the instance markers, the shim gives each recorded use a Mokly
    type. Under every option, a parent that keeps only children of one type,
    such as a `Tabs` that keeps only `Tab`, and a `child.type === X` check on
    the content render differently. A `useId` value inside the content also
    changes.
  - Decision 13 records uses with no change to screens.
- **Problem:** The content of a use needs markers to stay in Changes, and the
  markers change what a product component receives.
- **Impact if no action:** Milestone 35 cannot keep both decision 21 and
  faithful rendering. Screens with such components break or render wrong.
- **Root question:** How does Changes keep every edit of the content that a
  screen passes into a story component, with the screen as its owner, while
  the use renders as in the product?
- **Options:**
  - **A.** Wrap the whole content in one slot element, as `defineComponent`
    wrappers do, and state the limit. Effort: Medium.
  - **B.** Keep text `children` in the digest as data, and wrap only element
    content in one slot element. Radix `asChild` and `Children.only` still
    break. Effort: Medium.
  - **C.** Add no slot markers. A canonical form of the content joins the
    digest of the use. Every edit inside a component element of the content,
    such as a screen's own form inside a modal, drops out of Changes, and the
    screen's own CSS on the content goes to the story component. Effort:
    Medium.
  - **D.** Record no projected region for a use with React content. The use
    stays in the usage lists, and its whole output stays in the screen's
    comparison. This is option C of decision 21, which the user rejected.
    Effort: Small.
  - **E.** Replace each element that the screen supplies with a Mokly mirror
    element with the same key and props. The mirror renders the original
    type inside its own slot markers, and reads of static fields on its type
    reach the original type. Text stays as it is and joins the digest in
    order. Each element is its own slot, named by its prop and its key or
    position. An insertion without a key renames the slots after it.
    `child.type` checks still differ. Effort: Medium.
  - **F.** Do E, and render each view again with the original content.
    Compare the two outputs without the markers. A use whose output differs
    then follows D. It adds render time and false differences from counters
    at module level. Effort: Large.
  - **G.** Do E, and add a field to the `mokly` parameter of a stories meta
    that turns off use recording for its component. Its uses then render
    unchanged and stay in the screen's own comparison. The author must see
    the wrong render first. Effort: Medium.
  - **H.** Render through React's reconciler in place of `react-dom/server`.
    The sidecar finds the use and its content in React's own tree and writes
    every marker itself, so no Mokly element enters the product's tree. Mokly
    then writes the HTML itself, and layout effects, `useId`, and Suspense act
    as on the client. Effort: Large.
  - **I.** Do E, with a switch in the `mokly` parameter of a stories meta that
    keeps the use. For a component with the switch, Mokly records each use
    when the screen's JSX creates it, so the component's page still lists the
    screens that use it. The element keeps its own type, and its content gets
    no mirrors. Its whole output stays in the screen's comparison, as D does
    for that one component. Only the folding of its own changes is lost: an
    edit inside its own code shows as a change of each screen, not once on
    its page. Added by the primary orchestrator's re-check of 2026-11-28.
    Effort: Medium.
  - **J.** Mark each component in the module that defines it, not at each
    use. When Mokly compiles a module that defines a component, a transform
    replaces the component's binding with one Mokly wrapper, so that every
    importer, the defining module included, sees the same value, and
    `child.type === Tab` holds. The JSX shim adds the use's data, such as its
    key and its source, under a hidden prop with a JavaScript Symbol key,
    which survives `cloneElement` and never reaches the HTML. When the
    wrapper renders, it writes the instance markers of a story component use
    and the slot markers of content that the screen supplied. HTML elements
    that the screen supplies, such as `<a>`, keep the mirrors of E, and the
    switch of I stays for a check of an HTML element type. Components that
    Node loads from installed packages get no wrapper, so their elements keep
    mirrors. Mokly must change the code of every component module on both
    compile paths, and handle `memo`, `forwardRef`, and class components. It
    is not tested. Added by the primary orchestrator's re-check of
    2026-11-28. Effort: Large.
- **Left out:**
  - Clone each child with a hidden prop: component children and text get no
    marker, so it fails the goal. E is the working form of the idea.
  - Place markers by matching a separate render of the content: it fails on
    components that clone, repeat, or move their content.
  - Slots declared in each meta: E covers the same content with no edit, and
    G keeps an opt-out.
- **Wider fix:** H. No product component then sees a Mokly element.
- **Previous examples:** Emotion's `css` prop swaps element types the same
  way as E.
- **Related:** Decision 21, whose slots A, B, E, F, and G keep and C drops. Track I
  decision 2, whose option D uses this answer. Content that a function prop
  returns, such as `renderItem`, renders inside the use under every option,
  and decision 21 keeps its edits out of Changes.
- **Recommendation:** G, changed from C by the second options check. E
  renders the patterns that break under A and B as in the product and keeps
  the slots of decision 21, and the switch covers `child.type` checks. H
  protects the codebase best, at Large effort.
- **Action:** ask the user, because G adds a field to the `mokly` parameter
  that no requirement covers, A and B break the faithful rendering that
  decision 13 assumes, and no option is clearly best.
- **Answer:** H, chosen by the user on 2026-11-26: the wider fix, at Large
  effort, over the recommended G. Under H, the Radix `asChild`,
  `Children.toArray`, `typeof children === "string"`, and `child.type` cases
  render as in the product, and each one gets a test. Before the build, a
  design note and its options check confirm that H breaks no requirement in
  force and needs no further decision.
- **Answer changed:** spike of J first, chosen by the user on 2026-11-28,
  with I as the fallback. When the spike and its independent check show that
  J works for the tested cases, J applies. Otherwise I applies. Decisions 4
  to 9 close. Reason given: under G, the switch turns off recording, so a
  component such as `Tabs`, whose content is checked with
  `child.type === Tab`, loses its usage list and the folding of its own
  changes. I keeps the usage list, and J also keeps the folding. The design
  note of H and its decisions 4 to 9 found that H breaks the private-runtime
  rule and the failed-views rule.
- **Spike result, 2026-11-28:** the spike of J ran in the track I workspace
  with its independent check. Both used React and react-dom 19.2.3, esbuild
  0.28.2, and Vite 8.3.8 on Node 24.21.0 and 22.15.0. The evidence is under
  `.context/storybook-support/track-i/spike-j/` in that workspace: the spike
  in `REPORT.md` and `out/`, and the check in `check/out/`.
  - J as the spike built it replaces each component binding with a wrapper
    after the definition. It fails these cases:
    - a cyclic importer keeps the original function;
    - a class body or a named function that names itself sees another
      value;
    - a subclass of a wrapped class fails to construct, and a prototype
      read gives `undefined`;
    - invocation lines move by three or more;
    - every compiled component renders through an extra layer, so its own
      `useId` changes.
  - The check's variant `b` keeps J's choice. It marks each component where
    it is defined, and it uses the Symbol carrier, E's mirrors for supplied
    HTML elements, and I's switch. It runs the original body of each
    function, arrow, inner function of `memo` and `forwardRef`, and class
    `render` method inside a helper, and keeps the binding. Call results and
    tagged templates keep a binding wrapper. `b` passed every identity case
    on both compilers and both Node versions, with the cyclic case included.
    It adds no layer, and it keeps 5 of 6 `useId` values where E and J keep 1.
  - Under the user's rule, J works for every tested case, within the limits
    that its text accepts, only in the form of `b`. J in the form of the
    spike does not. The primary orchestrator relays this result to the user,
    and the build waits for the option that the user then names.
  - The verdicts:

    | Question                | Spike   | Check                                                          |
    | ----------------------- | ------- | -------------------------------------------------------------- |
    | 1. Identity             | Partly  | Partly for the spike's J, proven for `b`                       |
    | 2. Detection            | Partly  | Partly: destructured exports get no mark                       |
    | 3. Hidden data          | Refuted | Partly: the Symbol survives clones, maps, and spreads          |
    | 4. Markers              | Partly  | Partly: the core rejects implicit slots until I9 lands         |
    | 5. Patterns             | Partly  | Partly: 12 of 14 for J, 9 of 14 for E, content can bypass slot |
    | 6. Rules in force       | Partly  | Partly: dropped Suspense branches fail today's code too        |
    | 7. Both sides and Serve | Partly  | Partly: both sides use the same transform, not rerun           |
    | 8. Installed packages   | Proven  | Proven, not rerun                                              |
    | 9. Cost                 | Proven  | Proven for the spike's J, `b` not measured                     |

  - The cost of the spike's J against E, in milliseconds, as medians. The
    1-minute load average was between 2.79 and 3.79 on four CPUs. E has no
    transform step.

    | Node    | Corpus         | Compiler | J transform |      E / J bundle |    E / J render | J ÷ E render |
    | ------- | -------------- | -------- | ----------: | ----------------: | --------------: | -----------: |
    | 24.21.0 | Example        | esbuild  |       97.00 |   122.78 / 124.81 |   13.04 / 12.30 |        0.94× |
    | 24.21.0 | Example        | Vite     |       97.00 |   203.64 / 226.68 |   13.89 / 13.08 |        0.94× |
    | 24.21.0 | 500 components | esbuild  |       35.17 |   627.43 / 742.83 | 252.16 / 220.13 |        0.87× |
    | 24.21.0 | 500 components | Vite     |       35.17 | 1545.29 / 1655.03 | 199.69 / 245.48 |        1.23× |
    | 22.15.0 | Example        | esbuild  |      100.52 |    91.45 / 141.90 |   12.27 / 11.14 |        0.91× |
    | 22.15.0 | Example        | Vite     |      100.52 |   235.86 / 198.81 |   12.41 / 12.98 |        1.05× |
    | 22.15.0 | 500 components | esbuild  |       33.60 |   583.17 / 902.86 | 250.68 / 237.44 |        0.95× |
    | 22.15.0 | 500 components | Vite     |       33.60 | 1893.01 / 1849.85 | 266.06 / 248.69 |        0.93× |

  - The check's corrections to the spike report:
    - Question 3 is partly, not refuted. React copies props without Symbol
      keys only when the config holds `key` or the code calls
      `createElement`. A shim that moves a spread `key` into the key
      argument keeps the Symbol in 3 of 4 spread forms. The fourth, a `key`
      after a spread, compiles to `createElement`, and
      [story-uses-after-spread-keys.md](follow-ups/story-uses-after-spread-keys.md)
      covers it.
    - The spike's J warnings name wrong lines. `b` keeps the lines.
    - A styled-components tagged template gets no mark in the spike's J.
      `b` wraps it as a call result. A destructured export gets no mark in
      either, and I's switch is its remedy.
    - After `useId` values are normalized, J matches 12 of 14 plain outputs
      and E matches 9 of 14. The two that J misses are filters by HTML
      element type and by installed component type, which J's text leaves
      to E's mirrors and I's switch.
    - Today's branch code, `defineComponent` wrappers, and `MockLink
asChild` fail with "render dropped a Mokly marker" when Suspense drops
      a marked branch. With no story use recorded, the wrapper and
      `MockLink` cases still fail, so the defect is older than track I.
      Track I decision 11 holds it.
    - Under the Vite adapter with `NODE_ENV=production`, the development
      JSX shim does not run, and today's branch records no story use. This
      breaks design call I2, so the build fixes it without a decision.
  - Design calls of 2026-11-28 for the build of J in the form of `b`, if J
    applies:
    - Mokly keeps its work for each component instance in a ref, because
      React calls a function again after an update in the render phase.
    - The product body runs outside Mokly's error scope, so that a product
      throw stays the story's failure under the track F rules.
    - The transform adds no line. An invocation location that it cannot
      keep is left out, never guessed.
    - The shim gives use data only to story component elements, moves a
      spread `key` into the key argument, and carries the slot of an
      element that a component re-creates with its own type.
    - The transform reuses `@babel/parser`, which the repository already
      has.
    - Rules that a component body inserts through a style library take
      that component as their owner, as the render records page requires.
      The spike did not test it, so the build tests it.
    - The build measures the cost of `b` against E on both Node versions.
- **Outcome:** J, in the form of variant `b`, a call of the primary
  orchestrator on 2026-11-28 under the user's rule of the same day. Reason:
  `b` keeps J's choice, to mark each component where it is defined. It
  passes every tested identity case on both compilers and both Node
  versions, and it beats E and the spike's J on the other tested cases.
  Track I decisions 10 and 11 apply to E, I, and J alike, so they do not
  change the choice. The user can still ask for I.

The design note of 2026-11-26 for the answer H, with its spike and its
options check, found that H breaks requirements in force and needs the
decisions below. The note, the spike, and the check are under
`.context/storybook-support/track-i/` in the track I workspace. In each
decision, the option "do not move to the reconciler" drops H, and that
answer closes the other five.

Decisions 4 to 9 closed on 2026-11-28 without an answer of their own,
because the answer of decision 3 no longer takes H.

#### Track I decision 4: Where the reconciler comes from

- **Severity:** High. **Effort:** Medium.
- **Source:** Design, from the design note of the answer H.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-rendering.md:48-56`,
  `packages/mokly/src/sidecar/plugins.ts:152-162`.
- **Background:** `@mokly/mokly` declares `react` and `react-dom` `>=19.0.0`
  as peers and ships no private runtime. The sidecar loads both from the
  project's configuration directory, so one React instance renders. H needs
  `react-reconciler` too. Each reconciler release accepts its own React minor
  and every later one, and a reconciler older than the project's React fails
  on newer elements and hooks, such as `<ViewTransition>` on React 19.3.1.
- **Problem:** A reconciler that Mokly ships is a private runtime, and one
  release cannot render every React that `>=19.0.0` admits.
- **Impact if no action:** Projects on another React minor fail or render
  wrong, and each new React minor needs a Mokly release.
- **Root question:** How does Mokly get a renderer that matches each
  project's React version?
- **Options:**
  - **A.** Ship one pinned reconciler, narrow the React peers to its minor,
    and drop the private-runtime rule. Effort: Small.
  - **B.** Do not move to the reconciler, and choose another option of
    decision 3, such as G. Effort: Medium.
  - **C.** Resolve `react-reconciler` from the configuration directory, as
    `react` is, check the pair against a table of React minors, and fail with
    a message that names the version to install. It adds an install step and
    a build error. Effort: Medium.
  - **D.** Do C, but warn and render today's way without story component
    uses when the package is missing or does not match. Such a project has no
    usage evidence for story components. Effort: Medium.
  - **E.** Ship one reconciler for each React minor and choose one at run
    time. It ships private runtimes and needs a Mokly release for each minor.
    Effort: Large.
- **Left out:** `react-test-renderer`: it flushes only through `act`, which
  production React does not export, and React 19 deprecated it.
  `react-dom/client` with a fake DOM: decision 1 rejected a DOM emulator.
- **Wider fix:** C.
- **Previous examples:** Decision 22 fails `bundle` with a clear message when
  the project lacks `vite`.
- **Related:** Track I decision 9, whose option B limits the package to
  catalogues with stories files.
- **Recommendation:** D. It ships no private runtime, follows the project's
  React, and a project without the package still builds.
- **Action:** ask the user, because D adds a warning and an install step, and
  without the package it records no use, but decision 13 records every use.

#### Track I decision 5: Which store snapshot a render reads

- **Severity:** High. **Effort:** Medium.
- **Source:** Design, from the design note of the answer H.
- **Category:** Docs or spec.
- **Location:** `docs/guides/authoring/storybook.md:288`,
  `docs/protocol/mokly-storybook-failures.md:8-12`.
- **Background:** Today's render reads `getServerSnapshot` of
  `useSyncExternalStore`, and a store without it fails. The reconciler reads
  `getSnapshot`, as a browser does. Libraries use the server snapshot as a
  guard: Radix `useIsHydrated` returns `false` on a server.
- **Problem:** Under H, browser code behind such guards runs in Node. A
  `getSnapshot` that reads `window` fails with `window is not defined`, and
  so does browser code behind a `useIsHydrated` guard. Both render today.
- **Impact if no action:** Screens and stories that render today fail, and
  the guide's advice to write server-safe code is no longer enough.
- **Root question:** Under H, does a render show the state of a server render
  or of a browser?
- **Options:**
  - **A.** Read `getSnapshot`, and change the guide and the failures page.
    Guarded browser code fails in Node. Effort: Small.
  - **B.** Wrap `useSyncExternalStore` on the project's React so that a
    render reads `getServerSnapshot`, and fail with today's message without
    one. The wrapper must be in place before any module captures the export.
    Effort: Medium.
  - **C.** Do not move to the reconciler, and choose another option of
    decision 3, such as G. Effort: Medium.
- **Left out:** Fall back to the server snapshot when `getSnapshot` throws: a
  guard does not throw, and its browser code fails later. A switch for each
  entry: no requirement covers it, and B keeps today's output.
- **Wider fix:** B.
- **Previous examples:** None found.
- **Related:** Track I decision 6 decides what such a failure gives.
- **Recommendation:** B. Screens and stories that render today keep
  rendering, and the guide stays true.
- **Action:** ask the user, because A follows a browser and B keeps today's
  output, and the text of H named no rule for stores.

#### Track I decision 6: Which outcomes fail a render

- **Severity:** High. **Effort:** Medium.
- **Source:** Design, from the design note of the answer H.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-storybook-failures.md:8-12`,
  `docs/protocol/mokly-sidecar.md:209-213`.
- **Background:** Today a story fails when its own work throws, and a screen
  fails with `render-failed`. Today's render also fails on a portal and on a
  suspend without a boundary, and it shows the fallback with no error when a
  child of a Suspense boundary throws. With effects off, the reconciler
  reports only errors that reach the root.
- **Problem:** A caught error, a portal, and a suspend without a boundary
  look like successful renders under H.
- **Impact if no action:** Reviewers see a fallback or an empty view as a
  valid render, with no warning, and `--strict` passes.
- **Root question:** Under H, which outcomes count as a failed story view or a
  failed screen render?
- **Options:**
  - **A.** Accept what the reconciler gives, and change the failures page.
    Effort: Small.
  - **B.** Fail with today's messages on an error at the root, a portal, and
    a suspend without a boundary, the last found through fiber fields. A
    caught error still shows the fallback. An error inside Suspense now
    fails. Effort: Medium.
  - **C.** Do B, and also fail on a caught error that the boundary's fiber
    field shows. Effort: Medium.
  - **D.** Do not move to the reconciler, and choose another option of
    decision 3, such as G. Effort: Medium.
  - **E.** Do C, and render a failed view again today's way so that today's
    result decides. It renders twice and breaks the rule that there is no
    fallback render. Effort: Large.
- **Left out:** Report caught errors through `onCaughtError`: with effects
  off React never calls it.
- **Wider fix:** C.
- **Previous examples:** Track F's failed views.
- **Related:** Track I decision 5.
- **Recommendation:** C. It keeps the failed-views rule, and its one new
  failure, an error inside Suspense, is one that the rule already requires.
- **Action:** ask the user, because C fails builds that pass today when a
  child of a Suspense boundary throws.

#### Track I decision 7: Content that the tracking loses

- **Severity:** High. **Effort:** Medium.
- **Source:** Design, from the design note of the answer H.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-component-changes.md:99-132`.
- **Background:** Under H, Mokly finds supplied content in React's tree by
  the identity of each element's props object and a `cloneElement` wrapper.
  Text children are data in the use's digest. Decision 21 makes element
  content slots of the use.
- **Problem:** A component that re-creates a supplied element with new props,
  such as `createElement(child.type, {...child.props})`, breaks the tracking.
  The content then counts as the component's own output, in no slot and not
  in the digest.
- **Impact if no action:** After an edit of that content, Changes shows the
  screen as unchanged, which breaks the rule that missing evidence never
  means unchanged inputs.
- **Root question:** How does Changes keep an edit of supplied content that
  the tracking cannot find in the output?
- **Options:**
  - **A.** Accept the gap, and state it in the guide. Effort: Small.
  - **B.** Add a canonical digest of the supplied elements to the use's
    record. An edit inside a screen component in that content still drops
    out, and normal edits show twice. Effort: Medium.
  - **C.** Give a use no instance region when a supplied element has no
    tracked fiber. Its whole output stays in the screen's comparison.
    Effort: Medium.
  - **D.** Do not move to the reconciler, and choose G, whose mirror elements
    keep the mark when a child is re-created. Effort: Medium.
- **Left out:** Match content by a second render: it fails when components
  clone, repeat, or move content.
- **Wider fix:** C.
- **Previous examples:** Option D of track I decision 3.
- **Recommendation:** C. No edit of a use's content can drop out, and the
  noise touches only uses whose content the tracking loses.
- **Action:** ask the user, because C applies the rule "no instance region for
  a use with content", which decision 21 rejected, to those uses.

#### Track I decision 8: Style owners of a story component use

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design, from the design note of the answer H.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-sidecar-render-records.md:21-28`,
  `packages/mokly/src/sidecar/styles.ts:89-121`.
- **Background:** Mokly gives each styled-components and Emotion rule the
  component whose render used it as its owner, and slot content keeps its
  supplier. A Mokly scope element around each use and slot sets that owner.
  H allows no Mokly element in the product's tree.
- **Problem:** Under H nothing gives the rules of a story component use their
  owner, so every such rule falls to the screen.
- **Impact if no action:** An edit of a story component's own CSS shows as an
  edit of each screen that uses it, and its Affected list misses them.
- **Root question:** How does each style rule of a story component use get
  its owner without a Mokly element around the use?
- **Options:**
  - **A.** Give every such rule the screen as owner. Effort: Small.
  - **B.** After the render, give each rule the owner of the region whose
    output carries its class: the component outside the slots, the supplier
    inside one. A rule without a class keeps the owner of its `<style>`
    element, or else the screen. Effort: Medium.
  - **C.** Do not move to the reconciler, and choose another option of
    decision 3, such as G. Effort: Medium.
  - **D.** Find the rendering component through React's development-only
    owner field when a library adds a rule, and use B in production builds.
    Effort: Large.
- **Left out:** None.
- **Wider fix:** B.
- **Previous examples:** Persistent native registries keep selector
  attribution.
- **Recommendation:** B. Every rule keeps an owner from public data in the
  output, and the rule changes only for story component uses.
- **Action:** ask the user, because B changes the style ownership rule of the
  render records page.

#### Track I decision 9: Which renders move to the reconciler

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design, from the design note of the answer H.
- **Category:** Docs or spec.
- **Location:** `packages/mokly/src/sidecar/render-markup.ts:48-56`.
- **Background:** Story component uses occur only in a generation with
  stories files, so the sidecar knows before each render whether a use can
  occur. Client `useId` values differ from today's, and they shift when one
  `useId` call is added earlier in the document.
- **Problem:** If every render moves, catalogues without Storybook get new
  bytes and new failure rules. If only renders with a use move, the sidecar
  must find uses before the render.
- **Impact if no action:** The build has no rule for the path of a render.
- **Root question:** Which React renders take the reconciler, so that uses
  render as in the product with the fewest unrelated changes?
- **Options:**
  - **A.** Move every React render. Effort: Small.
  - **B.** Move every render of a generation that has stories files. Other
    catalogues keep today's path. The first stories file changes the bytes of
    every screen once. Effort: Small.
  - **C.** Do not move to the reconciler, and choose another option of
    decision 3, such as G. Effort: Medium.
  - **D.** Move only a render that holds a story component use, found by a
    first render or a static check of the module graph. Effort: Large.
- **Left out:** Move only a render with a use that has content: a use without
  content still gets a Mokly type and breaks `child.type` filters.
- **Wider fix:** B.
- **Previous examples:** The JSX shim records uses only when the generation
  has stories files.
- **Related:** Track I decision 4.
- **Recommendation:** B. Catalogues without Storybook keep today's output
  and need no reconciler.
- **Action:** ask the user, because A keeps one path for all catalogues and B
  keeps the other catalogues unchanged.

The spike of J and its check of 2026-11-28 raised the two decisions below.
Both apply to E, I, and J alike, so they do not decide between J and I.

#### Track I decision 10: Supplied content that bypasses its slot

- **Severity:** High. **Effort:** Large.
- **Source:** Review, from the check of the spike of J.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-component-changes.md:107` and `:133`,
  `docs/protocol/mokly-story-component-uses.md:51`.
- **Background:** Under decision 21, each element that a screen passes into
  a story component use becomes a slot of the use. Changes compares the
  slot in the screen's own view and the rest of the use only by its id, its
  path, and its props digest. Under E and J the supplied element keeps its
  props, so the receiving component can read them, re-create the element, or
  render its content without the element. Track I decision 7 asked the same
  question for H and closed without an answer.
- **Problem:** The check found 6 visible edits of supplied content that
  leave the compared inputs of the screen equal under J, and 3 under E. A
  fallback for a slot without a placement catches 5 of them. One edit stays
  hidden under every tested form: a receiver that renders the slot and also
  reads the element's props outside it.
- **Impact if no action:** After a visible edit, Changes shows the screen as
  unchanged. This breaks the rule that missing input evidence never means
  unchanged inputs.
- **Root question:** How does Changes keep every edit of supplied content
  when the receiving component reads the content or renders it outside its
  slot?
- **Options:**
  - **A.** Keep the projection, and state the limit in the guide. The six
    edits drop out of Changes. Effort: Small.
  - **B.** A use with a supplied slot that gets no placement keeps its whole
    output in the screen's comparison. The edit of a slot that is placed and
    also read stays hidden. A use whose component never renders a supplied
    slot loses its folding. Effort: Medium.
  - **C.** The props digest of a use also holds a canonical form of each
    supplied element: its type name, its key, its data props, and its nested
    elements. A screen edit of supplied content then changes the use's
    inputs. An edit of the code of a screen component inside that content,
    with equal props, stays hidden. Effort: Medium.
  - **D.** Do B and C. Every tested visible edit then stays visible, and uses
    whose content stays in its slots keep their folding. The check did not
    build C. Effort: Large.
  - **E.** Do B, and also fall back when other code reads a supplied
    element's props, which a proxy detects. Radix `asChild` reads every prop,
    so most uses lose their folding. Effort: Large.
- **Left out:** A warning or an error for such a use: a new error that the
  user did not approve, for code that renders correctly. No projection for
  every use with content: decision 21 rejected it.
- **Wider fix:** D.
- **Previous examples:** Track I decision 7, and option C of track I
  decision 3.
- **Related:** Track I decision 11. A use whose slots are all dropped with a
  Suspense branch falls under B. Option I of decision 3 needs the core
  feature of B, a usage record whose output stays in the screen's
  comparison.
- **Recommendation:** D. It is the only option that keeps every tested
  visible edit while uses whose content stays in its slots keep their
  folding.
- **Action:** ask the user, because B applies the rule that decision 21
  rejected to some uses, and C adds content to the props digest, which no
  rule covers.

#### Track I decision 11: Suspense branches that the render drops

- **Severity:** High. **Likelihood:** Common. **Effort:** Medium.
- **Source:** Review, from the check of the spike of J.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/markup.ts:104`,
  `docs/protocol/mokly-instances.md:196`,
  `docs/protocol/mokly-sidecar-render-records.md:40`.
- **Background:** Each Mokly marker is a template element with a random
  token that the sidecar records. A render fails with "render dropped a
  Mokly marker" when a recorded token is not in the output, and the render
  records page requires complete consumption of the markers. On the server,
  a Suspense boundary whose content suspends or throws renders its fallback
  and drops that content. `defineComponent` wrappers and `MockLink asChild`
  write markers on `origin/main`, and track I gives every story component
  use markers. The instances page says that an unrendered branch has no
  record.
- **Problem:** Today's branch sidecar fails 8 of 10 scenarios that plain
  React renders with the fallback. The wrapper and `MockLink` cases fail
  without track I too.
- **Impact if no action:** A screen or a story with a pending or failing
  Suspense branch, such as a `React.lazy` section, stops the build with
  `render-failed` once it renders a story component, under E, I, and J.
- **Root question:** What does Mokly record for a marked branch that
  Suspense replaces with its fallback?
- **Options:**
  - **A.** Keep the failure. Each such view stops the build. Effort: Small.
  - **B.** Drop the records of each region whose two tokens never reach the
    output, and renumber the input orders. A region that lost only one
    token, and a token that leaks into the output as text, still fail. A
    later use keeps the number that it took, such as `Healthy-3` after a
    dropped `Healthy-2`. Effort: Medium.
  - **C.** Do B, and recompute the ids, keys, and markers of later uses after
    the render, so that their numbers close up. Effort: Large.
- **Left out:** A failed view or a warning for such a view: the product
  renders the fallback, and a warning would fail `--strict` for correct
  code. A second render without uses: it costs a render and gives no usage
  evidence.
- **Wider fix:** B. It covers every marker kind.
- **Previous examples:** None found.
- **Related:** Track I decision 10.
- **Recommendation:** B. It follows the rule for unrendered branches,
  matched plain React in every tested scenario that plain React renders, and
  keeps the checks for a forged or partly dropped marker.
- **Action:** ask the user, because B changes the requirement of complete
  marker consumption on the render records page and overrides a render
  failure that `origin/main` has.

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
