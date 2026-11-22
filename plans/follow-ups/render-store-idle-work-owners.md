# Enroll remaining Serve work in writer activity

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the branch
  `calummoore/mokly-first-changes-5-render-store-p3o6`, implementation review
  round 2, finding 3: its wider option and the new problems of its options
  check.
- **Location:** `crates/mokly-cli/src/serve_git.rs:111`,
  `crates/mokly-sidecar/src/pool_releases.rs:109`,
  `crates/mokly-server/src/work_delivery.rs:50`,
  `crates/mokly-server/src/work.rs:146`,
  `crates/mokly-server/src/asset_response.rs:21`, and
  `crates/mokly-server/src/response.rs:66`.
- **Reason:** The fix needs two lower-level ownership boundaries and a shared
  Git default, with their regressions, and the accepted performance goals of
  the render store do not need it.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Render store writer:** The `mokly-documents` thread that encodes and
    saves rendered documents into the Mokly cache, so that a later Serve
    process can reuse them.
  - **Unit:** One encoding of one document, or one save of one segment, by
    the render store writer.
  - **Write activity:** The writer's busy controller, `WriteActivity` in
    `crates/mokly-graph/src/write_activity.rs`. A scoped `WriteLease` stops
    new units until it drops. Its count claims no sidecar slot and changes no
    Serve admission.
  - **Idle rule:** The requirement in the Writes section of
    `docs/protocol/mokly-render-store.md` that the writer starts a new unit
    only while Serve is idle.
  - **Reference probe:** The Git work of watched Serve that resolves `HEAD`,
    the base ref, and their merge base once each second.
- **Background:**
  - The idle rule permits a new unit only after the first completed Changes
    result, ready or unavailable. After that, it permits a new unit only
    while the current revision's `changesStatus` is `ready` or `unavailable`
    and no other Serve work is in flight. A unit that already started may
    finish. A render and a publication never wait for a store write.
  - The writer checks the Changes status and the lease count before each
    unit, at `crates/mokly-compare/src/render_admission.rs:106`.
  - These owners already hold a lease: the sidecar gate and pool calls, the
    rebuilds, the head-return and warm-up maintenance worker, the render jobs
    of `Workers` in `crates/mokly-server/src/work.rs`, the captures of
    `MemoryComparisons` in `crates/mokly-server/src/comparison_store.rs`, and
    the reference probes of `ChangesPass`.
  - `ChangesPass` in `crates/mokly-server/src/changes_background.rs` owns the
    complete probe and its handoff. Each probe takes its lease before
    `spawn_blocking` queues it, and the blocking job owns the lease. A probe
    that finds moved refs keeps its lease through the queued refresh, until
    the refreshed classification ends. A lease for each Git command cannot
    replace this owner, because the commands of one probe leave gaps, and
    the handoff runs before the `pending` publication.
  - Only two production call sites use the Serve Git runner, both in
    `crates/mokly-cli/src/serve_changes_native.rs`. The reference probe, at
    line 39, holds the `ChangesPass` lease. The classification runtime, at
    line 131, runs under the `pending` status of the classification task and
    the lease that a moved-ref handoff carries. The retained-source capture
    path holds the existing capture activity.
- **Problem:** Two kinds of Serve work hold no lease, so a unit can start
  while they run:
  1. The sidecar release thread. `clean_idle` in
     `crates/mokly-sidecar/src/pool_releases.rs:109` sends `Dispose` and
     `DisposeContext` calls to idle processes through
     `pool_cleanup::cleanup`.
  2. Finite file response bodies. `asset_delivery` in
     `crates/mokly-server/src/work_delivery.rs:50` and `authored` in
     `crates/mokly-server/src/work.rs:146` hold a lease only until the file
     opens. The body then streams through
     `crates/mokly-server/src/asset_response.rs:21` and
     `crates/mokly-server/src/response.rs:66` after the lease drops.
  - Direct source reads show both missing scopes. Nobody ran an event-order
    reproduction of these paths, and nobody measured their cost.
  - The shared Serve Git wrapper has no default protection.
    `Tracked::enter` in `crates/mokly-cli/src/serve_git.rs:111` counts each
    command only for the shutdown drain. Its `Active` guard drops when the
    command returns, also on an error. So a later Git caller outside a
    covered parent would hold no lease. This alone does not show that a
    current Git command runs outside every parent activity or status. No
    untracked current Git command execution was reproduced.
- **Impact if no action:** Some encodings and saves can overlap release-thread
  maintenance and finite file bodies, against the idle rule. A later Git caller
  outside a covered parent would add the same gap. No output changes. The
  overlap costs little: a dispose call, a file read, or a Git command uses no
  encoder lease and no transit reserve of the render cache.
- **Root question:** How can optional writes stay paused for every relevant
  Serve work lifetime without changing output or scheduling?
- **Options:**
  - **A.** Enroll the two uncovered owners in the existing write activity, at
    their complete owner boundaries, and add the Git default. Add a barrier
    regression for each owner, with no timer. Effort: Medium.
    - Git commands, as the default protection for every current and later
      caller: take a lease for each command in `Tracked::enter`, beside
      the shutdown count, and drop it with the `Active` guard, also on an
      error or a cancellation. Do not hold a lease for the life of a runner.
      A retained base source keeps its runner through
      `crates/mokly-git/src/repository.rs:131` and
      `crates/mokly-compare/src/sources.rs:59`, so a runner lease keeps the
      writer paused while that source lives. Pass the activity to
      `ServeGit::new` on the existing line
      `crates/mokly-cli/src/entry_serve.rs:121`, because that file is at the
      300-line cap.
    - Release thread: give the pool the activity, and hold a lease for each
      queued or running cleanup pass at its actual owner. Keep the pool's
      scheduling, root and claim priority, process and render caps, and
      replacement rules.
    - File bodies: carry the lease of a finite file response until its body
      completes or the client cancels it. Do not hold a lease for the
      perpetual event stream, which is outside the finite file path.
  - **B.** Apply A for Git commands only. Every current and later Serve Git
    command then holds a lease at the shared wrapper. The two demonstrated
    gaps, the release thread and the file bodies, stay uncovered. Effort:
    Small.
  - **C.** Add one `mokly-server` helper that runs each blocking Serve job
    under a lease, and move all 14 `spawn_blocking` sites in nine files to it.
    A later blocking job then cannot miss the lease. It does not cover the
    CLI Git wrapper, the sidecar release thread, or a response body after its
    job. Effort: Medium.
  - **D.** Narrow the idle rule instead of the code. State that
    release-thread maintenance and finite file bodies are not Serve work for
    the rule. It changes no code. It narrows a requirement that the user set,
    so it needs a separate user choice. Effort: Small.
- **Left out:**
  - A lease for the life of a Git runner. A retained base source would keep
    the writer paused, which fails the goal that writes resume when Serve is
    idle.
  - A lease for the perpetual event stream. Serve would never be idle while a
    browser stays connected.
  - A new counter, gate, scheduler, worker, timer, retry, or setting. The
    existing controller already wakes the writer when the last lease drops,
    so A is better on every point.
  - A lint or a test for the class. It is a detection fix, which needs a user
    decision, and A removes the cases by structure.
  - A readiness input from the `ServeGit` command count. A lease gives the
    same cover and already wakes the writer, so A is better on every point.
  - Change nothing. The idle rule stays false for these paths.
- **Wider fix:** A. It puts both uncovered owners under the one existing
  controller at their complete boundaries. Its Git default protects later Git
  callers at the shared wrapper. So the class needs no new counter or
  detection.
- **Previous examples:** The `ChangesPass` probe and handoff owner in
  `crates/mokly-server/src/changes_background.rs`, and the existing owners in
  `crates/mokly-server/src/work.rs`,
  `crates/mokly-server/src/comparison_store.rs`,
  `crates/mokly-cli/src/serve_pool.rs`,
  `crates/mokly-cli/src/serve_rebuild.rs`, and
  `crates/mokly-cli/src/serve_return.rs`.
- **Related:** `plans/follow-ups/sidecar-maintenance-admission.md` covers the
  same `clean_idle` path for a different count. That item counts maintenance
  in the Serve gate's admitted sidecar calls, for slot capacity and HTTP
  priority. This item counts write activity leases, which claim no slot and
  change no admission. Each item keeps its own decision, and neither fix
  replaces the other.
- **Recommendation:** A. It uses the existing controller at each complete
  owner, keeps every output and scheduling rule, and adds no counter, gate,
  or lint.
- **Action:** fix after merge, apply A, because it needs two lower-level
  ownership boundaries and the shared Git default, with their regressions, and
  the accepted performance goals do not need it.
- **Done when:** The release thread and finite file bodies hold a lease for
  their complete work, each Serve Git command holds one in the shared wrapper,
  a barrier regression proves each owner, and the commit removes the status
  lines that link this item from `docs/protocol/mokly-render-store.md` and
  `docs/architecture/rust-core.md`.
