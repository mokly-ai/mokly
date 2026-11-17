# Removed details restore base documents for usage

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the branch
  `calummoore/mokly-base-usage-without-restore-g972`, a new problem that the
  options check of its plan found.
- **Location:** `crates/mokly-compare/src/projection_removed.rs:82` and
  line 90, `crates/mokly-graph/src/session.rs:171` and line 187,
  `crates/mokly-graph/src/session_render.rs:68`,
  `crates/mokly-server/src/comparison_graph.rs:104` and line 109, and
  `CapturedGeneration::render` in
  `crates/mokly-compare/src/capture_generation.rs` and `capture_with_bound` in
  `crates/mokly-compare/src/comparison_capture.rs`.
- **Reason:** The branch that found this path moved only workspace input
  projection to the new usage read, and this path reads through `render`,
  whose source checks differ from that read.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Capture:** `CapturedGeneration` in
    `crates/mokly-compare/src/capture_generation.rs`. It is a bounded store of
    one side's compressed documents and their retained metadata, usage
    included.
  - **Kept view:** a view that the capture holds. The capture reads every
    other view from its source generation.
  - **Usage:** the `CatalogueUsage` records of one view: the component
    instances that it renders, with their props.
  - **Removed entry:** a base catalogue entry that the working tree no longer
    has. Its entry detail lives in the comparison generation.
- **Background:**
  - `projection_removed::details` builds the entry detail of each removed
    entry. For each base document plan of the entry, it calls
    `result.before.render(&plan.route)` at
    `crates/mokly-compare/src/projection_removed.rs:82`. It then copies only
    the usage of that document into the matching detail view, at line 90.
  - The details of removed pages and documents have no views, because their
    plans have no viewport. Their reads therefore copy nothing.
  - `result.before` is the base capture. When the base validation summary
    does not fit the 256 MiB capture bound, `capture_with_bound` returns the
    base generation without a capture.
  - `CapturedGeneration::render` reads `comparison_document`. For a kept
    view, that read decompresses the document and decodes its tree. For
    another view, it reads `comparison_document` of the source.
  - Serve runs this projection when it accepts a classification, at
    `crates/mokly-server/src/changes_execution.rs:135`. It runs it again when
    it publishes that classification as ready, at
    `crates/mokly-server/src/changes.rs:174`. Both calls reach
    `crates/mokly-server/src/comparison_metadata.rs:53`. A static build with
    Changes runs it once, at `crates/mokly-static/src/comparison_output.rs:33`.
  - On 2026-11-16, `RenderGeneration::comparison_usage` was added in
    `crates/mokly-graph/src/types.rs`. Its default reads `comparison_document`.
    A capture returns the retained usage of a kept view without a restore, and
    reads other views from its source. Wrappers that add checks keep the
    default, such as `FrozenResources` in
    `crates/mokly-server/src/comparison_graph.rs`. Wrappers that add no checks
    forward it. Workspace input projection moved to this read. Removed details
    stayed on `render`.
  - On a base without a capture, `render` checks more than
    `comparison_document`:
    - `Session::render` at `crates/mokly-graph/src/session.rs:187` runs the
      document job at `crates/mokly-graph/src/session_render.rs:68` on the
      render worker pool. The job walks the public closure of the view again
      and checks the links. It wraps a closure or link failure in
      `GraphError::Attempt` with the document warnings.
    - `Session::comparison_document` at
      `crates/mokly-graph/src/session.rs:171` checks only the links. It
      returns a link failure without that wrapper.
    - `FrozenResources` checks the document digest on both reads, at
      `crates/mokly-server/src/comparison_graph.rs:104` and line 109.
    - Complete base validation walks every closure before the comparison
      starts, at `crates/mokly-graph/src/session_collection.rs:74`.
  - The performance task of 2026-11-16 that found this path required equal
    public output, errors, input change order, and capture memory bounds.
- **Problem:** Each kept base view of a removed entry decompresses and
  decodes its whole document only to supply its usage. The capture already
  retains that usage outside the compressed payload.
- **Impact if no action:** Each ready publication of Serve, and each static
  build with Changes, decompresses and decodes each kept base view of a
  removed entry. The output stays correct.
- **Root question:** How can removed-entry details read base usage without a
  document restore, while each source read keeps its checks and errors?
- **Options:**
  - **A.** Change nothing. Removed entries are usually few, so the cost is
    small. Effort: Small.
  - **B.** Call `comparison_usage` in `projection_removed::details`. A kept
    view then returns its retained usage. A captured base keeps its source
    reads, because its `render` already reads `comparison_document`. A base
    without a capture loses the second closure walk and the
    `GraphError::Attempt` wrapper of a link failure. Its checks then match the
    checks of a captured base. Effort: Small.
  - **C.** Add a second usage read to `RenderGeneration`, with a default that
    reads `render`. A capture answers it with its `comparison_usage` read,
    because its `render` already reads `comparison_document`. Wrappers that
    add checks keep the default, and other wrappers forward it. Call it in
    `projection_removed::details`. Write the wrapper rule on the trait and in
    `crates/mokly-graph/README.md`, beside the rule of `comparison_usage`.
    Test that removed details over a captured base call the document
    restorer zero times, with `DocumentRestorer` in
    `crates/mokly-compare/src/capture_restore.rs`. The trait then has two
    usage reads. Effort: Small.
  - **D.** In `projection_removed::details`, call `comparison_usage` when
    `result.before.comparison_capture()` returns a capture, and call `render`
    otherwise. It needs no trait change. The projection then depends on the
    capture handle, which exists to reuse a capture, not to select a read.
    Effort: Small.
- **Left out:**
  - Keep a copy of removed-entry usage in the comparison result. It
    duplicates usage that the capture already retains. A recorded call of
    2026-11-16 rejected a second retained usage copy, because it adds memory
    to every retained result.
  - Compute the removed details once for each accepted classification in
    Serve. It fails the goal, because each acceptance and each static build
    still restores each kept document.
  - Skip the plans without a viewport. It drops the errors of those source
    reads on a base without a capture, so errors do not stay equal. B, C, and
    D already make the read of a kept view cheap.
- **Wider fix:** C. Each document read of a generation then has a usage read
  with the same checks, so no usage-only reader needs a restore.
- **Previous examples:** Workspace input projection, in
  `crates/mokly-compare/src/projection_inputs.rs`, restored each kept base
  document through `comparison_document` only for its usage, until
  2026-11-16.
- **Recommendation:** C. It removes the restore and keeps every check and
  error of the current reads. B is simpler, and it gives a base without a
  capture the checks of a captured base. Choose B if the user accepts that
  change of checks.
- **Action:** fix after merge, apply C, because the branch that found this
  path was limited to workspace input projection.

The plan that found this path is the
[plan at its first commit](https://github.com/mokly-ai/mokly/blob/76ee1415f19534ec18d5fd1eb9e077c0765b14b1/plans/base-usage-without-restore.md?plain=1).
