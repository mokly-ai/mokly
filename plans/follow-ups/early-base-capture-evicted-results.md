# Early base capture re-reads evicted results on large catalogues

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Owner:** Cal, GitHub user `calummoore`, by the user decision of 2026-11-21.
- **Condition:** Failed the 2% limit, and accepted as an exception. The one
  authorized diagnostic pair put the candidate's kernel memory peak 2.5964%
  above `main`, and its sampled whole-tree RSS 2.9798% above. On 2026-11-21 the
  user accepted that result as an exception and kept step 1 unchanged.
  **Measured evidence** gives the values.
- **Added:** 2026-11-21, from the branch
  `calummoore/mokly-first-changes-1-integration-93f7`, the large React
  measurements of the step 1 integration.
- **Location:** `crates/mokly-graph/src/prefetch_state.rs:96` to line 109 and
  line 128 to line 137, `crates/mokly-graph/src/session_prefetch.rs:26` to
  line 36, `crates/mokly-graph/src/evaluation.rs:73` to line 87,
  `crates/mokly-graph/src/workers.rs:120`,
  `crates/mokly-graph/src/capture_window.rs:24`, and
  `crates/mokly-cli/src/serve_capture_workers.rs:25`.
- **Reason:** On 2026-11-21 the user accepted the diagnostic pair, kept step 1
  unchanged, and deferred the bounded handoff and the capture concurrency
  investigation to separate work.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Early render:** A base render that starts as soon as base preparation
    knows the document keys, before the capture reaches the view.
  - **Flight:** The handoff record of one early render in `prefetch_state.rs`,
    which the capture reads at the view's turn.
  - **Ordered capture:** The base capture that validates and encodes every view
    in route order, in a sliding window, under its own 256 MiB bound.
  - **Full and compact tiers:** The two tiers of the render cache, which hold
    full artifacts and encoded documents that a lookup must restore.
  - **Lead:** The completed early results that the capture has not taken yet.
- **Background:**
  - Step 1 is the miss-first base capture change, the first of five stacked
    pull requests that make first Changes faster. First Changes is the time
    from the Serve start until the browser first shows ready Changes.
  - When base preparation knows the document keys, `session_prefetch::start`
    lists each view that neither the render cache nor the render store holds.
    `prefetch_tasks` then renders the listed views.
  - `prefetch_tasks` uses the sliding window of the capture workers with the
    `All` consumer, at `capture_window.rs:24`. `All` admits every listed view
    and frees each slot at completion. So no byte bound and no lead bound apply.
  - Each early job calls `Session::raw` at `session_prefetch.rs:29`, inserts the
    result into the render cache at line 31, and completes its flight at line 36.
  - `Flight::complete` keeps a strong `Arc` only when a capture reader already
    waits, at `prefetch_state.rs:130` to line 133. Otherwise the flight keeps a
    `Weak<Artifact>`, so the render cache is the only owner.
  - At the view's turn, `validation_input` reads the flight at `evaluation.rs:80`.
    `Flights::read` upgrades the `Weak` at `prefetch_state.rs:109`. When the
    full tier has evicted the result, the upgrade fails and the read returns
    nothing, also when the compact tier holds the encoded document.
  - `validation_input` then calls `Session::raw` again, at `evaluation.rs:86`.
    That lookup restores the document from the compact tier, at
    `crates/mokly-graph/src/cache.rs:169`. When the compact tier lost it too,
    the lookup reads the render store, and it renders only when the store
    misses too. The insert at `evaluation.rs:120` keeps a restored key compact,
    as `cache.rs:194` shows.
  - The render cache has a fixed bound of 256 MiB, at
    `crates/mokly-cli/src/render_runtime.rs:38`. It keeps 16 MiB for transit,
    the tiers share 240 MiB, and the compact tier takes at most 128 MiB.
  - The full tier keeps at least 112 MiB. Each tier evicts in its own access
    order, and inserts never wait, by `docs/protocol/mokly-runtime.md:49` to
    line 56. `crates/mokly-graph/cache.md:69` says: "Eviction changes work only."
  - The full tier charges each artifact with `entry_cost`, at `cache.rs:248`. A
    `Weak` keeps only the small allocation of its `Arc` after the cache drops
    the artifact. So each result's payload stays in the bounded render cache.
    The flights keep one small record for each listed view, at
    `prefetch_state.rs:35` to line 53, so their metadata grows with the misses.
  - Dropping the `PrefetchGuard` calls `cancel_and_join`, at
    `session_prefetch.rs:55` to line 79. It stops new early renders, joins the
    thread, and clears the flights of the session.
  - The early window and the ordered window both run on the base capture pool,
    through `prefetch_tasks` and `Session::schedule_capture_window` at
    `crates/mokly-graph/src/session.rs:136`.
  - That pool has as many threads as the smaller of the comparison parallelism
    and the sidecar limit, at `serve_capture_workers.rs:25` to line 27. Each
    window limit is at most that size, at
    `crates/mokly-cli/src/capture_workers.rs:50` to line 64. So the two windows
    together run no more jobs than the pool has threads.
  - A capture job that reaches a running early render waits on its pool thread
    until that render ends, at `prefetch_state.rs:96` to line 103.
  - The ordered capture already bounds its waiting results. Each capture job
    charges its encoded result, at `crates/mokly-graph/src/collection_jobs.rs:57`.
    Its consumer keeps a worker slot until the queued charge fits the room left,
    at `crates/mokly-graph/src/session_collection.rs:47`.
  - `docs/protocol/mokly-base-preparation.md:72` to line 74 require early
    renders to start at once, with a limit from one to the sidecar capacity. By
    line 75 to line 78, the capture takes each result at the view's turn and
    waits for a running early render.
  - By line 23 of that page, memory use stays bounded independently of
    repository size. By line 187 to line 189, each early render ends before its
    classification ends.
  - By `docs/protocol/mokly-comparison-serving.md:39` to line 44, the base
    capture has its own 256 MiB bound beside the render cache. By line 133 to
    line 137, the capture window takes the smaller of the worker count and the
    sidecar capacity. The decision at line 143 to line 145 rejected a larger
    window for cached views, because an eviction can make one render again
    beyond the capacity.
- **Measured evidence:** The measurements of 2026-11-21 gave these values. This
  item copies them, and nobody ran the measurements again.
  - The control is `main` at `cb233fb50af71725ed464bfb1df08ab5463c5280`. The
    candidate is the step 1 integration runtime at
    `fb8b20f77d65642602f773e322ee5e6e9846a27f`.
  - Three earlier pairs ran the large React fixture, whose base side has 5,850
    views. Each list below gives the three runs or pairs in order.
  - The early jobs of the candidate called `Session::raw` 2,410, 2,410, and
    2,412 times. Its ordered capture called it 3,862, 3,978, and 4,103 times.
    Each ordered count equals the compact restore count of its run, so no
    ordered read rendered a view.
  - The candidate made 6,272, 6,388, and 6,515 reads, and `main` made 5,850 in
    each run. The extra reads were 422, 538, and 665.
  - The views without a flight explain the other ordered reads: 3,440, 3,440,
    and 3,438. So each extra read is an early result that the full tier evicted.
  - `main` made 3,440, 3,441, and 3,437 compact restores. So the candidate made
    422, 537, and 666 more, close to its extra reads. The restore difference and the extra-read count
    differ by at most one.
  - Component renders were 2,410, 2,409, and 2,413 on `main`, and 2,410, 2,410,
    and 2,412 on the candidate. So the extra reads added no sidecar render. The
    timing records name no routes, so the evicted documents are unknown.
  - All ordered `Session::raw` spans of a run summed to 990, 748, and 1,018 ms.
    The union of their intervals was 956, 721, and 973 ms. These totals cover
    every ordered restore, and the time of the extra restores alone is unknown.
  - Classification took 33,656, 27,635, and 27,531 ms on the candidate, and
    31,414, 21,833, and 22,476 ms on `main`. That is 2,242, 5,802, and 5,055 ms
    more. So the extra restores cannot alone explain it. Comparison took 6,974,
    3,719, and 4,018 ms on the candidate, and 5,203, 2,382, and 2,263 ms on `main`.
  - All 6 runs gave 5,850 base views, 32,843,076 encoded bytes, 5,850 compared
    views, 69,540 reads, and a comparison peak of 19,667,054 bytes. These
    logical counters do not measure process memory. These runs collected no
    RSS, swap, or CPU values.
  - On `main`, up to 4 raw capture reads overlapped. On the candidate, the
    early window and the ordered window each had a limit of 2, and they shared
    one pool of 2 threads. So at most 2 base capture jobs ran at once, not 4.
  - One later diagnostic pair ran the cold large React fixture on `main` and
    then on the candidate, with fresh caches and the same harness.
  - Its cgroup `memory.peak` was 1,463,672,832 B, or 1,395.867 MiB, on `main`.
    On the candidate, it was 1,501,675,520 B, or 1,432.109 MiB. That is
    38,002,688 B more, or +2.5964%.
  - The whole-tree RSS, sampled every 200 ms, peaked at 1,462,380 KiB, or
    1,428.105 MiB, on `main`. On the candidate, it peaked at 1,505,956 KiB, or
    1,470.660 MiB. That is +2.9798%.
  - The cgroup `memory.swap.peak` fell from 4,247,552 B, or 4.051 MiB, to 405,504 B,
    or 0.387 MiB. The sampled `VmSwap` fell from 4,076 KiB to 396 KiB. Both
    kernel memory peaks came before first Changes.
  - The user accepted the pair as an exception on 2026-11-21. In the user's
    view, the increase is a fixed amount of about 38 MB, close to the Cloud mean
    of +37 MiB, or +1.2%. The user also noted a spread of about ±10% in
    single-pair peaks, and that swap fell. This item claims no memory growth curve.
  - In the diagnostic pair, classification took 47.922 s on `main` and 38.708 s
    on the candidate. Its CPU on `main` was 35.16 s in the core, 35.75 s in
    sidecars, and 2.64 s in esbuild. On the candidate, it was 29.6 s, 31.89 s,
    and 2.55 s.
  - Capture took 35.267 s on `main`, with 21.12 s of core CPU and 32.18 s of
    sidecar CPU. On the candidate, it took 26.894 s, with 17.66 s and 27.78 s.
  - Comparison took 6.269 s with 12.15 s of core CPU on `main`, and 4.713 s
    with 10.00 s on the candidate. During comparison, the new capture threads of
    the candidate used no CPU. The sidecars and esbuild used none in either arm.
    So this pair did not reproduce the slower comparison of the earlier pairs.
  - On the `mokly-cloud` catalogue, with 1,508 views, cold classification fell
    from 6,672 to 6,042 ms, faster in 4 of 4 pairs. First Changes fell from
    15.33 to 14.90 s.
- **Confirmed and unmeasured:**
  - Confirmed by the code and the counts: an early result that the full tier
    evicts costs one more compact restore. These restores added no render.
  - Confirmed by the code and the pairs: the early and ordered jobs share one
    pool, which ran at most 2 jobs at once where `main` overlapped 4.
  - Not known: the cause of the slower classification and comparison in the
    three earlier pairs. The diagnostic pair was faster on the candidate.
    Neither the restores nor the shared pool is a proven cause.
  - Not measured: the time of the extra restores alone, the waits for running
    early renders, and how memory grows with catalogue size.
- **Problem:** Early renders can run far ahead of the ordered capture. On a
  large catalogue, the full tier evicts some results before the capture takes
  them, so the capture restores them again. The early and ordered jobs also
  share one pool, which ran at most 2 jobs at once where `main` overlapped 4.
- **Impact if no action:** Each classification of the measured fixture made 422
  to 666 more compact restores than `main`. Three earlier pairs were 2.2 to
  5.8 s slower in classification. The diagnostic pair was 9.2 s faster, so the
  size and the cause of the large cold time cost stay unknown.
- **Root question:** How can the ordered capture take each early result before
  the render cache evicts it, while each retained result stays inside an
  existing memory bound?
- **Options:**
  - **A.** Bound the lead by the room of the full tier. Replace `All` in
    `prefetch_tasks` with a consumer that charges each completed early result
    with `entry_cost` until the capture takes it. Effort: Medium.
    - A new early render starts only while that charge fits a fixed lead
      budget, such as half of the full tier's 112 MiB minimum. Charge bytes,
      not a count, because documents vary in size.
    - One early render can always start, so the limit rule at
      `docs/protocol/mokly-base-preparation.md:73` holds. A hard stop at zero
      would change that rule.
    - No memory leaves the cache charge, and no cache rule changes. Other cache
      pressure can still evict a result, and the compact restore serves it.
    - The window re-checks held slots only when one of its own jobs completes,
      at `capture_window.rs:90`. A refused `admit` ends all further starts, at
      line 68. So A needs a wake-up when the capture takes a result.
    - When the budget binds, the capture reaches more listed views that still
      wait and renders them itself. So some early work moves to the capture.
  - **B.** Pin a small handoff set with admission. Each flight keeps a strong
    `Arc` until the capture takes it, within a fixed budget in `entry_cost`
    bytes. Effort: Medium.
    - When the budget is full, the prefetch window holds its slots until the
      capture takes a pinned result. It needs the same wake-up as A.
    - A pinned result that the full tier evicts stays alive outside the cache
      charge, beside its compact copy. So the budget charges it in full.
    - The budget is a new memory bound, and the option includes its protocol
      change. A new bound needs a user decision.
    - The capture bound cannot hold the pins, because `remaining` in
      `crates/mokly-graph/src/collection.rs:20` gives its room only later.
  - **C.** Pin untaken early results inside the full tier, up to a pinned share
    of its bound. When the share is full, no further early render starts.
    Effort: Large.
    - Every pinned result reaches the capture without a restore, and no memory
      leaves the cache charge. Pinned entries shrink the room of other documents.
    - The capture's take, the end of the classification, and a cancellation
      must each unpin the entry.
    - It changes the rule "Each tier evicts in its own access order" at
      `docs/protocol/mokly-runtime.md:50`, and it includes that doc change. So C
      needs a user decision. It touches the core cache of every render.
  - **D.** Hand off the capture's encoded result instead of the render. The
    early job runs the render, the closure walk, and the encoding of its view.
    Effort: Large.
    - The flight keeps the `EncodedComparisonDocument`, which uses the codec of
      the compact tier, at `crates/mokly-graph/src/collection_input.rs:43` to
      line 49. No full artifact must survive.
    - Waiting encoded results share the room of the capture bound, which is
      known only when the capture starts. So D needs a new bound before the
      capture, and that bound needs a user decision.
- **Left out:**
  - A strong `Arc` in every flight. It keeps every untaken result outside the
    cache charge, up to all listed views, such as 2,410 here. It breaks the
    bounded memory rule at `docs/protocol/mokly-base-preparation.md:23`.
  - A larger render cache. It adds memory against the 2% limit of the series,
    and the decision at `docs/protocol/mokly-runtime.md:61` rejected a larger
    bound that still thrashes.
  - A pin only near the capture cursor, with no admission. Results that complete
    far ahead are the evicted ones, so it fails the goal.
  - A capture out of route order. It can change which views a full capture bound
    keeps, and the window at `docs/protocol/mokly-comparison-serving.md:133`
    uses route order.
  - Early renders inside the capture window. The decision at
    `docs/protocol/mokly-base-preparation.md:79` and line 80 rejected it,
    because listed views would wait for the rest of preparation.
  - Change nothing. It keeps the re-reads that the user deferred to this item.
- **Assumptions:** All options share these, unless a line says otherwise.
  - Output stays equal, and a compact restore stays a correct fallback. Source:
    `docs/protocol/mokly-comparison-serving.md:151` and `cache.md:69`.
  - Early renders start at once, and between one and the sidecar capacity run.
    The capture takes each result at the view's turn. Source:
    `docs/protocol/mokly-base-preparation.md:72` to line 78.
  - No early result outlives its classification. Source: line 187 to line 189
    of that page.
  - Memory does not grow beyond the step 1 runtime. Source: the 2% limit of the
    user decision of 2026-11-19, and the exception of 2026-11-21.
  - The render cache rules stay. Source: `docs/protocol/mokly-runtime.md:49` to
    line 61. Option C drops one of them.
- **Future investigation:** This item also owns the rest of the large cold time
  cost. Effort: Medium.
  - Find whether the shared pool of 2 threads costs time against the overlap of
    4 on `main`. Measure the busy time of each pool thread, and the waits for
    running early renders. Repeat cold pairs, because the pairs differ in sign.
  - A wider window for jobs that need no sidecar changes the decision at
    `docs/protocol/mokly-comparison-serving.md:143`, so it needs a user decision.
- **Wider fix:** D. It removes the class by structure, because the handoff no
  longer depends on an entry that the cache can evict. A also bounds the lead
  for every early-render window, but other cache pressure can still evict.
- **Previous examples:** The eviction of a view between the miss listing and
  the capture follows the same rule. It changes work only, and
  `eviction_after_key_probing_renders_the_missing_input_and_keeps_exact_bytes`
  in `crates/mokly-graph/src/_tests_/prefetch_eviction_tests.rs` covers it.
- **Related:**
  - `plans/follow-ups/restore-decoder-charge.md` records that compact restores
    run uncharged. Each extra restore of this item is one such restore. Neither
    fix replaces the other.
  - `plans/follow-ups/cold-start-base-overlap-memory.md` asks the user for a
    memory rule for early base work at cold start. Option B adds a bound of the
    same kind, so choose the two rules together.
- **Recommendation:** A. It bounds the lead with no memory outside the cache
  charge, keeps every protocol rule, and keeps the compact restore as its
  fallback. D best protects the codebase, at a Large cost and with a new bound.
- **Action:** fix after merge, apply A, because on 2026-11-21 the user accepted
  the diagnostic pair, kept step 1 unchanged, and deferred this work.
- **Done when:**
  - A deterministic test shows that the window starts no new early render while
    untaken results fill the lead budget, except the one that may always start.
    It also shows the restart after a take, with no timer and no sleep.
  - The tests in `crates/mokly-graph/src/_tests_/prefetch_tests.rs` still pass,
    so cancellation stops and joins every early render.
  - Each new asynchronous test passes in 10 of 10 runs.
  - Cold pairs on the large React fixture report each run beside `main`: the
    early and ordered reads, the compact restores, the component renders,
    classification, comparison, and the cgroup memory and swap peaks. Pairs on
    `mokly-cloud` report cold classification and first Changes beside `main`.
  - Memory does not grow beyond the step 1 runtime, and swap does not grow.
  - The pull request gives the result of the future investigation.
