# No test pins the reset to its instance

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from review 1 finding 1 of the reset fix in [PR #55](https://github.com/mokly-ai/mokly-cloud/pull/55), which the deleted `plans/foundation-terraform-from-ci.md` kept open, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/tests/test_rollout.py:120`, `infra/tests/test_rollout.py:169-182`, `infra/scripts/rollout.sh:63-79` and `docs/protocol/cloud/infrastructure-promotion.md:66-80`.
- **Reason:** The review left this missing-test finding for the user, and PR #55 merged on 2026-10-26 without an answer.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The tests still reset `main-preview` only and do not assert `--instance`. The script targets the right instance today.
- **Category:** Test (estimate).

- **Terms:**
  - **Reset release:** A Deploy dispatch with `reset=true`, which deletes and recreates the `mokly` database of each enabled stable environment and migrates it from empty.
  - **Reset account:** The service account `mkc-<environment>-reset`, which the Deploy identity impersonates for the Cloud SQL database calls of a reset.
- **Background:**
  - `infra/scripts/rollout.sh:63-79` defines `reset_database`. It sets the instance to `mkc-$environment` and the account to the reset account of that environment.
  - It then lists, deletes and creates the `mokly` database with `gcloud sql databases` commands that pass `--instance="$instance"`.
  - On 2026-10-25 the user chose to remove the instance condition from the reset role bindings. IAM conditions do not apply to Cloud SQL database operations, so that condition denied every reset. PR #55 merged the change on 2026-10-26.
  - Each reset account can now list, create and delete databases on both stable instances. Only `rollout.sh` selects the instance.
  - `docs/protocol/cloud/infrastructure-promotion.md:68-69` requires that a reset recreates only the database of the environment that it resets.
- **Problem:** `infra/tests/test_rollout.py` runs the reset for `main-preview` only, at line 120. It checks the order of the database calls and the impersonated account, but not the `--instance` value. A change that names a fixed or wrong instance passes every test.
- **Impact if no action:** A wrong instance in `rollout.sh` can delete the production database during a `main-preview` reset, and no test fails first.
- **Root question:** How do the tests prove that a reset recreates only the database of the environment that it resets?
- **Options:**
  - **A.** Run the reset test for both `main-preview` and `production`. Assert `--instance=mkc-<environment>` and the matching reset account on each `gcloud sql databases` call. Effort: Small.
  - **B.** Change nothing. Review stays the guard. Effort: Small (estimate).
- **Left out:** A per-instance IAM limit, where the reset recreates the database through a SQL connection as the reset database user. The user rejected it on 2026-10-25, because only a credentialed run can prove the Cloud SQL privileges that it needs. No other approach was found, because a test, a review, or an IAM limit are the only guards.
- **Wider fix:** None. `rollout.sh` already derives the instance and the account from one `environment` value, and option A pins that rule.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/foundation-sql-iam-test-ignores-conditions.md` has the same cause. After PR #55, the per-environment Cloud SQL limits rest on `rollout.sh` and on the conditioned connection roles. Each item adds a test for one of them.
- **Recommendation:** A. The review recommended it, and it pins the requirement that the protocol doc states.
- **Action:** ask the user, because condition 6 holds: the review-fix rule leaves a finding about a missing test to the user.

The review graded the finding Medium severity and Small effort, and it recorded option A only. Option B was added on 2026-10-30, and its effort is an estimate. Reset release 40253545142 passed in `main-preview` and `production` on 2026-10-26, so the current script targets the right instances.

Source: [the open review findings of the reset fix](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L595-L597) in the deleted plan.
