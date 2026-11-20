# Deploy runbook calls the preview environment protected

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s`, while writing the repository cutover runbook.
- **Location:** `docs/ops/deploy.md:170-171`.
- **Reason:** The text came from the cloud import unchanged, and the choice of which side is right is not part of the repository move.

- **Terms:**
  - **`preview` environment:** the GitHub Actions environment that the credentialed release job of `.github/workflows/preview.yml` uses for pull request workloads of Mokly Cloud.
  - **Protection rules:** GitHub environment settings, such as required reviewers, a wait timer, or a deployment branch policy, that hold or limit a job that names the environment.
- **Background:** Step 3 of the stable setup in `docs/ops/deploy.md` says "Configure the protected `preview` environment for PR workloads." On 2026-11-19 the `preview` environment of `mokly-ai/mokly-cloud` had no protection rules and no branch policy (`gh api repos/mokly-ai/mokly-cloud/environments` returned `preview rules= branch_policy=null`). `docs/ops/repository-cutover.md` copies the environment to `mokly-ai/mokly` as it is. The workflow itself limits the credentialed preview release: `docs/protocol/ci-workflow-cloud.md`, section "Forks And Protection", says that the release accepts `pull_request_target` events only from this repository and never runs on a fork event.
- **Problem:** The runbook says that the environment is protected, but the environment has no rules.
- **Impact if no action:** An operator who rebuilds the setup from the runbook cannot tell which protection to configure. A reader can think that a reviewer holds each preview release, which is not true.
- **Root question:** Does a preview release of a pull request need an environment rule, or do the workflow guards alone protect it?
- **Options:**
  - **A.** Keep the environment without rules. Change the runbook sentence to name the environment and to point at the workflow guards in `docs/protocol/ci-workflow-cloud.md`. Effort: Small.
  - **B.** Add a deployment branch policy or required reviewers to `preview` in both the settings and the cutover runbook. A reviewer rule holds every preview release until a person approves it. Effort: Small.
- **Left out:** Removing the environment. The release job reads its environment values, so it must stay.
- **Wider fix:** None. This is one sentence.
- **Previous examples:** None found.
- **Recommendation:** A. The workflow guards already keep fork events away from the credentials, and a reviewer rule would slow every preview.
- **Action:** ask the user, because the user decides which side of a runbook and setting mismatch is right.
