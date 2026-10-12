# Generated Output Simplification

Status: Active. Milestones 1–23 are complete, including the orchestrator's
review, one re-review and both fix rounds. Decisions on open findings remain.
The branch uses one
generated tree, a referenced authored closure, writer-only output locks, current-format baselines and `mokly-viewer/`.
The combined formats are manifest v9, catalogue v5 and review v6. Milestones
24–28 contain the remaining review fixes. Findings 17 and 52 still await user
decisions. Cloud rollout remains a non-blocking post-merge follow-up.

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
tracked in Git. Only v9 can be a readable baseline after the merge. Complete
v9 output uses Git blobs; missing or incomplete v9 output uses
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
rules and every local URL reachable from generated documents and their CSS.
Renderers return HTML strings and contribute resources through document links.

Superseded in Milestone 15 (2026-10-09): D1 C also accepts `{ html; resources? }`.
D3 A retains checked renderer declarations as private closure seeds, including
CSS declarations that warn and grant no stylesheet ownership.
For the example:

```
examples/basic/mokly-generated/         all generated files, replaced on every build
examples/basic/styles.css …        authored, tracked (15 stylesheets)
examples/basic/design-library/**   authored, tracked (16 stylesheets)
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
  manifest in the generated subtree. Missing or incomplete v9 output rebuilds
  with its own recipe; stale root-level metadata never decides availability.
  Keep the v9 version gate, including the earlier-version outcome after a
  rebuild writes root-level output below v9. Invalid caches are partial and
  rebuild under their lock; completion markers publish by atomic rename.
  Remove transformers, old ownership adaptation and notice handling, obsolete
  reservation/key logic, inferred snapshot ids and serialized layout prefixes.
  Keep current format gates, removed-key diagnostics, identity hash domains,
  exact earlier-baseline product copy and the 426 service-version response.
- Finding 32 = **B**, documentation only: the combined route model derives
  entry identities from configured roots and source paths. Documents use
  `<path>/index.html`; view variants derive their index filenames from that
  identity. No fixed kind prefix is required. The outer generated directory
  is separate, and entry paths may contain the directory-name text. The viewer
  reads catalogue v5 only. Add no route validator or substring rejection for
  this finding; the approved `styles`/`assets` reservation remains.
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
  know exactly which files belong to the catalogue. Only v9
  content is readable. Only the canonical manifest name has metadata status.
- `mockupsDir` keeps its name. The generated child is the fixed name
  `mokly-generated`; unlike local-only `.mokly-cache`, deployable output has
  no leading dot because some static hosts and deploy tools skip dot-paths.
  `publicExclude` and automatic directory-wide public delivery are removed.
  Referenced authored HTML remains part of the checked asset closure.
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

Evidence: `.context/generated-output-simplification/m09-document-validation.md`.

Evidence: `.context/generated-output-simplification/m09-mainline-preservation-audit.md`.

The user approved the Milestone 11 audit exception and writer-only lock
adaptation. Preserve #130's audit policy and #129's writer exclusion and frame
race fix. No reader takes the generated-output lock.

Evidence: `.context/generated-output-simplification/m11-mainline-audit-refresh.md`.

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

Evidence: `.context/generated-output-simplification/m10-contract-proof.md`.

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

Evidence: `.context/generated-output-simplification/m10-validation.md`.

User-approved checkpoint exception: #130 on main supplies the existing,
expiring dev-only audit exception through 2026-11-03. Do not change package
versions, the audit command or audit policy before merging it. This approval
applies only to the Milestone 10 commit/push; Milestone 11 must pass the full
gate, including the audit, before any merged tip is pushed.

Evidence: `.context/generated-output-simplification/m10-dependency-audit.md`.

## Milestone 11: Merge `main` and unify the generated directory

Backend. Status: complete.

Evidence: `.context/generated-output-simplification/m11-integration-progress.md`.

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

Evidence: `.context/generated-output-simplification/m11-integration-adaptations.md`.

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

Evidence: `.context/generated-output-simplification/m11-final-validation.md`.

Merge justifications: `.context/generated-output-simplification/m11-merge-justifications.md`.

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

Evidence: `.context/generated-output-simplification/m12-source-tip.md`.

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

Evidence: `.context/generated-output-simplification/m12-preservation-record.md`.

Evidence: `.context/generated-output-simplification/m12-smoke.md`.

Evidence: `.context/generated-output-simplification/m12-validation.md`.

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

Evidence: `.context/generated-output-simplification/m13-implementation-and-preservation.md`.

Evidence: `.context/generated-output-simplification/m13-validation.md`.

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

Evidence: `.context/generated-output-simplification/m14-fixture-audit.md`.

- [x] Record the comparable independent-preparation run before introducing reuse.
- [x] Retain the same common profile, recipe, cold cases and timing instrumentation
      for the after run; report global setup, teardown and fixture phases explicitly.

Evidence: `.context/generated-output-simplification/m14-before-measurement.md`.

Evidence: `.context/generated-output-simplification/m14-after-measurement.md`.

Evidence: `.context/generated-output-simplification/m14-validation.md`.

## Milestone 15: Verify and review the merged branch

Evidence: `.context/generated-output-simplification/m15-document-audit-inventory.md`.

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

Evidence: `.context/generated-output-simplification/m15-validation.md`.

### Review outcome

The orchestrator reported findings 35–57: one high, eight medium and fourteen
low. They cover closure authority, baselines, watching, compatibility, release
contracts and test preparation. Later approved decisions below define the work.

Evidence: `.context/generated-output-simplification/m15-review-outcome.md`.

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

No current writer omits snapshot identity when an immutable comparison
identity exists. Remove the reader fallback. A non-null public comparison URL
requires each removed record's snapshot id. Keep the generation hash construction
and no-identity records with a null comparison URL.

Evidence: `.context/generated-output-simplification/m16-snapshot-writer-proof.md`.

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

Evidence: `.context/generated-output-simplification/m16-validation.md`.

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

Evidence: `.context/generated-output-simplification/m17-smoke.md`.

Evidence: `.context/generated-output-simplification/m17-mainline-removals-and-titles.md`.

Candidates 1 and 2 became approved removals 13 and 14. Candidates 3–6 remain
outside that approval. Current format gates, source protection and hash domains
stay. The recorded candidate list and both searches are in the evidence file.

Evidence: `.context/generated-output-simplification/m17-compatibility-search.md`.

Evidence: `.context/generated-output-simplification/m17-validation.md`.

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

Under item 13's then-current condition, retain the display dependency branch
and rename it `displayDependencies`. Canonical manifest entries do not gain that
field. The later 62 A decision supersedes this retained branch.

Evidence: `.context/generated-output-simplification/m18-dependency-producer-proof.md`.

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

Evidence: `.context/generated-output-simplification/m18-document-check.md`.

Evidence: `.context/generated-output-simplification/m18-smoke.md`.

Evidence: `.context/generated-output-simplification/m18-validation.md`.

### Review outcome

The orchestrator reported findings 58–65: one medium and seven low. They cover
style ownership, baseline races and discovery, export errors, dead code, tests
and documents. Finding 66 adds repeated public-file checks. The decisions below
define the approved fixes. Findings 17 and 52 remain open.

Evidence: `.context/generated-output-simplification/m18-review-outcome.md`.

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
- **63 B:** delete the listed dead code and stale references, except
  `PendingGeneratedFiles.routes()`. The user chose A after the path-identity
  merge: retain this now-used member and its `DocumentCompiler` route-set check,
  required by snapshot decision B. All other cleanup and tooling remain. Use a small
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

The detailed reports in `.context/generated-output-simplification/reviewer-reports/INDEX.md` resolve the missing
file lists. Their references were checked against the current tree. The
source of each requested fix is recorded in that index; already-correct text
is retained. Findings 45, 46 and 64 are documentation work here. The listed
member/test cleanup and inaccurate Milestone 17 table rows belong to the
approved tooling step. No unrelated review finding is changed.

The user chose a TypeScript language-service `findReferences` ratchet. Knip v6
removed class-member analysis. Install the current maintained API Extractor
release when public API report work starts; do not pin an older tool.

Evidence: `.context/generated-output-simplification/m19-tool-research.md`.

### Squash-merge message

Use this text in the PR description and as the squash-merge message; release
versions and changelogs remain owned by the release workflow:

```text
feat!: simplify generated output and delivery

Use one generated tree, checked authored resources, shared watching and
per-commit v9 baseline selection. Keep current format rejection, safe output
transactions and content-delta publication.

BREAKING CHANGE: Remove generatedOutput and publicExclude configuration.
Only build, build --watch and serve --build write generated output. Check
uses Git-index tracking. Generated files and the private v9 manifest live
under mockupsDir/mokly-generated. Earlier baseline results are not cached.

BREAKING CHANGE: Remove compatibility.transformer and its public types.
Author portable documents and links directly. Current readers do not adopt
or convert older catalogue, baseline, cache or export formats.

BREAKING CHANGE: Viewer resources use mokly-viewer with no __mokly alias.
Catalogue and static delivery use v5, bootstrap uses v2, ownership uses v3,
and upload uses v2. Review uses v6; capabilities and inspector messages use v2.
Older services must update before accepting publication.
ManifestV9 replaces ManifestV8 and adds the closure and generated inventory.

BREAKING CHANGE: Stored Browse recovery requires changesStatus and
filterBaselineDisclosures. Removed records require snapshotId with any
non-null comparisonUrl. Static delivery parsing returns a tagged result;
browser readers retain typed version failures. Plain successful baseline
notices use stdout. See npm-release-notes.md for the complete API migration.
```

Evidence: `.context/generated-output-simplification/m19-document-validation.md`.

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

Evidence: `.context/generated-output-simplification/m20-regressions-and-smoke.md`.

Evidence: `.context/generated-output-simplification/m20-validation-and-preservation.md`.

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

- **Snapshot decision B (2026-10-05):** only `build`, `build --watch` and
  `serve --build` acquire the output write lock. Compilation, live Serve,
  export, publication and Check never acquire or wait for it. Replace main's
  disk `captureOutputSnapshot` with the immutable checked route set built from
  the accepted in-memory generation. Keep `assertSnapshotRoutes` rejection and
  strict private IPC validation. Remove the mixed-layout authored-collision
  scan and ownership-based orphan detection under the unified-tree decisions
  (Milestones 3, 9 and 11), ownership removal (Milestone 4), and this decision.
  Adapt every mixed-purpose snapshot/lock test. Delete a test only if its whole
  purpose is disk snapshot capture or a reader lock; list every affected title
  and this approval in the merge body and audit.

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

- [x] Fetch `main`. Capture the source tip and merge base before any merge,
      audit `main`'s additions with
      `git diff --name-status <merge-base>..origin/main`, and write a
      preservation list into this milestone.
- [x] Define the combined design in the protocol documents, guides and
      READMEs: path-identity routes inside `mokly-generated/`, the asset closure
      for Markdown document resources, the version number of every format
      after the merge, the earlier-version outcome for `main`'s v8 output, and
      the `mokly-viewer/` paths for the new viewer features.
- [x] Record every planned removal of `main` code with its approving decision.
- [x] Run `npm run format:check` and the documentation tests; review the diff;
      commit with Conventional Commits; push.

Evidence: `.context/generated-output-simplification/m21-captured-mainline-audit.md`.

### Combined versions and implementation choices

The owning contracts are `mokly-path-output-integration.md`,
`mokly-format-versions.md` and `mokly-generation-routes.md`. They define every
boundary: manifest 9, catalogue 5, review 6, delivery 5, bootstrap 2, capability
2, inspector 2, live-index-2, change snapshot 3, preview metadata 3, ownership
3, upload 2, Plan 1, completion marker 2/generated-v9, route snapshot 1 and
navigation storage v4. Unchanged transaction/process/module/timing versions and
unversioned authoring records are explicitly listed there. No version chooses
between two entry shapes. Stable hash domains and opaque runtime revisions
are not renamed as schema versions.

Markdown source resources stay private and watched; their generated copies go
in generatedFiles, not assetClosure. The latter remains authored files read in
place. Preserve incoming copy path derivation inside the generated tree and
ordinary collisions; `styles` and `assets` remain reserved HTML first segments
under decision 28. The exact reserved-prefix error stays. Snapshot decision B
adds no config flag or disk fallback.

The preview acceptance runs `npm run preview:build -- --include-changes --base origin/main`.
The pinned base executes its own #131 recipe and emits v8 at its root-level
manifest location. Post-rebuild version detection must produce the exact
approved earlier-version line, no completed cache entry and a successful
current preview with unavailable Changes. A separate v9 base proves moves.

### Approved replacements of main

Every actual resolution path and removed/renamed main test title is appended
in Milestone 22 and the merge commit body. Planned scope is:

- `src/config/types.ts`, validation/public exclusions, build/output/check,
  Serve/export/publication and mode fixtures: remove output-mode branches and
  publicExclude; preserve input behavior under the original generated-output
  decision and Milestones 19–20. All generated bytes move under one tree.
- `src/build/ownership.ts`, `tracked_ownership.ts`, `committable_output.ts`,
  generated markers/collision checks and their callers: remove header authority,
  per-file orphan adoption and committability checks (Milestones 3–4, 9, 11;
  Milestone 16 items 7 and 12). Keep actual source protection and transactions.
- `src/build/output_snapshot.ts` and snapshot/lock callers/tests: remove disk
  snapshot capture, orphanRoutes and reader locking only (snapshot decision B).
  Retain the module's accepted-route check and strengthen its private shape.
- `src/compatibility/**`, transformer-only imports/CSS inventory, configuration
  and tests: remove the transformer and its public types (Milestone 16 item 4).
  Keep every mixed-purpose CSS, navigation, range and final-document check.
- Export/preview reservation and ownership adapters, former notice/manifest
  handling and disclosure cleanup: retain approved current-only behavior
  (Milestone 16 items 2, 3, 5–10, 13–14; Milestone 19 decisions). No earlier
  content or cache reader returns; no incompatible result is cached.
- All `__mokly/` and `__generations/` producers/consumers, inspector/document
  endpoints, archive fixtures and URLs: replace with the shared current
  namespace (decision 30). No redirect alias; keep authentication and bounds.
- Conflicting format literals/types/fixtures: replace with the combined versions
  under decision 2 A. Keep prior versions only as rejection inputs; preserve
  every unrelated parser assertion and exact earlier-baseline product line.
- Main's obsolete id/navPath and nested-authoring deletions remain deleted
  under incoming path identity. Do not restore their modules to make the old
  branch tests compile; adapt valid tests to the current path model.

No other main feature, file or assertion is approved for removal. Findings 17
and 52 and the remaining review fixes stay pending. The verification step maps
those decisions against the merged code before any further implementation.

Evidence: `.context/generated-output-simplification/m21-document-validation.md`.

## Milestone 22: Merge `main` and apply the combined design

- [x] Merge `origin/main` once under `AGENTS.md` "Mainline Feature
      Preservation": resolve conflicts path by path, confirm that the merge
      commit has exactly two parents, review `git show --remerge-diff` for every
      listed path, and check deletions against `main`. If `main` moves again
      during this milestone, do not merge again; report the new tip.
- [x] Apply the combined design from Milestone 21 to the merged code, including
      the new format numbers.
- [x] Keep every `main` test title and assertion except the approved removals,
      and list each removal in the commit body.
- [x] Smoke-test `build`, `check`, Serve and export with Markdown documents,
      folders and a moved entry. Changes against a base built by `main`'s #131
      code must give the earlier-version line, and
      `npm run preview:build -- --include-changes --base origin/main` must
      succeed with Changes unavailable.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check`, and
      `cargo xtask check`; `git add -A`; commit; push.

Evidence: `.context/generated-output-simplification/m22-integration-preservation-record.md`.

Merge justifications: `.context/generated-output-simplification/m22-merge-justifications.md`.

Evidence: `.context/generated-output-simplification/m22-removed-main-files.md`.

Evidence: `.context/generated-output-simplification/m22-removed-main-test-titles.md`.

The orchestrator allowed a local merge checkpoint for HEAD-based baseline tests. Keep
it local until the full gate and preview smoke pass. Review both parents and
every remerge path immediately after committing it.

Evidence: `.context/generated-output-simplification/m22-validation-and-smoke-progress.md`.

Evidence: `.context/generated-output-simplification/m22-two-parent-checkpoint-review.md`.

Evidence: `.context/generated-output-simplification/m22-final-gate-attempts.md`.

Evidence: `.context/generated-output-simplification/m22-final-validation.md`.

## Milestone 23: Verify the merge and re-plan the review fixes

- [x] Merge `origin/main` once more under Mainline Feature Preservation before
      the remaining TODOs. Capture the source tip and merge base, audit all main
      changes, resolve each conflict path, preserve exactly two parents, inspect
      every remerge path, and check deletions. Keep #133's `AGENTS.md`, delete
      `plans/README.md`, and put this plan's useful summary in its first
      `Status: Active` paragraph. Keep #132's persistent lock directories with
      decision B's writer-only lock. Run the full gate, commit, and push before
      the document check and re-plan. If main moves again, report its tip without
      another merge.
- [x] Re-read every document changed in Milestones 21 and 22 against the code,
      and fix drift. Keep the tested projection and Markdown boundary fixes.
- [x] Finish the current non-browser checks and checkpoint the document audit
      locally, including the orchestrator-confirmed `source-map-js` advisory patch. Do not push.
- [x] Move evidence to `.context/generated-output-simplification/` as a separate
      local plan-only commit. Keep decisions, approvals, contracts and TODOs in
      this plan; name the evidence files here. Validate the plan with Prettier
      and review its diff. Use `docs(plans): move evidence logs to .context`.
- [x] Merge `origin/main` at #124 under Mainline Feature Preservation. Capture
      both tips and the merge base, audit all paths, resolve each conflict,
      confirm two parents and review every remerge path and deletion. Keep all
      tier, warning, strict-mode and test-wait behavior with the writer-only
      lock and unified tree. Save preservation records and merge justifications
      under this plan's evidence directory. Do not merge again if main moves.
- [x] Run the full gate once on the merged tip. If browser tests fail, rerun
      only the failed specs once. Investigate a case that fails in both runs;
      write a failing test before any code fix. Keep all deadlines, retry
      settings and assertions. Record both outcomes for each flaky case.
      If the slow machine prevents a passing gate, stop without pushing.
- [x] Push the two local checkpoints and the merge together only after the
      merged gate passes. Then complete the re-plan below.
- [x] Check each decision of Milestones 24–27 against the merged code. Update
      their TODOs with current files, routes and fixtures. Record each finding
      that the merge resolved or changed, and stop for the user's decision
      where a recorded decision no longer fits.
- [x] `git add -A`; commit with Conventional Commits; push.
- [x] Merge main once more under the orchestrator's instruction and user
      decision 1 A. Capture both tips and the merge base, audit additions, resolve
      each conflict, confirm exactly two parents and review every remerge path
      and deletion. Keep #137, #140, #141 and #143 completely, including
      `AGENTS.md` exactly as main has it. Preserve the writer-only output lock
      and existing approved branch contracts. Store all preservation evidence
      and merge justifications under this plan's ignored evidence directory.
- [x] Carry the warning-contract wording clarification into that integration;
      build warnings stay on stderr, while 18 A moves successful baseline notices.
- [x] Finish the pending gate and push through the user's additional main
      integration below. Keep local merge `61a1ce3e` unchanged.
- [x] Merge latest main once on top of `61a1ce3e` under the user's direct
      2026-10-06 instruction and decision 1 A. Capture both tips and the merge
      base; audit every incoming path; preserve #142's shape hydration and
      resource audit, and #146's dependency updates and security tests. Review
      all remerge paths and exactly two parents before pushing.
- [x] Keep main's `package.json`, `package-lock.json`, `xtask/Cargo.toml` and
      `Cargo.lock` exactly. Run `npm ci` without regenerating the lock. Fix
      branch code for the new tools without changing lint or format settings.
- [x] Restore the verified example-catalogue paragraph from `85f45a7b` while
      keeping every other main rule in `AGENTS.md`. Adapt the new audit to the
      generated tree and authored closure under the existing path contracts.
- [x] Run the full gate once on the combined tip. After it passes, commit
      completion and push both local merges together. If main moves after this
      integration starts, report its new tip without merging again.
- [x] After the passing gate and unchanged push of `61a1ce3e` and `e68c4dff`,
      merge main once more under the user's latest-main instruction and
      decision 1 A. Capture both tips and the merge base. Keep #147's review
      rules, prompt and 33 deletions, the branch example paragraph, and the
      #149/#150 documentation cleanup present at the captured tip. Repair any
      relative link to a removed record without restoring it.
- [x] Preserve #148's concurrency helpers, per-worker servers, parallel
      hydration routes, worker-scoped bundle and every test. Combine its
      all-server readiness with the branch's baseline setup and cleanup. Keep
      the writer-only output lock and 600-second fixture limit. Record every
      resolution and review exactly two parents, every remerge path and all
      deletions before pushing.
- [x] Run the full gate because the captured tip includes #148 code/tests.
      Commit and push only after it passes. Report later main movement without
      another merge, then stop for the orchestrator's review.
- [x] After the push, the orchestrator reviews the merge against `origin/main`
      using `docs/implementation-review-prompt.md`. Report severity, category,
      effort, options and Auto-fix tags. Follow `AGENTS.md`'s review-fix rule
      after the report. Keep findings 17 and 52 pending their existing user decisions.

  - 67 — High: Non-ASCII changed filenames break Changes.
  - 68 — Medium: Markdown resources overwrite imported-CSS assets.
  - 69 — Medium: Markdown public-file links disappear under containing catalogue roots.
  - 70 — Medium: Watched Build misses repairs in newly imported files after failure.
  - 71 — Medium: Protocol documents retain merge history and one-time integration steps.
  - 72 — Medium: Resource audit accepts private authored targets.
  - 73 — Medium: Compilation lacks a regression for the final Markdown safety check.
  - 74 — Medium: Three boundaries lack older-version rejection tests.
  - 75 — Low: Shell delivery version error names version 4 instead of 5.
  - 76 — Low: Catalogue-root-only moves mark styled screens changed.
  - 77 — Low: Internal READMEs repeat plan-history prose.
  - 78 — Low: Milestone 28 review TODO uses the earlier workflow wording.
  - 79 — Low: Check, publish and plain Serve lack lock-free regressions.
  - 80 — Low: Failed transaction cleanup writes directly to stderr.
  - 81 — Low: Route-set contract overstates worker-thread validation.
  - 82 — Low: Output collision model retains an orphan field and comment.
  - 83 — Low: Four unused test helpers remain after the merge.
  - 84 — Low: Resource-audit error calls the boundary the generated root.
  - 85 — Low: Test titles retain earlier format versions.
  - 86 — Low: Cache marker v2 accepts unknown fields.
  - Known 54 A — Partial: document base reads are restored; image and unused-CSS lazy-read parity remains open.
  - Known 10 — Changed: main normalizes `.html` and highlights work through redirects; the shared helper and regression remain in Milestone 26.
  - Known 25 — Still open: frame paths are decoded twice.
  - Known 57 — Unchanged: hydration global setup still rebuilds the shared example.
  - Known 63 — Still open: ESLint names the deleted `src/build/discovery.ts`.
  - Known 65 — Unchanged: the planned test corrections remain.

The review and one re-review are complete. Both fix rounds are complete:
87–92 in the first round and 93–95 in the final round. No further re-review
is required. The open findings and status notes above remain unchanged.

Review reports: `.context/generated-output-simplification/m23-review/`.

Review-fix validation: `.context/generated-output-simplification/m23-review/fixes-87-92-validation.md`.

Re-review report: `.context/generated-output-simplification/m23-review/rereview-fix-87-92.md`.

Final review-fix validation: `.context/generated-output-simplification/m23-review/fixes-93-95-validation.md`.

### Current checkpoint and integration instructions

The orchestrator directed local audit and evidence commits before the #124
merge. This replaces the earlier audit-push-before-merge order. Nothing is
pushed until the merged gate passes. The orchestrator measured CPU steal and
confirmed the compatible `source-map-js` 1.2.2 patch for GHSA-68fv-2mgg-jv7q.
User decision 1 A approves merging main before the remaining review fixes,
including #124 and its navigation waits. The user asked for the evidence move
at the next safe point without delaying the merge. The orchestrator directed
this plan to follow PR #137's rule without editing `AGENTS.md`: store evidence
and merge justifications in the ignored plan directory, and copy the merge
justifications into the future PR description.

Evidence: `.context/generated-output-simplification/m23-browser-trace-observations.md`.

Evidence: `.context/generated-output-simplification/m23-checkpoint-validation.md`.

### Additional main integration approvals

Decision 1 A covers #133 and #132. Keep main's plan-status rule and removal of
`plans/README.md`. Keep persistent output-lock directories with decision B's
writer-only ownership. Keep the incoming APFS and successor-lock checks. Main's
own removed directory-disappearance retries stay removed.

Evidence: `.context/generated-output-simplification/m23-133-132-merge-justifications.md`.

Merge commit justifications: `.context/generated-output-simplification/m23-133-132-commit-justifications.md`.

Evidence: `.context/generated-output-simplification/m23-133-132-validation.md`.

### Document audit and route-member decision

The audit corrects current format numbers, generated paths, source privacy,
compatibility claims and writer-only locking. Two runtime fixes enforce approved
contracts: reject unsupported projection versions before entry access (2 A),
and keep Markdown's package-root equality rejection export-only (37 A).

Evidence: `.context/generated-output-simplification/m23-document-audit-evidence.md`.

**Resolved re-plan question: finding 63 B includes a used main member.**

Evidence: `.context/generated-output-simplification/m23-route-member-proof.md`.

The user chose
**A**: retain `routes()` and remove it from the 63 B deletion list. Preserve its
real caller and the route-set guarantee. All other 63 B cleanup and the
TypeScript language-service unused-member ratchet remain planned for Milestone 27. The ratchet must count this production call as a use.

The re-plan below confirms the other verified facts: 54 A's targeted reads are
restored, the production dependency fallback in 62 A is already removed while
its artificial projector round-trip test remains, and #132 does not fix 59 A's
per-entry retention race. Milestone 22's document-resource counterpart handling belongs to **39 B**,
not the projection cleanup. Findings 17 and 52 remain untouched. No remaining
review-fix milestone or final review has started.

Evidence: `.context/generated-output-simplification/m23-document-validation.md`.

Evidence: `.context/generated-output-simplification/m23-browser-and-audit-blockers.md`.

### Link-control and warning integration

The #124 integration keeps placement tiers, diagnostics, strict command checks
and navigation waits. Warnings stay on stderr. Watched Build applies strict
checks before each writer call and keeps its existing failure/recovery path.
The direct link resolver carries diagnostics without restoring the transformer.
No public or persisted format changes are required for these private compile
records. The remaining watch and reporting redesign stays in Milestone 24.

Evidence: `.context/generated-output-simplification/m23-124-preservation.md`.

Merge justifications: `.context/generated-output-simplification/m23-124-merge-justifications.md`.

Evidence: `.context/generated-output-simplification/m23-124-validation.md`.

Evidence: `.context/generated-output-simplification/m23-full-gate-summary.md`.

Evidence: `.context/generated-output-simplification/m23-124-remerge-review.md`.

### Re-plan decisions

The recorded decisions still fit the code that includes #124. Keep build
warnings on stderr and the accepted-catalogue warning boundary separate from
writer summaries. The target's empty-stderr guarantee applies to warning-free
success. This preserves #124 and decision 18 A together.

The merges restored 54 A and removed 62 A's production fallback. Its artificial
test round trip still needs removal. They partly changed 39 B and 10 B. Keep
`PendingGeneratedFiles.routes()` under the user's decision A; its real caller
still enforces the accepted route set. The other 63 B cleanup remains. The TODOs
below name current files, path-based routes and fixtures. Findings 17 and 52
remain untouched. Milestone 26 stays UI-only.

Evidence: `.context/generated-output-simplification/m23-replan-findings.md`.

Evidence: `.context/generated-output-simplification/m23-replan-validation.md`.

Evidence: `.context/generated-output-simplification/m23-main-movement.md`.

The orchestrator completed the review and one re-review. Both fix rounds are
complete. No Milestone 24 implementation has started. The orchestrator directed
the additional integration above before that review, under the user's existing
decision 1 A.

The incoming changes can affect the remaining plan as follows:

- #137 changes evidence and merge-justification storage for every milestone;
  this plan already follows that rule.
- #140 adds security assertions and maintenance documentation. Preserve them in
  every gate and in Milestone 27's dependency/tool installation work.
- #141 changes the runtime pin file to `.nvmrc` and its verification. Milestone 27
  must use that name and retain the new runtime-profile and required-CI tests.
- #143 removes Juno and leaves five packed-consumer scenarios. Milestone 27 must
  keep those five scenarios, strict audits and the new fixture README. It must
  not restore Juno when changing fixture or API-report tooling.

These changes do not alter the recorded runtime fixes in Milestones 24–26.
The re-plan is based on pushed `d0f6dd99`; the additional merge will verify the
four incoming changes path by path.

### Final main integration

Merge `61a1ce3e` keeps #137, #140, #141 and #143 under decision 1 A. The
orchestrator then required `AGENTS.md` exactly as incoming main. The additional
integration below corrects that instruction for the example paragraph only.
Keep the `.nvmrc` pin, all moved CI assertions, the source-map regression tests
and five packed-consumer scenarios. The warning clarification changes only the
target contract; implementation remains in Milestone 24.

Preservation record: `.context/generated-output-simplification/m23-final-main-preservation.md`.

Merge justifications: `.context/generated-output-simplification/m23-final-main-justifications.md`.

Evidence: `.context/generated-output-simplification/m23-final-main-remerge-review.md`.

Validation: `.context/generated-output-simplification/m23-final-main-validation.md`.

### Hydration and dependency integration

The user directly approved another main merge on 2026-10-06 and chose main's
fix for the dependency advisories. Keep `61a1ce3e` unchanged. Preserve #142's
shape rule, default-state coverage boundary and all reference checks. Audit
the generated tree and authored closure beneath the catalogue root, as the
unified layout requires. Keep #146's dependency files exactly and install them
with `npm ci`. Preserve the dependency policy and all new tests.

The orchestrator corrects the earlier exact-`AGENTS.md` instruction: restore
only the checked example paragraph from `85f45a7b`. The user's output-mode
removal and generated-directory rename authorize that correction. Keep every
other main rule. No later review-fix milestone or final review starts here.

Preservation record: `.context/generated-output-simplification/m23-142-146-preservation.md`.

Merge justifications: `.context/generated-output-simplification/m23-142-146-justifications.md`.

Validation: `.context/generated-output-simplification/m23-142-146-validation.md`.

Remerge review: `.context/generated-output-simplification/m23-142-146-remerge-review.md`.

### Review rules and latest-main integration

The orchestrator directed one more main merge after the passing gate and push
of `61a1ce3e` and `e68c4dff`, under the user's latest-main instruction and
existing decision 1 A. At this step's fetch, main also included #149, #150 and
#148. Preserve all four changes. The code and test changes require the full
gate under the orchestrator's explicit validation rule.

Keep #147's auto-fix eligibility, ask conditions, two-round limit, report rules,
evidence storage and graceful handling. Keep the branch's verified example
paragraph. Keep all 33 review records deleted and #149's removed historical
spec deleted; preserve working history links. Keep #150's active dependency
choices and all existing audit policy. #148 changes concurrency, while the
600-second fixture deadline and all existing test deadlines/retries stay.
Combine every worker's Serve readiness with this branch's current shared
baseline setup, timing, environment restoration and cleanup. Plain Serve keeps
compiled output in memory and takes no output write lock. Future fixture
simplification stays in Milestone 27. The orchestrator owns the final review.

Preservation record: `.context/generated-output-simplification/m23-147-preservation.md`.

Merge justifications: `.context/generated-output-simplification/m23-147-justifications.md`.

Validation: `.context/generated-output-simplification/m23-147-validation.md`.

Remerge review: `.context/generated-output-simplification/m23-147-remerge-review.md`.

## Milestone 24: Shared watching and command output

Implements 40 B, 9 B, 41 B, 50 B, 18 A, 16 B and 51 A.

- [x] Merge the captured latest main (`dc56e3d4`) under the user's direct
      2026-10-07 instruction. Preserve #145's cache ignore publication, #151's
      npm pin, #152's deterministic timing rules and #134's scroll waits.
      Keep writer-only locking and the cold preview operation across the file
      split. Resolve each conflict, audit paths and titles, smoke the built
      CLI, run the full gate, commit with two parents, review every remerge
      path, and push. Tick this item after the push; start no other TODO here.
- [x] Merge the next captured main (`fcc50591`) as a separate two-parent
      merge under the user's explicit 2026-10-07 approval for #160 and Blacksmith
      Testboxes. Preserve all incoming code, tests and contracts; keep the
      protocol index at 250 lines. Install the CLI under `.context/`, check the
      executor, commit and push before the complete automatic remote gate.
      Verify every command, nine reports, the aggregate and box cleanup. Use
      local fallback only before remote suites start. Retry an infrastructure
      failure at most once. After a passing gate, tick this item, validate the
      plan, commit and push. Start no other TODO here.

Merge evidence: `.context/generated-output-simplification/m24-main-preservation.md`.

Merge justifications: `.context/generated-output-simplification/m24-main-justifications.md`.

Validation: `.context/generated-output-simplification/m24-main-validation.md`.

Second merge evidence: `.context/generated-output-simplification/m24-main-160-preservation.md`.

Second merge justifications: `.context/generated-output-simplification/m24-main-160-justifications.md`.

Second merge validation: `.context/generated-output-simplification/m24-main-160-validation.md`.

- [ ] Write failing lifecycle tests first. Extract one watch-setup owner from
      `server/serve_watched.ts`, `watch_inventory.ts`, `watch_paths.ts`,
      `watcher.ts` and `resource_watcher.ts`; use it from `cli/build_watch.ts`.
      Keep `watch_events.ts` notification gates, debounce and serialization.
      Resolve graph/PostCSS inventory before readiness, retain both old and new
      gates' events during replacement, and adopt checked resource watches only
      with their matching candidate. Preserve roots, folder records, Markdown
      inputs, path-based generated ignores and failed-candidate recovery.
- [ ] Run one case matrix through watched Build and Serve using the existing
      injected watcher/queue seams in `tests/build_watch.test.ts`,
      `watch_startup.test.ts`, `watch_config_shutdown.test.ts`,
      `watch_postcss*.test.ts` and `watch_resource_*.test.ts`. Cover imports,
      scan additions, initial-build edits, reconfiguration, linked authored
      HTML/PDF/CSS and repaired invalid resources. Extend
      `watched_authored_closure.test.ts` for closure changes. Keep the new
      `build_watch_warnings.test.ts` strict/normal writer coverage in the matrix.
- [ ] Update `server/demand/generation.ts` and the shared resource lifecycle so
      `serve --build` writes a refreshed complete manifest after a stylesheet
      changes the closure. Plain Serve keeps checked memory; evidence-only
      actions never write. Preserve the child/parent boundary and immutable
      route snapshot through full-generation replacement.
- [ ] Tie SIGINT/SIGTERM to immediate shutdown and active compile/write
      cancellation in `cli/build_watch.ts`. Propagate through
      `build/compile.ts`, its graph/render lifecycle and `output_store.ts`.
      Test initial compilation and a held lock with explicit synchronization;
      no late candidate may write. Keep the transaction drain and #132's
      persistent lock directories and foreign-lock protections. Preserve cache
      ignore publication before the writer acquires its lock; nonwriting
      consumers do not create a cache except through requested baseline rebuilds.
- [ ] Share the generated summary for `cli/run.ts`, `cli/build_watch.ts`,
      `server/serve.ts`, `server/watched_background.ts` and reporter calls.
      Keep #124’s `reportCatalogueReady` warning boundary separate from the generated
      writer summary; plain Serve still writes no output. Use the invocation-relative
      catalogue path with `.` fallback. Move
      successful baseline notes and earlier-version notices to stdout in plain
      mode; retain errors, #124 build warnings and timing JSON on stderr and rich
      presentation. The empty-success-stderr assertion applies only to warning-free
      cases; test warnings together with successful baseline notices. Test
      the notice once per accepted base and reset after a base change.
- [ ] Replace English-message matching in `build/tracked_output.ts` with the
      exact machine-readable probe in `mokly-boundary-results.md`. Preserve
      process exit/signal/stdout and launch errors through `review/git_process.ts`
      or an equally narrow injectable probe. Cover ordinary nonrepositories,
      bare/corrupt/inaccessible repositories, missing Git, non-English stderr
      and explicit Git overrides. Carry the selected real indexed prefix into
      mixed and stale-output remedies in `build/check.ts`; test aliases.
- [ ] Smoke both writing watch commands with Tailwind-style scanning, an edit
      during the initial build, stylesheet closure additions/removals and Ctrl+C
      under a held lock. Record command, URL, output bytes and process cleanup.
- [ ] Run the full gate as in Milestone 20; `git add -A`; commit; push.

## Milestone 25: Comparisons, baselines and build edits

Implements 39 B, 54 A, 55 A, 59 A, 60 A, 48 A, 58 A and 62 A.

- [ ] Add failing absent-versus-invalid tests before one inventory reader per
      side in `review/assets.ts`, `head_assets.ts` and their full/selected/live
      callers. Base uses its v9 manifest and pinned historical descriptor;
      head uses accepted generated bytes and closure. Safe unlisted optional
      counterparts are absent; corrupt/missing listed files and unsafe paths
      fail. Preserve required-reference validation, copied Markdown resources,
      move aliases, PDF attachments, binary bytes and source privacy.
- [ ] Exercise added/removed/renamed embedded generated pages, Markdown,
      screen views, CSS, copied assets and authored files through
      `review/compare.ts`, `selected.ts`, `page_preview.ts` and live Changes.
      Use the current helpers in `tests/helpers/changed_fixture.ts`,
      `derived_fixture.ts`, `committed_repository.ts` and move fixtures.
      The public CLI has no Review command.
- [ ] Preserve the restored 54 A targeted-read assertions in
      `tests/server_changed_lazy_base.test.ts` and bounded batches in
      `server/changed_content.ts`; extend them for the new readers. Remove both
      descriptor roots from authored Git evidence in `review/imported_changes.ts`
      and its callers (55 A). Test a catalogue-root move with generated changes
      at both roots and unchanged authored evidence.
- [ ] Implement the bounded ENOENT acquisition retry in `baseline/lock.ts`
      through the confined filesystem boundary. Recreate an entry removed
      between directory creation and lock publication; test success, three
      exhausted attempts, other failures and cancellation with deterministic
      interleaving against `cleanup.ts`. Keep metadata-only retention and
      fail-intact settings mismatch. Do not restore #132's removed cache-ancestor
      retries or delete the persistent writer-lock directories. Preserve the
      cache ignore file through partial-entry and retention cleanup.
- [ ] Update `baseline/discovery.ts` for 60 A using v9 candidates: one valid
      current-format catalogue wins over stale pre-v9 envelopes, including at
      the requested root. Preserve malformed/newer rejection and ambiguity for
      multiple current candidates. With no v9 output retain the exact earlier
      outcome. Extend `baseline_discovery.test.ts` and rebuilt-version cases.
- [ ] Extend `tests/baseline_debris.test.ts` with a table of every recognized
      temporary name from `cache_layout.ts`, `debris.ts`, `rebuild.ts` and
      `filesystem.ts`, including `complete-<uuid>.tmp`. Retain live owners,
      tombstones, unrecognized files, the cache ignore file and maintenance-error
      behavior (64 A).
- [ ] Add 48 A's real Git SHA-256 inventory selection and opaque blob-byte
      tests. Extend `baseline_compatibility.test.ts` and
      `baseline_rebuilt_version.test.ts` with real watched/no-watch Serve:
      the base's own recipe writes a root-level pre-v9 manifest, the exact line
      appears once on stdout, content edits do not repeat it, and a changed
      base resets reporting. Keep incompatible results out of completed caches.
- [ ] Implement exact UTF-16 text patches and one offset map for post-render
      edits (58 A), replacing index-based `components/style_ownership.ts`
      rebinding. Preserve #124’s diagnostic return value, sanitization, ordering and
      placement tiers. Cover `components/render.tsx`, `build/render.ts`,
      `link_control_patches.ts`, `link_controls.ts`, `mock_links.ts`,
      `document_links.ts`, `compile.ts` and
      `document_compiler.ts`. Test body styles, equal repeated style text,
      package head insertion and logical rewrites through full Build and demand
      Serve. Preserve range authentication, byte fidelity and document safety.
- [ ] Complete 62 A's test cleanup: remove only the artificial display→CLI
      projector round trip from `tests/catalogue_manifest_producers.test.ts`.
      Keep current producer and viewer display assertions. Production dependency
      derivation already uses source, declared dependencies and Markdown
      resources; add no display-entry producer or compatibility branch.
- [ ] Smoke live Changes after adding and removing an embedded generated page.
      Record ready status, expected membership and current/pinned bytes.
- [ ] Run the full gate as in Milestone 20; `git add -A`; commit; push.

## Milestone 26: Viewer frame URLs

Tags: ui

Implements 10 B and 25 B in the viewer. No backend work.

- [ ] Extend the existing `client/same_origin_identity.ts` delivered-resource
      helper and use it for `same_origin_load.ts`, `same_origin_access.ts`,
      `same_origin_adapter.ts` readiness/inspection and `component_geometry.ts`.
      Keep #131's exact, extensionless and index-directory URL forms, exact
      origin/query matching, weak document provenance and mount-generation
      rejection. No later duplicate check may reject an accepted form.
- [ ] Decode paths exactly once between `client/frame_mount.ts`,
      `catalogue/delivery_paths.ts` and adapter setup. Test single/double
      encoding, invalid escapes, separators, dot segments, query/origin
      mismatches, positioning fragments and private transient previews.
      Cross-origin tests assert only observable origin/nonce/source and assigned
      route checks; no final cross-origin pathname access is assumed.
- [ ] Add a static-host redirect fixture to `tests/helpers/static_server.ts`
      or its browser fixture and test `x.html` → `x` with real highlight and
      pick, plus preserved page `index.html` normalization. Extend existing
      same-origin adapter, frame adapter/security and clipping cases. Smoke
      the styled screen under that host and stop the browser and server.
- [ ] Run the full gate as in Milestone 20; `git add -A`; commit; push.

## Milestone 27: Test and release tooling

Implements 57 B, 65 A, 63 B and 42 B. Finding 63 B excludes the now-used
`PendingGeneratedFiles.routes()` under the user's post-merge decision A.

Timing work follows [CI Test Timing](../docs/protocol/ci-test-timing.md):
deterministic assertions use operation counts, captured watcher targets, event
order or fake clocks. Report durations as text through the shared duration
helper; retain structured fixture phase evidence and the existing setup budgets.
Polling for expected state allows at least 10,000 ms. Keep the real-config
timing selectors, directory guard, source-order guard and import rules active.
The npm pin is 11.21.0; preserve its workflow and lockfile-shape checks.

- [ ] Record a comparable full browser run and actual fixture timings before
      changing setup. Replace `acquireSharedExample` in
      `tests/browser/static_example.spec.ts` and `design_library_export.spec.ts`
      with each fixture's `createCommittedExampleBaseline` profile from
      `tests/helpers/example_baseline.ts`. Keep isolated repositories and the
      design edit after the baseline commit. Retain new Markdown URL/appearance
      assertions and every existing export/inspection assertion from #131.
- [ ] Remove only shared rebuilt-cache preparation from `tests/browser/setup.ts`
      and its now-unused descriptor/cache-copy helpers and tests. Preserve
      global Serve readiness and process/resource ownership cleanup. Keep
      `example_baseline_cold.spec.ts` as the single cold example-baseline browser
      operation, plus `preview_preparation.spec.ts` and its real cold
      `preview:build`. Keep `FULL_CATALOGUE_SETUP_TIMEOUT_MS = 600_000`, suite
      workers/retries and strict gate policy unchanged. Measure the same full
      browser suite and actual fixture phases afterward (57 B).
- [ ] Fix 65 A in `tests/deleted_resource_classification.test.ts` so its
      `rebuild` cases actually use rebuilt v9 output, with an asserted reader
      selection. Replace the ineffective assertion in
      `build_imported_styles_resources.test.ts` with a real stale generated-file
      replacement check. Remove the duplicate-only
      `entry-imported workspace-package CSS inventories a linked image` case
      from `imported_styles_workspace_package.test.ts`, keeping the stronger
      logical/physical/binary coverage. Correct the moved M17 title inventory’s
      historical lazy-read claim and render
      its rows as a real table in the evidence file; add a short plan correction
      and record M22’s later restoration separately.
- [ ] Remove unused `StyleResolution.failure` in `src/build/styles/resolution.ts`;
      keep its used `failures` map and the different graph plugin's `failure`.
      Remove only the listed stored logical-reference fields (`attributes`,
      `namespace`, `ownerClass`) and metadata-owner fields (`inTemplate`, `node`)
      from `build/logical_record_types.ts`, `mock_links.ts` and
      `link_control_metadata.ts`. Keep runtime native-link namespace checks and
      template validation. Do not remove `PendingGeneratedFiles.routes()`.
- [ ] Remove the stale exact `src/build/discovery.ts` selector/probe in
      `eslint.config.js`, `tests/helpers/lint_paths.ts` and its contract list;
      remove the obsolete DOM prefix assignment in `frame_clipping.spec.ts`,
      duplicate assertions in `viewer_generated_delivery.test.ts`, and no-op
      output-mode replacements/obsolete titles in `build_postcss_privacy.test.ts`
      and `publication_snapshot.test.ts`. Extend the removal search to DOM
      spellings. List any removed or renamed main title with decision 63 B/65 A.
- [ ] Add the real-flat-config exact-file existence test beside the existing
      ESLint Node API folder probes; preserve both lint guards and coverage.
      Add the TypeScript `findReferences` unused-member ratchet under
      `scripts/verification/`, wired into `repository-ratchets.mjs`. Include
      production/test/worker/interface/public uses and verify `routes()` is
      recognized as used. Baseline other existing findings rather than deleting
      them. Keep stable identities, shrink-only growth policy, stale exceptions
      and fail-closed errors. Record runtime and limit candidate declarations
      to non-exported classes only if it exceeds about 60 seconds, as approved.
- [ ] Preserve the incoming `.nvmrc` runtime-pin checks, required-CI guard split,
      source-map-js security assertions and five packed-consumer scenarios.
      Keep the fixture README and strict audits; do not restore the removed Juno
      fixture or assume that the old six-scenario count still applies.
- [ ] Install maintained `@microsoft/api-extractor` without an old pinned
      version. Build both packages, then commit reports under `etc/api/` for
      root `@mokly/mokly` and viewer `.`, `./server`, `./runtime`, `./browser`,
      `./data`; inventory `./styles.css` separately. Separate update/check
      commands must verify exact reports without mutating them. CI/full gate
      checks after declaration build and compares against `origin/main`, failing
      report changes without `docs/protocol/npm-release-notes.md` in that diff.
      Test signatures, new/removed subpaths, stale reports, missing refs and
      release-note gating; preserve the released-name audit (42 B).
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
- Coordinate the Cloud product's upload-v2/ownership-v3 receiver, catalogue-v5
  reader, review-v6 delivery, bootstrap-v2 and inspector-v2 handling, `/mokly-viewer/catalogue.json` fetch path, `diffs/generations/`
  storage paths and embedded viewer/version-error handling. Until upgraded,
  it must reject the new artifact with 426, not accept and misread it. Validate
  a published current-only catalogue and one with Changes after that rollout;
  this external update does not block completion of this branch's plan.
- Smoke-test a fresh consumer with the next published package: `npx mokly`
  and `npx mokly export` produce nothing under `mokly-generated/`, `npx mokly
build` produces it, `check` passes with the directory ignored, and a
  comparison against `origin/main` uses verified v9 blobs or a v9 rebuild when
  required. If that base predates v9, confirm the documented unavailable outcome.
