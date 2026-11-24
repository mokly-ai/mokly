# Source packages in module resolution

Status: Active. On branch `calummoore/mokly-website-redesign-plan-v2-xnnj`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says.

A comparison renders the head from the working tree and the base from the
base commit's Git files. A catalogue that imports a repository-owned package
whose `exports` point only to built files under `dist` cannot render its base,
because Git does not hold `dist`. Mokly then publishes without Changes. This
repository's cloud mockup catalogue hits this: it imports `@mokly/ui` and
`@mokly/viewer` by name, every base render fails with
`Could not resolve "@mokly/ui/..."`, and the preview capture rejects each
upload without a comparison, so no pull request can deploy a preview. The
failure exists since #350 (2026-11-20).

On 2026-11-24 Cal chose a new configuration option,
`moduleResolution.sourcePackages`, over four other ways: publishing a
`mokly-source` export condition with the package sources, stripping that
condition at release, mapping 59 TypeScript `paths` in at least six
`tsconfig` files, and a base build command. The option names each
repository-owned package whose `dist` mirrors its `src`, for example
`{ "@mokly/ui": { "dist": "src" } }`. Mokly then loads
`packages/ui/src/top-bar/top-bar.tsx` where the export names
`dist/top-bar/top-bar.js`. It runs no code. Cal also chose on 2026-11-24 to
plan the base build command, `review.basePrepare`, in a separate top-level
workspace, "Mokly base prepare command". A probe on 2026-11-24 proved that
loading the package sources makes this repository's base render pass, with
the Changes comparison.

Design calls, mine, 2026-11-24:

- The remap applies in both renders, so the head and the base load the same
  kind of file. The head then no longer depends on a fresh `dist`.
- A configured built file maps to the source file with the same relative
  path. A `.js`, `.mjs` or `.cjs` file tries the configured resolve
  extensions. Any other file, such as `.css`, keeps its name.
- A configured built file without a source file fails like any other missing
  side file, with `module {path} has no source in this side`. Mokly does not
  fall back to `dist`, because the base never has it.
- Each probed source path enters the reuse evidence, as the package lookup
  probes do.
- The keys are bare package names. Each value holds exactly one built
  directory and one source directory, both relative to the package root,
  without `..` or an absolute path.

Contract owners:

- [Configuration](../docs/protocol/mokly-configuration.md), section Module
  Resolution.
- [Sidecar modules](../docs/protocol/mokly-sidecar-modules.md).
- [Base dependencies](../docs/protocol/mokly-base-dependencies.md), which says
  that the base keeps its own module resolution settings.
- [Imported styles](../docs/protocol/mokly-configuration-imported-styles.md),
  for CSS `@import`.
- The [configuration guide](../docs/guides/authoring/config.md).
- The [@mokly/mokly README](../packages/mokly/README.md), the
  [mokly-catalogue README](../crates/mokly-catalogue/README.md), the
  [mokly-sidecar README](../crates/mokly-sidecar/README.md) and the
  [mokly-css README](../crates/mokly-css/README.md).

## Milestone 1: Documentation and protocol

Depends on: none

State the option, its validation, the remap rule and which configuration
each render reads, as decision 1 settles it.

- [ ] Update `docs/protocol/mokly-configuration.md`: the field list and the
      Module Resolution section.
- [ ] Update `docs/protocol/mokly-sidecar-modules.md`: where the remap runs
      among the workspace mapping, tsconfig paths and package lookup, and its
      reuse evidence.
- [ ] Update `docs/protocol/mokly-base-dependencies.md` with the rule of
      decision 1, beside its rule that the base keeps its own module
      resolution settings.
- [ ] Update `docs/protocol/mokly-configuration-imported-styles.md` for CSS
      `@import` of a source package.
- [ ] Update `docs/guides/authoring/config.md` with the option and one
      example.

## Milestone 2: Configuration

Depends on: 1

- [ ] Add `sourcePackages` to `packages/mokly/config.schema.json`, to
      `ModuleResolution` in `crates/mokly-catalogue/src/config_types.rs`,
      and to the authoring type in `packages/mokly/src/authoring/config.ts`.
- [ ] Add accepted and rejected examples to
      `crates/mokly-catalogue/src/_tests_/config_tests.rs`.
- [ ] Pass the option to the sidecar's `ModuleResolution` in
      `crates/mokly-sidecar/src/methods.rs`, from the head in
      `crates/mokly-render/src/side.rs` and from the base in
      `crates/mokly-cli/src/base_dependency_selection.rs`, as decision 1
      says. Apply decision 1 where the base configuration loads
      (`crates/mokly-cli/src/changes_base_sources.rs`), so that an HTML-only
      base, which has no sidecar side, gets the same value. Run `cargo xtask generate-types`. Split `methods.rs` if it
      passes 300 lines.

## Milestone 3: JavaScript resolution

Depends on: 2

- [ ] Remap configured built files to source files in
      `packages/mokly/src/sidecar/module-paths.ts` (`candidate`, `resolve`,
      `resolveSync`), after the side mapping, and record each probe in the
      lookup evidence. Split the file if it passes 300 lines.
- [ ] Add head and base cases to the sidecar tests, modelled on
      `tests/sidecar_repository_links.test.ts`: a JS export, a CSS import
      from JS, a missing source file, and a base tree without `dist`.

## Milestone 4: CSS resolution

Depends on: 2

- [ ] Apply the same remap in `crates/mokly-css/src/resolver.rs` after the
      package target and main-field lookup, with the field in
      `crates/mokly-css/src/resolution.rs`, filled in
      `crates/mokly-render/src/stylesheets.rs`.
- [ ] Add cases to `crates/mokly-css/src/_tests_/resolver_tests.rs`.

## Milestone 5: End-to-end test and adoption

Depends on: 3, 4

- [ ] Add a CLI test with a Git base whose workspace package has only `src`
      and whose working tree has a built `dist`, modelled on
      `crates/mokly-cli/tests/changes_ancestor_tests.rs`. Changes must be
      available.
- [ ] Add `sourcePackages` for `@mokly/ui`, `@mokly/viewer`, `@mokly/model`
      and `@mokly/frame` to the root `mokly.config.json`. The
      `@mokly/viewer/styles.css` export has no source file, because its build
      writes it. No catalogue file imports it. An import of it would then
      fail on both sides.
- [ ] Build the cloud mockups against a base, as `docs/mockups/README.md`
      gives, and check that no `base` diagnostic prints and that the output
      holds the comparison. Run the cloud mockup check and suite.

## Milestone 6: Verification, commit, review, and pull request

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

## Post-merge follow-up (non-blocking)

- [ ] Add the `preview` label to a pull request and check that the capture,
      the seed and the deploy pass.

## Decisions

### 1. Which configuration gives `sourcePackages` to the base render?

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Terms:**
  - **Working configuration:** the `mokly.config.json` of the working tree.
  - **Base configuration:** the same file in the base commit.
- **Background:**
  - The base render reads the base configuration for every setting
    (`crates/mokly-cli/src/changes_base_sources.rs:88-101`), so each side
    resolves with its own aliases and conditions. A base without the file has
    an empty catalogue.
  - Two settings come from the working configuration: `review.base`
    (`crates/mokly-compare/src/base_render.rs:220-230`) and
    `review.baseInstallScripts` (`docs/guides/authoring/config.md:83-84`).
    Both say how to compare. Neither says what the base holds, so neither is a
    precedent for a package layout.
  - Without an entry for a package, the head loads its fresh `dist`, because
    CI runs `npm run build` before a capture. So a forgotten entry passes the
    pull request that adds the import, and the base of each later pull
    request fails.
  - Serve's kept-base key already hashes the working configuration
    (`crates/mokly-cli/src/serve_base_key.rs:32-52`), so a working-side
    change drops a kept base.
- **Problem:** with the per-side rule, a new `sourcePackages` entry helps only
  a base that already holds it. Today's `main` does not.
- **Impact if no action:** previews keep failing until the option is on
  `main`, and the pull request that adds it cannot preview itself. A
  repository that adds the option later meets the same gap once.
- **Root question:** when the base configuration has no entry that the base
  needs, or a different entry, which tree says the base's `dist`-to-`src`
  layout?
- **Options:**
  - **A.** Read `sourcePackages` from the working configuration for both
    renders. The base remaps from its first run after the option lands,
    also an old base. Effort: Small.
  - **B.** Each render reads its own configuration, as every other
    `moduleResolution` field does. The option helps a base only when the
    base commit holds it. Effort: Small.
  - **C.** The base uses its own `sourcePackages` when its configuration
    has the field, and the working value otherwise. Effort: Small.
  - **D.** Choose per package. For each package, the base uses the base
    configuration's entry when that file names the package, and the working
    entry otherwise. The head reads only the working configuration. Mokly
    merges the two maps once, where the base configuration loads. A working
    entry can only point the base at the base commit's own files inside the
    package root, so it adds no trust risk. Effort: Small.
- **Left out:** a value for one run from the command line, because a
  package layout is not a permission for one run, and the preview capture
  and the cloud runner would each have to pass it. Reading the layout from
  each package's `tsconfig`, because it adds a second source beside the
  chosen option, and builds with esbuild, tsup or Vite set no `outDir`.
- **Assumption that all options share:** the remap itself reads the package
  files of the side that it renders (`docs/protocol/mokly-comparison-packages.md`).
- **Recommendation:** D, changed from A by the options check. D repairs a
  base without the field or without one package's entry, as A does, and it
  keeps each entry that the base gives, so a pull request that renames a
  package's `src` or `dist` directory, or removes the option, keeps its
  comparison.
- **Wider fix:** D, because it also covers one missing package entry, which
  C does not.
- **Action:** ask the user.
