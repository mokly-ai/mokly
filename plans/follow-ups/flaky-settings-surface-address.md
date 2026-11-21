# Settings surface test reads the old address

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from `calummoore/mokly-incremental-render-keys-38ts` during the frozen-base complete gate.
- **Location:** `apps/app/src/_tests_/settings/drafts.spec.ts:117`.
- **Reason:** The render-key change does not touch the app or this test, so its fix belongs in a separate branch.

- **Background:** The browser test checks that a settings draft survives switching between mobile and desktop surfaces. It also checks the exact address query. Its local `settleAddress` helper waits for two animation frames before reading the address.
- **Problem:** The desktop test named `a draft survives the surface changing under it` failed once. The existing runner retry passed. The dialog was visible, but the address still had its mobile form. The failure was `expect(received).toBe(expected)`, with expected `?handoff=one%26two+literal%2Bplus%23notes&tag=first&tag=second&settings=project` and received `?handoff=one%26two+literal%2Bplus%23notes&tag=first&tag=second`.
- **Impact if no action:** A passing application change can produce a flaky cloud-app check. The test can read the address before the route replacement commits.
- **Root question:** How should the test observe a completed settings-surface change?
- **Options:**
  - **A.** Wait for the expected address through an existing browser assertion. Preserve the exact query, draft, and unload-guard assertions. Effort: Small.
  - **B.** Move address-commit readiness into the shared settings browser helper. Use it wherever tests change surfaces. This needs an audit of those callers. Effort: Medium.
  - **C.** Make the product commit its address before it exposes the new surface. First establish whether the current order breaks a product requirement. Effort: Medium.
- **Left out:** More animation frames, sleeps, retries, and longer time limits do not establish that the address committed.
- **Wider fix:** B. A shared readiness helper prevents tests from treating animation frames as navigation completion.
- **Previous examples:** This test's `settleAddress` helper is the observed case. No other occurrence was established.
- **Recommendation:** B. Use one observable address-commit condition for the settings browser helpers.
- **Action:** fix after merge, apply B. Keep the fix separate from the render-key speed change.

The suspected source is asynchronous route replacement after a viewport change. This source was not confirmed. Reproduce the failure before choosing between a harness fix and a product fix. The observed run used the unchanged app code from `3e09c6150` with Node `24.21.0`, npm `11.21.0`, Chromium, and the cloud-app suite's isolated Postgres database. The runner's first retry passed. No assertion, retry configuration, or product code changed in response.
