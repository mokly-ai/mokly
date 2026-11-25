# Site CSS tests read the union by default

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from branch `calummoore/stylesheets-listing-51ma`, review item 2.
- **Location:** `docs/mockups/src/_tests_/site-stylesheets.ts`, `docs/mockups/src/_tests_/design-site-test-helpers.ts`, and `apps/site/tests/styles-focus.test.ts`.
- **Reason:** It changes the reader calls of the tokens, containers and parity tests, which the branch that found it did not change.
- **Category:** Test.

- **Terms:**
  - **Site CSS reader:** `siteStylesheets(screen?)` in `docs/mockups/src/_tests_/site-stylesheets.ts`, and `siteStyles(screen?)`, `siteRules`, `assertHoverChangesMoreThanColor` and `assertStrongBoundaries` in `design-site-test-helpers.ts`. Each reads the sheets of one site mockup page, or of all site pages without a screen.
  - **The union:** what a site CSS reader returns without a screen: the sheets of every site page together. No single page loads it.
- **Background:** Each site mockup screen under `docs/mockups/src/screens/design/site/` imports its CSS through style modules: a shared module first, then the module of its own area. So a site page loads only the shared sheets and the sheets of its own area. The tests of one page pass their screen to the site CSS reader. The chrome, menu and focus checks run once for each site screen. The tokens, containers and parity tests read the union, because their checks must hold in every sheet.
- **Problem:** The screen is optional, so a new check reads the union when its author forgets the screen. A check of a part that every page draws then passes when any one page has the rule.
- **Impact if no action:** A later check of a shared part can miss a page that lost the rule.
- **Root question:** How does a new site CSS check name the pages that it reads?
- **Options:**
  - **A.** Make the screen a required argument of each site CSS reader. Give the union its own name, such as `everySiteStylesheet()`. Change the tokens, containers, parity and focus tests to call it. Update the key code list of `docs/mockups/README.md`. Effort: Small.
  - **B.** Keep the optional screen, and add a doc comment that says when to read the union. Effort: Small.
- **Left out:** Change nothing. A comment that B adds is easy to miss, so A is the structural fix.
- **Wider fix:** A.
- **Previous examples:** The chrome and menu tests read the union for their checks of shared parts until review item 2 of the same branch moved them to one run per screen.
- **Recommendation:** A. It removes the union as the default input.
- **Action:** fix after merge, apply A, because it changes tests outside the branch that found it.
