# Writer resumes omit a state record

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from PR #394, review round 4, finding 4.
- **Location:** `crates/mokly-compare/src/render_writer.rs:54`,
  `crates/mokly-compare/src/render_admission.rs:51`, and
  `docs/protocol/mokly-timings.md:135`.
- **Reason:** The diagnostic omission affects no output or accepted performance,
  and the branch has used both review fix rounds.

- **Source:** Review.
- **Category:** docs or spec.
- **Terms:**
  - **Render store:** The disk cache of complete Serve documents that later
    Serve processes can reuse.
  - **Writer:** The background thread that saves offered documents when Serve
    permits optional work.
  - **State record:** A sequenced `render.store` event in the opt-in timing output.
  - **Pending set:** The document keys that wait for optional encoding and saving.
- **Background:**
  - Serve starts the writer paused. After each completed Changes result,
    `finished` in `crates/mokly-cli/src/serve_changes.rs` calls `resume`.
  - The timing contract requires a state record for preparation, each lookup,
    each admitted or dropped offer, each batch, a resume, and stop.
  - Complete snapshots and their sequence share one publication owner in
    `crates/mokly-compare/src/render_pending.rs`. The highest sequence must
    always identify the newest complete state.
- **Problem:**
  - `DocumentWriter::resume` calls only `Admission::resume`. That method opens
    the first-Changes latch, advances its epoch, and wakes the writer.
    Neither method calls the state observer.
  - With an empty pending set, the writer waits again without emitting a record.
    A held activity lease or pending Changes status also keeps it waiting.
  - `TraceStoreObserver::state` supplies the event field that
    `crates/mokly-cli/src/serve_trace.rs` converts into a timing record.
    No observer call means no resume record.
- **Impact if no action:** The opt-in timing stream omits a promised transition.
  Document output, admission, counters, and the highest-sequence rule remain correct.
  The existing drain consumer in `scripts/large/render_store_seed.ts` reads
  `queued` and `active`, which a resume does not change. No current consumer fails.
- **Root question:** How should timing output cover the release of optional
  document writes?
- **Options:**
  - **A.** Publish the current complete snapshot through the existing sequence
    owner when writes resume. Order it under the pending-set lock before the
    release permits a writer batch. Extend a writer test for an empty queue.
    Effort: Small.
  - **B.** Remove the resume-record guarantee from the timing contract.
    Effort: Small. This changes a requirement and needs a user decision.
  - **C.** Add a release field to each state record. Set it after the first
    completed Changes and publish its transition as in A. Update the protocol,
    trace allowlist, and trace test. Effort: Medium. This adds a boundary field
    and needs a user decision. No current consumer reads it.
  - **D.** Name each record's cause through the allowlisted `action` field:
    preparation, lookup, offer, batch, resume, or stop. Update
    `StoreObserver::state`, its mock, both implementations, and all nine emit
    sites. Effort: Medium. This adds record data and needs a user decision.
- **Left out:**
  - No change leaves the contract and output inconsistent.
  - A separate event channel or admission-event owner duplicates the existing
    publication owner without meeting a different requirement.
  - Publishing only from the writer loop misses a resume while a lease or
    Changes status still prevents work.
  - Publishing from Serve moves sequence ownership outside the store.
  - A prose test checks documentation words instead of emitted behavior.
- **Assumptions:**
  - The store owns its records. The timing contract states this boundary.
  - Current records have no release flag or cause. A repeats the current
    counters, so a reader can identify the transition only by its time.
    C and D drop this assumption, with their separate decision cost.
- **Ordering and tests:**
  - Keep the existing complete-snapshot publication owner. Release its lock
    before observer callbacks, as the existing state-order rule requires.
  - Coordinate resume with the pending-set lock, as `stop` does. Publish
    before the admission release lets a batch start.
  - A snapshot emitted after release without this coordination can repeat the
    writer's busy snapshot. The delayed-observer regression then waits on a
    barrier that the writer owns, and can deadlock.
  - Preserve every assertion in
    `crates/mokly-compare/src/_tests_/render_writer_state_tests.rs`.
    Its state-order regression calls `resume` and shares this publication path.
  - Extend an existing writer-boundary test to observe the callback and
    sequence advance with an empty queue. Assert record data and event order.
    Use no sleep, retry, elapsed-time bound, or test of protocol prose.
  - One record for each resume call is acceptable. Repeated records retain
    sequence order, as repeated stop records do.
- **Wider fix:** The documentation skill already requires protocol and code
  alignment in the same change. No additional wider mechanism is needed.
- **Previous examples:** `plans/follow-ups/stylesheet-roots-span-parent.md`
  records a separate timing-output mismatch. It has a different cause and fix.
- **Recommendation:** A. It restores the promised event without a new record
  field, owner, or setting.
- **Action:** fix after merge, apply A. The independent source check confirmed
  the omission. Both review fix rounds are used, and the finding is noncritical.
- **Done when:**
  - An empty-queue resume publishes its complete snapshot through the existing
    sequence owner. The writer's admission and output behavior stay unchanged.
  - The extended test fails by assertion before the fix and passes afterward.
    Each new asynchronous test passes ten runs.
  - Existing delayed-observer and startup tests keep all assertions and pass.
  - Remove the status line from `docs/protocol/mokly-timings.md` when its
    resume-record guarantee holds.
