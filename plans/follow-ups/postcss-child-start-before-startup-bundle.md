# Warm start waits for the PostCSS child

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-21, from the branch
  `calummoore/mokly-restored-bundle-reuse-answer-pspj`. The performance
  orchestrator chose this item on 2026-11-21, after its warm Basic check of
  the branch together with the startup PostCSS preparation.
- **Location:** `crates/mokly-render/src/bundle.rs:102` to line 116,
  `packages/mokly/src/sidecar/session.ts:81`, and
  `packages/mokly/src/sidecar/postcss.ts:46` and line 111 to line 160.
- **Reason:** The change that found this item makes the head bundle faster
  but keeps the existing preparation point. A change to when the PostCSS
  child starts is separate work with its own measurement.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Serve:** `mokly serve`, the development server. `serve.ready` is the
    timing span that ends when Serve can answer requests.
  - **Sidecar:** the Node process that bundles and renders catalogue
    JavaScript for the Rust core.
  - **PostCSS child:** the Node process that a sidecar forks to run the
    project's PostCSS configuration. Each `processCss` request of one
    context runs in that child.
  - **Startup preparation:** the `preparation` member of the first `full`
    bundle request of a Serve start. `describe` in
    `crates/mokly-render/src/bundle.rs` sets it when the capture is `Full`
    and edit plans exist. The sidecar calls `PostcssWorkers.prepare` when
    the bundle request arrives, before its reuse check, and does not wait.
  - **Restored reuse:** a bundle request that the sidecar answers from a
    compilation that the core installed with `restoreGeneration`. Its reply
    is the short `{ generation, restoredGeneration }`.
- **Background:**
  - A warm Serve start restores the stored head compilation into a sidecar
    and sends the startup bundle request with the startup preparation.
  - The sidecar forks the PostCSS child 1 to 2 ms after it receives that
    request.
  - The core sends the first `processCss` request when the bundle reply
    arrives. That request waits until the child is ready.
  - Measured on 2026-11-21 on the example catalogue `examples/basic`, with
    2 sidecars, warm restarts, a 4-CPU machine, and 6 rounds per arm:
    - The child needs about 310 to 330 ms from fork to ready.
    - The head bundle takes about 105 ms of sidecar time with the short
      reply, and 150 to 165 ms with the full reply.
    - With the short reply, the first `processCss` starts 60 to 90 ms
      earlier but ends at the same time. Its pair differences against
      `main` at `d596e4aa3` were −42, −76, −91, −13, −13, and +12 ms.
    - Mean `serve.ready` was 1,241 ms on `main` and 1,214 ms with the short
      reply.
  - So on a warm start of a PostCSS project, the child start is the
    critical path, and a faster head bundle does not shorten `serve.ready`.
- **Problem:** The PostCSS child starts only when the startup bundle request
  reaches the sidecar. That point is too late to hide the child start
  behind the head bundle.
- **Impact if no action:** Warm starts of PostCSS projects keep about 150 to
  220 ms of child start on the path to `serve.ready`. Gains in the head
  bundle do not reach `serve.ready` on these projects.
- **Root question:** How can a warm Serve start have the PostCSS child ready
  when the first stylesheet needs it, with the same output, evidence, and
  context ownership?
- **Options:**
  - **A.** Send the startup preparation with the `restoreGeneration` request
    that seeds the head compilation, so that the child forks before the
    bundle request. This gains only the time between the restore and the
    bundle request. Effort: Small.
  - **B.** Start the startup preparation when the first sidecar of the head
    root answers `hello`, as soon as the core knows the PostCSS module and
    the context. Keep the existing ownership, disposal, and affinity rules
    of the context. Effort: Medium.
  - **C.** Keep one prepared PostCSS child warm in the pool for the head
    root before any request, and hand it to the first context. This needs
    new pool ownership and memory accounting. Effort: Large.
- **Left out:** Delay the first `processCss` request: that makes no part of
  the start faster.
- **Wider fix:** B. It moves the child start to the earliest point at which
  the core knows its inputs, for every warm start.
- **Previous examples:** The startup preparation itself moved the child
  start from the first `processCss` request to the startup bundle request.
- **Recommendation:** B. A gains too little, and C adds a new pool owner.
- **Action:** fix after merge, apply B.
