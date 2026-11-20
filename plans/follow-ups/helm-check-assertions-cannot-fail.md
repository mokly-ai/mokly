# Unnamed Helm check assertions may never fail

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** Low. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from Milestone F8 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/helm/tests/check.py`.
- **Reason:** The user accepted the finding without applying it, and it was carried into the backlog on 2026-09-20.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the finding. A full read of `check.py` found no assertion that cannot fail, and the record does not name the two assertions.
- **Category:** Test.

- **Background:**
  - The review at `e963ba61` on 2026-09-17 found two assertions in `infra/helm/tests/check.py` that cannot fail. The user accepted the finding without applying it.
  - Neither the backlog nor the initial plan names the two assertions, and the review report is not in the repository. `check.py` changed many times since the review.
  - On 2026-10-31 `check.py` had 335 lines. It checks command failures, parsed workload values, hooks, exact golden files and rejected inputs.
  - The pattern with an escaped closing brace at `check.py:129` reads the inline YAML labels of `infra/helm/mokly-cloud/templates/migration.yaml:4-16`. It can fail on a wrong workload label, so it does not compare a value with itself.
- **Problem:** The record does not name the two assertions, and a current read finds none that cannot fail. Nobody can check the defect from the record alone.
- **Impact if no action:** If such assertions still exist, they protect nothing. If they do not, the item keeps work in the backlog that has no target.
- **Root question:** Do assertions in `check.py` exist that cannot fail?
- **Options:**
  - **A.** Find the evidence first: the two assertion texts of the review at `e963ba61`, or a wrong render that a current assertion accepts. Then make each named assertion fail on a wrong render. Do not change an assertion without that evidence. Effort: Small (estimate). The grade stays provisional until the assertions are known.
  - **B.** Delete this item, because nobody can name the assertions. Effort: Small.
- **Left out:** None. A and B are the two outcomes.
- **Wider fix:** None found.
- **Previous examples:** A review of 2026-09-22 found that the certificate arm of `infra/tests/test_domain_layout.py` compared a value with itself. The current test compares independent sources.
- **Recommendation:** A. The user accepted the finding, so only evidence that names the assertions, or the user, should close it. If no evidence exists, B is the outcome, and it drops accepted work.
- **Action:** fix after merge, apply A, because the user accepted the finding as follow-up work.

Source: [Milestone F8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1010-L1051) of the deleted plan.
