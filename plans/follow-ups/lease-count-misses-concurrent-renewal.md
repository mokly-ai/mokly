# Lease count can miss a concurrent renewal

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from open review finding 1 of the Milestone 5 review TODO in the deleted `plans/build-lock-and-clock-order.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-store-pg/src/build/queries.rs:66-91`, `crates/mkc-store-pg/src/build/claim_organization.sql`, `crates/mkc-store-pg/src/build/claim_build.sql`, `crates/mkc-store-pg/src/build/start.sql`, `crates/mkc-store-pg/src/build/claim.rs:26-39`, `docs/protocol/cloud/cloud-build-lifecycle.md:104-110` and `docs/protocol/cloud/persistence-transactions.md:21-29`.
- **Reason:** The recommended fix changes the renewal rule that the protocol doc states, and no user decision covers that change.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the race. Renewal still locks only its own build, while a claim takes the workspace lock. No controlled overlap has run.
- **Category:** Product bug.

- **Terms:**
  - **Lease:** The time-limited ownership of a running build attempt, stored as `lease_token` and `lease_expires_at` on the `builds` row.
  - **Live lease:** A running build whose `lease_expires_at` is later than the clock reading of the query.
  - **Clock guard:** The injected `BuildClock` that claims, renewal and upload-grant consumption read after their locks.
- **Background:** Cloud builds allow at most two live leases for each workspace. A claim locks the workspace row and the candidate build, then counts the live leases of the workspace. The count reads the other builds without row locks. Renewal locks only its own build row, reads the clock guard, and extends the lease when `lease_expires_at` is later than that reading. The worker renews every 30 seconds with a two-minute lease. PR #61 fixed the earlier clock and lock order findings on 2026-10-26.
- **Problem:** A claim and a renewal can overlap at the expiry boundary. The renewal reads the clock just before expiry and then commits. The claim reads the clock just after expiry, counts the lease as expired, and starts a third build. Then three leases can be live. Nobody has reproduced this overlap with the real store. Serializable isolation does not stop it, because the two transactions form no cycle.
- **Impact if no action:** In a rare timing, a workspace runs three builds at once instead of two. This happens only when an owner renews in the last instant before its lease expires.
- **Root question:** How does the two-lease limit stay true when a renewal and a claim meet at the expiry boundary?
- **Options:**
  - **B.** Accept the rare third lease, and state the limit as best effort in `docs/protocol/cloud/cloud-build-lifecycle.md`. Effort: Small.
  - **A.** Renew only while the stored expiry is at least ten seconds after the fresh clock reading. A claim then sees an expired lease only when no renewal that takes less than ten seconds can still succeed. A transaction that stalls longer can still race. It changes the renewal rule in `docs/protocol/cloud/persistence-transactions.md:21-29`. Effort: Medium.
  - **C.** Make renewal take a key-share lock on the workspace row before it reads the clock. A claim holds an update lock on that row, so the two serialize. It adds one lock to every renewal. Effort: Medium.
- **Left out:** A retry that recounts after commit. A commit cannot be undone, so a recount finds the third lease too late.
- **Wider fix:** C. One lock order for every lease write removes the class. A only narrows the window to transactions slower than ten seconds.
- **Previous examples:** PR #61 fixed the same class for claims and grant consumption: it reads the clock after all required locks.
- **Recommendation:** C. It removes the unsynchronized write, while A only narrows the window to transactions faster than ten seconds. First reproduce the overlap with the real store. The review recommended A, because it needs no new lock on the busy workspace row.
- **Action:** ask the user, because condition 1 holds: A and C change the renewal or lock rule in `persistence-transactions.md`, and no recorded decision covers it.

The review graded the finding Low severity and Medium effort, and it recorded option A only. Options B and C were added on 2026-10-30, and their efforts are estimates.

The Postgres regressions of the earlier revival case do not cover this last-instant renewal. The lifecycle rules now live in `docs/protocol/cloud/cloud-build-lifecycle.md`. A regression for this case needs a controlled overlap of one claim and one renewal through the real store. It holds the renewal after its clock read before expiry, while another connection claims after expiry. It then reads the committed build rows and clock readings under the real isolation and retry behaviour of the store.

Source: [the open findings](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/build-lock-and-clock-order.md?plain=1#L117-L136) of the deleted plan.
