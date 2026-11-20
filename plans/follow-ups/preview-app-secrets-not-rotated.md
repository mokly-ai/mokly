# Preview GitHub App secret rotation is unconfirmed

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Low. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from an unchecked post-merge task of the deleted `plans/mokly-cloud-initial-scope.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** The GitHub App registration of `main-preview`, and `docs/ops/secrets.md:21-23`.
- **Reason:** The secrets live in GitHub and Secret Manager, outside the repository, so only an operator can rotate them.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify a rotation. The repository records no reason for the task, and no replacement dates for the three preview App credentials after 2026-09-22.

- **Terms:**
  - **Preview App:** The GitHub App registration that `main-preview` uses, apart from the production App `mokly-ai`.
- **Background:** The list below gives the facts.
  - The production provisioning change of 2026-09-22, PR #11, added the task "Rotate the preview App's secrets." It records no reason.
  - The same change recorded the production App and its rotated webhook secret in `docs/ops/production.md`. That rotation is for a different App.
  - `docs/ops/secrets.md:21-23` gives the rotation of each GitHub App secret: the private key, the client secret and the webhook secret.
  - On 2026-09-19, before the task, the operator rotated the preview webhook secret after its length failure, as `docs/ops/deploy.md:664-669` records. That rotation covers only the webhook secret.
  - The repository does not show whether a later rotation happened.
- **Task:** Ask the owner why the task exists and whether it still applies. If it does, rotate the private key, the client secret and the webhook secret of the preview App. Follow the rotation column of `docs/ops/secrets.md`. Record the date in that runbook. If the rotation already happened, record its nonsecret replacement and disable dates instead.
- **Impact if no action:** If the secrets were exposed during provisioning, an old copy can still act as the preview App.
- **Needs:** Owner access to the preview App and to the Secret Manager IDs of `main-preview`.
- **Done when:** The owner confirms that no rotation is needed, or the runbook records the rotation.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-initial-scope.md?plain=1#L2824-L2856) of the deleted plan.
