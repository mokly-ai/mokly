# Render writer tests see a contended offer

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from `calummoore/ci-speed-fast-local-test-loop-v1dm` during the local parallel gate measurements.
- **Location:** `crates/mokly-compare/src/_tests_/render_writer_tests.rs:78`, `crates/mokly-compare/src/_tests_/render_writer_startup_tests.rs:107`, and `crates/mokly-compare/src/render_writer.rs:71`.
- **Reason:** The local test speed change does not touch Rust code, so its fix belongs in a separate branch.

- **Background:** `DocumentWriter::offer` takes the pending queue lock with `try_lock`. When another thread holds the lock, the offer counts a contention and returns `OfferOutcome::Dropped` at once. The writer thread takes the same lock when it drains the queue.
- **Problem:** Two tests failed with `assertion left == right failed, left: Dropped, right: Queued`. They are `a_full_key_queue_returns_the_render_while_disk_publication_is_blocked` and `prepared_writer_reads_while_writes_wait_for_completed_changes`. Each failed once in a full `cargo nextest run --locked -p "mokly-*" -p xtask` on a 4-CPU machine. The second test then passed 40 of 40 runs alone.
- **Impact if no action:** A passing change can fail the Repository suite and the native suites, more often on a loaded or small runner.
- **Root question:** How do these tests observe a queued offer without a race against the writer thread for the queue lock?
- **Options:**
  - **A.** Make each test wait until the writer thread is parked, through an existing observer or test double, before it offers. Keep every assertion. Effort: Small.
  - **B.** Add one test helper that offers only after the writer reports that it is idle, and use it in every render writer test that asserts `Queued`. Effort: Small.
  - **C.** Change the product so that `offer` waits briefly or retries the lock. First confirm that a dropped offer under contention breaks a product requirement, because the drop is intended behaviour. Effort: Medium.
- **Left out:** Retries, sleeps, and test serialization hide the race and do not prove a queued offer.
- **Wider fix:** B. One helper removes the race for every render writer test.
- **Previous examples:** None found.
- **Recommendation:** B. One idle-writer helper serves every test that asserts a queued offer.
- **Action:** fix after merge, apply B.

The suspected source is a `try_lock` contention between the test thread and the writer thread. This source was not confirmed. The observed runs used merged `main` at `3c7306065`, Rust 1.98.1, cargo-nextest 0.9.152, and a 4-CPU Linux machine. No test, assertion, or product code changed in response.
