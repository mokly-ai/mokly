# Served product flow tests run near their timeout

- **Severity:** Medium (estimate). **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from [PR #79](https://github.com/mokly-ai/mokly-cloud/pull/79). Updated on 2026-10-30 with four CI failures on the closed re-land pull requests, and with the recurrences that two deleted plans recorded.
- **Location:** `docs/mockups/src/_tests_/product-serve.spec.ts:87-162`, `apps/mockups/playwright.config.ts:33` and `apps/mockups/playwright.serve.config.ts:8-9`.
- **Reason:** The test and its configuration were the same on `main` of the old cloud repository, so a separate branch fixes it.
- **Checked:** 2026-10-31, at commit `f568853e`. Not verified. One test still visits all screens of a flow in both schemes under one 45-second timeout. No current CI duration or failure trace shows how close it runs to that guard.
- **Category:** Test.

- **Terms:**
  - **Product flow test:** `product flow <journey> visits every owning mobile screen` in `docs/mockups/src/_tests_/product-serve.spec.ts`, which the serve suite runs.
  - **Hang guard:** A test-runner timeout that only stops a hung test. The `deterministic-tests` skill keeps it at least three times the typical duration.
- **Background:** The list below gives the facts.
  - The product flow test runs once for each of the onboarding, browse and invitation flows.
  - Each run visits every screen of its flow in both color schemes. The eight onboarding screens make 16 captures.
  - Each capture needs two navigations: the Browse page and the screen's own fragment page. So the onboarding run makes 32 navigations.
  - It checks that each owning mobile screen opens with no page error and no failed request.
  - All visits share one 45-second timeout. `apps/mockups/playwright.config.ts:33` sets it, and `apps/mockups/playwright.serve.config.ts` inherits it. Since the cloud moved into this repository on 2026-11-17, the `cloud-mockups` suite runs this test.
  - Three local runs took 16.1 to 19.3 seconds on the base of the PR #79 stack, and 17.1 to 20.5 seconds on PR #79. So PR #79 did not slow the test.
  - Earlier CI failures suggest that CI runners run the test close to 45 seconds. No current CI duration confirms it.
- **Problem:** Earlier CI runs failed at the hang guard, and the reruns passed. So the guard was then less than three times the CI duration. Nobody measured the duration at commit `f568853e`.
- **Impact if no action:** CI can keep failing at random on the product flow test. Each failure costs a rerun, and its message reads like a product defect.
- **Root question:** How does the product flow check stay far below its hang guard on a slow runner?
- **Options:**
  - **A.** Give the test a timeout of at least three times its typical CI duration, with `test.setTimeout`. It is a longer time limit, which the flaky-test rule of the `deterministic-tests` skill allows only with the user's approval. Effort: Small.
  - **B.** Make one test for each screen and scheme. Each test then does one visit and one capture, far below the shared timeout. Keep every assertion. Effort: Small.
- **Left out:** A retry of the test. The flaky-test rule forbids a retry. A removal of the test. It is the only served check of every owning screen of the product flows.
- **Wider fix:** B. It is the structural fix, because the duration of each test no longer grows with its flow.
- **Previous examples:** None found.
- **Recommendation:** B. Each test then runs far below its hang guard, also when a flow gains screens.
- **Action:** ask the user, because condition 3 holds: the `deterministic-tests` skill sends a slow test and a longer time limit to the user. Before the choice, get the current CI duration of each flow. For a failure, get its failing step and trace.

Failures, as history. They do not prove a failure at commit `f568853e`. Each failure starts with `Test timeout of 45000ms exceeded.`

- CI run 40907872529 on PR #79, 2026-10-29, failed the onboarding flow. A
  local run on 2026-10-29 failed the browse flow the same way on its last
  capture. Both passed on a rerun, and the same tests passed on PR #77 and
  PR #78.
- CI run 40396307516 on PR #62, 2026-10-26, attempt 1: the second line is
  `Error: page.goto: Test timeout of 45000ms exceeded.` The test was opening
  `/view/product/viewer/standalone/publish/publishing/`. Attempt 2 passed.
- CI run 40424731681 on PR #66, 2026-10-27, attempt 1: the same `page.goto`
  error, while the test was opening `/view/product/account/project-created/`.
  Attempt 2 passed.
- CI run 40431240029 on PR #67, 2026-10-27, attempt 1: no second error line.
- The same run, attempt 2: the second line is
  `Error: page.evaluate: Target page, context or browser has been closed`, at
  `product-serve.spec.ts:161` in the capture step. Attempt 3 passed.
- The deleted [desktop app shell plan](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L751-L754)
  recorded the onboarding flow at its 45-second guard in hosted CI, before
  2026-10-21. The baseline and the local gate passed.
- The deleted [Foundation plan](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L559-L562)
  recorded the same timeout for the onboarding flow on PR #54 and PR #51. Both
  passed on a rerun.

The suspected source is runner speed against the one shared 45-second
timeout. Nobody reproduced that cause. No failure points to a product defect.
