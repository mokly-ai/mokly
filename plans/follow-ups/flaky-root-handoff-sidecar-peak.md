# Flaky root handoff test counts a released sidecar

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the complete gate of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, which its review of
  round 1 lists outside the scope.
- **Location:**
  - `crates/mokly-server/src/_tests_/overlap/scheduling_tests.rs:16-63`: the
    test. Line 57 holds the assertion that failed.
  - `crates/mokly-server/src/_tests_/overlap/support.rs:82-107`: the
    scripted render. Lines 85-88 add to the sidecar counter, line 92 calls
    the handoff, and line 93 subtracts from the counter.
  - `crates/mokly-server/src/background_stage.rs:191-210`: `Stage::handoff`,
    which releases the worker permit at line 203.
- **Reason:** The test fails now and then on branches that do not touch it,
  so one fix in its own branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Sidecar place:** a permit of the worker semaphore of `Workers` in
    `crates/mokly-server/src/work.rs`, which a background render holds while
    it uses a sidecar.
  - **Handoff:** the call of `Completion::handoff` when the root render of a
    view is done, which moves the view from its sidecar place to completion.
- **Background:**
  - The Rust test
    `background::overlap_tests::scheduling_tests::root_handoffs_overlap_with_bounded_completion_and_ordered_reports`
    checks the overlap of four background renders in `mokly-server`. It
    makes `Workers` with two sidecar places and a completion bound of two.
  - The test scripts each render through gates in `support.rs`. Each
    scripted render counts the sidecar places and the completion places that
    the renders hold, and it records the peak of each count.
  - Line 57 asserts that `sidecar_peak`, the highest count of held sidecar
    places, is 2. Line 58 asserts the same for `completion_peak`.
  - The test runs in the repository suite of the complete gate, through
    `cargo test --locked -p "mokly-*" -p xtask`.
  - On 2026-11-25, it failed once in the complete gate, on a 4-core machine,
    while another agent read the repository. The failure text was:
    `panicked at crates/mokly-server/src/_tests_/overlap/scheduling_tests.rs:57:5: assertion left == right failed, left: 3, right: 2`.
  - Rerun outcome: 20 of 20 passes of the test alone, and 10 of 10 passes of
    the whole `mokly-server` lib suite. The branch did not touch
    `crates/mokly-server`.
  - The test file last changed in commit `cb233fb50`, "perf(serve): keep
    sidecars busy during the head usage pass (#408)", of 2026-11-20.
  - Suspected source, from a read of the code: async ordering between two
    threads.
    - The scripted render adds one to `counts.sidecars` when it starts, and
      records the peak, at `support.rs:85-88`.
    - After its root gate opens, it calls `completion.handoff(charge)` at
      line 92. Only then does it subtract one from `counts.sidecars`, at
      line 93.
    - `Stage::handoff` releases the sidecar place inside that call. It drops
      the worker permit at `background_stage.rs:203`.
    - So the next view can start on another blocking thread and add one to
      `counts.sidecars` before line 93 runs. The counter then reads 3, and
      the peak keeps 3, while the scheduler held only two places.
    - Under CPU load, the first thread can pause between line 92 and line 93.
      On an idle machine, that pause seldom happens.
  - The completion count cannot rise in the same way. The scripted render
    adds to it after the handoff takes the completion place. It subtracts
    from it before the place is free.
- **Problem:** The test counts a sidecar place as held after the scheduler
  has released it. So the peak can read 3 while the bound of two places
  holds.
- **Impact if no action:** The repository suite fails now and then on
  unrelated branches, and each failure costs a rerun of the complete gate.
- **Root question:** How can the test measure the peak of held sidecar places
  without counting a place that the scheduler has already released?
- **Options:**
  - **A.** In `support.rs`, subtract one from `counts.sidecars` before the
    call to `completion.handoff(charge)`. The count then drops before the
    place is free. Keep every assertion. Only this test reads `sidecar_peak`
    or `counts.sidecars`. When a charge does not fit, the handoff keeps the
    place, and the count is one low until the view ends. No test that reads
    the count uses such a charge. Effort: Small.
  - **B.** Count the held places on the production side: let the test read
    the free permits of the worker semaphore of `Workers`. This needs a
    reader of `Workers` for tests only. Effort: Medium.
- **Left out:** A retry, a sleep, or a longer wait: each hides the race, and
  the deterministic-tests rules of the `testing` skill forbid them.
- **Wider fix:** None, because the race is in the counter of this one test
  helper.
- **Previous examples:** `plans/follow-ups/flaky-background-window-capacity-test.md`,
  another background test in `mokly-server` whose concurrent renders race.
- **Recommendation:** A. It removes the race and keeps every assertion.
- **Action:** fix after merge, apply A, because the test is outside the diff
  of the branch that found it.
