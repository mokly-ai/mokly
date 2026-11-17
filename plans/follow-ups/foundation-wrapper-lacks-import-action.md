# Shared Terraform wrapper has no import action

- **Severity:** Low (estimate). **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the follow-up that a review of [PR #54](https://github.com/mokly-ai/mokly-cloud/pull/54) proposed for review 3 finding 3, which the deleted `plans/foundation-terraform-from-ci.md` kept open, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/scripts/terraform-root.sh:14-16`, `infra/scripts/terraform-foundation.sh:5-7`, `infra/scripts/terraform-environment.sh:5`, `docs/ops/foundation.md:116-142`, `docs/ops/build-template.md:124-139`, `docs/ops/secrets.md:521-551` and `infra/terraform/README.md:84-93`.
- **Reason:** The review proposed it as a wider fix, and the user has not chosen it since PR #54 merged on 2026-10-23.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The wrapper still accepts only `plan`, `check` and `apply`, and the runbooks still repeat the import setup. The old wrong-token defect is fixed.
- **Category:** Code structure (estimate).

- **Terms:**
  - **Shared root wrapper:** `infra/scripts/terraform-root.sh`, which holds the plan, check and apply steps that both Terraform entry points share.
  - **Entry point:** `infra/scripts/terraform-foundation.sh` or `infra/scripts/terraform-environment.sh`, each of which sets the backend prefix, inputs and token IDs of one root.
  - **Import:** A `terraform import` command, which records an object that already exists in the cloud in the Terraform state.
- **Background:**
  - The shared root wrapper accepts only `plan`, `check` and `apply`, at `terraform-root.sh:16`. It initializes the backend with the prefix of the root and reads the right Cloudflare token from Secret Manager.
  - Imports run outside the wrapper. `docs/ops/foundation.md:116-142` exports the `TF_VAR_*` inputs, runs `terraform init` with the backend prefix, and reads the read-only plan token for a Cloudflare import.
  - `docs/ops/build-template.md:124-139`, `docs/ops/secrets.md:521-551` and `infra/terraform/README.md:84-93` give more hand-written import commands.
  - A review of PR #54 found a defect in the token that the hand-written import step read. PR #54 fixed the runbook, so the step now reads the read-only plan token, and only for a Cloudflare import.
- **Problem:** Each import runs outside the wrapper, with a backend, input and token setup that only runbook text gives. A runbook copy can drift from the wrapper, as that review showed.
- **Impact if no action:** A drifted copy can import into the wrong state prefix, or read a token with more access than an import needs. Each new import procedure adds another copy.
- **Root question:** How does an operator import an object with the same backend, input and token rules as a plan?
- **Options:**
  - **C.** Change nothing, and fix each copy when it drifts. Effort: Small (estimate).
  - **A.** Add an `import ADDRESS ID` action to the shared root wrapper and to both entry points. It initializes the same backend, reads the read-only plan token, runs `terraform import`, and runs only outside GitHub Actions. The runbooks then call it. Effort: Medium.
  - **B.** Add only an `init` action that prepares the backend and the inputs. The runbooks keep their `terraform import` commands after it. Effort: Medium (estimate).
- **Left out:** Terraform `import` blocks in the change. The user rejected them for foundation on 2026-10-21, and that decision stays in force.
- **Wider fix:** A. One action for every import is a structural fix, because no runbook then repeats the setup.
- **Previous examples:** None found, besides the review finding that this wider fix covers.
- **Related:**
  - `plans/follow-ups/foundation-import-plan-checks-branch-not-merge.md`: its option B builds on this action.
  - [`docs/ops/foundation.md#imports`](../../docs/ops/foundation.md#imports): its import steps now also cover the `main-preview` and `production` environment states. Environment imports would use the same action.
- **Recommendation:** A. The review proposed it, and it moves the setup of every import into the wrapper.
- **Action:** ask the user, because condition 6 holds: the review-fix rule leaves a code-structure change to the user.

The review graded its shared-wrapper action Small and gave no severity. Current option A changes all three scripts, so its current grade is Medium (estimate). The severity and options B and C were added on 2026-10-30, and they are estimates.

Source: [the open follow-ups](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L502-L503) of the deleted plan.
