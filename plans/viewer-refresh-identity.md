# Viewer refresh identity

Status: Active. On branch `calummoore/mokly-viewer-refresh-identity-q13s`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says.

In Serve, one source edit gives about five publications. Each publication
sends one server-sent event. On each event the viewer fetches the whole index
(1.2 MB on the mokly-cloud catalogue) and the route details, and adopts them
in one store commit. The adoption copies both documents with
`structuredClone`, projects every index record again, rebuilds every lookup,
builds the navigation sections twice, and renders the whole shell again. Each
mounted frame also gets a new usage object, so each frame restarts its probe
on each publication, also when its usage did not change. The measurements of
`main` on 2026-11-22 (mokly-cloud catalogue, 167 entries, 1,508 views,
4 vCPU, warm edits) gave about 320 ms of renderer main-thread work for each
warm edit. A traced profile put about 7 ms of each refresh in
`structuredClone`, 11 ms in React, and 6 ms in the navigation builders.

This change removes the copy of the JSON that the viewer fetched itself
(decision 1). It makes a refresh reuse each unchanged part, so that React and
the builders skip it and an unchanged frame keeps its probe (decision 2). The
final state after each edit stays the same as on `main`. This change does not
hold refreshes while frames load: that option waits for a separate user
approval after the measurements of this change. It changes no protocol page,
no package other than `@mokly/viewer`, and no Serve code. The Serve change of
the same work is a separate pull request.

Contract owners:

- [Shell delivery, updates in Serve](../docs/protocol/mokly-shell-delivery.md#updates-in-serve).
- [Shell fetch and fences](../docs/protocol/mokly-shell-fences.md).
- [Live evidence, browser adoption](../docs/protocol/mokly-live-evidence.md#browser-adoption).
- [Frame adapter](../docs/protocol/mokly-frame-adapter.md): the viewer
  updates a frame's usage when that usage changes.
- [Artifact compatibility, frame boundary](../docs/protocol/cloud/mokly-artifact-compatibility.md#frame-boundary):
  the public index and detail readers return copies.
- The [viewer README](../packages/viewer/README.md) and the
  [shell README](../packages/viewer/src/shell/README.md).

## Decisions

Cal approved both decisions on 2026-11-22, in the task message of this
change, and asked that the work not wait for another approval. The task
message gives the choice of each decision and one rejected alternative. The
other alternatives below come from the code and the task message. The
options check of the same day kept both choices and added options. Its
report is in `.context/viewer-refresh-identity/options-check-report.md`.

1. **The copy of fetched JSON.** Chosen: **B**. The internal reads skip
   `structuredClone` for an index or a detail that the viewer fetched itself.
   The public readers `readCatalogueIndex` and `readEntryDetail` keep their
   copy, so an object that a host passes is still copied.
   - Reason: `response.json()` returns an object that no other code holds, so
     the copy protects nothing. The copy costs about 7 ms of each refresh in
     the traced profile.
   - Rejected: **A**, keep the copy everywhere, because it costs time on each
     refresh. **C**, skip the copy also in the public readers, because a host
     object would then become viewer state. The artifact compatibility page
     requires the copy.
   - Added by the check: **D**, B with a type that only `fetchJson` makes,
     so that only fetched JSON can reach a gate without a copy. The design
     takes D as a design call inside B, because it keeps the user's choice
     and only adds a compile-time guard.
   - Consequence: a test fake that returns one shared body must return a
     fresh copy for each call, because the viewer no longer copies it.
2. **What a refresh rebuilds.** Chosen: **B**. A refresh reuses each
   unchanged index record, each unchanged detail, the derived lookups, the
   navigation sections, and each frame's usage object. The viewer's
   containers and builders memoize on object identity, so React skips the
   unchanged parts. A detail's `detailId` is a content id, so an equal id
   proves an equal detail. An index record has no id, so a structural compare
   of each record decides. The `@mokly/ui` package components stay unchanged.
   A test compares the incrementally adopted state with a full rebuild from
   the same index and details. Tests of the identity reuse come first.
   - Root question, as the check wrote it: how does a publication refresh
     do work only for the parts that changed, while the data, the rendered
     shell, and the frames all end equal to a full rebuild?
   - Reason: most records, details, and usage objects do not change in a
     publication. A rebuild of them costs React and builder time on each
     refresh, and a new usage object restarts the frame probe.
   - Rejected: **A**, rebuild everything on each publication, as `main`
     does. **C**, hold refreshes while frames load, which waits for a separate
     approval after the measurements of this change.
   - Added by the check: **D**, B with a value guard in the frame mount
     hook, so that a usage of equal content never restarts a probe. The
     check recommends D. The design takes D as a design call inside B,
     because it keeps the user's choice and only adds a guard. **E**, a
     store that each container reads through a selector, so that a
     container renders only when its slice changes. It changes the 23 files
     that read the store. **F**, the React Compiler in place of hand-written
     memos. It adds a dependency and a build step to a published package.
     **G**, a worker that parses and compares the index and posts only the
     changed records. It adds a worker and its fallback. E, F, and G are
     Large. They stay open for a later change if the measurements of B fall
     short.

## Design

Each item below is my design call of 2026-11-22, unless it names a decision.

- Decision 1 covers the index and the detail only. The live descriptor, the
  deployment file, the render response, and the removed page preview keep
  their copy. They are small, they are not on the measured path, and their
  copy tests stay.
- Each of the two readers gets a version gate that returns its input
  without a copy. The public reader calls the gate and copies. Only the
  paths that read the value of `fetchJson` use the gate without the copy:
  the URL branches of `loadIndexSource` and `loadDetailResult`, and
  `fetchStandaloneIndex`. An object source keeps the public reader.
  `fetchJson` returns its value as a branded `FetchedJson` type, and the
  gates without a copy accept only that type.
- A new index is adopted against the installed one in `withIndex`. Each
  current record, matched by its list and path, and each removed record,
  matched by its path and snapshot id, keeps the installed object when a
  deep compare of the two plain JSON values finds them equal. The `tree`
  follows the same rule, and a list whose records all stay keeps its array.
  The index object itself is new, because `revision` changes. A one-time
  probe on a 1.2 MB synthetic index measured the per-record compare at about
  a fifth of the cost of the copy that decision 1 removes:
  `.context/viewer-refresh-identity/bench/compare_cost.txt`.
- An accepted detail whose `detailId` equals the held detail of the same key
  keeps the held content and takes the new `revision`, because the content
  id covers every field except `revision`. A detail with a new `detailId`
  keeps the held usage object of each view whose usage is deep-equal, so a
  change of evidence alone does not restart the probe.
- `shellCatalogueModel` reuses a projected record when its index record and
  the detail fields that the projection reads, `views` and
  `resourceEvidence`, are the same objects as in the last projection. The
  detail object itself is new on each publication, because its `revision`
  changes.
- `createCatalogue` reuses the installed lookups when every projected record
  is the object that those lookups already hold, and the tree and the tree
  order are the installed objects. A reused lookup holds exactly the records
  that a full rebuild holds. A detail commit keeps its current behaviour: it
  replaces the public model and keeps the index lookups. Each publication
  of an edit changes the edited record, so this reuse applies mostly to
  publications that change no record.
- The navigation sections are built once for each catalogue. The disclosure
  reconcile and the store use the same sections. A rebuilt section tree
  keeps each subtree that is deep-equal to the installed one.
- Each memo cache is a `WeakMap` keyed by the object that it derives from,
  as `branchPoints` does, or state of one shell root. No module-level value
  holds a catalogue strongly, so independent shell roots stay apart and an
  unmounted catalogue leaves the heap.
- The state rebind keeps the installed route only when the rebound record
  is the same object. It keeps the disclosure and filter baseline objects
  when they are deep-equal. The shell context keeps its installed entry
  lists when they are equal.
- The navigation column memoizes its rows and its package element on the
  sections, the navigation state, and the context values that it reads. Its
  callbacks are stable and call the latest store actions. The row builders
  receive a narrow input type, so that a builder cannot read a field that
  the memo does not track. Other containers get the same memoization where
  an unchanged publication still renders them again. No memo keys on the
  workspace object of `use_workspace_data.ts`, because that object keeps its
  identity while its evidence changes in place.
- The frame mount hook updates usage only when the new usage differs by
  value from the session's usage. The reuse above keeps the object of
  unchanged usage, and the guard covers each other path that makes an equal
  object.
- The render capability stays new for each revision, because a render
  request carries the installed revision.
- The final-state guard has two levels. The snapshot and the shell state
  after each sequence of publications are deep-equal to a full rebuild from
  the same index and details. The rendered navigation column and stage are
  equal to a fresh render of the same final data, so a memo that misses an
  input fails a test.
- Implementation finding of the check, fixed here under the fix rule:
  `nav_scroll.ts` scrolls the current row into view for each new route
  object, and `main` makes a new route object on every publication. A
  publication can then scroll the rail, which the live evidence page
  forbids. The current-row effect keys on the routed entry's identity in
  place of the route object, and a regression test covers it. The test
  reproduced the scroll on `main`, also for a publication that restores a
  missing route, so the effect runs only for a new route installation.

Open question: does a usage update of equal content reset an active
highlight or the instance selection? The live evidence page requires that
both stay. When `main` resets either one, decision 2 also fixes that
defect, and the change adds its regression test. Answer of 2026-11-22: on
`main` the probe restart clears the active highlight in the frame until the
viewer draws it again. The selected instance stays. Detail reuse keeps the
usage object of an unchanged screen view, and the value guard removes each
other equal update. A React test holds the highlight through a publication
of a screen. On a component route, each publication makes new usage objects
of equal value, so there the value guard alone prevents the update. A
second React test publishes unchanged data on a component route, and it
fails without the value guard (review finding 41, 2026-11-22).

Decision 3, answered by Cal on 2026-11-22 through the parent orchestrator:
**the order of the index and detail requests.** Chosen: **A**, keep the
serial order. `loadRefresh` keeps requesting the route details after the
index arrives and parses.

- Reason: the parent orchestrator's bench of `main` (12 warm edits,
  Chrome's clock) puts the index request at 0 ms and its body end at 6 ms
  after the page's first event. The detail request starts at 22 ms and ends
  at 25 ms, after a 16 ms parse and copy that decision 1 shortens. So the
  detail itself costs about 3 ms, and a parallel fetch saves at most about
  4 ms. When a newer publication lands between the two requests, a
  parallel detail fails its fence and costs one more 1.2 MB index fetch.
- Rejected: **B**, load the route details of the installed index beside
  the index request in this change. **C**, the same in a later change.
  Both save at most about 4 ms and risk one more index fetch.
- Source: the options check of this plan raised the question.

## Milestone 1: Final-state tests

Depends on: none

Tests that pass on `main` and must keep passing. They fix the final state of
an edit before the code changes.

- [x] Add a test for each case: after the last publication of a sequence,
      the snapshot and the shell state are deep-equal to a full rebuild from
      the same index and details. Cover a document key change, a usage
      change, a Changes status and mark change, a removed record change, a
      dropped and a renamed routed entry, events during a fetch, and a failed
      fetch that a later event repairs.
- [x] Add a test that the frame documents after the last publication are the
      documents of a full rebuild, and that only a frame whose document key
      changed reloads.
- [x] Add a React test: after a sequence of publications, the rendered
      navigation column and stage equal a fresh render of the final index
      and details.
- [x] Run the new tests on `main` and record that they pass.

Evidence: `.context/viewer-refresh-identity/main-final-state.log`.

## Milestone 2: Fetched JSON without a copy

Depends on: 1

Decision 1.

- [x] Add the red tests: a fetched index and a fetched detail are the objects
      that `response.json()` returned, also through the standalone source.
      An object source and the public readers still return copies.
- [x] Make every test fake that returns one shared body return a fresh copy
      for each call. Check `sources.test.ts`, `standalone_transport.test.ts`,
      `live_render.test.ts`, and the other fakes of `response.json()`.
- [x] Add the version gates without a copy and the `FetchedJson` type, and
      use them on the fetch paths.
- [x] Update the readers line of the viewer README.

Evidence: `.context/viewer-refresh-identity/main-red.log`.

## Milestone 3: Refresh reuse

Depends on: 1

Decision 2, under the design above.

- [x] Add the red tests: a publication keeps each unchanged record, detail,
      usage object, projected record, lookup, section, and the route object,
      and replaces each changed one. The mounted frame of an unchanged view
      gets no usage update across a publication. A frame whose usage changed
      gets exactly one.
- [x] Answer the open question with a test. When `main` resets the
      highlight or the instance selection, keep the test as the regression
      test of the defect.
- [x] Add the regression test of the rail scroll: a publication that rebinds
      the routed entry does not scroll the current row into view.
- [x] Implement the reuse in the data adoption, the projection, the
      lookups, the sections, the state rebind, and the context.
- [x] Add the value guard of the frame mount hook, and key the current-row
      effect of `nav_scroll.ts` on the routed entry's identity.
- [x] Memoize the navigation column and the other containers that an
      unchanged publication renders again.
- [x] Update the shell README where it says that a publication rebuilds the
      lookups and the navigation sections.

Evidence: `.context/viewer-refresh-identity/main-red.log` and
`.context/viewer-refresh-identity/viewer-tests-1.log`.

## Milestone 4: Verification, commit, review, and pull request

Depends on: 2, 3

- [x] Run the targeted viewer tests. Run each new asynchronous test 10
      times. Run `cargo xtask check --suite repository`.
- [x] Smoke-test `npm run dev` with a live edit of an `examples/basic`
      entry: the view updates, the Changes list updates, and no view is
      stale.

Evidence: `.context/viewer-refresh-identity/ten-runs.txt`,
`.context/viewer-refresh-identity/repository-suite-1.log`,
`.context/viewer-refresh-identity/rust-tests-1.log`,
`.context/viewer-refresh-identity/rust-tests-lfs.log`,
`.context/viewer-refresh-identity/smoke/run.log`, and
`.context/viewer-refresh-identity/smoke/settled.json`.

- [x] Commit with Conventional Commits and push the branch. Send the SHA to
      the parent orchestrator.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.

Evidence: `.context/reviews/calummoore/mokly-viewer-refresh-identity-q13s/findings.md`
and `.context/viewer-refresh-identity/browser-evidence-2.log`.

- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request into `main`. Its description gives the decisions
      and the design calls of this plan with their dates, a permalink to this
      plan, and the follow-up items that the change adds. Wait for CI.
