# Commit title length is unchecked

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F1 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `xtask/src/checks/`.
- **Reason:** The fix is a new gate, and a new gate needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. No check in `xtask` or `.github/workflows` enforces the title limit of 72 code points. No new gate is approved.
- **Category:** Repository rule.

- **Background:** The backlog asked to enforce a 50-character first line on every commit that is not on `origin/main`, because the rule was broken routinely. That premise is outdated. The shared `git-commit` skill now limits pull request titles and their squash commit titles to 72 Unicode code points. It sets no limit for other commits.
- **Problem:** No check enforces the title limit of the `git-commit` skill.
- **Impact if no action:** A long pull request title reaches the squash commit on `main`.
- **Root question:** Does the gate enforce the title limit of the `git-commit` skill?
- **Options:**
  - **A.** Change nothing, and delete this item. Effort: Small.
  - **B.** Add an `xtask` check of the pull request title and the squash commit title against 72 code points, in CI only. It is a new gate. Effort: Medium.
- **Left out:** The 50-character check of every commit. The shared skill no longer states that rule.
- **Wider fix:** B, if the user wants the rule enforced.
- **Previous examples:** None found.
- **Recommendation:** B. The backlog asked for enforcement, and this option follows the current title rule.
- **Action:** ask the user, because condition 3 holds: B adds a new gate.

Source: [Milestone F1](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1117-L1204) of the deleted plan.
