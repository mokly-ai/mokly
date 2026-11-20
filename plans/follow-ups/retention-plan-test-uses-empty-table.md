# Retention plan test uses an empty table

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from Milestone F8 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-store-pg/tests/maintenance/plans_tests.rs:25-61` and `crates/mkc-store-pg/tests/maintenance/fixtures.rs:30-64`.
- **Reason:** The user accepted the finding without applying it, and it was carried into the backlog on 2026-09-20.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The publication `EXPLAIN` still runs on an empty table with `enable_seqscan = off`. No slow query has been observed.
- **Category:** Test.

- **Background:** The test `production_candidate_queries_use_partial_cutoff_indexes` checks with `EXPLAIN` that the retention queries use their partial indexes. It inserts no rows and sets `enable_seqscan = off`. The blob test beside it inserts 200 rows. The review at `e963ba61` on 2026-09-17 found the gap, and the user accepted it without applying it.
- **Problem:** On an empty table, the planner's choice says little about the plan on real data. With `enable_seqscan = off`, the test proves only that the planner can use the indexes. Rows alone do not make that forced plan representative, so first define whether the test checks index use or plan quality.
- **Impact if no action:** A change that makes the retention queries slow on real data can pass the test.
- **Root question:** Does the plan test reflect the plan on real data?
- **Options:**
  - **A.** Insert enough rows before the `EXPLAIN`, as the blob test does. A one-time performance proof stays outside the permanent suite. Effort: Small.
  - **B.** Remove the test, and rely on production traces. Effort: Small.
- **Left out:** None. A and B are the two outcomes.
- **Wider fix:** None found.
- **Previous examples:** The blob test beside it already inserts 200 rows.
- **Recommendation:** A. The review recommended it.
- **Action:** fix after merge, apply A, because the user accepted the finding as follow-up work.

Source: [Milestone F8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1010-L1051) of the deleted plan.
