# Contract import rule omits declared objects

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from review 4 finding 3 of [PR #54](https://github.com/mokly-ai/mokly-cloud/pull/54), which the deleted `plans/foundation-terraform-from-ci.md` kept open, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/protocol/cloud/foundation-promotion.md:136-160`, `infra/terraform/README.md:351-356`, `docs/ops/secrets.md:523-531` and `docs/ops/foundation.md:173-174`.
- **Reason:** The recommended option adds a rule to a protocol doc, and the user has not answered it since PR #54 merged on 2026-10-23.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The contract still gives only the timing before the merge, and two runbooks still call the bootstrap the next foundation apply.
- **Category:** Docs or spec (estimate).

- **Terms:**
  - **Operator path:** The list in `docs/protocol/cloud/foundation-promotion.md:136-160` of the only foundation changes that a person applies by hand.
  - **Foundation run:** A run of `.github/workflows/foundation.yml`, which plans and applies the foundation Terraform root on each push to `main`.
  - **Bootstrap:** The one-time operator apply of 2026-10-23 that created the foundation identity, recorded under "Bootstrap Record" in `docs/ops/foundation.md`.
  - **Import:** A `terraform import` command, which records an object that already exists in the cloud in the Terraform state.
- **Background:**
  - The operator path allows "imports of existing objects into the foundation state, directly before the merge of the change that declares them". The user chose that timing on 2026-10-21.
  - The decision text beside it rejects Terraform `import` blocks in the change, because imports are rare and each import is coordinated with its merge.
  - A review of PR #54 then added a second timing to two runbooks. An object that `main` already declares is imported "before the next foundation apply, which today is the foundation bootstrap".
  - `infra/terraform/README.md:354-356` and `docs/ops/secrets.md:526-528` state that second timing. Step 1 of the bootstrap in `docs/ops/foundation.md:173-174` used it.
  - The bootstrap ran on 2026-10-23. Its record says that no object needed an import.
- **Problem:** The contract omits the second timing. A reader cannot tell from the contract whether an import of an object that `main` already declares is allowed, or when. The runbooks still name the bootstrap as the next foundation apply, but the next apply is now the next Foundation run.
- **Impact if no action:** The contract and the runbooks disagree on which imports an operator may run. An operator who reads the runbooks can wait for a bootstrap that already happened.
- **Root question:** Which imports may an operator run on the foundation state, and when?
- **Options:**
  - **B.** Add the second timing to the operator path and to its decision in `docs/protocol/cloud/foundation-promotion.md`. Restate the timing for the time after the bootstrap. Update the same words in the two runbooks. Effort: Small.
  - **C.** Treat such an import as recovery. The operator path then says that the operator imports an object that `main` declares and the state lacks, then dispatches Foundation from `main`. The two runbooks link to the recovery steps instead of a second timing. Effort: Small (estimate).
- **Left out:** Change nothing. The contract then stays incomplete, which fails the goal. Terraform `import` blocks in the change. The user rejected them on 2026-10-21, and that decision stays in force. The review's option A is not recorded.
- **Wider fix:** None. The `documentation` skill already requires a protocol doc that covers every behaviour at its boundary.
- **Previous examples:** Another review of PR #54 found that the Terraform README copied the operator path. Its fix made the README link to the contract.
- **Related:**
  - `plans/follow-ups/foundation-import-plan-checks-branch-not-merge.md`: the same import procedure. One docs change can fix both items.
  - [`docs/ops/foundation.md#imports`](../../docs/ops/foundation.md#imports): the timing rule for an object that a pending change declares. It covers foundation and the `main-preview` and `production` environment states. The timing passages of this item in `infra/terraform/README.md` and `docs/ops/secrets.md` link to it.
- **Recommendation:** B. The review recommended it, and it keeps one complete operator path in the contract.
- **Action:** ask the user, because condition 1 holds: B adds a rule to a protocol doc, and no recorded user decision covers it.

The review graded the finding Low severity and Small effort, and it recommended option B. The source does not record the text of option A. Option C was added on 2026-10-30, and its effort is an estimate. The stale bootstrap wording was found on 2026-10-30, when this item was written.

The review recommended B before the bootstrap ran. After the bootstrap, each Foundation run tries to create an object that `main` declares and the state lacks. A create of an object that already exists normally fails at the provider, so C may fit better (estimate). This item does not check that behaviour. Check it before you choose between B and C.

Source: [the open review findings](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L496-L498) of the deleted plan.
