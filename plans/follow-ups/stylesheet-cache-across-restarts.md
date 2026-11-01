# Keep stylesheet bundles across restarts

- **Severity:** Medium. **Effort:** Large (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the open decision of 2026-10-30 in the
  "mokly perf orchistrator" workspace, and decision 2 of the unmerged
  bundle disk cache plan at commit `0677f609`.
- **Location:** `crates/mokly-render/src/stylesheet_store.rs:51`,
  `crates/mokly-render/src/stylesheet_cache.rs`, and
  `crates/mokly-render/src/stylesheet_record.rs`.
- **Reason:** The user has not chosen when this work starts, and its design
  depends on the cache kind of
  [bundle-disk-cache.md](./bundle-disk-cache.md).

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Stylesheet cache:** the in-memory store of stylesheet bundle records,
    one record for each stylesheet root, under a 64 MiB bound.
  - **CSS Modules class maps:** the class-name maps that the core bundles
    for JavaScript entries during `catalogue.validate`, before Serve is
    ready.
  - **OS cache directory:** the per-repository directory outside the
    repository that holds the base extraction and dependency caches.
  - **Orchestrator:** the agent that coordinated the performance work of
    2026-10-27 to 2026-10-31 and brought its decisions to the user.
- **Background:**
  - On 2026-10-30, `main` at `f93afcea` on a slow machine: warm
    `serve.ready` was 6.6 s. The class maps took 1.5 s. In `graph.prepare`,
    35 stylesheet bundles took 0.88 s of 1.14 s, all without a cache record.
  - Both steps use the stylesheet cache. PR #242 lets it serve later
    attempts inside one process. The cache lives in memory, so every
    restart bundles each stylesheet again.
  - The bundle disk cache plan estimates warm `serve.ready` at about 2.6 s
    on the baseline machine with the compiled bundle kept on disk. Keeping
    the stylesheet cache on disk too gives about 1.2 s (estimate). The user's
    startup target is about 1 s.
  - A stored record needs its own format version, a byte bound, eviction,
    and a check of its inputs: PostCSS read evidence, asset and glob
    stamps, and the PostCSS configuration files.
  - On 2026-10-30 the orchestrator asked the user when to start this work.
    The user did not answer before the workspaces closed.
- **Problem:** Each restart bundles every stylesheet root again, also when
  no input changed.
- **Impact if no action:** After the bundle disk cache, warm startup stays
  near 2.6 s on the baseline machine, against a target of about 1 s.
- **Root question:** How does a restart skip stylesheet work whose inputs
  did not change?
- **Options:**
  - **A.** Do not start this work. Effort: Small.
  - **B.** Start after the bundle disk cache merges, and reuse its new OS
    cache kind code for a second stored kind. Effort: Large (estimate).
  - **C.** Start now, in parallel with the bundle disk cache. Both branches
    then change the same cache code and must resolve the conflicts. Effort:
    Large (estimate).
  - **D.** Fold this work into the bundle disk cache, as its option 2D. One
    pull request then holds two stored formats. Effort: Large.
- **Left out:** Listening before the class maps are ready. It changes the
  readiness order, and `docs/protocol/mokly-timings.md` records the user's
  rejection of usable navigation before every entry is ready.
- **Wider fix:** None. This is a planning choice.
- **Previous examples:** PR #242 made the stylesheet cache serve later
  attempts in one process.
- **Related:**
  - [bundle-disk-cache.md](./bundle-disk-cache.md): its decision 2 moves
    the 1.5 s target here under option 2A, and its option 2D is option D
    here.
  - [postcss-config-inputs-per-record.md](./postcss-config-inputs-per-record.md):
    each record copies the configuration inputs, which a stored format
    would copy too.
  - [postcss-request-order-varies.md](./postcss-request-order-varies.md):
    the cumulative read evidence of a record depends on request order.
- **Recommendation:** B. It is the only planned work that reaches near 1 s,
  and it avoids a conflict with the bundle disk cache.
- **Action:** ask the user, because this choice starts new work and no
  recorded user decision covers it.
