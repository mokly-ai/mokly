# Test the build render-once requirement

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #220 and its completed plan, finding 1 of
  its first review.
- **Location:** `tests/static_capture_timing.test.ts:8` and
  `docs/protocol/mokly-runtime.md:52`.
- **Reason:** The review of PR #220 left the finding open when the pull
  request merged on 2026-10-27, and no answer was recorded.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Head capture:** the compressed copy of every head document that
    `build` and `publish` render once during the build check. Changes, the
    output, and the comparison output restore documents from it.
  - **Timing record:** one JSON line that `--debug-timings` prints for a
    span, such as `review.capture-side` or `render.document`.
- **Background:**
  - Before PR #220, `build` and `publish` rendered every head document five
    times. PR #220 made the build check capture the head once, under the
    user's decision of 2026-10-26.
  - `docs/protocol/mokly-runtime.md:52` states the rule: the head reuses the
    capture, so a build renders each head document once.
  - The test "build capture timings report bounded retention for both
    sides" at `tests/static_capture_timing.test.ts:8` checks the
    `review.capture-side` records of both sides.
  - Rust tests in `crates/mokly-cli/src/_tests_/build_capture_tests.rs`
    check that `prepare` keeps the captured head for later reads.
- **Problem:** No end-to-end test fails when a later build stage renders a
  head document again outside the capture.
- **Impact if no action:** A change can bring back a repeated render pass.
  The build then stays correct but slower, and no gate reports it. On the
  large React fixture, the repeated passes cost 725 s of render time before
  PR #220.
- **Root question:** How does the test suite show that a build renders each
  head document only inside the head capture?
- **Options:**
  - **A.** Assert in `tests/static_capture_timing.test.ts` that every core
    `render.document` record has a `review.capture-side` ancestor. Effort:
    Small.
  - **B.** Count the `render.document` records of one build, and assert that
    the count equals the view count of the two captures. Effort: Small
    (estimate).
  - **C.** Change nothing, and rely on the Rust tests of `prepare`. They do
    not cover the output loop or the comparison output end to end. Effort:
    Small (estimate).
- **Left out:** A time limit on the build. The `deterministic-tests` skill
  forbids elapsed-time assertions.
- **Wider fix:** A. The ancestor check catches every new render path outside
  the capture, whatever stage adds it.
- **Previous examples:** None found.
- **Recommendation:** A. It checks the rule directly with the records that
  the test already reads.
- **Action:** ask the user, because condition 6 holds (estimate): the item
  asks for a missing test, and the review-fix rule gives every missing-test
  finding to the user.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/build-head-capture.md?plain=1#L205).
