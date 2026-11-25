# Overlap test counts a sidecar after its handoff

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the complete gate of branch
  `calummoore/e2b-build-enabling-vbbo`, which does not change `mokly-server`.
- **Location:** `crates/mokly-server/src/_tests_/overlap/support.rs:85` to
  line 92, and the assertion at
  `crates/mokly-server/src/_tests_/overlap/scheduling_tests.rs:57`.
- **Reason:** The testing skill fixes an unrelated flaky test in its own
  branch, so that one fix reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Sidecar place:** one of the limited slots in which a background render
    runs its sidecar step. The test allows two.
  - **Handoff:** `completion.handoff(charge)`. The render gives back its
    sidecar place and moves on to its completion step.
  - **Sidecar peak:** the highest number of renders that the test's counter
    saw in their sidecar step at the same time.
- **Background:**
  - The test
    `background::overlap_tests::scheduling_tests::root_handoffs_overlap_with_bounded_completion_and_ordered_reports`
    runs four background renders with two sidecar places. At line 57 it
    asserts that the sidecar peak is 2.
  - The mock `background_read` in `support.rs` adds 1 to
    `counts.sidecars` when a render starts, and records the peak. After the
    handoff, it subtracts 1.
  - The handoff gives the place back before the mock subtracts 1. So the next
    render can start, and add 1, while the counter still counts the render
    that handed off. The counter then reads 3, and the peak becomes 3.
- **Problem:** On 2026-11-24, one complete gate run failed at line 57 with
  `assertion left == right failed, left: 3, right: 2`. Two earlier complete
  gate runs on the same machine passed it. After the failure, the test passed
  20 of 20 runs alone with
  `cargo test --locked -p mokly-server --lib root_handoffs_overlap_with_bounded_completion_and_ordered_reports`.
  The order above is the suspected source. No trace confirms it yet.
- **Impact if no action:** the test fails at random under load and stops the
  complete gate of any branch, also when the product code is correct.
- **Root question:** how does the test count the sidecar places in use
  without counting a render that already gave its place back?
- **Options:**
  - **A.** In the mock, subtract 1 from `counts.sidecars` before
    `completion.handoff(charge)`. Keep every assertion. First prove the race:
    add a test-only pause after the handoff and before the subtraction, and
    see the test fail with `left: 3`. Effort: Small.
  - **B.** Measure the places in use from the product's own place count, not
    from a counter in the mock. Effort: Medium.
- **Left out:** retrying the test or raising the peak limit to 3. Both hide a
  real overrun of the place limit.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A. It matches the counter to the moment the place is
  given back, and it keeps the test's check of the place limit.
- **Action:** fix after merge, apply A, in a branch from `main`.
