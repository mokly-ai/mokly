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
the base tree, which has `packages/ui/src` and no `dist`. With the working
tree's installation, the sidecar then reports that the module has no source
in this side. The bundle fails, and Changes is unavailable for the whole
catalogue, because one bundle holds every entry and Changes has one status.
That branch works around the failure: its design mockups import
`packages/ui/src/{name}/{name}.tsx` by repository path, and local stylesheets
import `packages/ui/src/{name}/{name}.css` by relative path.

On `main`, a registration's `stylesheets` field accepts only paths inside
the configuration directory. A parent segment fails the path check in
`crates/mokly-render/src/declarations.rs` with "declares invalid
stylesheet". A path through `node_modules` fails the public policy in
`crates/mokly-graph/src/public_locations.rs` with "consumer dependency
tree". A configured stylesheet in `mokly.config.json` may already use `..`
segments that stay inside `repoRoot`, under the
[configuration contract](../docs/protocol/mokly-configuration.md#validation).

A PostCSS plugin that inlines a bare `@import` resolves it with its own
resolver. Tailwind looks in the `node_modules` folders above the stylesheet,
then in `NODE_PATH`, and matches only the `style` and `default` conditions.
The base side's PostCSS child puts the selected installation first in
`NODE_PATH`. With the working tree's installation, Tailwind therefore
inlines the working tree's copy of a repository package on both sides, and
a change to that CSS never shows. No stylesheet in the repository has such
an import today. A relative `@import` resolves from the stylesheet's own
folder, which on the base side lies inside the base extraction, so the
design library's relative imports read the base bytes.

This plan lets Changes compare a built repository package from each side's
own sources. A registration's `stylesheets` value may name any CSS file
inside `repoRoot` with `..` segments, as a configured stylesheet may, under
answered decision 3. Under the recommended options of the open decisions, a
repository opts in to source export conditions for its repository packages,
and the base side fails closed when a PostCSS plugin read the head's copy of
a changed repository file. `@mokly/ui` then declares `source` targets and
publishes `src`, and the design library imports the package by name. The
plan adds no package build, unless decision 1 selects B. It does not change
a third-party package or a repository that does not opt in.

Evidence goes under `.context/built-repository-packages/`.

Contract owners:

- [Component stylesheets](../docs/protocol/mokly-component-stylesheets.md),
  the path rule of the `stylesheets` field.
- [Configuration](../docs/protocol/mokly-configuration.md#module-resolution),
  the module resolution settings.
- [Comparison package selection](../docs/protocol/mokly-comparison-packages.md),
  the repository package rule.
- [Base dependencies](../docs/protocol/mokly-base-dependencies.md#dependency-identity),
  the mapping of repository packages.
- [Sidecar module sources](../docs/protocol/mokly-sidecar-modules.md#source-and-dependency-files),
  the mapped file of a repository package.
- [Imported stylesheet delivery](../docs/protocol/mokly-imported-styles.md),
  its [PostCSS page](../docs/protocol/mokly-imported-styles-postcss.md), and
  its [diagnostics](../docs/protocol/mokly-imported-styles-errors.md).
- [Design components](../docs/protocol/mokly-design-components.md), the
  design library's package imports.
- The [mokly package README](../packages/mokly/README.md), the
  [mokly-css README](../crates/mokly-css/README.md), the
  [mokly-render README](../crates/mokly-render/README.md), the
  [design library README](../examples/basic/specs/design/library/README.md),
  and `packages/ui/README.md` after the shared UI package PR merges.
- The [Changes guide](../docs/guides/catalogue/changes.md), the
  [configuration guide](../docs/guides/authoring/config.md), the
  [components guide](../docs/guides/authoring/components.md), and the
  [styles guide](../docs/guides/authoring/styles.md).

## Decisions

The plan asked five decisions on 2026-10-28. The coordinator workspace 367
answered decisions 3 and 5 for the user on the same day, after an
independent review of all five. Decisions 1, 2, and 4 wait for the user. An
open decision blocks the milestones that depend on it, and none of its
options applies before the answer. The milestones follow the recommended
options. Another answer changes the milestones that depend on the decision.
Decision 1 keeps the letters A and B of the brief, and decision 3 kept its
letter C, so the options that the plan added to decision 1 start at D.

On 2026-10-28, after the coordinator's review, an options check in a fresh
context added options to decisions 1, 2, and 4. It changed the
recommendation of decision 1 from D to G. Its report is
`.context/built-repository-packages/options-check-2026-10-28.md`.

### Answered decisions

- Decision 3 (2026-10-28, the coordinator for the user): B. A component's
  `stylesheets` value may use `..` segments when its path stays inside
  `repoRoot`. Rejected: A, a local stylesheet that imports the package CSS
  by relative path, because each package stylesheet then needs an extra
  file; C, a package specifier that each side resolves, because it adds a
  second resolution path for declarations and is Large. Reason: since
  PR #240, `ResolvedConfig::repository_path` removes those segments and
  stops at `repoRoot`, and `crates/mokly-graph/src/styles.rs` builds the
  declared roots from it. Only `declarations.rs` and the component
  stylesheet contract still reject the segments, while the configuration
  contract allows that form. B removes the mismatch and is Small. The plan
  recommended C. The coordinator's reviewer changed it to B.
- Decision 5 (2026-10-28, the coordinator for the user): D, a new option.
  Do the core milestones from `main`. If the shared UI package PR of
  `calummoore/viewer-library-design` has merged by then, merge
  `origin/main` and do the two UI milestones, "UI package source targets"
  and "Design library package imports". If it has not, move those two
  milestones to a later plan and finish this branch without them. Rejected:
  A, wait for that PR; B, stack this branch on it; C, move the two
  milestones now. Reason: the core work never waits for the other PR, and
  the UI work still lands here when it can. The coordinator named the
  milestones by number. This plan names them by title, because later
  changes renumbered them.

### Design calls

- My call, 2026-10-28: under decision 3 B, a declared value also accepts
  `.` and empty segments. The configuration contract removes `.`, `..`, and
  empty segments from every config-relative path, and the component
  stylesheet contract says that a value is relative to the configuration
  file like a configured local stylesheet.
- My call, 2026-10-28: the documentation milestone splits in two. Milestone
  1 states decision 3 B, which is answered, so that its implementation can
  start. Milestone 3 states decisions 1 and 2 after the user answers them.
- My call, 2026-10-28, for the options that use source conditions: a `null`
  target in `exports` means that the subpath is not exported, as in Node.
  `crates/mokly-css/src/package.rs` skips such a target today. The
  stylesheet contract already uses Node package lookup.
- My call, 2026-10-28: `#name` imports through a package's `imports` field
  stay out of scope. They keep today's resolution, and no repository
  package uses them.

### Open decision 1. The base side lacks the package build

- **Severity:** High. **Effort:** Large.
- **Terms:**
  - **Selected installation:** the `node_modules` tree that a side uses for
    third-party packages. It is the working tree's tree while the lockfiles
    match.
- **Background:** The sidecar resolves a bare import through the selected
  installation. It maps a file of a repository package to the same path in
  the side's own copy, in `packages/mokly/src/sidecar/module-paths.ts`. The
  Rust stylesheet resolver does the same for a CSS `@import`, through
  `crates/mokly-render/src/sources.rs`. In tier two, the install links the
  package to its own copy of the base sources, which has no `dist` either.
  Every option keeps the `exports` rules of Node resolution, which the
  sidecar module rules require. No option changes a plugin-inlined import,
  which decision 2 covers.
- **Problem:** `@mokly/ui/appearance-selector` resolves to a file in `dist`.
  The base side has no such file. Its bundle fails with "has no source in
  this side", or in tier two with the bundler's "Could not resolve".
- **Impact if no action:** Changes stays unavailable for the whole catalogue
  while any entry imports a built repository package. The design library
  keeps its imports by repository path.
- **Options:**
  - **F.** Make no core change. Consumers commit the build output, import
    the sources by repository path, map each subpath with tsconfig `paths`,
    or add `source` to `moduleResolution.conditions`. That setting also
    changes third-party packages. Effort: Small.
  - **A.** Enable the `source` condition only where a side lacks a mapped
    file. The head renders `dist` and the base renders `src`, so module and
    stylesheet names differ between the sides. An out-of-date build changes
    the head. Effort: Large.
  - **B.** Build the package for each side in an isolated checkout, with a
    cache keyed by the side's tree. Mokly then needs a build command for
    each package, and the configuration has no build recipe today.
    Base-commit build scripts run, behind an opt-in like base install
    scripts. Effort: Large.
  - **D.** Enable the `source` condition of every repository package on
    both sides, with no setting. Both sides render tracked sources, and no
    side needs a build. This adds a resolution default, which the
    configuration contract excludes today. A repository whose `source`
    targets need the package's own build changes its renders silently.
    Effort: Large.
  - **E.** Read the working tree's build output on the base side, with a
    warning. This drops the rule of the comparison package contract that
    each side reads a repository package from its own copy. A change in the
    package then never shows. Effort: Large.
  - **G.** Apply D's rule with the condition names of a new
    `moduleResolution` setting, such as `repositoryConditions`, which is
    empty by default. This repository sets `["source"]`. A consumer can
    reuse a name that its TypeScript `customConditions` already uses. Each
    consumer must opt in. Effort: Large.
- **Recommendation:** G. It gives D's result to every repository that opts
  in, and it changes no other repository's renders. The plan first
  recommended D.
- **Auto-fix:** no, because condition 1 of the decision test holds: G adds
  a configuration setting and changes the repository package rule of the
  comparison package contract.

### Open decision 2. PostCSS plugins read the head's copy

- **Severity:** High. **Effort:** Medium.
- **Terms:**
  - **Plugin-inlined import:** a bare CSS `@import` that a PostCSS plugin,
    such as Tailwind, resolves and copies in before Mokly's bundler runs.
- **Background:** On the base side, the PostCSS child process puts the
  selected installation first in `NODE_PATH`. Tailwind looks for a bare
  `@import` in the `node_modules` folders above the stylesheet, then in
  `NODE_PATH`. A relative `@import` resolves from the stylesheet's own
  folder, so it reads the side's own bytes. The core gets the plugins'
  declared `dependency` messages in
  `crates/mokly-render/src/postcss_inventory.rs`, and the reads that Mokly
  observes in `postcss_read_inventory.rs`. Every option keeps the
  consumer's plugins, which the PostCSS contract requires.
- **Problem:** For a plugin-inlined import of a repository package, the
  base side gets the head's bytes. Changes then misses a change to that
  stylesheet, and no message tells the user. No stylesheet in the
  repository has such an import today.
- **Impact if no action:** Changes can show a changed repository package
  stylesheet as unmodified.
- **Options:**
  - **A.** Document the limit only. Effort: Small.
  - **B.** Warn when a base-side plugin reported the head's copy of a
    repository file whose bytes differ from the base. Changes stays
    available, but its result can be wrong. Effort: Medium.
  - **C.** Fail the base side in that case, with a diagnostic. A reported
    folder of the working tree fails too, because the plugin then scanned
    the head's files. The recovery names a relative repository-path
    `@import`, a `stylesheets` declaration, or a JavaScript import. A
    relative `@import` keeps a Tailwind theme import in one compilation.
    Effort: Medium.
  - **F.** Do C, and apply the same rule to the observed reads of `.css`
    files. A plugin that reads the head's copy without a report then fails
    too. Inlining plugins usually report their files, so it adds little.
    Effort: Medium.
  - **D.** Before PostCSS runs, point each top-level bare `@import` of a
    repository package at the side's own file, and apply C to nested
    imports, which the plugin reads from disk. Effort: Large.
  - **E.** Give the base side's PostCSS child its own package links: a
    folder first in `NODE_PATH` whose links point each repository package at
    the side's own copy. This drops the rule of the base preparation
    contract that the child reads the selected installation directly. A
    plugin that reads `NODE_PATH` then inlines the side's bytes. A package's
    own `node_modules`, as pnpm keeps them, and a CSS `default` target in
    `dist` still miss. Effort: Large.
  - **G.** Define Tailwind's `globalThis.__tw_resolve` hook in the PostCSS
    child, so that Tailwind resolves a repository package to the side's own
    file, and keep C for other plugins. The hook is an undocumented Tailwind
    internal that a release can change. Effort: Large.
  - **H.** When C's check fails, prepare the base again with a tier-two
    install, and keep C when the install cannot run. This costs an install
    while the lockfiles match, and it misses a CSS `default` target in
    `dist`. Effort: Large.
- **Recommendation:** C. It is the smallest option that stops the wrong
  output for every plugin that reports its reads, no stylesheet in the
  repository needs more today, and a larger option can follow.
- **Auto-fix:** no, because condition 3 of the decision test holds: C adds
  a new build error.

### Open decision 4. Published `source` targets of `@mokly/ui`

- **Severity:** Low. **Effort:** Medium.
- **Terms:**
  - **Release manifest check:** `scripts/release/manifest.mjs` and
    `scripts/release/package_reports.mjs` on the shared UI package branch.
    They check each published `exports` target and the files in the
    archive.
- **Background:** This decision applies when `@mokly/ui` declares targets
  under a source condition: under decision 1 A, D, or G, or under the
  `moduleResolution.conditions` workaround of F. The package publishes only
  `dist` and three text files today. The name `source` comes from the brief.
  Other tools, such as TypeScript and Vite, can share that name.
- **Problem:** A `source` target names a `src` file that the published
  archive does not hold. The release manifest check then fails, because
  every export target must be in the archive.
- **Impact if no action:** The UI package milestone cannot pass the release
  check.
- **Options:**
  - **B.** Publish `dist` only, and skip `source` targets in the archive
    check. A downstream bundler that enables `source` then cannot resolve
    the package. Effort: Small.
  - **C.** Use a Mokly-only condition name, such as `mokly-source`, and
    publish `dist` only. The archive check must skip that name's targets
    too. No downstream bundler selects the name, but other tools cannot
    share it. Effort: Small.
  - **A.** Publish `src` beside `dist`. The checks of the `files` list and
    of the archive report then allow `src/`. Every export target exists, and
    the archive grows by the component sources. Effort: Medium.
  - **D.** Keep the `source` targets in the tracked manifest, and pack a
    staged copy whose manifest leaves them out. The archive then holds only
    `dist`, and every published target exists. The release checks must
    accept both manifest forms on purpose. Effort: Medium.
- **Recommendation:** A. Every published export target then exists for
  every bundler, and the shared name stays.
- **Auto-fix:** no, because condition 5 of the decision test holds: the
  coordinator, for the user, asked to bring it to the user, because it
  changes what `@mokly/ui` publishes.

## Design

### Declared stylesheet paths

Decision 3, option B. A declared value names the path that it reaches from
the configuration directory after `.`, `..`, and empty segments are
removed, as `ResolvedConfig::repository_path` computes since #240. A value
whose path leaves `repoRoot` keeps the "declares invalid stylesheet" error,
which names the authored value. The other shape rules stay: a nonempty
value, no leading `/`, no backslash, colon, query, fragment, or NUL, and a
`.css` suffix. The roots, the routes, the links, the duplicate grouping, and
the configured overlap already read the normalized path since #240. The
change is therefore the segment check in `declarations.rs`, its tests, and
the contract text.

### Source targets of repository packages

The recommended option G of open decision 1. One rule serves JavaScript
imports, CSS imports from JavaScript, runtime requires, PostCSS module
imports, and the CSS `@import`s that Mokly's bundler resolves. It applies
only the conditions that `moduleResolution.repositoryConditions` names, and
both sides apply the same value.

- Look up the package directory of a bare specifier in the selected
  installation, as today. When its real path lies inside a repository root
  and outside every `node_modules` directory, the package is a repository
  package. Its repository-relative path names the side's own copy.
- Read the `package.json` of the side's own copy. Evaluate its `exports` for
  the subpath with the repository conditions added to the conditions of
  the import. When the selection passes through a repository condition key,
  its target is the result.
- The target must be a regular file inside the side's own copy. Otherwise
  the import fails with the existing diagnostic: the missing-source message
  for JavaScript and the unresolved `@import` message for CSS.
- Otherwise resolve as today. A package without `exports`, or a subpath
  without a repository condition key, keeps the current mapping and its
  fail-closed rule.
- Look up before the bundler's own resolution. Without a build, the bundler
  cannot resolve a `dist` target on either side.
- Follow Node's `exports` rules, which `crates/mokly-css/src/package.rs`
  implements apart from a `null` target: exact subpaths, `*` patterns with
  the longest prefix, arrays, nested conditions, and object key order. The
  Node test and the Rust test read one table of `exports` cases, so the two
  evaluators cannot drift.

In the sidecar, a new `package-exports.ts` holds the evaluator.
`package-directory.ts` already finds the package directory. One
`ModulePaths` method applies the rule. Both `onResolve` handlers in
`plugins.ts`, `sideRequire` in `importer-resolution.ts`, and `resolvePlugin`
and `nativePath` in `postcss-resolution.ts` call it. The native plan does
not change, because a bare import from a repository-owned importer always
takes the full path in `native-resolution.ts`. A test holds this.

In `mokly-css`, `SourceResolver::resolve` reads the package manifest through
the side tree of `crates/mokly-render/src/sources.rs`. For a repository
package, that tree projects the manifest to the side's own copy, so the
projected identity lies outside every `node_modules` directory. That
classification adds the repository conditions in `Target::resolve`.

### PostCSS reads of the head's copy

The recommended option C of open decision 2. The core receives each
plugin's `dependency` and `dir-dependency` messages for every processed
stylesheet.

- On the base side, a reported file whose real path lies in the working
  tree's repository root, outside every `node_modules` directory, is a read
  of the head's copy. A reported folder there is a scan of the head's files.
- Compare a reported file's bytes with the base side's bytes at the same
  repository path. Equal bytes keep the comparison. Different bytes, no base
  file, or a reported folder fail the base side with a `build-invalid`
  diagnostic. Changes is then unavailable under the
  [historical runtime policy](../docs/protocol/mokly-base-preparation.md#shared-render-runtime).
- The diagnostic names the plugin, the stylesheet, and the path. Its
  recovery names a relative repository-path `@import`, which keeps a
  Tailwind theme import in one compilation, a `stylesheets` declaration, or
  a JavaScript import. Milestone 3 sets the exact text.
- A tier-two base reads the install entry's copy of the base sources, so
  the check does not fire there. A read without a report escapes the check,
  as the
  [incomplete coverage rule](../docs/protocol/mokly-sidecar-postcss.md#incomplete-coverage)
  allows.

## Milestone 1: Documentation for declared stylesheet paths

State decision 3 B in the component stylesheet contract and the components
guide. Milestones 1 and 2 depend on no open decision.

- [x] `docs/protocol/mokly-component-stylesheets.md`, Declaration And Local
      Inputs: a value names the path that it reaches from the configuration
      directory after `.`, `..`, and empty segments are removed, as a
      configured local stylesheet does. The path must stay inside
      `repoRoot`. Remove empty, dot, and parent segments from the rejected
      forms. Put decision 3 B next to the rule, with the rejected package
      specifier and its reason.
- [x] Add the status line below the title of that page. Milestone 2 removes
      it.
- [x] Align any sentence of `docs/protocol/mokly-components.md`,
      `docs/protocol/mokly-public-closure.md`, or
      `docs/protocol/mokly-configuration.md` that contradicts the rule. None
      of the three contradicts it, so none changed.
- [x] Add the rule, with one example, to the Component styles section of
      the [components guide](../docs/guides/authoring/components.md).
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`. The link test ran as
      `node --import tsx --test`, which skips only the build, with the four
      guide tests.
- Done on 2026-10-29 by the delegated Claude Opus 5.5 session and checked.
  Its report: `.context/built-repository-packages/delegation/m1-report.md`.

## Milestone 2: Declared stylesheet paths in `mokly-render`

A declared value with `.`, `..`, or empty segments links the stylesheet
that its normalized path names, under decision 3 B.

- [ ] Add failing tests first beside
      `crates/mokly-render/tests/integration/declaration_tests.rs`:
  - [ ] A value with `..` that stays inside `repoRoot` links
        `styles/{repository path}` on the head side and on the base side.
  - [ ] A value with a `.` or an empty segment links the same route.
  - [ ] A value whose path leaves `repoRoot` fails with "declares invalid
        stylesheet" and the authored value.
  - [ ] Two spellings of one file in one component link once, and the
        duplicate warning names the first authored spelling.
  - [ ] A configured stylesheet and a declaration that spell one file
        differently give one link at the configured position.
- [ ] Remove the segment check from `crates/mokly-render/src/declarations.rs`.
      Keep the other shape checks, and keep `repository_path` as the
      confinement check.
- [ ] Remove the status line that milestone 1 added.
- [ ] Update the README of `mokly-render` if it states the old rule.
- [ ] Smoke test: under `.context/built-repository-packages/smoke/`, build a
      small consumer whose component declares a stylesheet outside the
      configuration directory. Check the link and the delivered stylesheet
      in the output.
- [ ] Run `cargo test -p mokly-render` and
      `cargo xtask check --suite repository`.

## Milestone 3: Documentation for source targets and PostCSS reads

Record the answers to decisions 1, 2, and 4. Then state the requirements and
the decisions in force for decisions 1 and 2. Each touched protocol page
gets the status line until the verification milestone. This milestone waits
for decisions 1 and 2.

- [ ] Record the user's answers to decisions 1, 2, and 4 under Answered
      decisions, each with its date, the rejected options, and the reason.
      Rewrite the milestones that another answer changes.
- [ ] `docs/protocol/mokly-configuration.md`, Module Resolution: the
      `repositoryConditions` setting of decision 1 G.
- [ ] `docs/protocol/mokly-comparison-packages.md`: the repository package
      rule of decision 1, with the decision in force and its rejected
      alternatives beside it.
- [ ] `docs/protocol/mokly-base-dependencies.md`: the repository package
      paragraph of Dependency Identity links the rule instead of repeating
      it. The page is close to its 250-line target, so replace sentences
      rather than add them.
- [ ] `docs/protocol/mokly-sidecar-modules.md`: in Source And Dependency
      Files, the mapped file of a repository package is its repository
      condition target when the package declares one, for JavaScript, CSS,
      runtime, and PostCSS module imports.
- [ ] `docs/protocol/mokly-imported-styles.md`: in Roots, Collection And
      Deduplication, a CSS import of a repository package selects its
      repository condition target, and a plugin-inlined import follows the
      PostCSS page.
- [ ] `docs/protocol/mokly-imported-styles-postcss.md`: in Dependency
      Inventory, the base-side rule of decision 2.
- [ ] `docs/protocol/mokly-imported-styles-errors.md`: the exact message of
      the decision 2 diagnostic.
- [ ] Add `Status: In progress under the [built repository packages plan](../../plans/built-repository-packages.md).`
      below the title of each touched protocol page.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 4: The repository conditions setting

`moduleResolution.repositoryConditions` reaches both sides. Nothing reads it
yet, so the product keeps working. This milestone waits for decision 1.

- [ ] Add failing tests first: the configuration accepts a list of
      condition names, rejects a value that is not a list of nonempty
      strings with `config-invalid`, and passes the list to the sidecar's
      module resolution and to the stylesheet resolution settings of each
      side.
- [ ] Add the field to the configuration types in `mokly-catalogue`, to
      `packages/mokly/config.schema.json`, and to the sidecar's
      `ModuleResolution` type, then run `cargo xtask generate-types`.
- [ ] Pass the value through `crates/mokly-render/src/side.rs`,
      `crates/mokly-render/src/stylesheets.rs`, and
      `crates/mokly-compare/src/dependencies.rs`.
- [ ] Add the setting to the [configuration guide](../docs/guides/authoring/config.md).
- [ ] Run the new tests and `cargo xtask check --suite repository`.

## Milestone 5: Sidecar source targets

The sidecar selects a repository package's repository condition target on
both sides, for JavaScript imports, CSS imports from JavaScript, runtime
requires, and PostCSS module imports. A package without such a key, or a
repository without the setting, resolves as before. This milestone waits
for decision 1.

- [ ] Add a failing Node test first: `tests/sidecar_built_packages.test.ts`,
      modeled on `tests/sidecar_repository_links.test.ts`, for the npm and
      pnpm link layouts. A `widget` package declares `source` targets in
      `src` and `import` and `default` targets in `dist`. Only the head has
      `dist`. The module resolution sets `repositoryConditions: ["source"]`.
      Split the file when it passes 300 lines.
  - [ ] The base side bundles the base `src` and renders the base text.
  - [ ] The head side renders `src`, also when a stale `dist` differs, and
        bundles without `dist`.
  - [ ] A CSS import from JavaScript selects the CSS `source` target on
        each side.
  - [ ] TypeScript sources whose relative imports end in `.js` bundle.
  - [ ] A `source` target that is missing on the base fails with the
        missing-source message.
  - [ ] Without the setting, a package keeps today's failure when the base
        has no `dist`.
  - [ ] A third-party package with a `source` key keeps its `import`
        target.
  - [ ] A runtime `require`, a PostCSS module import, and a record-form
        PostCSS plugin of a repository package select the `source` target.
  - [ ] The planned resolution mode gives the result of the full mode.
- [ ] Add `packages/mokly/src/sidecar/package-exports.ts`, the `exports`
      evaluator, with `tests/sidecar_package_exports.test.ts` over the
      shared table of `exports` cases.
- [ ] Add one `ModulePaths` method for the lookup. Call it from both
      `onResolve` handlers in `plugins.ts`, from `sideRequire` in
      `importer-resolution.ts`, and from `resolvePlugin` and `nativePath` in
      `postcss-resolution.ts`. `module-paths.ts` has 261 lines, so put the
      new logic in its own module.
- [ ] Update the Key Code list of `packages/mokly/README.md`.
- [ ] Add a section on built repository packages to the
      [Changes guide](../docs/guides/catalogue/changes.md), with the
      setting and an `exports` example that declares `source` targets.
- [ ] Run the new tests, `tests/sidecar_repository_links.test.ts`,
      `tests/sidecar_dependencies.test.ts`, `npm run typecheck`,
      `npm run lint`, and `cargo xtask check --suite repository`.

## Milestone 6: `mokly-css` source targets

The Rust stylesheet resolver selects a repository package's repository
condition target for a CSS `@import` on both sides, with the `exports` rules
of the sidecar. A third-party package keeps today's conditions. This
milestone waits for decision 1.

- [ ] Add failing unit tests first in
      `crates/mokly-css/src/_tests_/resolver_tests.rs`: a repository
      package's `@import` selects its `source` target, a third-party package
      with a `source` key keeps its `style` target, a missing `source`
      target fails with the `@import` diagnostic, a `null` target is not
      exported, and the shared table of `exports` cases passes.
- [ ] Add the repository conditions in `crates/mokly-css/src/package.rs`
      and `crates/mokly-css/src/resolver.rs` when the projected manifest
      lies outside every `node_modules` directory.
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
      `cargo test -p mokly-render built_package`, and
      `cargo xtask check --suite repository`.

## Milestone 7: PostCSS reads of the head's copy

The base side fails closed when a PostCSS plugin reported the head's copy
of a changed repository file, or a folder of the working tree. This
milestone waits for decision 2.

- [ ] Add failing tests first beside
      `crates/mokly-render/src/_tests_/postcss_read_inventory_tests.rs`: a
      differing file fails the base side with the milestone 3 diagnostic,
      equal bytes keep the comparison, a reported folder of the working
      tree fails, a file under `node_modules` is ignored, and a tier-two
      base copy does not fire.
- [ ] Add the check where the core takes in the plugin reports,
      `crates/mokly-render/src/postcss_inventory.rs`.
- [ ] Update the Tailwind section of the
      [styles guide](../docs/guides/authoring/styles.md): a repository
      package's stylesheet reaches a side through a relative `@import`, a
      `stylesheets` declaration, or a JavaScript import, not through a
      plugin-inlined `@import`.
- [ ] Run `cargo test -p mokly-render postcss` and
      `cargo xtask check --suite repository`.

## Milestone 8: Changes against a base without build output

One build-level test proves the whole path with a real Git base: a base
commit without `dist` renders a catalogue that imports a built repository
package. This milestone waits for decisions 1 and 2.

- [ ] Add `tests/static_changes_built_packages.test.ts` with the helpers of
      `tests/static_changes_styles.test.ts`. The fixture repository has
      `packages/widget` with TypeScript sources, CSS, `source` targets, and
      `dist` in `.gitignore`. Its configuration is under `catalogue/` and
      sets `repositoryConditions: ["source"]`. Its `node_modules` is a real
      directory with links to the workspace's React packages and to
      `widget`, so that the fixture adds nothing to the workspace
      installation. A screen imports `widget/button` and
      `widget/button.css`. A component declares
      `stylesheets: ["../packages/widget/src/button.css"]`. Commit the base
      without `dist`, then build `dist` in the head.
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

## Milestone 9: UI package source targets

`@mokly/ui` declares `source` targets, so that the design library can import
it by name. This milestone waits for decisions 1 and 4, and decision 5 D
decides whether it stays in this plan.

- [ ] Merge `origin/main` into this branch after the shared UI package PR
      merges, under the `git-merge` skill.
- [ ] `packages/ui/package.json`: each component subpath gets
      `"source": "./src/{name}/{name}.tsx"` as its first key. Each CSS
      subpath becomes
      `{ "source": "./src/{name}/{name}.css", "default": "./dist/{name}/{name}.css" }`.
      `./styles.css` keeps its `dist` target, because the build writes it.
- [ ] Add `src` to `files`, under decision 4.
- [ ] `scripts/release/manifest.mjs` and
      `scripts/release/package_reports.mjs`: `validateUiManifest` requires
      the new target forms, `validateBrowserPackage` accepts the new `files`
      list for `@mokly/ui`, and `validateUiReport` allows `src/`. Update the
      release tests that assert them, such as
      `tests/release_ui_package.test.ts`.
- [ ] Describe the `source` targets in the Development section of
      `packages/ui/README.md`.
- [ ] Update `docs/protocol/mokly-viewer.md` or
      `docs/protocol/npm-release.md` if either states the export targets or
      the published files.
- [ ] Run `npm run build`, the release tests, `npm run package:smoke`, and
      `cargo xtask check --suite repository`.

## Milestone 10: Design library package imports

Tags: mockup

The two design library components that render `@mokly/ui` import it by name
and declare its stylesheets by repository path. The artboards do not
change, so no design step comes first. This milestone comes after the core
milestones, because the mockups render through them. It waits for decision
1, and decision 5 D decides whether it stays in this plan.

- [ ] Set `moduleResolution.repositoryConditions` to `["source"]` in
      `examples/basic/mokly.config.json`.
- [ ] `chrome/appearance-selector.view.tsx` imports
      `@mokly/ui/appearance-selector`, and
      `controls/comparison-toolbar.view.tsx` imports
      `@mokly/ui/comparison-toolbar`, instead of the `packages/ui/src`
      paths.
- [ ] Their registrations declare the package stylesheets by repository
      path, such as
      `../../packages/ui/src/comparison-toolbar/comparison-toolbar.css`,
      through `libraryMetadata` and `style_files.ts`. A local stylesheet
      stays only for its own rules, such as the compact flag of the
      appearance selector, and stops importing the package stylesheets.
- [ ] Delete each local stylesheet that then has no rules. Save the search
      that shows it unused under `.context/built-repository-packages/`.
- [ ] Change the "by its repository path" sentences of
      `docs/protocol/mokly-design-components.md`, the design library
      README, and `AGENTS.md`: the JavaScript names the package, and the
      stylesheets keep their repository paths.
- [ ] Update `tests/design_boundaries.test.ts` and
      `tests/helpers/design_styles.ts` if they read the local stylesheets.
      The design browser specs of both components pass.
- [ ] Mockup check: `npm run build`, then
      `npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`.
- [ ] Smoke test through `npm run dev`: the Shared components pages of both
      components, the Appearance artboards, and the Changes diff-controls
      artboards, in both viewports and both schemes. An edit to
      `packages/ui/src/appearance-selector/appearance-selector.tsx`
      refreshes the pages without a package build.
- [ ] Changes smoke test against a base without `dist`: commit this
      milestone, change the text of the comparison toolbar in
      `packages/ui/src` without a commit, and run the mockup build with
      `--base HEAD`. Changes lists the comparison toolbar. Restore the file.
      Save the output and the screenshots under
      `.context/built-repository-packages/mockups/`.

## Milestone 11: Verification, commit, review, and pull request

- [ ] Remove the status lines that milestone 3 added, because the behaviour
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
