# The missing-object fallback builds unbounded attribute names

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/perf-batch-git-base-lookups-maiq`, a finding check of review round 2.
- **Location:** `crates/mokly-git/src/checkout_index.rs` (`checkout_entries`) and `crates/mokly-git/src/presence.rs` (`attribute_paths`).
- **Reason:** The same loop is on `origin/main`. The branch bounds only the sized-listing shortcut.

- **Background:** The missing-object fallback finds the `.gitattributes` path of each distinct ancestor directory of the entries, then passes them to `ls-tree`, which applies the 16 KiB argument budget.
- **Problem:** The names are built before the budget applies. A base commit with a very deep tree of long directory names makes the fallback allocate memory in proportion to the depth times the path length.
- **Impact if no action:** A crafted or unusual base tree can use a lot of memory before the read returns `ArgumentLimit`.
- **Root question:** How can the fallback reject an attribute path over the budget before it builds it?
- **Options:**
  - **A.** Skip, and report as `ArgumentLimit`, a directory whose attribute path would pass the budget, before building its name. Effort: Small (estimate).
  - **B.** Build the attribute arguments with a bounded builder that the batch planner shares. Effort: Medium (estimate).
- **Recommendation:** A (estimate).
- **Action:** fix after merge, apply A, because the loop is on `origin/main` and outside the scope of the branch.
