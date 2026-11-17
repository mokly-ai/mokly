# Approval reason rule differs from the policy

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the outside-the-scope list of review 1 of the reset fix in [PR #55](https://github.com/mokly-ai/mokly-cloud/pull/55), kept in the deleted `plans/foundation-terraform-from-ci.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/protocol/infrastructure-promotion.md:139-140` and `infra/scripts/terraform-plan-policy.py:240-242`.
- **Reason:** Each option changes either a protocol requirement or a validation, and both choices belong to the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. `_validate_reason` still counts the trimmed string, and an in-memory call accepted `a b c d e f`.
- **Category:** Docs or spec (estimate).

- **Terms:**
  - **Approval document:** The JSON file under `infra/terraform/<root>/destructive-approvals/` that authorizes the exact destructive actions of one Terraform plan.
  - **Plan policy:** `infra/scripts/terraform-plan-policy.py`, which checks each Terraform plan and each approval document before an apply.
- **Background:**
  - An approval document has a `reason` field that explains the destructive change.
  - `docs/protocol/infrastructure-promotion.md:139-140` requires that "the reason must contain 10–500 non-whitespace characters".
  - `_validate_reason` at `terraform-plan-policy.py:240-242` accepts a reason when `len(reason.strip())` is from 10 to 500. That count includes every inner space.
  - Its error text says that the reason "must contain 10 to 500 characters".
  - The same rule applies to the foundation approval document, at its own path.
- **Problem:** The code and the protocol doc count different characters. The reason `a b c d e f` has 11 characters after the trim, but only 6 non-whitespace characters. The policy accepts it, and the contract rejects it.
- **Impact if no action:** A reviewer cannot tell from the contract which reasons the policy accepts. The difference shows only near the two length limits.
- **Root question:** Which characters count toward the length of an approval reason?
- **Options:**
  - **A.** Change the contract to the current behaviour: 10 to 500 characters after the policy trims the leading and trailing whitespace. It changes a protocol requirement. Effort: Small (estimate).
  - **B.** Change the policy to count non-whitespace characters, as the contract says, and update its error text. It makes the check stricter for short reasons with spaces. Effort: Small (estimate).
- **Left out:** Remove the length rule from the contract. The contract must state each rule at the boundary, so that a reader can judge the code. No other approach was found, because the rule can only follow one side or the other.
- **Wider fix:** None. The `documentation` skill already requires the doc and the code to agree.
- **Previous examples:** None found.
- **Recommendation:** A. The rule asks for a real explanation, and the trimmed count serves that as well. A keeps every approval that the policy accepts today.
- **Action:** ask the user, because condition 1 holds: A changes a requirement of `docs/protocol/infrastructure-promotion.md`, and no recorded user decision covers it. B adds stricter validation, which also waits for the user.

The review gave no severity, effort, options, recommendation or action. Those judgments and both options were added on 2026-10-30, and they are estimates.

Source: [the outside-the-scope list of the reset fix](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L602-L604) in the deleted plan.
