# Test the build render-once requirement

- **Severity:** Low. **Effort:** Small.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #220 and its completed plan.
- **Location:** `tests/static_capture_timing.test.ts`.
- **Reason:** The review or plan deferred this work until after PR #220.

Assert that every core `render.document` record has a `review.capture-side` ancestor. This test protects the requirement that the build check captures each head document once.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/build-head-capture.md?plain=1#L205).
