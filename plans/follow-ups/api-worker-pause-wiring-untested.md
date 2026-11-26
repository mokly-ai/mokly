# No test proves the API passes worker pauses

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from the review of the pull request "test(cloud): speed up slow cloud tests and prove the #528 App removals in the browser" (#549).
- **Location:** `crates/mkc-api/src/application_server.rs:81` and `:87`, `crates/mkc-api/src/worker_intervals.rs`, and `crates/mkc-api/tests/github/harness.rs:136-137`.
- **Reason:** The only test that would catch the break needs a new way to observe the running loops, and the break costs CI time only.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Worker loop:** A loop of the API process that polls for work and pauses between passes, such as check delivery and build claims.
  - **`WorkerIntervals`:** The struct in `crates/mkc-api/src/worker_intervals.rs` that holds the pause of each worker loop. Its default is the production pause: 1 s for each webhook delivery loop, 5 s between check-delivery passes, and 2 s after a build claim that finds no build.
- **Background:**
  - The GitHub test harness in `crates/mkc-api/tests/github/harness.rs:136-137` sets `check_delivery` and `build_claim` to a 20 ms pause.
  - The API server copies these values into `CheckWorkerLoop` and `BuildWorkerLoop`, in `crates/mkc-api/src/application_server.rs:81` and `:87`.
  - Two tests are fast only because of that copy: `github::build_smoke_tests::configured_api_schedules_current_push_and_pull_heads_and_delivers_checks` (about 26 s to about 2 s in CI) and `github::check_delivery_tests::upload_creates_a_live_check_and_both_rerun_events_update_the_same_run` (about 25 s to about 2 s).
- **Problem:** If the server passes the production defaults instead of the configured values, both tests still pass, but each takes about 25 s again. No test fails on that break.
- **Impact if no action:** Such a regression shows only as slower CI, in the CI timing report. The product does not change.
- **Root question:** Do we need a failing test when the configured worker pauses do not reach the running loops?
- **Options:**
  - **A.** Accept the gap. The CI timing report shows the slower tests. Effort: Small.
  - **B.** Add mock-clock unit tests of each loop with custom pauses. They check only that a loop sleeps its own field, and they would not catch the server passing the defaults. Effort: Small.
  - **C.** Start the full API with an injected clock, and capture the pauses of its running check-delivery and build-claim loops. This catches the realistic break, but it adds a clock seam to the server composition. Effort: Medium.
- **Left out:** An elapsed-time assertion on the two tests, because tests must not assert wall-clock time.
- **Wider fix:** C. It observes what the running server does, so it covers each future loop that gets a configured pause.
- **Previous examples:** None found.
- **Recommendation:** A. The break costs only CI time, the CI timing report shows it, and B would not catch it.
- **Action:** ask the user, because A accepts a known test gap.
