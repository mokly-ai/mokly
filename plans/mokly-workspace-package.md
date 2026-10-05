# Move `@mokly/mokly` Into `packages/mokly`

Make the CLI package a real npm workspace member at `packages/mokly`, beside
`packages/viewer`. The repository root becomes a private workspace root that
owns the shared toolchain, the repository-wide scripts, the tests, the docs,
and the examples. The published `@mokly/mokly` tarball keeps the same file
layout, the same `bin`, the same exports, and the same shipped guides and
protocol documents. Created 2026-10-05.

## Current Layout

- The root `package.json` is the published `@mokly/mokly` package. It compiles
  `src/` to `dist/`, exposes `bin: ./dist/cli/bin.js`, and ships `dist`,
  `docs/guides`, `docs/protocol`, `README.md`, `CHANGELOG.md`, and `LICENSE`.
- `packages/viewer` is the only workspace member. The root depends on its exact
  version, and `node_modules/@mokly/viewer` is a workspace link.
- `examples/basic`, the 89 tests that import `@mokly/mokly`, and the synthetic
  test consumers under `.context/` resolve `@mokly/mokly` through Node's
  package self-reference from the root `package.json`.
- 553 test files import the built CLI through relative `../dist/...` or
  `../../dist/...` specifiers. 43 test files and three `scripts/large/*.d.mts`
  declarations import `../src/...` sources. 30 test files join
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
  in every `README.md`. The 18 READMEs under `src/` contain 93 links that
  climb two levels to `docs/`, `packages/viewer/`, or `plans/`.
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
   `engines`. The package `package.json` owns `name`, `version`, `description`,
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
   `$['packages']['packages/mokly']['dependencies']['@mokly/viewer']`. The
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
10. **Historical records stay.** Path mentions inside `plans/*.md` other than
    this plan, `plans/README.md`, and `docs/reviews/*.md` are dated records and
    stay unchanged. Current docs, READMEs, and protocol documents change.
11. **Ratchet roots.** The source roots become `packages/mokly/src`,
    `packages/mokly/scripts`, `packages/viewer/src`, `packages/viewer/scripts`,
    and `scripts`. Every viewer script is already at or below 200 lines, so the
    wider rule adds no violation. The package roots become `packages/mokly` and
    `packages/viewer`.
12. **CI.** `ci.yml` and `preview.yml` run root npm scripts and `cargo xtask`
    suites and need no path change. Only `release.yml` changes.

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

- `build`: `npm run -s build --workspace @mokly/viewer && npm run -s build --workspace @mokly/mokly`
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

## Post-merge follow-up (non-blocking)

- After the first `main` push, confirm the Release Please pull request bumps
  `packages/mokly/package.json`, `packages/mokly/CHANGELOG.md`, the root
  lockfile entries, and the two guide `extra-files`, and that the CLI tag is
  still `vX.Y.Z`.
- After the next publish, confirm the npm provenance statement shows
  `packages/mokly` as the repository directory and that the mokly-cloud guide
  renderer still finds `docs/guides` in the tarball.

## Milestone 1: Define the workspace layout contract

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
- [ ] Commit with Conventional Commits and push the branch.

## Milestone 2: Add layout seams with the current layout

Introduce the names that the move will redefine, while `src/` and `dist/` stay
at the root. The gate stays green.

- [ ] `tests/helpers/fixture.ts`: export `packageRoot` (equal to
      `repositoryRoot` for now) and `cliBinPath`
      (`path.join(packageRoot, "dist/cli/bin.js")`).
- [ ] Replace every `path.join(repositoryRoot, "dist/...")` and
      `path.join(repositoryRoot, "src", ...)` in `tests/` with `packageRoot`,
      and every CLI executable path with `cliBinPath`: the 30 files found by
      `grep -rlE 'repositoryRoot, "(dist|src)' tests` plus
      `tests/browser/watched_serve.ts`, `tests/helpers/publish_process.ts`,
      `tests/helpers/publish_pre_installation_cancellation.ts`, and
      `tests/package.test.ts` (`npm pack --dry-run` `cwd`).
- [ ] Add `scripts/package/layout.mjs` exporting `CLI_PACKAGE_PATH` (`"."`
      for now), `cliPackageRoot(repositoryRoot)`, and `cliLockKey()` (`""`
      when the path is `"."`, otherwise the path), with a `.d.mts` declaration.
- [ ] Use the layout module in `scripts/package/pair.mjs`,
      `scripts/package/manifest.mjs` (`validatePackageManifest` repository
      `directory` and `validateLockPair` keys), `scripts/package-check.mjs`,
      `scripts/package-smoke.mjs`, `scripts/release/refs.mjs`,
      `scripts/verification/prepared.mjs`, `scripts/large/setup.mjs`, and
      `scripts/clean.mjs`.
- [ ] `tests/release_packages.test.ts` and `tests/release_config.test.ts`:
      read the CLI package path from the layout module instead of `"."`.
- [ ] Capture `.context/pack-baseline.json` from
      `npm pack --dry-run --json --ignore-scripts` after `npm run build`.
- [ ] Run `cargo xtask check` and fix every failure.
- [ ] Commit with Conventional Commits and push the branch.

## Milestone 3: Move the CLI package into `packages/mokly`

Perform the move and every path update in one commit so the gate never breaks.

- [ ] `git mv src packages/mokly/src`, `git mv CHANGELOG.md packages/mokly/CHANGELOG.md`,
      `git mv README.md packages/mokly/README.md`,
      `git mv scripts/copy-assets.mjs packages/mokly/scripts/build.mjs`, and
      copy `LICENSE` to `packages/mokly/LICENSE`.
- [ ] Split `package.json` per Decision 2; write `packages/mokly/package.json`.
- [ ] Add `packages/mokly/tsconfig.json` (extends `../../tsconfig.json`,
      includes `src/**`) and `packages/mokly/tsconfig.build.json` (`rootDir`
      `src`, `outDir` `dist`, declarations and source maps, excludes tests);
      delete the root `tsconfig.build.json`; replace `src/**` with
      `packages/mokly/src/**` in the root `tsconfig.json`.
- [ ] Finish `packages/mokly/scripts/build.mjs` per Target Layout, including
      the viewer-built guard and the docs copy.
- [ ] Update the root scripts per Target Layout, `playwright.config.ts`,
      `scripts/clean.mjs`, `.gitignore` (`packages/mokly/docs/`),
      `.prettierignore` (`packages/mokly/CHANGELOG.md`, `packages/mokly/docs`),
      and `eslint.config.js` path globs.
- [ ] Run `npm install` to regenerate `package-lock.json`; confirm
      `node_modules/@mokly/mokly` is a workspace link and that `examples/basic`
      still resolves `@mokly/mokly`.
- [ ] Flip `scripts/package/layout.mjs` to `"packages/mokly"` and
      `tests/helpers/fixture.ts` `packageRoot` to `packages/mokly`.
- [ ] Codemod every relative `dist/` and `src/` specifier in `tests/**`,
      `scripts/large/**`, `scripts/preview/**`, and
      `scripts/package/browser_graph.mjs` to the new relative path; verify
      with `tsc --project tsconfig.json --noEmit`, `npm run typecheck:script-declarations`,
      and `npm run lint`.
- [ ] Update the ratchet roots in `scripts/verification/ratchets/internal-exports.mjs`
      and `scripts/verification/ratchets/typescript-length.mjs`, and the path
      in `xtask/unused-internal-exports.txt`.
- [ ] Update `release-please-config.json`, `.release-please-manifest.json`, and
      `.github/workflows/release.yml` per Decision 7.
- [ ] Update `tests/release_config.test.ts` (package manifest location,
      `repository.directory`, lockfile keys, config keys and `extra-files`),
      `tests/release_packages.test.ts` (lockfile fixture entries), and
      `tests/ci_workflow.test.ts` (root and package `engines` parity, root
      README sentences).
- [ ] Update `tests/helpers/example_baseline.ts` to copy `package.json`,
      `package-lock.json`, `tsconfig.json`, `docs/guides`, `docs/protocol`,
      `packages/viewer`, and `packages/mokly` while excluding `dist`,
      `node_modules`, and the copied `packages/mokly/docs`.
- [ ] Update `tests/component_protocol_docs.test.ts` to read the moved README
      sentence from `packages/mokly/README.md`.
- [ ] Update `tests/guides_versions.test.ts` to read the CLI version from
      `packages/mokly/package.json`. The private root will not own that version.
- [ ] Write the new root `README.md` and trim `packages/mokly/README.md` per
      Decision 9; update the Packages table link and every Key code link.
- [ ] Fix the 93 upward links in the READMEs under `packages/mokly/src/` and
      the links or prose in `docs/architecture/build-pipeline.md`,
      `docs/architecture/package-boundary.md`,
      `docs/protocol/mokly-instances.md`,
      `docs/protocol/mokly-export-public-files.md`, `xtask/README.md`, and
      `docs/protocol/npm-release.md`.
- [ ] Update the CLI Browse README links in
      `packages/viewer/src/client/README.md` and
      `packages/viewer/src/inspector/README.md` after the move. Both currently
      link to `../../../../src/browse/README.md`; the new target is
      `../../../../packages/mokly/src/browse/README.md`.
- [ ] Confirm the public export ratchet still resolves the `v0.13.0` baseline
      tag for `packages/mokly`.
- [ ] Compare `npm pack --dry-run --json --ignore-scripts` from
      `packages/mokly` with `.context/pack-baseline.json`; the file lists must
      match.
- [ ] Smoke-test: `npm run build`, `npm run example:build`,
      `npm run example:check`, `npm run dev` with a page fetch, `mokly export`
      on the example, and install the packed tarball into a temporary consumer
      and run `npx mokly --version`.
- [ ] Run `cargo xtask check` and fix every failure.
- [ ] Audit `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`; only the Milestone 3
      renames and the root `tsconfig.build.json` may be deleted.
- [ ] Commit with Conventional Commits and push the branch.

## Milestone 4: Review the complete diff

- [ ] After the push, review the complete local diff against `origin/main`
      with [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
      Report numbered findings with severity, impact, lettered options, and a
      recommendation. Do not change the implementation.
