# Stale previews have no automatic cleanup

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/pr-preview-environments.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `.github/workflows/preview.yml:2-10`, `infra/scripts/preview-event.py:17-25`, `infra/scripts/preview-destroy.sh` and `docs/ops/preview.md:243-245`.
- **Reason:** The plan left the cleanup job as an idea to consider, and no requirement asks for it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The preview workflow runs only on pull request events and has no schedule, as the runbook documents.
- **Category:** Process.

- **Terms:**
  - **Preview namespace:** The Kubernetes namespace `preview-pr-N` that a labelled pull request deploys.
- **Background:** A same-repository pull request with the `preview` label deploys a namespace. Unlabel or close destroys it. A forgotten label keeps the namespace alive with its Postgres, API, catalogue server and app. `docs/ops/preview.md:243-245` says that a labelled pull request keeps its preview until it closes or loses the label, and that no stale-label reaper exists. That is the current, intended lifecycle.
- **Problem:** Nothing removes a preview whose pull request has had no push for a long time.
- **Impact if no action:** Forgotten previews keep their cluster cost until someone removes the label.
- **Root question:** How does a forgotten preview stop costing money?
- **Options:**
  - **A.** Change nothing. A reviewer removes the label by hand. Effort: Small.
  - **B.** Add a nightly job that destroys previews whose pull request had no push for seven days, and removes the label. The seven days are the source's proposal. The age, the activity basis, the label behaviour and the reviewer's recovery are still open. Effort: Medium (estimate), to regrade with that design.
- **Left out:** A destroy on every merge of `main`. It would remove previews that reviewers still use.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** B. An expiry rule removes the cost without manual work. The user has chosen neither the rule nor its age, and A stays valid under the current lifecycle.
- **Action:** ask the user, because condition 2 holds: B adds behaviour that no requirement covers.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/pr-preview-environments.md?plain=1#L610-L625) of the deleted plan.
