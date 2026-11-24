# Eager sidecar claims skip the slot ranking

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from round 5 of the review of the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, whose finding check listed
  it outside the scope.
- **Location:** `crates/mokly-sidecar/src/pool_eager.rs:31` (`eager_claim`,
  the choice of the eligible slot), and the ranking in
  `crates/mokly-sidecar/src/pool_affinity.rs` (`matching` and `acquire`).
- **Reason:** `pool_eager.rs` has not changed since #461 (commit
  `87e8984cf`), so the slot order of eager claims is outside the diff that
  found it.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Eager claim:** the slot reservation that Serve takes for a base-side
    call while it still prepares or renders the head. Serve takes eager
    claims only when the pool has three or more sidecars.
  - **Generation rank:** the order in which the ordinary path ranks the idle
    processes of one source root: a process that holds the generation and
    its prerequisites first, then one that holds the generation, then the
    others.
  - **Pass preference:** while the background return pass has candidates, a
    base request prefers an idle process of its root outside the pass.
- **Background:**
  - The ordinary admission path, `pool_affinity::acquire`, takes the process
    of the call's PostCSS context first. Then it applies the pass preference
    and the generation rank to the idle processes of the call's root. Then it
    takes an empty slot, then growth.
  - `docs/protocol/mokly-sidecar-root-scheduling.md`, "Later Base Work" and
    "Generation Affinity", applies these rules to base requests too: a base
    request prefers an idle process of its root outside the pass, the rank
    orders the idle processes of the root for each request that names a
    generation, and an idle process of the root comes before an empty slot.
  - `Pool::eager_claim` takes the process of the call's context when one is
    bound. Otherwise it takes the first slot of the idle queue that is empty
    or serves the base root. The idle queue puts the process that has been
    idle longest first, and an empty slot can come before an idle process of
    the root.
- **Problem:** An eager `cssModules`, `describe`, `bindings`, or render call
  skips the pass preference, the generation rank, and the rule that an idle
  process of the root comes before an empty slot.
- **Impact if no action:** With two idle base processes of one root, or an
  empty slot before the base process, the eager base graph calls can
  alternate between processes, start a second base process, and replay the
  generation and the class maps in each. That costs time and memory in Serve
  with three or more sidecars. Nobody measured how often it happens.
- **Root question:** How does an eager base call choose the same process
  that the ordinary rules would choose, within the eager admission rules?
- **Options:**
  - **A.** Let `eager_claim` rank its eligible slots with the ordinary rank of
    `pool_affinity.rs`: the process of the context, then the idle processes
    of the root by pass preference and generation rank, then an empty slot.
    Keep the eager rules: no head process, no root switch, one eager call at
    a time, and the reservation at claim time. Add a test with two idle base
    processes that hold different generations. Effort: Medium.
  - **B.** Change nothing in the code, and measure first: count in a Serve
    session with four sidecars how often an eager base call takes a process
    without its generation. Fix only when the count is not small. Effort:
    Medium.
- **Left out:** Ordinary claims for eager calls: they break the eager
  admission rules, which give an eager call no head process and no wait
  behind head work (`docs/protocol/mokly-eager-base-preparation.md`).
  Preferring the process of the previous eager call: the scheduling page
  rejects recency as a stand-in for the loaded state.
- **Wider fix:** A. One ranking then serves both admission paths.
- **Previous examples:** Before 2026-11-22, the eager path bound only a
  `processCss` context, while the ordinary path bound every context. Round 5
  of the same branch moved both paths to one binding helper.
- **Related:** `plans/follow-ups/sidecar-loaded-state-selection.md` asks how
  the ordinary path chooses processes by their loaded state. Its answer
  applies to this ranking too.
- **Recommendation:** A. It makes the eager path follow the scheduling rules
  that the protocol already states.
- **Action:** fix after merge, apply A, because the eager claim's slot order
  is outside the diff that found it.
