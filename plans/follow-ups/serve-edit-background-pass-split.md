# Shorten the work after each warm Serve edit

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the split of the background pass of warm Serve
  edits on branch `calummoore/mokly-edit-background-render-olos`, which the
  performance orchestrator requested.
- **Location:**
  - `crates/mokly-server/src/background.rs:91`: `UsagePass::fill_window`, the
    `serve.background` span, and its window at line 99.
  - `crates/mokly-server/src/work_background.rs`: `Workers::background_render`,
    the lookup, the batch admission, and the resumed render of one view.
  - `crates/mokly-cli/src/serve_watch.rs:119` (`WatchedInputs::candidate`),
    `crates/mokly-cli/src/serve_watch_plan.rs:104` (`PlanRecord::new`),
    `crates/mokly-watch/src/plan.rs:165` (`Plan::resources`), and
    `crates/mokly-watch/src/native.rs:172` (the native `replace`): the watch
    candidate of the first edit after a warm start, which W2 and W4 change.
  - `crates/mokly-sidecar/src/pool_affinity.rs:36` and `:58`: the generation
    rank that sends a render to an idle process that lacks its generation.
  - `crates/mokly-sidecar/src/pool_preparation.rs:150` (`Pool::prepare`),
    `:173` (`Pool::restore`), and `:222` (`Pool::prerequisite`), which send
    `restoreGeneration`, `cssModules`, `describe`, and `bindings` before the
    first render of a generation on a process.
  - `crates/mokly-sidecar/src/pool_releases.rs:70` (`record_release`) and
    `:109` (`clean_idle`): `record_release`, which holds the pool lock while
    `crates/mokly-sidecar/src/pool_recipes.rs:73` encodes a whole restore
    request to measure a released recipe, and `clean_idle`, which disposes the
    idle slots one at a time.
  - `crates/mokly-sidecar/src/codec.rs:62`: the request encoder.
  - `packages/mokly/src/sidecar/transport.ts:8`: the frame decoder.
  - `packages/mokly/src/sidecar/evaluate.ts:47`: the `new Function`
    evaluation of the bundle.
  - `packages/mokly/src/sidecar/styles.ts:150` and
    `packages/mokly/src/sidecar/registry-styles.ts:32`: the per-render parse of
    the whole style registry.
  - `crates/mokly-server/src/changes_execution.rs:22`: `changes.classify`, and
    `crates/mokly-cli/src/serve_base.rs:124`, where the kept-base check reads
    the dependency directories that the renders record.
  - `crates/mokly-server/src/publication.rs:155` (`completed_many`) and `:205`
    (`changes`): the usage publication through
    `crates/mokly-server/src/evidence.rs:42` (`complete`), and the Changes
    publication through `crates/mokly-server/src/changes.rs:158` (`project`)
    and `crates/mokly-server/src/changes_detail.rs:29` (`apply`).
  - `crates/mokly-compare/src/base_classification.rs:29` and
    `crates/mokly-compare/src/base_freshness.rs:132`: the base pin, the
    kept-base check, and the comparisons.
  - `docs/protocol/mokly-on-demand.md:76`: the rule that no base capture or
    comparison starts before the pass of its state ends.
- **Reason:** On 2026-11-22 the performance orchestrator chose to wait with
  C2, C3, W2, and W4 until it chooses them, after B1, B2, and B4 merged in
  #472 and after it measured and closed the second speed change of branch
  `calummoore/mokly-edit-background-render-olos`.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Background pass:** the Serve work after each edit that renders the views
    whose documents changed, the `serve.background` span.
  - **Holder:** the sidecar process that bundled the new head generation, so it
    holds that generation already.
  - **Cold sidecar:** an idle head process that holds only an older head
    generation. Its first render of the new generation needs a preparation.
  - **Preparation:** `restoreGeneration`, `cssModules`, `describe`, and
    `bindings` for a new generation on one cold sidecar.
  - **mokly-cloud:** the measurement catalogue of the performance
    orchestrator: 167 entries, 1,508 views, 4 vCPU, and 4 sidecars.
- **Background:**
  - The request of 2026-11-22: make a warm one-line edit on mokly-cloud reach
    published Changes at least 100 ms sooner, with the same published bytes,
    warnings, and diagnostics, and a whole-tree memory peak within 2% of
    `main`. The stop bar: no set of safe changes that projects 60 ms or more
    for each warm edit. A protocol change needs the approval of the
    orchestrator first.
  - The section "Measurements of 2026-11-22" below gives the method and the
    numbers. The baseline is `main` at
    `9bdb0569d3ac0214bf303c599854a70b20dc2b2c`, PR #467. Each number and each
    code fact of this Background and of that section is of that commit,
    before PR #468, PR #469, and the cuts B1, B2, and B4, except in a bullet
    that names another commit, pull request, or cut.
  - The second speed change of the branch, H, W1, and C1 of 2026-11-22, was
    built in commits `ea6724a03` (H), `f453c0440` (W1), `a9a09edf2` (C1), and
    `0910565bf` (the C1 index under a weak key), and reverted in `11f8e4ac4`.
    It never opened a pull request. Its code stays at
    https://github.com/mokly-ai/mokly/tree/0910565bf3a7abac064b2bc7b04845e913ee1260.
  - Each warm edit re-renders 44 views: 11 view paths in light and dark at
    two viewports. Each view makes one sidecar render.
  - The pass is CPU-bound. The core and the sidecars together use a median of
    1,298 ms of CPU while the views of the pass take a median of 380 ms. So 3.4
    of the 4 cores are busy on average, in a range of 3.2 to 3.6. Over 20 warm
    passes, the time to the last view is 23.6 ms plus 0.273 times the CPU of
    the pass. So each millisecond of CPU that leaves the pass saves about
    0.27 ms.
  - C1 did not confirm this fit. A probe in the sidecars timed the 44 filter
    calls of each warm edit at a mean of 2.8 ms each, about 100 to 120 ms of
    wall time inside the busy sidecars. But `serve.background` did not get
    shorter in the timed gate of `a9a09edf2` against `main` `a2ae56360`
    (+8 ms) or in the timed split of `0910565bf` against `main` `c699b35d3`
    (+4 ms). That figure is wall time, not a measured CPU saving.
  - All four sidecars render in each pass. The holder starts its first render
    at a median of 17 ms. Each of the three cold sidecars first spends a
    median of 200 ms on its preparation, so it starts its first render at a
    median of 209 ms. The preparation is about 45% of the sidecar time of a
    pass, and the 44 renders are the rest.
  - Each pass has three fragments that take over 100 ms. 90% of their time is
    the preparation on a cold sidecar. No fragment waits for a busy holder.
  - The window, the batch, the worker permits, the completion stage, and the
    Serve gate add almost no wait. A test with twice the views in flight
    changed `serve.background` by +5 ms, within noise, and raised the memory
    peak by about 8%.
  - Inside a preparation, `describe` takes a median of 134 ms. A CPU profile
    splits it into the evaluation of the bundle, its compile, the Babel parse
    of `orderedExports`, garbage collection, and the reply.
    `restoreGeneration` takes a median of 56 ms. Most of it is the encode
    in the core and `JSON.parse` in the sidecar of a 5.9 MB request.
  - React runs its development build in the sidecar. React work is about 70%
    of each render. Mokly's own work after the React render is most of the
    rest, about 28%. The parse of the whole style registry on each render is
    9.3% of the render time.
  - After the last view, the serial work takes a median of 159 ms in a calm
    session: 20 ms to publish the usage, 3 ms of Git references, and
    `changes.classify`. Inside it: 3 ms of base pin, 23 ms of kept-base
    check, 69 ms of comparisons, 7 ms of identity, metadata, and a Git check,
    and 29 ms of Changes publication. The sidecars are idle then.
  - PR #468, merged on 2026-11-22, caches the export names of
    `orderedExports` across generations. The orchestrator accepted it on
    2026-11-21 at -42 ms for each mokly-cloud edit. It is not in this
    baseline. It also lowers the preparation of each cold sidecar. Its Part B,
    a preparation `describe` without definitions, is the item
    [prepare-only-describe.md](./prepare-only-describe.md).
  - The gate of the performance orchestrator measured B1, B2, and B4 on
    2026-11-22 against `main` at `1a2534d03`, with release cores on 4 vCPU,
    over 6 rounds of 3 warm one-line mokly-cloud edits: edit to published
    Changes 1,898 to 1,811 ms, `changes.classify` 181 to 140 ms, and
    `serve.background` 437 to 413 ms. The whole-tree memory peak of cold
    10-edit sessions stayed equal, 3,110 to 3,109 MiB. A confirm check of the
    final code on 4 rounds measured `changes.classify` 190 to 152 ms.
- **Problem:** After B1, B2, and B4, each warm mokly-cloud edit still spends
  about 410 ms in the CPU-bound background pass, and the safe CPU cuts of the
  pass are not built. The goal of 100 ms is not reached: the gate measured
  -87 ms. The second speed change, H, W1, and C1, was measured on
  2026-11-22 and reverted, because its pooled untimed check missed its bar. Until 2026-11-22 the
  problem was: each warm edit spends about 400 ms in the CPU-bound background
  pass and about 160 ms in serial work after its last view; no single cut
  saves 60 ms, and the cuts without a protocol change reach about 75 ms only
  together.
- **Impact if no action:** Each warm edit on mokly-cloud keeps the work that
  C2 and C3 would remove: two of the three encodes of the 5.9 MB restore
  request, 13 to 17 ms each, and the byte loop of the frame decode, about
  7 ms for each 10.3 MB frame. No measurement shows how much of it the pass
  would gain, because C1 did not confirm the 0.27 ms fit. The first edit
  after a warm start keeps the watch candidate that W2 and W4 would shorten,
  up to about 33 ms. Until 2026-11-22 the impact was: a background pass of about 320 to 540 ms,
  median 400 ms, and about 150 to 180 ms of serial work after the last view,
  in the local runs of that date.
- **Root question:** How can a warm edit publish Changes at least 100 ms
  sooner, by removing CPU work and serial waits from the background pass and
  the work after it, with the same output and a whole-tree peak within 2% of
  `main`?
- **Options:**
  - **A.** Change nothing, and close this record. Effort: Small.
  - **B.** Cut the serial work after the last view, with no protocol change.
    The section "Serial work after the last view" below gives the split. The
    sidecars are idle then, so each cut saves its full time. Effort: Large.
    - **B1.** In both publications, build only the entry details that the
      pass or the Changes result changes. Share the other details without a
      clone or a deep compare. Encode the canonical index without a JSON value
      tree. About 18 to 26 ms. Most of it is in the Changes publication,
      because the usage publication already touches only the 11 changed
      entry details. Memory: lower, because fewer details are cloned. Risk:
      low to medium. Every published byte must stay equal. Applied on
      2026-11-22: a publication shares the record of a detail whose inputs
      are equal, and the canonical encoder sorts keys while it writes.
    - **B2.** In the comparisons, decide the reuse of an unchanged view from
      its document key and the base identity, without a fetch and a digest of
      its document. Reuse the closure and anchor walks that the pass already
      made for the changed views. About 20 to 35 ms. The link checks of an
      unchanged view can change when a view that it links to changes, so the
      reuse must follow the link targets. Memory: the walk facts of the views
      of one pass, at most 44 here, released with the pass. Risk: medium.
      Changes must stay equal over every edit sequence. Applied on
      2026-11-22, as built: a proven head view skips its document fetch, its
      digest, and its anchor walk; only a background read of a view with a
      viewport keeps a walk record; the records of one generation stay within
      two MiB, and each record ends when the classification of its
      generation takes it or when the generation ends. The record rule for
      pages and Markdown documents is the item
      [background-walk-records-from-kept-facts.md](./background-walk-records-from-kept-facts.md).
    - **B3.** In the kept-base check, skip the re-read of unchanged working
      manifests, lockfiles, and install listings. About 15 to 18 ms. A check
      by file metadata alone adds a change that the checks do not see, so it
      changes the Freshness Checks section of
      `docs/protocol/mokly-base-preparation.md`. So B3 needs a protocol
      decision. Risk: medium to high. The item
      [kept-base-freshness-edit-cost.md](./kept-base-freshness-edit-cost.md)
      already records the cost of this check as work outside an earlier
      scope.
    - **B4.** One Git read of the references for both the reference
      resolution and the base pin. About 3 ms. Risk: low. Applied on
      2026-11-22.
  - **C.** Cut the CPU of the pass with no protocol change. These parts touch
    neither the seed path nor the released-recipe release. Encode each restore
    request once for all cold sidecars, about 4 to 8 ms. It holds one encoded
    5.9 MB request for each generation while its restores wait. Index the style
    registry by rule, for each generation, with a fixed cap and a release at
    `dispose`, about 8 to 13 ms. Scan frames with the native `indexOf`, about
    3 to 8 ms. Together about 15 to 29 ms. Effort: Medium. The style registry
    index was built and measured as C1 on 2026-11-22 and reverted: it cut
    filter calls that took about 100 to 120 ms of wall time for each warm
    edit inside the busy sidecars, but `serve.background` did not get shorter
    in either timed run. No test covered its fallback to `registryStyles`. The
    section "H, W1, and C1, measured on 2026-11-22" gives the numbers. The one
    encode of each restore request is C2, and the native frame scan is C3.
    - Two more parts touch the seed path and the released-recipe release: a
      release without the lock-held encode and without the one-at-a-time
      disposes, about 3 to 8 ms, and a render-only restore, about 15 to
      25 ms. They waited for the branch that owned that code, which merged as
      PR #469 on 2026-11-22. They are not in the choice of the next pull
      request.
    - A V8 code cache would live in the memory of the core. The holder makes it
      after its visible `describe`, and each restore request carries it, about
      1.6 MB more. So its net gain is about 3 to 8 ms. A file would need a new
      kind of cache entry, because the sidecar writes no files today.
  - **D.** Start the comparisons against the kept base during the pass. This
    changes the rule at `docs/protocol/mokly-on-demand.md:76` for
    comparisons only. The kept-base check stays after the last render,
    because it reads the dependency directories that the renders record.
    After B, the comparisons that could overlap take about 30 to 45 ms, and
    their CPU slows the CPU-bound pass. So D gains about 5 to 25 ms net after
    B. Effort: Large, with high risk.
  - **E.** Evaluate only the modules that the rendered views need on a cold
    sidecar. About 25 to 45 ms. It changes `describe.ts`, which PR #468, the
    export-name cache, merged on 2026-11-22, so no other branch owns it now. It
    needs proof that module order cannot change any output. Effort: Large.
  - **F.** B without B3, and C. About 55 to 95 ms, central about 75. With B3,
    about 70 to 110 ms. Effort: Large.
  - **G.** The cuts that stay open after 2026-11-22, each when the
    orchestrator chooses it and after a measurement that shows a shorter
    pass or a shorter first edit. Effort: Large.
    - C2, one encode of each restore request for all cold sidecars, from
      option C. It holds one encoded request for each generation while its
      restores wait. Effort: Medium.
    - C3, the native frame scan, from option C. Effort: Small.
    - W2 of the watch block below. It needs a new equality test over an edit
      sequence, `crates/mokly-watch/src/plan.rs` must be split first because
      it has 299 lines, and the cause of the one extra resolver probe is
      unknown. Effort: Medium.
    - W4 of the watch block below, with W2. It is a form of option C of
      [serve-watch-candidate-plan-cost.md](./serve-watch-candidate-plan-cost.md),
      which grades that work Large. Effort: Large.
- **Left out:**
  - A second process that holds the new generation before the pass. This is
    the preload family of
    [serve-head-generation-preload.md](./serve-head-generation-preload.md).
    Its third attempt, experiment D of 2026-11-21, was 0.07 s slower and used
    3.8% more memory. This split gives no new reason that removes the memory
    cost.
  - More views in flight than sidecars, or another order of the views and
    their calls. Measured on 2026-11-22: no gain, and about 8% more memory. The
    pass is CPU-bound, so less idle time on a sidecar slows the other work.
  - Coalesced document compositions. The 44 views of a pass have 44 distinct
    document keys, so no composition repeats.
  - The production build of React. It changes published bytes and warnings.
  - A prerequisite `describe` without a reply. It repeats Part B of the
    export-name cache work, which the orchestrator did not build on
    2026-11-21, because the core would lose its Rust check of the
    definitions. The item [prepare-only-describe.md](./prepare-only-describe.md)
    holds it. The reply is 0.2 MB, so it saves about 3 ms.
  - Fewer cold sidecars in a pass. The preparation and the renders that it
    enables cost about the same lane time, so the pass ends at about the
    same time.
  - Reuse of evaluated modules across generations. Shared module state could
    make the output depend on the edit history.
  - One render for the four views of a path. Each render call carries its
    viewport and its color scheme, and the renderer can read both.
  - A classification that starts before the usage publication ends. Serve
    classifies Changes after the usage of the pass, so this changes a
    requirement, and the orchestrator ruled out protocol changes for B on
    2026-11-22.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** PR #225 made the pass parallel. PR #313 and PR #315
  keep head processes ready and rank them by their loaded generation. PR #466
  reuses proven head validation facts in the comparisons.
- **Related:**
  - [serve-head-generation-preload.md](./serve-head-generation-preload.md)
    records the three rejected attempts to prepare the new generation before
    the pass.
  - [sidecar-loaded-state-selection.md](./sidecar-loaded-state-selection.md)
    holds the open choice of the process for each request.
  - [coalesce-document-composition.md](./coalesce-document-composition.md)
    owns repeated compositions, which this pass does not have.
  - [default-sidecar-count.md](./default-sidecar-count.md) owns the default
    pool size, which this split did not change.
  - [closed-experiment-record-kind.md](./closed-experiment-record-kind.md)
    holds the open decision on records that ask for no action. When the next
    pull request closes this item and keeps its measurements, it applies that
    answer.
  - [serve-pass-rereads-unchanged-pages.md](./serve-pass-rereads-unchanged-pages.md)
    holds the reads of unchanged pages and Markdown documents. The split of
    2026-11-22 measured this cost, and the ranking of 2026-11-22 did not name
    it.
  - [serve-watch-candidate-plan-cost.md](./serve-watch-candidate-plan-cost.md),
    the record of experiment C of 2026-11-21, measured the same watch
    candidate step and found the same two causes of the record miss. W2 and
    W4 of the watch block below are forms of its option C, and its stop of
    2026-11-21 holds for a bar of 30 ms for each edit.
  - [prepare-only-describe.md](./prepare-only-describe.md) holds the Part B
    call of the export-name cache work. One reason of that call says that
    render sidecars run `describe` after Changes publishes. This split shows
    three prerequisite `describe` calls inside each warm pass, before
    Changes.
- **Decisions:**
  - 2026-11-22, the performance orchestrator chose B of the first decision of
    this item: split the serial work after the last view with the same probe,
    with no protocol change and no product code before the next answer.
  - 2026-11-22, the performance orchestrator chose F without B3: B1, B2, and
    B4 as one pull request, from branch
    `calummoore/mokly-edit-background-render-olos`, and the safe parts of C as
    the next pull request after it merges. The safe parts are the per-rule
    style registry index with its fixed cap and its release at `dispose`, one
    encode of each restore request for all cold sidecars, and the native frame
    scan. The parts of C in the seed path and the released-recipe release are
    not in that choice; they waited for the branch that owned them, which
    merged as PR #469 on 2026-11-22.
  - 2026-11-22, the performance orchestrator, after its gate accepted B1, B2,
    and B4: before any code of the next pull request, split two more costs
    with one clock, and rank their fixes with the safe parts of C, under the
    same bytes and the same 2% memory rule:
    - The first edit after a warm start builds all 366 entry details. In the
      12 gate sessions of the orchestrator, on both arms, the first edit had
      366 `detail.build` spans between the end of `graph.prepare` and the
      start of `index.build`, with a mean of 125 ms, in a range of 92 to
      205 ms. Edits 2 and 3 had no `detail.build` there and took 15 to 16 ms.
      The startup restores its state from the store, so the core probably
      holds no encoded details of the startup generation to share. Candidate
      fixes: encode or keep the details of the startup generation at idle
      after the first ready Changes, or reuse the stored bytes of the
      unchanged details. The item
      [changes-detail-revision-copies.md](./changes-detail-revision-copies.md)
      holds this cost.
    - The background pass reads every unchanged page and Markdown document
      again after each edit. The item
      [serve-pass-rereads-unchanged-pages.md](./serve-pass-rereads-unchanged-pages.md)
      gives its count and its time: none on mokly-cloud, which has no pages
      or Markdown documents.
  - 2026-11-22, the performance orchestrator, after the splits above and the
    watch split below: the next speed pull request is H of
    [changes-detail-revision-copies.md](./changes-detail-revision-copies.md),
    W1 below, and C1, the style registry index of option C, in that order.
    C2, one encode of each restore request, and C3, the native frame scan,
    wait: about 7 to 16 ms together. W2 and W4 below stay open. W3 stays out.
  - 2026-11-22, the performance orchestrator, after the checks of the second
    speed change: H, W1, and C1 do not merge, and the branch keeps only the
    records. Reason: only H shows a gain on the critical path, on the first
    edit of a session (the window from the end of `graph.prepare` to the
    start of `index.build`, 100 to 67 ms, timed), and it costs 18.5 MiB of
    live data until the first edit and about 40 MiB of retained core RSS. C1
    removes sidecar CPU, but `serve.background` did not get shorter in either
    timed run. W1 does not help the measured edit. So the change gives less
    than its projection, and its memory sits near the 2% limit. H can come
    back as its own small pull request, with option I of
    [changes-detail-revision-copies.md](./changes-detail-revision-copies.md),
    only if an allocator change removes the retained RSS. The item
    [core-rss-retained-free-pages.md](./core-rss-retained-free-pages.md)
    holds the allocator question.
  - 2026-11-22, the performance orchestrator: B3 stays out. A check by file
    metadata alone adds an unseen change class to the freshness rules, so it
    needs a protocol decision that is not taken for 15 to 18 ms.
  - 2026-11-22, the performance orchestrator: D, E, and the V8 code cache stay
    recorded as ranked here.
- **The watch candidate of the first edit after a warm start:**
  - Measured on 2026-11-22 on mokly-cloud with a probe on one clock: the
    candidate of the first edit takes 36 to 52 ms, and the candidates of
    edits 2 and 3 take 4 to 7 ms, because they reuse the adopted watch record.
  - Its parts on the first edit: the plan build, `PlanRecord::new`, about
    12 ms; `unobserved` 2.3 ms; the attachment, a clone of the record plan and
    `extend_required`, 5.8 ms; the observer re-attach, `replace`, 15 to 19 ms;
    and the replay 1.1 ms. The full pass of the observer covers about 5,000
    targets.
  - Two causes make the record of the startup miss:
    - Resources. After a restart, the resource recordings of the process are
      empty, so the startup record holds none. The background pass observes
      the two email logos, and the drain adds them to the live plan, so a
      write to them after a warm start is caught: in a real session a rebuild
      started 79 ms after the write. The drain does not add them to the
      record. W1 fixes this cause. It was built in `f453c0440` and measured
      on 2026-11-22, and `11f8e4ac4` reverts it. Its copy of the record held
      3.0 MiB, and the measured slug-editor edit does not use it, because its
      resolution inputs differ.
    - Resolution. On the edit of
      `docs/mockups/src/screens/product/settings/slug-editor.tsx`, the bundle
      reads one more resolver probe than the startup bundle of the same
      imports: the file
      `node_modules/.mokly-roots/1/@firna/ui/dist/node/theme.d.ts/package.json`
      and the folders `node_modules/.mokly-roots/1/@firna/ui/dist/node` and
      `node_modules/.mokly-roots/1/@firna/ui/dist/node/theme.d.ts`. A restore
      of the source returns to 5,019 files and 251 folders. Each state watches
      the probes that its own bundle read. Open question: why the bundle of
      the edited state reads this probe and the startup bundle does not.
  - Open options, not chosen on 2026-11-22:
    - **W2.** When a candidate differs from the record only by resources and
      resolution entries, build its plan from the record plan and the deltas,
      instead of `PlanRecord::new`. About 12 ms.
    - **W4.** With W2, let the observer take the target delta and update only
      the parents of the added and removed targets, and build the attachment
      from the delta. With W2, up to about 33 ms. It changes
      `crates/mokly-watch`.
    - Condition for both: an equality test over an edit sequence (the
      slug-editor edit, its restore, a resource write, an added and a removed
      resource, an added and a removed import) shows that the incremental
      plan and observer equal a fresh `PlanRecord::new` plan and a fresh
      attach for every state, and every delta that the incremental path does
      not handle falls back to the full path.
    - The reason of 2026-11-22: they save about 33 ms once for each session,
      on the first edit only, and a defect of the watcher's folder set means a
      missed rebuild.
    - Two facts limit "once for each session": a restore of the source
      returns to the startup probes, and in experiment C each later edit came
      after a restore and missed the record in the resolution files, at 41 to
      51 ms. So W2 and W4 can save time on each edit or restore that moves a
      resolver probe.
    - W3, equal resolver probes in both bundles, stays out, because it changes
      the resolution records of the bundler.
- **Recommendation:** G. Its parts are the cuts that stay open: B1, B2, and
  B4 of option F merged in #472, and C1 and W1 were measured and reverted on
  2026-11-22. Until 2026-11-22 the recommendation was F without B3.
- **Action:** ask the user, because the performance orchestrator chose on
  2026-11-22 to wait with C2, C3, W2, and W4 until it chooses them. H comes
  back only through option I of
  [changes-detail-revision-copies.md](./changes-detail-revision-copies.md).
  A later proposal of B3 needs a protocol decision first. D, E, and the V8
  code cache need their own scope approval.

## Measurements of 2026-11-22

All times are in milliseconds. They are local measurements with a probe, not
official Changes timings, and the performance orchestrator owns the official
measurements. Each number and each code fact of this section is of `main` at
`9bdb0569d`, before PR #468, PR #469, and the cuts B1, B2, and B4, except in a
bullet that names another commit, pull request, or cut.

### Method

- The catalogue is the `mokly-ai/mokly-cloud` repository at commit `194fdb78`,
  with its own `mokly.config.json`, `--base HEAD`, and `--debug-timings`.
  `npm ci` ran in `ts/`. The release core and the dist of the measured arm
  were installed over its `@mokly` packages.
- The machine has 4 vCPU and Node 24.22.1. Serve used the default 4 sidecars.
  Each session ran in its own transient systemd scope, and a sampler read the
  anonymous memory and the swap of that scope every 50 ms.
- Each edit changed the `title` text on line 35 of
  `docs/mockups/src/screens/product/settings/slug-editor.tsx` to a new value
  of the same length. After the last edit, the session restored the source
  exactly. A session waited for 4 s without timing records before each edit.
- A warm edit is an edit after the first edit of a session. Each arm had its
  own cache directory.
- A temporary probe, never committed, timed each view of the pass with one
  monotonic clock for the core and the sidecars. It recorded the window
  start, the waits for a worker, a batch place, a completion place, the Serve
  gate, and a pool slot, the preparation, each sidecar exchange, the request
  encode, the result decode, and the thread CPU of the composition. At the
  start and the end of each pass, it read the CPU time of every process of
  the tree. The process-local `elapsedMs` of each sidecar cannot align the
  processes, because each sidecar starts its clock at its own start.

### Split of the warm edits

Twenty warm edits of four sessions. Medians, with the range in brackets:

| Measure                                     | Value                  |
| ------------------------------------------- | ---------------------- |
| Edit to published Changes                   | 1,645 (1,430 to 2,200) |
| `serve.background`                          | 400 (318 to 542)       |
| End of the last view, from the pass start   | 380 (297 to 516)       |
| `changes.classify`                          | 152 (119 to 190)       |
| Views, and sidecar renders, in each pass    | 44 and 44              |
| CPU of the pass, core                       | 217 (176 to 293)       |
| CPU of the pass, four sidecars together     | 1,080 (839 to 1,488)   |
| CPU of the pass, whole tree                 | 1,298 (1,015 to 1,781) |
| Busy cores, whole-tree CPU over view time   | 3.4 (3.2 to 3.6)       |
| First render on the holder                  | 17 (5 to 25)           |
| First render on a cold sidecar              | 209 (120 to 394)       |
| Preparation on a cold sidecar               | 200 (60 cold sidecars) |
| `restoreGeneration` exchange                | 56 (33 to 119)         |
| `describe` exchange on a cold sidecar       | 134 (68 to 246)        |
| Render exchange                             | 14.7 (4.2 to 87.9)     |
| Idle gap between two renders on one sidecar | 2.6 (0.4 to 16.4)      |
| Pool slot wait, sum of a pass               | 17                     |
| Batch wait, sum of a pass                   | 3                      |
| Worker, completion, and gate waits          | 0                      |

- A warm edit took about 78 to the start of `watch.action`.
- `watch.action` took a median of 1,013, in a range of 879 to 1,417.
- `changes.classify` started 3 to 5 after the end of `serve.background`.
- Each pass starts four views at once. One goes to the holder. Three go to
  cold sidecars, which run their preparation. Until the first cold sidecar
  is ready, only the holder renders, one view after the other, with a gap of
  2 to 10 ms between its renders.
- The pool slot waits come at the start of each pass. The release of the old
  head generation then sends one `dispose` to each process, one at a time, 1
  to 4 each. The first call on each process waits for its `dispose`, up to 14
  on the last process. Just before the pass, the released recipe store
  encodes the 5.9 MB restore request of the old generation to measure it.
- Each pass has three fragments of over 100 ms, about 200 ms each. These are
  the first renders on the cold sidecars. The preparation is 70% to 90% of
  each, median 90%.
- Inside `changes.classify`, medians of the 20 warm edits: the base commit
  and the reuse of the kept base take 30, the view comparisons 79, then 32
  without a span, then the index build and the publication 8. The
  comparisons reused 1,464 views and compared 44.
- The memory peaks of the four warm probe sessions were 2,805 to 2,942 MiB.

### Inside one preparation

A CPU profile of the sidecars, with `--cpu-prof` at a 0.5 ms interval, slows
each edit by about 0.6 s, so only its shares count. For a prerequisite
`describe` on a cold sidecar, 198 ms under the profiler:

| Part of `describe`                            | Share |
| --------------------------------------------- | ----- |
| Running the bundle code                       | 28%   |
| Compiling the bundle code, in `evaluate`      | 26%   |
| `orderedExports`, a Babel parse of each entry | 23%   |
| Garbage collection                            | 10%   |
| Definition records and the JSON reply         | 8%    |
| Other                                         | 5%    |

- `restoreGeneration`, 115 ms under the profiler, is mostly the frame decode
  and `JSON.parse` of the request, 58, and idle time while the core encodes
  and sends it, 26.
- The restore request is 5.9 MB: the bundle code 2.7 MB, the module graph
  1.8 MB with 4,445 modules, the input digests 0.8 MB, the directory listings
  0.5 MB, and the entry sources 0.2 MB. The core encodes it once for each
  cold sidecar, in 13 to 17 each, or up to 39 when three run at once. In a
  warm pass, the released recipe store also encodes the 5.9 MB request of
  the released generation, while it holds the pool lock, only to measure its
  size. Only the pass of the first edit of a session measures 9.2 MB.
- A replay of one preparation in a fresh Node process, after an older
  generation, took 71 to 93 for `describe`. Its compile took 20 to 22. A V8
  code cache of 1.2 MB, made by an earlier evaluation, cut the compile to 5
  to 7 and `describe` to 56 to 72.
- A replay of the frame decode of a 10.3 MB test frame took 55 with the
  current byte loop and 48 with the native `indexOf`.
- In a warm render under the profiler, React work in its development build
  is about 70%. Mokly's own work after the React render is about 28%. Its
  largest part is `registryStyles`, which parses the whole style registry
  with PostCSS on each render, 9.3% of the render time.

### Serial work after the last view

One calm probe session, 6 warm edits, medians. The thread CPU is the CPU of
the thread that runs the step.

| Step after the last view                                 | Wall | Thread CPU |
| -------------------------------------------------------- | ---- | ---------- |
| Usage publication, `evidence::complete`                  | 20   | 20         |
| Git reference read before the classification             | 3    | none       |
| Base pin, `review.base-commit`, Git                      | 3    | 0.4        |
| Kept-base check, `review.base-tree`                      | 23   | 6          |
| Comparisons, `review.compare-views`                      | 69   | 35         |
| Identity encode, metadata files, and Git reference check | 7    |            |
| Changes publication, `changes::project`                  | 29   | 29         |
| Last view to published Changes, in total                 | 159  |            |

- Inside the Changes publication: `changes_detail::apply` 10, the detail loop
  and the index encode 9, the Changes apply 4, and the index build 2.
- Until 2026-11-22, `changes_detail::apply` deep-cloned all 167 entry
  details on each publication, and the detail loop then deep-compared each
  detail with the previous one before it reused the old file. B1 removed
  both.
- The usage publication also encoded the whole index again.

A second session ran under `perf` at 1,999 Hz with frame pointers. It slowed
each edit by about 1 s, so only its shares count. Shares of the CPU samples in
each step:

- Usage publication: the index encode 35%, clones 27%, and deep compares of
  details 24%.
- Kept-base check: the work runs on about 10 threads, mostly in the kernel,
  with directory reads and zlib `inflate`. It lists `node_modules`, hashes the
  install lockfiles, and reads the working manifests with Git clean
  normalization.
- Comparisons, on about 2.6 busy threads: head validation of the 1,508 views
  50%, with document cache lookups 11%, SHA-256 digests 10%, and anchor and
  closure walks of the 44 changed views 15%. The comparison engine 13%, the
  retained preparation 11%, and the reuse checks 17%.
- Changes publication: `changes_detail::apply` 34%, clones 33%, the index
  encode 23%, and `projection::index` 14%.
- The pass already walks the closure of each changed view before it caches
  the document, so part of the comparison walks repeats work.
- `crates/mokly-cli/src/serve_base.rs:124`: the kept-base check reads the
  dependency directories that the renders of the pass record. So that check
  cannot start before the renders end, unless the change proves the same
  result.

### Twice the views in flight

A variant of the probe build doubled the window, the worker permits, and the
batch and completion bound, so that calls waited at the Serve gate instead of
in the window. One interleaved round of four sessions, A B B A, six edits
each, warm edits only:

| Measure                   | Probe build  | Twice in flight | Difference |
| ------------------------- | ------------ | --------------- | ---------- |
| Edit to published Changes | 1,574        | 1,650           | +76        |
| `serve.background`        | 385          | 390             | +5         |
| `watch.action`            | 978          | 1,020           | +42        |
| `changes.classify`        | 140          | 167             | +27        |
| Session memory peak, MiB  | 2,808, 2,805 | 3,065, 3,002    | about +8%  |

- In the variant, the calls of a pass waited 1.0 to 1.5 s in total at the
  gate. The mean render exchange of a pass was 15.4 to 23.2, against 13.7 to
  16.5 in the probe build. The CPU of a pass stayed at about 1.0 to 1.35 s.
- So the idle gaps were not the bound. With the CPU nearly full, a fuller
  queue makes each render slower.
- One round cannot rank the endpoints of the two arms, because single edits
  ranged from 1,444 to 2,135. It shows no gain in the pass.

## Checks of the split

- The probe and the analysis scripts ran only on the local machine. They
  changed no file of the repository. The final probe patch has 906 lines, and
  its SHA-256 is
  `fffe177c389b873263d136a6b6b6aba5af72d145df35afaf2f8019012811c0c7`. This
  record holds every fact that it needs from the patch and the evidence.
- A fresh read-only agent ran the options check over this record on
  2026-11-22. It added the release, style index, and render-only restore
  parts of option C, the work after the last view, and the staged set F. It
  corrected the render share of Mokly's work and the classification medians.
  It found that the stop holds only if a protocol change counts as unsafe.
- Every session restored the edited source exactly, and every edit in this
  record published Changes with status `ok`.
- These did not happen: a product change, tests, the repository suite, the
  complete gate, a byte proof, a review, CI, and an official latency or memory
  run. This record makes no acceptance claim.

## H, W1, and C1, measured on 2026-11-22

The second speed change of branch
`calummoore/mokly-edit-background-render-olos` built three cuts in commits
`ea6724a03`, `f453c0440`, `a9a09edf2`, and `0910565bf`. It never opened a
pull request, and commit `11f8e4ac4` reverts its code. The code stays at
https://github.com/mokly-ai/mokly/tree/0910565bf3a7abac064b2bc7b04845e913ee1260. The plan of that work is kept at
https://github.com/mokly-ai/mokly/blob/0910565bf3a7abac064b2bc7b04845e913ee1260/plans/serve-first-edit-and-style-cuts.md?plain=1.

### What was built

- **H:** after the first ready Changes of a session, an idle step built and
  encoded the ready rebuild record of each unchanged entry, in chunks of 32
  on idle workers. Each path kept two rebuild records, one for each usage
  shape. The first edit then shared its unchanged details instead of
  encoding them. The item
  [changes-detail-revision-copies.md](./changes-detail-revision-copies.md)
  holds H with its memory and its option I, which keeps no typed copy, and
  the two review results of its code.
- **W1:** the watch drain kept a copy of the adopted watch record with the
  resources that the background pass observed, beside the adopted record, so
  that a later candidate with equal inputs reused it.
- **C1:** each sidecar generation kept an index of the React Native Web
  style registry text, at most 1 text and 64 outputs, so that a render found
  its needed rules with no parse. The filter of `main` stayed as the
  fallback. The review of 2026-11-22 found that no test covered that
  fallback, for a registry text that the index cannot read.

### Measurements of the performance orchestrator

Release cores, 4 vCPU, 7.9 GB, no memory cap; mokly-cloud unless named. The
rules of the gate, written before its data: all edits at least 30 ms sooner
with at least 4 of 6 rounds faster; on edit 1, the timed window at least
20 ms shorter with no `detail.build` span, and `serve.background` not more
than 10 ms longer; restarts within +30 ms; memory within +2%; and
`examples/basic` edits and restores within +30 ms. The rule of the decisive
check: all edits at least 15 ms sooner, and edit 1 not slower than `main`.

- The gate, `a9a09edf2` against `main` `a2ae56360`, with no kept esbuild
  context in either arm:
  - Untimed, 6 warm rounds of 3 edits: all 18 edits 1,749 to 1,696 ms (-54,
    4 of 6 rounds faster); edit 1 2,087 to 1,963 ms (-123); edits 2 and 3
    1,608 to 1,588 and 1,553 to 1,535 ms.
  - Timed, 4 rounds: on edit 1, the end of `graph.prepare` to the start of
    `index.build` 100 to 67 ms, with 366 and 0 `detail.build` spans;
    `serve.background` for each edit 374 to 382 ms (+8).
  - Untimed, 8 warm unchanged restarts: the listening line 1,063 to 1,028 ms,
    first Changes 2,928 to 2,915 ms, edits after a restart 1,756 to 1,731 ms.
  - Cold 10-edit sessions, 4 pairs: whole-tree peak 3,097 to 3,158 MiB
    (+61.5 MiB, +1.99%; pairs +135, +4, +25, +82).
  - `examples/basic`, 2 sidecars, 4 warm pairs: edits 1,792 to 1,572 ms
    (-219); restores 993 to 1,033 ms (+40; pairs -13, +19, +73, +80), over
    the rule of +30 ms; cold 5+5 peak 2,147 to 2,192 MiB (+2.13%; median
    +12.5 MiB), over the rule of 2%. The pooled repeat below passed both.
- The confirm after the merge of #478, `0910565bf` against `main`
  `c699b35d3`, with the kept esbuild context in both arms, untimed, 4 warm
  rounds: edit 1 2,012 to 2,130 ms (+118; rounds +40, +180, +120, +130);
  edits 2 and 3 1,480 to 1,502 and 1,472 to 1,478 ms; all 12 edits 1,655 to
  1,703 ms (+48).
- A timed split of the same arms, 4 warm rounds: published for each edit
  1,675 against 1,690 ms (+15); edit 1 +90 ms, carried by one round whose
  edit-1 compile took 889 ms against 617 to 674 ms in every other session;
  edits 2 and 3 -40 and -5 ms; `serve.background` +4 ms and
  `changes.classify` +1 ms. Edit 1 ran on one sidecar that kept the context
  in every session. A sidecar spawned during edit 1 in 2 of 4 `main` and 3 of
  4 candidate sessions.
- The `examples/basic` repeat with the merged arms, pooled with the gate, 8
  pairs each: warm edits -123 ms (median -96), restores -8 ms (median +3),
  cold peak +41.8 MiB (+1.97%). The +40 ms restores of the gate were noise.
- Pooled memory, 8 cold pairs each: mokly-cloud +1.27%, `examples/basic`
  +1.97%. Both pass the 2% limit.
- The decisive check, untimed, the merged arms, announced before its data: a
  new run of 8 rounds gave all edits -42 ms (7 of 8 rounds faster), edit 1
  -65 ms (median -50), and edits 2 and 3 -45 and -15 ms. Pooled with the
  confirm, 12 rounds: all edits -12 ms (8 of 12 rounds faster), which misses
  the bar of -15 ms; edit 1 -4 ms (median +10), which meets the bar of no
  slower than `main`.

### Measurements of the branch

- Byte proofs of `a9a09edf2` against `main` `a2ae56360`, with the same
  TypeScript packages apart from C1: strict builds of mokly-cloud (5,304
  files), `examples/basic` (2,389), and the large HTML and React fixtures
  (20,828 each) gave equal bytes and equal output streams. Serve sessions of
  `examples/basic` (8 stages, 2,313 file checks) and of mokly-cloud (a warm
  start with a logo write before the first edit, 6 stages, 2,346 file checks)
  gave 0 differences and equal revisions.
- H in that mokly-cloud Serve session: `main` encoded 375, 0, 13, 305, and 0
  details inside its five rebuilds, and the candidate 0 in each. The idle
  step made 377 encodes, 94 to 109 ms of wall time and 45 to 54 ms of encode
  time, and it started 8 to 9 ms after the first ready Changes.
- A 2x2 factorial with the kept context in every arm, timed, 3 warm
  restarts of 3 edits for each arm, on a noisy machine: edit 1 means of
  2,459 ms (main core, `main` dist), 2,019 ms (main core, C1 dist), 2,186 ms
  (candidate core, `main` dist), and 2,227 ms (candidate core, C1 dist). The
  idle step ended 5.1 to 5.7 s before edit 1 in every candidate session, the
  edit-1 bundle took 955 to 1,133 ms in every arm, and all 4 sidecars
  rendered in every edit. The factorial found no mechanism for the +118 ms
  of the confirm.
- C1 in the sidecar: the filter of `main` took a median of 1.88 ms for each
  call inside the sidecars, and the same registry text repeated in 2,033 of
  2,049 calls. Outside the sidecar, on that text, the filter of `main` took
  411 to 603 us, an index hit 23 to 103 us, and a memo miss 98 to 245 us.
  One index held about 297 KiB.
- W1: the copy held 3.0 MiB net (the inputs, the plan with its private
  indexes, and 5,104 targets), and its build took 54 ms once for each
  session.
- The memory breakdown of H is in the item
  [changes-detail-revision-copies.md](./changes-detail-revision-copies.md),
  and the retained core RSS is in the item
  [core-rss-retained-free-pages.md](./core-rss-retained-free-pages.md).
