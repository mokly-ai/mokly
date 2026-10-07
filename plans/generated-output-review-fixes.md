# Generated Output Review Fixes

Status: Active. This plan owns the remaining review fixes from
[Generated Output Simplification](./generated-output-simplification.md), merged
in [PR #156](https://github.com/mokly-ai/mokly/pull/156) on 2026-10-07. Milestones
2–6 retain the former Milestones 24–28. Findings 17, 52 and 67–86 and the known
status notes remain pending decisions, outside milestone scope. Milestone 1 is
complete; Milestones 2–6 await their separate instructions.

## Summary

Finish the approved shared Watch lifecycle, command notices, comparison readers,
cache races, post-render offsets, frame URL handling and test/release tooling.
The [recorded decisions](./generated-output-simplification.md#milestone-19-define-the-review-fix-contracts) and
[post-merge re-plan](./generated-output-simplification.md#re-plan-decisions)
remain the source of approval. This transfer changes no contract decision.
Checked integration TODOs are retained as history; do not repeat them.

The orchestrator sends one instruction per milestone. Write a failing test
before each bug fix and retain its failure output as evidence. Complete the
milestone's smoke tests. Do not implement a pending finding unless separately
approved. If approved work also fixes one, record that side effect without
claiming a decision. Keep UI work separate from backend work.

## Contract owners

- Shared watching, cancellation and notices: [watch writers](../docs/protocol/mokly-watch-writers.md),
  [Git state for Check](../docs/protocol/mokly-boundary-results.md#git-state-for-check)
  and [terminal errors](../docs/protocol/mokly-terminal-errors.md).
- Comparisons and build edits: [side inventories, cache acquisition/discovery and offset mapping](../docs/protocol/mokly-comparison-inventory.md),
  [baseline addressing](../docs/protocol/mokly-baseline-addressing.md),
  [storage](../docs/protocol/mokly-baseline-storage.md) and the
  [v9 manifest gate](../docs/protocol/mokly-generated-manifest.md).
- Viewer URLs: [delivered frame identity](../docs/protocol/mokly-boundary-results.md#delivered-frame-identity)
  and the [frame adapter](../docs/protocol/mokly-frame-adapter.md).
- Test and release tooling: [fixture preparation](../docs/protocol/ci-fixture-preparation.md),
  [API reports and unused members](../docs/protocol/verification-api-members.md)
  and [directory/import lint](../docs/protocol/mokly-directory-lint.md).

Preserve cache ignore publication and retention under the
[cache layout contract](../docs/protocol/mokly-baseline-storage.md#cache-layout).
Tests follow [CI Test Timing](../docs/protocol/ci-test-timing.md): deterministic
assertions, text-only duration evidence, at least 10,000 ms for expected-state
polling, and unchanged fixture budgets. Structured fixture phase reports stay.
The [remote gate](../docs/protocol/remote-verification.md) and its
[Testbox execution contract](../docs/protocol/remote-verification-testbox.md)
keep all suites, source checks, report validation and cleanup.

## Verification and delivery

Use Node 22.14.0 first on `PATH` and `TMPDIR=$PWD/.context/tmp`. Before each
commit and push, require branch `calummoore/untitled-v2`; never rename it.
Keep evidence under `.context/generated-output-review-fixes/`, with one file
pointer under its milestone. Keep generated catalogue output out of Git.
Stop all owned processes, browsers and Testboxes.

For implementation milestones, commit and push before `cargo xtask check`.
The user approved Blacksmith on 2026-10-07. Its complete gate covers all seven
commands below. Validate all 11 remote outcomes, nine reports, aggregation and
the unchanged source fingerprint. Local fallback is allowed only before remote
suites start. If it selects or falls back to local, run all seven commands
locally, with the final command forced local:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:browser
npm run example:check
cargo xtask check --executor local
```

Fix only failures caused by the active milestone. Commit and push fixes before
rerunning the gate. After it passes, tick completed TODOs, validate the changed
plan and push its completion update. Documentation-only work uses Markdown
checks and diff inspection under `AGENTS.md`; it needs no full gate or Testbox.

## Pending decisions

These are carried review records, not milestone work. Known-status notes qualify
older completion claims. Preserve their pending status until the user decides.

- 17 — Pending: authored-root/output-directory rules 1 and 3; rule 2 was the separately approved 37 A restoration.
- 52 — Low: the directory literal rule couples the viewer's public CSS class to its URL namespace.
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
- Known 10 — Changed: main normalizes `.html` and highlights work through redirects; the shared helper and regression remain in [Milestone 4](#milestone-4-viewer-frame-urls-was-milestone-26).
- Known 25 — Still open: frame paths are decoded twice.
- Known 57 — Unchanged: hydration global setup still rebuilds the shared example.
- Known 63 — Still open: ESLint names the deleted `src/build/discovery.ts`.
- Known 65 — Unchanged: the planned test corrections remain.

The required final-review wording update also addresses the wording described
in finding 78. This is a bookkeeping side effect, not a selected option or a
new decision for that finding.

## Milestone 1: Confirm contracts and transfer ownership

Documentation only. Preserve all approved decisions and every moved TODO.

- [x] Re-read the protocol sections owned by Milestones 2–6. Keep complete
      behavior, error, test and smoke contracts; distinguish implemented rules
      from approved targets and preserve pending decisions.
- [x] Carry the cache ignore, deterministic test timing and remote gate
      constraints into the affected target contracts without changing decisions.
- [x] Close the merged plan, transfer its remaining milestones and pending
      records, and point pending-target owner links at this active plan.
- [x] Run Markdown formatting and documentation tests for links, protocol
      sizes/history and guides. Review the diff and prove the transferred TODOs,
      decision codes, UI tag and unrelated completed-plan text are preserved.
- [x] `git add -A`; commit with Conventional Commits; check the branch and
      push with `git push -u origin HEAD`. Stop before Milestone 2.

Evidence: `.context/generated-output-review-fixes/m1-contract-audit.md`.

Validation: `.context/generated-output-review-fixes/m1-validation.md`.

## Milestone 2: Shared watching and command output (was Milestone 24)

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

Test-first evidence: `.context/generated-output-review-fixes/m2-test-first.md`.

Implementation evidence: `.context/generated-output-review-fixes/m2-implementation.md`.

Smoke evidence: `.context/generated-output-review-fixes/m2-smoke.md`.

Gate evidence: `.context/generated-output-review-fixes/m2-gate.md`.

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
- [ ] Complete the [full gate from the completed plan](./generated-output-simplification.md#milestone-20-one-public-file-policy):
      `git add -A`; commit with Conventional Commits and push; then run
      `cargo xtask check`. On Blacksmith it covers all seven gate commands.
      If it falls back to local, run the seven commands locally as listed under
      [Verification and delivery](#verification-and-delivery). Fix only failures
      caused by this milestone, commit and push each fix, then rerun the gate.
      Tick the completed TODOs after the gate passes; validate and push the plan.

## Milestone 3: Comparisons, baselines and build edits (was Milestone 25)

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
- [ ] Complete the [full gate from the completed plan](./generated-output-simplification.md#milestone-20-one-public-file-policy):
      `git add -A`; commit with Conventional Commits and push; then run
      `cargo xtask check`. On Blacksmith it covers all seven gate commands.
      If it falls back to local, run the seven commands locally as listed under
      [Verification and delivery](#verification-and-delivery). Fix only failures
      caused by this milestone, commit and push each fix, then rerun the gate.
      Tick the completed TODOs after the gate passes; validate and push the plan.

## Milestone 4: Viewer frame URLs (was Milestone 26)

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
- [ ] Complete the [full gate from the completed plan](./generated-output-simplification.md#milestone-20-one-public-file-policy):
      `git add -A`; commit with Conventional Commits and push; then run
      `cargo xtask check`. On Blacksmith it covers all seven gate commands.
      If it falls back to local, run the seven commands locally as listed under
      [Verification and delivery](#verification-and-delivery). Fix only failures
      caused by this milestone, commit and push each fix, then rerun the gate.
      Tick the completed TODOs after the gate passes; validate and push the plan.

## Milestone 5: Test and release tooling (was Milestone 27)

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
      logical/physical/binary coverage. Correct the moved [Milestone 17 title inventory](./generated-output-simplification.md#milestone-17-remove-the-compatibility-code)’s
      historical lazy-read claim and render
      its rows as a real table in the evidence file; add a short plan correction
      and record [Milestone 22’s later restoration](./generated-output-simplification.md#milestone-22-merge-main-and-apply-the-combined-design) separately.
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
- [ ] Complete the [full gate from the completed plan](./generated-output-simplification.md#milestone-20-one-public-file-policy):
      `git add -A`; commit with Conventional Commits and push; then run
      `cargo xtask check`. On Blacksmith it covers all seven gate commands.
      If it falls back to local, run the seven commands locally as listed under
      [Verification and delivery](#verification-and-delivery). Fix only failures
      caused by this milestone, commit and push each fix, then rerun the gate.
      Tick the completed TODOs after the gate passes; validate and push the plan.

## Milestone 6: Verify and review the review fixes (was Milestone 28)

- [ ] Re-read every document changed in [Milestones 19–23 of the completed plan](./generated-output-simplification.md#milestone-19-define-the-review-fix-contracts)
      and Milestones 1–5 here against the code, and fix drift. Validate changed
      Markdown. If code changes, commit and push, then run `cargo xtask check`.
      On Blacksmith it covers all seven gate commands. If it falls back to local,
      run the seven commands locally under [Verification and delivery](#verification-and-delivery).
- [ ] `git add -A`; commit with Conventional Commits; push.
- [ ] After the push, the orchestrator reviews the complete local diff against
      `origin/main` using [the implementation review prompt](../docs/implementation-review-prompt.md).
      The review stays read-only and reports severity, category, effort, options
      and Auto-fix tags. Then follow `AGENTS.md`'s review-fix rule: fix eligible
      findings, validate, commit and push, re-review once, and apply at most one
      final eligible fix round. Report the remaining findings for decisions.
      The implementer stops after the push; the orchestrator owns this review.
