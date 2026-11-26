# Catalogue backpressure test waits a fixed 20 ms

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the review of the branch `calummoore/ci-speed-flaky-decisions-a`, which changed another test of the same file.
- **Location:** `crates/mkc-catalogue-server/src/_tests_/http/stream_tests.rs:93-134`, with the wait at line 131.
- **Reason:** The branch that found it changed only the starvation test of this file, and this test has not failed.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Poll:** one call that the catalogue server makes to read the next chunk of a stored file stream. The test counts each one.
- **Background:**
  - `response_backpressure_polls_only_as_the_client_reads` checks that the catalogue server reads a stored file only as fast as the client reads the response.
  - The test reads one frame of the response, then waits with `tokio::time::sleep(Duration::from_millis(20))`, and then asserts that the poll count is still 1.
  - The test runs on the current-thread tokio runtime of `#[tokio::test]`.
  - `docs/protocol/ci-test-timing.md` forbids a test that decides its result on elapsed time.
- **Problem:** The 20 ms wait gives the server a fixed time to read ahead. On a slow or loaded machine, a read-ahead can need longer than 20 ms, and the test then passes without the check that it means to make. The wait also adds 20 ms of real time to each run.
- **Impact if no action:** A change that makes the server read ahead can pass this test, and the test keeps a real-time wait that the timing protocol forbids.
- **Root question:** How does the test prove that the server polls no further chunk while the client reads nothing, without a real-time wait?
- **Options:**
  - **A.** Run the test with a paused tokio clock, so that the runtime advances time only when every task is idle. Then the server has run until it waits before the test reads the count again. Effort: Small.
  - **B.** Use event order. After the first frame, yield until the server task is idle, for example with `tokio::task::yield_now` in a loop that a test-only idle hook ends, and then assert the count. This needs a hook in the stream adapter. Effort: Medium.
- **Left out:** A longer wait, because the testing rules forbid it and it does not prove the absence of a poll.
- **Wider fix:** None. The timing protocol already forbids elapsed-time decisions.
- **Previous examples:** The starvation test of the same file replaced its two 200 ms waits with event order on 2026-11-26.
- **Recommendation:** A. A paused clock makes "no further poll while idle" exact on the current-thread runtime.
- **Action:** fix after merge, apply A, because the branch that found it does not change this test.
