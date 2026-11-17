# Merged preview workflow lacks a recorded live proof

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from post-merge tasks of the deleted plans `pr-preview-environments.md`, `preview-seed-data.md`, `derived-mockup-output.md`, `mokly-dependencies-upgrade.md`, `readable-addresses.md` and `workspaces.md`, on the branch `calummoore/plans-skill-update`. On 2026-10-31 the validity audit merged two duplicate items into it: `verify-preview-seed-job-live.md` and `merge-main-into-labelled-prs.md`. Both came from the branch `calummoore/preview-environment-seeding-discussion` on 2026-10-30.
- **Location:** `docs/ops/preview-verification.md`, which the section "Verification Record" of `docs/ops/preview.md` links. The proof covers `.github/workflows/preview.yml`, `infra/scripts/preview-seed-job.py`, `infra/scripts/preview_seed_job_run.py` and `infra/helm/mokly-cloud/templates/preview-seed.yaml`.
- **Reason:** `pull_request_target` runs the preview workflow from `main`, so only a labelled pull request after each merge can prove it.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify a complete live proof. The preview run 41195009519 of PR #84 was still in progress, and no current result is recorded.

- **Terms:**
  - **Labelled preview:** A same-repository pull request with the `preview` label, which deploys the namespace `preview-pr-N`.
  - **Preview required:** The required check that the preview workflow sets on a labelled pull request.
  - **Sample project:** The **Mokly Cloud** project that the preview seed creates, without a repository link, from this repository's own mockups.
  - **Seed Job:** The Kubernetes Job `preview-seed-<run>` that runs `mkc-api preview-seed --run <run>` from the pull request's own API image in its preview namespace.
- **Background:**
  - `docs/ops/preview-verification.md` records an operator proof of 2026-09-23 for PR 18 and the first label run 36113198199 for PR 17. These results are history. They do not prove the current workflow, the seed Job or the timing of the hosted runner.
  - Six later plans each left a preview proof for after their merge. The repository records none of them. An absent record does not prove that no run happened.
  - After the deploy evidence, the release job of `.github/workflows/preview.yml` runs `infra/scripts/preview-seed-job.py`.
  - The script stages `request.json` and the captured catalogue in `pr-N/seed/<run>/` of the preview bucket. It creates the seed Job from the suspended CronJob `preview-seed` and waits up to 25 minutes.
  - The script then prints the Job's log, collects `seed-status.json` and `seed-proof.json`, and deletes the Job. The pull request comment then shows **Open preview** and **Sample project**.
  - The local stack proved the seed command on 2026-10-30.
  - An API image from a branch without the seed command fails at once and writes no status. The release script then reports `The seed wrote no status. If this revision predates the API preview seed, merge main into the pull request and rerun the workflow.`
  - In that case **Preview required** fails, and the comment shows no **Sample project** link.
  - On 2026-10-31 PR #84 was the only open pull request with the `preview` label. Its head `b95686e4` was one commit ahead of `main` at `cdf9c9e5` and none behind, so its image has the seed command.
  - A **Preview required** success can come from a run that skipped the lifecycle. It does not alone prove the seed. The ancestry of a pull request does not prove that its seed Job succeeds.
- **Task:** Label one same-repository pull request `preview`. Record each result below, with its run ID and date, in `docs/ops/preview-verification.md`.
  - Before a run, list the open pull requests with the `preview` label. Merge `main` into each one that does not contain the seed command, or ask its owner to. Do not merge automatically.
  - The run IDs and tested commits of the label, push, rerun, unlabel and close paths through the merged workflow.
  - The first main deploy installs the shared platform through the `preview-platform` job.
  - **Preview required** passes, and the workflow's seed step prints the seed Job's log.
  - The run's artifact `preview-evidence-pr-N` holds `deployment-smoke.json` with passing DNS/TLS, revision, health and isolation results, and the seed status and proof.
  - The sample project has no repository link.
  - From the comment, **Open preview** opens the preview. **Sample project** opens the sample project on the pull request's publication, with Changes against `main`.
  - The seed's upload duration, the seed Job's duration, and the capture duration against the 15-minute publish limit on the hosted runner.
  - The capture runs against a derived `main` with complete v9 output, in the 0.14.0 format.
  - A push adds a publication to the history.
  - A workflow rerun runs a new seed Job. Its proof has `uploadStatus` 200 for the same publication.
  - `https://pr-N.preview.mokly.ai/sign-in` serves the app, and the preview root serves the app document with `X-Robots-Tag: noindex`.
  - `https://pr-N.preview.api.mokly.ai/v1/health` answers, and `https://mokly.ai/docs/` still serves the site.
  - Unlabel and close remove the namespace, its bindings, objects and DNS record.
- **Impact if no action:** A defect in the merged preview workflow stays hidden until a reviewer meets it on a real pull request. An example is a missing permission for `kubectl create job --from`.
- **Needs:** A same-repository pull request that contains the current `main` and may carry the `preview` label.
- **Done when:** `docs/ops/preview-verification.md` holds every result above with its run IDs and date. The first run and the rerun both pass, and the sample project opens.

The seed and the capture may change before this proof. Prove the workflow that is on `main` at the time.

Before the merge, the seed Job item graded its own proof Medium severity and Small effort (estimate). The labelled pull request item graded its merge task Low severity and Small effort (estimate).

Source: [the PR preview post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/pr-preview-environments.md?plain=1#L610-L625) and [the preview seed post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/preview-seed-data.md?plain=1#L602-L618) of the deleted plans.
