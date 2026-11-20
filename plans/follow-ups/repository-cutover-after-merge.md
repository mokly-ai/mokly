# Finish the repository cutover after the merge

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-11-19, from the post-merge section of the plan that moved Mokly Cloud into this repository (PR #350).
- **Location:** `docs/ops/repository-cutover.md` (section "After The Merge"), `docs/ops/repository-retirement.md`, `infra/terraform/modules/github/moved.tf`, the legacy repository input of `infra/terraform/modules/github/`, and the repository variable `MKC_LEGACY_REPOSITORY_ID`.
- **Reason:** Cloud delivery from this repository can start only after the merge, because every cloud delivery job runs from `main`.

- **Terms:**
  - **Old repository:** `mokly-ai/mokly-cloud`, the private repository that held Mokly Cloud. Its `main` is frozen at `55972c86`.
  - **Cutover switch:** the repository variable `MKC_CLOUD_CUTOVER_ENABLED`. Until it equals `true`, no cloud delivery job of this repository starts, and the Deploy and Foundation result jobs pass with a skip line.
- **Background:**
  - On 2026-11-19 the operator steps before the merge were done: the old pull requests #133, #107, and #88 were closed and their previews removed, the old Deploy, Desktop release, Preview, and Site workflows were disabled, the Terraform trust change was applied (Google Cloud trusts both repositories), and the secrets, variables, environments, and the `preview` label were copied.
  - The old CI and Foundation workflows stay on until the retirement.
  - The organization's Conductor cloud computer script installs the pinned cloud tools from `infra/scripts/install-tools.sh` and `install-build-tools.sh` only when they exist on `main`.
- **Task:**
  1. Run "Turn On Cloud Delivery" of `docs/ops/repository-cutover.md`: set the cutover switch, dispatch Foundation and then Deploy, and watch the first deploy from `main` through to production.
  2. Run every step of `docs/ops/repository-retirement.md`: disable the old CI and Foundation workflows, check that no old preview resource remains, remove the old repository from the trust condition, port the branches of #133, #107, and #88 to this repository as new pull requests, point the old README here, archive the old repository, and record the cutover.
  3. Remove the cutover-only trust code: the legacy repository input, `MKC_LEGACY_REPOSITORY_ID`, and `infra/terraform/modules/github/moved.tf`, with their contract tests.
  4. Rebuild the Conductor cloud computer, so that it installs the pinned cloud tools from `main`.
  5. Remove the status line of `docs/protocol/ci-workflow-cloud.md`, which marks cloud delivery as off until the cutover, and delete or rewrite the two cutover runbooks once they describe only history.
- **Impact if no action:** Mokly Cloud keeps deploying nothing from this repository, so changes under `packages/` and `apps/` never reach the hosted cloud, and the old repository keeps its Google Cloud trust.
- **Needs:** Owner access to both repositories and to Google Cloud project `mokly-508518`, and Conductor organization admin access.
- **Done when:** Production runs a deploy from `main` of this repository, the old repository is archived and out of the trust condition, the cutover-only trust code is gone, and no page marks cloud delivery as off.
