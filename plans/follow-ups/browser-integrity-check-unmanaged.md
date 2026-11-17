# Browser Integrity Check is not managed

- **Severity:** Medium (estimate). **Likelihood:** Rare. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F3 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/terraform/foundation/main.tf:89-98`, `docs/ops/environment.md:110-111` and `docs/ops/deploy.md:243-245`.
- **Reason:** The source left a choice between two designs, and no user decision picks one.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. Terraform manages only the SSL setting of the app/API zone, and the runbooks keep the Browser Integrity Check as a documented dashboard setting.
- **Category:** Process.

- **Terms:**
  - **Browser Integrity Check:** A Cloudflare zone setting that answers 403 to requests that look like a bot.
  - **`manage_zone_settings`:** The Terraform switch that lets the foundation root manage Cloudflare zone settings. It defaults to false.
- **Background:**
  - On 2026-09-19 the Browser Integrity Check answered 403 to the smoke runner. It would also answer 403 to the publish CLI and to webhook callers.
  - `docs/ops/deploy.md:670-671` records the incident. The operator turned the check off in both zones.
  - `docs/ops/environment.md:110-111` and `docs/ops/deploy.md:243-245` require the check off, or the API and catalogue hosts exempt, as an operator setting.
  - Under `manage_zone_settings`, Terraform manages only the `ssl` setting, and only in the app/API zone of `var.zone_id`. The foundation root has no input for the catalogue zone.
  - No probe checks the setting.
- **Problem:** The setting that keeps the CLI and webhooks working lives only in the Cloudflare dashboard. A change there breaks publishing without a repository change.
- **Impact if no action:** Someone turns the check back on, and `mokly publish` and GitHub webhooks get 403 until an operator finds the cause.
- **Root question:** How does the zone keep the Browser Integrity Check off for the API and catalogue hosts?
- **Options:**
  - **A.** Add a documented preflight probe with a non-browser user agent, and record it in `docs/ops/environment.md`. Effort: Small.
  - **B.** Manage the setting in Terraform, and record it in `docs/ops/environment.md`. Turning on `manage_zone_settings` is not enough. B needs a new setting resource or an exemption in the app/API zone. It also needs a design for the catalogue zone: a new Terraform input, or a recorded operator setting. Effort: Medium (estimate).
  - **C.** Keep the documented dashboard setting and change nothing. Drift stays invisible until a client gets 403. Effort: Small.
- **Left out:** None. The source left out an undocumented dashboard setting. The runbooks now document the setting, so C keeps it as a real option.
- **Wider fix:** B. Terraform then holds the setting, and a plan shows any drift.
- **Previous examples:** The 403 of 2026-09-19 in `docs/ops/deploy.md:670-671`.
- **Related:** [`infra/terraform/README.md#shared-foundation`](../../infra/terraform/README.md#shared-foundation) holds the Cloudflare token list for the same zone settings. It already gives the operator and foundation tokens Zone Settings edit on the app/API zone when `manage_zone_settings` is true. Both adoption steps in that README give each token its zone settings permission before the import and the merge. `docs/ops/secrets.md` already gives the zone-setting token permission. B needs it.
- **Recommendation:** B. A managed setting cannot drift silently. The user has not chosen it, and its effort depends on how B covers the catalogue zone.
- **Action:** ask the user, because condition 4 holds: the source left a choice between a probe and Terraform management.

Source: [Milestone F3](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L796-L836) of the deleted plan.
