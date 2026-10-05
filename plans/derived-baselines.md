# Derived Baselines

Status: Completed. [PR #70](https://github.com/mokly-ai/mokly/pull/70)
merged on 2026-09-15.
[Derived Baseline Review Fixes](./derived-baseline-review-fixes.md) fixes
three of its review findings; the rest await the user's decision.

## Summary

Stop committing generated HTML and the generated manifest for catalogues that
opt in. Source remains the only authored artifact in Git. Changes, screen
comparisons, and export obtain the baseline by rebuilding the merge-base commit
in an isolated extraction of that commit, using that commit's own dependencies
and Mokly version, and cache the rebuilt output by commit.

Motivation recorded by the user: committed exports cause merge conflicts whose
only correct resolution is regeneration, and the source already determines the
output. Interactive components are explicitly out of scope for this plan.

Decisions:

- The mode is a typed config choice, `generatedOutput: "committed" | "derived"`.
  `committed` keeps today's behavior unchanged. This repository's example
  catalogue moves to `derived`.
- Rebuilding executes the merge-base commit's install and build commands. The
  base is a trusted mainline; the protocol states this explicitly.
- Committed HTML deletion from `examples/basic/generated` touches files on
  `origin/main` and requires explicit user approval before Milestone 8 runs.
- Interim conflict relief (a Git merge driver) is not pursued; the derived mode
  removes the conflicting files instead.

Protocol owner: `docs/protocol/mokly-derived-baselines.md` (created in
Milestone 1). Related contracts: [Changes](../docs/protocol/mokly-changes.md),
[export](../docs/protocol/mokly-export.md),
[source protection](../docs/protocol/mokly-source-protection.md),
[timings](../docs/protocol/mokly-timings.md),
[package](../docs/protocol/mokly-package.md).

## Milestone 1: Define the derived-baseline contract — completed

Documentation only. Every later milestone implements this contract.

- [x] Create `docs/protocol/mokly-derived-baselines.md` (about 250 lines)
      covering: the `generatedOutput` option and its default; what `build`,
      `check`, Serve, export, and publication do in each mode; the rebuild
      procedure (resolve merge base, extract the commit with `git archive` into
      `.mokly-cache/baselines/<commit>/source`, run the configured typed
      argv commands, adopt `mockupsDir` from the extraction into
      `.mokly-cache/baselines/<commit>/output` with a completion marker);
      cache locking, reuse, invalidation when the merge base moves, and bounded
      cleanup of old commits; explicit failure states (missing history, failed
      install or build, interrupted rebuild, invalid rebuilt manifest); and the
      trust statement that rebuilding executes base-commit code.
- [x] Define the typed rebuild command config: `review.baselineBuild` as an
      ordered list of argv arrays run in the extraction root. The defaults are
      an npm clean install followed by the Mokly build command for the
      configured config path, both invoked without a shell. Document that this
      repository's example must also build the package itself at the base
      commit.
- [x] Define the derived-mode `check` contract: compile and validate as today,
      require that no generated route or the manifest is tracked by Git, and
      report tracked paths as a typed failure with the ignore rule to add.
- [x] Define the derived-mode Git ignore requirement for `mockupsDir`: HTML
      routes and the manifest ignored, authored public files still tracked.
- [x] Update `mokly-changes.md`, `mokly-export.md`,
      `mokly-source-protection.md`, `mokly-timings.md`,
      `mokly-on-demand.md`, `mokly-live-evidence.md`, and
      `mokly-package.md` so "the baseline is read, never rebuilt" becomes
      "the baseline is committed bytes or a cached rebuild; it is never rendered
      with the current tree's code". Add a `preparing` evidence state alongside
      the existing loading, unavailable, and complete states.
- [x] Add the new doc to `docs/protocol/README.md`; link this plan from
      `plans/README.md` under Active.
- [x] Validate Markdown with `npm run format:check`, check local link targets,
      review the diff, commit, and push.

## Milestone 2: Separate baseline reads from repository evidence — completed

Refactor with no behavior change. Everything still passes with committed
baselines.

- [x] Split `GitClient` in `src/review/git.ts` into `RepositoryEvidence`
      (`mergeBase`, `changedPaths`) and `BaselineReader` (`fileExists`,
      `fileKind`, `readFile`, `readFileBytes`, `readFiles`). Keep the Git
      implementation as `CommittedBaselineReader`.
- [x] Update every consumer in `src/review`, `src/server`, and `src/export` to
      depend on the two interfaces; `pinnedGit` in `src/export/inputs.ts`
      becomes a pinned evidence object plus an unchanged reader.
- [x] Update unit tests that stub `GitClient` to the new seams; keep the
      batching, symlink rejection, and budget tests intact.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run example:check`, and `cargo xtask check`; commit and
      push.

## Milestone 3: Rebuilt baseline builder and reader — completed

New `src/baseline/` module family. Unit tests inject the process runner, clock,
and filesystem; one integration test uses a real temporary Git repository with
a tiny consumer catalogue.

- [x] Add `src/baseline/cache_layout.ts`: paths under `.mokly-cache/baselines`,
      completion marker format, and the lock file location.
- [x] Add `src/baseline/extract.ts`: `git archive <commit>` piped into the
      source directory, refusing to write outside it.
- [x] Add `src/baseline/commands.ts`: run the configured argv list in the
      extraction root with a bounded environment, captured output retained for
      the failure message, cancellation through `AbortSignal`, and no shell.
- [x] Add `src/baseline/rebuild.ts` behind a `BaselineBuilder` interface:
      acquire the lock, reuse a complete cache entry, otherwise extract, run
      commands, validate the produced manifest with the historical-manifest
      parser, adopt output, write the marker, and clean stale entries beyond a
      retained count.
- [x] Add `src/baseline/reader.ts`: `RebuiltBaselineReader` implementing
      `BaselineReader` over the cached output tree using the confined public
      file reader, rejecting symlinks and non-regular files exactly as the Git
      reader does.
- [x] Add typed errors: history unavailable, extraction failed, command failed
      with exit code and last output lines, interrupted rebuild, invalid rebuilt
      manifest, lock timeout.
- [x] Tests: cache hit skips commands; concurrent rebuilds of one commit share
      the lock; interrupted rebuild leaves no marker and is rebuilt next time;
      command failure surfaces the command and exit code; retained-count
      cleanup never removes the active commit; reader rejects symlinks.
- [x] Update `src/review/README.md` or add `src/baseline/README.md`.
- [x] Cover cache-setting collisions, stale-lock reclamation races, ancestor
      symlinks, compressed archives, and bounded filesystem batches; clarify
      the corresponding protocol boundaries.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run example:check`, and `cargo xtask check`; commit and
      push.

## Milestone 4: Config, build, and check modes — completed

- [x] Add `generatedOutput` and `review.baselineBuild` to `defineConfig`,
      `ResolvedConfig`, config validation, and `--help` output. Default is
      `committed`.
- [x] Add a `TrackedGeneratedOutput` check used by derived-mode `check`: list
      Git-tracked files under `mockupsDir`, intersect with compiled routes and
      the manifest, and fail with the paths and suggested ignore rules.
- [x] Keep `build` writing transactionally in both modes.
- [x] Wire the composition root in `src/cli/run.ts` to choose
      `CommittedBaselineReader` or `BaselineBuilder` plus
      `RebuiltBaselineReader` from the mode.
- [x] Tests for config parsing, both `check` modes, and composition selection.
- [x] Support absent derived output directories without weakening path safety.
- [x] Preserve typed configuration errors for dangling links and non-directory
      ancestors when projecting absent output paths.
- [x] Await baseline preparation outside Serve workers and export capture; pin
      the prepared commit and retain compiled head documents for selected diffs.
- [x] Compare ignored generated documents and resources in derived Changes;
      cover source-only edits, Serve shutdown, and a real derived export.
- [x] Preserve Git-only `changedPaths` and dependency reasons; classify derived
      resource-byte differences without Git evidence as material changes.
- [x] Exclude the cache and its aliases from watch, evidence, shared impact,
      public reads, and configured or exported output destinations.
- [x] Update `README.md` and the package protocol CLI table.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run example:check`, and `cargo xtask check`; commit and
      push.

## Milestone 5: Design the preparing and failed baseline states — completed

Tags: mockup

- [x] Add a `preparing` Changes state to the shell design entries under
      `examples/basic/entries/design/` for mobile and desktop: tabs stay,
      Changes shows a spinner with product copy such as "Preparing comparison",
      and All stays usable.
- [x] Add a failed-rebuild state reusing the existing unavailable presentation
      with copy that names the outcome, not the command or cache path.
- [x] Keep owning pages within the five-screen limit; reuse screens in the
      relevant flow with links back.
- [x] Update the shell design protocol, build and check the example, run
      relevant tests, and visually inspect changed artifacts from disk.
- [x] Update the design-library inventory doc, the library authoring guide, and
      the example README so the catalogue-navigation variant list, the
      availability enum, and the screen and variant counts stay accurate.
- [x] Commit and push.

## Milestone 6: Serve, watch, and export integration — completed

Tags: ui

- [x] Serve derived mode: the background worker requests the baseline from the
      builder after HTTP readiness; publish the `preparing` evidence state
      until the cache entry is complete, then run the existing classification.
- [x] Add `preparing` to `ChangesStatus`, its IPC and session-recovery
      validation, and render the mockup's spinner, title and detail line in the
      served shell without changing `pending` or `unavailable` output.
- [x] Watched Serve: a Git ref change that moves the merge base schedules a new
      rebuild and cancels the running one; `--no-watch` resolves once.
- [x] Export derived mode: rebuild synchronously before capture, pin the same
      commit for attribution and comparisons, and fail explicitly on rebuild
      errors. Recheck the marker in `assertInputsUnchanged`.
- [x] Add `--debug-timings` phases for extraction, install, build, and adopt.
      Moved to Milestone 7, which owns the timing spans and their benchmark.
- [x] Browser tests for preparing and failed states; integration test for a
      merge-base move during watch; export test against a real temporary repo.
- [x] Update `mokly-runtime.md`, `mokly-live-evidence.md`, and
      `mokly-timings.md` if implementation revealed gaps.
- [x] Run tests, typecheck, lint, `cargo xtask check`, commit, and push.

## Milestone 7: Repository tooling for derived mode — completed

- [x] Add a repository-level baseline build for this repo's example:
      `["npm", "ci"]`, `["npm", "run", "build"]`,
      `["npm", "run", "example:build"]`, expressed in
      `examples/basic/mokly.config.ts`. Keep it commented until Milestone 8:
      committed mode continues to reject `baselineBuild`.
- [x] Add a derived-mode variant to the large fixture setup so the benchmark
      covers cold-cache first Changes and warm-cache restart; record the budget
      the benchmark enforces for each.
- [x] Confirm `ci.yml` and `preview.yml` keep `fetch-depth: 0` and that the PR
      preview job installs the base commit's dependencies within the job's time
      budget; add npm cache for the base lockfile if needed.
- [x] Add opt-in baseline resolution, extraction, command and adoption timing
      spans, including the cache-hit flag, without changing Serve lifecycle.
- [x] Test fixture modes, archived tooling, timing success/failure and benchmark
      cache-state enforcement; smoke-test full-sized cold and warm derived runs.
- [x] Run format, tests, typecheck, lint, example check and `cargo xtask check`.
- [x] Commit and push after the mainline-preservation audit passes. The audit
      showed no deletions relative to `HEAD`; the two paths reported against
      `origin/main` were additions on main after the branch point and are
      integrated by the merge that follows this commit.

## Milestone 8: Switch this repository to derived output — completed

Requires explicit user approval before deleting tracked files on `origin/main`.

- [x] Obtain approval to remove the 269 tracked HTML files and the manifest
      under `examples/basic/generated`. The user explicitly confirmed approval
      when requesting Milestone 8; record that approval in the commit body.
- [x] Set `generatedOutput: "derived"` and enable the staged
      `review.baselineBuild` recipe in the example config together.
- [x] Add ignore rules for `examples/basic/generated/**/*.html` and the
      manifest; keep the authored CSS tracked.
- [x] `git rm --cached` the generated routes and manifest; verify
      `npm run example:check` passes in derived mode and
      `git diff --diff-filter=D --name-status origin/main` lists only the
      approved paths.
- [x] Update `README.md`, `examples/basic/README.md`, and
      `docs/architecture/build-pipeline.md`.
- [x] Build local example output before both test entrypoints; ensure example
      fixtures copy only authored inputs and rebuild historical output through
      normal derived composition using their own source and lockfile.
- [x] Verify the preview job's full Git history, Node 24 and baseline lockfile
      cache, and smoke-test publication with Changes.
- [x] Allow shared browser setup to wait for the initial historical install
      and build while preserving normal watch-test deadlines and assertions.
- [x] Move the design-library export fixture to a source-only Git baseline
      with archived tooling, and assert that it tracks only authored CSS.
- [x] Run the test suite and derived check in a fresh clone with no generated
      example output or baseline cache.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run example:check`, `npm run test:browser`, and
      `cargo xtask check`; commit and push.

## Milestone 9: Review — completed

- [x] After the final push, review the complete local diff against
      `origin/main` using `docs/implementation-review-prompt.md`. Report
      numbered findings with severity, context, impact, lettered options, and a
      recommendation. Do not change the implementation.

Review outcome: twelve findings were reported to the user without changes
(two high, four medium, six low). The high findings are a derived rebuild
reachable from the HTTP child through the unselected comparison route, and a
completed cache entry discarded when cleanup fails or cancellation lands after
the marker is written. Each finding is awaiting the user's decision.
