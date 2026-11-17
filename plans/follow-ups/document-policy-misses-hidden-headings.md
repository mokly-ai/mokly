# The document policy misses a hidden page heading

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from Milestone 3 of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`, as the wider fix of two hidden headings.
- **Location:** `docs/mockups/src/_tests_/document-policy.ts` (`documentViolations`, the "one primary heading required" check) and `ts/app/src/_tests_/document-policy.ts`.
- **Reason:** The fix is a stricter check, and the always-on rules leave a new or stricter check to the user.
- **Category:** Test.

- **Terms:**
  - **Document policy:** The checks that the catalogue's browser tests and the app's browser tests run on every drawn or rendered page, such as one `main` landmark and one `h1`.
  - **Wait:** What a region draws while a read that it needs runs, as `docs/protocol/folio-chrome.md` defines it.
- **Background:** `docs/protocol/web-app.md` says that every screen owns one `main` landmark, one `h1` and a skip link. The document policy counts the `h1` elements of a page with `querySelectorAll("h1")`. It does not check that the `h1` is exposed to assistive technology or that it has a name.
- **Problem:** A wait drew its `h1` as a bar hidden from assistive technology twice in the change that found this: the finished project's wait while the project loads, and the viewer's wait while the project loads (`product/viewer/standalone/project-loading`). The policy passed both, because the hidden `h1` still counts as an element.
- **Impact if no action:** A later wait or screen can hide its only `h1` from screen readers again, and no check fails.
- **Root question:** How does the policy know that each page has one heading that a screen reader can reach?
- **Options:**
  - **A.** Change nothing, and rely on review. Effort: Small.
  - **B.** Make both policies count only `h1` elements that are not hidden from assistive technology and that have a non-empty accessible name, and require exactly one. Add a fixture for a hidden `h1`. Effort: Small.
- **Left out:** A lint over the screen sources. A heading can be hidden by a parent element, which a source lint cannot see.
- **Wider fix:** B. It detects the whole class.
- **Previous examples:** The finished project's wait (fixed in the same change) and `product/viewer/standalone/project-loading`.
- **Recommendation:** B. Two cases in one change show that review alone misses it.
- **Action:** ask the user, because B adds a stricter check, which the always-on rules leave to the user.
