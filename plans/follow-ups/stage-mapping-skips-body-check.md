# The stage mapping test does not compare build card bodies

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-05, from Milestone 6 of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `ts/app/src/_tests_/viewer/stage-drawings.test.ts` and `docs/mockups/src/_tests_/build-drawings.ts`.
- **Reason:** The fix is a test that catches a whole class of mapping mistake, which needs the user's approval.
- **Category:** Test.

- **Terms:**
  - **Build card body:** What a build card shows besides its title: its one action, the placeholder of an action that a read decides, or nothing, and its line of text.
  - **Mapping test:** `stage-drawings.test.ts`, which maps each card and body that the app can show to one mockup drawing in the authored inventory.
- **Background:** The mapping test checks that each reachable body maps to a drawing that exists. `docs/mockups/src/_tests_/build-drawings.ts` records what each build drawing shows. In the change that found this, every body with no action and no line mapped to the plan refusal's wait drawing, which shows an action placeholder, and the test still passed.
- **Problem:** The test does not compare a body with the record of the drawing it maps to, so a body mapped to another body's drawing passes.
- **Impact if no action:** A future card or body can map to a drawing that does not show it, and nobody reviews that body in the catalogue.
- **Root question:** How does the mapping test know that each drawing shows the body mapped to it?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Compare each mapped body's action key and line kind with the record of its drawing in `build-drawings.ts`, and fail on a difference. Effort: Small.
- **Left out:** A review checklist item. It relies on people to catch what one assertion can.
- **Wider fix:** B. It detects the whole class.
- **Previous examples:** The no-action, no-line body that mapped to `product/viewer/standalone/build/reader/plan-loading`, fixed in the same change with a `running` drawing.
- **Recommendation:** B. One comparison would have caught the mistake that the change found.
- **Action:** ask the user, because B adds a test for a whole class of defect, which needs the user's approval.
