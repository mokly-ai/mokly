# Site mockup Docs links open the Install guide

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from `calummoore/cloud-sign-up-uadj`, review finding 10.
- **Location:** `docs/mockups/src/screens/design/site/docs_screen.tsx:66`,
  `docs/mockups/src/screens/design/site/parts/docs-pages.ts:30-60`,
  `docs/mockups/src/screens/design/site/parts/links.ts:21-30`,
  `docs/mockups/src/screens/design/site/parts/actions.tsx:20`,
  `docs/mockups/src/screens/design/site/parts/pricing-plans.tsx:142`,
  `docs/mockups/src/screens/product/viewer/account-menu-screen.tsx:29`,
  `docs/protocol/cloud/site-mockups.md:22`, `:65-69`.
- **Reason:** Both fix rounds of the branch that found it were used, and the
  fix needs a new mockup state and a change to the docs page model.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Documentation landing:** the site page at `/docs/`, headed **Getting
    started**. Its source is `apps/site/src/pages/docs/index.astro`. It
    starts with the Mokly install command.
  - **Install guide:** the site page at `/docs/start/install/`, headed
    **Install**.
  - **Documentation screen:** the site mockup `design/site/docs` under
    `docs/mockups`. It draws the Install guide.
- **Background:**
  - On the site, every **Docs** link opens the documentation landing: the
    header, the menu, the footer, the home's open foundation and the
    pricing page's Open source plan. On 2026-11-24 Cal chose **Docs** to
    `/docs/` for the two actions beside the open-source CLI.
  - `docs/protocol/cloud/site-mockups.md` says that each site mockup action
    links the screen that owns its destination.
  - Every site mockup **Docs** link opens the documentation screen, which
    draws the Install guide. The header's **Docs** has done this since
    `6d4f4f6cf`. The viewer's account menu mockup does the same, while the
    app's **Docs** opens the site's `/docs/`
    (`packages/app/src/viewer/account-menu.tsx:53`).
  - The mockup tests `docs/mockups/src/_tests_/design-site-home.test.ts:91`
    and `docs/mockups/src/_tests_/design-site-pricing-copy.ts:16` expect
    `design/site/docs`, so they accept the mismatch.
  - The docs page model in `docs-pages.ts` draws only package guides from
    `docs/guides/{file}`, so a landing drawing needs a model change.
  - The header, the menu and the footer use the link target to mark the
    current page (`links.ts:21-30`, `currentPage` at `:70-75`).
- **Problem:** A site mockup **Docs** link shows the **Install** page. The
  site shows the **Getting started** landing.
- **Screenshot:** Select **Docs** in the Home mockup's open foundation, and
  the screen that opens shows the heading **Install**, where the site shows
  **Getting started**.
- **Impact if no action:** Design reviewers see a different first page for
  the documentation than readers of the site see.
- **Root question:** How should the site mockups show where **Docs** takes
  readers?
- **Options:**
  - **A.** Add a **Getting started** state to the documentation entry, point
    the **Docs** links to it, and check its heading. The current-page mark
    then needs a separate key. Effort: Medium.
  - **B.** Add a **Getting started** entry, and map the landing and the
    Install guide to separate screens in one mockup route table. The site
    screen counts in `site-mockups.md:7` and `marketing-site.md:116-118`
    change. Effort: Medium.
  - **C.** Make the documentation screen draw the landing, as each other
    site screen draws its own route. Move the Install guide to a new
    `install` state. Only the Install row of the docs tree (`docs-pages.ts:50`)
    and the Install tests move. The docs page reaches the five-screen limit
    of the `mockups` skill. Effort: Medium.
  - **D.** Do C, then send each site mockup link through one lookup keyed by
    the site route, such as `/docs/`. The lookup gives the screen that draws
    that route, or plain text when no screen draws it. Extend `OWNED_PAGES`
    and `docsPageScreen` in `docs-pages.ts:48-60` to the header, the menu,
    the footer, the home actions, the plan actions and the viewer's account
    menu. Effort: Medium.
- **Left out:** No change, an external link to the site, and plain text,
  because each takes reviewers away from the navigation under review.
- **Wider fix:** D. A link to a route without a drawing then shows plain
  text and does not open a nearby screen.
- **Previous examples:** The header's **Docs** since `6d4f4f6cf`, and the
  viewer's account menu mockup.
- **Related:** `plans/follow-ups/docs-landing-installs-react-for-everyone.md`
  asks Cal to change the install block of the landing. The mockups change
  first, so draw the landing together with that answer.
- **Recommendation:** C. The documentation screen then draws the page at
  `/docs/`, so every **Docs** link is right with no new key. D best protects
  the codebase.
- **Action:** fix after merge, apply C, because both fix rounds of the
  branch that found it were used.
