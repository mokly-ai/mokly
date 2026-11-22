# Shorten the serial work after each Serve edit

Status: Active. On branch `calummoore/mokly-edit-background-render-olos`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says.

After each warm Serve edit, the background pass renders the changed views,
and then Serve publishes the usage of the pass, classifies Changes, and
publishes Changes. On mokly-cloud, the serial work from the last view of the
pass to published Changes takes a median of 159 ms, and the sidecars are idle
during it. So each cut there saves its full time. This change makes three cuts
there, with no change of a published byte, a warning, a diagnostic, or a
requirement:

- **B1.** The usage publication and the Changes publication rebuild only the
  entry details whose inputs changed, and they share the other details
  without a clone or a deep compare. The canonical index encoder writes its
  sorted keys without a second JSON value tree.
- **B2.** The head validation of a classification skips the document fetch
  and the document digest of a view whose validated facts are proven
  unchanged, including every input of its link checks and the views that it
  links to. The classification reuses the closure walks that the background
  pass of the same state made for the changed views, and these facts end with
  that pass.
- **B4.** The base pin of a Serve classification uses the merge base of the
  reference read of the same attempt, so Git resolves the base once.

The follow-up item
[serve-edit-background-pass-split.md](./follow-ups/serve-edit-background-pass-split.md)
holds the split, the measurements, and the other options. This plan does not
cover the CPU cuts inside the pass: they are the second pull request of this
workspace, after this one merges.

Contract owners:

- [On-demand Serve](../docs/protocol/mokly-on-demand.md) and its
  [background pass](../docs/protocol/mokly-on-demand-background.md).
- [Changes serving](../docs/protocol/mokly-changes-serving.md) and the
  [base preparation](../docs/protocol/mokly-base-preparation.md).
- The [mokly-server README](../crates/mokly-server/README.md), the
  [mokly-compare README](../crates/mokly-compare/README.md), the
  [mokly-graph README](../crates/mokly-graph/README.md), and the
  [mokly-model README](../crates/mokly-model/README.md).

## Decisions

- 2026-11-22, the performance orchestrator, item 1 of the split: split the
  serial work after the last view with the one-clock probe before any cut.
  Alternatives: stop; cut the pass first; overlap the comparisons with the
  pass (a protocol change). Reason: the sidecars are idle in that work, so
  each cut saves its full time with no protocol change.
- 2026-11-22, the performance orchestrator, item 2: build B1, B2, and B4 as
  one pull request from this workspace, and the safe CPU cuts of the pass as a
  second pull request after this one merges. Alternatives: stop; only B1, B2,
  and B4; only the pass cuts; also B3 and the parts that wait for other
  branches. Conditions:
  - B1: every published byte stays equal: the usage index, the Changes index,
    and every entry detail file. The differential test compares the raw bytes
    of each publication after a sequence of edits: an edit inside one screen,
    a shared component edit, an added and a removed entry, and a revert. It
    must fail if a changed detail is shared instead of rebuilt.
  - B2: an unchanged view may skip its fetch and digest only while every input
    of its link checks is proven unchanged, including the views that it links
    to. Red tests first: a view whose link target changes, is added, or is
    removed is checked again; the reuse of the pass's walks does not outlive
    its pass; the walk facts stay bounded by the changed views of one pass and
    are released with it. The proven-facts rules of PR #466 are the model.
  - B4: one Git reference read gives the same result and the same errors as
    today's two reads.
  - Push the source as soon as it is final, and send the SHA to the
    orchestrator, whose official gate measures it against `main` with the
    same edit, plus memory.
- 2026-11-22, the performance orchestrator: B3, a kept-base check by file
  metadata alone, stays out. It adds an unseen change class to the freshness
  rules, so it needs a protocol decision that is not taken for 15 to 18 ms.
- 2026-11-22, the performance orchestrator: merge `origin/main` once after
  workspaces 229 and 233 land in `crates/mokly-sidecar`, before the final SHA.

## Design

### B4: one Git reference read

- Today a Serve Changes attempt reads `HEAD` and the base ref with
  `rev-parse`, and their merge base, in `references_native`, which caches the
  merge base by the two commits. Then the classification pins the base again
  in `GitBaseLookup::pin`: it opens the repository, resolves the base ref, and
  runs `merge-base` with `HEAD`.
- With B4, the classification of an attempt takes the pinned base from the
  reference read of the same attempt: the same reference, the merge base that
  the read returned, and the opened repository. Only `open` still runs.
- The errors stay the same: a failed reference read fails the attempt before
  the classification, as today. A reference that moves between the read and
  the end of the classification is caught by the existing reference check
  after the classification, as today.
- The `review.base-commit` span then no longer appears in Serve, under the
  existing timing rule for a pinned commit.

### B1: publications that share unchanged details

- `changes_detail::apply` deep-clones all entry details on each Changes
  publication, and the publish loop deep-compares each detail with the
  previous one before it reuses the old file. The usage publication touches
  only the changed details, but it encodes the whole index again.
- With B1, a publication computes the inputs of each entry detail: the source
  detail, the workspace projection of the entry, and the Changes evidence of
  the entry. When the inputs equal those of the previous publication, the
  publication shares the previous detail and its file. Otherwise it rebuilds
  the detail as today. The equality of the inputs must cover every input, so
  that a changed detail is never shared.
- The canonical encoder sorts the keys of each object while it writes the
  object, instead of building a second sorted value tree. Its output stays
  byte-equal for every value, including keys outside the Basic Multilingual
  Plane, which sort by UTF-16 code units.

### B2: head validation without a fetch for proven views

- `Session::complete_head` validates every view: it fetches the checked
  document, replays or walks its closure, and computes its anchors. PR #466
  made the replay of a recorded read set prove the closure facts of an
  unchanged view, but the fetch, the document identity, and the anchors still
  run for every view.
- With B2, the validated view of a view keeps its anchors, its links, and its
  warnings next to its closure facts, under the same bounds and the same
  release rules as the facts of PR #466. A later classification reuses them
  without a fetch only after an ordered replay proves every input unchanged:
  the checked document by its document key, every read of the closure walk,
  and every input of the link checks, including the membership and the
  anchors of each view that it links to. The replay stops at the first changed
  input, and the view is then fetched and validated as today.
- Every ordered and global check and every comparison aggregate still runs
  over all views, as today.
- The background pass already walks the closure of each view that it renders.
  With B2, that walk records the same read set as a validation walk, and the
  classification of the same state uses it instead of a second walk. These
  facts belong to the pass of one state, stay bounded by its changed views,
  and end with the pass, also when a newer state replaces it.

### Design calls

- 2026-11-22, my call: B4 reuses the merge base that `references_native`
  caches, not a second cache. Reason: one cache keeps one source of truth for
  the commits of an attempt.
- 2026-11-22, my call: the three cuts are three milestones, B4 first, then
  B1, then B2. Reason: they change separate subsystems, and B2 is the largest
  and builds on the facts of PR #466.
- 2026-11-22, implementor's call, accepted by me: the classification keeps
  `Changes.pinned` empty and uses an `AttemptLookup` that pins the merge base
  of the attempt. Reason: a pinned base would open the repository before the
  `Reading` step, and an existing test requires the step first.
- 2026-11-22, implementor's call, accepted by me: the reference read runs
  `merge-base` with the base commit first, as the pin does. Reason: Git picks
  among equal merge bases by argument order, so the old order could change the
  base commit in a criss-cross history.
- 2026-11-22, implementor's call, accepted by me: `PinnedBase::resolved` lives
  in `mokly-compare`, so the Git error mapping of that crate has one copy.

## Milestone 1: Documentation and protocol

Depends on: none

The change keeps every requirement, so no protocol doc changes. The crate
README files change only where an entry point moves.

- [x] Confirm that B1, B2, and B4 change no requirement of the contract owners
      above, and record the result in this milestone. Result of 2026-11-22:
      no protocol doc changes. B1 keeps every published byte. B4 keeps the
      base as the merge base of `HEAD` and the base ref, and a pinned commit
      already emits no `review.base-commit` span under the timing rules. B2
      stays inside the complete content proof of
      [proven view reuse](../docs/protocol/mokly-changes-serving.md#proven-view-reuse):
      it reuses validated facts only after a replay of content identities, and
      it uses no watcher event, edited-file list, or object identity as a
      proof. B1 may compare pointers only as a shortcut to value equality.
- [x] Update the follow-up item
      `plans/follow-ups/serve-edit-background-pass-split.md` with the decision
      of 2026-11-22: B1, B2, and B4 in this branch, the pass cuts next, and B3,
      D, E, and the V8 code cache as open options with their reasons.

## Milestone 2: One Git reference read

Depends on: 1

- [x] Red test: a Serve classification resolves the base once, with the same
      pinned commit as today.
- [x] Red test: the errors of a failed reference read and of a moved
      reference stay the same.
- [x] Implement B4.
- [x] Run the targeted tests of the changed crates. Evidence:
      `.context/edit-background-render/m2-b4/`.

## Milestone 3: Publications that share unchanged details

Depends on: 1

- [ ] Red differential test: the raw bytes of the usage index, the Changes
      index, and every entry detail file equal those of today's code after a
      sequence of edits: an edit inside one screen, a shared component edit,
      an added and a removed entry, and a revert. The test fails when a changed
      detail is shared instead of rebuilt.
- [ ] Red test: the canonical encoder writes the same bytes as today for keys
      outside the Basic Multilingual Plane.
- [ ] Implement B1.
- [ ] Run the targeted tests of the changed crates.

## Milestone 4: Head validation without a fetch for proven views

Depends on: 1

- [ ] Red test: a view whose link target changes is validated again.
- [ ] Red test: a view whose link target is added or removed is validated
      again.
- [ ] Red test: the walk facts of a pass are not used by a classification of
      another state, and they are released with the pass.
- [ ] Red test: the walk facts of a pass stay bounded by its changed views.
- [ ] Red differential test: documents, usage, Changes, and diagnostics equal
      today's over the edit sequence of Milestone 3 and a failed render with
      its recovery.
- [ ] Implement B2.
- [ ] Run the targeted tests of the changed crates.

## Milestone 5: Verification, proofs, review, and pull request

Depends on: 2, 3, 4

- [ ] Run the repository suite `cargo xtask check --suite repository`.
- [ ] Merge `origin/main` once after workspaces 229 and 233 land, with the
      `git-merge` skill.
- [ ] Run the complete gate `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch. Send the SHA to
      the performance orchestrator.
- [ ] Run a strict byte proof with ready Changes on `mokly-cloud`,
      `examples/basic`, and the large HTML and large React fixtures of
      `scripts/large/`. Save the evidence under `.context/`.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds. Wait for CI with the
      `ci-wait.sh` script of the `finish-work` skill, and send the link and
      the SHA to the orchestrator. Do not merge it.

## Post-merge follow-up (non-blocking)

- [ ] The second pull request of this workspace, after this one merges: the
      per-rule style registry index with its fixed cap and its release at
      `dispose`, one encode of each restore request for all cold sidecars,
      and the native frame scan. The follow-up item
      `plans/follow-ups/serve-edit-background-pass-split.md` holds their
      projections.
