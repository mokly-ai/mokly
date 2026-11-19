# Timing test copies workflow time limits

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the branch `calummoore/ci-provider`, in the check of review finding 3.
- **Location:** `tests/ci_timing_policy.test.ts`.
- **Reason:** The branch that found it does not change this test or any time limit.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Job guard:** the `timeout-minutes` limit that stops a whole CI job.
- **Background:**
  - `tests/ci_timing_policy.test.ts` reads `.github/workflows/ci.yml` and asserts that each job has a fixed `timeout-minutes` value, such as 75 for Repository and 60 for the native jobs.
  - The rule that it names, three times the typical duration, needs real durations. The test reads none.
  - The `testing` skill lists workflow YAML literals under "What never gets a test". Rule 3 under "Remove a test" lets an agent remove such a test without the user.
- **Problem:** The test copies workflow values and cannot fail when a guard breaks the three-times rule. It only fails when someone changes a value on purpose.
- **Impact if no action:** Each guard change needs a second edit in the test, and the test gives no protection.
- **Root question:** What should protect the CI job guards, when a copy of their values protects nothing?
- **Options:**
  - **A.** Delete the test under rule 3 of "Remove a test". Record the reason and the proof in the pull request. Effort: Small.
  - **B.** Replace it with the scheduled duration report of `ci-timeout-duration-report.md`. Effort: Medium.
- **Left out:** Keeping the test and copying each new value into it. That keeps a test from the "never" list.
- **Wider fix:** B, which `ci-timeout-duration-report.md` holds.
- **Previous examples:** On 2026-11-18 the branch `calummoore/ci-provider` removed a copied runner table from `tests/release_matrix.test.ts` for the same reason.
- **Related:** `plans/follow-ups/native-ci-timeout-headroom.md`. Its options A and D delete this test. When the user chooses one of them, this item closes with that change.
- **Recommendation:** A. It removes a test that protects nothing, and it needs no new code.
- **Action:** fix after merge, apply A, because the test lies outside this branch's change and may go with the native guard decision.
