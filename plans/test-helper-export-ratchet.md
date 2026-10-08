# Test Helper Export Ratchet

Status: Active. Plan created on 2026-10-08 with the user's consent. No
milestone has started.

## Status And Outcome

The unused-internal-export ratchet scans `src`, `packages/viewer/src`, and
`scripts`. It never scans `tests` or `packages/viewer/tests`. A test helper can
therefore export a function that no test imports, and no gate reports it. The
post-push review of this branch found one such helper,
`mountedRegistrySessions` in `packages/viewer/tests/frame_registry_harness.tsx`.
A scan of both test roots with the existing resolver found more:

| Measure                                       | Count |
| --------------------------------------------- | ----- |
| Candidate helper modules under the test roots | 262   |
| Unused named value exports                    | 81    |
| Helper files that no module imports           | 6     |

The six orphan files are `tests/helpers/fake_dom.ts`,
`tests/helpers/fake_markup.ts`, `tests/helpers/publish_exchange_fixture.ts`,
`tests/removed_preview_delivery_fixture.ts`,
`tests/browser/removed_preview_observers.ts`, and
`packages/viewer/tests/component_workspace_fixture.tsx`. The last one is a
duplicate that its `.ts` sibling shadows during module resolution.
`tests/component_authoring_types.tsx` is a compile-only type test; its eight
exported witnesses are live type checks that nothing imports.

This plan extends the ratchet to the two test roots, bootstraps a separate
shrink-only baseline for them, and deletes the dead helpers. It also resolves
open review finding 83 in
[Generated Output Simplification](./generated-output-simplification.md), which
records unused test helpers after the merge of PR #156.

This is verification-script, test, and documentation work. It does not change
product behavior, UI, or mockups.

Contract owners:

- [Repository verification ratchets](../docs/protocol/verification-ratchets.md)
  and its new continuation page for test helper exports.
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
  under `tests/fixtures/`, which tests load by path. Non-candidate files stay in
  the module graph, so their imports still count as uses.
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

## Milestone 1: Define the test helper export contract

Document the new scope before changing the ratchet.

- [ ] Add `docs/protocol/verification-ratchets-test-helpers.md` as a
      continuation of the ratchet contract. Define the roots, the candidate
      rule, the non-candidate files, the path-loaded module rule, the baseline
      file and its bootstrap, the finding and summary text, and gate placement
      after the internal-export audit in the repository suite and the complete
      gate.
- [ ] Link the new page from `verification-ratchets.md` and keep that page at
      or under 250 lines. Index the page in `docs/protocol/README.md` and add
      it to the page list in `tests/protocol_split_links.test.ts`.
- [ ] Update the repository row and the ratchet paragraph in
      `docs/protocol/ci-verification.md`, and the scope, exception, and file
      list paragraphs in `xtask/README.md`.
- [ ] Run `npm run format:check`, the Markdown link test, and the protocol
      structure tests. Review the documentation diff.

## Milestone 2: Scan the test helper roots

Add the second scope to the ratchet without changing the source-root results.

- [ ] Parameterize `scripts/verification/ratchets/internal-exports.mjs` by
      scope: label, roots, baseline file, non-candidate rule, and message
      prefix. Split a module if any file would pass 300 lines.
- [ ] Register the `Unused test helper export` audit in
      `scripts/verification/repository-ratchets.mjs` after the internal-export
      audit. Update `repository-ratchets.d.mts` for any changed signature.
- [ ] Bootstrap `xtask/unused-test-helper-exports.txt` from the scan of this
      branch, sorted and exact.
- [ ] Add unit tests in `tests/repository_ratchets.test.ts`: a `.test.ts`
      file and a `.spec.ts` file are not candidates but their imports count; a
      `tests/fixtures/` module is not a candidate; a declaration file is not a
      candidate; the scope-specific baseline prefix check; the finding and
      summary text.
- [ ] Add Git-backed tests in `tests/repository_ratchets_git.test.ts`: a new
      unused export under `tests/helpers` fails; the same export in a
      `.test.ts` file passes; a comparison commit that predates the baseline
      file permits the bootstrap; an entry absent at the comparison commit
      fails afterwards; the source-root audit output is unchanged.
- [ ] Run the focused ratchet tests and
      `cargo xtask check --suite repository`. Require a 100% pass rate.

## Milestone 3: Delete the orphan helpers

Remove the approved dead code and shrink the new baseline.

- [ ] Delete the six orphan files named above and `mountedRegistrySessions`
      with its unused `ShellFrameRegistry` import.
- [ ] Rewrite `tests/component_authoring_types.tsx` so it exports nothing, in
      the style of `tests/authoring_variant_types.ts`. Keep every type check.
- [ ] Remove the matching baseline lines. Search `docs/`, `plans/`, and every
      `README.md` for the deleted names; `plans/screen-variants.md` names
      `fake_dom.ts` only in history, so leave it.
- [ ] Record under finding 83 in `plans/generated-output-simplification.md`
      that this plan removes the helpers. Do not change the finding's words.
- [ ] Run the focused tests for the frame registry harness, the component
      workspace fixture, and the ratchets. Require a 100% pass rate.

## Milestone 4: Triage the remaining baseline entries

Apply the cleanup policy to every entry left after Milestone 3. Work file by
file. Keep the tree green after each file.

- [ ] Triage `tests/server_fixture.ts`, `tests/review_fixture.ts`,
      `tests/authoring_fixture.tsx`, and `tests/browser/*.ts` entries.
- [ ] Triage the `tests/helpers/*.ts` entries.
- [ ] Triage the `packages/viewer/tests/*.ts` entries.
- [ ] Record each kept entry and its reason in this section. Record each
      deletion in the commit description.
- [ ] Run the focused tests for every changed helper and the ratchet tests.
      Require a 100% pass rate.

## Milestone 5: Verify and deliver

- [ ] Run `cargo xtask check --suite repository` and the complete
      `cargo xtask check`. Require a 100% pass rate. Rerun only failing
      tests after a fix, then rerun the complete gate.
- [ ] Run the mainline preservation audit in `docs/dev/git.md` before and
      after the commit. Confirm every deletion is one this plan approves.
- [ ] Run `git add -A`, commit with Conventional Commits, and push the branch
      with every new file tracked.
- [ ] After the push, review the complete diff against `origin/main` with
      `docs/implementation-review-prompt.md`, report numbered findings, then
      apply the review-fix rule in `docs/dev/review.md`: fix the
      `Auto-fix: yes` findings, re-review once, and report the rest.

## Post-merge follow-up (non-blocking)

- When the harness size review in
  [Meta Test Reduction](./meta-test-reduction.md) considers `knip`, include the
  test helper scope in that comparison.
