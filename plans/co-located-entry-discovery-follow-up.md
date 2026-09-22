# Co-Located Entry Discovery Follow-up

Status: implemented and verified on 2026-09-22; delivery and post-push review
are in progress. Created at the user's request to close
[Co-Located Entry Discovery](./co-located-entry-discovery.md) for
[PR #101](https://github.com/mokly-ai/mokly/pull/101). All work here belongs in a
separate PR. The user requested a plan audit before delegating the fixes to
Codex 5.6 Sol with max reasoning and an independent supervising check.
Keep this plan active until its PR merges; component-adoption work and the
published-release smoke remain outside this implementation.

## Scope And Contracts

Carry every deferred seventh/eighth-round finding, the latest entry-layout
documentation finding, the eighth-round residual note, and both original
post-merge tasks. Preserve original review records; recheck historical findings
against the follow-up base before making edits and retain evidence if an item
has already been addressed.

The audited starting tip and `origin/main` are both `ce3da27`. Implement on the
existing workspace branch without renaming it. This follow-up changes
documentation and regression fixtures; retain current production discovery,
watching and source-protection behavior unless a regression demonstrates a
contract violation. No UI, mockup, dependency or manifest changes are planned.

Contract owners:

- [Configuration](../docs/protocol/mokly-configuration.md) and
  [source protection](../docs/protocol/mokly-source-protection.md).
- [Build pipeline](../docs/architecture/build-pipeline.md),
  [build README](../src/build/README.md), and
  [watching](../docs/protocol/mokly-watch.md).
- [Authoring](../docs/protocol/mokly-authoring.md),
  [component Changes](../docs/protocol/mokly-component-changes.md), and
  [rendering](../docs/protocol/mokly-rendering.md) for later adoption planning.

## Carried Review Findings

The original round/item references keep all eight deferred observations
traceable. Seventh-round item 8 and eighth-round item 1 describe the same
wrapping issue and share finding 6 below; neither observation is discarded.

1. **P2 — Historical verification records were removed.** Seventh round,
   item 3. Earlier edits to the Status And Outcome and sixth-review preamble
   dropped the Milestone 11 gate record, permission-probe explanation and
   verified-items list. Missing provenance makes it harder to tell what was
   actually tested. **A (recommended):** compare the retained history with the
   original commits, restore only missing evidence, and record already-restored
   passages. **B:** replace the history with a short outcome summary. A retains
   useful evidence without rewriting completed work or inventing new checks;
   a new history linter is unnecessary for this documentation issue.
2. **P3 — A completed delivery task dropped the push requirement.** Seventh
   round, item 4. A commit-and-push task was shortened and checked before its
   push, making the record overstate delivery. **A (recommended):** locate the
   historical task and restore accurate wording and delivery evidence while
   retaining the original record. **B:** add a separate delivery table for
   every milestone. A is sufficient because the repo-wide rule already
   requires commit followed by push and post-push review.
3. **P3 — Diagnostic precedence changed without a contract or test.** Seventh
   round, item 5. A denied module in an earlier glob can now outrank a later
   glob's zero-match error, changing which configuration problem users see.
   **A (recommended):** document ordered per-glob validation and add mixed-error
   regression tests. **B:** restore a separate validation pass for the old
   precedence. A preserves the intended single-validation design and makes
   its observable error ordering deliberate.
4. **P3 — The diagnostic placeholder calls files roots.** Seventh round,
   item 6. `not searched` can include vanished files as well as directories;
   the documented `<repository-relative roots>` placeholder misleads users.
   **A (recommended):** use paths consistently in configuration and build docs,
   referencing existing directory/file diagnostic tests. **B:** split files
   and directories into new runtime diagnostic categories. A corrects the
   documentation without a needless CLI compatibility change.
5. **P3 — Two explanations were lost from the configuration contract.**
   Seventh round, item 7. The contract lost why an explicit `dist/entries/**`
   root remains discoverable and why each glob must be validated, making
   future changes more likely to reintroduce silent omissions.
   **A (recommended):** retain or restore both explanations beside the rules,
   cross-checking existing glob-root and zero-match tests. **B:** duplicate
   that guidance in every consumer guide. A keeps the rationale at its owner
   without multiplying potentially inconsistent copies.
6. **P3 — Discovery documentation has inconsistent wrapping.** Seventh round,
   item 8, widened by eighth round, item 1. Ragged paragraphs and the two
   unwrapped additions make contract changes harder to scan and review.
   **A (recommended):** reflow the affected configuration and build paragraphs
   consistently and check Markdown formatting. **B:** reformat all repository
   prose. A addresses the touched contracts without burying future behavioral
   review in unrelated formatting churn.
7. **P3 — The filesystem mutation helper fires on every listing.** Eighth
   round, item 2; `tests/entry_discovery_errors.test.ts`'s
   `mutateAfterListing`. A future second discovery pass would repeat a
   one-time delete/replacement and fail for fixture reasons.
   **A (recommended):** make the hook one-shot and test a second listing/pass.
   **B:** forbid repeated discovery in callers. A models the intended race
   faithfully and protects future test reuse without changing production code.
8. **P3 — Entry-layout contracts both allow and prohibit nested sources.**
   Latest post-CI review, item 3;
   `docs/protocol/mokly-configuration.md:166` and
   `docs/protocol/mokly-source-protection.md:26`. Runtime and
   `tests/entry_discovery.test.ts:251` support entries below `mockupsDir`, but
   contradictory prose can cause users to reject supported layouts.
   **A (recommended):** reconcile both contracts with supported nesting,
   source denial and output collision protection; cite existing boundary
   tests. **B:** prohibit nesting in runtime, breaking supported layouts.
   A documentation correction is enough; there is no need to change the
   discovery or source-protection architecture for this finding.

## Milestones

### Milestone 1: Align contracts and preserve review history (completed)

Define the diagnostics and supported layout precisely before changing any
tests or implementation. This milestone is documentation only.

- [x] Audit findings 1 and 2 against Git history, restoring any missing
      verification/push evidence and recording what has already been restored.
      Retain the historical milestones and original review observations.
- [x] Document and cross-check error precedence for finding 3, including
      overlapping globs, vanished candidates and zero-match failures. Describe
      shared root projection before ordered per-glob walks separately: a root
      projection failure can precede an earlier glob's module validation.
- [x] Resolve the eighth-round residual note: existence checks precede the
      baseline-cache denial, so a concurrently vanished cache candidate is
      dropped. Document that race while retaining denial of surviving private
      paths; do not broaden access to `.mokly-cache/`.
- [x] Align the configuration contract, build README and pipeline descriptions
      for findings 4, 5 and 6; retain the explicit-root and per-glob rationale.
- [x] Reconcile nested source layouts for finding 8 in both contracts, keeping
      inventories, alias checks, generated-route collisions and public source
      denials intact. Link to existing discovery and source-protection tests.
- [x] Validate changed Markdown and links and inspect the documentation diff.

### Milestone 2: Pin discovery diagnostics and race fixtures (completed)

Use focused tests to protect the documented behavior and make the race fixture
faithful; avoid unrelated discovery or watcher refactoring.

- [x] Add regression tests for finding 3's earlier-denial/later-empty ordering,
      reversed glob order and overlapping matches. Cover the vanished-cache
      residual note and surviving forbidden candidates at the appropriate
      boundary without weakening source protection. Distinguish direct
      discovery calls from normal configuration, which rejects private cache
      glob roots before discovery; pin shared-root projection precedence too.
- [x] Add a failing second-listing regression for finding 7 before making
      `mutateAfterListing` one-shot; retain real delete and replacement races.
      Verify another discovery pass and overlapping walks do not repeat the
      mutation, and that surviving entries still contribute to each glob.
- [x] Run the discovery/error, glob-root/watch-boundary, source-denial,
      output-safety and export-safety suites. Confirm the existing nested
      `mockups/src/entries` discovery/build case still passes.
- [x] Smoke watched Serve with a co-located entry create/edit/delete and
      confirm the catalogue rebuilds without silently dropping readable input.
      Retain one unchanged entry so deletion does not intentionally empty the
      glob; record commands and outcomes in the delivery evidence.

Implementation evidence:

- The Git audit compared `8b9a30f`, `01b31dd`, `0ddfa2a`, `da3cbe0`, and
  `daa06c9`. The current original plan already retained Milestone 11's gate
  counts, permission-probe explanation, and the sixth-review verified-items
  preamble. Its Milestone 11 and 12 delivery tasks now state the completed
  commit-and-push fact instead of the stale future-tense handoff. The original
  review observations remain unchanged.
- The second-listing regression first failed alone with one failed test and the
  false diagnostic `not searched: entries`. After `mutateAfterListing` became
  one-shot, the discovery error and ordering suites passed all 25 tests. The
  new ordering coverage pins both glob orders, eager shared-root projection,
  accepted and vanished overlap handling, and the direct/config cache boundary.
- Independent source-denial, output-safety, and export-safety verification
  passed all 17 tests without skips. The broader discovery, glob-root,
  watch-boundary, source-denial, output-safety, and export-safety command passed
  all 84 tests without skips; it includes the nested
  `mockups/src/entries` discovery and build cases. The complete gate is recorded
  separately by its final checklist item.
- Watched Serve smoke used
  `node --import tsx .context/discovery-followup-smoke.ts`. Creating, editing,
  and deleting `src/card/card.mockup.tsx` added, updated, and removed
  `smoke-card` at content revisions 6, 9, and 14. The unchanged `home` and
  `details` entries remained throughout; shutdown was clean and emitted no
  diagnostic beyond the listening message.

Finding traceability:

| Finding               | Decision and evidence                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                     | Historical gate, probe, and reviewer-verification evidence was already restored and is retained.                                                                      |
| 2                     | Milestones 11 and 12 again record `cargo xtask check`, commit, and push as completed.                                                                                 |
| 3                     | Ordered per-glob diagnostics and eager shared-root projection are documented and covered in `entry_discovery_ordering.test.ts`.                                       |
| 4                     | Zero-match documentation consistently calls denied, vanished, and dropped items paths.                                                                                |
| 5                     | The explicit `dist/entries/**` rationale and per-glob omission protection remain in the configuration contract.                                                       |
| 6                     | The touched discovery prose is consistently wrapped and included in Markdown formatting validation.                                                                   |
| 7                     | The failing-first repeated/overlapping discovery regression proves the mutation hook is one-shot.                                                                     |
| 8                     | Configuration and source-protection contracts allow nested sources below `mockupsDir` while retaining inventory, alias, public-read, and generated-route protections. |
| Eighth-round residual | Config rejects cache-root globs; direct discovery drops a concurrently vanished cache candidate but denies a surviving one. Both paths have regression coverage.      |

### Milestone 3: Verify, deliver, and review the separate PR

Finish this follow-up on its own branch; published-release smoke remains
outside merge-blocking milestones.

- [x] Map each original deferred finding and the residual note to validation
      or a documented decision; update delivery docs. The supervising agent
      independently checks the delegated work and runs the final gate. Keep
      the plan in Active with an accurate awaiting-merge status until its own
      PR merges, then move its index link to Completed.
- [x] Run all relevant tests and `cargo xtask check` with a 100% pass rate;
      inspect the complete diff and mainline preservation before committing.
- [ ] After checks pass, run `git add -A`, commit with Conventional Commits
      and a title of at most 50 characters, and push the branch, including all
      authored new files.
- [ ] Only after the push, review the complete local diff against `origin/main`
      using [the implementation review prompt](../docs/implementation-review-prompt.md).
      Report every finding with severity, context, impact, lettered options
      and a recommendation; do not automatically fix review findings.

The supervising agent independently checked the delegated changes and ran the
complete `cargo xtask check`: 2,238 unit/integration tests, 686 Chromium tests,
10 Rust tests, and all five packed-consumer scenarios passed. There were no
failures, skips, or cancellations. Dependency audit, formatting, linting,
type checking, example validation, Rust formatting, and Clippy also passed.
The first gate attempt stopped on unformatted test additions; after formatting,
the complete gate passed. Relative Markdown links (104 targets), code fences,
whitespace, and preservation against `origin/main` were checked separately.
No production files or generated artifacts changed, and no files were deleted.

## Post-merge follow-up (non-blocking)

These tasks were already outside the original implementation's merge boundary.
They remain unimplemented and do not block PR #101 or this follow-up's merge.

- [ ] Write a separate component-library adoption protocol and implementation
      plan covering an explicit adoption helper in the attributed facade,
      package-version dependency evidence in Changes, provider composition in
      the consumer renderer, and package naming. Read the existing authoring,
      rendering and component-Changes contracts first; define the new contract
      before scheduling implementation. Installed-package adoption and a
      generator from library type declarations remain out of scope until that
      separate plan is agreed; keep the current manifest schema unchanged here.
- [ ] Smoke a consumer repository that uses a monorepo workspace package as
      an entry-glob root with the published release containing PR #101. Record
      the version, commands and outcomes after that release exists.
