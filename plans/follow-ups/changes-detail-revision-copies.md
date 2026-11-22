# First warm-start edit builds every detail

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from branch `calummoore/mokly-publish-path`: a
  problem that the options check of its design calls found outside the
  scope. Updated on 2026-11-21 from the branch
  `calummoore/mokly-edit-comparison-cost-bo07`, which timed the warm edits of
  the `mokly-cloud` catalogue. Updated on 2026-11-22 from the branch
  `calummoore/mokly-edit-background-render-olos`, which shares unchanged
  details, and again on the same day after that branch built and measured
  option H, which did not merge.
- **Location:** `crates/mokly-server/src/changes.rs:158` (`project`),
  `crates/mokly-server/src/changes_detail.rs:29` (`apply`),
  `crates/mokly-server/src/detail_publication.rs:38`
  (`RecentDetails::publish`), `crates/mokly-server/src/snapshot.rs:254`
  (`encode_index`), `crates/mokly-server/src/changes_execution.rs:162`
  (`ChangesPass::publish`) and line 191 (`install_ready`),
  `crates/mokly-server/src/publication.rs:205` (`SharedPublication::changes`),
  `crates/mokly-model/src/projection.rs:76` (`index`), and
  `crates/mokly-compare/src/projection_index.rs:23` (`apply`).
- **Reason:** The code lies outside the diffs of both branches that found it,
  and on 2026-11-21 the user asked for a separate later task. On 2026-11-22
  the performance orchestrator closed the pull request that built option H,
  because its memory cost was near the 2% limit and its pooled speed check
  missed its bar.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Detail:** one `EntryDetailV4` record of a catalogue entry, held behind
    an `Arc` in `Snapshot::details`.
  - **Classification:** one Changes pass of Serve after a source edit, which
    finds or prepares the base, compares every view, and publishes the result.
  - **Warm edit:** a source edit in a running Serve process after its first
    classification, when Serve keeps a base and view comparisons.
  - **Ready publication:** the last step of a classification, which projects
    the comparison result into a new index and new details and commits them
    as `ready`.
  - **Snapshot:** the published state of one Serve revision, `Snapshot` in
    `crates/mokly-server/src/snapshot.rs`, with the index, the details, and
    their encoded files.
- **Background:**
  - History of this item:
    - On 2026-11-19 its title was "Changes copies every detail to stamp a
      revision". It asked whether the revision stamp of `changes::project`
      copies every detail.
    - On 2026-11-21 a timing run measured the whole ready publication. The
      user asked to handle that phase in a separate later task. This item took
      in the phase, so that one item holds the whole investigation.
    - On 2026-11-21 the title, the root question, option A, the left-out
      line, the previous examples, the recommendation, and the action
      changed. Options B and C keep their text of 2026-11-19 and gain notes.
      Options D to G are new.
    - On 2026-11-22 the serial work cuts of branch
      `calummoore/mokly-edit-background-render-olos` applied options B and E
      and changed the typed revision rule, as the parts below say. This item
      then took in the cost of the first edit after a warm start, and its
      problem, recommendation, and action changed.
    - On 2026-11-22 the second pull request of that branch split the first
      edit (option A) and built option H. H did not merge. Option H below
      gives its measurements, and option I, new on that date, gives the cut of
      its memory.
  - Mokly Serve serves a mockup catalogue for development and watches its
    sources. After each source edit, it prepares a new head generation from
    the working tree.
  - Then a classification compares the head with the base: the merge base of
    `HEAD` and the configured review base. Serve publishes the result as the
    Changes state of the catalogue index and the details.
  - The `changes.classify` timing span covers one classification. It ends
    when the `ready` or `unavailable` state commits. No standard timing span
    covers the ready publication alone.
  - `ChangesPass::publish` calls `install_ready`, which checks the room of the
    comparison store. Then it runs `SharedPublication::changes` on a blocking
    task.
  - `SharedPublication::changes` takes the build lock and calls
    `changes::project` with the current snapshot. This runs on each Changes
    publication, on the path to the Changes result.
  - `changes::project` builds the next snapshot from a clone of the current
    one. Then it runs these parts in this order:
    - `projection::index` builds the whole index from the catalogue model and
      the view keys.
    - `projection_index::apply` adds the comparison result. The records and
      the detail ids of removed entries follow.
    - `changes_detail::apply` computes the inputs of each detail: the source
      detail, the workspace projection of the entry, and its Changes
      evidence. When they equal the inputs of the record of the previous
      Changes publication, it shares that record and its file, with no copy
      and no build. Otherwise it builds the detail. Until 2026-11-22 it
      cloned each detail, cleared its comparison fields, computed the usage
      workspaces of all details again, and put each detail in a new `Arc`.
    - Only a built or changed detail takes
      `Some(next.index.revision)`. Then `RecentDetails::publish` reuses the
      bytes of an equivalent earlier detail, or encodes the detail. Until
      2026-11-22 a loop stamped the revision on every detail.
    - `encode_index` encodes the index. Since 2026-11-22 the canonical
      encoder sorts the keys of each object while it writes, with no second
      value tree.
  - After `project`, the publication installs the comparison metadata files.
    Then it swaps the snapshot and sends one event.
  - The copy question of 2026-11-19 and the current code:
    - On 2026-11-19 this item said that the clone shares each detail `Arc`
      with the current snapshot, so `make_mut` copies every detail.
    - The current code runs `changes_detail::apply` before the stamp loop,
      and that function gives each detail a new `Arc`. By reading only, the
      stamp should find one owner and copy nothing.
    - So the copy premise of 2026-11-19 is unproved. The clone of each detail
      happens in `changes_detail::apply` instead. Nobody has timed the stamp
      alone.
    - Since 2026-11-22 an unchanged detail is shared, so this question is
      closed.
  - The `README.md` of `mokly-server` says that each response inserts the
    current revision into the stored bytes. A decision of 2026-11-22 of the
    performance orchestrator changed its second rule: a shared detail keeps
    the typed `revision` of the publication that built it, because every
    served response takes the current revision from `RevisionFile`. Until
    then, reuse never changed the typed `revision` that a phase stamps on its
    details.
  - The first edit after a warm start, measured by the performance
    orchestrator on 2026-11-22 in 12 Serve sessions on mokly-cloud, on `main`
    and with the cuts of that date: the first edit of each session had 366
    `detail.build` spans between the end of `graph.prepare` and the start of
    `index.build`, with a mean of 125 ms, in a range of 92 to 205 ms. Edits 2
    and 3 had no `detail.build` there and took 15 to 16 ms. The startup
    restores its state from the store, so the core probably holds no encoded
    details of the startup generation to share. Candidate fixes: encode or
    keep the details of the startup generation at idle after the first ready
    Changes, or reuse the stored bytes of the unchanged details.
  - The gate of the performance orchestrator on 2026-11-22 measured
    `changes.classify` per warm mokly-cloud edit at 181 ms on `main` and
    140 ms with the cuts of that date, which also include two cuts outside
    this phase.
  - Requirements that stay:
    - Each publication replaces the index and the details in one step and
      raises `revision` by one. Source:
      [Updates In Serve](../../docs/protocol/mokly-shell-delivery.md#updates-in-serve).
    - The index lists the `detailId` of each detail. A detail whose content
      does not change keeps its `detailId` and its bytes, apart from
      `revision`. Source: the same section.
    - The event stream writes one message for each publication. A failed
      candidate leaves the last published state in place. Source: the same
      section.
    - Serve publishes a terminal status only for the latest generation. It
      discards a result from a superseded generation. Source:
      [Changes in Serve](../../docs/protocol/mokly-changes.md#changes-in-serve).
    - A classification that reuses comparisons publishes the same bytes,
      counts, warnings, and diagnostics as a full comparison. Source:
      [View Comparison Reuse](../../docs/protocol/mokly-comparison-serving.md#view-comparison-reuse).
    - Each step that combines views or entries runs again over every view in
      each classification, with the current usage of both sides. Source:
      [Proven view reuse](../../docs/protocol/mokly-changes-serving.md#proven-view-reuse).
    - These steps include the review result with its projection onto the
      index and the details. Decision in force: Serve reuses single view
      comparisons only, not the final result of an entry or the catalogue.
    - On 2026-11-16 the user asked to keep improving the speed and the
      reliability of Changes. The same decision forbids any change that can
      exhaust a machine's memory.
  - Measurement setup, an investigation on 2026-11-21, not an acceptance
    result:
    - Mokly at `beb87a53a6c0cd4fb72b03fba404ca1318894ad8`, before PR #459,
      which merged as `793d0c77d`. PR #459 changed sidecar PostCSS
      preparation and render code, not the code of this phase.
    - The `mokly-ai/mokly-cloud` catalogue at
      `194fdb789b243ca649a592c6488e8d56b0a32be5`. It has 381 expanded
      records: 283 screens, 94 components, and 4 use cases. It has 1,508
      document views. The 167 entries of 2026-11-19 count authored entries.
    - Linux with four vCPUs, four sidecars, four comparison workers, and
      Node 24.22.1. The core was a release build. The npm packages were built
      from the same source.
    - A strict build of the catalogue with Changes and `--base HEAD` passed.
      It wrote 5,485 files.
    - Each sample started
      `mokly serve --config mokly.config.json --base HEAD --sidecars 4 --port 4289 --debug-timings`
      from the restored source. Then it made two one-line title edits at
      line 35 of `docs/mockups/src/screens/product/settings/slug-editor.tsx`.
    - The harness waited for each `ready` publication through the Serve
      events. It added no timeout, retry, or sleep.
    - In each warm edit, all 1,508 views took part: 1,464 reused and 44
      compared. Each edit published `ready` and served all 381 current
      details.
    - A temporary Rust probe outside the repository timed the parts. Mode
      `off` disables its hooks. Mode `coarse` times phases. Mode `detail`
      also times single calls.
    - The modes ran in interleaved rounds, with ten warm edits for each mode.
  - Results, as coarse means over ten warm edits, in milliseconds. A parent
    includes its children:
    - Classification: 384.040. The comparison: 271.878. Outside the
      comparison: 112.162.
    - The ready publication, from the call of `ChangesPass::publish` to its
      return: 55.623. The means of the five runs range from 42.0 to 64.4.
    - Inside it, `changes::project`: 54.443.
    - Inside `project`, the detail loop with the stamp took 11.115, and the
      index encoding took 10.162. About 33 ms of `project` lies outside these
      two parts.
    - In mode `detail`, `changes_detail::apply` took a mean of 17.535 over ten
      warm edits, with a range of 12.2 to 43.2. That is another mode, so do
      not subtract it from coarse values.
    - Other parts outside the comparison: the kept-base freshness check
      37.202, the pin of the selected base 6.207, and the final Git reference
      check 3.756.
  - Limits of the measurement:
    - In mode `off`, the comparison mean was 211.10 ms, with a range of 157 to
      333 ms. The coarse mean was 272.20 ms. Do not read a difference between
      modes as probe overhead or as a saving.
    - In mode `off`, a classification spent a mean of 96.1 ms outside the
      comparison. Mode `off` gives no split of that time.
    - Use coarse and off values to rank work. Use detail values only to name
      parts. Never add values of different modes, or a parent and its child.
    - Mode `off` is the probe binary with its hooks off, not a clean core.
    - The classification value is the probe's own interval. The standard
      `changes.classify` span also includes the probe's event output.
    - One machine, one catalogue, and one edit shape. No change was tried, so
      no saving was measured.
- **Problem:** The first edit after a warm start builds all 366 entry details
  of mokly-cloud, with a mean of 125 ms, because Serve holds no encoded detail
  of the startup generation to share. Later warm edits share their unchanged
  details since 2026-11-22. The split of 2026-11-22 gives the encodes as 37 to
  46 ms of that work, and option H, which removes them, costs memory near the
  2% limit. Until 2026-11-22 the problem was: each warm edit spends a mean of
  55.6 ms in the ready publication, almost all of it in `changes::project`,
  which built the whole index and every detail again.
- **Impact if no action:** The first edit after each warm start keeps about
  125 ms more on the path to published Changes than the later edits.
- **Root question:** How can Serve publish the ready Changes state sooner
  after a warm edit, with the same index, details, bytes, revision, and event?
  Until 2026-11-21 the root question was: how does a Changes publication give
  each detail its revision without a copy of every detail?
- **Options:**
  - **A.** Split first, with no product change. On current `main`, time each
    part of `changes::project`, the metadata installation, and the commit.
    Time the stamp alone, and check whether it copies a detail. Count the
    details that `RecentDetails::publish` reuses and encodes, and give the
    size of the encoded index. Run the `mokly-cloud` catalogue,
    `examples/basic`, and the default React variant of the
    [large fixture](../../tests/fixtures/large/README.md). Keep the probe and
    its results out of the repository, and add no test. Then record the split
    here, and recommend the option for the largest part. On 2026-11-19, A
    timed only the stamp loop, at effort Small. Since 2026-11-22, A splits
    the first edit after a warm start with one clock, before any code, as the
    performance orchestrator asked: the 366 `detail.build` spans and the work
    around them. Effort: Medium.
  - **B.** Copy and stamp only the details that change in this publication,
    and keep the shared `Arc` of the others, if the reuse rule allows it. It
    acts after the complete projection, so it keeps the projection rule. It
    helps only if A shows that the stamp copies details. Effort: Medium.
    Applied on 2026-11-22: an unchanged detail is shared with its typed
    revision, and only a built or changed detail takes the new revision.
  - **C.** Stamp the revision only at the encoding, and keep the typed
    details free of it, if every typed consumer can take the revision from
    the snapshot. It also acts after the complete projection. It helps only
    if A shows that the stamp costs time. Effort: Large.
  - **D.** Keep the projected parts of the last publication, and project again
    only the parts whose exact inputs changed. Cost: it skips part of the
    projection onto the index and the details, which each classification
    must run over every view. So it needs a user decision and a change of
    `docs/protocol/mokly-changes-serving.md` first. Each kept part also needs
    a complete input proof and an existing bound. A missed input publishes a
    stale detail. Effort: Large.
  - **E.** Make the complete projection cheaper, with the same output bytes.
    For example, remove the clone of each detail in `changes_detail::apply`,
    and encode the index with fewer copies. Each classification still
    projects every view. Cost: it helps only the parts that a split names.
    Effort: Medium. Applied on 2026-11-22: no clone of an unchanged detail,
    and an index encoder with no second value tree.
  - **F.** Start the projection parts that do not read the comparison result
    while the comparison runs, such as `projection::index`. Apply the
    comparison result after it ends. Each classification still runs every
    projection step. Cost: the snapshot can change in that time. The work
    must then start again from the current snapshot, as
    `SharedPublication::changes` already does after a replaced snapshot. It
    removes no work. Effort: Medium.
  - **G.** Add permanent timing spans for the parts of `changes::project`, and
    allow them in `crates/mokly-cli/src/serve_trace_stages.rs`. Every
    `--debug-timings` run then shows the split. Cost: more timing records for
    each classification. Stage names are diagnostic details under
    `docs/protocol/mokly-timings.md`. Effort: Small.
  - **H.** Give the first edit after a warm start details to share: encode or
    keep the details of the startup generation at idle after the first ready
    Changes, or reuse the stored bytes of the unchanged details. Each needs
    the same published bytes and a whole-tree memory peak within 2% of
    `main`. Cost: idle work or memory after each start. Effort: Medium.
    Built and measured on 2026-11-22, and not merged:
    - The build: after the first ready Changes, an idle step built the detail
      that the next rebuild builds for each unchanged entry, with the code of
      the rebuild, encoded it in chunks of 32 on idle workers, and kept it as
      a ready rebuild record. Each path kept two rebuild records, one for each
      usage shape, so five records in all. The plan of that work is kept at
      https://github.com/mokly-ai/mokly/blob/0910565bf3a7abac064b2bc7b04845e913ee1260/plans/serve-first-edit-and-style-cuts.md?plain=1.
    - The split of option A on mokly-cloud: the 366 encodes of the first edit
      took 37 to 46 ms. A rebuilt detail of an unchanged entry differs from
      its usage record only in `workspace`, which the rebuild leaves unset
      while an edited entry has pending usage. So no kept record had the
      shape of that rebuild.
    - Speed: the timed gate of the performance orchestrator, 4 rounds, gave
      the window from the end of `graph.prepare` to the start of
      `index.build` on the first edit as 100 ms with 366 `detail.build` spans
      on `main` and 67 ms with none. In a Serve session of the branch, every
      rebuild encoded no detail, against 375, 0, 13, 305, and 0 on `main`.
      The idle step made 377 encodes, 94 to 109 ms of wall time and 45 to
      54 ms of encode time, starting 8 to 9 ms after the first ready Changes.
    - Bytes: the strict build and Serve byte proofs of the branch were equal
      to `main`.
    - Memory on mokly-cloud, one cold session of 10 edits for each arm with a
      counting allocator in the core: the ready records held 8.9 MiB of
      typed details and 9.6 MiB of encoded bytes, 18.5 MiB, from the first
      ready Changes until the first edit. At the first edit the rebuild
      shared the encoded bytes, its own typed details replaced the typed
      copies, and the extra records then held about 1.4 MiB: the pending
      slot, 377 small records of 0.8 MiB, and small differences. The peak
      live heap was 542 MiB against 538 MiB. But the core RSS settled about
      37 MiB higher after the idle step and stayed higher for all 10 edits: a
      median of 995 MiB against 949 MiB. The item
      [core-rss-retained-free-pages.md](./core-rss-retained-free-pages.md)
      holds that retention.
    - Memory on `examples/basic`: 241 records, 8.6 MiB typed and 11.8 MiB
      encoded, until the first rebuild; the live heap peak rose at the first
      edit, 512 MiB against 486 MiB.
    - The pooled whole-tree memory checks passed: mokly-cloud +1.27% and
      `examples/basic` +1.97% over 8 cold pairs each, with W1 and C1 of the
      same pull request.
  - **I.** H, with no typed copy in a ready record. The step builds its record
    with the code of the rebuild, as H did, and checks that it is equivalent
    to the usage record of the same path with the workspace unset, through
    `equivalent_with` in `crates/mokly-server/src/detail_publication.rs`. If
    so, the slot keeps only the encoded bytes, a reference to that usage
    record, a marker for the unset workspace, and the `detailId` of the
    encoded bytes. The encoder sets that id to the digest of the canonical
    preimage, and a share gives the new detail the id of the record that it
    shares, so the slot must keep the id of its bytes. The rebuild compares
    its detail with the reference and the marker, so it needs no copy. If the
    check fails, the slot keeps the typed record, as H did. The bytes stay
    equal, because the kept bytes encode exactly the value that the rebuild
    compares. Saving: 8.9 MiB of live data on mokly-cloud and 8.6 MiB on
    `examples/basic` until the first edit, and the long-lived typed copies
    that the first rebuild frees from another thread. Cost: a new record
    form in `RecentDetails` and its use in `publish`, `find`, and `holds`,
    with tests for a share, a failed check, and the id. Effort: Medium.
- **Left out:**
  - Change nothing. It fails the goal of a shorter warm edit.
  - Publish `ready` before the projection ends, or publish the index and the
    details in two steps. Each publication replaces both in one step.
  - Keep the old bytes of a changed detail, or keep the old revision. That
    breaks the publication rules above.
  - The version of 2026-11-19 left nothing out.
- **Assumptions:**
  - The publication rules above stay. Source: the sections Updates In Serve
    and Changes in Serve. Every option keeps them.
  - The published bytes equal a complete projection of the same state.
    Source: the reuse rule of comparison serving. Every option keeps it.
  - Each classification projects the review result onto the index and the
    details over every view. Source: Proven view reuse. Every option except
    D keeps it, and D needs a user decision first.
  - No option adds a store, a bound, an error, or a gate. Source: the user
    decision of 2026-11-16. D must keep its parts within an existing bound.
  - One catalogue shows the cost. Source: the measurement of 2026-11-21. A
    adds `examples/basic` and the large React fixture.
- **Wider fix:** None, because this is a speed opportunity, not a class of
  defect. G keeps the parts of the phase visible in later timing runs.
- **Previous examples:** `head-graph-preparation-cost.md` asks for a split of
  another warm-edit phase before it chooses a fix. The version of 2026-11-19
  found none.
- **Related:**
  - [kept-base-freshness-edit-cost.md](./kept-base-freshness-edit-cost.md):
    the same measurement. It records the kept-base freshness check, the other
    deferred phase outside the comparison.
  - [serve-edit-background-pass-split.md](./serve-edit-background-pass-split.md):
    the pull request that built H also built W1 and C1. That item holds the
    measurements of all three of 2026-11-22 and the decision to close them.
    Until 2026-11-22 this line said that the next speed pull request ranks
    the fix of the first edit after a warm start with the safe CPU cuts of
    the pass.
  - [core-rss-retained-free-pages.md](./core-rss-retained-free-pages.md): the
    retained core RSS that decides whether H with I can come back.
- **Recommendation:** H with I, only if an allocator change removes the
  retained core RSS that the item
  [core-rss-retained-free-pages.md](./core-rss-retained-free-pages.md)
  describes. H is the only measured cut of the first edit on the critical
  path, and I removes its typed copies. Without the allocator change, the
  memory of H stays near the 2% limit. Until 2026-11-22 the recommendation
  was A, on the first edit after a warm start, and then H if the split shows
  that the detail builds are its largest part; before that it was A on every
  warm edit, and until 2026-11-21 it was A, then B if the measurement showed
  a cost.
- **Action:** fix after merge, apply H with I, because the performance
  orchestrator chose on 2026-11-22 that H comes back as its own small pull
  request only after an allocator change removes its retained RSS.
