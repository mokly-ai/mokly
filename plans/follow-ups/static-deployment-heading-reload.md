# Stabilize headings during deployment reload

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the defaults-engine work of the Changes milestone.
- **Location:** `tests/browser/static_deployment.spec.ts:91` and
  `tests/browser/static_deployment.spec.ts:105`.
- **Reason:** The test failed once in an unrelated remote gate and passed in
  the next one, so a separate branch investigates it.

- **Source:** Review.
- **Category:** Test (estimate).
- **Terms:**
  - **Deployment reload:** the full page load that the standalone shell
    makes when a static catalogue's deployment id changes under it.
- **Background:** The test and its later fix are as follows.
  - `static_deployment.spec.ts` has one test, "a copied catalogue reloads on
    another deployment without comparison changes".
  - It opens a copied static catalogue, replaces the copy with another
    deployment, and checks the `#mb-main h2` heading before and after the
    reload.
  - A later fix by 2026-10-20 made the test wait for the replacement document
    load before it reads the heading, at line 105 today.
  - The record does not say whether the failed run had that wait.
- **Problem:** In one remote gate of the rebuild, the heading check matched
  two transient headings during the deployment reload. The next remote gate
  passed the test unchanged. The record names only the test's line 79 of
  that time, no failure text, and reload ordering as the suspected source.
- **Impact if no action:** A complete gate can fail on a test that the
  change did not touch, and the developer must rerun it.
- **Root question:** How should the test read the heading only after the
  replacement document owns the page?
- **Options:**
  - **A.** Drop the item unless the failure recurs after the later wait.
    Effort: Small (estimate).
  - **B.** Repeat the test to reproduce the failure, name its source, and
    wait on an explicit readiness signal of the replacement document. Keep
    every assertion. Record the pass counts before and after. Effort: Small
    (estimate).
- **Left out:** A retry, a sleep, or a longer timeout breaks the
  deterministic-test rule.
- **Wider fix:** B. A readiness signal of the replacement document removes
  the race for every check after a reload.
- **Previous examples:** Two other copied-deployment races of this test
  were fixed by 2026-10-20. A transient `404 /mokly-viewer/client/inspector.js`
  came from a request between the fixture's two directory renames. The fixture
  now publishes immutable copies through one root selection for each
  request. The title check raced the reload, and the test now waits for the
  replacement document load.
- **Recommendation:** B. (estimate) It finds out whether the later wait
  already covers the failure.
- **Action:** ask the user (estimate), because the failure has not been
  reproduced, and the flaky-test rule asks the user for an unknown source.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L1715).
