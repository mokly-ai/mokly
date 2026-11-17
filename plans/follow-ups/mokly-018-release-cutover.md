# Mokly 0.18.0 release cutover

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-11-02, from the post-merge tasks of the Mokly 0.18.0 upgrade plan on the branch `calummoore/mokly-cli-upgrade`, deleted with that change.
- **Location:** `docs/ops/mokly-release-cutover.md`.
- **Reason:** Each step needs the merged and deployed change.

- **Terms:**
  - **Cutover:** the deploy order that moves each stable environment from 0.14.0 publications to 0.18.0 publications.
  - **Dogfood catalogue:** this repository's own mockup catalogue, published to each stable environment.
- **Background:**
  - The upgrade does not convert stored 0.14.0 publications. On 2026-10-26 the user chose to reset each stable environment's database after the deploy (Decision 2).
  - The reset also removes accounts, workspaces and projects.
  - On 2026-10-26 the user chose to run the preview capture proof after the merge (Decision 7), because the capture tools on `main` refuse the upgrade's own pull request.
- **Task:** Follow the steps of `docs/ops/mokly-release-cutover.md`, in order:
  1. Deploy the API and the app before any job publishes with 0.18.0.
  2. Reset main-preview, and production when it is enabled, with the deploy reset.
  3. Republish the dogfood catalogue in each reset environment.
  4. Recreate every labelled pull-request preview that was created before the merge.
  5. Run the preview capture proof on the next labelled pull request.
  6. Run the credentialed publish proof of `docs/ops/deploy.md` with 0.18.0. This also serves `plans/follow-ups/stable-publish-proof-incomplete.md`.
- **Impact if no action:** Stable environments keep 0.14.0 publications that the 0.18.0 viewer cannot open, and the upload path stays unproven against real credentials.
- **Needs:** The merged change, deploy access to each stable environment, and the dogfood publishing token.
- **Done when:** Each stable environment runs the 0.18.0 API and app, holds a republished dogfood catalogue, the preview proof passed on a labelled pull request, and the runbook records the publish proof.
