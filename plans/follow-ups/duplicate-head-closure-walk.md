# Head closure reads walk the closure twice

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from `calummoore/mokly-comparison-reuse-1see`, a
  problem outside the scope that the options check of the proof-cost item
  found.
- **Location:** `crates/mokly-graph/src/session_render.rs:59-66` and
  `:68-107`, `crates/mokly-graph/src/session.rs:202-204`,
  `crates/mokly-compare/src/comparison_resources.rs:43` and `:48`,
  `crates/mokly-compare/src/move_fingerprint.rs:18`,
  `crates/mokly-server/src/comparison_capture.rs:177`, and
  `crates/mokly-server/src/comparison_graph.rs:202-208`.
- **Reason:** The repeated walk is in the render graph, outside the diff of
  the comparison reuse branch, and that branch makes no code change for it.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Closure walk:** `Walker::collect` in `crates/mokly-graph/src/closure.rs`,
    which follows the references of a composed document under the public
    closure policy.
  - **Closure read:** `RenderGeneration::closure`, which `Session::closure`
    answers for a prepared generation by running `closure_job` on the render
    workers.
- **Background:**
  - A closure walk returns a `Closure` with files, edges, evidence,
    references, and warnings.
  - `Session::closure_job` first calls `Session::artifact`. That job reads
    the composed document and walks its closure. It adds the closure warnings
    to the document and runs the link checks. Then it inserts the
    composition into the render cache and records the closure files for the
    document key.
  - `artifact` wraps a failure of its closure walk or of its link checks in
    `GraphError::Attempt` with the document warnings. Its closure walk runs
    before its link checks.
  - Then `closure_job` walks the closure of the same tree and resources a
    second time, and it returns that second result. A failure of the second
    walk returns the walker error without the `GraphError::Attempt` wrapper.
  - Both walks read the same tree and the same resources. So their results
    differ only when an input changes between them, for example when a file
    of the closure changes or vanishes.
  - Callers of the closure read include the closures of compared views in
    `comparison_resources.rs`, the move fingerprints in
    `move_fingerprint.rs`, and selected captures in `comparison_capture.rs`.
    `FrozenResources` forwards the read, then runs its checked digest read
    for each closure edge.
  - Nobody measured the cost of the second walk. Any cost is an estimate
    from the code. The proof-cost measurement of the same branch does not
    cover it, because a reused view makes no closure read.
  - A fix must keep these constraints:
    - The same checks: the closure walk, the link checks, and the cache and
      closure-file records of `artifact`.
    - The same diagnostic wrapping: `GraphError::Attempt` with the document
      warnings for a failure of the first walk or of the link checks.
    - The same order: the closure walk before the link checks, and the same
      first error.
- **Problem:** Each closure read of a prepared generation walks the closure
  of the view twice. The second walk repeats the work of the first, and its
  result equals the first unless an input changed between the walks.
- **Impact if no action:** Each compared view, move fingerprint, and
  selected capture pays for one extra closure walk on each side that it
  reads. The output stays correct.
- **Root question:** How can a closure read walk the closure once, and keep
  the same checks, diagnostic wrapping, order, and failure on changed
  inputs?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Let `artifact` hand its closure to `closure_job`, and drop the
    second walk. The checks, the wrapping, and the order of `artifact` stay.
    Concern: today the second walk can fail when an input changes between
    the two walks. B removes that failure path. A later branch must first
    show that the checked reads of each caller still catch such a change.
    Effort: Medium.
  - **C.** Keep one walked closure for each document key in the generation,
    within a fixed bound, so that each closure read of the generation walks
    at most once. This also removes repeated walks across callers. It has
    the concern of B for a longer time, because a kept closure can outlive
    an input change until the next generation. It also adds memory. Effort:
    Medium.
- **Left out:**
  - Dropping the first walk. It makes the closure warnings and the closure
    records of `artifact`, and it sets the order before the link checks.
  - A separate item for the link checks of page reads. Option E of
    `serve-comparison-proof-cost.md` shares the link checks that cause that
    cost.
- **Wider fix:** B. It gives `closure_job` one walk by construction, because
  the job takes the closure that `artifact` already made.
- **Previous examples:** None found.
- **Related:**
  - `removed-detail-usage-restore.md` notes the second walk in its option
    B, under a different root question: removed-entry usage without a
    document restore.
  - `serve-comparison-proof-cost.md` holds the link-check cost of the same
    graph code.
- **Recommendation:** B, after a later branch shows that each caller still
  catches an input change between the two walks. Otherwise keep A.
- **Action:** ask the user, because B removes a failure path for inputs that
  change between the two walks, and no requirement says whether a closure
  read must report that change. The question belongs to a later branch. This
  item makes no change to the reuse pull request.
