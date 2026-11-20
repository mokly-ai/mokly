# GitHub App live walks lack a complete result

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from post-merge tasks of the deleted plans `mokly-cloud-initial-scope.md`, `workspaces.md`, `require-the-installation.md` and `remove-connect-step.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/github-app-smoke.md`.
- **Reason:** The smoke needs a registered App, real GitHub accounts and a deployed environment, so the recorded fixtures cannot prove it.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the live walks. The repository holds only a partial connect and publish walk from September, before the requirements of PR #77.

- **Terms:**
  - **Connect situation:** The install step at `/install?installationId=N` for an installation that arrived from GitHub without a live flow.
  - **Recorded GitHub:** `crates/mkc-github-double`, the replayed GitHub that the test suites use instead of the real one.
- **Background:** The test suites run every GitHub flow against the recorded GitHub. `docs/ops/github-app-smoke.md` says to keep this follow-up open until an operator records live results. The plans below each left a live walk for after their merge. The repository holds no complete current result for them. That absence does not prove that nobody ran them. The dated walk of September in `docs/ops/deploy.md:683-701` covers only part of the initial scope.
  - The initial scope, merged 2026-09-21: installation, OAuth, permissions, webhook and uninstall observations, first through a tunnel.
  - PR #69, merged 2026-10-28: a fresh account walks Workspace, Install and Repository with a real installation.
  - In that walk, the account pane reports GitHub as connected without the reader pressing Connect GitHub.
  - In that walk, the select lists the installed repositories, and the manage link opens GitHub's installation page.
  - PR #77, merged 2026-10-30: install on a personal account and on a GitHub organization, and see both sections in the select.
  - In the PR #77 walk, Configure on GitHub returns to the workspace.
  - In the PR #77 walk, an install started on GitHub connects through the connect situation.
  - In the PR #77 walk, the same account from a second workspace shows the conflict state.
- **Task:** After `plans/follow-ups/github-app-registrations-unverified.md`, run the walks above against `main-preview` from a fresh account. Follow `docs/ops/github-app-smoke.md`. Record delivery IDs, expected and actual statuses and test commit SHAs. Uninstall the test App and revoke its credentials when finished.
- **Impact if no action:** A defect that only real GitHub shows stays hidden until a user meets it in onboarding.
- **Needs:** A registered App with Redirect on update enabled, two GitHub accounts that the operator controls, and a disposable repository.
- **Done when:** `docs/ops/github-app-smoke.md` records each walk with its date and observations.
- **Related:** The list below gives the links.
  - `plans/follow-ups/github-app-registrations-unverified.md` is the prerequisite.
  - `plans/follow-ups/dogfood-catalogue-not-published-from-ci.md` records the live Changes check.

Source: [the workspaces post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/workspaces.md?plain=1#L1019-L1038) and [the initial scope post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-initial-scope.md?plain=1#L2824-L2856) of the deleted plans.
