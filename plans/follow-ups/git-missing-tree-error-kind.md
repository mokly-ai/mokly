# A missing tree gives `CommandFailed`, not a typed missing-object error

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/perf-batch-git-base-lookups-maiq`, a finding check of review round 2.
- **Location:** `docs/protocol/mokly-git.md` (the presence sentence) and `crates/mokly-git/src/lookup.rs`.
- **Reason:** The behaviour is on `origin/main`, and the fix decides which side is right.

- **Background:** `docs/protocol/mokly-git.md` says that missing objects without a promisor remote keep a typed fetch error.
- **Problem:** A lookup of a path below a directory whose tree object is missing, and a listing below that directory, return `CommandFailed` with status 1 on `origin/main` and on the branch, on Git 2.43.0 and 2.56.1.
- **Impact if no action:** A damaged base gives a generic command error, not `MissingObject`, for a missing tree.
- **Root question:** Which error must a read return when Git cannot open a tree on the path?
- **Options:**
  - **A.** Narrow the protocol sentence to missing blobs. Effort: Small (estimate).
  - **B.** Map Git's missing-tree failure to `MissingObject`. Effort: Small (estimate).
- **Recommendation:** A (estimate), because the blob errors are what a read can recover from with a fetch.
- **Action:** ask the user, because the fix changes a protocol requirement or its implementation.
