# Site docs page hydration check flakes

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
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
  - On 2026-11-22 the check failed again, in a complete local gate run of
    commit `7db27be57` on the branch
    `calummoore/fu-marked-folder-listing-fixes-8vkl`, which does not change
    `apps/site`. Of 509 browser cases, only "`/docs/authoring/config/` meets
    the deterministic accessibility contract" failed, in the project
    `1440-dark`. The failure text was the same: "Error:
    expect(locator).toHaveCount(expected) failed. Locator:
    `locator('astro-island[ssr]')`. Expected: 0. Received: 2. Timeout:
    5000ms." A rerun of that case alone passed 1 of 1 at once, in 655 ms. As
    in the first failure, the suite ran directly after the `cloud-mockups` and
    `cloud-app` suites on a 4-CPU machine. So the suspected source below fits
    this failure too, but it stays unconfirmed.
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
