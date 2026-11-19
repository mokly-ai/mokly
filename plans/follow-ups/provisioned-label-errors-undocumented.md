# Stable origin errors need a policy decision

- **Severity:** Low. **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the Milestone 5 review outcome of the deleted `plans/unified-domain-layout.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `apps/worker/src/index.ts:121,229-230`, `docs/protocol/cloud/origin-router.md:74-75,123-130` and `apps/worker/README.md:31-33`.
- **Reason:** The recorded recommendation changes the current branch-origin requirement, and no user decision approves that policy.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The Worker still rethrows a failed `br-main` fetch, while the contract and the README still promise a router 404.
- **Category:** Docs or spec.

- **Terms:**
  - **Provisioned label:** A host label with a fixed environment behind it, such as `production` or `br-main`.
  - **Disposable label:** A pull request label, `pr-N`, whose preview may not exist.
- **Background:** The list below gives the facts.
  - The origin router proxies product paths to the environment's app workload.
  - The review of 2026-09-22 found different answers for failed origin fetches. Provisioned labels propagate a Worker error, while disposable labels get the router's 404. The code still makes `br-main` provisioned.
  - Commit `2fe70139` later added the branch-origin requirement below. The review recorded its recommendation, but no user chose it.
  - The tests at `apps/worker/tests/routing.test.ts:139-151` cover unresolved origins for `pr-84` and `br-feature`, not `br-main`.
  - Nobody has seen a deployed origin outage from this.
- **Problem:** `origin-router.md:74-75` requires a no-store router 404 when a valid branch label has no internal origin record. That includes `br-main`, whose failed fetch the code rethrows instead. `apps/worker/README.md:31-33` also promises a router 404 for an unresolved branch origin. Documenting the observed split would change this requirement. The provisioned set also depends on the literal `main`.
- **Impact if no action:** The router and its branch-origin requirement remain inconsistent. A later worker could mistake the old recommendation for an approved policy change.
- **Root question:** What does the router answer when the origin of each kind of label cannot be reached?
- **Options:**
  - **A.** Approve the observed split: stable hosts propagate Worker errors and disposable hosts get the router's 404. Update the branch requirement and test each kind. Effort: Small.
  - **B.** Do A, and derive the provisioned set from configuration data instead of the literal `main`. A new Worker binding also changes the D-only runtime-value requirement at `origin-router.md:129-130`. The binding touches the Worker source, its renderer and the deployment configuration. Effort: Medium (estimate).
  - **C.** Return the no-store router 404 for every failed origin fetch. This keeps the current `br-main` branch rule, but changes other stable-host failures. Effort: Small.
  - **D.** Give stable hosts a synthetic no-store 5xx response, while disposable hosts keep the router's 404. Document and test the new stable-host policy. Effort: Small.
- **Left out:** Delete this item. The code and the branch-origin requirement would still disagree. No error policy is excluded by an unrecorded assumption about stable hosts.
- **Wider fix:** B. Data names the provisioned set, so a new stable environment needs no code change.
- **Previous examples:** None found.
- **Recommendation:** B. Configuration owns the stable set, so a new stable environment needs no routing-code change. The original review recommended B. C keeps the current branch rule, and D gives stable failures a defined response.
- **Action:** ask the user, because condition 1 holds: B changes the current branch-origin requirement without a recorded user decision. This item chooses no router policy.

Source: [the Review Outcomes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/unified-domain-layout.md?plain=1#L573-L605) of the deleted plan.
