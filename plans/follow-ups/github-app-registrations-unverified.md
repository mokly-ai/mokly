# GitHub App registrations are unverified

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the first unchecked post-merge task of the deleted `plans/workspaces.md` and the second post-merge task of the deleted `plans/readable-addresses.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/github-app-smoke.md:53-58` and the GitHub App registrations of `main-preview` and production.
- **Reason:** The registrations live on GitHub, outside the repository, so only an operator can change and confirm them.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the live settings. The repository documents only the target settings, and nobody read either registration.

- **Terms:**
  - **Redirect on update:** A GitHub App setting that sends the user back to the setup URL after they change an installation's repositories.
- **Background:** The registration table at `docs/ops/github-app-smoke.md:53-58` gives the target settings.
  - Callback URL: `<app-origin>/auth/github/callback`.
  - Setup URL: `<app-origin>/auth/github/install`.
  - Redirect on update: enabled, to `<app-origin>/auth/github/install`.
  - Webhook URL: `<api-origin>/v1/github/webhooks`.
  - The readable addresses change removed the `/app` prefix before its 2026-09-24 rollout, so every registration needed new URLs.
  - Until 2026-10-28 the registration table had no Redirect on update row. The workspaces change added the row and the code that handles the return. The missing row does not prove that the live setting was off.
  - `docs/ops/production.md:67-79` records the production registration with the former `app.mokly.ai` callbacks, and says to change them at the shared-origin rollout. That dated record does not show the current values.
- **Task:** For the App of `main-preview` and for the production App `mokly-ai`, do the steps below.
  - Compare the callback, setup and webhook URLs with the table, and correct each one that differs.
  - Confirm that Redirect on update is enabled with the setup URL, or enable it.
  - Compare the permissions and events with `docs/protocol/cloud/github-app.md`.
  - Record the date and the result in `docs/ops/github-app-smoke.md`.
- **Impact if no action:** If Redirect on update is off, Configure on GitHub does not return to Mokly. A wrong callback or webhook URL would break sign-in, installs or check delivery.
- **Needs:** Owner access to both GitHub App registrations.
- **Done when:** Both registrations match the table, and the runbook records the check.
- **Related:** `plans/follow-ups/github-app-live-smoke-not-recorded.md` runs the live walk after this check.

Source: [the workspaces post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/workspaces.md?plain=1#L1019-L1038) and [the readable addresses post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/readable-addresses.md?plain=1#L1223-L1254) of the deleted plans.
