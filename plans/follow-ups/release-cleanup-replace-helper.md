# Idle cleanup keeps its own process replacement copy

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the round-1 review of the branch
  `calummoore/mokly-return-warmup`, list of problems outside the scope.
- **Location:** `crates/mokly-sidecar/src/pool_releases.rs:137` (`clean_idle`)
  and `crates/mokly-sidecar/src/pool.rs` (`Pool::replace`).
- **Reason:** The copy is older than the return warm-up branch, and that branch
  changed only the request, release, and warm-up paths.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Idle cleanup:** `clean_idle`, the work of the release thread that sends
    `dispose` and `disposeContext` to idle sidecar processes whose generation
    or PostCSS context was released.
  - **Replacement:** the end of a sidecar process that a failure left
    unusable. The pool records the `replacement` reason for the slot and kills
    the process, so that the next request in the slot starts a new process.
- **Background:** The return warm-up branch moved the replacement steps into
  one helper, `Pool::replace` in `crates/mokly-sidecar/src/pool.rs`. The
  request path in `pool_exchange.rs`, the slot release in `pool.rs`, and the
  warm-up in `pool_warmup.rs` call it. `clean_idle` in `pool_releases.rs` runs
  on the release thread and holds only the shared state and the condition
  variable, not a `Pool`. So it keeps its own copy: it reads `stopped`, kills
  the process with or without the `replacement` stop span, and inserts the
  `replacement` reason later.
- **Problem:** Two code paths do the same job. A change to the replacement
  rule, for example a new timing field or a reap, can reach `Pool::replace`
  and miss `clean_idle`.
- **Impact if no action:** The idle cleanup can drift from the request rule
  for a failed process. Today both paths behave the same.
- **Root question:** How does every owner that ends an unusable process use
  one replacement rule?
- **Options:**
  - **A.** Move the shared steps into a free function over the state mutex
    and a control, and call it from `Pool::replace` and `clean_idle`. Effort:
    Small.
  - **B.** Give the release thread a handle that can call `Pool::replace`,
    for example an `Arc` of the shared parts of the pool. Effort: Medium.
- **Left out:** No change, because the two copies can drift. Fewer than three
  approaches are real, because the rule needs only one home that both
  threads can reach.
- **Wider fix:** A. One function then holds the rule for every owner.
- **Previous examples:** The return warm-up branch made `Pool::replace` from
  two copies in `pool_exchange.rs` and `pool.rs`.
- **Recommendation:** A. It removes the copy without a new handle.
- **Action:** fix after merge, apply A, because the copy is older than the
  branch that found it and changes no behaviour.
