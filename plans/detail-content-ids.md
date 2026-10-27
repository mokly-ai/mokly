# Detail Content Ids

Status: Active. On branch `conductor/dedup-1-detail-content-ids`, no pull
request yet. The plan closes when its PR merges. Decisions 1 to 4 are open,
and every milestone waits for them.

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
`deploymentId`. Three related changes have their own workspaces: "dedup 2"
compresses blob uploads, "dedup 3" keeps a component's usage list only in its
parent detail, and "dedup 4" writes a before snapshot only when it differs
from the after snapshot.

The index and the ownership marker still change with each publication, and
this plan keeps that. It adds no fence for documents, and it does not change
the code of Mokly Cloud. No screen or copy changes, so the plan has no mockup
milestone.

Contract owners:

- [Catalogue serialization](../docs/protocol/mokly-catalogue-serialization.md)
  and [format versions](../docs/protocol/mokly-format-versions.md).
- [Shell delivery](../docs/protocol/mokly-shell-delivery.md) and the
  [embeddable viewer](../docs/protocol/mokly-viewer.md).
- [Static build browser and identity](../docs/protocol/mokly-export-browser.md)
  and [static delivery](../docs/protocol/mokly-export-delivery.md).
- [Comparison generation and serving](../docs/protocol/mokly-comparison-serving.md).
- The [upgrade guide](../docs/guides/start/upgrade.md).

## Design

- `detailId` is 64 lowercase hex characters: the SHA-256 of canonical JSON.
  With decision 1 B, the input is a two-element array of the entry's index
  record and its detail. Each `detailId` in the input is 64 zeros, so the id
  does not depend on itself. A current detail's `revision` is 0 in the input,
  so Serve keeps an id across publications, and `build` and Serve agree.
- Every index record carries `detailId` in its shared entry fields. A current
  record names its detail under `mokly-viewer/entries/`. A removed record names
  the removed entry's detail in the comparison generation (decision 4).
- Every detail carries `detailId` and no `deploymentId`. A current entry's
  detail keeps `revision`. A removed entry's detail keeps `snapshotId` and
  loses `generation` (decision 4).

The shell checks a current entry's detail in this order:

1. A `revision` that differs from the index: request the index once more, as
   today.
2. A `detailId` that differs from the id of the index record: another
   deployment replaced the files. The standalone shell performs a full page
   load, and an embedded host receives one `onError`.
3. Another `identity`, kind, view list, or control order: the unavailable
   state, as today.

The revision check comes first, because in Serve a detail of a newer
publication has a new id. Step 2 still comes before step 3, so another
deployment wins over another identity. A removed entry's detail needs the
index identity and a removed record with its path, `snapshotId`, and
`detailId`. Otherwise it is unavailable, because generation files never
change. A held detail stays on a new index that lists its id, and for a
current entry also its revision.

The index keeps `deploymentId` in `build` and in Serve. In Serve it is the
process id: the event stream sends it, and the shell compares it on each
message, after a revision refetch, and on each publication refresh. It also
binds the live render capability and the publication guards of Serve. A build
stamps the hash of its files. A static shell reads that hash only when it
requests the index again, and only decision 2 B adds such a request.
`mokly publish` reads only `base` and `baseCommit` from the index, and Mokly
Cloud skips the field.

The generation writer stamps each removed detail's id into the detail and its
removed record. Then it names the generation with the hash of its files as
they are. Next, `finalize` stamps each current detail's id into the detail and
its record. Last, it computes `deploymentId` with only the index's own field
zeroed. No step depends on its own output.

Serve computes the id of each new or changed detail in each publication. It
writes the index in the same step, because the index lists the ids. An
unchanged detail keeps its id and its encoded bytes, and Serve still supplies
`revision` when it answers. A usage completion now also writes the index once
per publication. Milestone 5 measures that cost.

For the measured heading edit, the projected upload is 15 files with 2.75 MB,
88% less. The index and the marker are 2.68 MB of that, and "dedup 2" covers
them.

An old tab now accepts a detail that a new deployment kept, because its content
is the same. Decisions 1 and 2 set how an old tab still notices a new version.

Rejected designs: a file hash that the shell checks, because Serve writes
`revision` into the bytes. A separate map of ids, because the record field
follows `documentKey` and also serves removed records.

## Format Versions And Merge Order

Each reader accepts one version. The serialization contract requires a new
number for a removal, a required addition, or a changed meaning. This plan
adds a required `detailId` and removes `deploymentId` from the details.
Release 0.17.0, which the open PR #219 prepares, contains index v8 and detail
v2. After it, this plan needs index v9 and detail v3. Every other format keeps
its number.

"dedup 3" and "dedup 4" can also change these formats, and the four changes
can merge in any order. Decision 3 sets the rule. With option B, each format
takes one new number between two releases:

- The first change that merges after a release raises the number of each
  format that it changes.
- A later change in the same release window keeps a number that `main`
  already raised since the last release, and adds its shape to it.
- The `EntryDetailV3` type, the fixture names, the reader gates, and the
  format table change once per release. A later change keeps them when it
  resolves its conflicts.
- If 0.17.0 has not shipped when this plan merges, the index keeps 8.

The id covers every field, so the other changes need no change to the id rule.
They edit the same projections, generation writer, and Node identity helper.
The change that merges second keeps both rules there.

## Mokly Cloud

On `main` at `7bf81f0`, the receiver parses the upload envelope, the marker,
and review v6, but not the index. The branch
`conductor/adopt-mokly-without-reviewjson`, with the plan
`plans/mokly-catalogue-index-adoption.md`, adds an index v8 parser. It
requires version 8 exactly, reads only the Changes fields, and skips the
others. It never reads `deploymentId` or a detail. So this plan needs one
receiver change: the version gate and the fixtures move to the index number of
the release. The app embeds `MoklyViewer` and gets the new fences with the
matching `@mokly/viewer`. A Plan lists only the hashes that the project has not
stored, and a referenced file is never collected.

## Open Decisions

Asked on 2026-10-27. The message to the user gives the background.

1. What the detail id covers. Severity Medium, effort Large. A: the detail
   only, so an old tab can show an old title over new content. B: the entry's
   index record and its detail. C: B and the viewer files, so each viewer
   change uploads every detail again. D, proposed by the user on 2026-10-27:
   A, plus `mokly-viewer/deployment.json` with the `deploymentId`, outside the
   id's hash. A static shell fetches it with each detail request and before
   each generation request. Another id reloads the page. Recommended: D.
2. An old tab whose comparison generation is gone. Severity Medium, effort
   Medium. A: accept the unavailable state until the reader reloads. B: in a
   static build, a failed detail or generation request makes the shell request
   the index again, and another `deploymentId` gives a full page load or one
   `onError`. Recommended: B. Decision 1 D closes this decision.
3. Format numbers when the dedup changes merge in any order. Severity Medium,
   effort Small. A: each change raises the numbers on `main`, so a second
   detail change gives v4. B: one new number per format between two releases.
   Recommended: B.
4. Content ids for removed entries' details. Severity Low, effort Large. A:
   keep `generation`, so each removed detail uploads again when any snapshot
   changes. B: `detailId` replaces `generation`, and the generation name hashes
   its files as they are. Recommended: B.

## Milestone 1: Documentation and protocol

Write the requirements and the decisions in force for the code milestones.
Add the status line of the repository rules to each changed protocol page.

- [ ] Record the answers to decisions 1 to 4 with the date. Update the design
      and the TODOs below to the chosen options.
- [ ] `mokly-catalogue-serialization.md`: add a detail identity section with
      the id input and the decision in force. Reject a deployment id in each
      detail, because any edit changed every detail. Keep `deploymentId` as an
      index field, and name the new fields in the version paragraph.
- [ ] `mokly-shell-delivery.md`: the `detailId` fields, the current and
      removed detail fields, the fence order and its reason, held details,
      unchanged ids in Serve publications, the identity, the route table, and
      the fail-closed table. Split the page if it passes 250 lines.
- [ ] `mokly-export-browser.md`: the deployment identity with only the
      index's field zeroed, the generation name (decision 4), and the old-tab
      rule (decisions 1 and 2).
- [ ] `mokly-export-delivery.md`: the static navigation rule. A detail that
      keeps its id keeps its bytes and validators across deployments.
- [ ] `mokly-comparison-serving.md`: the removed detail fields and the old-tab
      rule. `mokly-viewer.md`: the embedded fences and `EntryDetailV3`.
- [ ] `mokly-format-versions.md`: the index and detail rows, the rejection
      rule, the Mokly Cloud sentence, and the rule of decision 3.
- [ ] Align the sentences in `mokly-upload.md`, `mokly-export.md`, and
      `mokly-comparison.md` that name the stamped details, the index row, or
      the detail type. Change nothing that stays true.
- [ ] Add an upgrade section to `docs/guides/start/upgrade.md`. Update
      `packages/viewer/docs/deployment/README.md` and
      `packages/viewer/docs/concepts/README.md`.
- [ ] Run `npm run format:check` and the Markdown link test.

## Milestone 2: Mokly Cloud handoff

- [ ] Send the Mokly Cloud workspace "Adopt Mokly without review.json" the
      index and detail numbers of the release, the Milestone 1 docs, and the
      one receiver change. Record the message here.

## Milestone 3: Content ids in every writer and reader

Each reader accepts one version, so the writers and the readers change in one
milestone.

- [ ] Model: add `detailId` to the shared entry fields. Rename `EntryDetailV2`
      to `EntryDetailV3` without `deploymentId` and `generation`. Raise the
      version constants under decision 3.
- [ ] Model: add one id function beside the canonical encoder for `build` and
      Serve. The readers require a 64-hex `detailId`. A current detail has
      `revision` and no `snapshotId`, and a removed detail has the opposite.
      The detail context compares `detailId` with the record.
- [ ] Static build: `finalize` and the generation writer follow the design.
      The removed details lose their generation input.
- [ ] Serve: the projector, the usage completion, and the Changes projection
      compute the ids, encode the index after the details, and keep the bytes
      of an unchanged detail. Keep each Rust file under 300 lines.
- [ ] Viewer: the readers of the new versions, the public `EntryDetailV3`
      type, the fence order in `detail_fences.ts`, and the held-detail rule in
      `data_commit.ts`.
- [ ] Run `cargo xtask generate-types`. Rename the protocol fixtures, fill
      them with real ids, and update the 14 files that name them.
- [ ] Rust tests for the id function, the readers, the detail context, the
      identity, the generation, Serve, and the HTTP snapshots, with these:
  - [ ] Finalize, change one detail, and finalize again. The other detail
        keeps its bytes and its id, and its record lists the same id.
  - [ ] A removed detail keeps its bytes when an unrelated snapshot changes.
  - [ ] A usage completion keeps the bytes and the id of an unchanged detail,
        and the new index lists the new id of the changed detail.
- [ ] Node tests: `tests/helpers/static_identity.ts` recomputes the ids, the
      generation name, and the deployment id. Update the static publication,
      Changes contents, and comparison tests.
- [ ] Node test: build two screens with a base commit, edit one, and build
      again. The other detail keeps identical bytes, the edited one changes,
      and each index lists the ids of its details.
- [ ] Node test: publish twice to the test exchange with one edit between. The
      second Plan does not list the unchanged detail as missing.
- [ ] Viewer tests: the readers, each fence step, the removed fence, and held
      details. Rename `catalogue_v8_fixture.ts`.
- [ ] Browser specs: keep `static_deployment.spec.ts`. In
      `static_comparison_deployment.spec.ts`, the next deployment changes the
      clicked entry's record but not its documents. An old tab accepts an
      unchanged entry without a reload.
- [ ] Update the READMEs of `crates/mokly-model`, `crates/mokly-static`,
      `crates/mokly-server`, and `packages/viewer/src/shell`.

## Milestone 4: Recovery after a replaced generation

Only for decision 2 B.

- [ ] In a static build with an index URL, a failed detail or generation
      request makes the shell request the index once more. Another
      `deploymentId` gives the replaced status. Otherwise the state stays
      unavailable. Keep `data_controller.ts` under 300 lines.
- [ ] Viewer tests: one index request per failure, the replaced status on
      another id, and no request in Serve or with an index object.
- [ ] Browser spec: after the host replaces an old tab's generation, opening
      an unchanged entry's comparison reloads the page and shows it.
- [ ] Remove the status lines of Milestone 1. With decision 2 A, do this at
      the end of Milestone 3.

## Milestone 5: Measurement and smoke tests

- [ ] Repeat the measurement in `.context/deployment-id-detail-ids/`. Expect
      about 15 new files and 2.75 MB. Add one line with the result.
- [ ] Measure the Serve completion publications on the large React fixture
      before and after with `--debug-timings`. Propose a decision if a
      publication becomes much slower.
- [ ] Run the mockup check of `AGENTS.md`. Smoke-test Serve and a static
      build: entries, a comparison, a live prop edit, and an old tab after a
      redeploy. Save a screenshot under `.context/deployment-id-detail-ids/`.

## Milestone 6: Verification, commit, review, and pull request

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Release the change as a minor version with a breaking-change note.
- [ ] Mokly Cloud pins that release and accepts its index number.
- [ ] Publish `examples/basic` twice to Mokly Cloud with one edit between.
      Confirm that the second upload holds only the changed files.
