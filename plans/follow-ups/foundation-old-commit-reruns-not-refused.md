# Re-runs of older commits are not refused

- **Severity:** Medium (estimate). **Likelihood:** Rare (estimate). **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the follow-up that a review of [PR #54](https://github.com/mokly-ai/mokly-cloud/pull/54) proposed for review 2 finding 1, which the deleted `plans/foundation-terraform-from-ci.md` kept open, on the branch `calummoore/plans-skill-update`.
- **Location:** `.github/workflows/foundation.yml:13-16`, `infra/scripts/foundation-gate.py:12-16`, `docs/ops/foundation.md:41-51` and `docs/ops/deploy.md:470-475`.
- **Reason:** The fix adds a new refusal to two workflows, and the user has not chosen it since PR #54 merged on 2026-10-23.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. No job compares its commit with the head of `main`. The gate finds Foundation by the run's own commit and never reads the head.
- **Category:** Product bug (estimate).

- **Terms:**
  - **Foundation run:** A run of `.github/workflows/foundation.yml`, which plans and applies the foundation Terraform root on each push to `main` and on each manual dispatch from `main`.
  - **Deploy wait:** The **Wait for foundation** job of `.github/workflows/deploy.yml`, which runs `infra/scripts/foundation-gate.py` before every credentialed Deploy job.
  - **Re-run:** The GitHub Actions **Re-run all jobs** or **Re-run failed jobs** action, which runs a workflow again at the commit of its first run.
- **Background:**
  - Each Foundation and Deploy run works on the commit that started it. The Deploy wait passes when the Foundation run of the same commit succeeded.
  - A re-run keeps that commit. So a re-run of an older Foundation run applies older foundation configuration. A re-run of an older Deploy run releases older images and configuration.
  - A review of PR #54 found this. PR #54 answered it with warnings only.
  - `docs/ops/foundation.md:41-51` and `docs/ops/deploy.md:470-475` tell operators to act only on the runs of the newest commit on `main`. The wait prints the same warning, from `infra/scripts/foundation-gate.py:13-16`.
  - The trust-set procedure in `docs/ops/foundation.md:93-105` dispatches Foundation and Deploy from `main` instead of re-running older runs.
- **Problem:** No job checks that its commit is still the head of `main`. A re-run of an older run plans, applies and deploys like a new run.
- **Impact if no action:** One re-run of an older Foundation run can revert newer in-place updates, such as a longer role permission list, until the next Foundation run. A re-run of an older Deploy run releases older images.
- **Root question:** How does CI stop a run of an older commit from changing infrastructure or releases after a newer commit reached `main`?
- **Options:**
  - **A.** Change nothing. The runbook warnings and the wait message stay the only guard. Effort: Small (estimate).
  - **B.** Make the Foundation plan job and the Deploy wait fail when the commit of the run is no longer the head of `main`. The failure names the newest commit and says that its runs carry the change. Effort: Small.
- **Left out:** A run that applies the newest `main`, whatever its own commit. It breaks the decision in `docs/protocol/foundation-promotion.md:81-83` that Deploy finds the Foundation run by its own commit. A GitHub environment with required reviewers. The user rejected that manual step on 2026-10-21. No other approach was found, because a run can only warn, refuse, or apply another commit.
- **Wider fix:** B. It is a guard, which is a detection fix. No structural fix was found, because GitHub keeps the commit of a re-run.
- **Previous examples:** None found.
- **Related:** [`docs/ops/deploy.md#stable-environment-apply`](../../docs/ops/deploy.md#stable-environment-apply) holds the new-commit recovery guidance for the same cause: a re-run keeps its old commit. After a failed approval check, the runs of a new commit on `main` apply the fix, and the operator does not re-run the failed run. B makes such a re-run fail safely.
- **Recommendation:** B. One check in two entry points stops every re-run of an older commit, whatever the operator reads.
- **Action:** ask the user, because condition 3 holds: B adds a new refusal to two workflows, and the always-on rules reserve that for the user.

The review graded the follow-up Small effort and gave no severity. The severity, the likelihood and option A were added on 2026-10-30, and they are estimates. The plan policy still refuses an unapproved delete, replacement or forget in a re-run, so the revert reaches only creates and in-place updates. With B, a run whose commit stops being the head while it waits can also fail. The runs of the newer commit then carry the change.

B can fit two code files and 30 code lines, but nobody has designed it. Regrade its effort after a choice between one shared check and two copies.

Source: [the open follow-ups](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L453-L455) of the deleted plan.
