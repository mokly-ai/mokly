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
tracked in Git. Only v8 can be a readable baseline after the merge. Complete
v8 output uses Git blobs; missing or incomplete v8 output uses
`review.baselineBuild`. The selected current-location version gate and the post-rebuild check retain
main's incompatible-earlier outcome; other committed locations are ignored. `check` always validates the sources,
and compares compiled bytes with the tracked files only when the output is
tracked. Only `build`, `build --watch`, and `serve --build` write generated
output; plain Serve, export, and publication never do. Watched writes follow each
successful complete compilation regardless of tracking. The head side of
every comparison is the in-memory compilation, so the requirement that the
working tree equal the compilation goes away.

**Change B: generated content lives alone in `mokly-generated`.** `mockupsDir`
names the catalogue directory; Mokly owns exactly `<mockupsDir>/mokly-generated/`
and replaces it wholesale on every build. Authored assets stay in the
catalogue directory and generated documents reference them in place with
relative hrefs. The approved Milestone 9 merge contract also places imported
CSS bundles and copied CSS assets in this tree, under `styles/` and `assets/`.
The public surface is the referenced asset closure: stylesheet
rules, renderer resource records, and every local URL reachable from generated
documents and their CSS. For the example:

```
examples/basic/mokly-generated/         all generated files, replaced on every build
examples/basic/styles.css …        authored, tracked (13 stylesheets)
examples/basic/design-library/**   authored, tracked (15 stylesheets)
```

**Change C: the ownership machinery goes.** With `mokly-generated/` disposable,
ownership headers, overwrite refusal, orphan and unclaimed detection, and the
ownership grep in the tracked-output check have no job left.

Decisions:

- Only `check` reads the Git index for `mokly-generated/` and `.mokly-cache/`,
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
- Current formats only: the approved fourteen removals below supersede earlier
  compatibility decisions. Select committed baselines only from the canonical
  manifest in the generated subtree. Missing or incomplete v8 output rebuilds
  with its own recipe; stale root-level metadata never decides availability.
  Keep the v8 version gate, including the earlier-version outcome after a
  rebuild writes root-level output below v8. Invalid caches are partial and
  rebuild under their lock; completion markers publish by atomic rename.
  Remove transformers, old ownership adaptation and notice handling, obsolete
  reservation/key logic, inferred snapshot ids and serialized layout prefixes.
  Keep current format gates, removed-key diagnostics, identity hash domains,
  exact earlier-baseline product copy and the 426 service-version response.
- Finding 32 = **B**, documentation only: generated HTML derives from kind/id
  and starts with `pages/`, `screens/` or `components/`. Its outer delivery
  prefix is separate; ids may contain the directory-name text. The merged
  viewer reads catalogue v4 only, with one fixed generated layout. Add no
  new route validator or substring rejection for this finding. The approved
  `styles`/`assets` reservation remains decision 28 work.
- Finding 34 = **C**: new Milestone 14 prepares the unchanged example baseline
  repository and rebuilt cache once in Playwright global setup, with isolated
  fixture copies. Audit every equivalent browser consumer after the merge;
  today they are static-example and design-library-export. Keep one real cold
  baseline browser regression and the real cold preview-build test, the
  unchanged 600-second fixture limit, and before/after suite and fixture timing
  evidence. Final verification/review moves to Milestone 15.
- `review.baselineBuild` remains and is valid in every repository.
- `check` on tracked output fails on missing, stale, or extra files with
  guidance to run `mokly build` and commit, or to untrack the directory.
  `check` on untracked output ignores local files entirely.
- Plain Serve, export, and publish never write under `mokly-generated/`. `build` writes
  transactionally. `build --watch` reuses the consumer watcher and rewrites
  after each successful complete compilation. `serve --build` does the same
  inside watched Serve, writing at the point where committed mode used to
  write; with `--no-watch` it writes once after the initial compilation.
- Generated documents reference authored assets in place. Serve's URL layout
  mirrors disk: generated documents sit under a `mokly-generated/` prefix and
  closure files at their catalogue-relative paths. Export produces the same
  layout. Committed baselines read closure files from Git blobs; rebuilt
  baselines copy the closure files from the extraction into the cache entry
  beside `mokly-generated/`, so the cache stays self-contained. Both copies are
  internal to `.mokly-cache/`.
- The manifest lists the referenced closure so the harvest and the readers
  know exactly which files belong to the catalogue. Only v8
  content is readable. Only the canonical manifest name has metadata status.
- `mockupsDir` keeps its name. The generated child is the fixed name
  `mokly-generated`; unlike local-only `.mokly-cache`, deployable output has
  no leading dot because some static hosts and deploy tools skip dot-paths.
  `publicExclude`, hand-written public HTML
  under `mockupsDir`, and the directory-based public policy are removed.
- The directory name is defined once in `@mokly/viewer/data`, used directly by
  the CLI and viewer, and guarded against other production literals by lint.
  The unreleased dot-directory spelling has no compatibility alias.
- Closure files must be regular files under `mockupsDir`, outside
  `mokly-generated`, and not protected source. Milestone 11 preserves `main`'s
  imported CSS pipeline for outside-catalogue sources by copying its compiled
  styles and assets into the generated tree; direct outside-catalogue links
  stay invalid. This replaces the former imported-CSS follow-up.
- Moving the example's 28 tracked stylesheets out of `examples/basic/generated/`
  is authorized by the user's request for this layout.
- A worktree-based cache outside the repository was discussed and parked; it
  is recorded under follow-up.
- Backend and documentation only. No mockup or UI work.

Approved merge targets: [unified output](../docs/protocol/mokly-unified-output.md),
[manifest and baseline version gate](../docs/protocol/mokly-generated-manifest.md),
[viewer namespace](../docs/protocol/mokly-viewer-namespace.md),
[lint contracts](../docs/protocol/mokly-directory-lint.md), and
[browser fixture preparation](../docs/protocol/ci-fixture-preparation.md).
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

- [x] Milestone 3 review carry-over: restore
      `"examples/basic/src/components/**"` to the example's
      `review.sharedImpact`; report Changes counts against `origin/main`.
- [x] Milestone 3 review carry-over: split `src/server/http.ts`,
      `scripts/preview/catalogue.mjs`, and
      `packages/viewer/src/shell/frame_mount_hook.ts` by responsibility;
      check `src/review/component_classification.ts` and
      `src/server/serve_watched.ts` for appropriate splits too.
- [x] Milestone 3 review carry-over: remove the ignored
      `examples/basic/.context/m3-static-export` smoke artefact and keep
      subsequent smoke output under repository-root `.context/`.
- [x] `src/build/transaction.ts`: stage the complete `.generated/` tree, swap
      it into place, and remove the previous tree; drop per-file backup and
      restore, orphan discovery, and the unowned-file refusal.
- [x] `src/build/check.ts`: tracked-output comparison reports missing, stale,
      and extra paths against the whole tree; remove unclaimed detection.
- [x] `src/build/tracked_output.ts` and `tracked_ownership.ts`: the tracked
      check lists paths under `.generated/` and `.mokly-cache/`; delete the
      ownership grep.
- [x] Delete `src/build/ownership.ts` and the ownership reads in
      `html_links.ts`, `render.ts`, `render_page.ts`,
      `src/server/static_routes.ts`, `src/server/watch_paths.ts`,
      `src/export/ownership.ts`, and `src/export/references.ts`; keep a
      one-line generated marker as plain text with no parsing.
- [x] Update `docs/protocol/mokly-timings.md` for removed phases such as
      `output.find-orphans`, and the affected READMEs.
- [x] Treat unexpected empty directories inside tracked `.generated/` as extra
      paths without following symlinks; cover the whole-tree check in tests.
- [x] Ignore browser-generated `.wrangler/` cache files in ESLint so the
      required post-browser `cargo xtask check` remains repeatable.
- [x] Tests: replace ownership, orphan, and unclaimed cases with tree-swap,
      extra-path, and tracked-path cases; keep the collision and confinement
      cases that still apply.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

## Milestone 5: Final verification and review

- [x] Re-read every document changed on this branch against the shipped
      behaviour and fix drift, including `AGENTS.md` and the README.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit with Conventional Commits; push
      the branch.
- [x] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md`; report numbered findings
      with severities and recommendations without changing the implementation.

Review outcome: after each finding was verified against the code, 27 findings
were reported to the user without changes (4 high, 9 medium, 14 low). Findings
with one shared fix were merged, and a watcher-test flake that also occurs on
`main` was moved out of scope. The high findings are that the manifest
inventory is sorted with the locale-dependent `localeCompare`, so builds fail
for routes with capitals or `_`; that Serve refuses authored stylesheets and
images until the complete background build finishes (permanently if it fails)
and later serves the file watcher's unchecked list; that stale pre-upgrade
output left in Git silently becomes later baselines, with no upgrade guide or
breaking-change notice; and that the new link normalization in comparisons
can crash Changes or report false differences. Each finding is awaiting the
user's decision.

## Milestone 6: Define the `mokly-generated` directory contract

Documentation only. After the review, the user chose to rename the
Mokly-owned output directory from `.generated/` to `mokly-generated/` (review
finding 11). The new name says which tool owns the folder, and a name without
a leading dot works on static hosts and deploy tools that skip or block
dot-directories: GitHub Pages' Jekyll build, Firebase Hosting's default ignore
rules, the `gh-pages` npm tool, and server rules that deny dot-paths. The
`.generated` name was never released, so no compatibility alias is kept.

- [x] Replace `.generated` with `mokly-generated` as the directory name in
      every protocol document, guide, architecture document, README (root,
      `src/**`, `packages/viewer`, `examples/basic`), and `AGENTS.md`:
      disk paths, Serve URLs (`/static/mokly-generated/<route>`), export and
      publication layouts (`static/mokly-generated/<route>`), the baseline
      cache layout, ignore-rule guidance, and the viewer's
      `generatedPathPrefix` value `"mokly-generated"`. Keep identifiers such
      as `generatedPathPrefix`, `generatedFiles`, and the `generated-v6`
      layout id unchanged.
- [x] Add the naming rule to the generated-output contract: a leading dot is
      reserved for Mokly state that never leaves the machine (`.mokly-cache/`
      and transaction directories), and deployable output uses the plain name
      `mokly-generated/`, with the hosting reason. State that production code
      defines the name once, as an exported constant in `@mokly/viewer/data`
      that the CLI imports, and that lint rejects the spelled-out name
      elsewhere.
- [x] Update this plan's summary, decisions, and post-merge follow-up to the
      new name (completed milestones stay as historical records), and update
      the plan's entry in `plans/README.md`.
- [x] Run `npm run format:check`, review the diff, commit, and push.

## Milestone 7: Rename the directory to `mokly-generated`

Backend. First make a single definition the only source of the directory
name, then change its value, so later code cannot drift back to a
spelled-out name.

- [x] Define the directory name once as an exported constant in
      `@mokly/viewer/data`, derive the viewer's `GeneratedPathPrefix` type
      from it, and import it directly wherever the name is used: replace the
      CLI's `GENERATED_DIRECTORY` and every string or template literal in
      `src/` and `packages/viewer/src/` that spells the name, including path
      strings such as `.generated/` and error messages. Do not rename
      identifiers that only contain the word, such as `metadata.generated`,
      `this.generated`, `generatedDir`, `generatedFiles`, or
      `generatedPathPrefix`.
- [x] Add an ESLint rule that rejects the directory name in string and
      template literals in production code outside the defining module, and
      prove that it reports a reintroduced literal.
- [x] Change the constant's value to `mokly-generated`; the viewer's
      catalogue decoder accepts only an absent prefix (the legacy layout) or
      `"mokly-generated"`.
- [x] Update tests, fixtures, scripts, the example's ignore entries
      (`.gitignore`, `.prettierignore`, `eslint.config.js`), and every other
      remaining reference.
- [x] Add a regression test that an exported site and a publication archive
      contain no dot-prefixed path segment, except the export ownership
      marker, which the site does not need.
- [x] Give cold full-example browser fixtures enough time to rebuild the
      renamed historical baseline on this VM, without changing runtime code.
- [x] Smoke test: `npm run example:build` writes only
      `examples/basic/mokly-generated/`; a generated document opened from
      disk is styled; `npm run dev` serves screens under
      `/static/mokly-generated/`, styled after the background build;
      `npm run example:check` passes; an exported site served by a plain
      static file server shows styled screens.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

## Milestone 8: Verify and review the rename

- [x] Re-read every document changed in Milestones 6 and 7 against the
      shipped behaviour and fix drift.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit with Conventional Commits; push
      the branch.
- [x] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md`; report numbered findings
      with severities and recommendations without changing the implementation.

Review outcome: the rename was verified with build, Serve, and export smoke
tests (only `.mokly-export-artifact` remains dot-prefixed in an export), and
seven new findings were reported to the user without changes (1 high, 2
medium, 4 low). The high finding is that `origin/main` has meanwhile adopted
`<mockupsDir>/mokly-generated/` for generated CSS and copied assets (#125),
with pages and the manifest at the catalogue root, so merging `main` needs an
agreed single layout first. The medium findings are that this branch's ESLint
guard and `main`'s `localeCompare` ban share the `no-restricted-syntax` rule
and silently replace each other on merge, and that exports still contain
`__mokly/`, which GitHub Pages' Jekyll build drops, so the hosting rationale
is overstated. The 26 earlier findings remain open; each finding awaits the
user's decision.

## Milestone 9: Define the merged layout and review-fix contracts

Status: complete (documentation only).

Documentation only. The user approved these rename review decisions: 28 A
(design one `mokly-generated/` layout with `main`'s imported CSS before
merging), 29 B and C (separate lint rules, tested in every covered folder),
30 C (rename the `__mokly/` namespace so that no fixed Mokly name starts with
`_` or `.`), 31 A (reword the naming rule), and 33 B (`import/no-duplicates`).
Meanwhile `origin/main` added imported CSS delivery under
`<mockupsDir>/mokly-generated/styles/` and `assets/` with its own
`GENERATED_DIRECTORY` constant (#125), navigation paths (#123), publish
content deltas (#122), route-scoped shell bootstraps (#120), and manifest v7,
and it still uses the committed and derived output modes.

Subsequent decisions supersede the earlier multi-version-reader design below:
correction 3 A requires v8-only baseline content; finding 32 B corrects route
and viewer-version wording; finding 34 C adds Milestone 14 shared preparation.
Completed Milestones 1–8 remain history, not the post-merge compatibility policy.

- [x] Audit every addition on `origin/main` since the merge base
      (`git diff --name-status <base>..origin/main`) and list in this plan
      the features, contracts, and tests that the merge must preserve.
- [x] Define one `mokly-generated/` layout: pages at
      `mokly-generated/<route>`, the manifest at
      `mokly-generated/mokly-manifest.json`, `main`'s compiled stylesheets at
      `mokly-generated/styles/…` and copied assets at
      `mokly-generated/assets/…` with paths relative to the generated
      directory; `styles` and `assets` reserved as first route segments with
      a defined error; one shared constant; and one rule for the files that
      pages may reference (generated pages, generated stylesheets and assets,
      and the authored closure).
- [x] Define the merged manifest: `main`'s v7 identity-derived routes plus
      this branch's `assetClosure`, `generatedFiles` inventory, and
      `blobHashAlgorithm` in a new schema version, with generated stylesheets
      and assets in the inventory and readers for every earlier version.
- [x] Define how imported CSS works without output modes: Git-index
      tracking, in-memory head output, per-commit baselines, `build --watch`
      and `serve --build`, PostCSS content scanning that excludes
      `mokly-generated/`, and change detection for generated stylesheets.
      Remove the post-merge follow-up item that `main` has now delivered.
- [x] Specify the `__mokly/` rename to `mokly-viewer/` for Serve, export,
      publication, viewer, and upload paths. Define its single constant, its
      lint guard, and a compatibility contract in which an older host or
      viewer fails with a clear version error instead of misreading an
      artifact. Record any cloud-product update as post-merge follow-up.
- [x] Reword the naming rule: no fixed Mokly name that a site visitor needs
      starts with `.`, `_`, `#`, or `~`; hosts may drop the optional
      `.mokly-export-artifact` marker; a leading dot remains only for local
      Mokly state.
- [x] Define the lint contracts: a local ESLint rule that rejects the
      spelled-out generated and viewer directory names in string, template,
      and regular-expression literals outside their defining modules;
      `main`'s `localeCompare` ban in its own rule; `import/no-duplicates`;
      and tests that probe every covered folder for each rule.
- [x] Update the plan index entry, run `npm run format:check`, review the
      diff, commit, and push.

Validation: `npm run format:check` passed after formatting the two new schema
pages. `node --import tsx --test tests/component_protocol_docs.test.ts` passed
both tests. The Markdown audit checked 13 changed files and 227 local links
and anchors, all changed protocols at most 250 lines, unchanged Milestones
1–8 and moved v6 prose, and no new main-relative file deletions.
`git diff --check` passed. `cargo xtask check` is exempt for this documentation
milestone. The full implementation review remains assigned to the orchestrator
in Milestone 15; this milestone only inspected its documentation diff.

### Mainline preservation audit

Fetched `origin/main` before this audit. Branch tip before Milestone 9:
`56a24c70b9b6ec12350946351e8fd1c7ab8cac51`. Audited source tip:
`b2c82c1591c91f2550a66c464833b1f864bdab07`. Merge base:
`bf9e3c9a4151fedacf8c7db5bc957609689a348b`. The 11 source commits below are the
preservation boundary. Refresh this audit if the source tip changes before
Milestone 11; do not assume a later tip has the same contents.

The complete name/status audit used:

```sh
git diff --name-status bf9e3c9a4151fedacf8c7db5bc957609689a348b..origin/main
```

It reports 1,680 paths: 589 additions, 1,070 modifications, two renames and
19 deletions. Every path belongs to the following inspected groups: `.github`
actions/workflows; root runtime, package, lock, lint, ignore, changelog and agent
files; docs/architecture, guides, protocol, fixtures, reviews and superpowers;
plans; `examples/basic`; `packages/viewer`; scripts/package, preview, large
and verification; all affected `src` areas; tests, browser tests, helpers and
consumer fixtures; and `xtask`. Existing mainline deletions are part of its
delivered architecture, not permission to remove surviving features. All
added/changed tests, fixtures, docs and completed plans in these groups must
survive the merge, with only the authorized adaptations listed below.

Preserve each source commit's behavior and verification:

1. `d4228f90` (#96): standalone Auto/Light/Dark appearance; embedded `theme`
   prop; URL/store/system precedence; isolated preview schemes/backgrounds;
   palette/contrast and host accent inheritance; authenticated frame reuse,
   reconnect and latest-wins slow loads; disclosure/focus preservation; mobile
   and desktop mockups. Preserve Node-range startup validation, `.node-version`
   and Git-ignore-aware ESLint integration from this change. Keep appearance,
   palette, same-origin, delayed-preview, `cli_bootstrap` and `eslint_gitignore`
   tests, package contracts and appearance browser suites.
2. `2ec4d837` (#115): precise `defineScreen` variant result types, effective
   view resolution, inherited/overridden metadata, light fallback, reparented
   history and matching design examples. Keep authoring-type, screen-variant,
   view-status, history and reparented-design tests.
3. `3699c566` (#119): shared Mokly logo/wordmark, exact 22px mark, accessible
   branding and ink colors across the shell and example mockups. Keep the
   brand/design assertions and inspection tests that wait for real geometry.
4. `d71b03b7` (#121): immutable snapshot presentations with cancellation;
   device-sized comparison frames, fixed/sticky content, page/inner-region
   scrolling, two-axis matching, echoes, anchors, keyboard/touch input,
   independent sections and Scroll together. Preserve all pane/region/scroll
   protocols, mockups, `comparison_alignment*`, `comparison_regions*`,
   `comparison_scroll*`, snapshot-presentation and controller tests.
5. `b4314fec` (#123): navigation paths and folder conflicts replace collections;
   id-derived entry/view/snapshot paths replace authored routes and `/id/`
   aliases; component variants become ordinary entries with `variantOf`;
   parent/variant order, breadcrumbs, removal identity, disclosure persistence
   and fallback stay intact. Preserve manifest v7's identity-only entry model,
   catalogue v3's complete allowlist/privacy model, delivery v3's atomic
   deployment checks and review result v4, with only the planned version/path
   adaptations. Preserve shared-impact Details evidence, own-source reason
   validation, deleted-resource handling, source classification, component
   fast paths, export confinement/cancellation fixes, lazy CLI/module boundaries,
   and all related fixture/example conversions. Keep `nav_path_*`,
   `id_keyed_wire_formats`, `artifact_paths`, variant/manifest/catalogue,
   disclosure, historical identity, component reason/resource/fast-path,
   private-metadata and export safety tests. Preserve the earlier-baseline
   unavailable behavior, raising its threshold to v8 under correction 3 A;
   do not restore main's deleted legacy readers, adapters, fixtures or tests.
6. `0c8245f8` (#122): content-addressed Plan → Blobs → Complete exchange;
   SHA-256/size ownership inventory; immutable snapshot capture; per-project
   deduplication; bounded parallelism; retry/expiry/re-plan rules; keep-first
   commit/config identity; cancellation/recovery precedence; redaction and
   uploaded/unchanged accounting. Keep public receiver fixtures, independent
   packed consumers, `publish_*`, `upload_plan_contract`, `fake_receiver*`,
   receiver-recovery/rejection suites, and all GitHub Action behavior. Retain
   browser shard discovery, separate hydration evidence, release verification
   and read-only remote-state workflow guards delivered with it.
7. `5d1c37ad` (#107): CLI 0.13.0/viewer 0.4.0 release metadata, changelogs,
   dependency pins and Release Please records. Do not roll back versions or
   release history to this branch's older values.
8. `b4a02a30` (#126): GitHub-hosted `ubuntu-24.04` release publishing and pinned
   `actions/checkout` for npm trusted-publishing provenance. Keep exact-tree
   evidence selection and release tests; do not restore the old release runner.
9. `4d4e752f` (#128): STE instructions for all agent responses.
10. `ff376d71` (#125): imported plain CSS and rename-only CSS Modules; renderer
    and entry-root bundles, first-reachability ordering, renderer exclusion at
    every import depth, exact scoped-selector/escape checks, `empty` loader
    opt-outs, source mapping and authored diagnostics. Preserve PostCSS ESM/CJS
    loading, isolated state, dependency/alias privacy and worker-failure rules;
    asset formats/MIME/raw bytes, resource URL parsing, scoped npm assets,
    generated byte evidence and delivered-source attribution. Keep all
    `build_imported*`, `build_module*`, `css_module*`, `build_postcss*`,
    `postcss_*`, `imported_styles*`, `serve_imported*`, `export_imported*`,
    publication/publish imported-binary, watch-dependency and browser stylesheet
    regressions. Preserve Tailwind/Autoprefixer examples and packed CSS smoke,
    dependencies/lockfile security patches, `compareCodeUnits` and its locale
    ban. Keep the repository quality gates: 300-line TS/JS and 250-line protocol
    limits with existing reviewed caps; unused/internal/public export ratchets;
    module ownership and CLI boundary tests; Markdown link/history tests;
    script declaration type checks; PR-title validation; complete test discovery;
    CI evidence, workflow, native and hydration suites. Preserve main's two-parent
    merge/remerge-diff review rule in `AGENTS.md`.
11. `b2c82c15` (#120): strict route-scoped live shell bootstraps; complete public
    catalogue and private Usage evidence; Loading/Failed/Try again states;
    current-request ownership after A → B → A; atomic navigation/refresh
    adoption; serialize-once/zero-in-browser behavior; shared hydration bundle;
    exact captured-scope validation; complete static external catalogue and
    normalized output invariance; the 1 MiB real-example limit. Keep scoped
    reader/host tests, `captured_shell_scope`, `server_route_scoped_bootstrap`,
    route-scoped browser/return tests, static hydration and size invariance
    tests, and mobile/desktop loading mockups. Version/path changes may alter
    expected bytes, but must not weaken scope, privacy, identity or size checks.

Main-only protocol names above and in the new contracts are plain text, not
links. Milestone 11 must import them before adding links. The test names denote
whole matching families, including helpers and browser/package counterparts;
they are preservation requirements, not a reduced validation selection.

### Mainline audit refresh for Milestone 11

Source tip fetched for the first merge:
`800fe9f88a0173429b25baa1bcf41ed9e59b2256`.
Pre-merge implementation checkpoint: `6df09b371ef2363440bd12ee1865af11eed747c0`.
The merge base remains `bf9e3c9a4151fedacf8c7db5bc957609689a348b`.
Audit `git diff --name-status b2c82c15..800fe9f8` in addition to the 11-commit
preservation list above. Fetch again before the merged push; record and merge
any new source commits before rerunning the required full gate.

12. `1dc91580` (#130): preserve the dependency-audit runner, evaluator,
    lockfile/path validation, declarations, fixtures and all audit tests.
    Preserve the exact dev-only GHSA-vfj7-8cjw-p6xm exception through
    2026-11-03 UTC, including expiry, stale-record rejection, sole-dependent
    checks and failure on other advisories or production paths. Keep the new
    dependencies:check command and strict exception-free packed-consumer audits
    unchanged. Preserve security/release/CI documentation and package tests.
13. `800fe9f8` (#129): preserve repository/realpath-scoped output-lock exclusion,
    holder/token validation, bounded wait/cancellation, dead-holder reclaim,
    release and directory-removal race handling. Adapt the lock to encompass
    one complete generated-tree transaction: validation, staging, backup,
    replacement, rollback and cleanup. Every explicit writer acquires it:
    build, build --watch and the Serve parent for serve --build. Preserve
    output.lock timings and cancellation that stops lock waiting, not an
    already-started transaction. Plain Serve, export and publication use
    in-memory output and must neither write nor acquire this writer lock.
    Preserve independent export input-stability and cancellation fences.
    Keep output_lock.ts and output_lock_file.ts guarantees and the concurrency,
    lock-wait, native lock, baseline-directory race, timing and watcher tests;
    adapt mode/disk-output expectations only under the approved output contract.
    Keep the frame_session_usage.ts race fix, mount-hook integration, fake
    adapters/harness and frame_hook_usage_race.spec.ts assertions. Preserve
    all other #129 fixes, including baseline mkdir retries and open-stream
    watcher tests. Do not implement Milestone 12 or 14 while resolving this merge.

The user explicitly authorizes replacing main's export write/read-lock path
with in-memory export and publication capture. Record these adaptations and
all other main-relative removals by path in the merge commit and this plan.
This does not authorize removing the writer lock, the frame race fix, an audit
check or any unrelated mainline test.

### Fixed decisions for implementation

- Use private manifest 8, extending v7 entries with closure/blob fields and
  exact binary-byte hashes. Correction 3 A supersedes the earlier reader design:
  only v8 content is readable. Use `generated-v8` descriptors and completion
  markers; older completed caches can only prove incompatibility. Preserve
  main's exact product copy and command outcomes for every older base.
- Reserve `styles` and `assets` case-insensitively for HTML first segments,
  with the exact `build-invalid` error in the unified-output contract. One
  pending-output/closure resolver owns references; no stale-disk fallback.
- PostCSS directory scans always skip generated output. Explicit generated
  dependencies still fail. Consumer scanners must also exclude it from their
  own content reads; output tracking never changes these rules.
- Add `VIEWER_DIRECTORY` beside the existing generated constant. Rename the
  nested `__generations` to `generations` as required by decision 30's rule
  for fixed Mokly path segments. No old-path aliases are deployed; authored
  names retain main's existing rules and the documented host caveat.
- Use public catalogue 4, delivery 4, a newly versioned bootstrap 1, ownership
  3 and upload metadata 2. Keep Plan response 1 and comparison result 4.
  Marker/upload gates make older receivers reject both current-only and
  Changes-enabled artifacts before path interpretation. Ship updated fixtures;
  Cloud's matching receiver/viewer rollout is an external follow-up.
- Use `mokly/no-directory-literals`; keep `no-restricted-syntax` for `main`'s
  unchanged locale ban. Probe the actual merged config in every matched folder
  and every exact-file selector. Enable default `import/no-duplicates` and
  apply its fixer without changing runtime behavior.

### Authorized replacements and deferred work

Decision 28 replaces main's split page/CSS roots and duplicate directory
constant, committed/derived writer/capture branches, Git-ignore committability
checks, mode-specific PostCSS directory scanning, per-file orphan ownership
inside the fully disposable tree. Their
tests must change to prove the new contract, not disappear. Preserve every
non-mode CSS, path, privacy, confinement, transaction and invalid-version check.
This branch's previously authorized removal of `generatedOutput`,
`publicExclude`, directory-wide public scans and ownership-header authority
remains in force; main's new code must not restore them. Historical headers
remain readable as data, never ownership proof.
Entry modules may remain below `mockupsDir` as protected authored sources.
Preserve the branch's rejection of `entriesDir` equal to `mockupsDir`, including
real-path aliases. The conflicting guide text is open finding 17; this work
does not change that guide or resolve the finding.

Decisions 29 and 33 replace the directory `no-restricted-syntax` options and
duplicate import declarations only. Decision 30 replaces `__mokly/` and
`__generations/` URL contracts and their public format versions; older artifact
uploads/viewers must reject with the defined version error. Decision 31 only
corrects the naming policy and marker exception. Milestone 9 removes no runtime
feature or test; it moves the existing v6 manifest prose into its focused
contract and removes the CSS follow-up already delivered on main.

Correction 3 A authorizes removing this branch's pre-v8 content readers,
legacy flat reader/harvest, old-schema adapters and cross-layout URL
normalization during Milestone 11. It preserves main's earlier-baseline outcome
with threshold v8 and all deletions already on main. Finding 32 B changes only
route-prefix/version-policy documentation; finding 34 C is Milestone 14 test
preparation work. All other unapproved findings, including finding 17, remain
deferred.
Do not apply separate fixes under the merge. If a contract collision forces a
change in one of those areas, make the smallest correct integration change and
record it by path in the merge commit and milestone report. Milestone 15's
final review belongs to the orchestrating agent after the final push.

## Milestone 10: Give the directory-name check its own lint rule

### Milestone 9 review corrections

1. [x] Correct the `entriesDir` equality claim to match current code, verify
       the other current-branch claims in the four new contracts, and preserve
       finding 17 for the user's decision.
2. [x] Limit the new naming rule to fixed names Mokly chooses. Preserve
       existing rules for authored names, document the hosting caveat, and specify
       example-artifact regression tests plus a unit test of Mokly's fixed names.

Commit these documentation corrections before the Milestone 10 code commit.
Historical-reader correction 3 is now decided as A in the decisions above.
The user accepted the subsequent contract update and authorized its separate
documentation commit before Milestone 10. Milestone 11 follows those commits.

Current-branch claims were checked against the implementation, not the guides:

- `mokly-unified-output.md`: `src/config/path_validation.ts` rejects equal
  shorthand/catalogue roots and real-path aliases; entry discovery and
  `src/config/public_files.ts` retain nested source protection. The generated
  constant is owned by `packages/viewer/src/catalogue/delivery_paths.ts`.
  `src/build/output_store.ts`, `tracked_output.ts`, `transaction.ts`,
  `src/server/static_routes.ts` and `src/export/public_files.ts` confirm the
  index boundary, generated-tree writer, in-memory static reads and closure
  capture. Imported CSS and the merged layout remain future targets.
- `mokly-generated-manifest.md`: `src/build/compile.ts`,
  `src/registry/manifest.ts`, `manifest_validation.ts` and `blob_hash.ts`
  confirm the current v6 fields, current/historical reader split and Git blob
  hashing. `src/review/prepare.ts`, `tree_inventory.ts` and
  `src/baseline/manifest.ts`, `catalogue.ts`, `cache_layout.ts`, `harvest.ts`
  confirm current lookup, inventory diagnostics, descriptors and harvest.
  At this audit the historical-reader target was unchanged pending correction 3. The later A decision now supersedes it; other open findings stay deferred.
- `mokly-viewer-namespace.md`: `src/publication/removed_previews.ts`,
  `src/publish/manifest.ts`, `src/export/ownership.ts` and the viewer's catalogue
  reader confirm the old namespace and strict current versions. New namespace,
  version gates and main's delta exchange remain targets, not current-branch
  claims. The fixed-name policy now excludes user-chosen names.
- `mokly-directory-lint.md`: `eslint.config.js` and `package.json` confirm the
  existing literal guard, covered roots and installed import plugin. The local
  rule is Milestone 10 work; main's locale ban and merged folder coverage remain
  later work. No extra current-branch behavior is asserted.

Backend. This runs before the merge, so `main`'s `no-restricted-syntax`
block and this branch's check never share one ESLint rule.

Status: complete. The user accepted the sole pre-merge audit failure for
GHSA-vfj7-8cjw-p6xm and authorized this code commit before the main merge. Documentation corrections were
committed and pushed as `f8f64e8f756fcc2a7b32b7eb69df8e38b8c4a354`.

- [x] Replace the `no-restricted-syntax` directory-name check with the local
      ESLint rule, and prove that a string, a template, and a
      regular-expression literal are reported.
- [x] Record the orchestrator's decision on the dependency-audit blocker
      before committing the code. Do not change dependency versions without
      separate authorization.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

Validation: the ten focused lint tests pass. Under Node 22.14.0, formatting,
lint and type checks pass; `npm test` passes 2,251 tests with no failures,
skips or cancellations; all 689 browser tests pass; example Check validates
310 untracked files. The initial Node 24.14.1 unit run had one native runtime
crash, `FATAL ERROR: v8::ToLocalChecked Empty MaybeLocal`; the isolated watcher
retry passed both tests, and the complete run passed on Node 22.14.0.

`cargo xtask check` was run and retried. Both attempts stop at
`npm run dependencies:check` with 13 high-severity findings from the `braces`
chain (GHSA-vfj7-8cjw-p6xm); the final audit reports `No fix available`.
The audited `HEAD` and `origin/main` lockfiles both contain `braces` 3.0.3,
`micromatch` 4.0.8 and `react-native-worklets` 0.8.3. No dependency or gate
configuration was changed before the merge. The user approved committing
Milestone 10 with this sole audit failure; all other required functional
commands passed. No final implementation review has run. Historical-reader correction 3 was later decided as A, and its
documentation is updated without starting Milestone 11 or making a commit.

User-approved checkpoint exception: #130 on main supplies the existing,
expiring dev-only audit exception through 2026-11-03. Do not change package
versions, the audit command or audit policy before merging it. This approval
applies only to the Milestone 10 commit/push; Milestone 11 must pass the full
gate, including the audit, before any merged tip is pushed. The captured
pre-merge gate output is reproduced exactly below:

```text
$ npm run dependencies:check

> @mokly/mokly@0.12.0 dependencies:check
> npm audit --audit-level=low --include=prod --include=dev --include=optional --include=peer

# npm audit report

braces  *
Severity: high
braces vulnerable to stack-exhaustion denial of service through deeply nested patterns - https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
No fix available
node_modules/braces
  micromatch  >=0.2.0
  Depends on vulnerable versions of braces
  node_modules/micromatch
    metro-file-map  *
    Depends on vulnerable versions of micromatch
    node_modules/metro-file-map
      metro  >=0.71.0
      Depends on vulnerable versions of metro-config
      Depends on vulnerable versions of metro-file-map
      Depends on vulnerable versions of metro-transform-worker
      node_modules/metro
        @react-native/community-cli-plugin  *
        Depends on vulnerable versions of @react-native/metro-config
        Depends on vulnerable versions of metro
        Depends on vulnerable versions of metro-config
        node_modules/@react-native/community-cli-plugin
          react-native  >=0.73.0-nightly-20230506-1af868c52
          Depends on vulnerable versions of @react-native/community-cli-plugin
          Depends on vulnerable versions of @react-native/virtualized-lists
          node_modules/react-native
            @firna/ui  *
            Depends on vulnerable versions of react-native
            node_modules/@firna/ui
            @react-native/virtualized-lists  >=0.85.0-nightly-20260108-1236b6be4
            Depends on vulnerable versions of react-native
            node_modules/@react-native/virtualized-lists
            react-native-reanimated  4.1.7 || >=4.2.3
            Depends on vulnerable versions of react-native
            node_modules/react-native-reanimated
        metro-config  >=0.71.0
        Depends on vulnerable versions of metro
        node_modules/metro-config
          @react-native/metro-config  *
          Depends on vulnerable versions of metro-config
          node_modules/@react-native/metro-config
            react-native-worklets  >=0.8.0-bundle-mode-preview-1
            Depends on vulnerable versions of @react-native/metro-config
            Depends on vulnerable versions of react-native
            node_modules/react-native-worklets
        metro-transform-worker  >=0.71.0
        Depends on vulnerable versions of metro
        node_modules/metro-transform-worker

13 high severity vulnerabilities

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.
[xtask/command] `npm run dependencies:check` failed with status 1
```

## Milestone 11: Merge `main` and unify the generated directory

Backend. Status: complete.

Merged source tip: `800fe9f88a0173429b25baa1bcf41ed9e59b2256`. The final fetch
confirmed that main had not moved. Conflicts were resolved path by path. The
full gate passes, including main's audit exception and strict packed-consumer
audits. An authorized local merge checkpoint supplied a v8 HEAD for main's
unchanged browser comparison assertions. The final merge keeps exactly two
parents; its remerge resolutions and all later edits were checked before push.

The first complete unit diagnostic run reported 3,658 passes and 25 failures.
Fixture paths, explicit metadata injection and version assertions have been
corrected. Its obsolete negative startup test opened listeners, so that test
process was stopped; the runner then reported
`Error: assigned and observed files do not match`. The first browser diagnostic
was stopped after 399 passes, 52 failures, one interruption and 511 tests not
run. It exposed an authenticated preview URL mismatch, fixed with the shared
path helper and a red/green transport regression. The focused browser rerun
passed 87 of 91 cases; the two further path fixes then passed all ten focused
cases. The two design-status assertions pass against the committed v8 HEAD. These diagnostic
runs are not accepted full gates.

All 19 paths deleted by main remain absent. The audit runner and exception,
package and lock files, output-lock implementation, baseline directory-race
fix and frame-session race fix match main. Its frame-usage race browser test
passes. Disk, Serve, npm dev and static-export smoke tests load the imported
styles and image. Serve/export leave local output unchanged. A real rebuild
pinned to `800fe9f8` returns `baseline-incompatible-earlier`. Smoke servers have
been stopped. The exact final command results are recorded below.

- [x] Split touched test files that exceed main's 300-line limit. Preserve every
      case, hook, deadline and fixture cleanup; record test inventories after the
      split. This does not perform Milestone 14 global baseline preparation.
- [x] Record the example imported-image move outside the catalogue root, the
      v8 comparison resource namespace, and the bundled navigation asset graph.
      These preserve main's imported-asset privacy and browser module closure.

Authorized main-relative removals (decision 28 and the previously approved
output simplification): `src/build/committable_output.ts`, `ownership.ts`,
`tracked_ownership.ts`, and `src/config/public_exclusions.ts`; whole-tree writes,
index-based Check and the authored closure replace those mode/header/exclusion
paths. `tests/build_check_unclaimed.test.ts` is replaced by whole-tree extra-file
and stale-file coverage. Header parser/owner-specific assertions in
`tests/build_ownership.test.ts` now test the plain marker and nonmaterial historic
notices. Git-ignore tests now prove builds are independent of committability and
Check uses actual index membership. Export lock-wait tests now prove lock-free
memory capture while a writer owns the lock. Preserve all other writer-lock
and frame-usage tests.

The whole-tree transaction also removes unused per-file safety and empty-directory
pruning functions from `src/build/reserved_tree.ts`. Full-tree safety remains at
writer and tracked-Check boundaries. `src/build/transaction.ts` keeps its locked
helper private because export no longer calls a writer (decision 28 and the
explicit #129 integration instruction). Main's internal-only `fixtureRecord`
and `extractSourceSetReferences` stay private in `scripts/large/setup.mjs` and
`src/html_references.ts`.

Merge cleanup removes unused branch-only `src/registry/generated_routes.ts`,
`src/review/component_classification_context.ts` and `src/server/http_request.ts`.
Main's manifest inventory, component classification modules and
`http_request_handler.ts` own their retained behavior. These are internal
adapters, not removed product features. The internal-export ratchet verifies
that the merge leaves no new unused exports.

Correction 3 A removes branch-only `src/review/normalize_urls.ts`,
`snapshot_dependencies.ts`, `tests/review_cross_layout.test.ts`, legacy reader
branches and old content-schema adapters. Snapshot resource copying is retained
in `src/review/snapshot_resources.ts`, with catalogue-relative generated and
authored paths; there is no cross-layout document rewrite. Main's deletions
remain deleted.

Selected authored symlinks now follow the approved regular-file closure rule:
`tests/changes_asset_aliases.test.ts` and `tests/publication_asset_aliases.test.ts`
replace main's selected-alias materialization cases with rejection/private cases.
Safe source/input fingerprint aliases remain supported. Direct Changes tests use
retained accepted generations for deleted resources; fresh compilations still
reject missing references. This preserves main's live deletion classification.

The ordinary-preview fixture imports the canonical action and toolbar entry
modules. Its narrowed graph must still include all Tailwind-scanned authoring
inputs now that they sit under the catalogue root. Main's PostCSS public-file
denial remains unchanged. This is fixture correctness, not shared global setup.

The imported example image moved from
`examples/basic/src/components/workspace-note/signal.png` to
`examples/imported-assets/workspace-note-signal.png`, because this branch's
catalogue root contains the example's `src/`. Keeping the image outside that root
preserves main's imported-asset privacy rule. Fixture copies and CSS references
follow the move. Navigation assets are bundled separately for browser delivery
so shared path/version helpers do not create missing deployed module imports.
Authored HTML whose catalogue-relative name equals a generated-relative name
receives untrusted-document stripping, never generated navigation or inspector
authority. This required namespace distinction preserves main's authentication
contract under decision 28; dedicated Serve/export regressions cover it.

- [x] Adapt main's split packed-consumer smoke fixtures and independent
      catalogue reader to v8 paths and the required public generated prefix.
      Remove fixture-only output modes, give the clean-cache consumer its own Git
      root before Check, and commit its regenerated renamed-config baseline.
      Preserve all six scenarios, API/type checks, binary checks and strict audits.

- [x] Preserve main's private-directory denial for authored `styles/` and
      `assets/` paths. Only accepted files under the generated prefix may bypass
      that authored-file rule. Remove the now-unused shape-only public-generated
      helper in `src/build/styles/routes.ts`; the accepted-output set replaces it.
      Add a regression for authored dependency/build folders and their distinct
      accepted generated counterparts.

- [x] Align the live preview transport's authenticated response path with the
      generated resource prefix. Keep generation, render-token and selected-view
      checks; prove edits, forwarded hosts, reset and expiry in real browser tests.
- [x] Retain main's nested authored-document security fixture as an authored
      closure file. Update static and snapshot test addresses while preserving
      native navigation, inspection and sandbox assertions.

- [x] Record the source tip and merge base, merge `origin/main`, resolve
      conflicts path by path while preserving every feature listed in
      Milestone 9, and record every authorized removal in the merge commit.
- [x] Merge and reconcile the main-only protocol pages named in Milestone 9,
      then add their links. Preserve the current README and guide contracts
      while replacing only the authorized layout, modes and version clauses.
      Include `mokly-baseline-compatibility.md`, retaining its earlier-version
      outcome with the approved v8 threshold.
- [x] Preserve #130's audit implementation/data/tests and strict consumer audits
      unchanged. Adapt #129's output lock around every whole-tree writer, keep
      in-memory nonwriters lock-free, and preserve its frame-usage race fix.
- [x] Implement the Milestone 9 layout and manifest: one constant,
      generated stylesheets and assets relative to the generated directory,
      reserved route segments, the shared reference rule, and imported CSS
      with Git-index tracking, in-memory head output, per-commit baselines,
      and the opt-in writers.
- [x] Implement correction 3 A: only v8 current/baseline readers; detect committed
      v2–v7 envelopes and former-name sentinels without rebuilding; detect earlier
      output after its own rebuild; retain main's exact typed outcome, product
      copy and Serve/export/publication behavior.
- [x] Keep v8 inventory verification, per-commit blob/rebuild selection and bounded
      moved-root discovery. Implement the documented old-cache compatibility probe
      and identity checks; write only v8 completed caches and clean up rejected
      rebuilt output without harvesting it.
- [x] Remove this branch's pre-v8 readers, old-schema adapters, legacy flat
      reader/harvest and cross-layout URL normalization. Keep ordinary resource
      resolution and every mainline deletion; do not restore removed legacy
      fixtures or APIs. Record the affected paths and approved removals.
- [x] Test committed, rebuilt and cached earlier bases; malformed/newer versions;
      v8 complete/incomplete inventories and moved roots; exact once-per-base
      unavailable copy; current-only exports/publication and recovery to a v8 base.
- [x] Reconcile generated-prefix documentation with kind/id-derived HTML paths
      and strict catalogue v4. Add no new validation for finding 32; retain the
      separately approved styles/assets reservation and main's path helpers.
- [x] Update the tests and fixtures from both sides. Add tests that page
      routes cannot collide with `styles/` or `assets/`, and that a page loads
      its imported stylesheet from disk, through Serve, and in an export.
- [x] Smoke test the example: build, `check`, Serve with Changes against
      `origin/main`, an export served by a static file server, and a screen
      with imported CSS that is styled in all three.
      If the pinned base predates v8, expect the documented unavailable state;
      use a separate v8 fixture to prove actual comparison delivery before merge.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

### Final validation and preservation evidence

All commands ran under Node 22.14.0 with temporary files under `.context/tmp`.

| Command                 | Result                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`  | Pass.                                                                                                                                                                 |
| `npm run lint`          | Pass.                                                                                                                                                                 |
| `npm run typecheck`     | Pass, including viewer and script declarations.                                                                                                                       |
| `npm test`              | 3,686 pass; zero failed, skipped or cancelled.                                                                                                                        |
| `npm run test:browser`  | 963 pass, including hydration; 24.3 minutes.                                                                                                                          |
| `npm run example:check` | 436 valid untracked files.                                                                                                                                            |
| `cargo xtask check`     | Pass: audit, formatting, lint, ratchets, Rust checks, package inspection, six packed-consumer scenarios, 3,686 unit tests, 740 browser cases and 223 hydration cases. |

`node --import tsx --test tests/markdown_links.test.ts tests/protocol_doc_history.test.ts tests/protocol_doc_sizes.test.ts`
passes all six checks. The final diff passes `git diff --check`. The file-length
and export ratchets pass without new exemptions or raised protocol caps. All
30 moved example stylesheets match main after formatting. Sixteen test-file
refactors retain their 143 recorded test statements, hooks and cleanup. All
19 mainline deletions remain absent. The audit runner/exception, package and
lock files, output-lock implementation and frame-session race fix match main.

The first `cargo xtask check` stopped at its packed-consumer smoke. Two old-path
reads were then corrected without removing assertions or changing audits. Their
exact errors were:

```text
Error: ENOENT: no such file or directory, open '/home/vercel-sandbox/mokly/.context/package-smoke-BHXOmg/esm-consumer/mockups/screens/packed-home.desktop.html'
[xtask/command] `npm run package:smoke:prepared -- --artifacts .context/verification/package-artifacts` failed with status 1
Error: ENOENT: no such file or directory, stat '/home/vercel-sandbox/mokly/.context/package-smoke-RgKhlA/esm-consumer/published/static/screens/packed-card.mobile.html'
```

The corrected packed smoke passes all six scenarios. The complete `cargo xtask
check` retry passes in 2,728.33 seconds. Its audit output is:

```text
Accepted dependency risk: GHSA-vfj7-8cjw-p6xm; package: braces.
Path: node_modules/metro-file-map -> node_modules/micromatch -> node_modules/braces
End date: 2026-11-03 UTC; 31 days left.
Reason: Dev-only React Native peer dependency. The repository does not run Metro or send untrusted patterns to it. No patched release is available.
Tracking: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
```

The full browser diagnostic before the final passing run reported 949 passes,
two ordinary-preview setup failures and 12 cases not run. The exact setup error
was:

```text
MoklyError: [mokly/build-invalid] PostCSS plugin @tailwindcss/postcss scanned a public mockups file in examples/basic/src/components/workspace-note/utilities.css: examples/basic/src/components/action/action.mockup.tsx; exclude mockupsDir from the plugin's sources (Tailwind: @source not "../../..")
```

Canonical entry imports fixed that fixture while retaining the privacy check;
all 14 affected browser cases and both complete browser gates then passed.
The private-directory regression also failed before its fix: the expected
`/private build or dependency directory/` diagnostic was an empty string. The
corrected guard admits only actual generated counterparts. Its 14-test export
and publication group passes. The old shape-only `isPublicGeneratedRoute`
helper was removed from `src/build/styles/routes.ts`; the accepted-output set
now owns that authorization, as required by decision 28.

The partial clone emitted this nonfatal remerge diagnostic, including on one
retry:

```text
fatal: remote error: upload-pack: not our ref 4fdf3756a8a41e7946e5716a52c0ffdd38efd177
```

The offline remerge run produced the same complete patch. Both commands exited
zero. The initial merge had 621 remerge paths; the path ledger, main-relative
patches, test inventory and final amendment were reviewed. No final
implementation review has run; that remains the orchestrator's Milestone 15.
Milestones 12–14, finding 17 and other unapproved findings remain untouched.

## Milestone 12: Rename the `__mokly/` namespace to `mokly-viewer/`

Backend.

- [x] Define the name once, import it everywhere, and extend the local lint
      rule to it.
- [x] Rename the Serve routes, export and publication paths, viewer URLs,
      and upload archive paths, and apply the Milestone 9 compatibility
      contract.
- [x] Extend the example-artifact export and upload regressions: no path
      segment starts with `.`, `_`, `#`, or `~`, except the root
      `.mokly-export-artifact` marker. Add a unit test for the fixed deployed
      names Mokly chooses. Preserve existing validation of user-chosen names;
      do not turn the example assertion into a new consumer path rejection.
- [x] Smoke test Serve, an export served by a static file server, and a
      publication archive.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

### Implementation decisions and preservation

The source tip was `800fe9f88a0173429b25baa1bcf41ed9e59b2256` at the start
and at the final refresh. No further main merge occurred in this milestone.

- Decision 30 C replaces all public `__mokly/` paths and nested `__generations`
  paths with `mokly-viewer/` and `generations/`. There are no deployed aliases.
  Live capabilities, authentication, retained generations, immutable comparisons,
  content-delta Plan v1, Blob accounting and Complete semantics remain intact.
- Ownership v3 and upload v2 replace the earlier accepted versions, including
  current-only artifacts. The former ownership-v2 fixture moves to
  `docs/protocol/fixtures/export-ownership-v3.json`; all digest, size, collision
  and classification cases remain, with an explicit unsupported-v2 case added.
  Older local markers fail before mutation and identify the unsupported version.
- The version contract authorizes the new exact HTTP-426 product message.
  Standalone loaders preserve typed version errors, retain server-rendered content
  and links, and show the compatibility alert. Embedded loaders emit
  `onError({ code: "version", message, details })`; details retain the diagnostic.
  The complete error type moves from the long viewer document into the focused
  namespace contract, with a type reference retained in the viewer API example.
- The strict literal guard also covers existing `mokly-viewer` CSS class strings.
  These import the shared constant; rendered classes and identifiers keep their
  existing values. `__moklySource` and other unrelated names remain unchanged.
- Correction 2 adds no consumer path rejection. Authored names, ids and mirrored
  repository paths keep their existing rules. Provider `_headers`, `_redirects`
  and the repository adapter marker remain optional metadata, not visitor
  dependencies. Fixed-name unit tests and example export/upload inventories
  enforce the approved naming scope.
- File-size checks require moving only helpers and complete tests:
  `tests/publish_run.test.ts` shares setup through
  `tests/helpers/publish_exchange_fixture.ts`; browser removed-preview observers
  move to `tests/browser/removed_preview_observers.ts`; the existing renamed-screen
  preview test moves to `tests/preview_comparison_routes.test.ts`. No test is removed.
  Updating the upload fixture in the 582-line `tests/guides_ci.test.ts` also
  requires splitting its existing checks into `tests/guides_ci_verification.test.ts`
  and `tests/guides_upload_validation.test.ts`, with shared inputs in
  `tests/helpers/guides_ci_context.ts`. All eleven original guide checks remain.
  Two branch-only lint test title templates gain the directory name because both
  constants now use the same probes. Milestone 13 folder expansion is untouched.
- No additional main feature, test or document is removed. The five deletions
  authorized in Milestone 11 remain unchanged. Main's audit runner, exception,
  strict packed-consumer policy, output writer lock and frame usage fix remain.
  The Cloud receiver/viewer rollout remains a non-blocking post-merge follow-up.

### Smoke evidence

All commands use Node `v22.14.0` first on `PATH`. Scratch evidence is under
`.context/milestone-12/`. The focused real example uses committed v8 baseline
output and includes a removed page, removed screen variant, imported CSS and PNG.

- Serve: `http://127.0.0.1:41765/view/screens/example-welcome.html` is styled.
  The new catalogue, shell CSS, authored CSS, compiled CSS and PNG return 200.
  The old catalogue endpoint and private generated manifest return 404.
- Export top-level names before removing the marker:
  `.mokly-export-artifact`, `404.html`, `index.html`, `mokly-viewer`, `static`, `view`.
  All 142 exported files have no segment beginning with `.`, `_`, `#` or `~`
  except the permitted `.mokly-export-artifact` root marker.
- After removing that marker, a plain static server loads
  `http://127.0.0.1:35037/mokly-viewer/catalogue.json` and the styled screen.
  Browser responses have no HTTP errors. No routing rewrite is required.
- Publication: one Plan, 112 Blob requests and one Complete succeed.
  All 143 reconstructed files equal the local publication bytes. Ownership is
  v3 and upload metadata is v2. Its only prefixed segment is the optional marker.
- All smoke servers and browsers stop in cleanup. No generated output is tracked.

### Validation and completion

Completed with Node `v22.14.0` first on `PATH` and `TMPDIR` under `.context/tmp`.
The final full gate passed. These timings include command preparation:

| Command                                                                  | Result                                            |  Seconds |
| ------------------------------------------------------------------------ | ------------------------------------------------- | -------: |
| `npm run format:check`                                                   | pass                                              |   24.067 |
| `npm run lint`                                                           | pass                                              |   16.817 |
| `npm run typecheck`                                                      | pass                                              |   35.824 |
| `npm test`                                                               | 3,703 passed; no failures, skips or cancellations |  951.230 |
| `npm run test:browser -- --output .context/milestone-12/browser-results` | 969 passed                                        | 1492.684 |
| `npm run example:check`                                                  | 436 valid, untracked files                        |   10.654 |
| `cargo xtask check`                                                      | pass                                              | 2753.591 |

The complete cargo gate includes 15 Rust tests, six packed-consumer scenarios,
another 3,703 unit tests, 746 browser tests and 223 hydration tests. The repository
audit uses main's unchanged `GHSA-vfj7-8cjw-p6xm` dev-only exception, expiring
`2026-11-03`. Strict packed-consumer audits retain no exception. Markdown links,
protocol sizes and source-file limits also pass. Raw receipts, per-file notes,
screenshots and smoke inventories are under `.context/milestone-12/`.

The initial full unit run passed 3,699 of 3,703 tests and found four outdated
expectations. Their exact failure messages were:

```text
9553 !== 9550
3 !== 2
[mokly/upload-unsupported-version] Use a receiver and Mokly version that support upload v2.
The input did not match the regular expression /unavailable/. Input:
'MoklyVersionError: Unsupported Mokly delivery version undefined; this viewer supports version 4.'
```

The canonical fixture byte/hash, ownership version, guide upload fixture and
delivery error expectations now match the approved contract. Focused checks
passed, followed by the complete passing gate above. Earlier failure tests proved
the old namespace/version behavior and exposed the swallowed delivery-version
error before its fix. File-size failures were resolved by the test splits above.

The commit records the authorized namespace/version removals and fixture move.
The branch check precedes commit and push. Milestones 13–15 remain open; the
orchestrator owns the final review. No final implementation review ran here.

## Milestone 13: Lint coverage after the merge

Backend.

- [x] Add tests that probe every folder covered by the directory-name rule
      and by `main`'s `localeCompare` rule, so that neither rule can stop
      applying without a test failure.
- [x] Enable `import/no-duplicates` and apply its automatic fix to the
      merged code.
- [x] Preserve mixed-import runtime semantics, split the newly touched oversized
      browser test without losing titles, and update its source-location check.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; commit and push.

### Implementation and preservation

The tests enumerate tracked and non-ignored new source files independently of
ESLint's configured globs. They derive 48 directory probes across all covered
folders and extensions, including both TypeScript roots and a nested preview
script. Seven source-order probes cover both recursive folders, all three exact
build files and two synthetic nested folders. Each probe uses `lintText` with
the repository's real flat config; no synthetic source file is written to disk.
Configuration and ignore checks reject missing rules and ignored-file results.

Every directory probe checks both constants through ordinary, embedded, template,
regex and escaped spellings, plus valid imports. Source-order probes require
both rule IDs on the same input and permit `compareCodeUnits`. Presentation
collation remains outside that ban. Separate tests retain the owner-module
exemption and Git-ignore/generated-output exclusions.

`import/no-duplicates` uses the installed plugin's default options at the global
import-rule scope. `npx eslint . --fix` applied the fix to the whole merged tree.
Fixer tests cover each production root and tests, including type-only imports
with a retained side-effect import. No suppression, forwarding module, package
ownership change or main feature/test removal was required.

Before enabling the rule, all seven duplicate-import tests failed with the
expected diagnostic, including:

```text
src/lint-coverage-probe.ts: missing import/no-duplicates
```

After enabling it and applying the automatic fix, all 66 new coverage/fixer
checks passed. Receipts and the complete probe inventory are under
`.context/milestone-13/`. Full-gate and commit results follow below.

The first type check caught the installed fixer's mixed type/value bug:

```text
src/shell/catalogue.ts(16,3): error TS2206: The 'type' modifier cannot be used on a named import when 'import type' is used on its import statement.
```

The affected imports in viewer `shell/catalogue.ts`, CLI `export/site.ts`,
`registry/changed_ids.ts` and `server/component_changes.ts` were normalized from
their original semantics into explicit type-only/value statements, then the
default fixer ran again. Type-only emission and runtime bindings have separate
regressions. No plugin option or suppression was added.

The import fix also exposed the existing 896-line `tests/browser/browse.spec.ts`
to the changed-file cap. Its 33 test bodies and assertions remain unchanged,
split between that file and `browse_search_details.spec.ts`,
`browse_view_controls.spec.ts`, `browse_toolbar_actions.spec.ts` and
`browse_layout.spec.ts`, with shared helpers in `browse_assertions.ts`.
Worker count, retry policy, test deadlines and fixture setup remain unchanged.

### Validation and completion

The final gate passed on Node `v22.14.0`. A direct comparison also proves that
all 17 production modules changed by the fixer retain their bodies and emitted
runtime imports. The test-title audit found no missing title. All 69 new lint
coverage/fixer checks pass, and the source-size gate passes for 903 files.

| Command                                                                  | Result                                  |  Seconds |
| ------------------------------------------------------------------------ | --------------------------------------- | -------: |
| `npm run format:check`                                                   | pass                                    |   24.485 |
| `npm run lint`                                                           | pass                                    |   19.386 |
| `npm run typecheck`                                                      | pass                                    |   36.096 |
| `npm test`                                                               | 3,772 passed; no skips or cancellations |  947.311 |
| `npm run test:browser -- --output .context/milestone-13/browser-results` | 969 passed                              | 1513.997 |
| `npm run example:check`                                                  | 436 valid, untracked files              |   10.530 |
| `cargo xtask check`                                                      | pass                                    | 2880.691 |

The cargo gate also passes 15 Rust tests, six packed-consumer scenarios, another
3,772 unit tests, 746 browser tests and 223 hydration tests. The dependency audit
and strict packed-consumer audits retain main's existing policy unchanged.

The first full unit run found one source-location assertion after the browser
split. It reported:

```text
The input did not match the regular expression /browser\.newContext\(\{\s+baseURL,/. Input:
```

`tests/deployment.test.ts` now reads `browse_layout.spec.ts`, which owns the
unchanged no-JavaScript test. Its three focused checks pass, followed by the
complete passing gate above. No test or main feature was removed.
The final main refresh remains `800fe9f88a0173429b25baa1bcf41ed9e59b2256`;
no merge occurred. Commit and push precede all Milestone 14 implementation.

## Milestone 14: Prepare shared browser baselines once

Test infrastructure. Implement finding 34 C under the
[fixture preparation contract](../docs/protocol/ci-fixture-preparation.md).
The product and every existing UI assertion remain functional throughout.

- [x] After the merge, audit every browser fixture and indirect helper that
      rebuilds the same unchanged example baseline. Record all consumers, starting
      with today's static-example and design-library-export fixtures.
- [x] Record the merged branch's browser-suite time, full test inventory and
      fixture phases before changing preparation, with runtime, worker/shard and
      cache conditions recorded for a comparable after measurement.
- [x] In Playwright global setup, create the example baseline repository and its
      real rebuilt v8 cache once before tests start. Publish the validated run
      descriptor only after preparation succeeds; retain existing Serve readiness.
- [x] Give every equivalent fixture an isolated repository/source/cache copy.
      Preserve the baseline commit and recipe; prove warm hits, mutation isolation,
      immutable template contents and safe global/fixture teardown on failure or
      cancellation. No per-fixture fallback rebuild may mask failed preparation.
- [x] Retain exactly one browser test that exercises the real cold baseline
      rebuild as its operation under test, and retain the real cold preview:build
      preparation test. Preserve all unit/integration baseline and UI coverage.
- [x] Keep the 600-second fixture limit unchanged; do not change assertion
      deadlines, retries, worker limits or sharding. Bound shared setup as specified.
- [x] Record after timings for the full browser suite, global preparation,
      per-fixture copy/cache/export and the retained cold operations. Compare with
      before results, including setup/teardown time and complete coverage evidence.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit with Conventional Commits and push.

### Merged fixture audit before implementation

Audited at `332f44decd603c2c8f7d1c50dc1cb28c2d871234`. The merged code differs
from the original preparation assumption. No browser fixture currently rebuilds
the same example baseline twice: `createCommittedExampleBaseline` compiles and
force-adds focused v8 output to each temporary repository, so the two named
export fixtures use blob readers. Their source/config profiles are different.
`createExampleBaseline` retains a real source-only rebuild in unit tests.

| Browser caller                                                     | Current preparation                                                                                                                                        | Planned ownership                                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `static_example.spec.ts`                                           | `createCommittedExampleBaseline(root, "static-example")`; unchanged-HEAD export                                                                            | Independent copy of the shared source-only example/cache; unchanged-HEAD assertions remain                            |
| `design_library_export.spec.ts`                                    | Same helper with `"design-library"`; tag-chip edit, then export                                                                                            | Same immutable baseline inputs as static-example; apply its existing edit only in its copy                            |
| `ordinary_preview_fixture.ts`                                      | Same helper with distinct `"ordinary-preview"` inputs; current-only publication; shared by `preview_navigation.spec.ts` and `preview_design_links.spec.ts` | Retain its separate worker-owned current-only preparation; it performs no historical rebuild and has different inputs |
| `preview_fixture.ts`, called only by `preview_preparation.spec.ts` | Same helper with `"static-example"`, followed by direct `buildPreview`, despite the cold `preview:build` description                                       | Independent source-only fixture and real cold `npm run preview:build`; never use the shared cache                     |
| Playwright's example Serve                                         | The working tree's separately pinned HEAD, prepared by Serve as needed                                                                                     | Keep readiness and report it separately; it is not the fixture baseline                                               |

There is no existing browser cold-baseline operation-under-test case to retain.
Add exactly one. Keep all unit/integration callers of `createExampleBaseline`,
`createCommittedExampleBaseline` and other baseline helpers independent.
`design_library_fixture.ts` is a unit-only in-memory comparison helper;
`component_design_fixture.ts` only reads prepared current output. Neither is a
browser historical rebuild consumer.

The two ordinary export fixtures will use one common focused source profile:
the existing basic catalogue/components plus the existing design-library fixture
entries. Their inputs, config path and real three-command recipe will be identical.
This preserves all UI assertions without pretending the old profiles were equal.
Generated output is absent from that baseline commit. The ordinary-preview
profile remains separate because its inputs differ and it has no historical work.

For comparable timing, first establish the required real operations without
sharing: both ordinary consumers prepare their own identical source-only baseline,
the new cold-baseline test performs its own rebuild, and preview preparation runs
the real CLI command. Measure a full run of that workload, then move only ordinary
baseline preparation into global setup and repeat the same full inventory on the
same machine/runtime with controlled cache conditions. Record the existing M13
24.9-minute browser run separately as the as-found shortcut workload; it is not
an equivalent before measurement for real rebuild sharing.

- [x] Record the comparable independent-preparation run before introducing reuse.
- [x] Retain the same common profile, recipe, cold cases and timing instrumentation
      for the after run; report global setup, teardown and fixture phases explicitly.

### Comparable before measurement

The independent-preparation run passed all 970 browser tests in **1618.841 s**
(command wall time, including package/example preparation). The Playwright report
records 26.6 minutes. No test was skipped or retried. The new inventory adds only
the explicit cold-baseline test to M13's 969 cases.

Conditions: Node `22.14.0`, npm `11.11.0`, Chrome `153.0.8010.52`, Linux x64,
8 Intel Xeon vCPUs at 2.90 GHz, 17,452,048,384 bytes RAM, one worker, no shard,
zero retries. Every fixture repository/cache was fresh; npm's existing download
cache was warm. The distinct workspace Serve baseline at HEAD `332f44de` was
prepared before measurement. Profile and lockfile SHA-256 values, the complete
inventory and raw phase records are retained in `.context/milestone-14/before.json`
and `before-inventory.json`; `README-timing.txt` records the controls.

Startup (server plus global setup) was 22.994 s; the existing Serve-readiness
global setup was 19.954 s. Global teardown measured 0.02 ms. The last test to
command exit interval was 0.332 s and includes outer teardown/reporting.

| Fixture               | Source/Git (s) | Install (s) | Build (s) | Cold baseline (s) | Prepare total (s) | Warm baseline (s) | Export (s) |
| --------------------- | -------------: | ----------: | --------: | ----------------: | ----------------: | ----------------: | ---------: |
| design-library-export |          0.722 |       9.140 |    14.770 |            25.417 |            25.447 |             0.080 |     13.698 |
| static-example        |          0.611 |       8.018 |    13.678 |            22.876 |            22.897 |             0.062 |     13.523 |
| cold-example-baseline |          0.712 |       8.633 |    14.827 |            24.806 |            24.826 |             0.062 |     13.879 |

The separate real cold `preview:build` took 21.761 s and its server startup
1.429 s. Ordinary current-only preview export took 161.609 s and serving 1.433 s.
Each warm export recorded absent install/build phases as `not-observed` with null
duration. There were three real common-profile baseline rebuilds: two ordinary
fixture preparations and the single cold operation test. Shared preparation was
not active. The before code and inputs stayed fixed throughout the measurement.

### Comparable after measurement

The shared-preparation run passed the same **970 tests in 1676.363 s** (27.6
minutes reported by Playwright), including global preparation and teardown.
This is **57.522 s slower** than the independent-preparation run. Do not claim
a full-suite speedup from these measurements.

Both runs used the same Node/npm/Chrome versions, machine, worker/shard/retry
settings, warm npm cache and separately warmed workspace Serve HEAD. The lockfile
and common-profile SHA-256 values match, and the complete test inventories match.
The recorded startup host load averages differ: before `[1.14, 1.18, 0.85]`, after
`[3.93, 4.18, 3.05]`. These are observed conditions, not controlled CPU scheduling;
they prevent attributing the full wall-time difference solely to cache sharing.
All raw after records are in `.context/milestone-14/after.json` and `after.log`.

Startup was 47.884 s, including global setup at 44.562 s. That setup includes
19.296 s of existing Serve readiness and the following one-time preparation:

| Global phase                                 | Seconds |
| -------------------------------------------- | ------: |
| Source/Git                                   |   0.749 |
| Install                                      |   8.181 |
| Build                                        |  14.276 |
| Cold baseline                                |  23.937 |
| Prepare total                                |  23.952 |
| Immutable-template verification and disposal |   0.380 |

| Fixture               | Template validation (s) | Copy (s) | Copied-cache validation (s) | Warm baseline (s) | Export (s) |
| --------------------- | ----------------------: | -------: | --------------------------: | ----------------: | ---------: |
| design-library-export |                   0.470 |    0.513 |                       0.351 |             0.064 |     13.913 |
| static-example        |                   0.437 |    0.492 |                       0.380 |             0.065 |     14.424 |

Both ordinary consumers report install/build as `not-observed` with null
duration. Neither performs a historical rebuild or shares mutable Git/cache state.
The template's bytes and refs remained unchanged through both consumers and
global teardown. Global teardown measured 0.380 s; the outer last-test-to-exit
interval was 0.810 s, including teardown/reporting.

The one retained cold operation measured source/Git 0.840 s, install 9.211 s,
build 15.925 s, baseline 26.675 s and prepare total 26.711 s. Its subsequent
comparison export used the real warm cache (0.063 s baseline validation) and took
14.484 s. The separate real cold `preview:build` took 27.374 s and its server
startup 1.642 s. Ordinary current-only preview remained independent: export
166.233 s and serving 1.434 s.

Common-profile rebuilds therefore changed from three to exactly two: one global
preparation and the cold regression. Existing unit/integration rebuild tests,
the separate preview operation and workspace Serve preparation remain independent.
The 600-second ceiling, assertion deadlines, worker count, retries and sharding
are unchanged. Test listing produces no preparation or fixture timing records.

Focused acceptance: all 29 lifecycle/command/timing checks and all six focused
browser checks pass. The miniature real-build fixture initially missed its required
desktop render; that test fixture was corrected. A cache-corruption assertion was
updated to require the existing `baseline-output-invalid` category instead of a
generic message. No product reader, cache validator or build recipe was weakened.

### Full gate and completion

The complete gate passed on Node `22.14.0`:

| Command                                                                | Result                                  |  Seconds |
| ---------------------------------------------------------------------- | --------------------------------------- | -------: |
| `npm run format:check`                                                 | pass                                    |   27.158 |
| `npm run lint`                                                         | pass                                    |   19.771 |
| `npm run typecheck`                                                    | pass                                    |   36.801 |
| `npm test`                                                             | 3,795 passed; no skips or cancellations |  981.598 |
| `npm run test:browser -- --output .context/milestone-14/after-results` | 970 passed; comparable after run above  | 1676.363 |
| `npm run example:check`                                                | 436 valid, untracked files              |   11.221 |
| `cargo xtask check`                                                    | pass                                    | 3016.476 |

The cargo gate passed the unchanged dependency audit policy, 15 Rust tests,
six packed-consumer scenarios, another 3,795 unit tests, 747 browser tests and
223 hydration tests. Each browser invocation prepared its own template and
removed it through the verification owner after immutable-content checks.
The source-size check passed for 921 files. No main test title or product feature
was removed; the five authorized Milestone 11 deletions remain unchanged.
The final refresh still names main `800fe9f88a0173429b25baa1bcf41ed9e59b2256`;
no merge occurred. Commit and push precede the final document audit.

## Milestone 15: Verify and review the merged branch

The document audit covers the union of Markdown paths changed by the first-parent
Milestone 9–14 commits, from `a9c8a9f7^` through `1ab8f5aa`: 206 paths, including
165 existing live documents and 41 history/index/deleted paths. The inventory
and per-file boundary notes are retained under `.context/milestone-15/`.
Historical review receipts, release notes and completed milestone narratives
retain their original version claims. The two documents already deleted on
main stay deleted; this milestone restores no legacy documentation or reader.

Corrections align the live documents with the implemented contracts:

- Imported CSS uses generated-root-relative routes inside the unified tree.
  Only Check reads index tracking. Writers replace the whole tree; in-memory
  consumers do not inspect stale generated output. Removed output modes,
  committability and `publicExclude` rules no longer appear as live behavior.
- Serve and publication retain accepted in-memory CSS/assets with no disk
  fallback. Both comparison sides use v8; older output yields unavailability.
  Watch documentation now distinguishes reload-triggered Build compilation
  from Serve resource reloads and makes the Serve write option explicit.
- Hosting uses `mokly-viewer/` and `static/`, the ownership fixture rejects
  non-v3 markers, and package/shell references name the actual v8/v4 readers.
  The component envelope no longer repeats fields or names the v7 entry type.
  Fixed-name policy and the authored-name host caveat are unchanged. Release
  notes cover `6775282d` and the format migration; user guides describe the
  approved Cloud version error and the earlier-baseline unavailable outcome.
- The unified PostCSS paragraph now uses the implemented diagnostic from
  `dependency_inventory.ts` and the existing error catalogue: exclude
  `mockupsDir`, with the stylesheet-relative Tailwind example. The earlier
  draft instead named the generated root. This is a documentation correction;
  the generated-output rejection and scan exclusions remain unchanged.
- Lint and browser preparation are documented as implemented. The current
  consumers use `shared_example.ts`; the one cold-baseline test and real cold
  preview command remain explicit. The 600-second limit is unchanged.

Finding 17 remains open. Its source-root equality claim in the older
configuration text is not changed; `validateSourceRoots` still rejects equal
roots, as the unified contract says. Other unapproved findings and the Cloud
receiver/viewer rollout also remain deferred. This audit adds no source,
configuration, script or test change and makes no new product decision.

- [x] Re-read every document changed in Milestones 9 to 14 against the
      shipped behaviour and fix drift.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit with Conventional Commits; push the
      branch.
- [x] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md`; report numbered findings
      with severities and recommendations without changing the implementation.

### Validation of the documentation audit

The final full gate passed on Node 22.14.0, with scratch reports under
`.context/milestone-15/`:

| Command                                                                  | Result                               |  Seconds |
| ------------------------------------------------------------------------ | ------------------------------------ | -------: |
| `npm run format:check`                                                   | pass                                 |   23.851 |
| `npm run lint`                                                           | pass                                 |   18.496 |
| `npm run typecheck`                                                      | pass                                 |   36.980 |
| `npm test`                                                               | 3,795 pass; zero skips/cancellations | 1014.552 |
| `npm run test:browser -- --output .context/milestone-15/browser-results` | 970 pass                             | 1710.050 |
| `npm run example:check`                                                  | 436 valid, untracked files           |   11.105 |
| `cargo xtask check`                                                      | pass                                 | 3052.107 |

Cargo also passed the unchanged live audit policy, 15 Rust tests, all six
packed-consumer scenarios and their strict audits, 3,795 unit tests,
747 browser tests and 223 hydration tests. Source length passed for 928 files.
All 28 focused guide checks and five Markdown/link/size checks pass.
The three documented v8 envelope field sets match the exported interface.

The first unit run passed 3,794 cases and failed one guide check:

```text
✖ the initial corpus has no links and future destinations are bounded
Error [ERR_TEST_FAILURE]: Expected values to be strictly deep-equal:
```

The Styles guide had gained a relative Markdown link, which the guide corpus
does not allow. The guide now uses self-contained prose; the rule and test remain.
All guide checks then passed. The complete gate restarted from formatting
and passed. No tests were skipped, disabled or weakened.

The final review TODO remains for the orchestrator. Commit and push complete
this milestone's first two TODOs only. Main remains
`800fe9f88a0173429b25baa1bcf41ed9e59b2256`; no merge occurred.
Only the five authorized Milestone 11 files remain deleted relative to main.

### Final review outcome

Seven parallel reviewers checked the pushed tip `a6287ed6` against
`origin/main` at `800fe9f8` with `docs/implementation-review-prompt.md`. They
covered writers and Check; baselines and caches; the asset closure, Serve and
export; comparisons; the viewer; documentation; and tests, lint and the merge.
Each claim was reproduced with a scratch script or verified in the code before
it was reported. The review reported 23 new findings, numbered 35 to 57,
without changes: 1 high, 8 medium and 14 low.

- High (35): watched Serve replaces the build's checked asset closure with the
  file watcher's own list. Authored pages and files that mockups reach through
  ordinary links return 404 for the whole session. Files that the privacy
  rules reject can be served.
- Medium: an earlier manifest that Git still tracks turns Changes off
  permanently (36). The merge removed `main`'s package-root error (37) and
  turned an unreadable baseline cache entry from a rebuild into a hard failure
  (38), both without approval. Adding or removing an embedded generated
  document makes every comparison fail (39). `build --watch` misses inputs that
  Serve watches (40) and ignores Ctrl+C while it waits for the output lock (41).
  The published viewer README promises support for earlier catalogues, and the
  release notes omit the viewer API breaks (42). Compatibility transformers
  receive inputs that contradict their contract (43).
- Low (44–57): documentation drift, upgrade edge cases, missing acceptance
  tests, leftovers of the removed output modes, and the Milestone 14 cost.
  After the merge, the two export fixtures already read committed output, so
  the shared preparation added about 1,800 lines of test code and new real
  rebuild work instead of sharing existing work.

Earlier findings 1, 4, 6, 7, 11, 12, 22, 23, 28–31, 33 and 34 are fixed, and
26 no longer applies. Findings 2, 8, 13, 15, 18, 20, 21, 24, 27 and 32 are
partly fixed; their remaining parts are listed with the new findings where
they changed form. Findings 3, 5, 9, 10, 14, 16, 17, 19 and 25 remain open.
Main had not moved. Every finding awaits the user's decision.

## Milestone 16: Define the compatibility-removal contracts

Documentation only. On 2026-10-04 the user decided that Mokly removes all
backward-compatibility code, because the project is not live. The decision
includes compatibility code that exists on `main`; this section records that
approval for each `main` removal listed below. Checks that detect older data
and stop with a clear message stay. This milestone rewrites every affected
contract, guide and README so that they describe only the current formats.
Milestone 17 then removes the code.

### Approved removals

The orchestrator's inventory comes from the final review and a source search:

1. **Base-selection shortcut** (findings 36 C and most of 19;
   `src/review/prepare.ts:116-160`, `src/review/base_manifest.ts`). Base
   selection reads only `<catalogueRoot>/mokly-generated/mokly-manifest.json`
   in the base tree. A committed manifest at any other location never decides
   the outcome. A missing manifest or an incomplete v8 inventory selects a
   rebuild with the base's own recipe. Selection lists only the
   `<catalogueRoot>/mokly-generated/` subtree, not the whole repository.
2. **Earlier manifest names** (`main`; `src/registry/manifest.ts:30-33` and
   every user). Mokly recognizes only `mokly-manifest.json`. The privacy
   rules keep that name.
3. **Earlier-format baseline cache entries** (findings 47, the rest of 8, and
   38 A; `src/baseline/cache.ts`, `src/baseline/cache_layout.ts`). Remove the
   `generated-v6` and `legacy` layouts, markers below manifest v8,
   `olderCacheExists` and `assertCurrentCache`. An entry that is not a
   complete, valid v8 entry is partial: Mokly deletes it under the cache lock
   and rebuilds it, as on `main`. The completion marker is written
   atomically, through a temporary file and a rename.
4. **Compatibility transformer** (`main`; finding 43 and the rest of 15 and
   21). Remove `compatibility.transformer`, `CompatibilityConfig`,
   `CompatibilityTransformer`, `CompatibilityTransformInput`,
   `src/compatibility/`, `validateCompatibilityRecords` and every build hook.
   A config that contains `compatibility` fails with the removed-key error
   `compatibility was removed; author portable links directly`.
5. **Earlier export-marker message** (finding 44;
   `src/export/ownership.ts:242-245`). A destination whose marker is not a
   valid v3 marker fails with the existing invalid-ownership error.
6. **Legacy export ownership** (`main`; `LegacyExportOwnership` and the
   `legacyOwnership` adapter option in `src/export/`). Export adopts only an
   empty folder or a folder with its own valid marker.
7. **Former generated notices** (`main`; `FORMER_FIRST_LINE` in
   `src/build/generated_marker.ts`). Mokly strips only the current marker,
   with LF or CRLF.
8. **Earlier export reservation check** (`main`;
   `src/export/reservation.ts:47-54`).
9. **Obsolete disclosure storage key** (`main`; the `mokly:nav-disclosure:v2`
   cleanup in `packages/viewer/src/shell/disclosure_storage.ts`). The viewer
   uses only the current key.
10. **Snapshot-id fallback** (`main`; `legacyGeneration` in
    `packages/viewer/src/catalogue/reader.ts`). Remove it if no current
    writer, including publication, omits `snapshotId` while a comparison
    identity exists. Otherwise keep it under a current name and record why.
11. **Layout prefix** (finding 24 and part of 25). Remove `generatedPathPrefix`
    from catalogue v4 and `CatalogueReadModel`, `GeneratedPathPrefix`, the
    prefix parameters, `FrameMount.generatedPathPrefix`, `FrameMount.route`,
    `data-mokly-generated-prefix`, and all layout derivation in the viewer.
    The viewer uses `GENERATED_DIRECTORY` directly. Catalogue v4 keeps its
    number, because it is not released.
12. **Removed output-mode leftovers** (finding 53 A). Remove
    `compareResourceBytes` and its `false` branches, the no-op mode loops and
    the stale test titles. Replace the assertion that accepts either of two
    messages with one exact message. Remove the two-mode text in
    `src/review/README.md`. Restore `main`'s "consumer is in `changedPaths`"
    assertion.

13. **Manifest dependency fallback** (approved after Milestone 17;
    `src/catalogue/projection.ts`). Prove every current producer: manifest v8,
    live-index metadata, Serve runtime and worker transfer. If none puts
    `dependencies` on a manifest entry, remove that read and derive the public
    dependency union from `sourcePath` and `declaredDependencies` only. Otherwise
    retain the current producer path under a current name and record the proof.
    Authoring-input `dependencies` and public `details.dependencies` stay.
14. **Incomplete watched recovery** (approved after Milestone 17;
    `packages/viewer/src/standalone/recovery.ts`). Require stored
    `filterBaselineDisclosures` and `changesStatus`. Reject absence rather than
    supplying null or accepting an omitted status. Keep current writer fields,
    the valid status values and all other stored-state checks.

### Kept checks

These checks detect older data and stop with a clear message:

- The format version checks: catalogue v4, delivery v4, bootstrap v1, export
  ownership v3, upload v2 with the 426 response, review result v4, preview
  v2, and the cache and process markers.
- The earlier-version outcome for a base whose own rebuild writes a manifest
  below v8 at `<catalogueRoot>/mokly-manifest.json`. Mokly does not cache
  this outcome.
- The removed-key errors for `generatedOutput`, `publicExclude` and `legacy`,
  plus the new one for `compatibility`.

The instance-key hash domains in `packages/viewer/src/components/keys.ts`
keep their names. They are identities, not compatibility code, and a rename
changes every instance key.

### Snapshot writer proof and contract choices

The writer audit at `cc1e332e` confirms that `src/catalogue/projection.ts`
publishes ids before serialization whenever `historicalSource` has a baseline
commit or comparison generation. Serve's `LivePublicCatalogue`, export's
`assembleExportSite` and `scripts/preview/catalogue.mjs` all use that projector.
`serializeCatalogue` preserves fields; `projectScopedCatalogue` spreads each
removed record. Hosted object, URL and loader sources go through
`packages/viewer/src/viewer/source.ts` and only read the model. They are not
another producer. External host data must obey this same current contract.

The direct source probe at `.context/milestone-16/snapshot-proof.ts` checks
baseline-only identity, generation-only identity and no identity, before and
after serialization and scoped delivery. Both real identities produce a
64-hex id; only the no-identity case omits it. Therefore remove `legacyGeneration`
from the reader. A non-null public `comparisonUrl` requires every removed
record's id; a missing id is invalid. Serve derives ids from its baseline before
publishing a comparison pointer. Its local comparison endpoint is a request
route, not an allowed public pointer. No-identity records with a null pointer
remain supported without invented ids. Keep the current writer's
generation-based hash construction.

Invalid cache data is partial. A valid v8 marker with different requested
catalogue/build settings keeps main's exact fail-intact error. Validate the
marker, compare settings, then validate output. Earlier or invalid markers
rebuild before settings comparison. Cancellation still aborts. Retention reads
only the marker and inputs; it removes unlocked invalid metadata entries without
reading or hashing output. Full output validation runs only on reuse. Atomic marker publication uses a unique sibling temporary and rename;
rename is the commit point. Keep safe lock, confinement and process checks.

Documentation removal shrinks reviewed oversized protocol pages. Their existing
tests require exact cap values, so lower only the corresponding numeric cap data
in `tests/protocol_doc_sizes.test.ts`. This is required documentation-validation
metadata, not a test removal or relaxed limit; assertions and titles stay intact.
No implementation code changes in the contract commit.

### Resolved by the decision without code

Finding 3's upgrade guide and `main`'s ignore rule for
`examples/basic/generated/` are not added. Finding 13's legacy-catalogue test
is covered by the version-gate tests. The Milestone 17 tests replace the
earlier-version acceptance tests of finding 48.

All other findings still await the user's decision: 35, 37, 39–41, 42 (except
the viewer README sentence that this work corrects), 45, 46 (except text that
goes with the removed code), 48 (the SHA-256, binary-asset and Serve-line
tests), 49–52 and 54–57, plus earlier findings 2, 5, 9, 10, 14, 16–18, 20 and
the double decode in 25. Do not fix them. If a removal forces a change in
their area, make the smallest correct change and record it.

- [x] Update every affected protocol document, guide and README, including
      `packages/viewer/README.md`, so that each describes only the current
      formats. Remove the transformer section from `mokly-rendering.md` and
      every reference to a removed item. Write current contracts, not plan
      history, as `docs/protocol/README.md` requires.
- [x] Define exactly: base selection with one manifest location and a
      generated-subtree listing; the earlier-version outcome after a rebuild;
      cache entry validity, partial-entry deletion, retention cleanup of
      invalid entries and the atomic marker write; an export destination with
      an invalid or earlier marker; the `compatibility` removed-key error; and
      the single-layout frame URL rule.
- [x] Record the removed public API in `docs/protocol/npm-release-notes.md`.
- [x] Update this plan's summary and decision text that describe removed paths.
- [x] Run `npm run format:check` and the documentation tests; review the diff;
      commit with Conventional Commits; push.

Validation: Node 22.14.0; `npm run format:check` passes. The Markdown link,
protocol size/index/history and guide structure/copy checks pass all 13 tests.
The snapshot writer probe passes baseline, generation and no-identity cases.
Only documentation and one lowered protocol-cap value changed. No main file
or test title is removed in this contract commit. All removal scope maps to
items 1–12 above; unrelated recovery/version wording remains for the search audit.

## Milestone 17: Remove the compatibility code

Implement the Milestone 16 contracts. Remove each approved item with its
tests, fixtures and references. Add tests for each new behaviour. The product
works at the end of the milestone.

- [x] Base selection and baselines (items 1–3). Add tests: a base with a
      committed root-level v7 manifest and no `mokly-generated/` selects a
      rebuild; a base whose rebuild writes v7 gives the earlier-version
      outcome through `prepareReviewRepository` and export; empty, truncated
      and earlier-format cache markers lead to a rebuild; the marker write is
      atomic.
- [x] Remove the compatibility transformer (item 4). Keep the other
      assertions of tests that configured a transformer. Test the
      `compatibility` removed-key error.
- [x] Remove the export items (items 5, 6 and 8) and update their tests.
- [x] Remove items 7, 9 and 10, with their tests.
- [x] Remove the layout prefix from the viewer (item 11). Update the public
      types, the tests and the catalogue fixture.
- [x] Remove the output-mode leftovers (item 12).
- [x] Search the code again for compatibility paths (for example `legacy`,
      `former`, `obsolete`, `earlier` and older version numbers). Record every
      result in this milestone. Remove a result only if it matches the
      approved scope, and report every other result.
- [x] Smoke-test build, check, Serve (a styled screen and Changes), an export
      on a static server, and Changes against a base that also commits a
      stale root-level v7 manifest.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit with Conventional Commits and
      a `BREAKING CHANGE` footer; push.

### Implementation choices and scope

Items 1–3 now list only the committed generated subtree and probe its canonical
manifest. A stale root-level v7 file cannot disable Changes before the build.
The base's own recipe still produces the result. If it produces a root-level
pre-v8 manifest, preparation and export keep the exact unavailable outcome and
do not publish a cache marker. Canonical pre-v8 committed generated manifests
still hit the version gate. Moved-root discovery and v8 inventory checks stay.

Cache reuse reads bounded metadata, compares settings, then validates output.
A valid marker with a different requested path or command list fails intact with
`Cached baseline uses different build settings; remove <entry> before changing catalogues or commands`.
Invalid metadata is partial before that comparison. Retention reads only the
marker and `inputs.json`, rechecks a partial candidate under its own free lock,
and never reads or hashes output. Completion uses a unique sibling temporary
and atomic rename. Tests cover write, rename and cancellation failures, plus
cancellation at the rename commit point. These choices incorporate all three
corrections to Milestone 16; no different mismatch or retention rule is adopted.

Item 4 removes the transformer API and graph roots. `document_links.ts` retains
ordinary child-control adaptation and portable link resolution for full and
on-demand compilation. Config presence, including undefined, fails with
`compatibility was removed; author portable links directly`. Mixed-purpose tests
keep CSS syntax, pending-style delivery, workspace symlink assets, custom/page
renderers, metadata-only native links, and final-anchor validation.

Items 5–10 remove earlier export adoption and messages, former notice stripping,
hashed-reservation admission, v2 disclosure writes and snapshot-id inference.
The repository preview uses v3 export ownership and no longer writes its own
earlier ownership marker. Its browser fixture now checks current ownership.
This is required by item 6 and does not change fixture preparation, deadlines
or the deferred Milestone 14 performance question. The shared-example corruption
test now expects its existing warm-cache assertion after invalid output becomes
a cache miss; it still refuses fallback rebuilding.

Item 11 removes the serialized prefix, mount fields/attribute and helper
parameters. Current URL validation retains its existing security checks and
uses the shared constant. It does not fix the separately deferred double decode.
Catalogue v4 keeps its unreleased number. The fixture's pinned size and digest
change with that field removal. Item 12 removes byte-comparison opt-outs,
restores the generated consumer in `changedPaths`, and removes inert mode loops.
Real blob/rebuild and fresh/retained setup differences keep separate coverage.

The export README again states every current closure/privacy/watch fact from
the correction. The resource policy admits both generated inventory and authored
closure. The other changed READMEs were checked for similar losses; their current
facts remain. Review again states that the first imported stylesheet changes
affected views against a v8 baseline without imported CSS; the existing test
covers this current behavior. The shell README names only the current storage key.
The internal-export ratchet identifies four helpers after their compatibility
callers disappear. `manifestEnvelopeVersion` and the link-control `attribute`
remain private helpers. `walkFiles` and its sole-module `src/build/discovery.ts`
are removed with the transformer. The old-preview-only `isExportPublicName`
wrapper and its unused build-directory option are removed; the confined
`exportResourceDenial` policy remains. The existing source-order lint rule still
covers its exact discovery path, and its synthetic probe remains. These are
items 3, 4 and 6, with no new authored-name restriction.
No other open finding is changed.

### Smoke evidence

`node --import tsx .context/milestone-17/smoke.ts` passes under Node 22.14.0.
The isolated source-only example commit is
`59ce920158bd9ca378940aa2efa2e9bfa68b91bb`. It commits
`examples/basic/mokly-manifest.json` with v7 and has no generated subtree.
Its own recipe runs `npm ci`, `npm run build` and `npm run example:build`.
Head `npm run example:check` passes with 32 valid untracked files.

Preparation selects `rebuild`, reports a cold completion, and publishes a v8
cache. Serve reports `ready` Changes at
`http://127.0.0.1:46427/view/screens/example-welcome.html`. The screen uses Inter,
a 32px heading and six stylesheets. Authored and imported CSS return 200.

The export top level is `.mokly-export-artifact`, `404.html`, `index.html`,
`mokly-viewer`, `static` and `view`. A plain static server returns 200 for
`http://127.0.0.1:39375/mokly-viewer/catalogue.json`, with catalogue v4 and
`ready` Changes. Its Welcome screen has the same styling. Browser loads have no
HTTP failures. All 147 export files were scanned; the only path segment starting
with `.`, `_`, `#` or `~` is `.mokly-export-artifact`. Screenshots and command receipts are under
`.context/milestone-17/`. All smoke servers and browsers stopped in cleanup.

### Mainline removals and title inventory

Main remains `800fe9f88a0173429b25baa1bcf41ed9e59b2256`. No merge occurs in this milestone.
Items refer to the twelve approved removals in Milestone 16. The following
eight main files are removed. No other new main file deletion is authorized:

- `src/build/discovery.ts` — item 4; its only caller was the transformer.
- `src/build/styles/lightning.ts` — item 4.
- `src/build/styles/transformer_inventory.ts` — item 4.
- `src/compatibility/transform.ts` — item 4.
- `src/compatibility/types.ts` — item 4.
- `tests/compatibility.test.ts` — item 4.
- `tests/compatibility_link_controls.test.ts` — item 4.
- `tests/compatibility_navigation.test.ts` — item 4.
  The branch-only file `tests/private_metadata_baselines.test.ts` is also removed
  under item 2. Its main-origin test title is listed below; main keeps that title
  in its original `tests/private_metadata.test.ts` file.

The five earlier Milestone 11 deletions remain: `src/build/committable_output.ts`,
`src/build/ownership.ts`, `src/build/tracked_ownership.ts`,
`src/config/public_exclusions.ts` and `tests/build_check_unclaimed.test.ts`.
No audit policy, write lock, frame-session race fix or unrelated main contract is removed.

The title audit compares all test declarations at the starting tip and main.
All missing declarations map to the approved scope. The list below also expands
every changed main title template into its concrete titles. A renamed title does
not mean that its coverage was deleted. Ordinary CSS, custom rendering, link
controls, anchors, source confinement and byte checks remain. The renderer
casing test moves unchanged to `build_link_control_casing.test.ts`; final
navigation checks move to `build_final_navigation.test.ts`.

| Main test file                                        | Removed main title                                                                             | Item and disposition                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `tests/build_imported_styles_alias.test.ts`           | `transformer-only legacy CSS does not reject deliverable CSS syntax`                           | 4: Renamed; non-transformer coverage retained.                                        |
| `tests/build_imported_styles_alias.test.ts`           | `transformer-only legacy CSS is inventoried without strict parsing`                            | 4: Removed transformer-only coverage.                                                 |
| `tests/build_imported_styles_graph.test.ts`           | `transformer-only CSS and its nested assets are private, not delivered`                        | 4: Removed transformer-only coverage.                                                 |
| `tests/build_imported_styles_resources.test.ts`       | `compatibility route discovery includes pending styles and omits reserved disk orphans`        | 4: Renamed; non-transformer coverage retained.                                        |
| `tests/build_link_controls.test.ts`                   | `custom and legacy renderers adapt controls before compatibility checks`                       | 4: Renamed; non-transformer coverage retained.                                        |
| `tests/build_postcss_dependencies.test.ts`            | `explicit generated output fails in both modes before public file validation`                  | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `committed plain imported CSS narrows shared-impact evidence to matching views`                | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `committed module imported CSS narrows shared-impact evidence to matching views`               | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `derived plain imported CSS narrows shared-impact evidence to matching views`                  | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `derived module imported CSS narrows shared-impact evidence to matching views`                 | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `committed changed generated font affects every view linking its stylesheet`                   | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `derived changed generated font affects every view linking its stylesheet`                     | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `committed baseline predating imported CSS reports a one-time jump`                            | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `derived baseline predating imported CSS reports a one-time jump`                              | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/changes_imported_styles.test.ts`               | `committed Changes ignores syntactically valid stray generated output`                         | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/compatibility.test.ts`                         | `migration compatibility transforms documents and legacy id links`                             | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility.test.ts`                         | `compatibility transforms reuse the logical route index for each view`                         | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility.test.ts`                         | `configured compatibility transformers are typed complete-document functions`                  | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility.test.ts`                         | `compatibility output fails closed on unresolved navigation links`                             | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility_link_controls.test.ts`           | `compatibility transforms cannot introduce or alter owned control metadata`                    | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility_link_controls.test.ts`           | `compatibility cannot add control metadata to a document without child links`                  | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility_link_controls.test.ts`           | `compatibility preserves generated metadata while allowing harmless edits and literal names`   | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility_navigation.test.ts`              | `compatibility transforms preserve complete logical-link records`                              | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility_navigation.test.ts`              | `compatibility transforms cannot duplicate reserved Browse metadata`                           | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility_navigation.test.ts`              | `identity transforms preserve metadata-only native links`                                      | 4: Renamed; non-transformer coverage retained.                                        |
| `tests/compatibility_navigation.test.ts`              | `compatibility transforms cannot add base URLs to activatable documents`                       | 4: Removed transformer-only coverage.                                                 |
| `tests/compatibility_navigation.test.ts`              | `compatibility transforms cannot remove an anchor from one target view`                        | 4: Renamed; non-transformer coverage retained.                                        |
| `tests/component_build_edges.test.ts`                 | `compatibility rejects removed ownership`                                                      | 4: Removed transformer-only coverage.                                                 |
| `tests/component_build_edges.test.ts`                 | `compatibility rejects changed owned head styles`                                              | 4: Removed transformer-only coverage.                                                 |
| `tests/component_material_reader.test.ts`             | `fall-through views reuse actual discovery in derived mode`                                    | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_changes_membership.test.ts`    | `committed plain exported and published Changes match live rule attribution`                   | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_changes_membership.test.ts`    | `committed module exported and published Changes match live rule attribution`                  | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_changes_membership.test.ts`    | `committed asset exported and published Changes match live rule attribution`                   | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_changes_membership.test.ts`    | `derived plain exported and published Changes match live rule attribution`                     | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_changes_membership.test.ts`    | `derived module exported and published Changes match live rule attribution`                    | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_changes_membership.test.ts`    | `derived asset exported and published Changes match live rule attribution`                     | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_styles.test.ts`                | `committed export retains generated asset routes containing dist and target`                   | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_styles.test.ts`                | `derived export retains generated asset routes containing dist and target`                     | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_styles.test.ts`                | `committed export captures scoped CSS assets without shipping private inputs`                  | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_styles.test.ts`                | `derived export captures scoped CSS assets without shipping private inputs`                    | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_imported_styles.test.ts`                | `derived public capture never adopts stray reserved files from disk`                           | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/export_migration.test.ts`                      | `only the repository adapter migrates a valid legacy preview`                                  | 6: Replaced with the current-only rejection/ownership contract.                       |
| `tests/export_reservations.test.ts`                   | `legacy hashed reservations must be explicitly recovered`                                      | 8: Replaced with the current-only rejection/ownership contract.                       |
| `tests/historical_snapshot_identity.test.ts`          | `reader safely derives older generation-backed identities`                                     | 10: Replaced with the current-only rejection/ownership contract.                      |
| `tests/imported_styles_accepted_changes.test.ts`      | `accepted committed classification does not rerun PostCSS`                                     | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/imported_styles_accepted_changes.test.ts`      | `catalogue freshness shares one inventory graph with committed Changes`                        | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/imported_styles_low_delivery.test.ts`          | `committed generated assets have specific types in static, on-demand and transient delivery`   | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/imported_styles_low_delivery.test.ts`          | `derived generated assets have specific types in static, on-demand and transient delivery`     | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/imported_styles_workspace_package.test.ts`     | `transformer-only workspace-package CSS inventories a linked image`                            | 4: Renamed; non-transformer coverage retained.                                        |
| `tests/private_metadata.test.ts`                      | `a stale historical-manifest alias does not prevent ordinary public resources`                 | 2: Replaced with the current-only rejection/ownership contract.                       |
| `tests/private_metadata.test.ts`                      | `an earlier manifest name is only an incompatibility sentinel`                                 | 2: Replaced with the current-only rejection/ownership contract.                       |
| `tests/publication_imported_styles.test.ts`           | `committed publication captures generated CSS and scoped binary assets without private inputs` | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publication_imported_styles.test.ts`           | `derived publication captures generated CSS and scoped binary assets without private inputs`   | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_compile_cancellation.test.ts`          | `committed publish cancels when esbuild exits before the signal listener runs`                 | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_compile_cancellation.test.ts`          | `derived publish cancels when esbuild exits before the signal listener runs`                   | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_imported_binary_snapshots.test.ts`     | `committed publish retains exact scoped binary bytes on both snapshot sides`                   | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_imported_binary_snapshots.test.ts`     | `derived publish retains exact scoped binary bytes on both snapshot sides`                     | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_pre_installation_cancellation.test.ts` | `committed publish cancels during comparison`                                                  | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_pre_installation_cancellation.test.ts` | `committed publish cancels during staging`                                                     | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_pre_installation_cancellation.test.ts` | `committed publish cancels during input-recheck`                                               | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_pre_installation_cancellation.test.ts` | `derived publish cancels during comparison`                                                    | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_pre_installation_cancellation.test.ts` | `derived publish cancels during staging`                                                       | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/publish_pre_installation_cancellation.test.ts` | `derived publish cancels during input-recheck`                                                 | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/serve_imported_styles.test.ts`                 | `accepted committed generated bytes are served without consulting stale disk`                  | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/serve_imported_styles.test.ts`                 | `accepted derived generated bytes are served without consulting stale disk`                    | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/serve_imported_styles.test.ts`                 | `committed watched Serve returns accepted scoped bytes`                                        | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/serve_imported_styles.test.ts`                 | `committed no-watch Serve returns accepted scoped bytes`                                       | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/serve_imported_styles.test.ts`                 | `derived watched Serve returns accepted scoped bytes`                                          | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/serve_imported_styles.test.ts`                 | `derived no-watch Serve returns accepted scoped bytes`                                         | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/serve_transient_imported_styles.test.ts`       | `committed transient HTTP delivers scoped CSS assets from memory for GET and HEAD`             | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/serve_transient_imported_styles.test.ts`       | `derived transient HTTP delivers scoped CSS assets from memory for GET and HEAD`               | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/server_changed_lazy_base.test.ts`              | `non-CSS evidence does not traverse a supplied base resource graph`                            | 12: Renamed or deduplicated; current assertions and real fixture dimensions retained. |
| `tests/source_boundary.test.ts`                       | `transformer imports reject authoring inputs outside repoRoot`                                 | 4: Removed only this obsolete parameterized case.                                     |
| `tests/private_metadata.test.ts`                      | `build rejects a resource or link to internal metadata: mokabook-manifest.json`                | 2: Removed only this obsolete parameterized case.                                     |
| `tests/private_metadata.test.ts`                      | `build rejects a resource or link to internal metadata: mockbook-manifest.json`                | 2: Removed only this obsolete parameterized case.                                     |

| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: committed stylesheet, regular at branch point, deleted now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: committed image, regular at branch point, deleted now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: committed embedded HTML, regular at branch point, deleted now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: derived stylesheet, regular at branch point, deleted now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: derived image, regular at branch point, deleted now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: derived embedded HTML, regular at branch point, deleted now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: committed image, absent at branch point, absent now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: derived embedded HTML, absent at branch point, absent now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: committed stylesheet, absent at branch point, absent now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: derived image, absent at branch point, absent now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: committed image, regular at branch point, dangling now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: derived image, regular at branch point, escaping now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |
| `tests/deleted_resource_classification.test.ts` | `deleted-resource classifiers agree: committed image, regular at branch point, source-root now` | 12: Renamed blob/rebuild parameter; classifier assertions retained. |

The twelve nested mutation subtests of `compatibility transforms cannot
introduce or alter owned control metadata` also disappear with that parent.
Their exact titles are the twelve transformer expressions recorded below.

```text
input.content.replace('</body>', '<template DATA-MOKLY-LINK-CHILD-END=""></template></body>')
input.content.replace('</body>', '<a DATA-MOKLY-LINK-CONTROL="button">Unrelated</a></body>')
input.content.replace('</body>', '<template><a data-mokly-link-control="span">Inert</a></template></body>')
input.content.replace('</head>', '<style DATA-MOKLY-LINK-CONTROL-STYLES=""></style></head>')
input.content.replace('data-mokly-link-control="button"', 'data-mokly-link-control="div"')
input.content.replace(' data-mokly-link-control="button"', '')
input.content.replace(' data-mokly-link-control="button"', '').replace('id="ordinary"', 'id="ordinary" data-mokly-link-control="button"')
input.content.replace('data-mokly-link-control="button"', 'data-mokly-link-control="button" DATA-MOKLY-LINK-CONTROL="div"')
input.content.replace('width:fit-content', 'width:100%')
input.content.replace('data-mokly-link-control-styles=""', 'data-mokly-link-control-styles="changed"')
input.content.replace(/<style data-mokly-link-control-styles="">[^]*?<\/style>/, '')
input.content.replace('id="ordinary"', 'id="ordinary" data-mokly-link-control-future=""')
```

Branch-only removed titles cover old cache diagnosis, former notice handling,
old layout prefixes and old export-version messages. Their replacements assert
the new contracts. The obsolete export baseline parameter `legacy manifest name`
is removed; all canonical pre-v8 cases stay. Both former manifest-name route
cases above disappear; canonical metadata and symlink privacy coverage remains.
Item 12 changes mode names only where the fixture still has real blob/rebuild
or fresh/retained differences. It removes duplicate runs where the mode did
nothing. All original MIME, HTTP method, binary, cancellation-phase and
watched/no-watch dimensions remain.

### Compatibility search results

The final search covers CLI, viewer, scripts, both test trees and protocol JSON
fixtures. Generated output is excluded. It uses `rg -n -i` with
`legacy|former|obsolete|earlier|backward.?compat|fallback|schemaVersion.{0,8}[12367]\b|ManifestV[2-7]\b`
and the extensions `ts`, `tsx`, `mjs`, `cjs` and `json`. It returns 665 lines.
The category counts below cover every result. They describe the accepted
Milestone 17 implementation before the later approvals for items 13 and 14.

- F — Keep the current format number or its positive/negative parser fixture.
- B — Keep the earlier-baseline outcome, canonical version gate or its test.
- N — Keep rejection of removed input, ignored old names or invalid stored keys.
- C — Keep current fallback, cancellation, CSS syntax or ordinary operation ordering.
- T — Keep authored/sample names, test vocabulary or unrelated test infrastructure.
- D — Outside the twelve approved items. Keep and report for the user's decision.

All 665 hits remain. They are kept checks, current behavior, test vocabulary
or the separate candidates listed next. Removing an API does not authorize
removing ordinary authored callback pages, browser Light fallback, obsolete-work
cancellation, native launch behavior, release fallback or version-negative tests.

| Category  | Matching lines |
| --------- | -------------: |
| F         |            276 |
| B         |             70 |
| N         |             26 |
| C         |            192 |
| T         |             96 |
| D         |              5 |
| **Total** |        **665** |

The complete search command is:

```bash
rg -n -i 'legacy|former|obsolete|earlier|backward.?compat|fallback|schemaVersion.{0,8}[12367]\b|ManifestV[2-7]\b' src packages/viewer/src packages/viewer/tests scripts tests docs/protocol/fixtures -g '*.ts' -g '*.tsx' -g '*.mjs' -g '*.cjs' -g '*.json'
```

The raw 665-line record stays in `.context/milestone-17/search-final.txt`.
These counts describe the accepted Milestone 17 search, before items 13 and 14.

A second search for the removed symbols finds no production implementation.
Its remaining results are negative checks only:

- `tests/viewer_generated_delivery.test.ts:21:  assert.equal(Object.hasOwn(catalogue, "generatedPathPrefix"), false);`
- `tests/viewer_generated_delivery.test.ts:44:  assert.equal(Object.hasOwn(fixture, "generatedPathPrefix"), false);`
- `tests/viewer_generated_delivery.test.ts:46:    Object.hasOwn(readCatalogue(fixture), "generatedPathPrefix"),`
- `tests/baseline_older_cache.test.ts:9:for (const format of ["flat-v7", "generated-v6"] as const) {`
- `tests/baseline_older_cache.test.ts:34:async function seed(format: "flat-v7" | "generated-v6") {`
- `tests/baseline_older_cache.test.ts:39:    format === "generated-v6"`
- `tests/baseline_older_cache.test.ts:40:      ? { ...completed.marker, manifestVersion: 6, layout: "generated-v6" }`
- `tests/baseline_older_cache.test.ts:50:    format === "generated-v6"`
- `scripts/package/catalogue.mjs:15:  assert.equal(Object.hasOwn(model, "generatedPathPrefix"), false);`

Additional source tracing records these candidates outside the approved list.
Items 1 and 2 are now approved as removals 13 and 14 in Milestone 18.
Candidates 3–6 remain unchanged.

1. `src/catalogue/projection.ts:229` still reads a historical `dependencies`
   field before current source/declaration fields. This is separate from snapshot ids.
2. `packages/viewer/src/standalone/recovery.ts:38` accepts missing
   `filterBaselineDisclosures` as null; `validChangesStatus` also accepts absence.
   `tests/client_disclosures.test.ts:58` tests this stored-state case.
3. `src/client/react_update_controller.ts:106` adopts a first ready version when
   the initial page version is unknown. Current hosts may use this optional input.
4. `packages/viewer/src/shell/workspace_views_data.ts:153` falls back to current
   per-view classification while a full comparison is pending. Its comment also
   says legacy. Removing this requires a separate current-behavior decision.
5. `tests/browser/component_design_fixture.ts:19` maps historical fixture route
   labels to current design ids. `tests/shell_fixture_2.ts:29` accepts two inspector
   markup shapes. These test helpers are outside the transformer/layout API work.
6. `tests/catalogue_removed_previews.test.ts:40` names old catalogues while
   exercising omitted optional preview descriptors on a v4 model. The current
   reader still accepts that absence; preview descriptors are not item 10's ids.

Stable hash domains, including `mokly-historical-snapshot-v2` and component
instance-key domains, remain unchanged. The disclosure v2 key appears only
as negative test data. Old notices now remain ordinary text.

The separate marker search finds `src/publication/files.ts:154–162` still
rejects source references inside a tree marked `.mokly-preview-artifact`.
This is a protected-artifact check, not ownership adoption. It stays unchanged.
Its negative fixture uses remain in `tests/export_migration.test.ts` and
`tests/preview_output_safety.test.ts`; `tests/preview.test.ts` asserts that no
current preview writes that marker. No old marker can authorize replacement.

### Final validation and completion

All checks use Node `22.14.0` first on `PATH`, npm `11.11.0` and temporary
paths under `.context/`. The final full gate passes:

| Command                                                                  | Result                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                                                   | Pass, including the clean build and final Markdown update.                                                               |
| `npm run lint`                                                           | Pass.                                                                                                                    |
| `npm run typecheck`                                                      | Pass, including the clean build.                                                                                         |
| `npm test`                                                               | 3,768 pass; zero failures, skips or cancellations.                                                                       |
| `npm run test:browser -- --output .context/milestone-17/browser-results` | 970 pass, including hydration; zero retries or skips.                                                                    |
| `npm run example:check`                                                  | 436 valid untracked files.                                                                                               |
| `cargo xtask check`                                                      | Pass; 15 Rust tests, six packed-consumer scenarios, another 3,768 unit tests, 747 browser cases and 223 hydration cases. |

The complete cargo retry took 4,146.323 seconds. The direct browser command took
2,331.617 seconds. These are validation timings, not a controlled performance
comparison. The 600-second fixture limit, workers, retries and assertions remain
unchanged. A clean build before browser/cargo verification removes every compiled
file for the deleted modules. The source-size check covers 984 files. All four
repository ratchets pass with no new exemption or raised cap. The release-export
check records four documented removed exports.

The dependency audit keeps main's unchanged record and strict packed-consumer
audits. The accepted repository risk output is:

```text
Accepted dependency risk: GHSA-vfj7-8cjw-p6xm; package: braces.
Path: node_modules/metro-file-map -> node_modules/micromatch -> node_modules/braces
End date: 2026-11-03 UTC; 30 days left.
Reason: Dev-only React Native peer dependency. The repository does not run Metro or send untrusted patterns to it. No patched release is available.
Tracking: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
```

The required baseline regressions failed before implementation: stale root v7,
empty/truncated cache markers and direct marker writes. Their exact errors were:

```text
[mokly/baseline-incompatible-earlier] the comparison base was built by an earlier Mokly version
[mokly/baseline-output-invalid] Invalid completed baseline cache
[mokly/baseline-output-invalid] Invalid completed baseline cache
[mokly/baseline-output-invalid] Could not prepare baseline: Never write complete.json in place
```

The first complete unit run passed 3,763 of 3,768 tests. Five stale expectations
failed: fixture bytes, two former-notice assertions and two preview migration
setups. Their diagnostics included these exact lines:

```text
9509 !== 9553
The input was expected to not match the regular expression /Generated by/. Input:
+ '<!-- Generated by mokly; ownership=v1; source-base64=c29tZS9vdGhlci9vd25lci50cw==. Do not edit. -->\n' +
+   '<html><body>Unchanged</body></html>\n'
- '<html><body>Unchanged</body></html>\n'
refusing to replace unowned preview directory: /home/vercel-sandbox/mokly/.context/mokly-test-SZ5ruu/.context/published. [mokly/export-invalid] Export ownership is missing; choose an empty directory.
refusing to replace unowned preview directory: /home/vercel-sandbox/mokly/.context/mokly-test-1fStGm/.context/published. [mokly/export-invalid] Export ownership is missing; choose an empty directory.
```

The fixture pins its new exact hash/size. Former notices remain ordinary text.
Preview route tests replace a valid current artifact; only their migration
setup is removed. All route assertions remain. The 16 focused bootstrap/Browse
checks and four notice/preview checks pass, followed by both complete unit runs.

The internal-export check first reported the four helpers described above.
Narrowing/removing their obsolete exports resolves that check. The first cargo
attempt then found the packed API test's annotation on the wrong line:

```text
api.tsx(276,1): error TS2578: Unused '@ts-expect-error' directive.
api.tsx(279,3): error TS2353: Object literal may only specify known properties, and 'compatibility' does not exist in type 'MoklyConfig'.
[xtask/command] `npm run package:smoke:prepared -- --artifacts .context/verification/package-artifacts` failed with status 1
```

Moving the annotation onto the rejected property preserves the negative type
check. The six packed scenarios pass, followed by the full cargo retry above.
No dependency, audit, timeout or retry policy changes. Development diagnostics,
raw logs, full file summaries and exact removed-title lists are retained under
`.context/milestone-17/`. The final Markdown tests and `git diff --check` pass.
The main tip remains `800fe9f88a0173429b25baa1bcf41ed9e59b2256`; no merge occurs.
Branch checks precede the Conventional Commit and explicit branch push.
Milestone 18 and its user-owned final review follow after this push.

## Milestone 18: Verify and review the compatibility removal

Milestone 17 (`49132487`) is accepted. The user approved items 13 and 14,
snapshot-id contract alignment and the compact search record for this step.
Candidates 3–6 remain outside this step. The user owns the final review.

- [x] Prove current manifest, live-index, Serve and worker dependency producers.
      Implement item 13 according to that evidence, with regression coverage.
- [x] Require both stored recovery fields under item 14. Write rejection tests
      first; preserve current valid writer round trips and other recovery checks.
- [x] Align removed snapshot-id code, error text and contracts with every current
      writer. Test Serve's local comparison request and its public catalogue.
      Retain the existing comparison-URL allowlist.
- [x] Replace the Milestone 17 per-file search table with category counts and the
      command. Keep its second search, candidate list and marker search.
- [x] Re-read every document changed in Milestones 16 and 17 against the code,
      and fix drift. Validate changed Markdown.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check` after these code changes; record exact outcomes.
- [x] `git add -A`; commit with Conventional Commits; push.
- [x] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md`; report numbered findings
      with severities and recommendations without changing the implementation.

### Current producer and format decisions

The manifest writer maps authoring `dependencies` to `declaredDependencies`.
The live index uses that writer. Runtime compaction drops usage only, and IPC
transfers the accepted entries rather than rebuilding their dependency fields.
Before code changes, `tests/catalogue_manifest_producers.test.ts` passed:
v8 build, serialized v8, live index, compact Serve runtime, startup IPC and
background compilation each emit 10 entries across all four kinds, including
component variants, with no `dependencies` field. Each published dependency
list equals the sorted unique source/declaration union. A wider trace then finds
a current producer in `packages/viewer/src/viewer/projection.ts`:
`displayEntry` spreads `entry.details`, including `dependencies`, and
`viewerCatalogue` places those records on its `live-index-1` display manifest.
SSR, standalone hydration and current capability adoption use that conversion.
The expanded probe confirms this field on every display entry and verifies its
public round trip. Under item 13's condition, retain the branch and rename
`historical` to `displayDependencies`. No canonical v8 producer or transfer gains
that field; no earlier-format reader is restored.

The stored Browse record requires a real live Changes status. General shell
snapshots also serve static and embedded hosts and keep their optional status;
the watched host must not store an incomplete Browse record or invent a status.

The public comparison-path validator currently accepts only immutable generation
URLs. Serve's local `mokly-viewer/diffs/review.json` endpoint is a request route,
not a public catalogue pointer. `PublicReviewAliases.capture` produces the
generation URL. Keep that allowlist. Require snapshot ids whenever the public
`comparisonUrl` is non-null, and use `removed entry needs snapshotId when comparisonUrl is non-null`. Current
Serve derives ids from its accepted baseline before publishing the pointer.
The regression must request the local endpoint, validate Serve's published
model, and prove that a raw local endpoint is still invalid catalogue data.

### Document check

Read all 55 Markdown files changed in Milestones 16 and 17, plus the catalogue
and client owner READMEs changed here. The per-document record is
`.context/milestone-18/document-audit.md`. Corrections remove a remaining
transformer-stage claim, describe manifest v8, align cache reuse and cheap
retention, retain exact export-marker errors, and describe current resource
discovery, portable links, dependency producers and recovery fields. The viewer
README and catalogue contract state the same snapshot-id rule as the reader.
No protocol cap increases. No main file or test title is removed in this step.

Finding 17's `entriesDir === mockupsDir` wording remains for the user's decision;
the code still rejects that configuration. Candidates 3–6 and all other
unapproved findings remain unchanged. This document check does not perform the
final implementation review.

### Smoke evidence

`node --import tsx .context/milestone-18/smoke.ts` passes on Node 22.14.0.
Base `66ea7e2407631396f266f40972f73b45f289eff3` commits a stale root-level v7
manifest and no generated tree. Its own recipe rebuilds manifest v8, and Changes
is `ready`. Build and Check pass in the isolated source-only example repository.

The styled Serve screen is `http://127.0.0.1:40447/view/screens/example-welcome.html`.
A plain static server returns 200 for
`http://127.0.0.1:37529/mokly-viewer/catalogue.json`, with catalogue v4 and
`ready` Changes. Both screens load authored and imported CSS, use Inter and a
32px heading, and have six stylesheets. No browser request fails.

The export top level is `.mokly-export-artifact`, `404.html`, `index.html`,
`mokly-viewer`, `static` and `view`. A scan of all 147 files finds only
`.mokly-export-artifact` among segments starting with `.`, `_`, `#` or `~`.
Screenshots and command receipts stay under `.context/milestone-18/`.
Both screenshots were visually checked. All smoke servers and browsers stopped.

### Full gate and completion

All commands use Node 22.14.0 first on `PATH`, npm 11.11.0 and scratch paths
under `.context/`. The final full gate passes:

| Command                                                                  | Result                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                                                   | Pass.                                                                                                                                      |
| `npm run lint`                                                           | Pass.                                                                                                                                      |
| `npm run typecheck`                                                      | Pass.                                                                                                                                      |
| `npm test`                                                               | 3,773 pass; zero failures, skips or cancellations.                                                                                         |
| `npm run test:browser -- --output .context/milestone-18/browser-results` | 970 pass, including hydration; zero retries or skips.                                                                                      |
| `npm run example:check`                                                  | 436 valid untracked files.                                                                                                                 |
| `cargo xtask check`                                                      | Pass: audit, repository checks, 15 Rust tests, six packed consumers, another 3,773 unit tests, 747 Chromium cases and 223 hydration cases. |

The direct unit run took 1,403.258 seconds; the direct browser command took
2,343.511 seconds; the complete cargo gate took 4,182.927 seconds. These are
validation times, not a controlled performance comparison. The source-size
check covers 991 files. All four repository ratchets pass without any raised
cap, exemption, timeout or retry change. The unchanged audit record reports:

```text
Accepted dependency risk: GHSA-vfj7-8cjw-p6xm; package: braces.
Path: node_modules/metro-file-map -> node_modules/micromatch -> node_modules/braces
End date: 2026-11-03 UTC; 29 days left.
Reason: Dev-only React Native peer dependency. The repository does not run Metro or send untrusted patterns to it. No patched release is available.
Tracking: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
```

Six new unit cases cover the producer proof, both required recovery fields,
the real writer, incomplete capture and Serve snapshot identities. The total
increases by five because the dynamic directory-lint probe for
`src/compatibility/` no longer runs after that directory's approved item 4
removal in Milestone 17. No test source title was removed here; the generator
and every current-folder probe stay unchanged. No new main file deletion occurs.

Before implementation, the new reader tests produced three expected failures.
Missing recovery fields returned a state instead of `undefined`; the Serve
test reported this exact diagnostic difference:

```text
+   message: '[mokly/components] $catalogue: removed entry needs snapshotId when a comparison generation exists'
-   message: '[mokly/components] $catalogue: removed entry needs snapshotId when comparisonUrl is non-null'
```

A new negative type test initially supplied an explicit undefined status:

```text
tests/client_browser.test.ts(65,30): error TS2375: Type '{ changesStatus: undefined; disclosures: Readonly<Record<string, boolean>> | null; colorScheme: ViewerSelection["colorScheme"]; detailsOpen: boolean; ... 6 more ...; viewport: ViewerSelection["viewport"]; }' is not assignable to type 'ShellRecoverySnapshot' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
  Types of property 'changesStatus' are incompatible.
    Type 'undefined' is not assignable to type 'LiveChangesStatus'.
```

The test now omits the optional field. The first full unit run passed 3,772 of
3,773 cases. The one failure came from a helper without the current live status:

```text
✖ React live updates provide recovery and replace strict-effect streams
Error [ERR_TEST_FAILURE]: Expected values to be strictly deep-equal:
+ actual - expected

+ undefined
```

The helper and two stored-state browser fixtures now include `ready` status.
Their original assertions stay. The 11-case focused retry and the complete
gate above pass. Exact full error objects and command logs remain in
`.context/milestone-18/failures.md` and the adjacent logs. The final evidence
table initially failed formatting; applying Prettier to this plan resolves it.
The final Markdown
link/size/index/history and guide checks pass all 13 tests; `git diff --check`
passes. The final main fetch remains
`800fe9f88a0173429b25baa1bcf41ed9e59b2256`; no merge occurs.
Branch checks precede the Conventional Commit and explicit branch push.
The final implementation-review TODO remains for the orchestrator.

### Final review outcome

Five parallel reviewers checked the pushed tip `497445c1` against
`origin/main` at `800fe9f8` with `docs/implementation-review-prompt.md`. They
covered baselines and caches; the build and configuration; export and
preview; the viewer and catalogue; and tests, documents and mainline
preservation. Each claim was reproduced with a scratch script or verified in
the code. No unapproved removal from `main` was found: the 13 deleted `main`
files and every missing `main` test title are approved. The review reported 8
new findings, numbered 58 to 65, without changes: 1 medium and 7 low.

- Medium (58): a component `<style>` element in `<body>` together with
  `MockLink asChild` breaks Build and Serve, also on `main`. Style ownership
  pairs `<style>` elements by position, and the link adapter adds its own
  stylesheet in `<head>`. The removal deleted the only test that reached this
  check.
- Low (59–65): retention can remove a cache entry that another process is
  about to lock; a stale tracked v7 manifest still blocks a comparison after
  the catalogue folder moves; export refusals do not name the folder, so
  publish and preview folders from earlier releases block without a remedy;
  the kept `dependencies` branch (item 13) is reached only by a test; dead code,
  test lines and lint paths remain from the removal; documents still describe
  removed items; and some kept tests and plan rows overstate their coverage.

Findings 13, 19, 24, 38, 43 and 47 are fixed. Findings 36 and 44 are fixed
apart from findings 60 and 61. Findings 3, 25, 27, 42, 48 and 53 changed form.
Findings 10, 17, 37, 45, 46, 49, 52, 54, 56 and 57 remain open. Findings 35,
39–41, 50, 51 and 55 are in code that Milestones 16–18 did not change, and the
earlier findings recorded in Milestone 15 keep their status. Main had not
moved. Every finding awaits the user's decision.

Finding 66 (low, performance) was added after the review at the user's
request. A CPU profile of `mokly check` on the example catalogue (436
documents, about 10.4 s of compile time) attributes about 1.3 s to repeated
checks that decide whether an authored file may be public. About 1.0 s comes
from configured stylesheets during rendering (`src/build/render.ts:202`, the
same code as on `main`), and about 0.3 s from the link walk
(`src/build/html_links.ts`). Each check calls the file system and keeps no
result, although the example has only about 30 authored files. The
recommendation is to decide each file once per compile and reuse the result,
in the same module as the shared list builder that finding 14 recommends.

## Milestone 19: Define the review-fix contracts

Documentation only. On 2026-10-05 the user chose an option for each open
finding below. This milestone records the decisions, defines the exact
behaviour, messages and tests for Milestones 20 and 24–27 in the affected contracts,
guides and READMEs, and fixes the documentation-only findings.

### Decisions

- **35 A:** Serve keeps the asset closure. One shared closure builder serves
  build, on-demand rendering, the watcher, Serve, export and publication. On
  demand it adds and walks authored link targets but stops at generated pages,
  so earlier finding 7 does not return. Serve replaces its list only with a
  checked result from that builder.
- **14 B with 66 A:** renderer-declared resources pass the shared builder's
  checks. Because 35 is A, Serve also reads each listed file without following
  symbolic links and re-checks it when it reads it. One module decides once per
  compile whether each authored file may be public, and every caller reuses
  that decision.
- **5 A:** build and export allow a referenced authored file unless it is a
  Mokly input or inside a protected location. A file extension or a
  build-folder name alone no longer makes a referenced file private.
- **37 A:** restore `main`'s error "A consumer package root must not equal
  mockupsDir; choose a separate public output directory.", its contract
  sentence and its test.
- **49 A:** remove the name-based skip of folders called `mokly-generated`;
  keep the path check for the real output folder.
- **61 B:** add no upgrade handling. Export refusals name the destination folder
  and, where they exist, the unexpected files.
- **56 B:** `parseStaticDelivery` classifies input as valid, unsupported-version
  or invalid and never throws. Only browser boundary readers throw; export
  restores its typed `export-invalid` error and the strict test.
- **40 B and 9 B:** one watch-setup module serves Serve and `build --watch`:
  source list, PostCSS scan folders, referenced-file watching and
  classification. Edits saved during the first build are not lost, and
  `serve --build` rewrites the manifest when a stylesheet reload changes the
  closure.
- **41 B:** Ctrl+C cancels the output-lock wait and the running compile in
  `build --watch`; Ctrl+C during the first build writes nothing.
- **50 B:** one summary helper for every writing command, with a `"."`
  fallback; the terminal contract documents `serve --build` and `build --watch`.
- **18 A:** in plain mode, the baseline rebuild notes and the earlier-version
  line go to stdout. Successful plain commands write nothing to stderr.
- **16 B:** `check` asks Git directly whether it is inside a work tree, never
  matches message text, and reports a typed error when `git` is missing.
- **51 A:** `check` suggestions use Git's real path when it differs from the
  configured path.
- **39 B:** one inventory reader per comparison side (base: `generatedFiles`
  and `assetClosure`; head: the in-memory output and its closure) decides
  "absent" versus "invalid" for every comparison reader.
- **54 A:** restore targeted base reads for catalogues without components.
- **55 A:** also remove the base's generated folder from Git's changed paths.
- **59 A:** lock acquisition recreates a removed cache entry folder and retries
  a bounded number of times.
- **60 A:** moved-root discovery ignores earlier-version matches when exactly one
  v8 match exists.
- **48 A:** add tests for a SHA-256 repository, binary assets read from Git, and
  Serve's earlier-version line (printed once, cleared when the base moves).
- **58 A:** post-render edits report their text patches; style ownership
  offsets move through one shared offset map instead of `<style>` counting.
- **62 A:** remove the `dependencies` branch in `src/catalogue/projection.ts`,
  its test case and the README sentence.
- **10 B:** one shared "delivered document matches route" helper serves every
  same-origin comparison and accepts the extensionless form.
- **25 B:** decode the frame path once, test double-encoded paths, and make the
  contract require only the checks the adapters can make.
- **57 B:** remove the shared browser baseline setup and return both export
  fixtures to the committed-output helper. Keep the cold-rebuild test and the
  real `preview:build` test.
- **63 B:** delete the listed dead code and stale references. Use a small
  repository script built on TypeScript's language service `findReferences`,
  not Knip v6 or pinned Knip v5. Check class methods, getters, setters and
  properties in `src/` and `packages/viewer/src` for references outside their
  declarations. Ratchet results like the internal-export check and run it in
  the same gate. Measure its runtime; if it exceeds about 60 seconds, restrict
  it to non-exported classes and record that choice. Written-but-unread
  interface fields are outside this tool; remove only the listed fields by hand.
  Also test that every exact file path in the ESLint configuration exists.
- **65 A:** fix the listed tests and plan rows.
- **42 B:** correct the release notes, and commit generated public API reports
  for `@mokly/mokly` and `@mokly/viewer`. CI fails when a report changes
  without a release-note change.
- **45 A, 46 A and 64 A:** fix each listed documentation line, and rewrite
  history wording in protocol documents as current contracts.
- **3 B:** the squash-merge message carries `!` and `BREAKING CHANGE:` footers.
  Mokly does not cache the earlier-version result.

Findings 17 (rules 1 and 3; rule 2 is 37 A) and 52 await the user's decision.
Do not change them. Approved changes to `main` behaviour: 18 A moves plain
notices from stderr to stdout, and 5 A stops export from rejecting referenced
authored files by extension or build-folder name alone. 37 A, 54 A and 57 B
restore `main`'s behaviour.

- [x] Define the exact behaviour, messages and tests for every decision above
      in the affected protocol documents, guides and READMEs.
- [x] Fix the documentation-only findings 45, 46 and 64, and the release-note
      text of finding 42.
- [x] Write the squash-merge message text with `!` and `BREAKING CHANGE:`
      footers into this milestone, for the PR description (3 B).
- [x] Run `npm run format:check` and the documentation tests; review the diff;
      commit with Conventional Commits; push.

### Contract choices and verified review detail

The focused contracts are `mokly-public-closure.md`,
`mokly-watch-writers.md`, `mokly-comparison-inventory.md`,
`mokly-boundary-results.md` and `verification-api-members.md` under
`docs/protocol/`. Existing owner documents link to their approved targets.
The contracts keep findings 17 and 52 unchanged. Package-root equality is the
separately approved restoration, not resolution of finding 17's other rules.

The detailed reports in `.context/review-reports/INDEX.md` resolve the missing
file lists. Their references were checked against the current tree. The
source of each requested fix is recorded in that index; already-correct text
is retained. Findings 45, 46 and 64 are documentation work here. The listed
member/test cleanup and inaccurate Milestone 17 table rows belong to the
approved tooling step. No unrelated review finding is changed.

Tool discovery confirms API Extractor 7.59.3 supports the required Node runtime.
The report design runs it per typed public subpath and inventories non-code
exports. Knip 6.39.0 is current and supports Node 22.14.0, but its maintained
v6 line removed `classMembers`. The user's follow-up explicitly selects a
small TypeScript language-service ratchet using `findReferences` instead.
No new member-analysis package or old Knip version is installed. API Extractor
still comes from the current npm release when implementation starts. Registry
metadata and research receipts are under `.context/milestone-19/`.

### Squash-merge message

Use this text in the PR description and as the squash-merge message; release
versions and changelogs remain owned by the release workflow:

```text
feat!: simplify generated output and delivery

Use one generated tree, checked authored resources, shared watching and
per-commit v8 baseline selection. Keep current format rejection, safe output
transactions and content-delta publication.

BREAKING CHANGE: Remove generatedOutput and publicExclude configuration.
Only build, build --watch and serve --build write generated output. Check
uses Git-index tracking. Generated files and the private v8 manifest live
under mockupsDir/mokly-generated. Earlier baseline results are not cached.

BREAKING CHANGE: Remove compatibility.transformer and its public types.
Author portable documents and links directly. Current readers do not adopt
or convert older catalogue, baseline, cache or export formats.

BREAKING CHANGE: Viewer resources use mokly-viewer with no __mokly alias.
Catalogue and static delivery use v4, bootstrap uses v1, ownership uses v3,
and upload uses v2. Older services must update before accepting publication.
ManifestV8 replaces ManifestV7 and adds the closure and generated inventory.

BREAKING CHANGE: Stored Browse recovery requires changesStatus and
filterBaselineDisclosures. Removed records require snapshotId with any
non-null comparisonUrl. Static delivery parsing returns a tagged result;
browser readers retain typed version failures. Plain successful baseline
notices use stdout. See npm-release-notes.md for the complete API migration.
```

### Documentation verification and scope

Verified every explicit report reference against current source. The corrected
facts include generated CSS/assets in guides, catalogue v4, current-marker
stripping, unsafe-tree Check errors, complete baseline IPC descriptors,
`html.links` timings, completion temporary cleanup, and lexical policy on
comparison copies. Protocol prose describes current rules; meaningful Git
merge-base terminology, former-parent labels, unsupported-input rejection and
release migration guidance remain. No new history lint is added (46 A).
The full search and its retained normative matches are under
`.context/milestone-19/`. No main file or main test title is removed or renamed.

The Review acceptance matrix uses the existing internal Review operation;
the CLI has no `review` command, so this plan does not add one. The debris
regression is assigned to the baseline/comparison step. Existing capped protocol
pages keep their exact line counts; no cap or test metadata changes here.

Validation: Node 22.14.0; `npm run format:check` passes. The exact Markdown
command is `node --import tsx --test tests/markdown_links.test.ts tests/protocol_doc_sizes.test.ts tests/protocol_split_links.test.ts tests/protocol_doc_history.test.ts tests/guides_structure.test.ts tests/guides_copy.test.ts`;
all 13 pass with no failures, skips or cancellations. `git diff --check` passes.
No validation failed. This documentation-only step requires no full cargo gate.
The source tip remains `800fe9f88a0173429b25baa1bcf41ed9e59b2256`; no merge.
Branch guards precede the documentation commit and explicit branch push.

## Milestone 20: One public-file policy

Implements 35 A, 14 B, 66 A, 5 A, 37 A, 49 A, 61 B and 56 B.

Review correction: 37 A restores main's realpath equality check in the export
resource policy with `exportError` and the exact package-root message. It does
not add `config-invalid` or a config-load/Build/Serve rejection. The contracts
and restored main test title/assertion follow that boundary.

- [x] One module decides once per compile whether each authored file may be
      public. Build, rendering, the link walk, Serve, export and publication
      use it.
- [x] One shared closure builder for build, on-demand rendering, the watcher,
      Serve, export and publication. Test that the watcher's list equals the
      build's list for a fixture with `<a href>`, `data-nav-href`, preload,
      `<iframe>`, `srcset` and renderer resources. Add a watched-Serve test for
      linked authored pages and PDFs.
- [x] Renderer resources pass the same checks. Serve reads listed files without
      following symbolic links.
- [x] Implement 5 A, 37 A, 49 A, 61 B and 56 B with their tests.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit with Conventional Commits; push.

### Regression-first evidence and implementation

Before production edits, `node --import tsx --test tests/public_closure_shared.test.ts tests/review_boundary_results.test.ts`
failed all nine cases. The failures reproduced the separate Watch closure,
authored navigation 404, unchecked seed, extension/folder-only rejection,
symlink read, missing package-root export guard, source-name skip, throwing
delivery parser and export refusal without a destination. Exact output includes:

```text
404 !== 200
Missing expected exception.
[mokly/build-invalid] document links and resources are invalid:
200 !== 404
Missing expected rejection.
Unsupported Mokly delivery version undefined; this viewer supports version 4.
[mokly/export-invalid] Export ownership is missing; choose an empty directory.
```

The complete errors and assertion diffs are in `.context/milestone-20/red.log`.
Two test fixtures were corrected before acceptance: the discovery module exports
its definitions through `mockups` and directly asserts discovery membership;
the startup test uses the live runtime rather than preloaded compiled bytes.
The new implementation shares generation-scoped decisions and one link walk.
Watch recovery retains confined observable aliases separately from checked
serving membership. Existing alias/recovery tests stay intact; Serve reads never
follow those links. Component-resource declarations keep their existing typed
validation error and route, while the shared link walker keeps `build-invalid`;
this preserves the existing main error boundary. Renderer-only seeds retain their declaring route. Export's
package-root check uses the exact restored `exportError` boundary.

The focused 51-case suite and the watched authored-link regression pass. The
smoke command `node --import tsx .context/milestone-20/smoke.ts` returns 200 for
`http://127.0.0.1:46253/static/guide.html`, `guide.css`, `spec.pdf` and the
generated screen. Editing the PDF publishes its new bytes. All servers stop.
The type check passes after correcting optional fixture metadata. The first
full unit run found two issues: an escaping alias changed the existing missing
target diagnostic, and one exact ownership-error assertion still omitted the
new destination. The policy now retains the missing-target diagnostic while
still denying the alias; the assertion includes the exact output path under
61 B. Exact failure lines were:

```text
The input did not match the regular expression /font\.css: missing target font\.woff2/.
+ '[mokly/export-invalid] Invalid export ownership inventory: /home/vercel-sandbox/mokly/.context/mokly-test-yzMtnl/site.'
- '[mokly/export-invalid] Invalid export ownership inventory.'
```

Development failures and complete error objects stay under
`.context/milestone-20/`; the full gate is rerun after these fixes.

### Full gate and preservation

All seven commands pass on Node 22.14.0:

| Command                                                                  | Result                                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                                   | Pass.                                                                                                     |
| `npm run lint`                                                           | Pass.                                                                                                     |
| `npm run typecheck`                                                      | Pass.                                                                                                     |
| `npm test`                                                               | 3,786 pass; zero skipped or cancelled.                                                                    |
| `npm run test:browser -- --output .context/milestone-20/browser-results` | 970 pass; no retries or skips.                                                                            |
| `npm run example:check`                                                  | 436 valid untracked files.                                                                                |
| `cargo xtask check`                                                      | Pass; audit, 15 Rust tests, six packed consumers, 3,786 unit tests, 747 Chromium and 223 hydration cases. |

The complete cargo gate took 2,906.842 seconds. Repository length and export
ratchets pass with no cap increase or new exception. The combined closure fixture
now includes renderer-only CSS in the same document as every required link form;
its five focused tests and the complete cargo unit run pass. Its first setup
omitted the declared component owner and failed with
`[mokly/components] home / mobile/light: style/resource owners must render in this view`;
adding the rendered owner corrected the fixture without a production change.

No main file or main test title is removed or renamed. Main's exact title
`a package root equal to mockupsDir fails explicitly instead of publishing a package`
is restored, replacing this branch's metadata-only title. The shared policy
reuses the existing source/location helpers. Existing Watch alias recovery
coverage remains; recovery locations never confer serving permission.

The final fetch found main at `c4138a0b9578448d81ce2a2868bd7ec47f5a88c6`,
`feat!: file-path identity and Markdown documents (#131)`, after the merged
source tip `800fe9f8`. Per the user's instruction, it is not merged. Its new
files and contracts are unmerged additions, not deletions by this milestone.
The milestone itself has no deleted file. The full gate's comparison boundary
remains the existing merge base. Final Markdown checks and `git diff --check`
pass. All smoke and verification processes stop. Branch checks precede commit
and explicit push; the final review remains with the orchestrator.

## Milestone 21: Define the merge with path identity

Documentation only. On 2026-10-05 `main` moved to `c4138a0b` (#131, "file-path
identity and Markdown documents"), which changes 1,614 files. It replaces each
entry's `id` and `navPath` with one path derived from the entry's file
location, makes Markdown files `document` entries, detects moves with
`previousPath`, and renames the Pages section to Specs. It defines its own
manifest v8, public catalogue read model v4 and review result v5, which differ
from this branch's v8 and v4. Its code still has the output modes, ownership
headers, the `__mokly/` namespace and compatibility code that this branch
removed.

The user decided:

- **1 A:** merge `main` now, before the remaining review fixes. Codex astra at
  maximum thinking performs the merge.
- **2 A:** give the merged formats new numbers: manifest v9, public catalogue
  read model v5 and review result v6. One number means one shape. Output from
  `main`'s unreleased v8, v4 and v5 then counts as earlier output and gets the
  earlier-version outcome. Any other format that has two different shapes
  under one number after the merge also gets a new number.

The merged design keeps every `main` feature and every approved decision of
this branch:

- From `main`: path identity, folders, `_folder.json` and `defineFolder`,
  Markdown documents and their resources, moves with `previousPath`, the Specs
  and Components sections, and every other feature and test of #131 and of any
  later `main` commit that this merge includes.
- From this branch: one Mokly-owned `<mockupsDir>/mokly-generated/` tree for
  every generated file, written only by `build`, `build --watch` and
  `serve --build`; Git index tracking for `check`; the referenced asset closure
  and the shared public-file policy; per-commit baselines that read only the
  current format; the `mokly-viewer/` namespace and its version gates;
  ownership v3 and upload v2; no backward-compatibility code (Milestone 16);
  and the implemented decisions of Milestones 19–20.
- Where `main` brings back something that an approved decision of this branch
  removed (for example output modes, ownership headers, `__mokly/`, earlier
  manifest names, the compatibility transformer or legacy export ownership),
  the removal stays approved. Record each such removal of `main` code, with
  its decision, in the preservation audit.

- [ ] Fetch `main`. Capture the source tip and merge base before any merge,
      audit `main`'s additions with
      `git diff --name-status <merge-base>..origin/main`, and write a
      preservation list into this milestone.
- [ ] Define the combined design in the protocol documents, guides and
      READMEs: path-identity routes inside `mokly-generated/`, the asset closure
      for Markdown document resources, the version number of every format
      after the merge, the earlier-version outcome for `main`'s v8 output, and
      the `mokly-viewer/` paths for the new viewer features.
- [ ] Record every planned removal of `main` code with its approving decision.
- [ ] Run `npm run format:check` and the documentation tests; review the diff;
      commit with Conventional Commits; push.

## Milestone 22: Merge `main` and apply the combined design

- [ ] Merge `origin/main` once under `AGENTS.md` "Mainline Feature
      Preservation": resolve conflicts path by path, confirm that the merge
      commit has exactly two parents, review `git show --remerge-diff` for every
      listed path, and check deletions against `main`. If `main` moves again
      during this milestone, do not merge again; report the new tip.
- [ ] Apply the combined design from Milestone 21 to the merged code, including
      the new format numbers.
- [ ] Keep every `main` test title and assertion except the approved removals,
      and list each removal in the commit body.
- [ ] Smoke-test `build`, `check`, Serve and export with Markdown documents,
      folders and a moved entry. Changes against a base built by `main`'s #131
      code must give the earlier-version line, and
      `npm run preview:build -- --include-changes --base origin/main` must
      succeed with Changes unavailable.
- [ ] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit; push.

## Milestone 23: Verify the merge and re-plan the review fixes

- [ ] Re-read every document changed in Milestones 21 and 22 against the code,
      and fix drift. If code changes, rerun the full gate.
- [ ] Check each decision of Milestones 24–27 against the merged code. Update
      their TODOs with current files, routes and fixtures. Record each finding
      that the merge resolved or changed, and stop for the user's decision
      where a recorded decision no longer fits.
- [ ] `git add -A`; commit with Conventional Commits; push.
- [ ] After the push, review the merge against `origin/main` using
      `docs/implementation-review-prompt.md`; report numbered findings with
      severities and recommendations without changing the implementation.

## Milestone 24: Shared watching and command output

Implements 40 B, 9 B, 41 B, 50 B, 18 A, 16 B and 51 A.

- [ ] Move the watch setup into one module that Serve and `build --watch` use.
      Run each watch case through both commands in one test set, including
      edits during the first build and closure changes from stylesheets.
- [ ] Connect Ctrl+C to the lock wait and the running compile. Test it with a
      held lock.
- [ ] Implement 50 B, 18 A, 16 B and 51 A with their tests.
- [ ] Run the full gate as in Milestone 20; `git add -A`; commit; push.

## Milestone 25: Comparisons, baselines and build edits

Implements 39 B, 54 A, 55 A, 59 A, 60 A, 48 A, 58 A and 62 A.

- [ ] Add the per-side inventory reader. Test added, removed and renamed pages,
      screens, stylesheets, assets and authored files through the internal Review
      operation and live Changes. The public CLI has no `review` command.
- [ ] Restore targeted base reads (54 A) and filter the base's generated folder
      (55 A), with a moved-root comparison test.
- [ ] Implement 59 A with a deterministic interleaving test, and 60 A.
- [ ] Add a table-driven cache-debris sweep test for every temporary name the
      builder writes, including `complete-<uuid>.tmp` (64 A).
- [ ] Add the 48 A tests.
- [ ] Implement 58 A with Build and Serve tests, and 62 A.
- [ ] Run the full gate as in Milestone 20; `git add -A`; commit; push.

## Milestone 26: Viewer frame URLs

Tags: ui

Implements 10 B and 25 B in the viewer. No backend work.

- [ ] Add the shared "delivered document matches route" helper and use it in
      every same-origin comparison. Add a browser test with a static host that
      redirects `x.html` to `x`.
- [ ] Decode the frame path once and test double-encoded paths.
- [ ] Run the full gate as in Milestone 20; `git add -A`; commit; push.

## Milestone 27: Test and release tooling

Implements 57 B, 65 A, 63 B and 42 B.

- [ ] Remove the shared browser baseline setup (57 B), and fix the tests and
      plan rows of finding 65.
- [ ] Delete the dead code and stale references, and add the unused-member
      ratchet and the ESLint path test (63 B).
- [ ] Add the public API reports and the CI rule (42 B).
- [ ] Run the full gate as in Milestone 20; `git add -A`; commit; push.

## Milestone 28: Verify and review the review fixes

- [ ] Re-read every document changed in Milestones 19–27 against the code, and
      fix drift. Validate changed Markdown. If code changes, rerun the full gate.
- [ ] `git add -A`; commit with Conventional Commits; push.
- [ ] After the push, review the complete local diff against `origin/main`
      using `docs/implementation-review-prompt.md`; report numbered findings
      with severities and recommendations without changing the implementation.

## Post-merge follow-up (non-blocking)

- Parked: replace archive extraction with Git worktrees in a cache outside
  the repository. The baseline would then be a full checkout, removing the
  harvest, the tar parser and its confinement code, and every in-repository
  `.mokly-cache` special case, at the cost of worktree metadata management,
  a documented cache location, and deleting `node_modules` after each build.
- Coordinate the Cloud product's upload-v2/ownership-v3 receiver, catalogue-v4
  reader, `/mokly-viewer/catalogue.json` fetch path, `diffs/generations/`
  storage paths and embedded viewer/version-error handling. Until upgraded,
  it must reject the new artifact with 426, not accept and misread it. Validate
  a published current-only catalogue and one with Changes after that rollout;
  this external update does not block completion of this branch's plan.
- Smoke-test a fresh consumer with the next published package: `npx mokly`
  and `npx mokly export` produce nothing under `mokly-generated/`, `npx mokly
build` produces it, `check` passes with the directory ignored, and a
  comparison against `origin/main` uses verified v8 blobs or a v8 rebuild when
  required. If that base predates v8, confirm the documented unavailable outcome.
