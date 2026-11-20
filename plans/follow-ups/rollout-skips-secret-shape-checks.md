# Rollout skips secret shape checks

- **Severity:** Medium (estimate). **Likelihood:** Rare. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F3 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/scripts/rollout.sh:30-42` and `:90-102`, `infra/helm/mokly-cloud/templates/bootstrap.yaml:49-62`, `infra/terraform/foundation/environments.tf:67-90` and `infra/tests/test_rollout.py`.
- **Reason:** The fix adds a check that can stop a rollout, which is stricter validation, and it needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. `rollout.sh` still checks only the TLS secret before Helm, and the deploy identity cannot read the workload secrets.
- **Category:** Process.

- **Terms:**
  - **CSI-mounted secret:** A Secret Manager value that the workload reads as a file through the Secrets Store CSI driver.
- **Background:** On 2026-09-19 the first `main-preview` install crash-looped the API. The stored webhook secret had 20 bytes, and the API requires at least 32. `docs/ops/deploy.md:664-669` records it. That incident is history, and nothing shows a bad secret value today.
  - Today `rollout.sh` fetches only the origin TLS key and certificate, and checks their expiry and hosts. It checks no CSI-mounted secret before Helm runs.
  - The workload mounts the signing, Postmark and enabled GitHub values through the SecretProviderClass in `bootstrap.yaml:49-62`.
  - The deploy identity has readers for the TLS secrets and the catalogue key only, in `environments.tf:67-90`. Workload secrets are behind a different identity.
  - The runtime checks each value itself. For example, `crates/mkc-config/src/github.rs:107-117` requires at least 32 webhook secret bytes.
- **Problem:** A secret with a wrong shape would reach the pods, and the failure would show only as a crash loop after the rollout starts.
- **Impact if no action:** A bad secret version can stop a rollout late, with an error that does not name the secret.
- **Root question:** How does a rollout learn of a wrong secret value before the pods start?
- **Options:**
  - **A.** Change nothing. The crash loop and the logs show the cause. Effort: Small.
  - **B.** Add a preflight before Helm that reads each secret's latest version and applies the runtime's rules. Cover it in `infra/tests/test_rollout.py`. Effort: Medium (estimate), to regrade after the choices below.
    - The deploy identity cannot read these secrets today. B must widen its grants, which changes the credential boundary, or run the check under the workload identity.
    - The source named three rules: a webhook secret of at least 32 bytes, an app key with a PEM header, and a hex signing key. A PEM header alone does not prove a usable key.
    - Those three rules do not cover the runtime validation of the optional billing, mail and GitHub features. The runtime rules must stay the authority.
- **Left out:** Copy the API's validation into Helm. The preflight already runs before Helm, with clearer errors.
- **Wider fix:** B, when it reuses the runtime's own validation. A copy of three rules does not cover every secret that the runtime checks.
- **Previous examples:** The 20-byte webhook secret of 2026-09-19.
- **Recommendation:** B. A bad value then fails before Helm, with the secret's name. The user has not approved the new check, nor the identity that it runs as.
- **Action:** ask the user, because condition 3 holds: B adds a new check that can stop a rollout.

Source: [Milestone F3](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L796-L836) of the deleted plan.
