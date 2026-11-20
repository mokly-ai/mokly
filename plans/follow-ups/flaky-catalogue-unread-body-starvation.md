# Catalogue server starvation test flakes

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from the branch `calummoore/fu-flaky-postcss-static-input-recheck-a3oe`, an unrelated flaky test that a load run met. On 2026-11-20, the user asked to record it only, not to fix it.
- **Location:** `crates/mkc-catalogue-server/src/_tests_/http/stream_tests.rs:181-252`. The two 200 ms waits are at lines 223-224 and 234-235. The failed assertion is at line 248.
- **Reason:** The branch that met the flake does not touch this test or its crate, and nobody has reproduced the flake or named its source.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Access exchange:** the `POST /_access` request of the catalogue server, which trades a one-time grant for the catalogue cookie.
  - **Unread response:** a response that the test keeps, but whose body it never reads, like a client that stops reading.
- **Background:**
  - The test is `http::tests::stream_tests::unread_bodies_do_not_starve_file_or_access_requests` in the `mkc-catalogue-server` library unit tests.
  - It builds its own tokio runtime with 2 worker threads and at most 2 blocking threads. It sends 8 file requests and keeps the 8 unread responses.
  - Then it sends `GET /ordinary.json` and the access exchange. It wraps each request in `tokio::time::timeout(Duration::from_millis(200), ...)` on the real clock.
  - It asserts that each of the two requests finished, with the messages "ordinary file request was starved" and "access exchange was starved". It also asserts that it holds 8 responses.
  - `docs/protocol/ci-test-timing.md`, section "Assertion Rule", forbids an upper or a lower bound on elapsed wall-clock time, also in Rust tests. The CI job timeout is the hang guard of the Rust tests.
  - Each 200 ms wait expects success, so it works as an upper bound on elapsed time.
  - On 2026-11-20, at commit `a2f61eb53`, this workspace test command ran with the default number of test threads:

    ```sh
    MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test cargo test --locked --workspace
    ```

  - At the same time, repeated full runs of the test binary of `crates/mokly-cli/tests/changes_javascript_tests.rs` loaded the host. Each of those runs took about 23 seconds.
  - The host was Linux `box-node-a33854b8325a11d9`, x86_64, with 4 CPUs and 7.8 GiB of memory. It used Rust 1.98.1, Node 24.22.1, Git 2.56.1, and `CARGO_BUILD_JOBS=2`. `crates/mkc-catalogue-server` had no local change.
  - The `mkc-catalogue-server` library target printed this failure. Then Cargo exited with status 101 after 401.611 seconds.

    ```text
    ---- http::tests::stream_tests::unread_bodies_do_not_starve_file_or_access_requests stdout ----

    thread 'http::tests::stream_tests::unread_bodies_do_not_starve_file_or_access_requests' (374449) panicked at crates/mkc-catalogue-server/src/_tests_/http/stream_tests.rs:248:9:
    ordinary file request was starved


    failures:
        http::tests::stream_tests::unread_bodies_do_not_starve_file_or_access_requests

    test result: FAILED. 74 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.79s

    error: test failed, to rerun pass `-p mkc-catalogue-server --lib`
    ```

  - After the load stopped, the test ran once alone from the repository root, with the same test binary:

    ```text
    target/debug/deps/mkc_catalogue_server-a9a0e652cf065d47 http::tests::stream_tests::unread_bodies_do_not_starve_file_or_access_requests --exact
    ```

  - It passed with `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 74 filtered out; finished in 0.90s`. It exited with status 0 after 0.908 seconds.
  - The equivalent Cargo command is `cargo test -p mkc-catalogue-server --lib -- http::tests::stream_tests::unread_bodies_do_not_starve_file_or_access_requests --exact`.
  - The suspected source, not confirmed, is CPU load against the two 200 ms waits. A wait cancels its request when it expires, so the failure does not show whether the request was slow or blocked.
  - Nobody reproduced the failure. Nothing shows a defect in the product code.
- **Problem:** The test failed once under CPU load and passed alone. Its two 200 ms waits on the real clock make its result depend on machine speed.
- **Impact if no action:** A loaded test run can fail on a healthy change and stop `cargo test --workspace`, as it did here. A real starvation and a slow machine give the same failure text.
- **Root question:** How does the test prove that unread responses do not block later file and access requests, with a check that does not depend on machine speed?
- **Options:**
  - **A.** Change nothing, and record each recurrence in this item. The two 200 ms waits stay, which `docs/protocol/ci-test-timing.md` forbids, so a loaded run can fail again. Effort: Small.
  - **B.** Reproduce and trace the failure first. Repeat the full `mkc-catalogue-server` library target under a load like the one above. Record the pass counts under `.context/`. Name the source, then choose the deterministic check that the source needs. When the source is a slow request under load, use event order. The test then asserts that both requests settle while it holds the 8 unread responses, and it checks each result. The existing hang guard stops a real starvation. Keep every correctness assertion and its message. Add no retry and no longer time limit. When the source is a product defect, write a failing test first, then fix the product. Effort: Medium.
- **Left out:**
  - A fix before a reproduction names the source. The flaky-test rule of the `testing` skill needs a named source first.
  - A retry, a repeat, a skip, a quarantine, or a longer time limit. The flaky-test rule forbids each of them.
  - Remove the test. That drops the check that unread responses do not block later requests.
  - Only two approaches are real before a source is named: investigate now, or wait for more failures.
- **Wider fix:** None. `docs/protocol/ci-test-timing.md` already states the assertion rule for Rust tests, and the source of this failure is not named.
- **Previous examples:** None found for this test. `plans/follow-ups/polling-tests-wait-on-real-time.md` records other tests that depend on real time.
- **Recommendation:** B. Only a named source can choose a deterministic check that keeps the proof of the test.
- **Action:** ask the user, because nobody has reproduced the flake or named its source, and the flaky-test rule sends an unknown source to the user.
