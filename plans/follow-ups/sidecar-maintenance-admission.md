# Count maintenance in Serve sidecar admission

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the memory-guard options check on branch
  `calummoore/mokly-sidecar-memory-guard-cf9n`. Updated on 2026-11-19 with two
  cases that the options check of an unmerged head preload attempt found, and
  with the return warm-up as a third owner.
- **Location:** `crates/mokly-sidecar/src/pool_return.rs:54`,
  `crates/mokly-sidecar/src/pool_releases.rs:109`,
  `crates/mokly-sidecar/src/pool_warmup.rs` (`Pool::claim_warmup`), and
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
  - On 2026-11-19 the options check of an unmerged head preload attempt, on
    the branch `calummoore/mokly-generation-prefetch`, found two more cases of
    this class on `main`. Nobody reproduced either case.
  - `claim_return` in `crates/mokly-sidecar/src/pool_return.rs` gives up only
    when a base request already waits in the pool's `waiting` queue. It cannot
    see a base call that the gate admitted but that has not reached that
    queue. So a return pass can start, and it can end the base process that
    such a call needs, while the call is on its way.
  - `clean_idle` in `crates/mokly-sidecar/src/pool_releases.rs` takes every
    idle slot with stale generation or PostCSS state out of `available` at
    once. A head request that arrives in that time finds no idle slot, so it
    can start or replace a process instead of using an idle one.
  - The return warm-up adds a third owner. `Pool::claim_warmup` in
    `crates/mokly-sidecar/src/pool_warmup.rs` takes an idle head process that
    the return pass started out of `available`. The warm-up then sends one
    call at a time, only while no request waits and the pool holds no claim.
    A call that the gate admits during a warm-up call can wait in the pool
    queue for that call. When no other idle process of its root exists, it
    can also start or replace a process. A hung warm-up call holds the
    process until its deadline: 30 s, or 120 s for `describe`.
- **Problem:** A call that passes the gate can still wait in the pool queue
  for maintenance. `claim_return` removes a slot from `available` and marks
  head return active. `clean_idle` also removes slots while it releases old
  generation or PostCSS state. A warm-up removes a slot for each call that it
  sends. None of these operations appears in the gate's active call count.
  Code tracing found this gap; no event-order reproduction has yet established
  its user-visible impact.
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
  - **D.** One rule for each owner that holds an idle process without a
    request: the return pass, the idle cleanup, and the warm-up. Each owner
    counts an admitted call that has not reached the pool queue as waiting.
    It gives the process back between its steps. The first request that would
    take that process waits for it instead of starting or replacing a process.
    Effort: Medium.
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
