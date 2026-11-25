# Docs say the site links sign-in

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the review of `calummoore/cloud-sign-up-uadj`.
- **Location:** `docs/ops/environment.md:69`,
  `docs/protocol/cloud/product-navigation.md:24`.
- **Reason:** The two sentences were already wrong on `origin/main`, and the
  branch that found them changed only the Get started links.

- **Source:** Review.
- **Category:** Docs or spec.
- **Background:** `docs/protocol/cloud/site.md`, section Get Started, and
  `docs/protocol/cloud/marketing-site.md`, section Links From The Site To
  The App, say that the site links one app route, `/sign-up`, and has no
  **Sign in** link. `APP_PATHS` in `apps/site/src/navigation.ts` holds only
  `signUp`.
- **Problem:** `docs/ops/environment.md:69` says the production site links
  to the app with `/sign-in` and `/sign-up`. The route table in
  `docs/protocol/cloud/product-navigation.md:24` says `/sign-up` and
  `/sign-in` are both linked from the public site.
- **Impact if no action:** A reader of the ops or navigation docs expects a
  site link to `/sign-in` that does not exist, and can add one or test for
  it.
- **Root question:** How do the ops and navigation docs describe the site's
  links into the app?
- **Options:**
  - **A.** Correct both sentences: the site links only `/sign-up`. Effort:
    Small.
  - **B.** Replace both sentences with a link to
    `docs/protocol/cloud/marketing-site.md#links-from-the-site-to-the-app`,
    which owns the rule. Effort: Small.
- **Left out:** Adding a **Sign in** link to the site, because `site.md`
  records that the site has none.
- **Wider fix:** None. The `documentation` skill already gives each fact one
  owner.
- **Previous examples:** `plans/follow-ups/pr-39-doc-fixes-still-apply.md`
  lists other cloud doc sentences that differ from the code.
- **Recommendation:** B. The route rule then has one owner.
- **Action:** fix after merge, apply B.
