# Import plan checks the branch, not the merge

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from review 3 finding 6 of [PR #54](https://github.com/mokly-ai/mokly-cloud/pull/54), which the deleted `plans/foundation-terraform-from-ci.md` kept open, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/foundation.md:107-142`.
- **Reason:** The review left the finding for the user, and PR #54 merged on 2026-10-23 without an answer.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. Step 4 still plans the checked-out change, and the runbook still gives no undo for a wrong import.
- **Category:** Process (estimate).

- **Terms:**
  - **Foundation root:** The Terraform root `infra/terraform/foundation`, which owns the shared cloud platform, the CI identities and their roles.
  - **Foundation run:** A run of `.github/workflows/foundation.yml`, which plans and applies the foundation root on each push to `main`.
  - **Import:** A `terraform import` command, which records an object that already exists in the cloud in the Terraform state.
- **Background:**
  - On 2026-10-21 the user chose the timing of foundation imports. An operator imports an object only after the change that declares it is approved. Then the operator merges that change at once and holds other merges.
  - `docs/protocol/foundation-promotion.md:149-158` records that decision. Terraform `import` blocks in the change were rejected, because imports are rare and each import is coordinated with its merge.
  - `docs/ops/foundation.md:116-142` gives five steps. Step 2 checks out the change. Step 3 imports each object.
  - Step 4 runs `bash infra/scripts/terraform-foundation.sh plan` on that checkout. The plan must show no create of the imported object and no delete or replacement.
  - Step 5 merges the change. The Foundation run of the merge commit then makes and applies its own plan.
- **Problem:** Step 4 plans the checked-out branch, not the merge result. When `main` moved after the branch point, the two plans differ. The runbook also gives no way to undo a wrong import.
- **Impact if no action:** The operator reviews one plan, and the Foundation run of the merge applies another. A wrong import stays in the state until someone finds the undo command.
- **Root question:** How does the operator review the plan that the merge will apply, and undo a wrong import?
- **Options:**
  - **A.** Add a runbook step before the import that brings `main` into the change, so that step 4 plans the merge result. Document `terraform -chdir=infra/terraform/foundation state rm 'ADDRESS'` as the undo. That command removes the object from the state and keeps it in the cloud. Docs only. Effort: Small.
  - **B.** Make the import tooling plan the merge result. A wrapper step merges the change into `origin/main` in a temporary checkout and plans there. It builds on the action of `plans/follow-ups/foundation-wrapper-lacks-import-action.md`. Effort: Medium (estimate).
- **Left out:** Change nothing. The merge then applies a plan that nobody reviewed, which fails the goal. Terraform `import` blocks in the change. The user rejected them on 2026-10-21, and that decision stays in force. The review's other options are not recorded.
- **Wider fix:** B. A tool that always plans the merge result removes the manual step from every later import.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/foundation-wrapper-lacks-import-action.md`: option B builds on that action.
  - `plans/follow-ups/foundation-contract-omits-declared-object-imports.md`: the same import procedure. One docs change can fix both items.
  - [`docs/ops/foundation.md#imports`](../../docs/ops/foundation.md#imports): the procedure of this item. It now also covers the `main-preview` and `production` environment states.
- **Recommendation:** A. The review recommended it, and it needs only runbook text. B best protects every later import, at Medium effort.
- **Action:** ask the user, because condition 6 holds: the review-fix rule leaves a process finding to the user.

The review graded the finding Low severity and Small effort, and it recorded option A only. Option B was added on 2026-10-30, and its effort is an estimate.

Source: [the open review findings](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L493-L495) of the deleted plan.
