# Component navigation exposes duplicate removed previews

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from `calummoore/mokly-flaky-viewer-pick-navigation-tests-i26g` during its local complete gate.
- **Location:** `tests/browser/component_design_inspection_cases.ts:109-196`, especially line 174; `tests/browser/component_design_inspection.spec.ts`.
- **Reason:** This failure is outside the viewer-pick test change, and its source is not confirmed.
- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Removed preview:** The saved earlier version of a screen that the current catalogue no longer contains.
  - **Strict locator:** A Playwright query that must match exactly one element before an element assertion can run.
- **Background:** Mokly's component-design examples show both current and removed screens. The browser test checks missing metadata, empty usage, invisible instances, and removed states at desktop and mobile widths.
- **Problem:**
  - The test `mobile component designs › missing metadata, empty usage, invisible instances, and removed states stay distinct` failed in the complete gate on main base `0accb6818`.
  - The gate used Node 24.22.1, Chromium, and one browser worker. Its browser suite finished with 2,285 passes, two failures, and no skips.
  - The test clicked the `Farewell` affected-usage link. It then checked the destination URL and the `Showing previous version` banner.
  - Its next assertion expected this locator to be visible:

    ```text
    locator('.ce-preview-view:visible').getByText('Come back whenever you are ready.', { exact: true })
    ```

  - Playwright reported `strict mode violation` because the locator resolved to two paragraph elements with the same farewell text.
  - The saved failure trace confirmed that assertion. The later page snapshot showed one mobile farewell preview.
  - One focused rerun passed: one pass, no failures, and no skips. The test body took 785 ms.
  - No assertion, timeout, retry, fixture, or product source changed between the failure and its rerun.
  - Suspected source: the navigation or viewport handoff exposes both preview copies before the test observes the final visibility state. This source is not confirmed.
  - Reproduce through the public browser command:

    ```sh
    npm run test:browser -- tests/browser/component_design_inspection.spec.ts -g 'mobile component designs.*missing metadata, empty usage, invisible instances, and removed states stay distinct'
    ```

- **Impact if no action:** A required browser check can fail on correct changes. Repeated CI runs slow merges and hide the source.
- **Root question:** How can this navigation test keep every check and pass independently of browser scheduling?
- **Options:**
  - **A.** Capture both preview copies during a controlled reproduction. Name the source, then wait for its explicit readiness signal in this test. Keep every assertion. Effort: Medium.
  - **B.** Put the confirmed readiness step in one shared component-design navigation helper. Use it for the other tests with that same source. This prevents repeated local fixes. Effort: Medium.
  - **C.** If the reproduction shows two previews remain visible after the navigation settles, report and fix the preview defect. Keep this test's current assertions. Effort: Medium.
- **Left out:** Retries, sleeps, longer timeouts, and weaker assertions hide the failure and break the test timing contract.
- **Wider fix:** B prevents the readiness mistake across component-design navigation tests, if that source is confirmed.
- **Previous examples:** None found for this exact duplicate-farewell failure. Other navigation flakes do not establish this source.
- **Recommendation:** A. Confirm the source before choosing a test fix or a preview fix.
- **Action:** ask the user, because the source is unconfirmed and either the test or the preview can require the fix.
