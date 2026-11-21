# A store-served startup leaves head slots without a process

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the render-store branch and PR #394, design call 6.
- **Location:** `crates/mokly-sidecar/src/pool_return.rs`,
  `crates/mokly-sidecar/src/pool_head.rs`,
  `crates/mokly-sidecar/src/pool_return_spawn.rs`,
  `crates/mokly-sidecar/src/pool_start.rs`, and
  `crates/mokly-sidecar/src/pool_warmup_state.rs`.
- **Reason:** The admitted fill needs a separate start path, reservation rollback,
  harness extensions, and lifecycle tests. Its checked effort exceeds the accepted
  under-one-hour limit for the render-store change.

- **Source:** Design.
- **Category:** Performance.
- **Related:**
  - `plans/follow-ups/render-store-idle-work-owners.md` covers other
    writer-activity owners. This fill uses the maintenance worker's existing lease.
  - `plans/follow-ups/render-store-index-lock-contention.md` covers stored
    documents that readers render again after index contention. Fewer such
    misses can leave more head slots without a process before the first edit.
- **Terms:**
  - **Sidecar:** A Node process that runs JavaScript renders for Mokly Serve.
  - **Head slot:** A place in the sidecar pool for a process that serves the
    current working tree.
  - **Return pass:** The existing idle worker that returns base processes to the
    head root, then warms head processes.
  - **Reservation:** The memory-admitted ownership of a process index in the pool.
  - **Warm-up:** Preparation and at most 30 quiet render replays on one head
    process through the existing return pass.
- **Background:**
  - Serve starts sidecars on demand. A restart can restore complete head
    documents from the render store without a sidecar render.
  - A usable stored head document records its top-level JavaScript request for
    the newest head generation. This records no call and starts no process.
    HTML-body calls and memory hits add no such request.
  - After completed Changes, the return pass returns base processes and warms
    existing cold head processes. It does not start processes in unused slots.
  - The accepted early candidate had enough processes because concurrent store
    misses happened to start them. A warmer store removes that incidental work.
- **Problem:** The first edit starts the missing processes, then pays their
  hello, description, and cold render costs during the edit.
- **Impact if no action:**
  - Three unchanged warm restart rounds measured first Changes at 11.43 seconds
    on main and 6.23 seconds with the store.
  - First-edit times were 2.72, 2.62, and 2.91 seconds on main.
    Store times were 3.00, 2.94, and 3.35 seconds, about 0.35 seconds slower on average.
  - One or two processes started during that edit, with description costs of
    195 to 265 milliseconds. Existing return replacements already ran 30 replays
    in about 420 to 440 milliseconds.
  - The warm restart still gains more than five seconds. The measured unchanged
    session peak was 2,692 MiB on main and 2,356 MiB with the store.
- **Root question:** How can a stored warm restart start and warm the head
  processes of a rendered startup before the first edit, within existing bounds?
- **Options:**
  - **A.** Fill admitted unused head slots through the same return pass after
    the first completed Changes of an eligible stored startup. Enroll new
    processes in the existing warm-up. Effort: Medium.
  - **B.** Keep lazy starts and the measured first-edit cost. Retain the restart
    gain and record the trade-off. Effort: Small.
  - **C.** Apply A, and also cap the fill at the startup generation's count of
    store-served top-level JavaScript requests. This preserves small-catalogue
    demand, but gives less preparation to JavaScript called from HTML bodies.
    Effort: Medium.
- **Left out:**
  - A second warm-up worker or channel breaks the single-mechanism requirement.
  - A start during the store read breaks its record-only boundary.
  - Filling before Changes competes with startup work.
  - A larger pool breaks the existing resource requirement.
  - Filling beyond four processes exceeds the process-count evidence on larger
    hosts. The source cap controls process count, not measured resident memory.
  - Starting at the next edit competes with its bundle and saves only start
    and hello work.
  - Waiting for warm processes changes request growth and can slow later edits.
  - Starting all slots at launch adds processes to cold and HTML-only sessions.
  - Filling every empty slot without a stored-startup condition exceeds the
    accepted scope and memory evidence.
- **Assumptions:**
  - The startup must record a store-served top-level head JavaScript request.
    The Startup Fill contract keeps HTML-only and cold sessions unchanged.
  - Fill follows the first completed Changes result. The performance decision
    keeps optional work off its measured startup path.
  - Store recording sends no call and starts no process. The Recorded Renders
    contract owns this boundary.
  - Keep the existing pool size and memory admission. Each new reservation
    must pass the normal admission rule.
  - Keep one worker, no setting, no timer, and no new channel. These are the
    accepted scope of the fill.
- **Design and lifecycle requirements for A:**
  - Arm only once, at the pool's first return pass, after completed Changes.
    Latch whether the newest head generation saw an eligible stored request.
    The latch must survive changes to the 30-request window.
  - Fence each step with the generation and its epoch. A newer head generation
    ends the fill. Later same-generation publications must not rearm it.
  - Finish all base return steps before fill. Fill before warm-up.
    Start one process at a time, only with no waiting request and no pool claim.
    Otherwise retain the fill and wake when the pool becomes idle.
  - Start only while fewer than four processes run and fewer than the configured
    pool size run. Reserve under the normal admission lock.
    Skip reserved slots without a process. Demand already starts those slots.
  - A denied admission ends optional fill quietly. A failed start also ends it.
    Add no retry. Report a failed return-pass step once under its existing rule.
  - A step that started finishes start and hello. A waiting request then has
    priority. Enroll each new process in the existing warm-up.
  - Extend `Head::notify` to recognize pending fill. Its current wake condition
    recognizes return candidates and pending warm-ups only.
  - Use `StartLease` for a new reservation. Commit when a child exists, also
    when a started child fails. Roll back when no child started.
    Never publish a rolled-back index to the available queue.
  - Keep the `starting` lock during the factory call. Register process control
    before hello so stop and cancellation can kill the child.
  - Preserve existing failed-hello kill and reap handling, slot retirement,
    background-disable behavior, and whole-pool stop rules.
  - Do not reuse `spawn_return` unchanged. It merges started and not-started
    failures, and records a root-switch replacement for every start.
    A first start must retain its normal spawn timing record.
  - Keep every warm-up rule: quiet calls, request priority, continuation when
    idle, generation and root end events, failed reap behavior, 30 replays,
    and the stop before a replay would bring the process to 500 renders.
  - Hold the existing maintenance writer-activity lease for fill steps.
    Keep the first-Changes writer latch. Started writer units may finish.
  - Change no rendered output, comparison count, cache identity, stored record,
    or public setting.
- **Wider fix:** A gives idle slot preparation one owner instead of depending
  on concurrent cache misses. An eager generation install after an edit bundle
  needs the same slot readiness. A separate measurement found about 0.25 seconds
  less per edit with eager installation. Both can share this owner later.
  That measurement does not show the effect of startup fill.
- **Previous examples:** The earlier accepted restart had three render processes
  plus a bundling process before its first edit. Later warmer-store runs had
  only one or two render processes and started the missing ones during edit one.
- **Recommendation:** A for later implementation. The independent source check
  estimates 1.5 to 3 hours, including tests and review.
- **Action:** fix after merge, with A. On 2026-11-20, the performance orchestrator
  accepted B for the render-store PR because A is Medium rather than Small.
  Keep the measured first-edit cost explicit until the fill is verified.
- **Done when:**
  - Deterministic tests prove no startup fill before Changes, no extra process
    for HTML-only or cold startup, and correct enrollment after an eligible hit.
  - Tests cover waiting requests, active claims, generation changes, memory
    denial, failed spawn and hello, rollback, cancellation, and unique indices.
    Extend the warm-up harness for admission and failed starts.
  - Each new asynchronous test has assertion-red proof and ten successful runs.
  - Three interleaved warm unchanged restart rounds use the same control and
    a three-second gap before edit one. Process population and first-edit time
    show the result. Also check an immediate edit without added delay.
  - Memory measurement confirms the accepted envelope. A count cap alone is
    not a resident-memory measurement.
  - The sidecar README describes the implemented boundary. Remove the status
    line from `docs/protocol/mokly-sidecar-return-warmup.md` when its rules hold.
