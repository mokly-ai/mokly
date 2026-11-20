# SQL IAM contract test ignores condition content

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the outside-the-scope list of review 1 of the reset fix in [PR #55](https://github.com/mokly-ai/mokly-cloud/pull/55), kept in the deleted `plans/foundation-terraform-from-ci.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/terraform/foundation/contracts.tftest.hcl:182-185` and `infra/terraform/foundation/environments.tf:33-52`.
- **Reason:** The review found it outside the scope of PR #55, and a finding about a missing test waits for the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The assertion still checks only 12 bindings with one condition each. The current expressions in `environments.tf` are correct.
- **Category:** Test (estimate).

- **Terms:**
  - **Contract test:** `infra/terraform/foundation/contracts.tftest.hcl`, a Terraform test of the planned foundation resources that `bash infra/scripts/check-terraform.sh` runs.
  - **IAM condition:** An expression on an IAM binding that limits the resources where the role applies.
- **Background:**
  - `infra/terraform/foundation/environments.tf:33-52` grants `roles/cloudsql.client` and `roles/cloudsql.instanceUser` to the `api`, `catalogue` and `reset` accounts of each stable environment. That makes 12 bindings.
  - Each binding has the condition `resource.name == 'projects/<project>/instances/mkc-<environment>'`, so each account connects only to the instance of its own environment.
  - On 2026-10-25 the user chose to remove the instance condition from the reset role bindings. IAM conditions do not apply to Cloud SQL database operations. PR #55 merged that change on 2026-10-26.
  - The database calls of a reset wait on a Cloud SQL operation, which needs `cloudsql.instances.get`. The reset account has that permission only through these conditioned roles.
  - The assertion at `contracts.tftest.hcl:182-185` checks only that there are 12 bindings, and that each binding has one condition.
- **Problem:** The test does not check the condition expression, the member, or the role of a binding. A binding whose condition names the other instance passes. A condition that is always true also passes.
- **Impact if no action:** A change could let a `main-preview` account reach the production instance, and the contract test would not fail.
- **Root question:** How does the contract test prove that the Cloud SQL access of each account stays on its own instance?
- **Options:**
  - **A.** Extend the assertion. For each key `<environment>/<workload>/<role>`, require the account of that workload as the member, the role of the key, and a condition that names `mkc-<environment>`. Effort: Small (estimate).
  - **B.** Change nothing. Review stays the guard. Effort: Small (estimate).
  - **C.** Add a test for the class: every conditioned IAM binding in foundation names the instance of its own environment. It covers later conditioned grants too. Effort: Medium (estimate).
- **Left out:** None.
- **Wider fix:** None. `environments.tf:50` already derives each condition from the environment of its key, which is the structural fix. Option A pins that rule, and C adds a test for the class on top.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/foundation-reset-test-omits-instance.md` has the same cause. After PR #55, the per-environment Cloud SQL limits rest on `rollout.sh` and on these conditioned roles. Each item adds a test for one of them.
- **Recommendation:** A. It pins the instance limit that remains after PR #55, with one assertion.
- **Action:** ask the user, because condition 6 holds: the review-fix rule leaves a finding about a missing test to the user.

The review gave no severity, effort, options, recommendation or action. Those judgments and all options were added on 2026-10-30, and they are estimates. The severity follows the Medium grade that the same review gave the missing reset instance test.

Source: [the outside-the-scope list of the reset fix](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L605-L606) in the deleted plan.
