# Check the read model once, where it enters

Status: Active. On branch `calummoore/rust-viewer-checks-plan`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says. The user approved all milestones and tasks on 2026-11-03. Implementation is in progress.

The core checks the read model with the Rust readers of `mokly-model` before
it writes it. The viewer checks the same JSON again with about 4,500 lines of
hand-written TypeScript. The two copies drift, so a schema or a title that
the core accepts can make a catalogue unreadable in every viewer. On
2026-11-01 the user chose option F of the investigation: run the Rust checks
in the viewer as JavaScript from wasm2js, after a measured trial.
`plans/follow-ups/viewer-checks-from-rust.md` recorded that choice.

The trial of 2026-11-02 showed a large cost. The as-is readers add about
1.23 MB gzip, and Chrome takes 26 s to read the large fixture's index. A slim
reader still adds about 350 KB gzip and reads four to six times slower. On
2026-11-03 the user chose option G of
[decision 1](./viewer-checks-from-rust/decisions.md#1-the-trial-shows-a-large-cost-for-option-f):
check the read model once, with the Rust readers, where it enters. In
workspace 463 the user then chose option B there: G, except that the core no
longer checks its own output before it writes it. Workspace 463 removes those
checks in `mokly-static`, `mokly-server`, and `mokly-publish`, and the viewer
shell guards in files that this plan does not change. The `mokly-model`
readers stay only as the upload check of a receiver, such as Mokly Cloud. The
viewer keeps the version gates and the delivery fences, and it trusts the
content. The decision record keeps every option and the trial
numbers.
[Decision 2](./viewer-checks-from-rust/rule-differences.md#2-the-core-and-the-viewer-apply-different-rules)
closed with that answer, and
[decision 3](./viewer-checks-from-rust/rule-differences.md#3-the-typescript-checks-that-stay-disagree-with-the-core)
holds its leftover.

This change states the new rules and gives the Rust readers a lenient mode
for a receiver. It removes the content checks from the viewer, and it keeps
the viewer's failure state for bad JSON. It aligns the TypeScript checks that
stay, under decision 3. The upload check of Mokly Cloud is work in the
`mokly-ai/mokly-cloud` repository, after this change merges. The trial
results are in `.context/viewer-checks-from-rust/trial-results.md`.
[design-calls.md](./viewer-checks-from-rust/design-calls.md) gives my design
calls.

Contract owners:

- [Embeddable viewer](../docs/protocol/mokly-viewer.md) and
  [viewer namespace and version gates](../docs/protocol/mokly-viewer-namespace.md).
- [Serialization](../docs/protocol/mokly-catalogue-serialization.md) and
  [upload validation](../docs/protocol/mokly-upload-validation.md).
- [Component props](../docs/protocol/mokly-component-props.md) and
  [entry props](../docs/protocol/mokly-entry-props.md).
- [Package boundary](../docs/architecture/package-boundary.md).
- The [viewer README](../packages/viewer/README.md) and the
  [`mokly-model` README](../crates/mokly-model/README.md).

Replaced ways:

- The viewer's content checks of the index, the details, the deployment
  file, the live descriptor, the render answer, and the removed page preview
  → the version gates and the delivery fence in the viewer, and the
  receiver's lenient Rust check. Consumers
  under `packages/viewer/src`: `catalogue/sources.ts`,
  `viewer/index_source.ts`, `standalone/data_source.ts`,
  `standalone/live_source.ts`, `standalone/live_render.ts`, and
  `review/page_preview.ts`. Also the root `scripts/large/delivery.ts`, and
  the tests, helpers, and browser specs that read fixtures. Moved in
  Milestone 3. Deleted in Milestone 6.
- The content matching of `catalogue/detail_fences.ts` → the delivery fence
  of design call 5. Consumers: `shell/data_requests.ts`,
  `shell/data_commit.ts`, and their tests. Moved in Milestone 3. Deleted in
  Milestone 6.

## Milestone 1: Documentation and protocol

Depends on: none

Completed on 2026-11-03.

- [x] `docs/protocol/mokly-viewer.md:44-45` and `:63-66`: the viewer checks
      the version gates and the delivery fence, and it trusts the content.
      Add the decision in force beside that rule: the receiver's upload check,
      not a check in the viewer, because of the trial's cost and the drift of
      two copies. Add no rule that the core checks its output before it
      writes it.
- [x] Merge the branch of workspace 463 before this milestone, because it
      edits the same protocol docs.
- [x] `docs/protocol/mokly-viewer.md`: bad JSON shows the failure state of
      design call 4.
- [x] `docs/protocol/mokly-catalogue-serialization.md:106-115`: the lenient
      rule applies to a receiver's check. The viewer reads the fields of its
      version and ignores the others.
- [x] `docs/protocol/mokly-viewer-namespace.md:88-90` and `:122`: move the
      rule about `usage` and `resourceEvidence` to the receiver's check. A
      malformed document shows the failure state.
- [x] `docs/protocol/mokly-upload-validation.md`: a receiver checks the
      index and every entry detail with the core's lenient readers before it
      completes an upload. A failed check is `upload-invalid-bundle`.
- [x] `docs/protocol/mokly-component-props.md:93-96`: the receiver's check,
      not the viewer, checks the recorded props of a document that Rust did
      not write.
- [x] `docs/architecture/package-boundary.md`, the viewer README, and
      `packages/viewer/docs/`: the viewer owns the version gates and the
      fence, not the checks of the content.
- [x] Remove the former viewer-only rejection statements from the other
      read-model docs under design call 9. Keep producer requirements.

Merge notes: `.context/viewer-checks-from-rust/docs-merge-justification.md`.

Documentation evidence: `.context/viewer-checks-from-rust/docs-preparation.md`.

## Milestone 2: Lenient Rust readers for a receiver

Depends on: 1

Completed on 2026-11-03.

- [x] Give the index and detail readers a lenient mode, under design call 1.
- [x] Decode each tagged union through a raw record, and remove the
      `deny_unknown_fields` attributes, under design call 2.
- [x] Move the privacy walk of `packages/viewer/src/catalogue/privacy.ts`
      into `mokly-model`, for the lenient mode.
- [x] Port each case of `packages/viewer/tests/reader_unknown_fields.test.ts`
      to a Rust test of the lenient mode.
- [x] Move each Rust test that expects `ReadError::Invalid` for an unknown
      field to the strict-mode error. The field stays rejected.
- [x] Describe the receiver API and the Git dependency of design call 3 in
      the `mokly-model` README.

Evidence: `.context/viewer-checks-from-rust/rust-implementation.md`.

## Milestone 3: The viewer trusts the content

Depends on: 1

Completed on 2026-11-03.

- [x] Make each reader check the version, then return a typed copy, under
      design call 6.
- [x] Keep the delivery fence of design call 5, and remove the content
      matching.
- [x] Remove each test of a removed check under the removal rule of the
      `testing` skill, with its proof. Keep the tests of the version gates
      and the fence.
- [x] Run the viewer tests and the browser specs.

Evidence: `.context/viewer-checks-from-rust/viewer-implementation.md` and the first remote gate reports.

## Milestone 4: The viewer's failure state for bad JSON

Tags: ui

Depends on: 3

Completed on 2026-11-03.

- [x] Add the error catcher of design call 4 around the embedded and the
      standalone shell. It renders the existing failure state of `@mokly/ui`.
- [x] Test that an index with a malformed entry shows the failure state with
      Retry and reports one `onError`.
- [x] Preserve host adapter cleanup errors when the catcher surrounds the
      shell. Keep each mounted frame's identity.
- [x] Catch only typed selection errors in the ready viewer. Let malformed
      catalogue errors reach the catalogue failure state.
- [x] Clarify that a document the shell cannot render shows the whole
      catalogue failure state, under design call 4.

Evidence: `.context/viewer-checks-from-rust/ui-implementation.md`.

## Milestone 5: The TypeScript checks that stay

Depends on: 1

Completed on 2026-11-03.

These TODOs follow option G of decision 3, which the user chose on
2026-11-03.

- [x] Write the shared cases for prop values and for the path, link, and
      fragment checks. Run them in the Rust tests and in the tests of
      `@mokly/viewer/data`.
- [x] Add a value check to `@mokly/viewer/data`. The wrapper and Serve's prop
      editor check only the props value, and the core checks each schema once.
- [x] Retain each prepared Rust schema validator and reuse it for invocation
      and live-edit value checks under design call 10.
- [x] Let the TypeScript schema check accept a schema prop named `__proto__`,
      `constructor`, or `prototype`. Both sides keep rejecting such a key in a
      props value.
- [x] Let TypeScript accept the core's fragment characters, and change
      `docs/protocol/mokly-navigation.md:82-83` to match.
- [x] Let the core accept an explicit instance id such as `con`, in
      `crates/mokly-model/src/usage_context.rs:54-63` and
      `crates/mokly-html/src/components.rs:53`.
- [x] Align the size limits of the TypeScript value check with
      `crates/mokly-model/src/limits.rs`.

Evidence: `.context/viewer-checks-from-rust/author-checks-implementation.md`.

## Milestone 6: Delete the dead checks

Depends on: 3, 4, 5

Completed on 2026-11-03.

- [x] Delete each viewer module that no consumer uses, under the dead-code
      test of the `git-commit` skill. Keep the `@mokly/viewer/data` exports
      `validateProps`, `isLinkPath`, and `isLogicalFragment`, because
      `@mokly/mokly` uses them to check author input. Save the searches under
      `.context/viewer-checks-from-rust/`.
- [x] Update the viewer README, the shell README, and the unused internal
      export baseline.
- [x] Delete `plans/follow-ups/viewer-checks-from-rust.md`. Update
      `plans/follow-ups/select-option-builder.md`, because the viewer no
      longer rejects a catalogue for its select options.

Evidence: `.context/viewer-checks-from-rust/cleanup-implementation.md`.

## Milestone 7: Initial verification, commit, and review

Depends on: 1, 2, 3, 4, 5, 6

Completed on 2026-11-03.

- [x] Measure the shell and first index read in Chrome on both fixtures.
- [x] Run the strict example build and all seven real dev smoke surfaces.
- [x] Run targeted checks and the complete gate.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete diff against `origin/main` with three fresh area
      reviewers. Run one independent check for each finding and report the
      final outcomes.

Evidence: `.context/reviews/calummoore/rust-viewer-checks-plan/findings.md`.

## Milestone 8: Apply the checked review outcomes

Depends on: 7

Completed on 2026-11-03.

- [x] Fix finding 1 with the shared presence-aware reader decoder. Preserve
      nullable data, unknown fields, and existing missing `comparisonUrl`
      acceptance.
- [x] Apply verified prerequisite finding 2 fix `f8860934`: admit all late
      generated files through the existing Inventory once.
- [x] Fix finding 3 by binding the private live render sender to its fixed
      endpoint on the captured origin.
- [x] Record finding 4's complete host-content ownership fix as a separate
      follow-up under the checked Rare fix rule. Keep its intended contract
      and mark the missing behavior in the docs.
- [x] Apply verified prerequisite finding 5 fix `271519b9`: correct the two
      stale Git README statements.
- [x] Obtain assertion-failure proof and passing targeted tests for each
      code fix. Repeat each new asynchronous test ten times.
- [x] Record the independent checks' new problems for re-review.
      Add no new rejection without the user's answer.

## Milestone 9: Final verification, review, and pull request

Depends on: 8

- [x] Run the complete gate on the fixed combined tree.
- [x] Commit with Conventional Commits and push the fixes.
- [ ] Re-review the full diff once with the `implementation-review` skill.
      Check each new finding, apply the fix rule once more, and record each
      deferred or open item as a follow-up. Stop after the permitted rounds.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description records each dated decision
      and design call, links to the plan before deletion, and lists the
      follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Mokly Cloud checks each upload with the lenient readers of
      `mokly-model` before it moves to a viewer release without content
      checks. Cloud pins `@mokly/viewer` 0.5.0 today, in
      `mokly-cloud/ts/app/package.json:22`.
- [ ] After that, upload a good and a bad catalogue to Cloud. Cloud rejects
      the bad one, and the embedded viewer reads the good one.
