# No check ties each site sheet to its area

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from branch `calummoore/stylesheets-listing-51ma`, review items 2 and 3.
- **Location:** `docs/mockups/src/screens/design/site/styles/` and `docs/mockups/src/_tests_/`.
- **Reason:** It is a new test for a whole class, and the repository rules keep a new check for the user to approve.
- **Category:** Test.

- **Terms:**
  - **Style module:** a module under `docs/mockups/src/screens/design/site/styles/` that holds only CSS imports in cascade order: `shared.ts`, then one module per area, `home.ts`, `docs.ts`, `changelog.ts`, `pricing.ts` and `legal.ts`.
  - **Area:** one page family of the site mockups: the home, the documentation, the changelog, pricing, or the four legal pages.
- **Background:** Each site mockup screen imports the shared style module, then its area's module. `docs/protocol/cloud/mockup-tooling.md` requires that no site document loads a sheet of another area. A test in `docs/mockups/src/_tests_/design-site-screens.test.ts` checks that each screen loads the font sheets, then the shared module's sheets, then its area module's sheets. The per-screen chrome, menu and focus checks check that each page holds the rules of the shared parts. Both trust the contents of the style modules.
- **Problem:** No check reads which pages use a sheet. These changes pass every test:
  - a sheet of one area that moves into the shared module, so every page loads it;
  - a rule of a shared part that moves into an area sheet, when no per-screen check lists that part's selector.
- **Impact if no action:** A page can load CSS that only another area uses, or lose a shared rule that no check lists, and no test fails.
- **Root question:** How do the tests keep each site sheet in the module of the pages that use it?
- **Options:**
  - **A.** Change nothing. The style modules and the per-screen checks stay the protection. Effort: Small.
  - **B.** Name each area sheet with its area prefix, and test that the shared module imports no prefixed sheet and each area module imports only its own prefix. Rename `closing.css`, `modules.css` and the `shell-*.css` sheets to `home-*`, and `policy.css` to `legal.css`. A new rule for names. Effort: Small.
  - **C.** A Node test over the built site documents with `happy-dom`, which is already installed. Each area sheet that a page loads must match an element in a document of its area. Each shared sheet must match elements in at least two areas. Its run time over 48 documents is not measured. Effort: Medium.
- **Left out:** A browser walk in Playwright. It needs no layout, so a Node DOM is enough.
- **Wider fix:** C.
- **Previous examples:** A one-time browser script made the same check when the site CSS moved into imports, on 2026-11-24. It found no sheet in the wrong module.
- **Recommendation:** C. It checks use, not the module contents, so it catches both moves.
- **Action:** ask the user, because C adds a new test for the class and B adds a naming rule, and the repository rules keep both for the user.
