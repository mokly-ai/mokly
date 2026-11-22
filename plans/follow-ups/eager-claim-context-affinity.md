# Eager sidecar claims keep their own context match

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, round 2 of its
  implementation review. That branch made `Pool::source_root`,
  `Call::postcss_context`, and the `generation` helper list every sidecar
  method, and tested the public path of `prepareContext`.
- **Location:** `crates/mokly-sidecar/src/pool_eager.rs` (`eager_claim` and
  `take_eager`), and `crates/mokly-sidecar/src/pool_sources.rs`
  (`Pool::source_root`, the `restoreGeneration` arm).
- **Reason:** The eager claim is outside the branch that found it, and no
  prepared PostCSS context takes the eager path today.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Eager claim:** the slot reservation in `pool_eager.rs` that Serve takes
    for a base-side call. `take_eager` then gives the reserved slot to the call.
  - **Context affinity:** the pool record in `state.affinity`. It sends every
    request of one PostCSS context to the slot that holds its child process.
  - **Public path:** `SidecarPool::request`, which chooses the slot of a call by
    its source root and its context affinity.
- **Background:**
  - The protocol requires that all requests of one live PostCSS context reach
    the same process, and that a process serves one source root
    (`docs/protocol/mokly-sidecar-modules.md`, "Source root workers").
  - `Call::postcss_context` gives the context of a `processCss` call, a
    `prepareContext` call, and a prepared `bundle` call. `Pool::source_root`
    gives the source root of each call. Since 2026-11-22 both list every method
    with no wildcard arm, and a test sends a public `prepareContext`.
  - `eager_claim` and `take_eager` keep their own match, which knows only
    `processCss`. A public `prepareContext` that takes an eager claim gets no
    affinity there.
  - No test sends a public `restoreGeneration` request, so the
    `restoreGeneration` arm of `Pool::source_root` has had no test since #199
    (commit `d935e6a66`).
- **Problem:** One routing point still decides the context by its own match,
  and one routing arm has no test.
- **Impact if no action:** A later caller that sends a prepared context on the
  eager path, or a refactor of the `restoreGeneration` arm, can send a request
  to a process of another source root or leave a child without affinity. Its
  later requests and its release then miss the child.
- **Root question:** How does each request of a PostCSS context keep reaching the
  process and source root of that context, whoever sends it and after later
  changes?
- **Options:**
  - **A.** Add a public-path test case for `restoreGeneration` only. Effort:
    Small.
  - **B.** Do A, and make `eager_claim` and `take_eager` read the context from
    `Call::postcss_context`. Pass the source root into `take_eager`, because
    `Pool::source_root` locks the pool state that `take_eager` already holds.
    Every routing point then reads one helper. Effort: Small.
- **Left out:** A consumer call type for `SidecarPool` that cannot hold the
  methods that only the pool sends: it changes the request API of three crates
  and about 40 files, and it removes public sends that the API accepts today, so
  it needs the user for a Low problem.
- **Wider fix:** B. Every routing point then reads one helper, and each method
  states its context and source root in one place.
- **Previous examples:** The wildcard arms of `Pool::source_root`,
  `Call::postcss_context`, and `generation`, removed on 2026-11-22.
- **Recommendation:** B.
- **Action:** fix after merge, apply B, because `pool_eager.rs` is outside the
  branch that found it, and no prepared context takes that path today.
