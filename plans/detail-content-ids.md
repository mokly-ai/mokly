# Detail Content Ids

Status: Active. [PR #224](https://github.com/mokly-ai/mokly/pull/224) is open.
The plan closes when its PR merges. The user answered the decisions on
2026-10-27.

`build` stamps one `deploymentId` into the catalogue index and into every
current entry detail. The id is a SHA-256 over every output file, so any edit
gives every detail new bytes. `mokly publish` uploads by content address: the
receiver answers with the digests that it does not hold. So each publication
uploads every detail again. On 2026-10-27, one heading edit in
`examples/basic` at `a9dd1e81` gave 250 new digests with 23.5 MB. 235 of the
240 details differed only in `deploymentId`, with 20.7 MB. A removed entry's
detail in the comparison generation has the same problem with its
`generation` field. Mokly Cloud keeps a project's files between publications,
so a detail that keeps its bytes does not upload again. Evidence:
`.context/deployment-id-detail-ids/measurement.md`.

User decision (2026-10-27): option A of change "dedup 1" from the
investigation "Hash-Based Content Caching". That workspace holds the other
options and their evidence. Option A removes `deploymentId` from the details.
Each detail carries its own content id, `detailId`, and the index lists that
id for each entry. The shell compares the two ids where it compared
`deploymentId`. A small deployment file then lets an old tab notice a new
version. Three related changes have their own workspaces: "dedup 2" compresses
blob uploads, "dedup 3" keeps a component's usage list only in its parent
detail, and "dedup 4" writes a before snapshot only when it differs from the
after snapshot.

The index and the ownership marker still change with each publication, and
this plan keeps that. It adds no fence for documents, and it does not change
the code of Mokly Cloud. No screen or copy changes, so the plan has no mockup
milestone.

Contract owners:

- [Catalogue serialization](../docs/protocol/mokly-catalogue-serialization.md)
  and [format versions](../docs/protocol/mokly-format-versions.md).
- [Shell delivery](../docs/protocol/mokly-shell-delivery.md), the
  [embeddable viewer](../docs/protocol/mokly-viewer.md), and the
  [viewer namespace](../docs/protocol/mokly-viewer-namespace.md).
- [Static build browser and identity](../docs/protocol/mokly-export-browser.md)
  and [static delivery](../docs/protocol/mokly-export-delivery.md).
- [Comparison generation and serving](../docs/protocol/mokly-comparison-serving.md).
- The [upgrade guide](../docs/guides/start/upgrade.md).

## Decisions

The user answered on 2026-10-27, with the reasons of the chosen
recommendations. An old tab loaded the catalogue before the host installed a
new version.

1. How an old tab notices a new version: D, proposed by the user. Details get
   content-only ids, and a static build writes `mokly-viewer/deployment.json`
   with the `deploymentId`. Rejected: A, those ids alone, because an old tab
   can show an old record above new documents. B, an id over the record and the
   detail, and C, B and the viewer files, because they miss cases or upload
   more. Reason: D keeps today's reload in every case and saves the most.
2. An old tab whose comparison generation is gone: closed by decision 1 D,
   because the shell checks the deployment file before each generation
   request. Neither option applies.
3. Format numbers when the dedup changes merge in any order: B, one new number
   per format between two releases. Rejected: A, each change raises the
   numbers on `main`, because the merge order then sets the numbers and renames
   the types and fixtures again.
4. Removed entries' details: B. They carry `detailId` instead of `generation`,
   and the generation name hashes its files as they are. Rejected: A, keep
   `generation`, because each removed detail then uploads again with each
   publication and the shell keeps two checks.
5. Decision raised by Mokly Cloud, answered on 2026-10-28: B. An embedded
   viewer requests the deployment file only when it fetched the index from a
   URL. Rejected: A, accept the failed requests, because each navigation in a
   private publication made a useless request and logged a warning. C, a new
   `MoklyViewer` prop, because a host that passes an index object already
   supplies each new version itself.

## Design

- `detailId` is 64 lowercase hex characters: the SHA-256 of the detail's
  canonical JSON with `detailId` as 64 zeros and, on a current detail,
  `revision` as 0. So the id does not depend on itself, Serve keeps an id
  across publications, and `build` and Serve agree. Equal content gives an
  equal id in every build.
- Every index record carries `detailId` in its shared entry fields. A current
  record names its detail under `mokly-viewer/entries/`. A removed record names
  the removed entry's detail in the comparison generation.
- Every detail carries `detailId` and no `deploymentId`. A current entry's
  detail keeps `revision`. A removed entry's detail keeps `snapshotId` and
  loses `generation`.
- `build` writes `mokly-viewer/deployment.json` with `schemaVersion` 1 and the
  `deploymentId` of the index. The deployment identity excludes the file,
  because the file holds the id. The ownership marker lists it. Serve writes
  and answers no such file, because its event stream announces each version.

A viewer of a static catalogue, standalone or embedded, fetches the deployment
file with each detail request of a page change, at the same time. It fetches
it again before it opens a comparison or a removed entry. Another
`deploymentId` gives the replaced status: a full page load in the standalone
shell, one `onError` in an embedded host. A missing or unreadable file changes
nothing, so a broken file cannot start a reload loop.

The shell checks a current entry's detail in this order:

1. A `revision` that differs from the index: request the index once more, as
   today.
2. A `detailId` that differs from the id of the index record: another
   deployment replaced the files. This catches a version that the host
   installed between the deployment file request and the detail request.
3. Another `identity`, kind, view list, or control order: the unavailable
   state, as today.

The revision check comes first, because in Serve a detail of a newer
publication has a new id. A removed entry's detail needs the index identity
and a removed record with its path, `snapshotId`, and `detailId`. Otherwise it
is unavailable, because generation files never change. A held detail stays on
a new index that lists its id, and for a current entry also its revision.

The index keeps `deploymentId`. In Serve it is the process id that the event
stream sends and the shell compares, and it binds the live render capability
and the publication guards. In a static build it is the hash of the files,
which the shell compares with the deployment file. `mokly publish` and Mokly
Cloud do not read it.

In `build`, the generation writer stamps each removed detail's id into the
detail and its record, then names the generation with the hash of its files.
`finalize` stamps each current id into the detail and its record, computes
`deploymentId` with only the index's own field zeroed, and writes the
deployment file. No step depends on its own output.

Serve computes the id of each new or changed detail in each publication. It
writes the index in the same step, because the index lists the ids. An
unchanged detail keeps its id and its encoded bytes, and Serve still supplies
`revision` when it answers. A usage completion now also writes the index once
per publication. Milestone 5 measures that cost.

For the measured heading edit, the projected upload is 16 files with 2.75 MB,
88% less. The index and the marker are 2.68 MB of that.

Rejected designs: a file hash that the shell checks, because Serve writes
`revision` into the bytes, and a separate map of ids in the index.

## Format Versions And Merge Order

Each reader accepts one version. The serialization contract requires a new
number for a removal, a required addition, or a changed meaning. Release
0.17.0 shipped on 2026-10-29 from `main` at `5d00ca8a`. It holds index v8 and
entry detail v3 in the shape of #223, with `deploymentId` and `generation`.
This plan changes both formats, so it needs index v9, entry detail v4, and the
new deployment file v1. Every other format keeps its number.

Under decision 3, each format takes one new number between two releases. The
first change that merges after a release raises the number of each format that
it changes. A later change in the same release window keeps that number and
adds its shape to it. It also keeps the raised type name, fixture names, reader
gates, and format rows when it resolves its conflicts. If another change
raises the index or the entry detail after 0.17.0 and merges first, this plan
keeps that number and adds its shape.

The id covers every field, so "dedup 3" and "dedup 4" need no change to the id
rule. They edit the same projections, generation writer, and Node identity
helper. The change that merges second keeps both rules there.

## Mokly Cloud

On `main` at `7bf81f0`, the receiver does not parse the index. The branch
`conductor/adopt-mokly-without-reviewjson` and its plan
`plans/mokly-catalogue-index-adoption.md` add an index v8 parser. It requires
version 8, reads only the Changes fields, and never reads `deploymentId` or a
detail. So the receiver needs only its version gate and fixtures moved to the
release's index number. It checks only the index and the comparison paths, so
it should accept the deployment file. The app gets the new checks with the
matching `@mokly/viewer`.

## Milestone 1: Documentation and protocol

Write the requirements and the decisions in force for the code milestones.
Add the status line of the repository rules to each changed protocol page.

- [x] Record the answers to decisions 1 to 4 with the date. Update the design
      and the TODOs below to the chosen options.
- [x] `mokly-catalogue-serialization.md`: add a detail identity section with
      the id input and the decision in force. Reject a deployment id in each
      detail, because any edit changed every detail. Keep `deploymentId` as an
      index field, and name the new fields in the version paragraph.
- [x] `mokly-shell-delivery.md`: the `detailId` fields, the current and
      removed detail fields, the deployment file route and check, the fence
      order and its reason, held details, unchanged ids in Serve publications,
      the identity, and the fail-closed table. Split it if it passes 250 lines.
- [x] `mokly-export-browser.md`: the deployment identity without the
      deployment file and with only the index's field zeroed, the generation
      name, and the deployment file.
- [x] `mokly-export-delivery.md`: static navigation with the deployment file,
      and revalidation for it. An unchanged detail keeps its validators.
- [x] `mokly-comparison-serving.md`: the removed detail fields and the check
      before generation requests. `mokly-viewer.md`: the embedded checks and
      `EntryDetailV3`. `mokly-viewer-namespace.md`: the new public path.
- [x] `mokly-format-versions.md`: the index, detail, and deployment file rows,
      the rejection rule, the Mokly Cloud sentence, and the rule of decision 3.
- [x] Align the sentences in `mokly-upload.md`, `mokly-export.md`, and
      `mokly-comparison.md` that name the stamped details, the output files, or
      the detail type. Change nothing that stays true.
- [x] Add an upgrade section to `docs/guides/start/upgrade.md`. Update
      `packages/viewer/docs/deployment/README.md` and
      `packages/viewer/docs/concepts/README.md`.
- [x] Run `npm run format:check` and the Markdown link test. Evidence:
      `.context/deployment-id-detail-ids/milestone-1-checks.log`. The remote
      tag check found no `v0.17.0`, so the index remains v8 and the detail is
      v3 for this release window.

## Milestone 2: Mokly Cloud handoff

- [x] Send the Mokly Cloud workspace "Adopt Mokly without review.json" the
      index and detail numbers of the release, the deployment file, and the
      Milestone 1 docs. Ask it to confirm that its receiver and hosting accept
      and serve the file. Record the message here.
  - Sent on 2026-10-27 to session `51e31014-7fd5-4552-bc6b-4ec555022572` of
    workspace `1b603283-dbbe-448f-a720-705e5b13bc8e`. The brief is
    `.context/deployment-id-detail-ids/cloud-handoff.md`. The answer comes to
    the user in that session.

## Milestone 3: The deployment file

The details still carry `deploymentId` here, so both checks run and the
product works at the end.

- [x] Model: the deployment file type and its version constant. Run
      `cargo xtask generate-types`.
- [x] Static build: write the file after the identity, and keep it out of the
      identity hash.
- [x] Viewer: the file reader and the check of the design in the data
      controller and the comparison and removed-entry loaders. Keep
      `data_controller.ts` under 300 lines.
- [x] Rust tests: the file bytes, its exclusion from the identity, and its
      ownership entry.
- [x] Viewer tests with a fake source: one file request per page change, one
      before a comparison, the replaced status on another id, nothing on a
      failed file, and no request in Serve.
- [x] Node tests: `tests/helpers/static_identity.ts` skips the file.
- [x] Browser spec: the host replaces an old tab's generation. Opening a
      comparison then reloads the page and shows it. Evidence:
      `.context/deployment-id-detail-ids/milestone-3-checks.log`.

## Milestone 4: Content ids in every writer and reader

Each reader accepts one version, so the writers and the readers change in one
milestone.

- [x] Model: add `detailId` to the shared entry fields. Rename `EntryDetailV2`
      to `EntryDetailV3` without `deploymentId` and `generation`. Raise the
      version constants under decision 3.
- [x] Model: add one id function beside the canonical encoder for `build` and
      Serve. The readers require a 64-hex `detailId`. A current detail has
      `revision` and no `snapshotId`, and a removed detail has the opposite.
      The detail context compares `detailId` with the record.
- [x] Static build: `finalize` and the generation writer follow the design.
      The removed details lose their generation input.
- [x] Serve: the projector, the usage completion, and the Changes projection
      compute the ids, encode the index after the details, and keep the bytes
      of an unchanged detail. Keep each Rust file under 300 lines.
- [x] Viewer: the readers of the new versions, the public `EntryDetailV3`
      type, the fence order in `detail_fences.ts`, and the held-detail rule in
      `data_commit.ts`.
- [x] Run `cargo xtask generate-types`. Rename the protocol fixtures, fill
      them with real ids, and update the 14 files that name them.
- [x] Rust tests for the id function, the readers, the detail context, the
      identity, the generation, Serve, and the HTTP snapshots, with these:
  - [x] Finalize, change one detail, and finalize again. The other detail
        keeps its bytes and its id, and its record lists the same id.
  - [x] A removed detail keeps its bytes when an unrelated snapshot changes.
  - [x] A usage completion keeps the bytes and the id of an unchanged detail,
        and the new index lists the new id of the changed detail.
- [x] Node tests: the identity helper recomputes the ids, the generation name,
      and the deployment id. Update the static publication, Changes contents,
      and comparison tests.
- [x] Node test: build two screens with a base commit, edit one, and build
      again. The other detail keeps identical bytes, the edited one changes,
      and each index lists the ids of its details.
- [x] Node test: publish twice to the test exchange with one edit between. The
      second Plan does not list the unchanged detail as missing.
- [x] Viewer tests: the readers, each fence step, the removed fence, and held
      details. Keep `catalogue_v8_fixture.ts` because the index remains v8
      when `v0.17.0` has no tag.
- [x] Browser specs: `static_deployment.spec.ts` and
      `static_comparison_deployment.spec.ts` pass unchanged. Their old tabs
      now reload through the deployment file.
- [x] Update the READMEs of `crates/mokly-model`, `crates/mokly-static`,
      `crates/mokly-server`, and `packages/viewer/src/shell`.
- [x] Remove the status lines that Milestone 1 added.
      Evidence: `.context/deployment-id-detail-ids/milestone-4-checks.log`.

## Milestone 5: Measurement and smoke tests

- [x] Repeat the measurement in `.context/deployment-id-detail-ids/`. Expect
      about 16 new files and 2.75 MB. Add one line with the result.
      Review-fix rerun: 16 new digests and 2,775,366 bytes. Evidence:
      `.context/deployment-id-detail-ids/compare-a4-b4.txt`.
- [x] Measure the Serve completion publications on the large React fixture
      before and after with `--debug-timings`. Propose a decision if a
      publication becomes much slower. One completion publication and two
      index encodings took 89,235 ms before and 82,714 ms after. The post-fix
      completion `index.build` span was 243 ms. Evidence:
      `.context/deployment-id-detail-ids/serve-comparison.json`.
- [x] Run the mockup check of `AGENTS.md`. Smoke-test Serve and a static
      build: entries, a comparison, a live prop edit, and an old tab after a
      redeploy. Save a screenshot under `.context/deployment-id-detail-ids/`.
      Evidence: `.context/deployment-id-detail-ids/milestone-5-smoke.log`.

## Milestone 6: Verification, commit, review, and pull request

- [x] Run the targeted tests and the complete gate named in `AGENTS.md`. Evidence: `.context/deployment-id-detail-ids/milestone-6-checks.log`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Review 1 of `4d5bbff4` found eight findings, and its validity check
    confirmed all of them. `35ee08e0` fixed findings 1 to 5. The re-review of
    `35ee08e0` found five findings, all confirmed, and `35649380` fixed its
    findings 1 and 2. Reports: `.context/deployment-id-detail-ids/review/`.
  - Merged `origin/main` at `2dd2937f` (#221) without conflicts.
  - 6. Rust version-gate test still exempts detail v2. Severity Low, effort
       Small. Recommended: C, a table-driven gate test over all four readers.
  - 7. Browser test no longer covers its named case. Severity Low, effort
       Small. Recommended: E, an unreadable deployment file and a page-load
       tripwire.
  - 8. Serve end-to-end tests dropped detail pairing checks. Severity Low,
       effort Small. Recommended: D, check the pairing in the shared Serve
       readiness helpers.
  - 9. Re-review finding 3: an HTTP test lost its `id: 2` event-stream
       assertion. Severity Low, effort Small. Recommended: A, restore it.
  - 10. Re-review finding 4: eight `map_err` calls in production code.
        Severity Low, effort Large. Recommended: B, one detail id helper per
        crate.
  - 11. Re-review finding 5: a byte test still rewrites a generation name.
        Severity Low, effort Small. Recommended: A, compare the exact bytes.
  - 12. Decision raised by Mokly Cloud: a private publication answers the
        deployment file request with 401. Severity Low, effort Small.
        Recommended: B, an embedded viewer with an index object skips the
        check.
  - `packages/viewer/src/shell/data_store.ts`: a StrictMode mount replay calls
    a host's `detail` source twice. Separate branch.
- [x] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Milestone 7: Review answers, the CI failure, and the main merge

On 2026-10-28 the user answered the open review items through the
orchestrator session of workspace "Startup Performance Optimization". CI of
PR #224 failed in browser shard 1 at `viewer_frame_scope.spec.ts`, "same-origin
highlights retain saved variant scope", with "This instance is unavailable in
the current view." This branch caused it: a detail waited for the deployment
file before it installed, and the test highlights without a readiness signal.
The test passed 40 of 40 runs as it is, and failed 10 of 10 runs when the
deployment file answered 400 ms late. Evidence:
`.context/deployment-id-detail-ids/ci-flake-before.log` and
`ci-flake-delay.log`.

- [x] Record the answers: finding 6 C, 7 E, 8 D, 9 A, 10 B, and 11 A, and
      decision 12 B.
- [x] CI failure: install a detail that arrives without waiting for the
      deployment check, which still runs before a failure is reported. Add the
      failing controller test first. Make the browser test wait for an
      explicit readiness signal before it highlights. Record the pass counts.
      Evidence: `.context/deployment-id-detail-ids/ci-flake-delay-after.log`,
      `ci-flake-normal-after.log`, and `review/fix-2-checks.log`.
- [x] Finding 6, C: one table-driven version-gate test for the index,
      deployment file, detail, and live readers.
- [x] Finding 7, E: the step-first browser test answers the deployment file
      with 404, checks the loading stage and the alert again, and checks that
      the page load starts only after the held detail is released.
- [x] Finding 8, D: the shared Serve readiness helpers check that each served
      detail's `detailId` equals its index record. The Changes spec checks the
      removed entry.
- [x] Finding 9, A: restore the `id: 2` event-stream assertion.
- [x] Finding 10, B: one detail id helper in each crate, with no `map_err`.
- [x] Finding 11, A: compare the exact bytes in
      `tests/comparison_record_bytes.test.ts`.
- [x] Decision 12, B: the viewer, its tests, and the shell delivery, viewer,
      and viewer README docs.
- [x] After #223 merges, merge `origin/main` under the `git-merge` skill. Keep
      entry detail v3 and `EntryDetailV3` with both shapes, under decision 3.
      Evidence: `.context/deployment-id-detail-ids/merge-aab537bd-report.md`,
      `.context/deployment-id-detail-ids/merge-aab537bd-checks.log`, and
      `.context/deployment-id-detail-ids/measurement.md`.
- [x] Run the targeted tests and the complete gate, then commit and push.
      Remote CI wait is outside this stop boundary.
      Evidence: `.context/deployment-id-detail-ids/review/fix-2-checks.log`.

## Milestone 8: CI composition with the shared UI package

On 2026-10-29, CI combined merge `0c2d7661` with main `e4c6d2c8` from
PR #243. The combined viewer protocol page exceeded its 250-line cap.
Design call: move the unchanged API declarations to a linked protocol page.
This keeps every requirement and leaves room for the shared UI rules.

- [x] Reproduce the file-length failure on CI's automatic merge.
- [x] Split the viewer API declarations and preserve every declaration.
- [x] Check formatting, links, and file lengths on the branch and the
      automatic merge. Save evidence under
      `.context/deployment-id-detail-ids/merge-3ea78c0b-ci-cap-`.
- [x] Commit and push the documentation fix. The supervisor owns review.

After the push, wait for PR #224's checks under the user's merge task.
Evidence: `.context/deployment-id-detail-ids/merge-3ea78c0b-report.md`.

## Milestone 9: Format numbers after release 0.17.0

Release 0.17.0 shipped on 2026-10-29 with index v8 and entry detail v3, before
this plan merged. Under decision 3 B, this plan is the first change after that
release that changes the two formats. So it raises the index to 9 and the
entry detail to 4. The deployment file has not shipped, so it stays at 1.

Design calls, 2026-10-29:

- My call: the detail type becomes `EntryDetailV4`, and the fixtures become
  `catalogue-v9.json` and `entry-details-v4.json`. Each earlier raise renamed
  the versioned type and fixtures in the same way.
- My call: the upgrade guide gives the content id step as an upgrade to the
  release after 0.17.0, not as part of the 0.17.0 steps.

- [x] Merge `origin/main` at `5d00ca8a` under the `git-merge` skill.
- [x] Raise the index to 9 and the entry detail to 4 in the model, the
      readers, the generated types, the fixtures and their detail ids, the
      tests, and the snapshots. Evidence:
      `.context/deployment-id-detail-ids/raise-v9-report.txt`.
- [x] Update the protocol docs, the upgrade guide, the READMEs, and the viewer
      docs to index v9 and entry detail v4.
- [x] Turn the open items into follow-up items under `plans/follow-ups/`.
- [ ] Run the complete gate, push, and wait for CI.
- [ ] Give the pull request description the format numbers, each decision and
      design call with its date, and a permalink to this plan.
- [ ] Delete this plan in the last commit of the work.

## Post-merge follow-up (non-blocking)

- [ ] Release the change as a minor version with a breaking-change note.
- [ ] Mokly Cloud pins that release and accepts its index number.
- [ ] Publish `examples/basic` twice to Mokly Cloud with one edit between.
      Confirm that the second upload holds only the changed files.
