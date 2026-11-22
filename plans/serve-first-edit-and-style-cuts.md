# Shorten the first Serve edit and the style filter

Status: Active. On branch `calummoore/mokly-edit-background-render-olos`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says.

This is the second speed pull request of the workspace. It makes three cuts,
with no change of a published byte, a warning, a diagnostic, or a requirement:

- **H.** After the first ready Changes of a Serve session, an idle step fills
  the rebuild record of each entry detail with the detail that the next
  rebuild builds. So the first edit after a start shares its unchanged details
  instead of encoding all of them again.
- **W1.** When the watch observes a resource for the first time, the adopted
  watch record takes it too. So the first rebuild after a warm start reuses
  the record when its other inputs are equal.
- **C1.** The sidecar indexes its style registry by rule, under a fixed cap,
  instead of parsing the whole registry on each render.

The follow-up item
[serve-edit-background-pass-split.md](./follow-ups/serve-edit-background-pass-split.md)
holds the split of the background pass and the safe CPU cuts. The item
[changes-detail-revision-copies.md](./follow-ups/changes-detail-revision-copies.md)
holds the cost of the first edit.

Contract owners:

- [Updates In Serve](../docs/protocol/mokly-shell-delivery.md#updates-in-serve)
  and [Background Work And Replacement](../docs/protocol/mokly-on-demand.md#background-work-and-replacement).
- The [mokly-server README](../crates/mokly-server/README.md), the
  [mokly-cli README](../crates/mokly-cli/README.md), and the
  [@mokly/mokly README](../packages/mokly/README.md).

## Decisions

- 2026-11-22, the performance orchestrator: the second pull request is H, W1,
  and C1, in that order. Alternatives: W2, an incremental watch plan, and W4,
  an incremental observer update, which save about 33 ms once for each
  session, and change the watcher's folder set in `crates/mokly-watch`, where a
  defect means a missed rebuild; W3, equal resolver probes in the edit bundle
  and the startup bundle; and C2 and C3, about 7 to 16 ms together. Reason: H
  and W1 remove most of the cost of the first edit with low risk, and C1 is
  the largest safe CPU cut of each warm edit. W2, W4, C2, C3, and the one-probe
  resolution difference stay open in the split item.
- 2026-11-22, the performance orchestrator, conditions:
  - H: the idle work starts only after the first ready Changes, yields to any
    edit or cancellation, and never delays an edit. Measure its CPU time and
    the growth of the rebuild slot. Every byte stays equal.
  - W1: a test shows that, after a warm start, a resource that the background
    pass observes is in both the live plan and the adopted record, and that a
    later resource-only rebuild reuses the record. The adopted record never
    holds an input that its live plan does not watch.
  - C1: a fixed cap on the style registry index, with a bound test.
  - Any protocol text goes to the orchestrator before its code. The protocol
    check of 2026-11-22 found that none of the three cuts changes a
    requirement.
- 2026-11-22, the performance orchestrator: the pull request also records two
  flake occurrences of the CI of PR #472 in their items.

## Design

### H: rebuild records after the first ready Changes

- Measured on 2026-11-22 on mokly-cloud: the first edit after a warm start
  encodes 366 of its 381 details, in 37 to 46 ms; edits 2 and 3 encode none.
  Each rebuilt detail of an unchanged entry differs from the usage record of
  the startup only in `workspace`: the rebuild has no settled workspace,
  because the edited entry has pending usage. The rebuild record of the
  startup still holds pending usage.
- With H, after the first ready Changes of a session, one idle step builds the
  detail of each current path with the code of a rebuild: the projected
  pending detail with the ready usage of each view and no settled workspace.
  When no record of the path equals it, the step encodes it and keeps it as
  the ready rebuild record of the path. The records stay a reuse cache that
  `RecentDetails::publish` checks by value, so a primed record that does not
  equal a later detail is never used.
- Each path keeps two rebuild records: one whose views all have ready usage,
  and one with a pending view. Each rebuild writes the record of its own
  shape. So a first edit that moves every view, such as a shared stylesheet
  edit, still shares the pending records of the startup, and a narrow edit
  after a wide edit still shares the ready records.
- The step publishes nothing: no revision, no event, and no changed byte. After
  each chunk it installs its records into the current snapshot, under the
  build lock and the state lock, only when that snapshot is the one that it
  read or installed last, like a usage completion that changes no detail.
- The step runs in chunks on a background worker. It waits while a foreground
  request is active, and it holds no lock while it encodes. A rebuild candidate
  enters an activity lease when it starts, and the step stops on that lease, on
  a cancellation, and on shutdown. A publication without a rebuild, such as the
  Changes of a moved Git reference, pauses the step; it resumes from the newest
  snapshot after the next ready Changes. A rebuild ends the step, because each
  rebuild writes the records of the entries that it does not change.

### W1: the adopted watch record keeps observed resources

- Measured on 2026-11-22: after a warm start, the adopted watch record holds no
  resources, because the resource recordings of the process are empty after
  the restart. The background pass observes the two email logos, and the drain
  adds them to the live plan, so a write to them is caught. The record keeps
  its old inputs, so the first candidate builds the whole plan again, in 36 to
  41 ms.
- With W1, after a drain adds observed resources to the live plan and the
  observer update returns `Ok`, the drain keeps a copy of the newest record
  that holds those resources beside the adopted record, when the records are
  still the ones that the drain read. A `PlanRecord` method builds the copy
  outside the lock with the same `Plan::resources` call. A candidate reuses
  the record whose inputs equal its own. The records hold the adopted record
  and one copy at most. So no record holds an input that the observer does not
  watch, a candidate in the gap builds the full plan, as today, and the adopted
  record still serves a later edit whose new resource key has no recordings
  yet.
- On the measured slug-editor edit, the resolution inputs also differ, so W1
  saves nothing there. It saves the whole candidate, about 38 ms, on a first
  rebuild whose resolution inputs equal those of the startup, such as a
  resource write.

### C1: an indexed style registry

- Measured on 2026-11-22: `registryStyles` parses the whole style registry with
  PostCSS on each render, 9.3% of the render time. About 8 to 13 ms for each
  warm mokly-cloud edit.
- react-native-web writes a new registry text on each rule that it inserts, so
  an index keyed by the whole text may miss on many renders. A measurement
  comes first: on warm mokly-cloud edits, the share of renders whose registry
  text equals one that the same sidecar filtered before, and the time of the
  parse inside `registryStyles`.
- Measured on 2026-11-22 on three warm mokly-cloud sessions: of 2,049 filter
  calls on 16 sidecars, 2,033 (99%) filtered a registry text that the same
  sidecar had filtered before. The text stayed one 12,821-byte text with 8 or
  9 top-level nodes. The filter took a median of 1.88 ms and a mean of 2.8 ms,
  and its parse a median of 0.34 ms.
- With C1, each generation object owns an index for each registry text that it
  filters, so `dispose` and `shutdown` release it with the generation. The
  index holds the parsed tree and the analysis of its rules, so a call computes
  its needed rules without a parse. A memo keeps the output for each set of
  needed nodes; a miss prunes a clone of the parsed tree by today's algorithm.
  A fixed cap counts the texts and the memo entries. Today's filter stays as
  the fallback for a text that the index cannot read, and both paths share
  its rules, so the output of each filter stays byte-equal.

### Design calls

- 2026-11-22, my call after the options check: each path keeps two rebuild
  records, one for each usage shape, so five records in all. Reason: a later
  rebuild still shares the pending startup record for each entry whose views
  all moved, so one slot would evict a record that a wide edit needs.
  Alternatives: the rebuild slot only; the Changes status slot.
- 2026-11-22, my call after the options check: H runs until it completes once
  in a session; a publication without a rebuild pauses it, and a rebuild or a
  shutdown ends it. Reason: a moved Git reference publishes a newer snapshot
  without a rebuild, and each rebuild leaves the records that the next rebuild
  needs. Alternative: one run, which a moved reference would end for good.
- 2026-11-22, my call after the options check: H builds its records with the
  code of the rebuild, by a split of the usage copy of `reuse_usage` from its
  workspace step, and it installs after each chunk. Reasons: one function then
  builds both records, and a stopped step keeps the work of its finished
  chunks.
- 2026-11-22, implementor's call, accepted by me: a failed rebuild candidate
  also ends the step. Reason: a held lease that resumes the step after a
  failure costs more and helps only a rare case, whose next edit encodes as
  before this change.
- 2026-11-22, implementor's call, accepted by me: the step starts at the end
  of the ready Changes publication and runs beside the seed work that follows
  it. Reason: a wait for the seed work needs a signal from `ChangesPass`, and
  both are idle work that yields to edits.
- 2026-11-22, implementor's call, accepted by me: the step skips an entry with
  a view that is not ready. Reason: its rebuilt detail has a pending view, and
  the step writes only the ready shape.
- 2026-11-22, my call after the options check: W1 changes the records only
  after the observer update returns `Ok`, through a `PlanRecord` copy method.
  Reason: a candidate between the plan change and the attach would otherwise
  reuse a record whose resources the observer does not watch yet.
- 2026-11-22, the performance orchestrator, on the W1 report: the copy stays
  beside the adopted record (B), bounded to the adopted record and one copy,
  with a test of that bound, and the pull request gives the size of the copy
  on mokly-cloud. Alternatives: a replacement of the record, which loses the
  reuse that the #347 test
  `equal_plan_inputs_reuse_the_active_observer_and_a_queued_edit_still_rebuilds`
  covers; a set of resources beside the record. Reason: B keeps every reuse of
  today and meets the intent of the W1 condition.
- 2026-11-22, my call after the options check: C1 measures the hit rate of the
  registry text first, and the generation object owns the index. Reasons: the
  gain of an index keyed by the whole text depends on an unmeasured hit rate,
  and an index that the generation owns needs no release path of its own.
- 2026-11-22, implementor's call, accepted by me: an index holds one registry
  text, `REGISTRY_TEXT_LIMIT`, and 64 outputs for each text,
  `REGISTRY_OUTPUT_LIMIT`, and the least recently used entry leaves first.
  Reasons: each measured sidecar filtered one text, the React Native Web sheet
  of a generation only grows, and a warm mokly-cloud edit makes 44 filter
  calls.
- 2026-11-22, my call: the caps count entries, not bytes. Reason: an index
  holds about 23 times its text, 297 KiB on mokly-cloud, and each output is a
  part of its text, so the caps bound the index of a generation by its
  registry text, and the sidecar memory limit bounds the process.
- 2026-11-22, my call: `collectStyles` always filters through the index of
  the generation, and `registryStyles` stays the fallback for a text that the
  index cannot read. Reason: a branch for a caller without an index would run
  only in tests, and the tests of `collectStyles` then run the indexed path.
- 2026-11-22, implementor's call, accepted by me: no test reads the session to
  show that `dispose` drops the index. Reason: the index is a field of the
  generation that `restore` creates, nothing else refers to it, and the
  session code that drops a generation does not change. A test would read the
  private generation map or assert an incidental error.

## Milestone 1: Documentation and items

Depends on: none

- [x] Update `plans/follow-ups/serve-edit-background-pass-split.md`: the
      choice of 2026-11-22; C2 and C3 wait; W2 and W4 as open options with
      their split (plan build about 12 ms, attachment and re-attach 21 to
      25 ms, about 5,000 targets in the full pass) and the equality-test
      condition; and the one-probe resolution difference as an open question.
- [x] Record the two flake occurrences of the CI of PR #472 in
      `plans/follow-ups/site-docs-island-hydration-flake.md` and
      `plans/follow-ups/macos-serve-signal-test-cache-warning.md`.

## Milestone 2: H

Depends on: 1

- [x] Red test: after the first ready Changes and the idle step, the first
      edit encodes no detail of an unchanged entry, for a narrow edit and for
      an edit that moves every view. The byte oracles of PR #472 and the byte
      proofs of Milestone 5 keep the bytes equal.
- [x] Red test: the step does not start before the first ready Changes; it
      stops on a rebuild candidate, a cancellation, or a shutdown; a
      publication without a rebuild pauses it until the next ready Changes; and
      it installs nothing into a snapshot that it did not read or install.
- [x] Implement H. Update the `mokly-server` README. Evidence:
      `.context/edit-background-render/pr2-h/`.
- [x] Measure the CPU time of the step and the growth of the rebuild slot on
      mokly-cloud. Evidence under `.context/`. Evidence:
      `.context/edit-background-render/pr2-h/measure.txt`.

## Milestone 3: W1

Depends on: 1

- [x] Red test: after a warm start, a resource that the background pass
      observes is in both the live plan and the adopted record, and a later
      resource-only rebuild reuses the record.
- [x] Implement W1. Update the `mokly-cli` README if an entry point moves.
      No entry point moved. Evidence: `.context/edit-background-render/pr2-w1/`.
- [x] Bound test: the records hold the adopted record and one copy at most.
- [x] Measure the size of the copy on mokly-cloud. Evidence:
      `.context/edit-background-render/pr2-w1/copy-size.txt`.

## Milestone 4: C1

Depends on: 1

- [x] Measure on warm mokly-cloud edits the share of renders whose registry
      text repeats on the same sidecar, and the parse time of
      `registryStyles`. Evidence under `.context/`. Choose the index by it.
      Evidence: `.context/edit-background-render/pr2-c1/`.
- [x] Red test: the indexed filter and today's filter, which stays as the
      fallback, write the same bytes over a set of registries and fragments.
- [x] Bound test: the index never holds more entries than its cap, and
      `dispose` releases it. The release follows from the ownership test;
      see the design call of 2026-11-22.
- [x] Implement C1. Update the package README. The sidecar README holds the
      index; the package README does not describe the style filter.
      Evidence: `.context/edit-background-render/pr2-c1/`.

## Milestone 5: Verification, review, and pull request

Depends on: 2, 3, 4

- [ ] Run the targeted tests, the repository suite, and the strict byte proofs
      on mokly-cloud, `examples/basic`, and the large HTML and large React
      fixtures, with Serve stage proofs. Evidence under `.context/`.
- [ ] Commit, push, and send the SHA to the performance orchestrator.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill, with its fix rounds.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request, wait for CI with the `ci-wait.sh` script, and
      send the link and the SHA to the orchestrator. Do not merge it.
