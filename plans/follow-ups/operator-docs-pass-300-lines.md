# Operator docs pass 300 lines

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from outside-the-scope notes of the Milestone 5 and 6B review TODOs in the deleted `plans/foundation-terraform-from-ci.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/deploy.md`, `docs/ops/secrets.md`, `docs/ops/environment.md` and `infra/terraform/README.md`.
- **Reason:** The docs already passed 300 lines on `origin/main` before the Foundation change, so its review left them for a separate branch.
- **Checked:** 2026-11-01, on the branch `calummoore/mokly-cli-upgrade` at commit `62e623ca`, with its uncommitted Mokly 0.18.0 docs. The problem is still open. `docs/ops/deploy.md` has 826 lines, `docs/ops/secrets.md` 551, `infra/terraform/README.md` 438 and `docs/ops/environment.md` 435.
- **Category:** Docs or spec.

- **Background:** The repository rules split a file that passes 300 lines. The Foundation review of 2026-10-23 listed five docs past it: `README.md`, `xtask/README.md`, `infra/terraform/README.md`, `docs/ops/deploy.md` and `docs/ops/secrets.md`. Its Milestone 6B review added `docs/ops/environment.md`.
- **Problem:** In the checked tree, four of them still pass 300 lines.
  - `docs/ops/deploy.md` has 826 lines. Its Mokly release cutover steps now live in `docs/ops/mokly-release-cutover.md`, and its "Mokly Release Cutover" section keeps a short summary and a link.
  - `docs/ops/secrets.md` has 551 lines.
  - `infra/terraform/README.md` has 438 lines.
  - `docs/ops/environment.md` has 435 lines.
  - `README.md` has 296 lines and `xtask/README.md` has 256 lines, so those two are below the limit now.
- **Impact if no action:** Operators read long runbooks to find one step, and each change makes a split harder.
- **Root question:** How do the long operator docs return under the split limit?
- **Options:**
  - **A.** Split each of the four docs into linked pages by task, and retarget every inbound anchor. Effort: Small.
  - **B.** Split only `docs/ops/deploy.md`, the longest. Effort: Small.
- **Left out:** Leave them. The repository rule says to split them.
- **Wider fix:** `plans/follow-ups/changed-files-have-no-length-check.md` holds the check that would stop the class.
- **Previous examples:** `plans/follow-ups/mockups-readme-passes-300-lines.md` and `plans/follow-ups/app-test-files-pass-300-lines.md`.
- **Related:** `plans/follow-ups/changed-files-have-no-length-check.md`, shared wider fix.
- **Recommendation:** A. Each doc is past the limit on its own.
- **Action:** fix after merge, apply A, because the docs passed the limit before the change that found them.

When you move text, account for each rule that you move, so that no rule is dropped. `plans/follow-ups/doc-splits-have-no-removal-audit.md` proposes a formal split audit, which the user has not approved.

Source: [the Milestone 5 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L435-L469) and [the Milestone 6B review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L528-L562) of the deleted plan.
