# Base cache keeps one lock file per key

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the options check of design calls 24 and 25 of
  the bundle disk cache plan on branch `calummoore/lisbon-h906`. The check put
  this problem outside the scope of that change.
- **Location:** `crates/mokly-platform/src/locks.rs:40` to line 59,
  `crates/mokly-compare/src/cache_lock.rs:9`,
  `crates/mokly-compare/src/cache.rs:63` and `:102`,
  `crates/mokly-compare/src/cache_maintenance.rs:45`, `:82`, and `:97`,
  `crates/mokly-compare/src/cache_transient.rs:34`, and the section "Cache
  Location And Ownership" of `docs/protocol/mokly-base-cache.md`.
- **Reason:** The growth predates the bundle disk cache change, and a bounded
  fix changes the rule "Lock files remain", which needs the user.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Source and dependency kinds:** the two kinds of the per-repository cache
    under the operating system's cache directory. They hold extracted base
    commits and installed base packages.
  - **Entry lock:** the operating system file lock of one source or dependency
    key, in the file `locks/{key}.lock` of its kind.
  - **Lease:** a preparation's hold on a complete entry. It keeps the shared
    entry lock while the preparation uses the files.
  - **Verified deletion:** a lock protocol that deletes an idle lock file and
    makes each lock attempt check that its open file is still the file at the
    lock path.
- **Background:**
  - `acquire` in `crates/mokly-platform/src/locks.rs:40` to line 59 opens each
    lock file with `create(true)`. No code deletes a file in `locks/`.
  - The section "Cache Location And Ownership" of
    `docs/protocol/mokly-base-cache.md` says: "A lock ends when its holder
    exits. Lock files remain."
  - `entry_lock_path` in `crates/mokly-compare/src/cache_lock.rs:9` is the one
    lock-path mapping of every kind. It gives each source or dependency key the
    file `locks/{key}.lock`. These functions of `crates/mokly-compare/src` lock
    through it:
    - `hit` and `build` in `cache.rs`;
    - `evict` and `clean_stages` in `cache_maintenance.rs`;
    - `transient` in `cache_transient.rs`, which gives each partial extraction
      a private key of its own.
  - The **Location** lines were checked on 2026-11-16.
  - So each source key leaves one empty lock file, also after eviction removes
    its entry. A source key is one base commit with its checkout settings. Each
    dependency key does the same.
  - The files grow with each new base commit and dependency set over the life
    of the cache directory. The byte bounds do not count them.
  - No operation lists `locks/`. So the growth costs directory entries and
    inodes, not run time. Deleting the cache directory removes the files.
  - Since 2026-11-16 the bundle kind uses a fixed set of 256 entry locks from
    the same function. The first byte of each settings key selects one. That
    fixed set does not fit the source and dependency kinds:
    - `DiskCache::lock`, at `crates/mokly-compare/src/cache.rs:38` to line 52,
      waits for a held lock.
    - A lease keeps its shared lock while a preparation uses the files, at
      `Lease` in `crates/mokly-compare/src/cache_types.rs:63` to line 69.
    - With a fixed lock set, a build would wait for the lease of an unrelated
      key that shares its lock, until cancellation.
    - `acquire` opens a new handle for each attempt. So a process also
      conflicts with its own lease, and a build could wait for its own lease.
- **Problem:** The source and dependency kinds keep one lock file for each key
  that they ever used, with no bound.
- **Impact if no action:** A long-lived cache directory collects one empty file
  for each base commit and dependency set. The growth is slow and costs no run
  time. Deleting the cache directory removes it.
- **Root question:** How do the source and dependency kinds keep their lock
  files bounded, while each key keeps its own waiting lock and its long leases?
- **Options:**
  - **A.** Change nothing. The rule "Lock files remain" stays. Effort: Small.
  - **B.** Verified deletion.
    - A writer deletes the lock file of a key while it holds it, at retirement
      and eviction.
    - After each lock attempt, the holder compares the file identity of its
      handle with the file at the path. A difference counts as a held lock,
      and a waiting caller tries again.
    - Cost: file identity on Unix and on Windows, a Windows case for a file
      that waits for deletion, a sweep of leftover lock files, and a new lock
      lifetime protocol with tests on both systems.
    - It changes the rule "Lock files remain". Effort: Large.
  - **C.** A sweep while no operation runs.
    - Each operation first takes a shared outer lock. A sweep takes that lock
      exclusively, once, and deletes the idle lock files.
    - Long leases hold the outer lock for a whole preparation, and a suspended
      process stops every sweep. So the bound is eventual only.
    - It changes the same rule. Effort: Medium.
- **Left out:**
  - The fixed lock set of the bundle kind. Waiting locks and long leases would
    make a build wait for an unrelated key or for its own lease.
  - Deleting idle lock files without an identity check. A process that opened
    the path just before the delete then holds a lock on a file with no name,
    so two writers can build one entry.
- **Wider fix:** B. Verified deletion can serve every kind.
- **Previous examples:** The fixed entry locks of the bundle kind, chosen on
  2026-11-16, bound the same growth for that kind.
- **Related:**
  - [base-cache-lock-wait.md](./base-cache-lock-wait.md): the same lock code
    and its waits. A fix of either item must keep the rules of the other. Each
    item can merge alone.
- **Recommendation:** A. The growth is slow, it costs no run time, and deleting
  the cache removes it. B is the only bounded fix, and it needs a new lock
  lifetime protocol. B best protects the codebase.
- **Action:** ask the user, because no option is clearly best. A accepts a
  slow growth, and B bounds it with a new lock lifetime protocol that changes
  the rule "Lock files remain".
