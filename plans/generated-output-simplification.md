# Generated Output Simplification

## Summary

Three related changes to how Mokly handles generated output, all following
the same principles recorded by the user: Mokly must not create files the
user did not ask for, generated content must never be mixed with authored
content, and behaviour should follow the repository rather than a declared
mode. Only `check` inspects the current Git index to decide whether to compare
local output; comparison baselines inspect the pinned commit's tree instead.

**Change A: Git state replaces the output modes.** The `generatedOutput`
option (`"committed" | "derived"`) is removed. Everything it selected is
derived from one fact, read per commit: whether the generated output is
tracked in Git. The baseline for a comparison is read from Git blobs when the
merge-base commit contains generated output, and rebuilt with
`review.baselineBuild` when it does not. `check` always validates the sources,
and compares compiled bytes with the tracked files only when the output is
tracked. Only `build`, `build --watch`, and `serve --build` write generated
output; plain Serve, export, and publication never do. Watched writes follow each
successful complete compilation regardless of tracking. The head side of
every comparison is the in-memory compilation, so the requirement that the
working tree equal the compilation goes away.

**Change B: generated content lives alone in `.generated`.** `mockupsDir`
names the catalogue directory; Mokly owns exactly `<mockupsDir>/.generated/`
and replaces it wholesale on every build. Authored assets stay in the
catalogue directory and generated documents reference them in place with
relative hrefs. The public surface is the referenced asset closure: stylesheet
rules, renderer resource records, and every local URL reachable from generated
documents and their CSS. For the example:

```
examples/basic/.generated/         all generated files, replaced on every build
examples/basic/styles.css …        authored, tracked (13 stylesheets)
examples/basic/design-library/**   authored, tracked (15 stylesheets)
```

**Change C: the ownership machinery goes.** With `.generated/` disposable,
ownership headers, overwrite refusal, orphan and unclaimed detection, and the
ownership grep in the tracked-output check have no job left.

Decisions:

- Only `check` reads the Git index for `.generated/` and `.mokly-cache/`,
  never `.gitignore`. It compares the complete compiled set: all expected
  paths tracked means tracked, none means untracked, and a mixture is a
  `build-invalid` error naming paths and both remedies. Without Git, `check`
  treats output as untracked. Build and Serve (including their writing forms),
  export and publication do not inspect current index tracking. Adding an
  entry builds successfully; `check` reports the new route under `untracked:`
  until the output is staged and committed.
- The manifest records an inventory of every generated path with its Git
  blob hash, so the completeness of committed output can be judged at any
  commit from Git alone.
- The baseline reader is chosen per merge-base commit from Git alone. No
  manifest blob at `<mockupsDir>/.generated/mokly-manifest.json` means
  the commit is rebuilt. A manifest whose inventory paths all
  exist in `git ls-tree` with matching hashes means complete, so blobs are
  read. Missing or mismatched paths mean incomplete or stale output, so the
  commit is rebuilt and the reason is logged; regeneration is always the safe
  answer and history cannot be fixed. Manifests from before the inventory
  keep today's assumption that a committed manifest means complete output. A
  repository that stops or starts committing output keeps comparing across
  the transition. The trust statement stays: a rebuild executes the base
  commit's own install and build.
- `review.baselineBuild` remains and is valid in every repository.
- `check` on tracked output fails on missing, stale, or extra files with
  guidance to run `mokly build` and commit, or to untrack the directory.
  `check` on untracked output ignores local files entirely.
- Serve, export, and publish never write under `.generated/`. `build` writes
  transactionally. `build --watch` reuses the consumer watcher and rewrites
  after each successful complete compilation. `serve --build` does the same
  inside watched Serve, writing at the point where committed mode used to
  write; with `--no-watch` it writes once after the initial compilation.
- Generated documents reference authored assets in place. Serve's URL layout
  mirrors disk: generated documents sit under a `.generated/` prefix and
  closure files at their catalogue-relative paths. Export produces the same
  layout. Committed baselines read closure files from Git blobs; rebuilt
  baselines copy the closure files from the extraction into the cache entry
  beside `.generated/`, so the cache stays self-contained. Both copies are
  internal to `.mokly-cache/`.
- The manifest lists the referenced closure so the harvest and the readers
  know exactly which files belong to the catalogue. Historical manifests and
  the old single-directory layout remain readable for baselines.
- `mockupsDir` keeps its name. The generated child is the fixed name
  `.generated`, like `.mokly-cache`. `publicExclude`, hand-written public HTML
  under `mockupsDir`, and the directory-based public policy are removed.
- Closure files must be regular files under `mockupsDir`, outside
  `.generated`, and not protected source. Assets outside the catalogue
  directory, including CSS imported from React components, are a follow-up.
- Moving the example's 28 tracked stylesheets out of `examples/basic/generated/`
  is authorized by the user's request for this layout.
- A worktree-based cache outside the repository was discussed and parked; it
  is recorded under follow-up.
- Backend and documentation only. No mockup or UI work.

Protocol owners: [configuration](../docs/protocol/mokly-configuration.md),
[derived baselines](../docs/protocol/mokly-derived-baselines.md), and
[baseline storage](../docs/protocol/mokly-baseline-storage.md). Related
contracts: [runtime](../docs/protocol/mokly-runtime.md),
[on-demand](../docs/protocol/mokly-on-demand.md),
[export](../docs/protocol/mokly-export.md),
[changes](../docs/protocol/mokly-changes.md),
[source protection](../docs/protocol/mokly-source-protection.md),
[authoring](../docs/protocol/mokly-authoring.md),
[navigation](../docs/protocol/mokly-navigation.md),
[terminal output](../docs/protocol/mokly-terminal-output.md).

## Milestone 1: Define the contracts

Documentation only. Every later milestone implements these contracts.

Change A:

- [x] `docs/protocol/mokly-configuration.md`: remove `generatedOutput`;
      `review.baselineBuild` is always valid; define tracked-state detection
      from the index, the mixed-state error, and the no-Git rule.
- [x] `docs/protocol/mokly-derived-baselines.md`: retitle the contract around
      per-commit baseline selection; replace the Command Behavior table with
      one keyed on tracked and untracked output; define `check` as validate
      then compare-if-tracked; define the per-commit selection rule (no
      manifest, complete, incomplete or stale) and its logged diagnostics;
      state that only `build`, `build --watch`, and `serve --build` write;
      drop the head-side equality requirement and the moving-`mockupsDir`
      restriction where per-commit selection lifts it.
- [x] `docs/protocol/mokly-changes.md`,
      `docs/protocol/mokly-component-changes.md`,
      `docs/protocol/mokly-export.md`, and `docs/protocol/mokly-on-demand.md`:
      the head side is always the in-memory compilation; Serve and export
      never write generated output; background completion finalizes files
      only under `serve --build`.
- [x] `docs/protocol/mokly-terminal-output.md`: the Serve header drops the
      mode word; `check` summary lines for tracked and untracked output;
      `build --watch` and `serve --build` output; the `build` summary names
      `<mockupsDir>/.generated`.
- [x] `docs/protocol/mokly-timings.md`: the large fixture's `--derived` flag
      becomes a tracked-output choice; remove mode wording from benchmark
      descriptions.

Change B:

- [x] `docs/protocol/mokly-configuration.md`: redefine `mockupsDir` as the
      catalogue directory with the Mokly-owned `.generated` child; configured
      inputs may live anywhere under it except inside `.generated`; stylesheet
      rule paths stay relative to `mockupsDir`; remove `publicExclude`; define
      `config-invalid` for inputs inside `.generated`.
- [x] `docs/protocol/mokly-source-protection.md` and
      `docs/protocol/mokly-authoring.md`: the referenced asset closure is the
      public surface; closure files must be regular files under `mockupsDir`
      outside `.generated` and not protected source; remove hand-written
      public HTML and the directory-based policy; keep symlink and
      confinement rules.
- [x] `docs/protocol/mokly-runtime.md`, `docs/protocol/mokly-navigation.md`,
      and `docs/architecture/build-pipeline.md`: documents reference assets
      in place with hrefs relative to their location inside `.generated/`; the
      Serve and export URL layout mirrors disk; a build replaces `.generated/`
      atomically.
- [x] `docs/protocol/mokly-baseline-storage.md`: the harvest moves
      `<source>/<mockupsDir>/.generated` and copies the manifest's closure
      files into the cache entry; the legacy single-directory layout is
      harvested as today; readers resolve repository-relative paths against
      the entry.
- [x] Manifest contract (`docs/protocol/mokly-runtime.md` or the manifest
      section that owns the schema): add the closure list and the
      generated-path inventory with blob hashes, bump the schema version, and
      keep compatibility readers for historical manifests.
- [x] `docs/protocol/mokly-export.md` and `docs/protocol/mokly-on-demand.md`:
      export ships `.generated/` plus the closure at catalogue-relative paths;
      Serve serves generated routes from memory under the `.generated/` prefix
      and closure files live from their authored location; the export output
      must not contain or be contained by `.generated/`.

Change C:

- [x] `docs/protocol/mokly-page-migration.md`,
      `docs/protocol/mokly-derived-baselines.md`, and
      `docs/protocol/mokly-runtime.md`: remove ownership headers, unclaimed
      files, orphan discovery, and overwrite refusal; committed-style `check`
      compares the whole tree; the tracked-output check is a prefix check.

Shared:

- [x] Guides (`docs/guides/authoring/config.md`, `components.md`,
      `docs/guides/cli/build.md`, `check.md`, `serve.md`, `export.md`,
      `options-and-exit-status.md`, `docs/guides/start/configure.md`,
      `build.md`, `serve.md`) and `README.md`: no modes; `mockupsDir` examples
      become the catalogue directory; ignore rules become `.mokly-cache/` and
      `<mockupsDir>/.generated/` for repositories that do not commit output;
      document `build --watch` and `serve --build`; the command table
      describes the new behaviour.
- [x] `examples/basic/README.md`, `src/build/README.md`, `src/server/README.md`,
      `src/export/README.md`, `src/review/README.md`, `src/baseline/README.md`,
      and the example bullet in `AGENTS.md`: describe the new layout and
      workflow.
- [x] Update this plan's index entry in `plans/README.md`; run
      `npm run format:check` on the changed Markdown; review the diff; commit
      and push.

Milestone 1 review corrections (documentation only):

- [x] Restrict Git-index tracking and the cache index guard to `check` alone;
      document that a new entry builds before it can be staged and that other
      commands, including watched Serve, do not inspect head tracking.
- [x] Define deterministic discovery of the historical catalogue root after
      a rebuild, record that root and layout in the completion marker, and
      preserve compatibility with pre-v6 cache entries.
- [x] Define a baseline catalogue descriptor and separate generated-route and
      catalogue-relative resource comparison namespaces across moved roots and
      both output layouts; name all consumers of the mapping.
- [x] Define viewer and static-delivery generated URL construction, route
      validation, and compatibility with existing prefixless publications;
      align the viewer, publication, and upload protocols.

## Milestone 2: Git state replaces the output modes

Backend for change A on the current single-directory layout. After this
milestone there is no mode option; only explicit `build`, `build --watch` and
`serve --build` write, and comparisons pick their baseline per commit.
Tracked-state detection uses the existing
compiled-route intersection until Milestone 3 gives it a single directory.

- [x] Config: delete `generatedOutput` from `src/config/types.ts`,
      `validate.ts`, `generated_output.ts`, and `src/cli/help.ts`; keep
      `review.baselineBuild` and its defaults; reject the removed key with
      guidance.
- [x] Tracked state: a typed `GeneratedOutputTracking` (`tracked`,
      `untracked`, or a mixed error) computed only by `check` from the index
      through `src/build/tracked_output.ts`, treating a missing repository as
      untracked. The `.mokly-cache/` index guard also runs only under `check`.
      Test all three outcomes, no Git, a new entry built before Git staging,
      and no tracking reads by other commands.
- [x] Baseline selection: `src/review/repository.ts` and
      `src/review/prepare.ts` choose `CommittedBaselineReader` when the
      merge-base commit contains the manifest and the rebuilt reader
      otherwise (inventory verification arrives with the schema bump in
      Milestone 3); remove every `generatedOutput` branch in `src/review`,
      `src/server`, `src/export`, and `src/cli`; the Serve child and export
      keep the prepared-repository handoff without head tracking state.
- [x] `check`: `src/cli/run.ts` and `src/build/output_store.ts` validate,
      then compare with disk only when tracked; summary lines per the terminal
      contract; `review/run.ts` no longer calls the output-store check.
- [x] Only `build` writes: remove the writes in `src/server/serve_lifecycle.ts`,
      `src/server/demand/generation.ts`, and `src/export/run.ts`; add
      `serve --build` (`src/cli/arguments.ts`, serve options, the parent's
      candidate handoff) writing after each successful complete compilation;
      add `build --watch` reusing `ConsumerWatcherFactory` and the watch rules
      to recompile and rewrite with the same debounce, reporting each result.
- [x] Serve header (`src/cli/reporter/serve_ready.ts`) and the large fixture
      scripts (`scripts/large/*.mjs`, `tests/fixtures/large/generate.ts`) drop
      the mode.
- [x] Repository preview capture compiles its own head generation and reads
      generated routes from those bytes without touching local generated output;
      test missing local output, stale output and alias collisions.
- [x] Refresh publication snapshot, document-enumeration, and manifest
      confinement tests for in-memory capture while retaining input-drift checks.
- [x] Correct transitional READMEs so flat output paths and public-file
      delivery describe Milestone 2, not the future `.generated/` layout.
- [x] Audit the quick-start and code-area READMEs for transitional Git-blob
      selection and ignore instructions before shipping Milestone 2.
- [x] Tests: replace the 26 test files' `generatedOutput` fixtures with
      tracked and untracked fixtures; per-commit reader selection across a
      transition commit; `check` outcomes; Serve and export write nothing;
      `serve --build` and `build --watch` write after a successful compile and
      not after a failed one; committed-style baselines still read blobs.
- [x] Update `tests/guides_authoring.test.ts` to validate index-derived
      tracking and the removed `generatedOutput` config field, and
      `tests/guides_cli.test.ts` to validate the new `--build` and `--watch`
      options when the corresponding config and CLI changes land.
- [x] Smoke test on the example: delete local generated files, run
      `npm run dev`, browse, wait for Changes, confirm nothing written; run
      `npm run example:check`; run `node dist/cli/bin.js build --watch` on the
      example, edit an entry, confirm a rewrite; run `npm run example:build`.
- [x] Isolate the clean-cache packed consumer in its own Git repository before
      `check`; commit its generated baseline after renaming the config so
      export still exercises committed blobs.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

## Milestone 3: The `.generated` directory with in-place references

Backend for change B. This milestone moves the output root, keeps assets in
place, and migrates the example in one step, because hrefs only resolve when
all of it lands together.

- [x] Replace the computed removed-key name in `src/config/validate.ts` with
      one small table of literal `generatedOutput` and `publicExclude` keys,
      each with its own `config-invalid` guidance; test both rejections.
- [x] Move the test-only `committedReviewRepository` factory out of
      `src/review/repository.ts` into `tests/helpers/` and update its callers;
      production readers must use parent-prepared baseline selection.
- [x] Config (`src/config/types.ts`, `validate.ts`, `paths.ts`,
      `path_validation.ts`): add the `GENERATED_DIRECTORY` constant, resolve
      `config.generatedDir` as `<mockupsDir>/.generated`, reject entries, the
      renderer, transformer, and package roots inside it, remove
      `publicExclude`, and keep every confinement and symlink rule for the
      catalogue directory.
- [x] Output and hrefs (`src/build/output_paths.ts`, `compile.ts`,
      `document_compiler.ts`, `html_links.ts`): write routes and the manifest
      under `generatedDir`; compute stylesheet and resource hrefs relative to
      the document's location inside `.generated/`.
- [x] Keep generated-route rejection for reserved source basenames and
      realpath aliases of internal metadata inside `.generated/` while
      allowing an authored file and a generated route to share a name across
      their separate directories.
- [x] Closure (`src/build/html_links.ts`, resource validation, renderer
      resource records, stylesheet rules): collect the closure of referenced
      local files, validate each against the catalogue directory and source
      protection, record it and the generated-path inventory with blob hashes
      in the manifest with the bumped schema version, and keep compatibility
      readers for v5 and earlier.
- [x] Share local-reference path resolution across build, Review, resource
      watches, and export, preserving each boundary's existing error policy.
- [x] Apply the retained private static-resource denial to references while
      validating the build closure, so hidden paths fail `build-invalid`
      before Serve or export attempts to deliver them.
- [x] Serve (`src/server/static_routes.ts`, `watch_paths.ts`,
      `watch_resources.ts`, `changed_content.ts`, the Browse shell's route
      mapping): serve generated routes from memory under the `.generated/`
      prefix, serve closure files live from `<mockupsDir>/<path>`, return not
      found for everything else, and keep resource-edit invalidation working
      at the new locations.
- [x] Viewer and static delivery: update `packages/viewer` public catalogue
      types/reader/reference validation, shell stages, frame mounting,
      navigation/inspection and geometry to carry the optional literal
      `.generated` prefix (absence means an older prefixless publication);
      validate paths against the active source layout, include the signal in
      Serve shell and SSR/hydration data, and produce prefixed read-model paths
      for new v6 catalogues. Test both layouts, source swaps, independent
      hosted viewer, and rejection of cross-layout mounts/navigation.
- [x] Export and publication (`src/export/public_files.ts`, `references.ts`,
      `paths.ts`, `src/publication/*`): ship `.generated/` from compiled bytes
      and the closure files from disk at catalogue-relative paths; drop the
      directory-based public walk (retain independent input fingerprinting
      and its safe alias semantics); reject selected closure symlinks and an
      output directory inside or containing `.generated/`.
- [x] Exclude the private v6 source manifest from the captured export and
      publication tree; assert its new `.generated/` path is absent in the
      export regression and packed publication smoke tests.
- [x] Keep the private v6 source manifest out of Serve's generated-route
      allowlist; test that its static URL returns 404 while a screen is served.
- [x] Pass logical generated routes to Browse document adaptation during
      static export, preserving trusted link/inspector metadata; cover the
      published bytes and native frame navigation with regression tests.
- [x] Align the baseline, delivery, and source-protection status text and
      manifest reader comment with the shipped v6 behavior.
- [x] Migrate packed-consumer smoke fixtures and inspections to `.generated/`
      paths, schema v6, and catalogue-root `.gitignore` rules; verify all five
      package-consumer scenarios with the packed archives.
- [x] Baseline (`src/baseline/rebuild.ts`, `reader.ts`, `manifest.ts`,
      `src/review/committed.ts`): harvest `.generated/` plus the closure files
      into the cache entry; harvest the legacy layout as today when
      `.generated/` is absent; discover moved historical roots by the bounded,
      deterministic manifest search; retain requested `inputs.json` and add
      discovered root/layout to `complete.json`, accepting old flat markers;
      blob and rebuilt readers use a per-commit descriptor to pair generated
      routes and catalogue-relative closure paths across different roots.
      Check's tracked-state detection becomes a prefix check on `.generated/`;
      baseline selection verifies inventory completeness and hashes with one
      `git ls-tree` before reading blobs and rebuilds with a logged reason
      when output is incomplete or stale.
- [x] Accept a repository-root `mockupsDir` as `.` through baseline preparation
      and cache identity while still discovering a moved historical catalogue;
      cover the end-to-end rebuild and reader.
- [x] Do not reinterpret a malformed v6 manifest in a searched parent as a
      valid legacy catalogue rooted at its `.generated/` child; test the
      rejected candidate is absent from historical discovery.
- [x] Example migration: `mockupsDir: "."` in `examples/basic/mokly.config.ts`;
      `git mv` the 28 stylesheets from `examples/basic/generated/` to
      `examples/basic/` and `examples/basic/design-library/`; update
      `review.sharedImpact`, component `dependency` strings, `.gitignore`
      (`examples/basic/.generated/`), `scripts/verification/prepared.mjs`,
      `tests/helpers/example_sources.ts`, `scripts/preview/*.mjs`,
      `scripts/large/*.mjs`, `tests/fixtures/large/generate.ts`, and every
      other test, script, and document that spells `examples/basic/generated`
      (about 45 files).
- [x] Tests: config rejection cases; closure collection for rule stylesheets,
      renderer resources, `@import`, `url()`, `srcset`, and nested HTML;
      hrefs resolve from disk and over HTTP; Serve refuses unreferenced files;
      export layout; blob and rebuilt baselines read closure files for both
      layouts; per-commit selection for absent, complete, incomplete, and
      stale committed output; current-root priority and unique moved-root
      discovery (including zero/ambiguous candidates), cache warm reuse and
      pre-v6 flat markers, cross-layout and cross-root route/resource pairs;
      the example baseline fixture rebuilds; a v5
      manifest baseline still compares.
- [x] Migrate the design-library attribution fixture's committed Git reader
      to the v6 generated root and descriptor so its batched Serve and Review
      assertions exercise the migrated catalogue rather than flat paths.
- [x] Update publication and Changes regression fixtures that currently
      expect public file/directory symlinks or a directory-based public walk:
      selected closure symlinks fail, unreferenced aliases remain private,
      and safe input-fingerprint aliases retain their existing semantics.
- [x] Update `tests/component_protocol_docs.test.ts` to assert manifest v6
      format rows and README text once manifest-v6 generation and readers land.
- [x] Smoke test: `npm run example:build` produces `examples/basic/.generated/`
      only; open a generated document from disk and confirm it is styled;
      `npm run dev` styles screens from the authored files and reflects a CSS
      edit without a rebuild; `npm run example:check`; export a site and
      serve it statically.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

## Milestone 4: Remove the ownership machinery

Backend for change C.

- [ ] `src/build/transaction.ts`: stage the complete `.generated/` tree, swap
      it into place, and remove the previous tree; drop per-file backup and
      restore, orphan discovery, and the unowned-file refusal.
- [ ] `src/build/check.ts`: tracked-output comparison reports missing, stale,
      and extra paths against the whole tree; remove unclaimed detection.
- [ ] `src/build/tracked_output.ts` and `tracked_ownership.ts`: the tracked
      check lists paths under `.generated/` and `.mokly-cache/`; delete the
      ownership grep.
- [ ] Delete `src/build/ownership.ts` and the ownership reads in
      `html_links.ts`, `render.ts`, `render_page.ts`,
      `src/server/static_routes.ts`, `src/server/watch_paths.ts`,
      `src/export/ownership.ts`, and `src/export/references.ts`; keep a
      one-line generated marker as plain text with no parsing.
- [ ] Update `docs/protocol/mokly-timings.md` for removed phases such as
      `output.find-orphans`, and the affected READMEs.
- [ ] Tests: replace ownership, orphan, and unclaimed cases with tree-swap,
      extra-path, and tracked-path cases; keep the collision and confinement
      cases that still apply.
- [ ] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

## Milestone 5: Final verification and review

- [ ] Re-read every document changed in Milestone 1 against the shipped
      behaviour and fix drift, including `AGENTS.md` and the README.
- [ ] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit with Conventional Commits; push
      the branch.
- [ ] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md`; report numbered findings
      with severities and recommendations without changing the implementation.

## Post-merge follow-up (non-blocking)

- Parked: replace archive extraction with Git worktrees in a cache outside
  the repository. The baseline would then be a full checkout, removing the
  harvest, the tar parser and its confinement code, and every in-repository
  `.mokly-cache` special case, at the cost of worktree metadata management,
  a documented cache location, and deleting `node_modules` after each build.
- Bring assets outside the catalogue directory into the closure, including
  CSS imported from React components, by mapping them into `.generated/`.
- Smoke-test a fresh consumer with the next published package: `npx mokly`
  and `npx mokly export` produce nothing under `.generated/`, `npx mokly
build` produces it, `check` passes with the directory ignored, and a
  comparison against `origin/main` rebuilds its baseline.
