# Cache unused compiled recipes

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  the deferred option C of F8 decision 59, 2026-10-20.
- **Location:** `crates/mokly-sidecar/src/pool_requests.rs:81-94` and
  `:128-130`, `crates/mokly-sidecar/src/compiled.rs:11-41`, and
  `docs/protocol/mokly-sidecar-modules.md:128-150`.
- **Reason:** A design call of 2026-11-01 chose option D. Only its
  implementation waits.

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
  - Measured on 2026-10-28: recipes are 3.1 to 3.3 MiB for `examples/basic`
    and 2.2 MiB for the large React fixture. In a five-minute watched
    session of `examples/basic` with two edits and two reverts, 6 of 10
    bundles had inputs equal to an earlier compile: the 2 head bundles
    after the reverts and 4 bundles of the unchanged base. Each bundle took
    2.2 to 5.5 s.
  - `seed_compilation` in `crates/mokly-sidecar/src/pool_preparation.rs`
    restores only one candidate with equal bundle settings. So a store of
    several recipes with equal settings cannot restore the older ones.
  - Design call of 2026-11-01: option D. No user message and no protocol
    requirement reserves this budget. The deferral of 2026-10-20 says that
    the current lifetime stays until this cache lands. D keeps every
    measured reusable repeat with about 6.4 MiB, and its 64 MiB ceiling is
    the existing sidecar frame limit.
  - The design call also weighed
    [bundle-disk-cache.md](./bundle-disk-cache.md), added on 2026-11-01,
    which asks to decide this item together with it. D does not depend on
    its open decisions. D keeps released recipes in memory only and
    restores them through the existing seed and input check. That cache
    keys each disk entry by the bundle settings, so it keeps only the latest
    compile of each settings and cannot restore the recipe that an edit and
    a revert need.
- **Problem:** When a generation ends, a later request for the same code
  compiles it again, even when no input changed. Reuse needs input
  revalidation and a byte budget.
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
  - **D.** Keep the latest released recipe of each bundle settings, in
    practice one head and one base recipe. Charge each by its serialized
    size. Before a `bundle` call, the seed restores that recipe and the
    live candidate, and the sidecar's input check stays the only reuse
    gate. Above 64 MiB per process, the existing sidecar frame limit,
    evict the least recently used recipe. Clear the store on dispose and
    shutdown. Effort: Medium.
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
  - [bundle-disk-cache.md](./bundle-disk-cache.md) keeps compiled bundles
    on disk across restarts. Its decision 1 A restores a stored recipe
    through `restoreGeneration` and the sidecar's input check, as D does.
    The two items can land in either order.
  - The
    [large React startup item at its last commit](https://github.com/mokly-ai/mokly/blob/a5cd66c7c16ea76f2da7391e712f9fe8ac9811d1/plans/follow-ups/large-react-startup.md)
    asked for a compilation cache redesign to bring large React startup
    under 5,000 ms. It closed on 2026-11-01, when large React startup
    measured about 3.7 s, cold and warm, so no startup work waits for this
    cache.
  - [flaky-large-watch-react.md](flaky-large-watch-react.md) tracks the
    large React watch test. Its timeouts come from accumulated React and
    base compilations, which this cache can reduce.
- **Recommendation:** D. It keeps every measured repeat at the smallest
  memory, under an existing limit. The first recommendation was B
  (estimate).
- **Action:** fix after merge, apply D, because the design call of
  2026-11-01 settles the budget and only the implementation remains.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5417).
