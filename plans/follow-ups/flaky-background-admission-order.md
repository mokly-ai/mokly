# Background admission order test flakes on Windows

- **Severity:** Low. **Effort:** Small. **Confidence:** Low. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from CI run 44818292103 of PR #397 (`calummoore/pr-completion-from-branch-8cbc`), job Native (windows-2025).
- **Location:** `crates/mokly-server/src/_tests_/work/background_tests.rs`, the test `queued_background_renders_admit_in_request_order`, assertion at line 139; `crates/mokly-server/src/work_background.rs`, `background_permit`.
- **Reason:** The failure is in a test that the branch that found it did not change, and a rerun passed, so the branch merged without a fix.

- **Terms:**
  - **Background render:** a render that `Workers::background` queues behind foreground work. `background_permit` takes the `turn` semaphore, waits until the priority state is idle, and then takes a worker permit.
  - **Admission order:** the order in which queued background renders get a worker. The test name requires request order.
- **Background:** The test starts one foreground render on one worker and holds it on a gate. It then queues two background renders, `first` and `second`, and polls each once. It releases the gate, awaits the foreground render, polls `second` again, joins both, and asserts that the routes ran in the order `["foreground", "first", "second"]`. `main` changed this file last in PR #408, "perf(serve): keep sidecars busy during the head usage pass", merged on 2026-11-20.
- **Problem:** On 2026-11-20 the test failed once on the Windows native runner. PR #397 changed no Rust code. The failure text:

  ```
  thread 'work::work_tests::background_tests::queued_background_renders_admit_in_request_order' (500) panicked at crates\mokly-server\src\_tests_\work\background_tests.rs:139:5:
  assertion `left == right` failed
    left: ["foreground", "second", "first"]
   right: ["foreground", "first", "second"]
  test result: FAILED. 142 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.60s
  ```

  A rerun of the failed jobs of the same commit passed. The Linux and macOS native jobs of that run passed.

- **Suspected source:** Not confirmed. The order depends on which background future takes the worker first after the foreground render ends. The test polls `second` again before it joins `first`, and the Windows scheduler can then let `second` record its route first. Either the test drives the futures in an order that does not prove request order, or `background_permit` can admit a later request before an earlier one.
- **Impact if no action:** The Native (windows-2025) job, and with it the required CI check, fails now and then on branches that do not touch this code. If the cause is in `background_permit`, background renders can run out of request order on Windows.
- **Root question:** Does `background_permit` admit queued background renders in request order on every platform, and does the test prove it without depending on the scheduler?
- **Options:**
  - **A.** Find the cause with repeated runs on a Windows runner. If `background_permit` can admit out of order, fix the admission and keep the test. If only the test depends on the scheduler, change the test so that it drives both futures deterministically, as the `deterministic-tests` skill says. Effort: Small.
  - **B.** Mark the test as flaky and rerun it on failure. It hides a possible ordering bug. Effort: Small.
- **Recommendation:** A. It finds out whether users can get renders out of order, and it removes the flake either way.
- **Action:** fix after merge, apply A, because the cause is unknown and the failure is outside the branch that found it.
