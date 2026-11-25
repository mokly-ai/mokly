# Replaced cache entries can evict live entries

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-actions-cache-headroom-and-gi6l`, review finding 4.
- **Location:** `.github/workflows/ci.yml` (the Rust and npm cache steps and the `CI timing` job), `docs/protocol/ci-verification-security.md#dependency-cache-and-security`, `docs/protocol/ci-duration-budgets.md#actions-cache`.
- **Reason:** The fix gives one CI job `actions: write`, which the cache security rules do not allow today, so the user must approve it.

- **Terms:**
  - **Actions cache:** GitHub's cache store of the repository. It holds at most 10 GB. Above that, GitHub evicts the least recently used entries.
  - **Cache key:** The name of an entry. Every Rust key ends in a hash of `Cargo.lock` and the manifests, and every npm key ends in a hash of `package-lock.json`. A key cannot change after its first save.
  - **Cache budget:** The `cache.gigabytes` value in `scripts/verification/ci-budgets.json`, 8.5 GB. The `CI timing` report warns when the cache total passes it.
- **Background:** Only runs on `main` save a cache. In November 2026 the entries of `main` held about 9.6 GB, and evictions cost the Repository job 3 to 8 minutes for each cold build. Branch `calummoore/ci-speed-actions-cache-headroom-and-gi6l` cut the steady total to about 7.7 GB and added the cache warning to the `CI timing` report. The report reads the cache list after every other job of the run.
- **Problem:** One `Cargo.lock` change gives every Rust key a new hash, so one run on `main` saves a complete new set of about 6 GB beside the old set. The total then passes 10 GB during that run. GitHub evicts the least recently used entries, which can include a live entry that the run did not touch, such as the `stripe-catalogue` entry of the deploy workflow or a `lint-native` entry. The report can warn only after the saves, so it does not warn in advance.
- **Impact if no action:** After each lockfile change, a live entry can be evicted, and the next jobs that need it build cold until a later run saves it again.
- **Root question:** How do the live cache entries of `main` survive the run that replaces a whole set of keys?
- **Options:**
  - **A.** Change nothing. The old set stops being used, so least-recently-used eviction usually removes it first. A live entry that no run touched since the old set was last used can still go. Effort: Small.
  - **B.** Report the usage at the start and at the end of CI. This shows the pressure before the run, but the saves of one run can still cross both thresholds between the samples. Effort: Medium.
  - **C.** In the timing report, add a projected total: the current total plus the size of the largest group of keys that one lockfile change replaces. Warn when that projection passes 10 GB. This is a heuristic that depends on the key shapes. Effort: Medium.
  - **D.** Add a step on `main` that runs after the saves. It deletes each entry that a newer entry with the same key prefix replaces, such as the old Rust set after a lockfile change. The step needs `actions: write`, the security doc changes, and the delete logic needs tests. Effort: Medium.
- **Left out:** Stopping cache saves at the budget lets every cache go stale after a lockfile change, and D is better on every point. A lower fixed budget would warn on every run, because the normal total is already near it.
- **Wider fix:** D. It keeps only the newest entry of each key prefix, whatever the size of the change.
- **Previous examples:** Commit `ba015c2df` recorded the eviction of the macOS and Repository Rust entries of `main` and Repository runs about 8 minutes slower.
- **Recommendation:** D. It removes the cause, and the deleted entries are ones that no job restores again.
- **Action:** ask the user, because D gives a CI job `actions: write`, and the cache security rules allow no job to write to the cache store except through a `main` save.
