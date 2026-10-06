# Move `@mokly/mokly` Into `packages/mokly`

Status: Active. Milestones 1–4 are complete. The final review found
[three findings](../docs/reviews/mokly-workspace-package.md), one High and two
Low; they await the user's decision. Maintainers must merge the pending release
PR #127 before this branch.

Make the CLI package a real npm workspace member at `packages/mokly`, beside
`packages/viewer`. The repository root becomes a private workspace root that
owns the shared toolchain, the repository-wide scripts, the tests, the docs,
and the examples. The published `@mokly/mokly` tarball keeps the same file
layout, the same `bin`, the same exports, and the same shipped guides and
protocol documents. Created 2026-10-05.

## Pre-move Layout

- The root `package.json` is the published `@mokly/mokly` package. It compiles
  `src/` to `dist/`, exposes `bin: ./dist/cli/bin.js`, and ships `dist`,
  `docs/guides`, `docs/protocol`, `README.md`, `CHANGELOG.md`, and `LICENSE`.
- `packages/viewer` is the only workspace member. The root depends on its exact
  version, and `node_modules/@mokly/viewer` is a workspace link.
- `examples/basic`, the 17 test and helper modules with direct imports of
  `@mokly/mokly`, and the synthetic test consumers under `.context/` resolve
  `@mokly/mokly` through Node's package self-reference from the root
  `package.json`.
- 553 test files import the built CLI through relative `../dist/...` or
  `../../dist/...` specifiers. 42 test files and two `scripts/large/*.d.mts`
  declarations import root `src/` sources. Two `scripts/preview/*.d.mts`
  declarations import root `dist/`. 30 test files join
  `repositoryRoot` with `dist/...` or `src/...`.
- `scripts/package/pair.mjs` packs the CLI from the repository root.
  `scripts/package/manifest.mjs` validates the lockfile root entry.
  `scripts/package-check.mjs` and `scripts/package-smoke.mjs` read the root
  manifest. `scripts/release/refs.mjs` reads the CLI manifest from the root.
- `release-please-config.json` and `.release-please-manifest.json` register the
  CLI as package `.`, and `.github/workflows/release.yml` reads the root
  outputs `release_created` and `tag_name`.
- The verification ratchets use `src`, `packages/viewer/src`, and `scripts` as
  source roots and `""` and `packages/viewer` as package roots.
  `xtask/unused-internal-exports.txt` lists one `src/...` path.
- `tests/markdown_links.test.ts` validates every relative link in `docs/**` and
  in every `README.md`. The 18 READMEs under `src/` contain 93 upward links
  to shared docs, the viewer, plans, the public Action, or another source module.
- `tests/helpers/example_baseline.ts` copies the root manifest, lockfile,
  tsconfigs, `scripts/copy-assets.mjs`, `packages/viewer`, and `src` into an
  isolated repository, because derived baselines run `npm ci`, `npm run build`,
  and `npm run example:build` inside a copy of the repository.

## Decisions

1. **Directory name.** The CLI package lives at `packages/mokly`, matching its
   npm name the same way `packages/viewer` matches `@mokly/viewer`.
2. **Root manifest.** The root `package.json` becomes a private workspace root
   named `mokly-workspace` with `"private": true`,
   `workspaces: ["packages/viewer", "packages/mokly"]`, the repository-wide
   scripts, every `devDependencies` entry, `overrides`, `packageManager`, and
   `engines`. Both manifests retain `type: "module"`. The package `package.json` owns `name`, `version`, `description`,
   `license`, `author`, `homepage`, `repository` with
   `directory: "packages/mokly"`, `bugs`, `engines`, `bin`, `exports`, `types`,
   `files`, `publishConfig`, `dependencies`, `peerDependencies`, and the
   package scripts `build`, `typecheck`, and `prepack`. Both manifests declare
   the same `engines.node` range.
3. **Tests stay at the root.** `tests/` keeps every unit, browser, helper, and
   fixture file. Only paths change. Splitting CLI-only tests into
   `packages/mokly/tests` is possible later and is out of scope.
4. **Shipped docs are copied at build time.** The package build copies
   `docs/guides` and `docs/protocol` into `packages/mokly/docs/`. That
   directory is Git-ignored and cleaned by `scripts/clean.mjs`. The tarball
   layout stays identical and `docs/` stays the single source. npm cannot
   include files outside the package directory, `npm pack` excludes symbolic
   links, and moving the shared protocol tree would break the protocol caps,
   the ratchets, and hundreds of links. The copy runs inside `build`, not only
   in `prepack`, because `npm pack --dry-run --ignore-scripts` validation and
   `tests/package.test.ts` need the files before any pack script runs.
5. **Relative test imports are rewritten, not aliased.** Every `../dist/...`
   and `../src/...` specifier in `tests/` and `scripts/` is rewritten to the
   new relative path with a one-off codemod kept under `.context/`. A root
   `imports` alias such as `#mokly/*` would add a second resolution rule for
   the same files and is rejected.
6. **Layout seams.** `tests/helpers/fixture.ts` exports `packageRoot` and
   `cliBinPath`, and `scripts/package/layout.mjs` exports the CLI package path
   and the matching lockfile key. Test files and scripts use those names
   instead of joining `repositoryRoot` with `dist/...` or `src/...`. The seams
   land with the current layout first, so the move changes each definition once.
7. **Release Please.** The CLI package path becomes `packages/mokly` in the
   config and the manifest. `include-component-in-tag` stays `false`, so CLI
   tags stay `vX.Y.Z`. The CLI `extra-files` become root-anchored
   `/docs/guides/start/install.md` and `/docs/guides/ci/github-action.md`. The
   viewer's lockfile `extra-files` JSONPath becomes
   `$['packages']['packages/mokly']['dependencies']['@mokly/viewer']`. Add
   explicit root-lockfile JSON updaters for the CLI's
   `$['packages']['packages/mokly']['version']` and the viewer's
   `$['packages']['packages/viewer']['version']`. Package-local strategies do
   not own the root lockfile, and its existing extra-file updater suppresses
   the workspace plugin's automatic root updater. The
   release workflow reads `packages/mokly--release_created` and
   `packages/mokly--tag_name`. `CHANGELOG.md` moves with the package.
8. **Historical bootstrap stays.** `scripts/release/bootstrap*.mjs`,
   `tests/release_bootstrap*.test.ts`, and `tests/helpers/bootstrap_fixture.ts`
   describe the reviewed 0.8.0 and 0.1.0 commits, where the CLI lived at the
   root. They do not change.
9. **README split.** `README.md` moves to `packages/mokly/README.md` with Git
   history and keeps the user-facing sections: brand header, Why Mokly, Quick
   start, Command line, Authoring, Review and share, Documentation, and
   License. A new root `README.md` is the repository overview: brand header,
   one-paragraph summary, Packages table, Documentation, Develop Mokly with the
   supported Node range and the `.node-version` link, Key code, Plans, and
   License. Tests that assert README sentences follow the sentence.
10. **Historical records stay.** Wording is frozen; relative link targets are
    maintained when files move. In `docs/reviews/*.md`, change only relative
    targets for moved files or moved README sections. Preserve link text and
    every other character. Other historical `plans/*.md` stay unchanged.
    Current docs, READMEs, and protocol documents change.
11. **Ratchet roots.** The source roots become `packages/mokly/src`,
    `packages/mokly/scripts`, `packages/viewer/src`, `packages/viewer/scripts`,
    and `scripts`. Every viewer script is already at or below 200 lines, so the
    wider rule adds no violation. The package roots become `packages/mokly` and
    `packages/viewer`.
12. **CI.** `ci.yml` and `preview.yml` run root npm scripts and `cargo xtask`
    suites and need no path change. Only `release.yml` changes.
13. **Ratchet history follows package moves.** Detect module renames over the
    whole tree before filtering source candidates. Match internal-export
    exceptions by predecessor module and unchanged export name. Resolve each
    released package root at its tag by npm name. Derive current CLI roots
    from the layout module so the move does not reset either export ratchet.

## Target Layout

```text
package.json                     private workspace root
tsconfig.json                    repository-wide typecheck project
tests/                           unchanged location, updated paths
scripts/                         repository-wide verification, package, release
docs/                            single source for guides and protocol docs
packages/viewer/                 @mokly/viewer, unchanged
packages/mokly/
  package.json                   @mokly/mokly
  README.md  CHANGELOG.md  LICENSE
  tsconfig.json  tsconfig.build.json
  scripts/build.mjs              private host modules + docs copy
  src/                           moved from ./src with history
  dist/                          build output, Git-ignored
  docs/guides, docs/protocol     build-time copies, Git-ignored
```

Root scripts after the move:

- `build`: `npm run -s build --workspace @mokly/viewer && npm run -s build --workspace @mokly/mokly && npm rebuild --workspace @mokly/mokly --ignore-scripts`
- `dev`, `example:build`, `example:check`, and `playwright.config.ts` run
  `node packages/mokly/dist/cli/bin.js ...`
- `typecheck:prepared` adds `npm run typecheck --workspace @mokly/mokly`

Package scripts: `build` runs `tsc --project tsconfig.build.json && node scripts/build.mjs`;
`typecheck` runs `tsc --project tsconfig.json --noEmit`; `prepack` runs
`npm run build`. `scripts/build.mjs` fails with a clear message when
`../viewer/dist/index.d.ts` is missing, replaces `docs/` with fresh copies of
`../../docs/guides` and `../../docs/protocol`, and builds the private browser
modules exactly as `scripts/copy-assets.mjs` does today.

## Execution Rules

- Use the Node version in `.node-version` (24.21.0) and npm 11.7.0. The
  workspace already has both versions installed; no toolchain change is needed.
- Move files with `git mv` so history follows `src/`, `CHANGELOG.md`,
  `README.md`, and `scripts/copy-assets.mjs`.
- Never force-add `packages/mokly/dist` or `packages/mokly/docs`.
- Keep the one-off import codemod under `.context/`; do not commit it.
- Record a pre-move `npm pack --dry-run --json` file list under `.context/`
  and compare it with the post-move list; they must be identical.
- Audit deletions against `origin/main` before and after each commit. The only
  expected deletions are the renames listed in Milestone 3 and the root
  `tsconfig.build.json`.

## Merge prerequisites

Maintainers must merge the pending
[release PR #127](https://github.com/mokly-ai/mokly/pull/127) before this branch.
That releases the unreleased root-path changes under the old `.` configuration.
Release Please attributes a non-root package only to commits that change files
under its path, so the move can remove those earlier CLI commits from the
regenerated release PR. If this branch merges first, the next release PR needs
a manual `release-as` and a changelog correction. This is a maintainer action,
not branch implementation work.

## Post-merge follow-up (non-blocking)

- After the first `main` push, confirm the Release Please pull request bumps
  `packages/mokly/package.json`, `packages/mokly/CHANGELOG.md`, the root
  lockfile entries, and the two guide `extra-files`, and that the CLI tag is
  still `vX.Y.Z`.
- Check all three root-lockfile fields in that PR: CLI workspace version,
  viewer workspace version, and the CLI's exact viewer dependency edge.
- After the next publish, confirm the npm provenance statement shows
  `packages/mokly` as the repository directory and that the mokly-cloud guide
  renderer still finds `docs/guides` in the tarball.

## Milestone 1: Define the workspace layout contract (complete)

Update the documentation and protocol documents so they define the complete
target before any file moves. Prose changes only; no link may point at a path
that does not exist yet.

- [x] `docs/protocol/npm-release.md`: in Package Metadata, state that
      `packages/mokly/package.json` describes `@mokly/mokly`, that the root
      manifest is a private workspace root, that the build copies
      `docs/guides` and `docs/protocol` into the package before packing, that
      the lockfile mirrors the package under `packages/mokly` with a
      `node_modules/@mokly/mokly` link, and that Release Please registers the
      package as `packages/mokly` with unchanged `vX.Y.Z` tags.
- [x] `docs/protocol/verification-ratchets.md`: list the five source roots and
      the two package roots from Decision 11.
- [x] `docs/architecture/package-boundary.md`: rename the title "Package And
      Consumer Boundary" to "Workspace Package Boundary" and describe both
      workspace members, the private root, the tests at the root, and the docs
      copy. Update inbound links or tests that name the old headings.
- [x] `plans/README.md`: verify this plan is under Active and keep its status
      current. The plan commit already added the entry.

- [x] Fix other prose-only layout conflicts in `docs/protocol/npm-release-management.md`,
      `docs/protocol/mokly-guides.md`, and `docs/protocol/mokly-package.md`.
      Name the package root exports explicitly in `docs/protocol/mokly-authoring.md`,
      `docs/protocol/mokly-components.md`, `docs/protocol/mokly-pages.md`, and
      `docs/protocol/mokly-viewer-appearance.md`; qualify viewer-relative source
      paths. Add links that need moved files to Milestone 3.
- [x] Search current docs and READMEs for remaining layout conflicts, excluding
      historical review records. Run each test that asserts changed doc text.
- [x] Validate the changed Markdown with `npx prettier --check` and run
      `npm run example:build` before
      `node --import tsx --test tests/markdown_links.test.ts tests/protocol_doc_sizes.test.ts`.
- [x] Commit with Conventional Commits and push the branch.

The approved `main` change later removed the index. The checked index item is
history. The plan's `Status:` paragraph now records its progress.

## Milestone 2: Add layout seams with the current layout (complete)

Introduce the names that the move will redefine, while `src/` and `dist/` stay
at the root. The gate stays green.

- [x] Fix the Milestone 1 boundary finding: restore "Package And Consumer
      Boundary" as the document title. Merge Workspace Layout and Viewer
      Responsibilities into one "Workspace Package Boundary" section at the
      old viewer section position. Check inbound headings and anchors.
- [x] Define rename and package-history rules in
      `docs/protocol/verification-ratchets.md`, within its cap. Update the
      Gate Placement And Evidence test list and the relevant README.
- [x] Add failing ratchet tests before fixing the code. Cover whole-tree
      rename predecessors, moved baseline exceptions, rejected new export
      names and modules, invalid root prefixes, package roots resolved by
      tag-time npm name, and missing name matches.
- [x] Implement the ratchet rules with the current layout: whole-tree rename
      detection before root filtering, predecessor-aware shrink-only baseline
      comparison, five layout-derived source roots, public entrypoints from
      the CLI/viewer manifests, and tag-time package-root resolution.
- [x] Keep the public-export ratchet active during an uncommitted package move.
      Resolve the release-state owner at `HEAD` by package name when its
      current path has no entry. Add a failing regression and define the rule.
- [x] `tests/helpers/fixture.ts`: export `packageRoot` (equal to
      `repositoryRoot` for now) and `cliBinPath`
      (`path.join(packageRoot, "dist/cli/bin.js")`).
- [x] Replace every `path.join(repositoryRoot, "dist/...")` and
      `path.join(repositoryRoot, "src", ...)` in `tests/` with `packageRoot`,
      and every CLI executable path with `cliBinPath`: the 30 files found by
      `grep -rlE 'repositoryRoot, "(dist|src)' tests` plus
      `tests/browser/watched_serve.ts`, `tests/helpers/publish_process.ts`,
      `tests/helpers/publish_pre_installation_cancellation.ts`, and
      `tests/package.test.ts` (`npm pack --dry-run` `cwd`).
- [x] Add `scripts/package/layout.mjs` exporting `CLI_PACKAGE_PATH` (`"."`
      for now), `cliPackageRoot(repositoryRoot)`, and `cliLockKey()` (`""`
      when the path is `"."`, otherwise the path), with a `.d.mts` declaration.
- [x] Test the layout helpers for the root and a package subdirectory. Check
      the declaration with `npm run typecheck:script-declarations`.
- [x] Use the layout module in `scripts/package/pair.mjs`,
      `scripts/package/manifest.mjs` (`validatePackageManifest` repository
      `directory` and `validateLockPair` keys), `scripts/package-check.mjs`,
      `scripts/package-smoke.mjs`, `scripts/release/refs.mjs`,
      `scripts/verification/prepared.mjs`, `scripts/large/setup.mjs`, and
      `scripts/clean.mjs`.
- [x] Use the layout module for the CLI executable in
      `scripts/large/benchmark.mjs` and `scripts/large/cli.mjs`, and for the
      `npm pack` working directory in `scripts/large/toolchain.mjs`.
- [x] Make `validateLockPair` derive CLI lockfile assertions from the layout.
      Preserve root-layout assertions; validate package metadata and the CLI
      workspace link for a subdirectory. Require CLI `repository.directory`
      for that layout. Test both shapes and invalid metadata/link variants.
- [x] Route CLI-manifest reads in tests through `packageRoot`. Keep workspace
      scripts, devDependencies, overrides, and packageManager reads at the
      repository root. Split mixed CLI/workspace reads where needed.
- [x] Split modified tests that exceed 300 lines by responsibility. Keep every
      existing test and assertion. Update the plan's test-file references.
- [x] Update the CLI metadata source in `tests/release_archives.test.ts`
      without changing its historical bootstrap fixture or archived layout.
- [x] Include the layout module in the isolated verification-wrapper harness.
      Derive its prepared CLI path from the layout. Add checked declarations
      for ratchet modules used directly by the regression tests.
- [x] Include the layout module in `tests/large_fixture_stylesheets.test.ts`.
      Derive its compiled CLI path from the layout. Preserve its real compile,
      stylesheet-baseline, and Git assertions.
- [x] Make the unused `browserManifestPath` helper private in
      `packages/viewer/scripts/browser.mjs`. The wider source-root audit found
      that no other module imports it. Keep its behavior unchanged.
- [x] `tests/release_packages.test.ts` and `tests/release_config.test.ts`:
      read the CLI package path from the layout module instead of `"."`.
- [x] Audit source-string readers, isolated package fixtures, and historical
      source links for the move.
      Record the uncovered migration work under Milestone 3. Do not change
      historical review records or start the move in Milestone 2.
- [x] Capture `.context/pack-baseline.json` from
      `npm pack --dry-run --json --ignore-scripts` after `npm run build`.
- [x] Run `cargo xtask check` and fix every failure.
- [x] Commit with Conventional Commits and push the branch.

### Mainline integration notes

- Merge `de9f4fd` integrates `60d4837` from source tip `8b79af5`. Its two
  parents are `8b79af5` and `60d4837`.
- The remerge review covered all 53 imported mainline paths and this plan.
  Every imported path matches `origin/main` exactly at the merge commit.
- Accept main's approved deletion of `plans/README.md`; do not recreate an index.
- Preserve main's agent rules and historical plan status updates unchanged.
- Preserve main's `plans/` links in the root README, example README, viewer
  client README, and CLI export and publish READMEs.
- Resolve this plan's stash conflict by keeping the new status and integration
  notes plus all completed Milestone 2 tasks. Milestone 1 stays closed.
- The complete gate passed: 15 Rust tests, six packed-consumer scenarios,
  4,231 unit/integration tests, 844 browser tests, and 263 hydration tests.
  The pre-move pack baseline contains 2,104 unique file paths.
- The first merged gate found one missing layout dependency in the isolated
  large-fixture harness. Add that dependency without changing its assertions.
  Its five focused tests and the subsequent complete gate passed.

## Milestone 3: Move the CLI package into `packages/mokly` (complete)

Perform the move and every path update in one commit so the gate never breaks.

- [x] Integrate main's `781da7a` output-lock fix before moving files. Preserve
      all 12 upstream paths and the approved replacement of the old directory
      walk test. Review the two-parent merge and its remerge diff.
- [x] After the current complete gate finishes, add explicit root-lockfile JSON
      version updaters for both package roots. Test a simulated real release
      update across all three lockfile fields and prove failure without the
      version updaters. Update release tests, protocol rationale, Decision 7,
      and the post-merge check. Run the complete repository, package, and unit
      suites after the batch. Record that the pre-batch complete gate covers
      browser and hydration. Record this split in the commit body.
- [x] After the current complete gate finishes, fix root-run CLI commands in
      the example and large-fixture READMEs. Update the example's CLI source
      path wording. Audit all non-historical Markdown commands once more.
- [x] Restore the local CLI executable link after the workspace build. npm
      skips a missing compiled bin during clean install. Add a failing isolated
      install/build regression before changing the root build script.
- [x] Make `source-roots.mjs` duplicate-free in both CLI layouts. Test both
      shapes. State the current `packages/mokly` path in the ratchet protocol
      and xtask README after the flip.
- [x] Scope the codemod by resolved path: change only specifiers that resolve
      into the root `src/` or `dist/`. Preserve viewer-local and example-local
      paths. Include large/preview `.d.mts` files and check all repository
      relative specifiers with an ignored `.context/` script.
- [x] After the running gate finishes, restore the unnecessary trailing-slash
      edit in `client_modules.ts`. Confirm every moved production TS/JS source
      matches its pre-move bytes, then rebuild and run the browser-module tests.
- [x] Remove the ignored pre-move root `dist/` after the running gate finishes.
      Recheck relative specifiers with both old root directories absent. Keep
      the saved pack baseline and use only the workspace build outputs.
- [x] Fix raw source-path readers and emitted subprocess import strings in
      tests. Keep preview fixtures at the current CLI package path. Update
      isolated ratchet fixtures to use the current source and package roots.
      Preserve every failed assertion. The complete gate TODO below covers
      the required rerun.
- [x] Update the viewer boundary test's CLI browser-output directory. Preserve
      its viewer-owned source imports and viewer browser-output path.
- [x] Split every changed TS/JS file above 300 lines by responsibility. Keep
      all tests and assertions, including the guide-CI and browser-preview
      fixtures. Audit all moved source files too.
- [x] Give inferred fixture results explicit portable return types. Workspace
      resolution exposed private CLI types through the npm link; preserve the
      declaration checks and each fixture's complete typed result.
- [x] Preserve package README links to shared source docs with `../../docs/`.
      Check brand-header HTML links by hand. Retarget the example README's
      Review and share anchor. Preserve main's root `./plans/` link.
- [x] Save the old lockfile under `.context/`. Use npm 11.7.0 and compare every
      installed entry's version, resolution, and integrity after install.
      Explain relocations. Prove a clean `npm ci` and build, then run the
      dependency audit. Stop before editing any moved audit-exception path.
- [x] After the running full gate finishes, restore all 22 mainline `libc`
      fields. Build the lockfile from `HEAD` with only the workspace name/root,
      CLI package entry, and CLI link changes. Prove a clean install and copied
      lock-only regeneration, then rerun the repository and package suites.
- [x] Reproduce the six optional bundled WASI additions from npm 11.7.0 on
      both the pre-move and moved lockfiles. Follow the reviewer's decision:
      retain the minimal lockfile and report this pre-existing regeneration
      churn without committing the six entries.
- [x] Remove the inherited CLI version from the private root's lockfile
      metadata before regenerating. npm 11.7.0 kept that old value when the
      manifest lost its version. Keep installed dependency tuples unchanged.
- [x] Assert the private root manifest has both workspace members in order
      and no CLI-only keys or version. Assert root/CLI Node-engine parity.
- [x] Test docs-copy replacement, the viewer-built guard, and cleanup of the
      CLI build output and copied docs.
- [x] Use bracket syntax for CLI Release Please action outputs. Preserve job
      output names and cover every workflow/config assertion.
- [x] Document path-based Release Please commit attribution and docs-only
      shipment behavior. Record the release PR #127 merge prerequisite outside
      the milestones without changing the target release configuration.
- [x] Restore all moved README material with its original wording and moved
      paths. Compare every rewritten Markdown file with its HEAD source;
      preserve sentences apart from obsolete root-layout descriptions.
- [x] Update plain code paths and root-run CLI examples in moved source
      READMEs. The Markdown link codemod does not cover inline code or shell
      examples. Preserve all surrounding wording.
- [x] Keep historical review wording byte-identical apart from approved
      relative link targets. Record each file's changed-target count.
- [x] Confirm all four ratchets pass on the uncommitted and committed moved
      trees. Keep the renamed internal-export baseline shrink-only.
- [x] `git mv src packages/mokly/src`, `git mv CHANGELOG.md packages/mokly/CHANGELOG.md`,
      `git mv README.md packages/mokly/README.md`,
      `git mv scripts/copy-assets.mjs packages/mokly/scripts/build.mjs`, and
      copy `LICENSE` to `packages/mokly/LICENSE`.
- [x] Split `package.json` per Decision 2; write `packages/mokly/package.json`.
- [x] Add `packages/mokly/tsconfig.json` (extends `../../tsconfig.json`,
      includes `src/**`) and `packages/mokly/tsconfig.build.json` (`rootDir`
      `src`, `outDir` `dist`, declarations and source maps, excludes tests);
      delete the root `tsconfig.build.json`; replace `src/**` with
      `packages/mokly/src/**` in the root `tsconfig.json`.
- [x] Finish `packages/mokly/scripts/build.mjs` per Target Layout, including
      the viewer-built guard and the docs copy.
- [x] Update the root scripts per Target Layout, `playwright.config.ts`,
      `scripts/clean.mjs`, `.gitignore` (`packages/mokly/docs/`),
      `.prettierignore` (`packages/mokly/CHANGELOG.md`, `packages/mokly/docs`),
      and `eslint.config.js` path globs.
- [x] Run `npm install` to regenerate `package-lock.json`; confirm
      `node_modules/@mokly/mokly` is a workspace link and that `examples/basic`
      still resolves `@mokly/mokly`.
- [x] Flip `scripts/package/layout.mjs` to `"packages/mokly"` and
      `tests/helpers/fixture.ts` `packageRoot` to `packages/mokly`.
- [x] Codemod every relative `dist/` and `src/` specifier in `tests/**`,
      `scripts/large/**`, `scripts/preview/**`, and
      `scripts/package/browser_graph.mjs` to the new relative path; verify
      with `tsc --project tsconfig.json --noEmit`, `npm run typecheck:script-declarations`,
      and `npm run lint`.
- [x] Update the mixed reader in `tests/guides_ci.test.ts`: resolve its raw
      `src/...` strings from `packageRoot` and docs from `repositoryRoot`.
      Split that oversized test file by responsibility without removing tests.
- [x] Give `tests/release_refs.test.ts` a fixture for the current CLI layout.
      It now reuses the root-layout bootstrap fixture, while `verifyReleaseRefs`
      follows the layout module. Keep the protected bootstrap files unchanged.
- [x] Resolve the historical-review link contract with the coordinating
      reviewer: maintain only relative targets for moved files and sections,
      freeze all other bytes, and keep the link test unchanged.
- [x] Confirm the layout flip updates both source-root and public-entrypoint
      ratchet roots. Update the path in `xtask/unused-internal-exports.txt`.
- [x] Update `release-please-config.json`, `.release-please-manifest.json`, and
      `.github/workflows/release.yml` per Decision 7.
- [x] Update `tests/release_config.test.ts` (package manifest location,
      `repository.directory`, lockfile keys, config keys and `extra-files`),
      `tests/release_packages.test.ts` (lockfile fixture entries), and
      `tests/ci_workflow_runtime.test.ts` (root and package `engines` parity, root
      README sentences).
- [x] Update `tests/helpers/example_baseline.ts` to copy `package.json`,
      `package-lock.json`, `tsconfig.json`, `docs/guides`, `docs/protocol`,
      `packages/viewer`, and `packages/mokly` while excluding `dist`,
      `node_modules`, and the copied `packages/mokly/docs`.
- [x] Update `tests/component_protocol_docs.test.ts` to read the moved README
      sentence from `packages/mokly/README.md`.
- [x] Confirm `tests/guides_versions.test.ts` reads the moved CLI version
      through `packageRoot`. The private root will not own that version.
- [x] Write the new root `README.md` and trim `packages/mokly/README.md` per
      Decision 9; update the Packages table link and every Key code link.
- [x] Fix the 93 upward links in the READMEs under `packages/mokly/src/` and
      the links or prose in `docs/architecture/build-pipeline.md`,
      `docs/architecture/package-boundary.md`,
      `docs/protocol/mokly-instances.md`,
      `docs/protocol/mokly-export-public-files.md`, `xtask/README.md`, and
      `docs/protocol/npm-release.md`.
- [x] Update the CLI Browse README links in
      `packages/viewer/src/client/README.md` and
      `packages/viewer/src/inspector/README.md` after the move. Both currently
      link to `../../../../src/browse/README.md`; the new target is
      `../../../../packages/mokly/src/browse/README.md`.
- [x] Confirm the public export ratchet still resolves the `v0.13.0` baseline
      tag for `packages/mokly`.
- [x] Compare `npm pack --dry-run --json --ignore-scripts` from
      `packages/mokly` with `.context/pack-baseline.json`; the file lists must
      match.
- [x] Smoke-test: `npm run build`, `npm run example:build`,
      `npm run example:check`, `npm run dev` with a page fetch, `mokly export`
      on the example, and install the packed tarball into a temporary consumer
      and run `npx mokly --version`.
- [x] Keep the 2,500-ms PostCSS collection limit. Run
      `tests/postcss_dependency_review.test.ts` three times in sequence with
      no other task running. Compare with the pre-move tree if any run fails.
      Then rerun the complete unit suite alone and record the timings.
- [x] Run `cargo xtask check` and fix every failure. Use the approved split:
      the complete gate before the final batch, followed by complete repository,
      package, and unit suites on the final implementation tree.
- [x] Audit `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`; only the Milestone 3
      renames and the root `tsconfig.build.json` may be deleted.
- [x] Commit with Conventional Commits and push the branch.

### Milestone 3 integration notes

- Merge `a716e2099d2ae2058111c47be477f5947eb4ad5a` integrates main's
  `781da7ae3261e6694a5ef5608a91f3e34061f6d0` from source tip
  `5309791d4e2d73983b57a471345e354b822599cf`. Those tips are its two parents.
  The remerge diff is empty for all 12 imported paths.
- Preserve `docs/protocol/mokly-baseline-storage.md` and
  `docs/protocol/mokly-rendering-generated.md` exactly. Move
  `src/baseline/confinement.ts` and `src/build/output_lock_file.ts` unchanged.
  Preserve every sentence in `src/build/README.md`; update only moved paths.
- Preserve the imported tests and assertions in `tests/derived_build.test.ts`,
  `tests/derived_cache_boundaries.test.ts`, `tests/export_current_derived.test.ts`,
  `tests/generated_output_lock.test.ts`, `tests/path_transaction_regressions.test.ts`,
  and `tests/helpers/output_directory_lock_spy.ts`. Update their CLI imports and
  portable fixture result types. Keep main's approved deletion of
  `tests/baseline_directory_walk.test.ts`; its replacement tests remain.
- Correct the pre-move survey: 17 test/helper modules have direct CLI package
  imports. There are 42 root-source importers, two large source declarations,
  and two preview built declarations. The 18 source READMEs have 93 upward
  links, including the public Action and one unchanged internal source link.
- Scope the codemod by resolved targets. Its required edits cover 1,959
  specifiers in 605 files. Remove its one unnecessary trailing-slash edit in
  `client_modules.ts`; all 484 moved production TS/JS files retain their
  original bytes. Viewer-local and example-local imports remain unchanged.
- Retain `type: "module"` in both manifests. Remove the inherited private-root
  lockfile version before regenerating; npm retained it after the manifest split.
  Existing dependency versions, resolutions, and integrity values stay unchanged.
- Extend the planned root build with an npm rebuild that relinks the compiled
  CLI. A clean install skips a missing bin; the new regression failed before
  this fix and passed after it. The rebuild does not run lifecycle scripts.
- Restore all 22 `libc` fields that npm 11.7.0 removed. Every old installed
  entry retains all metadata, beyond its version/resolution/integrity tuple.
  A clean install passes. Lock-only regeneration also adds six optional bundled
  entries below `node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/` on
  the pre-move tree. The reviewer approved reporting that pre-existing churn
  and keeping it out of this move's minimal lockfile.
- The first full gate passed repository/package checks, then failed 13 unit
  tests on old path readers and ratchet fixture roots. Fix the paths and
  preserve every assertion. Remove the stale ignored root `dist/` so it cannot
  hide old subprocess imports. The focused failure tests pass 53/53.
- Split the now-changed 301-line `tests/repository_ratchets.test.ts` into
  length/protocol and internal-export tests. Keep all 13 original test definitions.
- The next full gate passed 4,235/4,236 unit tests. Its sole failure exposed
  the viewer boundary test's raw CLI browser path after root `dist/` removal.
  Update only that cross-package directory; its viewer-owned imports and viewer
  browser directory stay unchanged.
- The complete gate then passed before the final review batch: 15 Rust tests,
  six packed-consumer scenarios, 4,236 unit/integration tests, 844 browser tests,
  and 263 hydration tests. No tests were skipped or cancelled. Save its three
  suite reports under `.context/pre-batch-reports/`.
- The final batch adds two explicit root-lockfile version updaters beside the
  viewer-edge updater, a release simulation regression, the corrected updater
  rationale, and two README command paths. The positive regression fails with
  the old configuration and passes with all three JSON updaters. Its negative
  cases reject each missing version updater separately.
- Verification uses the approved split. The complete repository suite passes
  after the final batch, including all 15 Rust tests. The complete package suite
  passes all six packed-consumer scenarios. The final complete unit suite
  passes all 4,240 tests, with no skips or cancellations. The passing pre-batch
  browser and hydration suites cover those unchanged areas. The commit body
  records this split. The focused release, Markdown-link, and protocol-size
  batch also passes all 59 tests; `npm run package:check` passes.
- The first post-batch unit run passed 4,239/4,240 tests. Its only failure was
  the unchanged PostCSS collection limit: 2,702.6 ms exceeded 2,500 ms while
  tarball installs ran on the machine. Keep the limit. Three fresh isolated
  runs pass at 1,899.5 ms, 1,621.7 ms, and 1,514.2 ms. No pre-move comparison
  is needed because none fails. The final unit suite runs alone and measures
  1,866.8 ms. The passing pre-batch complete gate measured 1,418.3 ms.
- Preserve all original README material across the root/package split. The
  Markdown audit checks 45 moved or rewritten documents against their source
  at the pre-move `HEAD`. Historical reviews retain every non-target character.
- The final relative-specifier check covers 8,976 specifiers with both old
  root directories absent. All 46 changed Markdown files pass formatting.
- The pre-staging deletion audit lists only `tsconfig.build.json`, replaced
  by the identical package build project. Once every new file is staged,
  Git identifies that replacement as a 100% rename. No deleted paths remain
  in the staged diff against `origin/main`.
- Commit `b20dc761a403ade78a76fa267914fdae45379aca` contains the complete
  atomic move and final review fixes. The push succeeds, and the remote tip
  matches that commit. Before and after the commit, the staged/committed
  deletion audit is empty. All four ratchets pass on both trees: 526 changed
  source modules, 124 protocol documents with 10 caps, 927 internal-export
  modules with one retained exception, and both unchanged public baseline tags.
  This separate documentation commit records completion after the push.

## Milestone 4: Review the complete diff (complete)

- [x] After the push, review the complete local diff against `origin/main`
      with [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
      Report numbered findings with severity, impact, lettered options, and a
      recommendation. Do not change the implementation.
- [x] Record the findings in
      [`docs/reviews/mokly-workspace-package.md`](../docs/reviews/mokly-workspace-package.md).
      The review covered `b20dc76` and `81086d8` against `origin/main` at
      `781da7a`.
