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
  builds on the bundle kind of the OS cache, which the bundle disk cache
  change adds.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Stylesheet cache:** the in-memory store of stylesheet bundle records,
    one record for each stylesheet root, under a 64 MiB bound.
  - **CSS Modules class maps:** the class-name maps that the core bundles
    for JavaScript entries during `catalogue.validate`, before Serve is
    ready.
  - **OS cache directory:** the per-repository directory outside the
    repository that holds the base extraction, dependency, and bundle
    caches.
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
  - A stored record needs its own format version, a byte bound, and
    eviction. It also needs a check of its inputs: PostCSS read evidence,
    asset and glob stamps, and the PostCSS configuration files.
  - On 2026-10-30 the orchestrator asked the user when to start this work.
    The user did not answer before the workspaces closed.
  - On 2026-11-16 the performance orchestrator answered decision 2 of the
    bundle disk cache plan with option A. The user had delegated that choice,
    to keep Changes fast and reliable with no change that can exhaust memory
    or disk. The answer set the scope of this item:
    - The bundle disk cache keeps compiled JavaScript bundles only. A warm
      restart runs no bundle compile.
    - This item keeps the stylesheet cache across restarts, for the CSS
      Modules class maps and for graph preparation.
    - This item carries the 1.5 s warm `serve.ready` target of the bundle
      disk cache task, with an estimate of about 1.2 s on the baseline
      machine.
  - The bundle disk cache change adds a `bundles` kind to the OS cache. Its
    rules are in the "Bundle Entries" section of
    [`docs/protocol/mokly-base-cache.md`](../../docs/protocol/mokly-base-cache.md#bundle-entries):
    one file for each entry, a first line with the format version, the Mokly
    version, and a payload digest, its own byte bound, and locks that never
    wait.
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
- **Left out:**
  - Listening before the class maps are ready. It changes the readiness
    order, and `docs/protocol/mokly-timings.md` records the user's rejection
    of usable navigation before every entry is ready.
  - Folding this work into the bundle disk cache, its option 2D, which was
    option D of this item. The answer of 2026-11-16 to its decision 2 kept
    that change to compiled JavaScript bundles.
- **Wider fix:** None. This is a planning choice.
- **Previous examples:** PR #242 made the stylesheet cache serve later
  attempts in one process.
- **Related:**
  - [postcss-probes-external-reads-environment.md](./postcss-probes-external-reads-environment.md):
    stored PostCSS records need discovery, external-read, and environment evidence.
  - The [bundle cache](../../docs/protocol/mokly-base-cache.md#bundle-entries)
    of compiled JavaScript: the change that adds it moved the 1.5 s target
    here on 2026-11-16. A stored stylesheet kind can follow its entry format,
    bound, and lock rules.
  - [postcss-config-inputs-per-record.md](./postcss-config-inputs-per-record.md):
    each record copies the configuration inputs, which a stored format
    would copy too.
  - [postcss-request-order-varies.md](./postcss-request-order-varies.md):
    the cumulative read evidence of a record depends on request order.
- **Recommendation:** B. It is the only planned work that reaches near 1 s,
  and it avoids a conflict with the bundle disk cache.
- **Action:** ask the user, because this choice starts new work and no
  recorded user decision covers it.
