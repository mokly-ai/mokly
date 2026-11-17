# Base cache waits behind a suspended process

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the options check of design calls 14 to 19 of
  the bundle disk cache plan on branch `calummoore/lisbon-h906`. The check
  put this problem outside the scope of that change.
- **Location:** `crates/mokly-compare/src/cache.rs:38` to line 52,
  `crates/mokly-compare/src/cache.rs:63`, `:69`, `:115`, and `:140`,
  `crates/mokly-compare/src/cache_transient.rs:17`, and
  `crates/mokly-compare/src/dependencies.rs:104`.
- **Reason:** The wait predates the bundle disk cache change, and every fix
  changes a base cache rule or the terminal output, which needs the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Source and dependency kinds:** the two kinds of the per-repository
    cache under the operating system's cache directory. They hold extracted
    base commits and installed base packages.
  - **Entry lock:** the file lock of one cache key. A builder holds it
    exclusively while it extracts or installs. A lease holds it shared while
    a preparation uses the entry.
  - **Namespace lock:** the `state.lock` file of one kind. A process holds it
    for one short step, such as an access-order update, an eviction, a
    receipt, or a stage cleanup.
  - **Suspended process:** a process that the operating system stopped
    without ending it, for example after Ctrl+Z in a shell, a `SIGSTOP`, or a
    debugger pause. It keeps every file lock that it holds.
- **Background:**
  - `DiskCache::lock` in `crates/mokly-compare/src/cache.rs:38` to line 52
    tries the lock. When another holder has it, the loop pauses 5 ms and tries
    again. The loop has no time limit. Only `check()`, which reads the cache's
    cancellation, ends it with `Error::Cancelled`.
  - These steps wait in that loop:
    - `hit` takes the shared entry lock at `cache.rs:63`, then the namespace
      lock at `cache.rs:69`. Both `get` and `lease`, the lookup without a
      build, run `hit`.
    - `build` takes the namespace lock at `cache.rs:115` and at
      `cache.rs:140`.
    - `transient` takes the namespace lock at
      `crates/mokly-compare/src/cache_transient.rs:17`.
  - `build` tries the entry lock once, at `cache.rs:102` to line 109. When
    another holder has it, `get` runs `hit` again, and `hit` waits for the
    shared entry lock.
  - Each entry lock path comes from `entry_lock_path` in
    `crates/mokly-compare/src/cache_lock.rs:9`, the one lock-path mapping of
    every kind. It gives each source or dependency key its own lock file.
    The bundle kind gets its fixed stripe files from the same function.
  - A shared lease of a damaged entry also blocks its repair. `get` then
    repeats `hit` and `build` until the lease ends, with the same cancellation
    as its only other exit.
  - The lock files hold no data. Each lock is an operating system file lock
    that ends when its holder exits. A suspended holder never exits on its
    own, so the waiter waits until its own cancellation.
  - In `build` and `publish`, that cancellation is the command's interrupt,
    through `GitCancellation` in `crates/mokly-cli/src/changes_runtime.rs:155`
    to line 166. In Serve, `CombinedCancel` in
    `crates/mokly-cli/src/serve_changes_base.rs:31` to line 39 ends the wait
    when Serve stops, when a later Changes classification replaces this one,
    or when its capture scope is cancelled.
  - The base dependency preparation has a 120-second budget, set at
    `crates/mokly-compare/src/dependencies.rs:61`. Only the version checks and
    the install commands of the same process read it. The wait inside
    `self.cache.get` at `dependencies.rs:104` does not read it.
  - Source extraction has no overall time limit. Each checkout filter
    conversion has its own 120-second allowance.
  - While a preparation waits, the comparison step label keeps an earlier
    step, because only a build announces `extracting base sources` or
    `installing base dependencies`. Rich `build` then shows a line such as
    `Comparing with origin/main · reading base catalogue` until the user
    interrupts it. Plain mode shows nothing. Serve keeps Changes pending.
  - The test `contended_entry_can_be_cancelled_before_any_namespace_lock` in
    `crates/mokly-compare/src/_tests_/cache_tests.rs:158` shows that only
    cancellation ends a contended wait.
  - These requirements are in force:
    - The section "Cache Location And Ownership" of
      `docs/protocol/mokly-base-cache.md` says that one caller at a time
      builds or repairs an entry, and that a caller that waits for that build
      uses the completed entry. It also says that a lock ends when its holder
      exits. No rule limits the wait.
    - The "Budgets" table of `docs/protocol/mokly-timings.md` gives the base
      dependency preparation 120 seconds for version discovery and all
      selected installs. Expiry uses the documented dependency fallback.
    - `docs/protocol/mokly-base-preparation.md` says that Changes is
      unavailable when a remaining tree, file, or command budget prevents
      comparison. The diagnostic names the requested path or root and the
      limit.
  - The bundle kind of the same cache never waits. It tries each lock once,
    under the section "Bundle Entries" of `docs/protocol/mokly-base-cache.md`.
    The options check of 2026-11-16 kept the wait of the source and
    dependency kinds as it is.
- **Problem:** A preparation that needs a source or dependency cache lock
  waits for it without a time limit. When a suspended process holds the lock,
  only the cancellation of the waiting command ends the wait.
- **Impact if no action:** `mokly build` and `mokly publish` wait until the
  user interrupts them, and no output names the cause. Serve keeps Changes
  pending, and each later classification waits again. The user can resume or
  stop the suspended process, or interrupt the command.
- **Root question:** How does a command avoid an endless wait for a base
  cache lock that a suspended process holds?
- **Options:**
  - **A.** Report the wait. After a fixed delay, such as 10 seconds, print one
    terminal line that says that another Mokly process uses the base cache.
    Then keep waiting. The user learns the cause and can resume or stop that
    process. The stall stays, and the line is new terminal output. Effort:
    Medium.
  - **B.** Limit each wait and use the existing fallbacks. A wait for a
    dependency entry counts against the 120-second dependency budget. Expiry
    then gives the documented time-limit fallback with its
    `base-dependencies` warning. A wait for a source entry or a namespace
    lock ends at a new limit, such as 120 seconds. Changes is then
    unavailable, and the diagnostic names the cache directory and the limit.
    A slow but live extraction in another process can then make Changes
    unavailable once. Effort: Medium.
  - **C.** Never wait, as the bundle kind does. Try each lock once. A held
    entry lock builds a private copy under a private key, as a partial
    extraction already does. A held namespace lock skips the access-order
    update of a hit. Two processes then extract or install the same base
    twice. Each private copy can use the 2 GiB bound of its kind, and no
    later preparation reuses it. Effort: Medium.
  - **D.** Wait only while the holder makes progress. A builder updates a
    progress record beside its entry lock at a fixed interval, from its own
    thread. A waiter keeps waiting while the record changes. It uses the
    fallbacks of B when the record does not change for a fixed interval, such
    as 30 seconds. A slow but live builder then never causes a fallback. The
    record and its interval are new cache rules. Effort: Large.
- **Left out:**
  - Change nothing. A command can still stall with no message, so it fails
    the goal.
  - Detect a stopped holder through the operating system. Each platform needs
    its own probe, and the lock files hold no process id. D covers a frozen
    holder on every platform.
  - Break the lock of a holder that looks stuck. Nothing can take a file lock
    from a live holder, and a deleted lock file lets two writers build one
    entry.
- **Wider fix:** B. A limit inside `DiskCache::lock` covers every current and
  later caller of the wait.
- **Previous examples:**
  - `plans/follow-ups/install-pipe-wait-after-stop.md`: a stopped base
    install waits without a limit for its output pipes.
  - The bundle kind tries each lock once. The bundle disk cache change chose
    that rule on 2026-11-16.
- **Related:**
  - [install-pipe-wait-after-stop.md](./install-pipe-wait-after-stop.md): the
    same class of wait without a limit during base preparation. The causes
    and the fixes differ.
  - [keep-base-side-in-memory.md](./keep-base-side-in-memory.md): a kept base
    would hold its shared leases longer. A repair of a damaged entry would
    then wait longer too.
  - [base-cache-lock-file-growth.md](./base-cache-lock-file-growth.md): the
    same lock code and its lock files. A fix of either item must keep the
    rules of the other. Each item can merge alone.
- **Recommendation:** B. It ends every wait with a result that the protocol
  already describes, at Medium effort. Its dependency half reuses the
  existing 120-second budget and fallback. D best avoids a fallback for a
  live builder.
- **Action:** ask the user, because B adds a time limit and an unavailable
  Changes result for source and namespace lock waits, and no protocol rule
  covers them.
