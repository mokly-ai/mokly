# Compile outcomes depend on operation event kinds

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 92, option D.
  The branch applied option B of that finding, an exhaustive classification
  of compile events. This item is its wider fix.
- **Location:** `crates/mokly-sidecar/src/operations.rs:9`,
  `crates/mokly-sidecar/src/process_worker.rs:90`,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs:156`,
  `crates/mokly-sidecar/src/pool_requests.rs:149`,
  `packages/mokly/src/sidecar/session.ts:94`, and the `bundle` row of the
  methods table in `docs/protocol/mokly-sidecar.md`.
- **Reason:** D adds a wire field to the `bundle` reply and changes its row
  in the sidecar methods table.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Sidecar:** The Node process that compiles and renders catalogue code
    for the Rust binary. The pool runs several sidecar processes.
  - **Operation event:** The `operation` event that a sidecar emits for each
    catalogue `esbuild` call, each Vite compile, and each PostCSS worker
    start or stop.
  - **`cache` value:** The label of a `catalogue.bundle` timing span. The
    values `memory` and `hit` mean that the sidecar did not compile.
  - **Head bundle affinity:** The pool's rank of the idle head processes by
    their last compile, newest first.
  - **Reuse branch:** The branch of the sidecar session at
    `packages/mokly/src/sidecar/session.ts:94` to line 103. It decides once
    for each `bundle` request, on both compilers, whether the request reuses
    an earlier compile.
- **Background:**
  - `docs/protocol/mokly-sidecar-head-bundle-affinity.md` ranks the idle head
    processes by their last compile, for a head `bundle` and a head
    `transformViteCss` call. A successful `bundle` counts as a compile unless
    its `cache` value is `memory` or `hit`. A `transformViteCss` call reuses
    the Vite server of the last compiler, and it does not move the rank.
  - `docs/protocol/mokly-timings.md` says that the sidecar compiled for every
    `cache` value except `memory` and `hit`.
  - The core uses the operation events for exact counts, also of failed
    calls. See the section "Operation Events" of
    `docs/protocol/mokly-sidecar-recipes.md`. A Vite compile emits `vite`
    and no `esbuild`, as `docs/protocol/mokly-vite-adapter.md:191` and
    `tests/sidecar_vite.test.ts:74` show.
  - Commit `a16a623e6` replaced the pool's inference of a compile from a new
    runtime key with event counts. Shared recipes let a reuse return a key
    that the pool did not list. That commit fixed the inverse error, in which
    the pool treated a bundle reuse as an esbuild compile.
  - The Vite path also runs a non-catalogue esbuild call that sends no event,
    at `packages/mokly/src/sidecar/vite-peers.ts:34`.
  - The sidecar sends the short `bundle` reply only after a reuse, at
    `session.ts:134`. A `serveEdit` request can reuse a marked Vite compile,
    at `packages/mokly/src/sidecar/compiled.ts:147`.
  - On 2026-11-25 the branch that found this item applied option B below.
    The operation type now has one exhaustive classification of compile
    events, and the worker counts with it.
  - The finding check of 2026-11-25 said that the `bundle` row of the methods
    table is a requirement, so that the user decides its change. The final
    call of the same date made D a fix after merge.
- **Problem:**
  - Before the direct fix, the worker counted only `esbuild` events. A fresh
    Vite compile reached the pool with a count of zero. The pool labelled it
    `memory` and left the compile rank of the worker unchanged. The worker
    count test at `crates/mokly-sidecar/src/_tests_/process_bundle_tests.rs:43`
    emitted only esbuild and PostCSS events.
  - The `cache` label and the head rank still infer the outcome from the
    operation events of each compile path. A compile path that sends no
    event, or a new event kind outside the classification, reads as a reuse.
- **Impact if no action:** Timing reports can show false cache hits. When
  several head workers are idle, a stylesheet request can select one that
  has to load another Vite setup.
- **Root question:** How should Rust tell a fresh compile from a reused
  bundle on either compile path?
- **Options:**
  - **A.** Count both `esbuild` and `vite` in the worker. Add a fresh Vite
    request to the count test. Effort: Small.
  - **B.** Give the operation type one exhaustive classification of compile
    events, and use it in the worker. Extend the count test. List Vite in the
    operation event and timing docs, in the count sentence at
    `crates/mokly-sidecar/README.md:260`, and in the `compile_count` comment
    at `crates/mokly-sidecar/src/results.rs:69`. The branch applied B on
    2026-11-25. Effort: Small.
  - **C.** Carry the compile count in the bundle replies of the sidecar. This
    needs a wire change for both the full and the short reply. Effort:
    Medium.
  - **D.** Report the outcome from the one reuse branch:
    - Add a reuse field to the full `bundle` reply. Set it from the
      `previous` branch at `session.ts:94`.
    - The short reply needs no field, because the sidecar sends it only after
      a reuse.
    - The pool classifies from the field, and it keeps the disk seed key
      check for `hit`.
    - The operation events stay for the `sidecar.operation` counts only.
    - A new compile path then cannot read as a reuse.
    - Cost: a wire field, the generated types, the Rust reply decode, the
      pool provenance tests, and the `bundle` row of the methods table in
      `docs/protocol/mokly-sidecar.md`.
    - Risk: a new reuse path outside the branch reads as a compile. That is
      the inverse error that commit `a16a623e6` fixed.
    - Effort: Medium.
- **Left out:**
  - Infer a fresh compile from the `vite` setting. A `serveEdit` request can
    reuse a marked Vite compile, so it fails the goal.
  - Send an `esbuild` event beside `vite` for each Vite compile. It breaks
    the exact operation counts, a requirement that stays.
  - Infer a compile from a new runtime key in `complete_bundle`. Commit
    `a16a623e6` replaced that inference, because shared recipes let a reuse
    return a key that the pool did not list. So it fails the goal.
  - Rank `transformViteCss` calls by the Vite setup that each process holds,
    at `crates/mokly-sidecar/src/pool_affinity.rs:48`. It leaves the `memory`
    label of `catalogue.bundle` wrong. The last compiler already holds the
    newest setup after the direct fix.
- **Wider fix:** D. D takes the outcome from the one reuse branch, so it does
  not need to know which events mark a compile. B must still classify each
  new event kind, and it misses a compile path that sends no event. B stays
  the widest fix without a wire change.
- **Previous examples:** Commit `a16a623e6` corrected the inverse error, in
  which the pool treated a bundle reuse as an esbuild compile.
- **Related:** `plans/follow-ups/sidecar-bundle-row-fields.md` changes the
  same `bundle` row of the methods table. Make both row changes in one edit
  when both items are open.
- **Recommendation:** D. The outcome then comes from the place that decides
  it, so no compile path can read as a reuse.
- **Action:** fix after merge, apply D, because D adds a wire field that
  changes a row of the sidecar methods table.
