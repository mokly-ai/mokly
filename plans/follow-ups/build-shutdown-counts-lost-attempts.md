# Build shutdown does not requeue running attempts

- **Severity:** Medium (estimate). **Likelihood:** Common. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from finding 5 of the `ea1ea2a8` review in the deleted `plans/cloud-builds.md`, which the user moved to post-merge follow-up, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/application_server.rs:33-41` and `:59-77`, `crates/mkc-api/src/build_runtime.rs:20-55`, `crates/mkc-publications/src/build_worker/claim.rs:54-68` and `crates/mkc-publications/src/build_worker/outcome.rs:24-39`.
- **Reason:** The user moved this finding to post-merge follow-up in Milestone 12 of that plan, after the review that ran on 2026-10-04.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The API waits only for Ctrl-C and then drops the build loop, with no drain or requeue. The chart declares no custom stop signal or `preStop` hook.
- **Category:** Product bug.

- **Terms:**
  - **Attempt:** One run of a build in a sandbox. A build has a retry budget of attempts.
  - **Lease:** The time-limited ownership of a running attempt, which the worker renews every 30 seconds.
- **Background:** The list below gives the facts.
  - The API process runs the build worker. A deploy or a restart stops the process. Today a running attempt then loses its worker.
  - A new lease lasts two minutes. When the lease expires, recovery treats the lost attempt as an infrastructure failure and counts it against the build's retry budget.
  - The requeue then waits a backoff of 60 to 480 seconds, and the fifth lost attempt fails the build.
  - `docs/protocol/cloud-build-lifecycle.md:87-97` and `:140-144` state this counting rule.
  - The code registers Ctrl-C only, and the API pod has a 30-second termination grace period.
  - The review of `ea1ea2a8` reported this, and the user moved it to post-merge follow-up.
- **Problem:** A routine restart uses up an attempt that the build did not fail, and the build waits for the lease to expire.
- **Impact if no action:** Each deploy can delay running builds by the rest of the lease, the recovery poll and the retry backoff. It also spends their retries.
- **Root question:** What happens to running and claimable builds when the worker shuts down?
- **Options:**
  - **A.** Change nothing. Lease recovery handles the attempt later. Effort: Small.
  - **B.** On shutdown, stop claiming builds, end the running attempts, and requeue them without counting the attempt. Effort: Medium.
- **Left out:** Wait for running attempts to finish before shutdown. A build can run up to its 15-minute budget, longer than a rollout waits.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** B. The review recommended it, and the user chose to fix it after the merge.
- **Action:** fix after merge, apply B, because the user moved the finding to post-merge follow-up. B changes the counting rule of `docs/protocol/cloud-build-lifecycle.md`, and the deferral chose no design. Before the implementation, ask the user to approve a retry-neutral shutdown rule, because condition 1 holds.

The plan records the user's choice in Milestone 12 without a day. The review ran after the verification of 2026-10-04, and PR #45 merged on 2026-10-20. Confirm the shutdown signal that the API receives in the Helm chart before you implement B.

Source: [Milestone 12](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L1146-L1160) and [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plan.
