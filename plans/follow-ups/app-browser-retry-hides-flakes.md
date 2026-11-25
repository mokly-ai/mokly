# App browser suite retries hide flaky tests

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from the branch `calummoore/ci-speed-fix-cloud-flaky-tests-9c37`, the cloud flaky-test work of the CI speed task.
- **Location:** `packages/app/playwright.config.ts:43-45`, the `retries: 1` setting and its comment.
- **Reason:** The brief of the flaky-test work forbids a change to this setting without the user's approval.

- **Category:** Test.
- **Terms:**
  - **App browser suite:** the Playwright tests under `packages/app/src/_tests_/**/*.spec.ts`. They drive the exported web app against the real API, the `cloud-app` suite of `cargo xtask check`.
  - **Retry:** a second run of a failed test in the same job. Playwright reports a test that passes on its retry as flaky, and the job passes.
- **Background:**
  - `packages/app/playwright.config.ts` sets `retries: 1`. Its comment says that a shared machine can stall a step long enough to fail a correct run.
  - The other Playwright suites of the repository, such as the site suite and the mockup disk suite, set `retries: 0`.
  - The shared `testing` skill says that a retry in the runner configuration is not a fix. A test that passes only on a retry is flaky.
  - Each app test waits for states with time limits of 15 seconds for an expectation, 20 seconds for an action and 30 seconds for a navigation. These limits already cover a stalled step.
  - Between 2026-11-20 and 2026-11-25, the test `an account another workspace holds is refused with the way back` failed in CI runs 44769720531 and 44979962058. The retry did not help, because the cause was in the test. The cause was a wait that started after the click, and the branch of this item fixed it.
- **Problem:** A retry turns a flaky failure into a pass, so a new flaky test can enter the suite without a failed job. Each retry also adds the run time of the failed test to the job.
- **Impact if no action:** Flaky app tests stay hidden until they fail twice in one run. Nobody sees them, so nobody fixes them.
- **Root question:** How does the app browser suite show each flaky test, so that its cause gets fixed?
- **Options:**
  - **A.** Keep `retries: 1`, and report each test that passed on its retry: a CI step reads the Playwright report and prints a warning for each flaky test. The job still passes. Effort: Small.
  - **B.** Set `retries: 0`, as the site and mockup suites do. A flaky test then fails its job, and a rerun of the job is the only way past it. Effort: Small.
  - **C.** Set `retries: 0` in CI only, through `process.env.CI`, and keep one retry for local runs. Effort: Small.
- **Left out:** Raising the time limits. It hides the cause in the same way as the retry, and the testing rules forbid it.
- **Wider fix:** B. It makes every flaky test visible on the first failure.
- **Previous examples:** `plans/follow-ups/connect-refusal-way-back-flakes.md`, deleted by the branch of this item. There, the retry passed in the gate of 2026-11-03 and hid the same flake for three weeks.
- **Recommendation:** B. The suite then follows the testing rules and the other suites, and the time limits already cover a stalled step.
- **Action:** ask the user, because the option removes a setting that `main` has, and the brief of the flaky-test work reserves this change for the user.
