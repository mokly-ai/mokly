# Background admission order test flakes

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix now.
- **Added:** 2026-11-20, from CI run 44818292103 of PR #397 (`calummoore/pr-completion-from-branch-8cbc`), job Native (windows-2025).
- **Location:** `crates/mokly-server/src/_tests_/work/background_tests.rs`, the test `queued_background_renders_admit_in_request_order`, assertion at line 139; `crates/mokly-server/src/work_background.rs`, `LookupJob::run` and `Workers::background_render`.
- **Reason:** The failure is in a test that the branch that found it did not change, and a rerun passed, so the branch merged without a fix.

- **Terms:**
  - **Background render:** a render that `Workers::background` queues behind foreground work. `background_permit` takes the `turn` semaphore, waits until the priority state is idle, and then takes a worker permit.
  - **Admission order:** the order in which queued background renders get a worker. The test name requires request order.
- **Background:** The test starts one foreground render on one worker and holds it on a gate. It then queues two background renders, `first` and `second`, and polls each once. It releases the gate, awaits the foreground render, polls `second` again, joins both, and asserts that the routes ran in the order `["foreground", "first", "second"]`. `main` changed this file last in PR #408, "perf(serve): keep sidecars busy during the head usage pass", merged on 2026-11-20.
- **Problem:** On 2026-11-20 the test failed twice. PR #397 changed no Rust code.
  - It failed on the Windows native runner, in CI run 44818292103 of PR #397. A rerun of the failed jobs of the same commit passed. The failure text:

    ```
    thread 'work::work_tests::background_tests::queued_background_renders_admit_in_request_order' (500) panicked at crates\mokly-server\src\_tests_\work\background_tests.rs:139:5:
    assertion `left == right` failed
      left: ["foreground", "second", "first"]
     right: ["foreground", "first", "second"]
    test result: FAILED. 142 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.60s
    ```

  - It failed on Linux, in the Repository job of the `main` push run 44826956203 for commit `1a5d2b24`, the squash merge of PR #397. The failure text:

    ```
    thread 'work::work_tests::background_tests::queued_background_renders_admit_in_request_order' (79474) panicked at crates/mokly-server/src/_tests_/work/background_tests.rs:139:5:
    assertion `left == right` failed
      left: ["foreground", "second", "first"]
     right: ["foreground", "first", "second"]
    test result: FAILED. 142 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.24s
    ```

- **Suspected source:** Confirmed by repeated local runs on Linux. Each render asks `background_permit` for a worker twice: for its lookup job and, after a miss, for its resumed job. The lookup job frees its worker and wakes the waiting renders on its blocking thread, before its task reports completion. When the scheduler pauses that thread in this gap, `second` takes the worker for its lookup and then for its resumed job, and records its route first. The test drives the futures correctly, and the `turn` comment in `crates/mokly-server/src/work.rs` promises request order, so the source is in the admission.
- **Impact if no action:** The required CI check fails now and then on branches that do not touch this code, on Windows and on Linux. It now also turns the required CI check red on `main` pushes, on Linux. A later background render can run before an earlier one.
- **Root question:** Does `background_permit` admit queued background renders in request order on every platform, and does the test prove it without depending on the scheduler?
- **Options:**
  - **A.** Reproduce the flake with repeated local runs on Linux, for example `cargo test -p mokly-server --lib queued_background_renders_admit_in_request_order` in a loop, or on a runner. If `background_permit` can admit out of order, fix the admission and keep the test. If only the test depends on the scheduler, change the test so that it drives both futures deterministically, as the `deterministic-tests` skill says. Effort: Small.
  - **B.** Mark the test as flaky and rerun it on failure. It hides a possible ordering bug. Effort: Small.
- **Recommendation:** A. It finds out whether users can get renders out of order, and it removes the flake either way.
- **Action:** fix now, apply A, because the flake breaks the required CI check, also on `main`, and repeated local runs reproduce it.
