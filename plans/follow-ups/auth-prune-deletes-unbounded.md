# Auth prune runs unbounded deletes

- **Severity:** Low. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from Milestone F8 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-auth/src/prune.rs:72-82`, `crates/mkc-store-pg/src/magic_link.rs:45-50`, `crates/mkc-store-pg/src/session.rs:49-63`, `crates/mkc-store-pg/src/rate_limit.rs:39-44` and `infra/helm/mokly-cloud/templates/maintenance.yaml:18-20`.
- **Reason:** The user accepted the finding without applying it, and it was carried into the backlog on 2026-09-20.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. `AuthPruner::prune` still runs the three deletes with no row limit in one transaction. No load test has measured a deadline overrun.
- **Category:** Performance.

- **Terms:**
  - **Auth prune:** `mkc-api prune`, the CronJob that deletes expired magic links, sessions and rate-limit counters.
- **Background:** The review at `e963ba61` on 2026-09-17 found that `prune` runs three unbounded deletes in one serializable transaction. The CronJob has a ten-minute deadline, `activeDeadlineSeconds: 600` in `infra/helm/mokly-cloud/templates/maintenance.yaml`. The user accepted the finding without applying it. The backlog listed it first, as one of the two findings "with production teeth".
- **Problem:** Each delete has no row limit, so a large backlog of expired rows runs in one long transaction.
- **Impact if no action:** After a long outage of the CronJob, one prune can run past its deadline and hold locks on the auth tables. Nobody has seen or measured such an overrun.
- **Root question:** How does prune finish within its deadline whatever the backlog?
- **Options:**
  - **A.** Change nothing, because the table sizes stay small today. Effort: Small.
  - **B.** Delete in batches, with a row limit for each statement, and stop at the deadline. Effort: Medium.
- **Left out:** Raise the CronJob deadline. The transaction stays unbounded.
- **Wider fix:** B. Batched deletes bound every run.
- **Previous examples:** None found.
- **Recommendation:** B. The review recommended it, and the user accepted the finding.
- **Action:** fix after merge, apply B, because the user accepted the finding and its fix as follow-up work.

Source: [Milestone F8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1010-L1051) of the deleted plan, and the [review record](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-initial-scope.md?plain=1#L2694-L2712) of the deleted initial scope plan.
