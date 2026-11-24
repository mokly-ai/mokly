# Pricing sign-up actions are not pressed

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from `calummoore/cloud-sign-up-uadj`: the pricing
  problem that the check of review finding 3 listed outside the scope.
- **Location:** `apps/site/tests/browser/pricing.spec.ts:22-38`.
- **Reason:** The press check was already missing on `origin/main`, so a fix
  in the branch that found it widens that branch, which needs Cal's choice.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Site preview:** the Astro preview server that the site browser specs
    use. It serves the built site only. It answers `/sign-up` with a 404
    and keeps that address, because the site sets `trailingSlash: "always"`.
- **Background:**
  - The site links one app route, `/sign-up`. The header, the menu and the
    home hero **Get started**, and **Create an account** and **Start a
    7-day trial** on the pricing page open it.
  - On 2026-11-24, branch `calummoore/cloud-sign-up-uadj` made the header
    and hero tests press their link and check that the address ends in
    `/sign-up`. A test in `apps/site/tests/browser/chrome.spec.ts` presses
    each menu link at 390px.
  - `apps/site/tests/browser/pricing.spec.ts`, test "the plan actions and
    the docs link open their targets", checks the `href` of **Create an
    account** and **Start a 7-day trial** and does not press them.
  - `apps/worker/tests/routing.test.ts` checks that app paths go to the
    app. `packages/app/src/_tests_/account.spec.ts` opens `/sign-up`.
- **Problem:** A script or a drawing that blocks a press on a pricing
  sign-up action passes the gate, because the test checks only the `href`.
- **Impact if no action:** A visitor can fail to open sign-up from the
  pricing page while CI passes.
- **Root question:** When does the pricing page get the same press check as
  the header and the hero?
- **Options:**
  - **A.** Press **Create an account** and **Start a 7-day trial** in
    `pricing.spec.ts` in the branch that found the gap, and check that the
    address ends in `/sign-up`. Effort: Small.
  - **B.** Do the press of A after the merge, in its own branch. Effort:
    Small.
  - **C.** Change nothing. The `href` checks prove the link targets.
    Effort: Small.
- **Left out:**
  - A test setup that runs the site and the app behind the origin router
    and presses each site link into the app. On 2026-11-24 Cal chose to add
    no such setup, because the site presses, the router tests and the app
    tests each cover one part.
  - A stand-in `/sign-up` page through `page.route`, because the site
    browser-test rules allow `page.route` only for third-party traffic.
  - A press check in the deployment smoke, because it runs after the merge.
- **Wider fix:** None. Cal rejected the site-and-app test setup on
  2026-11-24.
- **Previous examples:** The header test before 2026-11-24, which checked
  only the `href` of the sign-up **Get started**.
- **Related:** `plans/follow-ups/preview-hosts-serve-no-marketing-site.md`
  has the same cause: only production serves the site and the app on one
  origin.
- **Recommendation:** A. It is a small change in a file that the branch
  already changes.
- **Action:** ask the user, because A widens the branch to a gap that was
  already on `origin/main`.
