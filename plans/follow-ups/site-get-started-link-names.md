# Two Get started links open different pages

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from `calummoore/cloud-sign-up-uadj`, review finding 4.
- **Location:** `apps/site/src/components/Actions.astro:28`,
  `apps/site/src/components/pricing/Plans.astro:48`,
  `docs/mockups/src/screens/design/site/parts/actions.tsx:26`,
  `docs/mockups/src/screens/design/site/parts/pricing-plans.tsx:142`,
  `docs/protocol/cloud/site-copy.md:71`, `docs/protocol/cloud/site-pricing.md:32`.
- **Reason:** Each option changes the approved site copy or the accessible
  names of site actions, which needs Cal's choice.

- **Source:** Review.
- **Category:** UX wording.
- **Terms:**
  - **Accessible name:** the label that assistive technology reads for a
    link. For a site button link it is the visible text, because the arrow
    icon is decorative.
  - **Open foundation:** the home section about the open-source Mokly CLI,
    with Get started and View on GitHub.
- **Background:**
  - The public site in `apps/site` has five links labelled **Get started**.
    The header, the mobile menu and the home hero open the app's relative
    `/sign-up`. The open foundation and the pricing page's Open source plan
    open the Install guide, `/docs/start/install/`.
    `docs/protocol/cloud/site.md`, section Get Started, records this.
  - On 2026-11-24 Cal chose to keep the two CLI links on the Install guide
    with the visible label **Get started**. Renaming them was offered and
    not chosen.
  - `docs/protocol/cloud/site-delivery.md` asks for nonempty link names and
    a Lighthouse accessibility score of 1.0. Lighthouse 13.4.1 gives the
    identical-links audit weight 0. axe-core marks the rule minor and off by
    default. WCAG 2.4.9, link purpose from the link alone, is Level AAA.
- **Problem:** The home page and the pricing page each have two links with
  the name **Get started** that open different pages. A screen reader's
  links list shows names only, so it does not say which one opens account
  creation.
- **Impact if no action:** A reader who picks from the links list can open
  the wrong page and must go back. The paragraph or plan heading around each
  link names its target for a reader who reads in order.
- **Root question:** How can readers tell account creation from installing
  the open-source CLI before they follow a link?
- **Options:**
  - **A.** Give the two Install links the accessible name **Get started with
    the Mokly CLI** through `aria-label`, on the site and in the mockups.
    The visible label stays **Get started**. `MockLink` passes `aria-label`
    through. Add the name to `site-copy.md` and `site-pricing.md`, and find
    the open-foundation link by its new name in
    `apps/site/tests/browser/home.spec.ts`. Effort: Small.
  - **B.** Change the visible label of the two Install links to **Install
    Mokly CLI** on the site and in the mockups, with the copy docs and the
    tests. This is the rename that Cal did not choose on 2026-11-24.
    Effort: Small.
  - **C.** Change nothing. The context of each link names its target.
    Effort: Small.
  - **D.** Add a rule to the shared accessibility walk,
    `apps/site/tests/browser/accessibility.ts`, which
    `apps/site/tests/browser/pages.spec.ts` runs on every route: links on
    one page with one accessible name open one target. Add the rule to
    `site-delivery.md`. It is a new gate. About 26 other cases fail it
    first, such as the changelog links that
    `plans/follow-ups/changelog-links-share-names.md` records.
    Effort: Large.
- **Left out:** More text around the links or `aria-describedby`, because a
  links list shows names only. New names for the three sign-up links,
  because A changes fewer links and keeps the header name equal to its
  label. One target for every Get started, because it reverses Cal's
  choice of 2026-11-24.
- **Wider fix:** D. It fails on every page where one name opens two
  targets.
- **Previous examples:** The 23 **Read release details** links on
  `/changelog`, in `plans/follow-ups/changelog-links-share-names.md`.
- **Related:**
  - `plans/follow-ups/changelog-links-share-names.md`: the same class
    outside Get started. D covers both.
  - `plans/follow-ups/site-defect-classes-lack-site-wide-checks.md`: the
    other site-wide checks. On 2026-11-22 Cal chose to add no new gate in
    the Canvas redesign. D would join that list.
- **Recommendation:** A. It names each Install link in a links list and
  keeps the visible **Get started** that Cal chose. D best protects the
  codebase.
- **Action:** ask the user, because A adds an accessible name that the
  approved copy does not state, and B reverses the choice of 2026-11-24.
