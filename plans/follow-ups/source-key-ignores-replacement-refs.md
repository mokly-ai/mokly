# Source cache key ignores replacement refs

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-product-hot-spots-found-by-slow-o47c`, a finding check of review round 1.
- **Location:** `crates/mokly-git/src/source_key.rs:50`.
- **Reason:** The key is already on `origin/main`, and a fix changes the base cache identity, which the base cache contract owns.

- **Terms:**
  - **Replacement ref:** a ref under `refs/replace/` that makes Git read another object in place of an object id. Mokly keeps the user's replacement refs: the Git child environment drops `GIT_NO_REPLACE_OBJECTS` and `GIT_REPLACE_REF_BASE`.
  - **Source key:** `Repository::source_key`, the key of the on-disk cache of checkout-converted base sources.
- **Background:** The source key hashes the commit, the effective Git configuration, and the effective attributes of each regular file of the commit. It holds no blob or tree ids. The [base cache contract](../../docs/protocol/mokly-base-cache.md#converted-source-identity) owns this identity.
- **Problem:** A replacement ref that changes file contents but keeps the paths and attributes keeps the same key, so Mokly reuses the old converted files, also across processes.
- **Impact if no action:** A user who adds or changes a replacement ref sees base renders of the earlier contents until the cache entry goes.
- **Root question:** Which inputs must the source key hold so that each different converted byte set gets its own key?
- **Options:**
  - **A.** Add the resolved tree id of the commit, read through replacement refs, to the key. Effort: Small (estimate). It misses a replacement of a nested tree or blob.
  - **B.** Add a digest of the `refs/replace/` refs to the key. Effort: Medium (estimate).
  - **C.** Add the blob ids of the whole-tree listing, which the key already reads, as Git resolves them. Effort: Medium (estimate).
- **Left out:** Turning off replacement refs, because Mokly would then read another tree than the user's Git does.
- **Wider fix:** None found.
- **Recommendation:** B (estimate). It changes the key exactly when the set of replacements changes, at the cost of one ref listing.
- **Action:** ask the user, because the change is a decision of the base cache contract.
