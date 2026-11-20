# Superseded retention index is not dropped

- **Severity:** Low. **Effort:** Large (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from Milestone F8 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-db/migrations/202609162000_publications/up.sql:34-36`, `crates/mkc-db/migrations/202609171200_retention_indexes/up.sql:1-4`, `crates/mkc-store-pg/src/retention_candidates.sql:1-11` and `crates/mkc-store-pg/tests/outbox_tests.rs:29-39`.
- **Reason:** The user accepted the finding and its forward-migration fix without applying it, and it was carried into the backlog on 2026-09-20.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify that no query uses the index. The index and its predicate test remain, and no later migration drops it. No query plan with representative rows has run.
- **Category:** Dead code.

- **Background:** The migration `202609162000_publications` creates the index `publications_retention`. The migration `202609171200_retention_indexes` later added partial cutoff indexes for the retention query. The review at `e963ba61` on 2026-09-17 found the superseded index and its test still in place. The user accepted the finding without applying it. The backlog asked to remove both in a forward migration. No later migration drops the index.
- **Problem:** Every write to `publications` maintains an index that no current query names. A search of the code cannot prove that the planner never uses it.
- **Impact if no action:** If no query uses the index, writes cost a little more, and a reader takes the index for a live one.
- **Root question:** Does the schema keep an index that no query uses?
- **Options:**
  - **A.** Keep the index, and remove only its test. Effort: Small.
  - **B.** Drop the index and its test in a forward migration, with a `down.sql` that recreates it and two lock entries. Effort: Large.
- **Left out:** Edit the merged migration. The migration lock forbids it.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** B. The user accepted the drop in a forward migration.
- **Action:** fix after merge, apply B, because the user accepted the finding and its forward-migration fix. Run the index-use checks below first, and drop the index only when they show no use.

Use the `databases` skill for the migration. Before you drop the index, run `EXPLAIN` with representative publication rows for the retention query and the other ID-ordered lifecycle queries. Also read `pg_stat_user_indexes` with its workload and reset period, or equivalent operator evidence. The empty-table plan test of `plans/follow-ups/retention-plan-test-uses-empty-table.md` cannot settle this.

Source: [Milestone F8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1010-L1051) of the deleted plan.
