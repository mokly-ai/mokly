# A multi-batch lookup applies its limits to each batch

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/perf-batch-git-base-lookups-maiq`, review round 2.
- **Location:** `crates/mokly-git/src/lookup.rs` (`GitRepository::lookup_metadata`).
- **Reason:** The behaviour is already on `origin/main`.

- **Background:** An exact lookup of more than 128 paths, or of more than 16 KiB of path text, runs one `ls-tree` per argument batch and parses each batch output with the caller's `Limits`.
- **Problem:** Each batch is checked alone, so the combined result can hold more files or nodes than the caller's limits allow.
- **Impact if no action:** A large lookup can return more entries than its limits, where a single batch of the same entries returns `FileCount` or `NodeCount`.
- **Root question:** How can a lookup apply its limits to the whole result, whatever its batch layout?
- **Options:**
  - **A.** Count the files and nodes across batches, and return the typed error when the sum passes the limit. Effort: Small (estimate).
  - **B.** Parse every batch output into one parser state that keeps the counts. Effort: Medium (estimate).
- **Recommendation:** A (estimate).
- **Action:** fix after merge, apply A, because the behaviour is on `origin/main` and outside the scope of the branch.
