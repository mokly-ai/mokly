# Mockup screenshots fail now and then in CI

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from CI run 45212667020 of the branch
  `conductor/storybook-support-j-spike-for-decision-18`, pull request #349.
- **Location:**
  - `docs/mockups/src/_tests_/disk.spec.ts:144` and `:239`: the disk test
    and its screenshot call.
  - `docs/mockups/src/_tests_/emails.spec.ts:34` and `:91`: the email test
    and its screenshot call.
  - `apps/mockups/playwright.config.ts:30-31`: `fullyParallel: true` and
    `workers: 2`.
- **Reason:** The failure comes and goes in CI on a branch that changes no
  code, so one fix in its own branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Background:**
  - The `Mockup checks` job of CI runs
    `cargo xtask check --suite cloud-mockups`. Its Playwright tests in
    `docs/mockups/src/_tests_/` take a screenshot of each page of the cloud
    mockup catalogue.
  - On 2026-11-23, CI run 45212667020 failed this job twice on one commit.
    Each time one test of 2,076 failed with this text:
    `Error: page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot`
    - Attempt 1: `disk.spec.ts:144:3 › disk: static/mokly-generated/product/account/choose-repository/slug-taken/index.mobile.html`.
      Its call log ended after "fonts loaded".
    - Attempt 2, a rerun of the failed jobs:
      `emails.spec.ts:34:7 › hosted invitation document at 1440px in light`.
    - Each failed test passed in the other attempt.
  - That commit differed from its base only in Markdown files under
    `plans/`, which the mockup catalogue does not include. Both attempts ran
    2,076 disk tests, as the base does.
  - On the same day, the full suite passed locally on the base commit
    `63d6a377`, with Playwright's Chromium headless shell 149.0.7827.55:
    2,076 disk tests in 10.5 minutes and 10 serve tests in 2.2 minutes.
  - The five push runs of CI on `main` before that failure passed this job.
  - Suspected source: Chromium on the CI runner sometimes cannot capture a
    screenshot, for example under memory or GPU pressure, so any one of the
    screenshot tests can fail.
- **Problem:** One failed screenshot capture fails the whole job, and with
  it Required CI, although no page changed.
- **Impact if no action:** Required CI fails now and then on branches that
  change no mockup, and each failure costs a rerun.
- **Root question:** How does the mockup suite take its screenshots on the CI
  runner without random capture failures?
- **Options:**
  - **A.** Reproduce the failure on the CI runner, name its cause, and fix
    it there, for example in the worker count, the browser flags, or the
    browser's memory. Effort: Medium.
  - **B.** Capture once more after this one protocol error, and fail on any
    other error or a second failure. This adds a retry, which needs the
    user's approval. Effort: Small.
- **Left out:** A longer timeout: the error is not a timeout.
- **Wider fix:** A, because it removes the cause for every screenshot test.
- **Previous examples:** None found.
- **Recommendation:** A. It finds the cause, and B would hide each later
  capture failure behind one retry.
- **Action:** fix after merge, apply A, because the failure is outside the
  diff of the branch that found it.
