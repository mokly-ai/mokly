# Starvation test skips the storage read path

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from review finding 7 of the branch `calummoore/ci-speed-flaky-decisions-a`, which the finding check moved outside the scope.
- **Location:** `crates/mkc-catalogue-server/src/_tests_/http/stream_tests.rs:181-268`, `crates/mkc-catalogue-server/src/_tests_/http/compression_support.rs:21`, and `crates/mkc-catalogue-server/src/response.rs:53`.
- **Reason:** The test fixture that skips storage is the same on `main`, and the branch changed only the waits and the assertions of the test.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Blocking worker:** a thread of the tokio runtime that the catalogue server uses for work that waits synchronously.
- **Background:**
  - `unread_bodies_do_not_starve_file_or_access_requests` builds a runtime with two blocking workers, holds eight unread file responses, and then expects a file request and an access exchange to finish.
  - Its fixture `compression_support::full_file` returns `FileBody::Ready`, an in-memory body that exists only in tests. Production returns `FileBody::Storage`, and `response::render` opens it from storage with `catalogue.open(request).await`.
- **Problem:** No storage body is open while the test makes its two requests. A change to the storage branch of `response::render` that holds a blocking worker for each slow response would pass the test.
- **Impact if no action:** Slow clients could take both workers and block file delivery and access exchanges, while the isolation test still passes.
- **Root question:** How does the test prove that file delivery and access exchanges progress while slow clients hold storage responses?
- **Options:**
  - **A.** Use the storage response path in this test. Let the slow streams signal when their reads are pending, and check the ordinary file bytes and the access status before the eight reads go on. Keep every assertion. Effort: Medium.
  - **B.** Add a storage-backed fixture for catalogue response tests that check isolation, with the pause at the file-store boundary and the production catalogue behind the router. Effort: Medium.
- **Left out:** A request timeout, because it measures machine speed, which `docs/protocol/ci-test-timing.md` forbids.
- **Wider fix:** B. The shared fixture keeps storage in the path for every test that relies on pending file reads.
- **Previous examples:** `plans/follow-ups/catalogue-backpressure-test-fixed-wait.md` records another test of the same file that infers read order from a clock.
- **Recommendation:** A. It covers the missing path in the test that already holds slow clients.
- **Action:** fix after merge, apply A, because the fixture is the same on `main` and outside the change that found it.
