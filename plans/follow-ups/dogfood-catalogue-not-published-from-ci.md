# Dogfood catalogue has no proven production publication

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from unchecked post-merge tasks of the deleted `plans/mokly-cloud-initial-scope.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `.github/workflows/` and `docs/ops/publish-smoke.md`.
- **Reason:** Publishing needs the deployed production cloud and a project token, so it waits until after the merge.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify a live production publication. No workflow publishes to production, but cloud builds could publish without one, and no dated evidence exists either way.

- **Terms:**
  - **Dogfood catalogue:** This repository's own mockup catalogue under `docs/mockups`.
  - **Changes check:** The `Mokly` GitHub check run that reports how many entries changed on a pull request.
- **Background:** The initial scope asked to publish the dogfood catalogue from this repository's CI to production Mokly Cloud and to enable the `Mokly` check here. It also asked to confirm the live check on an installed test pull request, with its summary, rerequest and failure observations. No workflow under `.github/workflows` runs `mokly publish` to production. The preview workflow publishes only into preview namespaces. Cloud builds are a supported path that needs no CI token, as `docs/product-direction.md:36-40` says. So the workflow files alone do not prove that no production project or live check exists.
- **Task:** Make this repository a customer of its own product, then record the check.
  - Create a production project for this repository and a publishing token in its Tokens pane.
  - Store the token as a CI secret, and publish the catalogue from CI after the catalogue build. Cloud builds can do it instead, once they run live.
  - On a pull request, confirm that the `Mokly` check shows the Changes count with links into the hosted Changes view.
  - Confirm that Re-run delivers the check again, and record a failure check.
  - Record the observations in `docs/ops/publish-smoke.md`.
  - If a production project and a live check already exist, record their dated evidence instead.
  - The effort covers the proof only. Grade a new workflow change separately.
- **Impact if no action:** The team does not use its own product on its own changes, and the live check stays unproven.
- **Needs:** Production access, a project token, and the GitHub App on this repository.
- **Done when:** Each pull request of this repository gets a live `Mokly` check, and the runbook records the observations.
- **Related:** The list below gives the links.
  - `plans/follow-ups/cloud-builds-never-ran-live.md` can publish the catalogue without a CI token.
  - `plans/follow-ups/github-app-live-smoke-not-recorded.md`, same live proof. That walk leaves the live Changes check to this task.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-initial-scope.md?plain=1#L2824-L2856) of the deleted plan.
