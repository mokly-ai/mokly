# Check the read model once, where it enters

Status: Active. On branch `calummoore/rust-viewer-checks-plan`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says. Decision 3 waits for the user, and Milestone 5 waits for its answer.

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
check the read model once, with the Rust readers, where it enters. The core
checks it when it writes. A receiver, such as Mokly Cloud, checks each
upload. The viewer keeps the version gates and the delivery fences, and it
trusts the content. The decision record keeps every option and the trial
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
  → the version gates and the delivery fence in the viewer, the core's
  checks when it writes, and the receiver's lenient Rust check. Consumers
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

- [ ] `docs/protocol/mokly-viewer.md:44-45` and `:63-66`: the viewer checks
      the version gates and the delivery fence, and it trusts the content.
      Add the decision in force beside that rule: one check where JSON
      enters, not a second check in the viewer, because of the trial's cost
      and the drift of two copies.
- [ ] `docs/protocol/mokly-viewer.md`: bad JSON shows the failure state of
      design call 4.
- [ ] `docs/protocol/mokly-catalogue-serialization.md:106-115`: the lenient
      rule applies to a receiver's check. The viewer reads the fields of its
      version and ignores the others.
- [ ] `docs/protocol/mokly-viewer-namespace.md:88-90` and `:122`: move the
      rule about `usage` and `resourceEvidence` to the receiver's check. A
      malformed document shows the failure state.
- [ ] `docs/protocol/mokly-upload-validation.md`: a receiver checks the
      index and every entry detail with the core's lenient readers before it
      completes an upload. A failed check is `upload-invalid-bundle`.
- [ ] `docs/protocol/mokly-component-props.md:93-96`: the receiver's check,
      not the viewer, checks the recorded props of a document that Rust did
      not write.
- [ ] `docs/architecture/package-boundary.md`, the viewer README, and
      `packages/viewer/docs/`: the viewer owns the version gates and the
      fence, not the checks of the content.

## Milestone 2: Lenient Rust readers for a receiver

Depends on: 1

- [ ] Give the index and detail readers a lenient mode, under design call 1.
- [ ] Decode each tagged union through a raw record, and remove the
      `deny_unknown_fields` attributes, under design call 2.
- [ ] Move the privacy walk of `packages/viewer/src/catalogue/privacy.ts`
      into `mokly-model`, for the lenient mode.
- [ ] Port each case of `packages/viewer/tests/reader_unknown_fields.test.ts`
      to a Rust test of the lenient mode.
- [ ] Move each Rust test that expects `ReadError::Invalid` for an unknown
      field to the strict-mode error. The field stays rejected.
- [ ] Describe the receiver API and the Git dependency of design call 3 in
      the `mokly-model` README.

## Milestone 3: The viewer trusts the content

Depends on: 1

- [ ] Make each reader check the version, then return a typed copy, under
      design call 6.
- [ ] Keep the delivery fence of design call 5, and remove the content
      matching.
- [ ] Remove each test of a removed check under the removal rule of the
      `testing` skill, with its proof. Keep the tests of the version gates
      and the fence.
- [ ] Run the viewer tests and the browser specs.

## Milestone 4: The viewer's failure state for bad JSON

Tags: ui

Depends on: 3

- [ ] Add the error catcher of design call 4 around the embedded and the
      standalone shell. It renders the existing failure state of `@mokly/ui`.
- [ ] Test that an index with a malformed entry shows the failure state with
      Retry and reports one `onError`.

## Milestone 5: The TypeScript checks that stay

Depends on: 1, and the answer to decision 3

These TODOs follow option G of decision 3, the recommendation.

- [ ] Write the shared cases for prop values and for the path, link, and
      fragment checks. Run them in the Rust tests and in the tests of
      `@mokly/viewer/data`.
- [ ] Add a value check to `@mokly/viewer/data`. The wrapper and Serve's prop
      editor check only the props value, and the core checks each schema once.
- [ ] Let the TypeScript schema check accept a schema prop named `__proto__`,
      `constructor`, or `prototype`. Both sides keep rejecting such a key in a
      props value.
- [ ] Let TypeScript accept the core's fragment characters, and change
      `docs/protocol/mokly-navigation.md:82-83` to match.
- [ ] Let the core accept an explicit instance id such as `con`, in
      `crates/mokly-model/src/usage_context.rs:54-63` and
      `crates/mokly-html/src/components.rs:53`.
- [ ] Align the size limits of the TypeScript value check with
      `crates/mokly-model/src/limits.rs`.

## Milestone 6: Delete the dead checks

Depends on: 3, 4, 5

- [ ] Delete each viewer module that no consumer uses, under the dead-code
      test of the `git-commit` skill. Save the searches under
      `.context/viewer-checks-from-rust/`.
- [ ] Update the viewer README, the shell README, and the unused internal
      export baseline.
- [ ] Delete `plans/follow-ups/viewer-checks-from-rust.md`. Update
      `plans/follow-ups/select-option-builder.md`, because the viewer no
      longer rejects a catalogue for its select options.

## Milestone 7: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Measure `shell.js` and the first index read in Chrome on the example
      and the large fixture. Save the numbers under
      `.context/viewer-checks-from-rust/`.
- [ ] Run the mockup check of `AGENTS.md`. Smoke-test Browse, Changes, a
      comparison, inspection, prop editing, a removed entry, and an embedded
      host through `npm run dev`.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Mokly Cloud checks each upload with the lenient readers of
      `mokly-model` before it moves to a viewer release without content
      checks. Cloud pins `@mokly/viewer` 0.5.0 today, in
      `mokly-cloud/ts/app/package.json:22`.
- [ ] After that, upload a good and a bad catalogue to Cloud. Cloud rejects
      the bad one, and the embedded viewer reads the good one.
