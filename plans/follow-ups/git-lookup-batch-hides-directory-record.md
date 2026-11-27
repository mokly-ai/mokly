# A lookup batch can hide a directory record

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-product-hot-spots-found-by-slow-o47c`, a finding check of review round 1.
- **Location:** `crates/mokly-git/src/lookup.rs:25` (`lookup_metadata`) and `crates/mokly-compare/src/sources.rs:199` (`GitSources::ensure`).
- **Reason:** The behaviour is already on `origin/main`, and a fix changes which entries a lookup returns, so it needs its own change.

- **Terms:**
  - **Exact lookup:** `Repository::lookup`, which runs `git ls-tree -l -z --full-tree {commit} -- {paths}` in batches of at most 128 paths and 16 KiB of argument cost.
- **Background:** Git enters a directory when a requested path lies below it, and it then prints the directory's matching children in place of the directory's own record. A Git 2.43.0 probe showed it: `ls-tree -l -z -- dir dir/f1` prints `dir/f1`, `dir/f2`, and `dir/f3`, and no `dir` record. Two separate calls print `dir` and `dir/f1`.
- **Problem:** When one batch holds a directory and a path below it, the directory gets no entry, and the result holds unrequested siblings. `GitSources::ensure` then marks the directory as looked up without an entry, so a later projection of it returns no node, and a read of it fails with `MissingBlob` instead of the `NotRegular` that `docs/protocol/mokly-git.md` requires for a nonregular path. Where the batch splits also changes the result.
- **Impact if no action:** A caller that asks for a directory and a file below it in one call can treat the directory as missing. No current caller is known to do this; `GitTree::hint_metadata` leaves such directories out of its batch for this reason.
- **Root question:** How can an exact lookup return the same entries for each requested path, whatever the other paths of its batch are?
- **Options:**
  - **A.** In `GitSources::ensure`, look up a path that has a descendant in the same set alone, as `GitTree::hint_metadata` does. Effort: Small (estimate).
  - **B.** Run exact lookups with `ls-tree -t`, keep each requested record, and drop the records that no requested path names. Test a directory and its child in one batch and in two. Effort: Medium (estimate).
- **Left out:** Sorting the result, because it cannot bring back a record that Git never printed.
- **Wider fix:** B, because it makes every caller independent of the batch layout.
- **Related:** [ignored-module-large-index.md](./ignored-module-large-index.md): the same Git behaviour in `ls-files`. A folder in a request lists the records below it, which limits its option D. Its option B keeps only the requested records, as option B here does.
- **Recommendation:** B (estimate). It gives each requested path its own record, as the protocol expects.
- **Action:** ask the user, because B changes which entries `Repository::lookup` returns on `origin/main`.
