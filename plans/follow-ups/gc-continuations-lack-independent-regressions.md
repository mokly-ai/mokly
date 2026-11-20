# Collection continuations lack independent regression coverage

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-31, from post-push retention review finding 2 and its independent check.
- **Location:** `crates/mkc-publications/src/_tests_/maintenance_tests.rs:52`; `crates/mkc-publications/src/_tests_/garbage_tests.rs`; `crates/mkc-publications/src/maintenance.rs:69`; `crates/mkc-publications/src/garbage_collection.rs:58`.
- **Reason:** The user deferred this work to a follow-up on 2026-11-02. It does not block the current PR.
- **Decision:** The user approved deferral, without selecting an implementation option. Keep E as the recommendation for future work.

**Terms:** `more_blobs` reports another possible database batch. `next_cursor`
reports another object-storage listing page.

**Background:** One maintenance run must finish both sources independently.
The protocol requires bounded batches, exhaustion and stalled-cursor
rejection. A full database batch has 100 records. A missing object still
counts as deletion success.

**Problem:** The multi-batch unit test sets both continuation signals together
and ends them together. The real runner fixture collects two records. No
existing test needs a database continuation without a storage cursor, a
storage cursor without the database signal, or the collector's producer flag.

Static inspection identifies three unprotected changes: stop whenever the
cursor is absent; stop whenever `more_blobs` is false; or always return
`more_blobs: false`. The first and third can leave one of 101 collectible
records behind with empty storage. The second can stop an orphan sweep after
its first page. These mutations were not executed during the read-only review.

**Impact if no action:** A later regression can report success with eligible
work remaining. A storage-only regression can repeatedly miss later pages.

**Root question:** How should the gate prove that each source is exhausted,
whichever ends first?

**Options:**

- **A — Add the database-only unit case.** Also check the collector's full
  batch signal. Keep the current combined case. Effort: Small. This leaves
  the storage-only mutation uncovered.
- **B — Extend the composed Postgres/local-store fixture.** Create 101
  collectible records without objects and require one run to remove all of
  them. Effort: Small. This adds database work and does not by itself isolate
  the storage-only continuation.
- **C — Introduce an explicit continuation type.** Represent completed and
  continued collection explicitly. Effort: Medium. The combined decision
  moves into the collector and still needs regressions.
- **D — Split collection and sweeping into separate loops.** Give each
  bounded operation its own continuation and keep the stall guard on the
  sweep. Effort: Medium. This removes the combined decision and repeated
  listing during database-only passes, but changes working interfaces.
- **E — Isolate both terms and the producer.** Cover storage-only and
  database-only runner batches, plus the collector's signal at the requested
  row limit and one fewer. Effort: Small. The existing test files stay below
  their 300-line cap.
- **F — E plus one shared batch-size constant.** Use the constant for the
  candidate limit and the full-batch comparison. Effort: Small. This prevents
  those two literals drifting apart.

**Recommendation:** E, replacing the first pass's A after the independent
check. It protects all three identified mutations with focused unit cases.

**Wider fix:** D removes the two-source completion decision. E is sufficient
for this gap without changing the working collector's interface.

**Left out:** A constant-only assertion does not prove exhaustion. A browser
test adds no coverage here. A longer job deadline does not test the stop rule.

**Related:** The storage-cursor stall coverage item concerns another guard in
the same runner and can be addressed in the same test module.

**Action:** Fix after merge in separate work requested by the user. Confirm
the approach when that work starts. Do not add tests or change the collector
in the current PR.
