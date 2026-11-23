# Finish the repository cutover after the merge

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-19, from the post-merge section of the plan that moved Mokly Cloud into this repository (PR #350).
- **Location:** `infra/terraform/modules/github/moved.tf`, the legacy repository input of `infra/terraform/modules/github/`, every reader of `MKC_LEGACY_REPOSITORY_ID` (`infra/scripts/terraform-foundation.sh`, `.github/workflows/foundation.yml`, `infra/terraform/README.md`, and `infra/tests/test_terraform_wrappers.py`), `docs/ops/repository-cutover.md`, and `docs/ops/repository-retirement.md`.
- **Reason:** The cutover is done, and these parts served only the cutover.

- **Terms:**
  - **Old repository:** `mokly-ai/mokly-cloud`, the private repository that held Mokly Cloud. It is archived.
  - **Legacy repository input:** the Terraform input that kept the Google Cloud trust of the old repository during the cutover. The variable `MKC_LEGACY_REPOSITORY_ID` fed it.
- **Background:**
  - On 2026-11-20 cloud delivery started from this repository. The first Deploy put `e5acd1a2` into production. The old repository left the Google Cloud trust, its workflows are disabled, and it is archived. The dated record is at the end of `docs/ops/repository-retirement.md`.
  - The repository variable `MKC_LEGACY_REPOSITORY_ID` is deleted. The Foundation runs after that had no changes.
  - The organization's Conductor cloud computer script installs the pinned cloud tools from `infra/scripts/install-tools.sh` and `install-build-tools.sh` only when they exist on `main` at build time.
- **Task:**
  1. Remove the legacy repository input, its readers of `MKC_LEGACY_REPOSITORY_ID`, and `infra/terraform/modules/github/moved.tf`, with their contract tests. Check that the foundation plan stays at no changes.
  2. Rebuild the Conductor cloud computer, so that it installs the pinned cloud tools from `main`.
  3. Delete the two cutover runbooks and their index lines in `docs/ops/README.md`, or move the parts that stay true into the operations pages that own them.
- **Impact if no action:** Dead cutover code and two runbooks of finished work stay in the repository, and new cloud workspaces miss the pinned cloud tools.
- **Needs:** Conductor organization admin access for task 2.
- **Done when:** No file reads `MKC_LEGACY_REPOSITORY_ID`, `moved.tf` is gone, the foundation plan has no changes, new cloud workspaces have Terraform and Helm, and no page describes the cutover as a procedure to run.
- **Related:** `plans/follow-ups/workspace-setup-misses-gate-tools.md`, the same code. The rebuild of the Conductor cloud computer in the second task should also install the tool list of that item. When the third task moves the parts that stay true, it can carry the "Prepare Conductor" lines with the corrections of that item.
