# Old app host records may still exist

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Low. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the first post-merge task of the deleted `plans/readable-addresses.md` and the operator rollout task of the deleted `plans/unified-domain-layout.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** The Cloudflare zone of the app domain, and `docs/ops/environment.md`, section "DNS, Certificates And Worker".
- **Reason:** The records live in Cloudflare and in Terraform state, outside the repository, so only an operator can confirm them.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the records. The repository cannot list the zone or the state, and the rollouts of 2026-09-24 do not prove the cleanup.

- **Terms:**
  - **Old app hosts:** The public `app[-<environment>].<domain>` hosts that served the app before the unified domain layout.
  - **App-origin records:** The internal `app-origin.<domain>` and `app-origin-main-preview.<domain>` records that the Worker proxies to.
- **Background:** The unified domain layout moved the app onto the site's origin. The readable addresses change then removed the `/app` prefix. Both plans told the operator to confirm that the app-origin records exist and that the old public app host records are removed. `docs/ops/deploy.md` records the main-preview and production rollouts of 2026-09-24. The rollouts do not prove the record cleanup. The old deployment table in `docs/ops/production.md` is history, so it does not show that an old host still exists.
- **Task:** In the app zone, confirm that the app-origin records of both stable environments exist. Confirm that no old public app host record remains. Confirm that the Pages custom domain on the apex stays attached. Record the result with its date in `docs/ops/environment.md`.
- **Impact if no action:** An old public app host can still answer outside the Worker's routing and its headers.
- **Needs:** Read access to the Cloudflare zone, and to the Terraform state of both stable environments.
- **Done when:** The environment runbook records the dated check. A removal of an old record that the check finds is a separate reviewed change.

Source: [the readable addresses post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/readable-addresses.md?plain=1#L1223-L1254) of the deleted plan.
