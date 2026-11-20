# A billing test reads the words of a protocol table

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the round 2 review of `calummoore/stripe-loading-outside-app-mrlb`.
- **Location:** `apps/app/src/_tests_/billing.test.ts:51`.
- **Reason:** The test is on `origin/main`, so the fix belongs to a separate branch.
- **Category:** Repository rule.

- **Background:** The repository rules say that no test asserts the words of a protocol page.
- **Problem:** The test "the plan catalogue's own table is what the pane states" matches the trial row of `docs/protocol/cloud/billing.md` with a regular expression.
- **Impact if no action:** A wording change in the protocol page breaks the test.
- **Root question:** Where does the trial length live so that the pane and the catalogue cannot disagree?
- **Options:**
  - **A.** Read the trial length from generated or shared data that the catalogue and the pane both use, and delete the text match. Effort: Small.
  - **B.** Keep the test and record an exception. Effort: Small.
- **Left out:** Delete the test with no replacement loses the check.
- **Wider fix:** None. The repository rule is already in force.
- **Previous examples:** None found.
- **Recommendation:** A.
- **Action:** Fix after merge, apply A, in a separate branch.
