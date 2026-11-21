# Render store reads count index lock contention as misses

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Owner:** Cal, GitHub user `calummoore`, by the user decision of 2026-11-20.
- **Added:** 2026-11-21, from the branch
  `calummoore/mokly-first-changes-1-integration-93f7`, the render store miss
  delta of the step 1 integration measurement.
- **Location:** `crates/mokly-compare/src/render_store_read.rs:18` to line 22
  and line 83, `crates/mokly-compare/src/render_store.rs:89` and line 129,
  `crates/mokly-compare/src/render_store_state.rs:21`, and
  `crates/mokly-compare/src/render_store_write.rs:27`.
- **Reason:** On 2026-11-20 the user decided that this fix does not belong in
  step 1, whose runtime stays unchanged, because `main` has the same read path.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Render store:** The disk cache of complete Serve documents that a later
    Serve process reuses, under `docs/protocol/mokly-render-store.md`.
  - **Segment:** One entry of the render store, which holds up to 64 documents.
  - **Index:** The in-memory map from a stored document key to its place in a
    segment, which one `Mutex` at `render_store.rs:89` guards.
  - **Ordinary read:** `CachedDocuments::read_document`, the store lookup that
    Serve makes after a render cache miss.
  - **Head usage pass:** The background pass after Serve readiness that looks
    up and renders every current view, with the timing span `serve.background`.
- **Background:**
  - The ordinary read takes the index with `try_lock` at
    `render_store_read.rs:18`. When another thread holds the lock, the read
    returns `ReadOutcome::Miss` at line 19.
  - Otherwise the read looks up the key, clones one position, and releases
    the lock at line 22. It does no disk work under this lock.
  - `docs/protocol/mokly-render-store.md:79` requires this behaviour: "No read
    waits for a lock, so a held lock is a miss." Its Faults table, at line
    176, makes a held lock a normal event without output.
  - The head usage pass looks up as many views at once as the worker count,
    each on its own render worker. "Window And Lookup" in
    `docs/protocol/mokly-on-demand-background.md` gives this rule. So several
    workers run the ordinary read at the same time.
  - `DocumentWriter::finish_read` counts each outcome other than a hit as a
    miss, at `crates/mokly-compare/src/render_writer.rs:142`. That count also
    holds an absent key, a disabled store, an absent or contended segment, a
    rejected entry, and a cancelled read. No count separates these reasons.
  - Five places take the index lock, each with `try_lock`:
    - The ordinary read, at `render_store_read.rs:18`.
    - The adoption of a replaced segment, at `render_store_read.rs:83`. It
      runs only when a segment changed its token or its size after indexing.
    - The startup preparation, at `render_store_state.rs:21`. It holds the
      lock while it reads the inventory and each segment header. The writer
      thread runs it once, before its loop, from
      `crates/mokly-compare/src/render_writer_control.rs:149`.
    - The writer's save, at `render_store_write.rs:27`. It holds the lock
      across a disk `inspect` of the new segment, at line 33, and up to 64
      index inserts. The writer starts only after the first completed Changes
      result, as `ready` in `crates/mokly-compare/src/render_admission.rs:97`
      requires.
    - The `contains` probe, at `render_store.rs:129`. Step 1 added it. Only
      the base prefetch calls it, through `Session::uncached_documents` at
      `crates/mokly-graph/src/session.rs:119`.
  - `UsagePass::run` starts Changes, and so base preparation, only after the
    head usage pass ends, at `crates/mokly-server/src/background.rs:56` to
    line 62. So the probe cannot run during the first head usage pass, which
    the measurement below covers.
  - Reads can start when the native identity is ready, at
    `render_writer_control.rs:145`, before the index is ready at line 149.
    Those early reads miss, as `docs/protocol/mokly-render-store.md:69`
    permits.
  - The index is built once. `initialize` returns at once when the index
    exists, at `render_store_state.rs:102`, and no code clears it. A hit
    needs an indexed position.
  - So during the first head usage pass, after the first hit, only other
    ordinary reads and the rare adoption can hold the index lock.
  - After preparation, the other locks of the read do not reject a second
    reader. The segment read takes a shared file lease, at
    `crates/mokly-compare/src/bundle_cache_read.rs:39`. Access-order upkeep
    skips a held state lock at line 53 and still serves the document.
  - A miss makes Serve render the document again and offer it to the store.
    `DocumentWriter::offer`, at `render_writer.rs:69`, and `Batch::run`, at
    `crates/mokly-compare/src/render_batch.rs:46`, do not skip a key that the
    index holds. So the writer stores the document again.
  - The read path is the same in the two measured arms below. A `git diff`
    from the control shows no change in `render_store_read.rs`,
    `render_store_state.rs`, `render_store_write.rs`, or
    `crates/mokly-graph/src/session_lookup.rs`. The candidate adds only the
    `contains` probe on this path.
  - Step 1 keeps the head lookup on the render pool.
    `CaptureWorkers::background` forwards to its inner workers, at
    `crates/mokly-cli/src/capture_workers.rs:47`. The integration branch
    reported that a real-worker regression test fails without this forward
    and passes in 10 of 10 runs with it.
- **Measured evidence:** The measurement reports of 2026-11-20 gave these
  values. This item copies them, and nobody ran the measurement again.
  - Step 1 is the miss-first base capture change. It is the first of five
    stacked pull requests that make first Changes faster. First Changes is the
    time from the Serve start until the browser first shows ready Changes.
  - The control is `main` at `cb233fb50af71725ed464bfb1df08ab5463c5280`. The
    candidate is the step 1 integration runtime at
    `fb8b20f77d65642602f773e322ee5e6e9846a27f`. It merges the step 1 source
    `e46b21011` with that control.
  - A warm run restarts Serve on a store that earlier runs filled. The speed
    pass ran 8 balanced warm pairs on the `mokly-cloud` catalogue. Each pair
    has one control run and one candidate run. Two series of four pairs, W
    and U, make up the 8 pairs.
  - The mean first Changes time fell from 5.20 s on the control to 4.78 s on
    the candidate. The candidate was faster in all 8 pairs.
  - The U series restarts Serve on an unchanged tree. Each U run made 1,508
    store reads. The runs gave these counts, as hits/misses/writes:
    - Control: 1,504/4/4, 1,504/4/4, 1,504/4/4, and 1,501/7/4.
    - Candidate: 1,498/10/8, 1,499/9/9, 1,497/11/10, and 1,500/8/6.
  - So each extra miss replaced a hit, and the candidate made no extra read.
    It missed about five more reads in each run on average. It wrote two to
    six more documents in each run.
  - In rounds 2 to 4 of the W series, the control missed 15, 10, and 17
    reads, and the candidate missed 7, 6, and 6. So the candidate does not
    miss more in every series.
  - In pair 2 of the U series, the `serve.background` span ran from 1,474 to
    2,111 ms on the control. On the candidate, it ran from 1,456 to 2,468 ms.
    Each time is `elapsedMs` since the Serve session began.
  - The first miss of the candidate in that pair came at 1,534 ms, after 345
    hits. Its later misses came at 1,651, 1,754, 1,786, 1,915, 1,947, 1,977,
    and 2,010 ms, with two misses at 2,010 ms. That makes 9 misses.
  - The hit counts at those later misses were 693, 1,023, 1,091, 1,249,
    1,302, 1,346, and 1,404.
  - The misses of the control in that pair came at 1,701, 1,804, 1,938, and
    1,980 ms, after 891, 1,179, 1,389, and 1,472 hits.
  - The measurement placed every extra miss of the candidate in the head usage
    pass, and none in base capture. The `review.capture-side` span took 257
    ms on the candidate and 581 ms on the control.
- **Confirmed and unmeasured:**
  - Confirmed by the code: two overlapping ordinary reads can reject each
    other. The second read then counts a miss for a document that the store
    holds.
  - Confirmed by the code: in the first head usage pass, after the first hit,
    only other ordinary reads and the rare adoption can hold the index lock.
  - Confirmed by the code: a one-time unready index cannot explain a miss
    after the first hit. The 345 hits before the first miss of the candidate
    show that its index was ready.
  - Not measured: how many misses took the index lock branch. The timing
    records name no document, by `docs/protocol/mokly-timings.md:26`. No
    count of failed index locks exists. So the documents that missed are
    unknown.
  - Not measured: why the candidate missed more in the U series. Its read
    path is the same as on the control. Nobody found a step 1 mechanism that
    adds overlap between head reads.
  - The other miss reasons of the counter stay possible for some misses. So
    the confidence is Medium.
- **Problem:** The index uses one exclusive lock for readers and writers. So
  two overlapping ordinary reads can reject each other, and the second read
  misses a document that the store holds. Serve then renders that document
  again and writes it again.
- **Impact if no action:** Warm restarts can render stored documents again
  during the head usage pass, before first Changes. Nobody measured this time.
  Each extra write uses idle writer time and keeps a second copy until
  eviction.
- **Root question:** How can overlapping store reads serve every stored
  document that they look up, instead of rendering it again?
- **Options:**
  - **A.** Guard the index with `std::sync::RwLock`. The ordinary read and the
    `contains` probe take the shared lock with `try_read`. Two readers then
    never reject each other, and no read waits. Effort: Medium.
    - Preparation, the writer's save, and the adoption take the exclusive
      lock with `try_write`. A read that meets it still misses, so the
      protocol text stays true.
    - Keep each exclusive acquisition non-blocking. The standard `RwLock`
      can refuse `try_read` while a writer waits.
    - First confirm the cause with a local count of failed index locks during
      warm runs. Keep that count out of the commit.
    - It does not remove the misses while the writer or the preparation holds
      the lock.
  - **B.** Let an ordinary read wait a short time for the index lock, after
    preparation. This is the short blocking acquisition that the user named.
    Effort: Medium.
    - A read before preparation ends stays a miss. Every later holder does
      in-memory work only, so the writer's save runs its disk `inspect`
      before it takes the lock.
    - It also serves the reads that meet the writer's inserts. With the
      current `Mutex`, readers still pass the index one at a time.
    - It changes the requirement "No read waits for a lock" at
      `docs/protocol/mokly-render-store.md:79`. The option includes that doc
      change.
    - The read already waits briefly for two in-memory locks: the fault queue
      at `render_store_read.rs:23` and the counters through `read_state` at
      `crates/mokly-compare/src/render_pending.rs:145`.
  - **C.** Publish the index as an immutable snapshot. A reader looks up the
    key in the current snapshot, without the lock that preparation or the
    writer holds. Effort: Large.
    - Preparation, the writer, and the adoption build a new map and swap it
      in. This removes every index lock miss of the read, also against the
      writer.
    - It needs a new dependency such as `arc-swap`, or a short lock around the
      snapshot pointer.
    - Each publication or adoption copies a map of up to 16,384 entries. Two
      maps live during a swap.
- **Left out:**
  - A second store read, or a caller retry, after a lock miss. It breaks the
    rule of at most one store read for each view, in "Window And Lookup" of
    `docs/protocol/mokly-on-demand-background.md`. That rule stays.
  - An index split into several exclusive locks by key. It lowers the
    collisions but keeps a miss for each one, so it fails the goal.
  - An index that only preparation fills. Documents that this process writes
    would then miss until a restart, so it fails the goal.
  - A count of misses by reason alone. It explains the misses but serves none
    of them, so it fails the goal. A uses a local count as its first step.
  - Change nothing. The extra renders stay, and the user decided on
    2026-11-20 to fix this in separate work.
- **Assumptions:**
  - The step 1 runtime stays as it is, and the fix lands in its own branch.
    Source: the user decision of 2026-11-20. All options share it.
  - The index stays in process memory. No stored format and no timing record
    field changes. Source: the code at `render_store.rs:89`. All options
    share it.
  - A read before preparation ends stays a miss. Source:
    `docs/protocol/mokly-render-store.md:69`. All options share it.
  - A stored read equals a fresh render, so the fix changes time and write
    counts only. Source: "Reads" in `docs/protocol/mokly-render-store.md`.
    All options share it.
  - No read waits for a lock. Source: `docs/protocol/mokly-render-store.md:79`.
    Options A and C keep it. Option B drops it.
- **Wider fix:** A. It removes the class by structure, because two index
  readers can no longer reject each other. After preparation, no other step of
  the read rejects a second reader. C also removes the misses against the
  writer, at a higher cost.
- **Previous examples:** None found of one reader that rejects another. The
  write path drops an offer when the pending lock is held, at
  `render_writer.rs:71`, under the matching write rule at
  `docs/protocol/mokly-render-store.md:102`.
- **Related:** `plans/follow-ups/store-served-startup-head-slots.md` covers
  the same store and pass. It found that concurrent store misses started
  sidecar processes before the first edit. Fewer misses start fewer processes,
  so its first-edit cost can show more often. Neither fix replaces the other.
- **Recommendation:** A. It removes the only index overlap that the head usage
  pass meets after preparation, needs no wait, and changes no protocol text.
  C best protects the reads from the writer too, at the cost of a dependency
  or index copies.
- **Action:** fix after merge, apply A, because on 2026-11-20 the user kept
  the step 1 runtime unchanged and gave this fix to Cal as separate work.
- **Done when:**
  - The ordinary read and the `contains` probe take a shared lock on the
    index without waiting. Preparation, the writer's save, and the adoption
    take the exclusive lock without waiting.
  - A deterministic test holds a shared guard on the index. A read of an
    indexed key then returns a hit, and the probe returns true.
  - With the exclusive guard held, the same test shows a miss and a false
    probe. The test uses no timer and no sleep.
  - The tests that hold the index, at
    `crates/mokly-compare/src/_tests_/render_store_boundary_tests.rs:168` and
    `crates/mokly-compare/src/_tests_/render_store_fault_tests.rs:39`, hold
    the exclusive guard and keep their assertions.
  - The pull request gives a local count of failed index locks in balanced
    warm runs on `mokly-cloud`, before and after the change. It gives the
    hits, misses, and writes of each run beside a `main` control. No time or
    count threshold applies.
