# Choose sidecar processes by their loaded state

- **Severity:** Medium. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from the options check of decision 1 in the
  first-edit warm sidecars plan, branch
  `calummoore/mokly-first-edit-warm-sidecars-8npz`.
- **Location:** `crates/mokly-sidecar/src/pool_affinity.rs:72`, line 75,
  line 76, and line 86, the B rank at line 18 and line 35,
  `crates/mokly-sidecar/src/pool.rs:171`, and
  `docs/protocol/mokly-sidecar-root-scheduling.md`, sections Roots And The
  Warm Head Process and Generation Affinity.
- **Reason:** C and D change the replacement rule and need their own
  measurement, so the generation affinity change applied only option B.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Source root:** the directory that one sidecar process serves for its
    whole life: the working repository for the head, or the extracted base
    commit for the base.
  - **Root switch:** the pool ends an idle sidecar process and starts a new
    process in another source root.
  - **Generation:** one bundled version of the catalogue's JavaScript. A
    process evaluates it once and then renders from it.
  - **Warm head process:** the process that bundled the newest head
    generation, or the process that last rendered it after a successful
    render.
  - **Kept base:** the captured base side that Serve keeps between Changes
    classifications.
- **Background:**
  - Each sidecar process serves one source root. A request for another root
    replaces an idle process. The new process loads and evaluates its
    generations again.
  - A request without a PostCSS context affinity takes an idle process in its
    own root first, at `pool_affinity.rs:75`. While a return pass has
    candidates, a base request prefers such a process that already left the
    pass, at line 72. Then it takes an empty slot, at line 76. Then it takes the oldest
    idle process other than the warm head process, at line 86. The warm head
    process comes last. A slot goes to the back of the idle queue when its
    request ends, at `pool.rs:171`.
  - Option B, below, now ranks the idle processes of one root by the
    generation state that a call needs, at `pool_affinity.rs:18` and line 35.
    When no idle process holds the generation, a head request still takes the
    first idle head process in queue order. It does not prefer a process that
    already loaded the runtime packages, such as React.
  - The user authorised the performance orchestrator to decide the first-edit
    design on 2026-11-16. On 2026-11-18 the orchestrator chose a narrow rule.
    A base request takes the warm head process only when no other idle
    process and no empty slot is available.
    `docs/protocol/mokly-sidecar-root-scheduling.md` holds this rule.
  - The same change starts a return pass after each Changes publication in
    Serve. The pass replaces idle base processes with new head processes. The
    new processes load no generation in advance. So at the next edit, a call
    that reaches a new process loads the runtime packages and evaluates the
    generation from a cold start.
  - Since 2026-11-19, the head preload restores each new head generation and
    its class maps on the other idle head processes, one at a time, after its
    `describe` and before its renders. It evaluates nothing, so the first call
    on such a process still describes the generation. A call still reaches a
    process without the generation when the preload has not reached that
    process yet.
    `docs/protocol/mokly-sidecar-head-preload.md` holds these rules.
  - Serve keeps a base capture of at most 256 MiB, at
    `crates/mokly-compare/src/capture_weight.rs:12`. A view outside it renders
    again through the kept base and needs a base process. After the return
    pass, that render can replace a head process that the next edit needs.
  - The options check of 2026-11-18 named this wider policy as the wider fix
    of the class "a process choice destroys loaded state that a later request
    needs". It graded the policy Large, because it needs its own tests and
    measurement.
  - On 2026-11-18 the performance orchestrator chose option B, under the
    user's delegation of 2026-11-16 to decide Changes speed and reliability
    work. The user also requires bounded memory. Branch
    `calummoore/mokly-sidecar-generation-affinity-jmbb` applies B.
  - The reason for B: Serve validates edited catalogue code before it
    prepares render inputs. The process that bundled the new generation then
    goes to the back of the idle queue. So queue order sends the next calls to
    processes that must restore and describe code that this process already
    holds. A second-edit trace that the orchestrator supplied showed a 254 ms
    gap before render inputs. B removes that redundant work without a change
    to replacement or startup.
  - The section Generation Affinity of
    `docs/protocol/mokly-sidecar-root-scheduling.md` holds the B rule. A call
    that names a generation ranks the idle processes of its root. First comes
    a process that holds the current lifetime of the generation and each input
    that the call needs: class maps, description, and the latest bindings
    table. Next comes another process that holds that lifetime. Queue order
    breaks ties. The pass preference comes before the rank. A call never
    waits for a busy process that holds its generation. Calls without a
    generation keep queue order. The rank starts no process and keeps no state
    of its own.
  - The orchestrator kept C and D open. B answers the root question below
    only inside one root. The choice of the process that changes root still
    uses queue order and the warm head process rule. C addresses that
    eviction rather than the immediate restore. D combines B and C after
    measurements establish the replacement policy. C and D can extend the B
    rank to the state that a root switch destroys.
- **Problem:** Under option B, the pool weighs the generation state that a
  call uses, but only among the idle processes of its root. It still chooses
  the process that changes root by queue order and the warm head process
  rule. It does not weigh the loaded state that a root switch destroys.
- **Impact if no action:** After an edit, a head call still reaches a process
  without loaded head state when every process that holds the generation is
  busy. A later base render can still replace a head process that the next
  edit needs.
- **Root question:** How does the pool choose the process for each request, so
  that it keeps the loaded state that later requests need?
- **Options:**
  - **A.** Change nothing. Keep the warm head process rule and the return
    pass. Effort: Small. With B applied, A also keeps the B rank as it is.
  - **B.** Generation affinity. A request prefers an idle process in its root
    that already holds its generation. This changes the choice among
    processes of one root only. Effort: Medium. Applied: the performance
    orchestrator chose B on 2026-11-18, and branch
    `calummoore/mokly-sidecar-generation-affinity-jmbb` applies it.
  - **C.** Loaded-state replacement. A request for another root replaces the
    idle process with the least useful loaded state, for both roots. This can
    keep a base process for views outside the kept capture. Effort: Medium.
  - **D.** One ranking of the idle candidates by the loaded state that the
    request uses or destroys, for every root and request. This combines B and
    C. It needs its own tests and a measurement of startup Changes, the first
    two edits, and peak memory. Effort: Large.
- **Left out:** Processes beyond the pool size, because they break the
  configured pool bound. One process for both roots, because a process serves
  one source root. A replay of the newest head generation into new processes,
  because it answers another question: how a new process gets warm.
  `docs/protocol/mokly-sidecar-root-scheduling.md` rejects that replay,
  because it adds CPU work and keeps more evaluated code in memory.
- **Wider fix:** D. One ranking prevents the class for every root and request.
  B and C each cover one part of it.
- **Previous examples:** PostCSS context affinity in
  `crates/mokly-sidecar/src/pool_affinity.rs` keeps the requests of one
  context on the process that holds it. The warm head process rule of
  2026-11-18 is a narrow case of this class. So is the pass preference of the
  same date, which keeps sequential base calls on one process. So is option
  B, the generation rank inside one root, chosen later on the same date.
- **Related:**
  - [sidecar-idle-child-retention.md](./sidecar-idle-child-retention.md) measures the memory and restoration cost of rich idle children. Design the policies together.
  - [serve-sidecar-prestart.md](./serve-sidecar-prestart.md) also changes the
    order in which the pool gives slots to requests. Design the two changes
    together.
  - [root-switch-reap-wait.md](./root-switch-reap-wait.md) changes the root
    switch of a request. A branch that does one should check the other.
- **Recommendation:** D. One ranking keeps the useful state of both roots,
  where the warm head process rule helps only the first head call after an
  edit. B now covers the choice inside one root only.
- **Action:** ask the user, because C and D change the replacement rule in
  `docs/protocol/mokly-sidecar-root-scheduling.md`, and the recorded call of
  2026-11-18 covers only B.
