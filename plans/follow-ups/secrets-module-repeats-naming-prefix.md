# Secrets module repeats the naming prefix

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F8 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/terraform/modules/secrets/main.tf:21-37` and `infra/terraform/modules/naming/main.tf:13-21`.
- **Reason:** The user accepted the namespace finding on 2026-09-20, but that defect is gone, and nobody approved the prefix change that remains.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The secrets module builds no namespace, but its secret IDs still repeat the `mkc-<environment>` prefix.
- **Category:** Code structure.

- **Background:** The list below gives the facts.
  - The round three review of 2026-09-16 found that the secrets module hand-builds the namespace that the naming module owns. The user accepted the finding without applying it.
  - On 2026-10-31 the secrets module builds no namespace, so that defect is gone.
  - Its secret IDs still repeat the `mkc-${var.environment}` prefix, which the naming module also builds for its namespace.
  - `infra/terraform/README.md:69-73` gives the naming module the account, namespace and bucket names, not every secret ID. `docs/ops/secrets.md:8-12` documents the stable secret prefix as an operations convention.
  - No requirement makes the secrets module take its prefix from the naming module.
- **Problem:** Two modules write the same prefix. Nobody knows whether the repeated prefix is what the finding meant, so a change to it is an optional consolidation, not an approved fix.
- **Impact if no action:** A change to the naming rule can miss the secret IDs.
- **Root question:** Which module owns the `mkc-<environment>` prefix of the secret IDs?
- **Options:**
  - **A.** Take the secret ID prefix from the naming module. Effort: Small.
  - **B.** Delete this item, if the repeated prefix is intended. Effort: Small.
- **Left out:** Rename the existing secrets. Their IDs are live in Secret Manager.
- **Wider fix:** A. One module then owns the prefix.
- **Previous examples:** None found.
- **Recommendation:** A. One owner removes the repeat at small cost, if a plan of both environments shows no secret ID change.
- **Action:** ask the user, because condition 4 holds: the accepted finding named a namespace defect that is gone. For an optional consolidation, B is as reasonable as A.

A Terraform plan of both environments must show no change of a secret ID after A.

Source: [Milestone F8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1010-L1051) of the deleted plan.
