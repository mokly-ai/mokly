# Required CI can miss a new verification job

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s`, the check of review finding 4, which listed it outside the scope.
- **Location:** `.github/workflows/ci.yml:705`, the `required` job, with its `needs` list at `:708-717` and its step "Require every verification job" at `:736`.
- **Reason:** `origin/main` has the same gap, so the branch that moved the cloud into this repository did not cause it.

- **Terms:**
  - **Required CI:** the last job of `.github/workflows/ci.yml`, `required`. It runs with `if: ${{ always() }}` and fails unless each job of its `needs` list succeeded.
  - **Verification job:** a job of `ci.yml` whose failure must block a merge.
- **Background:**
  - `docs/ops/repository-cutover.md`, section "Copy The Environments And Rules", requires the protection of `main` to require the check `Required CI`. A merge then waits only for the jobs that Required CI names.
  - A job joins Required CI only when a person adds it in three places: the `needs` list, an env binding such as `PLAN_RESULT: ${{ needs.plan.result }}`, and a guard line such as `test "$PLAN_RESULT" = success`.
  - On 2026-11-19 `ci.yml` had twelve jobs, and Required CI named nine of them. `site-lighthouse` is report-only by design, and `apps/site/tests/site_ci.test.ts:62` proves that its result cannot block Required CI. `cloud-provider-plan` reaches Required CI through the job `plan`, "Cloud provider plan result", which needs it.
  - No test fails when a new job is missing from one of the three places. The tests that copy the `needs` list compare it with a literal, so they still pass when a new job is left out.
  - `origin/main` has the same gap. On 2026-11-19 its Required CI named six jobs, and no test compared the jobs of the workflow with that list.
- **Problem:** A new verification job can fail while Required CI passes, because nothing makes a person add the job to the `needs` list, its binding and its guard line.
- **Impact if no action:** A pull request can merge with a failed check that nobody required. The failure stays hidden until someone reads the run.
- **Root question:** How does CI make sure that each verification job gates Required CI?
- **Options:**
  - **A.** Add a test that parses `ci.yml` and requires each job other than `required` to be in `required.needs`, with a binding and a guard line. An exemption list in the test names each exempt job with its reason: `site-lighthouse` is report-only, and `cloud-provider-plan` reaches Required CI through `plan`. Effort: Small.
  - **B.** Do A, and let the guard read `${{ toJSON(needs) }}` and fail on each result other than `success`. The nine bindings and the nine guard lines then go away, so the `needs` list is the only list. The test of A then checks only that list. Effort: Medium.
- **Left out:** Changing nothing keeps the gap. A required check for each job in the protection of `main` needs a settings change for each new job, outside the repository.
- **Wider fix:** B. With one list, no binding or guard line can be forgotten, and the test keeps the list complete.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/required-ci-guard-tests-copy-needs-list.md`, same code: both change the tests of the Required CI job, so do them in one branch. Option B here removes the bindings from which that item derives its guard cases.
- **Recommendation:** B. It leaves one list of required jobs and a test that keeps that list complete.
- **Action:** ask the user, because both options add a new check to the gate, and the always-on rules leave each new check or gate to the user.
