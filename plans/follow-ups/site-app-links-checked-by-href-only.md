# Site links into the app are not pressed

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from `calummoore/cloud-sign-up-uadj`: the wider fix
  of review finding 3, with the pricing problem that the check of that
  finding listed outside the scope.
- **Location:** `apps/site/tests/browser/pricing.spec.ts:22-38`,
  `apps/site/tests/browser/chrome.spec.ts:110`,
  `apps/site/tests/browser/home.spec.ts:42`, `apps/site/scripts/preview.mjs`.
- **Reason:** The structural fix adds a test environment with the site and
  the app to the gate, which needs Cal's approval.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Site preview:** the Astro preview server that the site browser specs
    use. It serves the built site only. It answers `/sign-up` with a 404
    and keeps that address, because the site sets `trailingSlash: "always"`.
  - **Origin router:** the Cloudflare Worker in `apps/worker` that sends app
    paths such as `/sign-up` to the app and the other paths to the site.
- **Background:**
  - The site links one app route, `/sign-up`. The header, the menu and the
    home hero **Get started**, and **Create an account** and **Start a
    7-day trial** on the pricing page open it.
  - On 2026-11-24, branch `calummoore/cloud-sign-up-uadj` made the header
    and hero tests press their link and check that the address ends in
    `/sign-up`. The menu tests already press links in the same dialog.
  - `apps/site/tests/browser/pricing.spec.ts`, test "the plan actions and
    the docs link open their targets", checks the `href` of **Create an
    account** and **Start a 7-day trial** and does not press them.
  - `apps/worker/tests/routing.test.ts` checks that app paths go to the
    app. `packages/app/src/_tests_/account.spec.ts` opens `/sign-up`. No
    test runs the press from the site through the router to the app page.
- **Problem:** A script or a drawing that blocks a press on a pricing
  sign-up action passes the gate, because the test checks only the
  `href`. No test proves the handoff from a site press to the app's
  sign-up page.
- **Impact if no action:** A visitor can fail to reach sign-up from the
  pricing page, or from a site page whose app handoff breaks, while CI
  passes.
- **Root question:** How do the tests prove that a visitor can open the
  app's sign-up from every site link into the app?
- **Options:**
  - **A.** Press **Create an account** and **Start a 7-day trial** in
    `pricing.spec.ts` and check that the address ends in `/sign-up`, as
    the header and hero tests do. Effort: Small.
  - **B.** Run the site and the app behind the origin router in one local
    test environment. Press each site link into the app and check that the
    app's account heading appears. This is a new gate. Effort: Large.
  - **C.** Change nothing. The `href` checks prove the link targets.
    Effort: Small.
- **Left out:** A stand-in `/sign-up` page through `page.route`, because the
  site browser-test rules allow `page.route` only for third-party traffic.
  A press check in the deployment smoke, because it runs after the merge.
- **Wider fix:** B. It covers the whole handoff, router included.
- **Previous examples:** The pricing test above checks only the `href`
  since the pricing page got its sign-up actions.
- **Related:** `plans/follow-ups/preview-hosts-serve-no-marketing-site.md`
  has the same cause: only production serves the site and the app on one
  origin. Its option C serves each pull request's site beside its app on
  `pr-N.preview.mokly.ai`. A reviewer could then press the site's app links
  against the real app on each preview, but no gate test would run there.
- **Recommendation:** A. It closes the pricing gap with the press that the
  header and hero tests now use. B best protects the codebase.
- **Action:** ask the user, because B is a new gate, and A is the part
  without one.
