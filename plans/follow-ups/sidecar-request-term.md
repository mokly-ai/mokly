# Define a sidecar request once in the protocol pages

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch `calummoore/mokly-return-warmup`,
  round-2 review finding 3, the wider fix that the agent split off.
- **Location:** `docs/protocol/mokly-sidecar-root-scheduling.md:17` (the warm
  head rule), `docs/protocol/mokly-sidecar-return-warmup.md:11` (the recorded
  renders), `docs/protocol/mokly-sidecar.md:39` (the request frame), and
  `crates/mokly-sidecar/README.md:98`.
- **Reason:** The direct fix put a warm-up exception next to each rule, and a
  defined term rewords the request across the sidecar protocol pages, outside
  that branch's diff.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Warm head process:** the head sidecar process that bundled the newest
    head generation or rendered it last. A base request takes it only when no
    other process is available.
  - **Warm-up replay:** a render call that the pool sends again to a process
    that the return pass started, to warm it. The pool discards the result.
  - **Request:** today the protocol pages use the word for every frame that
    the core sends to a sidecar, also for the calls that the pool sends on its
    own.
- **Background:** The return warm-up sends preparation calls and render
  replays that no caller asked for. Rules that count requests had to name the
  warm-up as an exception: the warm head rule of
  `docs/protocol/mokly-sidecar-root-scheduling.md` says that a warm-up replay
  does not move the warm head process, and the warm-up page says that a
  replay is not recorded. The crate README and
  `plans/follow-ups/sidecar-loaded-state-selection.md` repeat the exception.
  `docs/protocol/mokly-sidecar.md` calls each frame with `id` and `method` a
  request, so a rule that says "render request" covers a replay too, unless
  it names the exception.
- **Problem:** Each rule that counts the work of callers must name every
  background mechanism as an exception. A later mechanism that sends renders,
  such as a head preload, needs the same exception in each rule again.
- **Impact if no action:** A new background mechanism can leave a rule
  without its exception, and two pages then conflict, as they did before the
  direct fix.
- **Root question:** How do the sidecar protocol pages tell the work that a
  caller asked for from the calls that the pool sends on its own, once?
- **Options:**
  - **A.** Keep the exceptions next to each rule. Effort: Small.
  - **B.** Define the term once: a request is a call that a caller sends to
    the pool, and a call that the pool sends on its own, such as a preparation
    or warm-up call, is a pool call. Use "frame" for the wire unit on the
    sidecar page. Then write each rule with "request" and drop the
    exceptions that only repeat the definition. Check each use of "request"
    on the twelve sidecar pages. Effort: Medium.
- **Left out:** A rule set without the render clause of the warm head rule,
  because the clause gives the protection to the next process that renders
  when the bundling process ends. Fewer than three approaches are real,
  because the pages either name each exception or define the term.
- **Wider fix:** B. A defined term covers every later background mechanism.
- **Previous examples:** The round-1 review of the unmerged branch
  `calummoore/mokly-generation-prefetch` found that a "never" rule of the root
  scheduling page lacked the head preload exception. The round-2 review of
  `calummoore/mokly-return-warmup` found the same for the warm head rule.
- **Recommendation:** B. It removes the cause and keeps the rules short.
- **Action:** fix after merge, apply B, because it rewords twelve protocol
  pages, and the direct fix already removed the conflict.
