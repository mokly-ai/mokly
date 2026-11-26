# The missing-object fallback clones each entry into a map

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/perf-batch-git-base-lookups-maiq`, a finding check of review round 2.
- **Location:** `crates/mokly-git/src/checkout_index.rs` (`checkout_entries` and `fetch_checkout_objects`).
- **Reason:** The lines are the same on `origin/main`.

- **Category:** Performance.
- **Problem:** `checkout_entries` clones each entry into a `BTreeMap` and clones its path again for the key. `fetch_checkout_objects` then turns the map back into a `Vec` for `ensure_objects`, which reads only the modes and the object IDs. A scratch run measured about 0.76 ms per 4,096-path conversion batch.
- **Impact if no action:** Each fallback batch spends this time and memory.
- **Root question:** How can the fallback give `ensure_objects` the modes and IDs without copies?
- **Options:**
  - **A.** Pass borrowed entries to `ensure_objects`, and index the attribute entries alone. Effort: Small (estimate).
- **Recommendation:** A (estimate).
- **Action:** fix after merge, apply A, because the lines are on `origin/main` and outside the scope of the branch.
