# push-api.sh is not referenced

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F8 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/scripts/push-api.sh` and `infra/scripts/push-images.sh`.
- **Reason:** A script is an entry point, so its deletion needs the user's approval, as the backlog itself said.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. No file in the repository calls the script, but an operator can still run it by hand.
- **Category:** Code structure.

- **Background:** The list below gives the facts.
  - The review at `e963ba61` on 2026-09-17 found that `infra/scripts/push-api.sh` is unreferenced. `push-images.sh` superseded it.
  - The user accepted the finding without applying it. The backlog asked to delete the script "with the user's approval".
  - On 2026-10-31 no file outside the script itself names it. Deploy and Preview both call `push-images.sh`, which pushes the API, catalogue and app archives. `push-api.sh` pushes only the API archive.
  - It is still a runnable entry point, so the lack of callers does not prove that it is dead. Nothing shows that an operator runs it outside the repository.
- **Problem:** An old push script stays beside the one that the deploy uses.
- **Impact if no action:** An operator can run the old script and push an image outside the reviewed path.
- **Root question:** Does the repository keep `push-api.sh`?
- **Options:**
  - **A.** Delete `infra/scripts/push-api.sh`. Effort: Small.
  - **B.** Keep it, and document in `infra/README.md` why it stays. Effort: Small.
- **Left out:** None. A and B are the two outcomes.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** A. `push-images.sh` does its work, and nothing calls the old script.
- **Action:** ask the user, because condition 3 holds: A deletes an entry point, and the backlog asked for the user's approval.

Source: [Milestone F8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1010-L1051) of the deleted plan.
