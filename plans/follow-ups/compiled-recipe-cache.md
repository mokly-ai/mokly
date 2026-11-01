# Cache unused compiled recipes

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  the deferred option C of F8 decision 59, 2026-10-20.
- **Location:** `crates/mokly-sidecar/src/pool_requests.rs:81-94` and
  `:128-130`, `crates/mokly-sidecar/src/compiled.rs:11-41`, and
  `docs/protocol/mokly-sidecar-modules.md:128-150`.
- **Reason:** The cache needs a byte budget, and the plan requires the user
  to agree that budget before the work starts.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Compiled recipe:** the private result of one esbuild compilation in
    the sidecar: code, captured sources, peers, and input digests.
  - **Generation:** one evaluated lifetime of a compiled bundle. The Rust
    core releases it when no graph or request uses it.
- **Background:**
  - `docs/protocol/mokly-sidecar-modules.md:128-150` defines recipes. A
    recipe is reused only while its inputs stay unchanged.
  - The pool keeps a recipe only while its generation is live. It shares
    one copy between live generations with equal inputs, at
    `pool_requests.rs:81-94`. It drops the recipe when the generation is
    released, at lines 128-130. This is the current behaviour.
  - On 2026-10-19 the user decided to defer compilation and startup
    performance work until after the merge.
  - On 2026-10-20 the plan asked how long compiled recipes should live. It
    had three options. The first kept the current lifetime. The second added
    default Go runtime memory settings for esbuild. The third added a
    revalidated, byte-bounded cache of unused recipes. The user did not
    answer, so the plan kept the current lifetime under the user's standing
    rule for unanswered items. It did not add the Go settings, and it
    deferred the cache to this follow-up with a byte budget still to agree.
  - Mokly Cloud observations from that date: one long Serve session compiled
    the same base six times. Probes with default settings crossed an
    external 4 GB guard during a later base compilation, and esbuild reached
    2.91 GB in the merged sample. The plan records these as observations,
    not as a product memory bound.
- **Problem:** When a generation ends, a later request for the same code
  compiles it again, even when no input changed. Reuse needs input
  revalidation and a byte budget that the user has not chosen.
- **Impact if no action:** Long Serve sessions repeat compilations and their
  time. Memory stays bounded by the live generations.
- **Root question:** How does Mokly avoid repeated compilation of unchanged
  JavaScript while it keeps memory bounded?
- **Options:**
  - **A.** Keep the current lifetime, and cache no unused recipe. Effort:
    Small.
  - **B.** Measure recipe sizes. Add one fixed byte budget for unused
    recipes, and check the compiler and resolution inputs again before each
    reuse. Effort: Medium.
  - **C.** Add a cache budget that the user can configure, with the same
    input checks. This adds a public configuration field and its contract.
    Effort: Large.
- **Left out:**
  - A cache without a byte budget. It removes the memory bound.
  - Default Go runtime memory settings for esbuild. They limit esbuild
    memory, but they do not avoid a compilation.
- **Wider fix:** B. One revalidated cache serves every later generation with
  the same compilation inputs.
- **Previous examples:** The render cache already evicts documents under a
  byte bound, under `docs/protocol/mokly-runtime.md` section Render Graph
  And Cache.
- **Related:**
  - [large-react-startup.md](large-react-startup.md) asks for a compilation
    cache redesign to bring large React startup under 5,000 ms. A redesign
    there can include this cache, so decide the two together.
  - [flaky-large-watch-react.md](flaky-large-watch-react.md) tracks the
    large React watch test. Its timeouts come from accumulated React and
    base compilations, which this cache can reduce.
- **Recommendation:** B. A measured fixed limit adds reuse
  without a new public setting.
- **Action:** ask the user, because the byte budget trades memory for reuse, and
  the plan requires the user to agree it.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5417).
