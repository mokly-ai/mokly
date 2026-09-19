# Consumer Static Export

Current validation: the complete post-integration `cargo xtask check` passes on
macOS Node 25.4.0 and in CI on Node 22.14 and Node 24, including all 598
unit/integration tests, 107 browser tests, three Rust tests, and packed consumer
smoke tests. Both native platform jobs and Required CI pass. The pre-integration
gate also passed on Linux Node 22.14, and all 112 focused export/release tests passed on
macOS Node 24. The two approved findings from the
[follow-up review](../docs/reviews/consumer-export-followup.md) are implemented in
milestones 14–16: exclusive directory transactions and current release guidance.
The [exclusive-destination review record](../docs/reviews/consumer-export-exclusive.md)
tracks implementation `95bee11`, integration of main `aa5adea` in `4f944b0`,
and the completed post-push review with no actionable findings. Milestones 1–16
are complete; the record retains the initial CI browser failure, passing retry,
and separate dependency-maintenance recommendation.
Earlier milestones remain completed and retain their historical validation.

## Objective And Status

Milestones 1–16 completed, including the approved transaction, adapter-alias,
deployment-identity, preview-confinement, and CI follow-ups, latest-main
integration, and [PR #49](https://github.com/futex-ai/mokabook/pull/49).
The [integration review](../docs/reviews/consumer-export-integration.md) records
the preceding delivery and original findings. The
[preceding review](../docs/reviews/consumer-static-export.md) retains earlier context.
The user subsequently approved both code follow-ups and investigation of Node 22
CI. Milestones 10–13 track that work without reopening completed milestones.
Milestones 14–16 complete the approved exclusive-destination and release-doc
follow-ups, subsequent main integration, verification, and review.
The supported consumer CLI exports the complete Mokabook catalogue and comparisons
into a directory the consumer can deploy through their own hosting workflow.
The user approved fixing all four review findings, followed by merging latest main.

Implement the [consumer export protocol](../docs/protocol/mokly-export.md)
and [static delivery protocol](../docs/protocol/mokly-export-delivery.md).
Those documents describe the implemented contract on this branch, not a new npm release.

Consumer invocation:

```bash
npx mokabook export --out .context/mokabook-site
```

Export builds the consumer's current mockups, packages the same Browse shell
and Git comparisons as development, and exits. It does not upload a site or
publish npm packages. A relative output path is config-relative; `--base`
overrides `review.base`. The first release requires a valid Git baseline and
supports hosting at an origin root, with ordinary static files and directory
indexes. Subpath hosting and Git-free/optional comparisons are separate work.

## Initial Code And Design Decisions

- `src/cli/arguments.ts`, `help.ts`, and `run.ts` support only build/check/serve.
  `build` writes fragments and a manifest, not the catalogue shell.
- `scripts/preview/build.mjs` hardcodes the example config. `catalogue.mjs`
  captures shell pages/resources and replaces owned output; `comparisons.mjs`
  captures one isolated comparison. Both comparison selection and preview
  attribution hardcode `origin/main`.
- Preview rewrites HTML URLs for Cloudflare and emits `_redirects`/`_headers`.
  The new core must also work on a static server that ignores these files.
- `src/client/frame_navigation.ts` builds `/id/<id>` URLs; `diffs.ts` fetches
  the stable comparison endpoint. Static delivery needs explicit canonical
  route resolution and a direct immutable comparison URL.
- Reuse `src/build`, `src/server` rendering, `src/browse/document_adapter.ts`,
  and `src/review`; do not create another screen renderer or comparison engine.
- Existing `tests/preview*.test.ts`, `tests/browser/preview*.spec.ts`, and
  `scripts/package/consumer_cases.mjs` are the verification starting points.

Static aliases render existing screen components, and delivery metadata is
invisible. No new screen, appearance, or user-facing interaction is planned.
Reuse the approved [shell design](../docs/protocol/mokly-shell-design.md)
and its owning mobile/desktop example screens for visual smoke tests. If a
visible change becomes necessary, add a separate mockup milestone before its
tagged UI milestone and update the owning mockups before implementation.

Each implementation milestone ends with a functioning existing product and
passing focused tests. Keep the CLI unavailable until its complete static
browser behavior is ready. Add newly discovered work to the appropriate
incomplete milestone; never reopen completed milestones. Follow the repo's
separate-backend-then-new-UI rule if client work discovers a missing backend
contract. Test discovered regressions before fixing them.

Implementation clarification: the existing registry rejects empty definitions
and empty collections, so the planned "empty valid catalogue" case does not
exist. Preserve Build/Check/Serve validation; export rejects an empty registry
and retains the previous site. Supporting empty catalogues across commands is
a separate product decision, raised with the user. Protocols and regression
tests now describe the existing validation accurately.

## Milestone 1: Define The Consumer Contract — completed

Specify the public command and complete artifact/delivery behavior before code.

- [x] Audit the current CLI, exporter, config, comparison, and browser seams.
- [x] Fetch `origin/main` and audit preservation from source tip
      `e47524b9cb23f1866cb4b1a6a45ebb624b52a300`; main and this branch matched,
      with a clean worktree and no incoming additions or existing diff.
- [x] Define CLI/config rules, Git prerequisites, input consistency, private
      comparison storage, output ownership/rollback, and public-file boundaries.
- [x] Define portable routes, static aliases, delivery metadata, immutable
      comparison loading, hosting requirements, and the test contract.
- [x] Link the planned protocols from the protocol index and relevant current
      docs, without documenting the future command as already implemented.
- [x] Create this plan and register it immediately in `plans/README.md`.

Initial plan delivery uses the repository's documentation-only exception:
validate changed Markdown and local links, inspect the diff, then commit/push
the docs before `cargo xtask review`. Report findings without implementing them.
The implementation milestones below remain incomplete after that docs delivery.

## Milestone 2: Implement The Shared Export Engine — completed

Deliver a tested internal engine while existing consumer commands and the
repository preview remain functional. Do not expose a partial export command.

- [x] Add typed export options, results, versioned ownership data, and static
      delivery descriptors under `src/export`; keep files near 200 lines and
      split coherent responsibilities before 300 lines.
- [x] Implement config-relative output resolution and lexical/real-path
      confinement. Test missing/empty output, config/renderer/source overlap,
      installed-package/dependency/Git paths, symlink parents, and malformed
      ownership inventories before any replacement is allowed.
- [x] Implement one-writer ownership, exact stage/backup paths, safe replacement,
      rollback, explicit stale-reservation recovery, and cancellation/drain
      behavior. Cover installation and cleanup failures with injected boundaries
      plus real-filesystem integration tests.
- [x] Reuse the normal build transaction; pin one Git baseline and capture
      consistent current inputs for both route attribution and comparisons.
      Reject missing history and detected mid-export edits explicitly.
- [x] Preserve distinct Changes attribution and comparison materiality. Apply
      export, transaction, and real-path exclusions to both and extend Watch's
      owned-output pruning without suppressing unrelated authored files.
- [x] Generate the complete route/resource inventory through existing shell,
      catalogue, and Browse-adaptation functions. Detect duplicate/prefix path
      collisions and preserve current-id precedence for removed/renamed screens.
- [x] Package the complete browser module/font graph and public consumer asset
      graph. Test transitive HTML/CSS resources, binary assets, exclusions,
      symlink refusal, missing local assets, and retained external URLs.
- [x] Generate isolated comparisons with unchanged schema-v2 JSON and snapshot
      documents. Never use or disturb a live server's comparison directory.
- [x] Provide a typed static rendering context for the next milestone, including
      canonical/id routes and the direct generation URL; keep default served
      rendering behavior unchanged.
- [x] Run focused engine/config/review/watch/transaction tests and `npm run build`.

Exit: the internal engine can assemble and validate complete site inputs and
resources; the established public product remains available and tested.

Validation: 54 focused export, config, review, Changes, and watch tests passed;
`npm run build`, `npm run typecheck`, and `npm run lint` also passed.

## Milestone 3: Support Portable Static Browser Delivery — completed

Tags: ui

Make the existing shell and client work from plain static files, preserving the
approved appearance and all served navigation/comparison behavior.

- [x] Render and safely parse versioned shell-owned delivery metadata. Missing
      static metadata must not silently fall back to development endpoints;
      malformed data must not create cross-origin or out-of-prefix navigation.
- [x] Use a shared delivery-aware target resolver for shell links and every
      trusted frame activation mode. Preserve exact exported HTML paths and the
      existing served `/id` redirect path in development.
- [x] Render full canonical content for static id aliases. Normalize enhanced
      alias history without extra requests, preserve the validated fragment,
      and retain real page content when JavaScript is disabled.
- [x] Select the direct immutable comparison URL in static mode. Keep lazy
      loading, relative snapshot resolution, retry/refresh, cancellation, missing
      sides, and the server's current stable endpoint behavior intact.
- [x] Remove the watcher connection from static shells, with no environment
      badges or copy changes. Keep both viewports, schemes, search, tags, Changes,
      details, flows, active-tree state, and history/scroll behavior.
- [x] Add focused client/rendering tests and browser tests against exact static
      files and directory indexes, with no rewrite rules or live Mokabook routes.
- [x] Visually smoke-test the existing mobile/desktop owning screens in Current
      and all comparison modes, including alias/deep-link and fragment entry.
      Retain baseline served browser tests.

Exit: internally generated sites provide the complete existing experience on a
basic static server, and ordinary development Browse remains fully functional.

Validation: 59 focused client/navigation tests and 15 static/served browser tests
passed. Inspected mobile/desktop screenshots of Current and every comparison
mode; used browser-suite screenshots after interactive Browser setup failed.

## Milestone 4: Expose The CLI And Adopt It Internally — completed

Deliver the supported consumer command and reuse the engine for the existing
repository preview without changing its deployment ownership or public URLs.

- [x] Extend parser/help/dispatch with `export`, required `--out`, `--config`,
      and optional `--base`. Test wrong-command options, no-argument/default
      behavior, unknown flags, missing values, and config-free help.
- [x] Wire the complete export operation through typed errors and accurate
      success/failure output. Verify build-then-export behavior and document the
      separate build/output transaction guarantees.
- [x] Add CLI integration fixtures with config discovery from nested working
      directories, explicit nested configs, absolute/confined output, custom
      React renderers, cross-platform module resolution, and legacy pages.
- [x] Exercise non-default configured bases, overrides, equal-head baselines,
      missing refs/history, empty catalogues, removed screens, reused ids,
      ignored-only changes, and unchanged/shared-impact screens.
- [x] Turn repository preview entrypoints into adapters over the shared engine;
      retain their files, command, output path, local `--out` behavior, existing
      public assets/routes, and Cloudflare alias/header metadata.
- [x] Add explicit legacy-marker migration in the repository adapter only.
      Verify rollback from both an existing owned preview and a fresh directory;
      do not teach the public command to overwrite legacy/unrelated directories.
- [x] Keep preview adapter transformations inside the staged transaction.
      Audit parity against main before replacing old logic; retain production
      and PR deployment aliases, security settings, cleanup, and existing tests.
- [x] Prove provider alias validation, explicit legacy migration, output-parent
      retarget rejection, and post-install cleanup diagnostics with regression
      tests while integrating the new CLI and repository adapter.
- [x] Run CLI/preview integration suites, build the package, and run the real
      example through `npm run preview:build` and the Cloudflare local runtime.

Exit: a consumer can invoke the public CLI to export a complete site, and the
repository's established preview workflow uses the same tested core.

Validation: CLI, migration, safety, and comparison cases passed; the packed
Themed/Juno fixtures cover custom renderers, module resolution, and legacy
pages. All 8 existing Cloudflare browser checks and preview builds passed.

## Milestone 5: Prove Consumer Publishing And Document It — completed

Verify the npm boundary and deployment artifact, and publish accurate usage
documentation without actually uploading a site or releasing a package.

- [x] Add a clean packed-consumer export case using the installed CLI only.
      Cover local dependency and clean-cache npx execution, an explicit custom
      config/base, and absence of this repository's scripts or example files.
- [x] Inspect the tarball for the new compiled modules/assets and the existing
      package/license allowlist; export must need no consumer deep imports.
- [x] Copy just the completed site to an isolated serving directory and remove
      the fixture's source/Git access before browser checks. Crawl local route,
      module, CSS, image/font, alias, and snapshot references and require success.
- [x] Assert no comparison requests in Current and no live-update/network
      dependency on a Mokabook server. Exercise comparisons after source removal,
      refresh, interrupted navigation, failure/retry, and all schemes/viewports.
- [x] Retain real Cloudflare compatibility checks as a second serving mode;
      do not replace portable-host checks with provider-only success.
- [x] Update the root README's command table, consumer export/deploy recipe,
      config-relative output example, Git-history requirement, root-hosting
      limitation, external-resource caveat, and troubleshooting.
- [x] Update example/preview docs, package/runtime/navigation/Changes protocols,
      package architecture boundaries, and release/CI docs together. Mark the
      planned contracts implemented only once the command and tests are complete.
- [x] Run relevant package, consumer, static/browser, and preview tests with a
      100% pass rate and include them in `cargo xtask check`'s existing suites.

Exit: the shipped package exports real independent consumers, and a separately
served artifact demonstrates the documented publishing workflow.

## Milestone 6: Final Checks, Commit, Push, And Review — completed

Deliver all implementation, generated fixtures, and documentation through the
required repository workflow; no deployment or npm release is part of this plan.

- [x] Run `cargo xtask check` after all relevant tests pass. Resolve failures
      and rerun affected checks; keep implementation complete and functioning.
- [x] Fetch main and audit its additions from a captured source tip before any
      integration. Resolve paths individually; preserve mainline features.
- [x] Inspect the complete diff and deletions against `origin/main`; confirm
      every new source/test/generated file belongs to the intended change.
- [x] After checks pass, run `git add -A`, commit all completed work using
      Conventional Commits with a title of at most 50 characters and a body,
      then push the existing branch. Do not rename the branch.
- [x] Inspect committed paths/deletions against `origin/main` and run
      `cargo xtask review` only after the push so new files enter the review.
- [x] Report every finding without automatically fixing it: number, severity,
      feature/code context, impact of doing nothing, lettered options, and a
      clear recommendation, considering broader prevention as well as a direct
      fix. Record review execution blockers accurately if it cannot finish.
- [x] Record validation/review outcomes, mark completed milestones, and move
      this plan to Completed in `plans/README.md` once delivery is complete.
      Validate and commit/push any final documentation bookkeeping separately.

Exit: the requested implementation is checked, committed, pushed, and reviewed;
any reviewer-proposed follow-up remains the user's decision.

Preservation audit: fetched main from source tip
`59ca3ac3dd86c86a4474e5ecbf022d5779bbc0e0`; main remains
`e47524b9cb23f1866cb4b1a6a45ebb624b52a300`, with no incoming additions or file
deletions. Preview capture logic is replaced by the planned shared engine;
entrypoints, existing behavior/tests, and deployment workflows are retained.

Final gate: `cargo xtask check` passed formatting, lint, typechecking, all 429
unit/integration tests, committed example verification, package/license checks,
packed consumers, all 86 browser tests, Rust formatting/Clippy, 3 Rust tests,
and the Rust file-length audit. No npm release or deployment was performed.

Delivery: implementation commit `638b848` and checklist commit `d8c7a13` were
pushed to `calummoore/publish-export` before `cargo xtask review`. The review
completed successfully against `origin/main` on 2026-09-09 and reported three
Medium findings and one Low finding. See the
[post-push review](../docs/reviews/consumer-static-export.md) for every finding,
impact, solution options, verification notes, and recommended preventive scope.
The final plan/index/review-record changes are documentation-only bookkeeping.

## Milestone 7: Resolve Review Findings And Merge Main — completed

Deliver the requested review follow-up without reopening completed milestones.

- [x] Reproduce all four findings with failing regressions before fixes.
- [x] Use native reservation identity, shared package/anchor validation, and
      inventory-aware watcher traversal; update their protocols and READMEs.
- [x] Pass focused regression and integration checks before main integration.
- [x] Checkpoint the fixes, fetch main, capture the source tip, and audit main's
      additions before merging. Preserve features path-by-path.
- [x] Merge latest `origin/main`, resolve any conflicts, and rerun the full gate.
- [x] Audit diff/deletions, run `git add -A`, commit with Conventional Commits,
      and push the existing branch before `cargo xtask review`.
- [x] Report new review findings without automatic fixes; record final outcomes
      and commit/push documentation bookkeeping separately.

Delivered `fd543db`, merging main `93ac778` without deleting mainline files.
The full gate passed 465 unit/integration and 104 browser tests; five additional
post-commit browser smoke tests passed against the new merge baseline.
The successful post-push review reported one new High and one new Medium finding.
They were left unchanged at that handoff; approved fixes follow in Milestone 8.

## Milestone 8: Preserve Destination Data And Primary Failures — completed

Resolve both approved follow-up findings at shared transaction/cleanup boundaries.

- [x] Reproduce destination races and masked errors with failing regressions.
- [x] Validate captured backups, restore only when safe, and delete only validated
      files with non-recursive directory cleanup; retain unexpected contents.
- [x] Protect final reservation cleanup against late recovery entries and
      dangling backup symlinks; reproduce those gaps before fixing them.
- [x] Preserve retry-safe cleanup when the reservation is already absent,
      including a regression for the non-recursive cleanup transition.
- [x] Preserve primary and cleanup errors through setup, export, and the CLI;
      cover recovery conflicts, cancellation, and single/combined failures.
- [x] Update ownership/recovery protocols and READMEs; pass focused tests and
      smoke tests, followed by the complete `cargo xtask check` gate.
- [x] Audit mainline preservation and deletions, run `git add -A`, commit using
      Conventional Commits, and push before running `cargo xtask review`.
- [x] Report new findings without automatic fixes, complete the index/status,
      and validate, commit, and push final documentation bookkeeping.

Delivered `7fee0f4` with 20 new regressions and the complete passing gate above.
The post-push review completed on 2026-09-09 against main `93ac778`; its one new
Medium finding, reproduction, and recommended preventive scope are in the
[review report](../docs/reviews/consumer-static-export.md).

## Milestone 9: Validate Host Aliases And Deliver The PR — completed

Fix the approved collision gap, preserve latest main, and open the feature PR.

- [x] Reproduce alias/file, alias/directory, alias/alias, and case-folded
      collisions with failing tests, including the real preview adapter.
- [x] Share one collision index across files and aliases, including final
      reserved output paths; preserve valid aliases and exact-file deduplication.
- [x] Update the delivery protocol and relevant READMEs; pass focused tests.
- [x] Fetch main, capture the source tip, and audit incoming additions before
      merging; preserve each feature while resolving conflicts path-by-path.
- [x] Preserve main's new material-output/resource Changes calculation in
      export using captured inputs; add failing integration regressions first.
- [x] Pass the complete `cargo xtask check` gate and preview/export smoke tests
      on the merged result; audit mainline preservation and deletions.
- [x] Stabilize subprocess-heavy verification after reproduced startup timeouts
      by bounding test-file parallelism; retain all tests and their deadlines.
- [x] Run `git add -A`, commit using Conventional Commits, and push the branch
      before `cargo xtask review`; report new findings without automatic fixes.
- [x] Complete plan/index/review records, validate and commit/push any final
      documentation bookkeeping, and create a PR targeting `main` with results.

Integration audit: source `5b143d1`, merge base `93ac778`, fetched main `a5ecbc0`.
Main adds material-output Changes and resource watching. Both watch conflicts
retain main's behavior plus export exclusions; no mainline files were deleted.
See the [integration record](../docs/reviews/consumer-export-integration.md).

Delivery: merged implementation `43b6de0` was committed and pushed before the
completed independent review. Seven additional static/preview browser smoke
tests passed. [PR #49](https://github.com/futex-ai/mokabook/pull/49) is open against
`main`. The review reported one Medium and two Low observations; the two code
recommendations remain unapproved, while the pre-existing documentation closeout
records the delivery status. No PR merge or npm release was performed.

## Milestone 10: Finalize Deployment Identity And Adapter Boundaries — completed

Make complete export artifacts identifiable and enforce each adapter's scope.

- [x] Specify final-inventory hashing, self-reference normalization, descriptor
      compatibility, and projected-realpath adapter confinement before code.
- [x] Add failing regressions for non-comparison file/alias changes, stable
      insertion order, owned metadata integrity, and preserved consumer bytes.
- [x] Finalize one full-artifact identity after adapter changes and ownership
      assembly, and stamp only authenticated shell-root metadata.
- [x] Add failing preview/output-root symlink and retargeting tests; enforce
      the same stricter boundary at preflight and before installation.
- [x] Update relevant READMEs and pass focused export/preview tests and build.

Validation: 22 export/preview integration tests, build, typechecking, and lint passed.

## Milestone 11: Reload Across Static Deployments — completed

Tags: ui

Keep progressive navigation within one deployment and reload across versions.

- [x] Add failing client and real-browser regressions for unchanged comparisons
      across distinct deployments, including existing-tab state preservation.
- [x] Compare the full deployment identity, reject old/malformed descriptors,
      and retain normal served and same-deployment navigation.
- [x] Run static/preview browser tests and visually smoke-test the existing
      mobile/desktop owning screens; no screen redesign is required.

Validation: 4 delivery unit tests and 13 static/preview browser tests passed;
mobile and desktop owning-screen screenshots retain the approved appearance.

## Milestone 12: Resolve Node 22 Watcher Verification — completed

Determine the failing publication sequence before changing runtime or tests.

- [x] Reproduce and diagnose the inherited symlink-recovery assertion on
      Node 22/Linux, retaining the failing evidence and semantic state.
- [x] Add a deterministic regression for the proven cause, then fix the
      appropriate watcher lifecycle or shared test-observation boundary.
- [x] Retain every recovery assertion and deadline; pass focused Linux tests
      and the full relevant local suites.
- [x] Confirm both supported CI runtimes after the validated commit is pushed.
- [x] Clarify the watch/testing contract and README for any new useful context.

Diagnosis: a controlled Node 22/Linux removal/repair interleaving reproduced the
same assertion: version 5 showed two Changes for the removed file, then version
6 showed zero after restoration. The runtime recovered correctly. The original
helper accepted the intermediate version; a shared semantic-state expectation
now preserves the 20-second deadline, with deterministic polling and real
filesystem regressions. The original CI log did not record its intermediate
count; both CI runtimes subsequently passed all tests on `38e0aaa`.

## Milestone 13: Verify, Push, Review, And Update PR — completed

Deliver the approved follow-ups through the repository's verification workflow.

- [x] Run `cargo xtask check` and the relevant consumer/static/browser smoke
      checks with all tests passing; inspect preservation and deletions vs main.
- [x] Run `git add -A`, commit all source/tests/docs with Conventional Commits,
      and push the branch before running `cargo xtask review`.
- [x] Run the independent post-push review and report any new findings with
      severity, context, impact, lettered options, and a recommendation; do not
      automatically implement another unapproved review cycle.
- [x] Confirm PR #49 CI results, update its body and the review records, and
      validate, commit, and push the final documentation closeout.

Local validation: Linux Node 22.14.0/npm 11.7.0 passed all 578 unit/integration
tests. The full Node 24.2.0 `cargo xtask check` passed those 578 tests, all 105
browser tests, 3 Rust tests, all package/consumer smoke checks, and every other
gate. Main remains `a5ecbc0`; the branch preserves it without any file deletions.

Delivery: implementation `38e0aaa` was committed and pushed before the required
review. Both supported CI runtimes and Required CI passed. The review returned
one High installation-race finding and one Low pre-existing release-doc finding;
both are independently confirmed and recorded with options in the
[follow-up review](../docs/reviews/consumer-export-followup.md). They were not
automatically fixed or added as implementation TODOs. Final documentation
closeout records the completed approved scope without merging PR #49 or
publishing a release.

## Milestone 14: Preserve Concurrent Export Destinations — completed

Close the approved installation and rollback races without weakening complete,
atomic directory installation or requiring a consumer compiler toolchain.

- [x] Specify initial destination identity and exclusive rename in the recovery
      contract; add failing regressions before changing production code.
- [x] Retain typed initial state and exact directory identity, reject transitions,
      and verify the actual captured backup before installation.
- [x] Use one OS-enforced no-replace primitive for capture, install, and restore;
      fail closed on unsupported native operations without replacing rename.
- [x] Test initial absence, late owned/empty outputs, identity changes and
      removal, capture substitutions, and install/restore check-to-call races.
- [x] Verify native semantics and packaged consumers, add focused macOS/Windows
      CI alongside the existing complete Linux gates, and update relevant docs.

## Milestone 15: Clarify Current Release Guidance — completed

Apply the approved documentation finding without changing package versions or
publication behavior.

- [x] Document release-managed version sources and the current release/retry
      workflow without hardcoding a current package version.
- [x] Preserve bootstrap context as explicitly completed history, align README,
      and validate Markdown plus the existing release-contract tests.

## Milestone 16: Verify, Push, Review, And Update PR — completed

Deliver the approved findings through the existing PR, without publishing an
npm release or merging the PR.

- [x] Run relevant tests and `cargo xtask check` with all tests passing; audit
      changes and deletions against `origin/main`.
- [x] Run `git add -A`, commit using Conventional Commits, and push all changed
      source/tests/docs before invoking `cargo xtask review`.
- [x] After GitHub reports new mainline conflicts, capture source tip `95bee11`,
      fetch main `aa5adea`, audit all 36 incoming paths, and resolve the five
      watcher-test conflicts path-by-path. Preserve main's interfaces, tests,
      icon implementation, and generated design output alongside this branch's
      additional polling and controlled-recovery regressions.
- [x] Rerun the relevant tests and complete `cargo xtask check` after integration;
      audit mainline preservation, then `git add -A`, commit, and push the merge.
- [x] Run the post-push review; independently assess and report new findings with
      severity, context, impact, lettered options, and a recommendation rather
      than automatically implementing another unapproved cycle.
- [x] Confirm CI, update PR #49 and review records, then validate, commit, and
      push the final documentation closeout.

Delivery: fixes `95bee11` and main integration `4f944b0` were committed and
pushed before the final review. Both complete supported-runtime CI gates pass
598 unit/integration, 107 browser, and three Rust tests; native macOS/Windows
jobs, Required CI, and preview deployment also pass. One initial Node 24 browser
assertion failed; ten unchanged local repetitions and the full CI retry passed,
without code, assertion, deadline, or retry-policy changes. The exact original
cause is unproven and retained in the review record. The final independent
review reported no actionable findings. Final bookkeeping is documentation-only.
