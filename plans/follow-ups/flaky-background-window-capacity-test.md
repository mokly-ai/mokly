# Flaky background window capacity test in mokly-server

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-23, from CI run 44832259300 of the branch
  `conductor/storybook-support-j-spike-for-decision-18`, pull request #349.
- **Location:** `crates/mokly-server/src/_tests_/background_batch/capacity_tests.rs:54-80`:
  the test. Line 72 holds the assertion that failed.
- **Reason:** The test fails now and then on branches that do not touch it,
  so one fix in its own branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Background:**
  - The Rust test
    `background::background_batch_tests::capacity_tests::a_background_window_grows_after_memory_recovers_and_a_render_ends`
    checks the window of background renders in `mokly-server`. It starts
    with room for one background render. Then it reports more free memory,
    ends the first render, and expects two more renders to start.
  - It runs in the `Repository` job of CI, through
    `cargo test --locked -p "mokly-*" -p xtask`.
  - On 2026-11-20, it failed in CI run 44832259300, attempt 1, at line 72,
    with `assertion left == right failed`,
    `left: "screen-1/index.mobile.html"`, and
    `right: "screen-0/index.mobile.html"`. A second panic followed on
    another thread, with this text:
    `Original Unimock instance destroyed on a different thread than the one it was created on.`
  - The same job passed on the rerun, attempt 2, of the same commit. That
    branch did not touch `crates/mokly-server`.
  - Suspected source: async ordering. The test asks for the views of
    `screen-0`, `screen-1`, and `screen-2`. Their document lookups run at
    the same time and race for the one place, so a later view can start
    first. A local measurement on 2026-11-20 saw the order break in 14 of
    3,500 runs.
- **Problem:** The test asserts the start order of views whose lookups run
  at the same time, and nothing fixes that order.
- **Impact if no action:** The `Repository` job fails now and then on
  unrelated branches, and each failure costs a rerun.
- **Root question:** How does the test check that the background window
  grows, without a race between its concurrent lookups?
- **Options:**
  - **A.** Let the test release the lookups one at a time, in request
    order, with an explicit signal, and keep every assertion. Effort: Small.
  - **B.** Assert the set of the first views that start in place of their
    order, when the requirement needs no order for them. Effort: Small.
- **Left out:** A retry or a longer wait: both hide the race.
- **Wider fix:** None, because the race is in this one test.
- **Previous examples:** On 2026-11-20, `main` failed the test
  `work::work_tests::background_tests::queued_background_renders_admit_in_request_order`
  at `crates/mokly-server/src/_tests_/work/background_tests.rs:139`, with
  renders out of request order: `left: ["foreground", "second", "first"]`
  and `right: ["foreground", "first", "second"]`.
- **Recommendation:** A. It removes the race and keeps every assertion.
- **Action:** fix after merge, apply A, because the test is outside the
  diff of the branch that found it.
