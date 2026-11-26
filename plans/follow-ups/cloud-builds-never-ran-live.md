# Live cloud build proof is not recorded

- **Severity:** High (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/build-template.md`, section "Live Evidence", and `infra/e2b/build/`.
- **Reason:** The proof needs an E2B account, a published template and the installed App, which no repository check uses.
- **Checked:** 2026-11-24. The template `mokly-build-v2` (build reference `f1x5cj2fgwv20p42qxnn:2f7ad3b2-ffae-4e31-a4e9-33f3d2d26374`) passed the live probe, and the "Live Evidence" section of `docs/ops/build-template.md` records it. The API deployments of main-preview and production had no build settings, so builds were off in both. The main-preview Secret Manager secret `mkc-main-preview-e2b-api-key` had one enabled version. The production secret had no version. The agent token could not read or write the GitHub Actions variables, because GitHub answered HTTP 403.

- **Terms:**
  - **E2B:** The sandbox provider that runs each cloud build attempt in a one-shot sandbox.
  - **Build template:** The E2B template `mokly-build-v<N>` that `infra/e2b/build/` defines and `docs/ops/build-template.md` releases. The verified release is `mokly-build-v3`. `mokly-build-v2` is not a release, because its npm is broken.
- **Background:** The list below gives the facts.
  - PR #45 added cloud builds on 2026-10-20. The worker runs the repository's own `mokly publish` in a sandbox and posts build checks.
  - Every repository check runs without E2B.
  - On 2026-10-30, `docs/ops/build-template.md` said that no E2B candidate had been published or verified, and that no cloud resource or key had been provisioned.
  - The repository cannot show whether a resource, a key or a live build exists outside it.
  - Builds default to off, and PR previews cannot enable them. The preview seed of PR #81 starts no background worker, so a preview seed proves no sandbox build.
- **Task:** Prove cloud builds live, first on `main-preview`, then on production.
  - Enable builds on `main-preview`: add the `builds` group with the `mokly-build-v3` build reference `1zj5lunxulyowh6ewmy3:9dffde05-0e34-4afd-91f3-ac771fd52705` to the `MKC_MAIN_PREVIEW_APP_CONFIG` GitHub variable, as `docs/ops/build-template.md` says, and deploy.
  - With the installed App and a test repository, push to the default branch and open a pull request.
  - Watch the check move from queued to a Changes result, and press Re-run.
  - Record the result in the "Live Evidence" section of `docs/ops/build-template.md`.
  - Repeat the proof on production after promotion. First add a version to `mkc-production-e2b-api-key` and set `MKC_PRODUCTION_APP_CONFIG` with its own deployment ID. Record the timings of a cold install against the 15-minute budget.
- **Impact if no action:** Stable deployments keep builds off until an operator verifies the template, so users cannot use the product's default onboarding path.
- **Needs:** The effort counts code changes only. The operator work of provisioning and the live runs has no sized patch. An E2B team key, the template release, a GitHub test repository with the App installed, and access to both stable environments.
- **Done when:** The "Live Evidence" section records a successful build, check and Re-run on both environments. Each record gives the released template ID, its source revision, the environment, the publication receipts, the check URLs and the cold-install timings.
- **Related:** `plans/follow-ups/dogfood-catalogue-not-published-from-ci.md` can use cloud builds once they run.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plan.
