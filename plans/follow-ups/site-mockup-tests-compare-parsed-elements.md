# Site mockup tests compare parsed elements

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from the branch `calummoore/homepage-functionality-vjxs`.
- **Location:** `docs/mockups/src/_tests_/design-site-chrome.test.ts:173`, `docs/mockups/src/_tests_/design-site-test-helpers.ts`
- **Reason:** The fix reaches a test file that the home zoom change does not otherwise touch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **parse5 element:** a node of the HTML tree that the site mockup tests read from the built pages. Each node links to its parent and so to the whole document.
- **Background:** The site mockup tests under `docs/mockups/src/_tests_/` parse the built HTML and assert facts about parsed elements. Some assertions pass arrays of parsed elements to `assert.deepEqual`.
- **Problem:** When such an assertion fails, Node prints each element with its whole document. While the home zoom change was built, one failed assertion of this kind ran out of memory, the process exited with code 137, and no message showed. The status bar test now compares tags and names. `design-site-chrome.test.ts:173` still compares arrays of elements.
- **Impact if no action:** A real failure in that test can hide its message behind an out-of-memory exit.
- **Root question:** How does a failed assertion about parsed elements stay readable in every site mockup test?
- **Options:**
  - **A.** Change only the comparison at `design-site-chrome.test.ts:173` to compare tags and names. Effort: Small.
  - **B.** Add a helper in `design-site-test-helpers.ts` that names an element by its tag, its accessible name and its key attributes. Use it in every site test that compares elements. Effort: Small.
- **Left out:** Comparing counts only weakens the assertion.
- **Wider fix:** B.
- **Previous examples:** `docs/mockups/src/_tests_/design-site-statusbar.test.ts` compares the tags and names of the zoom controls.
- **Recommendation:** B. One helper keeps every site test readable.
- **Action:** fix after merge, apply B, because it reaches test files that the home zoom change does not touch.
