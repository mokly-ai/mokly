# Built Repository Packages In Changes

Status: Active. On branch `conductor/built-repository-packages-in-changes`,
no pull request yet. The plan closes when its PR merges.

A Changes comparison renders every entry twice. The head side renders from
the working tree. The base side renders from the base commit's sources,
without a build step. A third-party package comes from the selected
installation, which is the working tree's `node_modules` while the lockfiles
match. A repository package is a package inside the repository that the
package manager links into `node_modules`. Each side maps a repository
package to its own copy under the
[sidecar module rules](../docs/protocol/mokly-sidecar-modules.md#source-and-dependency-files)
and the
[imported styles contract](../docs/protocol/mokly-imported-styles.md#roots-collection-and-deduplication).
That rule assumes that the package's `exports` name files that Git tracks.

`@mokly/ui` under `packages/ui` is the first built repository package. It is
on the branch `calummoore/viewer-library-design`. The plan
`plans/ui-package.md` on that branch gives the evidence in its decision 9
and its milestone 4. The package's `exports` point every subpath at `dist/`,
which Git ignores. An entry that imports `@mokly/ui/appearance-selector`
resolves the built file on the head side. The base side maps that file to
the base tree, which has `packages/ui/src` and no `dist`. The sidecar then
reports that the module has no source in this side, the bundle fails, and
Changes is unavailable for every entry that imports the package. That branch
works around the failure: its design mockups import
`packages/ui/src/{name}/{name}.tsx` and `.css` by repository path.

A registration's `stylesheets` field accepts only paths inside the
configuration directory. A parent segment fails the path check in
`crates/mokly-render/src/declarations.rs` with "declares invalid
stylesheet". A path through `node_modules` fails the public policy in
`crates/mokly-graph/src/public_locations.rs` with "consumer dependency
tree". So a registration cannot name a package stylesheet.

A PostCSS plugin that inlines a bare `@import` resolves it with its own
resolver. Tailwind looks in the `node_modules` directories above the
stylesheet, then in `NODE_PATH`, with the `style` condition only. The base
side's PostCSS child puts the selected installation first in `NODE_PATH`.
With the working tree's installation, Tailwind therefore inlines the working
tree's package file on both sides. The example's PostCSS step inlines
`@import "@mokly/ui/{name}.css"` this way before Mokly's bundler runs, so
both sides get the same bytes and a change to that CSS never shows. This gap
applies to every repository package, built or not.

This plan lets Changes compare a built repository package from each side's
own sources. Under the recommended options, Mokly enables the `source` export
condition of a repository package on both sides. The base side fails closed
when a PostCSS plugin inlined the head's copy of a changed repository file.
A registration's `stylesheets` field accepts a package specifier, which each
side resolves. `@mokly/ui` then declares `source` targets, and the design
library imports the package by name again. The plan adds no package build,
unless decision 1 selects B. It does not change the configured stylesheet
rules of `mokly.config.json`, a package without a `source` condition, or a
third-party package.

Evidence goes under `.context/built-repository-packages/`.

Contract owners:

- [Comparison package selection](../docs/protocol/mokly-comparison-packages.md),
  the repository package rule.
- [Base dependencies](../docs/protocol/mokly-base-dependencies.md#dependency-identity),
  the mapping of repository packages.
- [Sidecar module sources](../docs/protocol/mokly-sidecar-modules.md#source-and-dependency-files),
  the mapped file of a repository package.
- [Imported stylesheet delivery](../docs/protocol/mokly-imported-styles.md),
  its [PostCSS page](../docs/protocol/mokly-imported-styles-postcss.md), and
  its [diagnostics](../docs/protocol/mokly-imported-styles-errors.md).
- [Registered components](../docs/protocol/mokly-components.md) and
  [component stylesheets](../docs/protocol/mokly-component-stylesheets.md),
  the `stylesheets` field.
- [Public file policy](../docs/protocol/mokly-public-closure.md), the
  admission of a resolved package stylesheet.
- [Design components](../docs/protocol/mokly-design-components.md), the
  design library's package imports.
- The [mokly package README](../packages/mokly/README.md), the
  [mokly-css README](../crates/mokly-css/README.md), the
  [mokly-render README](../crates/mokly-render/README.md), the
  [mokly-graph README](../crates/mokly-graph/README.md), the
  [design library README](../examples/basic/specs/design/library/README.md),
  and `packages/ui/README.md` after the shared UI package PR merges.
- The [Changes guide](../docs/guides/catalogue/changes.md), the
  [components guide](../docs/guides/authoring/components.md), and the
  [styles guide](../docs/guides/authoring/styles.md).

## Decisions

These decisions were asked on 2026-10-28 and are open. The report of the
plan commit gives each one with its background, problem, impact, and
options. A decision stays open until the user answers it. No option applies
before that, also not as an interim step. The milestones follow the
recommended options, so that the plan reads as one design. Another answer
changes the milestones that depend on the decision. Decision 1 keeps the
letters A and B of the brief, and decision 3 keeps its letter C, so the new
options of decision 1 start at D.

1. Decision 1, severity High: the base side has no build output of a
   repository package. Milestones 1, 2, 3, 6, 7, and 8 depend on it.
   - A: enable the `source` condition only where a mapped file is missing
     on a side. The head then renders `dist` and the base renders `src`.
     Effort Large.
   - B: build the package for each side in an isolated checkout, with a
     cache keyed by the side's tree. Base-commit build scripts run, as an
     opt-in like base install scripts. Effort Large.
   - D: enable the `source` condition of every repository package on both
     sides. Both sides render tracked sources, and no side needs a build.
     Effort Large.
   - E: read the working tree's build output on the base side, with a
     warning. A change in the package then never shows. Effort Large.
   - F: no core change. Consumers import the sources by repository path, or
     add `source` to `moduleResolution.conditions`, which applies to every
     package. Effort Small.
   - Recommended: D. Both sides then resolve the same files, so module
     names, stylesheet routes, and cross-side render reuse match, and a
     stale build cannot change the head.
   - No option changes a plugin-inlined import. Decision 2 covers it.
2. Decision 2, severity High: a PostCSS plugin inlines the head's copy on
   the base side. Milestones 1, 5, and 6 depend on it.
   - A: document the limit only. Effort Small.
   - B: warn when a base-side plugin inlined the head's copy of a
     repository file whose bytes differ from the base. Effort Medium.
   - C: fail the base side in that case, with a diagnostic and one recovery
     action. Effort Medium.
   - D: rewrite each root stylesheet's bare `@import` of a repository
     package to the side's own file before PostCSS runs, and apply C to
     nested imports, which the plugin reads from disk. Effort Large.
   - Recommended: C. The base output would be wrong, and the repository
     package rule already fails closed when a side lacks its own copy.
3. Decision 3, severity Medium: a registration cannot name a package
   stylesheet. Milestones 1, 4, 6, and 8 depend on it.
   - A: keep local paths. A local stylesheet imports the package's source
     CSS by relative repository path. Effort Small.
   - B: accept repository paths outside the configuration directory.
     Effort Medium.
   - C: accept a bare package specifier, such as
     `@mokly/ui/appearance-selector.css`, which each side resolves with its
     own stylesheet resolver. Effort Large.
   - Recommended: C. The registration names the package's public subpath,
     and the declared file is its own delivery root, so no PostCSS plugin
     inlines it.
4. Decision 4, severity Low: the published `@mokly/ui` must keep valid
   `source` targets. It applies when decision 1 is A or D. Milestone 7
   depends on it.
   - A: publish `src` beside `dist`. Effort Small.
   - B: publish `dist` only, and exempt `source` targets from the packed-file
     test of the release check. Effort Small.
   - Recommended: A. Every published export target then exists, also for a
     downstream bundler that enables `source`.
5. Decision 5, severity Low: milestones 7 and 8 need `@mokly/ui` on `main`.
   Milestones 7 and 8 depend on it.
   - A: do milestones 1 to 6 from `main`. Merge `origin/main` after the
     shared UI package PR merges, then do milestones 7 and 8. Effort Small.
   - B: rebase this branch onto `calummoore/viewer-library-design` and
     stack the two PRs. Effort Small.
   - C: move milestones 7 and 8 to a later plan. Effort Small.
   - Recommended: A. The core work does not wait, and this branch needs no
     rebase for each change on the other branch.

## Design

### Source targets of repository packages

Decision 1, option D. One rule serves JavaScript imports, CSS imports from
JavaScript, runtime requires, PostCSS module imports, and the CSS `@import`s
that Mokly's bundler resolves.

- Look up the package directory of a bare specifier in the selected
  installation, as today. When its real path lies inside a repository root
  and outside every `node_modules` directory, the package is a repository
  package. Its repository-relative path names the side's own copy.
- Read the `package.json` of the side's own copy. Evaluate its `exports` for
  the subpath with `source` added to the conditions of the import. When the
  selection passes through a `source` key, its target is the result.
- The target must be a regular file inside the side's own copy. Otherwise
  the import fails with the existing diagnostic: the missing-source message
  for JavaScript and the unresolved `@import` message for CSS.
- Otherwise resolve as today. A package without `exports`, or a subpath
  without a `source` key, keeps the current mapping and its fail-closed
  rule.
- Look up before the bundler's own resolution. Without a build, the bundler
  cannot resolve a `dist` target on either side.
- Follow the `exports` rules of `crates/mokly-css/src/package.rs`: exact
  subpaths, `*` patterns with the longest prefix, arrays, nested conditions,
  and object key order. The Node test and the Rust test read one table of
  `exports` cases, so the two evaluators cannot drift.

In the sidecar, a new `package-exports.ts` holds the evaluator.
`package-directory.ts` already finds the package directory. One
`ModulePaths` method applies the rule. Both `onResolve` handlers in
`plugins.ts`, `sideRequire` in `importer-resolution.ts`, and the PostCSS
module loader call it. The native plan does not change, because a bare
import from a repository-owned importer always takes the full path in
`native-resolution.ts`. A test holds this.

In `mokly-css`, `SourceResolver::resolve` reads the package manifest through
the side tree of `crates/mokly-render/src/sources.rs`. For a repository
package, that tree projects the manifest to the side's own copy, so the
projected identity lies outside every `node_modules` directory. That
classification enables `source` in `Target::resolve`.

### PostCSS reads of the head's copy

Decision 2, option C. The core receives each plugin's `dependency` messages
for every processed stylesheet.

- On the base side, a reported file whose real path lies in the working
  tree's repository root, outside every `node_modules` directory, is a read
  of the head's copy.
- Compare its bytes with the base side's bytes at the same repository path.
  Equal bytes keep the comparison. Different bytes, or no base file, fail
  the base side with a `build-invalid` diagnostic. Changes is then
  unavailable under the
  [historical runtime policy](../docs/protocol/mokly-base-preparation.md#shared-render-runtime).
- The diagnostic names the plugin, the stylesheet, and the file. It gives
  one recovery action: declare the package stylesheet in `stylesheets`, or
  import it from JavaScript. Milestone 1 sets the exact text.
- A tier-two base reads the install entry's copy of the base sources, so
  the check does not fire there. A read without a report escapes the check,
  as the
  [incomplete coverage rule](../docs/protocol/mokly-sidecar-postcss.md#incomplete-coverage)
  allows.

### Package stylesheets in registrations

Decision 3, option C.

- A `stylesheets` value keeps today's shape check. When no file exists at
  its configuration-relative path, the value is a bare package specifier.
  This is the lookup order of a plain bare CSS `@import`: the local file
  first, then the package.
- Each side resolves the specifier from the configuration directory with
  its own stylesheet resolver, with the `style` condition and the decision 1
  rule. `declarations.rs` uses a `SourceResolver` over the side reader of
  `sources.rs`, as `stylesheets.rs` does.
- The resolved logical path gives the delivery root, its route, and its
  link. Duplicates group by the resolved file. Diagnostics name the authored
  value.
- A file in a repository package passes today's public policy. A file in an
  installed package keeps its dependency name. The policy admits it as a
  private stylesheet input, because the dependency-tree and lexical-link
  rules guard authored public paths. Its route keeps a `@scope` segment
  after `node_modules`, as asset routes do.
- Serve watches the resolved file and the manifests that the resolution
  read. A manifest edit resolves the declaration again.
- PostCSS processes the side's own declared file. Only that file's own
  `@import`s reach the plugin's resolver.

## Milestone 1: Documentation and protocol

Record the answers. Then state the requirements and the decisions in force
for decisions 1 to 3. Each touched protocol page gets the status line until
milestone 9. The design components contract and the design library README
change in milestone 8, because their package sentences arrive with the
shared UI package PR. The guides and the READMEs change with the code,
because they describe released behaviour and entry points.

- [ ] Record the user's answers to decisions 1 to 5 in the Decisions
      section, each with its date, the rejected options, and the reason.
      Rewrite the milestones that another answer changes.
- [ ] `docs/protocol/mokly-comparison-packages.md`: the repository package
      rule of decision 1, with the decision in force and its rejected
      alternatives beside it.
- [ ] `docs/protocol/mokly-base-dependencies.md`: the repository package
      paragraph of Dependency Identity links the rule instead of repeating
      it. The page has 241 of its 250 lines, so replace sentences rather
      than add them.
- [ ] `docs/protocol/mokly-sidecar-modules.md`: in Source And Dependency
      Files, the mapped file of a repository package is its `source` target
      when the package declares one, for JavaScript, CSS, runtime, and
      PostCSS module imports.
- [ ] `docs/protocol/mokly-imported-styles.md`: in Roots, Collection And
      Deduplication, a CSS import of a repository package selects its
      `source` target, a declared package stylesheet is a delivery root, and
      a plugin-inlined import follows the PostCSS page. In Routes And
      Ownership, a declared stylesheet route keeps a `@scope` segment after
      `node_modules`.
- [ ] `docs/protocol/mokly-imported-styles-postcss.md`: in Dependency
      Inventory, the base-side rule of decision 2.
- [ ] `docs/protocol/mokly-imported-styles-errors.md`: the exact messages of
      the decision 2 diagnostic and of an unresolvable declared specifier.
- [ ] `docs/protocol/mokly-components.md`: the `stylesheets` bullet names
      local paths and package specifiers.
- [ ] `docs/protocol/mokly-component-stylesheets.md`: in Declaration And
      Local Inputs, Document Linking, and Delivery, the specifier form, its
      lookup order, the resolution on each side, the route from the
      resolved path, the grouping by resolved file, and the watch targets.
- [ ] `docs/protocol/mokly-public-closure.md`: the admission of a resolved
      package stylesheet as a private input.
- [ ] Add `Status: In progress under the [built repository packages plan](../../plans/built-repository-packages.md).`
      below the title of each touched protocol page.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Sidecar source targets

The sidecar selects a repository package's `source` target on both sides,
for JavaScript imports, CSS imports from JavaScript, runtime requires, and
PostCSS module imports. A package without a `source` key resolves as
before, so the product keeps working.

- [ ] Add a failing Node test first: `tests/sidecar_built_packages.test.ts`,
      modeled on `tests/sidecar_repository_links.test.ts`, for the npm and
      pnpm link layouts. A `widget` package declares `source` targets in
      `src` and `import` and `default` targets in `dist`. Only the head has
      `dist`. Split the file when it passes 300 lines.
  - [ ] The base side bundles the base `src` and renders the base text.
  - [ ] The head side renders `src`, also when a stale `dist` differs, and
        bundles without `dist`.
  - [ ] A CSS import from JavaScript selects the CSS `source` target on
        each side.
  - [ ] TypeScript sources whose relative imports end in `.js` bundle.
  - [ ] A `source` target that is missing on the base fails with the
        missing-source message.
  - [ ] A package without a `source` key keeps today's failure when the
        base has no `dist`.
  - [ ] A third-party package with a `source` key keeps its `import`
        target.
  - [ ] A runtime `require` and a PostCSS module import of a repository
        package select the `source` target.
  - [ ] The planned resolution mode gives the result of the full mode.
- [ ] Add `packages/mokly/src/sidecar/package-exports.ts`, the `exports`
      evaluator, with `tests/sidecar_package_exports.test.ts` over the
      shared table of `exports` cases.
- [ ] Add one `ModulePaths` method for the lookup. Call it from both
      `onResolve` handlers in `plugins.ts`, from `sideRequire` in
      `importer-resolution.ts`, and from the PostCSS module loader.
      `module-paths.ts` has 261 lines, so put the new logic in its own
      module.
- [ ] Update the Key Code list of `packages/mokly/README.md`.
- [ ] Add a section on built repository packages to the
      [Changes guide](../docs/guides/catalogue/changes.md), with an
      `exports` example that declares `source` targets.
- [ ] Run the new tests, `tests/sidecar_repository_links.test.ts`,
      `tests/sidecar_dependencies.test.ts`, `npm run typecheck`,
      `npm run lint`, and `cargo xtask check --suite repository`.

## Milestone 3: `mokly-css` source targets

The Rust stylesheet resolver selects a repository package's `source` target
for a CSS `@import` on both sides, with the `exports` rules of the sidecar.
A third-party package keeps today's conditions.

- [ ] Add failing unit tests first in
      `crates/mokly-css/src/_tests_/resolver_tests.rs`: a repository
      package's `@import` selects its `source` target, a third-party package
      with a `source` key keeps its `style` target, a missing `source`
      target fails with the `@import` diagnostic, and the shared table of
      `exports` cases passes.
- [ ] Enable `source` in `crates/mokly-css/src/package.rs` and
      `crates/mokly-css/src/resolver.rs` when the projected manifest lies
      outside every `node_modules` directory.
- [ ] Add a mapped-side test beside
      `crates/mokly-render/src/_tests_/source_precedence_tests.rs`: the
      side tree projects a repository package manifest to the side's own
      copy on the head side and on the base side.
- [ ] Add `crates/mokly-render/tests/integration/built_package_tests.rs`,
      declared in `crates/mokly-render/tests/integration/mod.rs` and
      modeled on `base_styles_tests.rs`. A head with `dist` and a base
      without it compare with ready Changes. A JavaScript import and a CSS
      `@import` of the package read each side's `src`. A changed rule in
      the base's `src` CSS is a changed rule.
- [ ] Update What This Crate Does in `crates/mokly-css/README.md`.
- [ ] Run `cargo test -p mokly-css`,
      `cargo test -p mokly-render built_package`,
      `cargo fmt --all -- --check`, `cargo clippy`, and
      `cargo xtask rust-file-length-lint`.

## Milestone 4: Package stylesheets in registrations

A registration's `stylesheets` value can name a package stylesheet, such as
`@mokly/ui/appearance-selector.css`. Each side resolves it with its own
stylesheet resolver. A local path keeps its meaning. The work spans
`mokly-render` and `mokly-graph`, because a declaration and its root must
change together for the product to keep working.

- [ ] Add failing tests first in
      `crates/mokly-render/tests/integration/declaration_tests.rs`:
  - [ ] A declared specifier links the `source` stylesheet of a repository
        package on each side.
  - [ ] A local file at the same configuration-relative path wins.
  - [ ] Two values that resolve to one file link once, with the duplicate
        warning.
  - [ ] An unresolvable specifier fails with the milestone 1 message.
  - [ ] An installed package's stylesheet links under its dependency route.
- [ ] `crates/mokly-render/src/declarations.rs`: resolve a value that names
      no local file with the side's stylesheet resolver, and pass the
      resolved logical path with the authored value.
- [ ] `crates/mokly-graph/src/delivery_inputs.rs` and
      `crates/mokly-graph/src/styles.rs`: the roots, routes, and links use
      the resolved path.
- [ ] `crates/mokly-graph/src/policy.rs` and `public_locations.rs`: admit a
      resolved package stylesheet under the milestone 1 rule.
- [ ] Watch the resolved file and the manifests that the resolution read,
      and resolve again after a manifest edit. Add a watch test beside
      `crates/mokly-render/tests/integration/watch_tests.rs`.
- [ ] Update the doc comment of `RenderSource::stylesheets` in
      `crates/mokly-catalogue/src/render_sources.rs`, which still says
      "Config-relative".
- [ ] Update the Component styles section of the
      [components guide](../docs/guides/authoring/components.md), and the
      READMEs of `mokly-render` and `mokly-graph`.
- [ ] Run `cargo test -p mokly-render`, `cargo test -p mokly-graph`,
      `cargo clippy`, and `cargo xtask check --suite repository`.

## Milestone 5: PostCSS reads of the head's copy

The base side fails closed when a PostCSS plugin inlined the head's copy of
a repository file whose bytes differ from the base, under decision 2.

- [ ] Add failing tests first beside
      `crates/mokly-render/src/_tests_/postcss_read_inventory_tests.rs`: a
      differing file fails the base side with the milestone 1 diagnostic,
      equal bytes keep the comparison, a file under `node_modules` is
      ignored, and a tier-two base copy does not fire.
- [ ] Add the check where the core takes in the plugin reports,
      `crates/mokly-render/src/postcss_inventory.rs`.
- [ ] Update the Tailwind section of the
      [styles guide](../docs/guides/authoring/styles.md): a repository
      package's stylesheet reaches a side through `stylesheets` or a
      JavaScript import, not through a plugin-inlined `@import`.
- [ ] Run `cargo test -p mokly-render postcss`, `cargo clippy`, and
      `cargo xtask check --suite repository`.

## Milestone 6: Changes against a base without build output

One build-level test proves the whole path with a real Git base: a base
commit without `dist` renders a catalogue that imports a built repository
package.

- [ ] Add `tests/static_changes_built_packages.test.ts` with the helpers of
      `tests/static_changes_styles.test.ts`. The fixture repository has
      `packages/widget` with TypeScript sources, CSS, `source` targets, and
      `dist` in `.gitignore`. Its `node_modules` is a real directory with
      links to the workspace's React packages and to `widget`, so that the
      fixture adds nothing to the workspace installation. A screen imports
      `widget/button`, and a component declares
      `stylesheets: ["widget/button.css"]`. Commit the base without `dist`,
      then build `dist` in the head.
  - [ ] Changes is ready, and an unchanged package gives unmodified views.
  - [ ] A text change in `src/button.tsx` changes the screen.
  - [ ] A rule change in `src/button.css` gives the component a changed
        rule.
  - [ ] A change only in the head's `dist` gives no change.
  - [ ] With Tailwind and a plugin-inlined `@import "widget/button.css"`,
        a differing package stylesheet makes Changes unavailable with the
        decision 2 diagnostic, and equal bytes keep Changes ready.
- [ ] Run `npm test -- tests/static_changes_built_packages.test.ts`. Save
      the output under `.context/built-repository-packages/static/`.

## Milestone 7: UI package source targets

`@mokly/ui` declares `source` targets, so that the design library can import
it by name. This milestone needs the shared UI package PR on `main`, under
decision 5.

- [ ] Merge `origin/main` into this branch after the shared UI package PR
      merges, under the `git-merge` skill.
- [ ] `packages/ui/package.json`: each component subpath gets
      `"source": "./src/{name}/{name}.tsx"` as its first key. Each CSS
      subpath becomes
      `{ "source": "./src/{name}/{name}.css", "default": "./dist/{name}/{name}.css" }`.
      `./styles.css` keeps its `dist` target, because the build writes it.
- [ ] Add `src` to `files`, under decision 4.
- [ ] `scripts/release/manifest.mjs`: `validateUiManifest` requires the new
      target forms and the new `files` list, and `validateExportFiles` then
      finds every target in the archive. Update the release tests that
      assert the manifest, such as `tests/release_ui_package.test.ts`.
- [ ] Describe the `source` targets in the Development section of
      `packages/ui/README.md`.
- [ ] Update `docs/protocol/mokly-viewer.md` or
      `docs/protocol/npm-release.md` if either states the export targets or
      the published files.
- [ ] Run `npm run build`, the release tests, `npm run package:smoke`, and
      `cargo xtask check --suite repository`.

## Milestone 8: Design library package-name imports

Tags: mockup

The two design library components that render `@mokly/ui` import it by name
and declare its stylesheets by package specifier. The artboards do not
change, so no design step comes first. This milestone comes after the core
milestones, because the mockups render through them.

- [ ] `chrome/appearance-selector.view.tsx` imports
      `@mokly/ui/appearance-selector`, and
      `controls/comparison-toolbar.view.tsx` imports
      `@mokly/ui/comparison-toolbar`, instead of the `packages/ui/src`
      paths.
- [ ] Their registrations declare `@mokly/ui/appearance-selector.css` with
      `@mokly/ui/change-mark.css`, and `@mokly/ui/comparison-toolbar.css`,
      through `libraryMetadata` and `style_files.ts`.
- [ ] Delete each local file that only imported the package sources by
      repository path. Save the search that shows it unused under
      `.context/built-repository-packages/`.
- [ ] Change the "by its repository path" sentences of
      `docs/protocol/mokly-design-components.md`, the design library
      README, and `AGENTS.md` to the package name.
- [ ] Update `tests/design_boundaries.test.ts` and
      `tests/helpers/design_styles.ts` if they read the package stylesheets
      by repository path. The design browser specs of both components pass.
- [ ] Mockup check: `npm run build`, then
      `npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`.
- [ ] Smoke test through `npm run dev`: the Shared components pages of both
      components, the Appearance artboards, and the Changes diff-controls
      artboards, in both viewports and both schemes. An edit to
      `packages/ui/src/appearance-selector/appearance-selector.css` refreshes
      the pages without a package build.
- [ ] Changes smoke test against a base without `dist`: commit this
      milestone, change a rule in
      `packages/ui/src/comparison-toolbar/comparison-toolbar.css` without a
      commit, and run the mockup build with `--base HEAD`. Changes lists
      the comparison toolbar with the changed rule. Restore the file. Save
      the output and the screenshots under
      `.context/built-repository-packages/mockups/`.

## Milestone 9: Verification, commit, review, and pull request

- [ ] Remove the status lines that milestone 1 added, because the behaviour
      is implemented.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] On the first branch after the merge that changes a `@mokly/ui`
      component, confirm that Changes against `main` lists the design
      library component and its consumers.
