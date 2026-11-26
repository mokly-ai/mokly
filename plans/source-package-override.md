# Source package override

Status: Active. On branch `calummoore/mokly-source-package-override-jkum`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says. The automatic source detection merged into `main`
in #501 on 2026-11-24. Implementation starts when Cal approves this plan.

A comparison renders the head from the working tree and the base from the
base commit's Git files. Git does not hold a package's built files, so a base
cannot load a workspace package whose `exports` point only to them. On
2026-11-24 Cal chose automatic source detection for this, and #501 built it.
Its rule lives in `docs/protocol/mokly-comparison-packages.md`:

1. It applies to a target that a bare package import reaches, inside a
   workspace package, outside `node_modules`. A configured file keeps its
   exact path.
2. The build and source folders come from `outDir` and `rootDir` in the
   package's `tsconfig.json` and its `extends` files. Otherwise a top-level
   `dist`, `lib`, `build` or `out` folder maps to `src`.
3. A file under the build folder maps to the same relative path under the
   source folder. A `.js`, `.mjs` or `.cjs` file tries the configured script
   extensions. Any other file keeps its name. When the build file is missing,
   Mokly recovers the source from the export targets of the subpath, only
   when every target names the same source file.
4. Bundled imports load the first matching source file. A Node-loaded
   `require` keeps an existing built file and loads the source only after
   `MODULE_NOT_FOUND`. When no source matches, the original target stays.

On 2026-11-24 Cal also asked for this change, in its own workspace: a
configuration override, `moduleResolution.sourcePackages`, for what the
convention cannot guess. It does two things for one named workspace package:

- It names the build and source folders, for example `esm/` built from
  `source/` with no `tsconfig` `outDir`.
- It turns the detection off with `false`, for example for a package whose
  build changes its code.

On 2026-11-25 Cal answered the four decisions below:

- Decision 1, E: the base tries its own entry, then the working entry, then
  the detection, file by file.
- Decision 2, B: an entry maps each build folder to its source folder, such
  as `{ "esm": "source", "cjs": "source" }`.
- Decision 3, A: an invalid entry fails with `config-invalid`.
- Decision 4, C: the base failure message names the override, and a warning
  reports each file that the head loads and Git ignores.

This plan does not change the detection rule outside the override, and it does
not build the base. The "Mokly base prepare command" workspace plans that
command, `review.basePrepare`, in `plans/base-prepare-command.md` on the
branch `calummoore/mokly-base-prepare-command-7jlm`.

Design calls, mine, 2026-11-24:

- An entry applies to the workspace package whose `package.json` `name`
  equals the key. The package root is the one that the detection rule finds.
  Each `package.json` that the lookup reads enters the reuse evidence, as the
  detection's reads do. Reason: a name key reads like `aliases`, and it still
  fits after a pull request moves the package folder. It also matches the same
  package on both sides. A directory key, as `packageRoots` uses, would fail
  at load on a typo. Decision 4 covers that gap.
- `false` turns the detection off for that package in the renders that the
  entry reaches. Those renders then load the files that the export names. A
  base has those files only when Git tracks them or when a base prepare
  command builds them. Otherwise each later base fails for that package. The
  guide says this beside the example of `false`.
- The override applies only to repository-owned packages. An installed
  package under `node_modules` ships its built files, and the detection rule
  does not read it.
- An entry for a package that the side does not have has no effect and gives
  no warning. Under decision 1 E, the base can get an entry for a package that
  it does not hold yet.
- Folder values are package-relative POSIX paths, such as `esm` or
  `dist/esm`. Mokly reads `./esm` and `esm/` as `esm`. A source folder can be
  `.`, for sources at the package root. A build folder cannot be `.`, because
  it would then hold every file of the package. When two build folders of one
  entry nest, the longest match wins.
- The two copies of the rule share the case table
  `tests/fixtures/workspace-sources.json`. This change adds its override cases
  to that table, so the sidecar and the Rust CSS resolver cannot drift.
- Serve's kept-base key already hashes the working configuration
  (`crates/mokly-cli/src/serve_base_key.rs`). A changed working entry then
  prepares the base again. No key change is needed.

Design calls, mine, 2026-11-25:

- Each render tries a list of layouts for a package, in order. The base tries
  the base entry, the working entry, and then the detection. The head tries the
  working entry and then the detection. The first layout that gives a source
  file wins. Reason: decision 1 E sets this order for the base. The head uses
  the same order without the base entry, so a file resolves the same way in
  both renders when both configurations agree.
- An entry is one layout. Mokly does not mix its folders with the `tsconfig`
  folders or the convention. Reason: the user reads the whole layout of the
  entry in one place.
- `false` ends the list at its place, and the render keeps the export target.
  So a base with its own `false` keeps its built files, also when the working
  entry has folders. Reason: decision 1 E puts the base's own entry first.
- The list replaces the folder step of the detection rule only. The other
  steps stay: bare package imports only, the extension rule, the recovery of a
  missing build from the export targets, and a Node-loaded `require` that
  keeps an existing built file. Each try enters the reuse evidence.
- The warning of decision 4 has the code `ignored-module`. It covers bundled
  imports and CSS imports. It skips a Node-loaded `require`, because the base
  recovers its source after `MODULE_NOT_FOUND`. It runs only when Changes runs,
  because only a comparison needs the base. It uses the Git listing of tracked
  and unignored files in `crates/mokly-compare/src/working_inputs.rs`, so a new
  file that is not committed yet gives no warning.
- The warning ignores the files that a base prepare command makes. That change
  is not on `main` yet. The change that merges second adds this exception.
- The warning names `moduleResolution.sourcePackages` only when a workspace
  package holds the file. Reason: no entry can fix any other file, and the
  warning still reports every ignored file. Raised by the docs implementor.
- An entry that names one build folder twice after normalisation, such as
  `esm` and `./esm`, fails with `config-invalid`. Reason: decision 3 A covers
  invalid entries, and the configuration already rejects duplicate stylesheet
  `match` values and duplicate watch paths. Raised by the docs implementor.
- `ignored-module` is a configuration warning, as `stylesheet-extglob` is,
  because the fix is in the configuration and no single page causes it. The
  rule lives in the comparison packages page, and the warnings page holds its
  row. Docs implementor's call.
- The exact failure messages live in
  `docs/protocol/mokly-imported-styles-errors.md`, with two new rows for a
  target inside a workspace package.

Contract owners:

- [Configuration](../docs/protocol/mokly-configuration.md), sections
  Validation and Module Resolution.
- [Comparison packages](../docs/protocol/mokly-comparison-packages.md), which
  holds the detection rule.
- [Imported styles](../docs/protocol/mokly-configuration-imported-styles.md),
  for CSS `@import`.
- [Sidecar modules](../docs/protocol/mokly-sidecar-modules.md), which owns
  the lookup records that the `package.json` reads add to.
- [Mockup baselines](../docs/protocol/cloud/mockup-baselines.md), which says
  that the base renders through the base commit's own `mokly.config.json`.
  Decision 1 E changes that sentence.
- [Build warnings](../docs/protocol/mokly-build-warnings.md), for the
  `ignored-module` warning.
- [Imported styles errors](../docs/protocol/mokly-imported-styles-errors.md),
  for the exact failure messages.
- The [configuration guide](../docs/guides/authoring/config.md).
- The [@mokly/mokly README](../packages/mokly/README.md), the
  [sidecar README](../packages/mokly/src/sidecar/README.md), the
  [mokly-catalogue README](../crates/mokly-catalogue/README.md) and the
  [mokly-css README](../crates/mokly-css/README.md).

## Milestone 1: Documentation and protocol

Depends on: none

State the option, its value shape, its validation, the order of layouts in
each render, and the `ignored-module` warning, as decisions 1 to 4 settle
them.

- [x] Merge `origin/main` with the detection change into this branch, as the
      `git-merge` skill says. Update the design calls above where the merged
      rule differs from `plans/source-packages.md` of 2026-11-24.
- [x] Update `docs/protocol/mokly-configuration.md`: the field list, the
      Module Resolution section, and the Validation list under decision 3.
- [x] Update `docs/protocol/mokly-comparison-packages.md`: the order of
      layouts in the folder step of the detection rule, and `false`.
- [x] Update `docs/protocol/mokly-configuration-imported-styles.md` for CSS
      `@import` of an overridden package.
- [x] Update `docs/protocol/mokly-sidecar-modules.md` for the `package.json`
      reads and the tries in the lookup records.
- [x] Update `docs/protocol/cloud/mockup-baselines.md`: the base also reads
      the working `sourcePackages` entries.
- [x] Add the `ignored-module` warning to
      `docs/protocol/mokly-build-warnings.md`, and the override hint to the
      base failure message rule and to
      `docs/protocol/mokly-imported-styles-errors.md`.
- [x] Update `docs/guides/authoring/config.md` with the option, one example
      of each value, the order of layouts, and the note that `false` needs
      built files in the base.

## Milestone 2: Configuration type and validation

Depends on: 1

- [x] Add `sourcePackages` to `ModuleResolution` in
      `crates/mokly-catalogue/src/config_types.rs`, as a map from a package
      name to `false` or to a map from build folder to source folder. Add it
      to `packages/mokly/config.schema.json`, with the key and folder
      patterns, and to the authoring type in
      `packages/mokly/src/authoring/config.ts`.
- [x] Reject invalid entries with `config-invalid` in
      `crates/mokly-catalogue/src/config_validation.rs`: a key that is not a
      bare package name, an empty folder map, a build folder `.`, a folder
      that is empty, absolute, or holds `..` or `node_modules`, and a build
      folder named twice after normalisation. Normalise `./esm` and `esm/` to
      `esm`.
- [x] Add accepted and rejected examples to
      `crates/mokly-catalogue/src/_tests_/config_tests.rs`.

## Milestone 3: Settings for both renders

Depends on: 2

- [x] Add the field to the sidecar's `ModuleResolution` in
      `crates/mokly-sidecar/src/methods.rs` as an ordered list of entry maps,
      and run `cargo xtask generate-types`. Split the file if it passes 300
      lines.
- [x] Fill the list for the head, with the working map, in
      `crates/mokly-render/src/side.rs`. Fill it for the base, with the base
      map and then the working map, in
      `crates/mokly-cli/src/base_dependency_selection.rs`.
- [x] Add the same list to the CSS `Resolution` in
      `crates/mokly-css/src/resolution.rs`, filled in
      `crates/mokly-render/src/stylesheets.rs`.
- [x] Keep the working map beside the base configuration where it loads, in
      `crates/mokly-cli/src/changes_base_sources.rs`, so that a base without a
      sidecar, which still resolves CSS, gets the same list. Add a unit test
      for each order.

## Milestone 4: JavaScript resolution

Depends on: 3

- [x] Try the layouts in order in the folder step of
      `packages/mokly/src/sidecar/workspace-sources.ts` and
      `workspace-lookups.ts`: each entry, then the detection. Apply the same
      order to the recovery of a missing build and to a Node-loaded `require`.
      Record each try in the lookup evidence. Split a file if it passes 300
      lines.
- [x] Add the override cases to `tests/fixtures/workspace-sources.json`:
      other folder names, nested build folders, two build folders, `false`,
      an entry for a missing package, a base entry before a working entry, a
      working entry after a base entry that finds no file, and a missing
      source file.
- [x] Add head and base cases to the sidecar tests, modelled on
      `tests/sidecar_workspace_sources.test.ts`: an `esm/` export from
      `source/`, a CSS import from JavaScript, a Node-loaded `require`, and
      `false`.

## Milestone 5: CSS resolution

Depends on: 3

- [x] Try the same layouts in order in
      `crates/mokly-css/src/workspace_sources.rs`.
- [x] Run the Rust copy of the rule against the shared case table, and add
      resolver cases to `crates/mokly-css/src/_tests_/resolver_tests.rs`.

## Milestone 6: Missing entry messages

Depends on: 4, 5

- [x] Name `moduleResolution.sourcePackages` in the
      `module {path} has no source in this side` message of
      `packages/mokly/src/sidecar/module-paths.ts` when the file is inside a
      workspace package, and in the matching Rust CSS message. Test both.
- [x] Give the `ignored-module` warning when Changes runs and a bundled or CSS
      import of the head loads a repository file outside `node_modules` that
      Git ignores. Name the file and the override in the message. Use the file
      listing in `crates/mokly-compare/src/working_inputs.rs`. Test it in
      `build`, in `build --strict` and in Serve.
- [x] Run `build --strict` over the example catalogue and the cloud mockups.
      Fix or record each new warning.

## Milestone 7: End-to-end test and README files

Depends on: 6

- [x] Add a CLI test with a Git base whose workspace package holds `source/`
      only and whose working tree has a built `esm/`, modelled on
      `crates/mokly-cli/tests/changes_ancestor_tests.rs`. With the entry in
      both configurations, Changes must be available.
- [x] Add the cases of decision 1 to the same test: an entry only in the
      working configuration, a package whose source folder the head renames,
      and a wrong base entry that the working entry corrects.
- [x] Run the example mockup check and the cloud mockup check named in
      `AGENTS.md`. This repository's configuration needs no entry, because
      the detection covers its packages.
- [x] Update `packages/mokly/README.md`,
      `packages/mokly/src/sidecar/README.md`,
      `crates/mokly-catalogue/README.md` and `crates/mokly-css/README.md`
      for the code that this change adds. The READMEs of `mokly-compare`,
      `mokly-sidecar`, `mokly-render`, `mokly-graph`, `mokly-cli` and
      `mokly-source-interface` also name their new entry points.

## Milestone 8: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Decisions

Cal answered each decision on 2026-11-25. An options check of 2026-11-24 added options to
decisions 1, 2 and 3. Its summary is in `.context/source-package-override/`.
It proposed a head warning in decisions 1 and 3. The warning answers a
different question, so it is decision 4 here.

### 1. Which configuration gives the override to the base render?

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-cli/src/changes_base_sources.rs:88-101`.
- **Terms:**
  - **Working configuration:** the `mokly.config.json` of the working tree.
  - **Base configuration:** the same file in the base commit.
- **Background:**
  - The base render loads the base configuration for every setting
    (`crates/mokly-cli/src/changes_base_sources.rs:88-101`). So each side
    resolves with its own aliases, conditions and package roots. A base
    without the file has an empty catalogue.
  - Two settings come from the working configuration: `review.base`
    (`crates/mokly-compare/src/base_render.rs:220-230`) and
    `review.baseInstallScripts` (`crates/mokly-cli/src/options.rs:72-82`).
    Both say how to compare. Neither says what the base holds.
  - Without an entry, the head of a package with an unusual layout loads its
    fresh built files, because CI builds before a capture. So a forgotten
    entry passes its own pull request, when that pull request also adds the
    import. The base of each later pull request then fails.
  - One failed import in the base makes Changes unavailable for the whole
    catalogue. The preview capture then rejects the upload.
  - The detection rule needs no configuration, so this question does not
    exist for the packages that it covers.
- **Problem:** with the rule that each side reads its own configuration, a
  new entry helps only a base that already holds it.
- **Impact if no action:** when the base already imports the package, the
  pull request that adds its entry gets no Changes at all. A pull request
  that adds `false` compares a head that loads built files with a base that
  loads sources, so it can show Changes that it did not make.
- **Root question:** how does each base render get a package layout that fits
  its own files, also when its commit lacks the entry or has a different one?
- **Options:**
  - **A.** Read `sourcePackages` from the working configuration for both
    renders. An old base works at once. A pull request that renames a
    package's source or build folder loses its Changes, because the working
    entry does not fit the base's files. Effort: Small.
  - **B.** Each render reads its own configuration, as every other
    `moduleResolution` field does. No new rule. The gap of the impact stays,
    once for each entry. Effort: Small.
  - **C.** The base uses its own `sourcePackages` when its configuration
    has the field, and the working value otherwise. A base that has the
    field but lacks one package still fails. Effort: Small.
  - **D.** Choose per package. The base uses the base configuration's entry
    when that file names the package, and the working entry otherwise. The
    head reads only the working configuration. Mokly merges the two maps once,
    where the base configuration loads. A working entry can point the base
    only at the base commit's own files inside the package root, so it adds
    no trust risk. A pull request cannot repair a wrong base entry for its own
    base. Effort: Small.
  - **E.** Choose per file. The base tries its own entry, then the working
    entry, then the detection, and loads the first source file that exists. A
    rename keeps its Changes, and a pull request can repair a wrong base
    entry. Both copies of the rule carry the ordered list, each try enters the
    reuse evidence, one package can resolve through two layouts, and a wrong
    entry can hide behind the next one. Effort: Medium.
- **Left out:**
  - A value for one run from the command line, because it fails the goal for
    cloud builds, whose runner passes a fixed argument list.
  - The configuration at the tip of the base ref, such as `origin/main`,
    because the tip also lacks the entry in the pull request that adds it.
  - A head that fails on a file that Git ignores, because that turns a state
    that a warning can report into a build error.
  - The options check's options F and G, which are B and D with a head
    warning. The warning is decision 4.
- **Assumption that all options share:** the remap reads the package files
  of the side that it renders. Source: `docs/protocol/mokly-comparison-packages.md`,
  which says that repository-owned packages come from each side's own
  sources. It stays.
- **Wider fix:** D, because it also covers one missing package entry, which
  C does not.
- **Previous examples:**
  - The same question for the earlier `sourcePackages` plan
    (`plans/source-packages.md`, commit `4b3faa59a` on
    `calummoore/mokly-website-redesign-plan-v2-xnnj`). An options check there
    changed the recommendation from A to D. Cal did not decide it, because the
    detection replaced it. He said that the gap of B is only a first pull
    request problem.
  - Base-side `tsconfig` paths win over working ones, so that working paths
    cannot change historical imports (`docs/protocol/mokly-sidecar-modules.md:94-97`).
    This rule supports B.
- **Related:** decision 1 of `plans/base-prepare-command.md`, on the branch
  `calummoore/mokly-base-prepare-command-7jlm`, asks the same question for
  `review.basePrepare` and recommends the working configuration. Answer the
  two together if you want one rule for both fields. Decision 4: its warning
  makes the gap of B rarer, because the author adds the entry with the
  import.
- **Recommendation:** D, kept. The options check recommended G, which is D
  with the warning of decision 4 option C. D repairs a base that lacks an
  entry, as A does, and it keeps each entry that the base gives, so a renamed
  folder keeps its Changes. B is the simplest rule, and its gap is one pull
  request for each entry, so the margin is small.
- **Action:** ask the user, because D changes the rule that the base reads
  its own configuration, and Cal asked to settle this question.
- **Decision:** Cal chose E on 2026-11-25, over the recommended D. E also
  passes a pull request that corrects a wrong base entry.

### 2. What shape does an entry have?

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-catalogue/src/config_types.rs:53-66`.
- **Background:**
  - The task gave this shape:
    `"sourcePackages": { "@acme/ui": { "dist": "esm", "src": "source" } }`.
    The field names `dist` and `src` name roles, and the values name folders.
    A reader can take `{ "dist": "esm" }` for a rename of `dist`.
  - Some packages build more than one folder from one source folder, for
    example `esm/` and `cjs/` from `source/`. Others build JavaScript and CSS
    into different folders. The configured conditions choose one export
    target, but other exports or a CSS `style` field can reach other folders.
  - Every shape also accepts `false`, which turns the detection off.
- **Problem:** the configuration needs one shape for the folders of a
  package. A public shape is hard to change after users adopt it.
- **Impact if no action:** the configuration type cannot start.
- **Root question:** how does a user state which folders of a package are
  built from which source folders?
- **Options:**
  - **A.** One pair with role names, as in the task:
    `{ "dist": "esm", "src": "source" }`. It cannot state a second build
    folder. Effort: Small.
  - **B.** A map from build folder to source folder:
    `{ "esm": "source", "cjs": "source" }`. The common case is as short as A,
    and several build folders need no new syntax. The keys are folder names,
    so a reader must know the direction. Effort: Small.
  - **C.** One pair whose build value can be a list:
    `{ "dist": ["esm", "cjs"], "src": "source" }`. It keeps the role names and
    allows several build folders with one source folder. It cannot map two
    build folders to two source folders. Effort: Small.
  - **D.** A list of pairs with role names:
    `[{ "build": "esm", "source": "source" }, { "build": "cjs", "source": "source" }]`.
    It states every layout of B, and each pair names its roles. It is the
    longest text, and a repeated build folder needs its own validation rule.
    Effort: Small.
- **Left out:**
  - Glob or path patterns, because the detection rule keeps the relative
    path, and a pattern adds a second mapping language.
  - An entry that points to a `tsconfig` file, because it fails for builds
    that set no TypeScript output folder, such as esbuild, tsup and Vite.
- **Assumption that all options share:** a file keeps its relative path
  under the source folder. Source: the detection rule, and the task, which
  names "other folder names". It stays. A build that renames or joins files
  needs `review.basePrepare`.
- **Wider fix:** None. This is a new shape, not a defect class.
- **Previous examples:** `moduleResolution.aliases`, a map from the name that
  the code imports to the name that Mokly loads. The earlier plan at commit
  `4b3faa59a` used the shape of B: `{ "@mokly/ui": { "dist": "src" } }`.
- **Recommendation:** B. It covers every layout of A, C and D with the
  shortest text, and it reads in the same direction as `aliases`.
- **Action:** ask the user, because the shape is new public configuration,
  and the options trade clear role names against more layouts and less text.
- **Decision:** Cal chose B on 2026-11-25.

### 3. What does Mokly do with an invalid entry?

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-catalogue/src/config_validation.rs:112-125`.
- **Background:**
  - The configuration rules reject each `moduleResolution` value outside the
    Module Resolution rules with `config-invalid`
    (`docs/protocol/mokly-configuration.md:129-130`). An alias key that is not
    a bare package name fails in this way.
  - An invalid entry is a key that is not a bare package name, an empty
    folder map, a build folder `.`, or a folder that is empty, absolute,
    holds `..`, or holds `node_modules`.
  - The always-on rules say to warn and continue on recoverable input. The
    `stylesheet-extglob` warning (`docs/protocol/mokly-configuration.md:90-97`)
    follows that rule for a configuration value.
- **Problem:** the new field needs a rule for invalid values. A rejection is
  a new build error.
- **Impact if no action:** the validation milestone cannot start.
- **Root question:** how does a user learn that the text of an entry cannot
  apply?
- **Options:**
  - **A.** Reject the configuration with `config-invalid`, which names the
    setting and the path, as every other `moduleResolution` value does. The
    schema can carry the same rules, so an editor shows the fault while the
    user types. A typo stops `build` and Serve until it is fixed. Effort:
    Small.
  - **B.** Warn, ignore the invalid entry, and continue, as
    `stylesheet-extglob` does. `--strict` counts the warning. The package
    resolves with the detection rule. The base can fail later with a message
    that does not name the entry. Effort: Small.
- **Left out:**
  - Ignoring the entry with no warning, because the user then cannot learn
    why the entry has no effect.
  - The options check's option C, a warning for an entry that loads no
    source file. It covers valid text, so it is decision 4 option D.
  - Only two distinct approaches exist for invalid text, because Mokly
    either refuses the value or runs without the entry.
- **Wider fix:** None. This is a new rule, not a defect class.
- **Previous examples:** the `config-invalid` rule for every other
  `moduleResolution` value, and the `stylesheet-extglob` warning.
- **Recommendation:** A. It follows the rule in force for every
  `moduleResolution` value, and a folder outside the package root is unsafe,
  not only wrong.
- **Action:** ask the user, because the repository rules reserve each new
  rejection for the user.
- **Decision:** Cal chose A on 2026-11-25.

### 4. How does an author learn of a missing entry?

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/module-paths.ts:229-231`.
- **Background:**
  - When a package's layout needs an entry and the author forgets it, the
    head still loads the fresh built files. The pull request passes. Each
    later base fails, and Changes is unavailable for the whole catalogue.
  - The base failure says `module {path} has no source in this side`. It does
    not name the override.
  - This repository lost every labelled preview from 2026-11-20 to
    2026-11-24 in this way.
  - `crates/mokly-compare/src/working_inputs.rs` already lists the files of
    the working tree that Changes reads.
- **Problem:** nothing tells the author, before the merge, that a later base
  cannot load a file that the head loads.
- **Impact if no action:** a forgotten or misspelled entry shows up only
  after the merge, as lost Changes in each later pull request.
- **Root question:** how does an author learn, before the merge, that a later
  base will not load a file that the head loads?
- **Options:**
  - **A.** Change nothing. The base failure message stays as it is. Effort:
    Small.
  - **B.** Name `moduleResolution.sourcePackages` in the base failure message
    when the file is inside a workspace package. It helps only after the
    merge. Effort: Small.
  - **C.** B, and a warning when Changes runs and the head loads a repository
    file outside `node_modules` that Git ignores. The warning names the file
    and the override. It catches a missing entry, a misspelled key, a wrong
    folder, and every layout that the detection misses. `--strict` counts it,
    as every warning, so a strict build can newly fail. A file that a future
    `review.basePrepare` builds needs an exception. Effort: Medium.
  - **D.** B, and a warning after each head render for each folder entry that
    loaded no source file. It catches a misspelled entry, but not a missing
    one. Both copies of the rule must report the entries that they used.
    Effort: Medium.
- **Left out:** a build error for such a file, because the always-on rules
  say to warn and continue on recoverable input.
- **Assumption that all options share:** Mokly cannot know the layout of a
  package that the detection misses and no entry names. Source: the
  detection plan. It stays.
- **Wider fix:** C, because it reports each way that a head can load a file
  that no base can load, whatever the cause.
- **Previous examples:** the loss of previews since #350, which the detection
  change fixes for this repository.
- **Related:** decision 1. With C, the author adds the entry together with
  the import, so the gap of decision 1 B becomes rare. C also covers packages
  that the detection misses, so it could move to the detection plan.
- **Recommendation:** C. It finds the fault in the pull request that makes
  it, which is the only point before Changes is lost.
- **Action:** ask the user, because C and D add a warning that `--strict`
  counts, and the repository rules reserve each new gate for the user.
- **Decision:** Cal chose C on 2026-11-25.
