# Dogfood catalogue has no proven production publication

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from unchecked post-merge tasks of the deleted `plans/mokly-cloud-initial-scope.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `.github/workflows/` and `docs/ops/publish-smoke.md`.
- **Reason:** Publishing needs the deployed production cloud and a project token, so it waits until after the merge.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify a live production publication. No workflow publishes to production, but cloud builds could publish without one, and no dated evidence exists either way.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. No workflow under `.github/workflows` runs `mokly publish`. The task now applies to this repository, `mokly-ai/mokly`.

- **Terms:**
  - **Dogfood catalogue:** The cloud mockup catalogue under `docs/mockups`, which the root `mokly.config.json` configures.
  - **Changes check:** The `Mokly` GitHub check run that reports how many entries changed on a pull request.
- **Background:** The initial scope asked to publish the dogfood catalogue from the CI of the cloud repository to production Mokly Cloud and to enable the `Mokly` check there. On 2026-11-17 the cloud and its catalogue moved from `mokly-ai/mokly-cloud` into this repository, `mokly-ai/mokly`, so the task now applies here. This repository also holds the Mokly example catalogue under `examples/basic`, which the initial scope did not name. It also asked to confirm the live check on an installed test pull request, with its summary, rerequest and failure observations. No workflow under `.github/workflows` runs `mokly publish` to production. The cloud preview workflow publishes only into preview namespaces. Cloud builds are a supported path that needs no CI token, as `docs/product-direction.md:36-40` says. So the workflow files alone do not prove that no production project or live check exists.
- **Task:** Make this repository a customer of its own product, then record the check.
  - Create a production project for this repository and a publishing token in its Tokens pane.
  - Store the token as a CI secret, and publish the catalogue from CI after the catalogue build. Cloud builds can do it instead, once they run live.
  - On a pull request, confirm that the `Mokly` check shows the Changes count with links into the hosted Changes view.
  - Confirm that Re-run delivers the check again, and record a failure check.
  - Record the observations in `docs/ops/publish-smoke.md`.
  - If a production project and a live check already exist, record their dated evidence instead.
  - Then move the places below from the old repository name `mokly-ai/mokly-cloud` to `mokly-ai/mokly`, with their tests. A design call of 2026-11-19 keeps the old name there until this repository has its production project.
    - The preview seed is not in this list. On 2026-11-19 its sample project moved to the repository `mokly-ai/mokly` and the project slug `mokly`, with its tests, `docs/protocol/cloud/preview-seed.md` and the local capture command of `docs/development/cloud.md`. The preview capture uploads for the repository that runs the preview, and upload authorization refused the old name, so the design call does not apply to the preview seed.
    - `scripts/cloud/publication_smoke_cli.py:59`, the `--repository` that the publication smoke publishes with. Its tests are `scripts/cloud/_tests_/publication_smoke_cli_tests.py` and `publication_smoke_fixture_tests.py`.
    - `scripts/cloud/publication_smoke_support.py:78` and `scripts/cloud/smoke_preview_plan.py:18`, which look up the repository in the GitHub installation of the workspace.
    - `scripts/cloud/smoke_viewer_reads.py:85` and `:101`, the pull request address that the viewer read smoke expects.
    - `infra/scripts/catalogue_recording_cases.py:43`, the `--repository` of the catalogue capture recording, which `infra/tests/fixtures/README.md:73` describes.
    - `docs/ops/github-app-smoke.md:135`, the repositories that step 4 of the GitHub App smoke expects under the `mokly-ai` account.
    - The dogfood commands in `docs/ops/mokly-release-cutover.md:45` and `:57` and `docs/ops/publish-smoke.md:92`, which create or publish the project of the old repository.
  - The effort covers the proof only. Grade a new workflow change separately.
- **Impact if no action:** The team does not use its own product on its own changes, and the live check stays unproven.
- **Needs:** Production access, a project token, and the GitHub App on this repository, `mokly-ai/mokly`.
- **Done when:** Each pull request of this repository gets a live `Mokly` check, the runbook records the observations, and the places that the task lists name `mokly-ai/mokly`.
- **Related:** The list below gives the links.
  - `plans/follow-ups/cloud-builds-never-ran-live.md` can publish the catalogue without a CI token.
  - `plans/follow-ups/github-app-live-smoke-not-recorded.md`, same live proof. That walk leaves the live Changes check to this task.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-initial-scope.md?plain=1#L2824-L2856) of the deleted plan.
