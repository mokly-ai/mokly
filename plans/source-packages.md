# Workspace package sources in module resolution

Status: Active. On branch `calummoore/mokly-website-redesign-plan-v2-xnnj`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says.

A comparison renders the head from the working tree and the base from the
base commit's Git files. A catalogue that imports a workspace package whose
`exports` point only to built files, such as `dist/top-bar/top-bar.js`,
cannot render its base, because Git does not hold the built files. Mokly then
publishes without Changes. This repository's cloud mockup catalogue hits this:
it imports `@mokly/ui` and `@mokly/viewer` by name, every base render fails
with `Could not resolve "@mokly/ui/..."`, and the preview capture rejects
each upload without a comparison, so no pull request can deploy a preview.
The failure exists since #350 (2026-11-20).

On 2026-11-24 Cal chose automatic source detection. A built file inside a
workspace package maps to the package's matching source file, in both
renders, with no configuration. He chose it over a `sourcePackages`
configuration option, a `mokly-source` export condition published with or
stripped from the packages, 59 TypeScript `paths` mappings, and a base build
command. On the same day he started two separate top-level workspaces: "Mokly
base prepare command" plans `review.basePrepare`, and "Mokly source package
override" plans an override for layouts that the detection misses. This plan
covers neither. A probe on 2026-11-24 proved that loading the package sources
makes this repository's base render pass, with the Changes comparison.

The rule:

1. A resolved file is inside a workspace package when it is a repository
   file outside `node_modules`, and the nearest `package.json` above it,
   inside the repository, has a `name`. That directory is the package root.
2. The build folder and the source folder of the package come from the
   `outDir` and `rootDir` of the package root's `tsconfig.json`, with its
   `extends` chain, when both are set and both are inside the package root.
   Otherwise a top-level `dist`, `lib`, `build` or `out` folder is a build
   folder, and `src` is the source folder.
3. A file under the build folder maps to the same relative path under the
   source folder. A `.js`, `.mjs` or `.cjs` file tries the configured resolve
   extensions in order. Any other file, such as `.css`, keeps its name.
4. When the side holds the source file, Mokly loads it. Otherwise Mokly
   resolves as before: the head loads its built file, and a base without it
   fails with `module {path} has no source in this side`.

Design calls, mine, 2026-11-24:

- The rule does not ask Git whether a file is tracked, as the first
  description of the option said. The sidecar has no Git data, a base side
  never holds built output, and step 4 acts only when a source file exists.
- The head also loads the sources, so both renders load the same kind of
  file. Repositories whose package builds change their code, for example by
  replacing environment values, may render differently than before. The
  project is not in production, so the repository rules allow this.
- `tsconfig` folders win over the convention, because they state the
  package's own layout.
- One table of cases, shared as a test fixture, holds the rule. The
  sidecar's JavaScript resolution and the Rust CSS resolver must both pass
  it, so the two copies of the rule cannot drift.
- Each file and `tsconfig` that the rule reads enters the reuse evidence, as
  the package lookup probes do, so a cached render sees a changed source.

Contract owners:

- [Configuration](../docs/protocol/mokly-configuration.md), section Module
  Resolution.
- [Sidecar modules](../docs/protocol/mokly-sidecar-modules.md).
- [Comparison packages](../docs/protocol/mokly-comparison-packages.md), which
  says that repository-owned packages come from each side's own sources.
- [Imported styles](../docs/protocol/mokly-configuration-imported-styles.md),
  for CSS `@import`.
- The [configuration guide](../docs/guides/authoring/config.md).
- The [@mokly/mokly README](../packages/mokly/README.md), the
  [sidecar README](../packages/mokly/src/sidecar/README.md) and the
  [mokly-css README](../crates/mokly-css/README.md).

## Milestone 1: Documentation and protocol

Depends on: none

- [x] State the rule in `docs/protocol/mokly-comparison-packages.md`, where
      workspace packages come from each side's sources.
- [x] Update `docs/protocol/mokly-sidecar-modules.md`: where the rule runs
      among the workspace mapping, tsconfig paths and package lookup, and its
      reuse evidence.
- [x] Update `docs/protocol/mokly-configuration.md` and
      `docs/protocol/mokly-configuration-imported-styles.md` for JavaScript
      and CSS imports of workspace packages.
- [x] Add a short section to `docs/guides/authoring/config.md`: workspace
      packages need no build for Changes, with the folder rule.

Evidence: `.context/source-packages/m1-format.log` and `.context/source-packages/m1-links.log`.

## Milestone 2: The rule and its case table

Depends on: 1

- [x] Add the case table as a JSON fixture under `tests/fixtures/`: package
      layouts, `tsconfig` folders, imported built files, and the expected
      source file or no mapping.
- [x] Add the rule to the sidecar as one module beside
      `packages/mokly/src/sidecar/module-paths.ts`. Read `rootDir` and
      `outDir` with the `extends` handling of `config-inputs.ts`.
- [x] Test the module against the table.

Evidence: `.context/source-packages/m2-case-table.log` and `.context/source-packages/m2-sidecar-regressions.log`.

## Milestone 3: JavaScript resolution

Depends on: 2

- [x] Apply the rule in `ModulePaths.candidate`, `resolve` and `resolveSync`,
      on the side's repository-relative name, before the existence check.
      Record each probe in the lookup evidence.
- [x] Add head and base cases to the sidecar tests, modelled on
      `tests/sidecar_repository_links.test.ts`: a JavaScript export, a CSS
      import from JavaScript, a package without sources, a `tsconfig`
      layout, and a base tree without `dist`.

Evidence: `.context/source-packages/m3-final-tests.log` and `.context/source-packages/m3-repeat-*.log`.

## Milestone 4: CSS resolution

Depends on: 2

- [x] Apply the same rule in `crates/mokly-css/src/resolver.rs` after the
      package target and main-field lookup, and read the package
      `tsconfig.json` folders there.
- [x] Test the Rust rule against the same table, and add resolver cases to
      `crates/mokly-css/src/_tests_/resolver_tests.rs`.

Evidence: `.context/source-packages/m4-css-tests.log` and `.context/source-packages/m4-clippy-final.log`.

## Milestone 5: End-to-end test and this repository

Depends on: 3, 4

- [x] Add a CLI test with a Git base whose workspace package holds only
      `src` and whose working tree holds a built `dist`, modelled on
      `crates/mokly-cli/tests/changes_ancestor_tests.rs`. Changes must be
      available.
- [x] Build the cloud mockups against a base commit, and check that no
      `base` diagnostic prints and that the output holds the comparison. Run
      the cloud mockup check and suite, and the example mockup check.

Evidence: `.context/source-packages/before-reproduction.log`,
`.context/source-packages/after-reproduction.log`,
`.context/source-packages/m5-cli-tests.log`,
`.context/source-packages/m5-mockups-test.log`, and
`.context/source-packages/example-serve.png`.

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
