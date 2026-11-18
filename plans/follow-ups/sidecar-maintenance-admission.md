# Count maintenance in Serve sidecar admission

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the memory-guard options check on branch
  `calummoore/mokly-sidecar-memory-guard-cf9n`.
- **Location:** `crates/mokly-sidecar/src/pool_return.rs:54`,
  `crates/mokly-sidecar/src/pool_releases.rs:109`, and
  `crates/mokly-cli/src/serve_pool.rs`.
- **Reason:** The maintenance paths already take slots outside Serve admission
  on main, independently of memory admission.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Serve gate:** The CLI scheduler that bounds sidecar calls and gives HTTP
    work priority over queued background calls.
  - **Head return:** Background work that replaces an idle base worker with a
    worker for the current catalogue.
- **Background:** Serve uses one sidecar pool for the current catalogue and
  its comparison base. The gate counts calls that it admitted. Head return
  and idle release cleanup can take an available pool slot without entering
  that gate. The root-scheduling protocol owns head return, and the on-demand
  protocol owns foreground priority.
- **Problem:** A call that passes the gate can still wait in the pool queue
  for maintenance. `claim_return` removes a slot from `available` and marks
  head return active. `clean_idle` also removes slots while it releases old
  generation or PostCSS state. Neither operation appears in the gate's active
  call count. Code tracing found this gap; no event-order reproduction has
  yet established its user-visible impact.
- **Impact if no action:** The gate's admitted count can exceed the slots
  available for calls. A queued background call can remain counted as active
  while later HTTP work waits at the gate.
- **Root question:** How should Serve count internal maintenance so that
  queued background calls do not delay HTTP work?
- **Options:**
  - **A.** Keep the current bounded maintenance behavior. First reproduce the
    interleaving and determine whether existing maintenance handover already
    preserves the foreground requirement. Effort: Small.
  - **B.** Give calls and maintenance one shared admission owner. Maintenance
    holds capacity while it owns a slot and yields before new queued HTTP
    work, without interrupting an active cleanup operation. This removes the
    separate uncounted path. Effort: Medium.
  - **C.** Move all request and maintenance priority into the pool queue.
    This also replaces Serve's external admission ownership and requires
    propagation of request priority through every affected caller.
    Effort: Large.
- **Left out:** Retrying a call does not account for a maintenance owner.
  Reserving an idle worker permanently would reduce useful concurrency.
- **Wider fix:** B. One owner accounts for both kinds of slot use.
- **Previous examples:** Both maintenance paths are present before default
  memory admission. Existing worker replacement and release tests cover
  their lifecycle, but not this gate-to-pool interleaving.
- **Recommendation:** B, after an event-order reproduction confirms the
  effect. It preserves foreground priority without a second resource count.
- **Action:** fix after merge, apply B, because the paths are unchanged on
  main and one separate fix can reach every open branch.
