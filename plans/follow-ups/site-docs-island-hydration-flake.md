# Site docs page hydration check flakes

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from a local run of the `cloud-site` suite on the
  branch `calummoore/mokly-earlier-postcss-start-bdhv`, which does not change
  `apps/site`.
- **Location:** `apps/site/tests/browser/pages.spec.ts:77`,
  `apps/site/src/layouts/Docs.astro:88`, and
  `apps/site/src/components/Header.astro:34`.
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
- **Problem:** The check fails now and then, on more than one docs page:
  first in a complete local `cloud-site` run on a 4-CPU machine (1 failed, 508
  passed), and then in the CI of PR #472. The failure text: "Error:
  expect(locator).toHaveCount(expected) failed. Locator:
  `locator('astro-island[ssr]')`. Expected: 0. Received: 2. Timeout: 5000ms."
  In the local run, the failing project was `1440-light`, and a rerun of the
  same test in all five viewports passed 5 of 5 at once.
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
  - 2026-11-24, the `Site checks` job of the CI of PR #495 at `6c1d2ea9e`
    (run 45449917789, step "Verify the partition"):
    "`/docs/authoring/viewports-and-color-schemes/` meets the deterministic
    accessibility contract" at `390-dark`, with the same failure text. The one
    rerun of the job passed. That branch did not change `apps/site` or
    `packages/`.
- **Impact if no action:** The cloud-site suite of the gate fails now and then
  without a site defect.
- **Root question:** How does the check wait for the islands of a docs page to
  hydrate, without a time bound that machine load or a late idle callback can
  pass?
- **Options:**
  - **A.** Wait for an explicit readiness signal of the page, for example an
    attribute that the page sets after its islands hydrate, before the count.
    It still waits for the idle callback of both islands. Effort: Small.
  - **B.** Wait for the load state and for each island to lose its `ssr`
    attribute one by one through an event that Astro dispatches on hydration.
    Effort: Small.
  - **C.** Hydrate the two islands without the idle wait, with `client:load`,
    or with `client:idle={{ timeout: 500 }}`, which bounds the wait. Cost: the
    code of the search and the copy button loads earlier on each docs page.
    Effort: Small.
- **Left out:** A longer timeout or a retry: the testing rules forbid them, and
  they hide the race.
- **Wider fix:** A, if the site helpers give every browser test the same
  readiness wait.
- **Previous examples:** None found.
- **Recommendation:** C. It removes the idle wait that the suspected source
  names, and a readiness signal after hydration waits for the same idle time.
  Until 2026-11-22 the recommendation was A.
- **Action:** fix after merge, apply C, in a branch that owns `apps/site`.
- **Suspected source:** Each docs page has two `client:idle` islands, the
  search in `apps/site/src/components/Header.astro:34` and the copy button in
  `apps/site/src/layouts/Docs.astro:88`, and both failures report two islands
  that did not hydrate. Astro starts a `client:idle` island through
  `requestIdleCallback`, with no timeout, so a busy browser can delay both past
  5 seconds. Until 2026-11-22 this line named only the load of earlier suites
  on a 4-CPU machine, which does not fit the CI occurrence.
