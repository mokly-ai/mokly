# Count maintenance in Serve sidecar admission

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the memory-guard options check on branch
  `calummoore/mokly-sidecar-memory-guard-cf9n`.
- **Location:** `crates/mokly-sidecar/src/pool_return.rs:54`,
  `crates/mokly-sidecar/src/pool_releases.rs:109`,
  `crates/mokly-sidecar/src/pool_preload.rs` (`claim_preload`), and
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
  its comparison base. The gate counts calls that it admitted. Head return,
  the head preload, and idle release cleanup can take an available pool slot
  without entering that gate. The root-scheduling protocol owns head return,
  the head preload protocol owns the preload, and the on-demand protocol owns
  foreground priority.
  - Since 2026-11-19, the head preload takes one idle head slot after the
    `describe` of a new head generation. It sends one preparation call at a
    time, and it gives the slot back before its next call when a request waits
    in the pool queue. A head request that finds no idle head slot waits in
    the pool queue for that slot. The gate does not count the preload.
  - The preload also treats a call that the gate admitted, and that has not
    reached the pool queue, as a waiting request. The pool records the call
    claims whose call reached the queue. The return pass and the idle cleanup
    do not use that record.
  - The options check of the preload design, on 2026-11-19, found two more
    cases of this class. The return pass claim cannot see a base request that
    the gate admitted but that has not entered the pool queue. The admission
    also wakes the maintenance worker, so the pass can end the base process
    that this request needs. The idle cleanup in `clean_idle` takes every idle
    slot with stale state out of the queue at once, so a head request in that
    time can start or replace a process.
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
  - **D.** One rule for every owner that holds an idle process without a
    request: the return pass, the head preload, and the idle cleanup. Each
    one counts an admitted call that has not arrived as waiting, gives the
    process back between its calls, and makes the first request that would
    take that process wait for it instead of starting or replacing a process.
    The head preload already follows this rule. Effort: Medium.
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
