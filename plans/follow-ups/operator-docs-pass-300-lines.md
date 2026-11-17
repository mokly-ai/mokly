# Operator docs pass 300 lines

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from outside-the-scope notes of the Milestone 5 and 6B review TODOs in the deleted `plans/foundation-terraform-from-ci.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/deploy.md`, `docs/ops/secrets.md`, `docs/ops/environment.md` and `infra/terraform/README.md`.
- **Reason:** The rule that asked for the split was a rule of the old cloud repository, and no rule of this repository caps a runbook or a README, so a split is now the user's choice.
- **Checked:** 2026-11-17, in the combined repository. `docs/ops/deploy.md` has 902 lines, `docs/ops/secrets.md` 546, `infra/terraform/README.md` 449 and `docs/ops/environment.md` 445.
- **Category:** Docs or spec.

- **Background:**
  - The rules of the old cloud repository split a file that passed 300 lines. The Foundation review of 2026-10-23 listed five docs past it: `README.md`, `xtask/README.md`, `infra/terraform/README.md`, `docs/ops/deploy.md` and `docs/ops/secrets.md`. Its Milestone 6B review added `docs/ops/environment.md`.
  - On 2026-11-17 the cloud moved into this repository. Here `AGENTS.md` caps changed TypeScript and JavaScript files at 300 lines and protocol pages at 250 lines. The shared `documentation` skill sets its 250-line target only for protocol and architecture docs. No rule caps a runbook under `docs/ops/` or a README.
  - The root `README.md` has 332 lines and `xtask/README.md` has 359 lines in this repository. No rule asks to split them either.
- **Problem:** Four operator docs pass 300 lines. `docs/ops/deploy.md` has 902 lines. Its Mokly release cutover steps live in `docs/ops/mokly-release-cutover.md`, and its "Mokly Release Cutover" section keeps a short summary and a link.
- **Impact if no action:** Operators read long runbooks to find one step, and each change makes a split harder.
- **Root question:** Do the long operator docs get split by task, now that no rule caps their length?
- **Options:**
  - **A.** Split each of the four docs into linked pages by task, and retarget every inbound anchor. Effort: Small.
  - **B.** Split only `docs/ops/deploy.md`, the longest. Effort: Small.
  - **C.** Leave them, because no rule of this repository caps a runbook or a README. Effort: Small.
- **Left out:** A new length rule for runbooks and READMEs, because it changes a repository rule, which is a separate decision.
- **Wider fix:** None. No check covers the length of a runbook.
- **Previous examples:** None in this repository.
- **Recommendation:** B. `docs/ops/deploy.md` has 902 lines, far more than any other doc here, so its split gives back the most reading time for the least churn.
- **Action:** ask the user, because no rule of this repository requires a split, so the split is a choice between reading time and churn in the runbooks.

When you move text, account for each rule that you move, so that no rule is dropped.

Source: [the Milestone 5 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L435-L469) and [the Milestone 6B review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L528-L562) of the deleted plan.
