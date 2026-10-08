# Test Helper Export Ratchet

Status: Active. Plan created on 2026-10-08 with the user's consent. All five
milestones are complete. The test helper baseline is empty. Finding 2 awaits
the user.

## Status And Outcome

Before this plan, the unused-internal-export ratchet scanned `src`,
`packages/viewer/src`, and `scripts`. It did not scan `tests` or
`packages/viewer/tests`. A test helper could therefore export a function that no
test imported, and no gate reported it. The
post-push review of this branch found one such helper,
`mountedRegistrySessions` in `packages/viewer/tests/frame_registry_harness.tsx`.
A scan of both test roots with the existing resolver found more:

| Measure                                       | Count |
| --------------------------------------------- | ----- |
| Candidate helper modules under the test roots | 262   |
| Unused named value exports                    | 81    |
| Helper files that no module imports           | 6     |

The scan found six orphan files: `tests/helpers/fake_dom.ts`,
`tests/helpers/fake_markup.ts`, `tests/helpers/publish_exchange_fixture.ts`,
`tests/removed_preview_delivery_fixture.ts`,
`tests/browser/removed_preview_observers.ts`, and
`packages/viewer/tests/component_workspace_fixture.tsx`. The last one is a
duplicate that its `.ts` sibling shadows during module resolution.
`tests/component_authoring_types.tsx` is a compile-only type test; its eight
exported witnesses are live type checks that nothing imports.

Milestone 4 found a seventh orphan, `tests/server_fixture.ts`; the viewer
fixture with the same stem is `packages/viewer/tests/server_fixture.tsx`.

This plan extends the ratchet to the two test roots, bootstraps a separate
shrink-only baseline for them, and deletes the dead helpers. It also resolves
open review finding 83 in
[Generated Output Simplification](./generated-output-simplification.md), which
records unused test helpers after the merge of PR #156.

This is verification-script, test, and documentation work. It does not change
product behavior, UI, or mockups.

Contract owners:

- [Repository verification ratchets](../docs/protocol/verification-ratchets.md)
  and the [test helper export contract](../docs/protocol/verification-ratchets-test-helpers.md).
- [CI verification](../docs/protocol/ci-verification.md).
- [Local verification](../xtask/README.md).

Evidence: `.context/test-helper-export-ratchet/probe-2026-10-08.txt` holds the
scan output, measured at merge base `1086732`.

## Decisions

- **Test helper roots.** The new scope scans `tests` and
  `packages/viewer/tests`. The three source roots keep their current scope,
  baseline, and messages.
- **Candidates.** A candidate is a module with one of the existing module
  extensions under a test helper root. These files are not candidates:
  `.test.ts` and `.test.tsx` files, which the strict unit discovery runs;
  `.spec.ts` files, which Playwright runs; declaration files; and every file
  under `tests/fixtures/`, which tests load by path. Declaration files are
  neither candidates nor importers in either scope. Other non-candidate modules
  stay in the shared graph, so their imports still count as uses.
- **Path-loaded modules.** A module that only a path string loads, such as an
  esbuild entry point or the Playwright `globalSetup` file, has no static
  importer. Such a module must not have a named value export that nothing
  imports. Default exports and type-only exports are never findings.
- **Separate baseline.** The test helper scope uses
  `xtask/unused-test-helper-exports.txt`. The file has the same format and
  rules as `xtask/unused-internal-exports.txt`: one exact
  `<module path>#<export name>` per line, sorted, no duplicates, no globs, a
  subset of the discovered set, and a subset of the file at the comparison
  commit. A comparison commit that predates the file permits the one-time
  bootstrap. A separate file is required because the shrink-only rule of the
  existing baseline rejects every entry that the comparison commit lacks.
- **Cleanup policy.** Delete a helper that nothing needs. Remove the `export`
  keyword from a value that only its own file uses. Keep a baseline entry only
  with a reason recorded in this plan. The target is an empty baseline file.
- **Messages.** Findings name the scope: `new unused test helper export: <key>`
  and `stale baseline entry: delete <key>`. The pass summary reads
  `<n> test helper module(s), <m> baseline exception(s)`.
- **User approval (2026-10-08).** The user approved this plan, the deletion of
  the six orphan files, and the deletion of `mountedRegistrySessions`. Every
  further deletion in Milestone 4 is listed in the commit description.

## Milestone 1: Define the test helper export contract — completed

Document the new scope before changing the ratchet.

- [x] Add `docs/protocol/verification-ratchets-test-helpers.md` as a
      continuation of the ratchet contract. Define the roots, the candidate
      rule, the non-candidate files, the path-loaded module rule, the baseline
      file and its bootstrap, the finding and summary text, and gate placement
      after the internal-export audit in the repository suite and the complete
      gate.
- [x] Link the new page from `verification-ratchets.md` and keep that page at
      or under 250 lines. Index the page in `docs/protocol/README.md` and add
      it to the page list in `tests/protocol_split_links.test.ts`.
- [x] Update the repository row and the ratchet paragraph in
      `docs/protocol/ci-verification.md`, and the scope, exception, and file
      list paragraphs in `xtask/README.md`.
- [x] Run `npm run format:check`, the Markdown link test, and the protocol
      structure tests. Run `cargo xtask source-file-length-lint`. Review the
      documentation diff.

Evidence: `.context/test-helper-export-ratchet/milestone-1-evidence.md`.

## Milestone 2: Scan the test helper roots — completed

Add the second scope to the ratchet without changing the source-root results.

- [x] Apply the reviewer's documentation corrections: exclude declarations from
      both import graphs, correct the live test TODO, group the README scope
      and baseline text, and move the unchanged Node CI text to its own paragraph.
- [x] Parameterize `scripts/verification/ratchets/internal-exports.mjs` by
      scope: label, roots, baseline file, non-candidate rule, and message
      prefix. Split a module if any file would pass 300 lines.
- [x] Register the `Unused test helper export` audit in
      `scripts/verification/repository-ratchets.mjs` after the internal-export
      audit. Update `repository-ratchets.d.mts` for any changed signature.
- [x] Analyze both candidate sets once per run. Share the graph result and any
      operational error across the two export audits.
- [x] Preserve source counts for linked paths. Keep unused keys with a hash in
      the module path during scope partition. Add regression tests first.
- [x] Bootstrap `xtask/unused-test-helper-exports.txt` from the scan of this
      branch, sorted and exact.
- [x] Add unit tests in the new `tests/test_helper_export_ratchet.test.ts`:
      `.test.ts`, `.test.tsx`, and `.spec.ts` files are not candidates but their
      imports count; exact suffix and `tests/fixtures/` exclusions; declaration
      files are neither candidates nor importers in either scope; root config
      and source imports count; path-only loads do not use named exports; the
      scope-specific baseline prefix check; the finding, format-error, and
      summary text. Do not extend the 301-line `repository_ratchets.test.ts`.
- [x] Add Git-backed tests in the new
      `tests/test_helper_export_ratchet_git.test.ts`: a new
      unused export under `tests/helpers` fails; the same export in a
      `.test.ts` file passes; a comparison commit that predates the baseline
      file permits the bootstrap; an entry absent at the comparison commit
      fails afterwards; a missing current baseline fails and names its file;
      the source-root audit output is unchanged. Keep changed test files at or
      under 300 lines.
- [x] Add the new baseline file to the fixture repositories in
      `tests/repository_ratchets_git.test.ts`, which run every repository
      ratchet. Check their updated output without changing their existing
      assertions.
- [x] Change the test helper protocol page's Delivery Status to implemented.
      Align the current ratchet count and scope in `verification-ratchets.md`,
      `ci-verification.md`, and `xtask/README.md` with the implementation.
- [x] Smoke-test a temporary unused export in a real helper. Confirm the exact
      finding with the repository ratchets, then remove the temporary export.
- [x] Run the focused ratchet tests, protocol structure and Markdown link
      tests, Prettier, ESLint on changed files, the source file-length audit,
      and `cargo xtask check --suite repository`. Require a 100% pass rate.

Evidence: `.context/test-helper-export-ratchet/milestone-2-evidence.md`.

## Milestone 3: Delete the orphan helpers — completed

Remove the approved dead code and shrink the new baseline.

- [x] Apply the reviewer's scope correction: remove the unused candidate flag
      branch and narrow the shared analysis input to module path and source.
- [x] Prove each orphan has no loader before deleting it. Search all repository
      file-stem references, including path strings and configuration.
- [x] Delete the six orphan files named above and `mountedRegistrySessions`
      with its unused `ShellFrameRegistry` import.
- [x] Rewrite `tests/component_authoring_types.tsx` so it exports nothing, in
      the style of `tests/authoring_variant_types.ts`. Keep every type check.
- [x] Confirm both TypeScript projects include the remaining viewer fixture.
      Confirm the root project includes the authoring type checks. Remove one
      expected-error directive temporarily, confirm the type error, then restore it.
- [x] Remove the matching baseline lines. Search `docs/`, `plans/`, and every
      `README.md` for the deleted names; `plans/screen-variants.md` names
      `fake_dom.ts` only in history, so leave it.
- [x] Add a sentence to the live status paragraph of
      `plans/generated-output-simplification.md`: finding 83 is resolved by
      [Test Helper Export Ratchet](./test-helper-export-ratchet.md).
      Do not change the historical finding list under completed Milestone 23.
- [x] Run the focused tests for the frame registry harness, the component
      workspace fixture, and the ratchets. Require a 100% pass rate.

Evidence: `.context/test-helper-export-ratchet/milestone-3-evidence.md`.

## Milestone 4: Triage the remaining baseline entries — completed

Apply the cleanup policy to every entry left after Milestone 3. Work file by
file. Keep the tree green after each file.

- [x] Triage `tests/server_fixture.ts`, `tests/review_fixture.ts`,
      `tests/authoring_fixture.tsx`, and `tests/browser/*.ts` entries.
- [x] Triage the `tests/helpers/*.ts` entries.
- [x] Triage the `packages/viewer/tests/*.ts` entries.
- [x] Record each kept entry and its reason in this section. Record each
      deletion in the commit description.
- [x] Record every action and cascade in
      `.context/test-helper-export-ratchet/milestone-4-triage.md`.
      Resolve cascades without adding baseline entries.
- [x] Run every unit test and Playwright spec that imports a changed helper,
      directly or transitively. Run both TypeScript projects, ESLint, Prettier,
      the source file-length audit, ratchet tests, and the repository suite.
      Require a 100% pass rate. Rerun an unrelated failure once and report it.

No baseline entry is kept. No cascade arose during cleanup.

Decision: Delete `tests/server_fixture.ts` as the seventh orphan. No module
loads it, and its seven definitions are unused. The file probe missed it because
`packages/viewer/tests/server_fixture.ts` has the same file stem. Tests load the
viewer fixture, not the root fixture.

Evidence: `.context/test-helper-export-ratchet/milestone-4-evidence.md`.

## Milestone 5: Verify and deliver — completed

- [x] Run `cargo xtask check --suite repository` and the complete
      `cargo xtask check`. Require a 100% pass rate. Rerun only failing
      tests after a fix, then rerun the complete gate.
- [x] Run the mainline preservation audit in `docs/dev/git.md` before and
      after the commit. Confirm every deletion is one this plan approves.
- [x] Run `git add -A`, commit with Conventional Commits, and push the branch
      with every new file tracked.
- [x] After the push, review the complete diff against `origin/main` with
      `docs/implementation-review-prompt.md`, report numbered findings, then
      apply the review-fix rule in `docs/dev/review.md`: fix the
      `Auto-fix: yes` findings, re-review once, and report the rest.

Review: `.context/test-helper-export-ratchet/review-1.md`; findings 1 and 3 are fixed in this round.

Re-review: `.context/test-helper-export-ratchet/review-2.md`; the re-review confirmed fixes for findings 1 and 3; finding 4 is fixed in round 2.

2 — Low, test: no test proves that the helper scope skips linked module files; recommended option A adds one Git-backed test. Awaits the user.

Evidence: `.context/test-helper-export-ratchet/milestone-5-evidence.md`.
Review fix evidence: `.context/test-helper-export-ratchet/review-1-fixes-evidence.md`.
Round 2 evidence: `.context/test-helper-export-ratchet/review-2-fixes-evidence.md`.

## Post-merge follow-up (non-blocking)

- When the harness size review in
  [Meta Test Reduction](./meta-test-reduction.md) considers `knip`, include the
  test helper scope in that comparison.
