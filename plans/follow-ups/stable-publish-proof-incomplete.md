# Stable publish proof is incomplete

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from post-merge tasks of the deleted plans `mokly-cloud-initial-scope.md`, `publication-delta-upload.md`, `publication-storage-scaling.md` and `mokly-dependencies-upgrade.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/deploy.md`, sections "Publish Proof" and "Mokly Release Cutover", and `docs/ops/mokly-release-cutover.md`, which holds the cutover steps.
- **Reason:** The proof needs a deployed stable environment, real project tokens and the published CLI.
- **Checked:** 2026-11-01, on the branch `calummoore/mokly-cli-upgrade` at commit `62e623ca`, with its uncommitted Mokly 0.18.0 docs. The proof is still open. The recorded proof used 0.11.0 and the old layout, and no 0.14.0 or 0.18.0 result is recorded.

- **Terms:**
  - **Publish proof:** The runbook procedure in `docs/ops/deploy.md` that publishes with the published CLI and checks the result through the deployed edge.
  - **User-content domain:** The separate registrable domain that serves each publication from its own sandbox origin.
- **Background:** The list below gives the history.
  - The publish proof first ran on 2026-09-20 against `main-preview`, with `@mokly/mokly@0.11.0`. Its catalogue checks were left for after the merge.
  - The storage scaling change of 2026-09-28 and the delta upload change of 2026-10-02 each asked for the proof again after a reset.
  - The 0.14.0 adoption of 2026-10-10 asked for a credentialed proof with the new CLI.
  - On 2026-10-26, reset release 40253545142 recreated both stable databases from empty. That removed the 2026-09-20 publication. It does not show whether newer publications exist now.
  - `docs/ops/deploy.md` said to republish with the pinned 0.14.0 CLI after that rollout. No republish is recorded. An absent record does not prove that nobody republished.
  - The change that moves the pin to `@mokly/mokly@0.18.0` resets both stable databases again after it merges. Its steps are in `docs/ops/mokly-release-cutover.md`. They deploy, reset, republish the dogfood catalogue and recreate the labelled PR previews. A later step of the same runbook runs the publish proof with 0.18.0 and records it.
  - A repeat upload at the same revision returns early as already published. It does not prove that a publish of unchanged content uploads nothing.
- **Task:** On `main-preview`, run the publish proof with the pinned CLI, then record each result below in `docs/ops/deploy.md`.
  - The publication opens in the app. Record its ID, address and UTC time.
  - A fetch of its catalogue with the app `Origin` shows host isolation and the security headers of the smoke contract.
  - A repeat upload at the same revision shows the documented idempotency.
  - A publish of unchanged content at a new revision uploads no file. Record the upload counts.
  - `smoke.py` passes with the deployed origins.
  - Check the production publication inventory. Repeat the proof on production, if production holds publications.
- **Impact if no action:** The first real catalogue on the user-content domain after the reset is a customer's. A serving or isolation defect would reach them first.
- **Needs:** A project token on the environment, the published CLI at the repository's pin, and the deployed origins.
- **Done when:** `docs/ops/deploy.md` records each result with its date and revision.

Source: [the initial scope post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-initial-scope.md?plain=1#L2824-L2856) and [the delta upload post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/publication-delta-upload.md?plain=1#L514-L524) of the deleted plans.
