# Site docs page hydration check flakes

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from a local run of the `cloud-site` suite on the
  branch `calummoore/mokly-earlier-postcss-start-bdhv`, which does not change
  `apps/site`.
- **Location:** `apps/site/tests/browser/pages.spec.ts:77`.
- **Reason:** The branch that saw it does not touch the site, so one fix in its
  own branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Astro island:** an `astro-island` element that Astro renders for a client
    component. It keeps an `ssr` attribute until the component hydrates in the
    browser.
- **Background:**
  - The test "`/docs/authoring/screens/` meets the deterministic accessibility
    contract" opens the page and expects `astro-island[ssr]` to have a count of
    0 within the default 5-second expect timeout, before it checks the page
    structure.
  - It runs for five viewports: 320 px light, 390 px light and dark, and
    1440 px light and dark.
- **Problem:** The check failed once in a complete local `cloud-site` run on a
  4-CPU machine (1 failed, 508 passed). The failure text: "Error:
  expect(locator).toHaveCount(expected) failed. Locator:
  `locator('astro-island[ssr]')`. Expected: 0. Received: 2. Timeout: 5000ms."
  The failing project was `1440-light`. A rerun of the same test in all five
  viewports passed 5 of 5 at once.
- **Occurrences:**
  - 2026-11-22, the local `cloud-site` run above: `/docs/authoring/screens/`,
    `1440-light`.
  - 2026-11-22, the `Site checks` job of the CI of PR #472 at `bb59546ba`
    (run 45015168777, job 137186011114, step "Verify the partition"):
    "`/docs/ci/the-check-on-a-pull-request/` meets the deterministic
    accessibility contract" at `390-light`, with the same failure text
    (received 2 within 5000 ms) and 508 other tests passed. The one rerun of
    the job passed (attempt 2, job 137190782856). That branch did not change
    `apps/site` or `packages/`.
- **Impact if no action:** The cloud-site suite of the gate fails now and then
  without a site defect.
- **Root question:** How does the check wait for the islands of a docs page to
  hydrate, without a time bound that machine load can pass?
- **Options:**
  - **A.** Wait for an explicit readiness signal of the page, for example an
    attribute that the page sets after its islands hydrate, before the count.
    Effort: Small.
  - **B.** Wait for the load state and for each island to lose its `ssr`
    attribute one by one through an event that Astro dispatches on hydration.
    Effort: Small.
- **Left out:** A longer timeout or a retry: the testing rules forbid them, and
  they hide the race.
- **Wider fix:** A, if the site helpers give every browser test the same
  readiness wait.
- **Previous examples:** None found.
- **Recommendation:** A. It removes the race at its source.
- **Action:** fix after merge, apply A, in a branch that owns `apps/site`.
- **Suspected source:** The suite ran directly after the `cloud-mockups` and
  `cloud-app` suites on a 4-CPU machine. Under that load, the hydration of two
  islands on that page took more than 5 seconds.
